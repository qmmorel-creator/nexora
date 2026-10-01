import { getAuth } from "firebase-admin/auth";
import { getDb, json } from "./nexora.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Session Nexora du PROPRIÉTAIRE, vérifiée côté serveur (#569, #578) : la
// simple présence d'un jeton ne suffit pas pour des données personnelles
// (finances, sport). Le jeton d'identité Firebase est vérifié (signature,
// expiration, projet) et son uid doit être NEXORA_USER_UID.
// Renvoie null si l'accès est accordé, sinon la réponse d'erreur à retourner.
export async function requireOwner(req: Request): Promise<Response | null> {
  const ownerUid = Netlify.env.get("NEXORA_USER_UID");
  const serviceAccount = Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  const missing = [!ownerUid && "NEXORA_USER_UID", !serviceAccount && "FIREBASE_SERVICE_ACCOUNT_JSON"].filter(Boolean) as string[];
  if (missing.length) return json({ ok: false, error: "configuration_missing", missing }, 503);

  const authorization = req.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    getDb(); // initialise l'application firebase-admin (compte de service, projet nexora-cb20d)
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.uid !== ownerUid) return json({ ok: false, error: "unauthorized" }, 401);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  return null;
}
