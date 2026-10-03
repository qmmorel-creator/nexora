// Préférences propres à Nexora Future Optim (Ref #687), clé nexora:optimPrefs.
// Décision de Quentin (03/10/2026) : synchronisées entre appareils, dans une
// clé NOUVELLE que ni nexora-project, ni le MCP, ni nexora-futur ne lisent.
// Toute valeur inconnue ou invalide retombe sur la valeur par défaut.

export const STYLES_GANTT = ["ruban", "pixels", "comete", "ecart", "pont", "compte", "jauge"] as const;
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
// Corps (#689) : quatre cartes, chacune titrée librement, jusqu'à quatre
// mesures (clés de MESURES_SANTE) ; période, regroupement, sections repliées.
export const PERIODES_CORPS = [14, 30, 90, 365] as const;
export type PeriodeCorps = (typeof PERIODES_CORPS)[number];
export const REGROUPEMENTS = ["jour", "semaine", "mois"] as const;
export type RegroupementCorps = (typeof REGROUPEMENTS)[number];
export const MAX_MESURES_CARTE = 4;
export interface CarteCorps { id: string; titre: string; mesures: string[]; }
export const CARTES_DEFAUT: CarteCorps[] = [
  { id: "recup", titre: "Récupération et sommeil", mesures: ["recovery", "sleepHours"] },
  { id: "cardio", titre: "Cardio", mesures: ["hrv", "restingHr"] },
  { id: "comp", titre: "Composition corporelle", mesures: ["weight", "bodyFat"] },
  { id: "vitaux", titre: "Signes vitaux", mesures: ["respRate", "spo2"] },
];
// Accueil (#691) : tuiles affichées, dans l'ordre choisi (les absentes sont masquées).
export const TUILES_ACCUEIL = ["journee", "corps", "semaine", "projets", "argent"] as const;
export type TuileAccueil = (typeof TUILES_ACCUEIL)[number];
// Contenu des blocs Journée et Semaine de l'accueil (retour du 03/10/2026).
export interface BlocJourneeAccueil { cadran: boolean; aujourdhui: boolean; rattraper: boolean; lignes: number; calendriers: boolean; }
export interface BlocSemaineAccueil { jours: 7 | 14; debut: "aujourdhui" | "lundi"; calendriers: boolean; retards: boolean; terminees: boolean; jalonsSeuls: boolean; projets: string[]; }
export const LIGNES_JOURNEE = [5, 8, 12, 20] as const;
export const JOURNEE_ACCUEIL_DEFAUT: BlocJourneeAccueil = { cadran: true, aujourdhui: true, rattraper: true, lignes: 8, calendriers: true };
export const SEMAINE_ACCUEIL_DEFAUT: BlocSemaineAccueil = { jours: 7, debut: "aujourdhui", calendriers: true, retards: false, terminees: false, jalonsSeuls: false, projets: [] };
export const TUILE_CORPS_DEFAUT = ["recovery", "sleepHours", "hrv", "sport"];
// Sport (retour du 03/10/2026) : sports masqués et grandeur affichée.
export const GRANDEURS_SPORT = ["duree", "distance", "denivele"] as const;
export type GrandeurSport = (typeof GRANDEURS_SPORT)[number];
export interface PrefsCorps { periode: PeriodeCorps; regroupement: RegroupementCorps; regroupementSport: RegroupementCorps; cartes: CarteCorps[]; replies: string[]; sportsMasques: string[]; grandeurSport: GrandeurSport;
  // Comparaison des photos (module de Nexora) : réglages d'affichage, comme la config du widget Nexora (bodyPhotos).
  photos: Record<string, unknown>; }

// Argent (#690) : onglet ouvert et durée N de l'évolution du patrimoine.
export const ONGLETS_ARGENT = ["mois", "patrimoine", "pro", "operations"] as const;
export type OngletArgent = (typeof ONGLETS_ARGENT)[number];
export const DUREES_PATRIMOINE = [6, 12, 24, 36, 60] as const;
// Période de l'onglet « Période » (ex-« Mois ») : bouton rapide retenu.
export const CHOIX_PERIODE_ARGENT = ["mois", "mois-prec", "semaine", "annee", "perso"] as const;
export interface PrefsArgent { onglet: OngletArgent; patrimoineMois: number; periode: (typeof CHOIX_PERIODE_ARGENT)[number]; }

export interface PrefsOptim {
  version: 1;
  gantt: StyleGantt;
  planning: { zoom: Zoom; groupe: GroupePlanning; corps: boolean; argent: boolean };
  projets: { zoom: Zoom; groupe: GroupeProjet; reference: Reference };
  couleursHabitudes: Record<string, string>;
  accueil: { pixels: boolean; corps: string[]; tuiles: TuileAccueil[]; journee: BlocJourneeAccueil; semaine: BlocSemaineAccueil };
  corps: PrefsCorps;
  argent: PrefsArgent;
  vues: VueEnregistree[];
}

export const FILTRE_VIDE: FiltreVue = { q: "", projets: [], statuts: [], responsables: [], types: [], criticites: [], retard: false, jalons: false, terminees: false };
export const PREFS_VIDES: PrefsOptim = {
  version: 1, gantt: "ruban",
  planning: { zoom: "mois", groupe: "projet", corps: true, argent: false },
  projets: { zoom: "trimestre", groupe: "aucun", reference: "courante" },
  couleursHabitudes: {}, accueil: { pixels: true, corps: TUILE_CORPS_DEFAUT, tuiles: [...TUILES_ACCUEIL], journee: JOURNEE_ACCUEIL_DEFAUT, semaine: SEMAINE_ACCUEIL_DEFAUT },
  corps: { periode: 30, regroupement: "jour", regroupementSport: "semaine", cartes: CARTES_DEFAUT, replies: [], sportsMasques: [], grandeurSport: "duree", photos: {} },
  argent: { onglet: "mois", patrimoineMois: 24, periode: "mois" },
  vues: [],
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

const CLE_MESURE = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const mesuresValides = (l: unknown, max = MAX_MESURES_CARTE) => [...new Set(chaines(l).filter((k) => CLE_MESURE.test(k)))].slice(0, max);
export function normaliserCorps(v: unknown): PrefsCorps {
  const b = objet(v);
  const brutes = Array.isArray(b.cartes) ? b.cartes : [];
  // Toujours les quatre cartes, dans l'ordre ; titre vide = titre par défaut.
  const cartes = CARTES_DEFAUT.map((d) => {
    const c = objet(brutes.find((x) => objet(x).id === d.id));
    const titre = typeof c.titre === "string" && c.titre.trim() ? c.titre.trim().slice(0, 60) : d.titre;
    return { id: d.id, titre, mesures: Array.isArray(c.mesures) ? mesuresValides(c.mesures) : d.mesures };
  });
  const periode = (PERIODES_CORPS as readonly number[]).includes(b.periode as number) ? (b.periode as PeriodeCorps) : 30;
  return { periode, regroupement: parmi(b.regroupement, REGROUPEMENTS, "jour"), regroupementSport: parmi(b.regroupementSport, REGROUPEMENTS, "semaine"), cartes, replies: chaines(b.replies, 60), sportsMasques: chaines(b.sportsMasques, 40).map((x) => x.slice(0, 60)), grandeurSport: parmi(b.grandeurSport, GRANDEURS_SPORT, "duree"), photos: objet(b.photos) };
}

export function normaliserJourneeAccueil(v: unknown): BlocJourneeAccueil {
  const b = objet(v), D = JOURNEE_ACCUEIL_DEFAUT;
  return { cadran: b.cadran !== false, aujourdhui: b.aujourdhui !== false, rattraper: b.rattraper !== false, lignes: (LIGNES_JOURNEE as readonly number[]).includes(b.lignes as number) ? (b.lignes as number) : D.lignes, calendriers: b.calendriers !== false };
}
export function normaliserSemaineAccueil(v: unknown): BlocSemaineAccueil {
  const b = objet(v);
  return { jours: b.jours === 14 ? 14 : 7, debut: b.debut === "lundi" ? "lundi" : "aujourdhui", calendriers: b.calendriers !== false, retards: b.retards === true, terminees: b.terminees === true, jalonsSeuls: b.jalonsSeuls === true, projets: chaines(b.projets, 100) };
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
    accueil: { pixels: ac.pixels !== false, corps: Array.isArray(ac.corps) ? mesuresValides(ac.corps) : TUILE_CORPS_DEFAUT, tuiles: Array.isArray(ac.tuiles) ? [...new Set(chaines(ac.tuiles).filter((t): t is TuileAccueil => (TUILES_ACCUEIL as readonly string[]).includes(t)))] : [...TUILES_ACCUEIL], journee: normaliserJourneeAccueil(ac.journee), semaine: normaliserSemaineAccueil(ac.semaine) },
    corps: normaliserCorps(b.corps),
    argent: (() => { const a = objet(b.argent); return { onglet: parmi(a.onglet, ONGLETS_ARGENT, "mois"), patrimoineMois: (DUREES_PATRIMOINE as readonly number[]).includes(a.patrimoineMois as number) ? (a.patrimoineMois as number) : 24, periode: parmi(a.periode, CHOIX_PERIODE_ARGENT, "mois") }; })(),
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

// Grille de l'accueil (#691) : largeur naturelle de chaque tuile sur 12
// colonnes ; la dernière tuile d'une rangée incomplète s'élargit pour la
// remplir, quel que soit l'ordre ou les tuiles masquées.
export const LARGEURS_ACCUEIL: Record<TuileAccueil, number> = { journee: 8, corps: 4, semaine: 8, projets: 4, argent: 12 };
export const LARGEURS_ACCUEIL_MOYEN: Record<TuileAccueil, number> = { journee: 12, corps: 12, semaine: 8, projets: 4, argent: 12 };
export function placerTuiles(tuiles: readonly TuileAccueil[], largeurs: Record<TuileAccueil, number>, colonnes = 12): number[] {
  const r: number[] = []; let reste = colonnes;
  tuiles.forEach((t) => {
    const w = Math.min(colonnes, largeurs[t]);
    if (w > reste && r.length) { r[r.length - 1] += reste; reste = colonnes; }
    r.push(w); reste -= w; if (!reste) reste = colonnes;
  });
  if (r.length && reste < colonnes) r[r.length - 1] += reste;
  return r;
}
