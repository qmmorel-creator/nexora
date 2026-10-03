// Lentille Tableur (Ref #658) : édition en ligne et en masse, port de
// TableView (nexora-project part-003:1546-1935). Toute modification passe par
// les mêmes règles que la fiche (statut imposé, jalon, dépendances).
import { useEffect, useMemo, useState } from "react";
import { CRITICITES, estEnRetard, estProjetCalendrier, estTerminee, inactiviteJours, statutImpose, statutsDuProjet, typesDuProjet, type Catalogues, type Tache } from "../donnees/modele";
import type { Paquet } from "../donnees/requete";
import { comparaison, libelleEcart, type Baselines } from "../donnees/planning";
import { Bouton, Etat } from "../composants";

export const COLONNES_TABLEUR: { cle: string; libelle: string; lecture?: boolean }[] = [
  { cle: "project", libelle: "Projet" }, { cle: "status", libelle: "Statut" }, { cle: "start", libelle: "Début" }, { cle: "end", libelle: "Fin" },
  { cle: "progress", libelle: "Avancement" }, { cle: "assignee", libelle: "Responsable" }, { cle: "milestone", libelle: "Jalon" }, { cle: "focus", libelle: "Focus" },
  { cle: "criticality", libelle: "Criticité" }, { cle: "lastInteraction", libelle: "Dernière modif.", lecture: true }, { cle: "inactivity", libelle: "Inactivité", lecture: true },
  { cle: "dependsOn", libelle: "Dépendances", lecture: true }, { cle: "referenceEnd", libelle: "Fin de référence", lecture: true }, { cle: "delta", libelle: "Écart", lecture: true },
  { cle: "delayRisks", libelle: "Risques", lecture: true },
];
export const COLONNES_DEFAUT = ["project", "status", "start", "end", "progress", "assignee", "lastInteraction", "inactivity"];

interface Props {
  paquets: Paquet[]; cat: Catalogues; aujourdhui: string; references: Baselines; selection?: string; colonnes: string[];
  setColonnes: (c: string[]) => void; onSelect: (id: string) => void; onOuvrir: (id: string) => void;
  onPatch: (id: string, patch: Partial<Tache>) => void;
  onMasse: (ids: string[], patch: (t: Tache) => Partial<Tache> | null, message: string) => void;
  onDecaler: (ids: string[], jours: number) => void; onDupliquer: (ids: string[]) => void; onArchiver: (ids: string[]) => void;
}

// Curseur d'avancement : la valeur n'est écrite qu'au relâchement.
function Avancement({ valeur, inactif, onValider, libelle }: { valeur: number; inactif: boolean; onValider: (v: number) => void; libelle: string }) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  const valider = () => { if (v !== valeur) onValider(v); };
  return <span className="tb-av"><input type="range" min={0} max={100} step={5} value={v} disabled={inactif} aria-label={`Avancement de ${libelle}`} onChange={(e) => setV(Number(e.target.value))} onPointerUp={valider} onKeyUp={valider} onBlur={valider} /><span className="mono">{v} %</span></span>;
}
function Titre({ valeur, inactif, onValider }: { valeur: string; inactif: boolean; onValider: (v: string) => void }) {
  const [v, setV] = useState(valeur);
  useEffect(() => setV(valeur), [valeur]);
  return <input className="tb-titre" aria-label="Titre" value={v} disabled={inactif} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim() && v !== valeur) onValider(v.trim()); else setV(valeur); }}
    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(valeur); } }} />;
}

export function Tableur({ paquets, cat, aujourdhui, references, selection, colonnes, setColonnes, onSelect, onOuvrir, onPatch, onMasse, onDecaler, onDupliquer, onArchiver }: Props) {
  const [choix, setChoix] = useState<Set<string>>(new Set());
  const [reglage, setReglage] = useState(false);
  const [masse, setMasse] = useState({ avancement: 50, debut: "", fin: "", decalage: 1 });
  const visibles = useMemo(() => paquets.flatMap((p) => p.taches), [paquets]);
  // La sélection ne garde que les tâches encore visibles.
  useEffect(() => { setChoix((c) => { const ids = new Set(visibles.map((t) => t.id)); const n = new Set([...c].filter((x) => ids.has(x))); return n.size === c.size ? c : n; }); }, [visibles]);
  const ids = [...choix];
  const tous = visibles.length > 0 && visibles.every((t) => choix.has(t.id));
  const basculer = (id: string) => setChoix((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const statutsCommuns = cat.statuts.filter((s) => !s.projectId);
  const typesCommuns = cat.types.filter((t) => !t.projectId);
  const projets = cat.projets.filter((p) => !p.gcalSource && !p.syncedCalendarSource);
  const membres = [...new Set(cat.membres.map((m) => m.name))].sort((a, b) => a.localeCompare(b));
  const cols = COLONNES_TABLEUR.filter((c) => colonnes.includes(c.cle));
  const nom = (n: number) => `${n} tâche${n > 1 ? "s" : ""}`;
  const menu = (libelle: string, options: { valeur: string; libelle: string }[], agir: (v: string) => void) => (
    <select aria-label={libelle} value="" onChange={(e) => { if (e.target.value) agir(e.target.value); e.target.value = ""; }}>
      <option value="">{libelle}…</option>{options.map((o) => <option key={o.valeur} value={o.valeur}>{o.libelle}</option>)}
    </select>
  );

  const cellule = (t: Tache, c: string) => {
    const gcal = estProjetCalendrier(cat.projets, t.projectId);
    switch (c) {
      case "project": return <select aria-label="Projet" value={t.projectId || ""} disabled={gcal} onChange={(e) => onPatch(t.id, { projectId: e.target.value })}>{(gcal ? cat.projets : projets).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;
      case "status": {
        const impose = statutImpose(cat.types, cat.statuts, t.taskTypeId);
        if (impose) return <span className="discret" title="Statut imposé par le type">🔒 {impose.name}</span>;
        return <select aria-label="Statut" value={t.statusId || ""} disabled={gcal} onChange={(e) => onPatch(t.id, { statusId: e.target.value })}>{statutsDuProjet(cat.statuts, cat.projets, t.projectId, t.statusId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>;
      }
      case "start": case "end": {
        const champ = c as "start" | "end"; const v = t[champ];
        if (!v) return <button type="button" className="btn btn-discret" disabled={gcal} aria-label={`${c === "start" ? "Début" : "Fin"} : aujourd'hui`} onClick={() => onPatch(t.id, { [champ]: aujourdhui })}>—</button>;
        return <input type="date" aria-label={c === "start" ? "Début" : "Fin"} value={v} disabled={gcal || (champ === "end" && !!t.milestone)} className={champ === "end" && estEnRetard(t, cat.statuts, aujourdhui) ? "crit" : ""} onChange={(e) => e.target.value && onPatch(t.id, { [champ]: e.target.value })} />;
      }
      case "progress": return <Avancement valeur={Number(t.progress) || 0} inactif={gcal} libelle={t.title || ""} onValider={(v) => onPatch(t.id, { progress: v })} />;
      case "assignee": return <select aria-label="Responsable" value={t.assignee || ""} disabled={gcal} onChange={(e) => onPatch(t.id, { assignee: e.target.value })}><option value="">Non assigné</option>{[...new Set([...membres, ...(t.assignee ? [t.assignee] : [])])].map((m) => <option key={m} value={m}>{m}</option>)}</select>;
      case "milestone": return <input type="checkbox" aria-label="Jalon" checked={!!t.milestone} disabled={gcal} onChange={(e) => onPatch(t.id, { milestone: e.target.checked })} />;
      case "focus": return <input type="checkbox" aria-label="Focus" checked={t.focus === true} disabled={gcal} onChange={(e) => onPatch(t.id, { focus: e.target.checked })} />;
      case "criticality": return <select aria-label="Criticité" value={t.criticality || ""} disabled={gcal} onChange={(e) => onPatch(t.id, { criticality: (e.target.value || null) as Tache["criticality"] })}><option value="">—</option>{CRITICITES.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}</select>;
      case "lastInteraction": return t.lastInteraction ? <span className="mono discret">{new Date(t.lastInteraction).toLocaleDateString("fr-FR")}</span> : <span className="discret">—</span>;
      case "inactivity": { const n = inactiviteJours(t); return Number.isFinite(n) ? <span className={`mono ${n >= 14 ? "alerte" : "discret"}`}>{n} j</span> : <span className="discret">—</span>; }
      case "dependsOn": return t.dependsOn?.length ? <span className="mono">{t.dependsOn.length}</span> : <span className="discret">—</span>;
      case "referenceEnd": { const x = comparaison(t, references); return x ? <span className="mono discret">{x.referenceEnd.split("-").reverse().join("/")}</span> : <span className="discret">—</span>; }
      case "delta": { const x = comparaison(t, references); return x ? <Etat ton={x.tonFin === "retard" ? "crit" : x.tonFin === "avance" ? "ok" : "neutre"} point={false}>{libelleEcart(x.ecartFin)}</Etat> : <span className="discret">—</span>; }
      case "delayRisks": { const n = Array.isArray(t.delayRisks) ? t.delayRisks.length : 0; return n ? <Etat ton="alerte" point={false}>{String(n)}</Etat> : <span className="discret">—</span>; }
    }
    return null;
  };

  return (
    <div className="tableur">
      <div className="fr-outils">
        <Bouton variante="discret" aria-expanded={reglage} onClick={() => setReglage((x) => !x)}>Colonnes</Bouton>
        <span className="marge-auto mono discret">{nom(visibles.length)}</span>
      </div>
      {reglage && (
        <fieldset className="panneau tb-colonnes"><legend className="surtitre">Colonnes affichées</legend>
          {COLONNES_TABLEUR.map((c) => <label key={c.cle} className="insp-case"><input type="checkbox" checked={colonnes.includes(c.cle)} onChange={() => setColonnes(colonnes.includes(c.cle) ? colonnes.filter((x) => x !== c.cle) : [...colonnes, c.cle])} /> {c.libelle}</label>)}
        </fieldset>
      )}
      {choix.size > 0 && (
        <div className="tb-masse panneau" role="toolbar" aria-label="Édition en masse">
          <strong>{nom(choix.size)} sélectionnée{choix.size > 1 ? "s" : ""}</strong>
          {menu("Statut", statutsCommuns.map((s) => ({ valeur: s.id, libelle: s.name || "" })), (v) => onMasse(ids, () => ({ statusId: v }), "Statut appliqué"))}
          {menu("Type", typesCommuns.map((s) => ({ valeur: s.id, libelle: s.name || "" })), (v) => onMasse(ids, (t) => (typesDuProjet(cat.types, cat.projets, t.projectId).some((x) => x.id === v) ? { taskTypeId: v } : null), "Type appliqué"))}
          {menu("Projet", projets.map((p) => ({ valeur: p.id, libelle: p.name || "" })), (v) => onMasse(ids, () => ({ projectId: v }), "Projet appliqué"))}
          {menu("Responsable", [{ valeur: "__aucun", libelle: "Non assigné" }, ...membres.map((m) => ({ valeur: m, libelle: m }))], (v) => onMasse(ids, () => ({ assignee: v === "__aucun" ? "" : v }), "Responsable appliqué"))}
          {menu("Jalon", [{ valeur: "oui", libelle: "Jalon : oui" }, { valeur: "non", libelle: "Jalon : non" }], (v) => onMasse(ids, () => ({ milestone: v === "oui" }), "Jalon appliqué"))}
          <span className="tb-groupe"><input type="number" min={0} max={100} step={5} aria-label="Avancement en masse" className="insp-nombre" value={masse.avancement} onChange={(e) => setMasse({ ...masse, avancement: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /><Bouton onClick={() => onMasse(ids, () => ({ progress: masse.avancement }), "Avancement appliqué")}>% appliquer</Bouton></span>
          <span className="tb-groupe">
            <input type="date" aria-label="Début en masse" value={masse.debut} onChange={(e) => setMasse({ ...masse, debut: e.target.value })} />
            <input type="date" aria-label="Fin en masse" value={masse.fin} onChange={(e) => setMasse({ ...masse, fin: e.target.value })} />
            <Bouton disabled={!masse.debut && !masse.fin} onClick={() => onMasse(ids, () => ({ ...(masse.debut ? { start: masse.debut } : {}), ...(masse.fin ? { end: masse.fin } : {}) }), "Dates appliquées")}>Dates</Bouton>
          </span>
          <span className="tb-groupe"><input type="number" aria-label="Décalage en jours" className="insp-nombre" value={masse.decalage} onChange={(e) => setMasse({ ...masse, decalage: Number(e.target.value) || 0 })} /><Bouton disabled={!masse.decalage} onClick={() => onDecaler(ids, masse.decalage)}>Décaler (j)</Bouton></span>
          <Bouton onClick={() => { onDupliquer(ids); setChoix(new Set()); }}>Dupliquer</Bouton>
          <Bouton variante="danger" onClick={() => { onArchiver(ids); setChoix(new Set()); }}>Archiver</Bouton>
          <Bouton variante="discret" onClick={() => setChoix(new Set())}>Désélectionner</Bouton>
        </div>
      )}
      {!visibles.length ? <div className="vide"><p>Aucune tâche ne correspond à cette requête.</p></div> : (
        <div className="tb-defil">
          <table className="tb" aria-label="Tableur des tâches">
            <thead><tr>
              <th className="tb-case"><input type="checkbox" aria-label="Tout sélectionner" checked={tous} onChange={() => setChoix(tous ? new Set() : new Set(visibles.map((t) => t.id)))} /></th>
              <th>Tâche</th>{cols.map((c) => <th key={c.cle}>{c.libelle}</th>)}
            </tr></thead>
            {paquets.filter((p) => p.taches.length).map((p) => (
              <tbody key={p.cle}>
                {p.cle !== "tout" && <tr className="tb-groupe-tete"><th colSpan={cols.length + 2}>{p.couleur && <span className="point" style={{ background: p.couleur }} />}{p.libelle} <span className="mono discret">· {p.taches.length}</span></th></tr>}
                {p.taches.map((t) => {
                  const gcal = estProjetCalendrier(cat.projets, t.projectId);
                  return (
                    <tr key={t.id} data-id={t.id} aria-selected={selection === t.id} className={`${selection === t.id ? "sel" : ""} ${choix.has(t.id) ? "choisie" : ""} ${estTerminee(t, cat.statuts) ? "finie" : ""}`} onClick={() => onSelect(t.id)}>
                      <td className="tb-case"><input type="checkbox" aria-label={`Sélectionner ${t.title}`} checked={choix.has(t.id)} onChange={() => basculer(t.id)} onClick={(e) => e.stopPropagation()} /></td>
                      <td className="tb-tache">{t.milestone && <span className="marque">◆</span>}<Titre valeur={t.title || ""} inactif={gcal} onValider={(v) => onPatch(t.id, { title: v })} /><button type="button" className="btn btn-discret" aria-label={`Ouvrir la fiche de ${t.title}`} onClick={(e) => { e.stopPropagation(); onSelect(t.id); onOuvrir(t.id); }}>›</button></td>
                      {cols.map((c) => <td key={c.cle}>{cellule(t, c.cle)}</td>)}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}
