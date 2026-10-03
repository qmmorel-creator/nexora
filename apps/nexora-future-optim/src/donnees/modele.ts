// Modèle Nexora (Ref #655) — port fidèle des règles de nexora-project.
// Références : apps/nexora/source/index.html.part-000/001 (voir commentaires).

export type Criticite = "bas" | "moyen" | "urgent";
export const CRITICITES: { id: Criticite; nom: string; couleur: string }[] = [
  { id: "bas", nom: "Bas", couleur: "#1FA971" }, { id: "moyen", nom: "Moyen", couleur: "#D97706" }, { id: "urgent", nom: "Urgent", couleur: "#DC2626" },
];

export interface ElementCheck { id: string; text: string; done: boolean; end?: string; statusId?: string | null; assignee?: string; }
export interface PieceJointe { id: string; type: "link" | "file"; name?: string; url?: string; provider?: string; driveKind?: string; mime?: string; size?: number; addedAt?: string; }
export interface Recurrence { unit: "day" | "week" | "month"; interval: number; }
export interface Tache {
  id: string; title?: string; projectId?: string; secondaryProjectId?: string | null;
  statusId?: string; taskTypeId?: string; criticality?: Criticite | null; focus?: boolean;
  milestone?: boolean; milestoneIcon?: string | null; milestoneTypeId?: string | null;
  start?: string; end?: string; startTime?: string; endTime?: string; progress?: number; estimateMinutes?: number | null;
  desc?: string; meetingReport?: string; assignee?: string;
  checklist?: ElementCheck[]; dependsOn?: string[]; recurrence?: Recurrence | null;
  attachments?: PieceJointe[]; comparison?: { enabled?: boolean; referenceStart?: string | null; referenceEnd?: string | null; capturedAt?: string | null; history?: unknown[] } | null;
  delayRisks?: unknown[]; customFields?: Record<string, unknown>;
  lastInteraction?: string; completedAt?: string; archivedAt?: string;
  source?: string | null; sourceUrl?: string | null; sourceSender?: string | null;
  [autre: string]: unknown;
}
export interface Projet { id: string; name?: string; color?: string; icon?: string; folderId?: string | null; priority?: string; disabledStatusIds?: string[]; disabledTaskTypeIds?: string[]; gcalSource?: boolean; syncedCalendarSource?: boolean; navigationDefaults?: unknown; }
export interface Dossier { id: string; name?: string; color?: string; parentId?: string | null; order?: number; }
export interface Statut { id: string; name?: string; color?: string; icon?: string | null; projectId?: string | null; }
export interface TypeTache { id: string; name?: string; color?: string; icon?: string; projectId?: string | null; locked?: boolean; restrictedStatusId?: string; }
export interface Membre { id: string; name: string; color?: string; email?: string | null; teamIds?: string[]; }
export interface Catalogues { projets: Projet[]; statuts: Statut[]; types: TypeTache[]; membres: Membre[]; }

const nomDe = (x?: { name?: string }) => (x?.name || "").trim();
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function aujourdhuiParis(d = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function ajouterJours(iso: string, n: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1, j + n));
  return d.toISOString().slice(0, 10);
}
export function ecartJours(de: string, a: string): number {
  const v = (s: string) => { const [x, y, z] = s.split("-").map(Number); return Date.UTC(x, y - 1, z) / 86400000; };
  return Math.round(v(a) - v(de));
}
// Identifiant court comme nexora-project (part-000:2674).
export const nouvelId = () => Math.random().toString(36).slice(2, 10);

// part-000:3570
export function estTerminee(t: Tache, statuts: Statut[]): boolean {
  const s = statuts.find((x) => x.id === t.statusId);
  return !!s && /termin/i.test(nomDe(s));
}
// part-000:3574 (une tâche sans fin n'est jamais en retard)
export function estEnRetard(t: Tache, statuts: Statut[], aujourdhui: string): boolean {
  return !!t.end && !estTerminee(t, statuts) && t.end < aujourdhui;
}
// part-000:3425
export function estUrgente(t: Tache, statuts: Statut[]): boolean {
  if (t.criticality) return t.criticality === "urgent";
  const s = statuts.find((x) => x.id === t.statusId);
  return !!s && /urgent/i.test(nomDe(s));
}
// part-000:3582 : uniquement le type, jamais le titre.
export function estReunion(t: Tache, types: TypeTache[]): boolean {
  const ty = types.find((x) => x.id === t.taskTypeId);
  const n = sansAccents(nomDe(ty));
  return n === "reunion" || n === "reunions";
}
export const estFocus = (t: Tache) => t.focus === true;
export const estJalonVisuel = (t: Tache) => !!t.milestone || (!!t.start && t.start === t.end);

const protege = (s: Statut) => /termin/i.test(nomDe(s)) || /en\s*cours/i.test(nomDe(s));

// part-000:2972
export function statutsDuProjet(statuts: Statut[], projets: Projet[], projectId?: string, statutCourant?: string | null): Statut[] {
  const p = projets.find((x) => x.id === projectId);
  const off = new Set(p?.disabledStatusIds || []);
  const ok = statuts.filter((s) => (s.projectId ? s.projectId === projectId : protege(s) || !off.has(s.id)));
  if (statutCourant && !ok.some((s) => s.id === statutCourant)) { const c = statuts.find((s) => s.id === statutCourant); if (c) return [...ok, c]; }
  return ok;
}
export function typesDuProjet(types: TypeTache[], projets: Projet[], projectId?: string, typeCourant?: string | null): TypeTache[] {
  const p = projets.find((x) => x.id === projectId);
  const off = new Set(p?.disabledTaskTypeIds || []);
  const ok = types.filter((t) => (t.projectId ? t.projectId === projectId : t.locked || !off.has(t.id)));
  if (typeCourant && !ok.some((t) => t.id === typeCourant)) { const c = types.find((t) => t.id === typeCourant); if (c) return [...ok, c]; }
  return ok;
}
export function statutParDefaut(statuts: Statut[], projets: Projet[], projectId?: string): Statut | undefined {
  const ok = statutsDuProjet(statuts, projets, projectId);
  return ok.find((s) => /planifier|nouveau|backlog|attente/i.test(nomDe(s))) || ok.find((s) => /en\s*cours/i.test(nomDe(s))) || ok[0];
}
export function typeParDefaut(types: TypeTache[], projets: Projet[], projectId?: string): TypeTache | undefined {
  const ok = typesDuProjet(types, projets, projectId);
  return ok.find((t) => t.locked && /^t[âa]ches?$/i.test(nomDe(t))) || ok.find((t) => t.locked) || ok[0];
}
// Type « Information » : statut imposé (part-000:3075).
export function statutImpose(types: TypeTache[], statuts: Statut[], taskTypeId?: string): Statut | undefined {
  const ty = types.find((t) => t.id === taskTypeId);
  return ty?.restrictedStatusId ? statuts.find((s) => s.id === ty.restrictedStatusId) : undefined;
}
export const estProjetCalendrier = (projets: Projet[], projectId?: string) => { const p = projets.find((x) => x.id === projectId); return !!(p?.gcalSource || p?.syncedCalendarSource); };

export function inactiviteJours(t: Tache, maintenant = new Date()): number {
  if (!t.lastInteraction) return Infinity;
  const ms = maintenant.getTime() - new Date(t.lastInteraction).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 86400000)) : Infinity;
}
