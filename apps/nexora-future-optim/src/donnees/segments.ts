// Lecture du stockage segmenté de Nexora (format « chunked-v1 », identique à
// nexora-project, part-000:877-1000). Fonctions pures : aucun accès réseau.

export const MODE_SEGMENTE = "chunked-v1";

export interface Manifeste {
  value?: unknown;
  storageMode?: string;
  chunkIds?: unknown;
  chunkCount?: unknown;
  totalLength?: unknown;
  revision?: string | null;
  updatedAt?: string | null;
  source?: string | null;
}

export interface Segment {
  parentKey?: string;
  revision?: string | null;
  chunk?: unknown;
}

export function idsSegments(m: Manifeste): string[] {
  if (m.storageMode !== MODE_SEGMENTE) return [];
  const ids = Array.isArray(m.chunkIds) ? m.chunkIds.filter((x): x is string => typeof x === "string") : [];
  if (!ids.length && Number(m.chunkCount || 0) > 0) {
    throw new Error("Stockage segmenté incomplet : manifeste sans segments.");
  }
  return ids;
}

// Reconstitue la valeur texte d'une clé. `segments[i]` vaut null si absent.
export function reconstituer(cle: string, m: Manifeste, segments: (Segment | null)[]): string {
  if (m.storageMode !== MODE_SEGMENTE) return typeof m.value === "string" ? m.value : m.value == null ? "" : JSON.stringify(m.value);
  const ids = idsSegments(m);
  if (segments.length !== ids.length) throw new Error(`Stockage segmenté incomplet pour ${cle} : ${segments.length}/${ids.length} segments.`);
  const texte = segments.map((s, i) => {
    if (!s) throw new Error(`Stockage segmenté incomplet pour ${cle} : segment ${i + 1}/${ids.length} absent.`);
    if (s.parentKey !== cle || s.revision !== m.revision) throw new Error(`Stockage segmenté incohérent pour ${cle} : segment ${i + 1} d'une autre révision.`);
    return String(s.chunk ?? "");
  }).join("");
  const total = Number(m.totalLength);
  if (Number.isFinite(total) && m.totalLength != null && texte.length !== total) {
    throw new Error(`Stockage segmenté incomplet pour ${cle} : ${texte.length}/${total} caractères.`);
  }
  return texte;
}

export function analyserJson<T>(cle: string, texte: string, defaut: T): T {
  if (!texte) return defaut;
  try { return JSON.parse(texte) as T; } catch { throw new Error(`Valeur illisible pour ${cle} : JSON invalide.`); }
}
