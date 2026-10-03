// Adaptateur du module photos de Nexora (retour du 03/10/2026) : les images
// arrivent par le relais corps d'Optim (GET /api/optim/corps/body-photos/:id/image,
// lecture seule) au lieu de l'API de nexora-project. URL d'objet en cache
// pour la session ; même contrat que useBodyPhotoUrl de Nexora.
import { useEffect, useState } from "react";
import type { Source } from "../donnees/source";
import { useOptim } from "../optim/contexte";

const urls = new Map<string, Promise<string>>();
const pretes = new Map<string, string>();
function image(source: Source, id: string): Promise<string> {
  const deja = urls.get(id); if (deja) return deja;
  if (!source.corps) return Promise.reject(new Error("Photos non relayées."));
  const p = source.corps.image(id).then((b) => { const u = URL.createObjectURL(b); pretes.set(id, u); return u; });
  urls.set(id, p); p.catch(() => urls.delete(id));
  return p;
}
export function useBodyPhotoUrl(id: string, enabled = true) {
  const { source } = useOptim();
  const [etat, setEtat] = useState<{ id: string; url: string | null; error: string | null }>(() => ({ id, url: pretes.get(id) || null, error: null }));
  useEffect(() => {
    if (!id || !enabled) return undefined;
    let vivant = true;
    image(source, id).then((url) => vivant && setEtat({ id, url, error: null }), (e: Error) => vivant && setEtat({ id, url: null, error: e.message }));
    return () => { vivant = false; };
  }, [source, id, enabled]);
  return etat.id === id ? etat : { id, url: null, error: null };
}
