# Migration GitHub — Nexora

## Objectif

Faire de GitHub la source canonique du code sans changer les URLs publiques, le projet Firebase, les identifiants Netlify ni les contrats consommés par Todoist, le MCP et les automatisations ChatGPT. Le bot Telegram existant appartient à Budget360 et reste hors périmètre Nexora.

## Inventaire figé avant bascule

| Composant | Référence à conserver |
|---|---|
| Nexora production | `https://nexora-project.org` |
| Projet Netlify Nexora | `12f7ec79-b8cb-4dd1-a07b-558b236bed4c` |
| MCP production | `https://nexora-chatgpt-mcp.netlify.app/mcp` |
| Projet Netlify MCP | `2c0b2293-8b71-471b-8288-21f641256aa2` |
| Firebase | `nexora-cb20d` |
| Propriétaire Firebase | variable Netlify `NEXORA_USER_UID` |

## Variables Netlify requises

### `nexora-project`

- `FIREBASE_SERVICE_ACCOUNT_JSON` — secret ;
- `NEXORA_USER_UID` — secret ;
- `NEXORA_ASSISTANT_API_KEY` — secret ;
- `KDM360_SUPABASE_SECRET_KEY` — secret si les fonctions finance sont conservées ;
- `NEXORA_SPORT_CSV_URL` — URL du CSV publié de la feuille « Activités Strava » lue par `/api/nexora/sport-activities` (nexora#578), contexte production ; sans elle, les widgets sport affichent « Source Sport non configurée ». Depuis le retrait du moteur externe (nexora#597), l'URL ne figure plus dans aucun fichier publié ;
- `NEXORA_HEALTH_CSV_URL` — URL du CSV publié de l'onglet Santé de la même feuille (Whoop, balance, nutrition ; `gid=0`), lue par `/api/nexora/health-records` (nexora#594), contexte production ; sans elle, le widget « Graphique santé » affiche « Source Santé non configurée ». À créer par Quentin ; une variable ne vaut qu'après un nouveau déploiement ;
- `NEXORA_BODY_PHOTOS_FOLDER_ID` — identifiant du dossier Google Drive **dédié** aux photos corporelles du widget « Photos corporelles — avant / après » (nexora#616), lu par `/api/nexora/body-photos` (session du propriétaire), contexte production. Créée le 02/10/2026 : dossier « Nexora — Photos corporelles (privé) » à la racine du Drive de Quentin, **hors** du dossier « Clients » de `NEXORA_DRIVE_ROOT_FOLDER_ID`, partagé **uniquement** avec le compte de service `firebase-adminsdk-fbsvc@nexora-cb20d.iam.gserviceaccount.com` (rôle Éditeur), sans lien de partage ; l'identifiant est la fin de l'URL `https://drive.google.com/drive/folders/<ID>`. Les fichiers déposés appartiennent au compte de service : si Google lui refuse du quota (`storageQuotaExceeded`), l'import échoue avec un message explicite. Sans elle, les routes répondent `503 body_photos_configuration_missing` et le widget l'affiche. Les métadonnées (dates, repères, ajustements, référence) vivent dans Firestore, collections `bodyPhotos` et `bodyPhotoSettings`, hors `kv_store`. Une variable ne vaut qu'après un nouveau déploiement ;
- `SECRETS_SCAN_OMIT_KEYS=NEXORA_SPORT_CSV_URL` — n'est plus nécessaire depuis le retrait du moteur externe (nexora#597) : le scanner de secrets de Netlify ne trouve plus l'URL dans les fichiers publiés. Peut être supprimée par Quentin ; la garder est sans effet. Ne pas y ajouter `NEXORA_HEALTH_CSV_URL` : cette URL n'est publiée nulle part ;
- `QME_INTAKE_SIGNING_KEY` — secret, endpoint d'ingestion prospect QME (nexora#279) — distinct de `NEXORA_ASSISTANT_API_KEY`, jamais partagé avec le site `qme-engineering` autrement que via cette variable ;
- `QME_SITE_ORIGIN` — configuration publique, origine attendue du site QME (ex. `https://qme-engineering.netlify.app` ou le domaine personnalisé une fois branché) ;
- `SECRETS_SCAN_SMART_DETECTION_OMIT_VALUES` — valeur publique Firebase uniquement.

### `nexora-chatgpt-mcp`

- `FIREBASE_SERVICE_ACCOUNT_JSON` — secret ;
- `FIREBASE_WEB_API_KEY` — configuration Firebase publique ;
- `MCP_CLIENT_SIGNING_KEY` — secret ;
- `MCP_PUBLIC_ORIGIN=https://nexora-chatgpt-mcp.netlify.app` ;
- `NEXORA_ASSISTANT_API_KEY` — secret ;
- `NEXORA_USER_UID` — secret.

Ne placer aucune de ces valeurs dans GitHub. La connexion Git–Netlify réutilise les variables déjà stockées dans chaque projet Netlify.

## Procédure sans interruption

1. Créer le dépôt GitHub privé `nexora` et pousser cette arborescence sur `main`.
2. Attendre la réussite de `Nexora CI`.
3. Relier d'abord `nexora-chatgpt-mcp` au dépôt avec la base `apps/nexora-mcp`, sans changer son domaine.
4. Produire un Deploy Preview et valider `/health`, les métadonnées OAuth et les tests MCP.
5. Relier ensuite `nexora-project` avec la base `apps/nexora`, sans changer son domaine.
6. Produire un Deploy Preview et valider l'interface, `/api/nexora/health`, lecture, création idempotente, relecture et archivage d'une tâche de recette.
7. Publier les deux déploiements sur `main` seulement après succès des contrôles.
8. Relire les deux Deploy IDs et exécuter `npm run smoke:production`.

## Contrôles de non-régression

### Firebase

- le `projectId` reste `nexora-cb20d` ;
- aucune migration ni suppression de données ;
- lecture et écriture de `users/{uid}/kv_store` inchangées ;
- clés `nexora:*` préservées, notamment `projects`, `tasks`, `taskArchive`, `workflows`, `workflowExecutionLog`, `notifications`, `gcalSettings` et `gcalSyncState` ;
- collections OAuth MCP `nexora_mcp_codes`, `nexora_mcp_access` et `nexora_mcp_refresh` toujours inaccessibles aux clients.

### MCP ChatGPT

- URL MCP inchangée ;
- OAuth PKCE S256, code à usage unique, access token 1 h et refresh 30 jours inchangés ;
- outils `list_projects`, `create_task` et `get_task` présents ;
- `create_task` accepte aussi les pièces jointes Google Drive ;
- création idempotente et relecture obligatoires.

### Automatisations ChatGPT

- ne modifier aucun ID ni horaire d'automatisation ;
- conserver `https://nexora-project.org` et l'alias historique `https://nexora-project.netlify.app` ;
- vérifier les routines de tri Gmail, classement Drive, briefs et rapports Nexora ;
- vérifier que les tâches créées depuis Gmail ou ChatGPT conservent leurs liens source et Drive.

### Todoist

- préserver les fonctions Firebase v2 `todoistOAuthStart`, `todoistOAuthCallback`, `syncTodoist` et `todoistWebhook` dans `us-central1` ;
- ne pas modifier leurs URL Cloud Run, secrets Firebase/Google Cloud, configuration OAuth ni webhook pendant la bascule Netlify ;
- conserver le flux Todoist vers Nexora : label `nexora`, import unique dans le projet `Inbox`, puis suppression de la tâche Todoist importée ;
- le flux **Nexora vers Todoist** a été supprimé de l'interface : plus de token personnel en
  `localStorage`, plus de création dans l'Inbox Todoist avec le label `nexora-mobile`, plus de
  liaison par `todoistTaskId`, plus de synchronisation de la complétion. `scripts/verify-repository.mjs`
  interdit désormais toute réapparition d'un appel à `api.todoist.com` dans l'interface ;
- `todoistCompletedAt` reste **lu** par `taskCompletionDate`, jamais écrit : les tâches terminées
  à l'époque par cette synchronisation gardent leur vraie date de complétion ;
- effectuer la recette après Deploy Preview : créer une tâche Todoist étiquetée `nexora` et
  vérifier qu'elle arrive bien dans le projet `Inbox` de Nexora, puis disparaît de Todoist.

Les fonctions Todoist Firebase ne sont pas migrées vers Netlify dans cette opération. Elles restent déployées sur le projet `nexora-cb20d`, ce qui découple leur continuité du changement de source GitHub des deux sites Netlify.

### Telegram Budget360 — hors périmètre

Le seul bot Telegram retrouvé est la fonction Netlify `telegram` du projet `agent-comptes-quentin`, route `POST /api/telegram/webhook`. Il pilote Budget360 et ne dépend pas du dépôt Nexora. La migration Nexora ne doit modifier ni ce site, ni sa fonction, ni ses variables.

## Retour arrière

En cas d'échec, republier le dernier Deploy ID fonctionnel du projet concerné. La base Firebase n'étant pas migrée, aucun retour arrière de données n'est requis.
