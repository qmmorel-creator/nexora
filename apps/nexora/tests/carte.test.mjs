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

test("mêmes données, même carte ; 14 thèmes disponibles", () => {
  const w = world(20, 300);
  assert.equal(JSON.stringify(build(w)), JSON.stringify(build(w)));
  assert.equal(C.CARTE_THEMES.length, 14);
  ["ville", "desert", "mer", "lac", "montagne", "hautemontagne", "marais", "jungle", "volcan", "ile"].forEach((id) => assert.ok(C.CARTE_THEME_BY_ID[id], id));
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

test("la construction d'une tâche en cours suit les paliers de progress", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const height = (pr) => C.carteTaskModel({ ...base, progress: pr }, "ville", { detail: 0 }).filter((p) => p.c !== "#c9a060").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  assert.ok(height(10) < height(50) && height(50) < height(90), `${height(10)} < ${height(50)} < ${height(90)}`);
  assert.equal(height(20), height(39), "même palier, même hauteur");
});

test("filtres de la vue et préférences normalisées", () => {
  const t = { state: "done", criticality: "urgent", overdue: false, oldDone: true };
  assert.equal(C.carteMatches(t, { states: ["done"], history: false }), false, "terminée depuis plus de 30 jours masquée par défaut");
  assert.equal(C.carteMatches(t, { states: ["done"], history: true, crit: "urgent" }), true);
  assert.equal(C.carteMatches(t, { states: ["todo"], history: true }), false);
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
