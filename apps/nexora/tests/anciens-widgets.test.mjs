/* Anciens widgets externes (#589) : plus aucun n'est créable, et leur
   migration à la lecture a été retirée avec l'abandon de l'ancienne
   application (#626). Restent les migrations internes du Graphique Budget
   (#604, #606). Tranches extraites du bundle construit. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}
const M = new Function(`${slice("MINIGANTT-MIGRATION")}; return { migrateLegacyMiniGanttData, migrateBudgetChartSankeyWidget, migrateBudgetChartCumulWidget };`)();

test("aucune mention de l'ancienne application dans Nexora (#613, #626)", () => {
  const name = new RegExp(["o", "s"].join("") + "[ -]?" + (300 + 60), "gi");
  assert.deepEqual(html.match(name) || [], []);
  assert.doesNotMatch(html, /LEGACY_(SPORT|FINANCE)_CHART_TYPE|LEGACY_SETTINGS_KEY|WidgetFinanceLegacyChart/);
});

test("Graphique Budget réglé sur un Sankey (#604) : devient le widget Sankey, le reste intact", () => {
  const base = { id: "g", type: "financeBudgetChart", title: "Flux", layout: { x: 0, y: 0, w: 8, h: 8 } };
  assert.deepEqual(M.migrateBudgetChartSankeyWidget({ ...base, budgetChart: "sankeyMonthly" }), { id: "g", type: "financeSankeyMonthly", title: "Flux", layout: base.layout });
  assert.deepEqual(M.migrateBudgetChartSankeyWidget({ ...base, budgetChart: "sankeyAnnual", sankeyConfig: { decimals: 0 } }).sankeyConfig, { decimals: 0, periodMode: "year", periodValue: "current" });
  const waffle = { ...base, budgetChart: "waffle" };
  assert.equal(M.migrateBudgetChartSankeyWidget(waffle), waffle);
  const data = M.migrateLegacyMiniGanttData({ w: [{ ...base, budgetChart: "sankeyAnnual" }, waffle] });
  assert.deepEqual(data.w.map((w) => w.type), ["financeSankeyMonthly", "financeBudgetChart"], "migration à la lecture");
});

test("Graphique Budget réglé sur le cumul ou les small multiples (#606) : devient « Budget cumulé par mois »", () => {
  const base = { id: "g", type: "financeBudgetChart", title: "Cumul", layout: { x: 0, y: 0, w: 8, h: 8 } };
  assert.deepEqual(M.migrateBudgetChartCumulWidget({ ...base, budgetChart: "cumulative" }), { id: "g", type: "financeBudgetCumul", title: "Cumul", layout: base.layout, budgetCumulMode: "categories" });
  assert.equal(M.migrateBudgetChartCumulWidget({ ...base, budgetChart: "smallMultiples" }).budgetCumulMode, "multiples");
  const donut = { ...base, budgetChart: "donut" };
  assert.equal(M.migrateBudgetChartCumulWidget(donut), donut);
  const data = M.migrateLegacyMiniGanttData({ w: [{ ...base, budgetChart: "cumulative" }, { ...base, budgetChart: "sankeyMonthly" }, donut] });
  assert.deepEqual(data.w.map((w) => w.type), ["financeBudgetCumul", "financeSankeyMonthly", "financeBudgetChart"], "migration à la lecture");
});
