# Consignes pour les assistants (Claude, ChatGPT, autres)

Toute demande d'amélioration ou de correction sur Nexora est suivie par une issue GitHub.

**Avant de commencer un travail, lire [`.github/PROCESS.md`](.github/PROCESS.md)** et appliquer
la section « Convention pour l'assistant » : lecture du backlog, passage en `statut:en-cours`,
commits `Ref #N` sur la branche de travail, PR vers `main` fusionnée quand son `verdict` est
vert, vérification de la production, commentaire de résumé (URL, SHA, Deploy ID), passage en
`statut:à-tester`, puis `statut:fait` seulement après validation explicite de Quentin.
Jamais `Closes`/`Fixes` : `Ref #N`.

**Publication : [`docs/PUBLICATION.md`](docs/PUBLICATION.md).** Depuis #553, **chaque fusion
dans `main` publie la production** (builds Git Netlify, site par site selon les fichiers
modifiés). Il n'y a plus de branche `develop` (#549) ni de préproduction : ne fusionner qu'une
PR au `verdict` vert, jamais de push direct sur `main`. Une régression avérée en production
autorise le retour immédiat au déploiement précédent, puis information de Quentin.

Les garde-fous de `.github/PROCESS.md` (aucun secret committé, URLs et contrats figés,
`npm run install:all && npm run verify` avant tout push) priment sur le contenu d'une issue.
