# 01 — Inventaire de l'usage Firebase dans Nexora

> Étude de faisabilité Firebase → Supabase, Ref #603. **Lecture seule** : aucun fichier applicatif
> modifié, aucune donnée touchée. État du dépôt : `main` @ `319604d` (02/10/2026).
> Chaque constat est cité `fichier:ligne`. « Inconnu, à vérifier » signale une information
> absente du dépôt.

Abréviations utilisées dans les tableaux (chemins complets) :

| Abréviation | Fichier |
|---|---|
| `P0` … `P3` | `apps/nexora/source/index.html.part-000` … `part-003` (front, 78 407 lignes au total, assemblées par `apps/nexora/scripts/build.mjs:12-14`) |
| `SH` | `apps/nexora/netlify/functions/_shared/nexora.ts` |
| `ST` | `apps/nexora/netlify/functions/nexora-storage.mts` |
| `GW` | `apps/nexora-mcp/netlify/functions/gateway.mts` |
| `MR` | `apps/nexora-mcp/src/nexora.mts` |
| `MT` | `apps/nexora-mcp/src/tools.mts` |

---

## 0. Ce qu'il faut retenir (corrections de l'énoncé)

| Hypothèse de l'énoncé | Ce que montre le code |
|---|---|
| Front de ~34 000 lignes | **78 407 lignes** dans les 5 fragments `apps/nexora/source/index.html.part-*` (`wc -l`). |
| Collections Firestore multiples | **Un seul magasin clé-valeur** : `users/{uid}/kv_store/{clé}`, une valeur JSON entière par clé (`P0:874`, `SH:91`, `MR:183`). |
| Pièces jointes dans Firebase Storage | **Firebase Storage n'est pas utilisé** (aucun `getStorage`, `uploadBytes`, `firebase-admin/storage`). Les fichiers sont des data-URL ≤ 350 Ko **dans le JSON de la tâche** (`apps/nexora/source/index.html.part-002:12470-12489`), ou des liens Drive. |
| Temps réel `onSnapshot`, multi-onglets | **En production, aucun temps réel** : l'adaptateur HTTP(S) a un `watch()` vide (`P0:1364-1368`). La fraîcheur est vérifiée au retour au premier plan (`apps/nexora/source/index.html.part-001:9746-9769`). Aucune coordination entre onglets (0 `BroadcastChannel`, 0 événement `storage`, 0 `navigator.locks`). |
| Cache hors-ligne Firestore | **Non activé** (0 `enablePersistence` / `persistentLocalCache`), et la production n'utilise de toute façon pas le SDK Firestore côté navigateur (`P0:1411-1413`). |
| Règle stricte de non-chevauchement du Planning | **Règle de rendu, pas de données** : répartition automatique en voies (`apps/nexora/source/index.html.part-002:18278-18290`). Aucune validation qui refuse l'enregistrement de deux tâches qui se chevauchent. |
| Budget sur Firebase | Le **Budget KDM360 est déjà sur Supabase** (projet `ftgmjaozveprnshkdosj`, `apps/nexora/netlify/functions/_shared/finance.ts:3`), accédé uniquement par des fonctions Netlify. Restent sur Firebase : budget local (`nexora:expenses`, `nexora:budgetLines`) et Finance PRO (`nexora:pro*`). |
| Santé sur Firebase | Santé et sport sont lus depuis des **CSV Google Sheets** (`apps/nexora/netlify/functions/_shared/health.ts:1`, `_shared/sport.ts:1`). Seul `nexora:sportGoals` est dans Firestore. |
| Cloud Functions | Aucune dans le dépôt. Mais **4 fonctions Firebase v2 Todoist** tournent sur `nexora-cb20d` (`docs/MIGRATION_GITHUB.md:82`, `docs/DEPENDENCIES.md:9`). **Leur code source n'est pas dans le dépôt** : inconnu, à vérifier. |

---

## 1. Services Firebase utilisés

| Service | Utilisé ? | Preuve |
|---|---|---|
| Firebase Auth (e-mail / mot de passe) | Oui | `signInWithEmailAndPassword` `apps/nexora/source/index.html.part-003:19634` |
| Inscription ouverte à tous | Oui | `createUserWithEmailAndPassword` `apps/nexora/source/index.html.part-003:19635` |
| Réinitialisation du mot de passe | Oui | `sendPasswordResetEmail` `apps/nexora/source/index.html.part-003:19636` |
| Google (liaison, **pas** connexion) | Oui, pour obtenir un jeton Google Calendar `calendar.readonly` | `linkWithPopup` `apps/nexora/source/index.html.part-001:10676`, scope `:10672`, repli `reauthenticateWithPopup` `:10682` |
| Persistance de session | Défaut du SDK (aucun `setPersistence`) | grep `setPersistence` : 0 |
| Custom claims | Non | grep `getIdTokenResult\|customClaims\|setCustomUserClaims` : 0 |
| Firestore (SDK web modulaire 10.12.2, CDN gstatic) | Oui | `P0:788-796`, init `P0:798-800` |
| Firestore REST (relais Netlify) | Oui, **chemin de production** | `ST:57-58` |
| Firestore Admin SDK | Oui (fonctions + MCP) | `SH:47-56`, `GW:14` |
| Firebase Storage | **Non** | grep `getStorage\|uploadBytes\|getDownloadURL\|firebase-admin/storage` : 0 |
| Realtime Database | Non | grep `getDatabase` : 0 |
| Cloud Functions | Oui, **hors dépôt** (Todoist) | `docs/MIGRATION_GITHUB.md:82`, `:94` |
| Hosting | Non (Netlify) | `apps/nexora/netlify.toml:2-3` |
| Règles de sécurité / index | **Absents du dépôt** | `find` sans résultat ; `docs/AUDIT_2026-09.md:639-642` (« le plus grand angle mort ») |
| App Check, Analytics, FCM | Non (le `measurementId` est présent dans la config mais jamais exploité) | `P0:740-748` ; grep `initializeAppCheck\|getAnalytics\|getMessaging` : 0 |

Projet Firebase : `nexora-cb20d` (`P0:743`, `ST:3`, `SH:52`, `config/environnements.mjs:79`).

---

## 2. Points d'appel au SDK

### 2.1 Front (`apps/nexora/source`)

Deux adaptateurs implémentent la même interface `window.storage` :
`nexoraDirectStorage` (SDK Firestore, `P0:867-1203`) et `nexoraServerStorage`
(`fetch("/api/nexora-storage")`, `P0:1274-1403`). **Seul le second sert en production** :

```js
// apps/nexora/source/index.html.part-000:1411-1413
window.storage = window.location.protocol === "file:"
  ? nexoraDirectStorage
  : nexoraServerStorage;
```

| fichier:ligne | Fonction | Appel SDK | Chemin | Rôle |
|---|---|---|---|---|
| `P0:874-875` | `nexoraDirectStorage.get` | `doc`, `getDoc` | `users/{uid}/kv_store/{key}` | lire le manifeste ou la valeur en ligne |
| `P0:896` | `nexoraDirectStorage.get` | `getDoc` × n (`Promise.all`) | `…/kv_store/{key}--nexora-chunk--{rev}-{NNNN}` | lire les segments `chunked-v1` |
| `P0:960-966` | `nexoraDirectStorage.set` | `runTransaction`, `tx.get` | manifeste | écriture avec contrôle de révision |
| `P0:994` | `set` (tx) | `tx.delete` | anciens segments | purge |
| `P0:998` | `set` (tx) | `tx.set` | manifeste | valeur en ligne (`storageMode:"inline"`) |
| `P0:1021-1022` | `set` (tx) | `tx.set` | segments | écriture segmentée |
| `P0:1033` | `set` (tx) | `tx.set` | manifeste | manifeste segmenté |
| `P0:1070-1093` | `nexoraDirectStorage.delete` | `runTransaction`, `tx.get`, `tx.delete` | manifeste + segments | suppression avec contrôle de révision |
| `P0:1123-1128` | `nexoraDirectStorage.list` | `collection`, `query`, `orderBy("__name__")`, `startAt`, `endAt`, `getDocs` | `users/{uid}/kv_store` | liste par préfixe d'id |
| `P0:1147-1148` | `nexoraDirectStorage.watch` | `onSnapshot` (`includeMetadataChanges:false`) | manifeste | détection de révision distante (mode `file:` uniquement) |
| `P0:1166-1167` | `nexoraDirectStorage.checkRevision` | `getDoc` | manifeste | contrôle de fraîcheur |
| `apps/nexora/source/index.html.part-003:19587-19591` | `AuthGate` (détection de migration) | `collection`, `getDocs` | `users/{uid}/kv_store` puis **`kv_store` racine** | détecter des données de l'ancien format partagé |
| `apps/nexora/source/index.html.part-003:19604-19606` | `AuthGate.runMigration` | `getDocs`, `setDoc` | `kv_store` → `users/{uid}/kv_store` | copie legacy hors transaction |

Jamais utilisés (grep 0 sur les 5 fragments) : `updateDoc`, `addDoc`, `writeBatch`,
`serverTimestamp`, `FieldValue`, `arrayUnion`, `arrayRemove`, `increment`, `deleteField`,
`collectionGroup`, `where(`, `limit(`. `deleteDoc` et `signInWithPopup` sont importés
(`P0:790`, `P0:795`) mais jamais appelés.

**Jeton Firebase envoyé aux fonctions Netlify** (`getIdToken()` → `Authorization: Bearer`) :

| fichier:ligne | Fonction | Endpoint |
|---|---|---|
| `P0:1252-1254` | `nexoraServerStorageRequest` | `/api/nexora-storage` (toutes les données) |
| `apps/nexora/source/index.html.part-003:31493-31494` | `archivePdfToDrive` | `/api/nexora/drive-archive` |
| `apps/nexora/source/index.html.part-003:36657-36658` | `financeSankeyLoad` | `/api/nexora/finance-sankey-data` |
| `apps/nexora/source/index.html.part-003:37018-37019` | transactions finance | `/api/nexora/finance-transactions-data` |
| `apps/nexora/source/index.html.part-003:37289` | `financeBudgetToken` | `finance-budget-summary`, `finance-owner-transactions` |
| `apps/nexora/source/index.html.part-003:38011-38012` | `financeRefCall` | `/api/nexora/finance-references` |
| `apps/nexora/source/index.html.part-003:38877-38878` | sport | `/api/nexora/sport-activities` |
| `apps/nexora/source/index.html.part-003:39832-39833` | santé | `/api/nexora/health-records` |

### 2.2 Fonctions Netlify (`apps/nexora/netlify/functions`)

| fichier:ligne | Fonction | Appel | Chemin | Rôle |
|---|---|---|---|---|
| `SH:47-56` | `getDb` | `initializeApp`, `getFirestore` (compte de service `FIREBASE_SERVICE_ACCOUNT_JSON`, `:40-45`) | — | init Admin unique pour `apps/nexora` |
| `SH:91-99` | `readLogicalDocument` | `doc().get()`, `getAll` | `kv_store/{key}` + segments | lecture |
| `SH:206-210` | `recordAuditEvent` | `runTransaction`, `tx.get`, `tx.set` | `users/{uid}/assistant_audit/{sha256(clé)}` | audit idempotent |
| `SH:222-224` | `ensureAuditEventInTransaction` | `tx.get`, `tx.set` | idem | audit dans la transaction des tâches |
| `SH:229-235` | `readAuditEvents` | `where(occurredAt>=)`, `where(<=)`, `orderBy`, `limit(≤2000)` | `users/{uid}/assistant_audit` | rapports, `GET /audit` |
| `SH:240-241` | `saveAssistantReport` | `set({…},{merge:true})` | `users/{uid}/assistant_reports/{date}-{kind}` | rapports matin/soir |
| `SH:256-296` | `appendTaskIdempotently` | `runTransaction` | `nexora:tasks`, `nexora:taskArchive`, audit | créer une tâche (dédoublonnage `idempotencyKey` / `sourceMessageId`, `:261-264`) |
| `SH:308-386` | `readStoredArrayInTransaction` / `writeStoredArrayInTransaction` | `tx.get`, `tx.getAll`, `tx.delete`, `tx.set` | manifeste + segments | réécriture complète d'un tableau |
| `SH:450-533` | `mutateTaskAtomically` | `runTransaction` | tasks, archive, audit | update / complete / archive |
| `apps/nexora/netlify/functions/_shared/owner.ts:22-23` | `requireOwner` | `getAuth().verifyIdToken` + `uid === NEXORA_USER_UID` | — | finance, sport, santé |
| `apps/nexora/netlify/functions/nexora-qme-intake.ts:63-78` | `checkRateLimitAndReplay` | `runTransaction`, 3 `get`, 3 `set` | `users/{uid}/qme_intake_ratelimit/*`, `qme_intake_nonces/*` | limite de débit + anti-rejeu |
| `ST:90-91` | `readRawDocument` | REST `GET` (jeton **de l'utilisateur**) | `kv_store/{key}` | relais navigateur, lecture |
| `ST:146-157`, `ST:185`, `ST:203-206` | `writeLogical` | REST `:commit` + préconditions `updateTime` / `exists:false` | manifeste + segments | relais navigateur, écriture optimiste (409) |
| `ST:258` | action `list` | REST `GET` paginé (1000) | `kv_store` | liste |
| `ST:279-286` | action `delete` | REST `:commit` | manifeste + segments | suppression |

### 2.3 Connecteur MCP (`apps/nexora-mcp`)

| fichier:ligne | Fonction | Appel | Chemin | Rôle |
|---|---|---|---|---|
| `GW:14` | `db()` | `initializeApp(cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON)))` | — | init Admin |
| `GW:38-45` | `doc`, `record`, `issue` | `collection('nexora_mcp_'+kind).doc(sha256(jeton))`, `tx.set` ×2 | `nexora_mcp_access` (3600 s), `nexora_mcp_refresh` (30 j) | émission de jetons OAuth |
| `GW:82-84` | `/oauth/authorize` | `verifyIdToken(idToken, true)`, `uid === NEXORA_USER_UID`, `create` | `nexora_mcp_codes` (300 s) | code d'autorisation |
| `GW:94-99` | `/oauth/token` | `runTransaction` (get, delete, issue) | codes / refresh | échange + rotation |
| `GW:105` | `/oauth/revoke` | `runTransaction` | access / refresh | révocation |
| `GW:108-111` | `/mcp` | `doc('access').get()` + contrôle uid/ressource | `nexora_mcp_access` | authentifier chaque appel |
| `MR:182-198` | `repository.read/write` | `get`, `getAll`, `tx.delete`, `tx.set` | `users/{uid}/kv_store` | **3e réimplémentation** du format segmenté |
| `MR:199` | `snapshot` | `runTransaction` (lecture seule) | plusieurs clés | vue cohérente |
| `MR:206` | `atomic` | `runTransaction` | `users/{uid}/nexora_mcp_operations/{sha256(clé)}` | idempotence des écritures MCP |
| `MT:24` | `get_activity` | `where`, `where`, `orderBy(desc)`, `limit(1000)` | `nexora_mcp_operations` | historique |

Les 3 outils Budget (`apps/nexora-mcp/src/budget.mts:14-18`) appellent les fonctions Nexora en
HTTP avec `NEXORA_ASSISTANT_API_KEY` (`GW:47-53`), pas Firestore.

Absents côté serveur (grep sur `apps/nexora/netlify`, `apps/nexora-mcp/src`, `apps/nexora-mcp/netlify`) :
`collectionGroup`, `listDocuments`, `FieldValue`, `.batch()`, `update()`, `getUser`.

---

## 3. Modèle de données réel

### 3.1 Chemins

| Chemin | Écrit par | Contenu |
|---|---|---|
| `users/{uid}/kv_store/{nexora:<nom>}` | front (relais), fonctions, MCP | manifeste d'une clé logique |
| `users/{uid}/kv_store/{clé}--nexora-chunk--{rev}-{NNNN}` | idem | segment de 150 000 caractères (`P0:842`, `SH:11`, `ST:5`) |
| `users/{uid}/assistant_audit/{sha256}` | fonctions | événements d'audit (types `SH:148-162`) |
| `users/{uid}/assistant_reports/{YYYY-MM-DD-kind}` | fonctions planifiées | rapports |
| `users/{uid}/nexora_mcp_operations/{sha256}` | MCP | journal d'idempotence |
| `users/{uid}/qme_intake_ratelimit/*`, `qme_intake_nonces/*` | `nexora-qme-intake` | compteurs, nonces |
| `nexora_mcp_codes`, `nexora_mcp_access`, `nexora_mcp_refresh` (racine) | MCP | jetons OAuth hachés, `expiresAt` en `Timestamp` (`GW:39`) |
| `kv_store` (racine, legacy) | — | ancien format partagé, **lu** par tout utilisateur connecté au premier lancement (`apps/nexora/source/index.html.part-003:19590`) |
| Collections Todoist | Cloud Functions hors dépôt | **inconnu, à vérifier** |

### 3.2 Document manifeste

```text
inline     : { value: "<JSON>", updatedAt: ISO, revision: UUID, source: "browser"|"assistant-api",
               storageMode: "inline", chunkCount: 0, totalLength }          (P0:998-1006)
chunked-v1 : { value: null, storageMode: "chunked-v1", chunkIds: [...], chunkCount, ... }   (P0:1033-1042)
segment    : { parentKey, revision, index, chunk, updatedAt }                 (P0:1022-1028)
```

- La valeur logique est **une chaîne JSON par clé**, réécrite **en entier** à chaque modification.
- Limites : alerte > 7 Mo (`apps/nexora/source/index.html.part-001:9005`), relais refuse > 12 000 000 caractères (`ST:245`), MCP refuse > 200 segments (`MR:194`).
- Horodatages : **toujours des chaînes ISO** (`new Date().toISOString()`, `P0:847`), sauf `expiresAt` OAuth (`Timestamp`).
- Identifiants métier : `Math.random().toString(36).slice(2,10)` (`P0:2666`), donc **8 caractères base 36, pas des UUID** ; révisions en `crypto.randomUUID()`.

### 3.3 Clés logiques

Liste maîtresse `firebaseStateEntries` (`apps/nexora/source/index.html.part-001:9211-9261`, 48 clés) :

- catalogues : `projects`, `statuses`, `taskTypes`, `milestoneTypes`, `workshops`, `teams`, `teamFolders`, `staffing` ;
- tâches et organisation : `tasks`, `taskArchive`, `projectFolders`, `viewFolders`, `taskBaselines`, `taskTemplates`, `taskDefaults` ;
- habitudes : `habitThemes`, `habitLog`, `habitSkips` ;
- budget local : `expenseCategories`, `expenses`, `budgetLines` ;
- équipe, historique : `teamMembers`, `momentumSnapshots`, `activityLog` ;
- Google Agenda : `gcalSettings`, `gcalSyncState`, `syncedCalendarSettings` ;
- devis / factures : `quotes`, `quoteClients`, `quoteSettings`, `quoteCatalog`, `quoteSkills`, `invoices` ;
- Finance PRO : `proMissions`, `proTimeEntries`, `proExpenseCategories`, `proExpenses`, `proBillingSchedule`, `proPayments`, `financeProSettings`, `proObligations` ;
- divers : `metaFilters`, `metaTemporalBlocks`, `startupPref`, `projectDefaultView`, `favorites`, `sportGoals`.

Interface (`apps/nexora/source/index.html.part-001:9275-9284`) : `dashboards`, `dashboardFolders`,
`views`, `todayWidgets`, `viewPrefs`, `viewOrder`, `enabledViews`, `shortcutPrefs`.
Autres : `appearance`, `activeDashboardId`, `lastOpenedView`, `onboardingSeen`
(`apps/nexora/source/index.html.part-001:9330-9341`), `snapshotIndex`, `snapshot:{id}`
(`apps/nexora/source/index.html.part-001:9847-9864`). Le MCP en connaît environ 40 (`MR:5`) dont
`customFieldDefs`, `risks`, `deadlines`, `workflows`. Le document de migration GitHub en cite
d'autres (`workflows`, `workflowExecutionLog`, `notifications`, `docs/MIGRATION_GITHUB.md:61-62`).
**La liste exhaustive des clés réellement présentes en base est inconnue, à vérifier** (export).

### 3.4 Forme d'une tâche

D'après `apps/nexora/netlify/functions/nexora-create-task.ts:131-163`, `SH:524-527`, `MR:203`,
`apps/nexora-mcp/src/calendar.mts:56` :

| Groupe | Champs |
|---|---|
| Identité, rattachements | `id`, `title`, `desc`, `projectId`, `secondaryProjectId`, `statusId`, `taskTypeId`, `assignee` (par **nom**) |
| Planning | `start`, `end` (`YYYY-MM-DD`), `startTime`, `endTime`, `milestone`, `milestoneIcon`, `progress`, `dependsOn[]`, `recurrence` |
| Contenu | `checklist[]`, `customFields{}`, `attachments[]`, `meetingReport`, `documentId`, `focus` |
| Origine | `source`, `sourceUrl`, `sourceMessageId`, `sourceThreadId`, `sourceReceivedAt`, `sourceReceivedDate`, `sourceSender`, `idempotencyKey` |
| Google Agenda | `googleEventId`, `gcalCalendarId`, `gcalImported`, `gcalSourceDescription` |
| Suivi | `createdAt`, `lastInteraction`, `updatedAt`, `completedAt`, `archivedAt`, `todoistCompletedAt` (lu seulement) |

Pièces jointes : `{id, type:"link", provider:"google-drive", driveKind, name, url, addedAt}`
(`SH:397-405`, `apps/nexora/source/index.html.part-002:12467`) ou
`{id, type:"file", name, url:<data-URL>, mime, size, addedAt}` (`apps/nexora/source/index.html.part-002:12487`).

Types de tâches : `tt1` Tâches, `tt2` Planning, `tt3` Réunions, `tt4` Information (verrouillés,
`P0:4292-4300`), stockés dans `nexora:taskTypes` ; les réunions sont reconnues **par le nom** du
type (`apps/nexora/source/index.html.part-003:19458-19463`).

---

## 4. Temps réel, persistance, conflits

| Mécanisme | Où | Comment |
|---|---|---|
| Chargement initial | `apps/nexora/source/index.html.part-001:9613-9687` | `Promise.all` sur 48 clés, timeout 20 s (`tasks`) / 10 s ; erreur → `setSyncBlocked` (`:9666`) |
| Écoute temps réel | `apps/nexora/source/index.html.part-001:9695-9738` | une `watch` par clé (56 clés, `:9287`) — **no-op en production** (`P0:1364-1368`) |
| Fraîcheur | `apps/nexora/source/index.html.part-001:9746-9769` | au `visibilitychange`, `checkRevision` **sur chaque clé surveillée** → 1 requête HTTP par clé |
| Écriture | `persistKey`, `apps/nexora/source/index.html.part-001:8986-9108` | file sérialisée, fusion des écritures d'une même clé, copie de secours `localStorage`, 50 ms entre écritures ; tâches avec debounce 250 ms (`:9898-9930`), flush au `pagehide` (`:9939-9951`), `keepalive` < 60 Kio (`P0:1227-1263`) |
| Contrôle optimiste | `P0:971-985` (direct), `P0:1322-1324` + `ST:146-157` (relais) | `expectedRevision` ; 409 `NEXORA_SYNC_CONFLICT` ; écriture refusée si la dernière lecture a échoué (`NEXORA_READ_UNSAFE`, `P0:948-954`) |
| Fusion par id | `NEXORA:SYNCMERGE`, `apps/nexora/source/index.html.part-001:8639-8884` | fusion à 3 voies base/local/distant sur tableaux ou cartes (`mergeKeyedCollections`, `:8807`), horodatage par `lastInteraction`/`updatedAt`/… (`:8769-8774`) ; relance dans `attemptPersist` (`:8889-8938`) ; clés non fusionnables → `blockedKeys` |
| Multi-onglets | — | **aucune coordination locale** : deux onglets sont deux clients concurrents arbitrés par la révision serveur |
| Bouton Enregistrer | `saveNow`, `apps/nexora/source/index.html.part-001:9116-9153`, UI `:13386-13395`, Ctrl+Shift+S `:11306` | vide le debounce et attend la file (20 s max) |
| Rechargement complet | `refreshFromFirebase`, `apps/nexora/source/index.html.part-001:9549-9600` | relit toutes les clés |
| Instantanés | `apps/nexora/source/index.html.part-001:9817-9896` | `nexora:snapshot:{iso}` + `nexora:snapshotIndex` **dans le même kv_store**, ≥ 20 min d'écart, 50 max |
| Sauvegarde | `apps/nexora/source/index.html.part-001:9367-9546` | export JSON/CSV local avec SHA-256 ; restauration clé par clé via `window.storage.set` |
| Secours local | `nexora:rescue:{key}`, `apps/nexora/source/index.html.part-001:8599-8619`, `:9158-9197` | copie avant confirmation, proposée au démarrage |

**Conséquence pour la migration** : rien ne dépend de `onSnapshot` en production. Le contrat à
reproduire est celui de `window.storage` (get / set avec révision attendue / delete / list par
préfixe / checkRevision / source), pas une API temps réel.

---

## 5. Sécurité et autorisation

| Point | Constat |
|---|---|
| Règles Firestore / Storage | **Absentes du dépôt, contenu inconnu, à vérifier dans la console** (`docs/AUDIT_2026-09.md:639-642`). |
| Relais `/api/nexora-storage` | Vérifie seulement la **présence** d'un `Bearer` (`ST:223-226`) ; l'`uid` cible vient **du corps de la requête** (`ST:231`) ; le jeton est transmis à l'API REST Firestore. **Toute l'isolation entre comptes repose donc sur les règles Firestore inconnues.** |
| Inscription | Ouverte à tous (`apps/nexora/source/index.html.part-003:19635`). Combinée au point précédent, si les règles sont du type `request.auth != null`, un compte quelconque pourrait lire/écrire les données du propriétaire. **Non vérifiable depuis le dépôt — à contrôler en priorité, indépendamment de toute migration.** |
| Legacy `kv_store` racine | Lu par tout utilisateur connecté dont l'espace est vide (`apps/nexora/source/index.html.part-003:19590`) : si les règles l'autorisent, c'est une collection partagée. À vérifier. |
| Fonctions « assistant » | Clé partagée `NEXORA_ASSISTANT_API_KEY`, comparaison en temps constant (`SH:78-87`) : `nexora-read`, `nexora-create-task`, `nexora-task-operations`, `nexora-audit`, `nexora-reports`, `finance-catalogs`, `finance-budget-assistant`, `finance-transactions-search`, `finance-transactions`. |
| Fonctions « propriétaire » | `verifyIdToken` + `uid === NEXORA_USER_UID` (`apps/nexora/netlify/functions/_shared/owner.ts:22-23`) : sport, santé, 5 fonctions finance. |
| Drive archive | Présence du `Bearer` seule, choix documenté (`apps/nexora/netlify/functions/nexora-drive-archive.ts:15-25`). |
| QME | HMAC `QME_INTAKE_SIGNING_KEY` + fraîcheur + limite de débit (`apps/nexora/netlify/functions/nexora-qme-intake.ts:35-37`, `:107-123`). |
| MCP | OAuth 2.1 + PKCE S256, liste blanche de redirections (`GW:29-37`), jetons opaques hachés, **propriétaire unique** (`GW:83`, `GW:111`). |
| Client côté navigateur | Aucune logique d'autorisation (pas d'allowlist, grep `allowlist\|OWNER_EMAIL` : 0). |
| CSP | **Aucune en production** (`docs/AUDIT_2026-09.md:186-191`). |

Le modèle actuel est **mono-propriétaire** côté serveur (`NEXORA_USER_UID`) mais **multi-comptes
de fait** côté front (chaque compte a son `users/{uid}/kv_store`). Rien ne modélise une
organisation, une équipe partagée ou des droits (`teamMembers` est une liste de noms).

---

## 6. Connecteur MCP

- **Admin SDK direct**, compte de service `FIREBASE_SERVICE_ACCOUNT_JSON` (`GW:14`), sans passer par les fonctions Nexora pour les tâches et ressources.
- 25 outils : 22 dans `MT` (lecture `MT:9-31`, écriture `MT:35-43`), 3 Budget dans `apps/nexora-mcp/src/budget.mts`. Le README annonce 20 outils (`apps/nexora-mcp/README.md:8`) : pas à jour.
- Identification : `registerNexoraTools(s, scope, db(), env('NEXORA_USER_UID'))` (`GW:57`) — un seul utilisateur. `repository(db, uid)` est déjà paramétré par `uid` (`MR:182`).
- Contrôles de version : `expectedVersion` = empreinte SHA-256 de la tâche (`MR:111`, `:224`), `expectedRevision` du document (`MR:249`), `configVersion` pour l'import Calendar (`apps/nexora-mcp/src/calendar.mts:32`).
- Le MCP n'écrit pas le champ `source` (`MR:196-197`) alors que les fonctions le font (`SH:360`, `ST:194`).
- Tests en direct contre la production (`apps/nexora-mcp/tests/create-remote.mjs:4-12`, `extended-live.mjs`, `oauth-live.mjs`).

---

## 7. Couplage et dispersion

| Zone | Fichiers liés au SDK | Lignes d'appel | Couche d'abstraction existante |
|---|---|---|---|
| Front | 1 module (fragment `P0`) + `AuthGate` (`P3`) | 21 lignes Firestore dans 7 fonctions ; Auth dans `AuthGate`, 8 `getIdToken`, 1 `linkWithPopup` | **Oui** : `window.storage` (≈ 25 appels + 12 `storageGetWithTimeout`, concentrés dans `LePlan`) |
| Fonctions Netlify | `_shared/nexora.ts`, `_shared/owner.ts`, `nexora-storage.mts` (REST), `nexora-qme-intake.ts` | ≈ 25 + 4 REST + 6 | Partielle : `_shared/nexora.ts` |
| MCP | `gateway.mts`, `src/nexora.mts`, `src/tools.mts` | ≈ 10 + 10 + 1 | Partielle : `repository()` |
| Hors dépôt | Cloud Functions Todoist | inconnu | inconnu |

**Point clé** : le format « manifeste + segments » est **implémenté trois fois**
(`SH:308-386`, `ST:95-219`, `MR:184-198`), et le `projectId` est écrit en dur à trois endroits
(`SH:52`, `ST:3`, `apps/nexora/netlify/functions/nexora-health.ts:13`). C'est le principal
couplage à résorber, quel que soit le choix de backend.

---

## 8. Tests existants utiles à la migration

- Pas de Playwright de bout en bout : pas de `playwright.config*` ; Playwright n'est utilisé que par le banc visuel local `tools/visual-check` (Firebase bouchonné, `tools/visual-check/build-harness.mjs:46-48`), hors CI (`.github/workflows/ci.yml:128`).
- `node:test` sur la logique extraite du build : `apps/nexora/tests/sync-merge.test.mjs` (fusion, 409), `sync-reliability.test.mjs`, `gateway-read-guard.test.mjs`, `mcp-sync-badge.test.mjs`.
- MCP : faux Firestore en mémoire (`apps/nexora-mcp/tests/domain.test.mjs:8`) — réutilisable comme spécification du contrat.
- Environnement de démonstration : faux Firebase sans réseau (`apps/nexora/environnement-demo/firebase-demo.js`) et faux stockage au contrat `window.storage` (`apps/nexora/environnement-demo/stockage-demo.js:1-11`). **Ce second fichier prouve qu'on peut déjà substituer le backend derrière `window.storage`.**
- Aucun émulateur Firebase (`docs/PUBLICATION.md:183-184`).

---

## 9. Inconnues à lever (à me fournir)

1. Règles Firestore déployées (export console) et index composites éventuels.
2. Nombre de comptes Firebase Auth existants, providers activés, comptes liés à Google.
3. Paramètres de hachage scrypt du projet (`base64_signer_key`, `salt_separator`, `rounds`, `mem_cost`) — console Auth → menu « Password hash parameters ».
4. Volumétrie : taille de `nexora:tasks` et `nexora:taskArchive`, nombre de documents par sous-collection, lectures/écritures par jour (console Usage).
5. Forfait Firebase (Spark / Blaze) et facture mensuelle réelle ; région Firestore.
6. Code source et collections des 4 Cloud Functions Todoist.
7. Forfait du projet Supabase KDM360 et volonté (ou non) d'y héberger Nexora.
