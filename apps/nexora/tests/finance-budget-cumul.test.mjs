/* Widget « Budget cumulé par mois » (#606) : modèle du mois (séries par
   catégorie, « Autres », couleurs stables, rythme du budget, dépassement) et
   rattachement au tableau de bord. Tranches extraites du bundle construit. */

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
const C = vm.runInThisContext(`(function () {\n${slice("FINANCE-BUDGET-CUMUL")}\n;return { FINANCE_BUDGET_CUMUL_MODES, FINANCE_CUMUL_PALETTE, FINANCE_CUMUL_OTHER, financeCumulModel, financeCumulSpread };\n})`)();

const days = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"];
// 9 catégories : A..I. Sur 12 mois, I est la 2e plus grosse, H et G les plus petites.
const cats = "ABCDEFGHI".split("");
const cumulative = cats.map((c, i) => ({ category: c, total: [90, 80, 70, 60, 50, 40, 30, 20, 10][i], budget: c === "A" ? 50 : c === "H" ? 15 : c === "G" ? 10 : 0, values: [] }));
for (const s of cumulative) s.values = [0, s.total / 2, s.total / 2, s.total];
const periodic = [{ month: "2026-08", categories: [{ category: "I", amount: 85 }] }, { month: "2026-09", categories: cumulative.map((s) => ({ category: s.category, amount: s.total })) }];
const charts = { days, cumulative, incomeCumulative: [100, 100, 300, 300], budgetTotal: 400, periodic };

test("cinq modes, palette fixe de 7 teintes", () => {
  assert.deepEqual(C.FINANCE_BUDGET_CUMUL_MODES.map((m) => m.key), ["categories", "budget", "trajectories", "multiples", "daily"]);
  assert.equal(C.FINANCE_CUMUL_PALETTE.length, 7);
});

test("modèle : couleur par rang sur 12 mois, « Autres » au-delà de 7, cumul et jour", () => {
  const m = C.financeCumulModel(charts);
  // Rang 12 mois : I (95), A, B, C, D, E, F | G, H dans « Autres ».
  assert.deepEqual(m.series.map((s) => s.category), ["I", "A", "B", "C", "D", "E", "F", "Autres"]);
  assert.deepEqual(m.series.map((s) => s.color), [...C.FINANCE_CUMUL_PALETTE, C.FINANCE_CUMUL_OTHER]);
  const other = m.series.at(-1);
  assert.deepEqual([other.members, other.total, other.budget, other.values], [["G", "H"], 50, 25, [0, 25, 25, 50]]);
  assert.deepEqual(m.series[1].daily, [0, 45, 0, 45]);
  assert.deepEqual(m.total, [0, 225, 225, 450]);
  assert.deepEqual(m.dailyTotal, [0, 225, 0, 225]);
  assert.equal(m.spent, 450);
  assert.deepEqual(m.pace, [100, 200, 300, 400]);
  assert.equal(m.crossDay, 3, "dépassement le 4e jour (450 > 400)");
  assert.deepEqual(m.income, [100, 100, 300, 300]);
});

test("modèle : couleur stable si une catégorie ne dépense rien ce mois", () => {
  const m = C.financeCumulModel({ ...charts, cumulative: cumulative.filter((s) => s.category !== "I") });
  assert.equal(m.series[0].category, "A");
  assert.equal(m.series[0].color, C.FINANCE_CUMUL_PALETTE[1], "A garde sa teinte même sans I");
});

test("modèle : sans budget ni dépense", () => {
  const m = C.financeCumulModel({ days, cumulative: [], periodic: [], budgetTotal: 0 });
  assert.deepEqual([m.series, m.crossDay, m.pace, m.spent, m.income], [[], -1, [0, 0, 0, 0], 0, [0, 0, 0, 0]]);
  assert.deepEqual(C.financeCumulModel(undefined).series, []);
});

test("étiquettes de fin sans chevauchement", () => {
  const out = C.financeCumulSpread([{ y: 50 }, { y: 10 }, { y: 15 }, { y: 100 }], 12);
  assert.deepEqual(out.map((o) => o.y), [10, 22, 50, 100]);
});

test("widget rattaché : catalogue, en-tête, rendu, taille, sélecteur des modes", () => {
  assert.match(html, /\{ key: "financeBudgetCumul", label: "Budget cumulé par mois", icon: TrendingUp, group: "Suivi" \}/);
  assert.match(html, /w\.type === "financeBudgetCumul" && \(\s*<WidgetFinanceBudgetCumul widget=\{w\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "financeBudgetCumul"/);
  assert.match(html, /if \(type === "financeBudgetCumul"\) return \{ w: 10, h: 9 \};/);
  assert.match(html, /onUpdateWidget\(\{ budgetCumulMode: e\.target\.value \}\)/);
  for (const c of ["Categories", "Budget", "Trajectories", "Multiples", "Daily"]) assert.match(html, new RegExp(`mode === "${c[0].toLowerCase() + c.slice(1)}" && <FinanceCumul${c} model=\\{model\\} />`));
});
