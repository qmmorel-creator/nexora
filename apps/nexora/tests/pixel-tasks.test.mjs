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

test("pixelTasksForDay : une tâche en retard terminée un jour reste affichée ce jour-là", () => {
  const today = "2026-09-29";
  const caught = T("caught", { end: "2026-09-20", statusId: "s5", completedAt: "2026-09-29T08:00:00" });
  const d = P.pixelTasksForDay([caught], today, today, statuses);
  assert.deepEqual(d.items.map((i) => [i.task.id, i.done, i.carried, i.lateDays]), [["caught", true, true, 0]]);
  assert.equal(P.pixelTasksForDay([caught], "2026-09-28", today, statuses).total, 0);
  assert.equal(P.pixelTasksForDay([caught], "2026-09-20", today, statuses).total, 1);
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
  assert.deepEqual([...P.PIXEL_TASKS_FUTURE_WINDOWS], [0, 7, 14, 30]);
});

test("pixelTaskOutlinePath : départ au milieu du bord haut, carré arrondi ou rond", () => {
  assert.match(P.pixelTaskOutlinePath(28, 5, 0.75, false), /^M 14 0\.75 H /);
  assert.match(P.pixelTaskOutlinePath(28, 5, 0.75, false), / Z$/);
  assert.match(P.pixelTaskOutlinePath(28, 5, 1, true), /^M 14 1 A 13 13 0 1 1 13\.99 1$/);
});
