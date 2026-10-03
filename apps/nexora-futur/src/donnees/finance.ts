// Finances (Ref #659) : types des réponses de nexora-project et règles
// d'AFFICHAGE portées de l'interface (NEXORA:FINANCE-BUDGET, -PERIOD,
// -WEALTH-BAR, -WEALTH-CURVE, part-003:37105-38110). Aucun calcul financier
// ici : les montants viennent du serveur (lib/finance-budget.mjs).

export interface Suivi { category: string; color?: string; budget: number; actual: number; remaining: number; over: boolean; }
export interface ACategoriser { id: string; date: string; label: string; amount: number; type: string; account: string; category: string; subcategory: string | null; confidence: number | null; reason: "sans_categorie" | "sous_categorie" | "confiance" | string; }
export interface ComptePatrimoine { id: string; name: string; bank: string; type: string; balance: number; color?: string; bankColor?: string; typeColor?: string; }
export interface SyntheseBudget {
  month: string; period: { from: string; to: string }; today: string;
  totals: { expenses: number; income: number; net: number; budget: number; remaining: number };
  tracking: Suivi[]; overBudget: string[]; toCategorize: ACategoriser[];
  charts?: Record<string, unknown>;
  wealth: { date: string; total: number; banks: { bank: string; color: string; total: number; segments: { type: string; value: number; color: string }[] }[]; accounts: ComptePatrimoine[]; history: { month: string; total: number }[] };
  catalogs: { accounts: { id: string; name: string; bank?: string; type?: string }[]; categories: { name: string; color?: string; subcategories: string[] }[] };
}
export interface TotauxPeriode { period: { from: string; to: string }; today: string; totals: { expenses: number; income: number; net: number }; counts: { expenses: number; income: number }; }
export interface SerieDePatrimoine { from: string; to: string; step: string; today: string; accounts: Omit<ComptePatrimoine, "balance">[]; points: { date: string; balances: number[]; total: number }[]; }
export interface DonneesTransactions { transactions: Record<string, unknown>[]; accounts: Record<string, unknown>[]; }

// Montant arrondi à l'euro, sans centimes ; « -0 € » devient « 0 € ».
export function euros(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  const r = Math.sign(v) * Math.round(Math.abs(v)) || 0;
  return r.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
export function libelleMois(m: string): string {
  if (!/^\d{4}-\d{2}$/.test(m)) return "";
  const l = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T12:00:00Z`));
  return l.charAt(0).toUpperCase() + l.slice(1);
}
export const decalerMois = (m: string, n: number) => { const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo - 1 + n, 1, 12)).toISOString().slice(0, 7); };

// Suivi : dépassements d'abord (du plus fort), puis budgétées par taux de
// consommation, puis sans budget par montant.
export function trierSuivi(l: Suivi[]): Suivi[] {
  const rang = (r: Suivi) => (r.budget > 0 && r.over ? 0 : r.budget > 0 ? 1 : 2);
  const ratio = (r: Suivi) => (r.budget > 0 ? r.actual / r.budget : 0);
  return [...l].sort((a, b) => rang(a) - rang(b)
    || (rang(a) === 0 ? (b.actual - b.budget) - (a.actual - a.budget) : 0)
    || (rang(a) === 1 ? ratio(b) - ratio(a) : 0)
    || b.actual - a.actual || a.category.localeCompare(b.category, "fr"));
}
export const RAISONS: Record<string, string> = { sans_categorie: "Sans catégorie", sous_categorie: "Sous-catégorie à préciser", confiance: "IA peu sûre" };
export const raison = (x: ACategoriser) => { const l = RAISONS[x.reason] || x.reason; return x.reason === "confiance" && x.confidence != null ? `${l} (${Math.round(x.confidence * 100)} %)` : l; };

// Périodes de la synthèse libre (FINANCE_PERIODS, financePeriodRange).
export const PERIODES = [
  { valeur: "month", libelle: "Ce mois" }, { valeur: "previousMonth", libelle: "Mois précédent" }, { valeur: "quarter", libelle: "Ce trimestre" },
  { valeur: "previousQuarter", libelle: "Trimestre précédent" }, { valeur: "year", libelle: "Cette année" }, { valeur: "previousYear", libelle: "Année précédente" },
  { valeur: "week", libelle: "Cette semaine" }, { valeur: "30", libelle: "30 derniers jours" }, { valeur: "90", libelle: "90 derniers jours" },
  { valeur: "365", libelle: "365 derniers jours" }, { valeur: "custom", libelle: "Dates libres" }, { valeur: "all", libelle: "Tout l'historique" },
] as const;
export type Periode = (typeof PERIODES)[number]["valeur"];
const decaler = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const finDeMois = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0, 12)).toISOString().slice(0, 10);
export function bornesPeriode(p: Periode, jour: string, libre: { from?: string; to?: string } = {}): { from: string; to: string } {
  const y = +jour.slice(0, 4); const q = Math.floor((+jour.slice(5, 7) - 1) / 3);
  const trimestre = (an: number, i: number) => { const yy = an + Math.floor(i / 4); const qq = ((i % 4) + 4) % 4; return { from: `${yy}-${String(qq * 3 + 1).padStart(2, "0")}-01`, to: new Date(Date.UTC(yy, qq * 3 + 3, 0, 12)).toISOString().slice(0, 10) }; };
  switch (p) {
    case "quarter": return trimestre(y, q);
    case "previousQuarter": return trimestre(y, q - 1);
    case "previousYear": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    case "week": { const lundi = decaler(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7)); return { from: lundi, to: decaler(lundi, 6) }; }
    case "month": return { from: `${jour.slice(0, 7)}-01`, to: finDeMois(jour.slice(0, 7)) };
    case "previousMonth": { const der = decaler(`${jour.slice(0, 7)}-01`, -1); return { from: `${der.slice(0, 7)}-01`, to: der }; }
    case "year": return { from: `${jour.slice(0, 4)}-01-01`, to: `${jour.slice(0, 4)}-12-31` };
    case "30": case "90": case "365": return { from: decaler(jour, 1 - Number(p)), to: jour };
    case "custom": { const ok = (d?: string) => /^\d{4}-\d{2}-\d{2}$/.test(d || ""); return { from: ok(libre.from) ? libre.from! : "", to: ok(libre.to) ? libre.to! : "" }; }
  }
  return { from: "", to: "" };
}
export function datesPeriode(p?: { from?: string; to?: string }) {
  const d = (x: string) => new Date(`${x}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" });
  return p?.from && p?.to ? (p.from === p.to ? `le ${d(p.from)}` : `du ${d(p.from)} au ${d(p.to)}`) : "";
}

// Barre de répartition du patrimoine (par compte, banque ou type).
export type Regroupement = "account" | "bank" | "type";
export function modeleBarrePatrimoine(comptes: ComptePatrimoine[], par: Regroupement) {
  const g = new Map<string, { cle: string; libelle: string; couleur?: string; valeur: number; comptes: string[] }>();
  comptes.forEach((a) => {
    const cle = par === "bank" ? a.bank : par === "type" ? a.type : a.id;
    const x = g.get(cle) || { cle, libelle: par === "bank" ? a.bank : par === "type" ? a.type : a.name, couleur: par === "bank" ? a.bankColor : par === "type" ? a.typeColor : a.color, valeur: 0, comptes: [] };
    x.valeur += Number(a.balance) || 0; x.comptes.push(a.name); g.set(cle, x);
  });
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const tous = [...g.values()].map((x) => ({ ...x, valeur: r2(x.valeur) })).filter((x) => x.valeur !== 0);
  const positifs = tous.filter((x) => x.valeur > 0).sort((a, b) => b.valeur - a.valeur || a.libelle.localeCompare(b.libelle, "fr"));
  const negatifs = tous.filter((x) => x.valeur < 0).sort((a, b) => a.valeur - b.valeur || a.libelle.localeCompare(b.libelle, "fr"));
  const totalPositif = r2(positifs.reduce((s, x) => s + x.valeur, 0)); const totalNegatif = r2(negatifs.reduce((s, x) => s + x.valeur, 0));
  return { segments: positifs.map((x) => ({ ...x, part: totalPositif ? x.valeur / totalPositif : 0 })), negatifs, totalPositif, totalNegatif, net: r2(totalPositif + totalNegatif) };
}

// Courbe du patrimoine : net par point ; avec un détail, empilement des parts
// positives (ordre : valeur au dernier point) et somme des négatives.
export type Detail = "none" | Regroupement;
export function modeleCourbePatrimoine(serie: SerieDePatrimoine | null, detail: Detail) {
  const comptes = serie?.accounts || []; const points = serie?.points || [];
  const par = detail === "none" ? null : detail;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const cleDe = (a: Omit<ComptePatrimoine, "balance">) => (par === "bank" ? a.bank : par === "type" ? a.type : a.id);
  const meta = new Map<string, { cle: string; libelle: string; couleur?: string }>();
  if (par) comptes.forEach((a) => { const k = cleDe(a); if (!meta.has(k)) meta.set(k, { cle: k, libelle: par === "account" ? a.name : k, couleur: par === "bank" ? a.bankColor : par === "type" ? a.typeColor : a.color }); });
  const lignes = points.map((p) => { const v = new Map<string, number>(); if (par) comptes.forEach((a, i) => v.set(cleDe(a), (v.get(cleDe(a)) || 0) + (Number(p.balances?.[i]) || 0))); return { date: p.date, net: r2(Number(p.total) || 0), v }; });
  const dernier = lignes[lignes.length - 1];
  const groupes = [...meta.values()].map((x) => ({ ...x, dernier: r2(dernier?.v.get(x.cle) || 0) })).sort((a, b) => b.dernier - a.dernier || a.libelle.localeCompare(b.libelle, "fr"));
  const out = lignes.map((l) => {
    let acc = 0;
    const pile = groupes.map((x) => { const v = r2(l.v.get(x.cle) || 0); const bas = acc; if (v > 0) acc += v; return { cle: x.cle, valeur: v, bas: r2(bas), haut: r2(acc) }; });
    return { date: l.date, net: l.net, pile, positif: r2(acc), negatif: r2(pile.filter((x) => x.valeur < 0).reduce((t, x) => t + x.valeur, 0)) };
  });
  const valeurs = out.flatMap((p) => (groupes.length ? [p.net, p.positif, p.negatif] : [p.net]));
  return { groupes, points: out, min: valeurs.length ? Math.min(...valeurs) : 0, max: valeurs.length ? Math.max(...valeurs) : 0 };
}
// Graduations rondes couvrant [min, max], zéro compris.
export function graduationsMontant(min: number, max: number, n = 4) {
  const lo0 = Math.min(0, min); const hi0 = Math.max(0, max);
  if (!(hi0 > lo0)) return { min: 0, max: 1, traits: [0, 1] };
  const brut = (hi0 - lo0) / n; const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= brut)!;
  const lo = Math.floor(lo0 / pas) * pas; const hi = Math.ceil(hi0 / pas) * pas;
  const traits: number[] = []; for (let v = lo; v <= hi + pas / 2; v += pas) traits.push(Math.round(v * 100) / 100);
  return { min: lo, max: hi, traits };
}

// Messages (financeBudgetError) : l'erreur technique n'est jamais affichée seule.
export function messageFinance(code: string): string {
  const m: Record<string, string> = {
    configuration_missing: "Configuration serveur incomplète sur nexora-futur.", unauthorized: "Session expirée : reconnecte-toi.",
    finance_configuration_missing: "Budget indisponible : configuration KDM360 absente côté nexora-project.", finance_read_failed: "Lecture du budget impossible (KDM360).",
    finance_relay_failed: "nexora-project ne répond pas : réessaie dans un instant.", invalid_month: "Mois invalide.", invalid_period: "Période invalide.",
    too_many_points: "Trop de points : choisis un pas plus large.", transaction_not_found: "Opération introuvable : elle a peut-être été modifiée ailleurs.",
    category_not_found: "Catégorie inconnue ou inactive.", subcategory_not_found_for_category: "Sous-catégorie inconnue pour cette catégorie.",
    finance_write_failed: "Catégorisation non enregistrée (KDM360).", idempotency_key_required: "Requête incomplète.",
  };
  return m[code] || `Erreur Budget : ${code}`;
}
