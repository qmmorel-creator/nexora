# Audit des dépendances d'Optim envers Nexora (03/10/2026)

Objectif fixé par Quentin : **Optim remplace intégralement Nexora**, sans aucune dépendance à Nexora au bout du compte.
Cet audit recense ce qui relie encore Optim à Nexora (nexora-project) et propose un plan de sevrage.
Fait en lecture seule le 03/10/2026, sur `main` après #719.

## 1. Dépendances d'exécution (réseau)

| Relais d'Optim | Appelle | Ce que fait nexora-project derrière | Secrets côté nexora-project |
|---|---|---|---|
| `optim-finance` (`/api/optim/finance/*`) : 4 lectures + catégorisation (en direct sur Supabase dès que la clé KDM360 est posée dans Optim, #721 ; voir étape 4 du plan) | `https://nexora-project.org/api/nexora/finance-*` (`_partage/relais-finance.ts`, `AMONT`) | Lit et écrit **Supabase KDM360** (tables `finance_*`, RPC `finance_apply_transaction_write`) ; calculs `lib/finance-budget.mjs` | `KDM360_SUPABASE_URL`, `KDM360_SUPABASE_SECRET_KEY` |
| `optim-corps` (`/api/optim/corps/*`) : sport, santé, photos (lecture) | `https://nexora-project.org/api/nexora/{sport-activities,health-records,body-photos}` | Sport et santé : CSV publiés de Google Sheets (Strava, Whoop, balance, nutrition). Photos : **Firestore** (`bodyPhotos`, `bodyPhotoSettings/main`, `bodyPhotoBlobs/{id}/chunks`) | `NEXORA_SPORT_CSV_URL`, `NEXORA_HEALTH_CSV_URL`, compte de service Firebase |
| `optim-rapports` | Firestore directement (`assistant_reports`) | Rapports écrits **uniquement** par les fonctions planifiées de nexora-project (matin et soir) | — |

Points communs aux trois relais :
- ils vérifient le jeton Firebase (uid = `NEXORA_USER_UID`), puis le transmettent tel quel ;
- le navigateur n'appelle que `/api/optim/*`, Firebase Auth et Firestore.

Remarque : `optim-rapports` n'est appelé par aucun écran d'Optim (seule la démo l'utilise).

## 2. Données partagées (Firestore `users/{uid}/kv_store`)

**Ce qu'Optim lit et écrit**
- Optim lit 39 clés `nexora:*` en temps réel (`src/donnees/magasin.tsx`).
- Optim n'écrit que `tasks`, `taskArchive`, `activityLog`, `habitLog`, `habitSkips` et `optimPrefs` (sa clé propre).
- Le format d'écriture segmenté `chunked-v1` est un contrat hérité de Nexora. Il faut le garder tant que le MCP et Futur cohabitent.

**Clés que seul Nexora écrit**
- Devis et factures : `quotes`, `quoteClients`, `invoices`.
- Finance PRO : `proMissions`, `proTimeEntries`, `proExpenses`, `proBillingSchedule`, `proPayments`, `financeProSettings`.
- Hors de la lecture d'Optim : `gcalSettings`, `quoteSettings`, `quoteCatalog`, `proObligations`, `milestoneTypes`, `views*`, `appearance`, `snapshot:*`.

**Catalogues** (projets, dossiers, statuts, types, équipe, habitudes, objectifs sport) : écrits par Nexora, Futur, le MCP et, depuis le 03/10/2026, par les Réglages d'Optim (étape 5 ci-dessous).

**Entretien que seule l'interface Nexora fait, quand elle est ouverte**
- purge de la corbeille après 30 jours ;
- instantanés de versions (`snapshot:*`) ;
- fusion sur conflit.

## 3. Dépendances de code

- **Copies générées** : `scripts/extraire-nexora.py` copie, **à la main** (jamais pendant le build), le code de Nexora dans `src/nexora/` :
  - graphiques Argent ;
  - calculs budgétaires ;
  - comparaison des photos ;
  - Tâches du jour.

  Ce sont des copies figées : elles fonctionnent sans Nexora.
- **Dépendance au build** : `tests/periode.test.ts` importait `apps/nexora/lib`. **Corrigé dans #720** : il importe la copie interne. Le build d'Optim ne lit plus aucun fichier de Nexora.
- **Portages à la main** dans `src/donnees/` (commentaires « port de nexora-project ») : aucun lien au build.
- **Relais** : copies de ceux de Futur.

## 4. Fonctionnalités de Nexora absentes d'Optim

| Domaine | Manque dans Optim | Ce qu'il faudrait |
|---|---|---|
| Fiche de tâche | édition complète (titre, dates, description, checklist, dépendances, pièces jointes, champs personnalisés), Tableur | interface seulement : `tasks` est déjà ouverte en écriture |
| Projets et catalogues | création et édition des projets, dossiers, statuts, types, valeurs par défaut, modèles | ouvrir ces clés ; porter les écrans de Futur (lot 10) |
| Réunions | saisie du compte rendu (`meetingReport`) | édition dans la fiche |
| Google Calendar | réglage `gcalSettings` (l'import passe par le MCP et une routine ChatGPT, pas par nexora-project) | écran de réglage |
| Gmail / capture | capture par lien, création par API (`nexora-create-task`) | route de capture dans Optim |
| Drive | archivage des PDF de devis et factures (`nexora-drive-archive`) | porter la fonction et les PDF |
| Finance KDM360 | saisie, édition complète, référentiel | relais élargi, puis Supabase en direct |
| Synchronisation bancaire | Enable Banking (connexion, rappel, synchronisation planifiée 04:40 et 16:40 UTC) | porter la fonction ; nouvelle URL de rappel chez Enable Banking ; **une seule planification à la fois** (quotas DSP2) |
| Finance PRO, devis, factures | toutes les écritures (Optim lit seulement) | ouvrir les clés ; porter l'interface, les PDF et la numérotation |
| Santé, sport | objectifs (`sportGoals`) ; lecture des CSV hébergée par Nexora | ouvrir `sportGoals` ; héberger la lecture des CSV dans Optim |
| Photos | import, repères, référence, dates, suppression (**demandé le 03/10/2026**) | relais en écriture, puis stockage Firestore en direct |
| Habitudes | édition du catalogue `habitThemes` | ouvrir la clé (Futur l'écrit déjà) |
| Équipe et charge | tout (`equipe.ts` est chargé mais inutilisé) | interface et ouverture des clés |
| Rapports assistant | rapports du matin et du soir | fonctions planifiées dans Optim |
| Entretien | purge, instantanés, fusion | à porter, idéalement en fonction planifiée |
| Écosystème assistant | le MCP et les routines ChatGPT appellent `nexora-project.org` / `nexora-project.netlify.app` en dur ; site QME (`nexora-qme-intake`) | API hébergée par Optim ou bascule du domaine |

## 5. Plan de sevrage proposé (du plus simple au plus lourd)

1. **Build indépendant de Nexora** : fait (#720). Ensuite, `extraire-nexora.py` devient facultatif : les copies sont du code d'Optim.
2. **`optim-rapports`** : le brancher sur l'Accueil ou le supprimer.
3. **Corps sans relais** :
   - lire les CSV de sport et santé depuis Optim (deux secrets à dupliquer, analyse déjà portée) ;
   - lire et écrire les photos dans Firestore directement (même projet, Optim a déjà le compte de service). Cela couvre toutes les écritures photos demandées.
4. **Finance sans relais** : Supabase KDM360 en direct. Cela revient sur le choix du 03/10 (pas de clé KDM360 sur Optim) : **décision de Quentin**. Il faut garder le préfixe d'idempotence existant pour ne pas doubler une écriture rejouée.
   **État (#721) : code prêt**, activé dès que Quentin pose `KDM360_SUPABASE_SECRET_KEY` dans Netlify (site nexora-future-optim ; `KDM360_SUPABASE_URL` facultative).
   - `_partage/finance-directe.ts` sert les cinq routes (budget-summary, wealth-series, sankey-data, transactions-data, catégoriser) sur Supabase, avec les modules copiés de nexora-project (`finance-supabase.ts`, `finance-validation.mjs`) et les calculs de `src/nexora/finance-budget.mjs` ;
   - la liste blanche du relais (`relais-finance.ts`) s'applique d'abord : mêmes réponses et mêmes erreurs qu'aujourd'hui ;
   - clé d'idempotence finale inchangée : `nexora:optim:<clé>` ;
   - sans la clé : repli automatique sur le relais vers nexora-project.
5. **Catalogues en écriture** (projets, dossiers, statuts, types, habitudes, objectifs sport, équipe), en portant les écrans de Futur. Risque d'écrasement tant que Nexora reste utilisé : basculer quand Nexora n'est plus ouvert.
   **Fait le 03/10/2026 (première partie)** : projets (priorité, icône, statuts et types masqués par projet, suppression avec réaffectation des tâches), dossiers, statuts (protégés comme Nexora, ordre), types (verrouillés, statut imposé, ordre), valeurs par défaut, modèles, thèmes et habitudes, utilisateurs (renommage reporté sur les tâches) et équipes, objectifs sport. Reste : types de jalon, ateliers, Google Calendar, calendriers synchronisés, méta-blocs temporels.
6. **Entretien** (purge à 30 jours, instantanés) : en fonction planifiée d'Optim, d'abord à blanc.
7. **Finance complète, puis synchronisation bancaire** : désactiver la planification de nexora-project avant d'activer celle d'Optim.
8. **Rapports du matin et du soir** dans Optim, sans doublon avec nexora-project.
9. **Finance PRO, devis, factures, PDF, archivage Drive** : le plus lourd ; attention à la numérotation des factures.
10. **Écosystème assistant** : MCP, routines ChatGPT et QME vers une API d'Optim ou un nouveau domaine. Éventuellement, `nexora-project.org` pointe vers Optim, ce qui demande de réimplémenter ses routes `/api/nexora/*` et `/api/finance/*`.
11. **Arrêt de nexora-project** : vérifier dans les journaux Netlify qu'il ne reçoit plus d'appels, puis retirer ses secrets.

**Incertitudes**
- les règles Firestore ne sont pas dans le dépôt ;
- l'alimentation des feuilles Strava et Santé se fait hors du dépôt ;
- le statut réel des clés `workflows`, `notifications` et `deadlines` est inconnu.
