# Versions, environnements et publication — Nexora

Mis en place par l'issue #544 (29/09/2026), simplifié par #549 (abandon de `develop`) et
**#553 (30/09/2026) : retour à la publication systématique**. Ce guide est la référence ;
`CLAUDE.md` et `.github/PROCESS.md` y renvoient.

## En bref (depuis #553)

| Niveau | Code | Publication | Données |
|---|---|---|---|
| **Local** | branche de travail `claude/…` | aucune — `npm run local`, `http://127.0.0.1:8888`, bandeau LOCAL | fictives, dans le navigateur |
| **Production** | `main` | **chaque fusion dans `main`** : build Git Netlify, site par site, si ses fichiers ont changé | Firebase `nexora-cb20d` |

**Une fusion dans `main` publie la production.** Il n'y a plus de préproduction ni de feu vert
par version : la PR vers `main`, fusionnée quand son `verdict` est vert, *est* la publication.

Cycle : branche de travail → `npm run install:all && npm run verify` → PR vers `main` →
`verdict` vert → fusion → build Netlify de production (≈ 1 à 3 min) → vérification de la
production → commentaire sur l'issue (URL, SHA, Deploy ID) → `statut:à-tester`.

- La commande `ignore` (`scripts/netlify-ignore.mjs`) décide : production construite si le
  dossier du site ou un fichier partagé (`config/environnements.mjs`, `publication/version.json`)
  a changé ; Deploy Previews et branch deploys **toujours sautés** (les deux projets servent les
  secrets de production à tous les contextes).
- Une modification de l'interface seule ne republie pas le MCP, et inversement ; une PR purement
  documentaire ou d'outillage ne publie rien.
- Arrêt d'urgence sans commit : variable Netlify `NEXORA_BUILDS_GIT_PRODUCTION=arret`, ou
  `outils/publier garde --arreter` (builds Git arrêtés).
- Retour arrière : dans Netlify, *Deploys* → déploiement précédent → *Publish deploy* (aucune
  reconstruction), ou `git revert` fusionné dans `main`. Un retour Netlify ne restaure ni
  Firebase ni les jetons MCP.
- `publication/version.json`, `CHANGELOG.md` et `publication/registre.json` ne sont plus tenus
  à chaque publication : le registre reste figé à l'état du 29/09/2026 (`outils/publier etat`
  signalera donc un écart dès la première publication par Git ; c'est attendu).

Les sections suivantes décrivent l'outillage de #544. **`preproduction`, `preparer` et
`production` sont hors usage depuis #553** ; `etat` et `garde` restent utiles.

## Commandes

```bash
npm run install:all && npm run verify   # socle, obligatoire avant tout push
npm run verifier                        # idem + plan du banc visuel (visual:plan)
npm run visual:plan / visual:affected   # banc visuel local, ciblé ; visual:check une fois sur le lot stabilisé

npm run local                           # construit en « local » et sert sur 127.0.0.1:8888 (mode UI léger)
npm run build:preproduction             # construction de préproduction dans apps/nexora/dist
npm run smoke:environnement -- --env preproduction [--url …] [--commit <sha>]
npm run smoke:production                # lecture seule de la production

npm run publier:installer               # une fois : empaqueteur de fonctions de l'outil (hors CI)
outils/publier etat
outils/publier garde [--arreter]
outils/publier preproduction [--ref main] [--essai]
outils/publier preparer --version 0.1.0
outils/publier production --version 0.1.0 --commit <sha complet> --essai
outils/publier production --version 0.1.0 --commit <sha complet> --brouillon
outils/publier production --version 0.1.0 --commit <sha complet> --accord "<citation exacte du feu vert>"
outils/publier retour --version <Y> [--sites application,mcp] [--essai]
```

Le jeton Netlify (`NETLIFY_AUTH_TOKEN`) est fourni par l'environnement de l'assistant ; il
n'est jamais committé ni ajouté aux secrets GitHub. GitHub Actions vérifie, il ne publie pas.

### `etat`
Compare, pour chaque site, le déploiement réellement servi, la dernière préproduction et le
registre ; affiche les garde-fous (builds Git, branche autorisée, Deploy Previews, verrou) et
toute divergence.

### `preproduction`
Résout la référence en SHA exact, refuse un commit antérieur au mécanisme (sans
`config/environnements.mjs`, `apps/nexora/scripts/environnement.mjs` et
`publication/version.json`), construit dans un `git worktree` temporaire (`npm ci`,
`NEXORA_ENV=preproduction`), dépose un **brouillon** (`draft: true`, `branch: "preprod"`) titré
`preproduction · <commit complet> · application · empreinte:<16>`, puis vérifie l'alias, le
permalien, `version.json`, le bandeau, `noindex`, l'absence de référence à `nexora-cb20d` et
l'absence de fonction servie, et que le Deploy ID de production n'a pas bougé. Même contenu
déjà servi sous l'alias : aucun nouveau dépôt. Ne déplace jamais la branche courante et ne
stashe rien.

- URL stable : `https://preprod--nexora-project.netlify.app`
- Permalien d'un candidat : `https://<deployId>--nexora-project.netlify.app`
- L'historique des préproductions est celui de Netlify ; elles n'entrent pas au registre.

### `preparer --version X.Y.Z`
Écrit `publication/version.json` et transforme « À venir » du `CHANGELOG.md` en
`[X.Y.Z] — date`. À committer et fusionner comme tout changement : la version doit être
déclarée **au commit publié**.

### `production`
Refus obligatoires, avant tout effet :

1. SHA absent de `origin/main` fraîchement relu ;
2. version non déclarée à ce commit, changelog sans section, tag `vX.Y.Z` sur un autre
   commit (un tag ne se déplace jamais) ;
3. pas de check run `verdict` du workflow `Nexora CI` terminé en `success` **sur ce SHA**
   (échec, annulation, absence, en cours = refus ; `skipped` ignoré, jamais un succès) ;
4. pour chaque composant modifié : aucune préproduction vérifiée du même contenu
   (empreinte de composant identique) — sauf `--sans-recette "raison"`, exception motivée,
   tracée dans le registre et la release, jamais automatique ;
5. builds Git encore actifs sur l'un des deux projets, déploiement servi verrouillé,
   registre divergent de la production servie, cible incohérente ;
6. feu vert absent : `--accord` doit citer la version, le SHA (12 caractères au moins) et
   chaque composant publié. Aucun consentement ne se déduit d'un test ou d'un champ rempli.

`--essai` affiche prérequis et plan sans rien modifier. `--brouillon` construit en
configuration de production (fonctions comprises, empaquetées par
`@netlify/zip-it-and-ship-it`), dépose et vérifie les brouillons **sans promouvoir** : permis
sans feu vert. La vraie publication promeut **ces mêmes Deploy IDs vérifiés** (aucune
reconstruction entre validation et promotion), vérifie l'URL de production et `version.json`
en contournant le cache, inscrit immédiatement chaque composant au registre (journal local
`publication/.journal/reprise.jsonl` d'abord), committe le registre sur `main` (worktree
temporaire, sans force push, relu si `main` a avancé), puis crée le tag sur le **commit
source** et la release. Une reprise retrouve le brouillon par titre **et** empreinte ; une
création dont la réponse est perdue n'est jamais relancée à l'aveugle. Un verrou local
sérialise production, retour et écritures du registre.

### `retour --version Y`
Republie les Deploy IDs inscrits au registre pour la version Y (y compris `initial`), sans
reconstruction, sans tag déplacé, sans réécriture Git ; vérifie et inscrit l'événement. La
demande de Quentin vaut autorisation de ce retour. **Un retour Netlify ne restaure ni
Firebase, ni ses règles, ni les fonctions Todoist/Cloud Run, ni les collections de jetons
MCP** : les clés `nexora:*` doivent rester lisibles par la version restaurée.

## Composants et empreintes

`config/environnements.mjs` est la source unique des valeurs non secrètes : projets
Netlify, origines, projet Firebase attendu, issuer OAuth, alias, chemins de chaque composant.

| Composant | Projet Netlify | Chemins de l'empreinte |
|---|---|---|
| `application` | `nexora-project` (`12f7ec79-…`) | `apps/nexora`, `config/environnements.mjs` |
| `mcp` | `nexora-chatgpt-mcp` (`2c0b2293-…`) | `apps/nexora-mcp`, `config/environnements.mjs` |

- **Empreinte de composant** (`git ls-tree` des chemins, hors `publication/registre.json` et
  `publication/version.json`) : décide s'il faut republier et prouve qu'une recette porte
  sur le même contenu. Une modification de l'interface seule ne republie pas le MCP.
- **Empreinte de recette** : empreinte de composant + environnement + Node majeur ; identifie
  une préproduction déjà servie.
- **Arbre du verdict CI** : tout le dépôt, registre compris.

La version déclarée, le changelog, le registre et les scripts d'orchestration ne
déclenchent pas à eux seuls de republication. Les deux sites ne forment pas une transaction :
chacun est inscrit dès son résultat. Ordre conseillé quand les deux changent : MCP puis
application si l'interface dépend d'un nouveau contrat MCP ; application puis MCP dans le cas
inverse ; retour dans l'ordre opposé.

## Isolation : ce qui est garanti, ce qui ne l'est pas

**Constat du 29/09/2026** : sur les deux projets Netlify, les secrets de production
(`FIREBASE_SERVICE_ACCOUNT_JSON`, `NEXORA_USER_UID`, `NEXORA_ASSISTANT_API_KEY`,
`KDM360_SUPABASE_SECRET_KEY`, `MCP_CLIENT_SIGNING_KEY`…) sont servis à **tous** les contextes
(production, branch-deploy, deploy-preview, dev). Un brouillon ou un aperçu **avec fonctions**
sur ces projets s'exécuterait avec les droits de production. D'où :

- la préproduction ne dépose **aucune fonction** : `/api/*` répond 404 ;
- l'interface hors production est construite en **mode démonstration** : SDK Firebase
  remplacé par `apps/nexora/environnement-demo/firebase-demo.js` (compte fictif, aucun
  réseau ; un projet autre que `demo-…` est refusé), stockage
  `apps/nexora/environnement-demo/stockage-demo.js` dans le `localStorage` de l'origine de
  test (préfixe `nexora-demo:v1:`, jamais de clé de production lue ni effacée). Le build
  **échoue** si une substitution ne trouve pas sa cible ou si `nexora-cb20d` subsiste, et une
  CSP `connect-src 'self' https://esm.sh` bloque en plus toute requête vers Firebase ou Google ;
- origines distinctes (`127.0.0.1:8888`, `preprod--nexora-project.netlify.app`) : sessions,
  cookies, caches et stockage navigateur séparés de la production ;
- `noindex, nofollow` en balise et en en-tête — ce n'est **pas** une protection d'accès.

Intégrations hors production (mode démonstration) :

| Intégration | Production | Local / préproduction |
|---|---|---|
| Firestore `users/{uid}/kv_store` | via `/api/nexora-storage` | stockage fictif du navigateur |
| Firebase Auth | comptes réels | compte fictif `demo@exemple.invalid` |
| Google Calendar (navigateur) | jeton Google de l'utilisateur | aucun jeton, `googleapis.com` bloqué par CSP |
| Drive, Gmail (routines ChatGPT) | API et MCP de production | non joignables : aucune fonction, aucun MCP |
| Todoist (fonctions Firebase v2, Cloud Run) | inchangé, hors Netlify | non concerné ; flux Nexora → Todoist toujours supprimé |
| Ingestion QME, finance (Budget360/KDM) | fonctions Netlify | aucune fonction : aucun secret Supabase exposé |
| Rapports planifiés matin/soir | `30 18,19 * * *`, `0 5,6 * * *` | aucune fonction déposée : aucun doublon possible, même par appel manuel |
| Synchronisation bancaire Enable Banking (#677) | `40 4,16 * * *` (UTC), bouton des Réglages | aucune fonction déposée : aucun accès bancaire |

**Ce qui reste à créer pour une recette intégrée** (fonctions, Firebase et MCP réels de
test) — non fait, car cela crée des ressources permanentes :

1. un projet Firebase de test distinct (ou les émulateurs Auth/Firestore avec un identifiant
   `demo-…` pour le local), son compte de service limité à ce projet ;
2. deux projets Netlify de test (application, MCP) **ou** des variables par contexte sur les
   projets existants, avec des valeurs de test pour `branch-deploy`/`deploy-preview` et les
   valeurs réelles limitées au contexte `production` ; vérifier ensuite par l'API la valeur
   **résolue à l'exécution** d'un brouillon, pas seulement la déclaration ;
3. le code : `projectId` aujourd'hui figé à `nexora-cb20d` dans
   `apps/nexora/netlify/functions/_shared/nexora.ts`, `nexora-storage.mts` et
   `nexora-health.ts` doit venir de la configuration, avec échec explicite hors production
   si la cible est `nexora-cb20d` ; le MCP doit recevoir `MCP_PUBLIC_ORIGIN`, clé de
   signature et collections de jetons propres au test, de sorte qu'un jeton de test soit
   refusé en production et inversement (issuer et audience distincts).

Tant que ce n'est pas fait, le **MCP n'a pas de préproduction** : `preproduction --composants mcp`
est refusé et une publication du MCP exige `--sans-recette "raison"`.

## Garde-fous de publication automatique

| Garde-fou | État depuis #553 |
|---|---|
| Builds Git Netlify (`stop_builds`) | **actifs** sur les deux projets (`outils/publier garde --retablir` avec `NEXORA_RESTAURER_ANCIEN_FONCTIONNEMENT=oui`) ; branche de production `main` |
| Commande `ignore` versionnée (`scripts/netlify-ignore.mjs`) | production construite si le site a changé ; aperçus et branches sautés ; arrêt par `NEXORA_BUILDS_GIT_PRODUCTION=arret` |
| Deploy Previews | désactivées (`skip_prs: true`) |
| Build hooks | aucun |
| CI sans secret ni étape de publication | `verdict` exigé avant fusion |

Arrêter les builds via l'interface : `Project configuration → Build & deploy → Continuous
deployment → Build settings → Configure → Build status → Stopped builds → Save`, sur chacun des
deux projets. Ne jamais déconnecter/reconnecter le dépôt.

## Protections GitHub (rulesets)

Dépôt **public** : rulesets disponibles avec GitHub Free. Depuis #553, `main` **est** la
production ; le ruleset suivant est donc recommandé (`Settings → Rules → Rulesets → New branch
ruleset`) :

| Ruleset | Cible | Règles |
|---|---|---|
| `main-production` | Branch targeting : `main` (Include default branch) ; Enforcement : Active | **Restrict deletions**, **Block force pushes** |

Ne pas cocher *Require a pull request* ni *Require status checks* sans ajuster les outils. Le
ruleset `v*` prévu par #544 n'est plus nécessaire tant qu'aucun tag de version n'est créé.

## CI et preuves

- `Nexora CI` : pull requests, push sur `main`, lancement manuel
  (`rapide | representatif | complet`). Plus aucun run sur un simple push de branche de
  travail : la vérification locale est obligatoire avant push.
- Jobs `perimetre` → `verify` → `verdict`. `verdict` est le statut exigé par l'outil ; il
  échoue si le socle requis manque, échoue ou est annulé, et n'est vert sans socle que pour
  une modification documentaire connue ou une **preuve applicable**.
- Preuve : artefact `preuve-verify-<empreinte>` (arbre, empreinte, commit, Node, résultat),
  conservé 30 jours, réutilisable **3 jours** au plus (le socle contient des contrôles datés),
  seulement s'il vient d'un run du dépôt lui-même. L'empreinte couvre tout le dépôt sauf la
  documentation connue et le registre : une modification de la CI, d'un outil, d'une
  dépendance ou de Node la change et impose le socle. Le commit final de `main` reçoit
  toujours son propre `verdict`.
- Les exécutions obsolètes sont annulées, **jamais celles de `main`**.
- Le banc visuel/3D reste local (`visual:plan`, `visual:affected`, `visual:check` une fois
  sur le lot stabilisé) ; il n'entre dans aucune preuve GitHub.

## Coûts

Dépôt public sur runners standard `ubuntu-latest` : minutes GitHub Actions non facturées
(les runners plus grands le seraient). Netlify, forfait à crédits : chaque **publication de
production** réussie coûte (15 crédits d'après la documentation consultée le 29/09/2026) ;
les brouillons de préproduction n'en consomment pas selon cette même documentation, mais le
trafic, les requêtes et les fonctions restent comptés. Construire chez l'assistant ne consomme
aucune minute de build hébergée, sans être gratuit pour autant. Viser une version officielle
par semaine environ, sauf urgence. Aucun changement d'abonnement.

## Règles d'usage pour l'assistant

| Demande de Quentin | Comportement |
|---|---|
| « Développe cette fonctionnalité » | issue, branche, commits `Ref #N`, `verify` local, PR vers `main`, fusion après `verdict` vert (= publication), vérification de la production, commentaire (URL, SHA, Deploy ID), `statut:à-tester` |
| « Reviens en arrière » | republier le déploiement précédent dans Netlify (ou `git revert` par PR), vérifier, informer |

Exception toujours valable : une régression avérée qui casse la production autorise le retour
immédiat au déploiement précédent, puis information de Quentin — ni restauration ni
destruction de données.

## Versions en ligne

`outils/publier etat` lit les déploiements servis depuis l'API Netlify (commit, Deploy ID,
date). Le registre `publication/registre.json` est figé depuis #553.
