import { createSign, randomBytes } from "node:crypto";
import {
  aspspKeyOf,
  consentStatus,
  describeSessionAccounts,
  MATCH_DAYS,
  pickBalance,
  planAccountSync,
  syncDateFrom
} from "../../../lib/bank-sync.mjs";
import { applyFinanceTransactionWrite, financeFetch } from "./finance.js";
import { parisDate } from "./nexora.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Synchronisation bancaire Enable Banking (#677), côté serveur.
// - Enable Banking : jeton JWT RS256 signé avec la clé privée de
//   l'application (variables Netlify ENABLE_BANKING_APP_ID et
//   ENABLE_BANKING_PRIVATE_KEY_B64, ou ENABLE_BANKING_PRIVATE_KEY en clair).
// - État : tables finance_bank_* de la base Budget (service_role seul,
//   apps/nexora/supabase/finance_bank_sync.sql).
// - Écritures : finance_apply_transaction_write (opération `import`) et
//   finance_set_transaction_reconciliation, comme le reste du Budget.
// Accès en LECTURE SEULE aux banques : aucune initiation de paiement.

type FinanceConfig = { url: string; secretKey: string };
export type EnableBankingConfig = { appId: string; privateKey: string };

const API = "https://api.enablebanking.com";
export const DEFAULT_REDIRECT_URL = "https://nexora-project.org/api/finance/enable-banking/callback";
const CONSENT_DAYS = 180;
const AUTH_REQUEST_TTL_MS = 30 * 60 * 1000;

export function requireEnableBankingConfig(): { config: EnableBankingConfig | null; missing: string[] } {
  const appId = (Netlify.env.get("ENABLE_BANKING_APP_ID") || "").trim();
  const encoded = (Netlify.env.get("ENABLE_BANKING_PRIVATE_KEY_B64") || "").trim();
  const plain = Netlify.env.get("ENABLE_BANKING_PRIVATE_KEY") || "";
  let privateKey = "";
  if (encoded) privateKey = Buffer.from(encoded, "base64").toString("utf8");
  else if (plain) privateKey = plain.replace(/\\n/g, "\n");
  const missing = [
    !appId && "ENABLE_BANKING_APP_ID",
    !privateKey && "ENABLE_BANKING_PRIVATE_KEY_B64"
  ].filter(Boolean) as string[];
  if (privateKey && !/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(privateKey)) missing.push("ENABLE_BANKING_PRIVATE_KEY_B64 (clé illisible)");
  return { config: missing.length ? null : { appId, privateKey }, missing };
}

export function redirectUrl() {
  return (Netlify.env.get("ENABLE_BANKING_REDIRECT_URL") || "").trim() || DEFAULT_REDIRECT_URL;
}

const base64url = (value: string | Buffer) => Buffer.from(value).toString("base64url");

export function enableBankingJwt(config: EnableBankingConfig, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: config.appId }));
  const payload = base64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(config.privateKey);
  return `${header}.${payload}.${base64url(signature)}`;
}

export async function enableBankingFetch(config: EnableBankingConfig, path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${enableBankingJwt(config)}`, "content-type": "application/json", ...(init.headers || {}) }
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(`enable_banking_http_${response.status}${payload?.error ? `:${payload.error}` : ""}`);
    (error as any).status = response.status;
    (error as any).detail = payload?.message || payload?.detail || null;
    throw error;
  }
  return payload;
}

// ---------- État en base ----------

const enc = encodeURIComponent;
const upsert = { Prefer: "resolution=merge-duplicates,return=representation" };

export async function listConnections(finance: FinanceConfig) {
  return await financeFetch(finance, "/rest/v1/finance_bank_connections?select=*&order=aspsp_name.asc") as any[];
}

export async function listLinks(finance: FinanceConfig) {
  return await financeFetch(finance, "/rest/v1/finance_bank_account_links?select=*&order=aspsp_key.asc,label.asc") as any[];
}

export async function updateLink(finance: FinanceConfig, accountKey: string, changes: Record<string, unknown>) {
  const rows = await financeFetch(finance, `/rest/v1/finance_bank_account_links?account_key=eq.${enc(accountKey)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...changes, updated_at: new Date().toISOString() })
  });
  if (!Array.isArray(rows) || !rows.length) throw new Error("bank_account_not_found");
  return rows[0];
}

// ---------- Autorisation ----------

export async function listFrenchBanks(config: EnableBankingConfig) {
  const payload = await enableBankingFetch(config, "/aspsps?country=FR&psu_type=personal");
  return (Array.isArray(payload?.aspsps) ? payload.aspsps : [])
    .map((a: any) => ({ name: String(a.name || ""), country: String(a.country || "FR"), logo: a.logo || null, maximumConsentValidity: Number(a.maximum_consent_validity) || null }))
    .filter((a: any) => a.name)
    .sort((a: any, b: any) => a.name.localeCompare(b.name, "fr"));
}

export async function startAuthorization(config: EnableBankingConfig, finance: FinanceConfig, aspspName: string, country = "FR") {
  const name = String(aspspName || "").trim();
  if (!name) throw new Error("aspsp_name_required");
  const banks = await listFrenchBanks(config);
  const bank = banks.find((b: any) => b.name === name && b.country === country);
  if (!bank) throw new Error("aspsp_not_found");
  const seconds = Math.min(CONSENT_DAYS * 86400, bank.maximumConsentValidity || CONSENT_DAYS * 86400);
  const validUntil = new Date(Date.now() + (seconds - 3600) * 1000).toISOString();
  const state = randomBytes(24).toString("hex");
  await financeFetch(finance, "/rest/v1/finance_bank_auth_requests", {
    method: "POST",
    body: JSON.stringify({ state, aspsp_name: name, aspsp_country: country })
  });
  const auth = await enableBankingFetch(config, "/auth", {
    method: "POST",
    body: JSON.stringify({ access: { valid_until: validUntil }, aspsp: { name, country }, state, redirect_url: redirectUrl(), psu_type: "personal" })
  });
  if (!auth?.url) throw new Error("enable_banking_auth_failed");
  return { url: String(auth.url), validUntil };
}

// Retour de la banque : `state` à usage unique et récent, puis ouverture de
// la session. Les comptes de la session sont enregistrés ; une liaison
// existante (compte Nexora, date de départ) est conservée.
export async function completeAuthorization(config: EnableBankingConfig, finance: FinanceConfig, code: string, state: string) {
  if (!code || !state || !/^[0-9a-f]{48}$/.test(state)) throw new Error("invalid_callback");
  const since = new Date(Date.now() - AUTH_REQUEST_TTL_MS).toISOString();
  const consumed = await financeFetch(finance, `/rest/v1/finance_bank_auth_requests?state=eq.${state}&consumed_at=is.null&created_at=gte.${enc(since)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ consumed_at: new Date().toISOString() })
  });
  const request = Array.isArray(consumed) ? consumed[0] : null;
  if (!request) throw new Error("auth_request_unknown_or_expired");

  const session = await enableBankingFetch(config, "/sessions", { method: "POST", body: JSON.stringify({ code }) });
  if (!session?.session_id) throw new Error("enable_banking_session_failed");
  const aspspKey = aspspKeyOf(request.aspsp_name, request.aspsp_country);
  const accounts = describeSessionAccounts(session.accounts);
  const now = new Date().toISOString();
  const previous = (await listConnections(finance)).find((c) => c.aspsp_key === aspspKey);
  await financeFetch(finance, "/rest/v1/finance_bank_connections?on_conflict=aspsp_key", {
    method: "POST",
    headers: upsert,
    body: JSON.stringify({
      aspsp_key: aspspKey,
      aspsp_name: request.aspsp_name,
      aspsp_country: request.aspsp_country,
      session_id: session.session_id,
      valid_until: session.access?.valid_until || null,
      accounts,
      updated_at: now
    })
  });
  if (accounts.length) {
    await financeFetch(finance, "/rest/v1/finance_bank_account_links?on_conflict=account_key", {
      method: "POST",
      headers: upsert,
      body: JSON.stringify(accounts.map((a) => ({
        account_key: a.accountKey,
        aspsp_key: aspspKey,
        account_uid: a.uid,
        label: a.label,
        iban_masked: a.ibanMasked,
        currency: a.currency,
        updated_at: now
      })))
    });
  }
  // L'ancienne session de cette banque n'a plus d'usage : on la ferme.
  if (previous?.session_id && previous.session_id !== session.session_id) {
    await enableBankingFetch(config, `/sessions/${enc(previous.session_id)}`, { method: "DELETE" }).catch(() => null);
  }
  return { aspspKey, aspspName: request.aspsp_name, accounts: accounts.length };
}

export async function disconnect(config: EnableBankingConfig, finance: FinanceConfig, aspspKey: string) {
  const connection = (await listConnections(finance)).find((c) => c.aspsp_key === aspspKey);
  if (!connection) throw new Error("bank_connection_not_found");
  await enableBankingFetch(config, `/sessions/${enc(connection.session_id)}`, { method: "DELETE" }).catch(() => null);
  await financeFetch(finance, `/rest/v1/finance_bank_connections?aspsp_key=eq.${enc(aspspKey)}`, { method: "DELETE" });
  await financeFetch(finance, `/rest/v1/finance_bank_account_links?aspsp_key=eq.${enc(aspspKey)}`, {
    method: "PATCH",
    body: JSON.stringify({ account_uid: null, updated_at: new Date().toISOString() })
  });
  return { aspspKey };
}

// ---------- Synchronisation ----------

function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function fetchBankTransactions(config: EnableBankingConfig, uid: string, dateFrom: string) {
  const all: unknown[] = [];
  let continuation: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ date_from: dateFrom });
    if (continuation) params.set("continuation_key", continuation);
    const payload = await enableBankingFetch(config, `/accounts/${enc(uid)}/transactions?${params}`);
    if (Array.isArray(payload?.transactions)) all.push(...payload.transactions);
    continuation = payload?.continuation_key || null;
    if (!continuation) return all;
  }
  throw new Error("enable_banking_pagination_limit");
}

const EXISTING_SELECT = "transaction_id,account_id,signed_amount,bank_date,effective_date,transaction_type,cancels_transaction_id,reconciled,reconciliation_date,reconciliation_id";

async function readExisting(finance: FinanceConfig, accountId: string, from: string) {
  const rows: any[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const page = await financeFetch(finance, `/rest/v1/finance_transactions_current?select=${EXISTING_SELECT}&account_id=eq.${enc(accountId)}&bank_date=gte.${from}&order=transaction_id.asc&limit=1000&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error("finance_invalid_response");
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
  throw new Error("finance_volume_limit");
}

async function setReconciled(finance: FinanceConfig, transactionId: string, date: string, reconciliationId: string) {
  return financeFetch(finance, "/rest/v1/rpc/finance_set_transaction_reconciliation", {
    method: "POST",
    body: JSON.stringify({ p_transaction_id: transactionId, p_reconciled: true, p_reconciliation_date: date, p_reconciliation_id: reconciliationId })
  });
}

export type AccountSyncResult = {
  accountKey: string; accountId: string | null; label: string | null;
  created: number; reconciled: number; already: number; remaining?: number; upcomingKnown?: number;
  skipped?: Record<string, unknown>; samples?: unknown; balance?: unknown; dateFrom?: string; error?: string;
};

// Écritures par appel : une fonction Netlify est coupée au bout de 10 s
// (30 s planifiée). Au-delà, le passage s'arrête proprement (`partial`) ; le
// suivant reprend là où il s'est arrêté, sans doublon (identifiants stables),
// et la date de dernière synchronisation n'avance qu'une fois le compte complet.
export const MAX_WRITES_PER_CALL = 25;

// Synchronise les comptes liés (tous, ou ceux de `accountKeys`). Chaque compte
// est indépendant : l'échec de l'un n'arrête pas les autres.
export async function runSync(config: EnableBankingConfig, finance: FinanceConfig, options: { accountKeys?: string[]; now?: Date; maxWrites?: number } = {}) {
  const now = options.now || new Date();
  let budget = options.maxWrites ?? MAX_WRITES_PER_CALL;
  const today = parisDate(now);
  const [connections, links, rules] = await Promise.all([
    listConnections(finance),
    listLinks(finance),
    financeFetch(finance, "/rest/v1/finance_merchant_rules?select=*&active=eq.true") as Promise<any[]>
  ]);
  const byBank = new Map(connections.map((c) => [c.aspsp_key, c]));
  const wanted = options.accountKeys?.length ? new Set(options.accountKeys) : null;
  const results: AccountSyncResult[] = [];

  for (const link of links) {
    if (wanted && !wanted.has(link.account_key)) continue;
    if (!link.account_id || !link.import_from) continue; // compte ignoré ou pas encore lié
    const result: AccountSyncResult = { accountKey: link.account_key, accountId: link.account_id, label: link.label, created: 0, reconciled: 0, already: 0 };
    results.push(result);
    try {
      const connection = byBank.get(link.aspsp_key);
      if (!connection || !link.account_uid) throw new Error("bank_not_connected");
      if (consentStatus(connection.valid_until, now).state === "expired") throw new Error("consent_expired");
      const dateFrom = syncDateFrom({ importFrom: link.import_from, lastSyncedAt: link.last_synced_at, today });
      result.dateFrom = dateFrom;
      const [bankTransactions, balances, existing] = await Promise.all([
        fetchBankTransactions(config, link.account_uid, dateFrom),
        enableBankingFetch(config, `/accounts/${enc(link.account_uid)}/balances`).catch(() => null),
        readExisting(finance, link.account_id, shiftDays(dateFrom, -(MATCH_DAYS + 3)))
      ]);
      result.balance = pickBalance(balances?.balances);
      const plan = planAccountSync({ accountKey: link.account_key, accountId: link.account_id, importFrom: link.import_from, bankTransactions, existing, rules, ignorePatterns: Array.isArray(link.ignore_patterns) ? link.ignore_patterns : [], today });
      result.already = plan.already;
      result.skipped = plan.skipped;
      result.samples = plan.samples;
      result.upcomingKnown = plan.upcomingKnown;
      // Rapprochements d'abord : une saisie existante ne doit jamais être
      // doublée par une création d'un passage interrompu.
      for (const item of plan.reconcile) {
        if (budget <= 0) break;
        await setReconciled(finance, item.transactionId, item.reconciliationDate, item.reconciliationId);
        result.reconciled += 1;
        budget -= 1;
      }
      for (const item of plan.create) {
        if (budget <= 0) break;
        const transaction = item.transaction as Record<string, unknown>;
        await applyFinanceTransactionWrite(finance, "import", transaction, `enable-banking:${transaction.transaction_id}`);
        // Une opération à venir n'est pas encore passée en banque : rapprochée
        // seulement le jour où la banque la comptabilise.
        if (item.reconciliationId && item.reconciliationDate) await setReconciled(finance, String(transaction.transaction_id), item.reconciliationDate, item.reconciliationId);
        result.created += 1;
        budget -= 1;
      }
      result.remaining = plan.reconcile.length + plan.create.length - result.reconciled - result.created;
      if (!result.remaining) await updateLink(finance, link.account_key, { last_synced_at: now.toISOString() });
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
  }

  const stamp = now.toISOString();
  for (const connection of connections) {
    const accountKeys = new Set(links.filter((l) => l.aspsp_key === connection.aspsp_key).map((l) => l.account_key));
    const mine = results.filter((r) => accountKeys.has(r.accountKey));
    if (!mine.length) continue;
    await financeFetch(finance, `/rest/v1/finance_bank_connections?aspsp_key=eq.${enc(connection.aspsp_key)}`, {
      method: "PATCH",
      body: JSON.stringify({ last_sync_at: stamp, last_sync_result: mine })
    }).catch(() => null);
  }
  return {
    at: stamp,
    accounts: results,
    created: results.reduce((n, r) => n + r.created, 0),
    reconciled: results.reduce((n, r) => n + r.reconciled, 0),
    errors: results.filter((r) => r.error).length,
    partial: results.some((r) => (r.remaining || 0) > 0)
  };
}

// État lisible par l'interface : jamais d'identifiant de session.
export async function readStatus(finance: FinanceConfig, now = new Date()) {
  const [connections, links] = await Promise.all([listConnections(finance), listLinks(finance)]);
  return {
    redirectUrl: redirectUrl(),
    connections: connections.map((c) => ({
      aspspKey: c.aspsp_key,
      name: c.aspsp_name,
      country: c.aspsp_country,
      validUntil: c.valid_until,
      consent: consentStatus(c.valid_until, now),
      lastSyncAt: c.last_sync_at,
      lastSyncResult: c.last_sync_result
    })),
    accounts: links.map((l) => ({
      accountKey: l.account_key,
      aspspKey: l.aspsp_key,
      connected: Boolean(l.account_uid),
      label: l.label,
      ibanMasked: l.iban_masked,
      currency: l.currency,
      accountId: l.account_id,
      importFrom: l.import_from,
      ignorePatterns: Array.isArray(l.ignore_patterns) ? l.ignore_patterns : [],
      lastSyncedAt: l.last_synced_at
    }))
  };
}
