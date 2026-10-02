import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readBudgetTables, requireOwnerFinance } from "./_shared/finance-owner.js";
import { buildWealthSeries } from "../../lib/finance-budget.mjs";

// Évolution du patrimoine (#645) : solde de chaque compte en fin de jour, de
// semaine ou de mois sur une période (lib/finance-budget.mjs), pour la
// session Nexora du propriétaire. LECTURE SEULE.
// `step` = day | week | month ; `from` / `to` facultatifs (aaaa-mm-jj).
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const params = new URL(req.url).searchParams;
  const step = params.get("step") || "month";
  const from = params.get("from") || null;
  const to = params.get("to") || null;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (!["day", "week", "month"].includes(step)) return json({ ok: false, error: "invalid_step" }, 400);
  if ((from && !day.test(from)) || (to && !day.test(to)) || (from && to && from > to)) return json({ ok: false, error: "invalid_period" }, 400);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  try {
    const raw = await readBudgetTables(access.config);
    return json({ ok: true, data: buildWealthSeries(raw, from, to, step) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Période refusée par le module (date inexistante, début dans le futur) ou trop de points.
    if (message === "invalid_period" || message === "too_many_points") return json({ ok: false, error: message }, 400);
    return json({ ok: false, error: "finance_read_failed", detail: message }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-wealth-series", method: ["GET"] };
