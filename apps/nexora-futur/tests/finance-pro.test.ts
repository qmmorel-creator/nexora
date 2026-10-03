import { describe, expect, it } from "vitest";
import { burnRate, caEncaisse, caEncaisseAnnee, caFacture, caPlanifie, caSigne, echeancesFacturation, facturesEnRetard, montantLigne, seuilTva, statutDevis, statutFacture, totalDevis, travailNonFacture, tresoreriePrevisionnelle } from "../src/donnees/finance-pro";
import { disposerSankey, grapheMensuel, graphePatrimoine, modeleCumul, normaliserSankey, type Graphes } from "../src/donnees/finance-graphes";

const J = "2026-10-03";
describe("devis et factures (NEXORA:QUOTES)", () => {
  it("montants : régie = quantité × taux, forfait = montant", () => {
    expect(montantLigne({ kind: "regie", quantity: 3, unitRate: 450 })).toBe(1350);
    expect(totalDevis({ lines: [{ kind: "forfait", amount: 2000 }, { kind: "regie", quantity: 2, unitRate: 100 }] })).toBe(2200);
  });
  it("statuts calculés : expiré, en retard ; jamais stockés", () => {
    expect(statutDevis({ id: "q", status: "sent", validUntil: "2026-10-01" }, J)).toBe("expired");
    expect(statutDevis({ id: "q", status: "accepted", validUntil: "2026-10-01" }, J)).toBe("accepted");
    expect(statutFacture({ id: "f", status: "issued", dueDate: "2026-10-02" }, J)).toBe("late");
    expect(statutFacture({ id: "f", status: "paid", dueDate: "2026-10-02" }, J)).toBe("paid");
  });
});

describe("Finance PRO (NEXORA:FINANCEPRO-CORE)", () => {
  const lignes = [
    { id: "l1", statut: "prevu", montantPrevu: 1000, dateCible: "2026-10-20" }, { id: "l2", statut: "a_facturer", montantPrevu: 500, dateCible: "2026-09-30" },
    { id: "l3", statut: "facture", montantPrevu: 2000, dateCible: "2026-09-15" }, { id: "l4", statut: "encaisse", montantPrevu: 3000, dateCible: "2026-08-01" },
    { id: "l5", statut: "annule", montantPrevu: 700, dateCible: "2026-09-01" }, { id: "l6", statut: "prevu", montantPrevu: 9999, archivedAt: "2026-01-01" },
    { id: "l7", type: "avoir", statut: "prevu", montantPrevu: -300, dateCible: "2026-09-20" },
  ];
  it("CA signé, planifié, facturé (avoirs compris), encaissé", () => {
    expect(caSigne([{ id: "q", status: "accepted", lines: [{ amount: 4000 }] }, { id: "r", status: "sent", lines: [{ amount: 99 }] }])).toBe(4000);
    expect(caPlanifie(lignes)).toBe(1000 + 500 - 300);
    expect(caFacture(lignes)).toBe(2000 + 3000 - 300);
    expect(caEncaisse([{ id: "p", montant: 3000, statutRapprochement: "rapproche" }, { id: "x", montant: 50, statutRapprochement: "non_rapproche" }])).toBe(3000);
  });
  it("retards, échéances, travail non facturé", () => {
    expect(facturesEnRetard(lignes, J).map((l) => l.id)).toEqual(["l2", "l3"]);
    expect(echeancesFacturation(lignes).map((l) => l.id)).toEqual(["l3", "l7", "l2", "l1"]);
    expect(travailNonFacture([{ id: "t", billable: true, status: "validee", durationMinutes: 240, rateApplied: 600, rateType: "journalier" }, { id: "u", billable: true, status: "facturee", durationMinutes: 600, rateApplied: 99 }], [{ id: "e", refacturable: true, statutRemboursement: "a_refacturer", montantTTC: 80 }])).toBe(300 + 80);
  });
  it("seuil de TVA en franchise et trésorerie prévisionnelle", () => {
    expect(seuilTva(30000).statut).toBe("proche"); expect(seuilTva(29000).statut).toBe("ok");
    expect(seuilTva(38000).statut).toBe("depasse_base"); expect(seuilTva(41250).statut).toBe("depasse_majore");
    expect(caEncaisseAnnee([{ id: "p", montant: 10, date: "2026-02-01", statutRapprochement: "rapproche" }, { id: "q", montant: 5, date: "2025-12-31", statutRapprochement: "rapproche" }], 2026)).toBe(10);
    expect(tresoreriePrevisionnelle({ tresorerieDisponible: 5000, tauxProvisionSocialesFiscales: 0.25 }, lignes, 30, J)).toBe(5000 + 1200 - 300);
  });
  it("burn rate (calculateBudgetBurnRate)", () => {
    const r = burnRate(10000, [{ amount: 2000, date: "2026-09-03" }, { amount: 1000, date: "2026-09-20" }], J);
    expect(r).toMatchObject({ statut: "pret", total: 3000, reste: 7000, pct: 30, jours: 30, journalier: 100, sante: "ok", semainesRestantes: 10 });
    expect(burnRate(1000, [{ amount: 900, date: "2026-09-26" }], J)).toMatchObject({ sante: "risk" });
    expect(burnRate(1000, [{ amount: 50 }], J)).toMatchObject({ statut: "sansDates", reste: 950 });
  });
});

describe("graphiques budget", () => {
  const c: Graphes = {
    days: ["2026-10-01", "2026-10-02", "2026-10-03"], byCategory: [], waterfall: [], incomeCumulative: [0, 100, 100], budgetTotal: 300,
    cumulative: [
      { category: "A", color: "#a", total: 250, budget: 200, values: [100, 200, 250] }, { category: "B", color: "#b", total: 90, budget: 0, values: [0, 50, 90] },
      ...Array.from({ length: 7 }, (_, i) => ({ category: `C${i}`, color: "#c", total: 1, budget: 0, values: [0, 0, 1] })),
    ],
    waffle: { unit: 0, categories: [] }, periodic: [{ month: "2026-09", expenses: 0, categories: [{ category: "B", amount: 5000, color: "" }] }],
  };
  it("cumul : rang sur 12 mois, 7 couleurs puis « Autres », rythme et dépassement", () => {
    const m = modeleCumul(c);
    expect(m.series.map((s) => s.categorie)).toEqual(["B", "A", "C0", "C1", "C2", "C3", "C4", "Autres"]);
    expect(m.series[7]).toMatchObject({ autres: true, membres: ["C5", "C6"], total: 2 });
    expect(m.total).toEqual([100, 250, 347]);
    expect(m.rythme).toEqual([100, 200, 300]);
    expect(m.jourDepassement).toBe(2);
    expect(m.totalJour).toEqual([100, 150, 97]);
  });
  const brut = {
    transactions: [
      { transaction_id: "1", effective_date: "2026-10-01", transaction_type: "Revenu", account_id: "cc", signed_amount: 3000, category: "Salaire", subcategory: "Paie" },
      { transaction_id: "2", effective_date: "2026-10-02", transaction_type: "Dépense", account_id: "cc", signed_amount: -1000, category: "Logement" },
      { transaction_id: "3", effective_date: "2026-10-02", transaction_type: "Dépense", account_id: "cc", signed_amount: -200, category: "Transferts internes" },
      { transaction_id: "4", effective_date: "2026-10-02", transaction_type: "Dépense", account_id: "cc", signed_amount: -50, category: "Loisirs" },
      { transaction_id: "5", effective_date: "2026-10-02", transaction_type: "Annulation", account_id: "cc", signed_amount: 50, cancels_transaction_id: "4" },
    ],
    accounts: [{ account_id: "cc", name: "Courant", bank: "A", account_type: "Courant", opening_balance: 100, color: "#123456" }, { account_id: "la", name: "Livret", bank: "A", account_type: "Épargne", opening_balance: 500 }],
    categories: [{ category: "Logement", color: "#4f6af5" }], banks: [], accountTypes: [], balances: [{ account_id: "la", as_of_date: "2026-09-30", balance: 800 }],
  };
  it("Sankey mensuel : transferts exclus, annulations retirées", () => {
    const g = grapheMensuel(normaliserSankey(brut), { from: "2026-10-01", to: "2026-10-31" });
    expect(g.noeuds.map((n) => n.id)).toEqual(["income:Paie", "account:cc", "category:Logement"]);
    expect(g.liens).toEqual([{ source: "income:Paie", cible: "account:cc", valeur: 3000 }, { source: "account:cc", cible: "category:Logement", valeur: 1000 }]);
    const d = disposerSankey(g, 600, 300);
    expect(d.liens.every((l) => l.chemin.startsWith("M"))).toBe(true);
  });
  it("Sankey patrimoine : dernier relevé puis mouvements", () => {
    const g = graphePatrimoine(normaliserSankey(brut), "2026-10-31", new Date("2026-10-03T12:00:00Z"));
    expect(g.liens.find((l) => l.cible === "account:la")?.valeur).toBe(800);
    expect(g.liens.find((l) => l.cible === "account:cc")?.valeur).toBe(100 + 3000 - 1000 - 200);
  });
  it("une transaction sans date refuse tout le jeu", () => {
    expect(() => normaliserSankey({ ...brut, transactions: [{ transaction_id: "x" }] })).toThrow(/sans identifiant ou dates/);
  });
});
