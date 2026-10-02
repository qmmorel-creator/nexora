-- =============================================================================
-- Nexora · brouillon de schéma Supabase (Postgres 15+) — Ref #603
--
--   ***  NON APPLIQUÉ. NE PAS EXÉCUTER SUR UN PROJET EXISTANT.  ***
--
-- Document d'étude (docs/migration-supabase/02-architecture-cible.md). Il n'a
-- été exécuté sur aucune base ; seule sa syntaxe a été contrôlée hors base
-- (voir 03-plan-migration.md, § Vérifications). Les noms, rôles et limites
-- sont des propositions à valider.
--
-- Principes :
--   1. Phase 1 = PARITÉ. Le modèle actuel est un magasin clé-valeur de gros
--      blobs JSON (users/{uid}/kv_store/{clé}, voir 01-inventaire §3). On le
--      reproduit tel quel (table kv_entries, valeur jsonb) pour changer de
--      backend SANS toucher aux 78 000 lignes du front. La segmentation
--      (chunked-v1, 150 000 caractères) disparaît : elle n'existe que pour
--      contourner la limite de 1 Mio d'un document Firestore.
--   2. Multi-tenant dès la phase 1 : la clé de partition est workspace_id,
--      pas user_id. Un compte migré obtient un espace personnel ; le partage
--      d'un espace entre plusieurs comptes devient possible sans re-migrer.
--   3. Le client navigateur n'écrit JAMAIS directement dans les tables :
--      lectures via RLS, écritures via les fonctions kv_put / kv_delete (contrôle
--      de révision atomique, équivalent du runTransaction actuel).
--   4. Tables serveur (audit, MCP, OAuth, QME) : RLS activée sans politique
--      d'écriture → accessibles uniquement par service_role.
-- =============================================================================

create schema if not exists nexora;

-- -----------------------------------------------------------------------------
-- 1. Locataires, membres, profils
-- -----------------------------------------------------------------------------

create table nexora.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 200),
  plan        text not null default 'free' check (plan in ('free', 'pro', 'team', 'internal')),
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create table nexora.workspace_members (
  workspace_id uuid not null references nexora.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_idx on nexora.workspace_members (user_id);

-- Un seul propriétaire par espace.
create unique index workspace_single_owner_idx
  on nexora.workspace_members (workspace_id) where role = 'owner';

-- Correspondance avec l'identifiant Firebase : un UID Firebase n'est pas un
-- UUID, il ne peut donc pas devenir auth.users.id tel quel (02 §3).
create table nexora.profiles (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  legacy_firebase_uid   text unique,
  default_workspace_id  uuid references nexora.workspaces (id) on delete set null,
  created_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. Fonctions d'appartenance (utilisées par la RLS)
--    SECURITY DEFINER pour éviter la récursion de RLS sur workspace_members ;
--    search_path figé ; (select auth.uid()) pour que l'appel soit évalué une
--    fois par requête et non une fois par ligne.
-- -----------------------------------------------------------------------------

create or replace function nexora.role_in(p_workspace uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from nexora.workspace_members m
  where m.workspace_id = p_workspace
    and m.user_id = (select auth.uid());
$$;

create or replace function nexora.can_read(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select nexora.role_in(p_workspace) is not null;
$$;

create or replace function nexora.can_write(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nexora.role_in(p_workspace) in ('owner', 'admin', 'member'), false);
$$;

create or replace function nexora.can_admin(p_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(nexora.role_in(p_workspace) in ('owner', 'admin'), false);
$$;

revoke all on function nexora.role_in(uuid), nexora.can_read(uuid),
  nexora.can_write(uuid), nexora.can_admin(uuid) from public, anon;
grant execute on function nexora.role_in(uuid), nexora.can_read(uuid),
  nexora.can_write(uuid), nexora.can_admin(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. Magasin clé-valeur (parité avec users/{uid}/kv_store)
-- -----------------------------------------------------------------------------

create table nexora.kv_entries (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  key           text not null check (key ~ '^[A-Za-z0-9:_-]{1,160}$'),   -- même motif que nexora-storage.mts:232
  value         jsonb not null,
  revision      uuid not null default gen_random_uuid(),
  source        text not null default 'browser'
                  check (source in ('browser', 'assistant-api', 'mcp', 'migration', 'todoist')),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references auth.users (id) on delete set null,
  -- même plafond que le relais actuel (nexora-storage.mts:245)
  constraint kv_entries_size_ck check (octet_length(value::text) <= 12000000),
  primary key (workspace_id, key)
);
-- list(prefix) : la PK couvre "where workspace_id = $1 and key like 'nexora:%'"
-- uniquement avec un opclass de motif ; index dédié :
create index kv_entries_prefix_idx on nexora.kv_entries (workspace_id, key text_pattern_ops);

-- Historique optionnel des révisions (remplacerait à terme nexora:snapshot:*).
-- Purge par tâche planifiée (pg_cron) ; volumétrie à mesurer avant activation.
create table nexora.kv_history (
  workspace_id  uuid not null,
  key           text not null,
  revision      uuid not null,
  value         jsonb not null,
  source        text not null,
  updated_at    timestamptz not null,
  updated_by    uuid,
  primary key (workspace_id, key, revision),
  foreign key (workspace_id) references nexora.workspaces (id) on delete cascade
);
create index kv_history_recent_idx on nexora.kv_history (workspace_id, key, updated_at desc);

-- Écriture conditionnelle : équivalent de runTransaction + expectedRevision
-- (index.html.part-000:960-1042, nexora-storage.mts:146-206).
--   p_expected_revision NULL  => la clé ne doit pas exister (création)
--   sinon                     => la révision stockée doit être égale
-- Conflit => SQLSTATE 'NX409' (traduit en HTTP 409 NEXORA_SYNC_CONFLICT).
create or replace function nexora.kv_put(
  p_workspace          uuid,
  p_key                text,
  p_value              jsonb,
  p_expected_revision  uuid,
  p_source             text default 'browser',
  p_keep_history       boolean default false
)
returns table (revision uuid, updated_at timestamptz)
language plpgsql
security invoker            -- la RLS de l'appelant s'applique
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_new uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_old nexora.kv_entries%rowtype;
begin
  if p_expected_revision is null then
    insert into nexora.kv_entries as e (workspace_id, key, value, revision, source, updated_at, updated_by)
    values (p_workspace, p_key, p_value, v_new, p_source, v_now, auth.uid())
    on conflict (workspace_id, key) do nothing;
    if not found then
      raise exception 'NEXORA_SYNC_CONFLICT: % existe déjà', p_key using errcode = 'NX409';
    end if;
  else
    select * into v_old from nexora.kv_entries e
     where e.workspace_id = p_workspace and e.key = p_key
     for update;
    if not found or v_old.revision <> p_expected_revision then
      raise exception 'NEXORA_SYNC_CONFLICT: %', p_key using errcode = 'NX409';
    end if;
    if p_keep_history then
      insert into nexora.kv_history (workspace_id, key, revision, value, source, updated_at, updated_by)
      values (v_old.workspace_id, v_old.key, v_old.revision, v_old.value, v_old.source, v_old.updated_at, v_old.updated_by);
    end if;
    update nexora.kv_entries e
       set value = p_value, revision = v_new, source = p_source,
           updated_at = v_now, updated_by = auth.uid()
     where e.workspace_id = p_workspace and e.key = p_key;
  end if;
  return query select v_new, v_now;
end;
$$;

create or replace function nexora.kv_delete(
  p_workspace          uuid,
  p_key                text,
  p_expected_revision  uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from nexora.kv_entries e
   where e.workspace_id = p_workspace and e.key = p_key and e.revision = p_expected_revision;
  if not found then
    raise exception 'NEXORA_SYNC_CONFLICT: %', p_key using errcode = 'NX409';
  end if;
end;
$$;

-- Commit multi-clés tout-ou-rien avec préconditions : équivalent du
-- `:commit` REST + `currentDocument` déjà utilisé par nexora-storage.mts:185-206,
-- et brique unique des « transactions » serveur (appendTaskIdempotently,
-- mutateTaskAtomically, MCP atomic). La logique métier reste en JS : lire,
-- calculer, appeler kv_commit, recommencer sur NX409 (03 §1.2).
--   p_writes : [{ "op": "put"|"delete", "key": text, "value": jsonb,
--                 "expected_revision": uuid|null }]
--   p_audit  : [{ "id": text, "event_type": text, "occurred_at": timestamptz, "payload": jsonb }]
--   p_mcp_op : { "id": text, "operation": text, "request_hash": text, "result": jsonb } | null
create or replace function nexora.kv_commit(
  p_workspace  uuid,
  p_writes     jsonb,
  p_source     text,
  p_audit      jsonb default '[]'::jsonb,
  p_mcp_op     jsonb default null
)
returns jsonb                        -- { "<clé>": "<nouvelle révision>" , … }
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  w        jsonb;
  v_key    text;
  v_exp    uuid;
  v_cur    uuid;
  v_new    uuid;
  v_out    jsonb := '{}'::jsonb;
  v_now    timestamptz := now();
begin
  -- 1. Verrouiller dans un ordre stable (évite les interblocages) et vérifier.
  for w in select x from jsonb_array_elements(p_writes) as t(x) order by x->>'key' loop
    v_key := w->>'key';
    v_exp := nullif(w->>'expected_revision', '')::uuid;
    select e.revision into v_cur from nexora.kv_entries e
     where e.workspace_id = p_workspace and e.key = v_key for update;
    if v_cur is distinct from v_exp then
      raise exception 'NEXORA_SYNC_CONFLICT: %', v_key using errcode = 'NX409';
    end if;
  end loop;

  -- 2. Idempotence MCP : une clé déjà vue => rejouer ou refuser.
  if p_mcp_op is not null then
    insert into nexora.mcp_operations (workspace_id, id, operation, request_hash, result)
    values (p_workspace, p_mcp_op->>'id', p_mcp_op->>'operation', p_mcp_op->>'request_hash', p_mcp_op->'result')
    on conflict (workspace_id, id) do nothing;
    if not found then
      raise exception 'NEXORA_IDEMPOTENT_REPLAY: %', p_mcp_op->>'id' using errcode = 'NX208';
    end if;
  end if;

  -- 3. Appliquer.
  for w in select x from jsonb_array_elements(p_writes) as t(x) loop
    v_key := w->>'key';
    if w->>'op' = 'delete' then
      delete from nexora.kv_entries e where e.workspace_id = p_workspace and e.key = v_key;
    else
      v_new := gen_random_uuid();
      insert into nexora.kv_entries as e (workspace_id, key, value, revision, source, updated_at, updated_by)
      values (p_workspace, v_key, w->'value', v_new, p_source, v_now, auth.uid())
      on conflict (workspace_id, key) do update
        set value = excluded.value, revision = excluded.revision, source = excluded.source,
            updated_at = excluded.updated_at, updated_by = excluded.updated_by;
      v_out := v_out || jsonb_build_object(v_key, v_new);
    end if;
  end loop;

  -- 4. Audit idempotent (même id => ignoré, comme recordAuditEvent).
  insert into nexora.audit_events (workspace_id, id, event_type, occurred_at, payload)
  select p_workspace, a->>'id', a->>'event_type', (a->>'occurred_at')::timestamptz, coalesce(a->'payload', '{}'::jsonb)
    from jsonb_array_elements(p_audit) as t(a)
  on conflict (workspace_id, id) do nothing;

  return v_out;
end;
$$;

revoke all on function nexora.kv_put(uuid, text, jsonb, uuid, text, boolean),
  nexora.kv_delete(uuid, text, uuid) from public, anon;
grant execute on function nexora.kv_put(uuid, text, jsonb, uuid, text, boolean),
  nexora.kv_delete(uuid, text, uuid) to authenticated, service_role;
-- kv_commit écrit audit_events et mcp_operations : réservé au serveur.
revoke all on function nexora.kv_commit(uuid, jsonb, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function nexora.kv_commit(uuid, jsonb, text, jsonb, jsonb) to service_role;

-- -----------------------------------------------------------------------------
-- 4. Tables serveur (écrites par les fonctions Netlify / le MCP en service_role)
-- -----------------------------------------------------------------------------

-- users/{uid}/assistant_audit (_shared/nexora.ts:206-235)
create table nexora.audit_events (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  id            text not null,                     -- sha256(idempotencyKey), comme aujourd'hui
  event_type    text not null,
  occurred_at   timestamptz not null,
  payload       jsonb not null default '{}'::jsonb,
  primary key (workspace_id, id)
);
create index audit_events_time_idx on nexora.audit_events (workspace_id, occurred_at);

-- users/{uid}/assistant_reports (_shared/nexora.ts:240)
create table nexora.assistant_reports (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  report_date   date not null,
  kind          text not null check (kind in ('morning', 'evening')),
  payload       jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, report_date, kind)
);

-- users/{uid}/nexora_mcp_operations (apps/nexora-mcp/src/nexora.mts:206)
create table nexora.mcp_operations (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  id            text not null,                     -- sha256(clé d'idempotence)
  operation     text not null,
  request_hash  text not null,
  result        jsonb,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, id)
);
create index mcp_operations_time_idx on nexora.mcp_operations (workspace_id, created_at desc);

-- nexora_mcp_codes / _access / _refresh (gateway.mts:38-45) : une table, un type.
create table nexora.mcp_oauth_tokens (
  token_hash    text primary key,                  -- sha256 base64url du jeton opaque
  kind          text not null check (kind in ('code', 'access', 'refresh')),
  user_id       uuid not null references auth.users (id) on delete cascade,
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  client_id     text not null,
  scope         text not null,
  resource      text not null,
  extra         jsonb not null default '{}'::jsonb, -- redirect_uri, code_challenge…
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);
create index mcp_oauth_tokens_expiry_idx on nexora.mcp_oauth_tokens (expires_at);

-- Consommation à usage unique (code, refresh) : remplace runTransaction get+delete (gateway.mts:94-99).
create or replace function nexora.mcp_oauth_consume(p_kind text, p_token_hash text)
returns nexora.mcp_oauth_tokens
language sql
security invoker
set search_path = ''
as $$
  delete from nexora.mcp_oauth_tokens t
   where t.token_hash = p_token_hash and t.kind = p_kind and t.expires_at > now()
  returning t.*;
$$;
revoke all on function nexora.mcp_oauth_consume(text, text) from public, anon, authenticated;
grant execute on function nexora.mcp_oauth_consume(text, text) to service_role;

-- users/{uid}/qme_intake_ratelimit et qme_intake_nonces (nexora-qme-intake.ts:63-78)
create table nexora.qme_rate_limits (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  bucket        text not null,                     -- '{ipHash}:{fenêtre}' ou 'global:{fenêtre}'
  hits          integer not null default 0,
  expires_at    timestamptz not null,
  primary key (workspace_id, bucket)
);
create table nexora.qme_nonces (
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  nonce_hash    text not null,
  expires_at    timestamptz not null,
  primary key (workspace_id, nonce_hash)
);

-- -----------------------------------------------------------------------------
-- 5. Pièces jointes (nouveau : aujourd'hui data-URL ≤ 350 Ko dans le JSON
--    des tâches, index.html.part-002:12470-12489). Métadonnées ici, binaire
--    dans le bucket Storage privé 'attachments' (02 §5).
-- -----------------------------------------------------------------------------

create table nexora.attachments (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references nexora.workspaces (id) on delete cascade,
  task_id       text not null,                     -- id métier de la tâche (8 car. base 36)
  storage_path  text not null unique,              -- '{workspace_id}/{id}/{nom}'
  name          text not null,
  mime          text,
  size_bytes    bigint not null check (size_bytes between 0 and 52428800),
  sha256        text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,
  constraint attachments_path_prefix_ck check (storage_path like workspace_id::text || '/%')
);
create index attachments_task_idx on nexora.attachments (workspace_id, task_id);

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------

alter table nexora.workspaces         enable row level security;
alter table nexora.workspace_members  enable row level security;
alter table nexora.profiles           enable row level security;
alter table nexora.kv_entries         enable row level security;
alter table nexora.kv_history         enable row level security;
alter table nexora.audit_events       enable row level security;
alter table nexora.assistant_reports  enable row level security;
alter table nexora.mcp_operations     enable row level security;
alter table nexora.mcp_oauth_tokens   enable row level security;
alter table nexora.qme_rate_limits    enable row level security;
alter table nexora.qme_nonces         enable row level security;
alter table nexora.attachments        enable row level security;

-- Espaces : lecture par les membres ; renommage par owner/admin.
-- Création d'un espace : par une fonction serveur (pas de politique INSERT).
create policy workspaces_select on nexora.workspaces
  for select to authenticated using (nexora.can_read(id));
create policy workspaces_update on nexora.workspaces
  for update to authenticated using (nexora.can_admin(id)) with check (nexora.can_admin(id));

-- Membres : visibles par les membres ; gérés par owner/admin, sans pouvoir
-- créer ni retirer un 'owner' (transfert de propriété = fonction serveur).
create policy members_select on nexora.workspace_members
  for select to authenticated using (nexora.can_read(workspace_id));
create policy members_insert on nexora.workspace_members
  for insert to authenticated with check (nexora.can_admin(workspace_id) and role <> 'owner');
create policy members_update on nexora.workspace_members
  for update to authenticated
  using (nexora.can_admin(workspace_id) and role <> 'owner')
  with check (nexora.can_admin(workspace_id) and role <> 'owner');
create policy members_delete on nexora.workspace_members
  for delete to authenticated using (nexora.can_admin(workspace_id) and role <> 'owner');

-- Profil : chacun le sien.
create policy profiles_self on nexora.profiles
  for select to authenticated using (user_id = (select auth.uid()));

-- Clé-valeur : lecture par tout membre ; écriture par owner/admin/member.
-- Les politiques d'écriture servent aussi de garde-fou pour kv_put/kv_delete
-- (SECURITY INVOKER).
create policy kv_select on nexora.kv_entries
  for select to authenticated using (nexora.can_read(workspace_id));
create policy kv_insert on nexora.kv_entries
  for insert to authenticated with check (nexora.can_write(workspace_id));
create policy kv_update on nexora.kv_entries
  for update to authenticated
  using (nexora.can_write(workspace_id)) with check (nexora.can_write(workspace_id));
create policy kv_delete on nexora.kv_entries
  for delete to authenticated using (nexora.can_write(workspace_id));

create policy kv_history_select on nexora.kv_history
  for select to authenticated using (nexora.can_read(workspace_id));
create policy kv_history_insert on nexora.kv_history
  for insert to authenticated with check (nexora.can_write(workspace_id));

-- Lecture seule pour les membres ; écriture service_role uniquement.
create policy audit_select on nexora.audit_events
  for select to authenticated using (nexora.can_read(workspace_id));
create policy reports_select on nexora.assistant_reports
  for select to authenticated using (nexora.can_read(workspace_id));
create policy mcp_ops_select on nexora.mcp_operations
  for select to authenticated using (nexora.can_read(workspace_id));

-- mcp_oauth_tokens, qme_rate_limits, qme_nonces : aucune politique =>
-- inaccessibles à anon/authenticated (équivalent de « inaccessibles aux
-- clients », docs/MIGRATION_GITHUB.md:63).

create policy attachments_select on nexora.attachments
  for select to authenticated using (nexora.can_read(workspace_id));
create policy attachments_insert on nexora.attachments
  for insert to authenticated with check (nexora.can_write(workspace_id));
create policy attachments_delete on nexora.attachments
  for delete to authenticated using (nexora.can_write(workspace_id));

-- Droits de table explicites (Supabase accorde par défaut tout à anon/authenticated
-- sur public ; ici schéma dédié, on n'accorde que le nécessaire).
grant usage on schema nexora to authenticated, service_role;
grant select on all tables in schema nexora to authenticated;
grant insert, update, delete on nexora.kv_entries, nexora.kv_history, nexora.attachments,
  nexora.workspace_members to authenticated;
grant update on nexora.workspaces to authenticated;
revoke all on nexora.mcp_oauth_tokens, nexora.qme_rate_limits, nexora.qme_nonces from authenticated;
grant all on all tables in schema nexora to service_role;

-- -----------------------------------------------------------------------------
-- 7. Storage : bucket privé 'attachments' (à créer par la console ou l'API).
--    Chemin imposé : '{workspace_id}/…' ; contrôle par le premier segment.
-- -----------------------------------------------------------------------------

create policy attachments_bucket_read on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments'
         and nexora.can_read(((storage.foldername(name))[1])::uuid));
create policy attachments_bucket_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments'
              and nexora.can_write(((storage.foldername(name))[1])::uuid));
create policy attachments_bucket_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments'
         and nexora.can_write(((storage.foldername(name))[1])::uuid));

-- -----------------------------------------------------------------------------
-- 8. Temps réel (OPTIONNEL — la production actuelle n'en a pas, 01 §4).
--    Ne PAS publier kv_entries dans supabase_realtime : chaque changement
--    enverrait la valeur entière (plusieurs Mo pour nexora:tasks).
--    Diffuser seulement {clé, révision, source} sur un canal privé par espace.
--    realtime.send() : fonction fournie par Supabase Realtime (« Broadcast from
--    Database ») — existence et signature à vérifier sur la version du projet.
-- -----------------------------------------------------------------------------

-- create or replace function nexora.kv_notify()
-- returns trigger language plpgsql security definer set search_path = '' as $$
-- begin
--   perform realtime.send(
--     jsonb_build_object('key', new.key, 'revision', new.revision, 'source', new.source),
--     'kv_changed',
--     'workspace:' || new.workspace_id::text,
--     true);                                  -- canal privé
--   return null;
-- end; $$;
-- create trigger kv_entries_notify after insert or update on nexora.kv_entries
--   for each row execute function nexora.kv_notify();
-- + politique RLS sur realtime.messages : lecture si nexora.can_read(split_part(topic, ':', 2)::uuid).

-- =============================================================================
-- 9. PHASE 2 — normalisation des tâches (CIBLE, à ne créer qu'après la phase 1)
--    Justification : 02 §1.3. Les référentiels (statuts, types de tâches) y
--    deviennent des tables administrables.
-- =============================================================================

-- create table nexora.task_types (
--   workspace_id        uuid not null references nexora.workspaces (id) on delete cascade,
--   id                  text not null,           -- 'tt1'… conservés
--   name                text not null,
--   color               text,
--   icon                text,
--   locked              boolean not null default false,
--   restricted_status_id text,
--   project_id          text,
--   kind                text not null default 'task' check (kind in ('task', 'planning', 'meeting', 'information')),
--   sort_order          integer not null default 0,
--   primary key (workspace_id, id)
-- );
-- -- 'kind' remplace la détection des réunions PAR LE NOM du type
-- -- (index.html.part-003:19458-19463).
--
-- create table nexora.statuses ( workspace_id uuid, id text, name text, color text,
--   is_done boolean, sort_order int, primary key (workspace_id, id) );
-- create table nexora.projects ( workspace_id uuid, id text, name text, color text,
--   folder_id text, archived_at timestamptz, data jsonb not null default '{}',
--   primary key (workspace_id, id) );
--
-- create table nexora.tasks (
--   workspace_id        uuid not null references nexora.workspaces (id) on delete cascade,
--   id                  text not null,           -- ids actuels (8 car. base 36) conservés
--   title               text not null,
--   description         text,
--   project_id          text,
--   secondary_project_id text,
--   status_id           text,
--   task_type_id        text,
--   assignee            text,                    -- NOM aujourd'hui ; FK membre plus tard
--   start_date          date,
--   end_date            date,
--   start_time          time,
--   end_time            time,
--   milestone           boolean not null default false,
--   progress            smallint check (progress between 0 and 100),
--   depends_on          text[] not null default '{}',
--   checklist           jsonb not null default '[]',
--   custom_fields       jsonb not null default '{}',
--   recurrence          jsonb,
--   source              jsonb,                   -- sourceUrl, sourceMessageId…
--   gcal                jsonb,                   -- googleEventId, gcalCalendarId…
--   extra               jsonb not null default '{}', -- champs rares / futurs : aucune perte
--   idempotency_key     text,
--   created_at          timestamptz,
--   updated_at          timestamptz not null default now(),
--   last_interaction    timestamptz,
--   completed_at        timestamptz,
--   archived_at         timestamptz,
--   revision            uuid not null default gen_random_uuid(),
--   primary key (workspace_id, id),
--   foreign key (workspace_id, project_id)   references nexora.projects (workspace_id, id),
--   foreign key (workspace_id, task_type_id) references nexora.task_types (workspace_id, id),
--   foreign key (workspace_id, status_id)    references nexora.statuses (workspace_id, id),
--   check (end_date is null or start_date is null or end_date >= start_date)
-- );
-- create unique index tasks_idem_idx on nexora.tasks (workspace_id, idempotency_key)
--   where idempotency_key is not null;
-- create index tasks_project_idx on nexora.tasks (workspace_id, project_id) where archived_at is null;
-- create index tasks_dates_idx   on nexora.tasks (workspace_id, start_date, end_date) where archived_at is null;
-- create unique index tasks_gcal_idx on nexora.tasks (workspace_id, (gcal->>'gcalCalendarId'), (gcal->>'googleEventId'))
--   where gcal is not null;
--
-- -- Non-chevauchement : PAS de contrainte d'exclusion. Aujourd'hui c'est une
-- -- règle d'AFFICHAGE (voies, index.html.part-002:18278-18290) : deux tâches
-- -- Planning qui se chevauchent sont légitimes et existent probablement déjà
-- -- en base ; une contrainte ferait échouer la migration et changerait le
-- -- comportement. Si une règle métier est décidée (ex. « une personne ne peut
-- -- pas avoir deux créneaux Planning simultanés »), la forme serait :
-- -- create extension if not exists btree_gist;
-- -- alter table nexora.tasks add constraint tasks_planning_no_overlap
-- --   exclude using gist (
-- --     workspace_id with =, assignee with =,
-- --     tstzrange((start_date + coalesce(start_time, '00:00'))::timestamp at time zone 'Europe/Paris',
-- --               (end_date   + coalesce(end_time,   '23:59'))::timestamp at time zone 'Europe/Paris', '[)') with &&)
-- --   where (task_type_id = 'tt2' and archived_at is null);
-- -- (expression à valider : 'at time zone' n'est pas IMMUTABLE pour un index ;
-- --  il faudrait stocker un tstzrange calculé dans une colonne.)
