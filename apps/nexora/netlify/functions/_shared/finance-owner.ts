import { getAuth } from "firebase-admin/auth";
import { getDb, json } from "./nexora.js";
import { financeFetch, requireFinanceConfig } from "./finance.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Accès aux données Budget KDM360 depuis la session Nexora du NAVIGATEUR
// (#569, #572). Contrairement à drive-archive, la simple présence d'un jeton ne
// suffit pas : ce sont les finances personnelles du propriétaire. Le jeton
// d'identité Firebase est vérifié (signature, expiration, projet) et son uid
// doit être NEXORA_USER_UID. La clé KDM360 reste côté serveur.

export type FinanceReadConfig = { url: string; secretKey: string };

// Renvoie la configuration KDM360 si la requête vient de la session du
// propriétaire, sinon la réponse d'erreur à retourner telle quelle.
export async function requireOwnerFinance(req: Request): Promise<{ config: FinanceReadConfig } | { response: Response }> {
  const ownerUid = Netlify.env.get("NEXORA_USER_UID");
  const serviceAccount = Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const missing = [!ownerUid && "NEXORA_USER_UID", !serviceAccount && "FIREBASE_SERVICE_ACCOUNT_JSON"].filter(Boolean) as string[];
  if (missing.length) return { response: json({ ok: false, error: "configuration_missing", missing }, 503) };

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { response: json({ ok: false, error: "unauthorized" }, 401) };
  try {
    getDb(); // initialise l'application firebase-admin (compte de service, projet nexora-cb20d)
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.uid !== ownerUid) return { response: json({ ok: false, error: "unauthorized" }, 401) };
  } catch {
    return { response: json({ ok: false, error: "unauthorized" }, 401) };
  }

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
