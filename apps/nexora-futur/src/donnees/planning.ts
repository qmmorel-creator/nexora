// Frise et Agenda (Ref #658) : fonctions pures, port fidèle de nexora-project.
// Références : chemin critique part-000:3587 ; comparaison part-002:9195-9420 ;
// calendrier part-002:5248-5506 (NEXORA:CALENDAR) ; axe part-003:12510.
import { ajouterJours, aujourdhuiParis, ecartJours, estTerminee, type Statut, type Tache } from "./modele";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const estIso = (v: unknown): v is string => typeof v === "string" && ISO.test(v);
export const jourIdx = (iso: string) => ecartJours("2020-01-01", iso);

// --- Chemin critique ---------------------------------------------------------
// Part de la (des) tâche(s) qui finissent le plus tard et remonte `dependsOn` en
// gardant à chaque étape le(s) prédécesseur(s) qui finissent le plus tard
// (égalité : toutes les branches). Ancré sur les dates de fin, sans durées.
export function cheminCritique(taches: Tache[]): Set<string> {
  const datees = taches.filter((t) => estIso(t.end));
  if (!datees.length) return new Set();
  const parId = new Map(datees.map((t) => [t.id, t]));
  const max = Math.max(...datees.map((t) => jourIdx(t.end!)));
  const ids = new Set(datees.filter((t) => jourIdx(t.end!) === max).map((t) => t.id));
  let front = [...ids]; let garde = 0;
  while (front.length && garde < 5000) {
    const suite: string[] = [];
    front.forEach((id) => {
      const deps = (parId.get(id)?.dependsOn || []).map((d) => parId.get(d)).filter((x): x is Tache => !!x);
      if (!deps.length) return;
      const m = Math.max(...deps.map((d) => jourIdx(d.end!)));
      deps.forEach((d) => { if (jourIdx(d.end!) === m && !ids.has(d.id)) { ids.add(d.id); suite.push(d.id); } });
      garde++;
    });
    front = suite;
  }
  return ids;
}

// --- Comparaison à la référence ---------------------------------------------
export interface EntreeHistorique { start: string; end: string; capturedAt: string | null; label: string | null; }
export interface ComparaisonStockee { enabled: boolean; referenceStart: string | null; referenceEnd: string | null; capturedAt: string | null; history: EntreeHistorique[]; }

function entreeHistorique(v: unknown): EntreeHistorique | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (!estIso(b.end)) return null;
  return { start: estIso(b.start) ? b.start : b.end, end: b.end, capturedAt: estIso(b.capturedAt) ? b.capturedAt : null, label: typeof b.label === "string" && b.label.trim() ? b.label.trim() : null };
}
export function normaliserComparaison(v: unknown): ComparaisonStockee | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  const enabled = b.enabled === true;
  const referenceStart = estIso(b.referenceStart) ? b.referenceStart : null;
  const referenceEnd = estIso(b.referenceEnd) ? b.referenceEnd : null;
  const history = Array.isArray(b.history) ? b.history.map(entreeHistorique).filter((x): x is EntreeHistorique => !!x) : [];
  if (!enabled && !referenceStart && !referenceEnd && !history.length) return null;
  return { enabled, referenceStart, referenceEnd, capturedAt: estIso(b.capturedAt) ? b.capturedAt : null, history };
}

function depuisDatesActuelles(t: Tache) {
  const jalon = !!t.milestone;
  const end = estIso(t.end) ? t.end : null;
  const start = jalon ? end : estIso(t.start) ? t.start : null;
  if (!end || (!jalon && !start)) return null;
  return { enabled: true, referenceStart: jalon ? null : start, referenceEnd: end };
}

// « Figer la référence » : l'ancienne référence est archivée dans l'historique
// (la première sous le libellé « Initiale ») avant d'être remplacée.
export function figerReference(t: Tache, jour = aujourdhuiParis()): ComparaisonStockee | null {
  const graine = depuisDatesActuelles(t);
  if (!graine) return null;
  const prec = normaliserComparaison(t.comparison);
  const history = prec ? prec.history.slice() : [];
  if (prec && prec.referenceEnd) {
    const a = entreeHistorique({ start: t.milestone ? prec.referenceEnd : prec.referenceStart, end: prec.referenceEnd, capturedAt: prec.capturedAt, label: history.length === 0 ? "Initiale" : null });
    if (a) history.push(a);
  }
  return { ...graine, capturedAt: jour, history };
}

export type Ton = "avance" | "retard" | "conforme";
export const ton = (n: number): Ton => (n < 0 ? "avance" : n > 0 ? "retard" : "conforme");
export const libelleEcart = (n: number) => (n === 0 ? "0 j" : `${n > 0 ? "+" : "−"}${Math.abs(n)} j`);
export interface Comparaison { referenceStart: string; referenceEnd: string; ecartDebut: number; ecartFin: number; tonFin: Ton; }
export type Baselines = Record<string, { start?: string; end?: string; capturedAt?: string }>;

// Comparaison exploitable, ou null. Repli sur nexora:taskBaselines seulement
// quand AUCUNE référence n'a été posée (comparison absente, pas désactivée).
export function comparaison(t: Tache, baselines: Baselines | null | undefined, mode: "courante" | "initiale" = "courante"): Comparaison | null {
  let c = normaliserComparaison(t.comparison);
  if (!c && t.comparison == null && baselines) {
    const b = baselines[t.id];
    if (b && estIso(b.start) && estIso(b.end)) c = { enabled: true, referenceStart: b.start, referenceEnd: b.end, capturedAt: null, history: [] };
  }
  if (!c || !c.enabled) return null;
  if (mode === "initiale" && c.history.length) c = { ...c, referenceStart: c.history[0].start, referenceEnd: c.history[0].end };
  const jalon = !!t.milestone;
  const finAct = estIso(t.end) ? t.end : null;
  const debAct = jalon ? finAct : estIso(t.start) ? t.start : null;
  if (!finAct || !debAct) return null;
  const refFin = c.referenceEnd; const refDeb = jalon ? refFin : c.referenceStart;
  if (!estIso(refFin) || !estIso(refDeb)) return null;
  if (!jalon && refFin < refDeb) return null;
  const ecartFin = ecartJours(refFin, finAct);
  return { referenceStart: refDeb, referenceEnd: refFin, ecartDebut: ecartJours(refDeb, debAct), ecartFin, tonFin: ton(ecartFin) };
}

// --- Frise : lignes, groupes, axe -----------------------------------------
export interface LigneFrise { t: Tache; debut: string; fin: string; jalon: boolean; }
// Barres : tâches non jalons datées (début et fin) ; jalons : avec une fin.
export function lignesFrise(taches: Tache[]): LigneFrise[] {
  return taches.flatMap((t): LigneFrise[] => {
    if (t.milestone) return estIso(t.end) ? [{ t, debut: t.end, fin: t.end, jalon: true }] : [];
    if (!estIso(t.start) || !estIso(t.end)) return [];
    return [{ t, debut: t.start <= t.end ? t.start : t.end, fin: t.start <= t.end ? t.end : t.start, jalon: false }];
  });
}

// Barre de synthèse d'un groupe : étendue et avancement moyen pondéré par la
// durée (un jalon compte 100 s'il est terminé, 0 sinon).
export function syntheseGroupe(lignes: LigneFrise[], statuts: Statut[]) {
  if (!lignes.length) return null;
  const debut = lignes.reduce((a, l) => (l.debut < a ? l.debut : a), lignes[0].debut);
  const fin = lignes.reduce((a, l) => (l.fin > a ? l.fin : a), lignes[0].fin);
  let poids = 0; let somme = 0;
  lignes.forEach((l) => {
    const d = Math.max(1, ecartJours(l.debut, l.fin) + 1);
    const p = l.jalon ? (estTerminee(l.t, statuts) ? 100 : 0) : estTerminee(l.t, statuts) ? 100 : Math.max(0, Math.min(100, Number(l.t.progress) || 0));
    poids += d; somme += d * p;
  });
  return { debut, fin, avancement: poids ? Math.round(somme / poids) : 0 };
}

export interface Fenetre { debut: string; jours: number; }
// Étendue naturelle des lignes (et des références affichées), élargie à
// aujourd'hui ; zoom : span = max(2, round(base × 1,65^−niveau)) centré sur
// aujourd'hui, décalé par pas de span/3.
export function fenetreFrise(lignes: LigneFrise[], aujourdhui: string, zoom = 0, decalage = 0, refs: { debut: string; fin: string }[] = []): Fenetre {
  const dates = [...lignes.flatMap((l) => [l.debut, l.fin]), ...refs.flatMap((r) => [r.debut, r.fin]), aujourdhui].sort();
  const deb0 = ajouterJours(dates[0], -2); const fin0 = ajouterJours(dates[dates.length - 1], 3);
  const base = Math.max(14, ecartJours(deb0, fin0));
  if (!zoom && !decalage) return { debut: deb0, jours: base };
  const span = Math.max(2, Math.round(base * Math.pow(1.65, -zoom)));
  const centre = zoom ? ajouterJours(aujourdhui, -Math.round(span / 2)) : deb0;
  return { debut: ajouterJours(centre, Math.round((decalage * span) / 3)), jours: span };
}

export type Unite = "jour" | "semaine" | "mois" | "trimestre" | "annee";
export const uniteAxe = (jours: number): Unite => (jours <= 18 ? "jour" : jours <= 70 ? "semaine" : jours <= 550 ? "mois" : jours <= 1500 ? "trimestre" : "annee");
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export interface Graduation { jour: string; position: number; libelle: string; }
export function graduations(f: Fenetre): { unite: Unite; traits: Graduation[] } {
  const unite = uniteAxe(f.jours);
  const traits: Graduation[] = [];
  const fin = ajouterJours(f.debut, f.jours);
  const [a0, m0] = f.debut.split("-").map(Number);
  const pousser = (iso: string, libelle: string) => { if (iso >= f.debut && iso <= fin) traits.push({ jour: iso, position: ecartJours(f.debut, iso) / f.jours, libelle }); };
  if (unite === "jour" || unite === "semaine") {
    const [a, m, j] = f.debut.split("-").map(Number); const dow = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
    let d = unite === "jour" ? f.debut : ajouterJours(f.debut, dow === 0 ? 0 : 7 - dow);
    const pas = unite === "jour" ? Math.max(1, Math.ceil(f.jours / 7)) : 7;
    for (; d <= fin; d = ajouterJours(d, pas)) pousser(d, `${+d.slice(8, 10)} ${MOIS[+d.slice(5, 7) - 1]}`);
  } else {
    const pasMois = unite === "mois" ? 1 : unite === "trimestre" ? 3 : 12;
    let a = a0; let m = unite === "mois" ? m0 : unite === "trimestre" ? Math.floor((m0 - 1) / 3) * 3 + 1 : 1;
    for (let i = 0; i < 400; i++) {
      const iso = `${a}-${String(m).padStart(2, "0")}-01`;
      if (iso > fin) break;
      pousser(iso, unite === "mois" ? `${MOIS[m - 1]}${m === 1 ? ` ${a}` : ""}` : unite === "trimestre" ? `T${Math.floor((m - 1) / 3) + 1} ${a}` : String(a));
      m += pasMois; while (m > 12) { m -= 12; a++; }
    }
  }
  return { unite, traits };
}

// --- Agenda (NEXORA:CALENDAR) -----------------------------------------------
const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const minutesDe = (v: unknown) => { const m = HEURE.exec(String(v ?? "").trim()); return m ? +m[1] * 60 + +m[2] : null; };
export const libelleMinutes = (n: number) => (n >= 1440 ? "24:00" : `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`);

export function plageAgenda(t: Tache): { start: string; end: string } | null {
  const a = t.start || t.end || ""; const b = t.end || t.start || "";
  if (!a) return null;
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}
export function lundiDe(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number); const dow = (new Date(Date.UTC(a, m - 1, j)).getUTCDay() + 6) % 7;
  return ajouterJours(iso, -dow);
}
const jourSemaine = (iso: string) => ecartJours(lundiDe(iso), iso);
export function comparerAgenda(a: Tache, b: Tache): number {
  const sa = minutesDe(a.startTime); const sb = minutesDe(b.startTime);
  if (sa == null && sb != null) return -1;
  if (sa != null && sb == null) return 1;
  if (sa != null && sb != null && sa !== sb) return sa - sb;
  return String(a.title || "").localeCompare(String(b.title || ""), "fr");
}

export interface Bandeau { t: Tache; col0: number; col1: number; piste: number; coupeDebut: boolean; coupeFin: boolean; }
// Une semaine : multi-jours en bandeaux sur la première piste libre, les
// autres dans leur case ; `lignes` borne une case, bandeaux compris. Les
// tâches terminées n'y figurent jamais.
export function semaineAgenda(taches: Tache[], statuts: Statut[], lundi: string, lignes = 4) {
  const rows = Math.max(2, Math.min(8, Math.round(lignes) || 4));
  const dimanche = ajouterJours(lundi, 6);
  const multi: { t: Tache; r: { start: string; end: string } }[] = []; const simples: Tache[] = [];
  taches.filter((t) => !estTerminee(t, statuts)).forEach((t) => {
    const r = plageAgenda(t);
    if (!r || r.end < lundi || r.start > dimanche) return;
    if (r.start !== r.end) multi.push({ t, r }); else simples.push(t);
  });
  multi.sort((a, b) => a.r.start.localeCompare(b.r.start) || b.r.end.localeCompare(a.r.end) || comparerAgenda(a.t, b.t));
  const finsPistes: number[] = [];
  const bandeaux: Bandeau[] = multi.map(({ t, r }) => {
    const col0 = jourSemaine(r.start < lundi ? lundi : r.start); const col1 = jourSemaine(r.end > dimanche ? dimanche : r.end);
    let piste = 0; while (finsPistes[piste] !== undefined && finsPistes[piste] >= col0) piste++;
    finsPistes[piste] = col1;
    return { t, col0, col1, piste, coupeDebut: r.start < lundi, coupeFin: r.end > dimanche };
  });
  const pistes = Math.min(finsPistes.length, rows);
  const jours = Array.from({ length: 7 }, (_, i) => {
    const date = ajouterJours(lundi, i);
    const el = simples.filter((t) => plageAgenda(t)!.start === date).sort(comparerAgenda);
    const place = Math.max(0, rows - pistes);
    const caches = bandeaux.filter((s) => s.piste >= rows && s.col0 <= i && i <= s.col1).length;
    return { date, taches: el.slice(0, place), masquees: el.length - Math.min(el.length, place) + caches, total: el.length + bandeaux.filter((s) => s.col0 <= i && i <= s.col1).length };
  });
  return { lundi, jours, bandeaux: bandeaux.filter((s) => s.piste < rows), pistes };
}

// Portion horaire d'une tâche un jour donné (jours intermédiaires : 0 h-24 h).
export function trancheHoraire(t: Tache, jour: string): { debut: number; fin: number } | null {
  const r = plageAgenda(t);
  if (!r || jour < r.start || jour > r.end) return null;
  const s0 = minutesDe(t.startTime); if (s0 == null) return null;
  const e0 = minutesDe(t.endTime);
  const debut = jour === r.start ? s0 : 0;
  let fin = jour === r.end ? (e0 == null ? Math.min(s0 + 60, 1440) : e0) : 1440;
  if (fin <= debut) fin = Math.min(debut + 15, 1440);
  return { debut, fin };
}

// Frise d'un jour : toutes les tâches actives ce jour-là, terminées comprises.
export function journeeAgenda(taches: Tache[], statuts: Statut[], jour: string) {
  const actives = taches.filter((t) => { const r = plageAgenda(t); return !!r && r.start <= jour && jour <= r.end; });
  const horaires: { t: Tache; fini: boolean; debut: number; fin: number }[] = [];
  const journee: { t: Tache; fini: boolean }[] = [];
  actives.forEach((t) => { const fini = estTerminee(t, statuts); const s = trancheHoraire(t, jour); if (s) horaires.push({ t, fini, ...s }); else journee.push({ t, fini }); });
  horaires.sort((a, b) => a.debut - b.debut || a.fin - b.fin || comparerAgenda(a.t, b.t));
  journee.sort((a, b) => comparerAgenda(a.t, b.t));
  return { jour, journee, horaires, total: actives.length, finies: actives.filter((t) => estTerminee(t, statuts)).length, minutesPlanifiees: horaires.reduce((s, x) => s + x.fin - x.debut, 0) };
}

// Créneaux qui se chevauchent : répartis en colonnes (première colonne libre
// dans chaque groupe de chevauchement).
export function colonnesHoraires<T extends { debut: number; fin: number }>(l: T[]): (T & { colonne: number; colonnes: number })[] {
  const out = l.map((x) => ({ ...x, colonne: 0, colonnes: 1 }));
  let groupe: typeof out = []; let finGroupe = -1;
  const clore = () => { const n = Math.max(1, ...groupe.map((e) => e.colonne + 1)); groupe.forEach((e) => { e.colonnes = n; }); groupe = []; };
  for (const e of out) {
    if (e.debut >= finGroupe) { clore(); finGroupe = -1; }
    const prises = new Set(groupe.filter((g) => g.fin > e.debut).map((g) => g.colonne));
    let c = 0; while (prises.has(c)) c++;
    e.colonne = c; groupe.push(e); finGroupe = Math.max(finGroupe, e.fin);
  }
  clore();
  return out;
}

// Bulles (part-003:2294, disposition « lanes ») : les bulles d'un groupe se
// rangent côte à côte et ne descendent d'une ligne que si elles se chevauchent
// réellement, largeur minimale comprise (en jours, déduite de la fenêtre).
export function couloirs(lignes: LigneFrise[], largeurMinJours: number): LigneFrise[][] {
  const tries = [...lignes].sort((a, b) => a.debut.localeCompare(b.debut) || a.fin.localeCompare(b.fin));
  const fins: string[] = []; const out: LigneFrise[][] = [];
  tries.forEach((l) => {
    const finOccupee = ajouterJours(l.debut, Math.max(ecartJours(l.debut, l.fin) + 1, largeurMinJours));
    let k = fins.findIndex((f) => f <= l.debut);
    if (k < 0) { k = fins.length; out.push([]); }
    fins[k] = finOccupee; out[k].push(l);
  });
  return out;
}
