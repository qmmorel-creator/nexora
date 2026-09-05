import type { Config } from "@netlify/functions";
import {
  AUDIT_EVENT_TYPES,
  isAuthorized,
  json,
  readAuditEvents,
  recordAuditEvent,
  requireConfig
} from "./_shared/nexora.js";

function text(value: unknown, max: number) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("invalid_text_field");
  const result = value.trim();
  if (result.length > max) throw new Error("text_field_too_long");
  return result;
}

function validIso(value: string) {
  return value && !Number.isNaN(Date.parse(value));
}

export default async (req: Request) => {
  if (!new Set(["GET", "POST"]).has(req.method)) return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = requireConfig();
  if (config.missing.length || !config.uid || !config.apiKey) return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  if (!isAuthorized(req, config.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    if (req.method === "GET") {
      const params = new URL(req.url).searchParams;
      const start = text(params.get("start"), 100);
      const end = text(params.get("end"), 100);
      const requestedLimit = Number(params.get("limit") || 1000);
      if (!validIso(start) || !validIso(end) || start > end) return json({ ok: false, error: "invalid_period" }, 400);
      if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 2000) return json({ ok: false, error: "invalid_limit" }, 400);
      const events = await readAuditEvents(config.uid, new Date(start).toISOString(), new Date(end).toISOString(), requestedLimit);
      return json({ ok: true, count: events.length, start: new Date(start).toISOString(), end: new Date(end).toISOString(), events });
    }

    const body = await req.json() as Record<string, unknown>;
    const idempotencyKey = text(body.idempotencyKey, 500);
    const eventType = text(body.eventType, 100);
    if (!idempotencyKey) return json({ ok: false, error: "audit_idempotency_key_required" }, 400);
    if (!AUDIT_EVENT_TYPES.has(eventType)) return json({ ok: false, error: "invalid_event_type" }, 400);
    const occurredAt = text(body.occurredAt, 100) || new Date().toISOString();
    if (!validIso(occurredAt)) return json({ ok: false, error: "invalid_occurred_at" }, 400);
    const rawMetadata = body.metadata == null ? {} : body.metadata;
    if (!rawMetadata || typeof rawMetadata !== "object" || Array.isArray(rawMetadata)) return json({ ok: false, error: "invalid_metadata" }, 400);
    if (JSON.stringify(rawMetadata).length > 10000) return json({ ok: false, error: "metadata_too_large" }, 400);

    const result = await recordAuditEvent(config.uid, {
      idempotencyKey,
      eventType,
      occurredAt,
      sourceMessageId: text(body.sourceMessageId, 500) || null,
      sourceThreadId: text(body.sourceThreadId, 500) || null,
      taskId: text(body.taskId, 500) || null,
      title: text(body.title, 500) || null,
      projectName: text(body.projectName, 200) || null,
      taskTypeName: text(body.taskTypeName, 200) || null,
      reason: text(body.reason, 1000) || null,
      metadata: rawMetadata as Record<string, unknown>
    });
    return json({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /^(invalid_|text_field_too_long|audit_idempotency_key_required|metadata_too_large)/.test(message);
    return json({ ok: false, error: clientError ? message : "audit_operation_failed", detail: clientError ? undefined : message }, clientError ? 400 : 502);
  }
};

export const config: Config = { path: "/api/nexora/audit", method: ["GET", "POST"] };
