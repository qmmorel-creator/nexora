# 02 — Architecture cible Supabase

> Étude de faisabilité, Ref #603. Brouillon de schéma : [`schema-draft.sql`](schema-draft.sql)
> (**non appliqué**). Les constats sur l'existant renvoient à
> [`01-inventaire-firebase.md`](01-inventaire-firebase.md) ; abréviations identiques
> (`P0`…`P3`, `SH`, `ST`, `GW`, `MR`, `MT`).
> Sources externes consultées le 02/10/2026 : <https://supabase.com/pricing>,
> <https://supabase.com/docs/guides/platform/migrating-to-supabase/firebase-auth>,
> <https://github.com/supabase-community/firebase-to-supabase>.

---

## 1. Schéma Postgres

### 1.1 Point de départ réel

Nexora ne stocke pas des « documents de tâches » : il stocke **environ 60 clés**, chacune
contenant **un tableau ou un objet JSON entier** (`nexora:tasks`, `nexora:projects`…), réécrit
en totalité à chaque modification (01 §3). Toute la logique de fusion, de conflit et de
secours du front (01 §4) est construite sur ce contrat. Normaliser les tâches implique donc de
réécrire le modèle d'état de `LePlan`, pas seulement l'accès aux données.

### 1.2 Phase 1 — parité clé-valeur (recommandée en premier)

| Firestore | Postgres | Justification |
|---|---|---|
| `users/{uid}/kv_store/{clé}` (manifeste + segments) | `nexora.kv_entries (workspace_id, key, value jsonb, revision uuid, source, updated_at, updated_by)` | Même contrat que `window.storage` ; la segmentation `chunked-v1` disparaît (un `jsonb` est stocké hors ligne par TOAST jusqu'à 1 Go ; plafond conservé à 12 000 000 caractères comme `ST:245`). |
| `revision` (UUID) + `expectedRevision` | colonne `revision` + fonction `kv_put(…, p_expected_revision)` | Conflit levé en SQLSTATE `NX409` → HTTP 409 `NEXORA_SYNC_CONFLICT`, sans changer le front. |
| `list` par préfixe (`orderBy("__name__")`, `startAt/endAt`, `P0:1125`) | `where key like 'nexora:%'` + index `text_pattern_ops` | Équivalent direct. |
| `nexora:snapshot:*` | inchangé (clés), puis éventuellement `kv_history` | Les instantanés restent des clés ; `kv_history` est une option à activer après mesure. |
| `assistant_audit`, `assistant_reports`, `nexora_mcp_operations`, `qme_*` | tables dédiées | Requêtes `where/orderBy/limit` (`SH:229-235`, `MT:24`) → index B-tree. |
| `nexora_mcp_codes/access/refresh` | `mcp_oauth_tokens` (une table, colonne `kind`) | `expiresAt` Timestamp → `timestamptz` ; purge par `pg_cron` (aujourd'hui « TTL automatique sur expiresAt non configuré », `apps/nexora-mcp/README.md:45`). |
| `users/{uid}` (racine de partition) | `workspaces` + `workspace_members` | Prépare la commercialisation : un espace partageable, des rôles. Un compte migré = un espace personnel dont il est `owner`. |

**Ce que la phase 1 ne gagne pas** : pas de requêtes SQL sur les tâches, pas de RLS par
tâche, toujours une réécriture complète de `nexora:tasks` à chaque enregistrement (amplification
d'écriture, voir 04 §Coûts).

### 1.3 Phase 2 — normalisation (cible, section commentée du brouillon)

- `tasks` en lignes, avec colonnes pour les champs filtrés ou triés (`project_id`, `status_id`,
  `task_type_id`, dates, `archived_at`) et **JSONB** pour ce qui est imbriqué et peu interrogé
  (`checklist`, `custom_fields`, `recurrence`, `source`, `gcal`) plus un `extra jsonb` qui
  reçoit tout champ non prévu → aucune perte lors de la transformation.
- Ids métier actuels (8 caractères base 36, `P0:2666`) **conservés** en `text` : les références
  croisées (`dependsOn`, `projectId`, URL, MCP) restent valides.
- Référentiels **administrables en base** : `task_types` (avec une colonne `kind` qui remplace la
  détection des réunions par le nom, `P3:19458-19463`), `statuses`, `projects`.
- `assignee` reste un **nom** (modèle actuel) ; passage à une FK membre plus tard.
- **Contrainte d'exclusion de non-chevauchement : non proposée.** Le code ne contient aucune
  règle de données de ce type ; c'est un algorithme de voies d'affichage
  (`apps/nexora/source/index.html.part-002:18278-18290`, commentaire `P0:2799-2801`). Une
  contrainte refuserait des données aujourd'hui légitimes. La forme correcte, si une règle
  métier est décidée, est donnée en commentaire dans le brouillon (colonne `tstzrange` stockée
  + `btree_gist`).

La phase 2 n'a de sens que si l'on réécrit la couche d'état du front pour travailler par entité
(ou si l'on accepte un « adaptateur de projection » qui reconstitue le tableau `nexora:tasks` à
partir des lignes, ce qui garde l'amplification côté réseau). Elle est **hors du périmètre
minimal** de la migration.

---

## 2. RLS (multi-tenant)

| Table | Lecture | Écriture | Équivalent actuel |
|---|---|---|---|
| `kv_entries` | membre de l'espace | `owner`/`admin`/`member`, via `kv_put`/`kv_delete` (`SECURITY INVOKER`, la RLS s'applique) | règles Firestore **inconnues** + relais qui accepte n'importe quel `uid` (`ST:231`) |
| `workspaces`, `workspace_members` | membre | `owner`/`admin`, sans toucher au rôle `owner` | n'existe pas |
| `audit_events`, `assistant_reports`, `mcp_operations` | membre (lecture seule) | `service_role` seul | Admin SDK |
| `mcp_oauth_tokens`, `qme_*` | personne | `service_role` seul | « inaccessibles aux clients » (`docs/MIGRATION_GITHUB.md:63`) |
| `storage.objects` (bucket `attachments`) | membre, selon le 1er segment du chemin | `owner`/`admin`/`member` | n'existe pas |

Règles d'écriture de la RLS retenues :

- fonctions d'appartenance `SECURITY DEFINER`, `search_path = ''`, pour éviter la récursion sur
  `workspace_members` ;
- `(select auth.uid())` plutôt que `auth.uid()` pour une évaluation par requête et non par ligne
  (recommandation de performance Supabase) ;
- schéma dédié `nexora` avec `grant` explicites (pas les droits par défaut de `public`) ;
- **aucune** clé `service_role` côté navigateur ; elle reste dans les variables Netlify, comme
  `FIREBASE_SERVICE_ACCOUNT_JSON` aujourd'hui (`.github/PROCESS.md`, garde-fous).

**Plus strict qu'aujourd'hui** : l'isolation devient versionnée, testable (tests SQL de
politique, voir 03 §5) et indépendante de la console. Aujourd'hui elle dépend de règles non
vues (01 §5).

**Risque principal** : une politique trop large (`using (true)`) ou un oubli de
`enable row level security` expose tout. À couvrir par un test automatique qui échoue si une
table du schéma `nexora` n'a pas la RLS activée, et par les « advisors » de sécurité Supabase.

---

## 3. Auth

### 3.1 Correspondance

| Usage actuel | Firebase | Supabase |
|---|---|---|
| Connexion | `signInWithEmailAndPassword` (`P3:19634`) | `auth.signInWithPassword` |
| Inscription | `createUserWithEmailAndPassword` (`P3:19635`), **ouverte** | `auth.signUp` ; décider si l'inscription reste ouverte (commercialisation) ou sur invitation |
| Mot de passe oublié | `sendPasswordResetEmail` (`P3:19636`) | `auth.resetPasswordForEmail` (SMTP à configurer : le SMTP par défaut de Supabase est limité, inconnu pour le volume visé) |
| Session | persistance par défaut du SDK | session supabase-js (stockage local) |
| Jeton vers les fonctions | `getIdToken()` (8 sites, 01 §2.1) | `session.access_token` (JWT Supabase) |
| Vérification serveur | `verifyIdToken` (`apps/nexora/netlify/functions/_shared/owner.ts:22`, `GW:82`) | vérification du JWT (clés JWKS du projet) ou `auth.getUser(jwt)` |
| Google Calendar (`calendar.readonly`) | `linkWithPopup` + `credentialFromResult().accessToken` (`apps/nexora/source/index.html.part-001:10667-10693`) | `linkIdentity`/`signInWithOAuth({ provider: 'google', options: { scopes } })` → `provider_token` dans la session. **À vérifier** : la liaison d'identité manuelle doit être activée ; Supabase ne rafraîchit pas le `provider_token` (comportement actuel équivalent : cache 45 min puis nouvelle fenêtre). |
| Page de connexion MCP | REST `identitytoolkit signInWithPassword` (`apps/nexora-mcp/public/connect.js:39`) | `POST /auth/v1/token?grant_type=password` avec la clé publique (anon/publishable) |

### 3.2 Identifiants

- `auth.users.id` est un **UUID** ; un UID Firebase ne l'est pas (format usuel : 28 caractères
  alphanumériques — **à confirmer sur la valeur réelle de `NEXORA_USER_UID`**). Les UID ne
  peuvent donc pas être conservés comme clé primaire. Stratégie : nouvel UUID, ancien UID dans
  `profiles.legacy_firebase_uid`, et toutes les données rattachées à un `workspace_id` (l'UID
  n'apparaît dans aucune valeur métier connue — à vérifier dans l'export).
- `NEXORA_USER_UID` (fonctions, MCP) devient l'UUID Supabase du propriétaire, puis disparaît
  au profit de l'appartenance à l'espace.

### 3.3 Mots de passe

- La documentation Supabase indique que les hachages **scrypt Firebase** sont pris en charge à
  l'import, à condition de fournir les paramètres du projet (`base64_signer_key`,
  `base64_salt_separator`, `rounds`, `mem_cost`). Le dépôt communautaire `firebase-to-supabase`
  décrit en revanche un **intergiciel** qui vérifie l'ancien mot de passe au premier login puis
  le ré-enregistre (statut « work in progress »). **Les deux sources divergent : à valider sur
  un compte de test avant de choisir.**
- Recommandation : si le nombre de comptes est très faible (le serveur n'en reconnaît qu'un,
  `NEXORA_USER_UID`), **réinitialisation de mot de passe** au moment de la bascule — simple,
  sans dépendance expérimentale. Si des comptes tiers existent (inscription ouverte), tenter
  l'import des hachages sur un projet de test ; sinon reset par e-mail.

---

## 4. Temps réel et hors-ligne

### 4.1 Constat

- **Production : aucun temps réel.** `nexoraServerStorage.watch()` est vide (`P0:1364-1368`) ;
  la fraîcheur est contrôlée au retour au premier plan, une requête `checkRevision` par clé
  (`apps/nexora/source/index.html.part-001:9746-9769`).
- **Aucun cache hors-ligne Firestore** (pas d'`enablePersistence`) ; le seul mécanisme
  « hors-ligne » est applicatif : copies de secours `nexora:rescue:*` dans `localStorage`
  (`apps/nexora/source/index.html.part-001:8599-8619`), qui ne dépendent pas du backend.
- **Aucune coordination multi-onglets locale** : chaque onglet est un client indépendant,
  arbitré par la révision serveur.

**Conséquence : la migration ne fait perdre ni temps réel ni hors-ligne.** Le risque
« perte du cache offline Firestore » mentionné dans l'énoncé ne s'applique pas au code actuel.

### 4.2 Proposition

1. **Parité (phase 1)** : garder le contrôle au premier plan, en remplaçant les ~56 requêtes
   `checkRevision` par **une seule** requête `select key, revision from kv_entries where
   workspace_id = $1` (gain net de latence et d'invocations).
2. **Option temps réel** : diffusion *Broadcast* depuis la base, déclenchée par un trigger, sur
   un canal **privé** `workspace:{id}`, avec **seulement** `{key, revision, source}` (bloc
   commenté §8 du brouillon). Ne **pas** publier `kv_entries` via `postgres_changes` : chaque
   changement transporterait la valeur entière (plusieurs Mo pour `nexora:tasks`).
3. **Multi-onglets** : ajouter un `BroadcastChannel` local est une amélioration indépendante
   du backend (évite deux onglets du même navigateur en conflit). Hors périmètre migration.

Limites Realtime à connaître (forfait Pro, page tarifs) : 500 connexions simultanées incluses,
5 millions de messages/mois, puis 10 $ / 1000 connexions et 2,50 $ / million de messages.
Avec la diffusion « révision seule », un message par enregistrement et par onglet abonné.

---

## 5. Storage

- **Aujourd'hui il n'y a rien à migrer depuis Firebase Storage** (non utilisé).
- Les fichiers joints sont des **data-URL ≤ 350 Ko dans le JSON des tâches**
  (`apps/nexora/source/index.html.part-002:12470-12489`). Ils alourdissent `nexora:tasks`,
  qui est relu et réécrit en entier.
- Cible : bucket **privé** `attachments`, chemin `{workspace_id}/{attachment_id}/{nom}`,
  métadonnées dans `nexora.attachments`, politiques `storage.objects` par appartenance à
  l'espace (§7 du brouillon), téléchargement par URL signée de courte durée.
- Migration : extraire chaque `attachments[i]` de type `file` (data-URL) → téléverser →
  remplacer dans la tâche par `{type:"file", storagePath, name, mime, size}`. **Nécessite une
  modification du front** (affichage et ajout). Peut être un lot séparé, après la bascule.
- Liens Google Drive : inchangés.

---

## 6. Fonctions serveur

| Existant | Cible |
|---|---|
| Fonctions Netlify `apps/nexora/netlify/functions/*` | **Conservées** sur Netlify ; seul l'accès aux données change (module `DataStore`, voir 03 §1). Pas de passage à Edge Functions nécessaire. |
| Relais `/api/nexora-storage` (`ST`) | Phase 1 : même route, backend Supabase, **en transmettant le JWT de l'utilisateur** à PostgREST (la RLS s'applique, comme aujourd'hui les règles Firestore). Option ultérieure : appel direct supabase-js depuis le navigateur (supprime une invocation Netlify par lecture/écriture). |
| Fonctions planifiées (rapports) | Conservées (cron Netlify) ou `pg_cron` + Edge Function ; aucun gain à les déplacer. |
| **4 Cloud Functions Todoist** (`docs/MIGRATION_GITHUB.md:82`) | **Code absent du dépôt.** À récupérer, puis réécrire en fonction Netlify (OAuth, webhook, synchro). Tant qu'elles écrivent dans Firestore, la bascule ne peut pas être complète. |

---

## 7. Transactions et atomicité

| Existant | Équivalent Postgres |
|---|---|
| `nexoraDirectStorage.set/delete` (`P0:965`, `P0:1074`) ; relais `:commit` + précondition `updateTime` (`ST:203`, `ST:279-286`) | `kv_put` / `kv_delete` : `select … for update` + comparaison de révision, une seule transaction |
| `appendTaskIdempotently` (`SH:256-296`) : relit tasks + archive, dédoublonne, écrit audit + tasks | RPC `append_task_idempotent(workspace, task jsonb, idempotency_key, audit jsonb)` : `select … for update` sur les 2 lignes `kv_entries`, test d'unicité, `insert audit_events … on conflict do nothing`, `update kv_entries` — à écrire au lot L4 |
| `mutateTaskAtomically` (`SH:450-533`) : update/complete/archive, déplacement tasks → archive | RPC `mutate_task(…)` (même schéma de verrouillage) |
| `recordAuditEvent` (`SH:206-210`) | `insert … on conflict (workspace_id, id) do nothing` (pas besoin de transaction explicite) |
| MCP `atomic` (`MR:206`) | RPC qui insère d'abord dans `mcp_operations` (`on conflict` → rejouer le résultat stocké ou refuser si `request_hash` diffère), puis applique l'écriture, dans la même transaction |
| MCP `snapshot` (`MR:199`, lecture cohérente multi-clés) | `select … where key = any($keys)` : une requête = un instantané cohérent (isolation MVCC) |
| OAuth `/oauth/token`, `/oauth/revoke` (`GW:94-105`) | `mcp_oauth_consume` (`delete … returning`) + `insert` des nouveaux jetons, même transaction |
| QME limite de débit + nonce (`apps/nexora/netlify/functions/nexora-qme-intake.ts:63-78`) | `insert … on conflict do update set hits = hits + 1 returning hits` ; nonce : `insert` simple, violation d'unicité = rejeu |

Contrainte technique : PostgREST exécute **une requête HTTP = une transaction**. Toute
opération multi-étapes doit donc être une **fonction Postgres** (RPC), pas une suite d'appels
REST depuis Node. Les connexions directes (`postgres` / `pg` via le pooler) sont possibles
depuis Netlify mais imposent la gestion du pool en environnement *serverless* ; à éviter en
phase 1.

---

## 8. Connecteur MCP

| Option | Description | Avis |
|---|---|---|
| A. `service_role` côté serveur | Le MCP (Netlify) appelle PostgREST/RPC avec la clé `service_role`, filtre explicitement par `workspace_id` issu du jeton OAuth. | **Équivalent strict de l'Admin SDK actuel** (qui contourne aussi les règles). Simple. Une erreur de filtre = fuite inter-locataires. |
| B. JWT utilisateur + RLS | À l'échange OAuth, le MCP mémorise l'utilisateur ; à chaque appel il signe un JWT court (claims `sub`, `role=authenticated`) avec la clé de signature du projet et appelle PostgREST : la RLS s'applique. | **Recommandé pour la commercialisation** (défense en profondeur). À vérifier : signature de JWT personnalisés avec les nouvelles clés asymétriques Supabase. |

Dans les deux cas : `NEXORA_USER_UID` disparaît, `mcp_oauth_tokens` porte `user_id` et
`workspace_id`, et `registerNexoraTools(s, scope, db, uid)` (`GW:57`) reçoit un
`DataStore` lié à l'espace. `repository(db, uid)` est déjà paramétré (`MR:182`).
Les 3 outils Budget restent des appels HTTP aux fonctions Nexora (`apps/nexora-mcp/src/budget.mts:14-18`).

---

## 9. Projet Supabase : séparé de KDM360

Le projet existant `ftgmjaozveprnshkdosj` porte le Budget personnel (KDM360) et est partagé
avec OS360 (`apps/nexora/supabase/finance_admin_reference_edit.sql:19-20`,
`docs/finance-pro/AUDIT_CONCEPTION.md:48-53`). **Ne pas y mettre les données des clients
Nexora** : données personnelles mélangées à des données commerciales, droits `service_role`
partagés, sauvegardes et restaurations communes. Recommandation : **un projet Supabase dédié
Nexora** (région UE), le Budget restant accédé comme aujourd'hui.

---

## 10. Effets de bord à prévoir

- CSP : la production n'en a pas (`docs/AUDIT_2026-09.md:186-191`) ; la future CSP devra
  autoriser `https://<projet>.supabase.co` et `wss://<projet>.supabase.co` au lieu des domaines
  Firebase (`docs/AUDIT_2026-09.md:217`).
- Garde-fous de build : `config/environnements.mjs:106-111` interdit des motifs Firebase dans
  les builds hors production ; à étendre aux motifs Supabase.
- Environnement de démonstration : `apps/nexora/environnement-demo/stockage-demo.js` prouve que
  le contrat `window.storage` est substituable ; un équivalent `supabase-demo` sera nécessaire.
- Contrats figés (`docs/MIGRATION_GITHUB.md`, `docs/AUTOMATIONS_BASELINE.md`) : les URL
  `/api/nexora/*` et OpenAPI doivent rester identiques ; seule leur implémentation change.
