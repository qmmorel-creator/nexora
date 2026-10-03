# Prompt : intégrer quatre modules de Nexora Futur dans Nexora Future Optim

**Les deux dossiers du dépôt :**
- **Source, à lire seulement** : le dossier `apps/nexora-futur` du dépôt `qmmorel-creator/nexora`, branche `main`. Le site correspondant est https://nexora-futur.netlify.app. Tout le travail de la session Futur est fusionné dans `main` ; la dernière PR est #704.
- **Cible, à modifier** : le dossier `apps/nexora-future-optim` du même dépôt. Le site est https://nexora-future-optim.netlify.app, avec un N comme Noémie.

**Ne modifie pas `apps/nexora-futur`** : Quentin y a arrêté le développement.

## Contexte

Tu travailles dans le dépôt GitHub `qmmorel-creator/nexora`. Avant tout, lis `CLAUDE.md` et `.github/PROCESS.md`, puis applique la « Convention pour l'assistant ».

- Pars toujours du dernier `main`.
- Crée une sous-issue de #687 par module.
- Passe chaque sous-issue en `statut:en-cours` au début du travail.
- Écris les commits avec `Ref #N`, jamais `Closes` ni `Fixes`.
- Lance `npm run install:all && npm run verify` avant chaque push.
- Ouvre une PR vers `main` et ne la fusionne que si son `verdict` est vert.
- Après la fusion : vérifie la production, commente l'issue (URL, SHA, Deploy ID) et passe-la en `statut:à-tester`.

**Site cible** : `apps/nexora-future-optim`, publié sur https://nexora-future-optim.netlify.app (issue mère #687). Lis son `README.md`.
- Sa couche `src/donnees` est celle de Nexora Futur, reprise sans changement de règle.
- Son interface est dans `src/optim` : coquille `Coquille.tsx`, contexte `useOptim()` / `useUi()`, styles `optim.css` et `app.css` (classes `hx-*`, `ox-*`).
- Ses préférences sont dans la clé `nexora:optimPrefs` (`src/donnees/prefs.ts`). **Il ne lit ni n'écrit `nexora:futurPrefs`.**

**Site source** : `apps/nexora-futur` (sur `main`). On y prend quatre modules : **Triage**, **Phrase**, **Archive** et les **frises**. La logique (fonctions pures et tests) se copie telle quelle. L'interface, elle, se **réécrit dans le langage visuel d'Optim** (classes `hx-*`, `useOptim`, `useUi().notifier`, `useUi().ouvrir`), et non avec les composants de Futur (`Bouton`, `Surtitre`, `Segment`, `Cartouche`, `useDonnees`, `useNotifier`).

**Garde-fous** :
- Aucune nouvelle clé Firebase ouverte à l'écriture. Les quatre modules n'ont besoin que de clés déjà ouvertes dans Optim : `nexora:tasks`, `nexora:taskArchive`, `nexora:activityLog`, `nexora:habitLog`, `nexora:habitSkips`, `nexora:optimPrefs`.
- Toute préférence nouvelle va dans `nexora:optimPrefs`. Étends `PrefsOptim`, `normaliser…` et la fusion **en conservant les champs inconnus**.
- Les tests `tests/garde.test.ts` et `tests/lecture-seule.test.ts` doivent rester verts.
- En démo (`VITE_DEMO=1`), complète `src/demo/donnees.ts` si un module a besoin de cas visibles.

Livre un module par PR, dans l'ordre ci-dessous. Chaque PR doit avoir ses tests unitaires et une capture à 1440 px et à 390 px (pas de défilement horizontal, aucune erreur console).

---

## Module 1 : Triage

Le Triage présente une décision à la fois, tirée par des règles, sans IA.

**Sources dans Futur**
- `src/donnees/triage.ts` : `cartesTriage(ctx, regles, moment, reports)`, `jourLibre`, `relaisPour`, `projetProbable`, `normaliserRegles`, `nettoyerReports`, `REGLES_DEFAUT`.
- `src/cockpit/Triage.tsx` : `PageTriage`, `compterTriage`, `Reglages`.
- `src/cockpit/triage.css`.
- `tests/triage.test.ts` (8 tests).

**Comportement à conserver**
- **Cartes** :
  - retards sans activité ;
  - tâches sans date ou à ranger (projet probable) ;
  - réunions sans compte rendu ;
  - éléments créés par l'assistant (`source: "assistant"`) ;
  - habitudes manquées hier ;
  - opérations bancaires à catégoriser, lues par le relais finances d'Optim (`budget-summary`, champ `toCategorize`).
- **Moments** : matin et soir. Le soir présente ce qui reste dû aujourd'hui.
- **Décisions au clavier** : A appliquer, R reporter, S passer, U annuler la dernière décision.
  - L'écouteur clavier est unique, posé en phase de capture, et lit l'état par `useRef`.
  - La décision et la fin d'animation se posent dans le même rendu, pour qu'un U rapide fonctionne.
  - Une carte annulée revient (liste `revenues`).
- **« Revoir dans N jours »** : reports mémorisés.
- **Règles activables** : les cases s'actualisent tout de suite (état local optimiste), puis la valeur enregistrée reprend la main.
- **Préférences** : ajoute `triage: { regles, reports }` à `PrefsOptim`. Reprends `normaliserRegles` et `nettoyerReports`.
- **Accès** : un **onglet « Triage » dans la barre du haut** (`NAV` de `src/optim/Coquille.tsx`, adresse `/triage`), avec le compteur `compterTriage` affiché comme le compteur de retards de « Projets ». Ajoute aussi un lien depuis la Journée, le matin et le soir.

**Critères d'acceptation** :
- les 8 tests de `triage.test.ts` sont portés et verts ;
- appliquer, annuler, revoir et désactiver une règle fonctionnent en démo ;
- le compteur de la navigation se met à jour.

---

## Module 2 : Phrase, avec vues enregistrées

La question s'écrit comme une phrase dont chaque mot souligné se change. La réponse (grand chiffre et détail) est recalculée en direct. Quentin y tient **à condition de pouvoir enregistrer des vues**.

**Sources dans Futur**
- `src/donnees/phrase.ts` :
  - `MODELES`, `DEFAUTS`, `options`, `calcul`, `texte`, `cle`, `choisir` ;
  - `normaliserPhrase`, `epingler`, `MAX_TUILES` ;
  - les types `Detail` et `Reponse`.
- `src/cockpit/Phrase.tsx` : `PagePhrase`, `DetailReponse`, `useLectures`.
- `src/cockpit/phrase.css`.
- `tests/phrase.test.ts` (5 tests).

**Comportement à conserver**
- **Cinq modèles de phrase** :
  - tâches : état, personne, projet ; les calendriers sont exclus ;
  - dépenses : catégorie, période ; lues par le relais finances d'Optim, un appel par mois, mis en cache ;
  - sport : activité, période ; lu par le relais corps d'Optim ;
  - charge : personne ou équipe, horizon, `capacityPerDay` ;
  - habitudes : période.
- **Changer un mot** : au clic (menu), ou avec le focus sur le mot puis ↑ ↓.
- **Vues enregistrées** :
  - liste rangée par espace, avec le chiffre du moment ;
  - ouvrir, renommer, supprimer ;
  - état « modifiée » quand un mot change, avec « Mettre à jour » ou « Enregistrer comme vue » (touche S) ;
  - adresse propre à chaque vue : `/phrase?vue=id`.
- **Tuiles épinglées** : touche E, 6 au maximum.
- Les touches S et E sont écoutées **en capture**, pour passer avant le clavier global d'Optim (N et C ouvrent la saisie).
- **Stockage** : `nexora:optimPrefs`, champ `phrase: { vues, tuiles }`.
- **Décision de Quentin** : les vues de Phrase restent **séparées** des vues enregistrées de Planning et Projets (`VueEnregistree`, `prefs.vues`). N'y touche pas et ne les mélange pas.
- **Accès** : un **onglet « Phrase » dans la barre du haut** (`NAV`, adresse `/phrase`).

**Critères d'acceptation** :
- les 5 tests sont portés et verts ;
- en démo, on peut changer un mot, enregistrer, épingler, modifier au clavier, mettre à jour, ouvrir une vue par son adresse, la renommer puis la supprimer.

---

## Module 3 : Archive

**Sources dans Futur**
- Vue « Archive » de `src/cockpit/Cockpit.tsx` (adresse `/archive`, rendu autour de `vue === "archive"`).
- Mutations dans `src/cockpit/actions.ts` : `archiverTache`, `restaurerTache`, `archiverPlusieurs`, `restaurerPlusieurs`. Elles existent déjà dans `apps/nexora-future-optim/src/donnees/actions.ts`.

**Comportement à conserver**
- Liste des tâches de `nexora:taskArchive`, triée par `archivedAt` décroissant, avec le compte et la mention « purge après 30 jours ». Cette mention est affichée seulement : aucune purge n'est faite par ce site.
- Pour chaque tâche : titre, projet (point de couleur), date d'archivage et bouton **Restaurer**. La restauration est annulable par la notification « Annuler » d'Optim.
- À ajouter dans Optim, car c'est utile et sans risque :
  - recherche par titre ;
  - filtre par projet ;
  - restauration multiple (cases à cocher).
- Archiver reste possible depuis la fiche (déjà présent dans Optim) et doit renvoyer vers cette liste.
- **Accès** : un **onglet « Archive » dans la barre du haut** (`NAV`, adresse `/archive`), avec le nombre de tâches archivées.

**Critères d'acceptation** :
- archiver depuis la fiche, retrouver la tâche dans l'archive, la restaurer, puis annuler la restauration ;
- un test unitaire du tri et du filtre.

---

## Module 4 : la frise 12 semaines de la page projet

Quentin a choisi **la « Frise · 12 semaines » de la page projet de Futur**. Les six représentations de Gantt d'Optim (`src/optim/frise.tsx`, `Planning.tsx`) **restent telles quelles** : n'y touche pas.

**Sources dans Futur**
- `src/donnees/projet.ts`, fonction `friseProjet(taches, idProjet, catalogues, jour)` :
  - fenêtre de 84 jours, du jour J−28 au jour J+56 ;
  - tâches du projet qui ont un début et une fin, triées par début ;
  - les tâches terminées sont gardées seulement si leur fin est dans la fenêtre et au plus tôt aujourd'hui ;
  - drapeau `retard` (`estEnRetard`) ;
  - renvoie `{ debut, jours: 84, auj: 28, barres: [{ t, debut, fin, retard }] }`.
- Rendu : `src/cockpit/PageProjet.tsx`, section `frise`.
  - 13 graduations hebdomadaires datées (jj/mm) ;
  - trait rouge d'aujourd'hui ;
  - une barre par tâche, à la couleur du projet, avec le titre sur la barre ;
  - jalons en losange (◆) sans fond ;
  - tâches terminées à demi-opacité ;
  - retards sur fond rouge pâle avec un liseré, et « · retard N j » ajouté au titre ;
  - hauteur `max(60, barres × 22 + 26)` px ;
  - un clic ouvre la fiche ;
  - texte vide : « Aucune tâche datée dans la fenêtre. »
- Styles : `src/cockpit/cockpit.css`, lignes 162-180 (`.pp-frise`, `.pp-semaine`, `.pp-auj`, `.pp-barre`, `.finie`, `.retard`, `.jalon`, `.pp-vide`). Reprends-les en classes `ox-*` ou `hx-*`, avec les couleurs d'Optim.
- Test : `tests/projet.test.ts` (le cas `friseProjet`).

**Dans Optim**
- `friseProjet`, `BarreFrise` et `duProjet` **existent déjà** dans `apps/nexora-future-optim/src/donnees/projet.ts`, repris de Futur. Réutilise-les sans les recopier. Vérifie seulement qu'ils sont identiques à ceux de Futur et qu'un test les couvre ; sinon, porte le cas `friseProjet` de `tests/projet.test.ts`. Le travail porte sur l'affichage.
- Affiche la frise dans la page d'un projet (`src/optim/Projets.tsx`, quand un projet est ouvert), en section « 12 semaines », au-dessus ou à côté de la représentation de Gantt existante.
- Le clic ouvre la fiche Optim avec `useUi().ouvrir(id)`.

**Critères d'acceptation** :
- le test `friseProjet` est porté et vert ;
- en démo, un projet affiche ses barres, le trait d'aujourd'hui, un jalon, un retard et une tâche terminée ;
- un clic ouvre la fiche ;
- à 390 px, la frise tient dans la largeur, sans défilement horizontal de la page.

---

## Ce qu'il ne faut pas reprendre

Ces éléments de Futur sont hors périmètre, sauf demande de Quentin :
- le Cadran ;
- l'Atlas ;
- la lentille Frise du Cockpit (barres, bulles, métro) ;
- l'écran Réglages et ses écritures de configuration ;
- l'identité Clarté (Optim a la sienne) ;
- la liaison Strava ;
- la capture externe ;
- les exports.

## Comment vérifier

- Dans `apps/nexora-future-optim` : `npm run check`, `npm test`, `npm run build` (refuse tout code de démonstration en production).
- Depuis la racine du dépôt : `npm run install:all && npm run verify`.
- Démo : `VITE_DEMO=1 npm run dev`, puis captures avec le Chromium installé : `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
