// Archive (Ref #709) : liste des tâches de nexora:taskArchive, triée par date
// d'archivage décroissante (comme la vue Archive de Nexora Futur), avec une
// recherche par titre et un filtre par projet ajoutés dans Optim.
import type { Tache } from "./modele";

export interface FiltreArchive { q: string; projet: string | null; }
const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function listeArchive(archive: Tache[], f: FiltreArchive): Tache[] {
  const q = sansAccents(f.q.trim());
  return archive
    .filter((t) => (!f.projet || t.projectId === f.projet) && (!q || sansAccents(t.title || "").includes(q)))
    .sort((a, b) => (b.archivedAt || "").localeCompare(a.archivedAt || "") || (a.title || "").localeCompare(b.title || "", "fr"));
}
