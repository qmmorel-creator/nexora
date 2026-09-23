import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash, timingSafeEqual } from "node:crypto";
import { parisCivilDate, reportPeriod } from "../../../lib/report-period.mjs";
import { resolveTaskTimes } from "../../../lib/task-times.mjs";

export { reportPeriod };

declare const Netlify: { env: { get(name: string): string | undefined } };

const CHUNK_CHAR_LIMIT = 150000;
const CHUNK_MARKER = "--nexora-chunk--";
const CHUNK_MODE = "chunked-v1";

export const KEYS = {
  tasks: "nexora:tasks",
  archive: "nexora:taskArchive",
  projects: "nexora:projects",
  statuses: "nexora:statuses",
  taskTypes: "nexora:taskTypes",
  teamMembers: "nexora:teamMembers"
} as const;

export type LogicalDocument = {
  key: string;
  value: string;
  revision: string | null;
  updatedAt: string | null;
  storageMode: string;
  chunkCount: number;
};

// Origine des écritures manifestes faites par la passerelle assistant/MCP
// (create_task, update_task, complete_task, archive_task...). Le client Nexora
// lit ce champ pour distinguer une synchronisation MCP d'une vraie autre
// session humaine : sans lui, les deux sont indiscernables et une simple
// écriture de l'assistant déclenche le bandeau plein écran de conflit.
export const NEXORA_WRITE_SOURCE = "assistant-api";

export function parseServiceAccount(raw: string | undefined) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === "string") parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

export function getDb() {
  if (!getApps().length) {
    const serviceAccount = parseServiceAccount(Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"));
    initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      projectId: "nexora-cb20d"
    });
  }
  return getFirestore();
}

export function requireConfig() {
  const uid = Netlify.env.get("NEXORA_USER_UID");
  const apiKey = Netlify.env.get("NEXORA_ASSISTANT_API_KEY");
  const serviceAccount = Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const missing = [
    !uid && "NEXORA_USER_UID",
    !apiKey && "NEXORA_ASSISTANT_API_KEY",
    !serviceAccount && "FIREBASE_SERVICE_ACCOUNT_JSON"
  ].filter(Boolean) as string[];
  return { uid, apiKey, missing };
}

// Comparaison en temps constant. `===` sur deux chaînes s'arrête au premier caractère
// qui diffère : la durée de la réponse dépend alors du nombre de caractères devinés
// juste. L'exploitation à distance reste peu probable — la gigue du réseau couvre
// largement l'écart — mais l'écrire correctement ne coûte rien et retire la question.
//
// Le hachage préalable sert à deux choses : `timingSafeEqual` exige deux tampons de
// MÊME longueur (sinon il lève), et passer par une empreinte de taille fixe évite de
// divulguer la longueur de la clé attendue.
function constantTimeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isAuthorized(req: Request, expected: string) {
  const auth = req.headers.get("authorization") || "";
  return constantTimeEqual(auth, `Bearer ${expected}`);
}

export async function readLogicalDocument(uid: string, key: string): Promise<LogicalDocument> {
  const db = getDb();
  const base = db.doc(`users/${uid}/kv_store/${key}`);
  const snap = await base.get();
  if (!snap.exists) throw new Error(`Key not found: ${key}`);
  const data = snap.data() || {};
  let value = String(data.value ?? "");
  const chunkIds = Array.isArray(data.chunkIds) ? data.chunkIds : [];
  if (data.storageMode === "chunked-v1") {
    if (!chunkIds.length && Number(data.chunkCount || 0) > 0) throw new Error(`Manifest without chunks: ${key}`);
    const chunks = await db.getAll(...chunkIds.map((id: string) => db.doc(`users/${uid}/kv_store/${id}`)));
    value = chunks.map((chunk, index) => {
      if (!chunk.exists) throw new Error(`Missing chunk ${index + 1}/${chunks.length}: ${key}`);
      const item = chunk.data() || {};
      if (item.parentKey !== key || item.revision !== data.revision) throw new Error(`Inconsistent chunk ${index + 1}: ${key}`);
      return String(item.chunk ?? "");
    }).join("");
    if (Number.isFinite(Number(data.totalLength)) && value.length !== Number(data.totalLength)) {
      throw new Error(`Invalid length ${value.length}/${data.totalLength}: ${key}`);
    }
  }
  return {
    key,
    value,
    revision: data.revision || null,
    updatedAt: data.updatedAt || null,
    storageMode: data.storageMode || "inline",
    chunkCount: Number(data.chunkCount || 0)
  };
}

export function parseArray(doc: LogicalDocument) {
  const parsed = JSON.parse(doc.value);
  if (!Array.isArray(parsed)) throw new Error(`${doc.key} is not an array`);
  return parsed;
}

export function parisDate(now = new Date()) {
  return parisCivilDate(now);
}

export function enrich(tasks: any[], projects: any[], statuses: any[], taskTypes: any[]) {
  const byId = (items: any[]) => new Map(items.map(item => [item.id, item]));
  const projectMap = byId(projects), statusMap = byId(statuses), typeMap = byId(taskTypes);
  return tasks.map(task => ({
    ...task,
    projectName: projectMap.get(task.projectId)?.name || null,
    statusName: statusMap.get(task.statusId)?.name || null,
    taskTypeName: typeMap.get(task.taskTypeId)?.name || null
  }));
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export const AUDIT_EVENT_TYPES = new Set([
  "email_analyzed",
  "email_marked_read",
  "email_marked_important",
  "email_ignored",
  "task_created",
  "task_duplicate",
  "task_updated",
  "task_completed",
  "task_archived",
  "finance_transaction_created",
  "finance_transaction_categorized",
  "confirmation_requested",
  "processing_error"
]);

export type AuditEventInput = {
  idempotencyKey: string;
  eventType: string;
  occurredAt?: string;
  sourceMessageId?: string | null;
  sourceThreadId?: string | null;
  taskId?: string | null;
  title?: string | null;
  projectName?: string | null;
  taskTypeName?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

function auditDocumentId(idempotencyKey: string) {
  return createHash("sha256").update(idempotencyKey).digest("hex");
}

export function auditEventData(input: AuditEventInput) {
  const occurredAt = input.occurredAt || new Date().toISOString();
  if (!AUDIT_EVENT_TYPES.has(input.eventType)) throw new Error("invalid_event_type");
  if (!input.idempotencyKey) throw new Error("audit_idempotency_key_required");
  if (Number.isNaN(Date.parse(occurredAt))) throw new Error("invalid_occurred_at");
  return {
    id: auditDocumentId(input.idempotencyKey),
    idempotencyKey: input.idempotencyKey,
    eventType: input.eventType,
    occurredAt: new Date(occurredAt).toISOString(),
    sourceMessageId: input.sourceMessageId || null,
    sourceThreadId: input.sourceThreadId || null,
    taskId: input.taskId || null,
    title: input.title || null,
    projectName: input.projectName || null,
    taskTypeName: input.taskTypeName || null,
    reason: input.reason || null,
    metadata: input.metadata || {}
  };
}

export async function recordAuditEvent(uid: string, input: AuditEventInput) {
  const db = getDb();
  const event = auditEventData(input);
  const ref = db.doc(`users/${uid}/assistant_audit/${event.id}`);
  return db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) return { created: false, event: existing.data() };
    tx.set(ref, event);
    return { created: true, event };
  });
}

async function ensureAuditEventInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  input: AuditEventInput
) {
  const db = getDb();
  const event = auditEventData(input);
  const ref = db.doc(`users/${uid}/assistant_audit/${event.id}`);
  const existing = await tx.get(ref);
  if (!existing.exists) tx.set(ref, event);
  return { created: !existing.exists, event: existing.exists ? existing.data() : event };
}

export async function readAuditEvents(uid: string, start: string, end: string, limit = 1000) {
  const snapshot = await getDb()
    .collection(`users/${uid}/assistant_audit`)
    .where("occurredAt", ">=", start)
    .where("occurredAt", "<=", end)
    .orderBy("occurredAt", "asc")
    .limit(Math.min(Math.max(limit, 1), 2000))
    .get();
  return snapshot.docs.map(doc => doc.data());
}

export async function saveAssistantReport(uid: string, reportId: string, report: Record<string, unknown>) {
  const ref = getDb().doc(`users/${uid}/assistant_reports/${reportId}`);
  await ref.set({ ...report, reportId, savedAt: new Date().toISOString() }, { merge: true });
  return reportId;
}

function splitStorageValue(value: string) {
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += CHUNK_CHAR_LIMIT) chunks.push(value.slice(i, i + CHUNK_CHAR_LIMIT));
  return chunks.length ? chunks : [""];
}

export async function appendTaskIdempotently(
  uid: string,
  task: Record<string, unknown>,
  idempotencyKey: string,
  auditContext: { projectName?: string; taskTypeName?: string } = {}
) {
  const db = getDb();
  return db.runTransaction(async tx => {
    const active = await readStoredArrayInTransaction(tx, uid, KEYS.tasks);
    const archive = await readStoredArrayInTransaction(tx, uid, KEYS.archive);
    const duplicate = [...active.items, ...archive.items].find(item => item && (
      item.idempotencyKey === idempotencyKey ||
      (task.sourceMessageId && item.sourceMessageId === task.sourceMessageId)
    ));
    if (duplicate) {
      await ensureAuditEventInTransaction(tx, uid, {
        idempotencyKey: `task_duplicate:${idempotencyKey}`,
        eventType: "task_duplicate",
        sourceMessageId: String(task.sourceMessageId || "") || null,
        sourceThreadId: String(task.sourceThreadId || "") || null,
        taskId: String(duplicate.id || "") || null,
        title: String(duplicate.title || task.title || "") || null,
        projectName: auditContext.projectName || null,
        taskTypeName: auditContext.taskTypeName || null
      });
      return { created: false, task: duplicate, revision: active.manifest.revision || null };
    }

    const nextTasks = [...active.items, task];
    const now = new Date().toISOString();
    const revision = crypto.randomUUID();

    await ensureAuditEventInTransaction(tx, uid, {
      idempotencyKey: `task_created:${idempotencyKey}`,
      eventType: "task_created",
      occurredAt: now,
      sourceMessageId: String(task.sourceMessageId || "") || null,
      sourceThreadId: String(task.sourceThreadId || "") || null,
      taskId: String(task.id || "") || null,
      title: String(task.title || "") || null,
      projectName: auditContext.projectName || null,
      taskTypeName: auditContext.taskTypeName || null,
      metadata: { date: task.end || task.start || null }
    });

    writeStoredArrayInTransaction(tx, uid, KEYS.tasks, active, nextTasks, revision, now);
    return { created: true, task, revision };
  });
}

type StoredArray = {
  items: any[];
  manifest: Record<string, any>;
  manifestRef: FirebaseFirestore.DocumentReference;
  oldChunkRefs: FirebaseFirestore.DocumentReference[];
};

async function readStoredArrayInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  key: string
): Promise<StoredArray> {
  const db = getDb();
  const manifestRef = db.doc(`users/${uid}/kv_store/${key}`);
  const manifestSnap = await tx.get(manifestRef);
  if (!manifestSnap.exists) throw new Error(`Key not found: ${key}`);
  const manifest = manifestSnap.data() || {};
  const oldChunkIds = manifest.storageMode === CHUNK_MODE && Array.isArray(manifest.chunkIds)
    ? manifest.chunkIds.map(String)
    : [];
  const oldChunkRefs = oldChunkIds.map((id: string) => db.doc(`users/${uid}/kv_store/${id}`));
  const oldChunkSnaps = oldChunkRefs.length ? await tx.getAll(...oldChunkRefs) : [];
  let value = String(manifest.value ?? "");
  if (manifest.storageMode === CHUNK_MODE) {
    if (!oldChunkIds.length && Number(manifest.chunkCount || 0) > 0) throw new Error(`Manifest without chunks: ${key}`);
    value = oldChunkSnaps.map((snap, index) => {
      if (!snap.exists) throw new Error(`Missing chunk ${index + 1}/${oldChunkSnaps.length}: ${key}`);
      const item = snap.data() || {};
      if (item.parentKey !== key || item.revision !== manifest.revision) throw new Error(`Inconsistent chunk ${index + 1}: ${key}`);
      return String(item.chunk ?? "");
    }).join("");
    if (Number.isFinite(Number(manifest.totalLength)) && value.length !== Number(manifest.totalLength)) {
      throw new Error(`Invalid length ${value.length}/${manifest.totalLength}: ${key}`);
    }
  }
  const items = JSON.parse(value);
  if (!Array.isArray(items)) throw new Error(`${key} is not an array`);
  return { items, manifest, manifestRef, oldChunkRefs };
}

function writeStoredArrayInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  key: string,
  stored: StoredArray,
  items: any[],
  revision: string,
  now: string
) {
  const db = getDb();
  const payload = JSON.stringify(items);
  const chunks = splitStorageValue(payload);
  const useChunks = chunks.length > 1;
  stored.oldChunkRefs.forEach(ref => tx.delete(ref));
  if (!useChunks) {
    tx.set(stored.manifestRef, {
      value: payload,
      updatedAt: now,
      revision,
      source: NEXORA_WRITE_SOURCE,
      storageMode: "inline",
      chunkIds: [],
      chunkCount: 0,
      totalLength: payload.length
    });
    return;
  }
  const chunkIds = chunks.map((_, index) => `${key}${CHUNK_MARKER}${revision}-${String(index).padStart(4, "0")}`);
  chunks.forEach((chunk, index) => tx.set(db.doc(`users/${uid}/kv_store/${chunkIds[index]}`), {
    parentKey: key,
    revision,
    index,
    chunk,
    updatedAt: now
  }));
  tx.set(stored.manifestRef, {
    value: null,
    updatedAt: now,
    revision,
    source: NEXORA_WRITE_SOURCE,
    storageMode: CHUNK_MODE,
    chunkIds,
    chunkCount: chunkIds.length,
    totalLength: payload.length
  });
}

export type TaskMutation = {
  taskId?: string;
  sourceMessageId?: string;
  sourceThreadId?: string;
  idempotencyKey: string;
  changes?: Record<string, unknown>;
  action: "update" | "complete" | "archive";
};

export type GoogleDriveAttachment = {
  id: string;
  type: "link";
  provider: "google-drive";
  driveKind: "file" | "folder";
  name: string;
  url: string;
  addedAt: string;
};

export function parseGoogleDriveAttachments(raw: unknown): GoogleDriveAttachment[] {
  if (raw == null) return [];
  if (!Array.isArray(raw) || raw.length > 20) throw new Error("invalid_attachments");
  const seen = new Set<string>();
  return raw.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("invalid_attachment");
    const input = item as Record<string, unknown>;
    if (typeof input.url !== "string") throw new Error("invalid_attachment_url");
    const url = input.url.trim();
    if (!url || url.length > 2000) throw new Error("invalid_attachment_url");
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error("invalid_attachment_url"); }
    if (parsed.protocol !== "https:" || !new Set(["drive.google.com", "docs.google.com"]).has(parsed.hostname)) {
      throw new Error("invalid_attachment_url");
    }
    const canonicalUrl = parsed.toString();
    if (seen.has(canonicalUrl)) throw new Error("duplicate_attachment_url");
    seen.add(canonicalUrl);
    const rawName = input.name == null ? "" : input.name;
    if (typeof rawName !== "string" || rawName.trim().length > 240) throw new Error("invalid_attachment_name");
    const driveKind: "file" | "folder" = /\/folders\//i.test(parsed.pathname) ? "folder" : "file";
    const rawAddedAt = typeof input.addedAt === "string" ? input.addedAt.trim() : "";
    if (rawAddedAt && Number.isNaN(Date.parse(rawAddedAt))) throw new Error("invalid_attachment_added_at");
    return {
      id: typeof input.id === "string" && input.id.trim() ? input.id.trim().slice(0, 200) : `ast-drive-${crypto.randomUUID()}`,
      type: "link",
      provider: "google-drive",
      driveKind,
      name: rawName.trim() || (driveKind === "folder" ? "Dossier Google Drive" : "Fichier Google Drive"),
      url: canonicalUrl,
      addedAt: rawAddedAt ? new Date(rawAddedAt).toISOString() : new Date().toISOString()
    };
  });
}

export function mergeGoogleDriveAttachments(current: unknown, additions: GoogleDriveAttachment[]) {
  const existing = Array.isArray(current) ? current : [];
  const urls = new Set(existing.map((item: any) => String(item?.url || "").trim()).filter(Boolean));
  return [...existing, ...additions.filter(item => !urls.has(item.url))];
}

export async function mutateTaskAtomically(uid: string, mutation: TaskMutation) {
  const db = getDb();
  return db.runTransaction(async tx => {
    const active = await readStoredArrayInTransaction(tx, uid, KEYS.tasks);
    const archive = await readStoredArrayInTransaction(tx, uid, KEYS.archive);
    const matchesMutation = (item: any) => item && (
      (mutation.taskId && item.id === mutation.taskId) ||
      (mutation.sourceMessageId && item.sourceMessageId === mutation.sourceMessageId) ||
      (mutation.sourceThreadId && item.sourceThreadId === mutation.sourceThreadId)
    );
    const matches = active.items.filter(matchesMutation);
    if (!matches.length && mutation.action === "archive") {
      const archivedMatches = archive.items.filter(matchesMutation);
      if (archivedMatches.length === 1) {
        return { found: true, conflict: false, unchanged: true, task: archivedMatches[0], revision: archive.manifest.revision || null };
      }
      if (archivedMatches.length > 1) return { found: true, conflict: true, unchanged: true, task: null, revision: null };
    }
    if (!matches.length) return { found: false, conflict: false, unchanged: false, task: null, revision: null };
    if (matches.length > 1 && !mutation.taskId && !mutation.sourceMessageId) {
      return { found: true, conflict: true, unchanged: false, task: null, revision: null };
    }
    const current = matches[0];
    if (mutation.action === "complete" && current.completedAt) {
      return { found: true, conflict: false, unchanged: true, task: current, revision: active.manifest.revision || null };
    }
    const now = new Date().toISOString();
    const revision = crypto.randomUUID();
    const eventType = mutation.action === "complete"
      ? "task_completed"
      : mutation.action === "archive"
        ? "task_archived"
        : "task_updated";
    const audit = await ensureAuditEventInTransaction(tx, uid, {
      idempotencyKey: `${eventType}:${mutation.idempotencyKey}`,
      eventType,
      occurredAt: now,
      sourceMessageId: current.sourceMessageId || null,
      sourceThreadId: current.sourceThreadId || null,
      taskId: current.id || null,
      title: current.title || null,
      metadata: { date: mutation.changes?.end || mutation.changes?.start || current.end || current.start || null }
    });
    if (!audit.created) {
      return { found: true, conflict: false, unchanged: true, task: current, revision: active.manifest.revision || null };
    }
    const rawChanges = { ...(mutation.changes || {}) };
    const attachmentsToAdd = Array.isArray(rawChanges.addAttachments) ? rawChanges.addAttachments as GoogleDriveAttachment[] : [];
    delete rawChanges.addAttachments;
    const next = {
      ...current,
      ...rawChanges,
      lastInteraction: now
    };
    if (attachmentsToAdd.length) next.attachments = mergeGoogleDriveAttachments(current.attachments, attachmentsToAdd);
    if (current.source === "gmail" && next.sourceUrl) {
      const sourceLine = `Mail d’origine : ${next.sourceUrl}`;
      const description = String(next.desc || "").split(sourceLine).join("").trim();
      next.desc = `${description}${description ? "\n\n" : ""}${sourceLine}`;
    }
    if (current.sourceReceivedDate && current.milestone && current.milestoneIcon) {
      next.start = current.sourceReceivedDate;
      next.end = current.sourceReceivedDate;
    }
    if ((next.start && !/^\d{4}-\d{2}-\d{2}$/.test(String(next.start))) ||
        (next.end && !/^\d{4}-\d{2}-\d{2}$/.test(String(next.end))) ||
        (next.start && next.end && String(next.start) > String(next.end))) {
      throw new Error("invalid_dates");
    }
    // Heures (#299) : effacer le début efface la fin ; toute modification des
    // heures, ou des dates d'une tâche horodatée, revalide le créneau.
    if (rawChanges.startTime === "" && !("endTime" in rawChanges)) next.endTime = "";
    if ("startTime" in rawChanges || "endTime" in rawChanges || (("start" in rawChanges || "end" in rawChanges) && next.startTime)) {
      Object.assign(next, resolveTaskTimes({ start: next.start, end: next.end, startTime: next.startTime, endTime: next.endTime }));
    }
    if (mutation.action === "complete") {
      next.completedAt = now;
      next.progress = 100;
    }
    if (mutation.action === "archive") next.archivedAt = now;

    const nextActive = active.items.filter(item => item !== current);
    if (mutation.action !== "archive") nextActive.push(next);
    const nextArchive = mutation.action === "archive" ? [...archive.items, next] : archive.items;
    writeStoredArrayInTransaction(tx, uid, KEYS.tasks, active, nextActive, revision, now);
    if (mutation.action === "archive") writeStoredArrayInTransaction(tx, uid, KEYS.archive, archive, nextArchive, revision, now);
    return { found: true, conflict: false, unchanged: false, task: next, revision };
  });
}
