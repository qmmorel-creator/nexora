# Versions, environnements et publication — Nexora

Mis en place par l'issue #544 (29/09/2026). Ce guide est la référence ; `CLAUDE.md` et
`.github/PROCESS.md` y renvoient.

## En bref

| Niveau | Code | Publication | Données |
|---|---|---|---|
| **Local** | branche de travail `claude/…` | aucune — `npm run local`, `http://127.0.0.1:8888`, bandeau LOCAL | fictives, dans le navigateur |
| **Préproduction** | `main` (ou un SHA précis) | brouillon Netlify, alias stable `preprod`, déposé par `outils/publier preproduction` | fictives, dans le navigateur ; aucune fonction |
| **Production** | commit de `origin/main` associé à `vX.Y.Z` | `outils/publier production`, **après feu vert explicite de Quentin** sur version, SHA et composants | Firebase `nexora-cb20d` |

Une fusion dans `main` **ne publie rien**. Elle fournit le SHA définitif à présenter pour
la publication. Le registre `publication/registre.json` dit ce qui est réellement en ligne ;
`main` peut contenir du code non publié.

Cycle (depuis le 30/09/2026, la branche `develop` est abandonnée, #549) : branche de travail →
PR vers `main` → `verdict` vert → fusion (ne publie rien) → préproduction depuis `main` →
`preparer --version X.Y.Z` par PR vers `main` → `verdict` du commit final → feu vert pour ce
commit → `outils/publier production` → registre committé sur `main`. Un correctif urgent part
du déploiement réellement servi (tag, ou provenance du registre tant qu'aucun tag n'existe)
dans `hotfix/<prochaine-version>`, puis rejoint `main` par PR.

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

| Garde-fou | État au 29/09/2026 |
|---|---|
| Builds Git Netlify arrêtés (`stop_builds`) sur les deux projets | **à appliquer au moment de la fusion du dispositif** : `outils/publier garde --arreter`, puis contrôle par `garde` |
| Commande `ignore` versionnée (`scripts/netlify-ignore.mjs`) | active dès la fusion : tout build Git de production, d'aperçu ou de branche est sauté |
| Deploy Previews | désactivées (`skip_prs: true`), vérifié par l'API |
| Build hooks | aucun, vérifié par l'API |
| CI sans secret ni étape de publication | active dès la fusion |

Arrêter les builds via l'interface, si l'API est refusée :
`Project configuration → Developer settings (ou Build & deploy) → Continuous deployment →
Build settings → Configure → Build status → Stopped builds → Save`, sur **chacun** des deux
projets. Ne jamais déconnecter/reconnecter le dépôt (cela peut réactiver les builds).
L'arrêt ne touche pas le site publié. Retour à l'ancien fonctionnement (réservé à une
restauration explicitement demandée) : variable Netlify
`NEXORA_BUILDS_GIT_PRODUCTION=ancien-fonctionnement` **et** `garde --retablir` avec
`NEXORA_RESTAURER_ANCIEN_FONCTIONNEMENT=oui`.

## Protections GitHub (rulesets)

Dépôt **public** : les rulesets de branches et de tags sont disponibles avec GitHub Free.
À appliquer par Quentin (`Settings → Rules → Rulesets → New ruleset`), puis à vérifier :

| Ruleset | Cible | Règles |
|---|---|---|
| `branches-officielles` | Branch targeting : `main` ; Enforcement : Active ; aucun bypass | **Restrict deletions**, **Block force pushes** — rien d'autre (pas de PR ni de statut obligatoires : l'outil écrit le registre directement sur `main`) |
| `tags-de-version` | Tag targeting : `v*` ; Enforcement : Active | **Restrict updates**, **Restrict deletions** — laisser la création possible |

Les protections d'environnement GitHub ne sont pas le verrou de publication : l'outil
s'exécute hors Actions.

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
| « Développe cette fonctionnalité » | issue, branche, commits `Ref #N`, tests locaux, PR vers `main`, fusion après `verdict` vert, préproduction, URL et SHA testés, `statut:à-tester` — sans nouvelle autorisation pour ces étapes |
| « Mets ce lot en préproduction » | `outils/publier preproduction`, vérifier, donner liens et SHA |
| « Publie la version X validée » | un seul message : version, SHA définitif, changelog, composants, recette, retour arrière ; publier après le « oui » applicable, sans redemander s'il a déjà été donné pour ce candidat exact |
| « Reviens à la version Y » | `outils/publier retour --version Y`, vérifier, registre à jour |

Si le candidat change après accord : le dire, renouveler la préproduction, demander un
accord pour le nouveau candidat. Seule exception à l'accord préalable : une régression avérée
qui casse la production autorise le **retour** au déploiement précédent connu et compatible,
puis information de Quentin — ni correctif non validé, ni restauration ou destruction de
données.

## Versions en ligne

`outils/publier etat` est la vue de référence (lue depuis l'API Netlify et le registre).
Le board de suivi, lorsqu'il est resynchronisé, reprend une section « Versions en ligne »
lue depuis `publication/registre.json` (version, commit, Deploy ID, date, précédent) et la
préproduction depuis l'historique Netlify — jamais d'une copie tenue à la main.
