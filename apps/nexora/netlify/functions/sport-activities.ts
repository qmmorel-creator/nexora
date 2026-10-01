import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { requireOwner } from "./_shared/owner.js";
import { sportActivities, sportCsvRows, sportUrl } from "./_shared/sport.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Widgets sport (#578) : toutes les activités du journal « Activités Strava »,
// en LECTURE SEULE, pour la session Nexora du propriétaire. Le CSV publié est
// lu côté serveur : son URL (variable NEXORA_SPORT_CSV_URL, contexte
// production) n'est jamais envoyée au navigateur par ce code. Il est lu comme
// OS360 (_shared/sport.ts). Depuis le retrait du moteur OS360 (#597), l'URL
// n'est plus dans aucun fichier publié.
// Une variable modifiée ne vaut qu'après un nouveau déploiement.
export default async (req: Request) => {
  if (req.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, 405);
  const denied = await requireOwner(req);
  if (denied) return denied;

  const url = sportUrl(Netlify.env.get("NEXORA_SPORT_CSV_URL"));
  if (!url) return json({ ok: false, error: "sport_configuration_missing", missing: ["NEXORA_SPORT_CSV_URL"] }, 503);
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return json({ ok: false, error: "sport_source_failed", detail: `La source Sport est indisponible (HTTP ${response.status}).` }, 502);
    const activities = sportActivities(sportCsvRows(await response.text()));
    return json({ ok: true, data: { activities, readAt: new Date().toISOString() } });
  } catch (error) {
    // Message d'OS360 (colonnes, date, CSV), jamais l'URL de la source.
    return json({ ok: false, error: "sport_source_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/sport-activities", method: ["GET"] };
