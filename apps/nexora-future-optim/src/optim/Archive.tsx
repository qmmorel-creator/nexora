// Archive (Ref #709), reprise de la vue Archive de Nexora Futur et réécrite dans
// le langage d'Optim : tâches de nexora:taskArchive (archivage le plus récent en
// tête), restauration annulable, et en plus dans Optim : recherche par titre,
// filtre par projet, restauration multiple. La mention « purge après 30 jours »
// est informative : ce site ne purge rien (c'est Nexora qui le fait).
import { useMemo, useState } from "react";
import { archiverPlusieurs, archiverTache, restaurerPlusieurs, restaurerTache } from "../donnees/actions";
import { listeArchive } from "../donnees/archive";
import { useOptim, useUi } from "./contexte";

const dateArchivage = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "date inconnue");

export function Archive() {
  const { d, projet, executer } = useOptim();
  const { notifier } = useUi();
  const [q, setQ] = useState("");
  const [projetFiltre, setProjetFiltre] = useState<string | null>(null);
  const [coches, setCoches] = useState<string[]>([]);
  const liste = useMemo(() => listeArchive(d.archive, { q, projet: projetFiltre }), [d.archive, q, projetFiltre]);
  const projetsPresents = useMemo(() => [...new Set(d.archive.map((t) => t.projectId))].map((id) => projet(id)).sort((a, b) => (a.name || "").localeCompare(b.name || "", "fr")), [d.archive, projet]);
  const visibles = new Set(liste.map((t) => t.id));
  const choisis = coches.filter((id) => visibles.has(id));
  const tous = liste.length > 0 && choisis.length === liste.length;

  const agir = async (m: Parameters<typeof executer>[0], texte: string, annuler: Parameters<typeof executer>[0]) => {
    try { await executer(m); notifier({ texte, annuler: () => void executer(annuler) }); }
    catch (e) { notifier({ texte: `Action refusée : ${(e as Error).message}` }); }
  };
  const restaurer = (id: string, titre: string) => { setCoches((c) => c.filter((x) => x !== id)); void agir(restaurerTache(id), `« ${titre} » restaurée`, archiverTache(id)); };
  const restaurerChoisis = () => { const ids = choisis; setCoches([]); void agir(restaurerPlusieurs(ids), `${ids.length} tâche${ids.length > 1 ? "s" : ""} restaurée${ids.length > 1 ? "s" : ""}`, archiverPlusieurs(ids)); };
  const basculer = (id: string) => setCoches((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <main className="hx-main ox-ar" data-scroll>
      <div className="hx-hello"><h1>Archive <span>{d.archive.length} tâche{d.archive.length > 1 ? "s" : ""} archivée{d.archive.length > 1 ? "s" : ""} · purge après 30 jours</span></h1>
        <p>La purge est faite par Nexora ; Nexora Future Optim ne supprime rien. Archiver se fait depuis la fiche d'une tâche.</p></div>
      <div className="hx-tile ox-ar-barre">
        <input type="search" className="ox-ar-q" placeholder="Rechercher un titre" aria-label="Rechercher dans l'archive" value={q} onChange={(e) => setQ(e.target.value)} />
        <select aria-label="Filtrer par projet" value={projetFiltre || ""} onChange={(e) => setProjetFiltre(e.target.value || null)}>
          <option value="">Tous les projets</option>
          {projetsPresents.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
        </select>
        <span className="hx-dim">{liste.length} affichée{liste.length > 1 ? "s" : ""}</span>
        <button type="button" className="hx-btn is-primary" disabled={!choisis.length} onClick={restaurerChoisis}>Restaurer la sélection{choisis.length ? ` (${choisis.length})` : ""}</button>
      </div>
      {liste.length ? (
        <div className="hx-tile ox-ar-liste" role="table" aria-label="Tâches archivées">
          <div className="ox-ar-l is-tete" role="row">
            <span role="columnheader"><input type="checkbox" aria-label="Tout sélectionner" checked={tous} onChange={() => setCoches(tous ? [] : liste.map((t) => t.id))} /></span>
            <span role="columnheader">Tâche</span><span role="columnheader">Projet</span><span role="columnheader">Archivée le</span><span role="columnheader" />
          </div>
          {liste.map((t) => { const p = projet(t.projectId); return (
            <div key={t.id} className={`ox-ar-l ${coches.includes(t.id) ? "is-sel" : ""}`} role="row">
              <span role="cell"><input type="checkbox" aria-label={`Sélectionner « ${t.title} »`} checked={coches.includes(t.id)} onChange={() => basculer(t.id)} /></span>
              <span role="cell" className="ox-ar-t">{t.title || "Sans titre"}</span>
              <span role="cell" className="ox-ar-p"><i style={{ background: p.color }} />{p.name || "Sans projet"}</span>
              <span role="cell" className="ox-ar-d">{dateArchivage(t.archivedAt)}</span>
              <span role="cell"><button type="button" className="hx-btn is-sm" onClick={() => restaurer(t.id, t.title || "Sans titre")}>Restaurer</button></span>
            </div>); })}
        </div>
      ) : <p className="hx-tile hx-dim">{d.archive.length ? "Aucune tâche archivée ne correspond." : "Aucune tâche archivée."}</p>}
    </main>
  );
}
