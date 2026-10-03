// Plan d'écriture d'une clé Nexora (Ref #655) — port exact de
// nexoraDirectStorage.set (nexora-project, part-000:960-1080), en fonction pure.
import { MODE_SEGMENTE, type Manifeste } from "./segments";

export const LIMITE_SEGMENT = 150000;
export const MARQUEUR_SEGMENT = "--nexora-chunk--";
export const SOURCE_NAVIGATEUR = "browser";

export class ErreurConflit extends Error {
  readonly code = "NEXORA_SYNC_CONFLICT";
  constructor(message: string) { super(message); this.name = "ErreurConflit"; }
}

export type Operation =
  | { type: "supprimer"; id: string }
  | { type: "ecrire"; id: string; donnees: Record<string, unknown> };

export const jetonRevision = (m: Manifeste | null) => (m ? m.revision || m.updatedAt || null : null);

export function decouper(texte: string): string[] {
  const morceaux: string[] = [];
  for (let i = 0; i < texte.length; i += LIMITE_SEGMENT) morceaux.push(texte.slice(i, i + LIMITE_SEGMENT));
  return morceaux.length ? morceaux : [""];
}

export const idSegment = (cle: string, revision: string, i: number) => `${cle}${MARQUEUR_SEGMENT}${revision}-${String(i).padStart(4, "0")}`;

// `revisionAttendue` : undefined = cette session n'a jamais lu la clé ;
// null = la clé était absente à la lecture ; sinon le jeton lu.
export function planifierEcriture(cle: string, texte: string, revisionAttendue: string | null | undefined, distant: Manifeste | null, maintenant: string, revision: string): Operation[] {
  const distante = jetonRevision(distant);
  if (revisionAttendue === undefined && distant) throw new ErreurConflit(`Conflit de synchronisation sur ${cle} : cette session n'a pas chargé la version Firebase actuelle.`);
  if (revisionAttendue !== undefined && distante !== revisionAttendue) throw new ErreurConflit(`Conflit de synchronisation sur ${cle} : Firebase contient une version plus récente. Aucune donnée n'a été écrasée.`);

  const ops: Operation[] = [];
  const anciens = distant?.storageMode === MODE_SEGMENTE && Array.isArray(distant.chunkIds) ? (distant.chunkIds as string[]) : [];
  anciens.forEach((id) => ops.push({ type: "supprimer", id }));

  const morceaux = decouper(texte);
  if (morceaux.length <= 1) {
    ops.push({ type: "ecrire", id: cle, donnees: { value: texte, updatedAt: maintenant, revision, source: SOURCE_NAVIGATEUR, storageMode: "inline", chunkCount: 0, totalLength: texte.length } });
    return ops;
  }
  const ids = morceaux.map((_, i) => idSegment(cle, revision, i));
  morceaux.forEach((chunk, index) => ops.push({ type: "ecrire", id: ids[index], donnees: { parentKey: cle, revision, index, chunk, updatedAt: maintenant } }));
  ops.push({ type: "ecrire", id: cle, donnees: { value: null, updatedAt: maintenant, revision, source: SOURCE_NAVIGATEUR, storageMode: MODE_SEGMENTE, chunkIds: ids, chunkCount: ids.length, totalLength: texte.length } });
  return ops;
}
