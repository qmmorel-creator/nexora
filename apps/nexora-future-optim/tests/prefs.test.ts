import { describe, expect, it } from "vitest";
import { fusionnerPrefs, normaliserPrefs, PREFS_VIDES } from "../src/donnees/prefs";

describe("préférences nexora:optimPrefs (#687)", () => {
  it("valeur absente ou invalide : valeurs par défaut", () => {
    expect(normaliserPrefs(null)).toEqual(PREFS_VIDES);
    expect(normaliserPrefs({ gantt: "metro", planning: { zoom: "siecle" }, accueil: { pixels: "oui" } })).toMatchObject({ gantt: "ruban", planning: { zoom: "mois" }, accueil: { pixels: true } });
  });
  it("couleurs d'habitudes : hexadécimal à 6 chiffres seulement", () => {
    expect(normaliserPrefs({ couleursHabitudes: { h1: "#DC2626", h2: "red", h3: "#123" } }).couleursHabitudes).toEqual({ h1: "#dc2626" });
  });
  it("vues : écran, nom et identifiant obligatoires, filtre normalisé", () => {
    const p = normaliserPrefs({ vues: [
      { id: "v1", ecran: "planning", nom: " Retards ", filtre: { retard: true, projets: ["p1", 3] }, zoom: "trimestre", style: "ecart" },
      { id: "v2", ecran: "corps", nom: "x" }, { ecran: "projets", nom: "sans id" },
    ] });
    expect(p.vues).toEqual([{ id: "v1", ecran: "planning", nom: "Retards", filtre: { q: "", projets: ["p1"], statuts: [], responsables: [], types: [], criticites: [], retard: true, jalons: false, terminees: false }, zoom: "trimestre", style: "ecart" }]);
  });
  it("fusion : conserve les champs inconnus d'une version future", () => {
    const r = fusionnerPrefs({ futur: 1, gantt: "pont" }, { accueil: { pixels: false } });
    expect(r).toMatchObject({ futur: 1, gantt: "pont", accueil: { pixels: false }, version: 1 });
  });
});
