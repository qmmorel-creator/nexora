/* #141 — Widget Graphique, style "Terminées par semaine". */

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
  `(function () {\n${slice("DATE-UTILS")}\n${slice("WEEK-UTILS")}\n${slice("COMPLETED-PER-WEEK")}\n;return {
    getMonday, isoWeek, completedPerWeekSeries,
  };\n})`
)();

const task = (id, completedAt) => ({ id, title: `Tâche ${id}`, completedAt });

test("completedPerWeekSeries : 12 semaines par défaut, du lundi de la semaine courante en dernier", () => {
  const { data } = F.completedPerWeekSeries([], 12, "2026-09-20"); // dimanche
  assert.equal(data.length, 12);
  assert.equal(data[11].weekStart, F.getMonday("2026-09-20"));
});

test("completedPerWeekSeries : weeksCount absent ou invalide retombe sur 12", () => {
  assert.equal(F.completedPerWeekSeries([], undefined, "2026-09-20").data.length, 12);
  assert.equal(F.completedPerWeekSeries([], 0, "2026-09-20").data.length, 12);
  assert.equal(F.completedPerWeekSeries([], -3, "2026-09-20").data.length, 12);
});

test("completedPerWeekSeries : les semaines sont consécutives et calendaires (lundi→dimanche)", () => {
  const { data } = F.completedPerWeekSeries([], 4, "2026-09-20"); // dimanche 20/09 -> lundi de sa semaine = 14/09
  assert.deepEqual(data.map((d) => d.weekStart), ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14"]);
});

test("completedPerWeekSeries : compte les tâches par completedAt, jamais par end/start", () => {
  const tasks = [
    task("a", "2026-09-15T10:00:00Z"), // dans la semaine du 14/09
    task("b", "2026-09-16T22:00:00Z"), // même semaine
    task("c", "2026-09-08T08:00:00Z"), // semaine précédente
    task("d", null),
    { id: "e", title: "Sans completedAt", end: "2026-09-15" },
  ];
  const { data } = F.completedPerWeekSeries(tasks, 4, "2026-09-20");
  const byStart = Object.fromEntries(data.map((d) => [d.weekStart, d.value]));
  assert.equal(byStart["2026-09-14"], 2);
  assert.equal(byStart["2026-09-07"], 1);
  assert.equal(byStart["2026-08-31"], 0);
});

test("completedPerWeekSeries : la moyenne est celle des valeurs de la série, arrondie nulle part", () => {
  const tasks = [task("a", "2026-09-15"), task("b", "2026-09-08"), task("c", "2026-09-08")];
  const { data, average } = F.completedPerWeekSeries(tasks, 4, "2026-09-20");
  const total = data.reduce((s, d) => s + d.value, 0);
  assert.equal(average, total / data.length);
});

test("completedPerWeekSeries : le label reprend le numéro de semaine ISO (S..)", () => {
  const { data } = F.completedPerWeekSeries([], 1, "2026-09-20");
  assert.equal(data[0].label, "S" + F.isoWeek(F.getMonday("2026-09-20")));
});

test("completedPerWeekSeries : liste vide -> série entièrement à zéro, moyenne nulle mais non NaN", () => {
  const { data, average } = F.completedPerWeekSeries([], 12, "2026-09-20");
  assert.ok(data.every((d) => d.value === 0));
  assert.equal(average, 0);
});
