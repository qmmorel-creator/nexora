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

// Le contrat public existe en DEUX exemplaires : `apps/nexora/openapi.yaml`, qui fait
// référence dans le dépôt, et `apps/nexora/public/openapi.yaml`, seul copié vers `dist`
// par le build (`scripts/build.mjs`) et donc seul réellement PUBLIÉ. Modifier le premier
// sans le second ne casse rien, ne se voit pas à la relecture, et laisse en ligne un
// contrat périmé : les clients continuent de lire l'ancien.
{
  const [reference, publie] = await Promise.all([
    readFile(path.join(root, "apps/nexora/openapi.yaml"), "utf8"),
    readFile(path.join(root, "apps/nexora/public/openapi.yaml"), "utf8"),
  ]);
  assert.equal(publie, reference,
    "apps/nexora/openapi.yaml et apps/nexora/public/openapi.yaml ont divergé : " +
    "c'est le second qui est publié. Recopier l'un sur l'autre.");
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

  /* Issue #40. Le site déployé passe par nexoraServerStorage, pas par
     l'adaptateur Firestore direct : c'est là que le garde-fou de lecture doit
     exister, et c'est là qu'il manquait. Sans lui, une lecture ratée ne laisse
     aucune trace, l'écriture suivante part sans révision, le serveur la refuse,
     et une préférence non fusionnable finit en « donnée en attente de
     synchronisation » sans qu'aucune autre session soit en cause. */
  assert.match(builtSource, /NEXORA:GATEWAY-READ-GUARD:START/,
    "Le garde-fou de lecture de la passerelle a disparu.");
  assert.match(builtSource, /NEXORA:GATEWAY-READ-GUARD:END/,
    "La sentinelle de fin du garde-fou de la passerelle a disparu.");
  {
    const start = builtSource.indexOf("NEXORA:GATEWAY-READ-GUARD:START");
    const end = builtSource.indexOf("NEXORA:GATEWAY-READ-GUARD:END", start);
    const bloc = builtSource.slice(start, end);
    assert.match(bloc, /__nexoraReadErrors\.set\(key, message\)/,
      "La passerelle ne note plus les lectures ratées.");
    assert.match(bloc, /err\.code = "NEXORA_READ_UNSAFE"/,
      "La passerelle n'oppose plus NEXORA_READ_UNSAFE à une clé dont la lecture a échoué.");
  }

  /* Le bandeau doit nommer la cause. Les annoncer toutes comme un conflit entre
     deux ordinateurs a fait chercher une seconde session inexistante pendant
     trois allers-retours. */
  assert.match(builtSource, /const blockedKeysReason = /,
    "Le bandeau de synchronisation ne distingue plus ses trois causes.");

  /* Issue #48. L'encadré posé par la coche n'a PAS d'étiquette : son icône ne
     s'affiche que parce que la condition de rendu accepte aussi iconUrl. Rétablir
     `seg.frame.label &&` seul rendrait le cadre nu, sans la moindre erreur. */
  assert.match(builtSource, /\(seg\.frame\.label \|\| seg\.frame\.iconUrl\)/,
    "L'encadré sans étiquette ne rendrait plus son icône.");
  assert.match(builtSource, /const GANTT_FRAME_BAR_CLEARANCE = /,
    "Le dégagement entre le cadre et la barre a disparu.");

  /* Issue #56. Le bandeau de paramètres était transparent et sans plan de
     superposition : le contenu se voyait au travers. Les trois pièces tiennent
     ensemble — un fond opaque sans z-index, ou un z-index sans isolation du
     corps, laisse repasser une infobulle ou une étiquette d'annotation. */
  assert.match(builtSource, /=== NEXORA:WIDGET-HEAD-PIN:START ===/,
    "Le bloc d'épinglage du bandeau de widget a disparu.");
  {
    const start = builtSource.indexOf("=== NEXORA:WIDGET-HEAD-PIN:START ===");
    const end = builtSource.indexOf("=== NEXORA:WIDGET-HEAD-PIN:END ===", start);
    assert.ok(end > start, "La sentinelle de fin de l'épinglage du bandeau a disparu.");
    const bloc = builtSource.slice(start, end);
    assert.match(bloc, /\.lp-widget-head\{[^}]*background:var\(--surface\)/,
      "Le bandeau de widget est redevenu transparent.");
    assert.match(bloc, /\.lp-widget-head\{[^}]*z-index:2/,
      "Le bandeau de widget n'est plus peint au-dessus du corps.");
    assert.match(bloc, /\.lp-widget-body\{[^}]*isolation:isolate/,
      "Le corps du widget ne s'isole plus : un descendant peut repasser au-dessus du bandeau.");
  }

  /* Issue #54. Les infobulles des widgets étaient posées à même le corps du
     widget en position:fixed. Deux pièges : position:fixed cesse de valoir par
     rapport à la fenêtre dès qu'un ancêtre établit un bloc conteneur, et le
     débordement n'était borné qu'à droite, sur une largeur devinée. Depuis #56
     le corps du widget s'isole, ce qui les enfermerait en plus dans son plan.
     Le portail vers document.body règle les trois d'un coup. */
  assert.match(builtSource, /=== NEXORA:POINTER-TOOLTIP:START ===/,
    "L'infobulle de survol commune aux widgets a disparu.");
  {
    const start = builtSource.indexOf("=== NEXORA:POINTER-TOOLTIP:START ===");
    const end = builtSource.indexOf("=== NEXORA:POINTER-TOOLTIP:END ===", start);
    const bloc = builtSource.slice(start, end);
    assert.match(bloc, /createPortal\(/,
      "L'infobulle des widgets n'est plus sortie dans un portail : elle se décalera de nouveau.");
    assert.match(bloc, /getBoundingClientRect\(\)/,
      "L'infobulle des widgets ne mesure plus sa boîte : son rabat redevient une devinette.");
  }

  /* Le motif d'origine — placement direct au curseur, sans mesure ni rabat —
     reposé ailleurs ramènerait le défaut sans bruit. L'infobulle du Mini-Gantt
     garde son position:fixed : elle calcule ses coordonnées et se rend déjà
     dans un portail, c'est le modèle dont le reste s'inspire. */
  {
    const restants = (builtSource.match(/style=\{\{ position: "fixed", left: [^,]+ \+ 12, top: [^ ]+ \+ 12 \}\}/g) || []).length;
    assert.equal(restants, 0,
      `${restants} infobulle(s) de widget encore posée(s) au curseur sans rabat ni portail.`);
  }

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

  /* Couloirs teintés et sous-grille (issue #53). Sans la teinte, on ne retrouve
     sa ligne qu'en relisant les libellés ; sans la sous-grille, un point entre
     deux repères se lit « quelque part au milieu ». */
  assert.match(builtSource, /fillOpacity=\{SCATTER_LANE_TINT\}/,
    "Les couloirs ne portent plus la couleur de leur entité.");
  assert.match(builtSource, /className="lp-widget-scatter-subaxis"/,
    "La sous-grille intermédiaire du nuage a disparu.");
  assert.match(builtSource, /ticks\.minor\.map/,
    "La sous-grille n'est plus dessinée à partir des graduations calculées.");

  /* Moteur d'étiquettes (issue #53). Trois maillons qui se défont sans erreur :
     le widget cesse de demander un placement, ou dessine le rappel autrement,
     ou reprend la couleur d'alerte à la place de celle du groupe. */
  assert.match(builtSource, /const labels = scatterPlaceLabels\(/,
    "Le widget ne demande plus de placement : les étiquettes disparaîtraient.");
  assert.match(builtSource, /className="lp-widget-scatter-leader"/,
    "Le trait de rappel des étiquettes déportées a disparu.");
  /* La couleur d'un point est celle de son GROUPE, en retard comme à venir : le
     rouge d'alerte effaçait l'agrégation sur toute la moitié gauche du nuage.
     Le retard se signale au contour. */
  const nuage = builtSource.slice(
    builtSource.indexOf("function WidgetDeadlineScatter"),
    builtSource.indexOf("function WidgetProjectPulse"),
  );
  assert.ok(nuage.length > 0, "WidgetDeadlineScatter introuvable");
  assert.doesNotMatch(nuage, /fill=\{pt\.days < 0 \? SCATTER_LATE_COLOR/,
    "Le retard reprend la couleur du point : l'agrégation ne se lirait plus à gauche de l'origine.");
  assert.match(nuage, /stroke=\{pt\.days < 0 \? SCATTER_LATE_COLOR/,
    "Le retard n'est plus signalé au contour : rien ne le distinguerait d'une tâche à venir.");
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
}

/* Feuille de style embarquée : pas un seul accent grave à l'intérieur.

   Les blocs `<style>{`…`}</style>` sont des littéraux gabarits JavaScript. Un
   accent grave posé DANS le CSS — y compris dans un commentaire, par exemple
   pour citer une propriété — ferme le littéral au milieu de la feuille. Babel
   part alors en erreur de syntaxe sur le fichier ENTIER et l'application reste
   sur « Chargement… », écran blanc, sans le moindre message côté serveur.

   C'est arrivé : le lot des couleurs de contraste (#59) a livré un commentaire
   citant « color: » entre accents graves, et rien ne l'a vu — ni `tsc`, ni les
   tests unitaires, qui n'analysent jamais le JSX. D'où ce garde, le seul de ce
   fichier qui protège du plantage total. */
{
  let from = builtSource.indexOf("<style>{`");
  assert.ok(from !== -1, "Aucune feuille de style embarquée : le garde ne contrôlerait rien.");
  while (from !== -1) {
    const open = from + "<style>{`".length;
    const close = builtSource.indexOf("`}</style>", open);
    assert.ok(close !== -1, "Feuille de style embarquée non refermée.");
    const inner = builtSource.slice(open, close);
    const faute = inner.indexOf("`");
    assert.equal(faute, -1,
      "Accent grave dans une feuille de style embarquée — il referme le littéral gabarit et l'interface entière cesse de se charger. " +
      `Extrait : « ${inner.slice(Math.max(0, faute - 70), faute + 25).replace(/\s+/g, " ")} »`);
    from = builtSource.indexOf("<style>{`", close);
  }
}

/* Encadré posé par la coche du Mini-Gantt (issue #48, second retour).
   La logique est couverte par les tests unitaires ; ce qui ne l'est pas, c'est
   le RENDU — et c'est précisément lui qui avait avalé l'icône au premier lot.
   « Ne garder que l'image à droite, en transparence » tient à trois maillons
   qui peuvent se défaire sans erreur. */
{
  assert.match(builtSource, /<img\s+src=\{seg\.frame\.cornerIconUrl\}/,
    "La pastille du coin n'est plus rendue : l'encadré de coche n'aurait plus aucune marque.");
  const corner = builtSource.slice(
    builtSource.indexOf(".lp-widget-minigantt-frame-corner{"),
    builtSource.indexOf("}", builtSource.indexOf(".lp-widget-minigantt-frame-corner{")),
  );
  assert.ok(corner.length > 0, "La règle de la pastille du coin est introuvable.");
  assert.match(corner, /opacity:0?\.\d+/,
    "La pastille du coin n'est plus peinte en transparence.");
}

console.log("Repository invariants: OK");
