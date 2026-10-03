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
// Même règle que la normalisation (habitudes.ts, equipe.ts) : id (texte ou nombre) ou, à défaut, le nom.
export const cleDe = (x: unknown): string => { if (!x || typeof x !== "object") return ""; const o = x as { id?: unknown; name?: unknown }; const id = o.id === undefined || o.id === null ? "" : String(o.id).trim(); return id || String(o.name ?? "").trim(); };

// Même format que uid() de Nexora (part-000:2674).
export const nouvelIdReglage = () => Math.random().toString(36).slice(2, 10);
const maintenant = () => new Date().toISOString();

export function ajouterElement<T extends AvecId>(v: unknown, el: T): T[] {
  const l = liste<T>(v);
  return l.some((x) => cleDe(x) === el.id) ? l : [...l, el];
}
// Un champ à `undefined` est retiré ; les autres champs sont conservés ; updatedAt posé.
export function majElement<T extends AvecId>(v: unknown, id: string, patch: Partial<T> | Record<string, unknown>, at: string = maintenant()): T[] {
  return liste<T>(v).map((x) => {
    if (cleDe(x) !== id) return x;
    const n: Record<string, unknown> = { ...x, ...patch, updatedAt: at };
    Object.keys(patch).forEach((k) => { if ((patch as Record<string, unknown>)[k] === undefined) delete n[k]; });
    return n as T;
  });
}
export const retirerElement = <T extends AvecId>(v: unknown, id: string): T[] => liste<T>(v).filter((x) => cleDe(x) !== id);
// Déplacement d'un élément d'un cran (ordre des statuts et types, comme les flèches de Nexora).
export function deplacerElement<T extends AvecId>(v: unknown, id: string, sens: -1 | 1): T[] {
  const l = [...liste<T>(v)]; const i = l.findIndex((x) => cleDe(x) === id), j = i + sens;
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
    if (cleDe(t) !== themeId) return t;
    const habits = liste<AvecId>(t.habits);
    return { ...t, updatedAt: at, habits: patch === null ? habits.filter((h) => cleDe(h) !== habitId) : majElement(habits, habitId, patch, at) };
  });
}
export function ajouterHabitude(v: unknown, themeId: string, h: AvecId & Record<string, unknown>, at: string = maintenant()): ThemeBrut[] {
  return liste<ThemeBrut>(v).map((t) => (cleDe(t) === themeId ? { ...t, updatedAt: at, habits: ajouterElement(liste<AvecId>(t.habits), h) } : t));
}

// Renommer un utilisateur : le nom sert de clé au responsable des tâches.
export function renommerResponsable(v: unknown, ancien: string, nouveau: string, at: string = maintenant()): Tache[] {
  return liste<Tache>(v).map((t) => (t?.assignee === ancien ? { ...t, assignee: nouveau, lastInteraction: at } : t));
}

export const COULEURS_REGLAGES = ["#2C6BE0", "#4F46E5", "#7A5AF8", "#EC4899", "#E5484D", "#F2A93B", "#22B07D", "#0EA5E9", "#14B8A6", "#7A8290"];


// --- Deuxième partie (retour du 03/10/2026) ----------------------------------
export const objetOuVide = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

// Types de jalon : copie de MILESTONE_TYPE_SEED et MILESTONE_SYMBOLS de Nexora
// (part-002:3264-3310). Une liste absente, vide ou illisible rend le catalogue
// de départ ; il reste toujours au moins un type (le premier sert « par défaut »).
export interface TypeJalon { id: string; name: string; symbol: string; color: string; }
export const TYPES_JALON_DEPART: TypeJalon[] = [
  { id: "standard", name: "Jalon", symbol: "diamond", color: "#4F6AF5" },
  { id: "decision", name: "Décision", symbol: "circle", color: "#8B5CF6" },
  { id: "contractual", name: "Engagement contractuel", symbol: "square", color: "#0EA5E9" },
  { id: "delivery", name: "Livraison", symbol: "triangle", color: "#22B07D" },
  { id: "commissioning", name: "Mise en service", symbol: "star5", color: "#F2A93B" },
];
export const SYMBOLES_JALON: { key: string; label: string; d: string; hollow?: boolean }[] = [
  { key: "diamond", label: "Losange", d: "M12 1.5 L22.5 12 L12 22.5 L1.5 12 Z" },
  { key: "diamond-ring", label: "Losange creux", hollow: true, d: "M12 3 L21 12 L12 21 L3 12 Z" },
  { key: "circle", label: "Disque", d: "M12 2 A10 10 0 1 1 11.99 2 Z" },
  { key: "ring", label: "Anneau", hollow: true, d: "M12 3.5 A8.5 8.5 0 1 1 11.99 3.5 Z" },
  { key: "half", label: "Demi-disque", d: "M12 2 A10 10 0 0 1 12 22 Z" },
  { key: "square", label: "Carré", d: "M2.5 2.5 H21.5 V21.5 H2.5 Z" },
  { key: "square-ring", label: "Carré creux", hollow: true, d: "M4 4 H20 V20 H4 Z" },
  { key: "triangle", label: "Triangle", d: "M12 1.5 L22.5 21 H1.5 Z" },
  { key: "triangle-down", label: "Triangle inversé", d: "M1.5 3 H22.5 L12 22.5 Z" },
  { key: "pentagon", label: "Pentagone", d: "M12 1.5 L22.5 9.2 L18.5 21.5 H5.5 L1.5 9.2 Z" },
  { key: "hexagon", label: "Hexagone", d: "M12 1.5 L21.5 7 V17 L12 22.5 L2.5 17 V7 Z" },
  { key: "octagon", label: "Octogone", d: "M8 1.5 H16 L22.5 8 V16 L16 22.5 H8 L1.5 16 V8 Z" },
  { key: "star4", label: "Étoile à 4 branches", d: "M12 1 L14.9 9.1 L23 12 L14.9 14.9 L12 23 L9.1 14.9 L1 12 L9.1 9.1 Z" },
  { key: "star5", label: "Étoile à 5 branches", d: "M12 1.2 L14.9 9.2 L23.4 9.4 L16.7 14.6 L19.1 22.8 L12 17.9 L4.9 22.8 L7.3 14.6 L0.6 9.4 L9.1 9.2 Z" },
  { key: "star6", label: "Étoile à 6 branches", d: "M12 1.5 L20.6 16.5 H3.4 Z M12 22.5 L3.4 7.5 H20.6 Z" },
  { key: "cross", label: "Croix de Saint-André", d: "M5 1.8 L12 8.8 L19 1.8 L22.2 5 L15.2 12 L22.2 19 L19 22.2 L12 15.2 L5 22.2 L1.8 19 L8.8 12 L1.8 5 Z" },
  { key: "plus", label: "Croix", d: "M9.2 1.5 H14.8 V9.2 H22.5 V14.8 H14.8 V22.5 H9.2 V14.8 H1.5 V9.2 H9.2 Z" },
  { key: "flag", label: "Drapeau", d: "M3 1.5 H6 V22.5 H3 Z M6 3 H21 L16.8 8.5 L21 14 H6 Z" },
  { key: "bookmark", label: "Marque-page", d: "M4.5 1.5 H19.5 V22.5 L12 16.5 L4.5 22.5 Z" },
  { key: "shield", label: "Bouclier", d: "M12 1.5 L21 5 V12 C21 17.5 17 21.2 12 22.8 C7 21.2 3 17.5 3 12 V5 Z" },
  { key: "bolt", label: "Éclair", d: "M14 1 L4 13.8 H10.4 L9.4 23 L20 10 H13.1 Z" },
  { key: "droplet", label: "Goutte", d: "M12 1.5 C12 1.5 20 10.2 20 15 A8 8 0 0 1 4 15 C4 10.2 12 1.5 12 1.5 Z" },
  { key: "arrow-right", label: "Flèche droite", d: "M3.5 2 L21 12 L3.5 22 Z" },
  { key: "arrow-left", label: "Flèche gauche", d: "M20.5 2 L3 12 L20.5 22 Z" },
  { key: "arrow-up", label: "Flèche haut", d: "M12 1.5 L21.5 11 H16.2 V22.5 H7.8 V11 H2.5 Z" },
  { key: "arrow-down", label: "Flèche bas", d: "M12 22.5 L2.5 13 H7.8 V1.5 H16.2 V13 H21.5 Z" },
  { key: "chevron", label: "Chevron", d: "M1.5 4 L12 13.5 L22.5 4 V11 L12 20.5 L1.5 11 Z" },
  { key: "bar", label: "Barre", d: "M9 1.5 H15 V22.5 H9 Z" },
];
export function normaliserTypesJalon(v: unknown): TypeJalon[] {
  const l = liste<Record<string, unknown>>(v).filter((x) => x && typeof x.id === "string" && x.id)
    .map((x) => ({ id: String(x.id), name: typeof x.name === "string" && x.name.trim() ? x.name.trim() : "Jalon", symbol: SYMBOLES_JALON.some((s) => s.key === x.symbol) ? String(x.symbol) : "diamond", color: typeof x.color === "string" ? x.color : "#4F6AF5" }));
  return l.length ? l : TYPES_JALON_DEPART.map((t) => ({ ...t }));
}
// Écrit le catalogue de départ avec la première modification (comme Nexora quand la liste est vide).
export const avecDepart = <T extends AvecId>(v: unknown, depart: T[]): T[] => (liste<AvecId>(v).some((x) => x && x.id) ? (v as T[]) : depart.map((x) => ({ ...x })));

// Ateliers : supprimer un atelier le retire des affectations (normalizeStaffingEntries) ; une case vide disparaît.
export function retirerAtelierDesAffectations(v: unknown, atelier: string): unknown[] {
  return liste<Record<string, unknown>>(v).flatMap((e) => {
    if (!e || !Array.isArray(e.workshops)) return [e];
    const ws = (e.workshops as string[]).filter((w) => w !== atelier);
    return ws.length ? [ws.length === (e.workshops as string[]).length ? e : { ...e, workshops: ws }] : [];
  });
}

// Méta-blocs temporels (nexora:metaTemporalBlocks) : périodes affichées en fond des frises.
export interface MetaBloc { id: string; title: string; startDate: string; endDate: string; kind: string; color: string; borderStyle: string; dashboardIds: string[] | null; opacity?: number; }
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function normaliserMetaBlocs(v: unknown): MetaBloc[] {
  return liste<Record<string, unknown>>(v).filter((x) => x && typeof x.id === "string").map((x) => ({
    ...(x as object), id: String(x.id), title: typeof x.title === "string" ? x.title : "", startDate: typeof x.startDate === "string" && ISO.test(x.startDate) ? x.startDate : "",
    endDate: typeof x.endDate === "string" && ISO.test(x.endDate) ? x.endDate : "", kind: typeof x.kind === "string" ? x.kind : "phase", color: typeof x.color === "string" ? x.color : "#7A8290",
    borderStyle: typeof x.borderStyle === "string" ? x.borderStyle : "solid", dashboardIds: Array.isArray(x.dashboardIds) ? (x.dashboardIds as string[]) : null,
  }) as MetaBloc);
}

// Calendriers synchronisés : copie de SYNCED_CALENDAR_DEFS et normalizedSyncedCalendars (part-003:19607).
export const CALENDRIERS_SYNC = [
  { id: "fr-holidays", label: "Jours fériés France", description: "Jours fériés nationaux français", projet: "Jours fériés", couleur: "#2E9B72" },
  { id: "school-holidays", label: "Vacances scolaires", description: "Rentrée, vacances et reprises selon la zone scolaire", projet: "Vacances scolaires", couleur: "#4E7CC7" },
  { id: "clock-changes", label: "Changements d'heure", description: "Passage heure d'été / heure d'hiver", projet: "Changements d'heure", couleur: "#8A64C5" },
  { id: "taxes", label: "Calendrier fiscal DGFiP", description: "Principales dates fiscales des particuliers", projet: "Fiscalité", couleur: "#E5573F" },
];
export function calendriersSync(reglages: unknown) {
  const sauves = liste<Record<string, unknown>>(objetOuVide(reglages).calendars);
  return CALENDRIERS_SYNC.map((def) => { const c = sauves.find((x) => x?.id === def.id) || {};
    return { ...def, enabled: c.enabled !== false, projectName: typeof c.projectName === "string" && c.projectName ? c.projectName : def.projet, color: typeof c.color === "string" && c.color ? c.color : def.couleur, showAsMetaBlock: c.showAsMetaBlock === true }; });
}
// Modifie un calendrier en conservant les autres champs ; écrit la liste complète normalisée (comme Nexora).
export function majCalendrierSync(reglages: unknown, id: string, patch: Record<string, unknown>): Record<string, unknown> {
  const o = objetOuVide(reglages); const sauves = liste<Record<string, unknown>>(o.calendars);
  const calendars = calendriersSync(o).map((c) => { const brut = sauves.find((x) => x?.id === c.id) || {}; const base = { ...brut, id: c.id, enabled: c.enabled, projectName: c.projectName, color: c.color, showAsMetaBlock: c.showAsMetaBlock };
    return c.id === id ? { ...base, ...patch } : base; });
  return { zone: "A", department: "69", ...o, calendars };
}
