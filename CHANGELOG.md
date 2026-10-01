# Journal des versions — Nexora

Versions officielles de Nexora (application, API, fonctions planifiées et MCP),
au format `MAJEUR.MINEUR.CORRECTIF[-rc.N]`, majeure `0` tant que le produit est en
démonstration. La version déclarée vit dans `publication/version.json` ; la
production réellement servie, composant par composant, dans
`publication/registre.json`. Voir [`docs/PUBLICATION.md`](docs/PUBLICATION.md).

Chaque lot ajoute ses lignes sous « À venir ». `outils/publier preparer --version X.Y.Z`
transforme cette section en `[X.Y.Z] — date` au moment de préparer la version.

## À venir

### Nouveautés

- Tableau de bord : widgets « Sankey mensuel (flux) » et « Structure du patrimoine (Sankey) » repris d'OS360 à l'identique (calcul, mise en page, infobulles, données), alimentés en lecture seule par KDM360 via `/api/nexora/finance-sankey-data` (session du propriétaire vérifiée) (Ref #569).
- Widgets Sankey : tous les réglages en en-tête (variante, barre de période « Aujourd'hui · Ce mois · Mois précédent · mois » d'OS360, montants, étiquetage, arrondi, décimales, opacité, Données) (Ref #569).
- Tableau de bord : widget « Transactions (Budget) » — 100 % des transactions KDM360 (annulées et annulations signalées), tous les champs, colonnes affichables au choix, recherche dans tous les champs, tri, export CSV, en lecture seule via `/api/nexora/finance-transactions-data` (Ref #572).
- Réglages → « Catégories Budget » : catégories et sous-catégories KDM360 modifiables depuis Nexora (ajout, renommage répercuté sur les transactions et les règles en une transaction, couleur, budget mensuel, activation, suppression refusée si utilisée), via `/api/nexora/finance-references` et la fonction SQL `finance_admin_reference_edit` (Ref #574).
- Tableau de bord : widget « Graphique financier (OS360) » — les 40 widgets Budget d'OS360 (graphiques du mois, patrimoine, annuels, analyses personnalisées, cartes, listes), rendus par le moteur d'OS360 lui-même dans un iframe isolé, avec sa barre de période et son panneau de réglages ; données via `/api/nexora/finance-budget-data` (Ref #573).
- Tableau de bord : widget « Activités sport » — toutes les activités du journal « Activités Strava » d'OS360, tous les champs, colonnes au choix, filtres sport et période (semaine ISO, mois, année, glissantes, dates libres), recherche, tri, export CSV, réglages dans l'en-tête ; lecture seule via `/api/nexora/sport-activities` (session du propriétaire, URL de la source dans la variable Netlify `NEXORA_SPORT_CSV_URL`, parseur à parité avec OS360) (Ref #578).
- Tableau de bord : widget « Sport par activité (barres empilées) » — une barre par jour, semaine ISO (lundi) ou mois, une couleur stable par sport ; mesure au choix (séances, durée totale, durée en mouvement, distance, dénivelé), sports et période, réglages dans l'en-tête ; activités sans valeur signalées, jamais comptées pour zéro (Ref #579).
- Tableau de bord : widget « Graphique sport (OS360) » — les widgets Santé et Sport d'OS360 rendus par son moteur sur le journal sportif (message `nx-sport`), par défaut « Temps de sport par semaine » ; données d'exemple du bundle OS360 jamais affichées (Ref #579).
- Cartes personnalisables : bloc « Total sport » — sports, période (dont « N derniers jours » et dates libres), mesure (séances, durées, distance, dénivelé, FC) et agrégation (somme, moyenne, maximum, minimum, nombre) ; moyenne de FC pondérée par la durée comme OS360 (Ref #580).
- Widgets sport : période « N derniers jours » au nombre libre (Ref #580).
- Budget natif, sans réglage : widgets « Budget du mois » (dépenses, revenus, solde net et reste à dépenser dans une carte unique, suivi par catégorie dépassements en tête, navigation par mois), « Budget — À catégoriser » (opérations sans catégorie, à sous-catégorie à préciser ou classées par l'IA avec une confiance < 85 % sur 60 jours ; correction en un clic et saisie manuelle d'une opération) et « Patrimoine par banque » (total, évolution sur 12 mois, barres empilées par banque et type de compte). Calculs d'OS360 traduits dans `lib/finance-budget.mjs`, servis par `/api/nexora/finance-budget-summary` ; écritures du propriétaire par `/api/nexora/finance-owner-transactions` (fonction SQL `finance_apply_transaction_write`, idempotente) (Ref #586).
- Rapport du matin : champ `budget` (reste à dépenser, catégories au-dessus ou à 90 % de leur budget, opérations à catégoriser), calculé avec les mêmes règles (Ref #586).
- Tableau de bord : widget « Graphique Budget » — Sankey mensuel et annuel (portage natif #569), waterfall, dépenses cumulées par catégorie, small multiples avec budget, donut, waffle et dépenses par mois sur 12 mois, calculés avec les règles d'OS360 (`lib/finance-budget.mjs`, vérifiés contre les fonctions d'origine) ; graphique et période choisis dans l'en-tête, aucun autre réglage (Ref #587).
- Assistant : routes `/api/finance/budget-summary` et `/api/finance/transactions/search` (clé de l'assistant, lecture seule) et outils MCP `get_budget_summary`, `search_budget_transactions`, `categorize_budget_transaction` (politique de confirmation de `/api/finance/transactions` conservée) (Ref #587).

### Corrections

### Incompatibilités

## À venir

### Incompatibilités

- Retour à la publication systématique : chaque fusion dans `main` publie la production (builds Git Netlify) ; préproduction abandonnée (Ref #553).

## [0.1.1] — 2026-09-30

### Nouveautés

- Pixel Tasks, « Rameaux » : un fil pointillé descend de chaque bourgeon le long des tâches du sous-groupe, avec un nœud par tâche, plein quand elle est terminée (Ref #546).



## [0.1.0] — 2026-09-30

### Nouveautés

- Versions officielles, environnements local et préproduction, publication volontaire et réversible par `outils/publier` (Ref #544).
- `version.json` public sur chaque site ; bandeau LOCAL / PRÉPRODUCTION et `noindex` hors production.
- Préproduction en données fictives : aucun accès à Firebase de production, aucune fonction déposée.
- Pixel Tasks : sous-groupes « Rameaux » sous les groupes principaux (projet, dossier, statut, responsable, type, jalon/durée) — tronc, rameaux, bourgeons qui éclosent, ruban spectral (Ref #546).


### Incompatibilités

- Une fusion dans `main` ne publie plus la production : la publication passe par `outils/publier production`, après feu vert explicite.
- Branche `develop` abandonnée : les PR visent `main`, la préproduction se fait depuis `main` (Ref #549).

## État initial (non versionné) — relevé du 29/09/2026

Aucune release vérifiable ne précédait ce mécanisme. Productions servies au relevé :
application `6abbe79f8b2d340008fd780f` (commit `445bc3a03f2b`), MCP
`6abb99a8d32416000815a1f7` (commit `a46b51d549e9`). Aucun tag rétroactif.
