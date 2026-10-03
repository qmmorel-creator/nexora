// Réglages (Ref #663) : opérations pures sur les collections de configuration
// de nexora-project. Chaque opération porte sur UN élément et conserve tous
// les champs qu'elle ne connaît pas, pour pouvoir être rejouée sur la version
// la plus récente sans écraser le travail d'une autre session.
import type { Dossier, Statut, Tache, TypeTache } from "./modele";
import type { Favori } from "./magasin";

type AvecId = { id: string };
const liste = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// Même format que uid() de nexora-project (part-000:2674).
export const nouvelIdReglage = () => Math.random().toString(36).slice(2, 10);

export function ajouterElement<T extends AvecId>(v: unknown, el: T): T[] {
  const l = liste<T>(v);
  return l.some((x) => x?.id === el.id) ? l : [...l, el];
}
// Un champ à `undefined` est retiré ; les autres champs sont conservés.
export function majElement<T extends AvecId>(v: unknown, id: string, patch: Partial<T> | Record<string, unknown>): T[] {
  return liste<T>(v).map((x) => {
    if (x?.id !== id) return x;
    const n: Record<string, unknown> = { ...x, ...patch };
    Object.keys(patch).forEach((k) => { if ((patch as Record<string, unknown>)[k] === undefined) delete n[k]; });
    return n as T;
  });
}
export const retirerElement = <T extends AvecId>(v: unknown, id: string): T[] => liste<T>(v).filter((x) => x?.id !== id);
export function majObjet(v: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const n: Record<string, unknown> = { ...(v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}), ...patch };
  Object.keys(patch).forEach((k) => { if (patch[k] === undefined || patch[k] === "") delete n[k]; });
  return n;
}

// Suppression protégée : nexora-project refuse de supprimer un projet qui a
// encore des tâches sans passer par un écran dédié ; Futur refuse simplement.
export const usages = (taches: Tache[], archive: Tache[], champ: "projectId" | "statusId" | "taskTypeId", id: string) =>
  taches.filter((t) => t[champ] === id).length + archive.filter((t) => t[champ] === id).length;

// Dossiers imbriqués : un dossier ne peut pas devenir l'enfant de lui-même ou
// d'un de ses descendants.
export function descendants(dossiers: Dossier[], id: string): Set<string> {
  const r = new Set<string>([id]); let ajout = true;
  while (ajout) { ajout = false; dossiers.forEach((f) => { if (f.parentId && r.has(f.parentId) && !r.has(f.id)) { r.add(f.id); ajout = true; } }); }
  return r;
}
export const parentsPossibles = (dossiers: Dossier[], id: string) => { const exclus = descendants(dossiers, id); return dossiers.filter((f) => !exclus.has(f.id)); };

// Statuts et types : globaux (sans projectId) ou propres à un projet.
export const portee = (x: Statut | TypeTache) => (x.projectId ? "projet" : "global");

export function basculerFavori(v: unknown, f: Favori): Favori[] {
  const l = liste<Favori>(v);
  return l.some((x) => x?.type === f.type && x?.id === f.id) ? l.filter((x) => !(x?.type === f.type && x?.id === f.id)) : [...l, f];
}

// Thèmes d'habitudes : les habitudes vivent dans theme.habits.
type ThemeBrut = AvecId & { habits?: unknown[] };
export function majHabitude(v: unknown, themeId: string, habitId: string, patch: Record<string, unknown> | null): ThemeBrut[] {
  return liste<ThemeBrut>(v).map((t) => {
    if (t?.id !== themeId) return t;
    const habits = liste<AvecId>(t.habits);
    return { ...t, habits: patch === null ? habits.filter((h) => h?.id !== habitId) : majElement(habits, habitId, patch) };
  });
}
export function ajouterHabitude(v: unknown, themeId: string, h: AvecId & Record<string, unknown>): ThemeBrut[] {
  return liste<ThemeBrut>(v).map((t) => (t?.id === themeId ? { ...t, habits: ajouterElement(liste<AvecId>(t.habits), h) } : t));
}

export const COULEURS_REGLAGES = ["#2C6BE0", "#4F46E5", "#7A5AF8", "#EC4899", "#E5484D", "#F2A93B", "#22B07D", "#0EA5E9", "#14B8A6", "#7A8290"];
