import { describe, expect, it } from "vitest";
import { createBodyPhotosHandler, type BodyPhotoMeta } from "../netlify/functions/_partage/body-photos";

// Photos corporelles côté serveur (sevrage de Nexora, #721) : module de Nexora
// copié, servi sous /api/optim/photos ; stockage factice en mémoire.
const P1 = "0f8e9a2c-1111-4a7b-9c3d-000000000001", P2 = "0f8e9a2c-1111-4a7b-9c3d-000000000002";
function monter(proprio = true) {
  const metas = new Map<string, BodyPhotoMeta>(); let ref: string | null = null; const octets = new Map<string, Uint8Array>();
  const meta = (id: string, date: string): BodyPhotoMeta => ({ id, status: "ready", blobId: "b-" + id, date, dateSource: "import", width: 800, height: 1200, createdAt: date + "T10:00:00Z" } as BodyPhotoMeta);
  metas.set(P1, meta(P1, "2026-04-06")); metas.set(P2, meta(P2, "2026-10-01")); octets.set("b-" + P1, new Uint8Array([1])); ref = P1;
  const h = createBodyPhotosHandler({
    requireOwner: async () => (proprio ? null : new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401 })),
    store: {
      list: async () => [...metas.values()], get: async (id) => metas.get(id) || null,
      createPending: async (m) => { const e = metas.get(m.id); if (e) return { meta: e, created: false }; metas.set(m.id, m); return { meta: m, created: true }; },
      update: async (id, p) => { const e = metas.get(id); if (e) metas.set(id, { ...e, ...p }); },
      remove: async (id) => { metas.delete(id); if (ref === id) ref = null; },
      getReference: async () => ref, setReference: async (id) => { ref = id; },
    },
    blobs: { find: async () => null, put: async (id, b) => { octets.set("b-" + id, b); return "b-" + id; }, get: async (id) => octets.get(id) || null, remove: async (id) => { octets.delete(id); } },
  });
  const appel = async (chemin: string, init: RequestInit = {}) => { const r = await h(new Request("https://optim.test/api/optim/photos" + chemin, init)); return { statut: r.status, corps: await r.json().catch(() => null) }; };
  return { appel, metas, lireRef: () => ref };
}

describe("photos : serveur d'Optim (module de Nexora)", () => {
  it("réservé au propriétaire", async () => {
    expect((await monter(false).appel("")).statut).toBe(401);
  });
  it("liste, référence, date, suppression sous /api/optim/photos", async () => {
    const m = monter();
    const l = await m.appel("");
    expect(l.statut).toBe(200); expect(l.corps.data.photos).toHaveLength(2); expect(l.corps.data.referenceId).toBe(P1);
    expect(JSON.stringify(l.corps.data)).not.toContain("b-" + P1); // l'identifiant de stockage ne sort jamais
    expect((await m.appel("/reference", { method: "PUT", body: JSON.stringify({ id: P2 }), headers: { "content-type": "application/json" } })).statut).toBe(200);
    expect(m.lireRef()).toBe(P2);
    expect((await m.appel("/" + P1, { method: "PATCH", body: JSON.stringify({ date: "2026-13-40" }), headers: { "content-type": "application/json" } })).statut).toBe(400);
    expect((await m.appel("/" + P1, { method: "PATCH", body: JSON.stringify({ date: "2026-04-07" }), headers: { "content-type": "application/json" } })).statut).toBe(200);
    expect(m.metas.get(P1)?.date).toBe("2026-04-07");
    expect((await m.appel("/" + P2, { method: "DELETE" })).statut).toBe(200);
    expect(m.lireRef()).toBeNull();
  });
});
