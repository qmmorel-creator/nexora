// Relais Corps (Ref #660), logique pure. Décision de Quentin (2026-10-03) :
// sport, santé et photos corporelles sont LUS par relais vers nexora-project,
// qui garde seul les adresses des feuilles publiées et le stockage des photos.
// nexora-futur ne détient ni NEXORA_SPORT_CSV_URL, ni NEXORA_HEALTH_CSV_URL.
// Liste blanche : quatre lectures. Aucun envoi, repère, date ni suppression.
export const AMONT = "https://nexora-project.org";
const ID_PHOTO = /^[A-Za-z0-9_-]{8,64}$/;

export type RouteCorps = { ok: true; url: string; binaire: boolean } | { ok: false; statut: number; erreur: string };

export function routerCorps(methode: string, chemin: string): RouteCorps {
  if (methode !== "GET") return { ok: false, statut: 405, erreur: "method_not_allowed" };
  const nom = chemin.replace(/^\/api\/optim\/corps\/?/, "").replace(/\/+$/, "");
  if (nom === "sport-activities" || nom === "health-records" || nom === "body-photos") return { ok: true, url: `${AMONT}/api/nexora/${nom}`, binaire: false };
  const m = /^body-photos\/([^/]+)\/image$/.exec(nom);
  if (m) return ID_PHOTO.test(m[1]) ? { ok: true, url: `${AMONT}/api/nexora/body-photos/${m[1]}/image`, binaire: true } : { ok: false, statut: 400, erreur: "invalid_photo_id" };
  return { ok: false, statut: 404, erreur: "not_found" };
}
