import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { requireOwner } from "./_shared/owner.js";
import { healthRecords } from "./_shared/health.js";
import { sportCsvRows, sportUrl } from "./_shared/sport.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Mesures santé (#594) : l'onglet Santé de la feuille (Whoop, balance,
// nutrition), en LECTURE SEULE, pour la session Nexora du propriétaire. Même
// modèle que /api/nexora/sport-activities : CSV publié lu côté serveur, URL
// dans la variable NEXORA_HEALTH_CSV_URL (contexte production), jamais
// renvoyée au navigateur ; lecture à parité avec OS360 (_shared/health.ts).
// Une variable modifiée ne vaut qu'après un nouveau déploiement.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const denied = await requireOwner(req);
  if (denied) return denied;

  const url = sportUrl(Netlify.env.get("NEXORA_HEALTH_CSV_URL"));
  if (!url) return json({ ok: false, error: "health_configuration_missing", missing: ["NEXORA_HEALTH_CSV_URL"] }, 503);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return json({ ok: false, error: "health_source_failed", detail: `La source Santé est indisponible (HTTP ${response.status}).` }, 502);
    const records = healthRecords(sportCsvRows(await response.text()));
    return json({ ok: true, data: { records, readAt: new Date().toISOString() } });
  } catch (error) {
    // Message d'OS360 (colonne, date, valeur), jamais l'URL de la source.
    return json({ ok: false, error: "health_source_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/health-records", method: ["GET"] };
