// Devis, Factures, Finance PRO (Ref #659, lot 6b) : LECTURE seule des clés
// Firestore (nexora:quotes, nexora:invoices, nexora:pro*). Port des fonctions
// pures de nexora-project : NEXORA:QUOTES (part-000:4038-4196) et
// NEXORA:FINANCEPRO-CORE (part-003:34346-34800). Franchise en base : HT = TTC.

export interface LigneDevis { id?: string; kind?: "forfait" | "regie"; description?: string; amount?: number; quantity?: number; unit?: string; unitRate?: number; }
export interface Devis { id: string; number?: string; status?: string; clientId?: string; title?: string; issueDate?: string; validUntil?: string; lines?: LigneDevis[]; }
export interface Facture { id: string; number?: string; quoteId?: string; clientId?: string; title?: string; issueDate?: string; dueDate?: string; lines?: LigneDevis[]; status?: string; paidAt?: string; creditNoteOf?: string; }
export interface Client { id: string; name?: string; company?: string; }
export interface LigneFacturation { id: string; missionId?: string; type?: string; libelle?: string; montantPrevu?: number; dateCible?: string; statut?: string; archivedAt?: string | null; }
export interface Paiement { id: string; billingScheduleId?: string; montant?: number; date?: string; statutRapprochement?: string; archivedAt?: string | null; }
export interface TempsPro { id: string; billable?: boolean; status?: string; durationMinutes?: number; rateApplied?: number; rateType?: string; missionId?: string; archivedAt?: string | null; }
export interface DepensePro { id: string; refacturable?: boolean; statutRemboursement?: string; montantTTC?: number; missionId?: string; archivedAt?: string | null; }
export interface MissionPro { id: string; clientId?: string; projectId?: string; billingMode?: string; status?: string; soldDayRate?: number; soldHourlyRate?: number; archivedAt?: string | null; }
export interface ReglagesPro { tresorerieDisponible?: number; tauxProvisionSocialesFiscales?: number | null; }

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const actifs = <T extends { archivedAt?: string | null }>(l: T[] | undefined) => (l || []).filter((x) => x && !x.archivedAt);

export const STATUTS_DEVIS: Record<string, string> = { draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", refused: "Refusé", expired: "Expiré" };
export const STATUTS_FACTURE: Record<string, string> = { issued: "Émise", paid: "Payée", cancelled: "Annulée", late: "En retard" };
export const STATUTS_LIGNE: Record<string, string> = { prevu: "Prévu", a_facturer: "À facturer", facture: "Facturée", encaisse: "Encaissée", annule: "Annulée" };

export const montantLigne = (l?: LigneDevis) => (!l ? 0 : l.kind === "regie" ? n(l.quantity) * n(l.unitRate) : n(l.amount));
export const totalDevis = (d?: { lines?: LigneDevis[] }) => (d?.lines || []).reduce((s, l) => s + montantLigne(l), 0);
// « Expiré » et « En retard » sont calculés à l'affichage, jamais stockés.
export const statutDevis = (d: Devis, jour: string) => (d.status === "sent" && d.validUntil && d.validUntil < jour ? "expired" : d.status || "draft");
export const statutFacture = (f: Facture, jour: string) => (f.status === "issued" && f.dueDate && f.dueDate < jour ? "late" : f.status || "issued");
export const euros2 = (v: number) => `${n(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} €`;

export const caSigne = (devis: Devis[]) => devis.filter((q) => q?.status === "accepted").reduce((s, q) => s + totalDevis(q), 0);
export const caPlanifie = (l: LigneFacturation[]) => actifs(l).filter((x) => x.statut === "prevu" || x.statut === "a_facturer").reduce((s, x) => s + n(x.montantPrevu), 0);
export const caFacture = (l: LigneFacturation[]) => actifs(l).filter((x) => x.statut === "facture" || x.statut === "encaisse" || x.type === "avoir").reduce((s, x) => s + n(x.montantPrevu), 0);
export const caEncaisse = (p: Paiement[]) => actifs(p).filter((x) => x.statutRapprochement === "rapproche").reduce((s, x) => s + n(x.montant), 0);
export function travailNonFacture(temps: TempsPro[], depenses: DepensePro[]) {
  const t = actifs(temps).filter((x) => x.billable && x.status !== "facturee").reduce((s, x) => { const h = n(x.durationMinutes) / 60; return s + (x.rateType === "journalier" ? (h / 8) * n(x.rateApplied) : h * n(x.rateApplied)); }, 0);
  return t + actifs(depenses).filter((e) => e.refacturable && e.statutRemboursement === "a_refacturer").reduce((s, e) => s + n(e.montantTTC), 0);
}
export const facturesEnRetard = (l: LigneFacturation[], jour: string) => actifs(l).filter((x) => (x.statut === "a_facturer" || x.statut === "facture") && !!x.dateCible && x.dateCible < jour);
export const caEncaisseAnnee = (p: Paiement[], annee: number) => actifs(p).filter((x) => x.statutRapprochement === "rapproche" && (x.date || "").startsWith(String(annee))).reduce((s, x) => s + n(x.montant), 0);
export function seuilTva(ca: number, base = 37500, majore = 41250) {
  const ratio = base ? ca / base : 0;
  return { ca, base, majore, ratio, statut: ca >= majore ? "depasse_majore" : ca >= base ? "depasse_base" : ratio >= 0.8 ? "proche" : "ok" };
}
export function tresoreriePrevisionnelle(r: ReglagesPro, l: LigneFacturation[], jours: number, jour: string) {
  const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + jours); const limite = d.toISOString().slice(0, 10);
  const attendus = actifs(l).filter((x) => (x.statut === "prevu" || x.statut === "a_facturer") && !!x.dateCible && x.dateCible <= limite).reduce((s, x) => s + n(x.montantPrevu), 0);
  const provisions = r.tauxProvisionSocialesFiscales == null ? 0 : attendus * Number(r.tauxProvisionSocialesFiscales);
  return n(r.tresorerieDisponible) + attendus - provisions;
}
// Échéances de facturation (WidgetFinanceProEcheances) : lignes actives hors
// encaissées et annulées, avec date cible, triées, 8 au plus.
export const echeancesFacturation = (l: LigneFacturation[], max = 8) => actifs(l).filter((x) => x.statut !== "encaisse" && x.statut !== "annule" && !!x.dateCible).sort((a, b) => (a.dateCible || "").localeCompare(b.dateCible || "")).slice(0, max);

// Burn rate d'un projet : port exact de calculateBudgetBurnRate
// (part-003:19500) — montants signés, date de la dépense, semaines au dixième.
export function burnRate(budgetActuel: number, depenses: { amount?: number | string; date?: string }[], jour: string) {
  const total = depenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const reste = budgetActuel - total;
  const pct = budgetActuel > 0 ? Math.round((total / budgetActuel) * 100) : 0;
  const dates = depenses.map((e) => e.date).filter((d): d is string => !!d).sort();
  if (!dates.length) return { statut: "sansDates" as const, budgetActuel, total, reste, pct };
  const jours = Math.max(1, Math.round((Date.parse(`${jour}T00:00:00Z`) - Date.parse(`${dates[0]}T00:00:00Z`)) / 86400000));
  const journalier = total / jours;
  const semainesRestantes = journalier > 0 ? Math.round((reste / journalier / 7) * 10) / 10 : null;
  const sante = reste < 0 ? "over" : semainesRestantes !== null && semainesRestantes < 4 ? "risk" : "ok";
  return { statut: "pret" as const, budgetActuel, total, reste, pct, journalier, hebdomadaire: journalier * 7, semainesRestantes, sante, jours };
}
