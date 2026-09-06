# Import Google Calendar via ChatGPT

Le MCP expose `get_google_calendar_import_config` et `import_google_calendar_events`.
L'accès Google reste celui du connecteur Google Calendar de ChatGPT. Le serveur MCP
ne reçoit aucun jeton Google et ne contacte pas Google.

1. Lire la configuration : elle provient de `nexora:gcalSettings`, et non de
   `syncedCalendarSettings` (calendriers publics français). Les projets Google doivent exister.
2. Lire tous les événements, occurrences comprises, de chaque calendrier sélectionné,
   dans la fenêtre retournée, avec pagination. Convertir les bornes civiles en Europe/Paris.
3. Transmettre les champs Google originaux par lots de 50 maximum : id, status, summary,
   description, location, start, end, updated, recurringEventId, originalStartTime.
   Garder chaque requête sous 200 Ko. Ne pas tronquer une description pour passer cette limite.
4. Fournir calendarId, configVersion, observedAt (heure réelle de lecture) et une
   idempotencyKey stable par exécution/lot. Reprendre la même requête en cas de réessai.
5. Relire les taskId retournés. Consigner dans le registre le résultat de tous les lots.

Les identifiants Nexora existants, notes personnelles, liens et archives sont conservés.
Seules les annulations explicites archivent une tâche. Une absence dans une page ou une
fenêtre ne supprime rien. Les tâches natives restent intactes. Une tâche déjà archivée
n'est pas recréée automatiquement. Les annulations rétablies demandent une restauration explicite.
Chaque lot est atomique et dédupliqué par calendrier et identifiant Google. Une erreur
après plusieurs lots laisse un import partiel, à reprendre et à signaler comme tel.

La routine ChatGPT horaire de classement Drive porte ce traitement. Aucun nouveau cron.
Après déploiement, actualiser les métadonnées du connecteur si les nouveaux outils ne sont pas visibles.

Validation : `npm run check` et `npm test`. Tests de conservation des IDs et notes,
réessais, annulations, dates Europe/Paris et fins de journée exclusive, fenêtres,
configurations périmées, sources dupliquées et protection des tâches natives.
