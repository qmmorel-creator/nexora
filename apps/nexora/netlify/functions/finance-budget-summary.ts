import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readBudgetTables, requireOwnerFinance } from "./_shared/finance-owner.js";
import { buildBudgetPeriodTotals, buildBudgetSummary } from "../../lib/finance-budget.mjs";

// Widgets Budget natifs (#586) : synthèse d'un mois calculée côté serveur
// (lib/finance-budget.mjs), pour la session Nexora du
// propriétaire. Avec `from` et/ou `to` (aaaa-mm-jj, #644) : seulement les
// totaux d'une période libre. LECTURE SEULE : les écritures passent par
// /api/nexora/finance-owner-transactions.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const params = new URL(req.url).searchParams;
  const month = params.get("month") || null;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ ok: false, error: "invalid_month" }, 400);
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  const isPeriod = params.has("from") || params.has("to");
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (isPeriod && ((from && !day.test(from)) || (to && !day.test(to)) || (from && to && from > to))) return json({ ok: false, error: "invalid_period" }, 400);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  try {
    const raw = await readBudgetTables(access.config);
    if (isPeriod) return json({ ok: true, data: buildBudgetPeriodTotals(raw, from, to) });
    return json({ ok: true, data: buildBudgetSummary(raw, month) });
  } catch (error) {
    // Date bien formée mais inexistante (2026-02-31) : refusée par le module.
    if (error instanceof Error && error.message === "invalid_period") return json({ ok: false, error: "invalid_period" }, 400);
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-budget-summary", method: ["GET"] };
