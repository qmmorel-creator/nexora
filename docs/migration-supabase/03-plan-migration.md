# 03 — Plan de migration

> Étude de faisabilité, Ref #603. S'appuie sur [`01`](01-inventaire-firebase.md) (existant) et
> [`02`](02-architecture-cible.md) (cible). Rien n'est implémenté : les interfaces et scripts
> ci-dessous sont des spécifications.

---

## 1. Couche d'abstraction

### 1.1 Ce qui existe déjà

- **Front** : `window.storage` est déjà une interface interchangeable, avec deux implémentations
  (`P0:867-1203`, `P0:1274-1403`) et une troisième en démonstration
  (`apps/nexora/environnement-demo/stockage-demo.js`). L'application n'appelle Firestore
  directement que dans `AuthGate` (migration legacy, `P3:19587-19606`).
- **Serveur** : pas d'interface commune. Le format « manifeste + segments » est implémenté
  **trois fois** (`SH:308-386`, `ST:95-219`, `MR:184-198`) et l'Auth est appelée dans
  `owner.ts` et `GW`.

### 1.2 Interfaces proposées

```ts
// Contrat commun serveur (fonctions Netlify + MCP). Une instance = un espace.
interface KvEntry { key: string; value: unknown; revision: string; source: string; updatedAt: string }

interface DataStore {
  read(keys: string[]): Promise<Map<string, KvEntry | null>>;          // instantané cohérent
  revisions(prefix: string): Promise<Map<string, string>>;              // contrôle de fraîcheur en 1 appel
  list(prefix: string): Promise<string[]>;
  commit(op: {
    writes: Array<{ op: 'put' | 'delete'; key: string; value?: unknown; expectedRevision: string | null }>;
    source: 'browser' | 'assistant-api' | 'mcp' | 'migration' | 'todoist';
    audit?: AuditEvent[];
    mcpOperation?: { id: string; operation: string; requestHash: string; result: unknown };
  }): Promise<Record<string, string>>;                                   // nouvelles révisions ; lève ConflictError (409)
  readAudit(range: { from: string; to: string; limit: number }): Promise<AuditEvent[]>;
  saveReport(date: string, kind: 'morning' | 'evening', payload: unknown): Promise<void>;
}

// Les « transactions » actuelles deviennent : lire → calculer en JS → commit → recommencer sur conflit.
async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> { /* backoff sur ConflictError */ }

interface AuthProvider {               // serveur
  verify(bearer: string): Promise<{ userId: string; workspaceId: string; role: string } | null>;
}

interface FileStore {                   // seulement si le lot Pièces jointes est retenu
  put(path: string, data: Uint8Array, mime: string): Promise<void>;
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
  remove(path: string): Promise<void>;
}
```

```js
// Front : on garde window.storage tel quel ; on ajoute un objet Auth unique.
window.nexoraAuth = {
  onChange(cb), signIn(email, pw), signUp(email, pw), resetPassword(email), signOut(),
  getAccessToken(),            // remplace les 8 getIdToken()
  getGoogleCalendarToken(),    // remplace getGoogleAccessToken (part-001:10667-10693)
};
```

Pourquoi `commit` plutôt que `transaction(fn)` : PostgREST n'offre pas de transaction
interactive (une requête HTTP = une transaction). Le `commit` avec préconditions est
exactement ce que le relais REST fait déjà avec Firestore (`ST:185-206`), il s'implémente
donc à l'identique sur les deux backends (`kv_commit`, `schema-draft.sql` §3), et la logique
métier (dédoublonnage, fusion, archivage) reste en JS, inchangée.

Point à vérifier : partager un module entre `apps/nexora` et `apps/nexora-mcp`, deux sites
Netlify à `base` différente. L'import relatif hors de `base` par esbuild et le script
`scripts/netlify-ignore.mjs` (qui décide des reconstructions selon les chemins) doivent en
tenir compte.

Si l'option B du MCP est retenue (JWT utilisateur + RLS, 02 §8), `kv_commit` doit devenir
`SECURITY DEFINER` avec un contrôle explicite `nexora.can_write(p_workspace)`, car les tables
`audit_events` et `mcp_operations` n'ont pas de politique d'écriture.

### 1.3 Volume de refactor (mesuré sur le dépôt)

| Zone | Code concerné | Nature |
|---|---|---|
| Serveur `apps/nexora` | `_shared/nexora.ts` (536 lignes), `nexora-storage.mts` (304), `_shared/owner.ts`, `nexora-qme-intake.ts` (partie Firestore), `nexora.ts`/`nexora-storage.mts`/`nexora-health.ts` (projectId en dur) | extraire `DataStore` + adaptateur Firebase, puis adaptateur Supabase |
| MCP | `src/nexora.mts` (312), `netlify/functions/gateway.mts` (OAuth, ~10 appels), `src/tools.mts:24` | `repository` sur `DataStore` ; OAuth sur table |
| Front | adaptateurs `P0:867-1403` (~540 lignes), `AuthGate` (~120 lignes autour de `P3:19557-19673`), 8 sites `getIdToken`, `getGoogleAccessToken` | `nexoraAuth` + nouvel adaptateur ou relais inchangé |
| Hors dépôt | 4 Cloud Functions Todoist | réécriture (code inconnu) |

Ordre de grandeur : **≈ 1 200 lignes serveur et ≈ 800 lignes front touchées**, sur ~80 000.
La logique métier (fusion `NEXORA:SYNCMERGE`, `persistKey`, instantanés) **ne change pas**.

---

## 2. Scénarios

| Critère | Big-bang | Double écriture | Bascule par module |
|---|---|---|---|
| Adapté au modèle KV (cohérence `tasks` + `taskArchive` + audit) | oui | **non** : deux sources avec deux séries de révisions ; la détection de conflit ne sait plus quelle révision fait foi | **non** : les modules partagent les mêmes clés (`nexora:tasks` est lu par tâches, planning, réunions, MCP, rapports) |
| Retour arrière | par resynchronisation inverse | immédiat en théorie | partiel |
| Complexité | faible | élevée (réconciliation, écritures partielles) | élevée |
| Durée de gel | minutes (volumétrie faible, à confirmer) | nulle | variable |

**Recommandation : progressif sur le code, big-bang sur les données.**

1. Refactor sans changement de comportement (adaptateur Firebase derrière `DataStore` /
   `nexoraAuth`), publié en production et observé.
2. Adaptateur Supabase développé et testé **sur une copie** des données, choix du backend par
   configuration (`NEXORA_DATA_BACKEND=firebase|supabase`).
3. Une bascule unique, courte, avec gel des écritures, contrôles et retour arrière préparé.

La double écriture n'est pas justifiée : un seul propriétaire, un volume probablement faible,
et un modèle où chaque écriture remplace un document entier.

---

## 3. Migration des données

### 3.1 Script (spécification, à créer sous `scripts/migration-supabase/` au lot L6)

```text
export-firestore.mjs   (Admin SDK, lecture seule)
  pour chaque uid de users/* :
    pour chaque doc de users/{uid}/kv_store hors segments (P0:1135) :
      si storageMode == "chunked-v1" : relire chunkIds, vérifier chunkCount == len, index contigus,
                                       revision identique sur chaque segment ; sinon ERREUR
      value = JSON.parse(inline ou concaténation)        // échec => ERREUR, pas d'import partiel
      écrire NDJSON { uid, key, value, revision, source, updatedAt, sha256(canon(value)) }
    idem assistant_audit, assistant_reports, nexora_mcp_operations, qme_* (facultatif)
  nexora_mcp_* : NON migrés (jetons à usage court ; les clients se reconnectent)
  kv_store racine (legacy) : inventorié, non migré sauf décision

transform.mjs
  uid Firebase -> user_id Supabase (table de correspondance issue de l'import Auth)
  user_id -> workspace_id (un espace personnel par compte)
  ISO -> timestamptz (contrôle de parse ; les valeurs invalides restent dans le JSON)

import-supabase.mjs   (service_role, transactionnel par clé)
  upsert kv_entries (workspace_id, key) avec revision = révision Firestore d'origine, source = 'migration'
  => idempotent : rejouer donne le même état ; une clé dont la révision cible diffère est signalée, pas écrasée

verify.mjs
  - comptages : clés par espace, documents d'audit/rapports/opérations
  - sommes de contrôle : sha256 du JSON canonique (clés triées) de chaque valeur, source vs cible
  - contenu : nombre d'éléments de tasks / taskArchive / projects ; ensemble des ids identique
  - échantillon : 20 tâches tirées au hasard comparées champ à champ
  - taille totale par clé (alerte si > 5 Mo)
  - sortie : rapport JSON + code retour ≠ 0 au moindre écart
```

Mode `--dry-run` sur chaque étape. Le script inverse `supabase-to-firestore.mjs` (pour le retour
arrière, §4) réécrit les clés modifiées après T0 au format manifeste/segments.

### 3.2 Pièces jointes (lot séparé, optionnel)

Parcourir `tasks[].attachments[]` et `taskArchive[]`, pour chaque `type:"file"` avec data-URL :
décoder, téléverser dans `attachments/{workspace}/{id}/{nom}`, insérer la ligne
`nexora.attachments`, remplacer `url` par `storagePath`. Contrôle : nombre et SHA-256 des
fichiers. Ne peut se faire qu'une fois le front capable d'afficher un `storagePath`.

---

## 4. Bascule et retour arrière

### 4.1 Prérequis (go/no-go J-7)

- Projet Supabase dédié (région UE), schéma appliqué par migration versionnée, advisors de
  sécurité sans alerte.
- Tests de RLS verts (§5.2), suite navigateur verte contre une **copie** des données.
- Répétition complète de la migration (export → import → verify) sur la copie, durée mesurée.
- Code Todoist récupéré et réécrit, ou décision explicite de le couper.
- Mécanisme de gel des écritures **à implémenter** (n'existe pas aujourd'hui) : variable lue
  par le relais, les fonctions d'écriture et le MCP → 503 `NEXORA_MAINTENANCE`.

### 4.2 Déroulé (J0)

| Étape | Action | Critère de passage |
|---|---|---|
| 1 | Sauvegarde complète : export JSON depuis l'app (`exportFullBackup`) + export Admin | fichiers + SHA-256 archivés |
| 2 | Gel : `NEXORA_WRITES_FROZEN=1` ; pause du webhook Todoist ; rapports planifiés désactivés | écritures refusées vérifiées |
| 3 | Export final → transform → import | 0 erreur |
| 4 | `verify.mjs` | **100 % des sommes de contrôle identiques** |
| 5 | `NEXORA_DATA_BACKEND=supabase` (publication) | build + `verdict` vert |
| 6 | Tests de fumée production : connexion, lecture tâches, création/modification/suppression d'une tâche de test, Enregistrer, rechargement, MCP `list_tasks` + `create_task` sur tâche de test, rapport à la demande | tous verts |
| 7 | Dégel | — |

**No-go** à l'une des étapes 3, 4 ou 6 : rebasculer `NEXORA_DATA_BACKEND=firebase`, dégeler.
Aucune donnée n'a été écrite côté Supabase par les utilisateurs : retour sans perte.

Point à vérifier : la prise en compte d'un changement de variable Netlify exige une nouvelle
publication (15 crédits par site, `.github/PROCESS.md`) ; la configuration du front est
injectée au build.

### 4.3 Retour arrière après dégel

- Firebase est conservé **intact et en lecture seule** pendant 30 jours (pas de suppression).
- Fenêtre de retour (ex. 7 jours) : gel, `supabase-to-firestore.mjs` sur les clés dont
  `updated_at > T0`, `verify` inverse, rebascule, dégel.
- Au-delà : le retour arrière devient une nouvelle migration.
- Côté Netlify : republier le déploiement précédent (`docs/PUBLICATION.md`).

---

## 5. Tests

État actuel : **aucun test navigateur de bout en bout** (pas de `playwright.config*`),
Playwright n'est utilisé que par le banc visuel local, Firebase bouchonné (01 §8). La
compilation et les tests `node:test` ne prouvent pas la non-régression d'une migration.

### 5.1 Tests de contrat `DataStore` (Node)

Une même suite exécutée contre : faux magasin en mémoire (repris de
`apps/nexora-mcp/tests/domain.test.mjs:8`), adaptateur Firebase (émulateur `demo-*`, absent
aujourd'hui, `docs/PUBLICATION.md:183-184`), adaptateur Supabase (Supabase local via CLI ou
projet de test). Cas : création, conflit 409, précondition « n'existe pas », commit
multi-clés tout-ou-rien, idempotence d'audit, rejeu MCP, liste par préfixe, valeurs > 150 000
et > 1 Mio caractères (la segmentation disparaît sans perte).

### 5.2 Tests de sécurité (SQL ou supabase-js, deux comptes)

- B ne lit ni n'écrit les `kv_entries`, pièces jointes et objets Storage de A.
- `viewer` lit mais ne peut pas `kv_put`.
- `anon` n'accède à rien ; `authenticated` n'accède pas à `mcp_oauth_tokens`, `qme_*`.
- Toute table du schéma `nexora` a la RLS activée (requête sur `pg_tables.rowsecurity`).
- Relais : un `workspace_id`/`uid` forgé dans le corps renvoie 403 ou vide.

### 5.3 Parcours navigateur Playwright (Chromium réel, nouvelle suite)

| # | Parcours | Preuve attendue |
|---|---|---|
| 1 | Persistance : créer, modifier, supprimer une tâche ; recharger | état identique après rechargement |
| 2 | Bouton Enregistrer / Ctrl+Shift+S pendant le debounce de 250 ms | écriture confirmée avant fermeture |
| 3 | Multi-onglets : deux contextes, même compte, modification de **deux tâches différentes** | fusion par id, aucune perte, après retour au premier plan |
| 4 | Multi-onglets : même clé non fusionnable modifiée des deux côtés | conflit signalé (`blockedKeys`), pas d'écrasement silencieux |
| 5 | Coupure réseau pendant l'enregistrement (`page.route` → abort) puis rechargement | copie `nexora:rescue:*` proposée et restaurable |
| 6 | Instantanés : horloge avancée de 20 min (`page.clock`) | `snapshotIndex` incrémenté ; restauration fonctionnelle |
| 7 | Planning : deux tâches Planning qui se chevauchent | **les deux sont enregistrées** ; la vue Métro les place sur deux voies (assertion géométrique, reprise du banc visuel) |
| 8 | Pièces jointes : fichier 300 Ko accepté, 400 Ko refusé ; lien Drive | inchangé ; après le lot Storage : envoi, téléchargement, suppression |
| 9 | Import Google Agenda (API Google simulée par `page.route`) | tâches de type Planning créées, `googleEventId` unique |
| 10 | Volume : 12 000 tâches (jeu du banc visuel) | chargement sous le seuil fixé ; pas d'alerte de taille |
| 11 | Sauvegarde complète puis restauration | SHA-256 identique |

### 5.4 MCP

`protocol.mjs` et les scénarios de `domain.test.mjs` exécutés contre l'adaptateur Supabase :
`create_task` idempotent, `update_task` avec `expectedVersion` périmé → conflit,
`get_activity`, `import_google_calendar_events` (lot de 50), `log_habit`, OAuth complet
(code → token → refresh → revoke) sur `mcp_oauth_tokens`. Les tests « live »
(`create-remote.mjs`…) doivent viser le projet de test, jamais la production.

### 5.5 À chaque étape

`npm run install:all && npm run verify` (inclut le build et la validation esbuild du script
assemblé : `apps/nexora/scripts/compile-ui.mjs:4-15`, `apps/nexora/tests/build-integrity.test.mjs:26`),
puis les suites §5.1 à §5.4 concernées. Une suite non exécutée est déclarée comme telle.

---

## 6. Vérifications faites pour cette étude

- Références `fichier:ligne` : contrôle automatique d'existence des lignes citées, et relecture
  manuelle des passages critiques (adaptateur de production `P0:1411-1413`, relais `ST:221-236`,
  `owner.ts:9-28`, voies Métro `part-002:18278-18290`, pièces jointes `part-002:12466-12490`,
  OAuth `GW:36-45`, `GW:80-84`, `GW:108-112`).
- `schema-draft.sql` : analyse syntaxique par `libpg-query` 18.1.5 (analyseur de Postgres 18),
  corps PL/pgSQL compris, blocs commentés phase 2 et temps réel compris. **Ce n'est pas une
  exécution** : les objets externes (`auth.users`, `storage.objects`, `realtime.send`) et la
  sémantique ne sont pas validés.
