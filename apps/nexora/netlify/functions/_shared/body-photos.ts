// Photos corporelles — avant / après (#616). Module PUR, sans import : la
// validation des entrées et la logique des routes, avec le stockage des
// métadonnées, celui des octets et le contrôle de session INJECTÉS. Les tests exécutent ce même code avec des
// faux (tests/body-photos.test.mjs) ; netlify/functions/body-photos.ts le
// raccorde aux vrais services (_shared/body-photos-store.ts, requireOwner).
//
// Confidentialité :
//   - chaque route passe par `requireOwner` avant toute lecture ou écriture ;
//   - le navigateur ne reçoit JAMAIS l'identifiant de stockage des octets
//     (`publicPhoto` le retire) : les octets passent par
//     GET /api/nexora/body-photos/:id/image, en `Cache-Control: private, no-store` ;
//   - une erreur de stockage est traduite en message générique, jamais en
//     message brut qui pourrait citer un chemin ou un identifiant.
//
// Stockage des octets (#616, 02/10/2026) : d'abord un dossier Drive dédié,
// abandonné car Google refuse tout quota Drive au compte de service ; depuis,
// Firestore dédié (_shared/body-photos-store.ts), choix de Quentin.

export const BODY_PHOTOS_BASE = "/api/nexora/body-photos";
// Corps binaire d'un JPEG ré-encodé par le navigateur (côté long 2 400 px,
// qualité 0,9 : 0,5 à 2 Mo en pratique). Marge sous la limite de 6 Mo du
// corps d'une fonction Netlify.
export const BODY_PHOTO_MAX_BYTES = 5_000_000;
export const BODY_PHOTO_MAX_SIDE = 4096;
export const BODY_PHOTO_LANDMARKS = ["leftEye", "rightEye", "navel"] as const;
export const BODY_PHOTO_DATE_SOURCES = ["exif", "import", "manual"] as const;
// Bornes des ajustements manuels (mode « Affiner ») : px du cadre de la
// référence, degrés, pourcentage d'échelle.
const ADJUST_LIMITS = { dx: 4096, dy: 4096, rot: 45, scale: 50 };

export type Point = { x: number; y: number };
export type Landmarks = { leftEye: Point | null; rightEye: Point | null; navel: Point | null };
export type Adjust = { dx: number; dy: number; rot: number; scale: number };
export type BodyPhotoMeta = {
  id: string;
  status: "pending" | "ready";
  blobId: string | null;
  date: string;
  dateSource: (typeof BODY_PHOTO_DATE_SOURCES)[number];
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
  updatedAt: string;
  landmarks: Landmarks;
  adjust: Record<string, Adjust>;
};

export type BodyPhotoStore = {
  list(): Promise<BodyPhotoMeta[]>;
  get(id: string): Promise<BodyPhotoMeta | null>;
  // Crée la métadonnée si elle n'existe pas ; renvoie celle qui existe sinon.
  createPending(meta: BodyPhotoMeta): Promise<{ meta: BodyPhotoMeta; created: boolean }>;
  update(id: string, patch: Partial<BodyPhotoMeta>): Promise<void>;
  // Supprime la métadonnée ET, dans la même transaction, la référence si
  // elle désignait cette photo.
  remove(id: string): Promise<void>;
  getReference(): Promise<string | null>;
  setReference(id: string | null): Promise<void>;
};

// Octets d'une photo, rangés sous l'identifiant de la photo.
export type BodyPhotoBlobs = {
  // Identifiant des octets s'ils sont déjà entièrement écrits (reprise).
  find(photoId: string): Promise<string | null>;
  put(photoId: string, bytes: Uint8Array): Promise<string>;
  get(blobId: string): Promise<Uint8Array | null>;
  // Des octets déjà absents sont un succès : la suppression est rejouable.
  remove(blobId: string): Promise<void>;
};

export type BodyPhotoDeps = {
  requireOwner(req: Request): Promise<Response | null>;
  store: BodyPhotoStore;
  blobs: BodyPhotoBlobs;
  now?: () => Date;
};

// --- Validation ------------------------------------------------------------

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", ...headers },
  });
}

// Clé d'idempotence générée par le navigateur, qui devient l'identifiant de la photo.
export function isPhotoId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

// Date civile AAAA-MM-JJ réelle, entre 1990 et demain (fuseau large).
export function isPhotoDate(value: unknown, now: Date = new Date()): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const max = new Date(now.getTime() + 36 * 3600 * 1000).toISOString().slice(0, 10);
  return value >= "1990-01-01" && value <= max;
}

function unitNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

// Repères en coordonnées normalisées 0–1 de l'image stockée ; null = non placé.
// Renvoie null si l'entrée est invalide (refus, jamais de correction silencieuse).
export function normalizeLandmarks(value: unknown): Landmarks | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((k) => !(BODY_PHOTO_LANDMARKS as readonly string[]).includes(k))) return null;
  const out: Landmarks = { leftEye: null, rightEye: null, navel: null };
  for (const key of BODY_PHOTO_LANDMARKS) {
    const p = input[key];
    if (p === null || p === undefined) continue;
    if (typeof p !== "object" || !unitNumber((p as any).x) || !unitNumber((p as any).y)) return null;
    out[key] = { x: (p as any).x, y: (p as any).y };
  }
  return out;
}

export function normalizeAdjust(value: unknown): Adjust | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const out = {} as Adjust;
  for (const key of ["dx", "dy", "rot", "scale"] as const) {
    const n = v[key] === undefined ? 0 : v[key];
    if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > ADJUST_LIMITS[key]) return null;
    out[key] = n;
  }
  return out;
}

// Dimensions d'un JPEG lues dans son segment SOF ; null si ce n'en est pas un.
export function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) {
      const height = (bytes[i + 5] << 8) | bytes[i + 6];
      const width = (bytes[i + 7] << 8) | bytes[i + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }
    if (marker === 0xda || marker === 0xd9) return null;
    i += 2 + length;
  }
  return null;
}

// Ce que le navigateur reçoit : jamais `blobId`.
export function publicPhoto(meta: BodyPhotoMeta) {
  return {
    id: meta.id,
    status: meta.status,
    date: meta.date,
    dateSource: meta.dateSource,
    width: meta.width,
    height: meta.height,
    bytes: meta.bytes,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    landmarks: meta.landmarks,
    adjust: meta.adjust || {},
  };
}

function storageFailure() {
  return json({ ok: false, error: "body_photos_storage_failed", detail: "Le stockage des photos a refusé l'opération. Réessaie." }, 502);
}

// --- Routes ----------------------------------------------------------------

const ALLOWED: Record<string, string[]> = {
  collection: ["GET", "POST"],
  reference: ["PUT"],
  photo: ["PATCH", "DELETE"],
  image: ["GET"],
};

function route(pathname: string): { kind: keyof typeof ALLOWED; id?: string } | null {
  if (!pathname.startsWith(BODY_PHOTOS_BASE)) return null;
  const rest = pathname.slice(BODY_PHOTOS_BASE.length).replace(/\/+$/, "");
  if (!rest) return { kind: "collection" };
  const parts = rest.slice(1).split("/");
  if (rest[0] !== "/" || parts.some((p) => !p)) return null;
  if (parts.length === 1 && parts[0] === "reference") return { kind: "reference" };
  if (!isPhotoId(parts[0])) return null;
  if (parts.length === 1) return { kind: "photo", id: parts[0] };
  if (parts.length === 2 && parts[1] === "image") return { kind: "image", id: parts[0] };
  return null;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function createBodyPhotosHandler(deps: BodyPhotoDeps) {
  const now = deps.now || (() => new Date());

  async function list() {
    const [photos, referenceId] = await Promise.all([deps.store.list(), deps.store.getReference()]);
    photos.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    const ref = photos.some((p) => p.id === referenceId && p.status === "ready") ? referenceId : null;
    return json({ ok: true, data: { photos: photos.map(publicPhoto), referenceId: ref, maxBytes: BODY_PHOTO_MAX_BYTES } });
  }

  async function upload(req: Request) {
    const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (type !== "image/jpeg") return json({ ok: false, error: "unsupported_media_type", detail: "Seul un JPEG ré-encodé par Nexora est accepté." }, 415);
    const id = req.headers.get("x-idempotency-key");
    if (!isPhotoId(id)) return json({ ok: false, error: "invalid_idempotency_key" }, 400);
    const date = req.headers.get("x-photo-date");
    if (!isPhotoDate(date, now())) return json({ ok: false, error: "invalid_date" }, 400);
    const dateSource = req.headers.get("x-date-source") || "import";
    if (!(BODY_PHOTO_DATE_SOURCES as readonly string[]).includes(dateSource)) return json({ ok: false, error: "invalid_date_source" }, 400);
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > BODY_PHOTO_MAX_BYTES) return json({ ok: false, error: "payload_too_large", maxBytes: BODY_PHOTO_MAX_BYTES }, 413);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length > BODY_PHOTO_MAX_BYTES) return json({ ok: false, error: "payload_too_large", maxBytes: BODY_PHOTO_MAX_BYTES }, 413);
    const size = jpegSize(bytes);
    if (!size) return json({ ok: false, error: "invalid_image", detail: "Le fichier n'est pas un JPEG lisible." }, 400);
    if (size.width > BODY_PHOTO_MAX_SIDE || size.height > BODY_PHOTO_MAX_SIDE) return json({ ok: false, error: "image_too_large", maxSide: BODY_PHOTO_MAX_SIDE }, 400);

    const stamp = now().toISOString();
    const { meta: existing, created } = await deps.store.createPending({
      id, status: "pending", blobId: null, date, dateSource: dateSource as BodyPhotoMeta["dateSource"],
      width: size.width, height: size.height, bytes: bytes.length, createdAt: stamp, updatedAt: stamp,
      landmarks: { leftEye: null, rightEye: null, navel: null }, adjust: {},
    });
    // Reprise d'un import déjà abouti : même réponse, rien de dupliqué.
    if (!created && existing.status === "ready") return json({ ok: true, data: { photo: publicPhoto(existing), duplicate: true } });
    try {
      // Reprise d'un import interrompu : des octets déjà entièrement écrits
      // sont retrouvés au lieu d'être réécrits.
      const blobId = existing.blobId || (await deps.blobs.find(id)) || (await deps.blobs.put(id, bytes));
      await deps.store.update(id, { status: "ready", blobId, updatedAt: now().toISOString() });
      return json({ ok: true, data: { photo: publicPhoto({ ...existing, status: "ready", blobId }), duplicate: !created } }, created ? 201 : 200);
    } catch {
      // Aucun octet n'a pu être écrit : la métadonnée en attente créée par
      // CET appel est retirée, pour ne laisser aucune entrée orpheline.
      if (created) await deps.store.remove(id).catch(() => {});
      return storageFailure();
    }
  }

  async function patch(req: Request, id: string) {
    const body = await readJson(req);
    if (!body) return json({ ok: false, error: "invalid_json" }, 400);
    const unknown = Object.keys(body).filter((k) => !["date", "landmarks", "adjust"].includes(k));
    if (unknown.length) return json({ ok: false, error: "unknown_fields", fields: unknown }, 400);
    const meta = await deps.store.get(id);
    if (!meta) return json({ ok: false, error: "not_found" }, 404);
    const changes: Partial<BodyPhotoMeta> = {};
    if ("date" in body) {
      if (!isPhotoDate(body.date, now())) return json({ ok: false, error: "invalid_date" }, 400);
      changes.date = body.date;
      changes.dateSource = "manual";
    }
    if ("landmarks" in body) {
      const landmarks = normalizeLandmarks(body.landmarks);
      if (!landmarks) return json({ ok: false, error: "invalid_landmarks" }, 400);
      changes.landmarks = landmarks;
    }
    if ("adjust" in body) {
      // { referenceId, value } : ajustement manuel propre à une référence ;
      // value null = remise à zéro (retour au calcul automatique).
      const a = body.adjust as Record<string, unknown> | null;
      if (!a || typeof a !== "object" || !isPhotoId(a.referenceId)) return json({ ok: false, error: "invalid_adjust" }, 400);
      const next = { ...(meta.adjust || {}) };
      if (a.value === null) delete next[a.referenceId];
      else {
        const value = normalizeAdjust(a.value);
        if (!value) return json({ ok: false, error: "invalid_adjust" }, 400);
        next[a.referenceId] = value;
      }
      changes.adjust = next;
    }
    if (!Object.keys(changes).length) return json({ ok: false, error: "empty_patch" }, 400);
    changes.updatedAt = now().toISOString();
    await deps.store.update(id, changes);
    return json({ ok: true, data: { photo: publicPhoto({ ...meta, ...changes }) } });
  }

  async function remove(id: string) {
    const meta = await deps.store.get(id);
    if (!meta) return json({ ok: false, error: "not_found" }, 404);
    // Octets d'abord : si leur suppression échoue, la photo reste entière
    // (métadonnée comprise) et la suppression peut être relancée. Octets déjà
    // absents = succès, donc une métadonnée restée après une coupure se
    // supprime aussi.
    try {
      const blobId = meta.blobId || (await deps.blobs.find(id));
      if (blobId) await deps.blobs.remove(blobId);
    } catch {
      return storageFailure();
    }
    await deps.store.remove(id);
    return json({ ok: true, data: { id } });
  }

  async function image(id: string) {
    const meta = await deps.store.get(id);
    if (!meta || meta.status !== "ready" || !meta.blobId) return json({ ok: false, error: "not_found" }, 404);
    let bytes: Uint8Array | null;
    try {
      bytes = await deps.blobs.get(meta.blobId);
    } catch {
      return storageFailure();
    }
    if (!bytes) return json({ ok: false, error: "not_found" }, 404);
    return new Response(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "content-type": "image/jpeg",
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-disposition": "inline",
      },
    });
  }

  async function setReference(req: Request) {
    const body = await readJson(req);
    if (!body || !("id" in body)) return json({ ok: false, error: "invalid_json" }, 400);
    if (body.id === null) {
      await deps.store.setReference(null);
      return json({ ok: true, data: { referenceId: null } });
    }
    if (!isPhotoId(body.id)) return json({ ok: false, error: "invalid_id" }, 400);
    const meta = await deps.store.get(body.id);
    if (!meta || meta.status !== "ready") return json({ ok: false, error: "not_found" }, 404);
    await deps.store.setReference(body.id);
    return json({ ok: true, data: { referenceId: body.id } });
  }

  return async function handler(req: Request): Promise<Response> {
    const target = route(new URL(req.url).pathname);
    if (!target) return json({ ok: false, error: "not_found" }, 404);
    const allowed = ALLOWED[target.kind];
    if (!allowed.includes(req.method)) return json({ ok: false, error: "method_not_allowed" }, 405, { allow: allowed.join(", ") });
    const denied = await deps.requireOwner(req);
    if (denied) return denied;
    try {
      if (target.kind === "collection") return req.method === "GET" ? await list() : await upload(req);
      if (target.kind === "reference") return await setReference(req);
      if (target.kind === "image") return await image(target.id!);
      return req.method === "PATCH" ? await patch(req, target.id!) : await remove(target.id!);
    } catch {
      // Erreur Firestore ou inattendue : jamais de détail brut renvoyé.
      return json({ ok: false, error: "body_photos_failed", detail: "Opération impossible pour le moment. Réessaie." }, 500);
    }
  };
}
