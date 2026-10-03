// Photos corporelles (sevrage de Nexora, #721 ; retour du 03/10/2026 : « tout
// doit être possible depuis Optim »). Liste, import, image, date, repères,
// ajustements, référence, suppression : le module de Nexora (copié dans
// _partage/body-photos.ts) branché directement sur Firestore — plus aucun
// passage par nexora-project. Accès réservé au propriétaire : jeton Firebase
// vérifié, uid = NEXORA_USER_UID.
import type { Config } from "@netlify/functions";
import { getAuth } from "firebase-admin/auth";
import { createBodyPhotosHandler } from "./_partage/body-photos.js";
import { firestoreBodyPhotoBlobs, firestoreBodyPhotoStore, getDb } from "./_partage/body-photos-store.js";

declare const Netlify: { env: { get(name: string): string | undefined } };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function requireOwner(req: Request): Promise<Response | null> {
  const uid = Netlify.env.get("NEXORA_USER_UID");
  if (!uid || !Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")) return json({ ok: false, error: "configuration_missing" }, 503);
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/, "").trim();
  if (!jeton) return json({ ok: false, error: "unauthorized" }, 401);
  try { getDb(); } catch { return json({ ok: false, error: "configuration_invalid" }, 503); }
  try { const d = await getAuth().verifyIdToken(jeton); if (d.uid !== uid) return json({ ok: false, error: "unauthorized" }, 401); }
  catch { return json({ ok: false, error: "unauthorized" }, 401); }
  return null;
}

export default createBodyPhotosHandler({ requireOwner, store: firestoreBodyPhotoStore(), blobs: firestoreBodyPhotoBlobs() });

export const config: Config = { path: ["/api/optim/photos", "/api/optim/photos/*"] };
