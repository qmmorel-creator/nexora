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
const builtBytes = await readFile(path.join(root, "apps/nexora/.build/index.html"));
const productionHtml = await readFile(path.join(root, "apps/nexora/dist/index.html"), "utf8");
assert.doesNotMatch(productionHtml, /type="text\/babel"|@babel\/standalone/);
assert.match(productionHtml, /<script type="module">/);
assert.deepEqual(builtBytes, sourceBytes, "Le build doit reconstruire exactement index.html");
const builtSource = builtBytes.toString("utf8").replace(/\r\n/g, "\n");
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
// Mini Gantt unique : annotations et migration restent extractibles, sans
// réintroduire un moteur classique en parallèle.
assert.match(builtSource, /\/\/ === NEXORA:GANTT-ANNOTATIONS:START ===/);
assert.match(builtSource, /\/\/ === NEXORA:GANTT-ANNOTATIONS:END ===/);
assert.match(builtSource, /className="lp-widget-minigantt-tblock"/);
assert.match(builtSource, /className="lp-widget-minigantt-frame"/);
assert.match(builtSource, /label: "Gantt"/);
assert.match(builtSource, /function MiniGanttView/);
assert.match(builtSource, /function MiniGanttViewSettings/);
assert.match(builtSource, /NEXORA:MINIGANTT-MIGRATION:START/);
assert.match(builtSource, /migrateLegacyMiniGanttWidget/);
assert.doesNotMatch(builtSource, /function WidgetEmbedGantt/);
assert.doesNotMatch(builtSource, /function GanttView/);
assert.doesNotMatch(builtSource, /Gantt \(complet\)/);
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
  // Le formulaire doit à la fois proposer le champ ET l'enregistrer : l'un sans
  // l'autre donne une case qui s'affiche et n'est jamais retenue.
  /* Le champ est passé d'un <select> natif au sélecteur à pastilles (#69) : ce
     qui compte reste que le formulaire le PROPOSE et l'ENREGISTRE — l'un sans
     l'autre donne un champ qui s'affiche et n'est jamais retenu. */
  assert.match(builtSource, /<CriticalitySelect value=\{criticality\} onChange=\{setCriticality\} \/>/,
    "champ Criticité absent du formulaire de tâche");
  assert.match(builtSource, /function CriticalitySelect\(\{ value, onChange \}\)/,
    "le sélecteur de criticité a disparu.");
  /* La pastille de « Non définie » ne doit jamais exister : une pastille grise
     se lirait comme un quatrième niveau, au lieu d'une absence de niveau. */
  const critSelect = builtSource.slice(
    builtSource.indexOf("=== NEXORA:CRITICALITY-SELECT:START ==="),
    builtSource.indexOf("=== NEXORA:CRITICALITY-SELECT:END ==="),
  );
  assert.ok(critSelect.length > 0, "Le bloc du sélecteur de criticité est introuvable.");
  assert.match(critSelect, /lp-color-select-dot-spacer/,
    "« Non définie » n'a plus son écarteur : son libellé se décalerait des trois niveaux.");
  assert.equal((critSelect.match(/lp-color-select-dot"/g) || []).length, 2,
    "La pastille doit être posée exactement deux fois : sur la valeur choisie et sur chaque option.");
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
  // Trois exceptions légitimes : un ancien format lu pour migrer, un index écrit
  // directement par window.storage.set en dehors du cycle React, et un magasin
  // FIGÉ — nexora:momentumSnapshots, dont plus aucun écrivain n'existe depuis la
  // suppression du widget Project Momentum (#99). Il reste lu pour que la
  // sauvegarde complète emporte ce qui y a déjà été enregistré ; rien ne le
  // modifie, il n'y a donc aucune modification à perdre. Le jour où l'interface
  // se remet à l'écrire, c'est par persistKey et cette exception saute.
  const readOnlyByDesign = new Set(["nexora:dashboardWidgets", "nexora:snapshotIndex", "nexora:momentumSnapshots"]);
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

/* Échéances — fusion de 4 widgets en 1 avec orientation (issues #46, #160, #176).
   Un widget se déclare à cinq endroits indépendants. Déclaré au catalogue mais
   absent du `switch` de rendu, il s'ajoute au tableau de bord et n'affiche
   RIEN — pas une erreur, pas un message : une tuile vide. Le contrôle visuel
   ne le verrait pas non plus, puisqu'il monte le composant directement. */
{
  assert.match(builtSource, /\/\/ === NEXORA:DEADLINE-SCATTER:START ===/, "Le bloc de calcul du nuage des échéances a disparu.");
  assert.match(builtSource, /\/\/ === NEXORA:DEADLINE-SCATTER:END ===/, "La sentinelle de fin du bloc du nuage a disparu.");
  assert.match(builtSource, /key: "echeances", label: "Échéances"/,
    "Le widget Échéances n'est plus au catalogue des widgets.");
  assert.match(builtSource, /<WidgetEcheances\s/,
    "Échéances est au catalogue mais son composant d'aiguillage a disparu : la tuile serait vide, sans erreur.");
  assert.match(builtSource, /<WidgetDeadlineScatter widget=\{widget\}/,
    "L'orientation « nuage » n'appelle plus le rendu du nuage des échéances.");
  assert.ok(usesTaskFilterExpr.includes('type === "echeances"'),
    "Échéances ne passe plus par le moteur de filtres : le widget ignorerait son propre filtre.");
  assert.match(builtSource, /if \(type === "echeances"\) return \{ w: 8, h: 6 \};/,
    "Échéances n'a plus de taille par défaut : il naîtrait écrasé sur la grille.");
  /* Le réglage doit être À LA FOIS proposé et enregistré : l'un sans l'autre
     donne une liste déroulante qui s'affiche et n'est jamais retenue. */
  assert.match(builtSource, /setScatterLaneField\(e\.target\.value\)/,
    "Le choix des couloirs a disparu de la fiche du widget.");
  assert.match(builtSource, /data\.scatterLaneField = scatterLaneField;/,
    "Le couloir choisi dans la fiche n'est plus enregistré.");
  /* La migration à la lecture évite qu'une ancienne sauvegarde (un des 4 types
     fusionnés) devienne un widget de type inconnu, invisible sans message. */
  assert.match(builtSource, /const ECHEANCES_LEGACY_ORIENTATION = \{/,
    "La table de migration des anciens widgets d'échéances a disparu.");
  assert.match(builtSource, /if \(value\.type in ECHEANCES_LEGACY_ORIENTATION\) return migrateLegacyEcheancesWidget\(value\);/,
    "La migration automatique à la lecture des anciens widgets d'échéances a disparu.");
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

/* Icônes par URL du menu latéral (issue #70).
   La reconnaissance est couverte par tests/icon-url.test.mjs. Ce qui ne l'est
   pas, c'est la SYMÉTRIE entre la fiche qui accepte et le rendu qui affiche :
   c'est leur divergence qui faisait le défaut, et deux expressions régulières
   voisines reprendraient le même chemin sans la moindre erreur. */
{
  assert.match(builtSource, /const isImageUrl = \(u\) => !!normalizeIconUrl\(u\);/,
    "La fiche d'icône ne partage plus sa règle avec le rendu : une URL acceptée pourrait redevenir inaffichable.");
  assert.match(builtSource, /const url = normalizeIconUrl\(icon\);\s*\n\s*if \(url\) return <IconUrlImage/,
    "Le rendu ne passe plus par la reconnaissance commune des URL d'icône.");
  /* Sans repli, une URL en échec laisse une image cassée ; sans mémorisation
     PAR URL, corriger l'URL resterait bloqué sur l'échec précédent. */
  assert.match(builtSource, /onError=\{\(\) => setFailedSrc\(src\)\}/,
    "Une icône dont le chargement échoue n'a plus de repli.");
  assert.match(builtSource, /if \(failedSrc === src\)/,
    "L'échec n'est plus mémorisé par URL : changer l'URL ne retenterait pas.");
  /* Second retour de test : l'icône ne s'affichait pas parce qu'elle n'était
     jamais ENREGISTRÉE. La règle de choix est couverte par le test unitaire ;
     ce qui ne l'est pas, c'est son câblage dans la fiche. Chacun de ces quatre
     points, retiré seul, rend l'URL silencieusement perdue. */
  assert.match(builtSource, /const saveIcon = \(\) => commitIcon\(resolveIconChoice\(draftIcon, customUrl\)\);/,
    "« Enregistrer » ignore de nouveau l'URL laissée dans le champ : elle serait perdue sans un mot.");
  assert.match(builtSource, /title="Utiliser cette image" onClick=\{\(\)=>commitIcon\(customUrl\.trim\(\)\)\}/,
    "« Utiliser cette image » ne fait plus qu'un brouillon : refermer la fiche perdrait l'icône.");
  assert.match(builtSource, /if\(e\.key==="Enter" && isImageUrl\(customUrl\)\)\{ e\.preventDefault\(\); commitIcon\(customUrl\.trim\(\)\); \}/,
    "La touche Entrée du champ d'URL ne valide plus l'icône.");
  /* Le champ vidé dès qu'on choisit ailleurs est ce qui rend son contenu
     lisible comme « la dernière chose exprimée » : sans cela, une URL restée
     dans le champ reprendrait le dessus sur l'icône cliquée, et « Retirer
     l'icône » ressusciterait l'ancienne URL. */
  assert.match(builtSource, /setCustomUrl\(""\);\s*\n\s*if \(item\.prefix === "tabler"\)/,
    "Choisir une icône dans la grille ne vide plus le champ d'URL : l'URL reprendrait le dessus.");
  assert.match(builtSource, /onClick=\{\(\)=>\{setCustomUrl\(""\);setDraftIcon\(null\);\}\}>Retirer l'icône/,
    "« Retirer l'icône » laisse l'URL dans le champ : elle reviendrait à l'enregistrement.");
  /* Même règle des deux côtés, jusque dans l'état initial du champ : la
     première version du correctif y avait laissé une expression sensible à la
     casse, et le champ s'ouvrait vide sur une icône pourtant enregistrée. */
  assert.doesNotMatch(builtSource, /useState\(\/\^\(https\?:\|data:\)\/\.test\(icon/,
    "Le champ d'URL retrouve sa propre règle de reconnaissance, différente du rendu.");
}

/* Filtre textuel des surfaces « tableau de bord » (issue #72).
   Le calcul est couvert par tests/board-search.test.mjs. Ce qui ne l'est pas,
   c'est le CÂBLAGE : un champ qui se saisit sans que rien ne le consomme, ou
   une surface oubliée, ne produit aucune erreur — la recherche paraît
   simplement sans effet. */
{
  assert.match(builtSource, /const boardTasks = useMemo\(\s*\(\) => filterTasksByText\(metaFilteredTasks, boardSearchApplied\)/,
    "La liste filtrée par le texte n'est plus calculée.");
  /* La valeur retardée est ce qui rend la frappe fluide : sans elle, chaque
     caractère recalcule tous les widgets de la page. */
  assert.match(builtSource, /setTimeout\(\(\) => setBoardSearchApplied\(boardSearch\), \d+\)/,
    "Le filtre n'est plus retardé : chaque caractère recalculerait toute la page.");
  assert.match(builtSource, /value=\{boardSearch\}/, "Le champ de filtre a disparu de la barre du haut.");
  /* Le widget « Tâche détaillée » retrouve sa tâche dans `allTasks` même quand
     un filtre la masque — c'est tout l'objet de cette seconde liste. Lui donner
     la liste réduite par la recherche la faisait disparaître dès la première
     lettre tapée, et le widget se vidait sous les yeux. */
  assert.match(builtSource, /allTasks=\{tasksBeforeSearch \|\| tasks\}/,
    "Le widget « Tâche détaillée » reçoit de nouveau la liste réduite par la recherche : son contenu s'évanouirait à la frappe.");
  assert.equal((builtSource.match(/tasksBeforeSearch=\{metaFilteredTasks\}/g) || []).length, 2,
    "Les deux surfaces à widgets ne transmettent plus toutes la liste d'avant la recherche.");
  /* Les DEUX surfaces qui partent du socle méta-filtré doivent le consommer.
     En oublier une donnerait un champ qui filtre ici et pas là. */
  for (const [surface, motif] of [
    ["Tableau de bord", /view === "dashboard" && <DashboardView[^\n]*tasks=\{boardTasks\}/],
    ["Aujourd'hui", /return \[\.\.\.boardTasks\]\.sort/],
  ]) {
    assert.match(builtSource, motif, `La vue « ${surface} » ne consomme plus la liste filtrée par le texte.`);
  }
}

/* Changer un widget de tableau de bord (issue #58).
   Le calcul est couvert par tests/widget-transfer.test.mjs. Ce qui ne l'est pas,
   c'est la CHAÎNE qui va de la fiche au magasin : quatre maillons, dont trois
   peuvent se défaire sans la moindre erreur — un bouton qui n'appelle plus
   rien, une fiche montée sans son émetteur, un transfert calculé et jamais
   écrit. Le widget resterait simplement sur place, en silence. */
{
  assert.match(builtSource, /Changer de tableau de bord/,
    "Le bouton « Changer de tableau de bord » a disparu de la fiche du widget.");
  assert.match(builtSource, /onTransfer\(\{ data: buildData\(\)/,
    "Le bouton de transfert ne transmet plus les réglages de la fiche : le widget partirait avec sa configuration d'avant.");
  assert.match(builtSource, /onTransfer=\{onTransferWidget \? transferEditedWidget : undefined\}/,
    "La fiche du widget n'est plus montée avec son émetteur de transfert : le bouton disparaîtrait.");
  assert.match(builtSource, /const after = widgetTransferApply\(before, widgetId, target, mode, uid, patch\);/,
    "Le transfert ne passe plus par widgetTransferApply : retrait et pose redeviendraient deux écritures séparées.");
  /* Les DEUX surfaces doivent recevoir le câblage : « Aujourd'hui » et les
     tableaux de bord partagent le même composant, et n'en câbler qu'une
     donnerait un bouton présent d'un côté, absent de l'autre. */
  const mounts = builtSource.match(/onTransferWidget=\{transferWidget\}/g) || [];
  assert.equal(mounts.length, 2,
    `Le transfert n'est câblé que sur ${mounts.length} des 2 surfaces (« Aujourd'hui » et les tableaux de bord).`);
}

/* Encadré posé par la coche du Mini-Gantt (issue #48, second retour).
   La logique est couverte par les tests unitaires ; ce qui ne l'est pas, c'est
   le RENDU — et c'est précisément lui qui avait avalé l'icône au premier lot.
   « Ne garder que l'image à droite, en transparence » tient à trois maillons
   qui peuvent se défaire sans erreur. */
{
  /* La pastille passe désormais par `miniGanttFrameCornerIcon`, qui laisse la
     TÂCHE substituer son icône à celle du cadre (URL saisie dans sa fiche).
     Le maillon à surveiller reste le même : que quelque chose soit rendu. */
  assert.match(builtSource, /<img\s+src=\{miniGanttFrameCornerIcon\(seg\.frame, tasksById\.get\(seg\.frame\.autoTaskId\)\)\}/,
    "La pastille du coin n'est plus rendue : l'encadré de coche n'aurait plus aucune marque.");
  assert.match(builtSource, /id="task-frame-icon"/,
    "Le champ d'icône d'encadré a disparu de la fiche de la tâche : la personnalisation ne serait plus saisissable.");
  const corner = builtSource.slice(
    builtSource.indexOf(".lp-widget-minigantt-frame-corner{"),
    builtSource.indexOf("}", builtSource.indexOf(".lp-widget-minigantt-frame-corner{")),
  );
  assert.ok(corner.length > 0, "La règle de la pastille du coin est introuvable.");
  /* Quentin a demandé la pastille OPAQUE après l'avoir vue en transparence :
     une opacité partielle qui reviendrait ici annulerait son retour sans que
     rien d'autre ne tombe. */
  assert.doesNotMatch(corner, /opacity:0?\.\d+/,
    "La pastille du coin redevient transparente : elle doit rester pleine.");
}

/* Coche du Mini-Gantt : elle ne sert qu'à encadrer (issue #48, dernier retour).
   Trois disparitions et une emphase, dont aucune ne se signale d'elle-même si
   elle se défait : les boutons peuvent revenir d'un copier-coller, et l'état de
   la coche peut retomber sur une sélection en mémoire. */
{
  const mini = builtSource.slice(
    builtSource.indexOf("function WidgetMiniGantt"),
    builtSource.indexOf("function WidgetEmbedMetro"),
  );
  assert.ok(mini.length > 0, "WidgetMiniGantt introuvable.");
  for (const [quoi, motif] of [
    ["Focus", /miniGanttFocus/],
    ["Présenter", /miniGanttPresentation/],
    ["Zoom sur la sélection", /zoomOnSelection/],
  ]) {
    assert.doesNotMatch(mini, motif, `Le mode « ${quoi} » est revenu dans le Mini-Gantt.`);
  }
  /* L'état de la coche vient des encadrés, pas d'une sélection en mémoire : une
     sélection se viderait au rechargement et la case reviendrait décochée sur
     une tâche visiblement encadrée. */
  assert.match(mini, /new Set\(rawHighlightFrames\.filter\(\(f\) => f && f\.autoTaskId\)\.map\(\(f\) => f\.autoTaskId\)\)/,
    "La coche du Mini-Gantt ne se lit plus sur les encadrés posés.");
  assert.doesNotMatch(mini, /useState\(\[\]\);[\s\S]{0,80}selection/, "Une sélection éphémère est revenue.");
  /* L'emphase de la tâche cochée : gras du titre et liseré rouge épais.
     Contrôle RÈGLE PAR RÈGLE, sans découper de tranche : le sélecteur de fin
     qu'on aurait pris ici (« .lp-widget-minigantt-label-title{ ») est contenu
     dans celui de début, donc la tranche se serait refermée dans sa propre
     ancre et les deux contrôles seraient passés à vide. */
  assert.match(builtSource,
    /\.lp-widget-minigantt-row\.is-selected \.lp-widget-minigantt-label-title\{[^}]*font-weight:800/,
    "Le titre d'une tâche cochée n'est plus en gras.");
  assert.match(builtSource,
    /\.lp-widget-minigantt-row\.is-selected \.lp-widget-minigantt-bar\{ box-shadow:0 0 0 2\.5px #D64545/,
    "La barre d'une tâche cochée n'a plus son liseré rouge épais.");
}

/* Bandeau de paramètres du widget (issue #56).
   La panne ne venait pas du bandeau mais de ce qui défilait dessous : les
   en-têtes collants du planning se calent sur la barre d'onglets de la PAGE,
   qui n'existe pas dans un widget. Le repli de la mesure — 48 px + 34 px —
   s'appliquait alors, et le planning défilait à découvert dans cette bande.
   Le premier lot n'avait livré que le durcissement CSS : le bandeau est devenu
   opaque, et la bande est restée. Les deux moitiés sont gardées ici ensemble. */
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
     ne s'applique pas, et un plan sans fond laisse voir au travers.
     Ancrage sur la DÉCLARATION, pas sur le seul sélecteur : « .lp-widget-head{ »
     apparaît aussi plus haut, dans une règle de glisser tactile. Partir de
     celle-là donnait une tranche de 700 000 caractères où tout se trouve — le
     garde passait au vert en mesurant n'importe quoi. */
  const headFrom = builtSource.indexOf(".lp-widget-head{ display:flex");
  const head = headFrom === -1 ? "" : builtSource.slice(headFrom, builtSource.indexOf("}", headFrom));
  assert.ok(head.length > 0, "La règle du bandeau de paramètres est introuvable.");
  assert.match(head, /background:var\(--surface\)/, "Le bandeau de paramètres n'a plus de fond opaque.");
  assert.match(head, /position:relative/, "Le bandeau n'est plus positionné : son z-index serait sans effet.");
  assert.match(head, /z-index:\d+/, "Le bandeau n'a plus de plan propre : le contenu positionné passe par-dessus.");
}

console.log("Repository invariants: OK");
