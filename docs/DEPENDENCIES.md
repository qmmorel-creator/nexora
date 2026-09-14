# Dépendances et contrats stables

| Consommateur | Dépendance Nexora | Garantie de migration |
|---|---|---|
| Interface web | Firebase `nexora-cb20d` | configuration client et domaine conservés |
| Fonctions Netlify | Firebase Admin + UID propriétaire | variables Netlify conservées |
| MCP ChatGPT | API `https://nexora-project.org/api/nexora/*` | domaine et Bearer inchangés |
| Automatisations ChatGPT | URL Nexora, OpenAPI, MCP ou navigateur | domaines et routes conservés |
| Todoist Firebase | OAuth, webhook et synchronisation dans `nexora-cb20d`, étiquette `nexora` | fonctions et URL Firebase inchangées — **seul** flux Todoist conservé |
| Bot Telegram Budget360 | projet Netlify `agent-comptes-quentin` | hors périmètre ; aucune modification |
| Rapports planifiés | fonctions Netlify Nexora | CRON et protections anti-double exécution conservés |
