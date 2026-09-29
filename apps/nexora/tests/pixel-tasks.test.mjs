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
    pixelTaskDate, pixelTaskIsDone, pixelTasksForDay, pixelTaskGroupsFor, pixelTasksSquareSize, PIXEL_TASKS_GROUP_BY,
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
