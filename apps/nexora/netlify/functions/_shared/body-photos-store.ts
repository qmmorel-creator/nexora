// Photos corporelles (#616) : raccordement aux vrais services, tout dans
// Firestore (projet nexora-cb20d), écrit et lu par firebase-admin :
//   - métadonnées : collection `bodyPhotos` et document `bodyPhotoSettings/main`
//     (référence) ;
//   - octets : collection `bodyPhotoBlobs/{photoId}` (manifeste) et sa
//     sous-collection `chunks/{n}` (morceaux binaires de 900 000 octets au plus,
//     sous la limite de 1 Mio d'un document).
// Le tout HORS de `users/{uid}/kv_store` : rien n'est synchronisé avec le reste
// de l'application ni lisible par la passerelle de l'assistant ou le MCP.
// Seule la route authentifiée (requireOwner) lit ou écrit ; aucun lien public.
//
// Un dossier Drive dédié avait d'abord été retenu : Google refuse tout quota
// Drive au compte de service, l'import y était impossible (02/10/2026).

import type { DocumentData } from "firebase-admin/firestore";
import { getDb } from "./nexora.js";
import type { BodyPhotoBlobs, BodyPhotoMeta, BodyPhotoStore } from "./body-photos.js";

const PHOTOS = "bodyPhotos";
const SETTINGS = "bodyPhotoSettings";
const SETTINGS_DOC = "main";
const BLOBS = "bodyPhotoBlobs";
const CHUNKS = "chunks";
export const BODY_PHOTO_CHUNK_BYTES = 900_000;

function fromDoc(data: DocumentData | undefined): BodyPhotoMeta | null {
  if (!data) return null;
  return {
    id: data.id,
    status: data.status === "ready" ? "ready" : "pending",
    blobId: data.blobId || null,
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

export function firestoreBodyPhotoBlobs(): BodyPhotoBlobs {
  const db = () => getDb();
  const manifest = (id: string) => db().collection(BLOBS).doc(id);
  const chunk = (id: string, n: number) => manifest(id).collection(CHUNKS).doc(String(n));
  return {
    // Le manifeste n'existe que si TOUS les morceaux ont été écrits avec lui.
    async find(photoId) {
      return (await manifest(photoId).get()).exists ? photoId : null;
    },
    // Morceaux et manifeste dans un seul lot atomique (5 Mo au plus, soit
    // 6 morceaux, sous la limite de 10 Mio d'un lot) : jamais d'image partielle.
    async put(photoId, bytes) {
      const batch = db().batch();
      const count = Math.max(1, Math.ceil(bytes.length / BODY_PHOTO_CHUNK_BYTES));
      for (let n = 0; n < count; n++) {
        const part = bytes.subarray(n * BODY_PHOTO_CHUNK_BYTES, (n + 1) * BODY_PHOTO_CHUNK_BYTES);
        batch.set(chunk(photoId, n), { data: Buffer.from(part) });
      }
      batch.set(manifest(photoId), { chunks: count, bytes: bytes.length, createdAt: new Date().toISOString() });
      await batch.commit();
      return photoId;
    },
    async get(blobId) {
      const head = await manifest(blobId).get();
      if (!head.exists) return null;
      const count = Number(head.data()?.chunks) || 0;
      const parts = await db().getAll(...Array.from({ length: count }, (_, n) => chunk(blobId, n)));
      if (parts.some((p) => !p.exists)) throw new Error("Morceaux d'image manquants.");
      return new Uint8Array(Buffer.concat(parts.map((p) => Buffer.from(p.data()!.data as Uint8Array))));
    },
    async remove(blobId) {
      const head = await manifest(blobId).get();
      const count = head.exists ? Number(head.data()?.chunks) || 0 : 0;
      // Morceaux éventuels d'une écriture antérieure sans manifeste : listés aussi.
      const listed = await manifest(blobId).collection(CHUNKS).listDocuments();
      const batch = db().batch();
      const seen = new Set<string>();
      for (let n = 0; n < count; n++) { batch.delete(chunk(blobId, n)); seen.add(String(n)); }
      for (const ref of listed) if (!seen.has(ref.id)) batch.delete(ref);
      batch.delete(manifest(blobId));
      await batch.commit();
    },
  };
}
