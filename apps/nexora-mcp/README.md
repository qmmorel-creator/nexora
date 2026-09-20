# Nexora MCP 1.0.0

Serveur privé Streamable HTTP : https://nexora-chatgpt-mcp.netlify.app/mcp
Site Netlify : 2c0b2293-8b71-471b-8288-21f641256aa2.

## Capacités

20 outils : list_projects, list_tasks, list_meetings, get_task, get_summary, get_health, get_activity, list_resources, read_resource, get_habit_log, create_task, update_task, complete_task, archive_task, restore_task, delete_task, add_attachment, save_meeting_report, mutate_resource, log_habit.

Les tâches et réunions sont accessibles avec descriptions complètes, checklists, pièces jointes liées, responsable, sources Gmail/Drive, dépendances, récurrence et champs personnalisés. Recherche paginée par texte, projet, statut, type, responsable, source, période et état d’archive. Les dates civiles utilisent Europe/Paris. Une échéance (end) et une réalisation (completedAt) sont deux notions distinctes. Les comptes rendus ajoutés sont conservés dans la description, sous un titre explicite. Les anciennes descriptions libres peuvent être des notes ou des ordres du jour : leur nature doit être appréciée sans invention. Une pièce jointe externe nécessite une lecture avec le connecteur de sa source.

Les domaines métier supplémentaires sont découverts avec list_resources : projets, catalogues, équipes, risques, budgets/dépenses Nexora, échéances, dossiers, tableaux de bord et réglages. read_resource renvoie la révision et la structure exacte. mutate_resource modifie un élément ou fusionne un objet de réglages. Les listes imbriquées fournies remplacent le champ concerné. Les historiques et états de synchronisation restent en lecture seule.

`taskBaselines` — le plan initial de chaque tâche, capturé côté interface à sa première apparition — s'écrit désormais, mais par un seul chemin et sous contrôle. C'est la SEULE écriture qui compte : depuis #150, l'interface lit cette même clé en repli du mode Comparaison du Gantt quand une tâche n'a jamais reçu de référence manuelle — une baseline posée ici y devient donc visible, sans intermédiaire :

- seule l'action `replace_settings` est acceptée ; `create`, `update` et `delete` sont refusés ;
- `changes` est un objet indexé par identifiant de tâche, chaque entrée valant exactement `{start, end, capturedAt}` en `AAAA-MM-JJ`, avec `start <= end` ; tout champ inattendu, toute date invalide et toute période inversée sont refusés ;
- la validation a lieu **avant** l'écriture : un lot partiellement faux n'écrit rien ;
- les entrées transmises sont **fusionnées** aux existantes — une tâche absente du lot garde sa baseline, la carte n'est jamais remplacée en bloc ;
- `expectedRevision` et `idempotencyKey` s'appliquent comme pour les autres ressources, donc la même requête rejouée ne double jamais l'écriture.

C'est une validation plus stricte que pour un réglage ordinaire, et c'est voulu : une baseline fausse reste invisible jusqu'au jour où l'on compare le réel au prévu. Aucun outil ne modifie les transactions Budget360 ou les événements Google Calendar. Aucun secret de connexion n’est exposé.

## Habit Tracker (#193)

Le catalogue `habitThemes` (thèmes → habitudes) se lit et se modifie comme n'importe quel autre catalogue, via `read_resource`/`mutate_resource`. Le journal `habitLog` (une entrée par habitude × jour, identifiant dérivé `habitId|date`) est en **lecture seule** par ces deux outils génériques : ses règles métier — exclusivité radio entre habitudes sœurs d'un thème en `selectionMode: "single"`, et bornage `[min,max]` d'une habitude `kind: "numeric"` — ne sont pas connues d'une fusion générique par identifiant.

- `log_habit` alimente le journal en langage naturel : l'habitude se désigne par `habitId`, ou par `habitName` (+ `themeId`/`themeName` en cas d'ambiguïté entre thèmes). Pour une habitude `check`, `value=true` coche, `false`/`null` décoche, omis bascule l'état ; cocher une habitude d'un thème `single` décoche automatiquement ses sœurs du même jour. Pour une habitude `numeric`, `value` est un nombre borné à `[min,max]` ou `null` pour effacer l'entrée. `date` par défaut est aujourd'hui (Europe/Paris).
- `get_habit_log` lit le journal sur une période (`dateFrom`/`dateTo`), filtrable par `habitId`/`themeId`, avec noms de thème/habitude déjà résolus.

Ces deux outils reproduisent exactement `toggleHabitLogEntry`/`setHabitLogValue` du front (`apps/nexora/source/index.html.part-002`), pour que Claude/ChatGPT et l'interface restent toujours d'accord sur l'état d'une case.

## Données et intégrité

Le serveur utilise Firebase Admin et le propriétaire fixé par NEXORA_USER_UID. Il lit les documents canoniques `users/{uid}/kv_store/nexora:*`, après vérification de ce schéma sur la production et dans le code de l’application. L’API REST et le site principal Nexora ne sont pas modifiés.

Les écritures utilisent une transaction Firestore, le format inline/chunked-v1 du site et des segments de 150000 caractères. Les révisions sont renouvelées pour que les sessions du site détectent les changements. Aucune copie intégrale périmée n’est écrasée : update_task exige une empreinte de la tâche, mutate_resource exige une révision du document. Les tâches sont fusionnées champ par champ avec la version relue en transaction. Les archivages/restaurations déplacent la tâche atomiquement entre tasks et taskArchive. La suppression définitive ne s’applique qu’à une tâche déjà archivée et nécessite une demande explicite.

Les opérations sont dédupliquées dans `users/{uid}/nexora_mcp_operations` avec empreinte de requête. Une même clé pour une autre requête est refusée. La création recherche aussi les clés historiques et les identifiants source dans les tâches et archives. Le journal ne contient pas de secrets d’authentification. Les règles Firebase existantes n’accordent pas d’accès client à cette sous-collection.

La pagination des tâches porte une empreinte des filtres et des révisions : si les données changent entre deux pages, la recherche doit recommencer. Une liste limitée ne vaut pas une lecture exhaustive. Les dates historiques invalides sont signalées dans dataQuality et ne bloquent pas une recherche. get_activity combine le journal applicatif conservé et les opérations MCP ; il ne garantit pas l’exhaustivité historique.

## Authentification

OAuth authorization-code, PKCE S256, audience MCP et UID contrôlés ; codes à usage unique, jetons opaques stockés hachés, accès une heure, renouvellement trente jours avec rotation transactionnelle. Les collections nexora_mcp_codes/access/refresh restent privées. TTL automatique sur expiresAt non configuré : l’application contrôle systématiquement l’expiration.

Variables serveur : MCP_PUBLIC_ORIGIN, FIREBASE_WEB_API_KEY (configuration publique Firebase), MCP_CLIENT_SIGNING_KEY, NEXORA_USER_UID, FIREBASE_SERVICE_ACCOUNT_JSON. NEXORA_ASSISTANT_API_KEY reste disponible pour les anciens tests/API mais le nouveau domaine métier MCP accède directement aux données canoniques. Ne jamais publier les valeurs. Elles sont conservées comme variables Netlify standard, accessibles aux administrateurs du projet.

Première connexion par e-mail/mot de passe Firebase ; pas de parcours social/MFA implémenté. La révocation d’un refresh empêche son renouvellement ; un accès déjà émis expire au plus tard une heure après émission. Une reconnexion peut être nécessaire après expiration ou révocation. Le MCP est effectivement connecté dans ChatGPT : list_projects a été exécuté par le connecteur pendant cette intervention.

## Actualiser ChatGPT

Après le déploiement, ouvrir Plugins → nexora → Refresh/Actualiser, vérifier les nouveaux outils, puis démarrer une nouvelle conversation. Ce rafraîchissement des métadonnées est une opération du compte ChatGPT ; le déploiement du serveur ne le prouve pas. L’URL et OAuth restent identiques.

Documentation officielle :
- https://developers.openai.com/plugins/deploy/connect-chatgpt
- https://learn.chatgpt.com/docs/automations

## Vérification

`npm ci --ignore-scripts`, `npm test`, `node tests/protocol.mjs`.

`tests/extended-live.mjs` reçoit sur stdin une ligne JSON des variables serveur, et TEST_REMOTE=true pour appeler le serveur publié. Ce test crée une tâche technique puis vérifie recherche, synthèse, création, déduplication, modification, conflit, lien documentaire, compte rendu, achèvement, archivage/restauration et création/suppression d’un dossier de test. La tâche est archivée et l’accès technique supprimé. Les identifiants ne doivent pas être écrits dans un fichier partagé. `tests/oauth-live.mjs` vérifie la rotation OAuth séparément.

Les tests techniques ne remplacent pas la vérification d’une exécution planifiée réelle après actualisation des métadonnées du compte ChatGPT.

## Publication et recette distante du 5 septembre 2026

Déploiement final `6a9c53b4b4f573d5a6ae6bc4` (build `6a9c53b4b4f573d5a6ae6bc2`) confirmé ready. Aucun secret détecté par le contrôle Netlify. Recette distante des 18 outils réussie ; tâche technique archivée, dossier technique supprimé, accès temporaire supprimé. Mesures ponctuelles sur ce test : recherche 1,2–1,5 s, création 3,4 s, modification 3,0 s, rejeu de création sans doublon 0,8 s. Ces mesures ne garantissent pas la durée totale d’un échange ChatGPT.

## 1.0.1 — Dates obligatoires

Chaque création et chaque modification d’une tâche impose start et end, quel que soit son type. Les dates explicites sont conservées ; une seule date remplit les deux champs. À défaut : date de réception transmise par sourceReceivedDate/sourceReceivedAt, puis date d’exécution en Europe/Paris. Les champs null ne permettent pas de vider les dates enregistrées : le repli est appliqué dans la transaction. Les réessais idempotents gardent le résultat initial. Les anciennes entrées ne sont pas modifiées en masse.

Le tri intelligent Gmail utilise la réception réelle du mail pour toute entrée dépourvue de date explicite, y compris Information. Les dates de repli sont des dates de classement et ne prouvent pas une échéance fixée par l’expéditeur.
