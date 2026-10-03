import { describe, expect, it } from "vitest";
import { bornes, decaler, moisCouverts, synthesePeriode } from "../src/donnees/periode";
import { buildBudgetSummary } from "../../nexora/lib/finance-budget.mjs";

const J = "2026-10-03"; // samedi
const tx = (id: string, d: string, type: string, montant: number, category: string, extra: Record<string, unknown> = {}) => ({ transaction_id: id, effective_date: d, bank_date: d, transaction_type: type, account_id: "cc", signed_amount: montant, category, subcategory: "", ...extra });
const BRUT = {
  transactions: [
    tx("b1", "2026-01-01", "Budget", -600, "Alimentation", { description: "[B360:BUDGET_V2:1,2,3,4,5,6,7,8,9,10,11,12]" }),
    tx("b2", "2026-01-01", "Budget", -310, "Loisirs", { description: "[B360:BUDGET_V2:10]" }),
    tx("r1", "2026-10-01", "Revenu", 3100, "Salaire"),
    tx("d1", "2026-10-02", "Dépense", -64, "Loisirs"),
    tx("d2", "2026-10-06", "Dépense", -142.3, "Alimentation"),
    tx("d3", "2026-09-18", "Dépense", -188.4, "Alimentation"),
    tx("t1", "2026-10-20", "Transfert", -150, "Transferts internes"),
  ],
  accounts: [{ account_id: "cc", name: "Compte courant", bank: "A", account_type: "Courant", opening_balance: 0 }],
  categories: [{ category: "Alimentation", color: "#22b07d" }, { category: "Loisirs", color: "#8b5cf6" }],
  subcategories: [], banks: [], accountTypes: [], balances: [],
};

describe("période d'Argent (#690)", () => {
  it("boutons rapides", () => {
    expect(bornes("mois", J)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(bornes("mois-prec", J)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(bornes("semaine", J)).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(bornes("annee", J)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(bornes("perso", J, { from: "2026-02-10", to: "2026-03-05" })).toEqual({ from: "2026-02-10", to: "2026-03-05" });
    expect(bornes("perso", J, { from: "2026-03-05", to: "2026-02-10" })).toEqual(bornes("mois", J));
  });
  it("décaler : mois et années calendaires, sinon même durée", () => {
    expect(decaler(bornes("mois", J), -1)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(decaler(bornes("annee", J), 1)).toEqual({ from: "2027-01-01", to: "2027-12-31" });
    expect(decaler(bornes("semaine", J), 1)).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });
  it("mois couverts et prorata", () => {
    expect(moisCouverts({ from: "2026-09-28", to: "2026-10-04" })).toEqual([{ mois: "2026-09", part: 3 / 30 }, { mois: "2026-10", part: 4 / 31 }]);
  });
  it("un mois entier donne exactement la synthèse de Nexora", () => {
    const s = synthesePeriode(BRUT, bornes("mois", J));
    const n = buildBudgetSummary(BRUT, "2026-10", new Date("2026-10-03T10:00:00Z"));
    expect(s.tracking).toEqual(n.tracking);
    expect(s.charts).toEqual(n.charts);
    expect(s.totals.expenses).toBe(n.totals.expenses); expect(s.totals.income).toBe(n.totals.income);
  });
  it("une semaine : dépenses de la semaine, budget au prorata des jours", () => {
    const s = synthesePeriode(BRUT, bornes("semaine", J));
    expect(s.totals.expenses).toBe(64); expect(s.totals.income).toBe(3100);
    const alim = s.tracking.find((c) => c.category === "Alimentation")!;
    expect(alim.budget).toBeCloseTo(600 * 3 / 30 + 600 * 4 / 31, 2);
    expect(s.tracking.find((c) => c.category === "Loisirs")!.budget).toBeCloseTo(310 * 4 / 31, 2);
  });
});
