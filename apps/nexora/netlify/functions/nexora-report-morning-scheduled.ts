import type { Config } from "@netlify/functions";
import { parisLocalClock, shouldRunReport } from "../../lib/report-period.mjs";
import { requireConfig, saveAssistantReport } from "./_shared/nexora.js";
import { buildAssistantReport } from "./_shared/reporting.js";

export default async () => {
  const now = new Date();
  const local = parisLocalClock(now);
  if (!shouldRunReport(local, 7, 0)) {
    // Tracé : c'est la seule façon de distinguer « l'autre invocation a fait le
    // travail » de « aucune des deux n'est passée » en lisant les journaux Netlify.
    console.log(`report:morning:skip heure_locale=${local.hour}:${String(local.minute).padStart(2, "0")} cible=7:00`);
    return;
  }
  const config = requireConfig();
  if (config.missing.length || !config.uid) throw new Error(`configuration_missing:${config.missing.join(",")}`);
  const report = await buildAssistantReport(config.uid, "morning", now);
  await saveAssistantReport(config.uid, report.reportId, report);
};

export const config: Config = { schedule: "0 5,6 * * *" };
