import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const required = [
  "apps/nexora/source/index.html.part-000",
  "apps/nexora/netlify.toml",
  "apps/nexora/openapi.yaml",
  "apps/nexora/netlify/functions/nexora-create-task.ts",
  "apps/nexora-mcp/netlify.toml",
  "apps/nexora-mcp/netlify/functions/gateway.mts",
  "apps/nexora-mcp/src/nexora.mts",
  "apps/nexora-mcp/src/tools.mts",
];

for (const file of required) await readFile(path.join(root, file));

async function files(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".netlify", ".harness"].includes(entry.name)) continue;
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...await files(target));
    else output.push(target);
  }
  return output;
}

const self = path.resolve(import.meta.filename);
const textFiles = (await files(root)).filter((file) => path.resolve(file) !== self && !/\.(png|jpe?g|gif|webp|ico|zip)$/i.test(file));
const forbidden = [
  /-----BEGIN PRIVATE KEY-----/,
  /TELEGRAM_BOT_TOKEN\s*[:=]\s*["'][^"']+/,
  /FIREBASE_SERVICE_ACCOUNT_JSON\s*[:=]\s*["']\s*\{/,
  /NEXORA_ASSISTANT_API_KEY\s*[:=]\s*["'][a-f0-9]{32,}/i,
];
for (const file of textFiles) {
  const source = await readFile(file, "utf8");
  for (const pattern of forbidden) assert.doesNotMatch(source, pattern, `Secret potentiel dans ${path.relative(root, file)}`);
}

const gateway = await readFile(path.join(root, "apps/nexora-mcp/netlify/functions/gateway.mts"), "utf8");
assert.match(gateway, /https:\/\/nexora-project\.org/);
assert.match(gateway, /registerNexoraTools/);
assert.match(gateway, /Every task type must have start and end dates/);
const mcpTools = await readFile(path.join(root, "apps/nexora-mcp/src/tools.mts"), "utf8");
assert.match(mcpTools, /add\('get_health'/);
assert.match(mcpTools, /add\('list_projects'/);
assert.match(mcpTools, /add\('create_task'/);
assert.match(mcpTools, /add\('add_attachment'/);
assert.match(mcpTools, /Dates obligatoires pour tous les types/);

const sourceParts = (await readdir(path.join(root, "apps/nexora/source")))
  .filter((name) => name.startsWith("index.html.part-"))
  .sort();
const sourceBytes = Buffer.concat(await Promise.all(sourceParts.map((name) => readFile(path.join(root, "apps/nexora/source", name)))));
const builtBytes = await readFile(path.join(root, "apps/nexora/dist/index.html"));
assert.deepEqual(builtBytes, sourceBytes, "Le build doit reconstruire exactement index.html");
const builtSource = builtBytes.toString("utf8");
assert.match(builtSource, /lp-drive-panel/);
assert.match(builtSource, /params\.get\("driveUrl"\)/);
// La liaison Nexora → Todoist est supprimée. Le seul flux conservé —
// Todoist → Nexora par l'étiquette `nexora` — vit HORS de l'application :
// l'interface ne doit donc plus appeler l'API Todoist, ni stocker de token,
// ni écrire de champ de liaison sur une tâche.
assert.doesNotMatch(builtSource, /api\.todoist\.com/);
assert.doesNotMatch(builtSource, /nexora:todoistPersonalToken/);
assert.doesNotMatch(builtSource, /nexora-mobile/);
assert.doesNotMatch(builtSource, /todoistTaskId/);
// `todoistCompletedAt` reste LU, jamais écrit : les tâches terminées à l'époque
// par cette synchronisation gardent leur vraie date de complétion.
assert.match(builtSource, /task\.todoistCompletedAt/);
assert.doesNotMatch(builtSource, /TELEGRAM_BOT_TOKEN/);
// Annotations du Gantt : le bloc de logique pure doit rester extractible par
// les tests unitaires, et les annotations rester attachées à la configuration
// du widget plutôt qu'aux tâches.
assert.match(builtSource, /\/\/ === NEXORA:GANTT-ANNOTATIONS:START ===/);
assert.match(builtSource, /\/\/ === NEXORA:GANTT-ANNOTATIONS:END ===/);
assert.match(builtSource, /ganttAnnotations: next/);
assert.match(builtSource, /className="lp-gantt-tblock"/);
assert.match(builtSource, /className="lp-gantt-frame"/);
assert.match(builtSource, /className="lp-widget-minigantt-tblock"/);
assert.match(builtSource, /className="lp-widget-minigantt-frame"/);
// Vue Métro : les mêmes annotations y sont dessinées, sur un plan de lignes.
assert.match(builtSource, /className="lp-pm-tblock"/);
assert.match(builtSource, /className="lp-pm-frame"/);
assert.match(builtSource, /lp-pm-strip-item is-/);
assert.match(builtSource, /lp-pm-risk is-/);
// Réglages : chaque onglet déclaré doit avoir un volet rendu. Un onglet listé
// dans la barre latérale mais sans branche `activeTab === "…"` s'ouvre sur un
// panneau VIDE, sans la moindre erreur — c'est exactement ce qui est arrivé en
// supprimant l'onglet Todoist : la coupure a emporté les cinq volets voisins.
{
  const tabsBlock = builtSource.slice(builtSource.indexOf("const SETTINGS_TABS = ["));
  const declared = [...tabsBlock.slice(0, tabsBlock.indexOf("];")).matchAll(/\{ key: "(\w+)"/g)].map((m) => m[1]);
  assert.ok(declared.length >= 10, `SETTINGS_TABS introuvable ou tronqué (${declared.length} onglets)`);
  const rendered = new Set([...builtSource.matchAll(/activeTab === "(\w+)"/g)].map((m) => m[1]));
  const orphans = declared.filter((key) => !rendered.has(key));
  assert.deepEqual(orphans, [], `Onglets de Réglages sans volet rendu : ${orphans.join(", ")}`);
}

// Criticité (issue #35). « Urgent » était un statut ; c'est devenu une dimension à
// part, et le statut a été supprimé. Trois choses peuvent se défaire sans que rien
// ne casse visiblement — d'où ces gardes.
{
  assert.match(builtSource, /=== NEXORA:CRITICALITY:START ===/, "bloc Criticité absent");
  assert.match(builtSource, /=== NEXORA:CRITICALITY:END ===/, "sentinelle de fin du bloc Criticité absente");

  // 1. L'urgence doit se lire sur la criticité. Si isTaskUrgent repartait du NOM du
  //    statut, le statut « Urgent » n'existant plus, le filtre « urgentes », les
  //    liserés rouges, les barres du Gantt, les bulles de la vue Métro, le bloc
  //    « Tâches urgentes » d'Aujourd'hui, le poids du treemap et trois métriques de
  //    widgets se videraient tous en silence, sans une seule erreur.
  const urgentFn = builtSource.slice(builtSource.indexOf("function isTaskUrgent"));
  assert.match(urgentFn.slice(0, 400), /task\?\.criticality/, "isTaskUrgent ne lit plus la criticité");

  // 2. Le champ doit rester branché sur le registre unique et sur les surfaces qui
  //    ne s'en déduisent pas. Retirer une seule de ces lignes ne casse rien : la
  //    criticité disparaît simplement de cette vue-là.
  assert.match(builtSource, /key: "criticality", label: "Criticité"/, "criticality absent de FIELD_DEFS");
  assert.match(builtSource, /ADVANCED_FILTER_FIELDS = \[[^\]]*"criticality"/, "criticality absent des filtres avancés");
  assert.match(builtSource, /WIDGET_GROUPBY_FIELDS = \[[^\]]*"criticality"/, "criticality absent du groupement");
  assert.match(builtSource, /MINIGANTT_ROW_FIELD_OPTIONS = \[[^\]]*"criticality"/, "criticality absent des champs de ligne du Mini-Gantt");
  // Deux capsules distinctes, l'une en lecture (FieldValue) et l'autre éditable
  // (InlineEditableField) : chercher le motif une seule fois laisserait passer la
  // suppression de l'une des deux. Garde éprouvé en supprimant chacune.
  const capsules = [...builtSource.matchAll(/fieldKey === "criticality"/g)].length;
  assert.equal(capsules, 2, `capsules de criticité : ${capsules} trouvée(s), 2 attendues (lecture et édition)`);

  // 2 bis. Cinq listes énumèrent les champs À LA MAIN, sans passer par FIELD_DEFS.
  //    Le premier lot les avait manquées : le champ apparaissait dans les filtres
  //    avancés mais sans aucune valeur proposée, et le formulaire de tâche n'avait
  //    pas de champ du tout — la criticité était donc impossible à renseigner.
  assert.match(builtSource, /field === "criticality"\) return CRITICALITIES/, "valeurs des filtres avancés non branchées");
  assert.match(builtSource, /field === "criticality"\) return task\.criticality/, "valeur lue pour évaluer une condition non branchée");
  assert.match(builtSource, /GANTT_COL_OPTIONS = \[[^\]]*key: "criticality"/, "criticality absent des colonnes du Gantt");
  assert.match(builtSource, /colKey === "criticality"/, "colonne de criticité déclarée mais sans rendu");
  assert.match(builtSource, /BUBBLE_FIELD_OPTIONS = \[[^\]]*"criticality"/, "criticality absent des bulles du Gantt");
  // Le formulaire doit à la fois proposer le champ ET l'enregistrer : l'un sans
  // l'autre donne une case qui s'affiche et n'est jamais retenue.
  assert.match(builtSource, /setCriticality\(e\.target\.value\)/, "champ Criticité absent du formulaire de tâche");
  assert.match(builtSource, /criticality: criticality \|\| null/, "la criticité saisie n'est pas enregistrée");

  // 3. Aucun statut nommé « Urgent » ne doit revenir par le jeu de démonstration :
  //    il serait recréé chez tout nouvel utilisateur, et la reprise le supprimerait
  //    en boucle à chaque chargement.
  const seed = builtSource.slice(builtSource.indexOf("const seedStatuses"), builtSource.indexOf("const seedStatuses") + 900);
  assert.doesNotMatch(seed, /name: "Urgent"/, "le jeu de démonstration recrée un statut Urgent");
}

// Mini-Gantt : aucun hook après le retour « aucune tâche ». React compte les hooks à
// chaque rendu ; un hook situé après un retour conditionnel s'exécute quand le widget
// a des tâches et pas quand il n'en a plus. Passer d'un état à l'autre — n'importe
// quel filtre qui ne ramène rien — casse alors le composant sur l'erreur React #310,
// au lieu d'afficher l'état vide. Le défaut ne se voit ni à la lecture ni au build.
{
  const from = builtSource.indexOf("function WidgetMiniGantt");
  assert.ok(from !== -1, "WidgetMiniGantt introuvable");
  const open = builtSource.indexOf("}) {", from) + 3;
  let depth = 0, end = open;
  for (let i = open; i < builtSource.length; i++) {
    const c = builtSource[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { end = i; break; }
  }
  const body = builtSource.slice(from, end);
  // Le retour de NIVEAU COMPOSANT, reconnaissable à ses deux espaces d'indentation et
  // au JSX qu'il rend. Plusieurs hooks contiennent aussi un « if (isEmpty) return [] »
  // dans leur callback : les confondre ferait passer le garde pour concluant alors
  // qu'il mesurerait tout autre chose.
  const guardAt = body.indexOf("\n  if (isEmpty) return <div");
  assert.ok(guardAt !== -1, "le retour « aucune tâche » du Mini-Gantt a disparu");
  // Hooks de NIVEAU COMPOSANT uniquement : deux espaces d'indentation. Ceux imbriqués
  // dans un callback s'exécutent de toute façon à chaque rendu.
  const after = [...body.slice(guardAt).matchAll(/\n  const [\w[\], ]+ = use[A-Z]\w*\(/g)].map((m) => m[0].trim());
  assert.deepEqual(after, [], `hook(s) après le retour « aucune tâche » du Mini-Gantt : ${after.join(" | ")}`);
}

// Conflit de synchronisation (409). Trois défauts distincts, tous invisibles à la
// lecture comme au build : ils ne se manifestent qu'avec deux appareils, ou au
// rechargement.
{
  assert.match(builtSource, /=== NEXORA:SYNCMERGE:START ===/, "bloc de fusion absent");
  assert.match(builtSource, /=== NEXORA:SYNCMERGE:END ===/, "sentinelle de fin du bloc de fusion absente");

  // 1. Une clé absente du registre n'est pas fusionnée : elle est BLOQUÉE, et plus
  //    rien ne s'enregistre dessus jusqu'au rechargement de l'onglet.
  //    nexora:dashboards porte les tableaux de bord et leurs widgets — c'est elle
  //    qu'écrit la modification d'un filtre de Mini-Gantt.
  const registry = builtSource.slice(
    builtSource.indexOf("const NEXORA_MERGEABLE_KEYS"),
    builtSource.indexOf("const NEXORA_MERGE_ID_GETTERS"),
  );
  assert.ok(registry.length > 0, "registre des clés fusionnables introuvable");
  for (const key of ["nexora:dashboards", "nexora:dashboardFolders", "nexora:views", "nexora:taskTypes"]) {
    assert.ok(registry.includes(`"${key}"`), `${key} absente du registre des clés fusionnables`);
  }

  // 2. Toute clé LUE au démarrage doit être ÉCRITE quelque part. nexora:taskTypes
  //    était lue, sauvegardée, surveillée pour les changements distants — et jamais
  //    enregistrée : cinq points la modifiaient, aucun n'atteignait Firebase. Rien
  //    ne le signalait, la clé se rechargeait simplement telle qu'elle était avant.
  const persisted = new Set([...builtSource.matchAll(/persistKey\("([^"]+)"/g)].map((m) => m[1]));
  const read = new Set([
    ...[...builtSource.matchAll(/storageGetWithTimeout\("([^"]+)"/g)].map((m) => m[1]),
    ...[...builtSource.matchAll(/\["\w+", "(nexora:[^"]+)", set/g)].map((m) => m[1]),
  ]);
  // Deux exceptions légitimes : un ancien format lu pour migrer, et un index écrit
  // directement par window.storage.set en dehors du cycle React.
  const readOnlyByDesign = new Set(["nexora:dashboardWidgets", "nexora:snapshotIndex"]);
  const neverWritten = [...read].filter((k) => !persisted.has(k) && !readOnlyByDesign.has(k)).sort();
  assert.deepEqual(neverWritten, [], `clé(s) lues au démarrage et jamais enregistrées : ${neverWritten.join(", ")}`);

  // 3. L'horodatage doit être posé par le setter, pas par les points d'écriture :
  //    les tableaux de bord en comptent dix-neuf et aucun n'y penserait. Sans
  //    horodatage la fusion ne peut pas départager deux sessions ayant touché la
  //    même entité : elle garde la version distante et la modification locale est
  //    perdue avec un simple avis.
  assert.match(builtSource, /const stampChangedEntities = \(prev, next\) =>/, "fonction d'horodatage absente");
  for (const [setter, raw] of [["setDashboards", "setDashboardsRaw"], ["setSavedViews", "setSavedViewsRaw"]]) {
    assert.ok(
      builtSource.includes(`const ${setter} = (updater) =>`)
        && builtSource.includes(`${raw}((prev) => stampChangedEntities(prev, typeof updater === "function" ? updater(prev) : updater))`),
      `${setter} ne passe pas par l'horodatage`,
    );
    // Le setter brut ne doit apparaître QUE deux fois : sa déclaration useState et
    // son enveloppe. Une troisième occurrence est une écriture qui contourne
    // l'horodatage — silencieuse, et invisible tant qu'on ne travaille pas à deux
    // ordinateurs.
    const rawUses = builtSource.split(raw).length - 1;
    assert.equal(rawUses, 2, `${raw} apparaît ${rawUses} fois (2 attendues : la déclaration et l'enveloppe)`);
  }

  // 4. refreshRevision est appelé APRÈS un conflit, pour resynchroniser la révision
  //    connue avant de réécrire. S'il renvoie null sans mettre cette révision à jour,
  //    la réécriture repart avec une révision périmée et Firebase la refuse une
  //    seconde fois — ce second 409 n'est plus rattrapé et la clé reste bloquée
  //    jusqu'au rechargement. Le défaut existait dans les DEUX adaptateurs : les
  //    compter est le seul moyen de ne pas croire l'invariant tenu parce qu'un seul
  //    l'applique.
  /* 5. Bandeau rouge au rechargement (retour de test sur le point 3).
     Deux verrous, tous deux invisibles à la lecture : ils ne se manifestent
     qu'au rechargement, et seulement quand une écriture keepalive est partie
     juste avant. */
  assert.match(builtSource, /const isRedundantWrite = \(knownRaw, serializedValue\) =>/,
    "Le contrôle d'écriture inutile a disparu : chaque démarrage refait tourner la révision pour rien.");
  assert.match(builtSource, /if \(isRedundantWrite\(window\.storage\?\.getKnownValue\?\.\(key\), serializedValue\)\)/,
    "persistKey ne compare plus ce qu'il s'apprête à écrire à ce que Firebase a confirmé.");
  assert.match(builtSource, /const resolution = syncConflictResolution\(\{/,
    "attemptPersist ne passe plus par la décision de conflit : un scalaire redeviendrait bloquant.");
  /* La décision doit être PRISE en un seul endroit. Réintroduire la comparaison
     à la main dans attemptPersist ferait diverger le code déployé des tests. */
  const tentative = builtSource.slice(
    builtSource.indexOf("const attemptPersist = async (key, payload)"),
    builtSource.indexOf("const rescueQuotaWarnedRef"),
  );
  assert.ok(tentative.length > 0, "attemptPersist est introuvable.");
  assert.doesNotMatch(tentative, /if \(JSON\.stringify\(remoteValue\) === JSON\.stringify\(localValue\)\) \{/,
    "La comparaison de contenu est revenue à la main dans attemptPersist, hors de la décision testée.");

  const refreshers = [...builtSource.matchAll(/async refreshRevision\(key\) \{[\s\S]*?\n  \},/g)].map((m) => m[0]);
  assert.equal(refreshers.length, 2, `refreshRevision : ${refreshers.length} adaptateur(s), 2 attendus`);
  refreshers.forEach((fn, index) => {
    assert.match(
      fn,
      /Key not found[\s\S]*?__nexoraKnownRevisions\.set\(key, null\)/,
      `refreshRevision #${index + 1} ne remet pas la révision connue à zéro sur une clé absente`,
    );
  });
}

/* Rattrapage des clés d'interface et écriture garantie à la fermeture (issue #39).
   La fusion sur conflit existe déjà pour ces clés ; ce qui manquait était la
   DÉTECTION d'une modification distante, et la survie de la requête au
   déchargement de la page. Ces pièces ne se manifestent qu'à la fermeture de
   l'onglet, sur l'autre machine, le lendemain. */
{
  assert.match(builtSource, /NEXORA:INTERFACE-SYNC:START/,
    "Le rattachement des clés d'interface au rattrapage a disparu.");
  assert.match(builtSource, /NEXORA:UNLOAD-FLUSH:START/,
    "L'écriture garantie à la fermeture de l'onglet a disparu.");

  /* La ligne de définition ne porte pas les parenthèses d'appel : ce motif ne
     compte QUE les appels. Trois attendus — écoutes, contrôle de fraîcheur,
     adoption d'une valeur distante. */
  assert.match(builtSource, /const firebaseWatchedEntries = \(\) =>/,
    "La définition de firebaseWatchedEntries a disparu.");
  const watched = (builtSource.match(/firebaseWatchedEntries\(\)/g) || []).length;
  assert.ok(watched >= 3,
    `firebaseWatchedEntries n'est plus branché sur les trois boucles de rattrapage (${watched} appel(s) sur 3 attendus).`);

  /* Le keepalive doit rester conditionné : l'appliquer sans condition
     gaspillerait le quota partagé de 64 Kio sur des lectures de premier plan. */
  assert.match(builtSource, /keepalive: nexoraPageLeaving && nexoraUseKeepalive\(nexoraBodyBytes\(requestBody\)\)/,
    "La requête de la passerelle n'est plus marquée keepalive à la fermeture de la page.");

  /* viewOrder est un ORDRE : le rendre fusionnable par identifiant le détruirait. */
  const mergeableStart = builtSource.indexOf("const NEXORA_MERGEABLE_KEYS = new Set([");
  const mergeableBlock = builtSource.slice(mergeableStart, builtSource.indexOf("]);", mergeableStart));
  assert.ok(!mergeableBlock.includes('"nexora:viewOrder"'),
    "nexora:viewOrder est devenu fusionnable : la fusion par identifiant détruirait l'ordre des vues.");
}

/* Widgets qui doivent passer par le moteur de filtres. Un widget absent de
   cette expression ignorerait son propre filtre — en silence. Testé par
   APPARTENANCE et non par voisinage : sinon, ajouter un widget entre deux
   autres casserait la garde sans qu'aucune propriété n'ait changé. */
const usesTaskFilterExpr = builtSource.slice(
  builtSource.indexOf("const usesTaskFilter = "),
  builtSource.indexOf(";", builtSource.indexOf("const usesTaskFilter = ")),
);
assert.ok(usesTaskFilterExpr.length > 100, "expression usesTaskFilter introuvable");

/* Nuage des échéances (issue #46).
   Un widget se déclare à cinq endroits indépendants. Déclaré au catalogue mais
   absent du `switch` de rendu, il s'ajoute au tableau de bord et n'affiche
   RIEN — pas une erreur, pas un message : une tuile vide. Le contrôle visuel
   ne le verrait pas non plus, puisqu'il monte le composant directement. */
{
  assert.match(builtSource, /\/\/ === NEXORA:DEADLINE-SCATTER:START ===/, "Le bloc de calcul du nuage des échéances a disparu.");
  assert.match(builtSource, /\/\/ === NEXORA:DEADLINE-SCATTER:END ===/, "La sentinelle de fin du bloc du nuage a disparu.");
  assert.match(builtSource, /key: "deadlineScatter", label: "Nuage des échéances"/,
    "Le nuage des échéances n'est plus au catalogue des widgets.");
  assert.match(builtSource, /<WidgetDeadlineScatter widget=\{w\}/,
    "Le nuage est au catalogue mais n'est plus rendu : la tuile serait vide, sans erreur.");
  assert.ok(usesTaskFilterExpr.includes('type === "deadlineScatter"'),
    "Le nuage ne passe plus par le moteur de filtres : le widget ignorerait son propre filtre.");
  assert.match(builtSource, /if \(type === "deadlineScatter"\) return \{ w: 10, h: 7 \};/,
    "Le nuage n'a plus de taille par défaut : il naîtrait écrasé sur la grille.");
  /* Le réglage doit être À LA FOIS proposé et enregistré : l'un sans l'autre
     donne une liste déroulante qui s'affiche et n'est jamais retenue. */
  assert.match(builtSource, /setScatterLaneField\(e\.target\.value\)/,
    "Le choix des couloirs a disparu de la fiche du widget.");
  assert.match(builtSource, /data\.scatterLaneField = scatterLaneField;/,
    "Le couloir choisi dans la fiche n'est plus enregistré.");
}

/* Treemap : le champ qui porte les tuiles (issue #47).
   Une tuile n'est plus forcément un projet. Trois maillons peuvent se défaire
   sans qu'aucune erreur ne se produise : le widget continue alors d'afficher
   des projets pendant que la fiche annonce des statuts. */
{
  assert.match(builtSource, /const TREEMAP_TILE_BY = \["project", "status", "taskType", "criticality"\];/,
    "La liste des champs qui peuvent porter les tuiles a changé ou disparu.");
  /* Sans ce paramètre, computeTreemapProjects retombe sur t.projectId : les
     tuiles restent des projets, en silence, quel que soit le réglage. */
  assert.match(builtSource, /bucketIdOf = \(t\) => t\.projectId,/,
    "Le rattachement d'une tâche à sa tuile n'est plus un paramètre du bloc de calcul.");
  assert.match(builtSource, /projects: tileEntities,/,
    "Le widget ne transmet plus les entités de tuile : le réglage serait sans effet.");
  assert.match(builtSource, /\bbucketIdOf,\n\s+colorMode: cfg\.colorMode,/,
    "Le widget ne transmet plus le rattachement : les tuiles resteraient des projets.");
  /* Le réglage doit être à la fois proposé et enregistré. */
  assert.match(builtSource, /onChange=\{\(e\) => setTreemapTileBy\(e\.target\.value\)\}/,
    "Le choix du champ des tuiles a disparu de la fiche du widget.");
  assert.match(builtSource, /data\.treemapTileBy = treemapTileBy;/,
    "Le champ des tuiles choisi dans la fiche n'est plus enregistré.");
  /* La priorité vient du projet DE LA TÂCHE : reprise de l'entité de la tuile,
     la criticité d'une même tâche changerait selon l'axe choisi. */
  assert.match(builtSource, /projectPriority: \(\(ctx\.projects \|\| \[\]\)\.find\(\(p\) => p\.id === t\.projectId\) \|\| \{\}\)\.priority/,
    "La priorité du projet n'est plus lue sur le projet de la tâche.");
  assert.match(builtSource, /treemapTaskCriticality\(\{ projectPriority: project\.priority \|\| "normal", \.\.\.facts \}\)/,
    "Les faits de la tâche ne priment plus sur la priorité de l'entité de tuile.");
}

/* Nuage des échéances : fenêtre d'affichage (issue #50).
   La fenêtre décide de la MISE EN PAGE, jamais du périmètre. Si le rabattement
   ou le comptage se défait, elle devient un filtre silencieux : des tâches
   disparaissent du widget sans qu'aucune erreur ne se produise. */
{
  assert.match(builtSource, /const SCATTER_WINDOW_MODES = \["auto", "fixed"\];/,
    "Les modes de fenêtre du nuage ont changé ou disparu.");
  /* Sans le rabattement, un point hors fenêtre sort du dessin : invisible,
     mais toujours compté — le widget mentirait dans les deux sens. */
  assert.match(builtSource, /const borne = Math\.max\(domain\.min, Math\.min\(domain\.max, days\)\);/,
    "La position en X n'est plus bornée : un point hors fenêtre sortirait du dessin.");
  assert.match(builtSource, /beyond: scatterClampDays\(pt\.days, domain\)\.beyond/,
    "Les points hors fenêtre ne sont plus marqués : rien ne les distinguerait d'une tâche à cette date.");
  assert.match(builtSource, /className="lp-widget-scatter-overflow"/,
    "Le compteur « au-delà » a disparu : la fenêtre deviendrait un filtre silencieux.");
  /* Le réglage doit être à la fois proposé et enregistré. */
  assert.match(builtSource, /onClick=\{\(\) => setScatterWindowMode\("fixed"\)\}/,
    "Le choix de la plage a disparu de la fiche du widget.");
  assert.match(builtSource, /data\.scatterWindowMode = scatterWindowMode;/,
    "Le mode de fenêtre choisi dans la fiche n'est plus enregistré.");
  assert.match(builtSource, /data\.scatterWindowBefore = Number\(scatterWindowBefore\);/,
    "Les bornes de la fenêtre ne sont plus enregistrées.");
}

/* Heat map croisée (issue #51).
   Un widget se déclare à cinq endroits indépendants ; déclaré au catalogue mais
   absent du `switch` de rendu, il s'ajoute au tableau de bord et n'affiche rien.
   S'y ajoute ici un piège propre à ce widget : ses classes CSS ont failli
   entrer en collision avec celles de la VUE « Heat map » (calendrier), qui pose
   display:flex sur .lp-widget-heatmap-cell — un <td> ainsi sorti de la mise en
   page de tableau empile les cases au lieu de les aligner. D'où un préfixe
   distinct, qui doit le rester. */
{
  assert.match(builtSource, /\/\/ === NEXORA:HEATMAP-GRID:START ===/, "Le bloc de calcul de la heat map a disparu.");
  assert.match(builtSource, /\/\/ === NEXORA:HEATMAP-GRID:END ===/, "La sentinelle de fin du bloc de la heat map a disparu.");
  assert.match(builtSource, /key: "heatmapGrid", label: "Heat map croisée"/,
    "La heat map croisée n'est plus au catalogue des widgets.");
  assert.match(builtSource, /<WidgetHeatmapGrid widget=\{w\}/,
    "La heat map est au catalogue mais n'est plus rendue : la tuile serait vide, sans erreur.");
  assert.ok(usesTaskFilterExpr.includes('type === "heatmapGrid"'),
    "La heat map ne passe plus par le moteur de filtres : le widget ignorerait son propre filtre.");
  assert.match(builtSource, /if \(type === "heatmapGrid"\) return \{ w: 9, h: 7 \};/,
    "La heat map n'a plus de taille par défaut.");
  /* Les réglages doivent être à la fois proposés et enregistrés. */
  assert.match(builtSource, /onChange=\{\(e\) => setHeatmapRowField\(e\.target\.value\)\}/,
    "Le choix de l'axe des lignes a disparu de la fiche.");
  assert.match(builtSource, /onChange=\{\(e\) => setHeatmapColField\(e\.target\.value\)\}/,
    "Le choix de l'axe des colonnes a disparu de la fiche.");
  assert.match(builtSource, /data\.heatmapRowField = heatmapRowField;/, "L'axe des lignes n'est plus enregistré.");
  assert.match(builtSource, /data\.heatmapColField = heatmapColField;/, "L'axe des colonnes n'est plus enregistré.");
  assert.match(builtSource, /data\.heatmapMetric = heatmapMetric;/, "La mesure choisie n'est plus enregistrée.");
  /* Aucune classe du nouveau widget ne doit retomber dans l'espace de noms de
     la vue « Heat map » : c'est ce qui empilait les cases. */
  const grille = builtSource.slice(
    builtSource.indexOf("function WidgetHeatmapGrid"),
    builtSource.indexOf("function WidgetDeadlineScatter"),
  );
  assert.ok(grille.length > 0, "WidgetHeatmapGrid introuvable");
  assert.doesNotMatch(grille, /lp-widget-heatmap-/,
    "La heat map croisée réutilise les classes de la vue « Heat map » : ses cases seraient empilées, sans erreur.");
  assert.match(grille, /lp-widget-hmgrid-cell/, "Les classes propres à la heat map croisée ont disparu.");
  /* CRITICALITIES est déclaré du plus bas au plus haut. Repris tel quel, l'axe
     mettrait « Bas » en tête, là où l'œil doit tomber sur « Urgent ». */
  assert.match(grille, /heatmapOrderCriticalities\(CRITICALITIES\)/,
    "L'axe des criticités ne suit plus l'ordre d'urgence : « Bas » se retrouverait en tête.");

  /* Deux volets (issue #51). Le volet de droite tient à trois pièces
     indépendantes, dont deux sans effet visible si elles se défont : la
     sélection relue dans la grille COURANTE, et l'état déclaré avant le retour
     anticipé. */
  assert.match(grille, /className="lp-widget-hmgrid-tasklist"/,
    "Le volet des tâches de la heat map croisée a disparu.");
  assert.match(grille, /className="lp-widget-hmgrid-resize"/,
    "La poignée de partage entre la grille et la liste a disparu.");
  /* Mémoriser la case retenue plutôt que de la relire laisserait une liste
     périmée à l'écran après un changement d'axe ou de filtre. */
  assert.match(grille, /const cell = grid\.cells\.get\(heatmapCellKey\(selected\.rowId, selected\.colId\)\);/,
    "La case retenue n'est plus relue dans la grille courante : la liste survivrait à un changement d'axe.");
  /* Même piège que le Mini-Gantt (erreur React #310) : un hook déclaré après le
     retour « aucune tâche à croiser » ne s'exécute pas dans cet état, et le
     widget casse au premier filtre qui ne ramène rien. */
  const retourVide = grille.indexOf("if (!lignes.length || !colonnes.length)");
  assert.ok(retourVide !== -1, "Le retour « aucune tâche à croiser » de la heat map a disparu.");
  const apres = [...grille.slice(retourVide).matchAll(/\n  const [\w[\], ]+ = use[A-Z]\w*\(/g)].map((m) => m[0].trim());
  assert.deepEqual(apres, [], `hook(s) après le retour « aucune tâche à croiser » : ${apres.join(" | ")}`);
  /* Le clic retient la case ; il n'ouvre plus la tâche d'autorité, ce qui
     poserait une fiche par-dessus la liste qu'on vient de demander. */
  assert.doesNotMatch(grille, /if \(cellule\.tasks\.length === 1 && onOpen\) onOpen/,
    "Le clic sur une case ouvre de nouveau la tâche d'autorité, par-dessus le volet de droite.");
}

/* Encadré posé par la coche du Mini-Gantt (issue #48, retour de test).
   Trois pièces du RENDU, qu'aucun test unitaire ne peut voir : la logique pure
   pose bien l'icône et le logo, mais c'est le JSX qui décide s'ils s'affichent.
   Le premier lot en a fait l'expérience : l'étiquette portant l'icône n'était
   rendue que « si le libellé existe » — or un encadré de coche n'en a pas, et
   l'icône demandée n'est jamais apparue. */
{
  const layer = builtSource.slice(
    builtSource.indexOf('className="lp-widget-minigantt-annot-layer"'),
    builtSource.indexOf("const annotationModal"),
  );
  assert.ok(layer.length > 0, "Le calque d'annotations du Mini-Gantt est introuvable.");
  assert.match(layer, /\{\(seg\.frame\.label \|\| seg\.frame\.iconUrl\) && \(/,
    "L'icône de l'encadré n'est affichée que s'il porte un libellé : un encadré de coche n'en a pas, l'icône disparaîtrait.");
  assert.match(layer, /className="lp-widget-minigantt-frame-corner"/,
    "Le logo du coin haut droit de l'encadré a disparu du rendu.");
  /* L'écart à la barre doit être appliqué AU RENDU : la constante peut très
     bien exister et n'être utilisée nulle part. */
  assert.match(layer, /const inset = seg\.padding \+ MINIGANTT_FRAME_SIDE_MARGIN;/,
    "Le cadre ne s'écarte plus de la barre : le trait la recoupe.");
  assert.match(layer, /Math\.max\(MINIGANTT_FRAME_MIN_WIDTH_PCT,/,
    "Le cadre peut redevenir plus étroit que la barre d'une tâche d'un seul jour.");
  assert.match(builtSource, /\.lp-widget-minigantt-frame-corner\{[^}]*translateX\(-100%\)/,
    "Le logo de coin n'est plus accroché au bord droit du cadre : il déborderait hors de l'encadré.");
}

/* Bandeau de paramètres du widget (issue #56).
   La panne ne venait pas du bandeau mais de ce qui défilait dessous : les
   en-têtes collants du planning se calent sur la barre d'onglets de la PAGE,
   qui n'existe pas dans un widget. Le repli de la mesure — 48 px + 34 px —
   s'appliquait alors, et le planning défilait à découvert dans cette bande. */
{
  const metroFrom = builtSource.indexOf("const pmChromeRef = useRef(null);");
  /* Recherche VERS L'AVANT : « const zoomKey = prefs.zoomKey » apparaît plus
     haut dans le fichier, dans une autre vue. Repartir du début rendrait la
     tranche vide, et tous les contrôles qui suivent passeraient à vide. */
  const metro = metroFrom === -1 ? "" : builtSource.slice(metroFrom, builtSource.indexOf("const zoomKey = prefs.zoomKey", metroFrom));
  assert.ok(metro.length > 0, "La mesure des en-têtes collants du planning est introuvable.");
  assert.doesNotMatch(metro, /if \(embedded\) return undefined;/,
    "Embarqué, le planning ne cale plus ses en-têtes collants : le repli de 82 px rouvre la bande sous le bandeau.");
  assert.match(metro, /node\.style\.setProperty\("--pm-tabbar-h", `\$\{-padTop\}px`\)/,
    "L'écart au bandeau ne compense plus le remplissage de la zone défilante.");
  /* Le fond et le plan vont ENSEMBLE : un z-index sur un élément non positionné
     ne s'applique pas, et un plan sans fond laisse voir au travers. */
  /* Ancrage sur la DÉCLARATION, pas sur le seul sélecteur : « .lp-widget-head{ »
     apparaît aussi plus haut, dans une règle de glisser tactile. Partir de
     celle-là donnait une tranche de 700 000 caractères où tout se trouve — le
     garde passait au vert en mesurant n'importe quoi. Éprouvé en retirant la
     règle : sans cet ancrage, rien ne tombait. */
  const headFrom = builtSource.indexOf(".lp-widget-head{ display:flex");
  const head = headFrom === -1 ? "" : builtSource.slice(headFrom, builtSource.indexOf("}", headFrom));
  assert.ok(head.length > 0, "La règle du bandeau de paramètres est introuvable.");
  assert.match(head, /background:var\(--surface\)/, "Le bandeau de paramètres n'a plus de fond opaque.");
  assert.match(head, /position:relative/, "Le bandeau n'est plus positionné : son z-index serait sans effet.");
  assert.match(head, /z-index:\d+/, "Le bandeau n'a plus de plan propre : le contenu positionné passe par-dessus.");
}

/* Place des infobulles des heat maps (issue #54).
   Deux pièces, chacune invisible à la lecture : le portail, sans lequel un
   ancêtre porteur d'un transform devient la référence de position:fixed et
   décale l'infobulle de toute sa position ; et le calcul de place, sans lequel
   elle sort du cadre près d'un bord. */
{
  assert.match(builtSource, /\/\/ === NEXORA:TOOLTIP-ANCHOR:START ===/, "Le bloc de placement des infobulles a disparu.");
  assert.match(builtSource, /\/\/ === NEXORA:TOOLTIP-ANCHOR:END ===/, "La sentinelle de fin du bloc de placement a disparu.");
  const mensuelle = builtSource.slice(
    builtSource.indexOf("function HeatmapDayTooltip"),
    builtSource.indexOf("function WidgetHeatmapMonth"),
  );
  assert.ok(mensuelle.length > 0, "L'infobulle de la heat map mensuelle est introuvable.");
  assert.match(mensuelle, /tooltipAnchor\(\{/, "L'infobulle mensuelle ne passe plus par le calcul de place : elle sortira du cadre près d'un bord.");
  assert.match(mensuelle, /createPortal\(/, "L'infobulle mensuelle n'est plus portée à la racine : un ancêtre transformé la décalerait.");
  assert.match(mensuelle, /document\.body,/, "Le portail de l'infobulle mensuelle ne vise plus document.body.");

  const hmFrom = builtSource.indexOf('className="lp-widget-hmgrid-tip"');
  const croisee = hmFrom === -1 ? "" : builtSource.slice(hmFrom - 600, hmFrom + 900);
  assert.ok(croisee.length > 0, "L'infobulle de la heat map croisée est introuvable.");
  assert.match(croisee, /createPortal\(/, "L'infobulle croisée n'est plus portée à la racine du document.");
  assert.match(croisee, /tooltipAnchor\(\{/, "L'infobulle croisée ne passe plus par le calcul de place.");
  /* Le rabattement maison d'origine ne traitait QUE le bord droit : le
     réintroduire ferait ressortir l'infobulle par le bas. */
  assert.doesNotMatch(croisee, /Math\.min\(hover\.x \+ 14/,
    "Le rabattement maison de l'infobulle croisée est de retour : il ignore le bord bas.");
}

console.log("Repository invariants: OK");
