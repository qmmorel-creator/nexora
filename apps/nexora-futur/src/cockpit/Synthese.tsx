// Lentille Synthèse (Ref #658) : indicateurs, graphique (7 styles), Treemap
// des projets et notes des tableaux de bord (lecture), sur la requête.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Catalogues, Tache } from "../donnees/modele";
import type { ChampGroupe } from "../donnees/requete";
import type { Baselines } from "../donnees/planning";
import { STYLES_GRAPHIQUE, compterPar, empilees, indicateurs, jauge, niveauCriticite, NIVEAUX_CRITICITE, squarifier, termineesParSemaine, treemapProjets, type ModeCouleurTreemap, type Part, type StyleGraphique } from "../donnees/suivi";
import { analyserMarkdown, segmentsEnLigne, type Bloc, type NoteTableau } from "../donnees/notes";
import type { PrefsSynthese } from "../donnees/prefs";
import { naviguer } from "../navigation/routeur";
import { Etat, Segment, Surtitre } from "../composants";

interface Props { taches: Tache[]; tachesToutes: Tache[]; cat: Catalogues; aujourdhui: string; references: Baselines; notes: NoteTableau[]; prefs: PrefsSynthese; setPrefs: (p: PrefsSynthese) => void; }

const PALETTE = ["#4F6AF5", "#22B07D", "#F2A93B", "#8B5CF6", "#0EA5E9", "#D64545", "#EC4899", "#14B8A6", "#6366F1", "#F97316"];
const CHAMPS: { id: ChampGroupe; libelle: string }[] = [
  { id: "status", libelle: "Statut" }, { id: "project", libelle: "Projet" }, { id: "criticality", libelle: "Criticité" }, { id: "taskType", libelle: "Type" },
  { id: "assignee", libelle: "Responsable" }, { id: "milestone", libelle: "Jalon" }, { id: "period", libelle: "Mois d'échéance" },
];
const coul = (p: Part, i: number) => p.couleur || PALETTE[i % PALETTE.length];

function Legende({ parts }: { parts: Part[] }) {
  return <ul className="sy-legende">{parts.map((p, i) => <li key={p.cle}><span className="point" style={{ background: coul(p, i) }} />{p.libelle} <span className="mono discret">{p.valeur}</span></li>)}</ul>;
}

function Graphique({ taches, tachesToutes, cat, aujourdhui, prefs }: { taches: Tache[]; tachesToutes: Tache[]; cat: Catalogues; aujourdhui: string; prefs: PrefsSynthese }) {
  const style = prefs.style as StyleGraphique; const champ = prefs.groupe as ChampGroupe;
  const parts = useMemo(() => compterPar(taches, style === "line" ? "period" : champ, cat), [taches, champ, cat, style]);
  if (!taches.length) return <p className="discret">Aucune tâche dans la requête.</p>;
  const max = Math.max(1, ...parts.map((p) => p.valeur));
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  switch (style) {
    case "pie": {
      let angle = -Math.PI / 2;
      const arcs = parts.map((p, i) => {
        const a = (p.valeur / total) * Math.PI * 2; const x0 = 90 + 80 * Math.cos(angle); const y0 = 90 + 80 * Math.sin(angle);
        angle += a; const x1 = 90 + 80 * Math.cos(angle); const y1 = 90 + 80 * Math.sin(angle);
        return parts.length === 1 ? <circle key={p.cle} cx={90} cy={90} r={80} fill={coul(p, i)} /> : <path key={p.cle} d={`M90 90 L${x0} ${y0} A80 80 0 ${a > Math.PI ? 1 : 0} 1 ${x1} ${y1} Z`} fill={coul(p, i)} stroke="var(--surface)" strokeWidth={1.5}><title>{`${p.libelle} : ${p.valeur}`}</title></path>;
      });
      return <div className="sy-graph-ligne"><svg viewBox="0 0 180 180" width={180} height={180} role="img" aria-label={`Camembert : ${parts.map((p) => `${p.libelle} ${p.valeur}`).join(", ")}`}>{arcs}</svg><Legende parts={parts} /></div>;
    }
    case "bar": {
      const w = Math.max(48, Math.min(84, 640 / Math.max(1, parts.length)));
      return (
        <svg viewBox={`0 0 ${parts.length * (w + 10) + 10} 210`} className="sy-svg" role="img" aria-label={`Barres : ${parts.map((p) => `${p.libelle} ${p.valeur}`).join(", ")}`}>
          {parts.map((p, i) => { const h = (p.valeur / max) * 150; return <g key={p.cle}><rect x={10 + i * (w + 10)} y={170 - h} width={w} height={h} fill={coul(p, i)} rx={2}><title>{`${p.libelle} : ${p.valeur}`}</title></rect><text x={10 + i * (w + 10) + w / 2} y={164 - h} textAnchor="middle" className="sy-txt">{p.valeur}</text><text x={10 + i * (w + 10) + w / 2} y={188} textAnchor="middle" className="sy-txt discret">{p.libelle.length > 12 ? `${p.libelle.slice(0, 11)}…` : p.libelle}<title>{p.libelle}</title></text></g>; })}
        </svg>
      );
    }
    case "barh":
      return <div className="sy-barh">{parts.map((p, i) => <div key={p.cle} className="sy-barh-l"><span className="sy-barh-n">{p.libelle}</span><span className="sy-barh-b"><span style={{ width: `${(p.valeur / max) * 100}%`, background: coul(p, i) }} /></span><span className="mono">{p.valeur}</span></div>)}</div>;
    case "gauge": {
      const v = jauge(prefs.jauge === "doneRatio" ? tachesToutes : taches, cat, prefs.jauge); const a = Math.PI * (1 - v / 100);
      return (
        <svg viewBox="0 0 220 130" className="sy-svg sy-jauge" role="img" aria-label={`Jauge : ${v} %`}>
          <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke="var(--ligne)" strokeWidth={18} />
          <path d={`M20 110 A90 90 0 0 1 ${110 + 90 * Math.cos(a)} ${110 - 90 * Math.sin(a)}`} fill="none" stroke="var(--accent)" strokeWidth={18} />
          <text x={110} y={102} textAnchor="middle" className="sy-gros">{v} %</text>
          <text x={110} y={124} textAnchor="middle" className="sy-txt discret">{prefs.jauge === "doneRatio" ? "part de tâches terminées (terminées comprises)" : "avancement moyen"}</text>
        </svg>
      );
    }
    case "line": {
      const pts = parts.filter((p) => p.cle !== "__none").sort((a, b) => a.cle.localeCompare(b.cle));
      if (pts.length < 2) return <p className="discret">Il faut au moins deux mois d'échéance pour tracer une courbe.</p>;
      const mx = Math.max(1, ...pts.map((p) => p.valeur)); const W = Math.max(300, pts.length * 56);
      const xy = pts.map((p, i) => [20 + (i * (W - 40)) / (pts.length - 1), 160 - (p.valeur / mx) * 130] as const);
      return <svg viewBox={`0 0 ${W} 200`} className="sy-svg" role="img" aria-label={`Courbe par mois d'échéance : ${pts.map((p) => `${p.libelle} ${p.valeur}`).join(", ")}`}>
        <polyline points={xy.map((x) => x.join(",")).join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {pts.map((p, i) => <g key={p.cle}><circle cx={xy[i][0]} cy={xy[i][1]} r={4} fill="var(--accent)" /><text x={xy[i][0]} y={xy[i][1] - 8} textAnchor="middle" className="sy-txt">{p.valeur}</text><text x={xy[i][0]} y={186} textAnchor="middle" className="sy-txt discret">{p.libelle}</text></g>)}
      </svg>;
    }
    case "completedPerWeek": {
      const r = termineesParSemaine(tachesToutes, aujourdhui); const mx = Math.max(1, ...r.semaines.map((s) => s.valeur));
      const ym = 160 - (r.moyenne / mx) * 130;
      return <svg viewBox="0 0 560 200" className="sy-svg" role="img" aria-label={`Terminées par semaine, moyenne ${r.moyenne}`}>
        {r.semaines.map((s, i) => { const h = (s.valeur / mx) * 130; return <g key={s.lundi}><rect x={14 + i * 45} y={160 - h} width={34} height={h} fill="var(--ok)" rx={2}><title>{`Semaine du ${s.lundi} : ${s.valeur}`}</title></rect><text x={31 + i * 45} y={154 - h} textAnchor="middle" className="sy-txt">{s.valeur || ""}</text><text x={31 + i * 45} y={184} textAnchor="middle" className="sy-txt discret">{s.lundi.slice(8)}/{s.lundi.slice(5, 7)}</text></g>; })}
        <line x1={10} x2={550} y1={ym} y2={ym} stroke="var(--encre2)" strokeDasharray="4 3" /><text x={548} y={ym - 4} textAnchor="end" className="sy-txt discret">moyenne {r.moyenne}</text>
      </svg>;
    }
    case "stackedBar": {
      const e = empilees(taches, champ, prefs.pile as ChampGroupe, cat); const mx = Math.max(1, ...e.barres.map((b) => b.parts.reduce((s, p) => s + p.valeur, 0)));
      return <div><div className="sy-barh">{e.barres.map((b) => <div key={b.cle} className="sy-barh-l"><span className="sy-barh-n">{b.libelle}</span><span className="sy-barh-b">{b.parts.map((p, i) => p.valeur ? <span key={p.cle} style={{ width: `${(p.valeur / mx) * 100}%`, background: coul(p, i) }} title={`${p.libelle} : ${p.valeur}`} /> : null)}</span><span className="mono">{b.parts.reduce((s, p) => s + p.valeur, 0)}</span></div>)}</div><Legende parts={e.series} /></div>;
    }
  }
  return null;
}

function Treemap({ taches, cat, aujourdhui, references, mode }: { taches: Tache[]; cat: Catalogues; aujourdhui: string; references: Baselines; mode: ModeCouleurTreemap }) {
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(800);
  useEffect(() => { const el = boite.current; if (!el) return; const o = new ResizeObserver(([e]) => setLargeur(Math.max(200, e.contentRect.width))); o.observe(el); return () => o.disconnect(); }, []);
  const lignes = useMemo(() => treemapProjets(taches, cat, aujourdhui, mode, references), [taches, cat, aujourdhui, mode, references]);
  const hauteur = 340;
  const tuiles = useMemo(() => squarifier(lignes, { x: 0, y: 0, w: largeur, h: hauteur }), [lignes, largeur]);
  const max = Math.max(1, ...lignes.map((l) => l.valeur));
  const fond = (v: number) => {
    if (mode === "criticite") return niveauCriticite(v).couleur;
    const f = Math.round(10 + (v / max) * 40);
    return `color-mix(in srgb, ${mode === "derive" ? "var(--crit)" : mode === "avancement" ? "var(--ok)" : "var(--accent)"} ${f}%, var(--surface))`;
  };
  return (
    <div ref={boite} className="sy-treemap" style={{ height: hauteur }} role="list" aria-label="Treemap des projets">
      {tuiles.map((t) => (
        <a key={t.projet.id} role="listitem" href={`/projets/${encodeURIComponent(t.projet.id)}`} className="sy-tuile" onClick={(e) => { e.preventDefault(); naviguer(`/projets/${encodeURIComponent(t.projet.id)}`); }}
          style={{ left: t.x, top: t.y, width: t.w - 3, height: t.h - 3, background: fond(t.valeur), borderLeftColor: t.projet.color || "var(--encre3)" }}
          aria-label={`${t.projet.name} : ${t.taille} tâche(s), ${t.retards} en retard, avancement ${t.avancement} %, criticité ${t.criticite} (${niveauCriticite(t.criticite).libelle})${mode === "derive" ? `, dérive moyenne ${t.derive} j` : ""}`}>
          <strong>{t.projet.name}</strong>
          {t.h > 44 && <span className="mono">{t.taille} t. · {t.avancement} %{t.retards ? ` · ${t.retards} retard${t.retards > 1 ? "s" : ""}` : ""}</span>}
          {t.h > 64 && mode === "criticite" && <span className="mono">{niveauCriticite(t.criticite).libelle} {t.criticite}</span>}
          {t.h > 64 && mode === "derive" && <span className="mono">dérive {t.derive > 0 ? "+" : ""}{t.derive} j</span>}
        </a>
      ))}
      {!tuiles.length && <p className="discret">Aucun projet dans la requête.</p>}
    </div>
  );
}

function EnLigne({ texte }: { texte: string }) {
  return <>{segmentsEnLigne(texte).map((s, i) => s.genre === "lien" ? <a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.texte}</a> : s.genre === "gras" ? <strong key={i}>{s.texte}</strong> : s.genre === "italique" ? <em key={i}>{s.texte}</em> : s.genre === "code" ? <code key={i}>{s.texte}</code> : <span key={i}>{s.texte}</span>)}</>;
}
function Blocs({ blocs }: { blocs: Bloc[] }): ReactNode {
  return <>{blocs.map((b, i) => {
    switch (b.genre) {
      case "titre": return <p key={i} className={`sy-md-titre n${b.niveau}`}><EnLigne texte={b.texte} /></p>;
      case "liste": return <ul key={i}>{b.elements.map((e, k) => <li key={k} className={e.coche !== undefined ? "sy-md-case" : ""}>{e.coche !== undefined && <span aria-label={e.coche ? "fait" : "à faire"}>{e.coche ? "☑" : "☐"} </span>}<EnLigne texte={e.texte} /></li>)}</ul>;
      case "encadre": return <aside key={i} className={`sy-md-encadre ${b.ton}`}><strong>{b.titre}</strong><Blocs blocs={b.blocs} /></aside>;
      case "tableau": return <table key={i} className="sy-md-tableau"><tbody>{b.lignes.map((l, k) => <tr key={k}>{l.map((c, j) => (k === 0 ? <th key={j}><EnLigne texte={c} /></th> : <td key={j}><EnLigne texte={c} /></td>))}</tr>)}</tbody></table>;
      default: return <p key={i}><EnLigne texte={b.texte} /></p>;
    }
  })}</>;
}

export function Synthese({ taches, tachesToutes, cat, aujourdhui, references, notes, prefs, setPrefs }: Props) {
  const k = useMemo(() => indicateurs(taches, cat, references), [taches, cat, references]);
  const cartes: [string, string, string?][] = [
    ["Tâches", String(k.count)], ["Avancement moyen", `${k.avgProgress} %`], ["Jalons", String(k.milestoneCount)], ["Urgentes", String(k.urgentCount)],
    ["Dérive moyenne", k.avecReference ? `${k.avgDrift > 0 ? "+" : ""}${k.avgDrift} j` : "—", k.avecReference ? `sur ${k.avecReference} tâche(s) avec référence` : "aucune référence"],
    ["En retard sur la référence", k.avecReference ? String(k.overdueVsRefCount) : "—"],
  ];
  return (
    <div className="synthese">
      <section className="sy-kpi" aria-label="Indicateurs">
        {cartes.map(([l, v, d]) => <div key={l} className="panneau sy-carte"><Surtitre>{l}</Surtitre><span className="sy-valeur mono">{v}</span>{d && <span className="discret sy-detail">{d}</span>}</div>)}
      </section>
      <section className="panneau sy-bloc" aria-label="Graphique">
        <div className="sy-tete">
          <Surtitre>Graphique</Surtitre>
          <select aria-label="Style du graphique" value={prefs.style} onChange={(e) => setPrefs({ ...prefs, style: e.target.value })}>{STYLES_GRAPHIQUE.map((s) => <option key={s.id} value={s.id}>{s.libelle}</option>)}</select>
          {!["gauge", "line", "completedPerWeek"].includes(prefs.style) && <label className="insp-case">par <select aria-label="Regrouper le graphique par" value={prefs.groupe} onChange={(e) => setPrefs({ ...prefs, groupe: e.target.value })}>{CHAMPS.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></label>}
          {prefs.style === "stackedBar" && <label className="insp-case">empilé par <select aria-label="Empiler par" value={prefs.pile} onChange={(e) => setPrefs({ ...prefs, pile: e.target.value })}>{CHAMPS.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}</select></label>}
          {prefs.style === "gauge" && <Segment etiquette="Mesure de la jauge" valeur={prefs.jauge} onChange={(jauge) => setPrefs({ ...prefs, jauge })} options={[{ valeur: "avgProgress", libelle: "Avancement" }, { valeur: "doneRatio", libelle: "Terminées" }]} />}
          <span className="marge-auto discret">{prefs.style === "completedPerWeek" || (prefs.style === "gauge" && prefs.jauge === "doneRatio") ? "terminées comprises, quel que soit le filtre" : "nombre de tâches de la requête"}</span>
        </div>
        <Graphique taches={taches} tachesToutes={tachesToutes} cat={cat} aujourdhui={aujourdhui} prefs={prefs} />
      </section>
      <section className="panneau sy-bloc" aria-label="Treemap des projets">
        <div className="sy-tete">
          <Surtitre>Treemap des projets</Surtitre>
          <Segment etiquette="Couleur du Treemap" valeur={prefs.treemap as ModeCouleurTreemap} onChange={(treemap) => setPrefs({ ...prefs, treemap })}
            options={[{ valeur: "taille", libelle: "Volume" }, { valeur: "criticite", libelle: "Criticité" }, { valeur: "derive", libelle: "Dérive" }, { valeur: "avancement", libelle: "Avancement" }]} />
          <span className="marge-auto discret">surface : nombre de tâches</span>
          {prefs.treemap === "criticite" && <span className="sy-niveaux">{NIVEAUX_CRITICITE.map((n) => <Etat key={n.cle} ton="neutre" point={false}><span className="point" style={{ background: n.couleur }} />{`${n.libelle} ≥ ${n.min}`}</Etat>)}</span>}
        </div>
        <Treemap taches={taches} cat={cat} aujourdhui={aujourdhui} references={references} mode={prefs.treemap as ModeCouleurTreemap} />
      </section>
      <section className="panneau sy-bloc" aria-label="Notes des tableaux de bord">
        <div className="sy-tete"><Surtitre>Notes des tableaux de bord</Surtitre><span className="marge-auto discret">lecture seule · modification au lot 10</span></div>
        {notes.length ? <div className="sy-notes">{notes.map((n) => <article key={n.id} className="sy-note"><header><strong>{n.titre}</strong> <span className="mono discret">{n.tableau}{n.page ? ` · ${n.page}` : ""}</span></header><Blocs blocs={analyserMarkdown(n.contenu)} /></article>)}</div>
          : <p className="discret">Aucune note dans les tableaux de bord.</p>}
      </section>
    </div>
  );
}
