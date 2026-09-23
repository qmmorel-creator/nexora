import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// #295 : vue « Métro » de l'Organigramme. Même règle que les autres suites :
// les fonctions testées sont extraites de l'interface RÉELLEMENT construite,
// entre les sentinelles des trois blocs qu'elle enchaîne — Équipes (modèle et
// arbre existants), layout par contour (#243) et Métro (adaptateur + layout).
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
test("l'Organigramme n'a plus qu'une vue : le plan Métro, quel que soit le mode enregistré", () => {
  const from = html.indexOf("function WidgetOrgChart(");
  const to = html.indexOf("\n}\n", from);
  assert.ok(from > 0 && to > from);
  const src = html.slice(from, to);
  assert.ok(src.includes("<OrgMetroChart"), "le widget rend le plan Métro");
  assert.ok(!/OrgHierarchyChart|orgChartView|ORGCHART_MODES/.test(src), "plus de vue hiérarchique ni de bascule de mode");
  assert.ok(!html.includes("function OrgHierarchyChart("), "le composant hiérarchique est retiré");
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
  `${block("TEAMS")}\n${block("ORGHIER-LAYOUT")}\n${block("ORGMETRO")}\n${block("ORGRELATIONS")}\n` +
  `;return { buildOrgHierarchyTree, reorderOrgHierarchyRoots, transverseTeamLinks, buildOrgMetroGraph, layoutOrgMetro,` +
  ` orgMetroBranchPaths, orgMetroObstacles, orgMetroStarPath, orgMetroJunctions, memberIsInactive, orgChartMembersWithInactive,` +
  ` normalizeOrgChartRelations, orgChartRelationOptions, orgChartVisibleRelations, orgMetroRelationRoutes, orgRelationLabelAnchor, orgRelationRefParse, orgRelationLabelPlacement, normalizeOrgMetroOrder, orgMetroReorder, orgMetroApplyOffsets, normalizeOrgMetroOffsets, orgMetroFreeOffsets, orgMetroShiftRoute, orgMetroTransverseRoutes, orgMetroOccurrences, orgMetroRelated, orgMetroWrap,` +
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
    if (b.row) segs.push({ key: "row:" + b.key, x1: b.row.x0, y1: b.row.y, x2: b.row.x1, y2: b.row.y });
    if (b.elbow && b.elbow.stacked) {
      segs.push({ key: "stackH:" + b.key, x1: b.elbow.fromX + 6, y1: b.elbow.y, x2: b.elbow.x, y2: b.elbow.y });
      segs.push({ key: "stackV:" + b.key, x1: b.elbow.x, y1: b.elbow.y, x2: b.elbow.x, y2: b.elbow.y1 });
    }
    if (b.elbow && b.elbow.vertical) segs.push({ key: "side:" + b.key, x1: b.elbow.x, y1: b.elbow.y + 12, x2: b.elbow.x, y2: b.elbow.y1 });
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

test("Métro : le responsable se distingue — en tête de sa ligne, halo et étoile", () => {
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

test("Métro : le responsable est TOUJOURS la première station sous le bandeau, même s'il n'est pas membre de la ligne", () => {
  const teams = [team("a", { name: "Alpha", leadName: "Chef" }), team("b", { name: "Bêta" }), team("c", { name: "Gamma", leadName: "Absent" })];
  const { layout } = metro(teams, [member("Chef", { teamIds: ["b"] }), member("X", { teamIds: ["a"] })]);
  const a = branch(layout, "team:a");
  assert.equal(a.badge.subtitle, "", "plus de rappel dans le bandeau : une seule règle");
  assert.deepEqual(a.stations.map((st) => [st.name, st.kind]), [["Chef", "lead"], ["X", "member"]]);
  assert.ok(a.stations[0].leadRef && a.stations[0].duplicate, "occurrence de plus, la station d'origine reste dans Bêta");
  assert.equal(stationsOf(layout, "Chef").length, 2);
  assert.equal(a.badge.count, "1", "le responsable venu d'ailleurs ne compte pas dans l'effectif");
  // Responsable absent de l'annuaire : station quand même, sans fiche à ouvrir.
  const c = branch(layout, "team:c");
  assert.equal(c.stations[0].name, "Absent");
  assert.equal(c.stations[0].member, null);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("orgMetroStarPath : étoile fermée à dix sommets", () => {
  const d = api.orgMetroStarPath(10, 10, 5);
  assert.equal((d.match(/[ML] /g) || []).length, 10);
  assert.ok(d.endsWith("Z"));
});

test("Métro : un manager reste une station de sa ligne ; seuls ses rattachés bifurquent, depuis SA station", () => {
  const teams = [team("d", { leadName: "Nina" })];
  const members = [
    member("Nina", { teamIds: ["d"] }), member("Léa", { teamIds: ["d"] }), member("Gabriel", { teamIds: ["d"] }),
    member("Anaïs", { teamIds: ["d"], managerName: "Gabriel" }), member("Tom", { managerName: "Gabriel" }), member("Sarah", { teamIds: ["d"], managerName: "Gabriel" }),
  ];
  const { layout } = metro(teams, members);
  const d = branch(layout, "team:d");
  const g = branch(layout, "mgr:Gabriel");
  assert.deepEqual(d.stations.map((s) => [s.name, s.kind]), [["Nina", "lead"], ["Léa", "member"], ["Gabriel", "manager"]],
    "le manager garde sa place de station sur la ligne de son équipe");
  const gabriel = d.stations[2];
  assert.equal(gabriel.cx, d.x);
  assert.equal(g.kind, "person");
  assert.equal(g.header, null, "la branche ne porte que les rattachés");
  assert.deepEqual(g.stations.map((s) => s.name), ["Anaïs", "Tom", "Sarah"]);
  assert.deepEqual(g.ancestors, ["team:d"]);
  assert.equal(stationsOf(layout, "Gabriel").length, 1, "le manager n'est pas dupliqué");
  // Pastille de correspondance pour le manager ; la branche part à
  // l'horizontale de sa pastille, du côté OPPOSÉ à son étiquette (gauche).
  assert.equal(gabriel.pill, true, "le manager porte la pastille de correspondance");
  assert.equal(g.drop, null);
  assert.equal(g.elbow.y, gabriel.cy, "départ horizontal, à la hauteur de la station");
  assert.equal(g.elbow.fromX, d.x - gabriel.half, "départ au bord gauche de la pastille");
  assert.ok(g.x < d.x, "branche de l'autre côté de l'étiquette");
  assert.ok(g.y > g.elbow.y);
  g.stations.forEach((st) => assert.ok(st.label.x + st.label.w < d.x - d.lineW / 2, "libellés des rattachés entre leur ligne et le tronc, sans le toucher"));
  assert.equal(g.color, d.color, "la branche garde la couleur de sa ligne");
  assert.ok(g.lineW < d.lineW);
  const junctions = api.orgMetroJunctions(layout);
  assert.ok(!junctions.some((j) => j.y === g.elbow.y), "pas de rond blanc en plus : la pastille du manager fait la correspondance");
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : deux managers sur une même ligne — les coudes ne se croisent pas", () => {
  const members = [
    member("M1", { teamIds: ["t"] }), member("M2", { teamIds: ["t"] }), member("Simple", { teamIds: ["t"] }),
    member("A", { managerName: "M1" }), member("B", { managerName: "M1" }), member("C", { managerName: "M2" }),
  ];
  const { layout } = metro([team("t")], members);
  const t = branch(layout, "team:t");
  assert.deepEqual(t.stations.map((s) => s.name), ["Simple", "M1", "M2"], "stations simples d'abord, managers ensuite");
  const b1 = branch(layout, "mgr:M1");
  const b2 = branch(layout, "mgr:M2");
  assert.ok(b1.elbow.y < b2.elbow.y);
  assert.ok(b1.x < b2.x, "la bifurcation la plus haute contourne la plus basse par la gauche");
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : manager → manager → rattachés, récursivement", () => {
  const members = [
    member("A", { teamIds: ["t"] }), member("B", { managerName: "A" }), member("C", { managerName: "B" }),
    member("D", { managerName: "C" }), member("E", { managerName: "C" }), member("F", { managerName: "B" }),
  ];
  const { layout } = metro([team("t")], members);
  assert.deepEqual(branch(layout, "team:t").stations.map((s) => s.name), ["A"]);
  assert.deepEqual(branch(layout, "mgr:A").stations.map((s) => s.name), ["B"]);
  assert.deepEqual(branch(layout, "mgr:B").stations.map((s) => s.name), ["F", "C"]);
  assert.deepEqual(branch(layout, "mgr:C").ancestors, ["team:t", "mgr:A", "mgr:B"]);
  assert.deepEqual(branch(layout, "mgr:C").stations.map((s) => s.name), ["D", "E"]);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
});

test("Métro : correspondance blanche à chaque départ de branche sur une barre (T intermédiaires)", () => {
  const ids = ["s1", "s2", "s3"];
  const { layout } = metro([team("root"), ...ids.map((id) => team(id, { parentTeamId: "root" }))], []);
  const root = branch(layout, "team:root");
  const js = api.orgMetroJunctions(layout);
  assert.ok(js.some((j) => j.x === root.fork.fromX && j.y === root.fork.y), "point de départ commun");
  const middle = branch(layout, "team:s2");
  assert.ok(js.some((j) => j.x === middle.x && j.y === root.fork.y), "départ en T de la branche du milieu");
  const ends = ["s1", "s3"].map((id) => branch(layout, "team:" + id));
  ends.forEach((e) => assert.ok(!js.some((j) => j.x === e.x && j.y === root.fork.y), "pas de point sur un coude d'extrémité"));
});

test("Métro : chaque changement de couleur passe par une station", () => {
  const teams = [
    team("root", { color: "#D64545" }),
    ...["s1", "s2", "s3"].map((id) => team(id, { parentTeamId: "root", color: "#2C6BE0" })),
    team("solo", { parentTeamId: "s2", color: "#1FA971" }),
  ];
  const { layout } = metro(teams, []);
  const js = api.orgMetroJunctions(layout);
  layout.branches.filter((b) => b.drop).forEach((b) => {
    const y = b.drop.y0 + (b.drop.curved ? 9 : 0);
    assert.ok(js.some((j) => j.x === b.drop.x && j.y === y), `aucune station au changement de couleur de ${b.key}`);
  });
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
  // Équipe « b » : une simple ligne, à gauche. Équipe « a » : une longue
  // chaîne de rattachés, qui s'étend vers la GAUCHE et loin vers le bas. Avec
  // un rectangle englobant, a serait repoussée au-delà de b à toute hauteur ;
  // par contour, sa chaîne se glisse sous b, là où b n'occupe plus rien.
  const chain = ["m0", "m1", "m2", "m3", "m4", "m5"];
  const members = [
    member("Solo", { teamIds: ["b"] }),
    member("m0", { teamIds: ["a"] }),
    ...chain.slice(1).map((n, i) => member(n, { managerName: chain[i] })),
    ...["w1", "w2", "w3", "w4"].map((n) => member(n + " avec un nom assez long pour élargir", { managerName: "m5" })),
  ];
  const { layout } = metro([team("b"), team("a")], members);
  const a = branch(layout, "team:a");
  const b = branch(layout, "team:b");
  const rects = api.orgMetroObstacles(layout);
  const inA = (r) => r.owner === "team:a" || layout.branches.find((x) => x.key === r.owner)?.ancestors.includes("team:a");
  const aLeft = Math.min(...rects.filter(inA).map((r) => r.x));
  const bRight = Math.max(...rects.filter((r) => r.owner === "team:b").map((r) => r.x + r.w));
  assert.ok(aLeft < bRight, "la chaîne de a s'est glissée sous b, au lieu d'être repoussée après tout son rectangle");
  assert.ok(b.x < a.x);
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
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
  assert.match(p.fork, /Q .* H .* Q /, "la barre (couleur parente) tourne aux extrémités");
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

// --- Relations propres au widget, statut inactif, compteur ---------------------

test("Relations : normalisation — extrémités valides, jamais la même, légende bornée, identifiants uniques", () => {
  const rels = api.normalizeOrgChartRelations([
    { id: "r1", from: "team:a", to: "person:Alice", label: "  Pilote  " },
    { id: "r2", from: "person:Alice", to: "person:Alice" },
    { id: "r3", from: "", to: "team:b" },
    { id: "r1", from: "team:a", to: "team:b" },
    { id: "r4", from: "équipe:a", to: "team:b" },
    { id: "r5", from: "person:Bob", to: "team:b", label: "x".repeat(200) },
    null,
  ]);
  assert.deepEqual(rels.map((r) => r.id), ["r1", "r5"]);
  assert.equal(rels[0].label, "Pilote");
  assert.equal(rels[1].label.length, 80);
  assert.deepEqual(api.orgRelationRefParse("person:Jean-Pierre Martin"), { type: "person", id: "Jean-Pierre Martin" });
  assert.equal(api.normalizeOrgChartRelations(undefined).length, 0);
});

test("Relations : options de la fiche — équipes puis personnes, triées", () => {
  const opts = api.orgChartRelationOptions([team("b", { name: "Bêta" }), team("a", { name: "Alpha" })], [member("Zoé"), member("Adam")]);
  assert.deepEqual(opts.map((o) => o.id), ["team:a", "team:b", "person:Adam", "person:Zoé"]);
  assert.equal(opts[0].label, "Équipe · Alpha");
});

test("Relations : une extrémité absente du rendu masque le lien sans l'effacer", () => {
  const rels = [{ id: "r1", from: "team:a", to: "person:Alice" }, { id: "r2", from: "team:gone", to: "person:Alice" }];
  const visible = api.orgChartVisibleRelations(rels, (id) => id === "a", (n) => n === "Alice");
  assert.deepEqual(visible.map((r) => r.id), ["r1"]);
});

test("Relations dans le Métro : équipe → équipe, équipe → personne, personne → personne, tracés orthogonaux avec légende", () => {
  const teams = [team("a", { name: "Alpha", leadName: "A1" }), team("b", { name: "Bêta" }), team("c", { name: "Gamma", parentTeamId: "a" })];
  const members = [member("A1", { teamIds: ["a"] }), member("B1", { teamIds: ["b"] }), member("C1", { teamIds: ["c"] }), member("C2", { teamIds: ["c", "b"] })];
  const { layout } = metro(teams, members);
  const routes = api.orgMetroRelationRoutes(layout, [
    { id: "t2t", from: "team:a", to: "team:b", label: "Pilotage" },
    { id: "t2p", from: "team:b", to: "person:C1", label: "Appui" },
    { id: "p2p", from: "person:A1", to: "person:C2" },
    { id: "ghost", from: "person:Personne", to: "team:a" },
  ]);
  assert.deepEqual(routes.map((r) => r.id), ["t2t", "t2p", "p2p"]);
  routes.forEach((r) => {
    for (let i = 1; i < r.points.length; i++) {
      const [x1, y1] = r.points[i - 1];
      const [x2, y2] = r.points[i];
      assert.ok(x1 === x2 || y1 === y2, `segment oblique dans ${r.id}`);
    }
  });
  assert.ok(routes[0].labelAt && routes[1].labelAt);
  assert.equal(routes[2].labelAt, null, "pas de légende : pas de pastille");
  // Une personne multi-équipe est accrochée à sa station canonique.
  const canonical = layout.stations.find((st) => st.name === "C2" && !st.duplicate);
  const end = routes[2].points[routes[2].points.length - 1];
  assert.ok(end[1] >= canonical.cy - 20 && end[1] <= canonical.cy + 20);
});

test("orgRelationLabelAnchor : milieu du plus long segment", () => {
  assert.deepEqual(api.orgRelationLabelAnchor([[0, 0], [10, 0], [10, 100], [20, 100]]), { x: 10, y: 50 });
});

test("Utilisateur inactif : reste dans le plan, à sa place, marqué inactif", () => {
  assert.equal(api.memberIsInactive({ inactive: true }), true);
  assert.equal(api.memberIsInactive({ inactive: "oui" }), false);
  assert.equal(api.memberIsInactive(null), false);
  const { layout } = metro([team("a", { leadName: "Chef" })], [member("Chef", { teamIds: ["a"], inactive: true }), member("Bob", { teamIds: ["a"] })]);
  const a = branch(layout, "team:a");
  assert.deepEqual(a.stations.map((st) => [st.name, st.inactive]), [["Chef", true], ["Bob", false]]);
  assert.equal(a.stations[0].kind, "lead", "un responsable inactif reste le responsable");
});

test("Compteur de bandeau : pastille ronde pour un chiffre, plus large au-delà", () => {
  const small = metro([team("a")], [member("X", { teamIds: ["a"] })]).layout;
  const big = metro([team("a")], Array.from({ length: 12 }, (_, i) => member("M" + i, { teamIds: ["a"] }))).layout;
  assert.equal(branch(small, "team:a").badge.countW, 18);
  assert.ok(branch(big, "team:a").badge.countW > 18);
});

test("orgRelationLabelPlacement : la légende quitte le milieu du segment si un texte l'occupe", () => {
  const pts = [[0, 0], [200, 0]];
  assert.deepEqual(api.orgRelationLabelPlacement(pts, 40, 18, []), { x: 100, y: 0 });
  const blocked = api.orgRelationLabelPlacement(pts, 40, 18, [{ x: 60, y: -10, w: 80, h: 20 }]);
  assert.ok(blocked.x + 20 <= 60 || blocked.x - 20 >= 140, `légende posée sur l'obstacle (${blocked.x})`);
  assert.equal(blocked.y, 0, "toujours sur le tracé");
});

test("Glisser-déposer : l'ordre choisi réordonne les lignes sœurs et tout le plan se recalcule", () => {
  const teams = [team("a"), team("b"), team("c"), team("s1", { parentTeamId: "a" }), team("s2", { parentTeamId: "a" })];
  const members = teams.map((t) => member("M " + t.id, { teamIds: [t.id] }));
  const order = (layout, keys) => keys.map((k) => branch(layout, k)).sort((x, y) => x.x - y.x).map((x) => x.key);
  const base = metro(teams, members).layout;
  assert.deepEqual(order(base, ["team:a", "team:b", "team:c"]), ["team:a", "team:b", "team:c"]);
  // « c » déposée en tête des lignes principales, « s2 » avant « s1 ».
  let o = api.orgMetroReorder(null, "hub", ["team:a", "team:b", "team:c"], "team:c", 0);
  o = api.orgMetroReorder(o, "team:a", ["team:s1", "team:s2"], "team:s2", 0);
  assert.deepEqual(o, { hub: ["team:c", "team:a", "team:b"], "team:a": ["team:s2", "team:s1"] });
  const moved = metro(teams, members, { order: o }).layout;
  assert.deepEqual(order(moved, ["team:a", "team:b", "team:c"]), ["team:c", "team:a", "team:b"]);
  assert.deepEqual(order(moved, ["team:s1", "team:s2"]), ["team:s2", "team:s1"]);
  assertNoOverlap(moved);
  assertLinesAvoidText(moved);
  // Clés inconnues ignorées, nouvelles lignes gardées à la suite, entrée
  // invalide = ordre par défaut.
  const partial = metro(teams, members, { order: { hub: ["team:ghost", "team:b"] } }).layout;
  assert.deepEqual(order(partial, ["team:a", "team:b", "team:c"]), ["team:b", "team:a", "team:c"]);
  assert.deepEqual(api.normalizeOrgMetroOrder("n'importe quoi"), {});
  assert.deepEqual(api.normalizeOrgMetroOrder({ hub: ["x", 3, "x"] }), { hub: ["x"] });
});

test("Déplacement libre : une ligne déplacée sur la grille emmène sa sous-arborescence, les raccords suivent", () => {
  const teams = [team("root"), team("a", { parentTeamId: "root" }), team("b", { parentTeamId: "root" }), team("a1", { parentTeamId: "a" })];
  const members = teams.map((t) => member("M " + t.id, { teamIds: [t.id] }));
  const base = metro(teams, members).layout;
  const moved = api.orgMetroApplyOffsets(base, { "team:a": { dx: 83, dy: 41 } });
  const shift = (key) => {
    const x0 = branch(base, key), x1 = branch(moved, key);
    const r0 = branch(base, "team:root"), r1 = branch(moved, "team:root");
    return [x1.x - r1.x - (x0.x - r0.x), x1.y - r1.y - (x0.y - r0.y)];
  };
  assert.deepEqual(shift("team:a"), [80, 40], "magnétisé sur la grille de 20 px");
  assert.deepEqual(shift("team:a1"), [80, 40], "la sous-équipe suit sa ligne");
  assert.deepEqual(shift("team:b"), [0, 0], "les autres lignes ne bougent pas");
  const a = branch(moved, "team:a");
  const root = branch(moved, "team:root");
  assert.equal(a.drop.x, a.x);
  assert.equal(a.drop.y1, a.y, "le raccord redescend jusqu'au bandeau déplacé");
  assert.equal(a.drop.y0, root.fork.y);
  assert.ok(root.fork.minX <= a.x && a.x <= root.fork.maxX, "la barre parente s'étire jusqu'à la nouvelle place");
  a.stations.forEach((st) => assert.equal(st.cx, a.x));
  // Jamais au-dessus de la barre dont la ligne part.
  const up = api.orgMetroApplyOffsets(base, { "team:a": { dx: 0, dy: -400 } });
  assert.ok(branch(up, "team:a").y > branch(up, "team:root").fork.y);
  // Rien dans le cadre ne passe en coordonnées négatives, et sans décalage
  // le plan est inchangé.
  const left = api.orgMetroApplyOffsets(base, { "team:a": { dx: -2000, dy: 0 } });
  assert.ok(Math.min(...api.orgMetroObstacles(left).map((r) => r.x)) >= 0);
  assert.equal(api.orgMetroApplyOffsets(base, {}), base);
  assert.deepEqual(api.normalizeOrgMetroOffsets({ "team:a": { dx: 9, dy: 31 }, bad: null, z: { dx: 0, dy: 0 } }), { "team:a": { dx: 0, dy: 40 } });
});

test("Ronds de métro : aucun sans bifurcation ni changement de couleur", () => {
  // Une sous-équipe unique, de la même couleur, en coude : pas de rond.
  const same = metro([team("p", { color: "#2C6BE0" }), team("c", { parentTeamId: "p", color: "#2C6BE0" })], []).layout;
  assert.equal(api.orgMetroJunctions(same).length, 0);
  // Même forme, couleur différente : un rond au changement.
  const diff = metro([team("p", { color: "#2C6BE0" }), team("c", { parentTeamId: "p", color: "#D64545" })], []).layout;
  assert.equal(api.orgMetroJunctions(diff).length, 1);
  // Deux sous-équipes de même couleur : c'est une bifurcation, point commun.
  const bif = metro([team("p"), team("a", { parentTeamId: "p" }), team("b", { parentTeamId: "p" })], []).layout;
  const p = branch(bif, "team:p");
  assert.ok(api.orgMetroJunctions(bif).some((j) => j.x === p.fork.fromX && j.y === p.fork.y));
});

test("Grand titre : il se déplace seul, sa barre reste raccordée aux lignes", () => {
  const teams = [team("a"), team("b")];
  const base = metro(teams, [member("X", { teamIds: ["a"] })]).layout;
  const moved = api.orgMetroApplyOffsets(base, { hub: { dx: 200, dy: -40 } });
  const h0 = branch(base, "hub"), h1 = branch(moved, "hub");
  const a0 = branch(base, "team:a"), a1 = branch(moved, "team:a");
  assert.equal((h1.x - a1.x) - (h0.x - a0.x), 200, "le titre bouge, pas les lignes");
  assert.equal(h1.fork.fromX, h1.x, "la barre part toujours du titre");
  assert.ok(h1.fork.minX <= h1.x && h1.x <= h1.fork.maxX);
  assert.equal(h1.trunk.y1, h1.fork.y);
  assert.equal(a1.drop.y0, h1.fork.y);
  // Jamais sous sa propre barre.
  const down = api.orgMetroApplyOffsets(base, { hub: { dx: 0, dy: 400 } });
  assert.ok(branch(down, "hub").badge.y + branch(down, "hub").badge.h < branch(down, "hub").fork.y);
});

test("Anti-superposition : une ligne posée sur une autre glisse vers la case libre la plus proche", () => {
  const teams = [team("root"), team("a", { parentTeamId: "root" }), team("b", { parentTeamId: "root" })];
  const members = [member("Alice Martin", { teamIds: ["a"] }), member("Bruno Petit", { teamIds: ["b"] })];
  const base = metro(teams, members).layout;
  const a = branch(base, "team:a"), b = branch(base, "team:b");
  // « a » posée exactement sur « b » : conflit.
  const want = { "team:a": { dx: api.normalizeOrgMetroOffsets({ k: { dx: b.x - a.x } }).k?.dx || 0, dy: 0 } };
  const bad = api.orgMetroApplyOffsets(base, want);
  const overlaps = (layout) => {
    const r = api.orgMetroObstacles(layout).filter((o) => !o.key.startsWith("station:"));
    for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) {
      const p = r[i], q = r[j];
      if (p.x < q.x + q.w - 0.5 && q.x < p.x + p.w - 0.5 && p.y < q.y + q.h - 0.5 && q.y < p.y + p.h - 0.5) return true;
    }
    return false;
  };
  assert.ok(overlaps(bad), "le scénario doit réellement superposer les deux lignes");
  const fixed = api.orgMetroFreeOffsets(base, want, "team:a");
  assert.ok(!overlaps(api.orgMetroApplyOffsets(base, fixed)), "plus aucun texte superposé après ajustement");
  assert.notDeepEqual(fixed, want);
  // Déjà libre : rien ne change.
  const ok = { "team:a": { dx: 0, dy: 60 } };
  assert.deepEqual(api.orgMetroFreeOffsets(base, ok, "team:a"), ok);
});

test("Liens déplaçables : le tracé se décale latéralement et verticalement, toujours orthogonal, extrémités fixes", () => {
  const ortho = (pts) => pts.every((p, i) => i === 0 || p[0] === pts[i - 1][0] || p[1] === pts[i - 1][1]);
  const hvh = [[0, 0], [50, 0], [50, 100], [120, 100]];
  const lateral = api.orgMetroShiftRoute(hvh, 40, 0);
  assert.deepEqual(lateral, [[0, 0], [90, 0], [90, 100], [120, 100]]);
  const vertical = api.orgMetroShiftRoute(hvh, 0, -60);
  assert.ok(ortho(vertical));
  assert.deepEqual(vertical[0], [0, 0]);
  assert.deepEqual(vertical[vertical.length - 1], [120, 100]);
  assert.ok(vertical.some((p) => p[1] === -60), "le palier horizontal est monté de 60");
  const straight = api.orgMetroShiftRoute([[0, 10], [100, 10]], 0, 40);
  assert.ok(ortho(straight) && straight.some((p) => p[1] === 50));
  assert.equal(api.orgMetroShiftRoute(hvh, 0, 0), hvh);
  // Appliqué aux relations du plan, par clé de lien.
  const { layout } = metro([team("a"), team("b")], [member("X", { teamIds: ["a"] }), member("Y", { teamIds: ["b"] })]);
  const plain = api.orgMetroRelationRoutes(layout, [{ id: "r", from: "person:X", to: "person:Y" }]);
  const shifted = api.orgMetroRelationRoutes(layout, [{ id: "r", from: "person:X", to: "person:Y" }], { "relation:r": { dx: 0, dy: 40 } });
  assert.notDeepEqual(shifted[0].points, plain[0].points);
  assert.ok(ortho(shifted[0].points));
});

test("Titre du responsable : choisi dans la fiche équipe, il remplace son poste sous son nom", () => {
  const teams = [team("a", { leadName: "Chef", leadTitle: "  Responsable de lot  " }), team("b", { leadName: "Autre" }), team("c", { leadName: "Ext", leadTitle: "Pilote" })];
  const members = [member("Chef", { teamIds: ["a"], teamRoles: { a: "Ing. Méca" } }), member("Autre", { teamIds: ["b"], teamRoles: { b: "Chef de projet" } }), member("Ext", { teamIds: ["b"] })];
  const { layout } = metro(teams, members);
  const lead = (key) => branch(layout, key).stations[0];
  assert.equal(lead("team:a").role, "Responsable de lot", "le titre prime sur le poste");
  assert.equal(lead("team:a").roleIsFallback, false);
  assert.equal(lead("team:b").role, "Chef de projet", "sans titre : son poste, comme avant");
  assert.equal(lead("team:c").role, "Pilote", "aussi pour un responsable venu d'une autre ligne");
  assertNoOverlap(layout);
});

test("Ligne repliée : seul le responsable reste, le compte et les autres lignes sont inchangés", () => {
  const teams = [team("a", { leadName: "Chef" }), team("b", { parentTeamId: "a", leadName: "Sous" }), team("c", { leadName: "Voisin" })];
  const members = [
    member("Chef", { teamIds: ["a"] }), member("Ana", { teamIds: ["a"] }), member("Rattaché", { teamIds: ["a"], managerName: "Ana" }),
    member("Sous", { teamIds: ["b"] }), member("Bob", { teamIds: ["b"] }),
    member("Voisin", { teamIds: ["c"] }), member("Cléo", { teamIds: ["c"] }),
  ];
  const open = metro(teams, members).layout;
  const { layout } = metro(teams, members, { collapsed: ["team:a"] });
  const a = branch(layout, "team:a");
  assert.equal(a.collapsed, true);
  assert.deepEqual(a.stations.map((s) => s.name), ["Chef"], "seul le responsable reste sur la ligne");
  assert.equal(a.badge.count, branch(open, "team:a").badge.count, "le bandeau garde l'effectif complet");
  assert.ok(a.badge.lines.join(" ").startsWith("▸ "), "le bandeau signale la ligne repliée");
  assert.equal(branch(layout, "team:b"), undefined, "les sous-équipes sont masquées");
  assert.equal(stationsOf(layout, "Rattaché").length, 0, "les rattachés sont masqués");
  assert.deepEqual(branch(layout, "team:c").stations.map((s) => s.name), branch(open, "team:c").stations.map((s) => s.name));
  assert.equal(branch(open, "team:a").collapsed, false);
  assertNoOverlap(layout);
});

test("Utilisateurs inactifs propres au widget : la liste du widget prime sur l'ancien drapeau de la fiche", () => {
  const members = [member("Ana", { id: "a1" }), member("Bob", { id: "b1", inactive: true }), member("Cléo", { id: "c1" })];
  const flags = (list) => list.map((m) => [m.name, api.memberIsInactive(m)]);
  // Widget jamais réglé : l'ancien drapeau reste la référence, sans copie.
  assert.equal(api.orgChartMembersWithInactive(members, undefined), members);
  // Widget réglé : seule sa liste compte, même vide.
  assert.deepEqual(flags(api.orgChartMembersWithInactive(members, ["a1"])), [["Ana", true], ["Bob", false], ["Cléo", false]]);
  assert.deepEqual(flags(api.orgChartMembersWithInactive(members, [])), [["Ana", false], ["Bob", false], ["Cléo", false]]);
  // Les fiches d'origine ne sont jamais modifiées ; une fiche inchangée est réutilisée telle quelle.
  const out = api.orgChartMembersWithInactive(members, ["a1"]);
  assert.equal(members[0].inactive, undefined);
  assert.equal(out[2], members[2]);
  // Deux widgets, deux réglages : chacun grise ses propres personnes dans le plan.
  const teams = [team("t", { leadName: "Ana" })];
  const withTeam = members.map((m) => ({ ...m, teamIds: ["t"] }));
  const w1 = metro(teams, api.orgChartMembersWithInactive(withTeam, ["c1"])).layout;
  const w2 = metro(teams, api.orgChartMembersWithInactive(withTeam, [])).layout;
  assert.deepEqual(w1.stations.filter((s) => s.inactive).map((s) => s.name), ["Cléo"]);
  assert.deepEqual(w2.stations.filter((s) => s.inactive).map((s) => s.name), []);
});

// --- Disposition horizontale par équipe, nœuds de bifurcation déplaçables ----

test("Disposition horizontale : stations côte à côte sur une ligne, noms dessous, rattachés à la verticale", () => {
  const teams = [team("a", { leadName: "Chef" }), team("b", { parentTeamId: "a", leadName: "Sous" }), team("v", { leadName: "Voisin" })];
  const members = [
    member("Chef", { teamIds: ["a"] }), member("Ana", { teamIds: ["a"] }), member("Rattachée", { teamIds: ["a"], managerName: "Ana" }),
    member("Zoé Longuenom-Composé", { teamIds: ["a"], teamRoles: { a: "Ingénieure fiabilité des services" } }),
    member("Sous", { teamIds: ["b"] }), member("Bob", { teamIds: ["b"] }),
    member("Voisin", { teamIds: ["v"] }), member("Cléo", { teamIds: ["v"] }),
  ];
  const vert = metro(teams, members).layout;
  const { layout } = metro(teams, members, { horizontal: ["a"] });
  const a = branch(layout, "team:a");
  assert.ok(a.row, "la ligne horizontale existe");
  assert.equal(a.stations[0].name, "Chef", "le responsable reste la première station");
  a.stations.forEach((st, i) => {
    assert.equal(st.cy, a.row.y, "station posée sur la ligne horizontale");
    assert.ok(st.label.y > a.row.y, "nom sous la ligne");
    if (i) assert.ok(st.cx > a.stations[i - 1].label.x + a.stations[i - 1].label.w, "chaque station après le nom de la précédente");
  });
  assert.equal(a.row.x1, a.stations[a.stations.length - 1].cx, "la ligne s'arrête sur la dernière station");
  assert.equal(a.trunk.x, a.row.x0, "la ligne horizontale part du tronc");
  // Rattachés : descente verticale depuis la station du manager.
  const side = branch(layout, "mgr:Ana");
  const ana = a.stations.find((st) => st.name === "Ana");
  assert.ok(side.elbow.vertical);
  assert.equal(side.x, ana.cx);
  // Sous-équipe : bifurcation sous le tout, depuis le tronc ; elle reste verticale.
  const b = branch(layout, "team:b");
  assert.equal(b.row, null);
  assert.ok(a.fork && a.fork.y > side.stations[side.stations.length - 1].cy, "la bifurcation passe sous les rattachés");
  assert.equal(a.trunk.y1, a.fork.y);
  // Les autres équipes ne changent pas de forme.
  assert.equal(branch(layout, "team:v").row, null);
  assert.deepEqual(branch(layout, "team:v").stations.map((st) => st.cx - branch(layout, "team:v").x), branch(vert, "team:v").stations.map((st) => st.cx - branch(vert, "team:v").x));
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
  // Déterministe, et suit les déplacements comme le reste.
  assert.deepEqual(metro(teams, members, { horizontal: ["a"] }).layout, layout);
  const moved = api.orgMetroApplyOffsets(layout, { "team:a": { dx: 40, dy: 20 } });
  const ma = branch(moved, "team:a");
  assert.equal(ma.row.x1 - ma.row.x0, a.row.x1 - a.row.x0);
  ma.stations.forEach((st) => assert.equal(st.cy, ma.row.y));
});

test("Nœud de bifurcation déplaçable : la barre et les lignes qui en partent bougent ensemble, le tronc suit", () => {
  const teams = [team("p", { leadName: "Chef" }), team("c1", { parentTeamId: "p" }), team("c2", { parentTeamId: "p" }), team("x", { leadName: "Ext" })];
  const members = [member("Chef", { teamIds: ["p"] }), member("Luc", { teamIds: ["c1"] }), member("Mia", { teamIds: ["c2"] }), member("Ext", { teamIds: ["x"] })];
  const { layout: base } = metro(teams, members);
  const p0 = branch(base, "team:p");
  const junction = api.orgMetroJunctions(base).find((j) => j.key === "j:team:p");
  assert.ok(junction, "le nœud existe");
  // Vers le bas seulement : tronc prolongé, lignes décalées d'autant.
  const down = api.orgMetroApplyOffsets(base, { "fork:team:p": { dx: 0, dy: 40 } });
  const rel = (l, k) => [branch(l, k).x - branch(l, "team:p").x, branch(l, k).y - branch(l, "team:p").y];
  assert.equal(branch(down, "team:p").fork.y - branch(down, "team:p").y, p0.fork.y - p0.y + 40);
  assert.equal(branch(down, "team:p").trunk.y1, branch(down, "team:p").fork.y, "le tronc descend jusqu'au nœud");
  ["team:c1", "team:c2"].forEach((k) => assert.deepEqual(rel(down, k), [rel(base, k)[0], rel(base, k)[1] + 40]));
  assert.deepEqual(branch(down, "team:p").stations.map((st) => st.cy - branch(down, "team:p").y), p0.stations.map((st) => st.cy - p0.y), "les stations de la ligne ne bougent pas");
  // En biais : décroché du tronc jusqu'au nœud, qui reste le départ de la barre.
  const side = api.orgMetroApplyOffsets(base, { "fork:team:p": { dx: 60, dy: 40 } });
  const ps = branch(side, "team:p");
  assert.ok(ps.trunk.jog, "décroché du tronc");
  assert.equal(ps.trunk.jog.x, ps.fork.fromX);
  assert.equal(ps.fork.fromX - ps.x, 60);
  assert.ok(api.orgMetroBranchPaths(ps).trunk.includes(" H "), "tracé orthogonal");
  const js = api.orgMetroJunctions(side).find((j) => j.key === "j:team:p");
  assert.deepEqual([js.x, js.y], [ps.fork.fromX, ps.fork.y], "le rond blanc suit le nœud");
  ["team:c1", "team:c2"].forEach((k) => assert.deepEqual(rel(side, k), [rel(base, k)[0] + 60, rel(base, k)[1] + 40]));
  // À la même hauteur : la barre s'étire jusqu'au pied du tronc.
  const flat = branch(api.orgMetroApplyOffsets(base, { "fork:team:p": { dx: 200, dy: 0 } }), "team:p");
  assert.ok(!flat.trunk.jog && flat.fork.minX <= flat.trunk.x && flat.fork.maxX >= flat.trunk.x);
  // Jamais au-dessus de sa place d'origine.
  const up = branch(api.orgMetroApplyOffsets(base, { "fork:team:p": { dx: 0, dy: -200 } }), "team:p");
  assert.equal(up.fork.y - up.y, p0.fork.y - p0.y);
  // Anti-superposition : un nœud lâché sur une autre ligne glisse vers une case libre.
  const x0 = branch(base, "team:x");
  const want = { "fork:team:p": { dx: x0.x - p0.x, dy: 0 } };
  const fixed = api.orgMetroFreeOffsets(base, want, "fork:team:p");
  assert.ok(fixed["fork:team:p"].dy >= 0);
  assertNoOverlap(api.orgMetroApplyOffsets(base, fixed));
});

test("Sous-équipes empilées : les unes sous les autres, à droite du tronc qui descend, chacune par un coude", () => {
  const teams = [
    team("root", { leadName: "Dir" }),
    team("ds", { parentTeamId: "root" }),
    team("s1", { parentTeamId: "ds", leadName: "Carla" }), team("s2", { parentTeamId: "ds", leadName: "Mehdi" }), team("s3", { parentTeamId: "ds", leadName: "Chloé" }),
    team("sib", { parentTeamId: "root", leadName: "Vincent" }),
  ];
  const members = [
    member("Dir", { teamIds: ["root"] }), member("Carla", { teamIds: ["s1"] }), member("Maureen", { teamIds: ["s1"] }),
    member("Mehdi", { teamIds: ["s2"] }), member("Chloé", { teamIds: ["s3"] }), member("Tiphaine", { teamIds: ["s3"] }),
    member("Vincent", { teamIds: ["sib"] }),
  ];
  const flat = metro(teams, members).layout;
  const { layout } = metro(teams, members, { stacked: ["ds"] });
  const ds = branch(layout, "team:ds");
  const kids = ["team:s1", "team:s2", "team:s3"].map((k) => branch(layout, k));
  assert.equal(ds.fork, null, "plus de barre de bifurcation");
  // Empilées dans l'ordre, sans chevauchement vertical, alignées à droite du tronc.
  kids.forEach((k, i) => {
    assert.ok(k.x > ds.x, "à droite du tronc");
    assert.equal(k.x, kids[0].x, "lignes alignées sur une même verticale");
    assert.ok(k.badge.x > ds.x + ds.lineW / 2, "le bandeau ne touche pas le tronc");
    assert.ok(k.elbow && k.elbow.stacked && k.elbow.fromX === ds.x && k.elbow.x === k.x, "coude depuis le tronc");
    if (i) {
      const prevBottom = Math.max(...branch(layout, ["team:s1", "team:s2", "team:s3"][i - 1]).stations.map((st) => st.label.y + st.label.h));
      assert.ok(k.elbow.y > prevBottom, "sous la sous-équipe précédente");
    }
  });
  assert.equal(ds.trunk.y1, kids[2].elbow.y, "le tronc descend jusqu'au dernier coude");
  // Un rond de correspondance au départ de chaque coude, sur le tronc.
  const dots = api.orgMetroJunctions(layout).filter((j) => j.key.startsWith("s:"));
  assert.deepEqual(dots.map((d) => [d.x, d.y]), kids.map((k) => [ds.x, k.elbow.y]));
  // Plus étroit que côte à côte : l'espace se prend en hauteur.
  const flatDs = [branch(flat, "team:s1"), branch(flat, "team:s3")];
  assert.ok(kids[2].y > flatDs[1].y, "plus bas que la version côte à côte");
  assertNoOverlap(layout);
  assertLinesAvoidText(layout);
  // Déplacer la ligne parente emporte l'empilement ; le coude reste accroché.
  const moved = api.orgMetroApplyOffsets(layout, { "team:ds": { dx: 40, dy: 20 } });
  const md = branch(moved, "team:ds");
  ["team:s1", "team:s2", "team:s3"].forEach((k) => {
    const b = branch(moved, k);
    assert.equal(b.elbow.fromX, md.x);
    assert.equal(b.x - md.x, kids[0].x - ds.x);
  });
  assert.equal(api.orgMetroBranchPaths(branch(moved, "team:s1")).drop.startsWith(`M ${md.x} `), true);
});
