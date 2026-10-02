import type { Config } from "@netlify/functions";
import { requireOwner } from "./_shared/owner.js";
import { createBodyPhotosHandler } from "./_shared/body-photos.js";
import { firestoreBodyPhotoStore, googleDriveBodyPhotos } from "./_shared/body-photos-store.js";

declare const Netlify: { env: { get(name: string): string | undefined } };

// Photos corporelles — avant / après (#616). Toutes les routes (liste, import,
// image, date, repères, ajustements, référence, suppression) exigent la
// session Nexora du PROPRIÉTAIRE (requireOwner). Logique et validation dans
// _shared/body-photos.ts ; stockage dans _shared/body-photos-store.ts.
// Dossier Drive dédié : variable NEXORA_BODY_PHOTOS_FOLDER_ID (production).
const handler = createBodyPhotosHandler({
  requireOwner,
  folderId: () => Netlify.env.get("NEXORA_BODY_PHOTOS_FOLDER_ID"),
  store: firestoreBodyPhotoStore(),
  drive: googleDriveBodyPhotos(),
});

export default handler;

// Pas de filtre `method` ici : le gestionnaire répond lui-même 405 (avec
// l'en-tête Allow) à une méthode interdite, chemin par chemin.
export const config: Config = { path: ["/api/nexora/body-photos", "/api/nexora/body-photos/*"] };
