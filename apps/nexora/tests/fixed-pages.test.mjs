/* Pages fixes (Cockpit du jour, Semaine). Même principe que les autres
   suites : la tranche testée est extraite du bundle RÉELLEMENT construit,
   jamais recopiée. */

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

const F = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("TEXT-MATCH")}\n${slice("TASK-STATUS")}\n${slice("FIXED-PAGES")}\n;return {
    isTaskDoneGlobal, isTaskLate, isMeetingTask,
    fixedPageProjectMeta, daysLate, overdueTasksSorted, tasksForDate, weekFlowDays,
  };\n})`
)();

const statuses = [{ id: "s1", name: "À planifier" }, { id: "s2", name: "En cours" }, { id: "s3", name: "Terminé" }];
const taskTypes = [{ id: "tt1", name: "Tâches" }, { id: "tt2", name: "Réunions" }];
const projects = [{ id: "p1", name: "Lot 1", color: "#bdcaff" }, { id: "p2", name: "Perso", color: "#22B07D" }];
const ctx = { statuses, taskTypes, projects };

const task = (id, extra) => ({ id, title: `Tâche ${id}`, projectId: "p1", statusId: "s1", end: "2026-09-20", ...extra });

test("isMeetingTask : type explicite, jamais deviné sur le titre", () => {
  const meeting = task("m1", { taskTypeId: "tt2", title: "Point budget" });
  const fakeMeeting = task("m2", { taskTypeId: "tt1", title: "Préparer la réunion" });
  assert.equal(F.isMeetingTask(meeting, ctx), true);
  assert.equal(F.isMeetingTask(fakeMeeting, ctx), false);
});

test("isMeetingTask : insensible aux accents/casse et au singulier/pluriel", () => {
  const ctxAccent = { ...ctx, taskTypes: [{ id: "tt9", name: "RÉUNION" }] };
  assert.equal(F.isMeetingTask(task("m3", { taskTypeId: "tt9" }), ctxAccent), true);
});

test("fixedPageProjectMeta : reprend le nom/couleur du projet, replis si absent", () => {
  assert.deepEqual(F.fixedPageProjectMeta(task("t1"), ctx), { projectName: "Lot 1", projectColor: "#bdcaff" });
  assert.deepEqual(F.fixedPageProjectMeta(task("t2", { projectId: "inconnu" }), ctx), { projectName: "", projectColor: "#7A8290" });
});

test("daysLate : nombre de jours dépassés, jamais négatif", () => {
  assert.equal(F.daysLate(task("t1", { end: "2026-09-10" }), "2026-09-20"), 10);
  assert.equal(F.daysLate(task("t2", { end: "2026-09-25" }), "2026-09-20"), 0);
});

// isTaskLate lit new Date() en interne (comme partout ailleurs dans l'app) :
// on construit donc les dates RELATIVEMENT à aujourd'hui plutôt que de
// simuler l'horloge, pour rester robuste sans dépendre d'une date figée.
const daysAgoIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const daysAheadIso = (n) => daysAgoIso(-n);

test("overdueTasksSorted : seulement les tâches en retard, triées de la plus ancienne échéance à la plus récente", () => {
  const tasks = [
    task("a", { end: daysAgoIso(5) }),
    task("b", { end: daysAgoIso(15), statusId: "s3" }), // terminée -> jamais en retard
    task("c", { end: daysAgoIso(10) }),
    task("d", { end: daysAheadIso(30) }), // futur -> pas en retard
  ];
  const out = F.overdueTasksSorted(tasks, ctx);
  assert.deepEqual(out.map((t) => t.id), ["c", "a"]);
  assert.equal(out[0].projectName, "Lot 1");
});

test("tasksForDate : tâches actives ce jour-là (enjambant compris), jamais les terminées", () => {
  const tasks = [
    task("a", { start: "2026-09-18", end: "2026-09-22" }), // enjambe le 20
    task("b", { start: "2026-09-20", end: "2026-09-20" }),
    task("c", { start: "2026-09-21", end: "2026-09-25" }), // pas encore
    task("d", { start: "2026-09-20", end: "2026-09-20", statusId: "s3" }), // terminée
  ];
  const ids = F.tasksForDate(tasks, ctx, "2026-09-20").map((t) => t.id);
  assert.deepEqual(ids.sort(), ["a", "b"]);
});

test("tasksForDate : les réunions remontent en tête du jour", () => {
  const tasks = [
    task("z-task", { start: "2026-09-20", end: "2026-09-20", taskTypeId: "tt1", title: "Zèbre" }),
    task("a-meeting", { start: "2026-09-20", end: "2026-09-20", taskTypeId: "tt2", title: "Aloha" }),
  ];
  const out = F.tasksForDate(tasks, ctx, "2026-09-20");
  assert.equal(out[0].id, "a-meeting");
  assert.equal(out[0].isMeeting, true);
  assert.equal(out[1].isMeeting, false);
});

test("weekFlowDays : un groupe par jour sur la période demandée, aujourd'hui inclus", () => {
  const tasks = [task("a", { start: "2026-09-22", end: "2026-09-22" })];
  const days = F.weekFlowDays(tasks, ctx, "2026-09-20", 7);
  assert.equal(days.length, 7);
  assert.equal(days[0].date, "2026-09-20");
  assert.equal(days[6].date, "2026-09-26");
  const day22 = days.find((d) => d.date === "2026-09-22");
  assert.equal(day22.items.length, 1);
  assert.equal(days[0].items.length, 0);
});

test("weekFlowDays : la largeur par défaut est 7 jours", () => {
  const days = F.weekFlowDays([], ctx, "2026-09-20");
  assert.equal(days.length, 7);
});
