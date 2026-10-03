// Barre de filtres commune (Ref #688) et vues enregistrées (liste
// déroulante), synchronisées dans nexora:optimPrefs.
import { useEffect, useRef, useState } from "react";
import type { Tache } from "../donnees/modele";
import { CRITICITES } from "../donnees/modele";
import { FILTRE_VIDE, type FiltreVue, type VueEnregistree } from "../donnees/prefs";
import { useOptim, useUi } from "./contexte";

type CleListe = "projets" | "statuts" | "responsables" | "types" | "criticites";
const LIBELLES: Record<CleListe, string> = { projets: "Projets", statuts: "Statuts", responsables: "Responsables", types: "Types", criticites: "Criticité" };
const SANS = "__sans__";

export const PREDEFINIES: { id: string; nom: string; filtre: (moi: string) => FiltreVue }[] = [
  { id: "tout", nom: "Tout", filtre: () => FILTRE_VIDE },
  { id: "moi", nom: "Mes tâches", filtre: (moi) => ({ ...FILTRE_VIDE, responsables: moi ? [moi] : [] }) },
  { id: "retard", nom: "En retard", filtre: () => ({ ...FILTRE_VIDE, retard: true }) },
  { id: "jalons", nom: "Jalons", filtre: () => ({ ...FILTRE_VIDE, jalons: true }) },
];

export function useFiltrage() {
  const { fini, retard } = useOptim();
  return (ts: Tache[], f: FiltreVue) => {
    const q = f.q.trim().toLowerCase();
    return ts.filter((t) => (!q || (t.title || "").toLowerCase().includes(q))
      && (!f.projets.length || f.projets.includes(t.projectId || SANS))
      && (!f.statuts.length || f.statuts.includes(t.statusId || SANS))
      && (!f.responsables.length || f.responsables.includes(t.assignee || SANS))
      && (!f.types.length || f.types.includes(t.taskTypeId || SANS))
      && (!f.criticites.length || f.criticites.includes(t.criticality || SANS))
      && (!f.retard || retard(t)) && (!f.jalons || !!t.milestone) && (f.terminees || !fini(t)));
  };
}

// Responsable « moi » : le membre dont l'e-mail correspond, sinon rien.
export function useMoi(email: string) {
  const { d } = useOptim();
  return d.membres.find((m) => m.email && m.email.toLowerCase() === email.toLowerCase())?.name || "";
}

function Choix({ cle, f, setF, ouvert, setOuvert }: { cle: CleListe; f: FiltreVue; setF: (f: FiltreVue) => void; ouvert: boolean; setOuvert: (c: CleListe | null) => void }) {
  const { d } = useOptim();
  const options: [string, string, string?][] = cle === "projets" ? [...d.projets.map((p): [string, string, string?] => [p.id, p.name || p.id, p.color]), [SANS, "Sans projet"]]
    : cle === "statuts" ? d.statuts.map((s) => [s.id, s.name || s.id, s.color])
      : cle === "types" ? d.types.map((t) => [t.id, t.name || t.id])
        : cle === "criticites" ? [...CRITICITES.map((c): [string, string, string?] => [c.id, c.nom, c.couleur]), [SANS, "Sans criticité"]]
          : [...[...new Set([...d.membres.map((m) => m.name), ...d.taches.map((t) => t.assignee || "").filter(Boolean)])].sort((a, b) => a.localeCompare(b, "fr")).map((n): [string, string, string?] => [n, n]), [SANS, "Sans responsable"]];
  const sel = f[cle];
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(null); };
    document.addEventListener("mousedown", fermer); return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert, setOuvert]);
  return (
    <span className="hx-fchip-w" ref={ref}>
      <button type="button" className={`hx-fchip ${sel.length ? "is-on" : ""}`} aria-expanded={ouvert} onClick={() => setOuvert(ouvert ? null : cle)}>{LIBELLES[cle]}{sel.length ? <> <b>{sel.length}</b></> : null} ▾</button>
      {ouvert && <div className="hx-pop is-f" role="dialog" aria-label={LIBELLES[cle]}>
        {options.map(([id, l, c]) => <label key={id}><input type="checkbox" checked={sel.includes(id)} onChange={() => setF({ ...f, [cle]: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] })} />{c && <i style={{ background: c }} />}{l}</label>)}
        <footer><button type="button" className="hx-more" onClick={() => setF({ ...f, [cle]: [] })}>Tout décocher</button></footer>
      </div>}
    </span>
  );
}

function resume(f: FiltreVue, n: number, noms: (cle: CleListe, id: string) => string) {
  const parts: string[] = [];
  (Object.keys(LIBELLES) as CleListe[]).forEach((k) => { if (f[k].length) parts.push(`${LIBELLES[k].toLowerCase()} : ${f[k].map((id) => noms(k, id)).join(", ")}`); });
  if (f.retard) parts.push("en retard seulement"); if (f.jalons) parts.push("jalons seulement"); if (f.q) parts.push(`« ${f.q} »`);
  return <><b>{n} tâche{n > 1 ? "s" : ""}</b> · {parts.length ? parts.join(" · ") : "aucun filtre"} · terminées {f.terminees ? "affichées" : "masquées"}</>;
}
const estVide = (f: FiltreVue) => !f.q && !f.retard && !f.jalons && (Object.keys(LIBELLES) as CleListe[]).every((k) => !f[k].length);

export function BarreFiltres({ ecran, n, masquer = [], email, reglages, appliquerReglages }: {
  ecran: "planning" | "projets"; n: number; masquer?: CleListe[]; email: string;
  reglages: Omit<VueEnregistree, "id" | "ecran" | "nom" | "filtre">; appliquerReglages: (v: VueEnregistree) => void;
}) {
  const { d, prefs, ecrirePrefs, projet, statut } = useOptim();
  const { filtre: f, setFiltre, vueActive, setVueActive, notifier } = useUi();
  const [ouvert, setOuvert] = useState<CleListe | null>(null);
  const [nom, setNom] = useState<string | null>(null);
  const moi = useMoi(email);
  const cur = vueActive[ecran] || "";
  const setF = (x: FiltreVue) => { setFiltre(x); setVueActive(ecran, ""); };
  const noms = (k: CleListe, id: string) => id === SANS ? "aucun" : k === "projets" ? projet(id).name : k === "statuts" ? statut(id).name : k === "types" ? d.types.find((t) => t.id === id)?.name || id : k === "criticites" ? CRITICITES.find((c) => c.id === id)?.nom || id : id;
  const mesVues = prefs.vues.filter((v) => v.ecran === ecran);
  const choisir = (val: string) => {
    setVueActive(ecran, val);
    if (val.startsWith("p:")) { const p = PREDEFINIES.find((x) => x.id === val.slice(2)); if (p) setFiltre(p.filtre(moi)); return; }
    const v = prefs.vues.find((x) => x.id === val.slice(2)); if (!v) return;
    setFiltre(v.filtre); appliquerReglages(v);
  };
  const enregistrer = async () => {
    const v: VueEnregistree = { id: "v" + Date.now().toString(36), ecran, nom: (nom || "").trim() || "Vue sans nom", filtre: f, ...reglages };
    await ecrirePrefs({ vues: [...prefs.vues, v] });
    setVueActive(ecran, "u:" + v.id); setNom(null); notifier({ texte: `Vue « ${v.nom} » enregistrée` });
  };
  const supprimer = async (id: string) => { await ecrirePrefs({ vues: prefs.vues.filter((v) => v.id !== id) }); setVueActive(ecran, ""); notifier({ texte: "Vue supprimée" }); };
  return (
    <div className="hx-fbar">
      <label className="hx-fsearch"><span aria-hidden="true">⌕</span><input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Filtrer par mot" aria-label="Filtrer par mot" autoComplete="off" /></label>
      {(Object.keys(LIBELLES) as CleListe[]).filter((k) => !masquer.includes(k)).map((k) => <Choix key={k} cle={k} f={f} setF={setF} ouvert={ouvert === k} setOuvert={setOuvert} />)}
      <button type="button" className={`hx-fchip ${f.retard ? "is-on" : ""}`} onClick={() => setF({ ...f, retard: !f.retard })}>En retard</button>
      <button type="button" className={`hx-fchip ${f.jalons ? "is-on" : ""}`} onClick={() => setF({ ...f, jalons: !f.jalons })}>Jalons</button>
      <button type="button" className={`hx-fchip ${f.terminees ? "is-on" : ""}`} onClick={() => setF({ ...f, terminees: !f.terminees })}>Terminées</button>
      <span className="hx-fviews"><span>Vue</span>
        <select value={cur} aria-label="Vue enregistrée" onChange={(e) => (e.target.value ? choisir(e.target.value) : setVueActive(ecran, ""))}>
          <option value="">— vue en cours (non enregistrée)</option>
          <optgroup label="Prédéfinies">{PREDEFINIES.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.nom}</option>)}</optgroup>
          {mesVues.length > 0 && <optgroup label="Mes vues">{mesVues.map((v) => <option key={v.id} value={`u:${v.id}`}>{v.nom}</option>)}</optgroup>}
        </select>
        {nom !== null
          ? <><input autoFocus value={nom} onChange={(e) => setNom(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void enregistrer(); if (e.key === "Escape") setNom(null); }} placeholder="Nom de la vue" aria-label="Nom de la vue" /><button type="button" className="hx-btn is-sm is-primary" onClick={() => void enregistrer()}>Enregistrer</button><button type="button" className="hx-more" onClick={() => setNom(null)}>Annuler</button></>
          : <><button type="button" className="hx-more" onClick={() => setNom("")}>+ Enregistrer la vue</button>{cur.startsWith("u:") && <button type="button" className="hx-more is-plain" onClick={() => void supprimer(cur.slice(2))}>Supprimer</button>}</>}
      </span>
      <p className="hx-fsum">{resume(f, n, noms)}{!estVide(f) && <> <button type="button" className="hx-more" onClick={() => { setFiltre({ ...FILTRE_VIDE, terminees: f.terminees }); setVueActive(ecran, ""); }}>Réinitialiser</button></>}</p>
    </div>
  );
}
