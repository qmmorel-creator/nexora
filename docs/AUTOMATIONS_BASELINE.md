# Automatisations ChatGPT — état avant migration

Inventaire vérifié le 05/09/2026. La migration GitHub ne doit modifier ni les identifiants, ni les horaires, ni l'état d'activation.

| ID | Titre | État | Dépendance Nexora |
|---|---|---|---|
| `6a9844f6c1a4819180a3b53394dd311d` | Classement Automatique Google Drive | active | création/mise à jour de tâches avec lien Drive |
| `6a972b7029f88191b1eafa63722c2f51` | Trier les mails intelligemment | active | création/mise à jour de tâches depuis Gmail |
| `6a9b3b0d5c3c819199c3bf0e5432e831` | Classement nocturne Drive | active | règle explicite de non-création Nexora |
| `6a8cd2cd20588191a52cacd98eda9c34` | Brief personnel du matin | active | exports assistant et réunions |
| `6a9b17dd26808191b34a414ff8bfa1d1` | Actualiser index Drive | active | contrôle Nexora en lecture |
| `6a9b1b89ae0c81919ebe965d839860c6` | Contrôle qualité quotidien | active | export assistant en lecture |
| `6a9b3b3e2fa481919d805b85ba488042` | Synchroniser Calendar dans Nexora | suspendue | interface Nexora historique |
| `6a875cbe96508191b2d7c8db1e993d19` | Synthèse mails matin | suspendue | URL de capture préremplie |

Les routines de lecture et capture utilisent encore l'alias `https://nexora-project.netlify.app/`. Cet alias appartient au même projet Netlify et doit rester disponible après la connexion GitHub.

## Validation après publication

1. ouvrir les deux exports Nexora utilisés par le brief ;
2. exécuter une création idempotente par l'API ou le MCP ;
3. vérifier une tâche avec lien Google Drive ;
4. déclencher manuellement les deux routines de création concernées ;
5. vérifier que les autres routines conservent leur comportement en lecture seule ;
6. ne réactiver aucune routine suspendue pendant cette recette.
