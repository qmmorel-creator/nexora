import { describe, expect, it } from "vitest";
import { CARTES_DEFAUT, fusionnerPrefs, LARGEURS_ACCUEIL, LARGEURS_ACCUEIL_MOYEN, normaliserCorps, normaliserPrefs, placerTuiles, PREFS_VIDES, TUILES_ACCUEIL } from "../src/donnees/prefs";

describe("préférences nexora:optimPrefs (#687)", () => {
  it("valeur absente ou invalide : valeurs par défaut", () => {
    expect(normaliserPrefs(null)).toEqual(PREFS_VIDES);
    expect(normaliserPrefs({ gantt: "metro", planning: { zoom: "siecle" }, accueil: { pixels: "oui" } })).toMatchObject({ gantt: "ruban", planning: { zoom: "mois" }, accueil: { pixels: true } });
  });
  it("argent (#690) : onglet connu et durée de patrimoine parmi 6/12/24/36/60 mois", () => {
    expect(normaliserPrefs({}).argent).toEqual({ onglet: "mois", patrimoineMois: 24, periode: "mois" });
    expect(normaliserPrefs({ argent: { onglet: "pro", patrimoineMois: 60, periode: "semaine" } }).argent).toEqual({ onglet: "pro", patrimoineMois: 60, periode: "semaine" });
    expect(normaliserPrefs({ argent: { periode: "decennie" } }).argent.periode).toBe("mois");
    expect(normaliserPrefs({ argent: { onglet: "bourse", patrimoineMois: 7 } }).argent).toEqual({ onglet: "mois", patrimoineMois: 24, periode: "mois" });
    expect(normaliserPrefs({ argent: "x" }).argent).toEqual({ onglet: "mois", patrimoineMois: 24, periode: "mois" });
  });
  it("accueil (#691) : tuiles connues, sans doublon, ordre conservé ; absent = toutes", () => {
    expect(normaliserPrefs({}).accueil.tuiles).toEqual([...TUILES_ACCUEIL]);
    expect(normaliserPrefs({ accueil: { tuiles: ["argent", "meteo", "journee", "argent"] } }).accueil.tuiles).toEqual(["argent", "journee"]);
    expect(normaliserPrefs({ accueil: { tuiles: [] } }).accueil.tuiles).toEqual([]);
  });
  it("grille de l'accueil : rangées de 12 colonnes toujours pleines", () => {
    expect(placerTuiles([...TUILES_ACCUEIL], LARGEURS_ACCUEIL)).toEqual([8, 4, 8, 4, 12]);
    expect(placerTuiles(["journee", "semaine", "projets"], LARGEURS_ACCUEIL)).toEqual([12, 8, 4]);
    expect(placerTuiles(["corps", "argent", "projets"], LARGEURS_ACCUEIL)).toEqual([12, 12, 12]);
    expect(placerTuiles(["projets", "corps", "journee"], LARGEURS_ACCUEIL)).toEqual([4, 8, 12]);
    expect(placerTuiles([...TUILES_ACCUEIL], LARGEURS_ACCUEIL_MOYEN)).toEqual([12, 12, 8, 4, 12]);
    expect(placerTuiles([], LARGEURS_ACCUEIL)).toEqual([]);
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
    const r = fusionnerPrefs({ futur: 1, gantt: "pont" }, { accueil: { ...PREFS_VIDES.accueil, pixels: false, corps: ["hrv"], tuiles: ["corps"] } });
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

describe("Corps : sports et grandeur (retour du 03/10/2026)", () => {
  it("sports masqués conservés, grandeur connue sinon durée", () => {
    const c = normaliserPrefs({ corps: { sportsMasques: ["Vélo", 3, "Crossfit"], grandeurSport: "denivele" } }).corps;
    expect(c.sportsMasques).toEqual(["Vélo", "Crossfit"]); expect(c.grandeurSport).toBe("denivele");
    expect(normaliserPrefs({ corps: { grandeurSport: "vitesse" } }).corps.grandeurSport).toBe("duree");
  });
});

describe("accueil : contenu des blocs (retour du 03/10/2026)", () => {
  it("valeurs par défaut et normalisation", () => {
    const a = normaliserPrefs({ accueil: { journee: { cadran: false, lignes: 99 }, semaine: { jours: 14, debut: "lundi", projets: ["p1", 2], retards: "oui" } } }).accueil;
    expect(a.journee).toEqual({ cadran: false, aujourdhui: true, rattraper: true, lignes: 8, calendriers: true });
    expect(a.semaine).toEqual({ jours: 14, debut: "lundi", calendriers: true, retards: false, terminees: false, jalonsSeuls: false, projets: ["p1"] });
  });
});
