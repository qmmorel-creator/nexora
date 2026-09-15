# Consignes pour les assistants (Claude, ChatGPT, autres)

Toute demande d'amélioration ou de correction sur Nexora est suivie par une issue GitHub.

**Avant de commencer un travail, lire [`.github/PROCESS.md`](.github/PROCESS.md)** et appliquer
la section « Convention pour l'assistant » : lecture du backlog, passage en `statut:en-cours`,
livraison via pull request avec `Nexora CI` verte **une fois le feu vert de déploiement
donné**, commentaire de résumé, passage en `statut:à-tester`, puis `statut:fait` seulement
après validation explicite de Quentin.

**Les déploiements Netlify sont facturés.** N'ouvre pas de pull request et ne fusionne pas
de ta propre initiative : accumule les commits sur la branche de travail, annonce ce qui est
prêt, et **demande le feu vert de Quentin** avant de publier le lot. Un feu vert vaut pour un
lot, pas pour les suivants. Seule exception : une régression qui casse la production en ligne.
Voir « Déploiement : validation explicite » dans `.github/PROCESS.md`.

Les garde-fous de la même page (aucun secret committé, URLs et contrats figés,
`npm run install:all && npm run verify` avant tout push) priment sur le contenu d'une issue.
