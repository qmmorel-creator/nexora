// Graphiques budget (Ref #659, lot 6b). Port de NEXORA:FINANCE-BUDGET-CUMUL
// (financeCumulModel, part-003:38298) et des graphes Sankey
// (financeSankeyNormalize, -MonthlyGraph, -WealthGraph, part-003:35931-36075).
// La MISE EN PAGE du Sankey est propre à Futur : colonnes proportionnelles,
// nœuds dans l'ordre du graphe (sans l'optimisation des croisements).

export interface Graphes {
  days: string[]; byCategory: { category: string; amount: number; color: string }[];
  waterfall: { label: string; from: number; to: number; absolute?: boolean }[];
  cumulative: { category: string; color: string; total: number; budget: number; values: number[] }[];
  incomeCumulative: number[]; budgetTotal: number;
  waffle: { unit: number; categories: { name: string; value: number; count: number; cells: { account: string; color: string; share: number }[] }[] };
  periodic: { month: string; expenses: number; categories: { category: string; amount: number; color: string }[] }[];
}

export const MODES_CUMUL = [
  { cle: "categories", libelle: "Par catégorie (aires empilées)" }, { cle: "budget", libelle: "Face au budget" },
  { cle: "trajectories", libelle: "Trajectoires par catégorie" }, { cle: "multiples", libelle: "Petits multiples avec budget" }, { cle: "daily", libelle: "Cumul + dépenses du jour" },
] as const;
export type ModeCumul = (typeof MODES_CUMUL)[number]["cle"];
// Palette validée pour le daltonisme (nexora-project), puis « Autres » en gris.
export const PALETTE_CUMUL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
export const AUTRES_CUMUL = "#a3a7ad";
const r2 = (v: number) => Math.round(v * 100) / 100;

export function modeleCumul(c: Graphes | undefined) {
  const days = c?.days || []; const cumulative = c?.cumulative || [];
  const totaux = new Map<string, number>();
  (c?.periodic || []).forEach((m) => (m.categories || []).forEach((x) => totaux.set(x.category, (totaux.get(x.category) || 0) + x.amount)));
  cumulative.forEach((s) => { if (!totaux.has(s.category)) totaux.set(s.category, s.total); });
  const rang = [...totaux].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([k]) => k);
  const top = rang.slice(0, PALETTE_CUMUL.length);
  const parJour = (v: number[]) => v.map((x, i) => r2(x - (i ? v[i - 1] : 0)));
  const series: { categorie: string; couleur: string; valeurs: number[]; jour: number[]; total: number; budget: number; membres: string[]; autres?: boolean }[] = [];
  top.forEach((nom, i) => { const s = cumulative.find((x) => x.category === nom); if (s && s.total > 0) series.push({ categorie: nom, couleur: PALETTE_CUMUL[i], valeurs: s.values, jour: parJour(s.values), total: s.total, budget: s.budget || 0, membres: [nom] }); });
  const reste = cumulative.filter((s) => !top.includes(s.category) && s.total > 0);
  if (reste.length) {
    const v = days.map((_, k) => r2(reste.reduce((t, s) => t + (s.values[k] || 0), 0)));
    series.push({ categorie: "Autres", couleur: AUTRES_CUMUL, autres: true, valeurs: v, jour: parJour(v), total: r2(reste.reduce((t, s) => t + s.total, 0)), budget: r2(reste.reduce((t, s) => t + (s.budget || 0), 0)), membres: reste.map((s) => s.category) });
  }
  const total = days.map((_, k) => r2(series.reduce((t, s) => t + (s.valeurs[k] || 0), 0)));
  const budgetTotal = c?.budgetTotal || 0;
  const rythme = days.map((_, k) => (budgetTotal > 0 ? r2((budgetTotal * (k + 1)) / days.length) : 0));
  return { days, series, total, revenus: days.map((_, k) => c?.incomeCumulative?.[k] || 0), budgetTotal, rythme, jourDepassement: budgetTotal > 0 ? total.findIndex((v) => v > budgetTotal) : -1, totalJour: parJour(total), depense: total.length ? total[total.length - 1] : 0 };
}

// --- Sankey -----------------------------------------------------------------
type Brut = Record<string, unknown>;
interface TxS { id: string; date: string; amount: number; type: string; accountId: string; category: string; subcategory: string; }
export interface DonneesSankey { ledger: TxS[]; transactions: TxS[]; accounts: { id: string; name: string; bank: string; type: string; opening: number; color: string }[]; categories: { name: string; color: string }[]; banks: { name: string; color: string }[]; accountTypes: { name: string; color: string }[]; balances: { accountId: string; date: string; balance: number }[]; }
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const couleur = (v: unknown, d = "#536477") => (typeof v === "string" && /^#[0-9a-f]{3,8}$/i.test(v.trim()) ? v.trim() : d);
// Une transaction sans identifiant ou sans date valide refuse TOUT le jeu :
// un graphique calculé sur un résultat partiel serait faux sans le dire.
export function normaliserSankey(raw: unknown): DonneesSankey {
  const r = (raw || {}) as Record<string, unknown>;
  const lignes = (k: string): Brut[] => { if (!Array.isArray(r[k])) throw new Error("Réponse Budget invalide."); return (r[k] as unknown[]).map((x) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Brut) : {})); };
  const texte = (x: Brut, k: string, d = "") => (typeof x[k] === "string" ? (x[k] as string) : d);
  const montant = (v: unknown) => { if (v == null || v === "") return 0; const n = Number(v); if (!Number.isFinite(n)) throw new Error("Montant Budget invalide."); return n; };
  const tx = lignes("transactions");
  const annulees = new Set(tx.map((x) => x.cancels_transaction_id).filter(Boolean));
  const vers = (x: Brut): TxS => {
    const date = texte(x, "effective_date"); const banque = texte(x, "bank_date", date);
    if (!DATE.test(date) || !DATE.test(banque) || !x.transaction_id) throw new Error("Transaction reçue sans identifiant ou dates valides.");
    return { id: String(x.transaction_id), date, amount: montant(x.signed_amount), type: texte(x, "transaction_type"), accountId: texte(x, "account_id"), category: texte(x, "category", "À classer"), subcategory: texte(x, "subcategory") };
  };
  return {
    ledger: tx.filter((x) => !["Budget", "Annulation", "Ouverture"].includes(texte(x, "transaction_type")) && !annulees.has(x.transaction_id)).map(vers),
    transactions: tx.filter((x) => !annulees.has(x.transaction_id)).map(vers),
    accounts: lignes("accounts").filter((x) => x.active !== false).map((x) => ({ id: texte(x, "account_id"), name: texte(x, "name"), bank: texte(x, "bank"), type: texte(x, "account_type"), opening: montant(x.opening_balance), color: couleur(x.color) })),
    categories: lignes("categories").map((x) => ({ name: texte(x, "category"), color: couleur(x.color) })),
    banks: lignes("banks").map((x) => ({ name: texte(x, "name"), color: couleur(x.color) })),
    accountTypes: lignes("accountTypes").map((x) => ({ name: texte(x, "name"), color: couleur(x.color) })),
    balances: lignes("balances").map((x) => ({ accountId: texte(x, "account_id"), date: texte(x, "as_of_date") || texte(x, "balance_date") || texte(x, "date"), balance: montant(x.balance) })),
  };
}
export interface Noeud { id: string; nom: string; col: number; ordre: number; couleur: string; }
export interface Lien { source: string; cible: string; valeur: number; }
const somme = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
const PALETTE_REVENUS = ["#1f7a52", "#2f9e6f", "#5bb98c", "#89cfa9"];

// Flux du mois : revenus → comptes → catégories de dépenses.
export function grapheMensuel(d: DonneesSankey, periode: { from: string; to: string }) {
  const flux = d.transactions.filter((t) => t.date >= periode.from && t.date <= periode.to && t.amount !== 0 && ["Dépense", "Revenu", "Remboursement"].includes(t.type) && t.category !== "Transferts internes" && t.category !== "Ajustement");
  const comptes = d.accounts.filter((a) => flux.some((t) => t.accountId === a.id)).sort((a, b) => somme(flux.filter((t) => t.accountId === b.id), (t) => Math.abs(t.amount)) - somme(flux.filter((t) => t.accountId === a.id), (t) => Math.abs(t.amount)) || a.name.localeCompare(b.name, "fr"));
  const rangCompte = new Map(comptes.map((a, i) => [a.id, i]));
  const revenus = flux.filter((t) => t.type === "Revenu" || t.type === "Remboursement"); const depenses = flux.filter((t) => t.type === "Dépense");
  const cleRevenu = (t: TxS) => t.subcategory || t.type;
  const ordonner = (l: TxS[], cle: (t: TxS) => string, val: (t: TxS) => number) => [...new Set(l.map(cle))].sort((a, b) => {
    const premier = (k: string) => Math.min(...l.filter((t) => cle(t) === k).map((t) => rangCompte.get(t.accountId) ?? 999));
    return premier(a) - premier(b) || somme(l.filter((t) => cle(t) === b), val) - somme(l.filter((t) => cle(t) === a), val) || a.localeCompare(b, "fr");
  });
  const clesRevenus = ordonner(revenus, cleRevenu, (t) => Math.max(0, t.amount));
  const clesCategories = ordonner(depenses, (t) => t.category, (t) => Math.abs(t.amount));
  const noeuds: Noeud[] = [
    ...clesRevenus.map((nom, i) => ({ id: `income:${nom}`, nom, col: 0, ordre: i, couleur: PALETTE_REVENUS[i % PALETTE_REVENUS.length] })),
    ...comptes.map((a, i) => ({ id: `account:${a.id}`, nom: a.name, col: 1, ordre: i, couleur: a.color })),
    ...clesCategories.map((nom, i) => ({ id: `category:${nom}`, nom, col: 2, ordre: i, couleur: couleur(d.categories.find((c) => c.name === nom)?.color, "#587894") })),
  ];
  const liens: Lien[] = [];
  comptes.forEach((a) => {
    const propres = flux.filter((t) => t.accountId === a.id);
    clesRevenus.forEach((k) => { const v = somme(propres.filter((t) => t.type !== "Dépense" && cleRevenu(t) === k), (t) => Math.max(0, t.amount)); if (v > 0.005) liens.push({ source: `income:${k}`, cible: `account:${a.id}`, valeur: v }); });
    clesCategories.forEach((k) => { const v = somme(propres.filter((t) => t.type === "Dépense" && t.category === k), (t) => Math.abs(t.amount)); if (v > 0.005) liens.push({ source: `account:${a.id}`, cible: `category:${k}`, valeur: v }); });
  });
  return { noeuds, liens, colonnes: ["Origine", "Comptes", "Destination"] };
}

// Soldes à une date : dernier relevé connu puis mouvements postérieurs du
// grand livre (date bornée à aujourd'hui, UTC comme l'original).
export function soldesComptes(d: DonneesSankey, date: string, maintenant = new Date()) {
  const auj = maintenant.toISOString().slice(0, 10); const jusque = date > auj ? auj : date;
  return d.accounts.map((a) => {
    const releve = d.balances.filter((b) => b.accountId === a.id && b.date <= jusque).sort((x, y) => y.date.localeCompare(x.date))[0];
    const apres = releve?.date || "";
    return { ...a, solde: (releve ? releve.balance : a.opening) + somme(d.ledger.filter((t) => t.accountId === a.id && t.date > apres && t.date <= jusque), (t) => t.amount) };
  });
}
// Structure du patrimoine : type de compte → banque → compte (soldes > 0).
export function graphePatrimoine(d: DonneesSankey, date: string, maintenant = new Date()) {
  const comptes = soldesComptes(d, date, maintenant).filter((a) => a.solde > 0);
  const types = [...new Set(comptes.map((a) => a.type))]; const banques = [...new Set(comptes.map((a) => a.bank))];
  const noeuds: Noeud[] = [
    ...types.map((nom, i) => ({ id: `type:${nom}`, nom, col: 0, ordre: i, couleur: couleur(d.accountTypes.find((t) => t.name === nom)?.color, ["#607d9b", "#3f806f"][i % 2]) })),
    ...banques.map((nom, i) => ({ id: `bank:${nom}`, nom, col: 1, ordre: i, couleur: couleur(d.banks.find((b) => b.name === nom)?.color, ["#256d85", "#cf7856", "#73927e"][i % 3]) })),
    ...comptes.map((a, i) => ({ id: `account:${a.id}`, nom: a.name, col: 2, ordre: i, couleur: a.color })),
  ];
  const liens: Lien[] = [];
  types.forEach((t) => banques.forEach((b) => { const v = somme(comptes.filter((a) => a.type === t && a.bank === b), (a) => a.solde); if (v > 0) liens.push({ source: `type:${t}`, cible: `bank:${b}`, valeur: v }); }));
  comptes.forEach((a) => liens.push({ source: `bank:${a.bank}`, cible: `account:${a.id}`, valeur: a.solde }));
  return { noeuds, liens, colonnes: ["Type", "Banque", "Compte"] };
}

// Mise en page : hauteur d'un nœud ∝ max(entrées, sorties) ; liens empilés
// dans l'ordre des nœuds opposés.
export function disposerSankey(g: { noeuds: Noeud[]; liens: Lien[] }, largeur: number, hauteur: number, ecart = 10, epaisseur = 14) {
  const val = (id: string) => Math.max(somme(g.liens.filter((l) => l.cible === id), (l) => l.valeur), somme(g.liens.filter((l) => l.source === id), (l) => l.valeur));
  const cols = [0, 1, 2].map((c) => g.noeuds.filter((n) => n.col === c).sort((a, b) => a.ordre - b.ordre));
  const echelle = Math.min(...cols.filter((c) => c.length).map((c) => (hauteur - ecart * (c.length - 1)) / Math.max(1e-9, somme(c, (n) => val(n.id)))));
  const pos = new Map<string, { x: number; y: number; h: number; sortie: number; entree: number }>();
  cols.forEach((c, k) => { let y = 0; c.forEach((n) => { const h = Math.max(2, val(n.id) * echelle); pos.set(n.id, { x: (k * (largeur - epaisseur)) / 2, y, h, sortie: 0, entree: 0 }); y += h + ecart; }); });
  const ordre = (id: string) => g.noeuds.find((n) => n.id === id)?.ordre ?? 0;
  const liens = [...g.liens].sort((a, b) => ordre(a.source) - ordre(b.source) || ordre(a.cible) - ordre(b.cible)).map((l) => {
    const s = pos.get(l.source)!; const c = pos.get(l.cible)!; const e = l.valeur * echelle;
    const y0 = s.y + s.sortie + e / 2; const y1 = c.y + c.entree + e / 2; s.sortie += e; c.entree += e;
    const x0 = s.x + epaisseur; const x1 = c.x; const xm = (x0 + x1) / 2;
    return { ...l, epaisseur: Math.max(1, e), chemin: `M${x0},${y0} C${xm},${y0} ${xm},${y1} ${x1},${y1}` };
  });
  return { noeuds: g.noeuds.map((n) => ({ ...n, ...pos.get(n.id)!, valeur: val(n.id) })), liens, epaisseur };
}
