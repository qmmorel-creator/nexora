// Sport (Ref #660, lot 7) : port de nexora-project, bloc NEXORA:SPORT
// (part-003:39073-39742). Les activités arrivent par le relais
// /api/optim/corps/sport-activities (lecture seule, décision de Quentin).
export interface Activite {
  id: string; date: string; sport: string; title: string; total: number | null; moving: number | null; distance: number | null;
  elevation: number | null; hr: number | null; maxHr: number | null; url: string | null; start?: string; end?: string;
}
export type PeriodeSport = "all" | "today" | "week" | "month" | "previousMonth" | "year" | "7" | "30" | "90" | "365";
export const PERIODES_SPORT: { valeur: PeriodeSport; libelle: string }[] = [
  { valeur: "week", libelle: "Semaine" }, { valeur: "month", libelle: "Mois" }, { valeur: "30", libelle: "30 j" }, { valeur: "90", libelle: "90 j" },
  { valeur: "year", libelle: "Année" }, { valeur: "365", libelle: "365 j" }, { valeur: "all", libelle: "Tout" },
];
export type Mesure = "count" | "total" | "moving" | "distance" | "elevation";
export const MESURES: { valeur: Mesure; libelle: string; unite: string }[] = [
  { valeur: "total", libelle: "Durée", unite: "h" }, { valeur: "count", libelle: "Séances", unite: "séances" },
  { valeur: "distance", libelle: "Distance", unite: "km" }, { valeur: "elevation", libelle: "Dénivelé", unite: "m" },
];
export type Regroupement = "day" | "week" | "month";
export const PALETTE_SPORT = ["#2f6f9f", "#d9822b", "#3f806f", "#a23b72", "#6c5fc7", "#c9a227", "#5b8c2a", "#c0504d", "#2aa3b8", "#8a6d3b", "#7f8c99", "#e377c2"];
const MAX_BARRES = 1500;

export const decalerJour = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const finMois = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0, 12)).toISOString().slice(0, 10);

// Normalisation de la réponse (sportRows sans les colonnes en plus).
export function activitesDe(data: unknown): Activite[] {
  const a = (data as { activities?: unknown })?.activities;
  if (!Array.isArray(a)) throw new Error("Réponse Sport invalide.");
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return a.filter((x) => x && typeof x === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String((x as Activite).date || ""))).map((x) => {
    const r = x as Record<string, unknown>;
    return { id: String(r.id || ""), date: String(r.date), sport: String(r.sport || ""), title: String(r.title || ""), total: n(r.total), moving: n(r.moving), distance: n(r.distance), elevation: n(r.elevation), hr: n(r.hr), maxHr: n(r.maxHr), url: typeof r.url === "string" ? r.url : null, start: typeof r.start === "string" ? r.start : "", end: typeof r.end === "string" ? r.end : "" };
  });
}

// sportPeriodRange : bornes incluses, "" = sans borne ; semaine = lundi-dimanche.
export function bornes(periode: PeriodeSport, jour: string): { from: string; to: string } {
  if (periode === "today") return { from: jour, to: jour };
  if (periode === "week") { const lundi = decalerJour(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7)); return { from: lundi, to: decalerJour(lundi, 6) }; }
  if (periode === "month") return { from: `${jour.slice(0, 7)}-01`, to: finMois(jour.slice(0, 7)) };
  if (periode === "previousMonth") { const d = decalerJour(`${jour.slice(0, 7)}-01`, -1); return { from: `${d.slice(0, 7)}-01`, to: d }; }
  if (periode === "year") return { from: `${jour.slice(0, 4)}-01-01`, to: `${jour.slice(0, 4)}-12-31` };
  if (/^\d+$/.test(periode)) return { from: decalerJour(jour, 1 - Number(periode)), to: jour };
  return { from: "", to: "" };
}
// sportFilter : aucun sport choisi = tous.
export function filtrer(rows: Activite[], periode: PeriodeSport, jour: string, sports: string[] = []) {
  const { from, to } = bornes(periode, jour); const s = new Set(sports);
  return rows.filter((r) => (!s.size || s.has(r.sport)) && (!from || r.date >= from) && (!to || r.date <= to));
}
// sportNames : du plus pratiqué au moins pratiqué (ordre des couleurs).
export function nomsSports(rows: Activite[]) {
  const c = new Map<string, number>(); rows.forEach((r) => c.set(r.sport, (c.get(r.sport) || 0) + 1));
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([name]) => name);
}
// sportColor
export function couleurSport(nom: string, ordre: string[], autres: string[] = []) {
  const i = ordre.indexOf(nom);
  return PALETTE_SPORT[(i !== -1 ? i : ordre.length + Math.max(0, autres.indexOf(nom))) % PALETTE_SPORT.length];
}
// sportMeasureValue : durées en minutes, affichées en heures.
export function valeurMesure(r: Activite, m: Mesure): number | null {
  if (m === "count") return 1;
  const v = r[m];
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return m === "total" || m === "moving" ? v / 60 : v;
}
// sportBucketKey / sportNextBucket / sportBucketLabel
export function cleRegroupement(date: string, g: Regroupement) {
  if (g === "month") return date.slice(0, 7);
  if (g === "week") { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
  return date;
}
export function cleSuivante(k: string, g: Regroupement) {
  if (g === "month") { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; }
  return decalerJour(k, g === "week" ? 7 : 1);
}
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function semaineIso(lundi: string) {
  const d = new Date(`${lundi}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 3);
  const year = d.getUTCFullYear();
  return { year, week: 1 + Math.floor((d.getTime() - Date.UTC(year, 0, 1, 12)) / 6048e5) };
}
export function libelleRegroupement(k: string, g: Regroupement) {
  if (g === "month") return `${MOIS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;
  if (g === "week") { const { year, week } = semaineIso(k); return `S${String(week).padStart(2, "0")} ${year}`; }
  return `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
}

export interface Barre { key: string; label: string; values: Record<string, number>; total: number; }
// sportStackSeries : une barre par période (vides comprises), une pile par
// sport ; les activités sans valeur sont comptées dans `missing`.
export function seriesEmpilees(rows: Activite[], o: { periode: PeriodeSport; mesure: Mesure; regroupement: Regroupement; sports?: string[] }, jour: string, ordre: string[] = []) {
  const filtrees = filtrer(rows, o.periode, jour, o.sports);
  const plage = bornes(o.periode, jour); const g = o.regroupement;
  const sommes = new Map<string, Map<string, number>>(); const totaux = new Map<string, number>(); let missing = 0;
  filtrees.forEach((r) => {
    const v = valeurMesure(r, o.mesure); if (v === null) { missing++; return; }
    const k = cleRegroupement(r.date, g);
    if (!sommes.has(k)) sommes.set(k, new Map());
    const m = sommes.get(k)!; m.set(r.sport, (m.get(r.sport) || 0) + v);
    totaux.set(r.sport, (totaux.get(r.sport) || 0) + v);
  });
  const dates = filtrees.map((r) => r.date).sort();
  const premier = plage.from || dates[0];
  const dernier = plage.to || (dates.length ? (dates[dates.length - 1] > jour ? dates[dates.length - 1] : jour) : "");
  const cles: string[] = []; let tropDeBarres = false;
  if (premier && dernier && premier <= dernier) {
    const fin = cleRegroupement(dernier, g);
    for (let k = cleRegroupement(premier, g); k <= fin; k = cleSuivante(k, g)) { if (cles.length >= MAX_BARRES) { tropDeBarres = true; break; } cles.push(k); }
  }
  const sports = [...totaux.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([name, total]) => ({ name, total, color: couleurSport(name, ordre, [...totaux.keys()]) }));
  const barres: Barre[] = cles.map((key) => {
    const m = sommes.get(key) || new Map<string, number>();
    const values = Object.fromEntries(sports.map((s) => [s.name, m.get(s.name) || 0]));
    return { key, label: libelleRegroupement(key, g), values, total: sports.reduce((t, s) => t + values[s.name], 0) };
  });
  return { barres, sports, unite: MESURES.find((m) => m.valeur === o.mesure)?.unite || "", missing, tropDeBarres, nb: filtrees.length };
}
// sportNiceTicks
export function graduationsRondes(max: number, n = 5): number[] {
  if (!(max > 0)) return [0, 1];
  const brut = max / n; const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= brut)!;
  const t: number[] = [];
  for (let v = 0; v < max + pas / 2; v += pas) t.push(Math.round(v * 1e6) / 1e6);
  if (t[t.length - 1] < max) t.push(Math.round((t[t.length - 1] + pas) * 1e6) / 1e6);
  return t;
}
// sportFormatValue
export function formaterValeur(v: number, unite: string) {
  const dec = unite === "séances" || unite === "m" || unite === "bpm" ? 0 : v < 10 ? 2 : 1;
  const t = v.toLocaleString("fr-FR", { maximumFractionDigits: dec });
  return unite === "séances" ? `${t} séance${v > 1 ? "s" : ""}` : `${t} ${unite}`;
}

// --- Résumé (sportSummary) ---------------------------------------------------
export function totaux(rows: Activite[]) {
  const s = (k: "total" | "distance" | "elevation") => rows.reduce((t, r) => t + (typeof r[k] === "number" && Number.isFinite(r[k]) ? (r[k] as number) : 0), 0);
  return { count: rows.length, hours: s("total") / 60, km: s("distance"), elevation: s("elevation") };
}
export const ilYa = (n: number) => (n <= 0 ? "aujourd’hui" : n === 1 ? "hier" : `il y a ${n} jours`);
export function duree(min: number | null | undefined) {
  if (typeof min !== "number" || !Number.isFinite(min)) return "—";
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
const ecart = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 864e5);
export function resume(rows: Activite[], jour: string, periode: PeriodeSport = "year", ordre: string[] = []) {
  const passees = rows.filter((r) => r.date <= jour);
  const derniere = passees.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.start || "").localeCompare(String(a.start || "")))[0] || null;
  const lundi = bornes("week", jour).from; const ecoule = ecart(lundi, jour); const lundiPrec = decalerJour(lundi, -7);
  const entre = (a: string, b: string) => passees.filter((r) => r.date >= a && r.date <= b);
  const choisies = filtrer(passees, periode, jour);
  const heures = new Map<string, number>(); const nb = new Map<string, number>();
  choisies.forEach((r) => { nb.set(r.sport, (nb.get(r.sport) || 0) + 1); if (typeof r.total === "number" && Number.isFinite(r.total)) heures.set(r.sport, (heures.get(r.sport) || 0) + r.total / 60); });
  const noms = [...nb.keys()];
  const totalHeures = [...heures.values()].reduce((t, h) => t + h, 0);
  const parSport = noms.map((name) => ({ name, hours: heures.get(name) || 0, count: nb.get(name)!, color: couleurSport(name, ordre, noms) }))
    .sort((a, b) => b.hours - a.hours || b.count - a.count || a.name.localeCompare(b.name, "fr")).map((s) => ({ ...s, share: totalHeures ? s.hours / totalHeures : 0 }));
  return {
    derniere, ilYaJours: derniere ? ecart(derniere.date, jour) : null,
    semaine: totaux(entre(lundi, jour)), semainePrec: totaux(entre(lundiPrec, decalerJour(lundiPrec, ecoule))),
    mois: totaux(filtrer(passees, "month", jour)), parSport, totalHeures,
  };
}

// --- Objectifs (nexora:sportGoals, lecture seule) ----------------------------
export interface ObjectifsSport { weeklyHours: number | null; yearlyKm: { id: string; label: string; sports: string[]; km: number | null }[]; }
const nombreObjectif = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
export function normaliserObjectifs(v: unknown): ObjectifsSport {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    weeklyHours: nombreObjectif(o.weeklyHours),
    yearlyKm: (Array.isArray(o.yearlyKm) ? o.yearlyKm : []).filter((g) => g && typeof g === "object" && typeof g.id === "string" && g.id)
      .map((g) => ({ id: g.id, label: typeof g.label === "string" ? g.label : "", sports: Array.isArray(g.sports) ? g.sports.filter((s: unknown) => typeof s === "string") : [], km: nombreObjectif(g.km) })),
  };
}
// sportGoalProgress
export function avancementObjectifs(rows: Activite[], objectifs: ObjectifsSport, jour: string) {
  const passees = rows.filter((r) => r.date <= jour);
  const an = jour.slice(0, 4);
  const joursAn = (Date.UTC(+an + 1, 0, 1) - Date.UTC(+an, 0, 1)) / 864e5;
  const jourAn = ecart(`${an}-01-01`, jour) + 1;
  const hSemaine = totaux(filtrer(passees, "week", jour)).hours;
  const hebdo = objectifs.weeklyHours ? { cible: objectifs.weeklyHours, fait: hSemaine, ratio: hSemaine / objectifs.weeklyHours, reste: Math.max(0, objectifs.weeklyHours - hSemaine) } : null;
  const annuels = objectifs.yearlyKm.filter((x) => x.km).map((x) => {
    const fait = totaux(filtrer(passees, "year", jour, x.sports)).km; const attendu = (x.km! * jourAn) / joursAn;
    return { id: x.id, libelle: x.label.trim() || (x.sports.length ? x.sports.join(" + ") : "Tous les sports"), cible: x.km!, fait, ratio: fait / x.km!, attendu, ecart: fait - attendu };
  });
  return { hebdo, annuels };
}

// --- Calendrier annuel (sportCalendar, rendu en grille CSS) ------------------
export function calendrier(rows: Activite[], annee: string, ordre: string[] = []) {
  const de = `${annee}-01-01`; const a = `${annee}-12-31`;
  const parJour = new Map<string, Activite[]>();
  rows.forEach((r) => { if (r.date < de || r.date > a) return; if (!parJour.has(r.date)) parJour.set(r.date, []); parJour.get(r.date)!.push(r); });
  const autres = [...new Set([...parJour.values()].flat().map((x) => x.sport))];
  const decalage = (new Date(`${de}T12:00:00Z`).getUTCDay() + 6) % 7;
  const jours: { date: string; semaine: number; dow: number; nb: number; minutes: number; fond: string; teinte: number; sports: string[] }[] = [];
  for (let d = de, i = 0; d <= a; d = decalerJour(d, 1), i++) {
    const acts = parJour.get(d) || [];
    const par = new Map<string, { minutes: number; count: number }>();
    acts.forEach((x) => { const p = par.get(x.sport) || { minutes: 0, count: 0 }; p.minutes += typeof x.total === "number" && Number.isFinite(x.total) ? x.total : 0; p.count++; par.set(x.sport, p); });
    const classes = [...par.entries()].sort((p, q) => q[1].minutes - p[1].minutes || q[1].count - p[1].count || p[0].localeCompare(q[0], "fr"));
    const couleurs = classes.map(([n]) => couleurSport(n, ordre, autres));
    const minutes = [...par.values()].reduce((t, p) => t + p.minutes, 0);
    const seg = 360 / Math.max(1, couleurs.length);
    jours.push({
      date: d, semaine: Math.floor((i + decalage) / 7), dow: (i + decalage) % 7, nb: acts.length, minutes, sports: classes.map(([n]) => n),
      fond: couleurs.length > 1 ? `conic-gradient(from 45deg, ${couleurs.map((c, k) => `${c} ${k * seg}deg ${(k + 1) * seg}deg`).join(", ")})` : couleurs[0] || "",
      teinte: acts.length ? Math.round((0.35 + 0.65 * Math.min(1, Math.max(0, minutes) / 120)) * 100) / 100 : 0,
    });
  }
  return { jours, semaines: jours.length ? jours[jours.length - 1].semaine + 1 : 0, joursActifs: jours.filter((j) => j.nb).length };
}

// --- Répartition « 1 carré = 1 h » (retour du 03/10/2026) --------------------
// Port de sportWaffle de Nexora (index.html.part-003) : heures totales par sport
// sur la période, un carré par heure entamée ; le dernier carré est rempli au
// prorata (`dernier` entre 0 et 1). Au-delà de MAX_CARRES pour un sport, on tronque.
export const MAX_CARRES = 2000;
export function repartition(rows: Activite[], periode: PeriodeSport, jour: string, ordre: string[] = [], sports: string[] = []) {
  const heures = new Map<string, number>(); let manquantes = 0;
  for (const r of filtrer(rows, periode, jour, sports)) {
    const v = valeurMesure(r, "total");
    if (v === null) { manquantes++; continue; }
    heures.set(r.sport, (heures.get(r.sport) || 0) + v);
  }
  const noms = [...heures.keys()];
  const parSport = [...heures.entries()].filter(([, h]) => h > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([nom, h]) => ({ nom, heures: h, carres: Math.ceil(h), dernier: h - Math.ceil(h) + 1, couleur: couleurSport(nom, ordre, noms) }));
  return { parSport, total: parSport.reduce((t, s) => t + s.heures, 0), manquantes, tropGrand: parSport.some((s) => s.carres > MAX_CARRES) };
}
