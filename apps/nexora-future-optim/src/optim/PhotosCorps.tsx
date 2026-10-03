// Photos corporelles (retours du 03/10/2026) : le widget de Nexora complet
// (src/nexora/photos-nexora.jsx, repris tel quel) — import, date, repères,
// affinage, rognage, référence, suppression et comparaison — sur la route
// /api/optim/photos d'Optim (même stockage Firestore que Nexora). Réglages
// d'affichage (photo de droite, volet, repères, rognages) dans
// nexora:optimPrefs, comme la config du widget Nexora (bodyPhotos).
import { WidgetBodyPhotos } from "../nexora/photos-nexora";
import type { PrefsCorps } from "../donnees/prefs";

export function PhotosCorps({ c, maj }: { c: PrefsCorps; maj: (p: Partial<PrefsCorps>) => void }) {
  return <div className="ox-photos-cadre"><WidgetBodyPhotos widget={{ bodyPhotos: c.photos }} onUpdateWidget={(p) => maj({ photos: p.bodyPhotos })} /></div>;
}
