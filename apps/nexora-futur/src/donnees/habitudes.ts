// Habitudes (Ref #669) : port fidèle de nexora-project, part-002:4323-4600
// (normalizeHabitThemes, normalizeHabitLog, toggleHabitLogEntry,
// setHabitLogValue, setHabitSkip, habitNumericStep, habitDayStates).
// Contrat de nexora:habitLog (lu et écrit aussi par le MCP) : une entrée
// { id: "habitId|date", habitId, date, value? } par habitude et par jour.
// « Non applicable » vit à part, dans nexora:habitSkips ({ id, habitId, date }).

export interface Habitude { id: string; name: string; color: string; kind: "check" | "numeric"; min: number; max: number; step?: number; strava?: unknown; }
export interface ThemeHabitudes { id: string; name: string; color: string; selectionMode: "single" | "multi"; habits: Habitude[]; }
export interface EntreeHabitude { id: string; habitId: string; date: string; value?: number; }
export interface NonApplicable { id: string; habitId: string; date: string; }

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const fini = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export const idCellule = (habitId: string, date: string) => `${String(habitId || "").trim()}|${String(date || "").trim()}`;

type Brut = Record<string, unknown>;
const objets = (l: unknown): Brut[] => (Array.isArray(l) ? l.filter((x): x is Brut => !!x && typeof x === "object") : []);

function normaliserHabitudes(liste: unknown): Habitude[] {
  const vus = new Set<string>();
  const out: Habitude[] = [];
  objets(liste).forEach((b) => {
    const name = String(b.name || "").trim(); if (!name) return;
    const id = String(b.id || "").trim() || name; if (vus.has(id)) return; vus.add(id);
    const kind = b.kind === "numeric" ? "numeric" : "check";
    const min = fini(b.min) ? b.min : 0;
    const max = fini(b.max) && b.max > min ? b.max : min + 10;
    const h: Habitude = { id, name, color: String(b.color || "").trim() || "#2C6BE0", kind, min, max };
    if (kind === "numeric") h.step = fini(b.step) && b.step > 0 ? b.step : 1;
    if (kind === "check" && b.strava) h.strava = b.strava;
    out.push(h);
  });
  return out;
}

export function normaliserThemes(liste: unknown): ThemeHabitudes[] {
  const vus = new Set<string>();
  const out: ThemeHabitudes[] = [];
  objets(liste).forEach((b) => {
    const name = String(b.name || "").trim(); if (!name) return;
    const id = String(b.id || "").trim() || name; if (vus.has(id)) return; vus.add(id);
    out.push({ id, name, color: String(b.color || "").trim() || "#7A8290", selectionMode: b.selectionMode === "multi" ? "multi" : "single", habits: normaliserHabitudes(b.habits) });
  });
  return out;
}

const connues = (themes: ThemeHabitudes[]) => themes.flatMap((t) => t.habits.map((h) => h.id));
export function trouverHabitude(themes: ThemeHabitudes[], habitId: string) {
  for (const theme of themes) { const habit = theme.habits.find((h) => h.id === habitId); if (habit) return { habit, theme }; }
  return null;
}

const trier = <T extends { habitId: string; date: string }>(l: T[]) => l.sort((a, b) => (a.date === b.date ? a.habitId.localeCompare(b.habitId) : a.date.localeCompare(b.date)));

export function normaliserJournal(liste: unknown, idsConnus?: string[]): EntreeHabitude[] {
  const connu = idsConnus ? new Set(idsConnus) : null;
  const parId = new Map<string, EntreeHabitude>();
  objets(liste).forEach((b) => {
    const habitId = String(b.habitId || "").trim(); const date = String(b.date || "").trim();
    if (!habitId || !ISO.test(date) || (connu && !connu.has(habitId))) return;
    const id = idCellule(habitId, date);
    const e: EntreeHabitude = { id, habitId, date };
    if (fini(b.value)) e.value = b.value;
    parId.set(id, e);
  });
  return trier([...parId.values()]);
}

export function normaliserNonApplicables(liste: unknown, idsConnus?: string[]): NonApplicable[] {
  const connu = idsConnus ? new Set(idsConnus) : null;
  const parId = new Map<string, NonApplicable>();
  objets(liste).forEach((b) => {
    const habitId = String(b.habitId || "").trim(); const date = String(b.date || "").trim();
    if (!habitId || !ISO.test(date) || (connu && !connu.has(habitId))) return;
    const id = idCellule(habitId, date);
    parId.set(id, { id, habitId, date });
  });
  return trier([...parId.values()]);
}

// Bascule une habitude à cocher. Thème « choix unique » : les habitudes sœurs
// du même jour sont retirées (comportement radio).
export function basculerHabitude(journal: unknown, themes: ThemeHabitudes[], habitId: string, date: string): EntreeHabitude[] {
  const trouve = trouverHabitude(themes, habitId);
  const ids = connues(themes);
  const actuel = normaliserJournal(journal, ids);
  if (!trouve) return actuel;
  const id = idCellule(habitId, date);
  const deja = actuel.some((e) => e.id === id);
  let suite = actuel.filter((e) => e.id !== id);
  if (trouve.theme.selectionMode === "single") {
    const soeurs = new Set(trouve.theme.habits.map((h) => h.id));
    suite = suite.filter((e) => !(e.date === date && soeurs.has(e.habitId)));
  }
  if (!deja) suite.push({ id, habitId, date });
  return normaliserJournal(suite, ids);
}

// Pose ou efface la valeur d'une habitude chiffrée, bornée à [min, max].
// Comme nexora-project, le choix unique ne s'applique pas aux valeurs.
export function poserValeur(journal: unknown, themes: ThemeHabitudes[], habitId: string, date: string, brute: string | number | null): EntreeHabitude[] {
  const trouve = trouverHabitude(themes, habitId);
  const ids = connues(themes);
  const actuel = normaliserJournal(journal, ids);
  if (!trouve) return actuel;
  const id = idCellule(habitId, date);
  const suite: EntreeHabitude[] = actuel.filter((e) => e.id !== id);
  if (brute === "" || brute === null) return normaliserJournal(suite, ids);
  const n = Number(brute);
  if (!Number.isFinite(n)) return normaliserJournal(suite, ids);
  const { min, max } = trouve.habit;
  suite.push({ id, habitId, date, value: Math.max(min, Math.min(max, n)) });
  return normaliserJournal(suite, ids);
}

export function poserNonApplicable(liste: unknown, themes: ThemeHabitudes[], habitId: string, date: string, actif: boolean): NonApplicable[] {
  const ids = connues(themes);
  const id = idCellule(habitId, date);
  const suite = normaliserNonApplicables(liste, ids).filter((e) => e.id !== id);
  if (actif && ids.includes(habitId)) suite.push({ id, habitId, date });
  return normaliserNonApplicables(suite, ids);
}

// Pas du compteur −/+ : « + » démarre à min puis plafonne à max ; « − » sous
// min efface (""). null quand rien ne change.
export function pasNumerique(h: Habitude, valeur: number | null | undefined, delta: number): string | null {
  const pas = fini(h.step) && h.step > 0 ? h.step : 1;
  const arrondi = (n: number) => Math.round(n * 1e6) / 1e6;
  const a = fini(valeur);
  if (delta < 0) { if (!a) return null; const n = arrondi(valeur - pas); return n < h.min ? "" : String(n); }
  if (a && valeur >= h.max) return null;
  return String(a ? Math.min(h.max, arrondi(valeur + pas)) : h.min);
}

export type EtatHabitude = "fait" | "partiel" | "na" | "a-faire";
// États d'un jour ; les « non applicables » sortent du total.
export function etatsDuJour(themes: ThemeHabitudes[], journal: unknown, nonApplicables: unknown, date: string) {
  const ids = connues(themes);
  const entrees = new Map(normaliserJournal(journal, ids).filter((e) => e.date === date).map((e) => [e.habitId, e]));
  const na = new Set(normaliserNonApplicables(nonApplicables, ids).filter((e) => e.date === date).map((e) => e.habitId));
  let faites = 0; let total = 0;
  const parTheme = themes.filter((t) => t.habits.length).map((theme) => ({
    theme,
    habitudes: theme.habits.map((h) => {
      const e = entrees.get(h.id);
      let etat: EtatHabitude = "a-faire"; let valeur: number | null = null;
      if (e) {
        if (h.kind === "numeric") { valeur = fini(e.value) ? e.value : h.min; etat = valeur >= h.max ? "fait" : "partiel"; } else etat = "fait";
      } else if (na.has(h.id)) etat = "na";
      if (etat !== "na") { total++; if (etat !== "a-faire") faites++; }
      return { h, etat, valeur };
    }),
  }));
  return { parTheme, faites, total };
}
