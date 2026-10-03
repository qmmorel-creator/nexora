import { describe, expect, it } from "vitest";
import { aujourdhuiParis, estEnRetard, estReunion, estTerminee, estUrgente, statutParDefaut, statutsDuProjet, typeParDefaut } from "../src/donnees/modele";
import { CAT } from "./fixtures";

describe("règles du modèle (port de nexora-project)", () => {
  it("terminé dépend du seul nom du statut", () => {
    expect(estTerminee({ id: "a", statusId: "s5" }, CAT.statuts)).toBe(true);
    expect(estTerminee({ id: "a", statusId: "s3", completedAt: "2026-10-01" }, CAT.statuts)).toBe(false);
  });
  it("retard au jour de Paris ; sans fin, jamais en retard", () => {
    expect(estEnRetard({ id: "a", statusId: "s3", end: "2026-10-02" }, CAT.statuts, "2026-10-03")).toBe(true);
    expect(estEnRetard({ id: "a", statusId: "s5", end: "2026-10-02" }, CAT.statuts, "2026-10-03")).toBe(false);
    expect(estEnRetard({ id: "a", statusId: "s3" }, CAT.statuts, "2026-10-03")).toBe(false);
    expect(aujourdhuiParis(new Date("2026-10-03T22:30:00Z"))).toBe("2026-10-04");
  });
  it("urgent : criticité d'abord, nom de statut en repli", () => {
    expect(estUrgente({ id: "a", criticality: "urgent" }, CAT.statuts)).toBe(true);
    expect(estUrgente({ id: "a", criticality: "bas", statusId: "s1" }, CAT.statuts)).toBe(false);
    expect(estUrgente({ id: "a", statusId: "x" }, [{ id: "x", name: "Urgent" }])).toBe(true);
  });
  it("réunion d'après le type, jamais le titre", () => {
    expect(estReunion({ id: "a", taskTypeId: "tt3" }, CAT.types)).toBe(true);
    expect(estReunion({ id: "a", title: "Préparer la réunion", taskTypeId: "tt1" }, CAT.types)).toBe(false);
  });
  it("statuts par projet : propres, protégés, désactivés, courant conservé", () => {
    expect(statutsDuProjet(CAT.statuts, CAT.projets, "p2").map((s) => s.id)).toEqual(["s1", "s3", "s5", "s6"]);
    expect(statutsDuProjet(CAT.statuts, CAT.projets, "p1").map((s) => s.id)).toContain("sp");
    expect(statutsDuProjet(CAT.statuts, CAT.projets, "p2", "s2").map((s) => s.id)).toContain("s2");
    expect(statutParDefaut(CAT.statuts, CAT.projets, "p1")?.id).toBe("s1");
    expect(typeParDefaut(CAT.types, CAT.projets, "p1")?.id).toBe("tt1");
  });
});
