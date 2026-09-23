import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// #295 : vue « Métro » de l'Organigramme. Même règle que les autres suites :
// les fonctions testées sont extraites de l'interface RÉELLEMENT construite,
// entre les sentinelles des trois blocs qu'elle enchaîne — Équipes (modèle et
// arbre existants), layout par contour (#243) et Métro (adaptateur + layout).
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
test("un ancien mode Orbital enregistré revient à Hiérarchique sans toucher au mode Métro", () => {
  const from = html.indexOf("const ORGCHART_MODES = [");
  const to = html.indexOf("function WidgetOrgChart(", from);
  assert.ok(from > 0 && to > from);
  const { ORGCHART_MODES, orgChartModeOf } = vm.runInThisContext(
    `(function () { ${html.slice(from, to)}; return { ORGCHART_MODES, orgChartModeOf }; })()`
  );
  assert.deepEqual(Array.from(ORGCHART_MODES, (mode) => mode.key), ["hierarchy", "metro"]);
  assert.equal(orgChartModeOf({ orgChartView: "orbital" }), "hierarchy");
  assert.equal(orgChartModeOf({ orgChartView: "metro" }), "metro");
});
function block(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const api = vm.runInThisContext(
  `(function () {\n` +
  `const STAFFING_COLOR_CHOICES = ["#64748B"];\n` +
  `${block("TEAMS")}\n${block("ORGHIER-LAYOUT")}\n${block("ORGMETRO")}\n` +
  `;return { buildOrgHierarchyTree, reorderOrgHierarchyRoots, transverseTeamLinks, buildOrgMetroGraph, layoutOrgMetro,` +
  ` orgMetroBranchPaths, orgMetroObstacles, orgMetroStarPath, orgMetroTransverseRoutes, orgMetroOccurrences, orgMetroRelated, orgMetroWrap,` +
  ` ORGMETRO_NAME_CHARS, ORGMETRO_SIBLING_GAP };\n})`
)();

const team = (id, extra) => ({ id, name: `Équipe ${id}`, color: "#2C6BE0", ...extra });
const member = (name, extra) => ({ id: name, name, ...extra });

// Même chaîne que le widget : arbre existant → racines réordonnées →
// adaptateur Métro → layout.
function metro(teams, members, opts) {
  const roots = api.reorderOrgHierarchyRoots(api.buildOrgHierarchyTree(teams, members), teams);
  const graph = api.buildOrgMetroGraph(roots, teams, opts || {});
  return { graph, layout: api.layoutOrgMetro(graph) };
}
const branch = (layout, key) => layout.branches.find((b) => b.key === key);
const stationsOf = (layout, name) => layout.stations.filter((s) => s.name === name);

// Aucun libellé, bandeau ou station ne doit en chevaucher un autre.
function overlaps(a, b) {
  const eps = 0.5;
  return a.x < b.x + b.w - eps && b.x < a.x + a.w - eps && a.y < b.y + b.h - eps && b.y < a.y + a.h - eps;
}
function assertNoOverlap(layout) {
  const rects = api.orgMetroObstacles(layout);
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      assert.ok(!overlaps(rects[i], rects[j]), `chevauchement : ${rects[i].key} × ${rects[j].key}`);
    }
  }
}
// Aucune ligne (tronc, barre de bifurcation, raccord) ne traverse un libellé
// ou un bandeau.
function lineSegments(layout) {
  const segs = [];
  layout.branches.forEach((b) => {
    if (b.trunk) segs.push({ key: "trunk:" + b.key, x1: b.trunk.x, y1: b.trunk.y0, x2: b.trunk.x, y2: b.trunk.y1 });
    if (b.fork) segs.push({ key: "fork:" + b.key, x1: b.fork.minX, y1: b.fork.y, x2: b.fork.maxX, y2: b.fork.y });
    if (b.drop) segs.push({ key: "drop:" + b.key, x1: b.drop.x, y1: b.drop.y0, x2: b.drop.x, y2: b.drop.y1 });
  });
  return segs;
}
function assertLinesAvoidText(layout) {
  const rects = api.orgMetroObstacles(layout).filter((r) => !r.key.startsWith("station:"));
  lineSegments(layout).forEach((s) => {
    rects.forEach((r) => {
      const eps = 0.5;
      const hit = Math.max(s.x1, s.x2) > r.x + eps && Math.min(s.x1, s.x2) < r.x + r.w - eps
        && Math.max(s.y1, s.y2) > r.y + eps && Math.min(s.y1, s.y2) < r.y + r.h - eps;
      assert.ok(!hit, `la ligne ${s.key} traverse ${r.key}`);
    });
  });
}

// --- Équipes ---------------------------------------------------------------

test("Métro : une équipe sans sous-équipe = une seule ligne, ses membres en stations sur le tronc", () => {
  const { graph, layout } = metro([team("a", { leadName: "Alice" })], [member("Alice", { teamIds: ["a"] }), member("Bob", { teamIds: ["a"] })]);
  assert.equal(graph.kind, "team", "une seule équipe racine : pas de station centrale inutile");
  assert.equal(layout.branches.length, 1);
  const a = branch(layout, "team:a");
  assert.deepEqual(a.stations.map((s) => [s.name, s.kind]), [["Alice", "lead"], ["Bob", "member"]]);
  a.stations.forEach((s) => assert.equal(s.cx, a.x, "station centrée sur la ligne"));
  assert.equal(a.fork, null);
  assert.ok(a.trunk && a.trunk.y1 === a.stations[1].cy, "le tronc s'arrête sur la dernière station");
});

test("Métro : deux sous-équipes bifurquent d'un MÊME point aligné sur le tronc parent", () => {
  const teams = [team("p", { leadName: "Chloé" }), team("core", { parentTeamId: "p" }), team("disc", { parentTeamId: "p" })];
  const { layout } = metro(teams, [member("Chloé", { teamIds: ["p"] }), member("Lucas", { teamIds: ["core"] }), member("Nina", { teamIds: ["disc"] })]);
  const p = branch(layout, "team:p");
  const core = branch(layout, "team:core");
  const disc = branch(layout, "team:disc");
  assert.equal(p.fork.fromX, p.x, "la bifurcation part du tronc");
  assert.equal(p.trunk.y1, p.fork.y, "le tronc descend jusqu'au point de bifurcation");
  assert.ok(p.fork.y > p.stations[p.stations.length - 1].cy, "bifurcation sous la dernière station du tronc");
  // Les deux branches partent de la même barre, au même niveau, de part et
  // d'autre du tronc — aucune ne paraît parente de l'autre.
  assert.equal(core.drop.y0, p.fork.y);
  assert.equal(disc.drop.y0, p.fork.y);
  assert.equal(core.y, disc.y, "les deux branches commencent à la même hauteur");
  assert.ok(core.x < p.x && disc.x > p.x, "une branche de chaque côté du tronc");
  assert.equal(p.x - core.x, disc.x - p.x, "tronc exactement au milieu des lignes desservies");
  assert.deepEqual([p.fork.minX, p.fork.maxX], [core.x, disc.x]);
  assert.ok(core.ancestors.includes("team:p") && !disc.ancestors.includes("team:core"));
});

test("Métro : cinq sous-équipes se répartissent à gauche et à droite du tronc, dans l'ordre du catalogue", () => {
  const ids = ["s1", "s2", "s3", "s4", "s5"];
  const teams = [team("root"), ...ids.map((id) => team(id, { parentTeamId: "root" }))];
  const { layout } = metro(teams, ids.map((id) => member("M " + id, { teamIds: [id] })));
  const root = branch(layout, "team:root");
  const xs = ids.map((id) => branch(layout, "team:" + id).x);
  assert.deepEqual([...xs].sort((a, b) => a - b), xs, "ordre gauche → droite = ordre du catalogue");
  assert.ok(xs.filter((x) => x < root.x).length >= 2 && xs.filter((x) => x > root.x).length >= 2, "branches des deux côtés");
  ids.forEach((id) => assert.equal(branch(layout, "team:" + id).drop.y0, root.fork.y, `${id} part de la barre commune`));
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : trois niveaux de sous-équipes (Tech → Plateforme → Sécurité → IAM), sans code dédié à la profondeur", () => {
  const teams = [
    team("tech"), team("plat", { parentTeamId: "tech" }), team("app", { parentTeamId: "tech" }),
    team("secu", { parentTeamId: "plat" }), team("iam", { parentTeamId: "secu" }),
    team("front", { parentTeamId: "app" }), team("api", { parentTeamId: "app" }),
  ];
  const { layout } = metro(teams, teams.map((t) => member("Lead " + t.id, { teamIds: [t.id] })));
  const iam = branch(layout, "team:iam");
  assert.deepEqual(iam.ancestors, ["team:tech", "team:plat", "team:secu"]);
  assert.equal(iam.depth, 4);
  assert.ok(iam.y > branch(layout, "team:secu").y && branch(layout, "team:secu").y > branch(layout, "team:plat").y);
  // Épaisseur par niveau : toutes les sous-équipes ont la même, plus fine
  // que la ligne principale.
  const subW = new Set(["plat", "app", "secu", "iam", "front", "api"].map((id) => branch(layout, "team:" + id).lineW));
  assert.equal(subW.size, 1);
  assert.ok(branch(layout, "team:tech").lineW > [...subW][0]);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : une équipe transverse reste une ligne indépendante, reliée par une correspondance", () => {
  const teams = [team("a"), team("b"), team("data", { parentTeamId: "a", parentLinkType: "transverse" })];
  const { graph, layout } = metro(teams, [member("X", { teamIds: ["a"] }), member("Y", { teamIds: ["data"] })]);
  const data = branch(layout, "team:data");
  assert.equal(graph.kind, "hub");
  assert.ok(data.independent && data.transverse);
  assert.deepEqual(data.ancestors, ["hub"], "jamais enfant de son partenaire");
  assert.equal(data.drop, null, "aucun raccord hiérarchique vers la station centrale");
  assert.ok(!branch(layout, "hub").fork.childXs.includes(data.x), "la barre centrale ne dessert pas la ligne transverse");
  const routes = api.orgMetroTransverseRoutes(layout, api.transverseTeamLinks(teams));
  assert.equal(routes.length, 1);
  assert.equal(routes[0].hits, 0, "la correspondance ne traverse aucun libellé");
  // Uniquement des segments horizontaux / verticaux (#241).
  for (let i = 1; i < routes[0].points.length; i++) {
    const [x1, y1] = routes[0].points[i - 1];
    const [x2, y2] = routes[0].points[i];
    assert.ok(x1 === x2 || y1 === y2, "segment oblique dans une correspondance");
  }
});

test("Métro : transverseSide 'left' / 'right' place la ligne transverse avant / après son partenaire (#244)", () => {
  const base = [team("a"), team("b"), team("c")];
  const left = metro([...base, team("t", { parentTeamId: "b", parentLinkType: "transverse", transverseSide: "left" })], []).layout;
  const right = metro([...base, team("t", { parentTeamId: "b", parentLinkType: "transverse", transverseSide: "right" })], []).layout;
  const order = (layout) => layout.branches.filter((b) => b.depth === 1).sort((x, y) => x.x - y.x).map((b) => b.teamId);
  assert.deepEqual(order(left), ["a", "t", "b", "c"]);
  assert.deepEqual(order(right), ["a", "b", "t", "c"]);
});

// --- Utilisateurs ------------------------------------------------------------

test("Métro : un membre simple est une station de sa ligne, avec son poste lu dans teamRoles", () => {
  const { layout } = metro([team("a")], [member("Alice", { teamIds: ["a"], teamRoles: { a: "Designer" } })]);
  const [s] = stationsOf(layout, "Alice");
  assert.equal(s.kind, "member");
  assert.equal(s.role, "Designer");
  assert.equal(s.branchKey, "team:a");
});

test("Métro : un responsable sans poste renseigné reçoit le libellé générique, jamais un rôle déduit du nom", () => {
  const { layout } = metro([team("a", { leadName: "Chef Alice" })], [member("Chef Alice", { teamIds: ["a"] })]);
  const [s] = stationsOf(layout, "Chef Alice");
  assert.equal(s.kind, "lead");
  assert.equal(s.level, "lead-root");
  assert.ok(s.roleIsFallback);
});

test("Métro : le responsable se distingue comme dans la vue hiérarchique — en tête de sa ligne, halo et étoile", () => {
  const { layout } = metro([team("a", { name: "Produit", leadName: "Chef" })], [member("Bob", { teamIds: ["a"] }), member("Chef", { teamIds: ["a"] })]);
  const a = branch(layout, "team:a");
  assert.deepEqual(a.stations.map((s) => s.name), ["Chef", "Bob"], "le responsable passe en tête, quel que soit l'ordre de l'annuaire");
  const [lead, bob] = a.stations;
  assert.deepEqual(lead.leads, ["Produit"]);
  assert.ok(lead.starW > 0, "étoile devant le nom du responsable");
  assert.equal(bob.starW, 0);
  assert.ok(lead.half > lead.r + lead.stroke / 2, "place réservée au halo d'accent");
  assert.ok(a.leadOnLine);
  assert.equal(a.badge.subtitle, "", "responsable visible sur la ligne : pas de rappel dans le bandeau");
  assertNoOverlap(layout);
});

test("Métro : une personne qui dirige une équipe garde son étoile là où elle apparaît ailleurs", () => {
  const teams = [team("a", { name: "Alpha", leadName: "Chef" }), team("b", { name: "Bêta" })];
  const { layout } = metro(teams, [member("Chef", { teamIds: ["b", "a"] })]);
  const occurrences = stationsOf(layout, "Chef");
  assert.equal(occurrences.length, 2);
  occurrences.forEach((s) => assert.deepEqual(s.leads, ["Alpha"]));
  assert.equal(occurrences.find((s) => s.branchKey === "team:a").kind, "lead");
  assert.equal(occurrences.find((s) => s.branchKey === "team:b").kind, "member");
});

test("Métro : un responsable qui n'est pas sur la ligne est nommé dans son bandeau", () => {
  const teams = [team("a", { name: "Alpha", leadName: "Chef" }), team("b", { name: "Bêta" })];
  const { layout } = metro(teams, [member("Chef", { teamIds: ["b"] }), member("X", { teamIds: ["a"] })]);
  const a = branch(layout, "team:a");
  assert.equal(a.leadOnLine, false);
  assert.equal(a.badge.subtitle, "Resp. Chef");
  assert.equal(branch(layout, "team:b").badge.subtitle, "");
  assert.ok(a.stations.every((s) => s.kind !== "lead"));
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("orgMetroStarPath : étoile fermée à dix sommets", () => {
  const d = api.orgMetroStarPath(10, 10, 5);
  assert.equal((d.match(/[ML] /g) || []).length, 10);
  assert.ok(d.endsWith("Z"));
});

test("Métro : un manager et ses subordonnés forment une branche qui part de la ligne de l'équipe", () => {
  const teams = [team("d", { leadName: "Nina" })];
  const members = [
    member("Nina", { teamIds: ["d"] }), member("Léa", { teamIds: ["d"] }), member("Gabriel", { teamIds: ["d"] }),
    member("Anaïs", { teamIds: ["d"], managerName: "Gabriel" }), member("Tom", { managerName: "Gabriel" }), member("Sarah", { teamIds: ["d"], managerName: "Gabriel" }),
  ];
  const { layout } = metro(teams, members);
  const d = branch(layout, "team:d");
  const g = branch(layout, "mgr:Gabriel");
  assert.deepEqual(d.stations.map((s) => s.name), ["Nina", "Léa"]);
  assert.equal(g.kind, "person");
  assert.equal(g.header.name, "Gabriel");
  assert.equal(g.header.kind, "manager");
  assert.deepEqual(g.stations.map((s) => s.name), ["Anaïs", "Tom", "Sarah"]);
  assert.deepEqual(g.ancestors, ["team:d"]);
  assert.equal(g.drop.y0, d.fork.y, "la branche part de la bifurcation du tronc de l'équipe");
  assert.notEqual(g.x, d.x, "une branche unique part en coude, visible comme bifurcation");
  assert.equal(g.color, d.color, "la branche garde la couleur de sa ligne");
  assert.ok(g.lineW < d.lineW);
  assertNoOverlap(layout);
});

test("Métro : manager → manager → subordonnés, récursivement", () => {
  const members = [
    member("A", { teamIds: ["t"] }), member("B", { managerName: "A" }), member("C", { managerName: "B" }),
    member("D", { managerName: "C" }), member("E", { managerName: "C" }), member("F", { managerName: "B" }),
  ];
  const { layout } = metro([team("t")], members);
  assert.deepEqual(branch(layout, "mgr:C").ancestors, ["team:t", "mgr:A", "mgr:B"]);
  assert.deepEqual(branch(layout, "mgr:C").stations.map((s) => s.name), ["D", "E"]);
  assert.deepEqual(branch(layout, "mgr:B").stations.map((s) => s.name), ["F"]);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : un cycle de managerName (A → B → A) ne boucle jamais et ne perd personne", () => {
  const members = [member("A", { teamIds: ["t"], managerName: "B" }), member("B", { teamIds: ["t"], managerName: "A" })];
  const { layout } = metro([team("t")], members);
  assert.equal(stationsOf(layout, "A").length, 1);
  assert.equal(stationsOf(layout, "B").length, 1);
});

test("Métro : une personne multi-équipe a une station canonique et une station de correspondance, ses subordonnés une seule fois (#212)", () => {
  const teams = [team("a"), team("b")];
  const members = [member("Alice", { teamIds: ["a", "b"] }), member("Bob", { managerName: "Alice" })];
  const { layout } = metro(teams, members);
  const alice = stationsOf(layout, "Alice");
  assert.equal(alice.length, 2);
  assert.equal(alice.filter((s) => s.duplicate).length, 1);
  const canonical = alice.find((s) => !s.duplicate);
  assert.equal(canonical.kind, "manager", "la station canonique porte la branche de ses subordonnés");
  assert.equal(stationsOf(layout, "Bob").length, 1, "subordonné jamais dupliqué");
  const occ = api.orgMetroOccurrences(layout).get("Alice");
  assert.equal(occ[0], canonical, "la station canonique vient en tête des occurrences");
  const rel = api.orgMetroRelated(layout, { name: "Alice" });
  alice.forEach((s) => assert.ok(rel.stationKeys.has(s.key)));
  assert.ok(rel.branchKeys.has("mgr:Alice") && rel.teamIds.has("a") && rel.teamIds.has("b"));
});

test("Métro : une personne sans équipe rejoint une ligne « Sans équipe » indépendante", () => {
  const { layout } = metro([team("a")], [member("X", { teamIds: ["a"] }), member("Seul")]);
  const none = branch(layout, "team:none");
  assert.ok(none && none.independent && none.drop === null);
  assert.equal(none.color, null, "couleur neutre (variable de thème au rendu)");
  assert.deepEqual(none.stations.map((s) => s.name), ["Seul"]);
});

// --- Layout -------------------------------------------------------------------

test("Métro : ordre et positions déterministes — mêmes données, même plan", () => {
  const teams = [team("a", { leadName: "A1" }), team("b", { parentTeamId: "a" }), team("c", { parentTeamId: "a" }), team("t", { parentTeamId: "a", parentLinkType: "transverse" })];
  const members = [member("A1", { teamIds: ["a"] }), member("B1", { teamIds: ["b"] }), member("C1", { teamIds: ["c", "t"] }), member("C2", { managerName: "C1" })];
  const strip = (l) => JSON.stringify(l, (k, v) => (k === "member" || k === "team" ? undefined : v));
  assert.equal(strip(metro(teams, members).layout), strip(metro(teams, members).layout));
});

test("Métro : contour compact — une branche profonde mais étroite ne repousse pas sa voisine (#243)", () => {
  // Équipe « a » : une longue chaîne de managers (profonde, étroite) ; équipe
  // « b » : une simple ligne. Avec un rectangle englobant, b serait repoussée
  // au-delà de la plus large rangée de a ; par contour, seules les hauteurs
  // réellement partagées comptent.
  const chain = ["m0", "m1", "m2", "m3", "m4", "m5"];
  const members = [
    member("m0", { teamIds: ["a"] }),
    ...chain.slice(1).map((n, i) => member(n, { managerName: chain[i] })),
    ...["w1", "w2", "w3", "w4"].map((n) => member(n + " avec un nom assez long pour élargir", { managerName: "m5" })),
    member("Solo", { teamIds: ["b"] }),
  ];
  const { layout } = metro([team("a"), team("b")], members);
  const a = branch(layout, "team:a");
  const b = branch(layout, "team:b");
  const rects = api.orgMetroObstacles(layout);
  const aRight = Math.max(...rects.filter((r) => r.owner === "team:a" || layout.branches.find((x) => x.key === r.owner)?.ancestors.includes("team:a")).map((r) => r.x + r.w));
  const bLeft = Math.min(...rects.filter((r) => r.owner === "team:b").map((r) => r.x));
  assert.ok(bLeft < aRight, "b s'est glissée sous le débord de a, au lieu d'être repoussée après tout son rectangle");
  assert.ok(b.x > a.x);
  assertNoOverlap(layout);
});

test("Métro : libellés longs — retour à la ligne, jamais de troncature, jamais de chevauchement", () => {
  const long = "Marie-Charlotte de La Rochefoucauld-Montmorency";
  const role = "Responsable de la transformation numérique et de l'innovation";
  const { layout } = metro(
    [team("a", { name: "Équipe au nom particulièrement long pour un bandeau de ligne" }), team("b", { parentTeamId: "a" }), team("c", { parentTeamId: "a" })],
    [member(long, { teamIds: ["b"], teamRoles: { b: role } }), member("Court", { teamIds: ["c"] }), member("X", { teamIds: ["a"] })]
  );
  const [s] = stationsOf(layout, long);
  assert.ok(s.nameLines.length >= 2);
  assert.equal(s.nameLines.join(" ").replace(/- /g, "-"), long, "aucun caractère perdu");
  assert.ok(s.nameLines.some((l) => l.endsWith("-")), "coupure après le trait d'union");
  assert.equal(s.roleLines.join(" "), role);
  s.nameLines.forEach((l) => assert.ok(l.length <= api.ORGMETRO_NAME_CHARS));
  assert.ok(branch(layout, "team:a").badge.lines.length >= 2);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : grande organisation (50 équipes, 200 personnes, managers) — aucun chevauchement, taille maîtrisée", () => {
  const teams = [];
  for (let i = 0; i < 10; i++) {
    teams.push(team("r" + i, { leadName: "Lead r" + i, color: "#1FA971" }));
    for (let j = 0; j < 4; j++) teams.push(team(`r${i}s${j}`, { parentTeamId: "r" + i, leadName: `Lead r${i}s${j}` }));
  }
  teams.push(team("rh", { parentTeamId: "r3", parentLinkType: "transverse", transverseSide: "left" }));
  const members = [];
  teams.forEach((t, ti) => {
    members.push(member(t.leadName || "Lead " + t.id, { teamIds: [t.id], teamRoles: { [t.id]: "Responsable " + t.id } }));
    for (let k = 0; k < 3; k++) members.push(member(`P${ti}-${k}`, { teamIds: k === 2 && ti % 5 === 0 ? [t.id, "rh"] : [t.id] }));
  });
  // Managers intermédiaires : quelques personnes ont leurs propres subordonnés.
  for (let n = 0; n < 12; n++) members.push(member(`Sub${n}`, { managerName: `P${n * 3}-0` }));
  const started = Date.now();
  const { layout } = metro(teams, members, { rootLabel: "Direction" });
  const elapsed = Date.now() - started;
  assert.ok(layout.stations.length >= 200);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
  assert.ok(elapsed < 2000, `layout trop lent : ${elapsed} ms`);
  // Largeur linéaire en nombre de colonnes, jamais exponentielle.
  const columns = layout.branches.filter((b) => !b.fork && b.kind !== "hub").length;
  assert.ok(layout.width < columns * 400, `plan trop large : ${layout.width}px pour ${columns} colonnes`);
});

test("Métro : beaucoup de membres sur une seule ligne — le tronc s'allonge, rien ne se chevauche", () => {
  const members = Array.from({ length: 120 }, (_, i) => member("Membre " + i, { teamIds: ["a"] }));
  const { layout } = metro([team("a")], members);
  const a = branch(layout, "team:a");
  assert.equal(a.stations.length, 120);
  assert.equal(a.trunk.y1, a.stations[119].cy);
  assertNoOverlap(layout);
});

test("Métro : tracés SVG — tronc vertical, barre horizontale, coudes aux extrémités", () => {
  const teams = [team("p"), team("x", { parentTeamId: "p" }), team("y", { parentTeamId: "p" })];
  const { layout } = metro(teams, [member("M", { teamIds: ["p"] })]);
  const p = api.orgMetroBranchPaths(branch(layout, "team:p"));
  assert.match(p.trunk, /^M [\d.]+ [\d.]+ V [\d.]+$/);
  assert.match(p.fork, /Q .* H .* Q /);
  const x = api.orgMetroBranchPaths(branch(layout, "team:x"));
  assert.match(x.drop, /^M [\d.-]+ [\d.]+ V [\d.]+$/);
});

test("orgMetroWrap : coupe au mot, puis au caractère pour un mot trop long, sans rien perdre", () => {
  assert.deepEqual(api.orgMetroWrap("un deux trois", 7), ["un deux", "trois"]);
  assert.deepEqual(api.orgMetroWrap("abcdefghij", 4), ["abcd", "efgh", "ij"]);
  assert.deepEqual(api.orgMetroWrap("Rochefoucauld-Montmorency", 16), ["Rochefoucauld-", "Montmorency"]);
  assert.deepEqual(api.orgMetroWrap("", 10), []);
});

test("buildOrgMetroGraph : aucune racine → aucun plan", () => {
  assert.equal(api.buildOrgMetroGraph([], []), null);
  assert.deepEqual(api.layoutOrgMetro(null).branches, []);
});
