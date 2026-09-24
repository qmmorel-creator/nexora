/* Vue Carte (#361) : disposition hexagonale, thèmes, paliers, normalisation
   des tâches et modèles procéduraux. La tranche testée est extraite du bundle
   RÉELLEMENT construit, jamais recopiée. Le moteur three.js est éprouvé par le
   banc visuel (tools/visual-check). */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const C = vm.runInThisContext(
  `(function () {\n${slice("CARTE")}\n;return {
    carteHash, carteStage, carteNormalize, carteBuild, carteTerritoryStats, carteTaskModel, carteHubModel,
    carteDecorModel, carteLegend, carteMatches, normalizeCarteViewPrefs, carteDist, CARTE_THEMES, CARTE_THEME_BY_ID,
    carteEmojiIcon, carteThemeOverrides, carteTaskLevel, carteDimmedProjects, carteDueAltitude, carteDueGround, carteInitials, carteAvatarAnchor, carteHazard,
    CARTE_STYLES, CARTE_STYLE_BY_ID, carteLook, carteStyleTileColors, carteNeonColor,
    CARTE_DND_LIEUX, CARTE_DND_BY_ID, CARTE_DND_FROM_THEME, carteDndLieux, normalizeCarteLieux,
  };\n})`
)();

const NOW = Date.parse("2026-09-24T10:00:00");
const statuses = [
  { id: "s1", name: "À planifier", color: "#64748B" },
  { id: "s2", name: "Attente tiers", color: "#8B5CF6" },
  { id: "s3", name: "En cours", color: "#0EA5E9" },
  { id: "s5", name: "Terminé", color: "#22B07D" },
  { id: "s6", name: "Information", color: "#64748B" },
  { id: "s7", name: "Urgent client", color: "#DC2626" },
];
const taskTypes = [
  { id: "tt1", name: "Tâches" }, { id: "tt2", name: "Planning" }, { id: "tt3", name: "Réunions" }, { id: "tt4", name: "Information" },
];

function world(nProjects, nTasks, opts = {}) {
  const folders = Array.from({ length: 6 }, (_, i) => ({ id: "f" + i, name: "Dossier " + i }));
  const projects = Array.from({ length: nProjects }, (_, i) => ({ id: "p" + i, name: "Projet " + i, color: "#336699", folderId: i % 5 === 4 ? "folder-a-trier" : "f" + (i % 6) }));
  const tasks = Array.from({ length: nTasks }, (_, j) => ({
    id: "t" + j, title: "Tâche " + j, projectId: "p" + (j % Math.max(1, opts.perProject || nProjects)), statusId: statuses[j % 5].id,
    taskTypeId: taskTypes[j % 4].id, start: "2026-09-10", end: "2026-10-02",
  }));
  return { ctx: { projects, projectFolders: folders, statuses, taskTypes, teamMembers: [] }, tasks };
}
const build = (w, memory, themeOverrides) => {
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  return C.carteBuild({ projects: n.projects, tasks: n.tasks, memory, themeOverrides });
};

test("paliers décidés : 0-19, 20-39, 40-59, 60-79, 80-99, 100 %", () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 99, 100, -5, NaN].map(C.carteStage), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 0, 0]);
});

test("familles d'état, type, criticité et indices de dates tirés des vrais champs", () => {
  const ctx = { projects: [{ id: "p", name: "P" }], statuses, taskTypes, projectFolders: [], teamMembers: [{ name: "Léo", color: "#ff0000" }] };
  const tasks = [
    { id: "a", projectId: "p", statusId: "s5", completedAt: "2026-09-22T08:00:00Z" },
    { id: "b", projectId: "p", statusId: "s1", taskTypeId: "tt4" },
    { id: "c", projectId: "p", statusId: "s3", progress: 45, taskTypeId: "tt3" },
    { id: "d", projectId: "p", statusId: "s2", milestone: true, taskTypeId: "tt3" },
    { id: "e", projectId: "p", statusId: "s1", end: "2026-09-20", start: "2026-09-18", criticality: "moyen" },
    { id: "f", projectId: "p", statusId: "s1", start: "2026-10-05", end: "2026-10-30", assignee: "Léo" },
    { id: "g", projectId: "p", statusId: "s7", end: "2026-09-28", lastInteraction: "2026-07-01T00:00:00Z" },
    { id: "h", projectId: "zz", statusId: "s1" },
  ];
  const n = C.carteNormalize(ctx, tasks, { now: NOW });
  const by = Object.fromEntries(n.tasks.map((t) => [t.id, t]));
  assert.equal(by.a.state, "done"); assert.equal(by.a.recentDone, true);
  assert.equal(by.b.state, "info");
  assert.equal(by.c.state, "doing"); assert.equal(by.c.kind, "meeting"); assert.equal(by.c.progress, 45);
  assert.equal(by.d.state, "waiting"); assert.equal(by.d.kind, "milestone");
  assert.equal(by.e.overdue, true); assert.equal(by.e.lateDays, 4); assert.equal(by.e.criticality, "moyen"); assert.equal(by.e.duration, 3);
  assert.equal(by.f.future, true); assert.equal(by.f.assigneeColor, "#ff0000");
  assert.equal(by.g.criticality, "urgent", "un statut nommé « urgent » vaut criticité urgente, comme isTaskUrgent");
  assert.equal(by.g.soon, true); assert.equal(by.g.stale, true);
  assert.equal(by.h.projectId, null, "projet inconnu : tâche orpheline");
});

test("mêmes données, même carte ; 15 thèmes disponibles", () => {
  const w = world(20, 300);
  assert.equal(JSON.stringify(build(w)), JSON.stringify(build(w)));
  assert.equal(C.CARTE_THEMES.length, 15);
  ["cyberpunk", "ville", "desert", "mer", "lac", "montagne", "hautemontagne", "marais", "jungle", "volcan", "ile"].forEach((id) => assert.ok(C.CARTE_THEME_BY_ID[id], id));
});

test("ajouter un projet et des tâches ne déplace aucun territoire existant", () => {
  const w = world(12, 200);
  const before = build(w);
  w.ctx.projects.push({ id: "p-new", name: "Nouveau", folderId: "f1" });
  w.tasks.push({ id: "t-new", projectId: "p-new", statusId: "s1" }, { id: "t-new2", projectId: "p3", statusId: "s1" });
  const after = build(w);
  Object.keys(before.memory.projects).forEach((id) => assert.equal(after.memory.projects[id], before.memory.projects[id], id));
});

test("avec la mémoire de l'appareil, une suppression ne décale ni territoire ni tâche", () => {
  const w = world(12, 200);
  const before = build(w);
  w.ctx.projects.splice(3, 1);
  w.tasks = w.tasks.filter((t) => t.projectId !== "p3" && t.id !== "t10");
  const after = build(w, before.memory);
  Object.keys(after.memory.projects).forEach((id) => assert.equal(after.memory.projects[id], before.memory.projects[id], id));
  Object.keys(after.memory.tasks).forEach((id) => assert.equal(after.memory.tasks[id], before.memory.tasks[id], id));
});

test("un thème par dossier, régions voisines différentes, isolés en île, préférence respectée", () => {
  const w = world(24, 100);
  const L = build(w);
  w.ctx.projects.forEach((p) => {
    const expected = p.folderId === "folder-a-trier" ? "ile" : L.groupThemes[p.folderId];
    assert.equal(L.themes[p.id], expected, p.id);
  });
  const L2 = build(w, null, { f0: "volcan" });
  assert.equal(L2.themes.p0, "volcan");
  const cyber = build(w, null, { f0: "cyberpunk" });
  assert.equal(cyber.themes.p0, "cyberpunk");
  assert.equal(cyber.themes.p6, "cyberpunk", "tous les projets du dossier gardent le même thème");
  assert.equal(cyber.themes.p1, L.themes.p1, "les autres dossiers gardent leur thème automatique");
  assert.deepEqual(cyber.territories.map((t) => [t.projectId, t.q, t.r]), L.territories.map((t) => [t.projectId, t.q, t.r]), "le thème ne déplace aucun projet");
  assert.equal(C.carteThemeOverrides([{ id: "f0", mapTheme: "cyberpunk" }], {}).f0, "cyberpunk");
  assert.match(C.carteLegend("cyberpunk").lines.find(([label]) => label === "Jalon")[1], /Balise/);
});

test("routes seulement entre projets d'un même dossier ; tâches dans leur territoire", () => {
  const w = world(18, 400);
  const L = build(w);
  L.routes.forEach((r) => assert.equal(L.projectById[r.from].group, L.projectById[r.to].group));
  L.pois.forEach((p) => assert.equal(L.tiles[p.key].projectId, p.projectId));
});

test("tâches sans projet : territoire « Terre inconnue » signalé", () => {
  const w = world(3, 9);
  w.tasks.push({ id: "orph", projectId: "absent", statusId: "s1" });
  const L = build(w);
  const poi = L.pois.find((p) => p.taskId === "orph");
  assert.equal(poi.projectId, "__terre-inconnue__");
  assert.equal(L.projectById["__terre-inconnue__"].name, "Terre inconnue");
});

test("statistiques et palier d'un territoire : les informations ne comptent pas", () => {
  const n = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [
    { id: "1", projectId: "p", statusId: "s5" }, { id: "2", projectId: "p", statusId: "s5" },
    { id: "3", projectId: "p", statusId: "s1" }, { id: "4", projectId: "p", statusId: "s6" },
  ], { now: NOW });
  const s = C.carteTerritoryStats(n.tasks);
  assert.equal(s.pct, 67); assert.equal(s.stage, 3); assert.equal(s.info, 1);
});

test("modèles valides pour chaque thème, état et palier", () => {
  const w = world(4, 60);
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  for (const th of C.CARTE_THEMES) {
    for (let st = 0; st <= 5; st++) for (const pr of ["high", "normal", "low"]) C.carteHubModel(th.id, st, "#123456", pr).forEach(check);
    n.tasks.forEach((t) => [0, 1, 2].forEach((d) => C.carteTaskModel({ ...t, recurring: true, checklistTotal: 3, checklistDone: 1, stale: true, overdue: true }, th.id, { detail: d, secondaryColor: "#00ff00" }).forEach(check)));
    C.carteDecorModel({ q: 1, r: 2, kind: "land" }, th.pal, th.id).forEach(check);
    assert.equal(C.carteLegend(th.id).lines.length, 11);
  }
  function check(p) {
    assert.ok(["box", "cyl", "hex", "cone", "pyr", "ball", "dome"].includes(p.g), p.g);
    assert.match(p.c, /^#[0-9a-fA-F]{6}$/);
    [...p.p, ...p.s].forEach((v) => assert.ok(Number.isFinite(v)));
  }
});

test("#376 : la construction d'une tâche en cours monte de façon continue avec l'avancement", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const height = (pr) => C.carteTaskModel({ ...base, progress: pr }, "ville", { detail: 0, plinth: false }).filter((p) => p.c !== "#c9a060").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  assert.ok(height(20) < height(25) && height(25) < height(50) && height(50) < height(90), `${height(20)} < ${height(25)} < ${height(50)} < ${height(90)}`);
});

test("filtres de la vue et préférences normalisées", () => {
  const t = { state: "done", criticality: "urgent", overdue: false, oldDone: true };
  assert.equal(C.carteMatches(t, { states: ["done"] }), true, "#372 : terminée visible par défaut, même ancienne");
  assert.equal(C.carteMatches(t, { states: ["done"], hideOldDone: true }), false, "masquée seulement sur demande");
  assert.equal(C.carteMatches(t, { states: ["done"], crit: "urgent" }), true);
  assert.equal(C.carteMatches(t, { states: ["todo"] }), false);
  assert.equal(C.normalizeCarteViewPrefs({}).hideOldDone, false);
  const p = C.normalizeCarteViewPrefs({ states: ["x"], crit: "nope", quality: "ultra", folderThemes: { f1: "volcan", f2: "inconnu" } });
  assert.deepEqual(p.states, ["todo", "waiting", "doing", "done", "info"]);
  assert.equal(p.crit, "all"); assert.equal(p.quality, "auto");
  assert.deepEqual(p.folderThemes, { f1: "volcan" });
});

test("grand volume : 300 projets et 12 000 tâches disposés en moins de 3 s", () => {
  const w = world(300, 12000);
  const t0 = Date.now();
  const L = build(w);
  const ms = Date.now() - t0;
  assert.equal(L.pois.length, 12000);
  assert.ok(ms < 3000, `${ms} ms`);
});

test("#366 : seules les icônes emoji passent dans les étiquettes 3D", () => {
  assert.equal(C.carteEmojiIcon("🏗️"), "🏗️");
  ["iconify:thesvg-color/gmail", "tabler:map-2", "https://x.y/i.png", "data:image/png;base64,AA", "abc", "", null].forEach((i) => assert.equal(C.carteEmojiIcon(i), "", String(i)));
});

test("#368 : le thème enregistré sur le dossier prime sur la préférence de vue", () => {
  const o = C.carteThemeOverrides([{ id: "f1", mapTheme: "volcan" }, { id: "f2", mapTheme: "inconnu" }, { id: "f3" }], { f1: "mer", f3: "lac", f9: "nope" });
  assert.deepEqual(o, { f1: "volcan", f3: "lac" });
});

test("#364 et #365 : préférences du filtre général et du panneau", () => {
  const f = { statusIds: ["s1"], excludeDone: true };
  assert.deepEqual(C.normalizeCarteViewPrefs({ filter: f }).filter, f);
  assert.equal(C.normalizeCarteViewPrefs({ filter: [1] }).filter, null);
  assert.equal(C.normalizeCarteViewPrefs({}).panel, true);
  assert.equal(C.normalizeCarteViewPrefs({ panel: false }).panel, false);
});

test("#374 : grisés = projets avec des tâches mais aucune affichée ; un projet vide ne l'est pas", () => {
  const tasks = [{ id: "a", projectId: "p1" }, { id: "b", projectId: "p1" }, { id: "c", projectId: "p2" }, { id: "d", projectId: null }];
  const dim = C.carteDimmedProjects(tasks, new Set(["a"]));
  assert.deepEqual([...dim].sort(), ["__terre-inconnue__", "p2"]);
  assert.equal(dim.has("p3"), false);
  assert.equal(C.carteDimmedProjects(tasks, new Set(["a", "c", "d"])).size, 0);
});

test("#380 : la hauteur construite est proportionnelle au pourcentage d'avancement", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const built = (pr) => C.carteTaskModel({ ...base, progress: pr }, "ville", { detail: 0, plinth: false }).filter((p) => p.c !== "#c9a060").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  const full = C.carteTaskModel({ ...base, state: "done" }, "ville", { detail: 0, plinth: false }).reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  [25, 50, 75].forEach((pr) => assert.ok(Math.abs(built(pr) / full - pr / 100) < 0.06, `${pr} % : ${(built(pr) / full * 100).toFixed(0)} % de la hauteur finale`));
  assert.ok(full >= 1.4, `bâtiment terminé agrandi (${full.toFixed(2)})`);
});

test("#383 : l'altitude du sol suit la date de fin ; la mer pour le retard, l'imminent et le terminé", () => {
  const t = (o) => ({ state: "todo", end: 100, dueIn: 30, overdue: false, ...o });
  assert.equal(C.carteDueAltitude(t({ overdue: true, dueIn: -3 })), 0);
  assert.equal(C.carteDueAltitude(t({ dueIn: 5 })), 0);
  assert.equal(C.carteDueAltitude(t({ state: "done", dueIn: 60 })), 0);
  assert.equal(C.carteDueAltitude(t({ end: null, dueIn: null })), 0.5);
  const a14 = C.carteDueAltitude(t({ dueIn: 14 })), a30 = C.carteDueAltitude(t({ dueIn: 30 })), a60 = C.carteDueAltitude(t({ dueIn: 60 }));
  assert.ok(a14 > 0 && a14 < a30 && a30 < a60 && a60 < 1, `${a14} < ${a30} < ${a60}`);
  assert.equal(C.carteDueAltitude(t({ dueIn: 400 })), 1);
  assert.ok(C.carteDueGround(1) - C.carteDueGround(0) <= 1.2, "sans exagération");
});

test("#383 : la case d'une tâche prend l'altitude de sa date de fin ; le bâtiment ne porte plus de socle", () => {
  const ctx = { projects: [{ id: "p", name: "P" }], statuses, taskTypes, projectFolders: [] };
  const n = C.carteNormalize(ctx, [
    { id: "late", projectId: "p", statusId: "s1", start: "2026-09-01", end: "2026-09-10" },
    { id: "far", projectId: "p", statusId: "s1", start: "2026-09-20", end: "2026-12-20" },
    { id: "nod", projectId: "p", statusId: "s1" },
  ], { now: NOW });
  const L = C.carteBuild({ projects: n.projects, tasks: n.tasks });
  const h = (id) => L.tiles[L.pois.find((p) => p.taskId === id).key].h;
  assert.ok(h("late") < h("nod") && h("nod") < h("far"), `${h("late")} < ${h("nod")} < ${h("far")}`);
  const model = C.carteTaskModel({ ...n.tasks[0], state: "done" }, "ville", { detail: 0 });
  assert.equal(model.filter((p) => p.g === "hex" && p.s[1] > 0.1).length, 0, "aucun socle d'avancement");
});

test("#379 : dalle claire et, pour une tâche à faire, jalon au fanion de son statut", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s1", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const parts = C.carteTaskModel(base, "ville", { detail: 0 });
  assert.ok(parts.some((p) => p.g === "hex" && p.c === "#fff8e8"), "dalle claire");
  assert.ok(parts.some((p) => p.g === "box" && p.c === base.statusColor), "fanion à la couleur du statut");
});

test("#382 : initiales et avatar du responsable", () => {
  assert.equal(C.carteInitials("Maïa Sonnier"), "MS");
  assert.equal(C.carteInitials("Quentin"), "Q");
  assert.equal(C.carteInitials("anne-laure masson"), "AM");
  assert.equal(C.carteInitials(""), "?");
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes, teamMembers: [{ name: "Léo", color: "#123456" }] }, [{ id: "x", projectId: "p", statusId: "s1", assignee: "Léo" }], { now: NOW }).tasks[0];
  const parts = C.carteTaskModel(base, "ville", { detail: 2 });
  assert.ok(parts.some((p) => p.g === "cyl" && p.c === "#123456"), "silhouette à la couleur de l'utilisateur");
  assert.ok(C.carteAvatarAnchor(base)[1] > 0.5, "badge au-dessus de la tête");
  assert.ok(!C.carteTaskModel({ ...base, overdue: true, criticality: "urgent" }, "ville", { detail: 0 }).some((p) => p.c === "#ff5a1f"), "pas de brasier dans le modèle");
});

test("#381/#385 : incendie si urgente, orage si en retard, énorme orage si les deux", () => {
  const t = (o) => ({ state: "doing", criticality: "moyen", overdue: false, ...o });
  assert.equal(C.carteHazard(t({ criticality: "urgent" })), "fire");
  assert.equal(C.carteHazard(t({ overdue: true })), "storm");
  assert.equal(C.carteHazard(t({ overdue: true, criticality: "urgent" })), "tempest");
  assert.equal(C.carteHazard(t({})), null);
  assert.equal(C.carteHazard(t({ state: "done", criticality: "urgent" })), null);
  assert.equal(C.carteHazard(t({ state: "info", criticality: "urgent" })), null);
});

// Styles de carte (#387) : Archipel d'encre et Néon-Grille, distincts du thème
// de dossier « cyberpunk » (#384) qui reste intact.
test("styles de carte : Classique par défaut, deux styles, thèmes inchangés", () => {
  assert.deepEqual(C.CARTE_STYLES.map((s) => s.id), ["classique", "estampe", "neon", "dnd"]);
  assert.equal(C.normalizeCarteViewPrefs({}).style, "classique");
  assert.equal(C.normalizeCarteViewPrefs({ style: "estampe" }).style, "estampe");
  assert.equal(C.normalizeCarteViewPrefs({ style: "cyberpunk" }).style, "classique", "un thème n'est pas un style");
  C.CARTE_STYLES.forEach((s) => assert.ok(!C.CARTE_THEME_BY_ID[s.id], "aucun identifiant partagé avec un thème : " + s.id));
  assert.ok(C.CARTE_THEME_BY_ID.cyberpunk, "le thème Cyberpunk de dossier reste disponible");
  assert.equal(C.CARTE_THEMES.length, 15);
});

test("styles de carte : la disposition ne bouge pas, seul l'habillage change", () => {
  const w = world(12, 200);
  const L = build(w);
  const look = C.carteLook("estampe", "ville");
  assert.equal(look.label, "Archipel d'encre");
  assert.equal(look.hub.length, 6);
  assert.equal(C.carteLook("classique", "ville").label, "Ville");
  assert.equal(C.carteLook("neon", "mer").hub[5], "Mégatour");
  const leg = C.carteLegend("ville", "neon");
  assert.equal(leg.lines.length, 11);
  assert.equal(leg.signals.length, 4);
  assert.match(leg.lines.find(([k]) => k === "Jalon")[1], /Flèche/);
  assert.match(C.carteLegend("ville").signals[0][1], /Incendie/, "légende classique : incendie des urgentes (#385)");
  // Les tuiles de mer passent sous la nappe du style ; la terre garde ses couleurs.
  Object.values(L.tiles).slice(0, 400).forEach((t) => {
    ["estampe", "neon"].forEach((st) => {
      const c = C.carteStyleTileColors(st, t, "#336699");
      assert.match(c.top, /^#[0-9a-f]{6}$/i); assert.match(c.side, /^#[0-9a-f]{6}$/i);
      assert.equal(!!c.sea, t.kind === "sea");
    });
    assert.equal(C.carteStyleTileColors("classique", t), null);
  });
  assert.equal(C.carteNeonColor("f1"), C.carteNeonColor("f1"), "néon stable par dossier");
});

test("styles de carte : chaque état, type et indice a un modèle valide", () => {
  const geos = new Set(["box", "cyl", "hex", "cone", "pyr", "ball", "dome"]);
  const valid = (parts, label) => {
    assert.ok(parts.length > 0, label);
    parts.forEach((p) => {
      assert.ok(geos.has(p.g), label + " : géométrie " + p.g);
      assert.ok(["l", "g", "t", "s", "h"].includes(p.m), label + " : matériau " + p.m);
      assert.match(p.c, /^#[0-9a-f]{6}$/i, label + " : couleur " + p.c);
      p.p.concat(p.s, [p.r]).forEach((v) => assert.ok(Number.isFinite(v), label + " : nombre"));
    });
  };
  const base = { id: "x", state: "todo", kind: "task", progress: 0, duration: 5, criticality: null, overdue: false, soon: false, future: false, assignee: null, checklistTotal: 0, checklistDone: 0, recurring: false, attachments: 0, hasReport: false, fromEmail: false, stale: false, startTime: null, secondaryProjectId: null };
  ["estampe", "neon"].forEach((st) => {
    ["todo", "waiting", "doing", "done", "info"].forEach((state) => ["task", "meeting", "planning", "milestone"].forEach((kind) => [0, 40, 100].forEach((progress) => {
      valid(C.carteTaskModel({ ...base, state, kind, progress }, "ville", { style: st }), `${st} ${state} ${kind} ${progress}`);
    })));
    const full = { ...base, state: "doing", progress: 60, criticality: "urgent", overdue: true, future: true, assignee: "Léo", checklistTotal: 3, checklistDone: 1, recurring: true, attachments: 2, hasReport: true, fromEmail: true, stale: true, startTime: "09:00", secondaryProjectId: "p2", recentDone: true };
    const rich = C.carteTaskModel(full, "ville", { style: st, secondaryColor: "#2a9d8f" });
    valid(rich, st + " tous indices");
    assert.ok(rich.length > C.carteTaskModel({ ...base, state: "doing", progress: 60 }, "ville", { style: st }).length, st + " : les indices ajoutent des pièces");
    assert.ok(C.carteTaskModel({ ...base, state: "done" }, "ville", { style: st, detail: 0 }).length > 0);
    for (let stage = 0; stage <= 5; stage++) valid(C.carteHubModel("ville", stage, "#e07a3f", stage === 5 ? "high" : "normal", st), `${st} cœur ${stage}`);
    const L = build(world(8, 60));
    Object.values(L.tiles).slice(0, 300).forEach((t) => C.carteDecorModel(t, C.CARTE_THEMES[0].pal, "ville", st).forEach((p) => assert.ok(geos.has(p.g))));
  });
  // Archipel : la pagode gagne un toit par palier d'avancement.
  const roofs = (progress) => C.carteTaskModel({ ...base, state: "doing", progress }, "ville", { style: "estampe", plinth: false }).filter((p) => p.g === "pyr").length;
  assert.deepEqual([0, 20, 40, 60, 80].map(roofs), [1, 2, 3, 4, 5]);
  // Classique inchangé quand aucun style n'est demandé.
  assert.deepEqual(C.carteTaskModel({ ...base, state: "done" }, "ville", {}), C.carteTaskModel({ ...base, state: "done" }, "ville", { style: "classique" }));
});

// Style Donjons & Dragons (#390) : un lieu par dossier, dalles carrées.
test("style D&D : cinq lieux, un par dossier, réglables", () => {
  assert.deepEqual(C.CARTE_DND_LIEUX.map((l) => l.id), ["donjon", "arene", "cite", "foret", "forge"]);
  C.CARTE_DND_LIEUX.forEach((l) => { assert.equal(l.hub.length, 6, l.id); assert.ok(l.lg.todo && l.lg.done, l.id); });
  C.CARTE_THEMES.forEach((t) => assert.ok(C.CARTE_DND_BY_ID[C.CARTE_DND_FROM_THEME[t.id]], "lieu automatique pour " + t.id));
  const L = build(world(12, 200));
  const auto = C.carteDndLieux(L);
  L.territories.forEach((tr) => {
    assert.ok(C.CARTE_DND_BY_ID[auto[tr.projectId]], tr.projectId);
    const g = L.projectById[tr.projectId].group;
    L.territories.filter((o) => L.projectById[o.projectId].group === g).forEach((o) => assert.equal(auto[o.projectId], auto[tr.projectId], "un seul lieu par dossier"));
  });
  const first = L.territories[0], key = L.projectById[first.projectId].group || "folder-a-trier";
  const forced = C.carteDndLieux(L, { [key]: "arene" });
  assert.equal(forced[first.projectId], "arene");
  assert.deepEqual(C.normalizeCarteLieux({ a: "forge", b: "atlantide", c: 3 }), { a: "forge" });
  assert.deepEqual(C.normalizeCarteViewPrefs({ style: "dnd", folderLieux: { f1: "cite", f2: "?" } }).folderLieux, { f1: "cite" });
  assert.equal(C.normalizeCarteViewPrefs({ style: "dnd" }).style, "dnd");
  // Libellés et légende suivent le lieu.
  assert.match(C.carteLook("dnd", "ville", "forge").label, /Forge naine/);
  assert.match(C.carteLook("dnd", "ville").label, /Cité/, "sans réglage, le thème Ville donne la cité");
  const leg = C.carteLegend("ville", "dnd", "donjon");
  assert.equal(leg.lines.length, 11); assert.equal(leg.signals.length, 4);
  // Tuiles : gouffre pour la mer, lieu transmis au moteur.
  Object.values(L.tiles).slice(0, 400).forEach((t) => {
    const c = C.carteStyleTileColors("dnd", t, "#336699", "foret");
    assert.match(c.top, /^#[0-9a-f]{6}$/i); assert.match(c.side, /^#[0-9a-f]{6}$/i);
    assert.equal(!!c.sea, t.kind === "sea");
    if (!c.water) assert.equal(c.lieu, "foret");
  });
});

test("style D&D : chaque lieu, état et indice a un modèle valide", () => {
  const geos = new Set(["box", "cyl", "hex", "cone", "pyr", "ball", "dome"]);
  const valid = (parts, label) => {
    assert.ok(parts.length > 0, label);
    parts.forEach((p) => {
      assert.ok(geos.has(p.g), label + " : géométrie " + p.g);
      assert.ok(["l", "g", "t", "s", "h"].includes(p.m), label + " : matériau " + p.m);
      assert.match(p.c, /^#[0-9a-f]{6}$/i, label + " : couleur " + p.c);
      p.p.concat(p.s, [p.r]).forEach((v) => assert.ok(Number.isFinite(v), label + " : nombre"));
    });
  };
  const base = { id: "x", state: "todo", kind: "task", progress: 0, duration: 5, criticality: null, overdue: false, soon: false, future: false, assignee: null, checklistTotal: 0, checklistDone: 0, recurring: false, attachments: 0, hasReport: false, fromEmail: false, stale: false, startTime: null, secondaryProjectId: null };
  const full = { ...base, state: "doing", progress: 60, criticality: "urgent", overdue: true, soon: true, future: true, assignee: "Léo", checklistTotal: 3, checklistDone: 1, recurring: true, attachments: 2, hasReport: true, fromEmail: true, stale: true, startTime: "09:00", secondaryProjectId: "p2" };
  const L = build(world(8, 60));
  C.CARTE_DND_LIEUX.forEach(({ id: lieu }) => {
    ["todo", "waiting", "doing", "done", "info"].forEach((state) => ["task", "meeting", "planning", "milestone"].forEach((kind) => [0, 40, 100].forEach((progress) => {
      valid(C.carteTaskModel({ ...base, state, kind, progress }, "ville", { style: "dnd", lieu }), `${lieu} ${state} ${kind} ${progress}`);
    })));
    const rich = C.carteTaskModel(full, "ville", { style: "dnd", lieu, secondaryColor: "#2a9d8f" });
    valid(rich, lieu + " tous indices");
    assert.ok(rich.length > C.carteTaskModel({ ...base, state: "doing", progress: 60 }, "ville", { style: "dnd", lieu }).length, lieu + " : les indices ajoutent des pièces");
    for (let stage = 0; stage <= 5; stage++) valid(C.carteHubModel("ville", stage, "#e07a3f", "normal", "dnd", lieu), `${lieu} cœur ${stage}`);
    Object.values(L.tiles).slice(0, 300).forEach((t) => C.carteDecorModel(t, C.CARTE_THEMES[0].pal, "ville", "dnd", lieu).forEach((p) => { assert.ok(geos.has(p.g)); assert.match(p.c, /^#[0-9a-f]{6}$/i); }));
  });
  // Le modèle est stable (pas d'aléa hors hachage).
  assert.deepEqual(C.carteTaskModel(full, "ville", { style: "dnd", lieu: "arene" }), C.carteTaskModel(full, "ville", { style: "dnd", lieu: "arene" }));
});
