import type { Config } from "@netlify/functions";
import {
  QME_PROJECT_ID,
  QME_SOURCE,
  QME_STATUS_ID,
  QME_TASK_TYPE_ID,
  buildDescription,
  buildProspectChecklist,
  buildTitle,
  ipFingerprint,
  isTimestampFresh,
  normalizeOrganization,
  optionalText,
  signatureFingerprint,
  validateEmail,
  validateRequestId,
  validateSourceUrl,
  verifySignature
} from "../../lib/qme-intake-validation.mjs";
import { appendTaskIdempotently, getDb, json, parisDate } from "./_shared/nexora.js";

// Nexora #279 — Endpoint d'ingestion DÉDIÉ aux prospects du site QME
// (qmmorel-creator/qme-engineering), appelé serveur-à-serveur par le
// backend-for-frontend du site, jamais par un navigateur. Ce n'est PAS une
// API d'écriture Nexora générale : projet/statut/type figés, contrat de
// champs restreint. Réutilise la logique canonique de nexora-create-task.ts
// (appendTaskIdempotently, _shared/nexora.ts) plutôt que de réécrire une
// écriture Firestore parallèle.
//
// Séparé du MCP OAuth/PKCE (apps/nexora-mcp) et de NEXORA_ASSISTANT_API_KEY
// (surface générale assistant) : secret propre QME_INTAKE_SIGNING_KEY, car
// cet endpoint est atteint indirectement par du trafic public — défense en
// profondeur pour qu'une fuite ne compromette pas la clé assistant générale.

const RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const RATE_LIMIT_PER_IP = 8;
const RATE_LIMIT_GLOBAL = 60;

const HONEYPOT_FIELD = "company_website"; // nom volontairement plausible pour un bot, absent du vrai formulaire

function qmeConfig() {
  const uid = Netlify.env.get("NEXORA_USER_UID");
  const serviceAccount = Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const signingKey = Netlify.env.get("QME_INTAKE_SIGNING_KEY");
  const siteOrigin = Netlify.env.get("QME_SITE_ORIGIN");
  const missing = [
    !uid && "NEXORA_USER_UID",
    !serviceAccount && "FIREBASE_SERVICE_ACCOUNT_JSON",
    !signingKey && "QME_INTAKE_SIGNING_KEY",
    !siteOrigin && "QME_SITE_ORIGIN"
  ].filter(Boolean) as string[];
  return { uid, signingKey, siteOrigin, missing };
}

declare const Netlify: { env: { get(name: string): string | undefined } };

// Limitation de débit + anti-rejeu, dans UNE transaction : IP et signature
// consommées ensemble, pas de fenêtre de course entre deux vérifications
// séparées.
async function checkRateLimitAndReplay(uid: string, ip: string, signature: string, nowSeconds: number) {
  const db = getDb();
  const windowIndex = Math.floor(nowSeconds / RATE_LIMIT_WINDOW_SECONDS);
  const ipRef = db.doc(`users/${uid}/qme_intake_ratelimit/${ipFingerprint(ip)}:${windowIndex}`);
  const globalRef = db.doc(`users/${uid}/qme_intake_ratelimit/global:${windowIndex}`);
  const nonceRef = db.doc(`users/${uid}/qme_intake_nonces/${signatureFingerprint(signature)}`);

  return db.runTransaction(async (tx) => {
    const [ipSnap, globalSnap, nonceSnap] = await Promise.all([tx.get(ipRef), tx.get(globalRef), tx.get(nonceRef)]);
    if (nonceSnap.exists) return { ok: false as const, reason: "signature_replayed" };

    const ipCount = Number(ipSnap.data()?.count || 0);
    const globalCount = Number(globalSnap.data()?.count || 0);
    if (ipCount >= RATE_LIMIT_PER_IP) return { ok: false as const, reason: "rate_limited" };
    if (globalCount >= RATE_LIMIT_GLOBAL) return { ok: false as const, reason: "rate_limited" };

    tx.set(ipRef, { count: ipCount + 1, updatedAt: new Date().toISOString() });
    tx.set(globalRef, { count: globalCount + 1, updatedAt: new Date().toISOString() });
    tx.set(nonceRef, { consumedAt: new Date().toISOString() });
    return { ok: true as const };
  });
}

function clientIp(req: Request) {
  return req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const VALIDATION_ERRORS = new Set([
  "request_id_required", "invalid_request_id",
  "name_too_long",
  "email_required", "email_too_long", "invalid_email",
  "organization_required", "organization_too_long",
  "need_too_long",
  "message_too_long",
  "source_url_required", "source_url_too_long", "invalid_source_url", "unexpected_source_origin"
]);

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const config = qmeConfig();
  if (config.missing.length || !config.uid || !config.signingKey || !config.siteOrigin) {
    return json({ ok: false, error: "configuration_missing", missing: config.missing }, 503);
  }

  // Corps brut conservé AVANT parsing JSON : la signature porte sur les
  // octets exacts envoyés, pas sur une reconstruction post-parsing.
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-qme-timestamp") || "";
  const signature = req.headers.get("x-qme-signature") || "";

  if (!isTimestampFresh(timestamp)) return json({ ok: false, error: "signature_expired" }, 401);
  if (!verifySignature(config.signingKey, timestamp, rawBody, signature)) {
    return json({ ok: false, error: "invalid_signature" }, 401);
  }

  try {
    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;

    // Honeypot rempli -> rejet SILENCIEUX : même réponse qu'un succès, pour
    // ne jamais renseigner un bot sur la détection. Aucune tâche créée,
    // aucun compteur de débit consommé (pas la peine de "payer" pour un bot).
    if (typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD].trim() !== "") {
      return json({ ok: true, status: "received" }, 200);
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const limit = await checkRateLimitAndReplay(config.uid, clientIp(req), signature, nowSeconds);
    if (!limit.ok && limit.reason === "signature_replayed") return json({ ok: false, error: "signature_replayed" }, 401);
    if (!limit.ok) return json({ ok: false, error: "rate_limited" }, 429);

    const requestId = validateRequestId(body.requestId);
    const name = optionalText(body.name, "name", 200);
    const email = validateEmail(body.email);
    const organization = normalizeOrganization(body.organization);
    const need = optionalText(body.need, "need", 200);
    const message = optionalText(body.message, "message", 5000);
    const sourceUrl = validateSourceUrl(body.sourceUrl, config.siteOrigin);

    const civilDate = parisDate();
    const receivedAtParis = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date());

    const title = buildTitle(organization);
    const desc = buildDescription({ name, email, organization, need, message, receivedAtParis, requestId, sourceUrl });
    const now = new Date().toISOString();
    const submittedAt = optionalText(body.submittedAt, "submitted_at", 100);

    const task = {
      id: `qme-${crypto.randomUUID()}`,
      title,
      projectId: QME_PROJECT_ID,
      secondaryProjectId: null,
      statusId: QME_STATUS_ID,
      taskTypeId: QME_TASK_TYPE_ID,
      milestone: false,
      milestoneIcon: null,
      start: civilDate,
      end: civilDate,
      progress: 0,
      desc,
      assignee: "",
      checklist: buildProspectChecklist(),
      dependsOn: [],
      recurrence: null,
      customFields: {},
      attachments: [],
      source: QME_SOURCE,
      sourceUrl,
      sourceMessageId: null,
      sourceThreadId: null,
      sourceReceivedAt: (submittedAt && !Number.isNaN(Date.parse(submittedAt))) ? new Date(submittedAt).toISOString() : now,
      sourceReceivedDate: civilDate,
      sourceSender: email,
      idempotencyKey: requestId,
      createdAt: now,
      lastInteraction: now
    };

    const result = await appendTaskIdempotently(config.uid, task, requestId, {
      projectName: "QME - Formulaire",
      taskTypeName: "Tâches"
    });
    return json({ ok: true, status: result.created ? "created" : "duplicate" }, result.created ? 201 : 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (VALIDATION_ERRORS.has(message)) return json({ ok: false, error: message }, 400);
    return json({ ok: false, error: "qme_intake_failed" }, 502);
  }
};

export const config: Config = { path: "/api/nexora/qme-intake", method: ["POST"] };
