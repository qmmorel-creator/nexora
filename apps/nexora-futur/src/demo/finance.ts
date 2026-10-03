// Budget FICTIF de démonstration (Ref #659). Mêmes FORMES de réponse que
// nexora-project (lib/finance-budget.mjs) ; calculs simplifiés, démo seulement.
import type { AccesFinance, Categorisation } from "../donnees/source";
import { ErreurFinance } from "../donnees/source";
import type { SyntheseBudget } from "../donnees/finance";

const CATEGORIES = [
  { name: "Alimentation", color: "#22B07D", subcategories: ["Courses", "Restaurant"], budget: 600 },
  { name: "Logement", color: "#4F6AF5", subcategories: ["Loyer", "Énergie"], budget: 1300 },
  { name: "Transport", color: "#F2A93B", subcategories: ["Carburant", "Péage"], budget: 250 },
  { name: "Loisirs", color: "#8B5CF6", subcategories: ["Sport", "Sorties"], budget: 150 },
  { name: "Vacances", color: "#0EA5E9", subcategories: [], budget: 0 },
  { name: "Salaire", color: "#14B8A6", subcategories: ["Paie"], budget: 0 },
];
const COMPTES = [
  { id: "cc", name: "Compte courant", bank: "Banque A", type: "Courant", color: "#4F6AF5", bankColor: "#203246", typeColor: "#4F6AF5", ouverture: 2400 },
  { id: "la", name: "Livret A", bank: "Banque A", type: "Épargne", color: "#22B07D", bankColor: "#203246", typeColor: "#22B07D", ouverture: 12000 },
  { id: "pea", name: "PEA", bank: "Banque B", type: "Placement", color: "#8B5CF6", bankColor: "#8899a6", typeColor: "#8B5CF6", ouverture: 18000 },
  { id: "cr", name: "Crédit auto", bank: "Banque B", type: "Crédit", color: "#D64545", bankColor: "#8899a6", typeColor: "#D64545", ouverture: -6400 },
];
interface Tx { id: string; date: string; label: string; amount: number; type: string; accountId: string; category: string; subcategory: string | null; confidence: number | null; }

const mois = (j: string, n: number) => { const [y, m] = j.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + n, 1, 12)).toISOString().slice(0, 7); };
const finMois = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0, 12)).toISOString().slice(0, 10);

export function financeDemo(aujourdhui: string): AccesFinance & { etat(): Tx[] } {
  const tx: Tx[] = [];
  let n = 0;
  const ajouter = (date: string, label: string, amount: number, type: string, category: string, subcategory: string | null, confidence: number | null = 1, accountId = "cc") => tx.push({ id: `demo-${++n}`, date, label, amount, type, accountId, category, subcategory, confidence });
  for (let k = -12; k <= 0; k++) {
    const m = mois(aujourdhui, k);
    ajouter(`${m}-01`, "Salaire", 3100, "Revenu", "Salaire", "Paie");
    ajouter(`${m}-03`, "Loyer", -1150, "Dépense", "Logement", "Loyer");
    ajouter(`${m}-06`, "Supermarché", -142.3, "Dépense", "Alimentation", "Courses");
    ajouter(`${m}-12`, "Station service", -68.9, "Dépense", "Transport", "Carburant");
    ajouter(`${m}-15`, "EDF", -96, "Dépense", "Logement", "Énergie");
    ajouter(`${m}-18`, "Supermarché", -188.4, "Dépense", "Alimentation", "Courses");
    ajouter(`${m}-20`, "Virement épargne", 150, "Transfert", "Transferts internes", null, 1, "la");
  }
  const m0 = aujourdhui.slice(0, 7);
  const j = (d: number) => `${m0}-${String(Math.min(d, +aujourdhui.slice(8))).padStart(2, "0")}`;
  ajouter(j(2), "Restaurant Le Quai", -64, "Dépense", "Loisirs", "Sorties", 0.62);
  ajouter(j(2), "Achat CB 4521", -38.5, "Dépense", "", null, null);
  ajouter(j(1), "Remboursement mutuelle", 42, "Remboursement", "Alimentation", "Sport", 0.9);
  ajouter(j(1), "Salle d'escalade", -180, "Dépense", "Loisirs", "Sport", 1);

  const synthese = (month: string): SyntheseBudget => {
    const from = `${month}-01`; const to = finMois(month);
    const dans = tx.filter((t) => t.date >= from && t.date <= to && t.category !== "Transferts internes");
    const depenses = dans.filter((t) => t.type === "Dépense"); const revenus = dans.filter((t) => t.type === "Revenu" || t.type === "Remboursement");
    const somme = (l: Tx[]) => Math.round(l.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100;
    const tracking = CATEGORIES.filter((c) => c.name !== "Salaire").map((c) => { const actual = somme(depenses.filter((t) => t.category === c.name)); return { category: c.name, color: c.color, budget: c.budget, actual, remaining: c.budget - actual, over: actual > c.budget }; }).filter((c) => c.budget > 0 || c.actual > 0);
    const budget = tracking.reduce((s, c) => s + c.budget, 0);
    const solde = (id: string, date: string) => COMPTES.find((c) => c.id === id)!.ouverture + tx.filter((t) => t.accountId === id && t.date <= date).reduce((s, t) => s + t.amount, 0) + (id === "cc" ? -tx.filter((t) => t.accountId === "la" && t.date <= date).reduce((s, t) => s + t.amount, 0) : 0);
    const date = to > aujourdhui ? aujourdhui : to;
    const accounts = COMPTES.map((c) => ({ id: c.id, name: c.name, bank: c.bank, type: c.type, balance: Math.round(solde(c.id, date) * 100) / 100, color: c.color, bankColor: c.bankColor, typeColor: c.typeColor })).sort((a, b) => b.balance - a.balance);
    const pairs = new Set(CATEGORIES.flatMap((c) => c.subcategories.map((s) => `${c.name}|${s}`)));
    const toCategorize = tx.filter((t) => ["Dépense", "Revenu", "Remboursement"].includes(t.type)).map((t) => {
      const cat = CATEGORIES.find((c) => c.name === t.category);
      const r = !t.category ? "sans_categorie" : (t.subcategory ? !pairs.has(`${t.category}|${t.subcategory}`) : (cat?.subcategories.length ?? 0) > 0) ? "sous_categorie" : t.confidence != null && t.confidence < 0.85 ? "confiance" : null;
      return r && { id: t.id, date: t.date, label: t.label, amount: t.amount, type: t.type, account: COMPTES.find((c) => c.id === t.accountId)!.name, category: t.category, subcategory: t.subcategory, confidence: t.confidence, reason: r };
    }).filter((x): x is NonNullable<typeof x> => !!x).sort((a, b) => b.date.localeCompare(a.date));
    return {
      month, period: { from, to }, today: aujourdhui,
      totals: { expenses: somme(depenses), income: somme(revenus), net: Math.round((somme(revenus) - somme(depenses)) * 100) / 100, budget, remaining: budget - tracking.filter((c) => c.budget > 0).reduce((s, c) => s + c.actual, 0) },
      tracking, overBudget: tracking.filter((c) => c.over && c.budget > 0).map((c) => c.category), toCategorize,
      wealth: {
        date, total: Math.round(accounts.reduce((s, a) => s + a.balance, 0) * 100) / 100, banks: [], accounts,
        history: Array.from({ length: 12 }, (_, i) => { const m = mois(from, i - 11); const d = finMois(m) > aujourdhui ? aujourdhui : finMois(m); return { month: m, total: Math.round(COMPTES.reduce((s, c) => s + solde(c.id, d), 0)) }; }),
      },
      catalogs: { accounts: COMPTES.map((c) => ({ id: c.id, name: c.name, bank: c.bank, type: c.type })), categories: CATEGORIES.map(({ name, color, subcategories }) => ({ name, color, subcategories })) },
    };
  };

  return {
    etat: () => tx,
    async lire(ressource, params = {}) {
      await new Promise((r) => setTimeout(r, 40));
      if (ressource === "budget-summary" && params.from) {
        const s = tx.filter((t) => t.date >= params.from && t.date <= params.to && t.category !== "Transferts internes");
        const dep = s.filter((t) => t.type === "Dépense"); const rev = s.filter((t) => t.type !== "Dépense" && t.type !== "Transfert");
        const somme = (l: Tx[]) => Math.round(l.reduce((x, t) => x + Math.abs(t.amount), 0) * 100) / 100;
        return { period: { from: params.from, to: params.to }, today: aujourdhui, totals: { expenses: somme(dep), income: somme(rev), net: Math.round((somme(rev) - somme(dep)) * 100) / 100 }, counts: { expenses: dep.length, income: rev.length } };
      }
      if (ressource === "budget-summary") return synthese(params.month || m0);
      if (ressource === "wealth-series") {
        const pas = params.step === "month" ? 30 : params.step === "day" ? 1 : 7;
        const points: { date: string; balances: number[]; total: number }[] = [];
        for (let d = params.from || `${mois(aujourdhui, -12)}-01`; d <= (params.to || aujourdhui); d = new Date(Date.parse(`${d}T12:00:00Z`) + pas * 86400000).toISOString().slice(0, 10)) {
          const s = synthese(d.slice(0, 7)); const b = COMPTES.map((c) => s.wealth.accounts.find((a) => a.id === c.id)!.balance);
          points.push({ date: d, balances: b, total: Math.round(b.reduce((x, y) => x + y, 0)) });
        }
        return { from: params.from, to: params.to, step: params.step || "week", today: aujourdhui, accounts: COMPTES.map(({ id, name, bank, type, color, bankColor, typeColor }) => ({ id, name, bank, type, color, bankColor, typeColor })), points };
      }
      if (ressource === "transactions-data") return { transactions: tx.map((t) => ({ transaction_id: t.id, effective_date: t.date, bank_date: t.date, transaction_type: t.type, account_id: t.accountId, signed_amount: t.amount, merchant: t.label, category: t.category, subcategory: t.subcategory, category_confidence: t.confidence })), accounts: COMPTES.map((c) => ({ account_id: c.id, name: c.name, bank: c.bank })) };
      throw new ErreurFinance("not_found");
    },
    async categoriser(c: Categorisation) {
      await new Promise((r) => setTimeout(r, 40));
      const t = tx.find((x) => x.id === c.transactionId); if (!t) throw new ErreurFinance("transaction_not_found");
      const cat = CATEGORIES.find((x) => x.name === c.category); if (!cat) throw new ErreurFinance("category_not_found");
      if (c.subcategory ? !cat.subcategories.includes(c.subcategory) : cat.subcategories.length > 0) throw new ErreurFinance("subcategory_not_found_for_category");
      t.category = c.category; t.subcategory = c.subcategory; t.confidence = 1;
    },
  };
}
