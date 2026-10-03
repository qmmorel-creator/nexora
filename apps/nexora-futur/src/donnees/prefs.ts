// Préférences propres à Nexora Futur (Ref #669), clé nexora:futurPrefs.
// Décision de Quentin (#652) : synchronisées entre appareils, dans une clé
// NOUVELLE que ni nexora-project ni le MCP ne lisent (aucun contrat changé).
import { REGLES_DEFAUT, nettoyerReports, normaliserRegles, type ReglesTriage } from "./triage";
import { PHRASE_VIDE, normaliserPhrase, type PrefsPhrase } from "./phrase";

export interface PrefsPageProjet { ordre: string[]; masquees: string[]; }
export type ModeReference = "aucune" | "courante" | "initiale";
export type StyleFrise = "barres" | "bulles" | "metro";
export interface PrefsFrise { reference: ModeReference; critique: boolean; style: StyleFrise; }
export interface PrefsDensite { mode: "mois" | "croisee" | "pixels"; lignes: string; colonnes: string; mesure: string; vue: "jour" | "semaine" | "mois"; }
export interface PrefsSynthese { style: string; groupe: string; pile: string; jauge: "avgProgress" | "doneRatio"; treemap: string; }
export interface PrefsTableur { colonnes: string[]; }
// Triage (#661) : règles réglables et reports « Revoir dans N jours » (clé de carte → date de retour).
export interface PrefsTriage { regles: ReglesTriage; reports: Record<string, string>; }
export interface PrefsFutur {
  version: 1;
  espaces: Record<string, string>; // dernière adresse de chaque espace
  pageProjet: PrefsPageProjet | null;
  frise: PrefsFrise; // lentille Frise (#658)
  tableur: PrefsTableur | null; // colonnes du Tableur (#658)
  densite: PrefsDensite; // lentille Densité (#658)
  synthese: PrefsSynthese; // lentille Synthèse (#658)
  triage: PrefsTriage; // Triage (#661)
  phrase: PrefsPhrase; // Phrase (#679) : vues enregistrées et tuiles épinglées
  guideVu: boolean; // guide de démarrage déjà montré (#663)
}

export const FRISE_DEFAUT: PrefsFrise = { reference: "aucune", critique: false, style: "barres" };
export const DENSITE_DEFAUT: PrefsDensite = { mode: "mois", lignes: "project", colonnes: "status", mesure: "count", vue: "semaine" };
export const SYNTHESE_DEFAUT: PrefsSynthese = { style: "bar", groupe: "status", pile: "status", jauge: "avgProgress", treemap: "taille" };
export const TRIAGE_DEFAUT: PrefsTriage = { regles: REGLES_DEFAUT, reports: {} };
export const PREFS_VIDES: PrefsFutur = { version: 1, espaces: {}, pageProjet: null, frise: FRISE_DEFAUT, tableur: null, densite: DENSITE_DEFAUT, synthese: SYNTHESE_DEFAUT, triage: TRIAGE_DEFAUT, phrase: PHRASE_VIDE, guideVu: false };
const parmi = <T extends string>(v: unknown, liste: readonly T[], defaut: T): T => (typeof v === "string" && (liste as readonly string[]).includes(v) ? (v as T) : defaut);

const chaines = (l: unknown) => (Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : []);

export function normaliserPrefs(v: unknown): PrefsFutur {
  if (!v || typeof v !== "object") return PREFS_VIDES;
  const b = v as Record<string, unknown>;
  const espaces: Record<string, string> = {};
  if (b.espaces && typeof b.espaces === "object") Object.entries(b.espaces as Record<string, unknown>).forEach(([k, x]) => { if (typeof x === "string" && x.startsWith("/")) espaces[k] = x; });
  const pp = b.pageProjet as Record<string, unknown> | null | undefined;
  const fr = (b.frise && typeof b.frise === "object" ? b.frise : {}) as Record<string, unknown>;
  const tb = b.tableur as Record<string, unknown> | null | undefined;
  return {
    version: 1, espaces,
    pageProjet: pp && Array.isArray(pp.ordre) ? { ordre: chaines(pp.ordre), masquees: chaines(pp.masquees) } : null,
    frise: { reference: fr.reference === "courante" || fr.reference === "initiale" ? fr.reference : "aucune", critique: fr.critique === true, style: parmi(fr.style, ["barres", "bulles", "metro"] as const, "barres") },
    densite: (() => { const x = (b.densite && typeof b.densite === "object" ? b.densite : {}) as Record<string, unknown>; const axes = ["project", "status", "taskType", "criticality", "assignee", "month"] as const; return {
      mode: parmi(x.mode, ["mois", "croisee", "pixels"] as const, DENSITE_DEFAUT.mode), lignes: parmi(x.lignes, axes, "project"), colonnes: parmi(x.colonnes, axes, "status"),
      mesure: parmi(x.mesure, ["count", "late", "criticality", "progress"] as const, "count"), vue: parmi(x.vue, ["jour", "semaine", "mois"] as const, "semaine") }; })(),
    synthese: (() => { const x = (b.synthese && typeof b.synthese === "object" ? b.synthese : {}) as Record<string, unknown>; const champs = ["status", "project", "criticality", "taskType", "assignee", "milestone", "period"] as const; return {
      style: parmi(x.style, ["pie", "bar", "barh", "gauge", "line", "completedPerWeek", "stackedBar"] as const, "bar"), groupe: parmi(x.groupe, champs, "status"), pile: parmi(x.pile, champs, "status"),
      jauge: parmi(x.jauge, ["avgProgress", "doneRatio"] as const, "avgProgress"), treemap: parmi(x.treemap, ["taille", "criticite", "derive", "avancement"] as const, "taille") }; })(),
    tableur: tb && Array.isArray(tb.colonnes) ? { colonnes: chaines(tb.colonnes) } : null,
    triage: (() => { const x = (b.triage && typeof b.triage === "object" ? b.triage : {}) as Record<string, unknown>; return { regles: normaliserRegles(x.regles), reports: nettoyerReports(x.reports, "0000-00-00") }; })(),
    phrase: normaliserPhrase(b.phrase),
    guideVu: b.guideVu === true,
  };
}

// Modifie une partie des préférences en conservant le reste (y compris des
// champs inconnus d'une version future).
export function fusionnerPrefs(actuel: unknown, patch: Partial<Omit<PrefsFutur, "version">>): Record<string, unknown> {
  const base = actuel && typeof actuel === "object" ? (actuel as Record<string, unknown>) : {};
  const n = normaliserPrefs(base);
  return {
    ...base, version: 1, espaces: { ...n.espaces, ...(patch.espaces || {}) },
    pageProjet: patch.pageProjet !== undefined ? patch.pageProjet : n.pageProjet,
    frise: patch.frise ?? n.frise,
    tableur: patch.tableur !== undefined ? patch.tableur : n.tableur,
    densite: patch.densite ?? n.densite,
    synthese: patch.synthese ?? n.synthese,
    triage: patch.triage ?? n.triage,
    phrase: patch.phrase ?? n.phrase,
    guideVu: patch.guideVu ?? n.guideVu,
  };
}
