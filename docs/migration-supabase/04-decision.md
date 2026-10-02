# 04 — Décision : migration Firebase → Supabase

> Étude de faisabilité, Ref #603 — 02/10/2026. Détails : [`01`](01-inventaire-firebase.md),
> [`02`](02-architecture-cible.md), [`03`](03-plan-migration.md), [`schema-draft.sql`](schema-draft.sql).

## Synthèse (1 page)

**Recommandation : NO-GO pour la migration complète maintenant. GO PARTIEL immédiat sur les
travaux utiles quel que soit le backend. Migration à reconsidérer quand le modèle
multi-utilisateurs commercial sera décidé.**

**Pourquoi pas maintenant**

1. **Le gain fonctionnel est presque nul à périmètre constant.** Nexora stocke ~60 gros blobs
   JSON par compte (01 §3). Transposés tels quels en `jsonb`, ils ne permettent ni requêtes SQL
   utiles ni RLS fine. Le seul gain net, des règles d'accès versionnées et testables, s'obtient
   aussi en versionnant `firestore.rules` dans le dépôt, pour beaucoup moins cher.
2. **Plusieurs risques supposés n'existent pas.** La production n'utilise ni temps réel
   (`watch` vide, `P0:1364-1368`), ni cache hors-ligne Firestore, ni Firebase Storage. Il n'y a
   donc rien à perdre de ce côté, mais rien à gagner non plus.
3. **Le coût est réel** : **25 à 45 jours** de travail, et la zone touchée est la plus sensible
   (persistance, fusion, conflits). Il n'existe aucun test navigateur de bout en bout pour
   prouver la non-régression.
4. **Bloquant non résolu** : 4 Cloud Functions Todoist tournent sur `nexora-cb20d` et leur code
   n'est pas dans le dépôt.

**Ce qui est à faire tout de suite, quel que soit le choix**

| # | Action | Effort |
|---|---|---|
| 1 | **Sécurité, urgent.** Exporter et auditer les règles Firestore. Le relais `/api/nexora-storage` accepte n'importe quel `uid` dans le corps et ne vérifie pas le jeton (`ST:223-231`), et l'inscription est ouverte (`P3:19635`) : l'isolation entre comptes repose entièrement sur des règles que personne n'a vues. | 0,5–1 j |
| 2 | Couche `DataStore` serveur unique (aujourd'hui 3 implémentations du même format) et `nexoraAuth` côté front, adaptateur Firebase, sans changement de comportement. | 4–7 j |
| 3 | Suite Playwright de persistance (multi-onglets, conflits, secours, instantanés). | 4–7 j |
| 4 | Contrôle de fraîcheur en 1 requête au lieu de ~56 (`part-001:9746-9769`), ce qui réduit fortement les invocations Netlify. | 1 j |

**Conditions pour passer en GO migration**

- (a) modèle commercial acté : espaces partagés, rôles, inscription libre ou sur invitation ;
- (b) volumétrie et facture Firebase mesurées ;
- (c) code Todoist récupéré ;
- (d) points 2 et 3 en production depuis au moins 2 semaines sans incident ;
- (e) décision de **normaliser les tâches**. C'est le vrai argument en faveur de Postgres : à 1 000 utilisateurs, le modèle « blob réécrit en entier » coûte cher sur les deux backends (§3).

Si ces conditions sont réunies, faire la migration **avec** la normalisation, sur un **projet
Supabase dédié** (pas celui de KDM360), selon le plan 03 : refactor progressif, puis bascule
des données en une fois.

---

## 1. Effort par lot

| Lot | Contenu | Jours (bas–haut) | Dépend de |
|---|---|---|---|
| L0 | Préalables : règles, volumétrie, paramètres scrypt, code Todoist, décisions | 1–2 | — |
| L1 | `DataStore` serveur + adaptateur Firebase (unifie `SH`, `ST`, `MR`), publication | 3–5 | L0 |
| L2 | `nexoraAuth` front (AuthGate, 8 `getIdToken`, jeton Google) | 1–2 | L0 |
| L3 | Projet Supabase, schéma, RLS, RPC, tests SQL de politique | 3–5 | L0 |
| L4 | Adaptateurs Supabase : fonctions, relais, MCP (OAuth sur table) | 4–7 | L1, L3 |
| L5 | Auth Supabase : front, Google Agenda, page MCP, comptes | 3–5 | L2, L3 |
| L6 | Scripts export / transform / import / verify / retour inverse | 2–4 | L3 |
| L7 | Tests : contrat `DataStore`, Playwright, MCP | 4–7 | L1 (contrat), L4–L5 (exécution) |
| L8 | Réécriture des fonctions Todoist (code inconnu) | 2–5 | L0, L4 |
| L9 | Répétition, bascule, stabilisation | 2–3 | tous |
| **Total migration à périmètre constant** | | **25–45** | |
| Option L10 | Pièces jointes vers Supabase Storage | 3–5 | L9 |
| Option L11 | Normalisation des tâches (réécriture du modèle d'état de `LePlan`) | 15–30 | L9 |
| Hors estimation | Produit multi-tenant (invitations, rôles en UI, facturation) | non estimé | — |

**Chemin critique** : L0 → L1 → L3 → L4 → L6 → L7 → L9. **L8 (Todoist) peut bloquer la bascule.**
Ces estimations sont des ordres de grandeur, sans mesure de vélocité réelle.

## 2. Risques (probabilité × impact, échelle 1–3)

| Risque | P | I | Score | Commentaire / parade |
|---|---|---|---|---|
| Isolation actuelle défaillante (règles inconnues + relais sans contrôle d'`uid`) | ? | 3 | **à évaluer d'urgence** | Existe **aujourd'hui**, indépendamment de la migration (action n° 1). |
| Régression du contrat de persistance (409, `NEXORA_READ_UNSAFE`, keepalive < 60 Kio, fusion) | 2 | 3 | **6** | Garder `window.storage` inchangé ; tests de contrat + Playwright (03 §5). |
| RLS mal écrite (fuite entre locataires) | 2 | 3 | **6** | Fonctions d'appartenance uniques, tests à deux comptes, test « RLS activée partout », advisors. |
| Fonctions Todoist introuvables ou non portables | 2 | 2 | 4 | Les récupérer en L0 ; sinon couper le flux en le décidant explicitement. |
| Amplification d'écriture des blobs (performance, coût, ballonnement MVCC) | 2 | 2 | 4 | Mesurer ; dimensionner le compute ; normaliser (L11). |
| Perte de données à la migration | 1 | 3 | 3 | Export vérifié, sommes de contrôle à 100 %, gel, Firebase conservé 30 j, script inverse. |
| Migration des mots de passe | 2 | 1 | 2 | Sources Supabase divergentes (02 §3.3) ; avec très peu de comptes, réinitialisation. |
| Crédits Netlify consommés par les publications de la migration | 3 | 1 | 3 | 15 crédits par site et par publication ; regrouper les PR. |
| Perte du hors-ligne | 1 | 1 | 1 | Non applicable : pas de cache Firestore ; le secours `localStorage` est indépendant du backend. |
| Régressions temps réel | 1 | 1 | 1 | Pas de temps réel en production. |
| Quotas Realtime | 1 | 1 | 1 | Realtime optionnel, diffusion de la révision seule. |

## 3. Coûts

### 3.1 Tarifs publics (consultés le 02/10/2026)

| | Firebase | Supabase |
|---|---|---|
| Gratuit | Firestore : 1 Gio stocké, 50 000 lectures, 20 000 écritures et 20 000 suppressions par jour ; Auth 50 000 MAU | Free : base de 500 Mo, 50 000 MAU, 1 Go de fichiers, 5 Go de sortie, **mise en pause après 1 semaine d'inactivité**, 2 projets, **pas de sauvegarde** |
| Payant | Blaze : facturation à l'usage au-delà du gratuit. Lectures ≈ 0,06 $ / 100 000 (multi-région US, source tierce). Écritures et suppressions : tarif par région, **à vérifier** pour la région de `nexora-cb20d` | Pro : 25 $/mois, avec 10 $ de crédit compute (instance Micro), 8 Go de base, 100 000 MAU, 100 Go de fichiers, 250 Go de sortie (puis 0,09 $/Go), 500 connexions Realtime, sauvegardes 7 jours |

Sources : <https://firebase.google.com/pricing>, <https://supabase.com/pricing>,
<https://www.budgetforge.dev/tools/firebase-pricing-2026>. Prix des instances compute
au-delà de Micro et du Go de base supplémentaire : **non relevés, à vérifier**.

### 3.2 Hypothèses d'usage

Ces hypothèses sont **à remplacer par des mesures réelles**. Par utilisateur actif et par jour :

- 5 chargements complets ;
- 40 retours au premier plan, soit 56 contrôles de révision chacun (code actuel) ;
- 100 enregistrements ;
- `nexora:tasks` pèse environ 1,5 Mo (10 segments) ;
- 50 instantanés conservés.

Cela donne environ 2 600 lectures, 600 écritures et 500 suppressions Firestore par jour, et
environ 3 700 invocations du relais Netlify.

### 3.3 Estimation mensuelle

| Échelle | Firebase (Firestore, sans Netlify) | Supabase | Relais Netlify (les deux, si conservé) |
|---|---|---|---|
| Actuelle (1 compte) | ≈ 0 $ (sous les quotas). Blaze probable (les fonctions v2 l'exigent), **à vérifier** | Free inadapté (pause, pas de sauvegarde), donc Pro 25 $. 2e projet sur l'organisation KDM360 si elle est déjà en Pro : environ +10 $ de compute, **à vérifier** | environ 110 000 invocations par mois, **coût en crédits inconnu** |
| 100 utilisateurs | ≈ 5–15 $ | 25 $ (+ compute supérieur probable) | environ 11 M d'invocations par mois, **inconnu** |
| 1 000 utilisateurs | ≈ 80–150 $ (dont environ 80 Go d'instantanés) | 25 $ + compute dimensionné pour environ 150 Go/jour d'écritures de blobs + sortie ≈ 20 $, **non chiffrable sans les prix compute** | environ 110 M d'invocations par mois, **probablement le poste dominant** |

**Constats :**

- **À l'échelle actuelle, Supabase coûte plus cher** (25 $/mois minimum contre ≈ 0 $).
- **Le poste qui grossit le plus n'est ni Firebase ni Supabase**. C'est le relais Netlify (une
  invocation par lecture, écriture ou contrôle) et le modèle « blob réécrit en entier ». Passer
  le contrôle de fraîcheur à 1 requête (action n° 4) et, plus tard, les accès directs depuis le
  navigateur et la normalisation pèsent plus sur la facture que le choix du fournisseur.
- Les instantanés (50 copies de `tasks` + `projects` par compte) dominent le stockage. Leur
  rétention est à revoir avant toute commercialisation.

## 4. Ce qu'on perd, ce qu'on gagne

**Gains**

- SQL : rapports, administration, référentiels administrables en base (types de tâches,
  statuts), contraintes, clés étrangères, après normalisation seulement.
- Accès versionnés dans le dépôt, testables et revus en PR (RLS), au lieu de règles en console.
- Réversibilité : `pg_dump`, format standard. Développement local et branches de base.
- Facture prévisible : pas de facturation à la lecture.
- Fin de la segmentation à 150 000 caractères (trois implémentations supprimées).
- Fichiers joints sortis du JSON des tâches (Storage avec politiques).
- Un seul type de backend avec le Budget, mais sur un projet séparé.

**Pertes et coûts**

- 25 à 45 jours sans gain visible pour l'utilisateur à périmètre constant.
- Un plancher de 25 $/mois contre environ 0 $ aujourd'hui.
- De l'exploitation à assurer : dimensionnement du compute, vacuum, limites de connexions.
  Firestore n'en demande pas.
- Les fonctions Todoist sont à réécrire.
- Risque de régression sur la persistance, la partie la plus délicate du code.
- Le Firestore actuel encaisse le modèle « gros documents segmentés » sans réglage. En
  Postgres, réécrire des `jsonb` de plusieurs Mo à haute fréquence demande une surveillance.

## 5. Questions ouvertes à trancher (Quentin)

1. **Modèle commercial** : espaces partagés entre plusieurs comptes, ou un compte égale un
   espace ? Inscription libre ou sur invitation ? (conditionne le schéma et la RLS)
2. **Normalisation des tâches** : acceptée comme objectif (15 à 30 jours) ? Sans elle, la
   migration a peu d'intérêt.
3. **Règles Firestore** : peux-tu exporter les règles déployées (console → Firestore → Règles) ?
   Faut-il traiter l'action n° 1 en priorité, dans une issue dédiée ?
4. **Comptes existants** : combien de comptes dans Firebase Auth, et lesquels sont liés à
   Google ? Ce nombre décide entre réinitialisation et import des hachages.
5. **Volumétrie et facture** : taille de `nexora:tasks` et `nexora:taskArchive`, usage
   Firestore (console → Usage), forfait (Spark ou Blaze), région du projet.
6. **Todoist** : où est le code des 4 fonctions ? Le flux Todoist doit-il survivre à la migration ?
7. **Supabase** : quel est le forfait de l'organisation KDM360 ? Es-tu d'accord pour un projet
   dédié à Nexora ?
8. **MCP** : `service_role` (simple) ou JWT utilisateur + RLS (plus sûr, recommandé pour la
   commercialisation) ?
9. **Pièces jointes** : passer les fichiers vers Supabase Storage, ou garder data-URL + Drive ?
10. **Non-chevauchement du Planning** : faut-il en faire une vraie règle de données (refus
    d'enregistrer), ou rester sur la règle d'affichage actuelle ?
