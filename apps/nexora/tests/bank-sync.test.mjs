/* Synchronisation bancaire Enable Banking (issue #677) : logique pure. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  accountKeyOf, aspspKeyOf, bankReportSection, buildImportedTransaction, isIgnoredLabel, normalizeIgnorePatterns, consentStatus, describeSessionAccounts, findMerchantRule,
  maskIban, normalizeBankTransaction, pickBalance, planAccountSync, syncDateFrom, withExternalIds, UNCLASSIFIED
} from "../lib/bank-sync.mjs";

const bankTx = (over = {}) => ({
  entry_reference: "REF-1",
  transaction_amount: { amount: "12.50", currency: "EUR" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-10-03",
  value_date: "2026-10-03",
  transaction_date: "2026-10-02",
  creditor: { name: "Boulangerie Martin" },
  remittance_information: ["CB BOULANGERIE MARTIN 02/10"],
  ...over,
});

const rules = [
  { rule_id: "r1", pattern: "Netlify", match_type: "contains", merchant_normalized: "Netlify", category: "Abonnements", subcategory: "Thalvego", priority: 130, confidence: 1, active: true },
  { rule_id: "r2", pattern: "boulangerie", match_type: "contains", merchant_normalized: "Boulangerie", category: "Alimentation", subcategory: "Courses", priority: 100, confidence: 0.9, active: true },
  { rule_id: "r3", pattern: "SNCF", match_type: "exact", category: "Transport", subcategory: "Train", priority: 120, confidence: 1, active: true },
  { rule_id: "r4", pattern: "loyer", match_type: "contains", category: "Logement", subcategory: "Loyer", priority: 140, confidence: 1, active: true, min_abs_amount: 500 },
  { rule_id: "r5", pattern: "(", match_type: "regex", category: "Achats", priority: 200, active: true },
  { rule_id: "r6", pattern: "boulangerie", match_type: "contains", category: "Sports", priority: 300, active: false },
];

test("clés : banque, compte stable d'un consentement à l'autre, IBAN masqué", () => {
  assert.equal(aspspKeyOf("Caisse d'Épargne Rhône Alpes", "fr"), "FR:caisse_d_epargne_rhone_alpes");
  assert.throws(() => aspspKeyOf(""), /aspsp_name_required/);
  const a = { uid: "u1", identification_hash: "abc", account_id: { iban: "FR76 1234" } };
  assert.equal(accountKeyOf(a), "hash:abc");
  const b1 = accountKeyOf({ uid: "u1", account_id: { iban: "FR7612345678901234567890123" } });
  const b2 = accountKeyOf({ uid: "u2", account_id: { iban: "fr76 1234 5678 9012 3456 7890 123" } });
  assert.equal(b1, b2, "même IBAN, uid différent : même clé");
  assert.match(b1, /^iban:[0-9a-f]{32}$/);
  assert.equal(maskIban("FR7612345678901234567890123"), "FR76 •••• 0123");
  assert.equal(maskIban(""), "");
  const [summary] = describeSessionAccounts([{ uid: "u1", name: "M. Q", details: "Compte courant", currency: "EUR", account_id: { iban: "FR7612345678901234567890123" } }]);
  assert.equal(summary.label, "M. Q · Compte courant");
  assert.equal(summary.ibanMasked, "FR76 •••• 0123");
  assert.ok(!JSON.stringify(summary).includes("12345678901234567890"), "IBAN complet jamais exposé");
});

test("normalisation : signe, dates, libellé, opérations en attente ignorées", () => {
  const debit = normalizeBankTransaction(bankTx());
  assert.deepEqual(debit, { bankId: "REF-1", amount: -12.5, currency: "EUR", bankDate: "2026-10-03", effectiveDate: "2026-10-02", merchant: "Boulangerie Martin", description: "CB BOULANGERIE MARTIN 02/10" });
  const credit = normalizeBankTransaction(bankTx({ credit_debit_indicator: "CRDT", debtor: { name: "Employeur" }, creditor: null, transaction_amount: { amount: "2500", currency: "EUR" } }));
  assert.equal(credit.amount, 2500);
  assert.equal(credit.merchant, "Employeur");
  assert.equal(normalizeBankTransaction(bankTx({ status: "PDNG" })), null);
  assert.equal(normalizeBankTransaction(bankTx({ transaction_amount: { amount: "0" } })), null);
  const noName = normalizeBankTransaction(bankTx({ creditor: null, remittance_information: ["PRLV SEPA FREE MOBILE"] }));
  assert.equal(noName.merchant, "PRLV SEPA FREE MOBILE");
  assert.equal(noName.description, null);
});

test("identifiants : stables, distincts pour deux opérations identiques sans référence", () => {
  const n = [bankTx({ entry_reference: null }), bankTx({ entry_reference: null })].map(normalizeBankTransaction);
  const [a, b] = withExternalIds("iban:x", n);
  assert.notEqual(a.transactionId, b.transactionId);
  const again = withExternalIds("iban:x", n);
  assert.equal(again[0].transactionId, a.transactionId);
  assert.match(a.transactionId, /^eb-[0-9a-f]{24}$/);
  assert.equal(a.reconciliationId, a.transactionId.replace("eb-", "eb:"));
  const other = withExternalIds("iban:y", n);
  assert.notEqual(other[0].transactionId, a.transactionId, "le compte fait partie de l'empreinte");
});

test("règles marchands : priorité, inactives, montant, exact, regex invalide", () => {
  const tx = normalizeBankTransaction(bankTx());
  assert.equal(findMerchantRule(rules, tx, "courant_ce").rule_id, "r2");
  assert.equal(findMerchantRule(rules, { merchant: "Loyer octobre", amount: -100 }, "courant_ce"), null, "sous le montant minimum");
  assert.equal(findMerchantRule(rules, { merchant: "Loyer octobre", amount: -700 }, "courant_ce").rule_id, "r4");
  assert.equal(findMerchantRule(rules, { merchant: "sncf", amount: -30 }, "x").rule_id, "r3");
  assert.equal(findMerchantRule(rules, { merchant: "SNCF Connect", amount: -30 }, "x"), null, "exact : libellé entier");
  assert.equal(findMerchantRule([{ ...rules[1], account_id: "bourso" }], tx, "courant_ce"), null, "règle propre à un autre compte");
});

test("transaction importée : type cohérent avec le signe, « À classer » sans règle", () => {
  const [tx] = withExternalIds("k", [normalizeBankTransaction(bankTx())]);
  const none = buildImportedTransaction(tx, "courant_ce", null);
  assert.equal(none.category, UNCLASSIFIED);
  assert.equal(none.subcategory, null);
  assert.equal(none.category_confidence, 0);
  assert.equal(none.transaction_type, "Dépense");
  assert.equal(none.source, "enable_banking");
  assert.equal(none.signed_amount, -12.5);
  const withRule = buildImportedTransaction(tx, "courant_ce", { ...rules[1], transaction_type: "Remboursement" });
  assert.equal(withRule.transaction_type, "Dépense", "Remboursement refusé sur un débit");
  assert.equal(withRule.category, "Alimentation");
  assert.equal(withRule.merchant, "Boulangerie");
  assert.equal(withRule.category_confidence, 0.9);
});

test("plan : rapproche une saisie manuelle au lieu de créer un doublon", () => {
  const existing = [
    { transaction_id: "manual-1", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-01", effective_date: "2026-10-01", transaction_type: "Dépense", reconciled: false },
    { transaction_id: "manual-2", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-09-20", effective_date: "2026-09-20", transaction_type: "Dépense", reconciled: false },
    { transaction_id: "budget-1", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-03", effective_date: "2026-10-03", transaction_type: "Budget" },
  ];
  const plan = planAccountSync({ accountKey: "k", accountId: "courant_ce", importFrom: "2026-09-01", bankTransactions: [bankTx()], existing, rules });
  assert.equal(plan.create.length, 0);
  assert.equal(plan.reconcile.length, 1);
  assert.equal(plan.reconcile[0].transactionId, "manual-1", "la plus proche en date, jamais une ligne Budget");
  assert.equal(plan.reconcile[0].reconciliationDate, "2026-10-03");
});

test("plan : une saisie déjà rapprochée à la main garde sa date", () => {
  const existing = [{ transaction_id: "m", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-02", effective_date: "2026-10-02", transaction_type: "Dépense", reconciled: true, reconciliation_date: "2026-09-30", reconciliation_id: null }];
  const plan = planAccountSync({ accountKey: "k", accountId: "courant_ce", importFrom: null, bankTransactions: [bankTx()], existing, rules: [] });
  assert.equal(plan.reconcile[0].reconciliationDate, "2026-09-30");
  const manual = [{ ...existing[0], reconciliation_id: "bilan-20260910" }];
  const kept = planAccountSync({ accountKey: "k", accountId: "courant_ce", importFrom: null, bankTransactions: [bankTx()], existing: manual, rules: [] });
  assert.deepEqual([kept.reconcile.length, kept.create.length, kept.already], [0, 0, 1], "repère manuel jamais écrasé");
});

test("plan : crée ce qui manque, ne recrée jamais au second passage", () => {
  const input = { accountKey: "k", accountId: "courant_ce", importFrom: "2026-09-01", bankTransactions: [bankTx(), bankTx({ entry_reference: "REF-2", booking_date: "2026-08-15", transaction_date: "2026-08-15" }), bankTx({ entry_reference: "REF-3", status: "PDNG" })], rules };
  const first = planAccountSync({ ...input, existing: [] });
  assert.equal(first.create.length, 1);
  assert.equal(first.skipped.beforeImportFrom, 1);
  assert.equal(first.skipped.pending, 1);
  const created = first.create[0];
  assert.equal(created.transaction.category, "Alimentation");
  const stored = [{ ...created.transaction, reconciled: true, reconciliation_id: created.reconciliationId }];
  const second = planAccountSync({ ...input, existing: stored });
  assert.deepEqual([second.create.length, second.reconcile.length, second.already], [0, 0, 1]);
  const interrupted = planAccountSync({ ...input, existing: [{ ...created.transaction, reconciled: false }] });
  assert.deepEqual([interrupted.create.length, interrupted.reconcile.length], [0, 1], "rapprochement repris, jamais une seconde création");
  assert.equal(interrupted.reconcile[0].transactionId, created.transaction.transaction_id);
  const linkedOnly = planAccountSync({ ...input, existing: [{ transaction_id: "manual-x", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-02", transaction_type: "Dépense", reconciled: true, reconciliation_id: created.reconciliationId }] });
  assert.equal(linkedOnly.already, 1, "saisie déjà liée à cette opération bancaire");
});

test("plan : une même saisie ne sert qu'une fois ; annulées et autres comptes exclus", () => {
  const existing = [
    { transaction_id: "m1", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-02", transaction_type: "Dépense" },
    { transaction_id: "m2", account_id: "bourso", signed_amount: -12.5, bank_date: "2026-10-02", transaction_type: "Dépense" },
    { transaction_id: "m3", account_id: "courant_ce", signed_amount: -12.5, bank_date: "2026-10-03", transaction_type: "Dépense" },
    { transaction_id: "a3", account_id: "courant_ce", signed_amount: 0, bank_date: "2026-10-03", transaction_type: "Annulation", cancels_transaction_id: "m3" },
  ];
  const plan = planAccountSync({ accountKey: "k", accountId: "courant_ce", importFrom: null, bankTransactions: [bankTx(), bankTx({ entry_reference: "REF-9" })], existing, rules: [] });
  assert.deepEqual(plan.reconcile.map((r) => r.transactionId), ["m1"]);
  assert.equal(plan.create.length, 1);
  assert.throws(() => planAccountSync({ accountKey: "k", accountId: "", bankTransactions: [], existing: [], rules: [] }), /account_id_required/);
});

test("fenêtre, consentement, solde", () => {
  assert.equal(syncDateFrom({ importFrom: "2026-10-01", lastSyncedAt: null, today: "2026-10-03" }), "2026-10-01");
  assert.equal(syncDateFrom({ importFrom: "2026-01-01", lastSyncedAt: "2026-10-03T05:00:00Z", today: "2026-10-03" }), "2026-09-23");
  assert.equal(syncDateFrom({ importFrom: "2026-10-01", lastSyncedAt: "2026-10-03T05:00:00Z", today: "2026-10-03" }), "2026-10-01");
  const now = new Date("2026-10-03T12:00:00Z");
  assert.deepEqual(consentStatus("2027-03-31T12:00:00Z", now), { state: "ok", daysLeft: 179 });
  assert.equal(consentStatus("2026-10-08T12:00:00Z", now).state, "soon");
  assert.equal(consentStatus("2026-10-01T00:00:00Z", now).state, "expired");
  assert.equal(consentStatus(null, now).state, "unknown");
  assert.deepEqual(pickBalance([{ balance_type: "CLAV", balance_amount: { amount: "10.004", currency: "EUR" } }, { balance_type: "CLBD", balance_amount: { amount: "1234.567", currency: "EUR" }, reference_date: "2026-10-02" }]), { amount: 1234.57, currency: "EUR", type: "CLBD", date: "2026-10-02" });
  assert.equal(pickBalance([]), null);
});

test("libellés ignorés : débit mensuel de la carte différée écarté, diagnostic des opérations en attente", () => {
  assert.deepEqual(normalizeIgnorePatterns("FACTURE CARTE A DEBIT DIFFERE\n\n facture carte a débit différé ;Relevé CB"), ["FACTURE CARTE A DEBIT DIFFERE", "Relevé CB"]);
  assert.throws(() => normalizeIgnorePatterns(["CB"]), /ignore_pattern_too_short/);
  assert.throws(() => normalizeIgnorePatterns(Array.from({ length: 11 }, (_, i) => `motif ${i}`)), /ignore_patterns_too_many/);
  assert.deepEqual(normalizeIgnorePatterns(null), []);
  assert.equal(isIgnoredLabel({ merchant: "Facture Carte à Débit Différé", description: null }, ["carte a debit differe"]), true);
  assert.equal(isIgnoredLabel({ merchant: "CB Boulangerie", description: null }, ["carte a debit differe"]), false);
  const existing = [{ transaction_id: "regul", account_id: "courant_ce", signed_amount: -1454.61, bank_date: "2026-11-04", transaction_type: "Transfert", reconciled: false }];
  const plan = planAccountSync({
    accountKey: "k", accountId: "courant_ce", importFrom: "2026-09-28", existing, rules: [], ignorePatterns: ["FACTURE CARTE A DEBIT DIFFERE"],
    bankTransactions: [
      bankTx({ entry_reference: "F1", transaction_amount: { amount: "1460.20" }, booking_date: "2026-11-04", transaction_date: "2026-11-04", creditor: null, remittance_information: ["FACTURE CARTE A DEBIT DIFFERE"] }),
      bankTx({ entry_reference: "P1", status: "PDNG", creditor: { name: "CB Carrefour" } }),
      bankTx({ entry_reference: "P2", status: "PDNG", creditor: { name: "CB Sncf" } }),
      bankTx({ entry_reference: "Z", transaction_amount: { amount: "0" } }),
    ],
  });
  assert.deepEqual([plan.create.length, plan.reconcile.length], [0, 0], "ni créé, ni rapproché à la régularisation");
  assert.equal(plan.skipped.ignored, 1);
  assert.equal(plan.skipped.invalid, 1);
  assert.deepEqual(plan.skipped.statuses, { PDNG: 2 });
  assert.deepEqual(plan.samples.pending.map((s) => s.label), ["CB Carrefour", "CB Sncf"]);
  assert.equal(plan.samples.pending[0].amount, -12.5);
  assert.deepEqual(plan.samples.ignored, [{ date: "2026-11-04", amount: -1460.2, label: "FACTURE CARTE A DEBIT DIFFERE" }]);
});

test("rapport du matin : alertes d'expiration et d'erreur, jamais de doublon d'alerte", () => {
  const now = new Date("2026-10-03T05:00:00Z");
  const section = bankReportSection([
    { aspsp_name: "Revolut", valid_until: "2027-03-31T00:00:00Z", last_sync_at: "2026-10-03T04:40:00Z", last_sync_result: [{ label: "Revolut", created: 2, reconciled: 1 }] },
    { aspsp_name: "BoursoBank", valid_until: "2026-10-06T00:00:00Z", last_sync_result: [{ label: "Bourso", error: "enable_banking_http_500" }] },
    { aspsp_name: "Caisse d'Epargne", valid_until: "2026-10-01T00:00:00Z", last_sync_result: [{ label: "Courant", error: "consent_expired" }] },
  ], now);
  assert.deepEqual(section.banks.map((b) => b.consent), ["ok", "soon", "expired"]);
  assert.deepEqual([section.banks[0].created, section.banks[0].reconciled], [2, 1]);
  assert.deepEqual(section.alerts, [
    "BoursoBank : accès bancaire à renouveler sous 2 jours.",
    "BoursoBank · Bourso : synchronisation en erreur (enable_banking_http_500).",
    "Caisse d'Epargne : accès bancaire expiré, à renouveler dans Réglages → Banques connectées.",
  ]);
  assert.deepEqual(bankReportSection(null, now), { banks: [], alerts: [] });
});

test("SQL : tables serveur seul, aucune politique, droits retirés au public", async () => {
  const sql = await readFile(new URL("../supabase/finance_bank_sync.sql", import.meta.url), "utf8");
  for (const table of ["finance_bank_auth_requests", "finance_bank_connections", "finance_bank_account_links"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
  }
  assert.doesNotMatch(sql, /create policy/i);
});
