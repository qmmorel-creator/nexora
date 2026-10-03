import { describe, expect, it } from "vitest";
import {
  ATELIERS_DEPART, arbreOrganisation, capacite, chargeMembre, codeAtelier, compteJour, fenetre, joursGrille, normaliserAffectations, normaliserAteliers, normaliserEquipes, parCase,
  personnesGrille, planDeCharge, remplissage, tachesActives, tachesDuJour, totauxAteliers,
} from "../src/donnees/equipe";

const ateliers = normaliserAteliers([{ id: "ws-a", name: "Chantier", color: "#ff7a3d" }, { id: "ws-b", name: "Bureau", color: "#7a5af8" }, { id: "ws-a", name: "Doublon" }, { id: "x", name: " " }]);

describe("Charge du personnel (#660, port de NEXORA:STAFFING)", () => {
  it("catalogue : doublons et noms vides écartés ; vide = valeurs de départ", () => {
    expect(ateliers.map((w) => w.id)).toEqual(["ws-a", "ws-b"]);
    expect(normaliserAteliers([])).toEqual(ATELIERS_DEPART);
    expect(normaliserAteliers([{ id: "z", name: "Z", color: "rouge" }])[0].color).toBe("#2C6BE0");
    expect(codeAtelier("Évaluation")).toBe("EV");
    expect(codeAtelier("--")).toBe("··");
  });
  it("affectations : case vide non stockée, atelier inconnu retiré, tri date puis personne", () => {
    const a = normaliserAffectations([
      { member: "Zoé", date: "2026-10-02", workshops: ["ws-a", "ws-a", "inconnu"] },
      { member: "Alain", date: "2026-10-02", workshops: ["ws-b"] },
      { member: "Alain", date: "2026-10-01", workshops: [] },
      { member: "", date: "2026-10-01", workshops: ["ws-a"] },
      { member: "Alain", date: "01/10/2026", workshops: ["ws-a"] },
    ], ateliers.map((w) => w.id));
    expect(a).toEqual([{ id: "Alain|2026-10-02", member: "Alain", date: "2026-10-02", workshops: ["ws-b"] }, { id: "Zoé|2026-10-02", member: "Zoé", date: "2026-10-02", workshops: ["ws-a"] }]);
  });
  it("fenêtres : mois civil, semaines depuis le lundi, décalage en périodes", () => {
    expect(fenetre("month", 0, "2026-10-03")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(fenetre("month", -1, "2026-10-03")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(fenetre("week", 0, "2026-10-03")).toEqual({ start: "2026-09-28", end: "2026-10-04" });
    expect(fenetre("twoWeeks", 1, "2026-10-03")).toEqual({ start: "2026-10-12", end: "2026-10-25" });
    const j = joursGrille({ start: "2026-09-28", end: "2026-10-04" }, "2026-10-03", false);
    expect(j.map((x) => x.iso)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(joursGrille({ start: "2026-09-28", end: "2026-10-04" }, "2026-10-03").find((x) => x.today)?.dow).toBe(5);
  });
  it("remplissage : aplat, quartiers coniques, inconnu ignoré", () => {
    expect(remplissage(["ws-a"], ateliers)?.background).toBe("#ff7a3d");
    expect(remplissage(["ws-a", "ws-b"], ateliers)?.background).toBe("conic-gradient(from 45deg, #ff7a3d 0deg 180deg, #7a5af8 180deg 360deg)");
    expect(remplissage(["nope"], ateliers)).toBeNull();
  });
  it("charge en postes, présents par jour, totaux par atelier", () => {
    const aff = normaliserAffectations([{ member: "A", date: "2026-10-01", workshops: ["ws-a", "ws-b"] }, { member: "B", date: "2026-10-01", workshops: ["ws-a"] }, { member: "A", date: "2026-10-02", workshops: ["ws-a"] }]);
    const c = parCase(aff); const jours = joursGrille({ start: "2026-10-01", end: "2026-10-02" }, "2026-10-01");
    expect(chargeMembre(c, "A", jours)).toBe(3);
    expect(compteJour(c, ["A", "B", "C"], "2026-10-01")).toBe(2);
    expect([...totauxAteliers(c, ["A", "B"], jours)]).toEqual([["ws-a", 3], ["ws-b", 1]]);
    expect(personnesGrille([{ id: "1", name: "B" }, { id: "2", name: "X", inactive: true }], aff)).toEqual(["B", "A"]);
  });
  it("tâches actives : jalons, terminées et non datées exclues ; capacité par défaut 1", () => {
    const statuts = [{ id: "s5", name: "Terminé" }, { id: "s1", name: "À faire" }];
    const i = tachesActives([
      { id: "1", assignee: "A", start: "2026-10-01", end: "2026-10-05", statusId: "s1" },
      { id: "2", assignee: "A", start: "2026-10-01", end: "2026-10-05", statusId: "s5" },
      { id: "3", assignee: "A", start: "2026-10-02", end: "2026-10-02", milestone: true },
      { id: "4", assignee: "A", end: "2026-10-02" },
    ], statuts);
    expect(tachesDuJour(i, "A", "2026-10-03").map((t) => t.id)).toEqual(["1"]);
    expect(capacite(undefined)).toBe(1); expect(capacite(2)).toBe(2); expect(capacite(-1)).toBe(1);
    expect(planDeCharge([{ id: "1", assignee: "A", start: "2026-10-01", end: "2026-10-04", statusId: "s1" }], statuts, "A", "2026-10-03", 3).map((p) => p.nb)).toEqual([1, 1, 0]);
  });
});

describe("Organigramme (#660, port de buildOrgHierarchyTree)", () => {
  it("parent inexistant ou cycle : vidé", () => {
    const e = normaliserEquipes([{ id: "a", name: "A", parentTeamId: "b" }, { id: "b", name: "B", parentTeamId: "a" }, { id: "c", name: "C", parentTeamId: "zz" }]);
    expect(e.find((t) => t.id === "a")?.parentTeamId).toBe("");
    expect(e.find((t) => t.id === "c")?.parentTeamId).toBe("");
  });
  it("équipes imbriquées, transverse en racine, responsable direct, doublon multi-équipe, sans équipe", () => {
    const equipes = [{ id: "d", name: "Direction" }, { id: "t", name: "Travaux", parentTeamId: "d" }, { id: "x", name: "BE", parentTeamId: "t", parentLinkType: "transverse" }, { id: "c", name: "Com" }];
    const membres = [{ id: "1", name: "Chef", teamIds: ["d"] }, { id: "2", name: "Ouvrier", teamIds: ["t"], managerName: "Chef" }, { id: "3", name: "Multi", teamIds: ["t", "c"] }, { id: "4", name: "Seul" }, { id: "5", name: "Boucle", teamIds: ["t"], managerName: "Boucle" }];
    const r = arbreOrganisation(equipes, membres);
    const noms = (n: { type: string; equipe?: { name: string } | null; membre?: { name: string }; doublon?: boolean; enfants: unknown[] }): unknown => n.type === "equipe" ? [n.equipe ? n.equipe.name : "Sans équipe", (n.enfants as never[]).map(noms)] : [`${n.membre!.name}${n.doublon ? "*" : ""}`, (n.enfants as never[]).map(noms)];
    expect(r.map(noms)).toEqual([
      ["Direction", [["Travaux", [["Multi", []], ["Boucle", []]]], ["Chef", [["Ouvrier", []]]]]],
      ["BE", []],
      ["Com", [["Multi*", []]]],
      ["Sans équipe", [["Seul", []]]],
    ]);
  });
});
