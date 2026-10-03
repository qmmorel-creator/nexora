import { describe, expect, it } from "vitest";
import { bornesPeriode, euros, graduationsMontant, modeleBarrePatrimoine, modeleCourbePatrimoine, raison, trierSuivi } from "../src/donnees/finance";

describe("finances : règles d'affichage (part-003:37105-38110)", () => {
  it("euros arrondis, sans « -0 € »", () => {
    expect(euros(-0.4).replace(/\s/g, " ")).toBe("0 €");
    expect(euros(1234.6).replace(/\s/g, " ")).toBe("1 235 €");
    expect(euros(undefined)).toBe("—");
  });
  it("suivi : dépassements, puis taux, puis sans budget", () => {
    const r = trierSuivi([
      { category: "Sans", budget: 0, actual: 50, remaining: 0, over: false }, { category: "Moitié", budget: 100, actual: 50, remaining: 50, over: false },
      { category: "Petit dépassement", budget: 100, actual: 110, remaining: -10, over: true }, { category: "Gros dépassement", budget: 100, actual: 200, remaining: -100, over: true },
      { category: "Presque", budget: 100, actual: 95, remaining: 5, over: false },
    ]);
    expect(r.map((x) => x.category)).toEqual(["Gros dépassement", "Petit dépassement", "Presque", "Moitié", "Sans"]);
  });
  it("raison de la file à catégoriser", () => {
    expect(raison({ id: "1", date: "", label: "", amount: 0, type: "", account: "", category: "", subcategory: null, confidence: 0.62, reason: "confiance" })).toBe("IA peu sûre (62 %)");
  });
  it("périodes (financePeriodRange)", () => {
    const J = "2026-10-03";
    expect(bornesPeriode("month", J)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(bornesPeriode("previousMonth", J)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(bornesPeriode("quarter", J)).toEqual({ from: "2026-10-01", to: "2026-12-31" });
    expect(bornesPeriode("previousQuarter", J)).toEqual({ from: "2026-07-01", to: "2026-09-30" });
    expect(bornesPeriode("previousQuarter", "2026-02-10")).toEqual({ from: "2025-10-01", to: "2025-12-31" });
    expect(bornesPeriode("previousYear", J)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(bornesPeriode("week", J)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(bornesPeriode("30", J)).toEqual({ from: "2026-09-04", to: J });
    expect(bornesPeriode("custom", J, { from: "2026-01-01", to: "x" })).toEqual({ from: "2026-01-01", to: "" });
  });
  it("barre du patrimoine : actifs en parts, dettes à part, net", () => {
    const a = [
      { id: "a", name: "Courant", bank: "A", type: "Courant", balance: 1000, color: "#1" }, { id: "b", name: "Livret", bank: "A", type: "Épargne", balance: 3000 },
      { id: "c", name: "Crédit", bank: "B", type: "Crédit", balance: -500 }, { id: "d", name: "Vide", bank: "B", type: "Courant", balance: 0 },
    ];
    const m = modeleBarrePatrimoine(a, "bank");
    expect(m.segments.map((x) => [x.cle, x.valeur, x.part])).toEqual([["A", 4000, 1]]);
    expect(m.negatifs.map((x) => [x.cle, x.valeur])).toEqual([["B", -500]]);
    expect(m.net).toBe(3500);
  });
  it("courbe : empilement des positifs, somme des négatifs", () => {
    const s = { from: "", to: "", step: "week", today: "", accounts: [{ id: "a", name: "A", bank: "X", type: "Courant" }, { id: "b", name: "B", bank: "X", type: "Crédit" }, { id: "c", name: "C", bank: "Y", type: "Courant" }],
      points: [{ date: "2026-01-01", balances: [100, -50, 200], total: 250 }, { date: "2026-02-01", balances: [150, -40, 100], total: 210 }] };
    const m = modeleCourbePatrimoine(s, "type");
    expect(m.groupes.map((g) => g.cle)).toEqual(["Courant", "Crédit"]);
    expect(m.points[1]).toMatchObject({ net: 210, positif: 250, negatif: -40 });
    expect(modeleCourbePatrimoine(s, "none").groupes).toEqual([]);
  });
  it("graduations rondes, zéro compris", () => {
    expect(graduationsMontant(1200, 9800)).toEqual({ min: 0, max: 10000, traits: [0, 2500, 5000, 7500, 10000] });
    expect(graduationsMontant(-300, 900).traits).toContain(0);
  });
});
