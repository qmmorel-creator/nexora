// Démo (VITE_DEMO=1) : faux serveur /api/optim/photos en mémoire, pour que le
// widget photos de Nexora fonctionne sans fonction Netlify. Lecture, image,
// date, repères, ajustements, référence et suppression ; l'import est refusé
// (aucun stockage en démo). Jamais inclus dans le build de production.
import { corpsDemo } from "./corps";

export function installerPhotosDemo(aujourdhui: string) {
  const corps = corpsDemo(aujourdhui);
  let etat: { photos: Record<string, unknown>[]; referenceId: string | null } | null = null;
  const charger = async () => { if (!etat) { const d = await corps.lire("body-photos") as { photos: Record<string, unknown>[]; referenceId: string }; etat = { photos: d.photos.map((p) => ({ ...p })), referenceId: d.referenceId }; } return etat; };
  const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data }), { headers: { "content-type": "application/json" } });
  const original = window.fetch.bind(window);
  window.fetch = async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : entree.url;
    const m = /\/api\/optim\/photos(\/.*)?$/.exec(new URL(url, location.href).pathname);
    if (!m) return original(entree, init);
    const e = await charger(), reste = m[1] || "", methode = (init?.method || "GET").toUpperCase();
    const img = /^\/([^/]+)\/image$/.exec(reste);
    if (img) return new Response(await corps.image(decodeURIComponent(img[1])));
    if (!reste && methode === "GET") return ok({ photos: e.photos, referenceId: e.referenceId });
    if (reste === "/reference" && methode === "PUT") { e.referenceId = JSON.parse(String(init?.body || "{}")).id || null; return ok({ referenceId: e.referenceId }); }
    const id = /^\/([^/]+)$/.exec(reste)?.[1];
    const p = id ? e.photos.find((x) => x.id === decodeURIComponent(id)) : undefined;
    if (p && methode === "PATCH") { Object.assign(p, JSON.parse(String(init?.body || "{}"))); return ok(p); }
    if (p && methode === "DELETE") { e.photos = e.photos.filter((x) => x !== p); if (e.referenceId === p.id) e.referenceId = null; return ok({ id: p.id }); }
    return new Response(JSON.stringify({ ok: false, error: "demo", detail: "Import indisponible en démonstration." }), { status: 400 });
  };
}
