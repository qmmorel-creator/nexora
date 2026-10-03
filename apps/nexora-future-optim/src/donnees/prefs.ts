// Préférences propres à Nexora Future Optim (Ref #687), clé nexora:optimPrefs.
// Décision de Quentin (03/10/2026) : synchronisées entre appareils, dans une
// clé NOUVELLE que ni nexora-project, ni le MCP, ni nexora-futur ne lisent.
// Toute valeur inconnue ou invalide retombe sur la valeur par défaut.

export const STYLES_GANTT = ["ruban", "pixels", "comete", "ecart", "pont", "compte"] as const;
export type StyleGantt = (typeof STYLES_GANTT)[number];
export const ZOOMS = ["semaine", "mois", "trimestre", "annee", "pluri"] as const;
export type Zoom = (typeof ZOOMS)[number];
export const GROUPES_PLANNING = ["projet", "dossier", "responsable", "statut"] as const;
export type GroupePlanning = (typeof GROUPES_PLANNING)[number];
export const GROUPES_PROJET = ["aucun", "statut", "responsable", "type", "criticite", "echeance", "jalon"] as const;
export type GroupeProjet = (typeof GROUPES_PROJET)[number];
export const REFERENCES = ["aucune", "courante", "initiale"] as const;
export type Reference = (typeof REFERENCES)[number];

export interface FiltreVue { q: string; projets: string[]; statuts: string[]; responsables: string[]; types: string[]; criticites: string[]; retard: boolean; jalons: boolean; terminees: boolean; }
export interface VueEnregistree {
  id: string; ecran: "planning" | "projets"; nom: string; filtre: FiltreVue;
  zoom?: Zoom; groupe?: string; style?: StyleGantt; reference?: Reference;
}
export interface PrefsOptim {
  version: 1;
  gantt: StyleGantt;
  planning: { zoom: Zoom; groupe: GroupePlanning; corps: boolean; argent: boolean };
  projets: { zoom: Zoom; groupe: GroupeProjet; reference: Reference };
  couleursHabitudes: Record<string, string>;
  accueil: { pixels: boolean };
  vues: VueEnregistree[];
}

export const FILTRE_VIDE: FiltreVue = { q: "", projets: [], statuts: [], responsables: [], types: [], criticites: [], retard: false, jalons: false, terminees: false };
export const PREFS_VIDES: PrefsOptim = {
  version: 1, gantt: "ruban",
  planning: { zoom: "mois", groupe: "projet", corps: true, argent: false },
  projets: { zoom: "trimestre", groupe: "aucun", reference: "courante" },
  couleursHabitudes: {}, accueil: { pixels: true }, vues: [],
};
// Compatibilité : nom attendu par le magasin de données.
export type PrefsFutur = PrefsOptim;

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const parmi = <T extends string>(v: unknown, liste: readonly T[], defaut: T): T => (typeof v === "string" && (liste as readonly string[]).includes(v) ? (v as T) : defaut);
const chaines = (l: unknown, max = 200) => (Array.isArray(l) ? l.filter((x): x is string => typeof x === "string").slice(0, max) : []);
const COULEUR = /^#[0-9a-f]{6}$/i;
const MAX_VUES = 40;

export function normaliserFiltre(v: unknown): FiltreVue {
  const b = objet(v);
  return {
    q: typeof b.q === "string" ? b.q.slice(0, 120) : "",
    projets: chaines(b.projets), statuts: chaines(b.statuts), responsables: chaines(b.responsables), types: chaines(b.types), criticites: chaines(b.criticites),
    retard: b.retard === true, jalons: b.jalons === true, terminees: b.terminees === true,
  };
}

function normaliserVue(v: unknown): VueEnregistree | null {
  const b = objet(v);
  const id = typeof b.id === "string" ? b.id.slice(0, 40) : "";
  const nom = typeof b.nom === "string" ? b.nom.trim().slice(0, 80) : "";
  if (!id || !nom || (b.ecran !== "planning" && b.ecran !== "projets")) return null;
  return {
    id, nom, ecran: b.ecran, filtre: normaliserFiltre(b.filtre),
    ...(typeof b.zoom === "string" && (ZOOMS as readonly string[]).includes(b.zoom) ? { zoom: b.zoom as Zoom } : {}),
    ...(typeof b.groupe === "string" ? { groupe: b.groupe.slice(0, 20) } : {}),
    ...(typeof b.style === "string" && (STYLES_GANTT as readonly string[]).includes(b.style) ? { style: b.style as StyleGantt } : {}),
    ...(typeof b.reference === "string" && (REFERENCES as readonly string[]).includes(b.reference) ? { reference: b.reference as Reference } : {}),
  };
}

export function normaliserPrefs(v: unknown): PrefsOptim {
  if (!v || typeof v !== "object") return PREFS_VIDES;
  const b = objet(v), pl = objet(b.planning), pj = objet(b.projets), ac = objet(b.accueil);
  const couleurs: Record<string, string> = {};
  Object.entries(objet(b.couleursHabitudes)).forEach(([k, c]) => { if (typeof c === "string" && COULEUR.test(c)) couleurs[k.slice(0, 80)] = c.toLowerCase(); });
  return {
    version: 1,
    gantt: parmi(b.gantt, STYLES_GANTT, PREFS_VIDES.gantt),
    planning: { zoom: parmi(pl.zoom, ZOOMS, "mois"), groupe: parmi(pl.groupe, GROUPES_PLANNING, "projet"), corps: pl.corps !== false, argent: pl.argent === true },
    projets: { zoom: parmi(pj.zoom, ZOOMS, "trimestre"), groupe: parmi(pj.groupe, GROUPES_PROJET, "aucun"), reference: parmi(pj.reference, REFERENCES, "courante") },
    couleursHabitudes: couleurs,
    accueil: { pixels: ac.pixels !== false },
    vues: (Array.isArray(b.vues) ? b.vues : []).map(normaliserVue).filter((x): x is VueEnregistree => !!x).slice(0, MAX_VUES),
  };
}

// Modifie une partie des préférences en conservant le reste, y compris les
// champs inconnus d'une version future.
export function fusionnerPrefs(actuel: unknown, patch: Partial<Omit<PrefsOptim, "version">>): Record<string, unknown> {
  const base = objet(actuel);
  const n = normaliserPrefs(base);
  return { ...base, ...n, ...patch, version: 1 };
}
