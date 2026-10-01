import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { readAllRows, requireOwnerFinance } from "./_shared/finance-owner.js";

// Widget Transactions (#572) : 100 % des transactions Budget, TOUS leurs champs
// (select=*, les colonnes futures comprises), en LECTURE SEULE, pour la session
// Nexora du propriétaire (vérification dans _shared/finance-owner.ts). Les
// comptes accompagnent les lignes pour afficher leur nom et leur banque.
const TABLES = {
  transactions: { table: "finance_transactions_current", select: "*", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,active", order: "account_id" },
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

export const config: Config = { path: "/api/nexora/finance-transactions-data", method: ["GET"] };
