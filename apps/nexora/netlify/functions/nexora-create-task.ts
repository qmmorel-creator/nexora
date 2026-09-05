import type { Config } from "@netlify/functions";
import { appendTaskIdempotently, isAuthorized, json, KEYS, parisDate, parseArray, parseGoogleDriveAttachments, readLogicalDocument, requireConfig } from "./_shared/nexora.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INFORMATION_MILESTONE_ICON = "https://cdn.pixabay.com/photo/2016/06/15/15/02/info-1459077_1280.png";

function text(value: unknown, max: number) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("invalid_text_field");
  const result = value.trim();
  if (result.length > max) throw new Error("text_field_too_long");
  return result;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = requireConfig();
  if (config.missing.length || !config.uid || !config.apiKey) return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  if (!isAuthorized(req, config.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const body = await req.json() as Record<string, unknown>;
    const title = text(body.title, 240);
    if (!title) return json({ ok: false, error: "title_required" }, 400);
    const idempotencyKey = text(body.idempotencyKey || body.sourceMessageId, 500);
    if (!idempotencyKey) return json({ ok: false, error: "idempotency_key_required" }, 400);
    const source = text(body.source, 100) || "assistant";
    const emailTaskKind = text(body.emailTaskKind, 100).toLocaleLowerCase("fr");
    const isParcelTracking = body.isParcelTracking === true || ["parcel_tracking", "colis", "suivi_colis"].includes(emailTaskKind);
    const isGmailInformation = source.toLocaleLowerCase("fr") === "gmail" && ["information", "info"].includes(emailTaskKind);

    const [projectsDoc, statusesDoc, taskTypesDoc] = await Promise.all([
      readLogicalDocument(config.uid, KEYS.projects),
      readLogicalDocument(config.uid, KEYS.statuses),
      readLogicalDocument(config.uid, KEYS.taskTypes)
    ]);
    const projects = parseArray(projectsDoc);
    const statuses = parseArray(statusesDoc);
    const taskTypes = parseArray(taskTypesDoc);

    const requestedProjectId = isParcelTracking ? "" : text(body.projectId, 200);
    const requestedProjectName = isParcelTracking
      ? "Colis"
      : source.toLocaleLowerCase("fr") === "gmail"
        ? "Gmail"
        : text(body.projectName, 200);
    const project = requestedProjectId
      ? projects.find(item => item.id === requestedProjectId)
      : projects.find(item => String(item.name || "").toLocaleLowerCase("fr") === (requestedProjectName || "Inbox").toLocaleLowerCase("fr"));
    if (!project) return json({ ok: false, error: "project_not_found" }, 400);

    const requestedTypeId = isGmailInformation ? "" : text(body.taskTypeId, 200);
    const requestedTypeName = isGmailInformation ? "Information" : text(body.taskTypeName, 200);
    const taskType = requestedTypeId
      ? taskTypes.find(item => item.id === requestedTypeId)
      : taskTypes.find(item => String(item.name || "").toLocaleLowerCase("fr") === (requestedTypeName || "Tâches").toLocaleLowerCase("fr"));
    if (!taskType || (taskType.projectId && taskType.projectId !== project.id)) return json({ ok: false, error: "task_type_not_found" }, 400);

    const requestedStatusId = isParcelTracking ? "" : text(body.statusId, 200);
    const requestedStatusName = isParcelTracking ? "Livraison" : text(body.statusName, 200);
    const allowedStatuses = statuses.filter(item => !item.projectId || item.projectId === project.id);
    const status = requestedStatusId
      ? allowedStatuses.find(item => item.id === requestedStatusId)
      : requestedStatusName
        ? allowedStatuses.find(item => String(item.name || "").toLocaleLowerCase("fr") === requestedStatusName.toLocaleLowerCase("fr"))
        : allowedStatuses.find(item => /à faire|a faire|planifi/i.test(String(item.name || ""))) || allowedStatuses[0];
    if (!status) return json({ ok: false, error: "status_not_found" }, 400);

    const due = text(body.due, 10);
    const sourceReceivedAt = text(body.sourceReceivedAt, 100);
    const receivedDateInput = text(body.receivedDate, 10);
    let receivedDate = receivedDateInput;
    if (!receivedDate && sourceReceivedAt) {
      const receivedAt = new Date(sourceReceivedAt);
      if (Number.isNaN(receivedAt.getTime())) return json({ ok: false, error: "invalid_source_received_at" }, 400);
      receivedDate = parisDate(receivedAt);
    }
    if (receivedDate && !DATE.test(receivedDate)) return json({ ok: false, error: "invalid_received_date" }, 400);
    if (isGmailInformation && !receivedDate) {
      return json({ ok: false, error: "information_received_date_required", required: ["sourceReceivedAt", "receivedDate"] }, 400);
    }
    const orderDate = text(body.orderDate, 10);
    const estimatedDeliveryDate = text(body.estimatedDeliveryDate, 10);
    if (isParcelTracking && (!orderDate || !estimatedDeliveryDate)) {
      return json({ ok: false, error: "parcel_dates_required", required: ["orderDate", "estimatedDeliveryDate"] }, 400);
    }
    const start = isParcelTracking ? orderDate : isGmailInformation ? receivedDate : text(body.start, 10) || due;
    const end = isParcelTracking ? estimatedDeliveryDate : isGmailInformation ? receivedDate : text(body.end, 10) || due || start;
    if ((start && !DATE.test(start)) || (end && !DATE.test(end)) || (start && end && start > end)) {
      return json({ ok: false, error: "invalid_dates" }, 400);
    }
    const rawChecklist = body.checklist == null ? [] : body.checklist;
    if (!Array.isArray(rawChecklist) || rawChecklist.length > 100) return json({ ok: false, error: "invalid_checklist" }, 400);
    const checklist = rawChecklist.map((item, index) => {
      const value = typeof item === "string" ? { text: item } : item as Record<string, unknown>;
      const itemText = text(value?.text, 500);
      if (!itemText) throw new Error("invalid_checklist_item");
      return { id: `ast-ck-${crypto.randomUUID()}`, text: itemText, done: Boolean(value.done), end: text(value.end, 10) || end || null, statusId: null, assignee: text(value.assignee, 200) };
    });
    const sourceUrl = text(body.sourceUrl, 2000) || null;
    const rawDescription = text(body.description ?? body.desc, 10000);
    const gmailSourceLine = sourceUrl ? `Mail d’origine : ${sourceUrl}` : "";
    const descriptionWithoutRepeatedSource = gmailSourceLine
      ? rawDescription.split(gmailSourceLine).join("").trim()
      : rawDescription;
    const description = source.toLocaleLowerCase("fr") === "gmail" && sourceUrl
      ? `${descriptionWithoutRepeatedSource}${descriptionWithoutRepeatedSource ? "\n\n" : ""}${gmailSourceLine}`
      : rawDescription;
    const now = new Date().toISOString();
    const attachments = parseGoogleDriveAttachments(body.attachments);
    const task = {
      id: `ast-${crypto.randomUUID()}`,
      title,
      projectId: project.id,
      secondaryProjectId: null,
      statusId: status.id,
      taskTypeId: taskType.id,
      milestone: isGmailInformation ? true : Boolean(body.milestone ?? (due && start === end)),
      milestoneIcon: isGmailInformation ? INFORMATION_MILESTONE_ICON : null,
      start: start || "",
      end: end || "",
      progress: 0,
      desc: description,
      assignee: text(body.assignee, 200),
      checklist,
      dependsOn: [],
      recurrence: null,
      customFields: {},
      attachments,
      source,
      sourceUrl,
      sourceMessageId: text(body.sourceMessageId, 500) || null,
      sourceThreadId: text(body.sourceThreadId, 500) || null,
      sourceReceivedAt: sourceReceivedAt || null,
      sourceReceivedDate: receivedDate || null,
      sourceSender: text(body.sourceSender, 500) || null,
      idempotencyKey,
      createdAt: now,
      lastInteraction: now
    };

    const result = await appendTaskIdempotently(config.uid, task, idempotencyKey, {
      projectName: String(project.name || ""),
      taskTypeName: String(taskType.name || "")
    });
    return json({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientErrors = new Set(["invalid_text_field", "text_field_too_long", "invalid_checklist_item", "invalid_attachments", "invalid_attachment", "invalid_attachment_url", "invalid_attachment_name", "invalid_attachment_added_at", "duplicate_attachment_url"]);
    return json({ ok: false, error: clientErrors.has(message) ? message : "create_task_failed", detail: clientErrors.has(message) ? undefined : message }, clientErrors.has(message) ? 400 : 502);
  }
};

export const config: Config = { path: "/api/nexora/tasks", method: ["POST"] };
