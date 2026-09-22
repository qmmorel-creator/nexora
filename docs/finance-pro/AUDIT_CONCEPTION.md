# Finance PRO — Audit & conception (phase 1)

Statut : **conception uniquement**. Aucune donnée Firebase modifiée, aucune fonctionnalité métier développée, aucune PR ouverte. Document de travail sur la branche `claude/qme-financial-module-tlrixq`, en attente de validation de Quentin avant tout développement.

Rattachement : ce chantier prend la suite de #252 (Module Devis, livré) et englobe/complète #253 (Facturation électronique). Il ne recrée ni ne duplique ces deux modules — il les rattache à une chaîne financière plus large et leur ajoute le pilotage temps/dépenses/trésorerie qui leur manque.

Décisions de cadrage validées par Quentin (2026-09-22) :
1. Le travail déjà réalisé (module Devis, #252) est conservé et rattaché — pas de reprise à zéro sur ce module.
2. La politique de sécurité d'écriture financière (seuil 200 €, confiance ≥ 85 %, `confirmed:true`, audit) peut réutiliser le **pattern** déjà en place pour KDM360 (`finance-transactions.ts`), en infrastructure/technique seulement — jamais en données ni en dépendance runtime.
3. Les anciennes structures Nexora `expenses` / `expenseCategories` / `budgetLines` ne sont **pas réutilisées** pour Finance PRO : nouvelles entités dédiées, repartant de zéro. Les anciennes structures restent inchangées pour leur usage actuel (budget générique de projet).
4. Cette demande prévaut sur le contenu déjà livré si contradiction : les issues existantes sont ajustées en conséquence (labels, portée), sans jamais les fermer ni les passer `statut:fait`.

---

## 1. Audit factuel de l'existant

### 1.1 Gouvernance du dépôt
- Une demande = une issue GitHub (`.github/PROCESS.md`), workflow `statut:backlog → en-cours → à-tester → fait`.
- Branche dédiée par lot, commits `Ref #N` (jamais `Fixes/Closes/Resolves`), aucune PR/fusion/déploiement sans feu vert explicite de Quentin (sauf régression cassant la prod).
- Garde-fous : `npm run install:all && npm run verify` avant tout push, aucun secret commité, contrats MCP/URLs figés sans issue dédiée.
- Aucun fichier `AGENTS.md` dans le dépôt ; seul `CLAUDE.md` (racine) fait foi et renvoie à `PROCESS.md`.

### 1.2 Architecture technique
- Monorepo Netlify à deux apps : `apps/nexora` (interface + fonctions + tâches planifiées) et `apps/nexora-mcp` (serveur MCP OAuth).
- Interface = monofichier React versionné en fragments `index.html.part-000..004`, concaténés au build. Pas de composants fichier-par-fichier.
- Données : Firebase `nexora-cb20d`, persistance par clé (`persistKey`) sous convention `nexora:*` (localStorage) + Firestore `kv_store` pour la sync/merge/backup (cf. module Devis, #252).

### 1.3 Module Devis / Facture (#252, #253) — **livré, en production**
- PR #251 fusionnée dans `main`, déployée. En attente que Quentin remplisse les réglages entreprise réels et valide en prod avant `statut:fait`.
- Entités : `quotes`, `quoteClients`, `quoteSettings`, `quoteCatalog`, `quoteSkills`, `invoices` (état ébauché, non conforme légalement).
- Cycle : Brouillon → Envoyé → Accepté/Refusé, `Expiré` calculé à l'affichage (jamais persisté). Numérotation `AAAA-NNN` déduite des devis existants. TVA non applicable (franchise en base, art. 293 B CGI) : HT = TTC.
- Devis accepté → **proposition** (jamais automatique) de création d'un projet Nexora avec une tâche par ligne (`createProjectFromQuote`).
- **Facture légale non construite** : #253 bloque le module Facture conforme (Factur-X, PDP, numérotation continue) sur des décisions externes à Nexora (choix de PDP par Quentin). `invoices` n'est qu'une ébauche non exploitable en l'état.

### 1.4 Structures financières génériques existantes — **hors périmètre Finance PRO**
- `expenses`, `expenseCategories`, `budgetLines` : ressources Nexora/Firebase internes, exposées en lecture/écriture via le MCP (`RESOURCES` dans `apps/nexora-mcp/src/nexora.mts`). Utilisées uniquement par des widgets de **budget de projet générique** (`WidgetBudget`, `WidgetBudgetBurnRate`, `WidgetProjectTreemap`, `calculateBudgetBurnRate`).
- Aucune notion de client facturable, TVA, refacturation, justificatif, rapprochement bancaire : ce ne sont pas des structures financières professionnelles, seulement un suivi de dépense par catégorie/projet.
- Décision : **laissées telles quelles**, non migrées, non étendues. Finance PRO crée ses propres entités (préfixe `pro*`, cf. §4).

### 1.5 Système financier personnel KDM360 — **strictement hors périmètre**
- Backend Supabase externe (`KDM360_SUPABASE_URL`/`KDM360_SUPABASE_SECRET_KEY`), appelé « Budget360 » côté doc MCP.
- Fonctions Netlify dédiées : `finance-transactions.ts`, `finance-catalogs.ts`, `_shared/finance.ts`. Tables `finance_accounts_current`, `finance_categories_current`, `finance_subcategories_current`, `finance_transactions_current`.
- Politique déjà mature : `confirmationPolicy()` exige confirmation si montant > 200 € ou confiance catégorisation < 85 % ; écriture bloquée (`committed:false`, `preview`) tant que `confirmed !== true` ; `recordAuditEvent()` journalise chaque écriture avec `idempotencyKey`.
- Le MCP Nexora exclut explicitement les « Transactions Budget360 » de son périmètre (`list_resources`).
- **Aucune trace de code reliant KDM360 à Devis/expenses/budgetLines** : la séparation actuelle est déjà respectée, rien à défaire. Finance PRO doit maintenir cette étanchéité : nouvelle infra Netlify/Firebase dédiée, aucun accès à Supabase KDM360, aucune donnée croisée.
- Le **pattern** de `confirmationPolicy`/`recordAuditEvent` est réutilisé (code dupliqué et adapté, pas partagé en exécution) pour Finance PRO, conformément au point 2 des décisions de cadrage.

### 1.6 Clients, projets, tâches, échéances, dashboards
- **Clients** : uniquement `quoteClients` (module Devis), CRUD `addQuoteClient`/`saveQuoteClient`/`deleteQuoteClient`. Pas de registre clients générique distinct.
- **Projets/missions** : entité `projects` de Nexora, modèle `{id, name, icon, color}`. `createProjectFromQuote` relie un devis accepté à un projet.
- **Tâches/jalons** : `seedTaskTypes` (4 types verrouillés : Tâches, Planning, Réunions, Information), modèle tâche `{id, projectId, statusId, title, desc, start, end, progress, milestone, assignee, checklist}`.
- **Échéances** : widget unique `echeances` (fusion de 4 anciens widgets, issues #160/#176), orientation horizontale/verticale, agrège les dates de fin de tâches/jalons. Pas de lien financier aujourd'hui.
- **Dashboards/widgets** : catalogue déclaratif `WIDGET_TYPE_META`, regroupé par `WIDGET_TYPE_GROUPS` (`Indicateurs`, `Planning`, `Intelligence`, `Suivi`). Extensible par ajout d'entrée + composant `Widget<Type>` dédié — pas un système plug-in arbitraire, chaque widget reste un composant métier propre.

### 1.7 MCP Nexora
- Outils : gestion de tâches (create/update/complete/archive/restore/delete), pièces jointes, habitudes, réunions/projets, résumés, import Google Calendar, `list_resources`/`read_resource`/`mutate_resource` génériques avec `expectedRevision` (contrôle de concurrence optimiste).
- `quotes`/`invoices` ne sont **pas** exposés dans `RESOURCES` aujourd'hui — pilotés uniquement côté interface.
- Aucune règle de confirmation/seuil financier dans le MCP Nexora (cette logique existe seulement côté KDM360).

### 1.8 Issues ouvertes pertinentes
- **#252** Module Devis — `statut:à-tester`, livré en prod, reste à faire côté Quentin (réglages entreprise réels, validation).
- **#253** Facturation électronique — `statut:backlog`, bloqué sur décisions externes (choix PDP).
- Aucune issue ouverte dédiée à budgets/dépenses pro/clients génériques/échéances financières en tant que sujet principal.

---

## 2. Cartographie des composants et données concernés

| Domaine | Composant/donnée | Fichier(s) | Statut vis-à-vis de Finance PRO |
|---|---|---|---|
| Devis | `quotes`, `quoteClients`, `quoteSettings`, `quoteCatalog`, `quoteSkills` | `index.html.part-000/001/003` | **Réutilisé** (source du client, de la mission, du montant signé) |
| Facture (ébauche) | `invoices` | `index.html.part-001` | **Réutilisé comme point d'ancrage**, mais remplacé fonctionnellement par le futur module Facture de #253 |
| Facturation légale | (à créer) | — | **Hors périmètre Finance PRO**, propriété de #253 |
| Projets/missions | `projects` | état global | **Réutilisé** comme entité Mission |
| Tâches/jalons | `tasks`, `seedTaskTypes` | `index.html.part-000` | **Réutilisé** pour le lien temps ↔ activité |
| Échéances | widget `echeances` | `index.html.part-003` | **Étendu** (nouvelles catégories d'échéance financières) |
| Dashboards/widgets | `WIDGET_TYPE_META` | `index.html.part-003` | **Étendu** (nouveaux types de widgets Finance PRO) |
| Dépenses génériques | `expenses`, `expenseCategories` | `index.html.part-001/003` | **Hors périmètre**, non touché |
| Budget projet générique | `budgetLines` | `index.html.part-001` | **Hors périmètre**, non touché |
| MCP Nexora | `RESOURCES`, `tools.mts` | `apps/nexora-mcp/src` | **Étendu** (nouvelles ressources Finance PRO, contrôle de concurrence réutilisé) |
| Finance perso | KDM360/Supabase | `apps/nexora/netlify/functions/_shared/finance.ts` et consorts | **Jamais touché**, pattern de sécurité réutilisé en code seulement |

---

## 3. Matrice de décision

| Élément | Décision |
|---|---|
| Registre clients (`quoteClients`) | **Existant réutilisable** — étendu avec SIREN, coordonnées bancaires de facturation, si nécessaire pour #253 |
| Missions (`projects`) | **Existant réutilisable** — pas de seconde structure de projet |
| Tâches/jalons | **Existant réutilisable** — champ `facturable`/lien temps ajouté en extension |
| Devis (`quotes`) | **Existant à étendre** — champs de planning de facturation (jalons facturables, acomptes) |
| Facture légale | **Hors périmètre** — propriété de #253, Finance PRO s'y raccroche sans la redévelopper |
| `expenses` / `expenseCategories` / `budgetLines` | **Hors périmètre, non migré** — nouvelles entités créées en parallèle |
| Suivi du temps | **Création nouvelle** — aucune structure existante |
| Dépenses professionnelles | **Création nouvelle** (`proExpenses`, `proExpenseCategories`) |
| Encaissements/rapprochement | **Création nouvelle** (`proPayments`) |
| Planning de facturation (jalons, acomptes) | **Création nouvelle**, rattachée aux devis existants |
| Trésorerie/prévisionnel | **Création nouvelle** — calculs purs, pas de persistance de l'agrégat |
| Obligations/échéances fiscales et sociales | **Existant à étendre** — nouvelles catégories dans le widget `echeances`, pas de second calendrier |
| Widgets Finance PRO | **Création nouvelle** dans le moteur de dashboard existant |
| MCP — nouvelles ressources | **Création nouvelle**, suivant la convention `RESOURCES`/`expectedRevision` déjà en place |
| Politique de confirmation/audit | **Existant (pattern) à dupliquer en code**, jamais en infra/données partagée avec KDM360 |
| Migration | Aucune migration de données existantes n'est nécessaire (nouvelles entités vides au départ) ; seule une migration idempotente de liaison (ex. renseigner `missionId` sur les devis acceptés déjà en prod) est envisageable, cf. §9 |

---

## 4. Modèle conceptuel de données

Convention commune à toutes les entités Finance PRO : identifiant `id` (uuid v4, stable), `createdAt`/`updatedAt` (ISO 8601, `Europe/Paris` à l'affichage), `revision` (entier, contrôle de concurrence optimiste façon MCP existant), `archivedAt` (nullable — archivage plutôt que suppression), `source` (`manual` | `mcp` | `import`), aucun champ ne portant de donnée KDM360.

### 4.1 `proClient` (extension de `quoteClients`, pas une nouvelle entité)
- Champs ajoutés : `siren` (nullable, requis avant #253), `paymentTerms` (jours), `defaultDayRate`/`defaultHourlyRate`.
- Relation : 1 client → n missions, n devis (existant).

### 4.2 `proMission` (alias fonctionnel de `projects`, pas une nouvelle table)
- Champs ajoutés au projet quand il sert de mission facturable : `clientId`, `billingMode` (`regie_horaire` | `regie_journaliere` | `forfait` | `acompte_jalons` | `abonnement`), `soldDayRate`/`soldHourlyRate`, `quoteId` (origine), `status` (`prospect` | `signee` | `en_cours` | `cloturee` | `archivee`).
- Contrainte : un projet ne devient « mission facturable » qu'avec `clientId` renseigné ; les projets internes (hors Finance PRO) ne sont pas affectés.

### 4.3 `proTimeEntry` (nouvelle)
- Champs : `id`, `date`, `durationMinutes`, `clientId`, `missionId`, `taskId` (nullable), `natureTemps` (`prod` | `avant-vente` | `admin` | `formation` | …), `billable` (bool), `rateApplied` (montant, snapshot au moment de la saisie), `rateType` (`horaire`|`journalier`|`forfait`), `comment`, `status` (`brouillon` | `validee` | `facturee`), `invoiceLineId` (nullable, rempli à la facturation).
- Règle : `status` ne peut passer à `facturee` que via une écriture liée à une ligne de facture existante (pas d'écriture libre).

### 4.4 `proExpenseCategory` (nouvelle, distincte de `expenseCategories`)
- Champs : `id`, `label`, `icon` (`tabler:<nom>`), `deductible` (bool), `refacturableParDefaut` (bool), `archivedAt`.
- Seed initial minimal (déplacement, hébergement, matériel, logiciel, sous-traitance, frais bancaires, assurance pro) — à valider avec Quentin, pas de reprise du seed `expenseCategories` existant.

### 4.5 `proExpense` (nouvelle, distincte de `expenses`)
- Champs : `id`, `datAchat`, `dateBancaire` (nullable), `fournisseur`, `montantHT`, `tva`, `montantTTC`, `devise` (ISO 4217, défaut EUR), `categoryId`, `moyenPaiement` (`cb_pro`|`virement`|`especes`|`prelevement`), `clientId`/`missionId` (nullable), `refacturable` (bool), `justificatifUrl` (Drive), `statutRapprochement` (`non_rapproche`|`rapproche`), `statutRemboursement` (`n/a`|`a_refacturer`|`refacture`|`rembourse`), `notes`, `externalId` (nullable, pour import), `dedupeHash` (calculé : fournisseur+montant+date, pour détection de doublon à l'import).
- Contrainte explicite : `clientId` **ne peut jamais** référencer une entité issue de KDM360 (validation au niveau service applicatif, pas seulement UI).

### 4.6 `proBillingSchedule` (nouvelle, rattachée à `quotes`/`proMission`)
- Champs : `id`, `missionId`, `quoteId`, `type` (`acompte` | `jalon` | `periode` | `solde`), `libelle`, `montantPrevu`, `dateCible`, `statut` (`prevu`|`a_facturer`|`facture`|`encaisse`|`annule`), `invoiceId` (nullable, rempli quand la facture existe côté #253).
- C'est la brique qui **pilote** la facturation (statuts, échéances, montants, liens documentaires) sans être elle-même le système légal d'émission — conforme à la consigne « ne pas présumer que Nexora doit devenir le système légal d'émission ».

### 4.7 `proPayment` (nouvelle)
- Champs : `id`, `invoiceId` (référence externe tant que #253 n'existe pas — champ texte libre en attendant, puis FK réelle), `montant`, `date`, `moyen`, `statutRapprochement`, `partiel` (bool).
- Relation : n paiements → 1 facture (paiements partiels).

### 4.8 `proObligation` (extension du widget Échéances, pas une nouvelle table dédiée)
- Nouvelles catégories d'échéance injectées dans le widget existant : validité devis, signature attendue, acompte dû, échéance facture, relance, déclaration Urssaf, TVA (si applicable), CFE, assurance pro, abonnement, renouvellement contractuel.
- Chaque catégorie = une fonction de dérivation pure lisant `proBillingSchedule`/`quotes`/réglages entreprise, pas une nouvelle persistance d'échéance.

### 4.9 Agrégats calculés (non persistés)
- `proCashPosition` (trésorerie disponible), `proCashForecast30_60_90`, `proIndicatorsSnapshot` (CA signé/facturé/encaissé, marge par mission, etc.) : **calculs purs**, recalculés à la demande, éventuellement mis en cache non-source-de-vérité.

---

## 5. Principales règles de calcul (extrait, à détailler lot par lot)

Toutes les règles ci-dessous sont **déterministes et pures** (mêmes entrées → même sortie), testables unitairement, fuseau `Europe/Paris` pour toute date d'échéance.

| Indicateur | Définition | Données | Période | Traitement annulations/avoirs/partiels | Risque de double comptage |
|---|---|---|---|---|---|
| CA signé | Somme des montants de `quotes` au statut `accepted` | `quotes` | Date d'acceptation | Un devis refusé après acceptation (rare) doit être un événement explicite, pas une suppression | Un devis accepté puis remplacé par un avenant compte une seule fois (avenant = nouvelle version, pas nouveau devis) |
| CA planifié | Somme des `proBillingSchedule` au statut `prevu`/`a_facturer` | `proBillingSchedule` | Date cible | Exclut les lignes `annule` | Une ligne `facture` ne doit plus compter en « planifié » |
| CA facturé | Somme des `proBillingSchedule` au statut `facture` (ou des factures #253 une fois existantes) | `proBillingSchedule` | Date de facturation | Un avoir vient en déduction, jamais en suppression de l'écriture d'origine | — |
| CA encaissé | Somme des `proPayment` rapprochés | `proPayment` | Date d'encaissement | Paiement partiel = somme des paiements liés, jamais le montant facture | Un paiement ne doit être rattaché qu'à une seule facture |
| Travail réalisé non facturé | Somme(`proTimeEntry.billable=true, status≠facturee` × taux) + dépenses refacturables non facturées | `proTimeEntry`, `proExpense` | Glissant | — | Exclure les entrées déjà liées à une `proBillingSchedule` `facture` |
| Factures en retard | `proBillingSchedule.statut=a_facturer/facture` et `dateCible < aujourd'hui` et non `encaisse` | `proBillingSchedule` | Instantané | — | — |
| Délai moyen d'encaissement | Moyenne(`proPayment.date` − `proBillingSchedule.dateCible` pour les lignes soldées) | les deux | Glissant (ex. 12 mois) | Paiements partiels : pondérer par montant | — |
| Marge par mission | CA facturé mission − (dépenses `proExpense` liées + coût temps interne si valorisé) | `proExpense`, `proTimeEntry`, `proBillingSchedule` | Vie de la mission | — | Ne pas compter deux fois une dépense refacturée (elle sort des charges si refacturée) |
| Taux journalier moyen vendu | CA signé / jours vendus (déduits des lignes `forfait` converties en jours estimés, ou `soldDayRate` direct) | `quotes`, `proMission` | Par mission/période | — | Forfaits sans conversion jours doivent être signalés, pas estimés silencieusement |
| Taux journalier réellement obtenu | CA facturé mission / jours réellement passés (`proTimeEntry`) | les deux | Par mission | — | — |
| Temps facturable / non facturable | Somme(`proTimeEntry.durationMinutes`) groupée par `billable` | `proTimeEntry` | Période | — | — |
| Taux d'occupation | Temps facturable / temps disponible théorique (jours ouvrés `Europe/Paris` × capacité déclarée) | `proTimeEntry` + réglages | Période | — | Jours fériés/congés à exclure de la capacité |
| Reste à facturer | CA signé − CA facturé (par mission puis agrégé) | `quotes`, `proBillingSchedule` | Instantané | — | — |
| Reste à encaisser | CA facturé − CA encaissé | `proBillingSchedule`, `proPayment` | Instantané | — | — |
| Trésorerie disponible | Solde des comptes pro déclarés (saisie manuelle ou import, hors KDM360) | à définir lot 5 | Instantané | — | — |
| Trésorerie prévisionnelle 30/60/90j | Trésorerie disponible + CA planifié à encaisser dans la fenêtre − dépenses prévues − provisions | agrégats ci-dessus | Glissant | — | Ne pas compter un encaissement déjà réalisé comme « prévisionnel » |
| Provisions sociales/fiscales/TVA | % paramétrable × CA encaissé (régime auto-entrepreneur : pas de TVA collectée tant que franchise en base) | réglages + CA encaissé | Glissant | — | — |
| Concentration CA par client | CA (facturé ou encaissé, à préciser) par client / CA total | `proBillingSchedule`/`proPayment` | Période | — | — |
| Carnet de commandes | CA signé − CA facturé (missions non closes) | `quotes`, `proBillingSchedule` | Instantané | — | — |
| Revenu mensuel récurrent | Somme des `proMission.billingMode=abonnement` actives × montant mensuel | `proMission` | Instantané | Prorata au mois de début/fin | — |
| Écart prévision/réalisé | CA planifié vs CA facturé sur une période close | agrégats | Période close | — | — |

---

## 6. Flux utilisateurs (parcours principaux)

1. **Prospect → devis** : création client (existant) → devis (existant) → statut `accepted` → proposition de création de mission (extension de `createProjectFromQuote` avec `clientId`/`billingMode`).
2. **Mission → planning de facturation** : à la création de la mission, génération assistée (jamais automatique) d'un `proBillingSchedule` initial dérivé du `billingMode` du devis (ex. forfait → acompte + solde ; régie → échéance périodique).
3. **Temps** : saisie d'une `proTimeEntry` liée à une tâche existante → validation (`brouillon` → `validee`) → sélection pour facturation (regroupement en ligne de `proBillingSchedule`).
4. **Dépense** : saisie d'une `proExpense`, justificatif Drive, marquage refacturable → si refacturable, rattachement à une mission → apparaît dans « reste à facturer ».
5. **Facturation** : passage d'une ligne `proBillingSchedule` de `a_facturer` à `facture` — déclenche la création de la facture dans #253 une fois ce module construit (en attendant, saisie manuelle de référence externe) → mise à jour des indicateurs CA facturé/reste à encaisser.
6. **Encaissement** : saisie/rapprochement d'un `proPayment` → clôture ou solde partiel de la ligne de facturation → mise à jour trésorerie.
7. **Obligations** : le widget Échéances affiche automatiquement les échéances dérivées (validité devis, acomptes dus, relances, déclarations) sans saisie manuelle dupliquée.
8. **Pilotage** : dashboard Finance PRO agrège les indicateurs du §5 via de nouveaux widgets dans le moteur existant.

---

## 8. Analyse des risques de régression

| Risque | Sévérité | Mitigation |
|---|---|---|
| Confusion entre `expenses`/`budgetLines` (génériques) et les nouvelles entités `pro*` dans l'UI ou le MCP | Élevée | Nommage strictement distinct, aucune fonction partagée entre les deux familles, revue de code dédiée |
| Conflits de fusion avec #252/#253 s'ils évoluent en parallèle | Moyenne | Rattacher explicitement chaque lot Finance PRO à ces issues, développer dans des fragments (`part-00x`) isolés autant que possible, synchroniser avec `main` avant chaque lot |
| Extension du monofichier `index.html.part-*` alourdissant encore la maintenabilité | Moyenne | Découper Finance PRO en fragments dédiés si la taille des parts existantes devient critique (question ouverte, cf. §11) |
| Fuite de données KDM360 vers Finance PRO (ou l'inverse) par copier-coller de code | Élevée | Revue systématique : aucune fonction Finance PRO n'importe `_shared/finance.ts` (KDM360) ; validation service-layer sur les `clientId`/comptes |
| Double comptage d'indicateurs (CA facturé vs encaissé, avoirs, partiels) | Moyenne | Les formules du §5 sont figées avant développement, testées unitairement avant toute UI |
| Widget « Échéances » surchargé par de nouvelles catégories | Faible | Filtres/orientation déjà supportés par le widget ; ajout de catégories = donnée, pas nouveau composant |
| MCP : ajout de nouvelles ressources sans respecter `expectedRevision` | Élevée | Réutiliser strictement le mécanisme existant, tests de conflit de concurrence avant activation |
| Écriture automatique dépassant les seuils de sécurité (§6 de la demande) | Élevée | Ces règles sont conçues mais **non activées** dans cette phase ; toute automatisation reste `confirmed:false` par défaut tant qu'un lot dédié ne l'active pas explicitement |

---

## 9. Stratégie de migration idempotente

- **Aucune migration de données existantes n'est requise** pour démarrer : toutes les entités Finance PRO (`proTimeEntry`, `proExpense`, `proExpenseCategory`, `proBillingSchedule`, `proPayment`) sont nouvelles et vides au départ.
- **Seule migration de liaison envisagée** : renseigner `clientId`/`billingMode` sur les `projects` déjà issus d'un `createProjectFromQuote` en prod, pour les rattacher rétroactivement à Finance PRO. Cette migration doit être :
  - **idempotente** : réexécutable sans dupliquer (clé de correspondance `quoteId` → `projectId` déjà existante) ;
  - **non destructive** : n'écrit que les champs ajoutés, ne touche à aucun champ existant du projet ;
  - **tracée** : chaque écriture de migration journalisée (qui, quand, quoi) suivant le même principe que `recordAuditEvent` côté KDM360.
- Toute intégration future d'un import externe (relevé bancaire pro, export comptable) doit utiliser `dedupeHash`/`externalId` (cf. §4.5) pour garantir qu'un import répété ne duplique jamais une écriture.

---

## 10. Découpage proposé en lots et issues GitHub

Proposition uniquement — aucune issue ni PR ne sera créée/fusionnée sans feu vert explicite, hors création d'issues de suivi (autorisée par la gouvernance, distincte d'une PR).

| Lot | Contenu | Dépend de | Issue |
|---|---|---|---|
| **Lot 0** | Issue chapeau Finance PRO + rattachement #252/#253 | — | à créer |
| **Lot 1** | Extension `proClient`/`proMission` (champs sur `quoteClients`/`projects`) + réglages entreprise complétés | Lot 0 | à créer |
| **Lot 2** | Suivi du temps (`proTimeEntry`) + widget temps facturable/non facturable | Lot 1 | à créer |
| **Lot 3** | Dépenses professionnelles (`proExpense`/`proExpenseCategory`) + justificatifs Drive | Lot 1 | à créer |
| **Lot 4** | Planning de facturation (`proBillingSchedule`) rattaché aux devis, statuts | Lot 1, 2, 3 | à créer |
| **Lot 5** | Encaissements (`proPayment`), rapprochement, trésorerie disponible | Lot 4 | à créer |
| **Lot 6** | Trésorerie prévisionnelle 30/60/90j + provisions | Lot 5 | à créer |
| **Lot 7** | Extension du widget Échéances (nouvelles catégories financières) | Lot 4 | à créer |
| **Lot 8** | Dashboard Finance PRO (5 vues, nouveaux types de widgets) | Lots 2 à 7 | à créer |
| **Lot 9** | Ressources MCP Finance PRO (lecture seule d'abord) | Lots 2 à 6 | à créer |
| **Lot 10** | Politique de confirmation/audit pour écritures financières (conçue au lot, activée seulement sur demande explicite ultérieure) | Lot 9 | à créer |

Chaque lot = une issue, `zone:finance`, `statut:backlog`, `Ref #<lot>` dans les commits.

---

## 11. Critères d'acceptation par lot (synthèse)

- **Lot 0** : issue chapeau créée, #252/#253 commentées avec le rattachement, aucun changement de statut sur ces deux issues.
- **Lots 1-3** : nouvelles entités créées et persistées via le mécanisme `persistKey`/`kv_store` existant ; aucun champ existant de `quoteClients`/`projects`/`expenses` modifié ; tests unitaires sur les CRUD de base ; aucune référence croisée avec KDM360 dans le code (vérifiable par grep `KDM360|Supabase` = 0 résultat dans les nouveaux fichiers).
- **Lot 4-6** : formules du §5 implémentées en fonctions pures testées unitairement (cas nominal, avoir, paiement partiel, annulation) avant tout branchement UI.
- **Lot 7** : widget Échéances existant non régressé (tests existants toujours verts), nouvelles catégories optionnelles/filtrable.
- **Lot 8** : 5 maquettes validées par Quentin traduites en widgets réels, intégrées au moteur de dashboard existant sans nouveau système de dashboard.
- **Lot 9** : nouvelles ressources MCP respectant `expectedRevision`, lecture seule tant que le lot 10 n'est pas activé.
- **Lot 10** : règles de seuils codées et testées, mais `allowAutoCommit` désactivé par défaut — activation seulement sur demande explicite ultérieure de Quentin, hors périmètre de cette phase.

---

## 12. Questions réellement bloquantes restantes

1. **Comptes de trésorerie pro** (§4.9/§5) : la trésorerie disponible nécessite une source (saisie manuelle du solde, ou import d'un relevé bancaire pro). Aucune décision prise sur ce point — à trancher avant le Lot 5/6.
2. **Régime fiscal réel** : le document part de l'hypothèse franchise en base de TVA (comme #252/#253) — si ce statut change, les règles TVA du §5 doivent être révisées.
3. **Statut de `invoices`** (ébauche actuelle) : à conserver comme brouillon technique en attendant #253, ou à retirer pour éviter la confusion avec le futur module Facture conforme ? Décision à prendre avant le Lot 4.
4. **Granularité des fragments `index.html.part-*`** : faut-il un nouveau fragment dédié Finance PRO (`part-005`) plutôt que d'étendre les parts existantes déjà volumineuses ? Question technique à trancher en Lot 1.
5. **Comptes/moyens de paiement pro** : liste fermée à définir avec Quentin (CB pro, virement, prélèvement, espèces...) avant le Lot 3.
6. **Barème de provisions sociales/fiscales** : taux exacts (régime auto-entrepreneur) à fournir par Quentin pour le Lot 6, sinon paramètre laissé vide/configurable.
