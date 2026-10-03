// Magasin de données du Cockpit (Ref #655) : lecture temps réel des clés
// Nexora utiles et actions d'écriture sur les tâches. Une action est une
// fonction pure appliquée à la version la plus récente (rejouable).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LectureCle } from "./firebase";
import type { Source } from "./source";
import { analyserJson } from "./segments";
import { aujourdhuiParis, type Catalogues, type Dossier, type Membre, type Projet, type Statut, type Tache, type TypeTache } from "./modele";
import { horodater } from "./operations";
import { metaFiltresParDefaut, normaliserFiltres, type Filtres } from "./filtres";
import { normaliserJournal, normaliserNonApplicables, normaliserThemes, type EntreeHabitude, type NonApplicable, type ThemeHabitudes } from "./habitudes";
import { ajouterAuJournal, entreesJournal, type EntreeJournal } from "./journal";
import { normaliserPrefs, type PrefsFutur } from "./prefs";
import type { Activite, Depense } from "./projet";

export const CLES = {
  projets: "nexora:projects", dossiers: "nexora:projectFolders", statuts: "nexora:statuses", types: "nexora:taskTypes",
  membres: "nexora:teamMembers", taches: "nexora:tasks", archive: "nexora:taskArchive", favoris: "nexora:favorites",
  metaFiltres: "nexora:metaFilters", defauts: "nexora:taskDefaults", modeles: "nexora:taskTemplates", raccourcis: "nexora:shortcutPrefs",
  themesHabitudes: "nexora:habitThemes", journalHabitudes: "nexora:habitLog", nonApplicables: "nexora:habitSkips",
  depenses: "nexora:expenses", journal: "nexora:activityLog", equipes: "nexora:teams",
  prefs: "nexora:futurPrefs",
} as const;
type NomCle = keyof typeof CLES;

export interface EtatCle { lecture: LectureCle | null; erreur: string | null; charge: boolean; }
export interface Defauts { projectId?: string; secondaryProjectId?: string; taskTypeId?: string; statusId?: string; assignee?: string; criticality?: string; milestone?: string; }
export interface Modele { id: string; name: string; values: Defauts; }
export interface Favori { type: "project" | "view" | "dashboard" | "task"; id: string; }

export interface Donnees extends Catalogues {
  dossiers: Dossier[]; taches: Tache[]; archive: Tache[]; favoris: Favori[]; metaFiltres: Filtres;
  defauts: Defauts; modeles: Modele[]; raccourcis: Record<string, string>;
  themesHabitudes: ThemeHabitudes[]; journalHabitudes: EntreeHabitude[]; nonApplicables: NonApplicable[]; prefs: PrefsFutur;
  depenses: Depense[]; journal: Activite[]; equipes: { id: string; name?: string; color?: string }[];
  etats: Record<NomCle, EtatCle>; charge: boolean; aujourdhui: string;
}

export interface Resultat { message?: string; annuler?: () => Promise<void>; }
export type Mutation = (taches: Tache[], archive: Tache[], cat: Catalogues) => { taches?: Tache[]; archive?: Tache[] };

// Clés JSON modifiables hors tâches (Ref #669).
export type CleJson = "journalHabitudes" | "nonApplicables" | "prefs";
export interface BilanMutation { journal?: string; }

interface Contexte {
  d: Donnees; enCours: number; source: Source;
  executer: (m: Mutation) => Promise<BilanMutation>;
  ecrireJson: (nom: CleJson, f: (valeur: unknown) => unknown) => Promise<void>;
}
const Ctx = createContext<Contexte | null>(null);

const VIDE: EtatCle = { lecture: null, erreur: null, charge: false };

function parse<T>(e: EtatCle, cle: string, defaut: T): T {
  try { return analyserJson<T>(cle, e.lecture?.texte || "", defaut) ?? defaut; } catch { return defaut; }
}

// Applique une mutation aux deux clés concernées. L'archive est écrite
// d'abord (une tâche n'est retirée qu'une fois sa copie en sécurité) ; les
// deux passages partent de la MÊME archive d'origine, sinon une restauration
// rejouée sur l'archive déjà modifiée ne trouverait plus la tâche.
export async function appliquerMutation(source: Pick<Source, "modifier">, m: Mutation, cat: () => Catalogues, instantane: { taches: string; archive: string }, maintenant = () => new Date().toISOString()): Promise<BilanMutation> {
  const lire = (cle: string, txt: string) => analyserJson<Tache[]>(cle, txt, []);
  const sonde = m(lire(CLES.taches, instantane.taches), lire(CLES.archive, instantane.archive), cat());
  let archiveAvant: Tache[] | undefined;
  if (sonde.archive) {
    await source.modifier(CLES.archive, (txt) => {
      archiveAvant = lire(CLES.archive, txt);
      const r = m(lire(CLES.taches, instantane.taches), archiveAvant, cat());
      return JSON.stringify(r.archive ?? archiveAvant);
    });
  }
  if (!sonde.taches) return {};
  // Avant et après de la DERNIÈRE application (celle qui a été écrite, le
  // transformateur pouvant être rejoué sur conflit).
  let avant: Tache[] = []; let apres: Tache[] = []; let at = "";
  await source.modifier(CLES.taches, (txt) => {
    const t = lire(CLES.taches, txt);
    const r = m(t, archiveAvant ?? lire(CLES.archive, instantane.archive), cat());
    at = maintenant();
    avant = t; apres = horodater(t, r.taches ?? t, cat(), at);
    return JSON.stringify(apres);
  });
  const entrees = entreesJournal(avant, apres, cat().statuts, at);
  if (!entrees.length) return {};
  // Les tâches sont déjà enregistrées : un échec du journal est signalé sans
  // annuler l'action.
  try {
    await source.modifier(CLES.journal, (txt) => JSON.stringify(ajouterAuJournal(analyserJson<EntreeJournal[]>(CLES.journal, txt, []), entrees)));
    return {};
  } catch (e) {
    return { journal: (e as Error).message };
  }
}

export function FournisseurDonnees({ children, source }: { children: ReactNode; source: Source }) {
  const [etats, setEtats] = useState<Record<NomCle, EtatCle>>(() => Object.fromEntries(Object.keys(CLES).map((k) => [k, VIDE])) as Record<NomCle, EtatCle>);
  const [jour, setJour] = useState(aujourdhuiParis());
  const [enCours, setEnCours] = useState(0);

  useEffect(() => {
    const arrets = (Object.entries(CLES) as [NomCle, string][]).map(([nom, cle]) =>
      source.ecouter(cle, (lecture) => setEtats((x) => ({ ...x, [nom]: { lecture, erreur: null, charge: true } })),
        (e) => setEtats((x) => ({ ...x, [nom]: { ...x[nom], erreur: e.message, charge: true } }))));
    const minuit = setInterval(() => setJour(aujourdhuiParis()), 60_000);
    return () => { arrets.forEach((a) => a()); clearInterval(minuit); };
  }, [source]);

  const d = useMemo<Donnees>(() => {
    const projets = parse<Projet[]>(etats.projets, CLES.projets, []);
    const dossiers = parse<Dossier[]>(etats.dossiers, CLES.dossiers, []);
    return {
      projets, dossiers: dossiers.some((f) => f.id === "folder-a-trier") ? dossiers : [...dossiers, { id: "folder-a-trier", name: "À trier", parentId: null }],
      statuts: parse<Statut[]>(etats.statuts, CLES.statuts, []), types: parse<TypeTache[]>(etats.types, CLES.types, []),
      membres: parse<Membre[]>(etats.membres, CLES.membres, []), taches: parse<Tache[]>(etats.taches, CLES.taches, []),
      archive: parse<Tache[]>(etats.archive, CLES.archive, []), favoris: parse<Favori[]>(etats.favoris, CLES.favoris, []),
      metaFiltres: normaliserFiltres(parse<unknown>(etats.metaFiltres, CLES.metaFiltres, null), metaFiltresParDefaut),
      defauts: parse<Defauts>(etats.defauts, CLES.defauts, {}), modeles: parse<Modele[]>(etats.modeles, CLES.modeles, []),
      raccourcis: parse<Record<string, string>>(etats.raccourcis, CLES.raccourcis, {}),
      themesHabitudes: normaliserThemes(parse<unknown>(etats.themesHabitudes, CLES.themesHabitudes, [])),
      journalHabitudes: normaliserJournal(parse<unknown>(etats.journalHabitudes, CLES.journalHabitudes, [])),
      nonApplicables: normaliserNonApplicables(parse<unknown>(etats.nonApplicables, CLES.nonApplicables, [])),
      prefs: normaliserPrefs(parse<unknown>(etats.prefs, CLES.prefs, null)),
      depenses: parse<Depense[]>(etats.depenses, CLES.depenses, []), journal: parse<Activite[]>(etats.journal, CLES.journal, []),
      equipes: parse<{ id: string; name?: string; color?: string }[]>(etats.equipes, CLES.equipes, []),
      etats, charge: etats.taches.charge && etats.projets.charge && etats.statuts.charge && etats.types.charge, aujourdhui: jour,
    };
  }, [etats, jour]);

  // Les catalogues et lectures les plus récents servent aux mutations : une
  // action différée (« Annuler » d'une notification) ne doit jamais partir
  // d'un état figé au moment où elle a été créée.
  const catRef = useRef<Catalogues>(d);
  catRef.current = d;
  const etatsRef = useRef(etats);
  etatsRef.current = etats;

  const executer = useCallback(async (m: Mutation) => {
    setEnCours((n) => n + 1);
    try {
      return await appliquerMutation(source, m, () => catRef.current, {
        taches: etatsRef.current.taches.lecture?.texte || "", archive: etatsRef.current.archive.lecture?.texte || "",
      });
    } finally { setEnCours((n) => n - 1); }
  }, [source]);

  // Transformation appliquée à la version la plus récente de la clé (rejouable).
  const ecrireJson = useCallback(async (nom: CleJson, f: (valeur: unknown) => unknown) => {
    setEnCours((n) => n + 1);
    try {
      await source.modifier(CLES[nom], (txt) => JSON.stringify(f(analyserJson<unknown>(CLES[nom], txt, null))));
    } finally { setEnCours((n) => n - 1); }
  }, [source]);

  const valeur = useMemo(() => ({ d, executer, ecrireJson, enCours, source }), [d, executer, ecrireJson, enCours, source]);
  return <Ctx.Provider value={valeur}>{children}</Ctx.Provider>;
}

export function useDonnees(): Contexte {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDonnees hors du FournisseurDonnees");
  return c;
}
