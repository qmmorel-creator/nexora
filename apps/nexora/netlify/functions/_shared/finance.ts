declare const Netlify: { env: { get(name: string): string | undefined } };

const DEFAULT_SUPABASE_URL = "https://ftgmjaozveprnshkdosj.supabase.co";

export type FinanceCatalogs = {
  accounts: Array<{ account_id: string; name: string; bank: string | null; account_type: string | null }>;
  categories: Array<{ category: string }>;
  subcategories: Array<{ category: string; subcategory: string }>;
};

export function requireFinanceConfig() {
  const url = Netlify.env.get("KDM360_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const secretKey = Netlify.env.get("KDM360_SUPABASE_SECRET_KEY");
  return { url, secretKey, missing: secretKey ? [] : ["KDM360_SUPABASE_SECRET_KEY"] };
}

async function financeFetch(config: { url: string; secretKey: string }, path: string, init: RequestInit = {}) {
  const response = await fetch(`${config.url}${path}`, {
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

export async function getFinanceCatalogs(config: { url: string; secretKey: string }): Promise<FinanceCatalogs> {
  const [accounts, categories, subcategories] = await Promise.all([
    financeFetch(config, "/rest/v1/finance_accounts_current?select=account_id,name,bank,account_type&active=eq.true&order=name.asc"),
    financeFetch(config, "/rest/v1/finance_categories_current?select=category&active=eq.true&order=category.asc"),
    financeFetch(config, "/rest/v1/finance_subcategories_current?select=category,subcategory&active=eq.true&order=category.asc,subcategory.asc")
  ]);
  return { accounts, categories, subcategories };
}

export async function getFinanceTransaction(config: { url: string; secretKey: string }, transactionId: string) {
  const encoded = encodeURIComponent(transactionId);
  const rows = await financeFetch(config, `/rest/v1/finance_transactions_current?select=*&transaction_id=eq.${encoded}&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

export async function applyFinanceTransactionWrite(
  config: { url: string; secretKey: string },
  operation: "create" | "update",
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
