// Rail et barre de navigation (Ref #655) : projets en arbre de dossiers,
// favoris, lentilles enregistrées à venir.
import { useMemo, useState } from "react";
import { useDonnees } from "../donnees/magasin";
import { estTerminee, type Dossier, type Projet } from "../donnees/modele";
import { naviguer } from "../navigation/routeur";
import { Kbd } from "../composants";

function Arbre({ dossiers, projets, parent, actif, compte, profondeur }: { dossiers: Dossier[]; projets: Projet[]; parent: string | null; actif?: string; compte: (id: string) => number; profondeur: number }) {
  const [ferme, setFerme] = useState<Record<string, boolean>>({});
  const enfants = dossiers.filter((f) => (f.parentId || null) === parent).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || "").localeCompare(b.name || ""));
  return (
    <>
      {enfants.map((f) => {
        const ps = projets.filter((p) => (p.folderId || "folder-a-trier") === f.id);
        const sous = dossiers.some((x) => x.parentId === f.id);
        if (!ps.length && !sous) return null;
        return (
          <div key={f.id} className="nav-dossier">
            <button type="button" className="nav-dossier-titre" style={{ paddingLeft: 8 + profondeur * 12 }} aria-expanded={!ferme[f.id]} onClick={() => setFerme((x) => ({ ...x, [f.id]: !x[f.id] }))}>
              <span aria-hidden="true">{ferme[f.id] ? "▸" : "▾"}</span>{f.name || "Dossier"}
            </button>
            {!ferme[f.id] && (
              <>
                <Arbre dossiers={dossiers} projets={projets} parent={f.id} actif={actif} compte={compte} profondeur={profondeur + 1} />
                {ps.map((p) => (
                  <a key={p.id} href={`/projets/${encodeURIComponent(p.id)}`} className={`nav-item ${actif === p.id ? "actif" : ""}`} style={{ paddingLeft: 20 + profondeur * 12 }} aria-current={actif === p.id ? "page" : undefined}
                    onClick={(e) => { e.preventDefault(); naviguer(`/projets/${encodeURIComponent(p.id)}`); }}>
                    <span className="point" style={{ background: p.color || "var(--encre3)" }} />{p.name || "Sans nom"}<span className="nav-n mono">{compte(p.id) || ""}</span>
                  </a>
                ))}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

export function Navigation({ projetActif, vue }: { projetActif?: string; vue: string }) {
  const { d } = useDonnees();
  const ouvertes = useMemo(() => {
    const m = new Map<string, number>();
    d.taches.forEach((t) => { if (!estTerminee(t, d.statuts) && t.projectId) m.set(t.projectId, (m.get(t.projectId) || 0) + 1); });
    return m;
  }, [d.taches, d.statuts]);
  const favorisProjets = d.favoris.filter((f) => f.type === "project").map((f) => d.projets.find((p) => p.id === f.id)).filter(Boolean) as Projet[];
  const total = [...ouvertes.values()].reduce((a, b) => a + b, 0);
  return (
    <nav className="nav" aria-label="Navigation principale">
      <a href="/" className={`nav-item ${vue === "fil" ? "actif" : ""}`} aria-current={vue === "fil" ? "page" : undefined} onClick={(e) => { e.preventDefault(); naviguer("/"); }}>Fil du jour</a>
      <a href="/taches" className={`nav-item ${vue === "toutes" ? "actif" : ""}`} onClick={(e) => { e.preventDefault(); naviguer("/taches"); }}>Toutes les tâches<span className="nav-n mono">{total}</span></a>
      <a href="/taches?retard=1" className="nav-item" onClick={(e) => { e.preventDefault(); naviguer("/taches", new URLSearchParams("retard=1")); }}>En retard</a>
      <a href="/taches?focus=yes" className="nav-item" onClick={(e) => { e.preventDefault(); naviguer("/taches", new URLSearchParams("focus=yes")); }}>Focus</a>
      <a href="/archive" className={`nav-item ${vue === "archive" ? "actif" : ""}`} onClick={(e) => { e.preventDefault(); naviguer("/archive"); }}>Archive<span className="nav-n mono">{d.archive.length || ""}</span></a>
      {favorisProjets.length > 0 && <div className="nav-titre surtitre">Favoris</div>}
      {favorisProjets.map((p) => (
        <a key={p.id} href={`/projets/${p.id}`} className={`nav-item ${projetActif === p.id ? "actif" : ""}`} onClick={(e) => { e.preventDefault(); naviguer(`/projets/${encodeURIComponent(p.id)}`); }}>
          <span className="point" style={{ background: p.color || "var(--encre3)" }} />{p.name}
        </a>
      ))}
      <div className="nav-titre surtitre">Projets</div>
      <Arbre dossiers={d.dossiers} projets={d.projets} parent={null} actif={projetActif} compte={(id) => ouvertes.get(id) || 0} profondeur={0} />
      <div className="nav-pied discret"><Kbd>⌘K</Kbd> commandes · <Kbd>?</Kbd> raccourcis</div>
    </nav>
  );
}
