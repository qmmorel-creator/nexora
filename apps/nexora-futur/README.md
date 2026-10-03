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
| `1` · `2` · `3` | Lentille Liste · Colonnes · Page (projet) |
| `4` · `5` · `6` | Lentille Frise · Agenda · Tableur (#658) |
| `7` · `8` | Lentille Densité · Synthèse (#658) |
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

## Frise, Agenda, Tableur (lot 5a, #658)

Trois lentilles de plus, sur la même requête que la liste (filtres, tri, regroupement) :

- **Frise** (`v=frise`) : Gantt des tâches datées et des jalons, barre de synthèse par groupe
  (avancement pondéré par la durée). On glisse une barre pour la déplacer, un bord pour changer
  le début ou la fin. Chemin critique (dépendances, ancré sur les fins) et comparaison à la
  **référence** ou au **plan initial**, avec repli sur `nexora:taskBaselines`. Les réglages sont
  synchronisés dans `nexora:futurPrefs`.
- **Agenda** (`v=agenda`) : grille continue de semaines (tâches ouvertes, multi-jours en bandeaux)
  et frise horaire du jour choisi (terminées comprises).
- **Tableur** (`v=tableur`) : édition en ligne ; sélection multiple et édition en masse (statut,
  type, projet, responsable, jalon, avancement, dates fixées ou décalées, dupliquer, archiver),
  toujours annulable. Colonnes au choix, synchronisées.
- **Fiche** : section « Référence de planning », avec « Figer la référence » (l'ancienne est
  gardée dans l'historique, la première sous « Initiale »).

## Densité, Synthèse, Bulles et Métro (lot 5b, #658)

- **Frise** : trois styles, Barres, **Bulles** (côte à côte dans un couloir, une ligne de plus
  seulement si elles se chevauchent) et **Métro** (une ligne par groupe, une station par tâche).
- **Densité** (`v=densite`) :
  - **Mois** : 3 mois, tâches sur leur fin, couleur des projets ;
  - **Croisée** : deux axes au choix, nombre, retards, criticité ou progression ;
  - **Pixels** : 1 tâche = 1 pixel, par jour, semaine ou mois ; les retards sont reportés sur la
    période en cours.
- **Synthèse** (`v=synthese`) :
  - indicateurs : tâches, avancement, jalons, urgentes, dérive et retards sur la référence ;
  - graphique en 7 styles ;
  - **Treemap** des projets : surface = nombre de tâches, couleur = volume, criticité (score de
    nexora-project), dérive ou avancement ;
  - **notes** des tableaux de bord en lecture seule (Markdown).
- Hors périmètre (décision du 2026-10-03) : Fleuve du temps, Cosmos, cartes 3D, Réunions 3D.

## Finances (lot 6a, #659)

- **Relais** `/api/futur/finance/*` (`netlify/functions/futur-finance.mts`). La fonction vérifie le
  jeton Firebase du propriétaire, puis le transmet à `nexora-project.org/api/nexora/finance-*`.
  Les calculs sont ceux de `lib/finance-budget.mjs`. **Aucun secret KDM360 n'est copié** sur
  nexora-futur (décision du 2026-10-03).
- **Liste blanche** (`_partage/relais-finance.ts`, testée) : quatre lectures (`budget-summary`,
  `wealth-series`, `sankey-data`, `transactions-data`) et la seule **catégorisation**
  (`PATCH categoriser`, corps reconstruit).
- **Vues** : synthèse du mois et d'une période libre, à catégoriser, transactions (recherche,
  export CSV), patrimoine (répartition, évolution).

## Finances, suite (lot 6b, #659)

- **Graphiques** (charts de `budget-summary`) : cascade, donut, gaufre, 12 mois (détail par
  catégorie), et **cumul** en 5 modes (catégories, face au budget, trajectoires, petits multiples,
  dépenses du jour). Palette et règle « Autres » de nexora-project.
- **Flux** (lignes brutes de `sankey-data`) : revenus → comptes → dépenses, ou patrimoine
  type → banque → compte. Mise en page propre à Futur, sans optimisation des croisements.
- **Pro**, en lecture seule (`nexora:quotes`, `nexora:invoices`, `nexora:pro*`) : synthèse
  Finance PRO (CA signé, planifié, facturé, encaissé, restes, trésorerie, seuil de TVA en
  franchise), échéances de facturation, devis, factures, livre des recettes.
- **Page projet** : rythme de dépense (burn rate) dans la section Budget.
