// Photos corporelles (#616) : raccordement aux vrais services.
//   - Octets : Google Drive, dans le dossier DÉDIÉ désigné par la variable
//     Netlify NEXORA_BODY_PHOTOS_FOLDER_ID (créé par Quentin, partagé avec le
//     seul compte de service, hors du dossier « Clients » de l'archivage des
//     devis). Jeton : compte de service Firebase (_shared/google-auth.ts).
//   - Métadonnées : Firestore, collection `bodyPhotos` et document
//     `bodyPhotoSettings/main` (référence), écrits par firebase-admin. Hors de
//     `users/{uid}/kv_store` : rien n'est synchronisé avec le reste de
//     l'application ni lisible par la passerelle de l'assistant ou le MCP.
// Aucun fichier n'est jamais rendu public ni partagé : seule la route
// authentifiée lit les octets.

import type { DocumentData } from "firebase-admin/firestore";
import { getDb } from "./nexora.js";
import { getGoogleAccessToken } from "./google-auth.js";
import { DRIVE_SCOPE } from "./drive.js";
import type { BodyPhotoDrive, BodyPhotoMeta, BodyPhotoStore } from "./body-photos.js";

const PHOTOS = "bodyPhotos";
const SETTINGS = "bodyPhotoSettings";
const SETTINGS_DOC = "main";
const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const APP_PROPERTY = "nexoraBodyPhotoId";

function fromDoc(data: DocumentData | undefined): BodyPhotoMeta | null {
  if (!data) return null;
  return {
    id: data.id,
    status: data.status === "ready" ? "ready" : "pending",
    fileId: data.fileId || null,
    date: data.date,
    dateSource: data.dateSource || "import",
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    bytes: Number(data.bytes) || 0,
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
    landmarks: { leftEye: null, rightEye: null, navel: null, ...(data.landmarks || {}) },
    adjust: data.adjust || {},
  };
}

export function firestoreBodyPhotoStore(): BodyPhotoStore {
  const db = () => getDb();
  const photo = (id: string) => db().collection(PHOTOS).doc(id);
  const settings = () => db().collection(SETTINGS).doc(SETTINGS_DOC);
  return {
    async list() {
      const snap = await db().collection(PHOTOS).get();
      return snap.docs.map((d) => fromDoc(d.data())).filter(Boolean) as BodyPhotoMeta[];
    },
    async get(id) {
      const snap = await photo(id).get();
      return snap.exists ? fromDoc(snap.data()) : null;
    },
    async createPending(meta) {
      return db().runTransaction(async (tx) => {
        const snap = await tx.get(photo(meta.id));
        if (snap.exists) return { meta: fromDoc(snap.data())!, created: false };
        tx.create(photo(meta.id), meta);
        return { meta, created: true };
      });
    },
    async update(id, patch) {
      await photo(id).update(patch as DocumentData);
    },
    async remove(id) {
      await db().runTransaction(async (tx) => {
        const s = await tx.get(settings());
        tx.delete(photo(id));
        if (s.exists && s.data()?.referenceId === id) tx.set(settings(), { referenceId: null }, { merge: true });
      });
    },
    async getReference() {
      const snap = await settings().get();
      return (snap.exists && snap.data()?.referenceId) || null;
    },
    async setReference(id) {
      await settings().set({ referenceId: id }, { merge: true });
    },
  };
}

async function driveFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getGoogleAccessToken(DRIVE_SCOPE);
  const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  if (!response.ok) {
    const payload: any = await response.json().catch(() => null);
    const error: any = new Error(`Google Drive a répondu ${response.status}.`);
    error.status = response.status;
    error.reason = payload?.error?.errors?.[0]?.reason || "";
    throw error;
  }
  return response;
}

export function googleDriveBodyPhotos(): BodyPhotoDrive {
  return {
    async findByPhotoId(folderId, photoId) {
      const q = `'${folderId.replace(/'/g, "")}' in parents and appProperties has { key='${APP_PROPERTY}' and value='${photoId}' } and trashed = false`;
      const params = new URLSearchParams({ q, fields: "files(id)", pageSize: "1", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
      const found: any = await (await driveFetch(`${DRIVE_API}/files?${params}`)).json();
      return found?.files?.[0]?.id || null;
    },
    async upload(folderId, photoId, bytes) {
      // Multipart binaire : métadonnées JSON + JPEG, en un appel. Aucun
      // partage ni lien n'est créé ; le fichier hérite des droits du dossier.
      const boundary = `nexora-photo-${crypto.randomUUID()}`;
      const metadata = JSON.stringify({ name: `nexora-photo-${photoId}.jpg`, parents: [folderId], mimeType: "image/jpeg", appProperties: { [APP_PROPERTY]: photoId } });
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`),
        Buffer.from(bytes),
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const created: any = await (await driveFetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id&supportsAllDrives=true`, {
        method: "POST",
        headers: { "content-type": `multipart/related; boundary=${boundary}` },
        body,
      })).json();
      if (!created?.id) throw new Error("Envoi Drive sans identifiant de fichier.");
      return created.id;
    },
    async download(fileId) {
      const response = await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`);
      return new Uint8Array(await response.arrayBuffer());
    },
    async remove(fileId) {
      // Suppression définitive (pas de corbeille) : c'est une photo intime.
      try {
        await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: "DELETE" });
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }
    },
  };
}
