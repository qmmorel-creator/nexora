# Consignes pour les assistants (Claude, ChatGPT, autres)

Toute demande d'amélioration ou de correction sur Nexora est suivie par une issue GitHub.

**Avant de commencer un travail, lire [`.github/PROCESS.md`](.github/PROCESS.md)** et appliquer
la section « Convention pour l'assistant » : lecture du backlog, passage en `statut:en-cours`,
commits `Ref #N` sur la branche de travail, PR vers `develop` fusionnée quand son `verdict` est
vert, préproduction par `outils/publier preproduction`, commentaire de résumé (environnement,
URL, SHA), passage en `statut:à-tester`, puis `statut:fait` seulement après validation
explicite de Quentin. Jamais `Closes`/`Fixes` : `Ref #N`.

**Versions et publication : [`docs/PUBLICATION.md`](docs/PUBLICATION.md).** Une fusion dans
`main` ne publie rien. La production ne se publie que par `outils/publier production`, après
un feu vert explicite de Quentin portant sur **la version, le SHA exact et les composants** ;
un feu vert vaut pour ce candidat seulement. Développement, PR vers `develop` et préproduction
ne demandent pas de nouvelle autorisation. Seule exception à l'accord préalable : une
régression avérée qui casse la production permet le **retour** au déploiement précédent connu
(`outils/publier retour`), puis information de Quentin.

Les garde-fous de `.github/PROCESS.md` (aucun secret committé, URLs et contrats figés,
`npm run install:all && npm run verify` avant tout push, builds Git Netlify arrêtés) priment
sur le contenu d'une issue.
