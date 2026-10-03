// Représentations de suivi (Ref #658, lot 5b) : fonctions pures, port de
// nexora-project. Treemap part-002:10807-11160 ; heat map croisée
// part-002:10154-10377 ; heat map mensuelle part-003:12599 ; KPI
// computeKpiValue part-003:2101 ; graphiques part-003:1988-4028 ; Pixel Tasks
// part-002:4823.
import { ajouterJours, ecartJours, estEnRetard, estTerminee, estUrgente, inactiviteJours, type Catalogues, type Projet, type Tache } from "./modele";
import { grouper, type ChampGroupe } from "./requete";
import { comparaison, lundiDe, type Baselines } from "./planning";

// --- Faits et criticité (Treemap) -------------------------------------------
export interface Faits { done: boolean; late: boolean; urgent: boolean; milestone: boolean; daysToDue: number | null; inactivityDays: number; projectPriority: string; }
export function faits(t: Tache, cat: Catalogues, jour: string, maintenant = new Date()): Faits {
  const p = cat.projets.find((x) => x.id === t.projectId);
  return {
    done: estTerminee(t, cat.statuts), late: estEnRetard(t, cat.statuts, jour), urgent: estUrgente(t, cat.statuts), milestone: !!t.milestone,
    daysToDue: t.end ? ecartJours(jour, t.end) : null, inactivityDays: inactiviteJours(t, maintenant), projectPriority: p?.priority || "normal",
  };
}
export const POIDS_CRITICITE = { late: 40, urgent: 25, dueSoon: 10, milestone: 10, stale: 10, projectPriorityHigh: 15, projectPriorityNormal: 5 };
export const NIVEAUX_CRITICITE = [
  { cle: "controlled", libelle: "Maîtrisé", min: 0, couleur: "#22B07D" }, { cle: "watch", libelle: "Vigilance", min: 25, couleur: "#F2A93B" },
  { cle: "high", libelle: "Élevé", min: 50, couleur: "#F07A3D" }, { cle: "critical", libelle: "Critique", min: 70, couleur: "#D64545" },
];
export function criticiteTache(f: Faits): { score: number; raisons: string[] } {
  if (f.done) return { score: 0, raisons: [] };
  const W = POIDS_CRITICITE; let score = 0; const raisons: string[] = [];
  const ajouter = (n: number, l: string) => { score += n; raisons.push(l); };
  if (f.late) ajouter(W.late, "En retard");
  if (f.urgent) ajouter(W.urgent, "Criticité urgente");
  if (!f.late && f.daysToDue != null && f.daysToDue >= 0 && f.daysToDue <= 7) ajouter(W.dueSoon, "Échéance dans 7 jours ou moins");
  if (f.milestone) ajouter(W.milestone, "Jalon");
  if (Number.isFinite(f.inactivityDays) && f.inactivityDays >= 14) ajouter(W.stale, "Sans interaction depuis 14 jours");
  if (f.projectPriority === "high") ajouter(W.projectPriorityHigh, "Projet prioritaire");
  else if (f.projectPriority === "normal") ajouter(W.projectPriorityNormal, "Projet à priorité normale");
  return { score: Math.max(0, Math.min(100, score)), raisons };
}
export const niveauCriticite = (score: number) => NIVEAUX_CRITICITE.reduce((n, l) => (score >= l.min ? l : n), NIVEAUX_CRITICITE[0]);

// --- Treemap projets ---------------------------------------------------------
export type ModeCouleurTreemap = "taille" | "criticite" | "derive" | "avancement";
export interface TuileProjet { projet: Projet; taille: number; poids: number; terminees: number; retards: number; urgentes: number; avancement: number; criticite: number; derive: number; fin: string | null; valeur: number; }
export function treemapProjets(taches: Tache[], cat: Catalogues, jour: string, mode: ModeCouleurTreemap, references: Baselines, afficherVides = false): TuileProjet[] {
  const parProjet = new Map<string, Tache[]>();
  taches.forEach((t) => { if (t.projectId) parProjet.set(t.projectId, [...(parProjet.get(t.projectId) || []), t]); });
  const lignes: TuileProjet[] = [];
  cat.projets.forEach((projet) => {
    const ts = parProjet.get(projet.id) || [];
    if (!afficherVides && !ts.length) return;
    let terminees = 0, retards = 0, urgentes = 0, avancement = 0, crit = 0, derive = 0, nDerive = 0; let fin: string | null = null;
    ts.forEach((t) => {
      const f = faits(t, cat, jour);
      if (f.done) terminees++; if (f.late) retards++; if (f.urgent) urgentes++;
      avancement += Math.max(0, Math.min(100, Number(t.progress) || 0));
      crit += criticiteTache({ ...f, projectPriority: projet.priority || "normal" }).score;
      const c = comparaison(t, references); if (c) { derive += c.ecartFin; nDerive++; }
      if (t.end && (!fin || t.end > fin)) fin = t.end;
    });
    const n = ts.length;
    lignes.push({ projet, taille: n, poids: n, terminees, retards, urgentes, avancement: n ? Math.round(avancement / n) : 0, criticite: n ? Math.round(crit / n) : 0, derive: nDerive ? Math.round(derive / nDerive) : 0, fin, valeur: 0 });
  });
  const max = lignes.reduce((m, r) => Math.max(m, r.taille), 0);
  const zero = Math.max(1, max * 0.12);
  lignes.forEach((r) => {
    r.poids = r.taille > 0 ? r.taille : zero;
    r.valeur = mode === "criticite" ? r.criticite : mode === "derive" ? Math.max(0, r.derive) : mode === "avancement" ? r.avancement : r.taille;
  });
  return lignes.sort((a, b) => b.taille - a.taille || String(a.projet.name || "").localeCompare(String(b.projet.name || "")));
}

// Squarified (part-002:11095), à l'identique.
export function squarifier<T extends { poids: number }>(items: T[], rect: { x: number; y: number; w: number; h: number }): (T & { x: number; y: number; w: number; h: number })[] {
  const liste = items.filter((i) => Number.isFinite(i.poids) && i.poids > 0);
  if (!liste.length || rect.w <= 0 || rect.h <= 0) return [];
  const total = liste.reduce((s, i) => s + i.poids, 0); const k = (rect.w * rect.h) / total;
  const tries = liste.map((item) => ({ item, aire: item.poids * k })).sort((a, b) => b.aire - a.aire);
  const out: (T & { x: number; y: number; w: number; h: number })[] = [];
  let { x, y, w, h } = rect;
  const pire = (r: typeof tries, l: number) => {
    if (!r.length || l <= 0) return Infinity;
    const s = r.reduce((a, b) => a + b.aire, 0); const mx = Math.max(...r.map((z) => z.aire)); const mn = Math.min(...r.map((z) => z.aire));
    if (s <= 0 || mn <= 0) return Infinity;
    return Math.max((l * l * mx) / (s * s), (s * s) / (l * l * mn));
  };
  const poser = (r: typeof tries) => {
    const s = r.reduce((a, b) => a + b.aire, 0); if (s <= 0) return;
    if (w >= h) { const rw = Math.min(w, s / h); let cy = y; r.forEach((z, i) => { const rh = i === r.length - 1 ? y + h - cy : (z.aire / s) * h; out.push({ ...z.item, x, y: cy, w: rw, h: rh }); cy += rh; }); x += rw; w -= rw; }
    else { const rh = Math.min(h, s / w); let cx = x; r.forEach((z, i) => { const rw = i === r.length - 1 ? x + w - cx : (z.aire / s) * w; out.push({ ...z.item, x: cx, y, w: rw, h: rh }); cx += rw; }); y += rh; h -= rh; }
  };
  let ligne: typeof tries = [];
  tries.forEach((e) => { const c = Math.min(w, h); const suite = [...ligne, e]; if (ligne.length && pire(ligne, c) < pire(suite, c)) { poser(ligne); ligne = [e]; } else ligne = suite; });
  if (ligne.length) poser(ligne);
  return out;
}

// --- Indicateurs (computeKpiValue) ------------------------------------------
export function indicateurs(taches: Tache[], cat: Catalogues, references: Baselines) {
  const cmp = taches.map((t) => comparaison(t, references)).filter((c): c is NonNullable<typeof c> => !!c);
  return {
    count: taches.length,
    avgProgress: taches.length ? Math.round(taches.reduce((s, t) => s + (Number(t.progress) || 0), 0) / taches.length) : 0,
    milestoneCount: taches.filter((t) => t.milestone).length,
    urgentCount: taches.filter((t) => estUrgente(t, cat.statuts)).length,
    avgDrift: cmp.length ? Math.round(cmp.reduce((s, c) => s + c.ecartFin, 0) / cmp.length) : 0,
    overdueVsRefCount: cmp.filter((c) => c.ecartFin > 0).length,
    avecReference: cmp.length,
  };
}

// --- Graphiques --------------------------------------------------------------
export type StyleGraphique = "pie" | "bar" | "barh" | "gauge" | "line" | "completedPerWeek" | "stackedBar";
export const STYLES_GRAPHIQUE: { id: StyleGraphique; libelle: string }[] = [
  { id: "pie", libelle: "Camembert" }, { id: "bar", libelle: "Barres verticales" }, { id: "barh", libelle: "Barres horizontales" }, { id: "gauge", libelle: "Jauge (%)" },
  { id: "line", libelle: "Courbe d'évolution" }, { id: "completedPerWeek", libelle: "Terminées par semaine" }, { id: "stackedBar", libelle: "Barres empilées" },
];
export interface Part { cle: string; libelle: string; couleur?: string; valeur: number; }
// Toujours le NOMBRE de tâches par groupe (comme nexora-project).
export const compterPar = (taches: Tache[], champ: ChampGroupe, cat: Catalogues): Part[] =>
  grouper(taches, champ, cat).filter((p) => p.taches.length).map((p) => ({ cle: p.cle, libelle: p.libelle, couleur: p.couleur, valeur: p.taches.length }));
export function empilees(taches: Tache[], champ: ChampGroupe, pile: ChampGroupe, cat: Catalogues) {
  const series = compterPar(taches, pile, cat);
  return { series, barres: grouper(taches, champ, cat).filter((p) => p.taches.length).map((p) => ({ cle: p.cle, libelle: p.libelle, parts: series.map((s) => ({ ...s, valeur: grouper(p.taches, pile, cat).find((x) => x.cle === s.cle)?.taches.length || 0 })) })) };
}
export function jauge(taches: Tache[], cat: Catalogues, mesure: "avgProgress" | "doneRatio") {
  if (!taches.length) return 0;
  if (mesure === "doneRatio") return Math.round((taches.filter((t) => estTerminee(t, cat.statuts)).length / taches.length) * 100);
  return Math.round(taches.reduce((s, t) => s + (estTerminee(t, cat.statuts) ? 100 : Number(t.progress) || 0), 0) / taches.length);
}
// Terminées par semaine (lundi → dimanche), 12 semaines, sur completedAt.
export function termineesParSemaine(taches: Tache[], jour: string, semaines = 12) {
  const lundi = lundiDe(jour);
  const debuts = Array.from({ length: semaines }, (_, i) => ajouterJours(lundi, -7 * (semaines - 1 - i)));
  const parSemaine = debuts.map((d) => ({ lundi: d, valeur: 0 }));
  taches.forEach((t) => {
    if (!t.completedAt) return;
    const j = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(t.completedAt));
    const i = debuts.findIndex((d, k) => j >= d && (k === debuts.length - 1 ? j <= ajouterJours(d, 6) : j < debuts[k + 1]));
    if (i >= 0) parSemaine[i].valeur++;
  });
  return { semaines: parSemaine, moyenne: Math.round((parSemaine.reduce((s, x) => s + x.valeur, 0) / semaines) * 10) / 10 };
}

// --- Densité : heat map mensuelle --------------------------------------------
// 3 mois consécutifs ; tâches comptées sur leur date de fin (jalons compris) ;
// couleurs des projets présents ; retard signalé.
export function densiteMois(taches: Tache[], cat: Catalogues, premierMois: string, jour: string, nbMois = 3) {
  const [a0, m0] = premierMois.split("-").map(Number);
  return Array.from({ length: nbMois }, (_, k) => {
    const a = a0 + Math.floor((m0 - 1 + k) / 12); const m = ((m0 - 1 + k) % 12) + 1;
    const mois = `${a}-${String(m).padStart(2, "0")}`;
    const nbJours = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const decalage = (new Date(Date.UTC(a, m - 1, 1)).getUTCDay() + 6) % 7;
    const jours = Array.from({ length: nbJours }, (_, i) => {
      const date = `${mois}-${String(i + 1).padStart(2, "0")}`;
      const ts = taches.filter((t) => t.end === date);
      const couleurs = [...new Set(ts.map((t) => cat.projets.find((p) => p.id === t.projectId)?.color || "#7A8290"))];
      return { date, taches: ts, couleurs, retard: ts.some((t) => estEnRetard(t, cat.statuts, jour)) };
    });
    return { mois, decalage, jours };
  });
}
export const fondConique = (couleurs: string[]) => (couleurs.length <= 1 ? couleurs[0] || "transparent" : `conic-gradient(from 45deg, ${couleurs.map((c, i) => `${c} ${(i / couleurs.length) * 100}% ${((i + 1) / couleurs.length) * 100}%`).join(", ")})`);

// --- Densité : heat map croisée ----------------------------------------------
export type AxeCroise = "project" | "status" | "taskType" | "criticality" | "assignee" | "month";
export type MesureCroisee = "count" | "late" | "criticality" | "progress";
export const AXES_CROISES: { id: AxeCroise; libelle: string }[] = [
  { id: "project", libelle: "Projet" }, { id: "status", libelle: "Statut" }, { id: "taskType", libelle: "Type de tâche" },
  { id: "criticality", libelle: "Criticité" }, { id: "assignee", libelle: "Responsable" }, { id: "month", libelle: "Mois d'échéance" },
];
export const MESURES_CROISEES: { id: MesureCroisee; libelle: string }[] = [
  { id: "count", libelle: "Nombre de tâches" }, { id: "late", libelle: "Tâches en retard" }, { id: "criticality", libelle: "Criticité moyenne" }, { id: "progress", libelle: "Progression moyenne" },
];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
function axe(taches: Tache[], champ: AxeCroise, cat: Catalogues, jour: string): { id: string; libelle: string; de: (t: Tache) => string }[] {
  if (champ === "month") {
    const presents = [...new Set(taches.map((t) => t.end?.slice(0, 7)).filter((x): x is string => !!x))].sort();
    const ids: string[] = [];
    if (presents.length) { let [y, m] = presents[0].split("-").map(Number); const [ly, lm] = presents[presents.length - 1].split("-").map(Number); while (y < ly || (y === ly && m <= lm)) { ids.push(`${y}-${String(m).padStart(2, "0")}`); m++; if (m > 12) { m = 1; y++; } } }
    let garde = ids; let avant = false; let apres = false;
    if (ids.length > 36) { let d = ids.indexOf(jour.slice(0, 7)); if (d < 0) d = 0; d = Math.max(0, Math.min(ids.length - 36, d - 12)); garde = ids.slice(d, d + 36); avant = d > 0; apres = d + 36 < ids.length; }
    const de = (t: Tache) => { const m = t.end?.slice(0, 7); if (!m) return "__none"; if (m < garde[0]) return "__avant"; if (m > garde[garde.length - 1]) return "__apres"; return m; };
    return [...(avant ? [{ id: "__avant", libelle: "avant" }] : []), ...garde.map((id) => ({ id, libelle: `${MOIS_COURTS[+id.slice(5) - 1]} ${id.slice(2, 4)}` })), ...(apres ? [{ id: "__apres", libelle: "après" }] : []), { id: "__none", libelle: "Sans échéance" }].map((x) => ({ ...x, de }));
  }
  const ordre = champ === "criticality" ? ["urgent", "moyen", "bas", "__none"] : null;
  const paquets = grouper(taches, champ as ChampGroupe, cat);
  const liste = ordre ? [...paquets].sort((a, b) => ordre.indexOf(a.cle) - ordre.indexOf(b.cle)) : paquets;
  return liste.map((p) => ({ id: p.cle, libelle: p.libelle, de: (t: Tache) => (grouper([t], champ as ChampGroupe, cat).find((x) => x.taches.length)?.cle ?? "__none") }));
}
export function grilleCroisee(taches: Tache[], cat: Catalogues, jour: string, lignes: AxeCroise, colonnes: AxeCroise, mesure: MesureCroisee) {
  const L = axe(taches, lignes, cat, jour); const C = axe(taches, colonnes, cat, jour);
  const cases = new Map<string, Tache[]>();
  taches.forEach((t) => { const k = JSON.stringify([L[0]?.de(t), C[0]?.de(t)]); cases.set(k, [...(cases.get(k) || []), t]); });
  const valeur = (ts: Tache[]) => {
    if (mesure === "late") return ts.filter((t) => estEnRetard(t, cat.statuts, jour)).length;
    if (mesure === "progress") return Math.round(ts.reduce((s, t) => s + Math.max(0, Math.min(100, Number(t.progress) || 0)), 0) / ts.length);
    if (mesure === "criticality") return Math.round(ts.reduce((s, t) => s + criticiteTache(faits(t, cat, jour)).score, 0) / ts.length);
    return ts.length;
  };
  const cellules = new Map<string, { valeur: number; taches: Tache[] }>();
  cases.forEach((ts, k) => cellules.set(k, { valeur: valeur(ts), taches: ts }));
  const max = mesure === "criticality" || mesure === "progress" ? 100 : Math.max(4, ...[...cellules.values()].map((c) => c.valeur));
  const lignesUtiles = L.filter((l) => C.some((c) => cellules.has(JSON.stringify([l.id, c.id]))));
  const colonnesUtiles = C.filter((c) => L.some((l) => cellules.has(JSON.stringify([l.id, c.id]))));
  return { lignes: lignesUtiles, colonnes: colonnesUtiles, cellule: (l: string, c: string) => cellules.get(JSON.stringify([l, c])) || null, max };
}

// --- Densité : Pixel Tasks ---------------------------------------------------
// 1 tâche = 1 pixel, à UNE date : celle du jalon (start) ou sinon la fin.
// La période en cours reprend aussi les tâches ouvertes en retard.
export type VuePixels = "jour" | "semaine" | "mois";
export const datePixel = (t: Tache) => (t.milestone ? t.start || t.end : t.end) || null;
export function pixels(taches: Tache[], cat: Catalogues, jour: string, vue: VuePixels, champ: ChampGroupe, periodes = 14) {
  const debutDe = (d: string) => (vue === "jour" ? d : vue === "semaine" ? lundiDe(d) : `${d.slice(0, 7)}-01`);
  const suivante = (d: string, n: number) => {
    if (vue === "jour") return ajouterJours(d, n);
    if (vue === "semaine") return ajouterJours(d, 7 * n);
    const [a, m] = d.split("-").map(Number); const t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`;
  };
  const courante = debutDe(jour);
  const colonnes = Array.from({ length: periodes }, (_, i) => suivante(courante, i - (periodes - 3)));
  const paquets = grouper(taches, champ, cat).filter((p) => p.taches.length);
  const lignes = paquets.map((p) => ({
    cle: p.cle, libelle: p.libelle, couleur: p.couleur,
    cases: colonnes.map((c) => {
      const ts = p.taches.filter((t) => {
        const d = datePixel(t); if (!d) return false;
        if (debutDe(d) === c) return true;
        return c === courante && d < c && estEnRetard(t, cat.statuts, jour);
      });
      return { debut: c, taches: ts, finies: ts.filter((t) => estTerminee(t, cat.statuts)).length, retards: ts.filter((t) => estEnRetard(t, cat.statuts, jour)).length };
    }),
  }));
  // Une tâche reportée sur la période en cours n'est comptée qu'une fois.
  const tout = [...new Map(lignes.flatMap((l) => l.cases.flatMap((c) => c.taches)).map((t) => [t.id, t])).values()];
  return { colonnes, courante, lignes, score: tout.length ? Math.round((tout.filter((t) => estTerminee(t, cat.statuts)).length / tout.length) * 100) : 0 };
}
