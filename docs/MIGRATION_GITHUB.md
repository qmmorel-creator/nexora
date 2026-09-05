# Migration GitHub — Nexora

## Objectif

Faire de GitHub la source canonique du code sans changer les URLs publiques, le projet Firebase, les identifiants Netlify ni les contrats consommés par Telegram, le MCP et les automatisations ChatGPT.

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

### Telegram

- ne pas changer le projet Firebase ni la structure `kv_store` ;
- conserver `Inbox` comme projet par défaut pour toute tâche créée depuis Telegram ;
- conserver tout endpoint, webhook, jeton et secret existant hors GitHub ;
- effectuer une recette réelle : message Telegram, création unique dans `Inbox`, relecture Nexora, puis suppression ou archivage de la tâche de test.

Le code source du bot Telegram n'est pas présent dans les deux packages récupérés. Il ne doit pas être redéployé ni modifié pendant la bascule GitHub tant que sa source canonique et son hébergement ne sont pas identifiés.

## Retour arrière

En cas d'échec, republier le dernier Deploy ID fonctionnel du projet concerné. La base Firebase n'étant pas migrée, aucun retour arrière de données n'est requis.

