/* Budget natif (issue #586).
   Les valeurs attendues des calculs ont été établies en exécutant, sur les
   mêmes données, les fonctions d'origine du bundle OS360 (vf, yf, bf, _f, pf,
   mf, hf, osBudgetGroups, of, sf) : toute divergence ici signale un écart avec
   OS360. Les blocs d'interface sont extraits du bundle RÉELLEMENT construit. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as B from "../lib/finance-budget.mjs";
import { buildCategorizedTransaction, buildCreateTransaction, validateCategoryPair } from "../lib/finance-validation.mjs";

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
  "financeBudgetBankBars", "financeBudgetSignedAmount", "financeBudgetReason", "financeBudgetSparkline",
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

test("totaux du mois identiques à OS360 : Épargne comptée, transferts internes et ajustements exclus, annulations retirées", () => {
  const s = B.buildBudgetSummary(raw, "2026-09", NOW);
  assert.deepEqual(s.period, { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(s.totals.expenses, 1653.45);
  assert.equal(s.totals.income, 3240.5);
  assert.equal(s.totals.net, 1587.05);
});

test("suivi budgétaire identique à OS360 : budgets par préfixe ou raw.budget_months, année de la période seulement", () => {
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

test("soldes et patrimoine identiques à OS360 : dernier relevé puis mouvements, date bornée à aujourd'hui", () => {
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

test("interface : formats, ordre du suivi, barres, saisie", () => {
  assert.deepEqual([...UI.FINANCE_BUDGET_TYPES], ["financeBudgetMonth", "financeToCategorize", "financeWealth"]);
  assert.equal(UI.financeBudgetMonthLabel("2026-09"), "Septembre 2026");
  assert.equal(UI.financeBudgetShiftMonth("2026-01", -1), "2025-12");
  assert.equal(UI.financeBudgetShiftMonth("2026-12", 1), "2027-01");
  assert.match(UI.financeBudgetEuro(1234.5, 2), /^1\s234,50\s€$/);
  const sorted = UI.financeBudgetSortTracking([
    { category: "A", budget: 100, actual: 50, over: false }, { category: "B", budget: 0, actual: 300, over: true },
    { category: "C", budget: 100, actual: 130, over: true }, { category: "D", budget: 100, actual: 90, over: false },
    { category: "E", budget: 50, actual: 200, over: true },
  ]);
  assert.deepEqual(sorted.map((r) => r.category), ["E", "C", "D", "A", "B"]);
  const bars = UI.financeBudgetBankBars([
    { bank: "X", total: 150, segments: [{ type: "a", value: 100 }, { type: "b", value: 50 }] },
    { bank: "Y", total: -20, segments: [{ type: "a", value: 30 }, { type: "c", value: -50 }] },
  ]);
  assert.deepEqual(bars.map((b) => b.segments.map((s) => [s.type, Math.round(s.width)])), [[["a", 67], ["b", 33]], [["a", 20]]]);
  assert.equal(UI.financeBudgetSignedAmount("Dépense", "12,50"), -12.5);
  assert.equal(UI.financeBudgetSignedAmount("Revenu", "-1 000"), 1000);
  assert.equal(UI.financeBudgetSignedAmount("Dépense", "0"), null);
  assert.equal(UI.financeBudgetReason({ reason: "confiance", confidence: 0.62 }), "IA peu sûre (62 %)");
  assert.equal(UI.financeBudgetSparkline([{ total: 1 }]), "");
  assert.equal(UI.financeBudgetSparkline([{ total: 0 }, { total: 10 }], 100, 20, 0), "0.0,20.0 100.0,0.0");
});

test("widgets rattachés au catalogue, au rendu, à l'en-tête et à la fiche, sans réglage", () => {
  assert.match(html, /\{ key: "financeBudgetMonth", label: "Budget du mois", icon: Wallet, group: "Suivi" \}/);
  assert.match(html, /\{ key: "financeToCategorize", label: "Budget — À catégoriser", icon: Tag, group: "Suivi" \}/);
  assert.match(html, /\{ key: "financeWealth", label: "Patrimoine par banque", icon: Banknote, group: "Suivi" \}/);
  assert.match(html, /w\.type === "financeBudgetMonth" && <WidgetFinanceBudgetMonth externalToolbarSlot=\{headerToolbarSlot\} \/>/);
  assert.match(html, /w\.type === "financeToCategorize" && <WidgetFinanceToCategorize externalToolbarSlot=\{headerToolbarSlot\} \/>/);
  assert.match(html, /w\.type === "financeWealth" && <WidgetFinanceWealth externalToolbarSlot=\{headerToolbarSlot\} \/>/);
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

test("graphiques identiques à OS360 : donut (lf), waterfall, waffle (jf, jd)", () => {
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
  assert.match(html, /\{ key: "financeBudgetChart", label: "Graphique Budget", icon: BarChart3, group: "Suivi" \}/);
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
