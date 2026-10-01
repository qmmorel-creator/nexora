/* Pixel Tasks (#524). La tranche testée est extraite du bundle RÉELLEMENT
   construit, entre les sentinelles NEXORA:PIXEL-TASKS, avec NEXORA:DATE-UTILS. */

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

const P = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("PIXEL-TASKS")}\n;return {
    pixelTaskDate, pixelTaskIsDone, pixelTasksForDay, pixelTaskGroupsFor, pixelTasksSquareSize, PIXEL_TASKS_GROUP_BY, PIXEL_TASKS_PACKAGE_BY, pixelTaskRingValue, pixelTaskOutlinePath, PIXEL_TASKS_FUTURE_WINDOWS,
    PIXEL_TASKS_SUB_BY, pixelTaskSpectrum, pixelTaskBud, pixelTaskVisibleGroups,
    pixelTaskParseQuickAdd, pixelTaskReschedule, pixelTaskNextMonday, pixelTaskMatches, pixelTaskFilterActive,
    pixelTaskLoad, pixelTaskOverflowCandidates, pixelTaskMinutesLabel, pixelTaskClosureList,
  };\n})`
)();

const statuses = [{ id: "s1", name: "À planifier" }, { id: "s3", name: "En cours" }, { id: "s5", name: "Terminé" }];
const T = (id, extra) => ({ id, title: "Tâche " + id, statusId: "s1", ...extra });

test("pixelTaskDate : jalon → date de jalon, sinon date de fin, replis sur l'autre borne", () => {
  assert.equal(P.pixelTaskDate(T("a", { start: "2026-09-01", end: "2026-09-30" })), "2026-09-30");
  assert.equal(P.pixelTaskDate(T("b", { milestone: true, start: "2026-09-12", end: "2026-09-12" })), "2026-09-12");
  assert.equal(P.pixelTaskDate(T("c", { milestone: true, start: "", end: "2026-09-14" })), "2026-09-14");
  assert.equal(P.pixelTaskDate(T("d", { start: "2026-09-02", end: "" })), "2026-09-02");
  assert.equal(P.pixelTaskDate(T("e", { start: "", end: "NaN-NaN-NaN" })), null);
});

test("pixelTasksForDay : une tâche n'apparaît qu'à sa date, jamais sur toute sa durée", () => {
  const tasks = [T("long", { start: "2026-09-01", end: "2026-09-30" })];
  assert.equal(P.pixelTasksForDay(tasks, "2026-09-15", "2026-09-01", statuses).total, 0);
  assert.equal(P.pixelTasksForDay(tasks, "2026-09-30", "2026-09-01", statuses).total, 1);
});

test("pixelTasksForDay : aujourd'hui reprend les retards non terminés, pas les tâches terminées", () => {
  const today = "2026-09-29";
  const tasks = [
    T("late", { end: "2026-09-27" }),
    T("doneLate", { end: "2026-09-27", statusId: "s5" }),
    T("today", { end: today, statusId: "s5" }),
    T("future", { end: "2026-10-01" }),
  ];
  const d = P.pixelTasksForDay(tasks, today, today, statuses);
  assert.deepEqual(d.items.map((i) => i.task.id), ["late", "today"]);
  assert.equal(d.items[0].lateDays, 2);
  assert.equal(d.items[0].carried, true);
  assert.equal(d.done, 1);
  assert.equal(d.total, 2);
  // Le jour d'origine garde la tâche, marquée en retard ; un autre jour passé, non.
  const past = P.pixelTasksForDay(tasks, "2026-09-27", today, statuses);
  assert.deepEqual(past.items.map((i) => [i.task.id, i.lateDays]), [["late", 2], ["doneLate", 0]]);
  assert.equal(P.pixelTasksForDay(tasks, "2026-09-28", today, statuses).total, 0);
});

test("pixelTaskGroupsFor : projet par défaut, groupe « Sans … » en dernier, compteurs", () => {
  const ctx = { projects: [{ id: "p1", name: "Lot 1", color: "#f00" }, { id: "p2", name: "Alpha", color: "#0f0" }], statuses, teamMembers: [{ name: "Quentin Morel", color: "#869afe" }], taskTypes: [] };
  const items = [
    { task: T("a", { projectId: "p1", assignee: "Quentin Morel" }), done: true },
    { task: T("b", { projectId: "p2" }), done: false },
    { task: T("c", {}), done: false },
    { task: T("d", { projectId: "p1" }), done: false },
  ];
  const g = P.pixelTaskGroupsFor(items, "project", ctx);
  assert.deepEqual(g.map((x) => [x.name, x.items.length, x.done]), [["Alpha", 1, 0], ["Lot 1", 2, 1], ["Sans projet", 1, 0]]);
  const a = P.pixelTaskGroupsFor(items, "assignee", ctx);
  assert.deepEqual(a.map((x) => x.name), ["Quentin Morel", "Non attribuée"]);
  assert.equal(a[0].color, "#869afe");
  assert.equal(P.pixelTasksSquareSize(g), 3);
  assert.equal(P.pixelTasksSquareSize([]), 1);
});

test("pixelTasksForDay : une tâche terminée ne s'affiche qu'à sa date, même terminée aujourd'hui", () => {
  const today = "2026-09-29";
  const closed = T("closed", { start: "2026-08-26", end: "2026-08-26", statusId: "s5", completedAt: "2026-09-29T14:12:00" });
  assert.equal(P.pixelTasksForDay([closed], today, today, statuses).total, 0);
  assert.equal(P.pixelTasksForDay([closed], "2026-08-26", today, statuses).total, 1);
});

test("pixelTaskGroupsFor : regroupement par dossier du projet, chemin complet", () => {
  const ctx = {
    projects: [{ id: "p1", name: "Lot 1", folderId: "f2" }, { id: "p2", name: "Perso", folderId: "f3" }, { id: "p3", name: "Lot 2B", folderId: "f2" }],
    projectFolders: [{ id: "f1", name: "CNR", color: "#123456" }, { id: "f2", name: "PCH VA", parentId: "f1", color: "#abcdef" }, { id: "f3", name: "Vie perso" }],
    statuses, taskTypes: [], teamMembers: [],
  };
  const items = [
    { task: T("a", { projectId: "p1" }), done: false },
    { task: T("b", { projectId: "p3" }), done: true },
    { task: T("c", { projectId: "p2" }), done: false },
    { task: T("d", { projectId: "inconnu" }), done: false },
  ];
  const g = P.pixelTaskGroupsFor(items, "folder", ctx);
  assert.deepEqual(g.map((x) => [x.name, x.items.length, x.done]), [["CNR › PCH VA", 2, 1], ["Vie perso", 1, 0], ["Sans dossier", 1, 0]]);
  assert.equal(g[0].color, "#abcdef");
  assert.ok(P.PIXEL_TASKS_GROUP_BY.some(([k]) => k === "folder"));
});

test("pixelTaskGroupsFor : packages de cases dans une rangée, lignes dans le même ordre", () => {
  const ctx = { projects: [{ id: "p1", name: "Lot 1" }], statuses: [{ id: "s1", name: "À planifier", color: "#64748B" }, { id: "s3", name: "En cours", color: "#0EA5E9" }], taskTypes: [], teamMembers: [] };
  const items = [
    { task: T("a", { projectId: "p1", statusId: "s3" }), done: false },
    { task: T("b", { projectId: "p1", statusId: "s1", milestone: true }), done: false },
    { task: T("c", { projectId: "p1", statusId: "s3", milestone: true }), done: true },
  ];
  const [g] = P.pixelTaskGroupsFor(items, "project", ctx, "status");
  assert.deepEqual(g.packages.map((p) => [p.name, p.start, p.count]), [["À planifier", 0, 1], ["En cours", 1, 2]]);
  assert.deepEqual(g.items.map((i) => i.task.id), ["b", "a", "c"]);
  const [k] = P.pixelTaskGroupsFor(items, "project", ctx, "kind");
  assert.deepEqual(k.packages.map((p) => [p.name, p.count]), [["Jalons", 2], ["Tâches avec durée", 1]]);
  const [n] = P.pixelTaskGroupsFor(items, "project", ctx, "none");
  assert.deepEqual(n.packages, [{ id: "all", name: "", color: n.color, start: 0, count: 3 }]);
  assert.ok(P.PIXEL_TASKS_PACKAGE_BY.some(([key]) => key === "kind"));
});

test("pixelTaskGroupsFor : sous-groupes « Rameaux » sous chaque groupe (#546)", () => {
  const ctx = {
    projects: [{ id: "p1", name: "Lot 1", color: "#111111" }, { id: "p2", name: "Lot 2", color: "#222222" }],
    statuses: [{ id: "s1", name: "À planifier", color: "#64748B" }, { id: "s3", name: "En cours", color: "#0EA5E9" }],
    taskTypes: [], teamMembers: [{ name: "Quentin Morel", color: "#abcdef" }],
  };
  const items = [
    { task: T("a", { projectId: "p1", assignee: "Quentin Morel" }), done: true },
    { task: T("b", { projectId: "p1" }), done: false },
    { task: T("c", { projectId: "p1", assignee: "Quentin Morel", milestone: true }), done: false },
    { task: T("d", { projectId: "p2", assignee: "Quentin Morel" }), done: true },
    { task: T("g", { projectId: "p1" }), done: false, ghost: true },
  ];
  const [g1, g2] = P.pixelTaskGroupsFor(items, "project", ctx, "kind", "assignee");
  assert.deepEqual(g1.subgroups.map((s) => [s.name, s.key, s.done, s.total, s.items.length]), [
    ["Quentin Morel", "p:p1›a:Quentin Morel", 1, 2, 2],
    ["Non attribuée", "p:p1›none", 0, 1, 2],
  ]);
  assert.equal(g1.subgroups[0].color, "#abcdef");
  // Chaque sous-groupe garde ses packages ; le groupe les met bout à bout.
  assert.deepEqual(g1.subgroups[0].packages.map((p) => [p.name, p.start, p.count]), [["Jalons", 0, 1], ["Tâches avec durée", 1, 1]]);
  assert.deepEqual(g1.subgroups[1].packages.map((p) => [p.id, p.start, p.count]), [["k:task", 0, 1], ["ghost", 1, 1]]);
  assert.deepEqual(g1.items.map((i) => i.task.id), ["c", "a", "b", "g"]);
  assert.deepEqual(g1.packages.map((p) => [p.start, p.count]), [[0, 1], [1, 1], [2, 1], [3, 1]]);
  assert.equal(new Set(g1.packages.map((p) => p.id)).size, 4);
  assert.deepEqual([g1.done, g1.total], [1, 3]);
  assert.deepEqual(g2.subgroups.map((s) => s.name), ["Quentin Morel"]);
  // Aucun sous-groupe : « none », absent, ou même clé que les groupes.
  for (const sub of ["none", undefined, "project"]) {
    const [g] = P.pixelTaskGroupsFor(items, "project", ctx, "none", sub);
    assert.equal(g.subgroups, undefined);
  }
  assert.deepEqual(P.PIXEL_TASKS_SUB_BY.map(([k]) => k), ["none", "project", "folder", "status", "assignee", "taskType", "kind"]);
});

test("pixelTaskSpectrum et pixelTaskBud : ruban proportionnel et bourgeon qui éclôt", () => {
  const subs = [
    { key: "x", name: "A", color: "#f00", done: 3, total: 3, items: [1, 2, 3] },
    { key: "y", name: "B", color: "#0f0", done: 0, total: 1, items: [1] },
    { key: "z", name: "C", color: "#00f", done: 0, total: 0, items: [1, 2] },
  ];
  const sp = P.pixelTaskSpectrum(subs);
  assert.deepEqual(sp.map((s) => [s.id, +s.weight.toFixed(3), s.done]), [["x", 0.5, 1], ["y", 0.167, 0], ["z", 0.333, 0]]);
  assert.deepEqual(P.pixelTaskSpectrum([]), []);
  assert.deepEqual(P.pixelTaskBud(subs[0]), { share: 1, bloom: true, empty: false });
  assert.deepEqual(P.pixelTaskBud({ done: 1, total: 4 }), { share: 0.25, bloom: false, empty: false });
  assert.deepEqual(P.pixelTaskBud(subs[2]), { share: 0, bloom: false, empty: true });
});

test("pixelTaskRingValue : 0 en haut, sens horaire, pas de 5 %", () => {
  assert.equal(P.pixelTaskRingValue(0, -10), 0);
  assert.equal(P.pixelTaskRingValue(10, 0), 25);
  assert.equal(P.pixelTaskRingValue(0, 10), 50);
  assert.equal(P.pixelTaskRingValue(-10, 0), 75);
  assert.equal(P.pixelTaskRingValue(-0.5, -10), 100);
  assert.equal(P.pixelTaskRingValue(Math.sin(0.4 * 2 * Math.PI), -Math.cos(0.4 * 2 * Math.PI)), 40);
});

test("pixelTasksForDay : fantômes = tâches en cours (début avant, fin après), hors score", () => {
  const today = "2026-09-29";
  const tasks = [
    T("run", { start: "2026-09-20", end: "2026-10-05" }),
    T("startsToday", { start: today, end: "2026-10-05" }),
    T("ms", { milestone: true, start: "2026-10-02", end: "2026-10-02" }),
    T("due", { start: "2026-09-01", end: today, statusId: "s5" }),
  ];
  const off = P.pixelTasksForDay(tasks, today, today, statuses);
  assert.deepEqual(off.items.map((i) => i.task.id), ["due"]);
  const on = P.pixelTasksForDay(tasks, today, today, statuses, { ghosts: true });
  assert.deepEqual(on.items.map((i) => [i.task.id, !!i.ghost]), [["due", false], ["run", true]]);
  assert.equal(on.total, 1);
  assert.equal(on.done, 1);
  assert.equal(on.ghosts, 1);
  const [g] = P.pixelTaskGroupsFor(on.items, "project", { projects: [], statuses }, "none");
  assert.deepEqual(g.packages.map((p) => [p.id, p.count]), [["all", 1], ["ghost", 1]]);
  assert.equal(g.total, 1);
});

test("pixelTasksForDay : futur = tâches entièrement à venir dans la fenêtre, hors score, après les fantômes", () => {
  const today = "2026-09-29";
  const tasks = [
    T("soon", { start: "2026-10-01", end: "2026-10-03" }),
    T("ms", { milestone: true, start: "2026-10-01", end: "2026-10-01" }),
    T("far", { start: "2026-11-01", end: "2026-11-02" }),
    T("running", { start: "2026-09-20", end: "2026-10-02" }),
    T("base", { start: today, end: today }),
  ];
  const d = P.pixelTasksForDay(tasks, today, today, statuses, { ghosts: true, futureDays: 14 });
  assert.deepEqual(d.items.map((i) => [i.task.id, i.ghost ? "g" : i.future ? "f" + i.daysAhead : "b"]), [["base", "b"], ["running", "g"], ["ms", "f2"], ["soon", "f4"]]);
  assert.equal(d.total, 1);
  assert.equal(d.future, 2);
  // La tâche en cours n'est jamais « future », même sans fantômes.
  const noGhost = P.pixelTasksForDay(tasks, today, today, statuses, { futureDays: 14 });
  assert.deepEqual(noGhost.items.map((i) => i.task.id), ["base", "ms", "soon"]);
  const [g] = P.pixelTaskGroupsFor(d.items, "project", { projects: [], statuses }, "none");
  assert.deepEqual(g.packages.map((p) => [p.id, p.count]), [["all", 1], ["ghost", 1], ["future", 2]]);
  assert.equal(g.total, 1);
  assert.deepEqual([...P.PIXEL_TASKS_FUTURE_WINDOWS], [0, 7, 14, 30, 90]);
});

test("pixelTaskOutlinePath : départ au milieu du bord haut, carré arrondi ou rond", () => {
  assert.match(P.pixelTaskOutlinePath(28, 5, 0.75, false), /^M 14 0\.75 H /);
  assert.match(P.pixelTaskOutlinePath(28, 5, 0.75, false), / Z$/);
  assert.match(P.pixelTaskOutlinePath(28, 5, 1, true), /^M 14 1 A 13 13 0 1 1 13\.99 1$/);
});

test("pixelTaskVisibleGroups : terminées masquées, compteurs de la journée complète conservés", () => {
  const today = "2026-09-29";
  const ctx = { statuses, projects: [{ id: "p1", name: "Alpha" }, { id: "p2", name: "Beta" }] };
  const tasks = [
    T("a", { projectId: "p1", end: today }),
    T("b", { projectId: "p1", end: today, statusId: "s5" }),
    T("c", { projectId: "p2", end: today, statusId: "s5" }),
  ];
  const d = P.pixelTasksForDay(tasks, today, today, statuses);
  const full = P.pixelTaskGroupsFor(d.items, "project", ctx, "none", "none");
  // Sans option : les groupes complets, inchangés.
  assert.equal(P.pixelTaskVisibleGroups(d.items, full, {}, "project", ctx, "none", "none"), full);
  const vis = P.pixelTaskVisibleGroups(d.items, full, { hideDone: true }, "project", ctx, "none", "none");
  // Beta, entièrement terminé, disparaît ; Alpha garde « 1 / 2 ».
  assert.deepEqual(vis.map((g) => [g.name, g.items.map((i) => i.task.id), g.done, g.total]), [["Alpha", ["a"], 1, 2]]);
  assert.equal(vis[0].packages.reduce((n, p) => n + p.count, 0), 1);
  // Sous-groupes : compteurs restaurés par clé.
  const fullSub = P.pixelTaskGroupsFor(d.items, "project", ctx, "none", "status");
  const visSub = P.pixelTaskVisibleGroups(d.items, fullSub, { hideDone: true }, "project", ctx, "none", "status");
  assert.deepEqual(visSub[0].subgroups.map((sg) => [sg.name, sg.items.length, sg.done, sg.total]), [["À planifier", 1, 0, 1]]);
});

// 2026-09-30 est un mercredi.
test("pixelTaskParseQuickAdd : titre, !jalon, @responsable, >date (#557)", () => {
  const team = [{ name: "Carla" }, { name: "Quentin Morel" }, { name: "Quentin" }];
  const d = "2026-09-30";
  assert.deepEqual(P.pixelTaskParseQuickAdd("Relancer Maia", d, team), { title: "Relancer Maia", milestone: false, assignee: "", date: d });
  const a = P.pixelTaskParseQuickAdd("Relancer Maia @quentin morel >ven !jalon", d, team);
  assert.deepEqual(a, { title: "Relancer Maia", milestone: true, assignee: "Quentin Morel", date: "2026-10-02" });
  assert.equal(P.pixelTaskParseQuickAdd("x @Cârla", d, team).assignee, "Carla");
  assert.equal(P.pixelTaskParseQuickAdd("x @Inconnu suite", d, team).assignee, "Inconnu");
  assert.equal(P.pixelTaskParseQuickAdd("x @Inconnu suite", d, team).title, "x suite");
  assert.equal(P.pixelTaskParseQuickAdd("x >demain", d, team).date, "2026-10-01");
  assert.equal(P.pixelTaskParseQuickAdd("x >mer", d, team).date, "2026-10-07", "jamais le jour même");
  assert.equal(P.pixelTaskParseQuickAdd("x >+3", d, team).date, "2026-10-03");
  assert.equal(P.pixelTaskParseQuickAdd("x >12/10", d, team).date, "2026-10-12");
  assert.equal(P.pixelTaskParseQuickAdd("x >02/01", d, team).date, "2027-01-02", "date passée : année suivante");
  // Un « > » non reconnu reste dans le titre.
  assert.equal(P.pixelTaskParseQuickAdd("A >B", d, team).title, "A >B");
  assert.equal(P.pixelTaskParseQuickAdd("A >31/02", d, team).date, d);
});

test("pixelTaskReschedule et pixelTaskNextMonday (#558, #559)", () => {
  assert.deepEqual(P.pixelTaskReschedule({ start: "2026-09-01", end: "2026-09-30" }, "2026-10-01"), { end: "2026-10-01" });
  assert.deepEqual(P.pixelTaskReschedule({ start: "2026-09-29", end: "2026-09-30" }, "2026-09-28"), { end: "2026-09-28", start: "2026-09-28" });
  assert.deepEqual(P.pixelTaskReschedule({ milestone: true, start: "2026-09-30", end: "2026-09-30" }, "2026-10-02"), { start: "2026-10-02", end: "2026-10-02" });
  assert.equal(P.pixelTaskReschedule({ start: "2026-09-30", end: "2026-09-30" }, "2026-09-30"), null);
  assert.equal(P.pixelTaskReschedule({ end: "2026-09-30" }, "pas une date"), null);
  assert.equal(P.pixelTaskNextMonday("2026-09-30"), "2026-10-05");
  assert.equal(P.pixelTaskNextMonday("2026-10-05"), "2026-10-12");
});

test("pixelTaskMatches : recherche et puces combinables (#563)", () => {
  const it = (task, extra) => ({ task: { title: "", ...task }, done: false, lateDays: 0, ...extra });
  const a = it({ title: "Audit SOCOTEC béton", assignee: "Carla", focus: true }, { lateDays: 2 });
  const b = it({ title: "Jalon PV", milestone: true });
  assert.equal(P.pixelTaskMatches(a, { query: "socotec beton" }), true);
  assert.equal(P.pixelTaskMatches(b, { query: "socotec" }), false);
  assert.equal(P.pixelTaskMatches(a, { late: true, focus: true, assignee: "Carla" }), true);
  assert.equal(P.pixelTaskMatches({ ...a, done: true }, { late: true }), false);
  assert.equal(P.pixelTaskMatches(b, { milestone: true }), true);
  assert.equal(P.pixelTaskMatches(a, { milestone: true }), false);
  assert.equal(P.pixelTaskFilterActive({ query: "  " }), false);
  assert.equal(P.pixelTaskFilterActive({ late: true }), true);
});

test("pixelTaskLoad : estimations, réunions horodatées, dépassement et report proposé (#561)", () => {
  const d = "2026-09-30";
  const it = (id, est, extra) => ({ task: { id, title: id, estimateMinutes: est, start: d, end: d, ...(extra && extra.task) }, done: false, lateDays: 0, ...(extra && extra.item) });
  const items = [
    it("a", 120), it("b", 90), it("c", 60, { task: { focus: true } }), it("d", 0), it("e", 240, { item: { done: true } }),
    it("f", 30, { item: { lateDays: 3 } }), it("g", 45, { item: { ghost: true } }),
  ];
  const meetings = [{ start: d, end: d, startTime: "09:00", endTime: "11:00" }, { start: d, end: d, startTime: "14:00", endTime: "14:30" }, { start: "2026-09-29", end: d, startTime: "09:00", endTime: "10:00" }];
  const l = P.pixelTaskLoad(items, meetings, d, 420, (x) => ({ id: x.task.id === "a" ? "p1" : "p2", name: "", color: "" }));
  assert.equal(l.busy, 150);
  assert.equal(l.free, 270);
  assert.equal(l.planned, 300);
  assert.equal(l.unestimated, 1);
  assert.equal(l.over, 30);
  assert.deepEqual(l.parts.map((p) => [p.id, p.minutes]), [["p1", 120], ["p2", 180]]);
  // Ni Focus, ni retard : « a » (2 h) suffit à couvrir 30 min.
  assert.deepEqual(P.pixelTaskOverflowCandidates(items, l.over, d).map((x) => x.task.id), ["a"]);
  assert.deepEqual(P.pixelTaskOverflowCandidates(items, 0, d), []);
  assert.equal(P.pixelTaskMinutesLabel(90), "1 h 30");
  assert.equal(P.pixelTaskMinutesLabel(45), "45 min");
  assert.equal(P.pixelTaskMinutesLabel(120), "2 h");
});

test("pixelTaskClosureList : non terminées, retards les plus anciens d'abord (#562)", () => {
  const it = (id, extra) => ({ task: { id }, done: false, lateDays: 0, ...extra });
  const list = P.pixelTaskClosureList([it("a"), it("b", { lateDays: 2 }), it("c", { done: true }), it("d", { lateDays: 9 }), it("e", { ghost: true }), it("f")]);
  assert.deepEqual(list.map((x) => x.task.id), ["d", "b", "a", "f"]);
});

test("pixelTaskVisibleGroups : filtre keep (#560, #563), compteurs conservés", () => {
  const today = "2026-09-29";
  const ctx = { statuses, projects: [{ id: "p1", name: "Alpha" }] };
  const tasks = [T("a", { projectId: "p1", end: today, focus: true }), T("b", { projectId: "p1", end: today })];
  const d = P.pixelTasksForDay(tasks, today, today, statuses);
  const full = P.pixelTaskGroupsFor(d.items, "project", ctx, "none", "none");
  const vis = P.pixelTaskVisibleGroups(d.items, full, { keep: (i) => i.task.focus !== true }, "project", ctx, "none", "none");
  assert.deepEqual(vis.map((g) => [g.items.map((i) => i.task.id), g.done, g.total]), [[["b"], 0, 2]]);
});
