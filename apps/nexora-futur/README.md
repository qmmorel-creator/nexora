# Nexora Futur

Nouvelle version de Nexora, publiée sur https://nexora-futur.netlify.app (issue mère #652).

## Commandes

- `npm ci` puis `npm run dev` : serveur de développement (http://127.0.0.1:5173), données Firebase réelles.
- `VITE_DEMO=1 npm run dev` : **démonstration**, données fictives en mémoire, sans Firebase ni connexion.
- `npm run check`, `npm test`, `npm run build`.
- `npm run e2e` : parcours de bout en bout du Cockpit dans Chromium, sur les données de démonstration.
  Il demande Playwright, à indiquer avec `PLAYWRIGHT_MODULE=<chemin de playwright/index.mjs>`
  et `CHROMIUM_PATH=<binaire>` s'ils ne sont pas installés dans ce dossier.

## Garde-fous

- **Écriture** : seules les clés de `CLES_ECRITURE_OUVERTES` (`src/donnees/config.ts`) sont
  modifiables, soit `nexora:tasks` et `nexora:taskArchive` depuis le lot 2 (#655). Toute
  écriture Firestore passe par `src/donnees/ecriture-firebase.ts`, avec le même protocole
  anti-conflit que nexora-project. `tests/lecture-seule.test.ts` refuse toute autre fonction
  d'écriture Firestore dans `src/`.
- **Démonstration** : `scripts/verifier-paquet.mjs` fait échouer le build de production s'il
  contient du code ou des données de démonstration.
- Le site `nexora-project` n'est pas concerné : sa commande `ignore` ne regarde que `apps/nexora`.

## Cockpit (lot 2)

| Touche | Action |
|---|---|
| ⌘K · Ctrl+K · `/` | Palette : créer, chercher (tâches et archive), aller à un projet, commandes |
| `C` · `N` · Ctrl+Alt+N | Nouvelle tâche, saisie rapide : `Relancer BC vendredi 14h @Vincent #CTEX6 !urgent /réunion` |
| `J` `K` · ↓ ↑ | Tâche suivante / précédente |
| ↵ / Échap | Ouvrir / fermer la fiche |
| `E` · `S` · `F` | Terminer ou rouvrir · statut suivant · focus |
| `D` · `A` | Date de fin · responsable |
| `X` · Suppr | Archiver (annulable) |
| `1` · `2` | Lentille Liste · Colonnes |
| `?` | Aide |

L'adresse décrit la vue (`/projets/<id>?v=colonnes&retard=1&t=<tâche>`) : lien profond et
bouton Précédent. Paramètres réservés : `t` (tâche ouverte) et `v` (lentille).
