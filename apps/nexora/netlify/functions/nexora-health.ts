import type { Config } from "@netlify/functions";
import { requireFinanceConfig } from "./_shared/finance.js";
import { json, requireConfig } from "./_shared/nexora.js";

export default async () => {
  const config = requireConfig();
  if (config.missing.length) return json({ ok: false, mode: "firebase-admin-readonly", error: "configuration_missing", missing: config.missing }, 503);
  const finance = requireFinanceConfig();
  const financeConfigured = finance.missing.length === 0;
  return json({
    ok: true,
    mode: "firebase-admin-gateway",
    projectId: "nexora-cb20d",
    writesEnabled: ["createTask", "updateTask", "completeTask", "archiveTask", "recordAuditEvent", "persistReport"],
    searchEnabled: ["taskId", "sourceMessageId", "sourceThreadId", "updatedPeriod", "auditPeriod", "morningReport", "eveningReport"],
    finance: {
      configured: financeConfigured,
      catalogsEnabled: financeConfigured,
      controlledWritesEnabled: financeConfigured,
      operations: financeConfigured ? ["create", "categorize"] : []
    }
  });
};

export const config: Config = { path: "/api/nexora/health", method: ["GET"] };
