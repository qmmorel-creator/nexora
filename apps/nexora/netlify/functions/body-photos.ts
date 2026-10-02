import type { Config } from "@netlify/functions";
import { requireOwner } from "./_shared/owner.js";
import { createBodyPhotosHandler } from "./_shared/body-photos.js";
import { firestoreBodyPhotoBlobs, firestoreBodyPhotoStore } from "./_shared/body-photos-store.js";

// Photos corporelles — avant / après (#616). Toutes les routes (liste, import,
// image, date, repères, ajustements, référence, suppression) exigent la
// session Nexora du PROPRIÉTAIRE (requireOwner). Logique et validation dans
// _shared/body-photos.ts ; métadonnées et octets dans Firestore, collections
// dédiées (_shared/body-photos-store.ts).
const handler = createBodyPhotosHandler({
  requireOwner,
  store: firestoreBodyPhotoStore(),
  blobs: firestoreBodyPhotoBlobs(),
});

export default handler;

// Pas de filtre `method` ici : le gestionnaire répond lui-même 405 (avec
// l'en-tête Allow) à une méthode interdite, chemin par chemin.
export const config: Config = { path: ["/api/nexora/body-photos", "/api/nexora/body-photos/*"] };
