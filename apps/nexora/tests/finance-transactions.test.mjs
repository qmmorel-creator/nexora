/* Widget Transactions Budget (issue #572) : 100 % des transactions, tous les
   champs, colonnes au choix, en lecture seule. La tranche testée est extraite
   du bundle RÉELLEMENT construit, comme les autres blocs. */

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

const EXPORTS = ["FINANCE_TX_COLUMNS", "FINANCE_TX_DEFAULT_COLUMNS", "financeTxAllColumns", "financeTxRows", "financeTxText", "financeTxSearch", "financeTxSort", "financeTxCsv"];
const T = vm.runInThisContext(`(function () {\n${slice("FINANCE-TRANSACTIONS")}\n;return { ${EXPORTS.join(", ")} };\n})`)();

const raw = {
  transactions: [
    { transaction_id: "t1", effective_date: "2026-09-02", transaction_type: "Revenu", account_id: "cc", signed_amount: 3000, merchant: "Employeur", category: "Revenus", reconciled: true, raw: { source: "csv" }, nouvelle_colonne: "x" },
    { transaction_id: "t2", effective_date: "2026-09-05", transaction_type: "Dépense", account_id: "cc", signed_amount: -1234.5, merchant: "Loyer; septembre", category: "Logement", reconciled: false, description: 'Bail "2026"' },
    { transaction_id: "t3", effective_date: "2026-09-06", transaction_type: "Dépense", account_id: "inconnu", signed_amount: -80, merchant: "Cinéma", category: "Loisirs", reconciled: null },
    { transaction_id: "t4", effective_date: "2026-09-07", transaction_type: "Annulation", account_id: "cc", signed_amount: 80, merchant: "Cinéma", category: "Loisirs", cancels_transaction_id: "t3" },
  ],
  accounts: [{ account_id: "cc", name: "Compte courant", bank: "Banque A", account_type: "Courant", active: true }],
};

test("widget rattaché au catalogue, au rendu, à l'en-tête et à la fiche", () => {
  assert.match(html, /key: "financeTransactions"/);
  assert.match(html, /w\.type === "financeTransactions" && \(\s*<WidgetFinanceTransactions widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "financeTransactions"/);
  assert.match(html, /if \(type === "financeTransactions"\) data\.txColumns = /);
  assert.match(html, /fetch\("\/api\/nexora\/finance-transactions-data"/);
});

test("100 % des transactions : annulées et annulations gardées et signalées, comptes nommés", () => {
  const rows = T.financeTxRows(raw);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.__state), ["", "", "Annulée", "Annulation"]);
  assert.equal(rows[0].__account, "Compte courant");
  assert.equal(rows[0].__bank, "Banque A");
  assert.equal(rows[2].__account, "inconnu", "compte absent du référentiel : son identifiant reste visible");
  assert.throws(() => T.financeTxRows({ transactions: [] }), /Réponse Budget invalide/);
});

test("toutes les colonnes : les connues, puis celles que la base ajoute", () => {
  const cols = T.financeTxAllColumns(T.financeTxRows(raw)).map((c) => c.key);
  for (const key of ["transaction_id", "merchant", "description", "raw", "reconciled", "__account", "__state"]) assert.ok(cols.includes(key), key);
  assert.equal(cols.at(-1), "nouvelle_colonne");
  assert.ok(T.FINANCE_TX_DEFAULT_COLUMNS.every((k) => T.FINANCE_TX_COLUMNS.some((c) => c.key === k)));
});

test("affichage des valeurs : montants, booléens, objets, vides", () => {
  // Arrondi à l'euro à l'affichage (#639) ; le CSV garde le montant exact.
  assert.equal(T.financeTxText("signed_amount", -1234.5), "-1\u202F235");
  assert.equal(T.financeTxText("signed_amount", -0.4), "0");
  assert.equal(T.financeTxText("signed_amount", 12.49), "12");
  assert.equal(T.financeTxText("reconciled", true), "Oui");
  assert.equal(T.financeTxText("reconciled", false), "Non");
  assert.equal(T.financeTxText("reconciled", null), "");
  assert.equal(T.financeTxText("raw", { source: "csv" }), '{"source":"csv"}');
});

test("recherche sur tous les champs, tri numérique et vides en fin", () => {
  const rows = T.financeTxRows(raw);
  assert.deepEqual(T.financeTxSearch(rows, "bail").map((r) => r.transaction_id), ["t2"], "la description non affichée est cherchée aussi");
  assert.deepEqual(T.financeTxSearch(rows, "CINÉMA").map((r) => r.transaction_id), ["t3", "t4"]);
  assert.deepEqual(T.financeTxSort(rows, "signed_amount", true).map((r) => r.transaction_id), ["t2", "t3", "t4", "t1"]);
  assert.deepEqual(T.financeTxSort(rows, "description", true).map((r) => r.transaction_id), ["t2", "t1", "t3", "t4"]);
  assert.deepEqual(T.financeTxSort(rows, "description", false).map((r) => r.transaction_id), ["t2", "t1", "t3", "t4"], "vides toujours en fin, ordre d'origine conservé");
});

test("CSV pour Excel : point-virgule, guillemets échappés, montant à virgule", () => {
  const rows = T.financeTxRows(raw).slice(0, 2);
  const cols = T.FINANCE_TX_COLUMNS.filter((c) => ["merchant", "signed_amount", "description"].includes(c.key));
  const csv = T.financeTxCsv(rows, cols).split("\r\n");
  assert.deepEqual(csv[0].split(";"), cols.map((c) => c.label));
  assert.equal(csv[2], cols.map((c) => ({ merchant: '"Loyer; septembre"', signed_amount: "-1234,5", description: '"Bail ""2026"""' })[c.key]).join(";"));
});

test("route serveur : lecture seule, session du propriétaire, tous les champs", async () => {
  const source = await readFile(new URL("../netlify/functions/finance-transactions-data.ts", import.meta.url), "utf8");
  assert.match(source, /path: "\/api\/nexora\/finance-transactions-data", method: \["GET"\]/);
  assert.match(source, /if \(req\.method !== "GET"\)/);
  assert.match(source, /await requireOwnerFinance\(req\)/);
  assert.match(source, /table: "finance_transactions_current", select: "\*"/);
  assert.doesNotMatch(source, /method: "(POST|PATCH|PUT|DELETE)"|rpc\//);
});
