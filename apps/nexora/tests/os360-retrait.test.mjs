/* Retrait d'OS360 (#589) : plus aucun widget « (OS360) » n'est créable ; les
   anciens, encore présents dans des sauvegardes, migrent à la lecture vers le
   widget natif équivalent (#590 sport, #596 finance) ou sont rendus par lui
   s'ils arrivent sans migration. Tranches extraites du bundle construit. */

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
const M = new Function(`${slice("MINIGANTT-MIGRATION")}; return { migrateLegacyFinanceOs360Widget, migrateLegacySportOs360Widget, migrateLegacyMiniGanttData, migrateBudgetChartSankeyWidget };`)();

test("aucun widget « (OS360) » au catalogue ; les anciens types sont rendus par les widgets natifs", () => {
  assert.doesNotMatch(html, /label: "Graphique financier \(OS360\)"/);
  assert.doesNotMatch(html, /label: "Graphique sport \(OS360\)"/);
  assert.doesNotMatch(html, /WidgetOs360Chart|Os360EngineWidget|os360DataStore|OS360_WIDGET_CSS|nx-os360-frame|\/os360-moteur\//);
  assert.match(html, /w\.type === LEGACY_FINANCE_OS360_TYPE && \(\s*<WidgetFinanceLegacyOs360 widget=\{w\}/);
  assert.match(html, /w\.type === LEGACY_SPORT_OS360_TYPE && \(\s*<WidgetSportChart widget=\{migrateLegacySportOs360Widget\(w\)\}/);
});

test("finance : chaque graphique OS360 devient le widget Budget natif qui montre la même chose", () => {
  const m = (type, extra = {}) => M.migrateLegacyFinanceOs360Widget({ id: "f1", type: "financeOs360Chart", title: "Mon budget", layout: { x: 1, y: 2, w: 8, h: 8 }, ...(type ? { os360: { type, title: "", config: { range: 90 } } } : {}), ...extra });
  const def = m();
  assert.deepEqual([def.id, def.title, def.layout.w, def.type, def.budgetChart], ["f1", "Mon budget", 8, "financeBudgetChart", "donut"], "défaut du widget OS360 : donut");
  const charts = {
    "budget.cascadeWaterfall": "waterfall",
    "budget.chart_cumulative": "cumulative", "budget.chart_small_multiples": "smallMultiples", "budget.chart_donut": "donut",
    "budget.chart_waffle": "waffle", "budget.chart_annual_categories": "periodic", "budget.generic_periodic": "periodic",
  };
  for (const [os, native] of Object.entries(charts)) {
    const w = m(os);
    assert.deepEqual([w.type, w.budgetChart], ["financeBudgetChart", native], os);
  }
  assert.equal(m("budget.chart_wealth_sankey").type, "financeSankeyWealth");
  // #604 : les Sankey de flux vont au widget Sankey (annuel : période année).
  assert.deepEqual([m("budget.chart_sankey_monthly").type, m("budget.chart_sankey_monthly").budgetChart, m("budget.chart_sankey_monthly").sankeyConfig], ["financeSankeyMonthly", undefined, undefined]);
  assert.deepEqual([m("budget.chart_annual_sankey").type, m("budget.chart_annual_sankey").sankeyConfig], ["financeSankeyMonthly", { periodMode: "year", periodValue: "current" }]);
  for (const os of ["budget.chart_wealth_by_bank", "budget.chart_wealth_by_type_abs", "budget.wealthHistory", "budget.accountsTreemap", "budget.card_wealth_change"]) assert.equal(m(os).type, "financeWealth", os);
  for (const os of ["budget.card_expense", "budget.card_net", "budget.budgetTracking", "budget.chart_budget_vs_actual", "budget.list_over_budget", "budget.category_progress"]) assert.equal(m(os).type, "financeBudgetMonth", os);
  for (const os of ["budget.list_all_transactions", "budget.list_recent", "budget.transactions"]) assert.equal(m(os).type, "financeTransactions", os);
  assert.deepEqual([m("budget.chart_radar_monthly").type, m("budget.chart_radar_monthly").budgetChart], ["financeBudgetChart", "donut"], "sans équivalent : Graphique Budget");
  assert.equal(m("budget.chart_donut").os360.type, "budget.chart_donut", "réglage OS360 conservé");
  const other = { id: "x", type: "financeBudgetChart", budgetChart: "waffle" };
  assert.equal(M.migrateLegacyFinanceOs360Widget(other), other);
  // Le native « Graphique Budget » ne connaît que ses 8 graphiques.
  for (const native of new Set(Object.values(charts))) assert.match(slice("FINANCE-BUDGET-CHART"), new RegExp(`key: "${native}"`));
});

test("migration à la lecture des tableaux de bord (finance et sport ensemble)", () => {
  const data = M.migrateLegacyMiniGanttData({ d: { pages: [{ widgets: [
    { id: "a", type: "financeOs360Chart", os360: { type: "budget.chart_waffle" } },
    { id: "b", type: "sportOs360Chart", os360: { type: "health.sportWaffle" } },
    { id: "c", type: "financeBudgetMonth" },
  ] }] } });
  assert.deepEqual(data.d.pages[0].widgets.map((w) => [w.type, w.budgetChart || w.sport?.view || ""]), [["financeBudgetChart", "waffle"], ["sportChart", "waffle"], ["financeBudgetMonth", ""]]);
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
