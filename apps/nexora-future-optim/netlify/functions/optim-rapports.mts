// Rapports de l'assistant pour le Fil du jour (Ref #656). LECTURE SEULE :
// lit les rapports déjà enregistrés par nexora-project
// (users/{uid}/assistant_reports/{AAAA-MM-JJ}-{morning|evening}).
// Accès réservé au propriétaire : jeton Firebase vérifié, uid = NEXORA_USER_UID.
import type { Config } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

declare const Netlify: { env: { get(name: string): string | undefined } };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "{}")) });
}

export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const uid = Netlify.env.get("NEXORA_USER_UID");
  if (!uid || !Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")) return json({ ok: false, error: "configuration_missing" }, 503);
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/, "").trim();
  if (!jeton) return json({ ok: false, error: "unauthorized" }, 401);
  // Compte de service illisible (valeur masquée « •••• » recopiée, JSON
  // tronqué) : erreur de configuration, pas une session expirée.
  let auth;
  try { auth = getAuth(app()); } catch { return json({ ok: false, error: "configuration_invalid" }, 503); }
  try {
    const decode = await auth.verifyIdToken(jeton);
    if (decode.uid !== uid) return json({ ok: false, error: "unauthorized" }, 401);
  } catch { return json({ ok: false, error: "unauthorized" }, 401); }

  const jour = new URL(req.url).searchParams.get("jour") || "";
  if (!JOUR.test(jour)) return json({ ok: false, error: "invalid_day" }, 400);
  try {
    const db = getFirestore(app());
    const [matin, soir] = await Promise.all(["morning", "evening"].map((k) => db.doc(`users/${uid}/assistant_reports/${jour}-${k}`).get()));
    return json({ ok: true, jour, matin: matin.exists ? matin.data() : null, soir: soir.exists ? soir.data() : null });
  } catch (e) {
    return json({ ok: false, error: "read_failed", detail: e instanceof Error ? e.message : String(e) }, 502);
  }
};

export const config: Config = { path: "/api/optim/rapports", method: ["GET"] };
