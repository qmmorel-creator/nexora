// Préférences d'apparence (Ref #654) : mode clair / sombre / automatique et
// densité. Préférences de confort propres à l'appareil : localStorage, avec
// repli silencieux si le stockage est indisponible.
import type { Densite } from "./jetons";

export type ChoixMode = "auto" | "clair" | "sombre";
export interface Apparence { mode: ChoixMode; densite: Densite; }

export const APPARENCE_DEFAUT: Apparence = { mode: "auto", densite: "compacte" };
const CLE = "nexora-futur:apparence";

export function normaliser(brut: unknown): Apparence {
  const o = (brut && typeof brut === "object" ? brut : {}) as Partial<Apparence>;
  return {
    mode: o.mode === "clair" || o.mode === "sombre" || o.mode === "auto" ? o.mode : APPARENCE_DEFAUT.mode,
    densite: o.densite === "confortable" || o.densite === "compacte" ? o.densite : APPARENCE_DEFAUT.densite,
  };
}

export function lireApparence(stockage: Pick<Storage, "getItem"> | null = safeStorage()): Apparence {
  try { return normaliser(JSON.parse(stockage?.getItem(CLE) || "null")); } catch { return APPARENCE_DEFAUT; }
}

export function enregistrerApparence(a: Apparence, stockage: Pick<Storage, "setItem"> | null = safeStorage()): void {
  try { stockage?.setItem(CLE, JSON.stringify(a)); } catch { /* stockage indisponible : préférence de session */ }
}

export function appliquerApparence(a: Apparence, racine: HTMLElement = document.documentElement): void {
  racine.dataset.mode = a.mode;
  racine.dataset.densite = a.densite;
}

function safeStorage(): Storage | null {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
}
