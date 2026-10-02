/* Anciens widgets externes (#589) : plus aucun n'est créable ; ceux encore
   présents dans des sauvegardes migrent à la lecture vers le
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
const M = new Function(`${slice("MINIGANTT-MIGRATION")}; return { migrateLegacyFinanceChartWidget, migrateLegacySportChartWidget, migrateLegacyMiniGanttData, migrateBudgetChartSankeyWidget, migrateBudgetChartCumulWidget, LEGACY_FINANCE_CHART_TYPE, LEGACY_SPORT_CHART_TYPE, LEGACY_SETTINGS_KEY };`)();
// Valeurs enregistrées dans les anciens tableaux de bord, lues dans l'application.
const FIN = M.LEGACY_FINANCE_CHART_TYPE, SPORT = M.LEGACY_SPORT_CHART_TYPE, KEY = M.LEGACY_SETTINGS_KEY;

test("aucune mention de l'ancienne application dans Nexora, hors des trois valeurs de données (#613)", () => {
  const name = new RegExp(KEY.slice(0, 2) + "[ -]?" + KEY.slice(2), "gi");
  const found = html.match(name) || [];
  assert.equal(found.length, 3, "seulement les trois constantes de données");
  for (const value of [SPORT, FIN, KEY]) assert.ok(html.includes(`= "${value}";`), value);
});

test("aucun ancien widget externe au catalogue ; les anciens types sont rendus par les widgets natifs", () => {
  assert.match(html, /w\.type === LEGACY_FINANCE_CHART_TYPE && \(\s*<WidgetFinanceLegacyChart widget=\{w\}/);
  assert.match(html, /w\.type === LEGACY_SPORT_CHART_TYPE && \(\s*<WidgetSportChart widget=\{migrateLegacySportChartWidget\(w\)\}/);
});

test("finance : chaque ancien graphique devient le widget Budget natif qui montre la même chose", () => {
  const m = (type, extra = {}) => M.migrateLegacyFinanceChartWidget({ id: "f1", type: FIN, title: "Mon budget", layout: { x: 1, y: 2, w: 8, h: 8 }, ...(type ? { [KEY]: { type, title: "", config: { range: 90 } } } : {}), ...extra });
  const def = m();
  assert.deepEqual([def.id, def.title, def.layout.w, def.type, def.budgetChart], ["f1", "Mon budget", 8, "financeBudgetChart", "donut"], "défaut de l'ancien widget : donut");
  const charts = {
    "budget.cascadeWaterfall": "waterfall",
    "budget.chart_donut": "donut",
    "budget.chart_waffle": "waffle", "budget.chart_annual_categories": "periodic", "budget.generic_periodic": "periodic",
  };
  for (const [os, native] of Object.entries(charts)) {
    const w = m(os);
    assert.deepEqual([w.type, w.budgetChart], ["financeBudgetChart", native], os);
  }
  // #606 : les dépenses cumulées vont au widget « Budget cumulé par mois ».
  assert.deepEqual([m("budget.chart_cumulative").type, m("budget.chart_cumulative").budgetCumulMode, m("budget.chart_cumulative").budgetChart], ["financeBudgetCumul", "categories", undefined]);
  assert.deepEqual([m("budget.generic_cumulative").type, m("budget.chart_small_multiples").type, m("budget.chart_small_multiples").budgetCumulMode], ["financeBudgetCumul", "financeBudgetCumul", "multiples"]);
  assert.equal(m("budget.chart_wealth_sankey").type, "financeSankeyWealth");
  // #604 : les Sankey de flux vont au widget Sankey (annuel : période année).
  assert.deepEqual([m("budget.chart_sankey_monthly").type, m("budget.chart_sankey_monthly").budgetChart, m("budget.chart_sankey_monthly").sankeyConfig], ["financeSankeyMonthly", undefined, undefined]);
  assert.deepEqual([m("budget.chart_annual_sankey").type, m("budget.chart_annual_sankey").sankeyConfig], ["financeSankeyMonthly", { periodMode: "year", periodValue: "current" }]);
  for (const os of ["budget.chart_wealth_by_bank", "budget.chart_wealth_by_type_abs", "budget.wealthHistory", "budget.accountsTreemap", "budget.card_wealth_change"]) assert.equal(m(os).type, "financeWealth", os);
  for (const os of ["budget.card_expense", "budget.card_net", "budget.budgetTracking", "budget.chart_budget_vs_actual", "budget.list_over_budget", "budget.category_progress"]) assert.equal(m(os).type, "financeBudgetMonth", os);
  for (const os of ["budget.list_all_transactions", "budget.list_recent", "budget.transactions"]) assert.equal(m(os).type, "financeTransactions", os);
  assert.deepEqual([m("budget.chart_radar_monthly").type, m("budget.chart_radar_monthly").budgetChart], ["financeBudgetChart", "donut"], "sans équivalent : Graphique Budget");
  assert.equal(m("budget.chart_donut")[KEY].type, "budget.chart_donut", "réglage d'origine conservé");
  const other = { id: "x", type: "financeBudgetChart", budgetChart: "waffle" };
  assert.equal(M.migrateLegacyFinanceChartWidget(other), other);
  // Le native « Graphique Budget » connaît chacun des graphiques visés.
  for (const native of new Set(Object.values(charts))) assert.match(slice("FINANCE-BUDGET-CHART"), new RegExp(`key: "${native}"`));
});

test("migration à la lecture des tableaux de bord (finance et sport ensemble)", () => {
  const data = M.migrateLegacyMiniGanttData({ d: { pages: [{ widgets: [
    { id: "a", type: FIN, [KEY]: { type: "budget.chart_waffle" } },
    { id: "b", type: SPORT, [KEY]: { type: "health.sportWaffle" } },
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

test("Graphique Budget réglé sur le cumul ou les small multiples (#606) : devient « Budget cumulé par mois »", () => {
  const base = { id: "g", type: "financeBudgetChart", title: "Cumul", layout: { x: 0, y: 0, w: 8, h: 8 } };
  assert.deepEqual(M.migrateBudgetChartCumulWidget({ ...base, budgetChart: "cumulative" }), { id: "g", type: "financeBudgetCumul", title: "Cumul", layout: base.layout, budgetCumulMode: "categories" });
  assert.equal(M.migrateBudgetChartCumulWidget({ ...base, budgetChart: "smallMultiples" }).budgetCumulMode, "multiples");
  const donut = { ...base, budgetChart: "donut" };
  assert.equal(M.migrateBudgetChartCumulWidget(donut), donut);
  const data = M.migrateLegacyMiniGanttData({ w: [{ ...base, budgetChart: "cumulative" }, { ...base, budgetChart: "sankeyMonthly" }, donut] });
  assert.deepEqual(data.w.map((w) => w.type), ["financeBudgetCumul", "financeSankeyMonthly", "financeBudgetChart"], "migration à la lecture");
});
