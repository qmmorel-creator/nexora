import type { Config } from "@netlify/functions";
import { requireFinanceConfig } from "./_shared/finance.js";
import { readBudgetTables } from "./_shared/finance-owner.js";
import { isAuthorized, json, requireConfig } from "./_shared/nexora.js";
import { buildBudgetSummary } from "../../lib/finance-budget.mjs";

// Synthèse Budget pour l'assistant (#587 : MCP, automatisations ChatGPT), en
// LECTURE SEULE, avec la clé de l'assistant comme les autres /api/finance/*.
// Mêmes chiffres que les widgets (lib/finance-budget.mjs) ; les séries
// journalières des graphiques sont retirées, inutiles à un assistant.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const assistant = requireConfig();
  if (assistant.missing.length || !assistant.apiKey) return json({ ok: false, error: "configuration_missing", missing: assistant.missing }, 503);
  if (!isAuthorized(req, assistant.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);
  const month = new URL(req.url).searchParams.get("month") || null;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ ok: false, error: "invalid_month" }, 400);
  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503);
  try {
    const summary = buildBudgetSummary(await readBudgetTables({ url: finance.url, secretKey: finance.secretKey }), month);
    const { charts, ...rest } = summary;
    return json({ ok: true, ...rest, byCategory: charts.byCategory, monthlyExpenses: charts.periodic });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/finance/budget-summary", method: ["GET"] };
