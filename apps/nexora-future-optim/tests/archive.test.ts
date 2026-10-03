// Archive (Ref #709) : tri par date d'archivage décroissante, recherche et filtre par projet.
import { describe, expect, it } from "vitest";
import { listeArchive } from "../src/donnees/archive";
import type { Tache } from "../src/donnees/modele";

const t = (id: string, title: string, projectId: string, archivedAt?: string): Tache => ({ id, title, projectId, statusId: "s5", taskTypeId: "tt1", archivedAt });
const A = [t("a", "Relance fournisseur", "p1", "2026-09-01T10:00:00Z"), t("b", "Réunion de chantier", "p2", "2026-10-02T08:00:00Z"), t("c", "Ancien devis", "p1"), t("d", "Rapport d'étude", "p1", "2026-10-01T09:00:00Z")];

describe("Archive (Ref #709)", () => {
  it("trie par archivage décroissant, sans date en dernier", () => {
    expect(listeArchive(A, { q: "", projet: null }).map((x) => x.id)).toEqual(["b", "d", "a", "c"]);
  });
  it("recherche par titre sans tenir compte des accents ni de la casse", () => {
    expect(listeArchive(A, { q: "reunion", projet: null }).map((x) => x.id)).toEqual(["b"]);
    expect(listeArchive(A, { q: "  RAPPORT ", projet: null }).map((x) => x.id)).toEqual(["d"]);
  });
  it("filtre par projet, combinable avec la recherche", () => {
    expect(listeArchive(A, { q: "", projet: "p1" }).map((x) => x.id)).toEqual(["d", "a", "c"]);
    expect(listeArchive(A, { q: "devis", projet: "p2" })).toEqual([]);
  });
  it("ne modifie pas la liste reçue", () => {
    const copie = [...A]; listeArchive(A, { q: "", projet: null }); expect(A).toEqual(copie);
  });
});
