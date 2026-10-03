import { readAuditEvents, reportPeriod } from "./nexora.js";
import { requireFinanceConfig } from "./finance.js";
import { readBudgetTables } from "./finance-owner.js";
import { buildBudgetReport } from "../../../lib/finance-budget.mjs";
import { bankReportSection } from "../../../lib/bank-sync.mjs";
import { listConnections } from "./bank-sync.js";

function uniqueMessages(events: any[], eventType: string) {
  return new Set(events.filter(event => event.eventType === eventType && event.sourceMessageId).map(event => event.sourceMessageId)).size;
}

function count(events: any[], ...types: string[]) {
  const allowed = new Set(types);
  return events.filter(event => allowed.has(event.eventType)).length;
}

// Budget du rapport du matin (#586) : reste à dépenser, catégories proches ou
// au-dessus du budget, opérations à catégoriser. Une erreur Budget ne bloque
// jamais le rapport : elle y est signalée.
async function budgetSection(at: Date) {
  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return { ok: false, error: "finance_configuration_missing" };
  try {
    const config = { url: finance.url, secretKey: finance.secretKey };
    const raw = await readBudgetTables(config);
    // #677 : accès bancaires (expiration, erreurs du dernier passage). Une
    // erreur ici n'efface pas le reste du Budget.
    const banks = await listConnections(config).then((rows) => bankReportSection(rows, at)).catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
    return { ok: true, ...buildBudgetReport(raw, at), banks };
  } catch (error) {
    return { ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) };
  }
}

function reportRows(events: any[]) {
  const visible = new Set([
    "email_ignored",
    "task_created",
    "task_duplicate",
    "task_updated",
    "task_completed",
    "task_archived",
    "confirmation_requested",
    "processing_error"
  ]);
  return events.filter(event => visible.has(event.eventType)).map(event => ({
    occurredAt: event.occurredAt,
    sourceMessageId: event.sourceMessageId || null,
    treatment: event.title || event.reason || event.eventType,
    projectType: [event.projectName, event.taskTypeName].filter(Boolean).join(" · ") || null,
    date: event.metadata?.date || null,
    result: event.eventType,
    taskId: event.taskId || null
  }));
}

export async function buildAssistantReport(uid: string, kind: "morning" | "evening", at = new Date()) {
  const period = reportPeriod(kind, at);
  const events = await readAuditEvents(uid, period.start, period.end, 2000);
  const rows = reportRows(events);
  return {
    ok: true as const,
    reportId: `${period.localDate}-${kind}`,
    period,
    summary: {
      emailsAnalyzed: uniqueMessages(events, "email_analyzed"),
      emailsMarkedRead: uniqueMessages(events, "email_marked_read"),
      emailsMarkedImportant: uniqueMessages(events, "email_marked_important"),
      tasksCreated: count(events, "task_created"),
      tasksUpdated: count(events, "task_updated"),
      tasksCompleted: count(events, "task_completed"),
      tasksArchived: count(events, "task_archived"),
      messagesWithoutTask: count(events, "email_ignored"),
      duplicatesAvoided: count(events, "task_duplicate"),
      confirmationsRequested: count(events, "confirmation_requested"),
      errors: count(events, "processing_error")
    },
    rowCount: rows.length,
    rows,
    ...(kind === "morning" ? { budget: await budgetSection(at) } : {})
  };
}
