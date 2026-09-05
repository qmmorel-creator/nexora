import type { Config } from "@netlify/functions";
import { isAuthorized, json, requireConfig, saveAssistantReport } from "./_shared/nexora.js";
import { buildAssistantReport } from "./_shared/reporting.js";

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = requireConfig();
  if (config.missing.length || !config.uid || !config.apiKey) return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  if (!isAuthorized(req, config.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const params = new URL(req.url).searchParams;
    const kind = params.get("kind") || "evening";
    if (kind !== "morning" && kind !== "evening") return json({ ok: false, error: "invalid_report_kind" }, 400);
    const atRaw = params.get("at");
    const at = atRaw ? new Date(atRaw) : new Date();
    if (Number.isNaN(at.getTime())) return json({ ok: false, error: "invalid_at" }, 400);
    const report = await buildAssistantReport(config.uid, kind, at);
    const persist = params.get("persist") === "true";
    if (persist) await saveAssistantReport(config.uid, report.reportId, report);
    return json({ ...report, persisted: persist });
  } catch (error) {
    return json({ ok: false, error: "report_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/reports", method: ["GET"] };
