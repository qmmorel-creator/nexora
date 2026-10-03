/* Widget Transactions : moteur de filtres (issue #683). Les tranches testées
   sont extraites du bundle RÉELLEMENT construit, comme les autres blocs. */

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

const EXPORTS = [
  "financeTxRows", "financeTxFilterSpec", "financeTxPeriodRange", "financeTxApplyFilters", "financeTxFilterCount",
  "financeTxRuleActive", "financeTxFieldKind", "financeTxDistinct", "financeTxCategoryTree", "financeTxSubKey", "financeTxNumber",
];
const T = vm.runInThisContext(`(function () {\n${slice("FINANCE-TRANSACTIONS")}\n${slice("FINANCE-TX-FILTERS")}\n;return { ${EXPORTS.join(", ")} };\n})`)();

const rows = T.financeTxRows({
  transactions: [
    { transaction_id: "a", effective_date: "2026-10-02", bank_date: "2026-10-05", transaction_type: "Dépense", account_id: "cc", signed_amount: -42.5, merchant: "Carrefour", category: "Alimentation", subcategory: "Courses", reconciled: true },
    { transaction_id: "b", effective_date: "2026-09-28", bank_date: "2026-09-29", transaction_type: "Dépense", account_id: "cc", signed_amount: -12, merchant: "Boulangerie", category: "Alimentation", subcategory: "Restaurant", reconciled: false },
    { transaction_id: "c", effective_date: "2026-09-15", bank_date: "2026-09-15", transaction_type: "Revenu", account_id: "livret", signed_amount: 3000, merchant: "Employeur", category: "Revenus", subcategory: "Salaire", description: "Paie septembre" },
    { transaction_id: "d", effective_date: "2026-08-20", bank_date: "2026-08-21", transaction_type: "Dépense", account_id: "cc", signed_amount: -150, merchant: "Amazon", category: "", subcategory: null },
    { transaction_id: "e", effective_date: "2026-08-21", bank_date: "2026-08-21", transaction_type: "Annulation", account_id: "cc", signed_amount: 150, merchant: "Amazon", category: "", cancels_transaction_id: "d" },
  ],
  accounts: [
    { account_id: "cc", name: "Compte courant", bank: "Banque A" },
    { account_id: "livret", name: "Livret", bank: "Banque B" },
  ],
});
// Samedi 3 octobre 2026.
const TODAY = "2026-10-03";
const ids = (spec) => T.financeTxApplyFilters(rows, T.financeTxFilterSpec(spec), TODAY).map((r) => r.transaction_id);

test("widget : filtres enregistrés dans le widget, panneau et période dans l'en-tête", () => {
  assert.match(html, /onUpdateWidget\(\{ txFilters: next \}\)/);
  assert.match(html, /<FinanceTxFilterPanel rows=\{rows\}/);
  assert.match(html, /financeTxSearch\(financeTxApplyFilters\(rows, filters, today\), query\)/);
});

test("réglage normalisé : valeurs inconnues remplacées, sans filtre par défaut", () => {
  const spec = T.financeTxFilterSpec({ period: "nimporte", dateField: "x", from: "03/10/2026", categories: ["A", 3, "A"], rules: [{ op: "zz", value: 12 }], days: -4 });
  assert.equal(spec.period, "all");
  assert.equal(spec.dateField, "effective_date");
  assert.equal(spec.from, "");
  assert.deepEqual(spec.categories, ["A"]);
  assert.equal(spec.days, 30);
  assert.deepEqual(spec.rules, [{ field: "merchant", op: "contains", value: "12", value2: "" }]);
  assert.equal(T.financeTxFilterCount(T.financeTxFilterSpec(null)), 0);
  assert.deepEqual(ids(null), ["a", "b", "c", "d", "e"]);
});

test("périodes : semaine du lundi au dimanche, mois, trimestres, glissantes", () => {
  const r = (period, extra = {}) => T.financeTxPeriodRange(T.financeTxFilterSpec({ period, ...extra }), TODAY);
  assert.deepEqual(r("today"), { from: "2026-10-03", to: "2026-10-03" });
  assert.deepEqual(r("yesterday"), { from: "2026-10-02", to: "2026-10-02" });
  assert.deepEqual(r("week"), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(r("previousWeek"), { from: "2026-09-21", to: "2026-09-27" });
  assert.deepEqual(r("month"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(r("previousMonth"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(r("quarter"), { from: "2026-10-01", to: "2026-12-31" });
  assert.deepEqual(r("previousQuarter"), { from: "2026-07-01", to: "2026-09-30" });
  assert.deepEqual(r("previousYear"), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(r("last7"), { from: "2026-09-27", to: "2026-10-03" });
  assert.deepEqual(r("rolling", { days: 2 }), { from: "2026-10-02", to: "2026-10-03" });
  assert.deepEqual(r("custom", { from: "2026-09-01" }), { from: "2026-09-01", to: "" });
  assert.deepEqual(T.financeTxPeriodRange(T.financeTxFilterSpec({ period: "previousMonth" }), "2026-01-15"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(T.financeTxPeriodRange(T.financeTxFilterSpec({ period: "previousQuarter" }), "2026-02-15"), { from: "2025-10-01", to: "2025-12-31" });
  // Dimanche : la semaine est encore celle du lundi précédent.
  assert.deepEqual(T.financeTxPeriodRange(T.financeTxFilterSpec({ period: "week" }), "2026-10-04"), { from: "2026-09-28", to: "2026-10-04" });
});

test("filtre de période sur la date choisie", () => {
  assert.deepEqual(ids({ period: "week" }), ["a", "b"]);
  assert.deepEqual(ids({ period: "month" }), ["a"]);
  assert.deepEqual(ids({ period: "previousMonth" }), ["b", "c"]);
  assert.deepEqual(ids({ period: "previousWeek" }), []);
  assert.deepEqual(ids({ period: "custom", from: "2026-09-29", to: "2026-10-31", dateField: "bank_date" }), ["a", "b"]);
});

test("catégories entières ou sous-catégories choisies, « sans catégorie » compris", () => {
  assert.deepEqual(ids({ categories: ["Alimentation"] }), ["a", "b"]);
  assert.deepEqual(ids({ subcategories: [T.financeTxSubKey("Alimentation", "Courses")] }), ["a"]);
  assert.deepEqual(ids({ categories: ["Revenus"], subcategories: [T.financeTxSubKey("Alimentation", "Restaurant")] }), ["b", "c"]);
  assert.deepEqual(ids({ categories: [""] }), ["d", "e"]);
  const tree = T.financeTxCategoryTree(rows, ["Disparue"]);
  assert.deepEqual(tree.map((c) => [c.name, c.count]), [["Alimentation", 2], ["Disparue", 0], ["Revenus", 1], ["", 2]]);
  assert.deepEqual(tree[0].subs.map((s) => s.name), ["Courses", "Restaurant"]);
  assert.deepEqual(tree[3].subs, [], "aucune sous-catégorie : rien à proposer");
});

test("montant en valeur absolue, sens, comptes, banques, types, pointage, état", () => {
  assert.deepEqual(ids({ amountMin: "40" }), ["a", "c", "d", "e"]);
  assert.deepEqual(ids({ amountMin: "12", amountMax: "42,50" }), ["a", "b"]);
  assert.deepEqual(ids({ amountMin: "150", amountMax: "40" }), ["a", "d", "e"], "bornes inversées remises dans l'ordre");
  assert.deepEqual(ids({ amountMax: "-12" }), ["b"], "une borne négative est lue en valeur absolue");
  assert.deepEqual(ids({ direction: "out" }), ["a", "b", "d"]);
  assert.deepEqual(ids({ direction: "in" }), ["c", "e"]);
  assert.deepEqual(ids({ accounts: ["Livret"] }), ["c"]);
  assert.deepEqual(ids({ banks: ["Banque A"] }), ["a", "b", "d", "e"]);
  assert.deepEqual(ids({ types: ["Revenu", "Annulation"] }), ["c", "e"]);
  assert.deepEqual(ids({ reconciled: "yes" }), ["a"]);
  assert.deepEqual(ids({ reconciled: "no" }), ["b", "c", "d", "e"]);
  assert.deepEqual(ids({ state: "active" }), ["a", "b", "c"]);
  assert.deepEqual(ids({ state: "cancelled" }), ["d", "e"]);
  assert.deepEqual(ids({ period: "previousMonth", direction: "out", categories: ["Alimentation"] }), ["b"], "les filtres se cumulent");
});

test("règles libres sur n'importe quel champ, ET / OU, règles incomplètes ignorées", () => {
  const rule = (field, op, value = "", value2 = "") => ({ field, op, value, value2 });
  assert.equal(T.financeTxFieldKind("signed_amount"), "number");
  assert.equal(T.financeTxFieldKind("__abs"), "number");
  assert.equal(T.financeTxFieldKind("bank_date"), "date");
  assert.equal(T.financeTxFieldKind("created_at"), "date");
  assert.equal(T.financeTxFieldKind("merchant"), "text");
  assert.deepEqual(ids({ rules: [rule("merchant", "contains", "AMAZ")] }), ["d", "e"]);
  assert.deepEqual(ids({ rules: [rule("merchant", "notContains", "amazon")] }), ["a", "b", "c"]);
  assert.deepEqual(ids({ rules: [rule("merchant", "startsWith", "bou")] }), ["b"]);
  assert.deepEqual(ids({ rules: [rule("description", "empty")] }), ["a", "b", "d", "e"]);
  assert.deepEqual(ids({ rules: [rule("description", "notEmpty")] }), ["c"]);
  assert.deepEqual(ids({ rules: [rule("__account", "equals", "compte courant")] }), ["a", "b", "d", "e"]);
  assert.deepEqual(ids({ rules: [rule("reconciled", "equals", "oui")] }), ["a"]);
  assert.deepEqual(ids({ rules: [rule("signed_amount", "lt", "-20")] }), ["a", "d"]);
  assert.deepEqual(ids({ rules: [rule("signed_amount", "equals", "-42,5")] }), ["a"]);
  assert.deepEqual(ids({ rules: [rule("__abs", "between", "100", "12")] }), ["a", "b"]);
  assert.deepEqual(ids({ rules: [rule("bank_date", "gt", "2026-09-29")] }), ["a"]);
  assert.deepEqual(ids({ rules: [rule("effective_date", "between", "2026-08-21", "2026-09-15")] }), ["c", "e"]);
  assert.deepEqual(ids({ rules: [rule("merchant", "equals", "Amazon"), rule("category", "equals", "Revenus")] }), []);
  assert.deepEqual(ids({ rulesMode: "any", rules: [rule("merchant", "equals", "Amazon"), rule("category", "equals", "Revenus")] }), ["c", "d", "e"]);
  // Incomplètes : sans valeur, valeur illisible, opérateur inadapté au champ.
  for (const r of [rule("merchant", "contains", " "), rule("signed_amount", "gt", "abc"), rule("bank_date", "lt", "3/10"), rule("signed_amount", "contains", "4"), rule("__abs", "between", "10")]) {
    assert.equal(T.financeTxRuleActive(r), false, JSON.stringify(r));
  }
  assert.deepEqual(ids({ rules: [rule("signed_amount", "gt", "abc")] }), ["a", "b", "c", "d", "e"]);
});

test("compteur de filtres actifs et valeurs proposées", () => {
  const spec = T.financeTxFilterSpec({ period: "month", categories: ["A"], subcategories: [T.financeTxSubKey("B", "x")], amountMax: "10", rules: [{ field: "merchant", op: "contains", value: "x" }, { field: "merchant", op: "contains", value: "" }] });
  assert.equal(T.financeTxFilterCount(spec), 4);
  assert.equal(T.financeTxFilterCount(T.financeTxFilterSpec({ period: "custom" })), 0, "dates libres sans borne : pas de filtre");
  assert.deepEqual(T.financeTxDistinct(rows, "__account", ["Ancien"]), [{ value: "Ancien", count: 0 }, { value: "Compte courant", count: 4 }, { value: "Livret", count: 1 }]);
  assert.equal(T.financeTxNumber("1 234,5"), 1234.5);
  assert.equal(T.financeTxNumber(""), null);
});
