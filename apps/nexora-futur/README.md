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
  modifiables : `nexora:tasks` et `nexora:taskArchive` (lot 2, #655) ; `nexora:activityLog`,
  `nexora:habitLog`, `nexora:habitSkips` et `nexora:futurPrefs` (#669). Toute
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

## Journal, habitudes, préférences (#669)

- **Journal d'activité** : chaque changement de tâche fait dans Futur est inscrit dans
  `nexora:activityLog`, avec les mêmes entrées que Nexora actuel et le même plafond de 2 000.
  Une entrée identique de moins de 5 minutes n'est pas ajoutée une seconde fois : Nexora actuel,
  s'il est ouvert, journalise lui aussi les changements qu'il reçoit (pendant côté Nexora : #670).
- **Habitudes** : coche, compteur −/+ et « non applicable », dans le Fil du jour et l'espace Corps
  (n'importe quel jour des 12 dernières semaines). Les règles sont celles de Nexora actuel :
  choix unique par thème, valeurs bornées, « non applicable » hors du total.
- **Préférences** (`nexora:futurPrefs`, clé lue par Futur seul) : dernière adresse de chaque
  espace, sections de la page projet. Synchronisées entre appareils.
