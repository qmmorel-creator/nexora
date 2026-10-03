import { describe, expect, it } from "vitest";
import { basculerHabitude, etatsDuJour, normaliserJournal, normaliserThemes, pasNumerique, poserNonApplicable, poserValeur } from "../src/donnees/habitudes";

const J = "2026-10-03";
const THEMES = normaliserThemes([
  { id: "lieu", name: "Lieu", habits: [{ id: "bureau", name: "Bureau" }, { id: "tele", name: "Télétravail" }] }, // choix unique par défaut
  { id: "sante", name: "Santé", selectionMode: "multi", habits: [{ id: "eau", name: "Eau" }, { id: "pas", name: "Pas", kind: "numeric", min: 2, max: 10, step: 2 }] },
  { name: "Vide" },
]);

describe("habitudes (port de nexora-project #193, #353)", () => {
  it("normalise le catalogue comme nexora-project", () => {
    expect(THEMES.map((t) => [t.id, t.selectionMode, t.habits.length])).toEqual([["lieu", "single", 2], ["sante", "multi", 2], ["Vide", "single", 0]]);
    expect(THEMES[1].habits[1]).toMatchObject({ kind: "numeric", min: 2, max: 10, step: 2 });
    expect(THEMES[0].habits[0]).toMatchObject({ kind: "check", min: 0, max: 10, color: "#2C6BE0" });
  });
  it("identifiant dérivé, une entrée par habitude et par jour", () => {
    expect(normaliserJournal([{ habitId: "eau", date: J }, { habitId: "eau", date: J }, { habitId: "x", date: "mauvais" }])).toEqual([{ id: `eau|${J}`, habitId: "eau", date: J }]);
  });
  it("bascule une coche ; choix unique : la sœur du même jour est retirée", () => {
    let l = basculerHabitude([], THEMES, "bureau", J);
    expect(l.map((e) => e.habitId)).toEqual(["bureau"]);
    l = basculerHabitude(l, THEMES, "tele", J);
    expect(l.map((e) => e.habitId)).toEqual(["tele"]);
    l = basculerHabitude(l, THEMES, "tele", J);
    expect(l).toEqual([]);
  });
  it("thème multi : les habitudes restent indépendantes ; les autres jours sont conservés", () => {
    let l = basculerHabitude([{ habitId: "eau", date: "2026-10-02" }], THEMES, "eau", J);
    l = poserValeur(l, THEMES, "pas", J, 4);
    expect(l.map((e) => e.id)).toEqual([`eau|2026-10-02`, `eau|${J}`, `pas|${J}`]);
  });
  it("valeur bornée à [min, max], vide = effacée", () => {
    expect(poserValeur([], THEMES, "pas", J, 50)[0].value).toBe(10);
    expect(poserValeur([], THEMES, "pas", J, 0)[0].value).toBe(2);
    expect(poserValeur([{ habitId: "pas", date: J, value: 4 }], THEMES, "pas", J, "")).toEqual([]);
  });
  it("pas du compteur : + démarre à min, plafonne ; − sous min efface", () => {
    const pas = THEMES[1].habits[1];
    expect(pasNumerique(pas, null, 1)).toBe("2");
    expect(pasNumerique(pas, 8, 1)).toBe("10");
    expect(pasNumerique(pas, 10, 1)).toBeNull();
    expect(pasNumerique(pas, 2, -1)).toBe("");
    expect(pasNumerique(pas, null, -1)).toBeNull();
  });
  it("non applicable : posé, retiré, ignoré pour une habitude inconnue", () => {
    const n = poserNonApplicable([], THEMES, "eau", J, true);
    expect(n).toEqual([{ id: `eau|${J}`, habitId: "eau", date: J }]);
    expect(poserNonApplicable(n, THEMES, "eau", J, false)).toEqual([]);
    expect(poserNonApplicable([], THEMES, "inconnue", J, true)).toEqual([]);
  });
  it("états du jour : validation prioritaire, non applicables hors total", () => {
    const e = etatsDuJour(THEMES, [{ habitId: "bureau", date: J }, { habitId: "pas", date: J, value: 4 }, { habitId: "eau", date: J }], [{ habitId: "eau", date: J }, { habitId: "tele", date: J }], J);
    const etats = Object.fromEntries(e.parTheme.flatMap((t) => t.habitudes.map((h) => [h.h.id, h.etat])));
    expect(etats).toEqual({ bureau: "fait", tele: "na", eau: "fait", pas: "partiel" });
    expect([e.faites, e.total]).toEqual([3, 3]);
  });
});

import { couleurIntensite, couleursCase, fondCase, intensite } from "../src/donnees/habitudes";
describe("couleurs des habitudes (#660, port de habitCellColors)", () => {
  it("intensité bornée, mélange avec le blanc à plancher 0,22, quartiers coniques", () => {
    const h = { id: "p", name: "Pas", color: "#000000", kind: "numeric" as const, min: 0, max: 10 };
    expect(intensite(h, 5)).toBe(0.5); expect(intensite(h, 99)).toBe(1); expect(intensite(h, undefined)).toBe(0);
    expect(couleurIntensite("#000000", 0)).toBe("#c7c7c7");
    expect(couleurIntensite("#000000", 1)).toBe("#000000");
    const theme = { id: "t", name: "T", color: "#111111", selectionMode: "multi" as const, habits: [{ id: "a", name: "A", color: "#ff0000", kind: "check" as const, min: 0, max: 10 }, h] };
    expect(couleursCase(theme, [{ id: "a|d", habitId: "a", date: "d" }, { id: "p|d", habitId: "p", date: "d", value: 10 }], "d")).toEqual(["#ff0000", "#000000"]);
    expect(fondCase(["#ff0000", "#000000"])).toBe("conic-gradient(from 45deg, #ff0000 0deg 180deg, #000000 180deg 360deg)");
    expect(fondCase([], "")).toBe("");
  });
});
