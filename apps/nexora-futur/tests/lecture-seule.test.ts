// Invariant du lot 0 (Ref #653) : aucun fichier de src/ n'importe de fonction
// d'écriture Firestore. Le jour où un lot ouvre une écriture, elle passera par
// un module unique, protégé par la garde, ajouté explicitement ici.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ECRITURES = /\b(setDoc|updateDoc|deleteDoc|addDoc|runTransaction|writeBatch)\b/;
// Lot 2 (#655) : unique module d'écriture, protégé par la garde.
const AUTORISES: string[] = ["donnees/ecriture-firebase.ts"];

function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

describe("lecture seule", () => {
  it("aucune fonction d'écriture Firestore dans src/", () => {
    const racine = path.resolve(__dirname, "../src");
    const fautifs = fichiers(racine)
      .filter((f) => !AUTORISES.includes(path.relative(racine, f)))
      .filter((f) => ECRITURES.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
