// Planning (Ref #688) : Partition sur les données réelles — zooms Semaine à
// Pluriannuel, regroupement, filtres communs, vues enregistrées, six
// représentations de Gantt, traits verticaux marqués, glisser-déposer.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ajouterJours, type Tache } from "../donnees/modele";
import { lignesFrise } from "../donnees/planning";
import { GROUPES_PLANNING, ZOOMS, type GroupePlanning, type StyleGantt, type VueEnregistree, type Zoom } from "../donnees/prefs";
import { useOptim, useUi } from "./contexte";
import { BarreFiltres, useFiltrage } from "./filtres";
import { Grille, graduations, HAUTEUR_RANGEE, infobulle, libellePlage, LigneGantt, plage, ranger, STYLES_DEF, tx, ZOOMS_DEF, type Plage } from "./frise";

export function SelecteurStyle({ petit }: { petit?: boolean }) {
  const { prefs, ecrirePrefs } = useOptim();
  return <div className="hx-gsel"><span>Représentation</span><div className={`hx-seg ${petit ? "is-xs" : "is-sm"}`}>
    {STYLES_DEF.map((s) => <button key={s.id} type="button" aria-pressed={prefs.gantt === s.id} title={s.aide} onClick={() => void ecrirePrefs({ gantt: s.id })}>{s.libelle}</button>)}
  </div></div>;
}
export const AideStyle = ({ style }: { style: StyleGantt }) => { const s = STYLES_DEF.find((x) => x.id === style) || STYLES_DEF[0]; return <p className="hx-gdesc"><b>{s.libelle}</b> : {s.aide}</p>; };

export function BarreZoom({ r, zooms, setZoom, decaler, jour }: { r: Plage; zooms: readonly Zoom[]; setZoom: (z: Zoom) => void; decaler: (n: number | null) => void; jour?: () => void }) {
  return <div className="hx-zoom"><div className="hx-seg">{jour && <button type="button" onClick={jour}>Jour</button>}{zooms.map((z) => <button key={z} type="button" aria-pressed={r.zoom === z} onClick={() => setZoom(z)}>{ZOOMS_DEF[z].libelle}</button>)}</div>
    <div className="hx-nav2"><button type="button" aria-label="Période précédente" onClick={() => decaler(-1)}>‹</button><button type="button" onClick={() => decaler(null)}>Aujourd'hui</button><button type="button" aria-label="Période suivante" onClick={() => decaler(1)}>›</button></div>
    <span className="hx-range">{libellePlage(r)}</span></div>;
}

// Ruban : titre sorti à droite quand il ne tient pas dans la barre.
export function useDebordRuban(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const mesurer = useCallback(() => {
    ref.current?.querySelectorAll<HTMLElement>(".gs-ruban:not(.is-row) .g-bar > .g-lab").forEach((l) => {
      const g = l.closest(".hx-g"); if (!g) return;
      g.classList.remove("lab-out");
      if (l.scrollWidth > l.clientWidth + 1) g.classList.add("lab-out");
    });
  }, []);
  useLayoutEffect(mesurer);
  // Les largeurs changent quand les polices arrivent et quand la fenêtre bouge.
  useEffect(() => {
    let vivant = true;
    void document.fonts?.ready.then(() => { if (vivant) mesurer(); });
    window.addEventListener("resize", mesurer);
    return () => { vivant = false; window.removeEventListener("resize", mesurer); };
  }, [mesurer]);
  void dep;
  return ref;
}

interface Portee { id: string; libelle: string; couleur: string; projet?: string; taches: Tache[]; }
function portees(ts: Tache[], par: GroupePlanning, o: ReturnType<typeof useOptim>): Portee[] {
  const { d, projet, statut } = o;
  if (par === "dossier") return [...d.dossiers.map((f) => ({ id: f.id, libelle: f.name || f.id, couleur: f.color || "#64748b", taches: ts.filter((t) => (projet(t.projectId).folderId || "folder-a-trier") === f.id) }))];
  if (par === "responsable") { const noms = [...new Set(ts.map((t) => t.assignee || ""))].sort((a, b) => (a ? a.localeCompare(b, "fr") : 1)); return noms.map((m) => ({ id: "m-" + m, libelle: m || "Sans responsable", couleur: "#64748b", taches: ts.filter((t) => (t.assignee || "") === m) })); }
  if (par === "statut") return d.statuts.map((s) => ({ id: s.id, libelle: s.name || s.id, couleur: statut(s.id).color, taches: ts.filter((t) => t.statusId === s.id) }));
  return [...d.projets.map((p) => ({ id: p.id, libelle: p.name || p.id, couleur: p.color || "#94a3b8", projet: p.id, taches: ts.filter((t) => t.projectId === p.id) })), { id: "__sans", libelle: "Sans projet", couleur: "#94a3b8", taches: ts.filter((t) => !t.projectId || !d.projets.some((p) => p.id === t.projectId)) }];
}
export const LIBELLE_GROUPE: Record<GroupePlanning, string> = { projet: "Projet", dossier: "Dossier", responsable: "Responsable", statut: "Statut" };

export function Planning({ email, allerJournee, ouvrirProjet }: { email: string; allerJournee: () => void; ouvrirProjet: (id: string) => void }) {
  const o = useOptim();
  const { d, jour, prefs, ecrirePrefs, projet, statut, fini, retard, joursRetard } = o;
  const { filtre, ouvrir, tacheId } = useUi();
  const filtrer = useFiltrage();
  const [decalage, setDecalage] = useState(0);
  const [replies, setReplies] = useState<Set<string>>(new Set());
  const zoom = prefs.planning.zoom, groupe = prefs.planning.groupe, style = prefs.gantt;
  const r = plage(zoom, decalage, jour);
  const ts = filtrer(d.taches, filtre).filter((t) => { const a = t.milestone ? t.end : t.start, b = t.end; return !!a && !!b && b >= r.debut && a <= r.fin; });
  const lanes = portees(ts, groupe, o).filter((l) => l.taches.length);
  const ref = useDebordRuban([ts, style, zoom]);
  const appliquer = (v: VueEnregistree) => { void ecrirePrefs({ planning: { ...prefs.planning, ...(v.zoom ? { zoom: v.zoom } : {}), ...(v.groupe && (GROUPES_PLANNING as readonly string[]).includes(v.groupe) ? { groupe: v.groupe as GroupePlanning } : {}) }, ...(v.style ? { gantt: v.style } : {}) }); setDecalage(0); };
  const infos = (t: Tache) => ({ fini: fini(t), retard: retard(t), joursRetard: joursRetard(t), jour });
  return (
    <main className="hx-main" data-scroll>
      <div className="hx-hello hx-row"><div><h1>Planning</h1></div>
        <BarreZoom r={r} zooms={ZOOMS} setZoom={(z) => { void ecrirePrefs({ planning: { ...prefs.planning, zoom: z } }); setDecalage(0); }} decaler={(n) => setDecalage(n === null ? 0 : decalage + n)} jour={allerJournee} />
        <div className="hx-opts"><span>Grouper par</span><div className="hx-seg is-sm">{GROUPES_PLANNING.map((g) => <button key={g} type="button" aria-pressed={groupe === g} onClick={() => void ecrirePrefs({ planning: { ...prefs.planning, groupe: g } })}>{LIBELLE_GROUPE[g]}</button>)}</div><SelecteurStyle /></div></div>
      <BarreFiltres ecran="planning" n={ts.length} email={email} reglages={{ zoom, groupe, style }} appliquerReglages={appliquer} />
      <div className="hx-tile hx-tl" ref={ref}>
        <div className="hx-tlhead"><span className="hx-tlcap">{LIBELLE_GROUPE[groupe]}</span><div className="hx-tltrack">{graduations(r).map((k) => <span key={k.iso} className={`hx-tick ${k.majeur ? "is-major" : ""} ${r.zoom === "semaine" && k.iso === jour ? "is-today" : ""}`} style={{ left: `${tx(r, k.iso)}%` }}>{k.libelle}</span>)}</div></div>
        {lanes.map((l) => {
          const col = replies.has(l.id), nRet = l.taches.filter(retard).length, lignes = lignesFrise(l.taches), pk = ranger(lignes, r, style);
          let resume: ReactNode = null;
          if (col && lignes.length) { const a = Math.max(0, tx(r, lignes.reduce((m, x) => (x.debut < m ? x.debut : m), "9999"))), b = Math.min(100, tx(r, ajouterJours(lignes.reduce((m, x) => (x.fin > m ? x.fin : m), "0000"), 1))); resume = <span className="hx-lsum" style={{ left: `${a}%`, width: `${b - a}%`, ["--c" as string]: l.couleur }} />; }
          return (
            <div key={l.id} className={`hx-lane ${col ? "is-col" : ""}`} data-lane-project={l.projet}>
              <button type="button" className="hx-lh" style={{ ["--c" as string]: l.couleur }} aria-expanded={!col} onClick={() => setReplies((s) => { const n = new Set(s); if (n.has(l.id)) n.delete(l.id); else n.add(l.id); return n; })}>
                <b><span className="hx-chev">{col ? "▸" : "▾"}</span>{l.libelle}</b>
                <small>{l.taches.length} tâche{l.taches.length > 1 ? "s" : ""}{nRet > 0 && <> · <em>{nRet} en retard</em></>}{l.projet && <> · <span className="hx-open" role="link" onClick={(e) => { e.stopPropagation(); ouvrirProjet(l.projet!); }}>ouvrir</span></>}</small>
              </button>
              <div className="hx-ltrack" data-rs={r.debut} data-rn={r.jours} style={{ height: col ? 22 : pk.rangees * HAUTEUR_RANGEE + 6 }}>
                <Grille r={r} jour={jour} />
                {col ? resume : pk.elements.map((el) => <LigneGantt key={el.l.t.id} el={el} r={r} style={style} couleur={projet(el.l.t.projectId).color} statuts={d.statuts} infos={infos(el.l.t)} selection={tacheId === el.l.t.id} ouvrir={ouvrir} info={infobulle(el.l.t, el.l, projet(el.l.t.projectId).name, statut(el.l.t.statusId).name, infos(el.l.t))} />)}
              </div>
            </div>
          );
        })}
        {!lanes.length && <p className="hx-empty">Aucune tâche ne correspond aux filtres sur cette période.</p>}
      </div>
      <AideStyle style={style} />
      <p className="hx-legend2"><span>Couleur = projet ; pâle ou hachuré = à planifier ; ambre = attente tiers ; gris = terminée</span><span><i className="lg-ms" />jalon</span><span><i className="lg-over" />retard depuis l'échéance</span><span><i className="lg-today" />aujourd'hui</span><span>Glisser une ligne la replanifie ; la glisser vers une autre portée change son projet.</span></p>
    </main>
  );
}
