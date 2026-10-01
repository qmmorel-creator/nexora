import { json } from "./nexora.js";
import { financeFetch, requireFinanceConfig } from "./finance.js";
import { requireOwner } from "./owner.js";

// Accès aux données Budget KDM360 depuis la session Nexora du NAVIGATEUR
// (#569, #572). Contrairement à drive-archive, la simple présence d'un jeton ne
// suffit pas : ce sont les finances personnelles du propriétaire (vérification
// dans owner.ts). La clé KDM360 reste côté serveur.

export type FinanceReadConfig = { url: string; secretKey: string };

// Renvoie la configuration KDM360 si la requête vient de la session du
// propriétaire, sinon la réponse d'erreur à retourner telle quelle.
export async function requireOwnerFinance(req: Request): Promise<{ config: FinanceReadConfig } | { response: Response }> {
  const denied = await requireOwner(req);
  if (denied) return { response: denied };

  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) {
    return { response: json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503) };
  }
  return { config: { url: finance.url, secretKey: finance.secretKey } };
}

const PAGE = 1000;
const MAX_ROWS = 1_000_000;

// Toutes les lignes, par pages de 1000 comme OS360. Au-delà de la limite de
// sécurité : erreur, jamais un résultat partiel qui fausserait les montants.
export async function readAllRows(config: FinanceReadConfig, spec: { table: string; select: string; order: string }) {
  const rows: unknown[] = [];
  const order = spec.order.split(",").map((column) => `${column}.asc`).join(",");
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await financeFetch(config, `/rest/v1/${spec.table}?select=${spec.select}&order=${order}&limit=${PAGE}&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error("finance_invalid_response");
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
  throw new Error("finance_volume_limit");
}

// Tables lues par les widgets Budget natifs et le rapport du matin (#586) :
// seules les colonnes utilisées par lib/finance-budget.mjs.
export const BUDGET_TABLES = {
  transactions: { table: "finance_transactions_current", select: "transaction_id,effective_date,bank_date,transaction_type,account_id,signed_amount,merchant,category,subcategory,description,category_confidence,cancels_transaction_id,raw", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,opening_balance,color,active", order: "account_id" },
  categories: { table: "finance_categories_current", select: "category,color,active", order: "category" },
  subcategories: { table: "finance_subcategories_current", select: "category,subcategory,active", order: "category,subcategory" },
  banks: { table: "finance_banks", select: "bank_id,name,color", order: "bank_id" },
  accountTypes: { table: "finance_account_types", select: "id,name,color", order: "id" },
  balances: { table: "finance_account_balances", select: "account_id,as_of_date,balance", order: "account_id,as_of_date" },
} as const;

export async function readBudgetTables(config: FinanceReadConfig) {
  const entries = await Promise.all(Object.entries(BUDGET_TABLES).map(async ([key, spec]) => [key, await readAllRows(config, spec)] as const));
  return Object.fromEntries(entries);
}
