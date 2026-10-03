// Réglages repris de Nexora (retour du 03/10/2026) : opérations par élément, horodatage et règles de Nexora.
import { describe, expect, it } from "vitest";
import { ajouterElement, ajouterHabitude, deplacerElement, descendants, majElement, majHabitude, majObjet, parentsPossibles, renommerResponsable, retirerElement, statutProtege, usages } from "../src/donnees/reglages";
import type { Tache } from "../src/donnees/modele";

const AT = "2026-10-03T12:00:00.000Z";
describe("réglages", () => {
  it("modifier conserve les champs inconnus, retire les undefined et horodate seulement l'élément touché", () => {
    const v = [{ id: "a", name: "A", inconnu: 1, icon: "x" }, { id: "b", name: "B" }];
    expect(majElement(v, "a", { name: "A2", icon: undefined }, AT)).toEqual([{ id: "a", name: "A2", inconnu: 1, updatedAt: AT }, { id: "b", name: "B" }]);
  });
  it("ajouter n'horodate pas et ne double pas ; retirer ; valeur illisible = liste vide", () => {
    expect(ajouterElement([{ id: "a" }], { id: "a" })).toEqual([{ id: "a" }]);
    expect(ajouterElement(null, { id: "z", name: "Z" })).toEqual([{ id: "z", name: "Z" }]);
    expect(retirerElement([{ id: "a" }, { id: "b" }], "a")).toEqual([{ id: "b" }]);
  });
  it("déplacer d'un cran, sans sortir de la liste", () => {
    const v = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(deplacerElement(v, "b", -1).map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(deplacerElement(v, "c", 1).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("objet (valeurs par défaut) : champ vide retiré, le reste conservé", () => {
    expect(majObjet({ projectId: "p1", assigneeDefaulted: true }, { projectId: "", statusId: "s1" })).toEqual({ assigneeDefaulted: true, statusId: "s1" });
  });
  it("statuts protégés comme Nexora : « Terminé », « En cours »", () => {
    expect([statutProtege({ name: "Terminé" }), statutProtege({ name: "en  cours" }), statutProtege({ name: "À planifier" })]).toEqual([true, true, false]);
  });
  it("usages comptés sur les tâches et l'archive", () => {
    const t = [{ id: "1", statusId: "s1" }, { id: "2", statusId: "s2" }] as Tache[];
    expect(usages(t, [{ id: "3", statusId: "s1" } as Tache], "statusId", "s1")).toBe(2);
  });
  it("dossiers : pas de parent parmi ses descendants", () => {
    const D = [{ id: "a", parentId: null }, { id: "b", parentId: "a" }, { id: "c", parentId: "b" }, { id: "d", parentId: null }];
    expect([...descendants(D, "a")].sort()).toEqual(["a", "b", "c"]);
    expect(parentsPossibles(D, "a").map((x) => x.id)).toEqual(["d"]);
  });
  it("habitudes : ajout et modification horodatent le thème ; suppression retire l'habitude", () => {
    const v = [{ id: "t", name: "Santé", habits: [{ id: "h", name: "Eau" }] }];
    expect(ajouterHabitude(v, "t", { id: "h2", name: "Pas" }, AT)[0]).toMatchObject({ updatedAt: AT, habits: [{ id: "h" }, { id: "h2" }] });
    expect(majHabitude(v, "t", "h", { name: "Eau 2 L" }, AT)[0].habits).toEqual([{ id: "h", name: "Eau 2 L", updatedAt: AT }]);
    expect(majHabitude(v, "t", "h", null, AT)[0].habits).toEqual([]);
  });
  it("renommer un utilisateur réécrit le responsable des tâches", () => {
    const t = [{ id: "1", assignee: "Vincent B." }, { id: "2", assignee: "Autre" }] as Tache[];
    expect(renommerResponsable(t, "Vincent B.", "Vincent Bernard", AT).map((x) => [x.assignee, x.lastInteraction])).toEqual([["Vincent Bernard", AT], ["Autre", undefined]]);
  });
});
