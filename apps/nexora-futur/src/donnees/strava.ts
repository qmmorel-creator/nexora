// Liaison habitudes ↔ Strava (Ref #663) : port exact de normalizeHabitStrava,
// habitStravaActivities et habitStravaEntries (nexora-project,
// part-002:4772-4819). Une séance suffisante coche l'habitude liée ; Futur,
// comme Nexora actuel, n'ajoute que des coches et n'en retire jamais.
import { idCellule, normaliserJournal, normaliserNonApplicables, normaliserThemes, type EntreeHabitude } from "./habitudes";
import type { Activite } from "./sport";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export interface LienStrava { sports: string[]; minMinutes: number; since: string; }
export function normaliserLienStrava(brut: unknown): LienStrava | null {
  if (!brut || typeof brut !== "object") return null;
  const r = brut as Record<string, unknown>;
  const sports = Array.isArray(r.sports) ? [...new Set(r.sports.filter((s): s is string => typeof s === "string" && !!s.trim()))] : [];
  if (!sports.length) return null;
  const min = Number(r.minMinutes); const since = String(r.since || "");
  return { sports, minMinutes: Number.isFinite(min) && min > 0 ? Math.round(min) : 0, since: ISO.test(since) ? since : "" };
}
export function seancesQualifiantes(strava: unknown, activites: Activite[], date: string): Activite[] {
  const l = normaliserLienStrava(strava);
  if (!l || (l.since && date < l.since)) return [];
  return activites.filter((a) => a && a.date === date && l.sports.includes(a.sport) && (!l.minMinutes || (typeof a.total === "number" && a.total >= l.minMinutes)));
}
export function entreesStrava(themesBruts: unknown, journal: unknown, nonApplicables: unknown, activites: Activite[], aujourdhui: string): EntreeHabitude[] {
  const themes = normaliserThemes(themesBruts);
  const deja = new Set(normaliserJournal(journal).map((e) => e.id));
  const exclus = new Set(normaliserNonApplicables(nonApplicables).map((e) => e.id));
  const parDate = new Map<string, Activite[]>();
  activites.forEach((a) => { if (!a || !ISO.test(String(a.date || "")) || a.date > aujourdhui) return; parDate.set(a.date, [...(parDate.get(a.date) || []), a]); });
  const ajout: EntreeHabitude[] = []; const ajoutes = new Set<string>();
  for (const t of themes) for (const h of t.habits) {
    if (!h.strava) continue;
    for (const [date, l] of parDate) {
      const id = idCellule(h.id, date);
      if (deja.has(id) || exclus.has(id) || !seancesQualifiantes(h.strava, l, date).length) continue;
      if (t.selectionMode === "single" && t.habits.some((x) => x.id !== h.id && (deja.has(idCellule(x.id, date)) || ajoutes.has(idCellule(x.id, date))))) continue;
      ajout.push({ id, habitId: h.id, date }); ajoutes.add(id);
    }
  }
  return ajout.sort((a, b) => (a.date === b.date ? a.habitId.localeCompare(b.habitId) : a.date.localeCompare(b.date)));
}
