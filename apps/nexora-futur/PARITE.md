# Parité Nexora actuel → Nexora Futur (Ref #663)

État au 3 octobre 2026, après le lot 10 (parties 1 à 4). Les preuves sont
les tests unitaires (`tests/`) et le parcours e2e (`e2e/parcours.mjs`,
32 étapes). Pour les fonctions de l'actuel, voir `apps/nexora/source`
(fichiers `index.html.part-00N`, notés p0 à p4).

Légende des statuts :
- **présent** : la fonction existe, avec la même logique ou une logique équivalente ;
- **adapté** : même usage, mais sous une autre forme ;
- **partiel** : il manque une partie, indiquée dans la colonne de droite ;
- **lecture** : consultation seulement, par choix ;
- **exclu** : écarté par Quentin ;
- **à décider** : demande l'avis de Quentin.

## Vues

| Vue de l'actuel | Statut | Dans Futur | Ce qui manque |
|---|---|---|---|
| Tableau de bord | à décider | Synthèse (indicateurs, graphique, treemap, notes modifiables), tuiles épinglées de Phrase | Tableaux de bord multiples, avec des widgets libres à déplacer ou redimensionner (`nexora:dashboards`) |
| Planning Projets (métro) | partiel | Frise, style Métro | Annotations, actions dépliées |
| Gantt | partiel | Frise : glisser, chemin critique, référence | Annotations, couloirs de risques, méta-blocs, zoom manuel |
| Heat map | partiel | Densité (Mois, Croisée), heat maps des habitudes | Heat map annuelle des tâches (S1-S52) |
| Pixel Tasks | partiel | Densité, mode Pixels | Terminer ou modifier une tâche depuis le pixel |
| Aujourd'hui | adapté | Fil du jour en Cadran | Widgets configurables de `todayWidgets` (les notes y sont modifiables) |
| Calendrier | présent | Agenda, avec « + Tâche ce jour » | — |
| Tableur | présent | Tableur, avec édition en masse | — |
| Devis, Factures, Finance PRO | lecture | Finances, activité pro | Saisie (clés fermées) |
| Carte 3D, Cosmos, Fleuve, Réunions 3D | exclu | Atlas (prototype) | — |

## Widgets (46)

**Présents** sous forme de lentille, d'onglet ou de bloc :
chart, list, taskDetail (inspecteur), bubbles, criticalPath, calendar,
heatmapMonth, heatmapGrid, projectTreemap, habitQuick, habitHeatmap,
habitPixel, financeSankeyMonthly, financeSankeyWealth, financeBudgetMonth,
financeToCategorize, financeBudgetPeriod, financeWealthBar,
financeWealthCurve, financeBudgetChart, financeBudgetCumul, sportChart,
sportSummary, sportActivities (export CSV), healthChart, healthSportChart,
staffing (saisie), orgchart, userProfile, teamCatalog (Réglages,
Utilisateurs et équipes), note (modifiable).

**Partiels** :
- customCard : six cartes fixes au lieu de blocs configurables ;
- minigantt et embedMetro : voir Gantt ;
- focusDay ;
- pixelTasks ;
- budget et budgetBurnRate : page projet, un projet à la fois ;
- financeTransactions : pas de filtres, ni d'édition, ni de saisie manuelle ;
- bodyPhotos : comparaison seulement, par décision.

**En lecture** : financeProSynthese, financeProEcheances.

**Exclus** : embedCarte, embedCosmos, embedFleuve, embedReunions3d.

## Fonctions transverses

| Fonction | Statut | Dans Futur |
|---|---|---|
| Projets, dossiers imbriqués, couleurs, favoris | présent | Réglages, Projets et dossiers (#701) |
| Icônes de projet | partiel | Champ conservé, non affiché |
| Statuts et types, globaux ou par projet | présent | Réglages, Statuts et types |
| Défauts de navigation par projet | partiel | Un projet s'ouvre sur sa page ; la vue par défaut n'est pas réglable |
| Tâche complète (dates, criticité, sous-tâches, dépendances, récurrence, référence, compte rendu, focus) | présent | Inspecteur |
| Risques de délai | partiel | Lus et comptés ; pas de saisie |
| Pièces jointes | partiel | Liens et fichiers ; ni sélecteur Drive, ni archivage Drive |
| Historique de la tâche | présent | Inspecteur, section Historique (journal d'activité) |
| Archive, restauration, annuler | présent | Pas de purge à 30 jours ni de suppression définitive (destructif, non porté) |
| Méta-filtres | présent | Réglages, Méta-filtres ; les conditions avancées existantes sont conservées |
| Filtres et vues enregistrés | adapté | Vues de Phrase (`futurPrefs.phrase`), adresse de chaque vue ; `nexora:views` n'est pas partagée |
| Synchronisation temps réel | présent | Écoute de chaque clé |
| Conflits d'écriture | adapté | Révision exigée, rejeu de la seule opération (3 essais), testé sur deux sessions simultanées, au lieu de la fusion à trois branches |
| Copie de secours locale | présent | Avant chaque envoi, signalée au démarrage, Réglages, Sauvegarde |
| Modèles de tâche, valeurs par défaut | présent | Réglages, Création ; palette « Nouvelle tâche : modèle … » |
| Raccourcis réglables | présent | Réglages, Raccourcis (actions du Cockpit) |
| Habitudes : thèmes, saisie, Strava | présent | Réglages, Thèmes d'habitudes ; pixel du jour ; liaison Strava (ajout de coches seulement) |
| Équipes, ateliers, charge du personnel | présent | Réglages et Équipe (saisie des affectations) |
| Objectifs sport | présent | Réglages, Objectifs sport |
| Calendriers publics (fériés, vacances, fiscalité) | à décider | Les projets synchronisés sont lus ; la synchronisation reste dans l'actuel |
| Réunions importées (Google Agenda) | lecture | Réglages Google Calendar dans l'actuel |
| Thèmes Bauhaus, Dessau, Observatoire | à décider | Identité Clarté (choix du 03/10) |
| Impression | présent | Palette « Imprimer la vue » ; feuille d'impression sans la coque |
| Fiche mémo PDF | adapté | Fiche A4 à imprimer ou à enregistrer en PDF (`/fiche?t=…`) |
| Export CSV | présent | Tâches, archive, sport ; sauvegarde JSON complète |
| Capture externe `?nexoraCapture=1` | présent | Mêmes paramètres que l'actuel |
| Guide de démarrage | présent | Première visite et palette |

### Réglages de l'actuel (14 onglets)

| Onglet | Dans Futur |
|---|---|
| Apparence | Apparence (mode et densité ; identité Clarté) |
| Ateliers | Ateliers |
| Objectifs sport | Objectifs sport |
| Projet | Projets et dossiers, Statuts et types, Création |
| Raccourcis | Raccourcis |
| Thèmes d'habitudes | Thèmes d'habitudes |
| Utilisateurs et équipes | Utilisateurs et équipes |
| Méta | Méta-filtres (pas les méta-blocs temporels) |
| Données | Données et exports, Sauvegarde |
| Intégrations | Adresse de capture seulement ; ChatGPT et Google Calendar se règlent dans l'actuel |
| Catégories budget, Banques connectées | Restent dans l'actuel (finances en lecture) |
| Vues affichées, Accueil | Sans objet : lentilles et Fil du jour |

## Écritures ouvertes depuis Futur

- **Tâches, journaux et préférences** : `tasks`, `taskArchive`, `activityLog`, `habitLog`, `habitSkips`, `futurPrefs`.
- **Réglages de projet** : `projects`, `projectFolders`, `statuses`, `taskTypes`, `taskDefaults`, `taskTemplates`, `favorites`, `habitThemes`.
- **Équipe, filtres, sport et notes** : `teamMembers`, `teams`, `workshops`, `staffing`, `metaFilters`, `sportGoals`, `dashboards`, `todayWidgets`.

Restent fermés (test `tests/garde.test.ts`) : devis, factures, Finance PRO
et dépenses de projet. La catégorisation des opérations bancaires passe par
le relais de finances.

## Décisions demandées à Quentin

1. Tableaux de bord multiples à widgets libres : faut-il les porter, ou Synthèse et les tuiles de Phrase suffisent-elles ?
2. Saisie dans Devis, Factures et Finance PRO : faut-il ouvrir ces clés ?
3. Calendriers publics et Google Agenda : la synchronisation reste-t-elle dans l'actuel ?
4. Thèmes Bauhaus, Dessau et Observatoire : faut-il les proposer à côté de Clarté ?
5. Suite du projet : coexistence des deux sites, ou bascule de `nexora-project.org` (issue dédiée, car l'adresse est un contrat figé).
