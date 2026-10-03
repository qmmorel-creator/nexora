import { describe, expect, it } from "vitest";
import { chargeEssai, construireAtlas, emprise, hauteur, type EntreeAtlas } from "../src/donnees/atlas";

const J = "2026-10-03";
const entree = (e: Partial<EntreeAtlas> = {}): EntreeAtlas => ({
  jour: J, statuts: [{ id: "s1", name: "À faire" }, { id: "s5", name: "Terminé" }], types: [{ id: "tt3", name: "Réunions" }], membres: [{ id: "m", name: "Alice", capacityPerDay: 1 }],
  dossiers: [{ id: "f1", name: "Chantiers", order: 0 }, { id: "f2", name: "Com", order: 1 }],
  projets: [{ id: "a", name: "Alpha", folderId: "f1", color: "#f00" }, { id: "b", name: "Bêta", folderId: "f2" }, { id: "cal", name: "Agenda", gcalSource: true }],
  taches: [
    { id: "t1", title: "Retard", projectId: "a", statusId: "s1", start: "2026-09-01", end: "2026-09-20", assignee: "Alice" },
    { id: "t2", title: "Ouverte", projectId: "a", statusId: "s1", start: "2026-10-01", end: "2026-10-10", assignee: "Alice" },
    { id: "t3", title: "Faite", projectId: "a", statusId: "s5", end: "2026-09-01" },
    { id: "t4", title: "Réunion", projectId: "b", statusId: "s1", taskTypeId: "tt3", end: "2026-10-06", dependsOn: ["t2"] },
    { id: "t5", title: "Agenda", projectId: "cal", statusId: "s1", end: "2026-10-04" },
    { id: "t6", title: "Simultanée", projectId: "b", statusId: "s1", start: "2026-10-02", end: "2026-10-04", assignee: "Alice" },
  ], ...e,
});
const recouvre = (a: { x: number; y: number; w: number; d: number }, b: { x: number; y: number; w: number; d: number }) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.d && b.y < a.y + a.d;

describe("Atlas, disposition (#662)", () => {
  it("quatre régions ; un îlot par projet (calendriers exclus) ; blocs retard d'abord", () => {
    const m = construireAtlas(entree(), { budgetMois: { reste: 400, budget: 2000, aCategoriser: 3 }, habitudes: { faites: 2, total: 6 } });
    expect(m.regions.map((r) => r.id)).toEqual(["chantiers", "finances", "corps", "equipe"]);
    const a = m.ilots.find((i) => i.id === "p:a")!;
    expect(m.ilots.some((i) => i.id === "p:cal")).toBe(false);
    expect(a).toMatchObject({ ouvertes: 2, retards: 1, h: hauteur(2), avancement: 33, equipe: ["Alice"] });
    expect(a.cubes.map((c) => c.etat)).toEqual(["retard", "ouvert", "fait"]);
    expect(m.ilots.find((i) => i.id === "p:b")?.reunion).toBe("06/10");
    expect(m.liens).toEqual([{ de: "p:a", vers: "p:b", nb: 1 }]);
    expect(m.ilots.find((i) => i.id === "f:acat")?.metrique).toBe("3 opérations");
    expect(m.ilots.find((i) => i.id === "m:Alice")?.couleur).toBe("#BE2F22"); // t2 et t6 actives le 3/10 pour 1 poste
    expect(m.zones.map((z) => z.nom)).toEqual(["Chantiers", "Com"]);
  });
  it("aucun chevauchement, ni entre îlots, ni entre régions ; chaque îlot dans sa région ; déterministe", () => {
    const c = chargeEssai(300, 15, J);
    const e = entree({ ...c, statuts: [{ id: "__ouvert", name: "En cours" }, { id: "__fait", name: "Terminé" }], membres: [] });
    const m = construireAtlas(e);
    expect(m.ilots.filter((i) => i.region === "chantiers")).toHaveLength(300);
    for (let i = 0; i < m.ilots.length; i++) for (let j = i + 1; j < m.ilots.length; j++) expect(recouvre(m.ilots[i], m.ilots[j]), `${m.ilots[i].id} / ${m.ilots[j].id}`).toBe(false);
    for (let i = 0; i < m.regions.length; i++) for (let j = i + 1; j < m.regions.length; j++) expect(recouvre(m.regions[i], m.regions[j])).toBe(false);
    m.ilots.forEach((i) => { const r = m.regions.find((x) => x.id === i.region)!; expect(i.x >= r.x && i.y >= r.y && i.x + i.w <= r.x + r.w + 1e-9 && i.y + i.d <= r.y + r.d + 1e-9, i.id).toBe(true); });
    expect(construireAtlas(e)).toEqual(m);
    // Région compacte : pas une bande (rapport largeur / profondeur raisonnable).
    const ch = m.regions[0]; expect(ch.w / ch.d).toBeGreaterThan(0.5); expect(ch.w / ch.d).toBeLessThan(2.5);
  });
  it("emprise et hauteur bornées", () => {
    expect(emprise(0)).toEqual({ w: 3.3, d: 2.6 });
    expect(emprise(10000)).toEqual({ w: 8.8, d: 7 });
    expect(hauteur(0)).toBe(0.5); expect(hauteur(1000)).toBe(4.5);
  });
});
