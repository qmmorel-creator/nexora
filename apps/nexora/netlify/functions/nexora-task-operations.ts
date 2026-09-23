import type { Config } from "@netlify/functions";
import {
  enrich,
  isAuthorized,
  json,
  KEYS,
  mutateTaskAtomically,
  parseArray,
  parseGoogleDriveAttachments,
  readLogicalDocument,
  requireConfig
} from "./_shared/nexora.js";
import { parseTaskTimeInput } from "../../lib/task-times.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIONS = new Set(["update", "complete", "archive"]);

function optionalText(value: unknown, max: number) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("invalid_text_field");
  const result = value.trim();
  if (result.length > max) throw new Error("text_field_too_long");
  return result;
}

function isoTime(value: string | null, field: string) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid_${field}`);
  return parsed.getTime();
}

export default async (req: Request) => {
  if (!new Set(["GET", "PATCH"]).has(req.method)) return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = requireConfig();
  if (config.missing.length || !config.uid || !config.apiKey) return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  if (!isAuthorized(req, config.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    if (req.method === "GET") {
      const url = new URL(req.url);
      const taskId = optionalText(url.searchParams.get("taskId"), 500);
      const sourceMessageId = optionalText(url.searchParams.get("sourceMessageId"), 500);
      const sourceThreadId = optionalText(url.searchParams.get("sourceThreadId"), 500);
      const updatedFromRaw = url.searchParams.get("updatedFrom");
      const updatedToRaw = url.searchParams.get("updatedTo");
      const updatedFrom = isoTime(updatedFromRaw, "updated_from");
      const updatedTo = isoTime(updatedToRaw, "updated_to");
      if (!taskId && !sourceMessageId && !sourceThreadId && updatedFrom == null && updatedTo == null) {
        return json({ ok: false, error: "search_criteria_required" }, 400);
      }
      if (updatedFrom != null && updatedTo != null && updatedFrom > updatedTo) {
        return json({ ok: false, error: "invalid_period" }, 400);
      }

      const names = ["tasks", "archive", "projects", "statuses", "taskTypes"] as const;
      const docs = await Promise.all(names.map(name => readLogicalDocument(config.uid!, KEYS[name])));
      const [tasks, archive, projects, statuses, taskTypes] = docs.map(parseArray);
      const matches = enrich([...tasks, ...archive], projects, statuses, taskTypes).filter((task: any) => {
        if (taskId && task.id !== taskId) return false;
        if (sourceMessageId && task.sourceMessageId !== sourceMessageId) return false;
        if (sourceThreadId && task.sourceThreadId !== sourceThreadId) return false;
        const changedAt = Date.parse(task.lastInteraction || task.updatedAt || task.createdAt || "");
        if (updatedFrom != null && (!Number.isFinite(changedAt) || changedAt < updatedFrom)) return false;
        if (updatedTo != null && (!Number.isFinite(changedAt) || changedAt > updatedTo)) return false;
        return true;
      });
      return json({ ok: true, count: matches.length, tasks: matches });
    }

    const body = await req.json() as Record<string, unknown>;
    const taskId = optionalText(body.taskId, 500);
    const sourceMessageId = optionalText(body.sourceMessageId, 500);
    const sourceThreadId = optionalText(body.sourceThreadId, 500);
    const idempotencyKey = optionalText(body.idempotencyKey, 500);
    if (!taskId && !sourceMessageId && !sourceThreadId) return json({ ok: false, error: "task_identifier_required" }, 400);
    if (!idempotencyKey) return json({ ok: false, error: "idempotency_key_required" }, 400);
    const action = optionalText(body.action, 50) || "update";
    if (!ACTIONS.has(action)) return json({ ok: false, error: "invalid_action" }, 400);

    const rawChanges = body.changes == null ? {} : body.changes;
    if (!rawChanges || typeof rawChanges !== "object" || Array.isArray(rawChanges)) return json({ ok: false, error: "invalid_changes" }, 400);
    const input = rawChanges as Record<string, unknown>;
    const allowed = new Set(["title", "description", "desc", "start", "end", "startTime", "endTime", "statusId", "sourceThreadId", "sourceUrl", "sourceSender", "addAttachments"]);
    const unexpected = Object.keys(input).filter(key => !allowed.has(key));
    if (unexpected.length) return json({ ok: false, error: "unsupported_changes", fields: unexpected }, 400);

    const changes: Record<string, unknown> = {};
    if ("title" in input) {
      const title = optionalText(input.title, 240);
      if (!title) return json({ ok: false, error: "title_required" }, 400);
      changes.title = title;
    }
    if ("description" in input || "desc" in input) changes.desc = optionalText(input.description ?? input.desc, 10000);
    if ("start" in input) changes.start = optionalText(input.start, 10);
    if ("end" in input) changes.end = optionalText(input.end, 10);
    if ((changes.start && !DATE.test(String(changes.start))) || (changes.end && !DATE.test(String(changes.end)))) {
      return json({ ok: false, error: "invalid_dates" }, 400);
    }
    if (changes.start && changes.end && String(changes.start) > String(changes.end)) {
      return json({ ok: false, error: "invalid_dates" }, 400);
    }
    // Heures (#299) : forme contrôlée ici, cohérence avec les dates de la tâche
    // vérifiée au moment de l'écriture (mutateTaskAtomically). Vide = effacer.
    if ("startTime" in input) changes.startTime = parseTaskTimeInput(input.startTime, "start_time");
    if ("endTime" in input) changes.endTime = parseTaskTimeInput(input.endTime, "end_time");
    if ("statusId" in input) {
      const statusId = optionalText(input.statusId, 200);
      const statuses = parseArray(await readLogicalDocument(config.uid, KEYS.statuses));
      if (!statuses.some(item => item.id === statusId)) return json({ ok: false, error: "status_not_found" }, 400);
      changes.statusId = statusId;
    }
    if ("sourceThreadId" in input) changes.sourceThreadId = optionalText(input.sourceThreadId, 500) || null;
    if ("sourceUrl" in input) changes.sourceUrl = optionalText(input.sourceUrl, 2000) || null;
    if ("sourceSender" in input) changes.sourceSender = optionalText(input.sourceSender, 500) || null;
    if ("addAttachments" in input) changes.addAttachments = parseGoogleDriveAttachments(input.addAttachments);

    const result = await mutateTaskAtomically(config.uid, {
      taskId: taskId || undefined,
      sourceMessageId: sourceMessageId || undefined,
      sourceThreadId: sourceThreadId || undefined,
      idempotencyKey,
      action: action as "update" | "complete" | "archive",
      changes
    });
    if (!result.found) return json({ ok: false, error: "task_not_found" }, 404);
    if (result.conflict) return json({ ok: false, error: "multiple_tasks_match", hint: "Use taskId or sourceMessageId" }, 409);
    return json({ ok: true, action, unchanged: result.unchanged, task: result.task, revision: result.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /^(invalid_|duplicate_attachment_url|text_field_too_long)/.test(message);
    return json({ ok: false, error: clientError ? message : "task_operation_failed", detail: clientError ? undefined : message }, clientError ? 400 : 502);
  }
};

export const config: Config = { path: "/api/nexora/tasks/manage", method: ["GET", "PATCH"] };
