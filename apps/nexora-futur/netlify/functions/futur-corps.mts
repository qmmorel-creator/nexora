// Corps (Ref #660) : relais en lecture vers nexora-project pour le sport, la
// santé et les photos corporelles. Jeton Firebase vérifié ici (uid =
// NEXORA_USER_UID) puis transmis tel quel ; nexora-project le revérifie.
// Routes : voir _partage/relais-corps.
import type { Config } from "@netlify/functions";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { routerCorps } from "./_partage/relais-corps.js";

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

  const r = routerCorps(req.method, new URL(req.url).pathname);
  if (!r.ok) return json({ ok: false, error: r.erreur }, r.statut);
  try {
    const amont = await fetch(r.url, {
      signal: AbortSignal.timeout(9_500), // sous la limite de 10 s d'une fonction Netlify : erreur lisible
      headers: { authorization: `Bearer ${jeton}`, accept: r.binaire ? "image/jpeg" : "application/json" },
    });
    if (r.binaire) {
      const type = amont.headers.get("content-type") || "";
      if (!amont.ok || !type.startsWith("image/jpeg")) return new Response(await amont.text(), { status: amont.ok ? 502 : amont.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
      return new Response(amont.body, { status: 200, headers: { "content-type": "image/jpeg", "cache-control": "private, no-store" } });
    }
    return new Response(await amont.text(), { status: amont.status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    return json({ ok: false, error: "corps_relay_failed", detail: e instanceof Error ? e.message : String(e) }, 502);
  }
};

export const config: Config = { path: ["/api/futur/corps/*"], method: ["GET"] };
