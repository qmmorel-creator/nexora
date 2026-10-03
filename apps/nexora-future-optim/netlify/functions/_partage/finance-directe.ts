// Finances en DIRECT sur Supabase KDM360 (sevrage de Nexora, #721 ; Ref #687).
// Copie de la logique des fonctions amont de nexora-project (apps/nexora/netlify/functions,
// main au commit 2de1ad9) : finance-budget-summary.ts, finance-wealth-series.ts,
// finance-sankey-data.ts, finance-transactions-data.ts et la branche « catégoriser »
// de finance-owner-transactions.ts. Mêmes réponses JSON, mêmes codes d'erreur.
//
// Bascule : avec KDM360_SUPABASE_SECRET_KEY dans l'environnement d'Optim, les cinq
// routes sont servies ici ; sans elle, relais inchangé vers nexora-project (#659).
// Dans les deux cas, la liste blanche et la validation de _partage/relais-finance.ts
// passent D'ABORD : la voie directe reçoit exactement ce que le relais aurait transmis
// (paramètres filtrés, corps de catégorisation reconstruit, clé « optim:<clé> »), et
// répond donc comme la chaîne Optim → nexora-project d'aujourd'hui.
//
// Idempotence : l'amont préfixe la clé par « nexora: » ; le relais envoie « optim:<clé> ».
// La clé finale reste donc « nexora:optim:<clé> », pour qu'une écriture rejouée
// (avant / après bascule) ne soit pas doublée par la RPC finance_apply_transaction_write.
import { router, type Route } from "./relais-finance.js";
import {
  applyFinanceTransactionWrite, getFinanceCatalogs, getFinanceTransaction, readBudgetTables, readTables,
  requireFinanceConfig, SANKEY_TABLES, TRANSACTIONS_TABLES, type FinanceReadConfig, type LireEnv,
} from "./finance-supabase.js";
import { buildCategorizedTransaction, validateAccount, validateCategoryPair } from "./finance-validation.mjs";
import { buildBudgetPeriodTotals, buildBudgetSummary, buildWealthSeries } from "../../../src/nexora/finance-budget.mjs";

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

const OPTIONS = { allowEmptySubcategory: true };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Configuration KDM360 si la clé est posée dans Optim, sinon null (→ relais).
export function configurationDirecte(env: LireEnv): FinanceReadConfig | null {
  const finance = requireFinanceConfig(env);
  return finance.secretKey ? { url: finance.url, secretKey: finance.secretKey } : null;
}

// Copie de finance-owner-transactions.ts : idempotencyKeyOf.
function idempotencyKeyOf(body: Record<string, unknown>) {
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!key) throw new Error("idempotency_key_required");
  if (key.length > 200) throw new Error("idempotency_key_too_long");
  return `nexora:${key}`;
}

// Copie de finance-budget-summary.ts (après le contrôle du propriétaire).
async function budgetSummary(config: FinanceReadConfig, params: URLSearchParams) {
  const month = params.get("month") || null;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ ok: false, error: "invalid_month" }, 400);
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  const isPeriod = params.has("from") || params.has("to");
  if (isPeriod && ((from && !DAY.test(from)) || (to && !DAY.test(to)) || (from && to && from > to))) return json({ ok: false, error: "invalid_period" }, 400);
  try {
    const raw = await readBudgetTables(config);
    if (isPeriod) return json({ ok: true, data: buildBudgetPeriodTotals(raw, from, to) });
    return json({ ok: true, data: buildBudgetSummary(raw, month) });
  } catch (error) {
    // Date bien formée mais inexistante (2026-02-31) : refusée par le module.
    if (error instanceof Error && error.message === "invalid_period") return json({ ok: false, error: "invalid_period" }, 400);
    return json({ ok: false, error: "finance_read_failed", detail: message(error) }, 502);
  }
}

// Copie de finance-wealth-series.ts.
async function wealthSeries(config: FinanceReadConfig, params: URLSearchParams) {
  const step = params.get("step") || "month";
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  if (!["day", "week", "month"].includes(step)) return json({ ok: false, error: "invalid_step" }, 400);
  if ((from && !DAY.test(from)) || (to && !DAY.test(to)) || (from && to && from > to)) return json({ ok: false, error: "invalid_period" }, 400);
  try {
    const raw = await readBudgetTables(config);
    return json({ ok: true, data: buildWealthSeries(raw, from, to, step) });
  } catch (error) {
    const texte = message(error);
    // Période refusée par le module (date inexistante, début dans le futur) ou trop de points.
    if (texte === "invalid_period" || texte === "too_many_points") return json({ ok: false, error: texte }, 400);
    return json({ ok: false, error: "finance_read_failed", detail: texte }, 502);
  }
}

// Copie de finance-sankey-data.ts et finance-transactions-data.ts.
async function tables(config: FinanceReadConfig, liste: Parameters<typeof readTables>[1]) {
  try {
    return json({ ok: true, data: await readTables(config, liste) });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: message(error) }, 502);
  }
}

// Copie de la branche PATCH (catégorisation) de finance-owner-transactions.ts. Le corps
// est celui reconstruit par le relais : jamais d'`operation: "edit"`, ni de POST.
async function categoriser(config: FinanceReadConfig, body: Record<string, unknown> | null) {
  try {
    if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_body" }, 400);
    const idempotencyKey = idempotencyKeyOf(body);
    const catalogs = await getFinanceCatalogs(config);
    const transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    if (!transactionId) return json({ ok: false, error: "transaction_id_required" }, 400);
    const existing = await getFinanceTransaction(config, transactionId);
    if (!existing) return json({ ok: false, error: "transaction_not_found" }, 404);
    const transaction = buildCategorizedTransaction(existing, { ...body, categoryConfidence: 1 }, OPTIONS);
    validateAccount(catalogs, String(transaction.account_id));
    validateCategoryPair(catalogs, String(transaction.category), transaction.subcategory as string | null, OPTIONS);
    const result = await applyFinanceTransactionWrite(config, "update", transaction, idempotencyKey);
    return json({ ok: true, operation: "categorize", result, transaction });
  } catch (error) {
    const texte = message(error);
    const clientError = /(_required|_too_long|^invalid_|_not_found|unsupported_|_must_be_)/.test(texte);
    return json({ ok: false, error: clientError ? texte : "finance_write_failed", detail: clientError ? undefined : texte }, clientError ? 400 : 502);
  }
}

// Route déjà validée par le relais → réponse servie depuis Supabase.
export async function traiterEnDirect(route: Extract<Route, { ok: true }>, config: FinanceReadConfig): Promise<Response> {
  const cible = new URL(route.url);
  const nom = cible.pathname.replace(/^\/api\/nexora\//, "");
  if (route.methode === "PATCH") {
    let corps: Record<string, unknown> | null = null;
    try { corps = route.corps ? JSON.parse(route.corps) : null; } catch { corps = null; }
    return categoriser(config, corps);
  }
  switch (nom) {
    case "finance-budget-summary": return budgetSummary(config, cible.searchParams);
    case "finance-wealth-series": return wealthSeries(config, cible.searchParams);
    case "finance-sankey-data": return tables(config, SANKEY_TABLES);
    case "finance-transactions-data": return tables(config, TRANSACTIONS_TABLES);
  }
  return json({ ok: false, error: "not_found" }, 404);
}

// Point d'entrée commun (après vérification du jeton Firebase dans optim-finance.mts) :
// liste blanche, puis voie directe si la clé KDM360 est posée, sinon relais.
export async function servirFinance(req: { methode: string; chemin: string; params: URLSearchParams; corps: unknown; jeton: string }, env: LireEnv): Promise<Response> {
  const r = router(req.methode, req.chemin, req.params, req.corps);
  if (!r.ok) return json({ ok: false, error: r.erreur }, r.statut);
  const config = configurationDirecte(env);
  if (config) return traiterEnDirect(r, config);
  try {
    const amont = await fetch(r.url, {
      method: r.methode, body: r.corps, signal: AbortSignal.timeout(9_500), // sous la limite de 10 s d'une fonction Netlify : erreur lisible
      headers: { authorization: `Bearer ${req.jeton}`, accept: "application/json", ...(r.corps ? { "content-type": "application/json" } : {}) },
    });
    const texte = await amont.text();
    return new Response(texte, { status: amont.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return json({ ok: false, error: "finance_relay_failed", detail: e instanceof Error ? e.message : String(e) }, 502);
  }
}
