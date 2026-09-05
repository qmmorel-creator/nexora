import type { Config } from "@netlify/functions";
import { getFinanceCatalogs, requireFinanceConfig } from "./_shared/finance.js";
import { isAuthorized, json, requireConfig } from "./_shared/nexora.js";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const assistant = requireConfig();
  if (assistant.missing.length || !assistant.apiKey) return json({ ok: false, error: "configuration_missing", missing: assistant.missing }, 503);
  if (!isAuthorized(req, assistant.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);
  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503);
  try {
    const catalogs = await getFinanceCatalogs({ url: finance.url, secretKey: finance.secretKey });
    return json({ ok: true, catalogs });
  } catch (error) {
    return json({ ok: false, error: "finance_catalogs_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/finance/catalogs", method: ["GET"] };
