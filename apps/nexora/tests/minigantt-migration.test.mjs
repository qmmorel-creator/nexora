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

test("#318 : les widgets Échéances, anciens types compris, sont retirés à la lecture", () => {
  const value = [{ id: "d", widgets: [
    { id: "a", type: "echeances", echeancesOrientation: "verticale" },
    { id: "b", type: "chart" },
    { id: "c", type: "deadlineScatter" },
  ], pages: [{ id: "p", widgets: [{ id: "e", type: "metroDeadline" }, { id: "f", type: "milestoneTimeline" }, { id: "g", type: "verticalMetroTimeline" }, { id: "h", type: "list" }] }] }];
  const next = api.migrateLegacyMiniGanttData(value);
  assert.deepEqual(next[0].widgets.map((w) => w.id), ["b"]);
  assert.deepEqual(next[0].pages[0].widgets.map((w) => w.id), ["h"]);
  assert.equal(next[0].id, "d");
});

test("les préférences historiques gantt deviennent des préférences Mini Gantt", () => {
  const prefs = api.normalizeMiniGanttViewPrefs({ ganttGroupBy: "status", ganttCols: ["status", "progress"] });
  assert.equal(prefs.groupBy, "status");
  assert.deepEqual(prefs.miniGanttFields, ["status", "progress"]);
  assert.equal(prefs.miniGanttSort, "start");
  assert.equal(prefs.showMilestones, true);
  assert.equal(prefs.colorBy, "status");
  assert.equal(prefs.miniGanttFieldsLayout, "aligned");
  assert.equal(prefs.miniGanttComparisonEnabled, false);
});

test("les préférences Mini Gantt déjà enregistrées restent complètes dans la vue", () => {
  const annotations = { temporalBlocks: [{ id: "phase" }], notes: [{ id: "note" }] };
  const prefs = api.normalizeMiniGanttViewPrefs({
    groupBy: "assignee", showMilestones: false, colorBy: "taskType",
    miniGanttFields: ["progress"], miniGanttFieldsLayout: "inline",
    miniGanttSort: "title", miniGanttSortDir: "desc",
    miniGanttRange: { mode: "rolling", beforeMonths: 2, afterMonths: 6 },
    miniGanttWindow: { start: "2026-01-01", end: "2026-12-31" },
    miniGanttZoomLevel: 1, miniGanttComparisonEnabled: true, ganttAnnotations: annotations,
  });
  assert.equal(prefs.groupBy, "assignee");
  assert.equal(prefs.showMilestones, false);
  assert.equal(prefs.colorBy, "taskType");
  assert.equal(prefs.miniGanttFieldsLayout, "inline");
  assert.equal(prefs.miniGanttSortDir, "desc");
  assert.equal(prefs.miniGanttZoomLevel, 1);
  assert.equal(prefs.miniGanttComparisonEnabled, true);
  assert.deepEqual(prefs.ganttAnnotations, annotations);
});
