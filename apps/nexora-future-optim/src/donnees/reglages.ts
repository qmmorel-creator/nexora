// Réglages repris de Nexora (retour de Quentin du 03/10/2026, sevrage #721 étape 5).
// Opérations pures sur les catalogues de configuration partagés avec Nexora,
// reprises de Nexora Futur (src/donnees/reglages.ts, Ref #663) avec les règles
// de Nexora que Futur n'appliquait pas :
// - chaque élément MODIFIÉ reçoit updatedAt (comme stampChangedEntities de Nexora,
//   part-001:8688) : Nexora fusionne ces clés élément par élément et garde la
//   version la plus récente ; une création n'est pas horodatée ;
// - statuts protégés (nom contenant « termin » ou « en cours », part-000:2967) :
//   ni renommage, ni changement de portée, ni suppression (couleur seule) ;
// - renommer un utilisateur réécrit le responsable des tâches (part-002:14745).
// Chaque opération porte sur UN élément et conserve les champs qu'elle ne connaît pas.
import type { Dossier, Statut, Tache, TypeTache } from "./modele";

type AvecId = { id: string };
const liste = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

// Même format que uid() de Nexora (part-000:2674).
export const nouvelIdReglage = () => Math.random().toString(36).slice(2, 10);
const maintenant = () => new Date().toISOString();

export function ajouterElement<T extends AvecId>(v: unknown, el: T): T[] {
  const l = liste<T>(v);
  return l.some((x) => x?.id === el.id) ? l : [...l, el];
}
// Un champ à `undefined` est retiré ; les autres champs sont conservés ; updatedAt posé.
export function majElement<T extends AvecId>(v: unknown, id: string, patch: Partial<T> | Record<string, unknown>, at: string = maintenant()): T[] {
  return liste<T>(v).map((x) => {
    if (x?.id !== id) return x;
    const n: Record<string, unknown> = { ...x, ...patch, updatedAt: at };
    Object.keys(patch).forEach((k) => { if ((patch as Record<string, unknown>)[k] === undefined) delete n[k]; });
    return n as T;
  });
}
export const retirerElement = <T extends AvecId>(v: unknown, id: string): T[] => liste<T>(v).filter((x) => x?.id !== id);
// Déplacement d'un élément d'un cran (ordre des statuts et types, comme les flèches de Nexora).
export function deplacerElement<T extends AvecId>(v: unknown, id: string, sens: -1 | 1): T[] {
  const l = [...liste<T>(v)]; const i = l.findIndex((x) => x?.id === id), j = i + sens;
  if (i < 0 || j < 0 || j >= l.length) return l;
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}
export function majObjet(v: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const n: Record<string, unknown> = { ...(v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {}), ...patch };
  Object.keys(patch).forEach((k) => { if (patch[k] === undefined || patch[k] === "") delete n[k]; });
  return n;
}

// Suppression protégée : comptée sur les tâches ET l'archive (plus prudent que Nexora).
export const usages = (taches: Tache[], archive: Tache[], champ: "projectId" | "statusId" | "taskTypeId", id: string) =>
  taches.filter((t) => t[champ] === id).length + archive.filter((t) => t[champ] === id).length;

// Statut protégé : la détection « terminé » des tâches et des projets calendrier en dépend.
export const statutProtege = (s: Pick<Statut, "name">) => /termin/i.test(String(s.name || "")) || /en\s*cours/i.test(String(s.name || ""));

// Dossiers imbriqués : un dossier ne peut pas devenir l'enfant de lui-même ou d'un descendant.
export function descendants(dossiers: Pick<Dossier, "id" | "parentId">[], id: string): Set<string> {
  const r = new Set<string>([id]); let ajout = true;
  while (ajout) { ajout = false; dossiers.forEach((f) => { if (f.parentId && r.has(f.parentId) && !r.has(f.id)) { r.add(f.id); ajout = true; } }); }
  return r;
}
export const parentsPossibles = <D extends Pick<Dossier, "id" | "parentId">>(dossiers: D[], id: string) => { const exclus = descendants(dossiers, id); return dossiers.filter((f) => !exclus.has(f.id)); };

export const portee = (x: Statut | TypeTache) => (x.projectId ? "projet" : "global");

// Thèmes d'habitudes : les habitudes vivent dans theme.habits ; le thème modifié est horodaté.
type ThemeBrut = AvecId & { habits?: unknown[] };
export function majHabitude(v: unknown, themeId: string, habitId: string, patch: Record<string, unknown> | null, at: string = maintenant()): ThemeBrut[] {
  return liste<ThemeBrut>(v).map((t) => {
    if (t?.id !== themeId) return t;
    const habits = liste<AvecId>(t.habits);
    return { ...t, updatedAt: at, habits: patch === null ? habits.filter((h) => h?.id !== habitId) : majElement(habits, habitId, patch, at) };
  });
}
export function ajouterHabitude(v: unknown, themeId: string, h: AvecId & Record<string, unknown>, at: string = maintenant()): ThemeBrut[] {
  return liste<ThemeBrut>(v).map((t) => (t?.id === themeId ? { ...t, updatedAt: at, habits: ajouterElement(liste<AvecId>(t.habits), h) } : t));
}

// Renommer un utilisateur : le nom sert de clé au responsable des tâches.
export function renommerResponsable(v: unknown, ancien: string, nouveau: string, at: string = maintenant()): Tache[] {
  return liste<Tache>(v).map((t) => (t?.assignee === ancien ? { ...t, assignee: nouveau, lastInteraction: at } : t));
}

export const COULEURS_REGLAGES = ["#2C6BE0", "#4F46E5", "#7A5AF8", "#EC4899", "#E5484D", "#F2A93B", "#22B07D", "#0EA5E9", "#14B8A6", "#7A8290"];
