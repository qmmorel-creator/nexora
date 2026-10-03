// Fil du jour (Ref #656) : fonctions pures sur les tâches d'une journée.
import { ajouterJours, aujourdhuiParis, ecartJours, estEnRetard, estProjetCalendrier, estReunion, estTerminee, statutImpose, type Catalogues, type Tache } from "./modele";

export type ModeJour = "matin" | "journee" | "soir" | "semaine";
export const modeParHeure = (h: number): ModeJour => (h < 11 ? "matin" : h >= 19 ? "soir" : "journee");
export const minutes = (hhmm?: string) => { const m = /^(\d{2}):(\d{2})$/.exec(hhmm || ""); return m ? +m[1] * 60 + +m[2] : null; };
export const heureParis = (d = new Date()) => { const [h, m] = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).split(":").map(Number); return h * 60 + m; };

const couvre = (t: Tache, jour: string) => !!t.start && !!t.end && t.start <= jour && jour <= t.end;

export interface Evenement { t: Tache; debut: number; fin: number; colonne: number; colonnes: number; }

// Tâches horaires du jour, avec répartition en colonnes quand elles se chevauchent.
export function evenementsDuJour(taches: Tache[], jour: string): Evenement[] {
  const ev = taches.filter((t) => couvre(t, jour) && minutes(t.startTime) !== null).map((t) => {
    const debut = minutes(t.startTime)!; const f = minutes(t.endTime);
    return { t, debut, fin: f !== null && f > debut ? f : Math.min(debut + 60, 24 * 60 - 1), colonne: 0, colonnes: 1 };
  }).sort((a, b) => a.debut - b.debut || b.fin - a.fin);
  // Groupes de chevauchement, puis première colonne libre.
  let groupe: Evenement[] = []; let finGroupe = -1;
  const clore = () => { const n = Math.max(1, ...groupe.map((e) => e.colonne + 1)); groupe.forEach((e) => { e.colonnes = n; }); groupe = []; };
  for (const e of ev) {
    if (e.debut >= finGroupe) { clore(); finGroupe = -1; }
    const prises = new Set(groupe.filter((g) => g.fin > e.debut).map((g) => g.colonne));
    let c = 0; while (prises.has(c)) c++;
    e.colonne = c; groupe.push(e); finGroupe = Math.max(finGroupe, e.fin);
  }
  clore();
  return ev;
}

export function echeancesDuJour(taches: Tache[], jour: string, cat: Catalogues): Tache[] {
  return taches.filter((t) => t.end === jour && minutes(t.startTime) === null && !estTerminee(t, cat.statuts));
}

// À caser : échéances du jour sans heure et retards, hors calendriers et
// types à statut imposé ; les plus en retard d'abord.
export function aCaser(taches: Tache[], jour: string, cat: Catalogues, max = 12): Tache[] {
  return taches.filter((t) => !estTerminee(t, cat.statuts) && !!t.end && t.end <= jour && minutes(t.startTime) === null
    && !estProjetCalendrier(cat.projets, t.projectId) && !statutImpose(cat.types, cat.statuts, t.taskTypeId))
    .sort((a, b) => (a.end || "").localeCompare(b.end || "") || (a.title || "").localeCompare(b.title || "")).slice(0, max);
}

export interface JourHorizon { jour: string; elements: Tache[]; }
export function horizon(taches: Tache[], jour: string, cat: Catalogues, n = 14): JourHorizon[] {
  return Array.from({ length: n }, (_, i) => {
    const j = ajouterJours(jour, i);
    return { jour: j, elements: taches.filter((t) => t.end === j && !estTerminee(t, cat.statuts) && (t.milestone || t.start === t.end || !statutImpose(cat.types, cat.statuts, t.taskTypeId))) };
  });
}

export function termineesLe(taches: Tache[], jour: string, cat: Catalogues): Tache[] {
  return taches.filter((t) => estTerminee(t, cat.statuts) && !!t.completedAt && aujourdhuiParis(new Date(t.completedAt)) === jour);
}
export function glissent(taches: Tache[], jour: string, cat: Catalogues): Tache[] {
  return taches.filter((t) => t.end === jour && !estTerminee(t, cat.statuts) && !estProjetCalendrier(cat.projets, t.projectId));
}

export interface Point { genre: "retard" | "compte-rendu" | "focus"; t: Tache; texte: string; }
export function pointsAttention(taches: Tache[], jour: string, cat: Catalogues): Point[] {
  const p: Point[] = [];
  taches.filter((t) => estEnRetard(t, cat.statuts, jour) && !estProjetCalendrier(cat.projets, t.projectId))
    .sort((a, b) => (a.end || "").localeCompare(b.end || "")).slice(0, 3)
    .forEach((t) => p.push({ genre: "retard", t, texte: `${ecartJours(t.end!, jour)} j de retard` }));
  taches.filter((t) => estReunion(t, cat.types) && !!t.end && t.end < jour && t.end >= ajouterJours(jour, -14) && !(t.meetingReport || "").trim())
    .sort((a, b) => (b.end || "").localeCompare(a.end || "")).slice(0, 2)
    .forEach((t) => p.push({ genre: "compte-rendu", t, texte: "réunion sans compte rendu" }));
  taches.filter((t) => t.focus === true && !estTerminee(t, cat.statuts)).slice(0, 2)
    .forEach((t) => p.push({ genre: "focus", t, texte: "en focus" }));
  return p;
}

export interface Habitude { id: string; name: string; color?: string; kind?: "check" | "numeric"; min?: number; max?: number; }
export interface ThemeHabitudes { id: string; name: string; color?: string; habits?: Habitude[]; }
export interface EntreeHabitude { habitId: string; date: string; value?: number; }
export function habitudesDuJour(themes: ThemeHabitudes[], journal: EntreeHabitude[], jour: string) {
  const du = new Map(journal.filter((e) => e.date === jour).map((e) => [e.habitId, e]));
  return themes.filter((t) => t.habits?.length).map((t) => ({
    theme: t, habitudes: (t.habits || []).map((h) => ({ h, fait: du.has(h.id), valeur: du.get(h.id)?.value })),
  }));
}
