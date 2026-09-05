# Nexora — passerelle d'automatisation Netlify

État : code intégré au dépôt de migration GitHub et vérifié localement le 05/09/2026. Déploiement Git non encore effectué.

Le paquet conserve l'application Nexora et la fonction `/api/nexora-storage`, puis ajoute les fonctions serveur déjà développées pour les automatisations : lecture, santé, création et mise à jour contrôlée des tâches, audit et rapports.

Validation :
- `npm test` : 16 tests réussis ;
- `npm run check` : vérification TypeScript réussie ;
- aucun secret inclus dans l'archive ; les fonctions utilisent les variables Netlify existantes.

La production doit rester sur le projet Netlify existant `nexora-project`. La connexion GitHub doit utiliser `apps/nexora` comme base directory afin de conserver les fonctions et le fichier statique dans un même déploiement.
