import type { Config } from "@netlify/functions";
import { getAuth } from "firebase-admin/auth";
import { getDb, json } from "./_shared/nexora.js";
import { financeFetch, requireFinanceConfig } from "./_shared/finance.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Données des widgets Sankey Budget (#569), en LECTURE SEULE, pour la session
// Nexora ouverte dans le navigateur. Contrairement à drive-archive, la simple
// présence d'un jeton ne suffit pas : ce sont les finances personnelles du
// propriétaire. Le jeton d'identité Firebase est donc vérifié (signature,
// expiration, projet) et son uid doit être NEXORA_USER_UID. La clé KDM360 reste
// côté serveur ; seules les colonnes lues par les deux Sankey sont renvoyées.

// Colonnes strictement nécessaires (voir financeSankeyNormalize côté interface).
const TABLES = {
  transactions: { table: "finance_transactions_current", select: "transaction_id,effective_date,bank_date,transaction_type,account_id,signed_amount,category,subcategory,cancels_transaction_id", order: "transaction_id" },
  accounts: { table: "finance_accounts_current", select: "account_id,name,bank,account_type,opening_balance,color,active", order: "account_id" },
  categories: { table: "finance_categories_current", select: "category,color", order: "category" },
  banks: { table: "finance_banks", select: "bank_id,name,color", order: "bank_id" },
  accountTypes: { table: "finance_account_types", select: "id,name,color", order: "id" },
  balances: { table: "finance_account_balances", select: "account_id,as_of_date,balance", order: "account_id,as_of_date" },
} as const;

const PAGE = 1000;
const MAX_ROWS = 1_000_000;

// Toutes les lignes, par pages de 1000 comme OS360. Au-delà de la limite de
// sécurité : erreur, jamais un résultat partiel qui fausserait les montants.
async function readAll(config: { url: string; secretKey: string }, spec: { table: string; select: string; order: string }) {
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

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);

  const ownerUid = Netlify.env.get("NEXORA_USER_UID");
  const serviceAccount = Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const missing = [!ownerUid && "NEXORA_USER_UID", !serviceAccount && "FIREBASE_SERVICE_ACCOUNT_JSON"].filter(Boolean) as string[];
  if (missing.length) return json({ ok: false, error: "configuration_missing", missing }, 503);

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    getDb(); // initialise l'application firebase-admin (compte de service, projet nexora-cb20d)
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.uid !== ownerUid) return json({ ok: false, error: "unauthorized" }, 401);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503);

  try {
    const config = { url: finance.url, secretKey: finance.secretKey };
    const entries = await Promise.all(Object.entries(TABLES).map(async ([key, spec]) => [key, await readAll(config, spec)] as const));
    return json({ ok: true, data: Object.fromEntries(entries) });
  } catch (error) {
    return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-sankey-data", method: ["GET"] };
