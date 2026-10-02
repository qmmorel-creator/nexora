/* Budget natif (issue #586).
   Les valeurs attendues des calculs ont été établies en exécutant, sur les
   mêmes données, les fonctions d'origine (vf, yf, bf, _f, pf,
   mf, hf, osBudgetGroups, of, sf) : toute divergence ici signale un écart avec
   l'origine. Les blocs d'interface sont extraits du bundle RÉELLEMENT construit. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as B from "../lib/finance-budget.mjs";
import { buildCategorizedTransaction, buildCreateTransaction, buildEditedTransaction, validateCategoryPair } from "../lib/finance-validation.mjs";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}
const UI_EXPORTS = [
  "FINANCE_BUDGET_TYPES", "financeBudgetEuro", "financeBudgetMonthLabel", "financeBudgetShiftMonth", "financeBudgetSortTracking",
  "financeBudgetSignedAmount", "financeBudgetReason",
];
const UI = vm.runInThisContext(`(function () {\n${slice("FINANCE-BUDGET")}\n;return { ${UI_EXPORTS.join(", ")} };\n})`)();

const tx = (id, date, type, account, amount, category, subcategory = "", extra = {}) => ({
  transaction_id: id, effective_date: date, bank_date: date, transaction_type: type, account_id: account,
  signed_amount: amount, category, subcategory, ...extra,
});
const raw = {
  transactions: [
    tx("r1", "2026-09-01", "Revenu", "cc", 3200, "Revenus", "Salaire"),
    tx("r2", "2026-09-12", "Remboursement", "cc", 40.5, "Santé", "Pharmacie"),
    tx("d1", "2026-09-03", "Dépense", "cc", -950, "Logement", "Loyer"),
    tx("d2", "2026-09-05", "Dépense", "cb", -123.45, "Alimentation", "Courses", { category_confidence: 0.6 }),
    tx("d3", "2026-09-06", "Dépense", "cc", -500, "Épargne", "Livret"),
    tx("d4", "2026-09-07", "Dépense", "cc", -300, "Transferts internes"),
    tx("d5", "2026-09-08", "Dépense", "cc", -60, "Loisirs", "Cinéma"),
    tx("a5", "2026-09-09", "Annulation", "cc", 60, "Loisirs", "", { cancels_transaction_id: "d5" }),
    tx("d6", "2026-09-10", "Dépense", "cc", -80, null, null),
    tx("d7", "2026-08-28", "Dépense", "cc", -42, "Loisirs", "Cinéma"),
    tx("j1", "2026-09-11", "Ajustement", "liv", 12, "Ajustement"),
    tx("t1", "2026-09-06", "Transfert", "liv", 500, "Épargne", "Livret"),
    tx("b1", "2026-01-01", "Budget", "cc", -1000, "Logement", "Prévision", { description: "[B360:BUDGET_V2:1,2,3,4,5,6,7,8,9,10,11,12] Loyer" }),
    tx("b2", "2026-01-01", "Budget", "cc", -100, "Alimentation", "Prévision", { description: "[B360:BUDGET_V2:9,10] Courses" }),
    tx("b3", "2026-01-01", "Budget", "cc", -30, "Loisirs", "Prévision", { description: "sans préfixe", raw: { budget_months: [9] } }),
    tx("b4", "2025-01-01", "Budget", "cc", -999, "Logement", "Prévision", { description: "[B360:BUDGET_V2:9] ancien" }),
    tx("o1", "2026-01-01", "Ouverture", "cb", 100, "Ajustement"),
    tx("f1", "2026-12-20", "Dépense", "cc", -77, "Loisirs", "Cinéma"),
  ],
  accounts: [
    { account_id: "cc", name: "Courant", bank: "Caisse", account_type: "Comptes Cartes Bleues", opening_balance: 1000, color: "#2a6f97", active: true },
    { account_id: "cb", name: "Carte", bank: "Revolut", account_type: "Comptes Cartes Bleues", opening_balance: 0, active: true },
    { account_id: "liv", name: "Livret A", bank: "Caisse", account_type: "Épargne Courte", opening_balance: 5000, active: true },
    { account_id: "av", name: "AV", bank: "Conservateur", account_type: "Epargne Longue", opening_balance: 0, active: true },
    { account_id: "old", name: "Clos", bank: "Caisse", account_type: "Comptes Cartes Bleues", opening_balance: 999, active: false },
  ],
  categories: [
    { category: "Logement", color: "#aa3322", active: true }, { category: "Alimentation", active: true }, { category: "Loisirs", active: true },
    { category: "Revenus", active: true }, { category: "Santé", active: true }, { category: "Épargne", active: true }, { category: "Vieux", active: false },
  ],
  subcategories: [
    { category: "Logement", subcategory: "Loyer", active: true }, { category: "Alimentation", subcategory: "Courses", active: true },
    { category: "Loisirs", subcategory: "Cinéma", active: true }, { category: "Revenus", subcategory: "Salaire", active: true },
    { category: "Épargne", subcategory: "Livret", active: true },
  ],
  banks: [{ name: "Caisse", color: "#123456" }, { name: "Revolut", color: "#222222" }],
  accountTypes: [{ name: "Épargne Courte", color: "#654321" }],
  balances: [
    { account_id: "liv", as_of_date: "2026-06-30", balance: 6000 },
    { account_id: "av", as_of_date: "2026-08-31", balance: 20000 },
    { account_id: "av", as_of_date: "2026-09-30", balance: 20250 },
  ],
};
const NOW = new Date("2026-09-20T10:00:00Z");

test("totaux du mois identiques à l'origine : Épargne comptée, transferts internes et ajustements exclus, annulations retirées", () => {
  const s = B.buildBudgetSummary(raw, "2026-09", NOW);
  assert.deepEqual(s.period, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(s.totals.expenses, 1653.45);
  assert.equal(s.totals.income, 3240.5);
  assert.equal(s.totals.net, 1587.05);
});

test("période libre : mêmes règles que le mois, bornes par défaut, dates refusées (#644)", () => {
  const month = B.buildBudgetSummary(raw, "2026-09", NOW);
  const sept = B.buildBudgetPeriodTotals(raw, "2026-09-01", "2026-09-30", NOW);
  const { expenses, income, net } = month.totals;
  assert.deepEqual(sept.totals, { expenses, income, net }, "un mois = la carte du mois");
  assert.deepEqual(sept.totals, { expenses: 1653.45, income: 3240.5, net: 1587.05 });
  assert.deepEqual(sept.counts, { expenses: 4, income: 2 }, "annulée, transferts internes et ajustements exclus");
  const across = B.buildBudgetPeriodTotals(raw, "2026-08-28", "2026-09-03", NOW);
  assert.deepEqual([across.period, across.totals], [{ from: "2026-08-28", to: "2026-09-03" }, { expenses: 992, income: 3200, net: 2208 }], "à cheval sur deux mois");
  // Sans bornes : de la première opération (budgets et ouvertures exclus) à aujourd'hui ; le futur est exclu.
  const all = B.buildBudgetPeriodTotals(raw, null, null, NOW);
  assert.deepEqual([all.period, all.today, all.totals], [{ from: "2026-08-28", to: "2026-09-20" }, "2026-09-20", { expenses: 1695.45, income: 3240.5, net: 1545.05 }]);
  assert.deepEqual(B.buildBudgetPeriodTotals(raw, "2026-09-15", null, NOW).totals, { expenses: 0, income: 0, net: 0 });
  assert.deepEqual(B.buildBudgetPeriodTotals(raw, null, "2026-01-05", NOW).period, { from: "2026-01-05", to: "2026-01-05" }, "fin avant la première opération : période d'un jour");
  assert.throws(() => B.buildBudgetPeriodTotals(raw, "2026-02-31", null, NOW), /invalid_period/);
  assert.throws(() => B.buildBudgetPeriodTotals(raw, "2026-09-30", "2026-09-01", NOW), /invalid_period/);
});

test("Synthèse Budget : périodes, bornes et rattachements (#644)", async () => {
  const P = vm.runInThisContext(`(function () {\n${slice("SPORT")}\n${slice("FINANCE-BUDGET-PERIOD")}\n;return { FINANCE_PERIODS, financePeriodSpec, financePeriodRange, financePeriodDates };\n})`)();
  assert.deepEqual(P.financePeriodSpec(undefined), { period: "month", from: "", to: "", days: 30 });
  assert.equal(P.financePeriodSpec({ budgetPeriod: { period: "inconnue" } }).period, "month");
  assert.deepEqual(P.financePeriodSpec({ budgetPeriod: { period: "custom", from: "2026-01-01", to: "2026-06-30" } }), { period: "custom", from: "2026-01-01", to: "2026-06-30", days: 30 });
  const r = (period, today, extra = {}) => P.financePeriodRange({ period, from: "", to: "", days: 30, ...extra }, today);
  assert.deepEqual(r("quarter", "2026-02-15"), { from: "2026-01-01", to: "2026-03-31" });
  assert.deepEqual(r("previousQuarter", "2026-02-15"), { from: "2025-10-01", to: "2025-12-31" }, "T1 → T4 de l'année précédente");
  assert.deepEqual(r("quarter", "2026-11-30"), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(r("previousQuarter", "2026-11-30"), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(r("previousYear", "2026-02-15"), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(r("month", "2026-02-15"), { from: "2026-02-01", to: "2026-02-28" }, "les autres périodes : celles du sport");
  assert.deepEqual(r("previousMonth", "2026-03-10"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(r("rolling", "2026-02-15", { days: 10 }), { from: "2026-02-06", to: "2026-02-15" });
  assert.deepEqual(r("custom", "2026-02-15", { from: "2025-12-01", to: "" }), { from: "2025-12-01", to: "" });
  assert.deepEqual(r("all", "2026-02-15"), { from: "", to: "" }, "sans bornes : le serveur choisit");
  assert.ok(P.FINANCE_PERIODS.every((p) => r(p.value, "2026-02-15") !== undefined));
  assert.equal(P.financePeriodDates({ from: "2026-07-01", to: "2026-09-30" }), "du 01/07/2026 au 30/09/2026");
  assert.equal(P.financePeriodDates({ from: "2026-07-01", to: "2026-07-01" }), "le 01/07/2026");
  // Rattachements : catalogue, taille, rendu, en-tête, fenêtre de réglages, route.
  assert.match(html, /\{ key: "financeBudgetPeriod", label: "Synthèse Budget \(période\)", icon: Wallet, group: "Budget" \}/);
  assert.match(html, /if \(type === "financeBudgetPeriod"\) return \{ w: 6, h: 4 \};/);
  assert.match(html, /w\.type === "financeBudgetPeriod" && \(\s*<WidgetFinanceBudgetPeriod widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "financeBudgetPeriod"/);
  assert.match(html, /if \(type === "financeBudgetPeriod"\) data\.budgetPeriod = \{ \.\.\.budgetPeriodConfig \};/);
  assert.match(html, /fetch\(`\/api\/nexora\/finance-budget-summary\?\$\{query\}`/);
  assert.match(html, /for \(const key of \[\.\.\.financeBudgetPeriodStore\.entries\.keys\(\)\]\) financeBudgetPeriodLoad\(key, true\);/, "Actualiser et les écritures relisent la synthèse");
  const route = await read("../netlify/functions/finance-budget-summary.ts");
  assert.match(route, /if \(isPeriod\) return json\(\{ ok: true, data: buildBudgetPeriodTotals\(raw, from, to\) \}\);/);
  assert.match(route, /error: "invalid_period" \}, 400\)/);
  assert.match(route, /buildBudgetSummary\(raw, month\)/, "sans from / to : réponse du mois inchangée");
});

test("évolution du patrimoine : chaque point = accountBalances, une passe, pas jour / semaine / mois (#645)", () => {
  const data = B.normalizeBudget(raw);
  const daily = B.buildWealthSeries(raw, "2025-12-25", null, "day", NOW);
  assert.deepEqual([daily.from, daily.to, daily.step, daily.points.length], ["2025-12-25", "2026-09-20", "day", 270], "fin par défaut : aujourd'hui");
  assert.deepEqual(daily.accounts.map((a) => a.id), ["cc", "cb", "liv", "av"], "comptes actifs seulement");
  for (const p of daily.points) {
    const ref = B.accountBalances(data, p.date, NOW).map((a) => Math.round(a.balance * 100) / 100);
    assert.deepEqual(p.balances, ref, `soldes au ${p.date}`);
    assert.equal(p.total, Math.round(B.wealthAt(data, p.date, NOW) * 100) / 100, `total au ${p.date}`);
  }
  // Mois : fins de mois, dernier point ramené à aujourd'hui ; début par défaut = premier relevé ou mouvement.
  const monthly = B.buildWealthSeries(raw, null, null, "month", NOW);
  assert.deepEqual(monthly.points.map((p) => [p.date, p.total]), [["2026-06-30", 7000], ["2026-07-31", 7000], ["2026-08-31", 26958], ["2026-09-20", 28757.05]]);
  assert.equal(monthly.accounts.find((a) => a.id === "liv").typeColor, "#654321");
  assert.deepEqual(B.wealthSeriesDates("2026-09-01", "2026-09-20", "week"), ["2026-09-06", "2026-09-13", "2026-09-20"], "semaines lundi–dimanche");
  assert.deepEqual(B.wealthSeriesDates("2026-01-15", "2026-04-10", "month"), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-10"]);
  assert.deepEqual(B.buildWealthSeries(raw, "2026-09-01", "2026-12-31", "week", NOW).to, "2026-09-20", "rien après aujourd'hui");
  assert.throws(() => B.buildWealthSeries(raw, "2026-10-01", null, "day", NOW), /invalid_period/, "début dans le futur");
  assert.throws(() => B.buildWealthSeries(raw, "2026-02-31", null, "day", NOW), /invalid_period/);
  assert.throws(() => B.buildWealthSeries(raw, null, null, "year", NOW), /invalid_step/);
  assert.throws(() => B.buildWealthSeries(raw, "2020-01-01", null, "day", NOW), /too_many_points/, `au plus ${B.WEALTH_SERIES_MAX_POINTS} points`);
  assert.equal(B.buildWealthSeries(raw, "2020-01-01", null, "week", NOW).points.length, 351);
});

test("Évolution du patrimoine : modèle, graduations et rattachements (#645)", async () => {
  const C = vm.runInThisContext(`(function () {\n${slice("SPORT")}\n${slice("FINANCE-BUDGET-PERIOD")}\n${slice("FINANCE-WEALTH-CURVE")}\n;return { FINANCE_WEALTH_STEPS, FINANCE_WEALTH_DETAILS, financeWealthCurveSpec, financeWealthTicks, financeWealthCurveModel, financeWealthPointLabel };\n})`)();
  assert.deepEqual(C.financeWealthCurveSpec(undefined), { period: "365", from: "", to: "", days: 30, step: "week", detail: "none" });
  assert.deepEqual(C.financeWealthCurveSpec({ wealthCurve: { period: "year", step: "day", detail: "bank" } }), { period: "year", from: "", to: "", days: 30, step: "day", detail: "bank" });
  assert.deepEqual(C.financeWealthCurveSpec({ wealthCurve: { step: "an", detail: "x" } }), { period: "365", from: "", to: "", days: 30, step: "week", detail: "none" });
  assert.deepEqual(C.financeWealthTicks(7000, 28757.05), { min: 0, max: 30000, ticks: [0, 10000, 20000, 30000] }, "l'axe part de zéro");
  assert.deepEqual(C.financeWealthTicks(-1500, 3000).ticks, [-2000, 0, 2000, 4000], "net négatif : zéro reste une graduation");
  const series = B.buildWealthSeries(raw, null, null, "month", NOW);
  const net = C.financeWealthCurveModel(series, "none");
  assert.deepEqual([net.groups, net.points.map((p) => p.net), net.min, net.max], [[], [7000, 7000, 26958, 28757.05], 7000, 28757.05]);
  const byType = C.financeWealthCurveModel(series, "type");
  assert.deepEqual(byType.groups.map((g) => [g.label, g.last, g.color]), [
    ["Epargne Longue", 20000, series.accounts.find((a) => a.id === "av").typeColor],
    ["Épargne Courte", 6512, "#654321"],
    ["Comptes Cartes Bleues", 2245.05, series.accounts.find((a) => a.id === "cc").typeColor],
  ], "par valeur au dernier point, couleur de l'entité");
  const lastType = byType.points.at(-1);
  assert.deepEqual(lastType.stack.map((x) => [x.lower, x.upper]), [[0, 20000], [20000, 26512], [26512, 28757.05]], "empilement des positifs");
  assert.deepEqual([lastType.positive, lastType.negative, lastType.net], [28757.05, 0, 28757.05]);
  const byAccount = C.financeWealthCurveModel(series, "account").points.at(-1);
  assert.deepEqual([byAccount.positive, byAccount.negative, byAccount.net], [28880.5, -123.45, 28757.05], "carte négative : hors pile, déduite du net");
  assert.equal(C.financeWealthPointLabel("2026-09-20", "week"), "20/09");
  assert.equal(C.financeWealthPointLabel("2026-09-30", "month"), "sept. 2026");
  // Rattachements.
  assert.match(html, /\{ key: "financeWealthCurve", label: "Évolution du patrimoine", icon: TrendingUp, group: "Budget" \}/);
  assert.match(html, /if \(type === "financeWealthCurve"\) return \{ w: 8, h: 7 \};/);
  assert.match(html, /w\.type === "financeWealthCurve" && \(\s*<WidgetFinanceWealthCurve widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "financeWealthCurve"/);
  assert.match(html, /if \(type === "financeWealthCurve"\) data\.wealthCurve = \{ \.\.\.wealthCurveConfig \};/);
  assert.match(html, /fetch\(`\/api\/nexora\/finance-wealth-series\?\$\{query\}`/);
  assert.match(html, /for \(const key of \[\.\.\.financeWealthStore\.entries\.keys\(\)\]\) financeWealthLoad\(key, true\);/);
  const route = await read("../netlify/functions/finance-wealth-series.ts");
  assert.match(route, /path: "\/api\/nexora\/finance-wealth-series", method: \["GET"\]/);
  assert.match(route, /await requireOwnerFinance\(req\)/);
  assert.match(route, /buildWealthSeries\(raw, from, to, step\)/);
  assert.doesNotMatch(route, /rpc\/|method: "(POST|PATCH|PUT|DELETE)"/, "lecture seule");
});

test("suivi budgétaire identique à l'origine : budgets par préfixe ou raw.budget_months, année de la période seulement", () => {
  const s = B.buildBudgetSummary(raw, "2026-09", NOW);
  assert.deepEqual(s.tracking.map(({ category, budget, actual }) => ({ category, budget, actual })), [
    { category: "Alimentation", budget: 100, actual: 123.45 },
    { category: "Logement", budget: 1000, actual: 950 },
    { category: "Loisirs", budget: 30, actual: 0 },
    { category: "À classer", budget: 0, actual: 80 },
    { category: "Épargne", budget: 0, actual: 500 },
  ]);
  assert.deepEqual(s.overBudget, ["Alimentation"]);
  // Reste à dépenser : budget des catégories budgétées moins leurs dépenses.
  assert.equal(s.totals.budget, 1130);
  assert.equal(s.totals.remaining, 56.55);
  // Octobre : seule la ligne b2 (mois 9,10) et b1 (tous les mois) s'appliquent.
  const oct = B.buildBudgetSummary(raw, "2026-10", NOW);
  assert.deepEqual(oct.tracking.map((c) => [c.category, c.budget]), [["Alimentation", 100], ["Logement", 1000], ["Loisirs", 0]]);
});

test("soldes et patrimoine identiques à l'origine : dernier relevé puis mouvements, date bornée à aujourd'hui", () => {
  const data = B.normalizeBudget(raw);
  assert.deepEqual(B.accountBalances(data, "2026-09-30", NOW).map((a) => [a.id, a.balance]), [["cc", 2368.5], ["cb", -123.45], ["liv", 6512], ["av", 20000]]);
  const s = B.buildBudgetSummary(raw, "2026-09", NOW);
  assert.equal(s.wealth.total, 28757.05);
  assert.equal(s.wealth.date, "2026-09-20");
  assert.deepEqual(s.wealth.banks.map((b) => [b.bank, b.total, b.segments.map((x) => [x.type, x.value])]), [
    ["Conservateur", 20000, [["Epargne Longue", 20000]]],
    ["Caisse", 8880.5, [["Épargne Courte", 6512], ["Comptes Cartes Bleues", 2368.5]]],
    ["Revolut", -123.45, [["Comptes Cartes Bleues", -123.45]]],
  ]);
  assert.equal(s.wealth.history.length, 12);
  assert.deepEqual(s.wealth.history.at(-1), { month: "2026-09", total: 28757.05 });
  assert.equal(s.wealth.history[0].month, "2025-10");
});

test("file à catégoriser : sans catégorie, sous-catégorie hors catalogue, IA peu sûre récente", () => {
  const s = B.buildBudgetSummary(raw, "2026-09", NOW);
  assert.deepEqual(s.toCategorize.map((t) => [t.id, t.reason]), [["r2", "sous_categorie"], ["d6", "sans_categorie"], ["d2", "confiance"]]);
  // Transferts internes sans sous-catégorie : la catégorie n'en a aucune, rien à faire.
  assert.ok(!s.toCategorize.some((t) => t.id === "d4"));
  // Une confiance faible ancienne (> 60 jours) ne revient pas dans la file.
  const old = B.buildBudgetSummary({ ...raw, transactions: [...raw.transactions, tx("x1", "2026-06-01", "Dépense", "cc", -5, "Loisirs", "Cinéma", { category_confidence: 0.3 })] }, "2026-09", NOW);
  assert.ok(!old.toCategorize.some((t) => t.id === "x1"));
  // Catalogues des formulaires : comptes actifs, catégories actives avec leurs sous-catégories.
  assert.deepEqual(s.catalogs.accounts.map((a) => a.id), ["cc", "cb", "liv", "av"]);
  assert.ok(!s.catalogs.categories.some((c) => c.name === "Vieux"));
  assert.deepEqual(s.catalogs.categories.find((c) => c.name === "Logement").subcategories, ["Loyer"]);
});

test("jeu refusé en entier si une transaction est invalide (jamais de total partiel)", () => {
  assert.throws(() => B.normalizeBudget({ ...raw, transactions: [...raw.transactions, tx("", "2026-09-01", "Dépense", "cc", -1, "Loisirs")] }), /finance_invalid_transaction/);
  assert.throws(() => B.normalizeBudget({ ...raw, transactions: [tx("z", "2026-02-30", "Dépense", "cc", -1, "Loisirs")] }), /finance_invalid_transaction/);
  assert.throws(() => B.buildBudgetSummary(raw, "2026-13", NOW), /invalid_month/);
});

test("rapport du matin : mois en cours à Paris, reste à dépenser, alertes et file", () => {
  const r = B.buildBudgetReport(raw, NOW);
  assert.equal(r.month, "2026-09");
  assert.equal(r.remaining, 56.55);
  assert.deepEqual(r.overBudget, [{ category: "Alimentation", budget: 100, actual: 123.45 }]);
  assert.deepEqual(r.nearBudget, [{ category: "Logement", budget: 1000, actual: 950 }]);
  assert.equal(r.toCategorize, 3);
  // 1er octobre à 0 h 30 à Paris = 30 septembre 22 h 30 UTC : c'est déjà octobre.
  assert.equal(B.buildBudgetReport(raw, new Date("2026-09-30T22:30:00Z")).month, "2026-10");
});

test("interface : formats, ordre du suivi, saisie", () => {
  assert.deepEqual([...UI.FINANCE_BUDGET_TYPES], ["financeBudgetMonth", "financeToCategorize"]);
  assert.equal(UI.financeBudgetMonthLabel("2026-09"), "Septembre 2026");
  assert.equal(UI.financeBudgetShiftMonth("2026-01", -1), "2025-12");
  assert.equal(UI.financeBudgetShiftMonth("2026-12", 1), "2027-01");
  // Arrondi à l'euro, sans centimes (#639).
  assert.match(UI.financeBudgetEuro(1234.5), /^1\s235\s€$/);
  assert.match(UI.financeBudgetEuro(-1234.5), /^-1\s235\s€$/);
  assert.match(UI.financeBudgetEuro(-0.4), /^0\s€$/);
  assert.doesNotMatch(html, /financeBudgetEuro\([^()]*(\([^()]*\))?[^()]*, \d\)/, "un montant Budget est encore affiché avec des décimales");
  const sorted = UI.financeBudgetSortTracking([
    { category: "A", budget: 100, actual: 50, over: false }, { category: "B", budget: 0, actual: 300, over: true },
    { category: "C", budget: 100, actual: 130, over: true }, { category: "D", budget: 100, actual: 90, over: false },
    { category: "E", budget: 50, actual: 200, over: true },
  ]);
  assert.deepEqual(sorted.map((r) => r.category), ["E", "C", "D", "A", "B"]);
  assert.equal(UI.financeBudgetSignedAmount("Dépense", "12,50"), -12.5);
  assert.equal(UI.financeBudgetSignedAmount("Revenu", "-1 000"), 1000);
  assert.equal(UI.financeBudgetSignedAmount("Dépense", "0"), null);
  assert.equal(UI.financeBudgetReason({ reason: "confiance", confidence: 0.62 }), "IA peu sûre (62 %)");
});

test("widgets rattachés au catalogue, au rendu, à l'en-tête et à la fiche, sans réglage", () => {
  assert.match(html, /\{ key: "financeBudgetMonth", label: "Budget du mois", icon: Wallet, group: "Budget" \}/);
  assert.match(html, /\{ key: "financeToCategorize", label: "Budget — À catégoriser", icon: Tag, group: "Budget" \}/);
  assert.match(html, /w\.type === "financeBudgetMonth" && <WidgetFinanceBudgetMonth externalToolbarSlot=\{headerToolbarSlot\} \/>/);
  assert.match(html, /w\.type === "financeToCategorize" && <WidgetFinanceToCategorize externalToolbarSlot=\{headerToolbarSlot\} \/>/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*FINANCE_BUDGET_TYPES\.includes\(w\.type\)/);
  assert.match(html, /if \(type === "financeBudgetMonth"\) return \{ w: 6, h: 8 \};/);
  assert.match(html, /fetch\(`\/api\/nexora\/finance-budget-summary\$\{month \? `\?month=\$\{month\}` : ""\}`/);
  assert.match(html, /fetch\("\/api\/nexora\/finance-owner-transactions"/);
  assert.match(html, /idempotencyKey: crypto\.randomUUID\(\)/);
});

test("routes serveur : synthèse en lecture seule, écritures du propriétaire par la fonction SQL idempotente", async () => {
  const summary = await read("../netlify/functions/finance-budget-summary.ts");
  assert.match(summary, /path: "\/api\/nexora\/finance-budget-summary", method: \["GET"\]/);
  assert.match(summary, /await requireOwnerFinance\(req\)/);
  assert.match(summary, /buildBudgetSummary\(raw, month\)/);
  assert.doesNotMatch(summary, /rpc\/|method: "(POST|PATCH|PUT|DELETE)"/);
  const write = await read("../netlify/functions/finance-owner-transactions.ts");
  assert.match(write, /path: "\/api\/nexora\/finance-owner-transactions", method: \["POST", "PATCH"\]/);
  assert.match(write, /await requireOwnerFinance\(req\)/);
  assert.match(write, /applyFinanceTransactionWrite\(access\.config, "create"/);
  assert.match(write, /applyFinanceTransactionWrite\(access\.config, "update"/);
  assert.match(write, /categoryConfidence: 1/);
  assert.match(write, /source: "nexora"/);
  assert.match(write, /validateAccount\(catalogs/);
  // L'API de l'assistant garde sa politique de confirmation, inchangée.
  const assistant = await read("../netlify/functions/finance-transactions.ts");
  assert.match(assistant, /buildCreateTransaction\(body, transactionId\);/);
  assert.match(assistant, /confirmationPolicy/);
  const reporting = await read("../netlify/functions/_shared/reporting.ts");
  assert.match(reporting, /kind === "morning" \? \{ budget: await budgetSection\(at\) \}/);
  assert.match(reporting, /return \{ ok: false, error: "finance_read_failed"/);
});

test("validation : sous-catégorie vide acceptée seulement à la demande, et pour une catégorie sans sous-catégorie", () => {
  const catalogs = {
    accounts: [{ account_id: "cc" }],
    categories: [{ category: "Vacances" }, { category: "Logement" }],
    subcategories: [{ category: "Logement", subcategory: "Loyer" }],
  };
  assert.throws(() => validateCategoryPair(catalogs, "Vacances", ""), /subcategory_not_found_for_category/);
  validateCategoryPair(catalogs, "Vacances", null, { allowEmptySubcategory: true });
  assert.throws(() => validateCategoryPair(catalogs, "Logement", null, { allowEmptySubcategory: true }), /subcategory_not_found_for_category/);
  const input = { transactionType: "Dépense", bankDate: "2026-09-01", accountId: "cc", signedAmount: -10, category: "Vacances" };
  assert.throws(() => buildCreateTransaction(input, "id1"), /subcategory_required/);
  const created = buildCreateTransaction(input, "id1", { allowEmptySubcategory: true, source: "nexora" });
  assert.equal(created.subcategory, null);
  assert.equal(created.source, "nexora");
  assert.equal(buildCreateTransaction({ ...input, subcategory: "x" }, "id2").source, "assistant_personnel");
  const updated = buildCategorizedTransaction({ transaction_id: "t", source_id: "bankin_screenshot:f:1" }, { category: "Vacances" }, { allowEmptySubcategory: true });
  assert.equal(updated.subcategory, null);
  assert.equal(updated.source_id, "bankin_screenshot:f:1");
});

// --- #587 : graphiques natifs, recherche et routes de l'assistant ----------

test("graphiques identiques à l'origine : donut (lf), waterfall, waffle (jf, jd)", () => {
  const c = B.buildBudgetSummary(raw, "2026-09", NOW).charts;
  assert.deepEqual(c.byCategory.map((x) => [x.category, x.amount]), [["Logement", 950], ["Épargne", 500], ["Alimentation", 123.45], ["À classer", 80]]);
  assert.deepEqual(c.waterfall.map((x) => [x.label, x.from, x.to]), [
    ["Revenus", 0, 3240.5], ["Logement", 3240.5, 2290.5], ["Épargne", 2290.5, 1790.5],
    ["Alimentation", 1790.5, 1667.05], ["À classer", 1667.05, 1587.05], ["Solde net", 0, 1587.05],
  ]);
  assert.equal(c.waffle.unit, 47.5);
  assert.deepEqual(c.waffle.categories.map((x) => [x.name, x.value, x.count, [...new Set(x.cells.map((y) => y.account))]]),
    [["Logement", 950, 20, ["Courant"]], ["Épargne", 500, 10, ["Courant"]], ["Alimentation", 123.45, 2, ["Carte"]], ["À classer", 80, 1, ["Courant"]]]);
  assert.deepEqual(B.apportion([5, 3, 2], 7), [4, 2, 1]);
  assert.deepEqual(B.apportion([1, 1, 1], 2), [1, 1, 0]);
});

test("graphiques : cumuls journaliers avec budget, dépenses des 12 derniers mois", () => {
  const c = B.buildBudgetSummary(raw, "2026-09", NOW).charts;
  assert.equal(c.days.length, 30);
  const logement = c.cumulative.find((x) => x.category === "Logement");
  assert.equal(logement.values[1], 0);
  assert.equal(logement.values[2], 950);
  assert.equal(logement.values.at(-1), 950);
  assert.equal(logement.budget, 1000);
  assert.equal(c.periodic.length, 12);
  assert.deepEqual(c.periodic.slice(-2).map(({ month, expenses }) => ({ month, expenses })), [{ month: "2026-08", expenses: 42 }, { month: "2026-09", expenses: 1653.45 }]);
  assert.equal(c.periodic[0].month, "2025-10");
  // #604 : détail par catégorie (empilé), même total que la barre.
  for (const m of c.periodic) assert.equal(Math.round(m.categories.reduce((t, x) => t + x.amount, 0) * 100) / 100, m.expenses, m.month);
  assert.deepEqual(c.periodic.at(-2).categories, [{ category: "Loisirs", amount: 42, color: "#536477" }]);
  assert.ok(c.periodic.at(-1).categories.every((x, i, a) => !i || a[i - 1].amount >= x.amount), "plus grosse catégorie en bas de la pile");
});

test("graphiques : revenus cumulés jour par jour et budget total du mois (#604)", () => {
  const summary = B.buildBudgetSummary(raw, "2026-09", NOW);
  const c = summary.charts;
  assert.equal(c.incomeCumulative.length, c.days.length);
  assert.equal(c.incomeCumulative.at(-1), summary.totals.income, "même règle que la carte du mois");
  assert.ok(c.incomeCumulative.every((v, i, a) => !i || v >= a[i - 1]), "cumul croissant");
  assert.equal(c.budgetTotal, summary.totals.budget);
});

test("recherche de transactions : sans accents ni casse, annulées et budgets exclus, filtres, pagination", () => {
  const ids = (f) => B.searchTransactions(raw, f).items.map((t) => t.transactionId);
  assert.deepEqual(ids({ query: "SANTE" }), ["r2"]);
  assert.deepEqual(ids({ query: "logement" }), ["d1"]);
  assert.ok(!ids({}).includes("d5"), "transaction annulée exclue");
  assert.ok(!ids({}).some((id) => id.startsWith("b")), "lignes Budget exclues");
  assert.deepEqual(ids({ minAmount: 900 }), ["d1", "r1"]);
  assert.deepEqual(ids({ dateFrom: "2026-09-10", dateTo: "2026-09-11", type: "Dépense" }), ["d6"]);
  const page = B.searchTransactions(raw, { limit: 2 });
  assert.equal(page.items.length, 2);
  assert.equal(page.nextOffset, 2);
  assert.equal(page.items[0].transactionId, "f1");
  assert.equal(B.searchTransactions(raw, { limit: 2, offset: page.total - 1 }).nextOffset, null);
});

test("interface graphique : échelles, donut, empilement, waterfall", () => {
  const C = vm.runInThisContext(`(function () {\n${slice("FINANCE-BUDGET-CHART")}\n;return { FINANCE_BUDGET_CHARTS, financeChartTicks, financeChartDonutArcs, financeChartStack, financeChartWaterfallScale, financeChartMonthShort };\n})`)();
  assert.deepEqual(C.FINANCE_BUDGET_CHARTS.map((c) => c.key), ["waterfall", "donut", "waffle", "periodic"], "sans les Sankey (#604) ni le cumul (#606), qui ont leur widget");
  assert.deepEqual(C.financeChartTicks(1653.45), { max: 2000, ticks: [0, 500, 1000, 1500, 2000] });
  assert.deepEqual(C.financeChartTicks(0), { max: 1, ticks: [0, 1] });
  assert.deepEqual(["2026-06", "2026-07"].map(C.financeChartMonthShort), ["juin", "juil."]);
  const arcs = C.financeChartDonutArcs([{ category: "A", amount: 75 }, { category: "B", amount: 25 }, { category: "C", amount: 0 }]);
  assert.deepEqual(arcs.map((a) => [a.category, a.share]), [["A", 0.75], ["B", 0.25]]);
  assert.match(arcs[0].d, /^M 0\.0000 -1\.0000 A 1 1 0 1 1 /);
  assert.deepEqual(C.financeChartStack([{ values: [1, 2] }, { values: [3, 4] }]).map((s) => [s.lower, s.upper]), [[[0, 0], [1, 2]], [[1, 2], [4, 6]]]);
  const sc = C.financeChartWaterfallScale([{ from: 0, to: 100 }, { from: 100, to: -50 }]);
  assert.equal(sc.x(-50), 0);
  assert.equal(sc.x(100), 100);
});

test("widget Graphique Budget et routes de l'assistant rattachés", async () => {
  assert.match(html, /\{ key: "financeBudgetChart", label: "Graphique Budget", icon: BarChart3, group: "Budget" \}/);
  assert.match(html, /w\.type === "financeBudgetChart" && \(\s*<WidgetFinanceBudgetChart widget=\{w\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "financeBudgetChart"/);
  // #604 : un Graphique Budget encore réglé sur un Sankey est rendu par le widget Sankey.
  assert.match(html, /if \(widget\.budgetChart === "sankeyMonthly" \|\| widget\.budgetChart === "sankeyAnnual"\) \{\n    const w = migrateBudgetChartSankeyWidget\(widget\);\n    return <WidgetFinanceSankey widget=\{w\}/);
  // #606 : un Graphique Budget encore réglé sur le cumul est rendu par le widget dédié.
  assert.match(html, /if \(FINANCE_BUDGET_CUMUL_FROM_CHART\[widget\.budgetChart\]\) \{\n    const w = migrateBudgetChartCumulWidget\(widget\);\n    return <WidgetFinanceBudgetCumul widget=\{w\}/);
  assert.doesNotMatch(html, /FinanceChartCumulative|FinanceChartSmallMultiples/);
  assert.match(html, /<FinanceChartPeriodic months=\{c\.periodic\} stacked=\{stacked\} \/>/);
  assert.match(html, /onUpdateWidget\(\{ budgetPeriodicStacked: !stacked \}\)/);
  assert.match(html, /fill: textOn\(c\.color\), fontWeight: 600 \}\}>\{financeChartShortEuro\(c\.amount\)\}/, "montant lisible sur une catégorie claire (jaune, blanc cassé)");
  assert.match(html, /\.nx-tx-tools select\{height:24px;padding:0 24px 0 7px;[^}]*flex:0 0 auto;max-width:none;width:auto\}/, "sélecteur jamais tronqué");
  const summary = await read("../netlify/functions/finance-budget-assistant.ts");
  assert.match(summary, /path: "\/api\/finance\/budget-summary", method: \["GET"\]/);
  assert.match(summary, /isAuthorized\(req, assistant\.apiKey\)/);
  const search = await read("../netlify/functions/finance-transactions-search.ts");
  assert.match(search, /path: "\/api\/finance\/transactions\/search", method: \["GET"\]/);
  assert.match(search, /isAuthorized\(req, assistant\.apiKey\)/);
  for (const source of [summary, search]) assert.doesNotMatch(source, /rpc\/|method: \["(POST|PATCH|PUT|DELETE)/);
});

// --- #617 : répartition du patrimoine -------------------------------------

test("synthèse : soldes par compte avec banque, type et couleurs (#617)", () => {
  const w = B.buildBudgetSummary(raw, "2026-09", NOW).wealth;
  assert.deepEqual(w.accounts.map((a) => [a.id, a.bank, a.type, a.balance]), [
    ["av", "Conservateur", "Epargne Longue", 20000], ["liv", "Caisse", "Épargne Courte", 6512],
    ["cc", "Caisse", "Comptes Cartes Bleues", 2368.5], ["cb", "Revolut", "Comptes Cartes Bleues", -123.45],
  ]);
  for (const a of w.accounts) assert.match(a.color + a.bankColor + a.typeColor, /^(#[0-9a-f]{6}){3}$/i);
  assert.equal(w.accounts.reduce((t, a) => t + a.balance, 0).toFixed(2), String(w.total.toFixed(2)), "même total que le patrimoine");
});

test("barre de patrimoine : regroupement, parts des actifs, soldes négatifs à part (#617)", () => {
  const W = vm.runInThisContext(`(function () {\n${slice("FINANCE-WEALTH-BAR")}\n;return { FINANCE_WEALTH_BAR_GROUPS, financeWealthBarModel };\n})`)();
  assert.deepEqual(W.FINANCE_WEALTH_BAR_GROUPS.map((g) => g.key), ["account", "bank", "type"]);
  const accounts = [
    { id: "a", name: "Courant", bank: "B1", type: "Courant", balance: 1000, color: "#111111", bankColor: "#aa0000", typeColor: "#00aa00" },
    { id: "b", name: "Livret", bank: "B1", type: "Épargne", balance: 3000, color: "#222222", bankColor: "#aa0000", typeColor: "#0000aa" },
    { id: "c", name: "Carte", bank: "B2", type: "Courant", balance: -200, color: "#333333", bankColor: "#bb0000", typeColor: "#00aa00" },
    { id: "d", name: "Vide", bank: "B3", type: "Épargne", balance: 0, color: "#444444", bankColor: "#cc0000", typeColor: "#0000aa" },
  ];
  const byAccount = W.financeWealthBarModel(accounts, "account");
  assert.deepEqual(byAccount.segments.map((s) => [s.label, s.value, s.share, s.color]), [["Livret", 3000, 0.75, "#222222"], ["Courant", 1000, 0.25, "#111111"]]);
  assert.deepEqual(byAccount.negatives.map((s) => [s.label, s.value]), [["Carte", -200]]);
  assert.deepEqual([byAccount.positiveTotal, byAccount.negativeTotal, byAccount.net], [4000, -200, 3800]);
  const byBank = W.financeWealthBarModel(accounts, "bank");
  assert.deepEqual(byBank.segments.map((s) => [s.label, s.value, s.accounts]), [["B1", 4000, ["Courant", "Livret"]]]);
  assert.deepEqual(byBank.negatives.map((s) => s.label), ["B2"], "banque à solde nul ignorée");
  const byType = W.financeWealthBarModel(accounts, "type");
  assert.deepEqual(byType.segments.map((s) => [s.label, s.value, s.color]), [["Épargne", 3000, "#0000aa"], ["Courant", 800, "#00aa00"]], "soldes compensés dans le groupe");
  assert.deepEqual(W.financeWealthBarModel([], "type"), { segments: [], negatives: [], positiveTotal: 0, negativeTotal: 0, net: 0 });
});

test("widget Répartition du patrimoine rattaché : catalogue, rendu, en-tête, bascule et regroupement (#617)", () => {
  assert.match(html, /\{ key: "financeWealthBar", label: "Répartition du patrimoine", icon: Banknote, group: "Budget" \}/);
  assert.match(html, /w\.type === "financeWealthBar" && \(\s*<WidgetFinanceWealthBar widget=\{w\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "financeWealthBar"/);
  assert.match(html, /if \(type === "financeWealthBar"\) return \{ w: 8, h: 6 \};/);
  assert.match(html, /onClick=\{\(\) => update\(\{ wealthBarPercent: true \}\)\}/);
  assert.match(html, /onClick=\{\(\) => update\(\{ wealthBarPercent: false \}\)\}/);
  assert.match(html, /onChange=\{\(e\) => update\(\{ wealthBarBy: e\.target\.value \}\)\}/);
});

// --- #618 : modification de toutes les transactions ------------------------

test("modification complète : champs modifiables, le reste conservé, contrôles (#618)", () => {
  const existing = {
    transaction_id: "t1", bank_date: "2026-09-01", effective_date: "2026-09-02", created_at: "2026-09-01T10:00:00Z",
    transaction_type: "Dépense", account_id: "cc", payment_method_id: "pm", signed_amount: "-12.5", merchant: "Boulangerie",
    category: "Alimentation", subcategory: "Courses", description: null, status: "Réalisé", source: "import",
    transfer_id: null, cancels_transaction_id: null, category_confidence: 0.6, tag: null, source_id: "bankin_screenshot:f:1", revision: 4,
  };
  const same = buildEditedTransaction(existing, {});
  assert.equal(same.categoryChanged, false);
  const { revision, ...unchanged } = existing;
  assert.deepEqual(same.transaction, { ...unchanged, signed_amount: -12.5 }, "sans changement : tout est conservé (montant en nombre)");
  const edited = buildEditedTransaction(existing, { effectiveDate: "2026-09-05", signedAmount: -20, merchant: "  Marché ", tag: "", accountId: "liv" });
  assert.deepEqual([edited.transaction.effective_date, edited.transaction.bank_date, edited.transaction.signed_amount, edited.transaction.merchant, edited.transaction.tag, edited.transaction.account_id], ["2026-09-05", "2026-09-01", -20, "Marché", null, "liv"]);
  assert.deepEqual([edited.transaction.source_id, edited.transaction.source, edited.transaction.status, edited.transaction.payment_method_id, edited.transaction.category_confidence], ["bankin_screenshot:f:1", "import", "Réalisé", "pm", 0.6], "conservés");
  const recat = buildEditedTransaction(existing, { category: "Loisirs", subcategory: null });
  assert.deepEqual([recat.categoryChanged, recat.transaction.category, recat.transaction.subcategory, recat.transaction.category_confidence], [true, "Loisirs", null, 1]);
  assert.throws(() => buildEditedTransaction(existing, { signedAmount: 5 }), /expense_amount_must_be_negative/);
  assert.equal(buildEditedTransaction(existing, { transactionType: "Revenu", signedAmount: 5 }).transaction.transaction_type, "Revenu");
  assert.throws(() => buildEditedTransaction(existing, { transactionType: "Transfert" }), /unsupported_transaction_type/);
  assert.throws(() => buildEditedTransaction(existing, { effectiveDate: "2026-02-30" }), /invalid_dates/);
  assert.throws(() => buildEditedTransaction(existing, { signedAmount: 0 }), /invalid_signed_amount/);
  assert.throws(() => buildEditedTransaction(existing, { category: "" }), /category_required/);
  // Un type hors des trois (Transfert, Ajustement…) reste modifiable sur ses autres champs, sans règle de signe.
  const transfer = buildEditedTransaction({ ...existing, transaction_type: "Transfert", transfer_id: "v1", signed_amount: 300 }, { merchant: "Virement épargne" });
  assert.deepEqual([transfer.transaction.transaction_type, transfer.transaction.transfer_id, transfer.transaction.signed_amount], ["Transfert", "v1", 300]);
  assert.throws(() => buildEditedTransaction(null, {}), /transaction_not_found/);
});

test("fiche de modification : seuls les champs changés partent, catégorie et sous-catégorie ensemble (#618)", () => {
  const E = vm.runInThisContext(`(function () {\n${slice("FINANCE-TX-EDIT")}\n;return { FINANCE_TX_EDIT_TYPES, financeTxEditInitial, financeTxEditChanges };\n})`)();
  const row = { effective_date: "2026-09-02", bank_date: "2026-09-01", transaction_type: "Dépense", account_id: "cc", signed_amount: -12.5, merchant: "Boulangerie", category: "Alimentation", subcategory: "Courses", description: null, tag: null };
  const init = E.financeTxEditInitial(row);
  assert.equal(init.signedAmount, "-12,5");
  assert.deepEqual(E.financeTxEditChanges(init, init), {});
  assert.deepEqual(E.financeTxEditChanges(init, { ...init, signedAmount: "-1 234,56", merchant: " " }), { signedAmount: -1234.56, merchant: null });
  assert.deepEqual(E.financeTxEditChanges(init, { ...init, subcategory: "Boulangerie" }), { category: "Alimentation", subcategory: "Boulangerie" });
});

test("route : modification par la fonction SQL, révision attendue, propriétaire seul (#618)", async () => {
  const write = await read("../netlify/functions/finance-owner-transactions.ts");
  assert.match(write, /if \(body\.operation === "edit"\) \{/);
  assert.match(write, /Number\(body\.expectedRevision\) !== Number\(existing\.revision\)/);
  assert.match(write, /error: "transaction_modified_elsewhere", revision: existing\.revision \}, 409\)/);
  assert.match(write, /const \{ transaction, categoryChanged \} = buildEditedTransaction\(existing, body\);/);
  assert.match(write, /if \(categoryChanged\) validateCategoryPair\(/);
  assert.match(write, /return json\(\{ ok: true, operation: "edit", result, transaction \}\);/);
  assert.match(html, /financeBudgetWrite\("PATCH", \{ operation: "edit", transactionId: row\.transaction_id, expectedRevision: row\.revision, \.\.\.changes \}\)/);
  assert.match(html, /\{editing && <FinanceTxEditor row=\{editing\} onClose=\{\(\) => setEditing\(null\)\} \/>\}/);
});
