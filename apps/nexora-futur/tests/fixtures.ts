import type { Catalogues } from "../src/donnees/modele";

// Catalogues identiques aux graines de nexora-project (part-000:4004, 4014).
export const CAT: Catalogues = {
  projets: [{ id: "p1", name: "CTEX6" }, { id: "p2", name: "Lot 2B", disabledStatusIds: ["s2"] }, { id: "cal", name: "Agenda", gcalSource: true }],
  statuts: [
    { id: "s1", name: "À planifier" }, { id: "s2", name: "Attente tiers" }, { id: "s3", name: "En cours" },
    { id: "s5", name: "Terminé" }, { id: "s6", name: "Information" }, { id: "sp", name: "Revue client", projectId: "p1" },
  ],
  types: [
    { id: "tt1", name: "Tâches", locked: true }, { id: "tt2", name: "Planning", locked: true },
    { id: "tt3", name: "Réunions", locked: true }, { id: "tt4", name: "Information", locked: true, restrictedStatusId: "s6" },
  ],
  membres: [{ id: "m1", name: "Vincent B." }, { id: "m2", name: "Quentin Morel" }],
};
