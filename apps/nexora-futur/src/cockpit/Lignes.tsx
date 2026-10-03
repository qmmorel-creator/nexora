// Lentilles Liste et Colonnes (Ref #655).
import { useState, type DragEvent } from "react";
import { CRITICITES, estEnRetard, estFocus, estReunion, estTerminee, ecartJours, type Catalogues, type Tache } from "../donnees/modele";
import type { ChampGroupe, Paquet } from "../donnees/requete";
import { Etat } from "../composants";

export const initiales = (nom?: string) => (nom || "").split(/\s+/).filter(Boolean).map((m) => m[0]).slice(0, 2).join("").toUpperCase();

export function echeance(t: Tache, statutsFini: boolean, aujourdhui: string): { texte: string; ton: "crit" | "alerte" | "neutre" } {
  if (!t.end) return { texte: "—", ton: "neutre" };
  const n = ecartJours(aujourdhui, t.end);
  if (!statutsFini && n < 0) return { texte: `−${-n} j`, ton: "crit" };
  if (n === 0) return { texte: "auj.", ton: statutsFini ? "neutre" : "alerte" };
  if (n === 1) return { texte: "demain", ton: "neutre" };
  return { texte: t.end.slice(8, 10) + "/" + t.end.slice(5, 7) + (t.end.slice(0, 4) !== aujourdhui.slice(0, 4) ? "/" + t.end.slice(2, 4) : ""), ton: "neutre" };
}

interface PropsLigne { t: Tache; cat: Catalogues; aujourdhui: string; selection: boolean; onSelect: () => void; onOuvrir: () => void; onBasculer: () => void; }

export function Ligne({ t, cat, aujourdhui, selection, onSelect, onOuvrir, onBasculer }: PropsLigne) {
  const fini = estTerminee(t, cat.statuts);
  const p = cat.projets.find((x) => x.id === t.projectId);
  const s = cat.statuts.find((x) => x.id === t.statusId);
  const crit = CRITICITES.find((c) => c.id === t.criticality);
  const e = echeance(t, fini, aujourdhui);
  return (
    <div role="row" aria-selected={selection} data-id={t.id} className={`ligne ${selection ? "sel" : ""} ${fini ? "finie" : ""}`} onClick={onSelect} onDoubleClick={onOuvrir}>
      <span role="gridcell"><button type="button" role="checkbox" aria-checked={fini} aria-label={fini ? `Rouvrir ${t.title}` : `Terminer ${t.title}`} className="case" onClick={(ev) => { ev.stopPropagation(); onBasculer(); }} /></span>
      <span role="gridcell" className="ligne-titre">
        {t.milestone && <span className="marque" title="Jalon">◆</span>}
        {estReunion(t, cat.types) && <span className="marque" title="Réunion">◎</span>}
        <button type="button" className="ligne-lien" onClick={(ev) => { ev.stopPropagation(); onSelect(); onOuvrir(); }}>{t.title || "Sans titre"}</button>
        {estFocus(t) && <span className="etiquette mono">focus</span>}
        {!!t.checklist?.length && <span className="etiquette mono">{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</span>}
      </span>
      <span role="gridcell" className="ligne-projet"><span className="point" style={{ background: p?.color || "var(--encre3)" }} />{p?.name || "Sans projet"}</span>
      <span role="gridcell"><Etat ton={fini ? "ok" : /en\s*cours/i.test(s?.name || "") ? "info" : /attente/i.test(s?.name || "") ? "alerte" : "neutre"}>{s?.name || "Sans statut"}</Etat></span>
      <span role="gridcell" className="avatar" title={t.assignee || "Sans responsable"}>{initiales(t.assignee) || "·"}</span>
      <span role="gridcell" className={`mono ech ech-${e.ton}`}>{e.texte}</span>
      <span role="gridcell" className="crit-barre" style={{ background: crit?.couleur || "transparent" }} title={crit ? `Criticité ${crit.nom}` : "Sans criticité"} />
    </div>
  );
}

interface PropsListe { paquets: Paquet[]; cat: Catalogues; aujourdhui: string; selection?: string; onSelect: (id: string) => void; onOuvrir: (id: string) => void; onBasculer: (id: string) => void; }

export function Liste({ paquets, cat, aujourdhui, selection, onSelect, onOuvrir, onBasculer }: PropsListe) {
  const [replies, setReplies] = useState<Record<string, boolean>>({});
  if (!paquets.some((p) => p.taches.length)) return <div className="vide"><p>Aucune tâche ne correspond à cette requête.</p><p className="discret">Retire une puce, ou affiche les tâches terminées.</p></div>;
  return (
    <div role="grid" aria-label="Tâches" className="liste">
      {paquets.map((p) => (
        <div key={p.cle} role="rowgroup">
          <button type="button" className="groupe" aria-expanded={!replies[p.cle]} onClick={() => setReplies((r) => ({ ...r, [p.cle]: !r[p.cle] }))}>
            <span aria-hidden="true">{replies[p.cle] ? "▸" : "▾"}</span>
            {p.couleur && <span className="point" style={{ background: p.couleur }} />}{p.libelle}<span className="mono discret">· {p.taches.length}</span>
          </button>
          {!replies[p.cle] && p.taches.map((t) => (
            <Ligne key={t.id} t={t} cat={cat} aujourdhui={aujourdhui} selection={selection === t.id} onSelect={() => onSelect(t.id)} onOuvrir={() => onOuvrir(t.id)} onBasculer={() => onBasculer(t.id)} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Champ modifié quand une carte change de colonne.
export function patchColonne(champ: ChampGroupe, cle: string): Partial<Tache> | null {
  const v = cle === "__none" ? "" : cle;
  switch (champ) {
    case "status": return v ? { statusId: v } : null;
    case "project": return v ? { projectId: v } : null;
    case "taskType": return v ? { taskTypeId: v } : null;
    case "criticality": return { criticality: (v || null) as Tache["criticality"] };
    case "assignee": return { assignee: v };
    case "milestone": return { milestone: cle === "yes" };
    case "focus": return { focus: cle === "yes" };
    default: return null;
  }
}

interface PropsColonnes extends PropsListe { champ: ChampGroupe; onDeplacer: (id: string, patch: Partial<Tache>) => void; }

export function Colonnes({ paquets, cat, aujourdhui, selection, onSelect, onOuvrir, champ, onDeplacer }: PropsColonnes) {
  const [survol, setSurvol] = useState<string | null>(null);
  const deplacable = champ !== "period" && champ !== "aucun";
  const deposer = (cle: string) => (ev: DragEvent) => {
    ev.preventDefault(); setSurvol(null);
    const id = ev.dataTransfer.getData("text/nexora-tache");
    const patch = patchColonne(champ, cle);
    if (id && patch) onDeplacer(id, patch);
  };
  return (
    <div className="colonnes" aria-label="Tâches en colonnes">
      {paquets.map((p) => (
        <section key={p.cle} className={`colonne ${survol === p.cle ? "survol" : ""}`} aria-label={`${p.libelle}, ${p.taches.length} tâches`}
          onDragOver={deplacable ? (e) => { e.preventDefault(); setSurvol(p.cle); } : undefined} onDragLeave={() => setSurvol(null)} onDrop={deplacable ? deposer(p.cle) : undefined}>
          <header className="colonne-tete">{p.couleur && <span className="point" style={{ background: p.couleur }} />}<span>{p.libelle}</span><span className="mono discret">{p.taches.length}</span></header>
          <div className="colonne-corps">
            {p.taches.map((t) => {
              const fini = estTerminee(t, cat.statuts);
              const e = echeance(t, fini, aujourdhui);
              const pr = cat.projets.find((x) => x.id === t.projectId);
              const crit = CRITICITES.find((c) => c.id === t.criticality);
              return (
                <article key={t.id} className={`carte-tache ${selection === t.id ? "sel" : ""} ${fini ? "finie" : ""} ${estEnRetard(t, cat.statuts, aujourdhui) ? "retard" : ""}`} draggable={deplacable}
                  onDragStart={(ev) => { ev.dataTransfer.setData("text/nexora-tache", t.id); ev.dataTransfer.effectAllowed = "move"; }}
                  onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)} style={{ borderLeftColor: crit?.couleur || "var(--ligne)" }}>
                  <button type="button" className="ligne-lien carte-titre" onClick={(ev) => { ev.stopPropagation(); onSelect(t.id); onOuvrir(t.id); }}>{t.milestone ? "◆ " : ""}{t.title || "Sans titre"}</button>
                  <div className="carte-meta"><span className="point" style={{ background: pr?.color || "var(--encre3)" }} /><span>{pr?.name || "Sans projet"}</span><span className="marge-auto avatar">{initiales(t.assignee) || "·"}</span><span className={`mono ech ech-${e.ton}`}>{e.texte}</span></div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {!paquets.length && <div className="vide"><p>Aucune tâche ne correspond à cette requête.</p></div>}
    </div>
  );
}
