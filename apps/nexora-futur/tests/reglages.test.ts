import { describe, expect, it } from "vitest";
import { ajouterHabitude, avecAteliersDepart, basculerAffectation, basculerFavori, descendants, majContenuNote, majElement, majHabitude, majObjet, parentsPossibles, retirerElement, usages } from "../src/donnees/reglages";
import { ATELIERS_DEPART, normaliserAffectations } from "../src/donnees/equipe";
import type { Tache } from "../src/donnees/modele";

describe("réglages (Ref #663)", () => {
  it("modifie un élément en gardant ses champs inconnus ; undefined retire le champ", () => {
    const l = [{ id: "p", name: "A", color: "#000", metroTaskIcons: true }, { id: "q", name: "B" }];
    expect(majElement(l, "p", { name: "A2", color: undefined })).toEqual([{ id: "p", name: "A2", metroTaskIcons: true }, { id: "q", name: "B" }]);
    expect(retirerElement(l, "q").map((x) => x.id)).toEqual(["p"]);
    expect(majObjet({ projectId: "p", statusId: "s" }, { statusId: "", assignee: "Léa" })).toEqual({ projectId: "p", assignee: "Léa" });
  });
  it("suppression protégée : tâches actives et archivées comptent", () => {
    const t = (id: string, projectId: string) => ({ id, title: id, projectId }) as Tache;
    expect(usages([t("a", "p")], [t("b", "p"), t("c", "q")], "projectId", "p")).toBe(2);
  });
  it("dossiers : pas de parent parmi ses descendants", () => {
    const f = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null }];
    expect([...descendants(f, "a")].sort()).toEqual(["a", "b", "c"]);
    expect(parentsPossibles(f, "a").map((x) => x.id)).toEqual(["d"]);
  });
  it("favoris et habitudes", () => {
    expect(basculerFavori([{ type: "project", id: "p" }], { type: "project", id: "p" })).toEqual([]);
    expect(basculerFavori([], { type: "project", id: "p" })).toEqual([{ type: "project", id: "p" }]);
    const th = [{ id: "t", name: "Santé", habits: [{ id: "h", name: "Eau", strava: { x: 1 } }] }];
    expect(majHabitude(th, "t", "h", { name: "Eau 2 L" })[0].habits).toEqual([{ id: "h", name: "Eau 2 L", strava: { x: 1 } }]);
    expect(majHabitude(th, "t", "h", null)[0].habits).toEqual([]);
    expect(ajouterHabitude(th, "t", { id: "g", name: "Gainage" })[0].habits).toHaveLength(2);
  });
  it("affectations : coche, ajoute, décoche ; la case vide disparaît", () => {
    let l: unknown = [];
    l = basculerAffectation(l, "Léa", "2026-10-05", "ws-usine");
    l = basculerAffectation(l, "Léa", "2026-10-05", "ws-bureau");
    expect(normaliserAffectations(l)).toEqual([{ id: "Léa|2026-10-05", member: "Léa", date: "2026-10-05", workshops: ["ws-usine", "ws-bureau"] }]);
    l = basculerAffectation(l, "Léa", "2026-10-05", "ws-usine");
    l = basculerAffectation(l, "Léa", "2026-10-05", "ws-bureau");
    expect(l).toEqual([]);
  });
  it("ateliers : un catalogue vide s'écrit avec les ateliers de départ", () => {
    expect(avecAteliersDepart([], ATELIERS_DEPART).map((w) => w.id)).toEqual(ATELIERS_DEPART.map((w) => w.id));
    expect(avecAteliersDepart([{ id: "x" }], ATELIERS_DEPART)).toEqual([{ id: "x" }]);
  });
  it("note : seul le contenu du widget visé change, pages et liste à plat", () => {
    const tableaux = [{ id: "b", pages: [{ id: "p", widgets: [{ id: "w1", type: "note", content: "a", title: "T" }, { id: "w2", type: "chart" }] }] }, { id: "c", widgets: [{ id: "w3", type: "note", content: "x" }] }];
    const n = majContenuNote(tableaux, "w3", "y") as typeof tableaux;
    expect(n[1].widgets![0]).toEqual({ id: "w3", type: "note", content: "y" });
    expect(n[0]).toEqual(tableaux[0]);
    expect((majContenuNote({ pages: [{ widgets: [{ id: "w1", type: "note", content: "a" }] }] }, "w1", "b") as { pages: { widgets: { content: string }[] }[] }).pages[0].widgets[0].content).toBe("b");
  });
});
