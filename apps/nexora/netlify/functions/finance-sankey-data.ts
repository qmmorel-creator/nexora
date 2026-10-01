import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readAllRows, requireOwnerFinance } from "./_shared/finance-owner.js";

// Données des widgets Sankey Budget (#569), en LECTURE SEULE, pour la session
// Nexora du propriétaire (vérification dans _shared/finance-owner.ts). Seules
// les colonnes lues par les deux Sankey sont renvoyées.

// Colonnes strictement nécessaires (voir financeSankeyNormalize côté interface).
const TABLES = {
  transactions: { table: "finance_transactions_current", select: "transaction_id,effective_date,bank_date,transaction_type,account_id,signed_amount,category,subcategory,cancels_transaction_id", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,opening_balance,color,active", order: "account_id" },
  categories: { table: "finance_categories_current", select: "category,color", order: "category" },
  banks: { table: "finance_banks", select: "bank_id,name,color", order: "bank_id" },
  accountTypes: { table: "finance_account_types", select: "id,name,color", order: "id" },
  balances: { table: "finance_account_balances", select: "account_id,as_of_date,balance", order: "account_id,as_of_date" },
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

export const config: Config = { path: "/api/nexora/finance-sankey-data", method: ["GET"] };
