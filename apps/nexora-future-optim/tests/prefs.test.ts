import { describe, expect, it } from "vitest";
import { CARTES_DEFAUT, fusionnerPrefs, normaliserCorps, normaliserPrefs, PREFS_VIDES } from "../src/donnees/prefs";

describe("préférences nexora:optimPrefs (#687)", () => {
  it("valeur absente ou invalide : valeurs par défaut", () => {
    expect(normaliserPrefs(null)).toEqual(PREFS_VIDES);
    expect(normaliserPrefs({ gantt: "metro", planning: { zoom: "siecle" }, accueil: { pixels: "oui" } })).toMatchObject({ gantt: "ruban", planning: { zoom: "mois" }, accueil: { pixels: true } });
  });
  it("argent (#690) : onglet connu et durée de patrimoine parmi 6/12/24/36/60 mois", () => {
    expect(normaliserPrefs({}).argent).toEqual({ onglet: "mois", patrimoineMois: 24 });
    expect(normaliserPrefs({ argent: { onglet: "pro", patrimoineMois: 60 } }).argent).toEqual({ onglet: "pro", patrimoineMois: 60 });
    expect(normaliserPrefs({ argent: { onglet: "bourse", patrimoineMois: 7 } }).argent).toEqual({ onglet: "mois", patrimoineMois: 24 });
    expect(normaliserPrefs({ argent: "x" }).argent).toEqual({ onglet: "mois", patrimoineMois: 24 });
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
    const r = fusionnerPrefs({ futur: 1, gantt: "pont" }, { accueil: { pixels: false, corps: ["hrv"] } });
    expect(r).toMatchObject({ futur: 1, gantt: "pont", accueil: { pixels: false }, version: 1 });
  });
  it("Corps : toujours quatre cartes, titres et mesures (4 au plus) conservés", () => {
    const c = normaliserCorps({ periode: 90, regroupement: "mois", cartes: [{ id: "cardio", titre: " Cœur ", mesures: ["hrv", "hrv", "restingHr", "spo2", "respRate", "skinTemp", "a b"] }, { id: "inconnue", titre: "x" }] });
    expect(c.periode).toBe(90); expect(c.regroupement).toBe("mois");
    expect(c.cartes.map((x) => x.id)).toEqual(CARTES_DEFAUT.map((x) => x.id));
    expect(c.cartes[1]).toEqual({ id: "cardio", titre: "Cœur", mesures: ["hrv", "restingHr", "spo2", "respRate"] });
    expect(c.cartes[0]).toEqual(CARTES_DEFAUT[0]);
    expect(normaliserCorps({ periode: 7, cartes: [{ id: "comp", titre: "", mesures: [] }] })).toMatchObject({ periode: 30, cartes: [CARTES_DEFAUT[0], CARTES_DEFAUT[1], { id: "comp", titre: "Composition corporelle", mesures: [] }, CARTES_DEFAUT[3]] });
  });
});
