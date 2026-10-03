// Adresses par lentille (Ref #655) : history API, lien profond et Précédent.
import { useEffect, useState } from "react";

export interface Route { chemin: string; segments: string[]; params: URLSearchParams; }
const lire = (): Route => ({ chemin: location.pathname, segments: location.pathname.split("/").filter(Boolean).map(decodeURIComponent), params: new URLSearchParams(location.search) });
const EVT = "nexora:navigation";

export function naviguer(chemin: string, params?: URLSearchParams, remplacer = false): void {
  const q = params && params.toString() ? `?${params}` : "";
  const cible = `${chemin}${q}`;
  if (cible === location.pathname + location.search) return;
  history[remplacer ? "replaceState" : "pushState"](null, "", cible);
  window.dispatchEvent(new Event(EVT));
}

export function useRoute(): Route {
  const [r, setR] = useState(lire);
  useEffect(() => {
    const maj = () => setR(lire());
    window.addEventListener("popstate", maj); window.addEventListener(EVT, maj);
    return () => { window.removeEventListener("popstate", maj); window.removeEventListener(EVT, maj); };
  }, []);
  return r;
}
