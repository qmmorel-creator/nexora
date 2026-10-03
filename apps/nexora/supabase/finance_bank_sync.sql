-- Nexora · Synchronisation bancaire Enable Banking (#677) — état serveur.
--
-- Trois tables, lues et écrites par les fonctions Netlify avec la clé
-- service_role uniquement (même modèle que finance_telegram_sessions) :
-- sécurité par ligne activée SANS politique, droits retirés à anon et
-- authenticated. Le navigateur ne voit jamais un identifiant de session.
--
--   finance_bank_auth_requests : demandes d'autorisation en cours. Le `state`
--     aléatoire envoyé à la banque est vérifié au retour (une seule
--     utilisation, 30 minutes) : un retour forgé n'ouvre aucune session.
--   finance_bank_connections : une session DSP2 par banque (lecture seule),
--     avec sa date d'expiration et les comptes qu'elle expose.
--   finance_bank_account_links : compte bancaire ↔ compte Nexora. La clé est
--     l'empreinte stable du compte (`identification_hash` d'Enable Banking,
--     sinon empreinte de l'IBAN) : l'`uid` change à chaque renouvellement du
--     consentement, la liaison reste. `account_id` nul = compte ignoré.
--     `import_from` : aucune opération antérieure n'est importée.
--
-- Les transactions elles-mêmes passent par finance_apply_transaction_write
-- (opération `import`) et le rapprochement par
-- finance_set_transaction_reconciliation : rien n'est écrit ici en dehors de
-- ces trois tables.
-- Idempotent : rejouer ce fichier ne change rien.

create table if not exists public.finance_bank_auth_requests (
  state text primary key,
  aspsp_name text not null,
  aspsp_country text not null default 'FR',
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create table if not exists public.finance_bank_connections (
  aspsp_key text primary key,
  aspsp_name text not null,
  aspsp_country text not null default 'FR',
  session_id text not null,
  valid_until timestamptz not null,
  accounts jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_sync_result jsonb
);

create table if not exists public.finance_bank_account_links (
  account_key text primary key,
  aspsp_key text not null,
  account_uid text,
  label text,
  iban_masked text,
  currency text,
  account_id text references public.finance_accounts_current(account_id) on update cascade,
  import_from date,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.finance_bank_auth_requests is 'Demandes d''autorisation Enable Banking en cours (#677) ; accès serveur uniquement.';
comment on table public.finance_bank_connections is 'Sessions Enable Banking par banque (#677) ; accès serveur uniquement.';
comment on table public.finance_bank_account_links is 'Liaison compte bancaire Enable Banking ↔ compte Nexora (#677) ; accès serveur uniquement.';

alter table public.finance_bank_auth_requests enable row level security;
alter table public.finance_bank_connections enable row level security;
alter table public.finance_bank_account_links enable row level security;

revoke all on public.finance_bank_auth_requests from anon, authenticated;
revoke all on public.finance_bank_connections from anon, authenticated;
revoke all on public.finance_bank_account_links from anon, authenticated;
grant select, insert, update, delete on public.finance_bank_auth_requests to service_role;
grant select, insert, update, delete on public.finance_bank_connections to service_role;
grant select, insert, update, delete on public.finance_bank_account_links to service_role;
