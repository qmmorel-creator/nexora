// Page projet et espaces (Ref #657) : fonctions pures.
import { ajouterJours, ecartJours, estEnRetard, estReunion, estTerminee, type Catalogues, type Tache } from "./modele";
import { etatsDuJour, type ThemeHabitudes } from "./habitudes";

const duProjet = (t: Tache, id: string) => t.projectId === id || t.secondaryProjectId === id;

export interface Sante { total: number; ouvertes: number; terminees: number; retards: number; avancement: number; prochaine?: Tache; jalon?: Tache; }
export function santeProjet(taches: Tache[], id: string, cat: Catalogues, jour: string): Sante {
  const ts = taches.filter((t) => duProjet(t, id));
  const ouvertes = ts.filter((t) => !estTerminee(t, cat.statuts));
  const avancement = ts.length ? Math.round(ts.reduce((a, t) => a + (estTerminee(t, cat.statuts) ? 100 : Number(t.progress ?? 0)), 0) / ts.length) : 0;
  const futures = ouvertes.filter((t) => t.end && t.end >= jour).sort((a, b) => (a.end || "").localeCompare(b.end || ""));
  return { total: ts.length, ouvertes: ouvertes.length, terminees: ts.length - ouvertes.length, retards: ouvertes.filter((t) => estEnRetard(t, cat.statuts, jour)).length, avancement, prochaine: futures[0], jalon: futures.find((t) => t.milestone) };
}

export function prochainesEtapes(taches: Tache[], id: string, cat: Catalogues, n = 8): Tache[] {
  return taches.filter((t) => duProjet(t, id) && !estTerminee(t, cat.statuts)).sort((a, b) => (a.end || "9999").localeCompare(b.end || "9999") || (a.title || "").localeCompare(b.title || "")).slice(0, n);
}

export interface BarreFrise { t: Tache; debut: number; fin: number; retard: boolean; }
// Fenêtre de 12 semaines (4 passées, 8 à venir), en jours depuis le début.
// Une tâche OUVERTE finie avant la fenêtre est en retard : elle est épinglée
// au bord gauche plutôt qu'oubliée.
export function friseProjet(taches: Tache[], id: string, cat: Catalogues, jour: string) {
  const debut = ajouterJours(jour, -28); const fin = ajouterJours(jour, 56);
  const barres: BarreFrise[] = taches.filter((t) => {
    if (!duProjet(t, id) || !t.start || !t.end || t.start > fin) return false;
    const ouverte = !estTerminee(t, cat.statuts);
    return ouverte ? true : t.end >= debut && t.end >= jour;
  }).sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    .map((t) => {
      const retard = estEnRetard(t, cat.statuts, jour);
      if (t.end! < debut) return { t, debut: 0, fin: 1, retard };
      return { t, debut: Math.max(0, ecartJours(debut, t.start!)), fin: Math.min(84, ecartJours(debut, t.end!) + 1), retard };
    });
  return { debut, jours: 84, auj: 28, barres };
}

export function reunionsProjet(taches: Tache[], id: string, cat: Catalogues, jour: string) {
  const r = taches.filter((t) => duProjet(t, id) && estReunion(t, cat.types));
  return {
    aVenir: r.filter((t) => (t.end || "") >= jour).sort((a, b) => (a.end || "").localeCompare(b.end || "")).slice(0, 3),
    passees: r.filter((t) => (t.end || "") < jour && (t.end || "") >= ajouterJours(jour, -45)).sort((a, b) => (b.end || "").localeCompare(a.end || "")).slice(0, 4),
  };
}

// Port de computeBudgetStats (nexora-project part-003:2834).
export interface Depense { id?: string; projectId?: string; amount?: number | string; status?: "engagee" | "facturee" | "payee"; categoryId?: string; label?: string; }
export function budgetProjet(projet: { budgetInitial?: number | string; budgetActuel?: number | string } | undefined, depenses: Depense[], id: string) {
  const initial = Number(projet?.budgetInitial) || 0;
  const actuel = Number(projet?.budgetActuel) || initial;
  const t = { engagee: 0, facturee: 0, payee: 0 };
  depenses.filter((e) => e.projectId === id).forEach((e) => { t[e.status || "engagee"] += Number(e.amount) || 0; });
  const consomme = t.engagee + t.facturee + t.payee;
  return { initial, actuel, ...t, consomme, reste: actuel - consomme, pct: actuel > 0 ? Math.round((consomme / actuel) * 100) : 0 };
}

export function documentsProjet(taches: Tache[], id: string) {
  const vus = new Map<string, { nom: string; url: string; drive: boolean; tache: Tache }>();
  taches.filter((t) => duProjet(t, id)).forEach((t) => (t.attachments || []).forEach((p) => {
    if (p.type === "link" && p.url && !vus.has(p.url)) vus.set(p.url, { nom: p.name || p.url, url: p.url, drive: p.provider === "google-drive", tache: t });
  }));
  return [...vus.values()];
}

export interface Charge { nom: string; ouvertes: number; retards: number; semaine: number; prochaine?: Tache; }
export function chargeParPersonne(taches: Tache[], cat: Catalogues, jour: string, filtre?: (t: Tache) => boolean): Charge[] {
  const fin = ajouterJours(jour, 7);
  const m = new Map<string, Charge>();
  cat.membres.forEach((p) => m.set(p.name, { nom: p.name, ouvertes: 0, retards: 0, semaine: 0 }));
  taches.filter((t) => !estTerminee(t, cat.statuts) && (!filtre || filtre(t))).forEach((t) => {
    const nom = (t.assignee || "").trim(); if (!nom) return;
    const c = m.get(nom) || { nom, ouvertes: 0, retards: 0, semaine: 0 };
    c.ouvertes++;
    if (estEnRetard(t, cat.statuts, jour)) c.retards++;
    if (t.end && t.end >= jour && t.end <= fin) c.semaine++;
    if (t.end && t.end >= jour && (!c.prochaine || t.end < (c.prochaine.end || ""))) c.prochaine = t;
    m.set(nom, c);
  });
  return [...m.values()].sort((a, b) => b.retards - a.retards || b.ouvertes - a.ouvertes || a.nom.localeCompare(b.nom));
}

export interface Risque { genre: "bloquee" | "retard-urgent" | "risque"; t: Tache; texte: string; }
export function risquesProjet(taches: Tache[], id: string, cat: Catalogues, jour: string): Risque[] {
  const parId = new Map(taches.map((t) => [t.id, t]));
  const r: Risque[] = [];
  taches.filter((t) => duProjet(t, id) && !estTerminee(t, cat.statuts)).forEach((t) => {
    const bloquants = (t.dependsOn || []).map((x) => parId.get(x)).filter((x): x is Tache => !!x && !estTerminee(x, cat.statuts));
    if (bloquants.length) r.push({ genre: "bloquee", t, texte: `bloquée par ${bloquants.map((b) => b.title).join(", ")}` });
    if (t.criticality === "urgent" && estEnRetard(t, cat.statuts, jour)) r.push({ genre: "retard-urgent", t, texte: `urgente, ${ecartJours(t.end!, jour)} j de retard` });
    ((t.delayRisks as { title?: string; severity?: string }[] | undefined) || []).forEach((x) => r.push({ genre: "risque", t, texte: `${x.title || "risque de retard"}${x.severity ? ` (${x.severity})` : ""}` }));
  });
  return r;
}

export interface Activite { id?: string; type?: string; taskId?: string; taskTitle?: string; projectId?: string; at?: string; from?: string | null; to?: string | null; fromDate?: string; toDate?: string; }
const LIB_ACT: Record<string, string> = { created: "créée", statusChanged: "statut changé", completed: "terminée", reopened: "rouverte", reassigned: "réassignée", deadlineChanged: "échéance déplacée", blocked: "bloquée", unblocked: "débloquée", deleted: "supprimée" };
export function journalProjet(journal: Activite[], id: string, n = 10) {
  return journal.filter((a) => a.projectId === id).slice(0, n).map((a) => ({ ...a, libelle: LIB_ACT[a.type || ""] || a.type || "" }));
}

// Grille d'habitudes : semaines × 7 jours, part des habitudes faites parmi les
// applicables (les « non applicables » sortent du total, comme nexora-project).
export function grilleHabitudes(themes: ThemeHabitudes[], journal: unknown, nonApplicables: unknown, jour: string, semaines = 12) {
  const [a, mo, j] = jour.split("-").map(Number); const dow = new Date(Date.UTC(a, mo - 1, j)).getUTCDay();
  const lundi = ajouterJours(jour, dow === 0 ? -6 : 1 - dow);
  const depart = ajouterJours(lundi, -7 * (semaines - 1));
  return Array.from({ length: semaines }, (_, s) => Array.from({ length: 7 }, (_, k) => {
    const d = ajouterJours(depart, s * 7 + k);
    const e = etatsDuJour(themes, journal, nonApplicables, d);
    return { jour: d, futur: d > jour, part: e.total ? e.faites / e.total : 0, nb: e.faites, total: e.total };
  }));
}
