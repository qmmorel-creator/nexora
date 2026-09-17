import type { Config, Context } from "@netlify/functions";

const PROJECT_ID = "nexora-cb20d";
const DATABASE = "(default)";
const CHUNK_LIMIT = 150000;
const CHUNK_MARKER = "--nexora-chunk--";
const CHUNK_MODE = "chunked-v1";
// Ce relais REST écrit pour le compte d'une session Nexora ouverte dans un
// navigateur : ses écritures portent donc la même origine que l'adaptateur
// Firestore direct, et non celle de la passerelle assistant/MCP.
const WRITE_SOURCE = "browser";

type JsonObject = Record<string, unknown>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const stringField = (value: unknown) => ({ stringValue: String(value ?? "") });
const intField = (value: number) => ({ integerValue: String(value) });
const nullField = () => ({ nullValue: null });
const arrayField = (values: string[]) => ({
  arrayValue: { values: values.map((value) => stringField(value)) },
});

const fieldValue = (field: any): any => {
  if (!field || typeof field !== "object") return undefined;
  if ("stringValue" in field) return field.stringValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("booleanValue" in field) return Boolean(field.booleanValue);
  if ("nullValue" in field) return null;
  if ("arrayValue" in field) return (field.arrayValue?.values || []).map(fieldValue);
  return undefined;
};

const decodeDocument = (document: any) => {
  const fields = document?.fields || {};
  return {
    name: document?.name || "",
    updateTime: document?.updateTime || null,
    value: fieldValue(fields.value),
    updatedAt: fieldValue(fields.updatedAt) || null,
    revision: fieldValue(fields.revision) || null,
    source: fieldValue(fields.source) || null,
    storageMode: fieldValue(fields.storageMode) || "inline",
    chunkIds: fieldValue(fields.chunkIds) || [],
    chunkCount: Number(fieldValue(fields.chunkCount) || 0),
    totalLength: Number(fieldValue(fields.totalLength) || 0),
    parentKey: fieldValue(fields.parentKey) || null,
    chunk: fieldValue(fields.chunk),
    index: Number(fieldValue(fields.index) || 0),
  };
};

const baseUrl = () =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE}/documents`;

const documentName = (uid: string, key: string) =>
  `projects/${PROJECT_ID}/databases/${DATABASE}/documents/users/${uid}/kv_store/${key}`;

const documentUrl = (uid: string, key: string) =>
  `${baseUrl()}/users/${encodeURIComponent(uid)}/kv_store/${encodeURIComponent(key)}`;

const googleRequest = async (
  url: string,
  authorization: string,
  init: RequestInit = {},
) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(payload?.error?.message || `Firestore a répondu ${response.status}`);
    error.status = response.status;
    error.code = payload?.error?.status || "FIRESTORE_ERROR";
    throw error;
  }
  return payload;
};

const readRawDocument = async (uid: string, key: string, authorization: string) => {
  const payload = await googleRequest(documentUrl(uid, key), authorization);
  return payload ? decodeDocument(payload) : null;
};

const readLogical = async (uid: string, key: string, authorization: string) => {
  const manifest = await readRawDocument(uid, key, authorization);
  if (!manifest) return null;

  let value = manifest.value;
  if (manifest.storageMode === CHUNK_MODE) {
    if (!manifest.chunkIds.length && manifest.chunkCount > 0) {
      throw new Error(`Stockage segmenté incomplet pour ${key} : manifeste sans segments.`);
    }
    const chunks = await Promise.all(
      manifest.chunkIds.map((chunkId: string) => readRawDocument(uid, chunkId, authorization)),
    );
    const missing = chunks.findIndex((chunk) => !chunk);
    if (missing >= 0) {
      throw new Error(`Stockage segmenté incomplet pour ${key} : segment ${missing + 1}/${chunks.length} absent.`);
    }
    value = chunks
      .map((chunk, index) => {
        if (chunk!.parentKey !== key || chunk!.revision !== manifest.revision) {
          throw new Error(`Stockage segmenté incohérent pour ${key} : segment ${index + 1} d'une autre révision.`);
        }
        return String(chunk!.chunk ?? "");
      })
      .join("");
    if (manifest.totalLength && String(value).length !== manifest.totalLength) {
      throw new Error(`Stockage segmenté incomplet pour ${key} : longueur invalide.`);
    }
  }

  return {
    key,
    value,
    updatedAt: manifest.updatedAt,
    revision: manifest.revision,
    source: manifest.source,
    storageMode: manifest.storageMode,
    chunkCount: manifest.chunkCount,
  };
};

const makeDocument = (name: string, fields: JsonObject) => ({ name, fields });

const writeLogical = async (
  uid: string,
  key: string,
  value: string,
  expectedRevision: string | null | undefined,
  authorization: string,
) => {
  const current = await readRawDocument(uid, key, authorization);
  const remoteRevision = current?.revision ?? null;
  if (expectedRevision === undefined && current) {
    const error: any = new Error(`Conflit de synchronisation sur ${key} : version distante non chargée.`);
    error.status = 409;
    error.code = "NEXORA_SYNC_CONFLICT";
    throw error;
  }
  if (expectedRevision !== undefined && remoteRevision !== expectedRevision) {
    const error: any = new Error(`Conflit de synchronisation sur ${key} : Firebase contient une version plus récente.`);
    error.status = 409;
    error.code = "NEXORA_SYNC_CONFLICT";
    throw error;
  }

  const now = new Date().toISOString();
  const revision = crypto.randomUUID();
  const chunks: string[] = [];
  for (let index = 0; index < value.length; index += CHUNK_LIMIT) {
    chunks.push(value.slice(index, index + CHUNK_LIMIT));
  }
  if (!chunks.length) chunks.push("");
  const useChunks = chunks.length > 1;
  const chunkIds = useChunks
    ? chunks.map((_, index) => `${key}${CHUNK_MARKER}${revision}-${String(index).padStart(4, "0")}`)
    : [];

  const writes: any[] = [];
  for (const oldChunkId of current?.chunkIds || []) {
    writes.push({ delete: documentName(uid, oldChunkId) });
  }
  if (useChunks) {
    chunks.forEach((chunk, index) => {
      writes.push({
        update: makeDocument(documentName(uid, chunkIds[index]), {
          parentKey: stringField(key),
          revision: stringField(revision),
          index: intField(index),
          chunk: stringField(chunk),
          updatedAt: stringField(now),
        }),
        currentDocument: { exists: false },
      });
    });
  }

  const manifestFields: JsonObject = {
    value: useChunks ? nullField() : stringField(value),
    updatedAt: stringField(now),
    revision: stringField(revision),
    source: stringField(WRITE_SOURCE),
    storageMode: stringField(useChunks ? CHUNK_MODE : "inline"),
    chunkCount: intField(useChunks ? chunkIds.length : 0),
    totalLength: intField(value.length),
  };
  if (useChunks) manifestFields.chunkIds = arrayField(chunkIds);

  writes.push({
    update: makeDocument(documentName(uid, key), manifestFields),
    currentDocument: current ? { updateTime: current.updateTime } : { exists: false },
  });

  await googleRequest(`${baseUrl()}:commit`, authorization, {
    method: "POST",
    body: JSON.stringify({ writes }),
  });
  return {
    key,
    value,
    updatedAt: now,
    revision,
    source: WRITE_SOURCE,
    storageMode: useChunks ? CHUNK_MODE : "inline",
    chunkCount: useChunks ? chunkIds.length : 0,
  };
};

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    return json({ ok: false, error: "Authentification Firebase requise." }, 401);
  }

  try {
    const body = await req.json();
    const action = String(body?.action || "");
    const uid = String(body?.uid || "").trim();
    const key = String(body?.key || "").trim();
    if (!uid || !/^[A-Za-z0-9:_-]{1,160}$/.test(key)) {
      return json({ ok: false, error: "UID ou clé invalide." }, 400);
    }

    if (action === "get" || action === "checkRevision") {
      const result = await readLogical(uid, key, authorization);
      if (!result) return json({ ok: false, code: "NOT_FOUND", error: `Key not found: ${key}` }, 404);
      return json({ ok: true, result: action === "checkRevision" ? { revision: result.revision, source: result.source } : result });
    }

    if (action === "set") {
      const value = String(body?.value ?? "");
      if (value.length > 12_000_000) return json({ ok: false, error: "Payload trop volumineux." }, 413);
      const expectedRevision = Object.prototype.hasOwnProperty.call(body, "expectedRevision")
        ? (body.expectedRevision === null ? null : String(body.expectedRevision))
        : undefined;
      const result = await writeLogical(uid, key, value, expectedRevision, authorization);
      return json({ ok: true, result });
    }

    if (action === "list") {
      const prefix = String(body?.prefix || "");
      const keys: string[] = [];
      let pageToken = "";
      do {
        const params = new URLSearchParams({ pageSize: "1000" });
        if (pageToken) params.set("pageToken", pageToken);
        const payload = await googleRequest(
          `${baseUrl()}/users/${encodeURIComponent(uid)}/kv_store?${params.toString()}`,
          authorization,
        );
        for (const document of payload?.documents || []) {
          const id = String(document.name || "").split("/").pop() || "";
          if (!id.includes(CHUNK_MARKER) && (!prefix || id.startsWith(prefix))) keys.push(id);
        }
        pageToken = payload?.nextPageToken || "";
      } while (pageToken);
      return json({ ok: true, result: { keys } });
    }

    if (action === "delete") {
      const current = await readRawDocument(uid, key, authorization);
      if (!current) return json({ ok: true, result: { key, deleted: false } });
      const expectedRevision = Object.prototype.hasOwnProperty.call(body, "expectedRevision")
        ? (body.expectedRevision === null ? null : String(body.expectedRevision))
        : undefined;
      if (expectedRevision === undefined || current.revision !== expectedRevision) {
        return json({ ok: false, code: "NEXORA_SYNC_CONFLICT", error: `Conflit de synchronisation sur ${key} : suppression refusée.` }, 409);
      }
      const writes = [
        ...(current.chunkIds || []).map((chunkId: string) => ({ delete: documentName(uid, chunkId) })),
        { delete: documentName(uid, key), currentDocument: { updateTime: current.updateTime } },
      ];
      await googleRequest(`${baseUrl()}:commit`, authorization, {
        method: "POST",
        body: JSON.stringify({ writes }),
      });
      return json({ ok: true, result: { key, deleted: true } });
    }

    return json({ ok: false, error: "Action inconnue." }, 400);
  } catch (error: any) {
    return json(
      { ok: false, code: error?.code || "NEXORA_SERVER_ERROR", error: error?.message || String(error) },
      Number(error?.status) || 500,
    );
  }
};

export const config: Config = {
  path: "/api/nexora-storage",
};
