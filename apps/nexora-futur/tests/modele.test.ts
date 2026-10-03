import { describe, expect, it } from "vitest";
import { aujourdhuiParis, estEnRetard, estTerminee } from "../src/donnees/modele";

const statuts = [{ id: "s1", name: "En cours" }, { id: "s2", name: "Terminé" }];

describe("modèle", () => {
  it("reconnaît une tâche terminée par statut ou date de fin", () => {
    expect(estTerminee({ id: "a", statusId: "s2" }, statuts)).toBe(true);
    expect(estTerminee({ id: "a", statusId: "s1", completedAt: "2026-10-01" }, statuts)).toBe(true);
    expect(estTerminee({ id: "a", statusId: "s1" }, statuts)).toBe(false);
  });
  it("calcule le retard au jour de Paris", () => {
    expect(estEnRetard({ id: "a", statusId: "s1", end: "2026-10-02" }, statuts, "2026-10-03")).toBe(true);
    expect(estEnRetard({ id: "a", statusId: "s2", end: "2026-10-02" }, statuts, "2026-10-03")).toBe(false);
    expect(aujourdhuiParis(new Date("2026-10-03T22:30:00Z"))).toBe("2026-10-04");
  });
});
