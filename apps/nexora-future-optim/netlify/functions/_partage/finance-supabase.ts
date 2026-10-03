// Copie de apps/nexora/netlify/functions/_shared/finance.ts et _shared/finance-owner.ts
// (sevrage de Nexora, #721 ; main au commit 2de1ad9). Accès REST à Supabase KDM360 :
// mêmes requêtes, mêmes listes de tables et de colonnes, même RPC d'écriture.
// Écarts volontaires :
//   - la configuration est lue par un accesseur d'environnement INJECTÉ (testable),
//     au lieu du global Netlify.env ;
//   - le contrôle du propriétaire (requireOwner) reste dans optim-finance.mts ;
//   - les listes de tables des widgets Sankey et Transactions, définies dans les
//     fonctions amont finance-sankey-data.ts et finance-transactions-data.ts, sont
//     regroupées ici.

export type LireEnv = (nom: string) => string | undefined;
export type FinanceReadConfig = { url: string; secretKey: string };

const DEFAULT_SUPABASE_URL = "https://ftgmjaozveprnshkdosj.supabase.co";

export type FinanceCatalogs = {
  accounts: Array<{ account_id: string; name: string; bank: string | null; account_type: string | null }>;
  categories: Array<{ category: string }>;
  subcategories: Array<{ category: string; subcategory: string }>;
};

export function requireFinanceConfig(env: LireEnv) {
  const url = env("KDM360_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const secretKey = env("KDM360_SUPABASE_SECRET_KEY");
  return { url, secretKey, missing: secretKey ? [] : ["KDM360_SUPABASE_SECRET_KEY"] };
}

export async function financeFetch(config: FinanceReadConfig, path: string, init: RequestInit = {}) {
  // Écart avec l'amont : délai de 9 s (sous la limite de 10 s d'une fonction Netlify),
  // comme le relais, pour renvoyer une erreur lisible plutôt qu'un dépassement muet.
  const response = await fetch(`${config.url}${path}`, {
    signal: AbortSignal.timeout(9_000),
    ...init,
    headers: {
      apikey: config.secretKey,
      authorization: `Bearer ${config.secretKey}`,
      "content-type": "application/json",
      ...(init.headers || {})
    }
  });
  const text = await response.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.error || `finance_http_${response.status}`);
    (error as any).status = response.status;
    throw error;
  }
  return payload;
}

export async function getFinanceCatalogs(config: FinanceReadConfig): Promise<FinanceCatalogs> {
  const [accounts, categories, subcategories] = await Promise.all([
    financeFetch(config, "/rest/v1/finance_accounts_current?select=account_id,name,bank,account_type&active=eq.true&order=name.asc"),
    financeFetch(config, "/rest/v1/finance_categories_current?select=category&active=eq.true&order=category.asc"),
    financeFetch(config, "/rest/v1/finance_subcategories_current?select=category,subcategory&active=eq.true&order=category.asc,subcategory.asc")
  ]);
  return { accounts, categories, subcategories };
}

export async function getFinanceTransaction(config: FinanceReadConfig, transactionId: string) {
  const encoded = encodeURIComponent(transactionId);
  const rows = await financeFetch(config, `/rest/v1/finance_transactions_current?select=*&transaction_id=eq.${encoded}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function applyFinanceTransactionWrite(
  config: FinanceReadConfig,
  operation: "create" | "update" | "import",
  transaction: Record<string, unknown>,
  idempotencyKey: string
) {
  return financeFetch(config, "/rest/v1/rpc/finance_apply_transaction_write", {
    method: "POST",
    body: JSON.stringify({
      p_operation: operation,
      p_transaction: transaction,
      p_idempotency_key: idempotencyKey
    })
  });
}

// --- Lecture paginée (copie de _shared/finance-owner.ts) ---

type Spec = { table: string; select: string; order: string };

const PAGE = 1000;
const MAX_ROWS = 1_000_000;

// Toutes les lignes, par pages de 1000. Au-delà de la limite de
// sécurité : erreur, jamais un résultat partiel qui fausserait les montants.
// signal : échéance commune à toutes les pages (et à toutes les tables via readTables),
// pour rester sous la limite d'une fonction Netlify même avec plusieurs pages.
export async function readAllRows(config: FinanceReadConfig, spec: Spec, signal: AbortSignal = AbortSignal.timeout(9_000)) {
  const rows: unknown[] = [];
  const order = spec.order.split(",").map((column) => `${column}.asc`).join(",");
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const page = await financeFetch(config, `/rest/v1/${spec.table}?select=${spec.select}&order=${order}&limit=${PAGE}&offset=${offset}`, { signal });
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

// Copie de finance-sankey-data.ts (#569) : colonnes strictement nécessaires aux deux Sankey.
export const SANKEY_TABLES = {
  transactions: { table: "finance_transactions_current", select: "transaction_id,effective_date,bank_date,transaction_type,account_id,signed_amount,category,subcategory,cancels_transaction_id", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,opening_balance,color,active", order: "account_id" },
  categories: { table: "finance_categories_current", select: "category,color", order: "category" },
  banks: { table: "finance_banks", select: "bank_id,name,color", order: "bank_id" },
  accountTypes: { table: "finance_account_types", select: "id,name,color", order: "id" },
  balances: { table: "finance_account_balances", select: "account_id,as_of_date,balance", order: "account_id,as_of_date" },
} as const;

// Copie de finance-transactions-data.ts (#572) : 100 % des transactions, TOUS leurs
// champs (select=*), avec les comptes pour afficher leur nom et leur banque.
export const TRANSACTIONS_TABLES = {
  transactions: { table: "finance_transactions_current", select: "*", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,active", order: "account_id" },
} as const;

export async function readTables(config: FinanceReadConfig, tables: Record<string, Spec>) {
  const signal = AbortSignal.timeout(9_000);
  const entries = await Promise.all(Object.entries(tables).map(async ([key, spec]) => [key, await readAllRows(config, spec, signal)] as const));
  return Object.fromEntries(entries);
}

export const readBudgetTables = (config: FinanceReadConfig) => readTables(config, BUDGET_TABLES);
