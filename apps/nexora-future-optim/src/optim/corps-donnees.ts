// Données Corps (Ref #689) : relevés santé et activités sport, lus une fois
// par session par les relais /api/optim/corps/* (lecture seule) et partagés
// entre l'accueil et l'écran Corps.
import { useEffect, useState } from "react";
import type { Source } from "../donnees/source";
import { relevesDe, type Releve } from "../donnees/sante";
import { activitesDe, type Activite } from "../donnees/sport";
import { useOptim } from "./contexte";

export interface DonneesCorps { releves: Releve[]; activites: Activite[]; charge: boolean; erreurSante: string; erreurSport: string; }
const VIDE: DonneesCorps = { releves: [], activites: [], charge: false, erreurSante: "", erreurSport: "" };

const MESSAGES: Record<string, string> = {
  configuration_missing: "configuration serveur incomplète sur nexora-future-optim",
  unauthorized: "session expirée, reconnectez-vous",
};
const message = (e: unknown) => { const c = (e as { code?: string; message?: string })?.code || (e as Error)?.message || "erreur"; return MESSAGES[c] || c; };

const caches = new WeakMap<Source, Promise<DonneesCorps>>();
function charger(source: Source): Promise<DonneesCorps> {
  const deja = caches.get(source); if (deja) return deja;
  const p = (async () => {
    if (!source.corps) return { ...VIDE, charge: true, erreurSante: "santé non relayée", erreurSport: "sport non relayé" };
    const [s, a] = await Promise.allSettled([source.corps.lire("health-records"), source.corps.lire("sport-activities")]);
    const r: DonneesCorps = { ...VIDE, charge: true };
    if (s.status === "fulfilled") { try { r.releves = relevesDe(s.value).sort((x, y) => x.date.localeCompare(y.date)); } catch (e) { r.erreurSante = message(e); } } else r.erreurSante = message(s.reason);
    if (a.status === "fulfilled") { try { r.activites = activitesDe(a.value).sort((x, y) => x.date.localeCompare(y.date)); } catch (e) { r.erreurSport = message(e); } } else r.erreurSport = message(a.reason);
    return r;
  })();
  caches.set(source, p);
  // Un échec n'est pas gardé en cache : nouvel essai à la prochaine ouverture.
  p.then((r) => { if (r.erreurSante || r.erreurSport) caches.delete(source); });
  return p;
}

export function useCorps(): DonneesCorps {
  const { source } = useOptim();
  const [d, setD] = useState<DonneesCorps>(VIDE);
  useEffect(() => { let vivant = true; void charger(source).then((r) => { if (vivant) setD(r); }); return () => { vivant = false; }; }, [source]);
  return d;
}

// Présentation des mesures (port de MDEF du prototype) : couleur, sens
// (plus bas = mieux), zones, objectif, bornes et barres.
export interface StyleMesure { couleur: string; inverse?: boolean; zones?: [number, number, string][]; objectif?: number; min?: number; max?: number; barres?: boolean; points?: (v: number) => string; }
const zoneRecup = (v: number) => (v >= 67 ? "#16a34a" : v >= 34 ? "#e0a21b" : "#dc2626");
export const STYLES_MESURES: Record<string, StyleMesure> = {
  recovery: { couleur: "#16a34a", zones: [[0, 33, "#dc2626"], [34, 66, "#e0a21b"], [67, 100, "#16a34a"]], min: 0, max: 100, points: zoneRecup },
  sleepHours: { couleur: "#5b7bd8", objectif: 8 }, sleepPerf: { couleur: "#6d83de", min: 0, max: 100 }, sleepEff: { couleur: "#7c8fe0", min: 0, max: 100 },
  deepSleep: { couleur: "#3d5ab8" }, remSleep: { couleur: "#8a6fd6" },
  hrv: { couleur: "#0f9d76" }, restingHr: { couleur: "#d64545", inverse: true }, respRate: { couleur: "#0e7490", inverse: true },
  spo2: { couleur: "#2563eb", min: 90, max: 100 }, skinTemp: { couleur: "#c2410c" },
  weight: { couleur: "#475569", inverse: true }, bodyFat: { couleur: "#b45309", inverse: true }, muscleMass: { couleur: "#0f766e" }, muscleRate: { couleur: "#0f766e" },
  strain: { couleur: "#7c3aed" }, calories: { couleur: "#ea580c", barres: true }, steps: { couleur: "#7c5cd6", objectif: 10000, barres: true },
  stress: { couleur: "#db2777", inverse: true }, hrZone45: { couleur: "#be123c", barres: true }, vo2max: { couleur: "#0369a1" }, sportDuration: { couleur: "#0e7490", barres: true },
  caloriesIn: { couleur: "#ca8a04", barres: true }, proteins: { couleur: "#65a30d", barres: true }, carbs: { couleur: "#d97706", barres: true },
};
export const styleMesure = (k: string): StyleMesure => STYLES_MESURES[k] || { couleur: "#475569" };
