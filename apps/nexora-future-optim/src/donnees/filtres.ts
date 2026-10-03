// Moteur de filtres (Ref #655) : port fidèle de matchTaskFilters et des
// conditions avancées (nexora-project part-000:3730-3920). Le jour de
// référence est passé en paramètre (tests déterministes).
import { ajouterJours, estEnRetard, estFocus, estTerminee, estUrgente, inactiviteJours, type Projet, type Statut, type Tache, type TypeTache } from "./modele";

export const SANS_PROJET = "__nexora_without_project__";
export const SANS_RESPONSABLE = "__nexora_without_assignee__";

export interface Condition { field: string; mode?: "is" | "isnot" | "contains" | "not_contains"; values?: string[]; textValue?: string; numberValue?: string | number; datePreset?: string; }
export interface Groupe { op: "and" | "or"; items: (Condition | Groupe)[]; }
export interface Filtres {
  search: string; milestone: "all" | "yes" | "no"; focus: "all" | "yes" | "no"; progressMin: number; progressMax: number;
  startFrom: string; startTo: string; endFrom: string; endTo: string; lateOnly: boolean; dueWithinDays: string | number;
  pastDays: string | number; inactivityDays: string | number; inactivityMinDays?: string | number; quickDatePreset: string;
  showDone: boolean; urgentOnly: boolean; advanced: Groupe;
}

export const filtresParDefaut = (): Filtres => ({
  search: "", milestone: "all", focus: "all", progressMin: 0, progressMax: 100, startFrom: "", startTo: "", endFrom: "", endTo: "",
  lateOnly: false, dueWithinDays: "", pastDays: "", inactivityDays: "", quickDatePreset: "", showDone: false, urgentOnly: false,
  advanced: { op: "and", items: [] },
});
export const metaFiltresParDefaut = (): Filtres => ({ ...filtresParDefaut(), showDone: true });

// Complète un objet lu dans Firebase (champs manquants des versions anciennes).
export function normaliserFiltres(brut: unknown, defaut: () => Filtres = filtresParDefaut): Filtres {
  const d = defaut();
  const o = brut && typeof brut === "object" ? (brut as Partial<Filtres>) : {};
  return { ...d, ...o, advanced: o.advanced && Array.isArray(o.advanced.items) ? o.advanced : d.advanced, search: typeof o.search === "string" ? o.search : "" };
}

export interface Contexte { projets: Projet[]; statuts: Statut[]; types: TypeTache[]; aujourdhui: string; maintenant?: Date; }

export function plageDePreselection(preset: string, aujourdhui: string): { de: string | null; a: string | null } {
  const [y, m, j] = aujourdhui.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, j)).getUTCDay();
  const lundi = ajouterJours(aujourdhui, dow === 0 ? -6 : 1 - dow);
  const iso = (a: number, mo: number, jo: number) => new Date(Date.UTC(a, mo, jo)).toISOString().slice(0, 10);
  switch (preset) {
    case "today": return { de: aujourdhui, a: aujourdhui };
    case "before_today": return { de: null, a: ajouterJours(aujourdhui, -1) };
    case "after_today": return { de: ajouterJours(aujourdhui, 1), a: null };
    case "this_week": return { de: lundi, a: ajouterJours(lundi, 6) };
    case "next_week": return { de: ajouterJours(lundi, 7), a: ajouterJours(lundi, 13) };
    case "this_month": return { de: iso(y, m - 1, 1), a: iso(y, m, 0) };
    case "next_month": return { de: iso(y, m, 1), a: iso(y, m + 1, 0) };
    case "this_year": return { de: `${y}-01-01`, a: `${y}-12-31` };
    default: return { de: null, a: null };
  }
}
export function dansPreselection(date: string | undefined, preset: string, aujourdhui: string): boolean {
  if (!date || !preset) return false;
  const { de, a } = plageDePreselection(preset, aujourdhui);
  return !(de && date < de) && !(a && date > a);
}

const fmtCourt = (iso?: string) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");

function foin(t: Tache, c: Contexte): string {
  return [t.title, t.desc, t.assignee, c.projets.find((p) => p.id === t.projectId)?.name, c.statuts.find((s) => s.id === t.statusId)?.name,
    c.types.find((x) => x.id === t.taskTypeId)?.name, t.milestone ? "jalon" : "", estFocus(t) ? "focus" : "", fmtCourt(t.start), fmtCourt(t.end), String(t.progress),
    ...(t.checklist || []).map((i) => i.text)].filter(Boolean).join(" ␟ ").toLowerCase();
}

function valeurChamp(t: Tache, champ: string): string {
  switch (champ) {
    case "project": return t.projectId || SANS_PROJET;
    case "status": return t.statusId || "";
    case "criticality": return t.criticality || "";
    case "taskType": return t.taskTypeId || "";
    case "assignee": return (t.assignee || "").trim() || SANS_RESPONSABLE;
    case "milestone": return t.milestone ? "yes" : "no";
    case "sameDay": return t.start && t.end && t.start === t.end ? "yes" : "no";
    case "focus": return estFocus(t) ? "yes" : "no";
    default: return "";
  }
}

function evalCondition(t: Tache, c: Condition, ctx: Contexte): boolean {
  if ((c.field === "start" || c.field === "end") && c.datePreset) {
    const ok = dansPreselection(t[c.field], c.datePreset, ctx.aujourdhui);
    return c.mode === "isnot" ? !ok : ok;
  }
  if (c.field === "title") {
    const n = (c.textValue || "").trim().toLowerCase();
    if (!n) return true;
    const ok = (t.title || "").toLowerCase().includes(n);
    return c.mode === "not_contains" ? !ok : ok;
  }
  if (c.field === "inactivity") {
    const s = Number(c.numberValue);
    if (c.numberValue === "" || c.numberValue == null || Number.isNaN(s)) return true;
    return inactiviteJours(t, ctx.maintenant) > s;
  }
  const liste = c.values || [];
  if (!liste.length) return true;
  let dans: boolean;
  if (c.field === "project") {
    const sans = !t.projectId && !t.secondaryProjectId;
    dans = (sans && liste.includes(SANS_PROJET)) || (!!t.projectId && liste.includes(t.projectId)) || (!!t.secondaryProjectId && liste.includes(t.secondaryProjectId));
  } else dans = liste.includes(valeurChamp(t, c.field));
  return c.mode === "isnot" ? !dans : dans;
}

export function evalGroupe(t: Tache, g: Groupe | undefined, ctx: Contexte): boolean {
  if (!g || !g.items?.length) return true;
  const r = g.items.map((i) => ("items" in i ? evalGroupe(t, i, ctx) : evalCondition(t, i, ctx)));
  return g.op === "or" ? r.some(Boolean) : r.every(Boolean);
}

const vide = (v: unknown) => v === "" || v == null;

export function correspond(t: Tache, f: Filtres, ctx: Contexte): boolean {
  if (f.search.trim() && !foin(t, ctx).includes(f.search.trim().toLowerCase())) return false;
  if (f.milestone === "yes" && !t.milestone) return false;
  if (f.milestone === "no" && t.milestone) return false;
  if (f.focus === "yes" && !estFocus(t)) return false;
  if (f.focus === "no" && estFocus(t)) return false;
  const pr = Number(t.progress ?? 0);
  if (pr < f.progressMin || pr > f.progressMax) return false;
  if (f.startFrom && (t.start || "") < f.startFrom) return false;
  if (f.startTo && (t.start || "") > f.startTo) return false;
  if (f.endFrom && (t.end || "") < f.endFrom) return false;
  if (f.endTo && (t.end || "") > f.endTo) return false;
  if (f.lateOnly && !estEnRetard(t, ctx.statuts, ctx.aujourdhui)) return false;
  const seuil = !vide(f.inactivityDays) ? Number(f.inactivityDays) : !vide(f.inactivityMinDays) ? Number(f.inactivityMinDays) : null;
  if (seuil != null && !Number.isNaN(seuil) && inactiviteJours(t, ctx.maintenant) <= seuil) return false;
  if (!vide(f.dueWithinDays)) {
    const n = Number(f.dueWithinDays);
    if (!Number.isNaN(n) && (!t.end || t.end < ctx.aujourdhui || t.end > ajouterJours(ctx.aujourdhui, n))) return false;
  }
  if (!vide(f.pastDays)) {
    const n = Number(f.pastDays);
    if (!Number.isNaN(n) && n >= 0 && t.end && t.end < ajouterJours(ctx.aujourdhui, -n)) return false;
  }
  if (f.quickDatePreset && !dansPreselection(t.end, f.quickDatePreset, ctx.aujourdhui)) return false;
  if (f.showDone === false && estTerminee(t, ctx.statuts)) return false;
  if (f.urgentOnly && !estUrgente(t, ctx.statuts)) return false;
  return evalGroupe(t, f.advanced, ctx);
}
