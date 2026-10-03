// Types minimaux du modèle Nexora (lot 0). Complétés au lot 2.
export interface Projet { id: string; name?: string; color?: string; folderId?: string | null; }
export interface Tache { id: string; title?: string; projectId?: string; statusId?: string; end?: string; completedAt?: string | null; }
export interface Statut { id: string; name?: string; }

const TERMINE = /termin|done|fini/i;

export function estTerminee(t: Tache, statuts: Statut[]): boolean {
  if (t.completedAt) return true;
  const s = statuts.find((x) => x.id === t.statusId);
  return !!s && TERMINE.test(s.name || "");
}

export function estEnRetard(t: Tache, statuts: Statut[], aujourdhui: string): boolean {
  return !!t.end && t.end < aujourdhui && !estTerminee(t, statuts);
}

export function aujourdhuiParis(d = new Date()): string {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
