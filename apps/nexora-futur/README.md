# Nexora Futur

Nouvelle version de Nexora, publiée sur https://nexora-futur.netlify.app (issue mère #652).

- `npm ci && npm run dev` : serveur de développement (http://127.0.0.1:5173).
- `npm run check`, `npm test`, `npm run build`.
- **Lecture seule** : aucune écriture Firestore tant qu'une clé n'est pas ouverte dans
  `src/donnees/config.ts` (`CLES_ECRITURE_OUVERTES`). Le test `tests/lecture-seule.test.ts`
  refuse toute fonction d'écriture Firestore dans `src/`.
- Le site `nexora-project` n'est pas concerné : sa commande `ignore` ne regarde que `apps/nexora`.
