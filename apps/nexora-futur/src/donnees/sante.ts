// Santé (Ref #660, lot 7) : port de nexora-project, bloc NEXORA:HEALTH
// (part-003:40580-40800). Mesures lues par le relais
// /api/futur/corps/health-records (lecture seule, décision de Quentin).
import { bornes, cleRegroupement, cleSuivante, decalerJour, libelleRegroupement, seriesEmpilees, type Activite, type Mesure, type PeriodeSport, type Regroupement } from "./sport";

export interface MesureSante { key: string; label: string; unit: string; decimals: number; group: string; }
export const MESURES_SANTE: MesureSante[] = [
  { key: "weight", label: "Poids", unit: "kg", decimals: 1, group: "Corps" },
  { key: "bodyFat", label: "Masse grasse", unit: "%", decimals: 1, group: "Corps" },
  { key: "muscleMass", label: "Masse musculaire", unit: "kg", decimals: 1, group: "Corps" },
  { key: "muscleRate", label: "Masse musculaire (%)", unit: "%", decimals: 1, group: "Corps" },
  { key: "sleepHours", label: "Sommeil réel", unit: "h", decimals: 1, group: "Sommeil" },
  { key: "sleepPerf", label: "Performance sommeil", unit: "%", decimals: 0, group: "Sommeil" },
  { key: "sleepEff", label: "Efficacité sommeil", unit: "%", decimals: 0, group: "Sommeil" },
  { key: "deepSleep", label: "Sommeil profond", unit: "h", decimals: 1, group: "Sommeil" },
  { key: "remSleep", label: "Sommeil REM", unit: "h", decimals: 1, group: "Sommeil" },
  { key: "recovery", label: "Récupération", unit: "%", decimals: 0, group: "Récupération" },
  { key: "hrv", label: "HRV", unit: "ms", decimals: 0, group: "Récupération" },
  { key: "restingHr", label: "FC repos", unit: "bpm", decimals: 0, group: "Récupération" },
  { key: "respRate", label: "Fréq. respiratoire", unit: "rpm", decimals: 1, group: "Récupération" },
  { key: "spo2", label: "SpO₂", unit: "%", decimals: 1, group: "Récupération" },
  { key: "skinTemp", label: "Température cutanée", unit: "°C", decimals: 1, group: "Récupération" },
  { key: "strain", label: "Day Strain", unit: "", decimals: 1, group: "Activité" },
  { key: "calories", label: "Calories dépensées", unit: "kcal", decimals: 0, group: "Activité" },
  { key: "steps", label: "Pas", unit: "", decimals: 0, group: "Activité" },
  { key: "stress", label: "Stress moyen", unit: "/3", decimals: 2, group: "Activité" },
  { key: "hrZone45", label: "Temps en zones FC 4–5", unit: "h", decimals: 2, group: "Activité" },
  { key: "vo2max", label: "VO₂ max", unit: "ml/kg/min", decimals: 1, group: "Activité" },
  { key: "sportDuration", label: "Durée sport (Whoop)", unit: "h", decimals: 1, group: "Activité" },
  { key: "caloriesIn", label: "Calories consommées", unit: "kcal", decimals: 0, group: "Nutrition" },
  { key: "proteins", label: "Protéines consommées", unit: "g", decimals: 0, group: "Nutrition" },
  { key: "carbs", label: "Glucides consommés", unit: "g", decimals: 0, group: "Nutrition" },
];
export const mesureSante = (k: string) => MESURES_SANTE.find((m) => m.key === k) || null;
export type Releve = { date: string } & Record<string, number | string | null>;

// healthRows
export function relevesDe(data: unknown): Releve[] {
  const r = (data as { records?: unknown })?.records;
  if (!Array.isArray(r)) throw new Error("Réponse Santé invalide.");
  return r.filter((x): x is Releve => !!x && typeof x === "object" && /^\d{4}-\d{2}-\d{2}$/.test(String((x as Releve).date || "")));
}
const valeur = (r: Releve | undefined, k: string) => { const v = r ? r[k] : null; return typeof v === "number" && Number.isFinite(v) ? v : null; };
export const moyenne = (vals: (number | null)[]) => { const k = vals.filter((v): v is number => typeof v === "number" && Number.isFinite(v)); return k.length ? k.reduce((t, v) => t + v, 0) / k.length : null; };

export interface PointSante { key: string; label: string; a: number | null; mobile: number | null; }
// healthSeries (une mesure) : moyenne des jours renseignés par période,
// trous gardés (null), rien après aujourd'hui ; moyenne mobile sur
// `jours` jours au dernier jour de chaque période.
export function serieSante(releves: Releve[], o: { mesure: string; periode: PeriodeSport; regroupement: Regroupement; jours?: number }, jour: string) {
  const plage = bornes(o.periode, jour);
  const parDate = new Map(releves.map((r) => [r.date, r]));
  const dates = [...parDate.keys()].sort();
  const premier = plage.from || dates[0] || "";
  const dernier = [plage.to || jour, jour].sort()[0];
  const groupes = new Map<string, string[]>();
  let tropDeBarres = false;
  if (premier && dernier && premier <= dernier) {
    const fin = cleRegroupement(dernier, o.regroupement);
    for (let k = cleRegroupement(premier, o.regroupement); k <= fin; k = cleSuivante(k, o.regroupement)) { if (groupes.size >= 1500) { tropDeBarres = true; break; } groupes.set(k, []); }
    for (let d = premier; d <= dernier; d = decalerJour(d, 1)) { const k = cleRegroupement(d, o.regroupement); if (groupes.has(k)) groupes.get(k)!.push(d); }
  }
  const n = Math.min(365, Math.max(2, Math.round(o.jours ?? 7) || 7));
  const mobile = (d: string) => moyenne(Array.from({ length: n }, (_, i) => valeur(parDate.get(decalerJour(d, -i)), o.mesure)));
  const points: PointSante[] = [...groupes.entries()].map(([key, jours]) => ({ key, label: libelleRegroupement(key, o.regroupement), a: moyenne(jours.map((d) => valeur(parDate.get(d), o.mesure))), mobile: jours.length ? mobile(jours[jours.length - 1]) : null }));
  const connus = points.filter((p) => p.a !== null);
  const extreme = (plus: boolean) => connus.reduce<PointSante | null>((b, p) => (!b || (plus ? p.a! > b.a! : p.a! < b.a!) ? p : b), null);
  return { points, tropDeBarres, mesure: mesureSante(o.mesure), moyenne: moyenne(points.map((p) => p.a)), dernier: connus[connus.length - 1] || null, nb: connus.length, min: extreme(false), max: extreme(true) };
}
// healthFormat
export function formaterSante(v: number | null | undefined, m: MesureSante | null) {
  if (v === null || v === undefined || !m) return "—";
  const t = v.toLocaleString("fr-FR", { maximumFractionDigits: m.decimals, minimumFractionDigits: 0 });
  return m.unit ? `${t} ${m.unit}` : t;
}
// healthTicks : bornes rondes encadrant [min, max] (axe qui ne part pas de 0).
export function graduationsSante(min: number, max: number, n = 5): number[] {
  if (!(Number.isFinite(min) && Number.isFinite(max))) return [0, 1];
  if (min === max) { min -= 1; max += 1; }
  const brut = (max - min) / n; const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= brut)!;
  const t: number[] = [];
  for (let v = Math.floor(min / pas) * pas; v < max + pas / 2; v += pas) t.push(Math.round(v * 1e6) / 1e6);
  if (t[t.length - 1] < max) t.push(Math.round((t[t.length - 1] + pas) * 1e6) / 1e6);
  return t;
}
// healthPearson : null sous 3 paires ou sans variation.
export function pearson(paires: [number | null, number | null][]): number | null {
  const ok = paires.filter((p): p is [number, number] => Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] !== null && p[1] !== null);
  const n = ok.length; if (n < 3) return null;
  const mx = ok.reduce((t, [x]) => t + x, 0) / n, my = ok.reduce((t, [, y]) => t + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of ok) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
export function libellePearson(r: number | null) {
  if (r === null) return "pas assez de jours renseignés";
  const a = Math.abs(r);
  const force = a < 0.1 ? "aucun lien" : a < 0.3 ? "lien faible" : a < 0.5 ? "lien modéré" : "lien fort";
  return a < 0.1 ? force : `${force}, ${r > 0 ? "même sens" : "sens opposé"}`;
}
// healthSportSeries : un jour sans sport compte 0 ; décalage d'un jour
// possible (santé du lendemain), en regroupement par jour seulement.
export function santeSport(releves: Releve[], activites: Activite[], o: { mesure: string; mesureSport: Mesure; periode: PeriodeSport; regroupement: "day" | "week"; decalage: 0 | 1 }, jour: string) {
  const lag = o.regroupement === "day" ? o.decalage : 0;
  const decales = lag ? releves.map((r) => ({ ...r, date: decalerJour(r.date, -lag) })) : releves;
  const s = serieSante(decales, { mesure: o.mesure, periode: o.periode, regroupement: o.regroupement }, lag ? decalerJour(jour, -lag) : jour);
  const sp = seriesEmpilees(activites, { periode: o.periode, mesure: o.mesureSport, regroupement: o.regroupement }, jour);
  const parCle = new Map(sp.barres.map((b) => [b.key, b.total]));
  const points = s.points.map((p) => ({ ...p, b: parCle.get(p.key) ?? 0 }));
  const r = pearson(points.map((p) => [p.b, p.a]));
  return { points, r, paires: points.filter((p) => p.a !== null).length, unite: sp.unite, mesure: s.mesure, lag };
}
