import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readBudgetTables, requireOwnerFinance } from "./_shared/finance-owner.js";
import { buildBudgetSummary } from "../../lib/finance-budget.mjs";

// Widgets Budget natifs (#586) : synthèse d'un mois calculée côté serveur
// (lib/finance-budget.mjs), pour la session Nexora du
// propriétaire. LECTURE SEULE : les écritures passent par
// /api/nexora/finance-owner-transactions.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const month = new URL(req.url).searchParams.get("month") || null;
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return json({ ok: false, error: "invalid_month" }, 400);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  try {
    const raw = await readBudgetTables(access.config);
    return json({ ok: true, data: buildBudgetSummary(raw, month) });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-budget-summary", method: ["GET"] };
