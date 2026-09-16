# Prompt d'audit Nexora — « Impeccable » + « UI/UX PRO MAX »

Prompt réutilisable à coller tel quel dans une session Claude Code (ou ChatGPT avec accès
au dépôt) pour auditer Nexora de bout en bout et produire un plan d'amélioration priorisé.

Deux axes complémentaires sont demandés dans la même passe :

- **Impeccable** — qualité d'ingénierie : correction, robustesse, sécurité, performance,
  testabilité, dette technique, cohérence du dépôt.
- **UI/UX PRO MAX** — qualité perçue : ergonomie, hiérarchie visuelle, cohérence du design
  system, accessibilité, micro-interactions, responsive, rédaction d'interface.

> Ces deux noms désignent ici des **grilles d'audit décrites dans ce document**, pas des
> skills installés. Si un jour les skills du plugin `design` (`design-critique`,
> `accessibility-review`, `design-system`, `ux-copy`) sont activés, ils peuvent alimenter
> l'axe UI/UX sans changer le format de sortie attendu ci-dessous.

---

## Le prompt

<!-- Copier à partir d'ici -->

Tu vas auditer **Nexora** (dépôt `qmmorel-creator/nexora`) selon deux grilles menées en
parallèle : **Impeccable** (ingénierie) et **UI/UX PRO MAX** (expérience). Objectif :
une liste de constats vérifiés, chiffrés, priorisés, chacun actionnable en une issue.

### 1. Contexte à connaître avant de commencer

Monorepo à deux applications, toutes deux déployées sur Netlify depuis `main` :

| Application | Dossier | Rôle | Production |
|---|---|---|---|
| Interface + API | `apps/nexora` | UI monofichier, fonctions Netlify `nexora-*`, rapports planifiés | `https://nexora-project.org` |
| Connecteur MCP | `apps/nexora-mcp` | serveur MCP OAuth pour ChatGPT | `https://nexora-chatgpt-mcp.netlify.app` |

Source de données : Firebase `nexora-cb20d`. Aucune donnée, aucun compte de service, aucun
jeton n'est versionné.

Faits structurants relevés sur la base actuelle — à **revérifier** plutôt qu'à reprendre
tels quels, ils datent du jour de rédaction :

- l'interface est **un seul fichier HTML d'environ 2,8 Mo / ~41 700 lignes**, versionné en
  fragments `apps/nexora/source/index.html.part-000..004` que le build concatène pour
  reconstruire `dist/index.html` à l'octet près ;
- c'est du **React transpilé dans le navigateur** : `@babel/standalone` chargé depuis
  unpkg, un unique `<script type="text/babel">` ; pas d'étape de build JS, pas de bundler,
  pas de découpage de code ;
- ~**189 composants React** et ~530 `useState` dans ce fichier unique ;
- ~**107 propriétés CSS personnalisées** cohabitent avec au moins cinq familles de nommage
  concurrentes (`--life-*`, `--b360-*`, `--ct-*`, `--fs-*`, et des noms nus comme `--bg`,
  `--ink`, `--paper`, `--quai`, `--craie`) ; ~468 couleurs hexadécimales en dur subsistent
  à côté des ~3 000 usages de `var(--…)` ;
- signaux d'accessibilité faibles au regard de la taille : ~1 440 `<button>` pour ~19
  `aria-label`, 4 `role=`, 1 `tabindex`, 5 `aria-hidden` ; 5 `prefers-reduced-motion`,
  3 `:focus-visible` ; aucun `prefers-color-scheme` ;
- 5 usages de `dangerouslySetInnerHTML` ;
- fonctions Netlify côté `apps/nexora` : `nexora-read`, `nexora-create-task`,
  `nexora-task-operations`, `nexora-audit`, `nexora-health`, `nexora-reports`,
  `nexora-report-morning-scheduled`, `nexora-report-evening-scheduled`, `nexora-storage`,
  `finance-catalogs`, `finance-transactions` ; contrat public décrit dans
  `apps/nexora/openapi.yaml` ;
- tests : `node --test` sur `apps/nexora/tests/*.test.mjs` (9 fichiers, orientés calculs :
  criticité, gantt, heatmap, treemap, merge/fiabilité de synchronisation) plus les tests
  MCP et `scripts/verify-repository.mjs` ; **aucun test de rendu, de parcours, ni de
  régression visuelle** ;
- CI : `.github/workflows/ci.yml` (`Nexora CI`) exécute `npm run install:all` puis
  `npm run verify` sur `main` et les branches `claude/**` et `codex/**` ;
- en-têtes HTTP : `apps/nexora/netlify.toml` pose `Cache-Control: no-store` et
  `X-Content-Type-Options: nosniff` sur `/api/*` ; un fichier `_headers` existe côté MCP.
  Vérifier ce qui manque (CSP, `Referrer-Policy`, `X-Frame-Options`, HSTS) et ce qui est
  réellement servi.

### 2. Contraintes non négociables

Elles priment sur toute recommandation : une piste qui les enfreint est hors sujet.

1. **Aucun secret** dans le dépôt, ni dans un exemple, ni dans un commentaire.
2. **URLs et contrats figés** : domaines de production, chemins `/api/nexora/*` et
   `/api/finance/*`, schémas de `openapi.yaml`, noms des outils MCP. Toute évolution est
   une piste à proposer, jamais un changement à appliquer dans l'audit.
3. **Les déploiements Netlify sont facturés.** L'audit ne pousse rien vers `main`,
   n'ouvre aucune pull request, ne fusionne rien. Le travail s'accumule sur la branche de
   travail ; la publication attend le feu vert explicite de Quentin.
4. **`npm run install:all && npm run verify` doit passer** avant tout push.
5. Le build monofichier doit rester **reproductible à l'octet près** : toute piste touchant
   `source/index.html.part-*` précise comment `scripts/verify-repository.mjs` reste vert.
6. Une demande = une issue, avec un label `statut:*` et un label `zone:*` (voir
   `.github/PROCESS.md`). Ne jamais employer de mot-clé de fermeture (`Closes`, `Fixes`,
   `Resolves`) dans un commit ou une description de pull request.

### 3. Méthode imposée

- **Lis avant de juger.** Chaque constat cite un fichier et une ligne, ou une commande
  reproductible avec sa sortie. Un constat sans preuve est supprimé, pas nuancé.
- **Mesure plutôt qu'estimer** : poids des fichiers, nombre d'occurrences, durée observée.
  Si une mesure est impossible dans l'environnement, écris-le au lieu d'inventer un chiffre.
- **Distingue** ce qui est cassé (bug), ce qui est risqué (fragilité), ce qui est lourd
  (dette), et ce qui est perfectible (confort). Ne les mélange pas dans une même ligne.
- **Refuse les généralités.** « Améliorer l'accessibilité » n'est pas un constat ;
  « les 1 440 boutons de l'interface n'exposent que 19 `aria-label`, donc les boutons
  icône-seule du bandeau d'actions sont muets au lecteur d'écran » en est un.
- **Doute de la base fournie** au §1 : si un chiffre ne se reproduit pas, corrige-le
  explicitement dans le rapport.
- Ne modifie aucun fichier applicatif pendant l'audit. Le livrable est le rapport.

### 4. Grille « Impeccable » — ingénierie

Traite chaque rubrique ; dis explicitement « rien à signaler » quand c'est le cas.

1. **Architecture et découpage** — le monofichier de 2,8 Mo : coût réel (temps de parse, de
   transpilation Babel au chargement, mémoire, capacité à relire une modification), et ce
   qu'un découpage coûterait en regard de la contrainte de reproductibilité.
2. **Chaîne de build** — transpilation navigateur vs build préalable ; dépendance à
   `unpkg` et `esm.sh` sans intégrité de sous-ressource ni épinglage robuste ; ce qui casse
   si un CDN tombe ou renvoie autre chose.
3. **Performance perçue** — poids transféré, chemin critique, polices Google Fonts, temps
   jusqu'au premier rendu utile, comportement sur une connexion mobile lente. Chiffre ce
   qui est mesurable.
4. **Sécurité** — les 5 `dangerouslySetInnerHTML` (origine des données injectées) ;
   en-têtes HTTP manquants ; exposition et validation des fonctions Netlify ; règles
   Firebase telles que l'application les suppose ; ce qui est authentifié et ce qui ne
   l'est pas.
5. **Fiabilité des données** — gestion des erreurs réseau, états de chargement, conflits
   d'écriture concurrente, idempotence des mutations, comportement hors-ligne.
6. **Tests** — ce que couvrent réellement les 9 fichiers de tests, ce qu'ils ne couvrent
   pas, et les trois tests qui apporteraient le plus de sécurité pour le moins d'effort.
7. **Contrat d'API** — `openapi.yaml` vs le comportement effectif des fonctions ; écarts,
   champs non documentés, codes d'erreur.
8. **Cohérence du dépôt** — scripts `npm`, documentation (`README.md`, `docs/`,
   `DEPLOYMENT.md`) vs réalité du code, fichiers morts, duplications entre
   `apps/nexora` et `apps/nexora-mcp`.
9. **CI et coût** — ce que `Nexora CI` attrape, ce qu'elle laisse passer, et si la règle
   `ignore` de `netlify.toml` protège vraiment contre les constructions inutiles.

### 5. Grille « UI/UX PRO MAX » — expérience

1. **Design system** — inventorie les ~107 tokens CSS, regroupe les familles concurrentes,
   identifie les doublons sémantiques (deux tokens, une même couleur) et les ~468
   hexadécimaux en dur qui devraient être des tokens. Propose une nomenclature cible unique
   et un chemin de migration progressif, sans big bang.
2. **Hiérarchie et densité** — sur les vues principales (Dashboard, Liste, Gantt, Calendrier,
   Heatmap, Chiffrage, Control Tower, Automatisations), juge la hiérarchie typographique,
   la densité d'information, le rythme vertical, la lisibilité des tableaux denses.
3. **Cohérence des composants** — les ~189 composants produisent-ils des boutons, champs,
   modales, menus et sélecteurs cohérents ? Repère les variantes accidentelles.
4. **Accessibilité (WCAG 2.1 AA)** — contrastes, cibles tactiles, navigation clavier
   complète (dont modales, menus, Gantt), visibilité du focus, libellés des contrôles,
   annonces des changements d'état, respect de `prefers-reduced-motion`, absence de
   `prefers-color-scheme`. Classe chaque manquement : bloquant / gênant / confort.
5. **États** — vide, chargement, erreur, hors-ligne, permission refusée, résultat unique,
   très grand volume. Repère ceux qui manquent ou qui laissent l'utilisateur sans issue.
6. **Parcours clés** — créer une tâche, la replanifier, la terminer, importer un lot,
   consulter un rapport, corriger une erreur de saisie. Compte les clics, repère les
   allers-retours évitables et les actions irréversibles sans confirmation ni annulation.
7. **Mobile et responsive** — comportement réel aux points de rupture, zones sûres
   (`--safe-*`), navigation basse, gestes, cibles trop petites.
8. **Rédaction d'interface** — libellés, messages d'erreur, états vides, confirmations :
   français cohérent, ton homogène, pas de jargon technique exposé à l'utilisateur.
9. **Micro-interactions** — transitions, retours immédiats après action, perception de
   latence, ce qui gagnerait à être optimiste et ce qui ne le doit surtout pas.

### 6. Format du rapport attendu

Un fichier Markdown unique, en français, structuré ainsi :

1. **Synthèse (20 lignes maximum)** — l'état général en une phrase honnête, les trois
   constats qui comptent vraiment, le risque principal s'il n'est rien fait.
2. **Tableau récapitulatif** trié par priorité décroissante :

   | # | Axe | Zone | Constat | Preuve | Gravité | Effort | Gain |
   |---|---|---|---|---|---|---|---|

   - *Axe* : `Impeccable` ou `UI/UX`.
   - *Zone* : le label `zone:*` de `.github/PROCESS.md` qui correspond.
   - *Preuve* : `chemin/fichier:ligne` ou commande + sortie.
   - *Gravité* : bloquant / majeur / mineur / cosmétique.
   - *Effort* : S (< 2 h) / M (une demi-journée) / L (plusieurs jours) / XL (chantier).
   - *Gain* : ce que l'utilisateur ou le mainteneur y gagne concrètement.
3. **Fiches détaillées** pour les constats bloquants et majeurs uniquement. Chacune :
   ce qui se passe, pourquoi c'est un problème, la correction proposée, ce qu'elle risque
   de casser, comment le vérifier.
4. **Quick wins** — tout ce qui est effort S et gain net, regroupé, prêt à devenir un lot
   unique.
5. **Chantiers de fond** — les L et XL, avec pour chacun un découpage en étapes livrables
   indépendamment, parce qu'un chantier non découpé ne sera jamais commencé.
6. **Issues proposées** — pour chaque constat retenu : un titre, le label `zone:*`, un
   corps court au format du modèle `.github/ISSUE_TEMPLATE/demande.yml`. Ne crée aucune
   issue : propose-les, Quentin décide.
7. **Hors périmètre / non vérifié** — ce que tu n'as pas pu contrôler et pourquoi.
   Cette section ne doit pas être vide si des vérifications ont échoué.

### 7. Ce qui invalide l'audit

- Un constat sans preuve vérifiable.
- Un chiffre non mesuré présenté comme mesuré.
- Une recommandation qui enfreint une contrainte du §2.
- Une liste de bonnes pratiques génériques recopiées sans lien avec ce code.
- Un rapport qui conclut que tout va bien sans avoir exécuté une seule commande.

Commence par annoncer en trois lignes ton plan d'exploration, puis exécute-le.

<!-- Fin du prompt -->

---

## Variantes d'usage

- **Audit ciblé** : garder le §1, le §2, la grille concernée (§4 ou §5) et le §6, et
  remplacer le §3 par « limite-toi à *zone concernée* ».
- **Audit de suivi** : ajouter « compare avec le rapport précédent *chemin* et ne
  rapporte que les écarts : résolu, aggravé, nouveau ».
- **Audit avant lot de déploiement** : ajouter « limite-toi au diff entre `main` et la
  branche de travail » — utile pour décider si un lot mérite un déploiement facturé.
