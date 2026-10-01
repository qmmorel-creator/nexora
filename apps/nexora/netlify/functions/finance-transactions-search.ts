import type { Config } from "@netlify/functions";
import { requireFinanceConfig } from "./_shared/finance.js";
import { readBudgetTables } from "./_shared/finance-owner.js";
import { isAuthorized, json, requireConfig } from "./_shared/nexora.js";
import { searchTransactions } from "../../lib/finance-budget.mjs";

// Recherche de transactions Budget pour l'assistant (#587), en LECTURE SEULE,
// avec la clé de l'assistant. Filtres : query, dateFrom, dateTo (aaaa-mm-jj,
// date effective), category, accountId, type, minAmount, maxAmount (valeur
// absolue), limit (≤ 200), offset.
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const assistant = requireConfig();
  if (assistant.missing.length || !assistant.apiKey) return json({ ok: false, error: "configuration_missing", missing: assistant.missing }, 503);
  if (!isAuthorized(req, assistant.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);
  const params = new URL(req.url).searchParams;
  const filters: Record<string, unknown> = {};
  for (const key of ["query", "dateFrom", "dateTo", "category", "accountId", "type", "minAmount", "maxAmount", "limit", "offset"]) {
    const value = params.get(key);
    if (value != null && value !== "") filters[key] = value;
  }
  for (const key of ["dateFrom", "dateTo"]) if (filters[key] && !DATE.test(String(filters[key]))) return json({ ok: false, error: "invalid_dates" }, 400);
  for (const key of ["minAmount", "maxAmount", "limit", "offset"]) if (filters[key] != null && !Number.isFinite(Number(filters[key]))) return json({ ok: false, error: `invalid_${key}` }, 400);
  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503);
  try {
    return json({ ok: true, ...searchTransactions(await readBudgetTables({ url: finance.url, secretKey: finance.secretKey }), filters) });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/finance/transactions/search", method: ["GET"] };
