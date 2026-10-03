// Période de l'onglet Argent › Période (#690, retour du 03/10/2026) : boutons
// rapides (ce mois, mois précédent, cette semaine, cette année) ou dates
// libres ; toutes les informations de l'onglet sont filtrées sur ces dates.
// Les calculs sont ceux de Nexora (lib/finance-budget.mjs, copié tel quel) ;
// seule adaptation : sur une période qui ne couvre qu'une partie d'un mois,
// le budget de ce mois est compté au prorata des jours.
import { budgetCharts, budgetTracking, expensesOf, incomeOf, monthBounds, normalizeBudget, sumAbs, type DonneesBudgetNexora, type PeriodeNexora } from "../nexora/finance-budget.mjs";
import { ajouterJours, ecartJours } from "./modele";
import type { Suivi } from "./finance";

import { CHOIX_PERIODE_ARGENT } from "./prefs";
export const CHOIX_PERIODE = CHOIX_PERIODE_ARGENT;
export type ChoixPeriode = (typeof CHOIX_PERIODE)[number];
export const LIB_PERIODE: Record<ChoixPeriode, string> = { mois: "Ce mois", "mois-prec": "Mois précédent", semaine: "Cette semaine", annee: "Cette année", perso: "Dates…" };
export interface Periode { from: string; to: string; }

const finDuMois = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0, 12)).toISOString().slice(0, 10);
export function bornes(choix: ChoixPeriode, jour: string, perso?: Periode): Periode {
  if (choix === "mois-prec") { const d = ajouterJours(`${jour.slice(0, 7)}-01`, -1); return { from: `${d.slice(0, 7)}-01`, to: d }; }
  if (choix === "semaine") { const dow = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7; const lundi = ajouterJours(jour, -dow); return { from: lundi, to: ajouterJours(lundi, 6) }; }
  if (choix === "annee") return { from: `${jour.slice(0, 4)}-01-01`, to: `${jour.slice(0, 4)}-12-31` };
  if (choix === "perso" && perso && perso.from <= perso.to) return perso;
  return { from: `${jour.slice(0, 7)}-01`, to: finDuMois(jour.slice(0, 7)) };
}
// Même durée, juste avant ou après (mois et années restent calendaires).
export function decaler(p: Periode, sens: -1 | 1): Periode {
  const moisEntier = p.from.slice(8) === "01" && p.to === finDuMois(p.to.slice(0, 7));
  if (moisEntier) {
    const n = (+p.to.slice(0, 4) - +p.from.slice(0, 4)) * 12 + (+p.to.slice(5, 7) - +p.from.slice(5, 7)) + 1;
    const d = new Date(Date.UTC(+p.from.slice(0, 4), +p.from.slice(5, 7) - 1 + sens * n, 1, 12)).toISOString().slice(0, 10);
    const f = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1 + n, 0, 12)).toISOString().slice(0, 10);
    return { from: d, to: f };
  }
  const n = ecartJours(p.from, p.to) + 1;
  return { from: ajouterJours(p.from, sens * n), to: ajouterJours(p.to, sens * n) };
}
export const joursDe = (p: Periode) => ecartJours(p.from, p.to) + 1;
// Mois touchés par la période, avec la part de jours couverte.
export function moisCouverts(p: Periode): { mois: string; part: number }[] {
  const r: { mois: string; part: number }[] = [];
  for (let m = p.from.slice(0, 7); m <= p.to.slice(0, 7); m = ajouterJours(`${finDuMois(m)}`, 1).slice(0, 7)) {
    const a = `${m}-01` > p.from ? `${m}-01` : p.from, b = finDuMois(m) < p.to ? finDuMois(m) : p.to;
    r.push({ mois: m, part: (ecartJours(a, b) + 1) / (ecartJours(`${m}-01`, finDuMois(m)) + 1) });
  }
  return r;
}

export interface SynthesePeriode {
  periode: Periode; totals: { expenses: number; income: number; net: number; budget: number; remaining: number };
  tracking: Suivi[]; charts: Record<string, unknown>;
}
const arrondi = (n: number) => Math.round(n * 100) / 100;
// `brut` : tables de transactions-data (toutes colonnes) complétées des
// catalogues de sankey-data (comptes, catégories, banques, types, soldes).
export function synthesePeriode(brut: unknown, p: Periode): SynthesePeriode {
  const data: DonneesBudgetNexora = normalizeBudget(brut);
  const budgets = new Map<string, number>();
  moisCouverts(p).forEach(({ mois, part }) => budgetTracking(data, monthBounds(mois)).forEach((c) => budgets.set(c.category, (budgets.get(c.category) || 0) + c.budget * part)));
  const periode: PeriodeNexora = { from: p.from, to: p.to };
  const tracking: Suivi[] = budgetTracking(data, periode).map((c) => { const budget = arrondi(budgets.get(c.category) || 0); return { ...c, budget, remaining: arrondi(budget - c.actual), over: c.actual > budget }; });
  const charts = budgetCharts(data, periode, tracking);
  const lignes = data.transactions.filter((t) => t.effectiveDate >= p.from && t.effectiveDate <= p.to);
  const expenses = arrondi(sumAbs(expensesOf(lignes))), income = arrondi(sumAbs(incomeOf(lignes)));
  const budget = arrondi(tracking.filter((c) => c.budget > 0).reduce((s, c) => s + c.budget, 0));
  return { periode: p, totals: { expenses, income, net: arrondi(income - expenses), budget, remaining: arrondi(budget - expenses) }, tracking, charts };
}
