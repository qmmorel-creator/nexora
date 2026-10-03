// Garde d'écriture (Ref #653). Tout chemin d'écriture vers Firestore passe par
// `exigerEcriture` ; tant que la clé n'est pas ouverte, l'écriture est refusée
// avant tout appel réseau.

export class ErreurLectureSeule extends Error {
  readonly code = "NEXORA_FUTUR_LECTURE_SEULE";
  constructor(readonly cle: string) {
    super(`Nexora Futur est en lecture seule : écriture refusée sur « ${cle} ».`);
    this.name = "ErreurLectureSeule";
  }
}

export function ecritureAutorisee(cle: string, ouvertes: readonly string[]): boolean {
  return typeof cle === "string" && cle.length > 0 && ouvertes.includes(cle);
}

export function exigerEcriture(cle: string, ouvertes: readonly string[]): void {
  if (!ecritureAutorisee(cle, ouvertes)) throw new ErreurLectureSeule(cle);
}
