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
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx|mts)$/.test(n) ? [p] : [];
  });
}

// Fonctions serveur : aucune écriture Firestore (firebase-admin), sauf les
// photos corporelles (retour de Quentin du 03/10/2026 : « tout doit être
// possible depuis Optim » ; sevrage de Nexora, #721) — module copié de Nexora,
// collections bodyPhotos / bodyPhotoSettings / bodyPhotoBlobs seulement.
const ECRITURES_ADMIN = /\.(set|update|delete|create|add)\(|batch\(|runTransaction|bulkWriter/;
const SERVEUR_AUTORISES = ["_partage/body-photos-store.ts", "_partage/body-photos.ts"];

describe("lecture seule", () => {
  it("aucune écriture Firestore dans les fonctions serveur", () => {
    const racine = path.resolve(__dirname, "../netlify/functions");
    const fautifs = fichiers(racine).filter((f) => !SERVEUR_AUTORISES.includes(path.relative(racine, f))).filter((f) => ECRITURES_ADMIN.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
  it("les écritures photos ne touchent que les collections des photos", () => {
    const store = readFileSync(path.resolve(__dirname, "../netlify/functions/_partage/body-photos-store.ts"), "utf8").replace(/^\s*\/\/.*$/gm, "");
    const collections = [...store.matchAll(/collection\(([^)]*)\)/g)].map((m) => m[1].trim());
    expect(new Set(collections)).toEqual(new Set(["PHOTOS", "SETTINGS", "BLOBS", "CHUNKS"]));
    expect(store).not.toMatch(/kv_store|users\//);
  });
  it("aucune fonction d'écriture Firestore dans src/", () => {
    const racine = path.resolve(__dirname, "../src");
    const fautifs = fichiers(racine)
      .filter((f) => !AUTORISES.includes(path.relative(racine, f)))
      .filter((f) => ECRITURES.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
