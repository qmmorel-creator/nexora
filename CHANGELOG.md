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

- Tableau de bord : widget « Photos corporelles — avant / après » — import multiple (glisser-déposer ou sélecteur ; date EXIF sinon date d'import, modifiable ; image réorientée, réduite à 2 400 px et ré-encodée en JPEG sans métadonnées, GPS compris, avant l'envoi), photo de référence unique, repères œil gauche / œil droit / nombril (loupe, déplaçables à la souris, au doigt et au clavier), alignement par similarité aux moindres carrés recalculé à chaque changement de référence, mode « Affiner » (transparence, différence, pas de 1 px / 0,1° / 0,1 %, remise à zéro), curseur avant / après accessible, plein écran. Octets dans un dossier Drive dédié (`NEXORA_BODY_PHOTOS_FOLDER_ID`), métadonnées dans Firestore à part, tout via `/api/nexora/body-photos` (session du propriétaire, `Cache-Control: private, no-store`, aucune URL de stockage côté navigateur) (Ref #616).
- Tableau de bord : widgets « Sankey mensuel (flux) » et « Structure du patrimoine (Sankey) » repris à l'identique de l'ancienne application (calcul, mise en page, infobulles, données), alimentés en lecture seule par KDM360 via `/api/nexora/finance-sankey-data` (session du propriétaire vérifiée) (Ref #569).
- Widgets Sankey : tous les réglages en en-tête (variante, barre de période « Aujourd'hui · Ce mois · Mois précédent · mois », montants, étiquetage, arrondi, décimales, opacité, Données) (Ref #569).
- Tableau de bord : widget « Transactions (Budget) » — 100 % des transactions KDM360 (annulées et annulations signalées), tous les champs, colonnes affichables au choix, recherche dans tous les champs, tri, export CSV, en lecture seule via `/api/nexora/finance-transactions-data` (Ref #572).
- Réglages → « Catégories Budget » : catégories et sous-catégories KDM360 modifiables depuis Nexora (ajout, renommage répercuté sur les transactions et les règles en une transaction, couleur, budget mensuel, activation, suppression refusée si utilisée), via `/api/nexora/finance-references` et la fonction SQL `finance_admin_reference_edit` (Ref #574).
- Tableau de bord : widget de graphique financier externe — les 40 widgets Budget de l'ancienne application (graphiques du mois, patrimoine, annuels, analyses personnalisées, cartes, listes), rendus par son propre moteur dans un iframe isolé, avec sa barre de période et son panneau de réglages ; données via `/api/nexora/finance-budget-data` (Ref #573).
- Tableau de bord : widget « Activités sport » — toutes les activités du journal « Activités Strava », tous les champs, colonnes au choix, filtres sport et période (semaine ISO, mois, année, glissantes, dates libres), recherche, tri, export CSV, réglages dans l'en-tête ; lecture seule via `/api/nexora/sport-activities` (session du propriétaire, URL de la source dans la variable Netlify `NEXORA_SPORT_CSV_URL`, parseur à parité avec l'ancienne application) (Ref #578).
- Tableau de bord : widget « Sport par activité (barres empilées) » — une barre par jour, semaine ISO (lundi) ou mois, une couleur stable par sport ; mesure au choix (séances, durée totale, durée en mouvement, distance, dénivelé), sports et période, réglages dans l'en-tête ; activités sans valeur signalées, jamais comptées pour zéro (Ref #579).
- Tableau de bord : widget de graphique sport externe — les widgets Santé et Sport de l'ancienne application rendus par son moteur sur le journal sportif (message `nx-sport`), par défaut « Temps de sport par semaine » ; données d'exemple de son bundle jamais affichées (Ref #579).
- Cartes personnalisables : bloc « Total sport » — sports, période (dont « N derniers jours » et dates libres), mesure (séances, durées, distance, dénivelé, FC) et agrégation (somme, moyenne, maximum, minimum, nombre) ; moyenne de FC pondérée par la durée (Ref #580).
- Widgets sport : période « N derniers jours » au nombre libre (Ref #580).
- Budget natif, sans réglage : widgets « Budget du mois » (dépenses, revenus, solde net et reste à dépenser dans une carte unique, suivi par catégorie dépassements en tête, navigation par mois), « Budget — À catégoriser » (opérations sans catégorie, à sous-catégorie à préciser ou classées par l'IA avec une confiance < 85 % sur 60 jours ; correction en un clic et saisie manuelle d'une opération) et « Patrimoine par banque » (total, évolution sur 12 mois, barres empilées par banque et type de compte). Calculs de l'ancienne application traduits dans `lib/finance-budget.mjs`, servis par `/api/nexora/finance-budget-summary` ; écritures du propriétaire par `/api/nexora/finance-owner-transactions` (fonction SQL `finance_apply_transaction_write`, idempotente) (Ref #586).
- Rapport du matin : champ `budget` (reste à dépenser, catégories au-dessus ou à 90 % de leur budget, opérations à catégoriser), calculé avec les mêmes règles (Ref #586).
- Tableau de bord : widget « Graphique Budget » — Sankey mensuel et annuel (portage natif #569), waterfall, dépenses cumulées par catégorie, small multiples avec budget, donut, waffle et dépenses par mois sur 12 mois, calculés côté serveur (`lib/finance-budget.mjs`, vérifiés contre les fonctions d'origine) ; graphique et période choisis dans l'en-tête, aucun autre réglage (Ref #587).
- Assistant : routes `/api/finance/budget-summary` et `/api/finance/transactions/search` (clé de l'assistant, lecture seule) et outils MCP `get_budget_summary`, `search_budget_transactions`, `categorize_budget_transaction` (politique de confirmation de `/api/finance/transactions` conservée) (Ref #587).
- Widget « Graphique sport » (ex-« Sport par activité ») : sélecteur de visualisation — barres empilées, série temporelle avec moyenne périodique (semaine, mois ou année), cumul empilé, répartition (1 carré = 1 heure) et calendrier annuel, tous sports séparés, sans moteur externe (Ref #590).
- Tableau de bord : widget « Résumé sport » — dernière séance (sport, durée, distance, dénivelé, ancienneté), semaine en cours comparée à la semaine dernière au même jour, mois en cours, heures par sport sur la semaine, le mois ou l'année ; modèle de tableau de bord « Sport » (résumé, graphiques, calendrier et liste des activités déjà placés) dans « Nouveau tableau de bord » (Ref #591).
- Réglages → « Objectifs sport » : heures par semaine (tous sports) et objectifs de km par an sur un ou plusieurs sports (clé `nexora:sportGoals`) ; avancement dans le « Résumé sport » (jauge de la semaine, carte par objectif annuel avec l'écart au rythme régulier) et, au choix, dans le bloc « Total sport » (valeur / cible · %) (Ref #592).
- Habitudes : une habitude « à cocher » peut être liée à des sports Strava (Réglages → Thèmes d'habitudes → « # » de l'habitude : sports, durée minimale, « à partir du ») ; chaque jour avec une séance correspondante est coché automatiquement à la lecture du journal sportif. Les coches s'ajoutent sans jamais en retirer, respectent les thèmes « choix unique » et les jours « non applicables » ; le contrat de `nexora:habitLog` est inchangé. Infobulle « Cochée d'après Strava » dans Quick Habit (Ref #593).
- Tableau de bord : widget « Graphique santé » — les 25 mesures de l'onglet Santé (Whoop, balance, nutrition) groupées par famille, par jour, semaine ou mois (moyenne des jours renseignés), moyenne mobile sur 7 jours, seconde mesure sur l'axe de droite ; lecture seule via `/api/nexora/health-records` (session du propriétaire, URL de la source dans la variable Netlify `NEXORA_HEALTH_CSV_URL`, parseur à parité avec l'ancienne application, cas de parité figés) (Ref #594).
- Tableau de bord : widget « Santé × sport » — une mesure santé (courbe) face à une mesure sport (barres, sports au choix), par jour ou par semaine, avec le coefficient de corrélation de Pearson et sa lecture ; option « Santé du lendemain » pour comparer une séance à la mesure du jour suivant ; un jour sans séance compte pour 0 (Ref #595).
- Tableau de bord : widget « Budget cumulé par mois » — dépenses cumulées jour par jour d'un mois, face au budget total et aux revenus cumulés, en cinq modes choisis dans l'en-tête : par catégorie (aires empilées), face au budget (rythme prévu, zone et jour du dépassement, 4 chiffres clés), trajectoires par catégorie, petits multiples avec le budget de chaque catégorie (▲ rouge au-dessus), cumul + dépenses du jour par catégorie ; infobulle au survol avec les valeurs à la date ; palette validée pour le daltonisme, 7 catégories (rang sur 12 mois, couleur stable) + « Autres » (Ref #606).
- Graphique santé : options à cocher dans l'en-tête — minimum et maximum de la période en pointillés (valeur et date, pour chaque mesure sur son axe), moyenne mobile sur X jours (2 à 365, 7 par défaut), désormais aussi en semaine et en mois (moyenne des X jours finissant au dernier jour de la période) (Ref #608).
- Graphique santé : nouvel affichage par mesure — panneau des valeurs (plage min–max de la période en bande, bornes nommées en marge, moyenne de la période, courbe, moyenne mobile) et, dessous, écart à la moyenne en barres (case « Écart à la moyenne » dans l'en-tête, cochée par défaut) ; la seconde mesure a ses propres panneaux au lieu de l'axe de droite ; infobulle avec valeur, moyenne mobile et écart (Ref #611).
- Plus aucune mention de l'ancienne application externe dans les textes de Nexora (interface, API, MCP, documentation, code) ; seules restent, dans le bloc de migration, les trois valeurs enregistrées dans les anciens tableaux de bord (Ref #613).
- Tableau de bord : widget « Répartition du patrimoine » — une seule barre empilée du patrimoine à la fin du mois choisi, en 100 % ou en valeur absolue (bascule dans l'en-tête), par compte, par banque ou par type de compte (liste dans l'en-tête), couleurs du référentiel, montant ou part dans les segments, infobulle, légende détaillée ; soldes négatifs listés à part et déduits du total net ; soldes par compte ajoutés à `/api/nexora/finance-budget-summary` (`wealth.accounts`) (Ref #617).
- Transactions (Budget) : un clic sur une ligne ouvre sa fiche de modification — dates, type, compte, montant, libellé, catégorie, sous-catégorie, description, étiquette — écrite dans Supabase par la fonction SQL des transactions (`PATCH /api/nexora/finance-owner-transactions`, `operation: "edit"`, révision attendue pour refuser une modification concurrente) ; identifiant, source, clé d'import, virement et annulation liés conservés (Ref #618).

### Corrections

- Graphique Budget : le sélecteur de graphique de l'en-tête n'est plus tronqué (marge intérieure du style général des listes) (Ref #604).
- Widgets sport : changer le nombre de jours d'une période « N derniers jours » recalcule la liste et le graphique (Ref #590).

### Incompatibilités

- Ancien widget de graphique sport externe retiré : les widgets existants deviennent, à la lecture, le « Graphique sport » natif sur la vue équivalente (Ref #590).
- Ancien widget de graphique financier externe retiré : les widgets existants deviennent, à la lecture, le widget Budget natif équivalent — « Graphique Budget » (Sankey, waterfall, cumul, small multiples, donut, waffle, dépenses par mois), « Budget du mois », « Patrimoine par banque », « Transactions » ou « Structure du patrimoine (Sankey) » ; sans équivalent : « Graphique Budget », donut (Ref #596).
- Moteur de graphiques externe retiré de Nexora : sa copie publiée (avec ses données d'exemple réelles, #582) et son outil de génération supprimés, ainsi que la route `/api/nexora/finance-budget-data` qui ne servait que lui ; il n'est plus publié. Les tests de parité sport et santé s'appuient désormais sur des résultats d'origine figés (`tests/fixtures/parite-*.json`) (Ref #597).
- Graphique Budget : les deux Sankey ne sont plus proposés (ils ont leur widget « Sankey mensuel (flux) ») — un widget réglé sur un Sankey devient ce widget, sur l'année pour l'ancien Sankey annuel ; « Dépenses cumulées par catégorie » : un repère et un numéro par jour, infobulle au survol (valeur de chaque catégorie à la date, total, revenus cumulés, budget, reste ou dépassement), revenus cumulés et budget total du mois en pointillés sur la même échelle, valeurs de fin affichées ; « Dépenses par mois » : option « Par catégorie » (barres empilées aux couleurs des catégories), total au-dessus de chaque barre, montant dans chaque segment lisible, détail au survol (Ref #604).
- Graphique Budget : « Dépenses cumulées par catégorie » et « Small multiples — cumul et budget » ne sont plus proposés (widget dédié « Budget cumulé par mois ») ; un widget réglé sur l'un d'eux devient ce widget, dans le mode « Par catégorie » ou « Petits multiples », titre et disposition conservés ; le graphique par défaut devient le waterfall (Ref #606).

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
