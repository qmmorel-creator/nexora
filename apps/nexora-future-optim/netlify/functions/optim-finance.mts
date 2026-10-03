// Finances (Ref #659) : relais vers nexora-project, sans secret KDM360.
// Jeton Firebase vérifié ici (uid = NEXORA_USER_UID) puis transmis tel quel ;
// nexora-project le revérifie. Routes et corps : voir _partage/relais-finance.
import type { Config } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { router } from "./_partage/relais-finance.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

function app() {
  if (getApps().length) return getApps()[0];
  return initializeApp({ credential: cert(JSON.parse(Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "{}")) });
}

export default async (req: Request) => {
  const uid = Netlify.env.get("NEXORA_USER_UID");
  if (!uid || !Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")) return json({ ok: false, error: "configuration_missing" }, 503);
  const jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/, "").trim();
  if (!jeton) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const decode = await getAuth(app()).verifyIdToken(jeton);
    if (decode.uid !== uid) return json({ ok: false, error: "unauthorized" }, 401);
  } catch { return json({ ok: false, error: "unauthorized" }, 401); }

  const url = new URL(req.url);
  const corps = req.method === "PATCH" ? await req.json().catch(() => null) : null;
  const r = router(req.method, url.pathname, url.searchParams, corps);
  if (!r.ok) return json({ ok: false, error: r.erreur }, r.statut);
  try {
    const amont = await fetch(r.url, {
      method: r.methode, body: r.corps, signal: AbortSignal.timeout(9_500), // sous la limite de 10 s d'une fonction Netlify : erreur lisible
      headers: { authorization: `Bearer ${jeton}`, accept: "application/json", ...(r.corps ? { "content-type": "application/json" } : {}) },
    });
    const texte = await amont.text();
    return new Response(texte, { status: amont.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return json({ ok: false, error: "finance_relay_failed", detail: e instanceof Error ? e.message : String(e) }, 502);
  }
};

export const config: Config = { path: ["/api/optim/finance/*"], method: ["GET", "PATCH"] };
