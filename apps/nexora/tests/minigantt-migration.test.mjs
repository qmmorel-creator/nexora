import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../.build/index.html", import.meta.url), "utf8");
const start = source.indexOf("// === NEXORA:MINIGANTT-MIGRATION:START ===");
const end = source.indexOf("// === NEXORA:MINIGANTT-MIGRATION:END ===");
assert.ok(start >= 0 && end > start, "migration Mini Gantt introuvable dans le build");
const block = source.slice(start, end).replace(/const /g, "var ");
const api = new Function(`${block}; return { migrateLegacyMiniGanttWidget, migrateLegacyMiniGanttData, normalizeMiniGanttViewPrefs };`)();

test("un ancien widget est converti sans perdre son identité ni ses propriétés", () => {
  const oldType = "embed" + "Gantt";
  const old = { id: "w1", type: oldType, title: "Planning", layout: { x: 2, y: 3, w: 8, h: 9 }, filter: { projectIds: ["p1"] }, ganttAnnotations: { temporalBlocks: [{ id: "b1" }] }, unknown: "keep" };
  const next = api.migrateLegacyMiniGanttWidget(old);
  assert.equal(next.type, "minigantt");
  assert.equal(next.id, old.id);
  assert.deepEqual(next.layout, old.layout);
  assert.deepEqual(next.filter, old.filter);
  assert.deepEqual(next.ganttAnnotations, old.ganttAnnotations);
  assert.equal(next.unknown, "keep");
  assert.deepEqual(api.migrateLegacyMiniGanttWidget(next), next);
});

test("la migration couvre tableaux, pages, Aujourd’hui et objets partiels", () => {
  const oldType = "embed" + "Gantt";
  const value = [{ id: "d", widgets: [{ id: "a", type: oldType }], pages: [{ id: "p", widgets: [{ id: "b", type: oldType, title: "B" }] }] }, { pages: [{ widgets: [{ id: "c", type: "minigantt" }] }] }];
  const next = api.migrateLegacyMiniGanttData(value);
  assert.equal(next[0].widgets[0].type, "minigantt");
  assert.equal(next[0].pages[0].widgets[0].type, "minigantt");
  assert.equal(next[1].pages[0].widgets[0].type, "minigantt");
  assert.equal(api.migrateLegacyMiniGanttData(null), null);
});

test("les préférences historiques gantt deviennent des préférences Mini Gantt", () => {
  const prefs = api.normalizeMiniGanttViewPrefs({ ganttGroupBy: "status", ganttCols: ["status", "progress"] });
  assert.equal(prefs.groupBy, "status");
  assert.deepEqual(prefs.miniGanttFields, ["status", "progress"]);
  assert.equal(prefs.miniGanttSort, "start");
});
