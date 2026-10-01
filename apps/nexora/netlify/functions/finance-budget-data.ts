import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readAllRows, requireOwnerFinance } from "./_shared/finance-owner.js";

// Widget « Graphique financier » (#573) : les tables Budget KDM360 telles
// qu'OS360 les charge (mêmes tables, mêmes tris, select=*), pour le moteur de
// graphiques OS360 servi par Nexora (public/os360-moteur). LECTURE SEULE, pour
// la session Nexora du propriétaire (vérification dans _shared/finance-owner.ts).
// Les clés reprennent celles d'OS360 (kc / Hc dans son bundle) : le moteur les
// passe telles quelles à sa fonction de chargement (Fc).
const TABLES = {
  transactions: { table: "finance_transactions_current", select: "*", order: "transaction_id" },
  categories: { table: "finance_categories_current", select: "*", order: "category" },
  subcategories: { table: "finance_subcategories_current", select: "*", order: "category,subcategory" },
  banks: { table: "finance_banks", select: "*", order: "bank_id" },
  accounts: { table: "finance_accounts_current", select: "*", order: "account_id" },
  accountTypes: { table: "finance_account_types", select: "*", order: "id" },
  budgets: { table: "finance_category_budgets", select: "*", order: "month,category" },
  balances: { table: "finance_account_balances", select: "*", order: "account_id,as_of_date" },
} as const;

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  try {
    const entries = await Promise.all(Object.entries(TABLES).map(async ([key, spec]) => [key, await readAllRows(access.config, spec)] as const));
    return json({ ok: true, data: Object.fromEntries(entries) });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-budget-data", method: ["GET"] };
