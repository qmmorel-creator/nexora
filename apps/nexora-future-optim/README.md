# Nexora Future Optim

Site issu du prototype hybride validé par Quentin le 03/10/2026
(`docs/maquettes/concepts-2026-10/hybride.html`), publié sur
https://nexora-future-optim.netlify.app. Issue mère : #687.

- **Accueil** : Mosaïque condensée.
- **Journée** : Cadran, Pixel Tasks et Habit Pixel.
- **Planning et Projets** : Partition, avec six représentations de Gantt.
- **Corps et Argent** : arrivent aux lots 2 et 3 (#689, #690).

## Commandes

- `npm ci` puis `npm run dev` : serveur de développement (http://127.0.0.1:5173), données Firebase réelles.
- `VITE_DEMO=1 npm run dev` : **démonstration**, données fictives en mémoire, sans Firebase ni connexion.
- `npm run check`, `npm test`, `npm run build`.

## Socle (repris de Nexora Futur, #652)

`src/donnees` est la couche données de Nexora Futur, reprise sans changement de règle :
- connexion Firebase (e-mail ou Google) ;
- lecture temps réel des clés `nexora:*` ;
- mutations rejouables avec le protocole anti-conflit de nexora-project ;
- journal d'activité ;
- règles des habitudes ;
- relais serveur vers nexora-project pour le budget, la santé et le sport (`/api/optim/*`) ; le budget passe en direct sur Supabase KDM360 dès que sa clé est posée (voir *Variables Netlify*).

Différences avec Futur :
- **Préférences** : clé `nexora:optimPrefs` (`src/donnees/prefs.ts`), propre à ce site. Elle porte la représentation de Gantt, les zooms et regroupements, les couleurs d'habitudes, le réglage d'accueil et les vues enregistrées. `nexora:futurPrefs` n'est ni lue ni écrite.
- **Interface** : `src/optim`, avec le CSS du prototype repris tel quel (`optim.css`). Les compléments sont dans `app.css`.

## Garde-fous

- **Écriture** : seules les clés de `CLES_ECRITURE_OUVERTES` (`src/donnees/config.ts`) sont modifiables :
  - `nexora:tasks` et `nexora:taskArchive` ;
  - `nexora:activityLog`, `nexora:habitLog` et `nexora:habitSkips` ;
  - `nexora:optimPrefs` ;
  - les catalogues de configuration partagés avec Nexora (Réglages, retour du 03/10/2026) : `nexora:projects`, `nexora:projectFolders`, `nexora:statuses`, `nexora:taskTypes`, `nexora:taskDefaults`, `nexora:taskTemplates`, `nexora:habitThemes`, `nexora:teamMembers`, `nexora:teams`, `nexora:sportGoals`. Chaque élément modifié reçoit `updatedAt` (`src/donnees/reglages.ts`) : Nexora fusionne ces clés élément par élément. Exception : `nexora:taskDefaults` n'est pas fusionnable côté Nexora (une écriture concurrente y affiche un bandeau de conflit, sans écrasement silencieux).
  - les autres réglages de Nexora (deuxième partie) : `nexora:milestoneTypes`, `nexora:workshops`, `nexora:staffing` (supprimer un atelier retire ses affectations), `nexora:metaTemporalBlocks`, `nexora:gcalSettings` et `nexora:syncedCalendarSettings` (réglages seuls : l'import des événements reste fait par Nexora).

  Toute écriture Firestore passe par `src/donnees/ecriture-firebase.ts`. `tests/lecture-seule.test.ts` refuse toute autre fonction d'écriture.
- **Démonstration** : `scripts/verifier-paquet.mjs` fait échouer le build de production s'il contient du code ou des données de démonstration.
- **Variables Netlify** (jamais committées) : `FIREBASE_SERVICE_ACCOUNT_JSON` et `NEXORA_USER_UID`. Sans elles, les relais (budget, santé, sport) répondent `configuration_missing`. Les tâches et les habitudes, lues directement dans Firestore, fonctionnent quand même.
- **Finances en direct** (sevrage de Nexora, #721), variables Netlify également jamais committées :
  - `KDM360_SUPABASE_SECRET_KEY` : **à poser par Quentin** dans Netlify (site nexora-future-optim). Présente, `optim-finance` lit et catégorise directement dans Supabase KDM360 (`_partage/finance-directe.ts`), mêmes réponses que nexora-project ; absente, repli automatique sur le relais vers nexora-project ;
  - `KDM360_SUPABASE_URL` : facultative, `https://ftgmjaozveprnshkdosj.supabase.co` par défaut ;
  - la catégorisation garde la clé d'idempotence `nexora:optim:<clé>` du relais : une écriture rejouée n'est pas doublée après la bascule.
- **Firebase Auth** : le domaine `nexora-future-optim.netlify.app` doit figurer dans *Authentication › Settings › Authorized domains*.
