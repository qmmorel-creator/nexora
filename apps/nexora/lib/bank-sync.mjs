// Synchronisation bancaire Enable Banking (#677) — logique pure, sans réseau.
//
// Une opération bancaire comptabilisée (statut BOOK) devient, pour le compte
// Nexora lié :
//   - soit le RAPPROCHEMENT d'une opération déjà saisie (à la main, par
//     l'assistant, par un ancien import) : même compte, même montant au
//     centime, dates à MATCH_DAYS jours au plus. Rien n'est créé : l'opération
//     existante est marquée rapprochée (`reconciliation_id` = `eb:<empreinte>`) ;
//   - soit une CRÉATION, d'identifiant `eb-<empreinte>` : une synchronisation
//     répétée retrouve l'identifiant et ne crée jamais de doublon.
// L'empreinte dérive du compte bancaire et de l'identifiant fourni par la
// banque (sinon d'un condensé date + montant + libellé + rang).
// Catégorie : première règle de `finance_merchant_rules` qui s'applique, sinon
// « À classer » (confiance 0) : l'opération remonte dans « À catégoriser ».

import { createHash } from "node:crypto";

export const MATCH_DAYS = 4;
export const UNCLASSIFIED = "À classer";
export const CONSENT_WARNING_DAYS = 7;
export const RESYNC_OVERLAP_DAYS = 10;
export const UPCOMING_UNDATED_DAYS = 31;
// Types qui ne sont pas des mouvements bancaires : jamais rapprochés.
const NOT_BANK_MOVEMENTS = new Set(["Budget", "Ouverture", "Ajustement", "Annulation"]);

const sha = (value) => createHash("sha256").update(value).digest("hex");
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function aspspKeyOf(name, country = "FR") {
  const slug = String(name || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  if (!slug) throw new Error("aspsp_name_required");
  return `${String(country || "FR").toUpperCase()}:${slug}`;
}

// Clé stable d'un compte bancaire : l'`uid` change à chaque consentement.
export function accountKeyOf(account) {
  if (account?.identification_hash) return `hash:${account.identification_hash}`;
  const iban = String(account?.account_id?.iban || "").replace(/\s+/g, "").toUpperCase();
  if (iban) return `iban:${sha(iban).slice(0, 32)}`;
  const other = account?.account_id?.other?.identification;
  if (other) return `other:${sha(String(other)).slice(0, 32)}`;
  if (account?.uid) return `uid:${account.uid}`;
  throw new Error("account_identifier_missing");
}

export function maskIban(iban) {
  const clean = String(iban || "").replace(/\s+/g, "").toUpperCase();
  if (clean.length < 8) return clean ? "••••" : "";
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

// Comptes d'une session, réduits à ce que l'interface peut afficher.
export function describeSessionAccounts(accounts) {
  return (Array.isArray(accounts) ? accounts : []).map((account) => ({
    accountKey: accountKeyOf(account),
    uid: String(account.uid || ""),
    label: [account.name, account.details, account.product].map((v) => String(v || "").trim()).filter(Boolean).filter((v, i, all) => all.indexOf(v) === i).join(" · ") || "Compte",
    ibanMasked: maskIban(account?.account_id?.iban),
    currency: String(account.currency || "EUR"),
    cashAccountType: account.cash_account_type ? String(account.cash_account_type) : null,
  }));
}

function shiftDays(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDistance(a, b) {
  if (!DATE.test(a || "") || !DATE.test(b || "")) return Infinity;
  return Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000;
}

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// Opération Enable Banking → forme interne. null pour une opération en
// attente (seules les opérations comptabilisées sont importées) ou nulle.
export function normalizeBankTransaction(tx) {
  if (!tx || typeof tx !== "object") return null;
  const status = String(tx.status || "BOOK").toUpperCase();
  if (status !== "BOOK") return null;
  const out = readBankTransaction(tx);
  return out && out.bankDate ? out : null;
}

// Paiement carte : numéro de carte masqué dans le libellé (« … 864231******7 »).
const CARD_NUMBER = /\d{4,}\*{2,}\d+/;

// Opération bancaire À VENIR (#677) : non comptabilisée, datée après
// `today` (ou sans date), et pas un paiement carte — les paiements de la carte
// à débit différé, eux aussi non comptabilisés, restent écartés.
export function normalizeUpcomingTransaction(tx, today) {
  if (!tx || typeof tx !== "object" || !today) return null;
  const status = String(tx.status || "BOOK").toUpperCase();
  if (status === "BOOK") return null;
  const out = readBankTransaction(tx);
  if (!out) return null;
  if (CARD_NUMBER.test(`${out.merchant} ${out.description || ""}`)) return null;
  if (out.bankDate && out.bankDate <= today) return null;
  return { ...out, upcoming: true };
}

function readBankTransaction(tx) {
  const raw = Number(tx.transaction_amount?.amount);
  if (!Number.isFinite(raw) || raw === 0) return null;
  const credit = String(tx.credit_debit_indicator || "").toUpperCase() === "CRDT";
  const amount = Math.round(Math.abs(raw) * 100) / 100 * (credit ? 1 : -1);
  const bankDate = [tx.booking_date, tx.value_date, tx.transaction_date].find((d) => DATE.test(d || "")) || null;
  const effectiveDate = DATE.test(tx.transaction_date || "") ? tx.transaction_date : bankDate;
  const counterparty = clean(credit ? tx.debtor?.name : tx.creditor?.name);
  const remittance = clean((Array.isArray(tx.remittance_information) ? tx.remittance_information : [tx.remittance_information]).filter(Boolean).join(" "));
  const merchant = (counterparty || remittance || clean(tx.note) || "Opération bancaire").slice(0, 500);
  const description = remittance && remittance !== merchant ? remittance.slice(0, 2000) : null;
  return {
    bankId: clean(tx.transaction_id || tx.entry_reference) || null,
    amount,
    currency: String(tx.transaction_amount?.currency || "EUR").toUpperCase(),
    bankDate,
    effectiveDate,
    merchant,
    description,
  };
}

// Identifiant stable de chaque opération d'un lot : celui de la banque, sinon
// un condensé, avec le rang des opérations identiques (deux cafés le même jour).
export function withExternalIds(accountKey, normalized) {
  const seen = new Map();
  return normalized.map((tx) => {
    let externalId = tx.bankId ? `id:${tx.bankId}` : null;
    if (!externalId) {
      const base = `${tx.bankDate}|${tx.amount.toFixed(2)}|${tx.merchant}|${tx.description || ""}`;
      const rank = seen.get(base) || 0;
      seen.set(base, rank + 1);
      externalId = `h:${sha(base).slice(0, 24)}:${rank}`;
    }
    const fingerprint = sha(`${accountKey}\u0000${externalId}`).slice(0, 24);
    return { ...tx, externalId, transactionId: `eb-${fingerprint}`, reconciliationId: `eb:${fingerprint}` };
  });
}

const fold = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function ruleMatches(rule, tx, accountId) {
  if (rule.active === false) return false;
  if (rule.account_id && rule.account_id !== accountId) return false;
  const abs = Math.abs(tx.amount);
  if (rule.min_abs_amount != null && abs < Number(rule.min_abs_amount)) return false;
  if (rule.max_abs_amount != null && abs > Number(rule.max_abs_amount)) return false;
  const pattern = String(rule.pattern || "");
  if (!pattern) return false;
  const haystack = fold(`${tx.merchant} ${tx.description || ""}`);
  switch (rule.match_type) {
    case "exact": return fold(tx.merchant) === fold(pattern);
    case "regex":
      try { return new RegExp(pattern, "i").test(`${tx.merchant} ${tx.description || ""}`); } catch { return false; }
    default: return haystack.includes(fold(pattern));
  }
}

export function findMerchantRule(rules, tx, accountId) {
  return [...(rules || [])]
    .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0) || String(b.pattern || "").length - String(a.pattern || "").length)
    .find((rule) => ruleMatches(rule, tx, accountId)) || null;
}

// Transaction prête pour finance_apply_transaction_write (opération import).
export function buildImportedTransaction(tx, accountId, rule) {
  let type = tx.amount < 0 ? "Dépense" : "Revenu";
  // Le type d'une règle ne s'applique que s'il est cohérent avec le signe.
  if (rule?.transaction_type === "Remboursement" && tx.amount > 0) type = "Remboursement";
  if (rule?.transaction_type === "Revenu" && tx.amount > 0) type = "Revenu";
  if (rule?.transaction_type === "Dépense" && tx.amount < 0) type = "Dépense";
  const confidence = rule ? Math.min(1, Math.max(0, Number(rule.confidence ?? 1))) : 0;
  return {
    transaction_id: tx.transactionId,
    bank_date: tx.bankDate,
    effective_date: tx.effectiveDate,
    transaction_type: type,
    account_id: accountId,
    payment_method_id: rule?.payment_method_id || null,
    signed_amount: tx.amount,
    merchant: rule?.merchant_normalized || tx.merchant,
    category: rule?.category || UNCLASSIFIED,
    subcategory: rule?.category ? rule.subcategory || null : null,
    category_confidence: confidence,
    description: tx.description,
    status: "Réalisé",
    source: "enable_banking",
    source_id: tx.externalId,
    tag: rule?.tag || null,
  };
}

// Libellés à ignorer d'un compte lié (#677) : ex. le débit mensuel de la carte
// à débit différé, déjà porté par la « Régularisation carte différée ». Une
// opération dont le libellé contient l'un d'eux (sans accents ni casse) n'est
// ni créée ni rapprochée. Au plus 10 libellés de 4 à 80 caractères.
export function normalizeIgnorePatterns(input) {
  const list = Array.isArray(input) ? input : String(input || "").split(/[\n;]+/);
  const out = [];
  for (const item of list) {
    const value = String(item ?? "").replace(/\s+/g, " ").trim();
    if (!value) continue;
    if (value.length < 4) throw new Error("ignore_pattern_too_short");
    if (value.length > 80) throw new Error("ignore_pattern_too_long");
    if (!out.some((p) => fold(p) === fold(value))) out.push(value);
  }
  if (out.length > 10) throw new Error("ignore_patterns_too_many");
  return out;
}

export function isIgnoredLabel(tx, patterns) {
  const haystack = fold(`${tx.merchant} ${tx.description || ""}`);
  return (patterns || []).some((p) => fold(p) && haystack.includes(fold(p)));
}

const SAMPLE_SIZE = 10;
const sampleOf = (raw) => ({
  status: String(raw?.status || ""),
  date: raw?.booking_date || raw?.value_date || raw?.transaction_date || null,
  // Diagnostic : où la banque met-elle la date d'une opération à venir ?
  dates: { booking: raw?.booking_date || null, value: raw?.value_date || null, transaction: raw?.transaction_date || null },
  fields: Object.keys(raw || {}).filter((k) => raw[k] != null && raw[k] !== "").sort(),
  amount: Number(raw?.transaction_amount?.amount) * (String(raw?.credit_debit_indicator || "").toUpperCase() === "CRDT" ? 1 : -1),
  label: clean((raw?.credit_debit_indicator === "CRDT" ? raw?.debtor?.name : raw?.creditor?.name) || (Array.isArray(raw?.remittance_information) ? raw.remittance_information.join(" ") : raw?.remittance_information) || raw?.note).slice(0, 120),
});

// Plan d'un compte : ce qui est déjà là, ce qui se rapproche, ce qui se crée.
// `existing` : opérations Nexora du compte autour de la fenêtre importée.
// `skipped.statuses` et `samples` : diagnostic des opérations écartées
// (statut bancaire, échantillon date / montant / libellé).
export function planAccountSync({ accountKey, accountId, importFrom, bankTransactions, existing, rules, ignorePatterns = [], today = null }) {
  if (!accountId) throw new Error("account_id_required");
  const skipped = { pending: 0, beforeImportFrom: 0, otherCurrency: 0, ignored: 0, invalid: 0, statuses: {}, upcomingUndated: 0 };
  const samples = { pending: [], ignored: [], upcomingUndated: [] };
  const normalized = [];
  const upcoming = [];
  for (const raw of bankTransactions || []) {
    const tx = normalizeBankTransaction(raw);
    if (!tx) {
      const status = String(raw?.status || "BOOK").toUpperCase();
      if (status === "BOOK") { skipped.invalid += 1; continue; }
      const next = normalizeUpcomingTransaction(raw, today);
      if (next && next.currency === "EUR" && !isIgnoredLabel(next, ignorePatterns)) {
        upcoming.push({ tx: next, raw });
        continue;
      }
      skipped.pending += 1;
      skipped.statuses[status] = (skipped.statuses[status] || 0) + 1;
      if (samples.pending.length < SAMPLE_SIZE) samples.pending.push(sampleOf(raw));
      continue;
    }
    if (tx.currency !== "EUR") { skipped.otherCurrency += 1; continue; }
    if (isIgnoredLabel(tx, ignorePatterns)) {
      skipped.ignored += 1;
      if (samples.ignored.length < SAMPLE_SIZE) samples.ignored.push({ date: tx.bankDate, amount: tx.amount, label: tx.merchant.slice(0, 120) });
      continue;
    }
    normalized.push(tx);
  }
  const identified = withExternalIds(accountKey, normalized);

  const ledger = (existing || []).filter((row) => row.account_id === accountId);
  const byId = new Map(ledger.map((row) => [row.transaction_id, row]));
  const linked = new Set(ledger.map((row) => row.reconciliation_id).filter((id) => String(id || "").startsWith("eb:")));
  const claimed = new Set(ledger.filter((row) => String(row.reconciliation_id || "").startsWith("eb:")).map((row) => row.transaction_id));
  const cancelled = new Set(ledger.map((row) => row.cancels_transaction_id).filter(Boolean));
  const candidates = ledger.filter((row) => !NOT_BANK_MOVEMENTS.has(row.transaction_type) && !cancelled.has(row.transaction_id));

  const plan = { create: [], reconcile: [], already: 0, upcomingKnown: 0, skipped, samples };
  for (const tx of identified) {
    const imported = byId.get(tx.transactionId);
    // Créée lors d'un passage interrompu avant son rapprochement : on le termine.
    if (imported && !imported.reconciled) {
      plan.reconcile.push({ transactionId: imported.transaction_id, reconciliationId: tx.reconciliationId, reconciliationDate: tx.bankDate, bank: { date: tx.bankDate, amount: tx.amount, merchant: tx.merchant } });
      continue;
    }
    if (imported || linked.has(tx.reconciliationId)) { plan.already += 1; continue; }
    if (importFrom && tx.bankDate < importFrom) { skipped.beforeImportFrom += 1; continue; }
    const match = candidates
      .filter((row) => !claimed.has(row.transaction_id))
      .filter((row) => Math.abs(Number(row.signed_amount) - tx.amount) < 0.005)
      .map((row) => ({ row, distance: Math.min(dayDistance(row.bank_date, tx.bankDate), dayDistance(row.effective_date, tx.bankDate), dayDistance(row.effective_date, tx.effectiveDate)) }))
      .filter((item) => item.distance <= MATCH_DAYS)
      .sort((a, b) => a.distance - b.distance || String(a.row.transaction_id).localeCompare(String(b.row.transaction_id)))[0];
    if (match) {
      claimed.add(match.row.transaction_id);
      const row = match.row;
      // Une opération déjà rapprochée à la main garde sa date et son repère :
      // on ne fait que la compter, elle est retrouvée à l'identique la fois suivante.
      if (row.reconciled && row.reconciliation_id) { plan.already += 1; continue; }
      plan.reconcile.push({
        transactionId: row.transaction_id,
        reconciliationId: tx.reconciliationId,
        reconciliationDate: row.reconciled && row.reconciliation_date ? row.reconciliation_date : tx.bankDate,
        bank: { date: tx.bankDate, amount: tx.amount, merchant: tx.merchant },
      });
      continue;
    }
    const rule = findMerchantRule(rules, tx, accountId);
    plan.create.push({ transaction: buildImportedTransaction(tx, accountId, rule), reconciliationId: tx.reconciliationId, reconciliationDate: tx.bankDate, ruleId: rule?.rule_id || null });
  }

  // Opérations à venir, APRÈS les comptabilisées (une saisie future déjà
  // retenue par une opération comptabilisée ne sert pas deux fois).
  // - datée : reconnue si une saisie de même compte et montant existe à
  //   MATCH_DAYS jours (rien n'est écrit), sinon CRÉÉE à sa date future, NON
  //   rapprochée : le jour où la banque la comptabilise, elle est rapprochée
  //   (même identifiant, ou même montant à MATCH_DAYS jours), jamais doublée ;
  // - sans date : reconnue si une saisie future de même montant existe dans
  //   les UPCOMING_UNDATED_DAYS jours, sinon seulement listée.
  const free = (row) => !claimed.has(row.transaction_id) && !cancelled.has(row.transaction_id) && !NOT_BANK_MOVEMENTS.has(row.transaction_type);
  const sameAmount = (row, tx) => Math.abs(Number(row.signed_amount) - tx.amount) < 0.005;
  const dated = withExternalIds(accountKey, upcoming.filter((u) => u.tx.bankDate).map((u) => u.tx));
  for (const tx of dated) {
    if (byId.has(tx.transactionId) || linked.has(tx.reconciliationId)) { plan.upcomingKnown += 1; continue; }
    const match = ledger
      .filter((row) => free(row) && sameAmount(row, tx))
      .map((row) => ({ row, distance: Math.min(dayDistance(row.bank_date, tx.bankDate), dayDistance(row.effective_date, tx.bankDate)) }))
      .filter((item) => item.distance <= MATCH_DAYS)
      .sort((a, b) => a.distance - b.distance || String(a.row.transaction_id).localeCompare(String(b.row.transaction_id)))[0];
    if (match) { claimed.add(match.row.transaction_id); plan.upcomingKnown += 1; continue; }
    const rule = findMerchantRule(rules, tx, accountId);
    plan.create.push({ transaction: buildImportedTransaction(tx, accountId, rule), reconciliationId: null, reconciliationDate: null, ruleId: rule?.rule_id || null, upcoming: true });
  }
  const horizon = today ? shiftDays(today, UPCOMING_UNDATED_DAYS) : null;
  for (const { tx, raw } of upcoming.filter((u) => !u.tx.bankDate)) {
    const match = ledger
      .filter((row) => free(row) && sameAmount(row, tx) && row.bank_date > today && row.bank_date <= horizon)
      .sort((a, b) => String(a.bank_date).localeCompare(String(b.bank_date)) || String(a.transaction_id).localeCompare(String(b.transaction_id)))[0];
    if (match) { claimed.add(match.transaction_id); plan.upcomingKnown += 1; continue; }
    skipped.upcomingUndated += 1;
    if (samples.upcomingUndated.length < SAMPLE_SIZE) samples.upcomingUndated.push(sampleOf(raw));
  }
  return plan;
}

// Date de début de la requête à la banque pour un compte lié.
export function syncDateFrom({ importFrom, lastSyncedAt, today }) {
  const floor = importFrom || today;
  if (!lastSyncedAt) return floor;
  const overlap = shiftDays(String(lastSyncedAt).slice(0, 10), -RESYNC_OVERLAP_DAYS);
  return overlap > floor ? overlap : floor;
}

export function consentStatus(validUntil, now = new Date()) {
  const end = Date.parse(validUntil || "");
  if (!Number.isFinite(end)) return { state: "unknown", daysLeft: null };
  const daysLeft = Math.floor((end - now.getTime()) / 86_400_000);
  if (end <= now.getTime()) return { state: "expired", daysLeft: 0 };
  return { state: daysLeft <= CONSENT_WARNING_DAYS ? "soon" : "ok", daysLeft };
}

// Rapport du matin : état de chaque accès bancaire et alertes (accès qui
// expire dans 7 jours ou moins, ou expiré ; comptes en erreur au dernier passage).
export function bankReportSection(connections, now = new Date()) {
  const banks = (Array.isArray(connections) ? connections : []).map((c) => {
    const consent = consentStatus(c.valid_until, now);
    const results = Array.isArray(c.last_sync_result) ? c.last_sync_result : [];
    return {
      name: c.aspsp_name,
      validUntil: c.valid_until,
      consent: consent.state,
      daysLeft: consent.daysLeft,
      lastSyncAt: c.last_sync_at || null,
      created: results.reduce((n, r) => n + (Number(r.created) || 0), 0),
      reconciled: results.reduce((n, r) => n + (Number(r.reconciled) || 0), 0),
      errors: results.filter((r) => r.error).map((r) => ({ account: r.label || r.accountId, error: r.error })),
    };
  });
  const alerts = [];
  for (const b of banks) {
    if (b.consent === "expired") alerts.push(`${b.name} : accès bancaire expiré, à renouveler dans Réglages → Banques connectées.`);
    else if (b.consent === "soon") alerts.push(`${b.name} : accès bancaire à renouveler sous ${b.daysLeft} jour${b.daysLeft > 1 ? "s" : ""}.`);
    for (const e of b.errors) if (e.error !== "consent_expired") alerts.push(`${b.name} · ${e.account} : synchronisation en erreur (${e.error}).`);
  }
  return { banks, alerts };
}

// Solde le plus pertinent d'une liste Enable Banking (comptable de clôture
// d'abord, puis disponible), arrondi au centime.
export function pickBalance(balances) {
  const order = ["CLBD", "ITBD", "XPCD", "CLAV", "ITAV", "OPBD"];
  const list = Array.isArray(balances) ? balances : [];
  const best = [...list].sort((a, b) => {
    const ia = order.indexOf(a.balance_type); const ib = order.indexOf(b.balance_type);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  })[0];
  const amount = Number(best?.balance_amount?.amount);
  if (!best || !Number.isFinite(amount)) return null;
  return { amount: Math.round(amount * 100) / 100, currency: String(best.balance_amount.currency || "EUR"), type: best.balance_type || null, date: best.reference_date || null };
}
