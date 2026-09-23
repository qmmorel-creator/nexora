/* Méta partagée par les pages qui listent des tâches datées (le Calendrier).
   Les anciennes pages fixes Cockpit du jour et Semaine ont été retirées
   (#327) avec leurs fonctions propres (daysLate, overdueTasksSorted,
   tasksForDate, weekFlowDays) ; seules les fonctions encore utilisées
   ailleurs (isMeetingTask, fixedPageProjectMeta) restent couvertes ici.
   Comme les autres suites : la tranche testée est extraite du bundle
   RÉELLEMENT construit, jamais recopiée. */

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
    fixedPageProjectMeta,
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
