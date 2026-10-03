// Contexte de l'interface Optim (Ref #688) : accès aux données réelles,
// helpers de lecture, préférences synchronisées et état d'interface partagé
// (fiche ouverte, saisie, notification annulable, filtres).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useDonnees, type Mutation } from "../donnees/magasin";
import { ecartJours, estEnRetard, estTerminee, type Projet, type Statut, type Tache } from "../donnees/modele";
import { fusionnerPrefs, FILTRE_VIDE, type FiltreVue, type PrefsOptim, type VueEnregistree } from "../donnees/prefs";
import { trouverHabitude, type Habitude } from "../donnees/habitudes";

export interface Notification { texte: string; annuler?: () => Promise<void> | void; }

interface Ui {
  tacheId: string | null; ouvrir: (id: string | null) => void;
  saisie: boolean; setSaisie: (v: boolean) => void;
  reglages: string | null; setReglages: (onglet: string | null) => void;
  notif: Notification | null; notifier: (n: Notification | null) => void;
  filtre: FiltreVue; setFiltre: (f: FiltreVue) => void;
  vueActive: Record<string, string>; setVueActive: (ecran: string, id: string) => void;
  // Vue à appliquer à l'ouverture de son écran (ouverte depuis les réglages).
  vueEnAttente: VueEnregistree | null; setVueEnAttente: (v: VueEnregistree | null) => void;
}
const CtxUi = createContext<Ui | null>(null);

export function FournisseurUi({ children }: { children: ReactNode }) {
  const [tacheId, ouvrir] = useState<string | null>(null);
  const [saisie, setSaisie] = useState(false);
  const [reglages, setReglages] = useState<string | null>(null);
  const [notif, setNotif] = useState<Notification | null>(null);
  const [filtre, setFiltre] = useState<FiltreVue>(FILTRE_VIDE);
  const [vueActive, setVA] = useState<Record<string, string>>({});
  const [vueEnAttente, setVueEnAttente] = useState<VueEnregistree | null>(null);
  const notifier = useCallback((n: Notification | null) => setNotif(n), []);
  const setVueActive = useCallback((ecran: string, id: string) => setVA((v) => ({ ...v, [ecran]: id })), []);
  const v = useMemo(() => ({ tacheId, ouvrir, saisie, setSaisie, reglages, setReglages, notif, notifier, filtre, setFiltre, vueActive, setVueActive, vueEnAttente, setVueEnAttente }), [tacheId, saisie, reglages, notif, notifier, filtre, vueActive, setVueActive, vueEnAttente]);
  return <CtxUi.Provider value={v}>{children}</CtxUi.Provider>;
}
export function useUi(): Ui {
  const c = useContext(CtxUi);
  if (!c) throw new Error("useUi hors du FournisseurUi");
  return c;
}

const GRIS = "#94a3b8";

// Lecture des données avec les règles de Nexora (port fidèle de Futur).
export function useOptim() {
  const { d, executer, ecrireJson, enCours, source } = useDonnees();
  const jour = d.aujourdhui;
  const parProjet = useMemo(() => new Map(d.projets.map((p) => [p.id, p])), [d.projets]);
  const parStatut = useMemo(() => new Map(d.statuts.map((s) => [s.id, s])), [d.statuts]);
  const projet = useCallback((id?: string | null): Projet & { name: string; color: string } => {
    const p = id ? parProjet.get(id) : undefined;
    return { ...(p || { id: id || "" }), name: p?.name || (id ? "Projet inconnu" : "Sans projet"), color: p?.color || GRIS };
  }, [parProjet]);
  const statut = useCallback((id?: string): Statut & { name: string; color: string } => {
    const s = id ? parStatut.get(id) : undefined;
    return { ...(s || { id: id || "" }), name: s?.name || "Sans statut", color: s?.color || GRIS };
  }, [parStatut]);
  const fini = useCallback((t: Tache) => estTerminee(t, d.statuts), [d.statuts]);
  const retard = useCallback((t: Tache) => estEnRetard(t, d.statuts, jour), [d.statuts, jour]);
  const joursRetard = useCallback((t: Tache) => (t.end ? Math.max(0, ecartJours(t.end, jour)) : 0), [jour]);
  const prefs: PrefsOptim = d.prefs;
  const ecrirePrefs = useCallback((patch: Partial<Omit<PrefsOptim, "version">>) => ecrireJson("prefs", (v) => fusionnerPrefs(v, patch)), [ecrireJson]);
  const couleurHabitude = useCallback((h: Habitude) => prefs.couleursHabitudes[h.id] || h.color || trouverHabitude(d.themesHabitudes, h.id)?.theme.color || GRIS, [prefs.couleursHabitudes, d.themesHabitudes]);
  const executerM = useCallback((m: Mutation) => executer(m), [executer]);
  return { d, jour, projet, statut, fini, retard, joursRetard, prefs, ecrirePrefs, couleurHabitude, executer: executerM, ecrireJson, enCours, source };
}

// --- Formats -----------------------------------------------------------------
export const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const MOIS_L = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_C = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_L = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const utc = (iso: string) => new Date(`${iso}T12:00:00Z`);
export const dateCourte = (iso?: string) => { if (!iso) return "—"; const d = utc(iso); return `${d.getUTCDate()} ${MOIS_C[d.getUTCMonth()]}`; };
export const jourCourt = (iso: string) => JOURS_C[utc(iso).getUTCDay()];
export const jourLong = (iso: string) => { const d = utc(iso); return `${JOURS_L[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS_L[d.getUTCMonth()]}`; };
export const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const initiales = (nom?: string) => (nom || "").split(/\s+/).filter(Boolean).map((x) => x[0]).join("").slice(0, 2).toUpperCase() || "·";
export function semaineIso(iso: string): number {
  const d = utc(iso); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}
export const hm = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? String(min % 60).padStart(2, "0") : ""}` : `${min} min`);
