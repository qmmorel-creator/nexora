// Finances (Ref #659, #721). Jeton Firebase vérifié ici (uid = NEXORA_USER_UID).
// Avec KDM360_SUPABASE_SECRET_KEY dans l'environnement d'Optim : Supabase KDM360
// en direct (_partage/finance-directe, sevrage de Nexora). Sans elle : relais vers
// nexora-project, qui revérifie le jeton. Routes et corps : _partage/relais-finance.
import type { Config } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { json, servirFinance } from "./_partage/finance-directe.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "{}")) });
}

export default async (req: Request) => {
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

  const url = new URL(req.url);
  const corps = req.method === "PATCH" ? await req.json().catch(() => null) : null;
  return servirFinance({ methode: req.method, chemin: url.pathname, params: url.searchParams, corps, jeton }, (nom) => Netlify.env.get(nom));
};

export const config: Config = { path: ["/api/optim/finance/*"], method: ["GET", "PATCH"] };
