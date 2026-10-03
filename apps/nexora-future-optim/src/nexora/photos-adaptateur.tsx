// Adaptateur du module photos de Nexora (retours du 03/10/2026) : session
// Firebase d'Optim (même objet `auth` que Nexora), date du jour à Paris et
// emplacement de barre d'outils (sans emplacement, la barre reste dans le module).
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { auth as authFirebase } from "../donnees/firebase";
import { aujourdhuiParis } from "../donnees/modele";

// En démonstration (VITE_DEMO=1) : session fictive, le faux serveur de src/demo/photos-api.ts répond.
export const auth = import.meta.env.VITE_DEMO === "1" ? ({ currentUser: { getIdToken: async () => "demo" } } as unknown as typeof authFirebase) : authFirebase;
export const financeSankeyToday = () => aujourdhuiParis();
export function ViewToolbarPortal({ slot, children }: { slot?: HTMLElement | null; children: ReactNode }) {
  if (!slot) return null;
  return createPortal(<>{children}</>, slot);
}
