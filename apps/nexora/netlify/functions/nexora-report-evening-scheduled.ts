import type { Config } from "@netlify/functions";
import { parisLocalClock } from "../../lib/report-period.mjs";
import { requireConfig, saveAssistantReport } from "./_shared/nexora.js";
import { buildAssistantReport } from "./_shared/reporting.js";

export default async () => {
  const now = new Date();
  const local = parisLocalClock(now);
  if (local.hour !== 20 || local.minute !== 30) return;
  const config = requireConfig();
  if (config.missing.length || !config.uid) throw new Error(`configuration_missing:${config.missing.join(",")}`);
  const report = await buildAssistantReport(config.uid, "evening", now);
  await saveAssistantReport(config.uid, report.reportId, report);
};

export const config: Config = { schedule: "30 18,19 * * *" };
