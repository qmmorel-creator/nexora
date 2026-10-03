// Préférences propres à Nexora Futur (Ref #669), clé nexora:futurPrefs.
// Décision de Quentin (#652) : synchronisées entre appareils, dans une clé
// NOUVELLE que ni nexora-project ni le MCP ne lisent (aucun contrat changé).

export interface PrefsPageProjet { ordre: string[]; masquees: string[]; }
export interface PrefsFutur {
  version: 1;
  espaces: Record<string, string>; // dernière adresse de chaque espace
  pageProjet: PrefsPageProjet | null;
}

export const PREFS_VIDES: PrefsFutur = { version: 1, espaces: {}, pageProjet: null };

const chaines = (l: unknown) => (Array.isArray(l) ? l.filter((x): x is string => typeof x === "string") : []);

export function normaliserPrefs(v: unknown): PrefsFutur {
  if (!v || typeof v !== "object") return PREFS_VIDES;
  const b = v as Record<string, unknown>;
  const espaces: Record<string, string> = {};
  if (b.espaces && typeof b.espaces === "object") Object.entries(b.espaces as Record<string, unknown>).forEach(([k, x]) => { if (typeof x === "string" && x.startsWith("/")) espaces[k] = x; });
  const pp = b.pageProjet as Record<string, unknown> | null | undefined;
  return { version: 1, espaces, pageProjet: pp && Array.isArray(pp.ordre) ? { ordre: chaines(pp.ordre), masquees: chaines(pp.masquees) } : null };
}

// Modifie une partie des préférences en conservant le reste (y compris des
// champs inconnus d'une version future).
export function fusionnerPrefs(actuel: unknown, patch: Partial<Omit<PrefsFutur, "version">>): Record<string, unknown> {
  const base = actuel && typeof actuel === "object" ? (actuel as Record<string, unknown>) : {};
  const n = normaliserPrefs(base);
  return { ...base, version: 1, espaces: { ...n.espaces, ...(patch.espaces || {}) }, pageProjet: patch.pageProjet !== undefined ? patch.pageProjet : n.pageProjet };
}
