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

console.log("Repository invariants: OK");
