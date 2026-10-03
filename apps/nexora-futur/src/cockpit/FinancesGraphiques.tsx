// Graphiques budget, cumul et flux (Ref #659, lot 6b). Les données des
// graphiques viennent du serveur (charts de budget-summary) ; le Sankey part
// des lignes brutes (sankey-data), normalisées comme nexora-project.
import { useEffect, useMemo, useRef, useState } from "react";
import type { AccesFinance } from "../donnees/source";
import { ErreurFinance } from "../donnees/source";
import { euros, graduationsMontant, libelleMois, messageFinance } from "../donnees/finance";
import { MODES_CUMUL, disposerSankey, grapheMensuel, graphePatrimoine, modeleCumul, normaliserSankey, type Graphes, type ModeCumul } from "../donnees/finance-graphes";
import { Segment, Surtitre, Etat } from "../composants";

const court = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const k = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10} k` : String(Math.round(v)));

export function GraphiquesBudget({ c, mois }: { c: Graphes; mois: string }) {
  const [vue, setVue] = useState<"waterfall" | "donut" | "waffle" | "periodique">("waterfall");
  const [empile, setEmpile] = useState(true);
  const total = c.byCategory.reduce((s, x) => s + x.amount, 0);
  return (
    <section className="panneau sy-bloc" aria-label={`Graphiques budget, ${libelleMois(mois)}`}>
      <div className="sy-tete"><Surtitre>Graphique · {libelleMois(mois)}</Surtitre><span className="marge-auto" />
        <Segment etiquette="Graphique budget" valeur={vue} onChange={setVue} options={[{ valeur: "waterfall", libelle: "Cascade" }, { valeur: "donut", libelle: "Donut" }, { valeur: "waffle", libelle: "Gaufre" }, { valeur: "periodique", libelle: "12 mois" }]} />
      </div>
      {vue === "waterfall" && (() => {
        const max = Math.max(1, ...c.waterfall.map((w) => Math.max(Math.abs(w.from), Math.abs(w.to))));
        const min = Math.min(0, ...c.waterfall.map((w) => Math.min(w.from, w.to)));
        const pct = (v: number) => ((v - min) / (max - min)) * 100;
        return <div className="sy-barh fi-cascade" role="list" aria-label="Cascade : revenus, dépenses par catégorie, solde net">{c.waterfall.map((w) => {
          const a = Math.min(w.from, w.to); const b = Math.max(w.from, w.to);
          return <div key={w.label} role="listitem" className="sy-barh-l"><span className="sy-barh-n">{w.label}</span><span className="sy-barh-b fi-cascade-b"><span style={{ marginLeft: `${pct(a)}%`, width: `${Math.max(0.5, pct(b) - pct(a))}%`, background: w.absolute ? (w.to < 0 ? "var(--crit)" : "var(--ok)") : "var(--crit)" }} /></span><span className="mono">{euros(w.absolute ? w.to : w.to - w.from)}</span></div>;
        })}</div>;
      })()}
      {vue === "donut" && (() => {
        let a = -Math.PI / 2;
        return <div className="sy-graph-ligne">
          <svg viewBox="0 0 200 200" width={200} height={200} role="img" aria-label={`Dépenses par catégorie : ${c.byCategory.map((x) => `${x.category} ${euros(x.amount)}`).join(", ")}`}>
            {c.byCategory.map((x) => { const d = (x.amount / (total || 1)) * Math.PI * 2; const p = (r: number, t: number) => `${100 + r * Math.cos(t)} ${100 + r * Math.sin(t)}`; const big = d > Math.PI ? 1 : 0; const path = `M${p(90, a)} A90 90 0 ${big} 1 ${p(90, a + d)} L${p(55, a + d)} A55 55 0 ${big} 0 ${p(55, a)} Z`; a += d; return <path key={x.category} d={c.byCategory.length === 1 ? "M100 10 A90 90 0 1 1 99.99 10 L99.99 45 A55 55 0 1 0 100 45 Z" : path} fill={x.color} stroke="var(--surface)"><title>{`${x.category} : ${euros(x.amount)}`}</title></path>; })}
            <text x={100} y={104} textAnchor="middle" className="sy-gros" style={{ fontSize: 18 }}>{euros(total)}</text>
          </svg>
          <ul className="sy-legende fi-legende-col">{c.byCategory.map((x) => <li key={x.category}><span className="point" style={{ background: x.color }} />{x.category} <span className="mono discret">{euros(x.amount)} · {Math.round((x.amount / (total || 1)) * 100)} %</span></li>)}</ul>
        </div>;
      })()}
      {vue === "waffle" && (c.waffle.unit ? <div className="fi-gaufre" role="list" aria-label={`Gaufre : une case = ${euros(c.waffle.unit)}`}>
        <p className="discret">une case = {euros(c.waffle.unit)} (la plus grosse catégorie / 20), couleur = compte</p>
        {c.waffle.categories.map((x) => <div key={x.name} role="listitem" className="sy-barh-l"><span className="sy-barh-n">{x.name}</span><span className="fi-cases">{x.cells.map((cel, i) => <i key={i} style={{ background: cel.color }} title={cel.account} />)}</span><span className="mono">{euros(x.value)}</span></div>)}
      </div> : <p className="discret">Aucune dépense ce mois-ci.</p>)}
      {vue === "periodique" && (() => {
        const max = Math.max(1, ...c.periodic.map((m) => m.expenses));
        return <><label className="insp-case"><input type="checkbox" checked={empile} onChange={(e) => setEmpile(e.target.checked)} /> Détail par catégorie</label>
          <svg viewBox="0 0 640 210" className="sy-svg" role="img" aria-label={`Dépenses des 12 derniers mois : ${c.periodic.map((m) => `${m.month} ${euros(m.expenses)}`).join(", ")}`}>
            {c.periodic.map((m, i) => { let y = 170; const x = 12 + i * 52; return <g key={m.month}>
              {empile ? m.categories.map((cat) => { const h = (cat.amount / max) * 150; y -= h; return <rect key={cat.category} x={x} y={y} width={40} height={h} fill={cat.color}><title>{`${cat.category} : ${euros(cat.amount)}`}</title></rect>; })
                : <rect x={x} y={170 - (m.expenses / max) * 150} width={40} height={(m.expenses / max) * 150} fill="var(--crit)" />}
              <text x={x + 20} y={164 - (m.expenses / max) * 150} textAnchor="middle" className="sy-txt">{k(m.expenses)}</text>
              <text x={x + 20} y={188} textAnchor="middle" className="sy-txt discret">{libelleMois(m.month).slice(0, 4)}.</text>
            </g>; })}
          </svg></>;
      })()}
    </section>
  );
}

export function CumulBudget({ c, mois }: { c: Graphes; mois: string }) {
  const [mode, setMode] = useState<ModeCumul>("budget");
  const m = useMemo(() => modeleCumul(c), [c]);
  if (!m.days.length) return null;
  const W = 640; const H = 240; const n = m.days.length;
  const hautMax = Math.max(1, m.budgetTotal, ...m.total, ...m.revenus.map(Number));
  const x = (i: number) => 44 + (i * (W - 60)) / Math.max(1, n - 1); const y = (v: number, max = hautMax) => 10 + (1 - v / max) * (H - 40);
  const ligne = (v: number[], max?: number) => v.map((val, i) => `${x(i)},${y(val, max)}`).join(" ");
  const g = graduationsMontant(0, hautMax);
  const axe = <>{g.traits.map((t) => <g key={t}><line x1={40} x2={W} y1={y(t)} y2={y(t)} stroke="var(--ligne2)" /><text x={36} y={y(t) + 3} textAnchor="end" className="sy-txt discret">{k(t)}</text></g>)}
    {[0, Math.floor((n - 1) / 2), n - 1].map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="sy-txt discret">{court(m.days[i])}</text>)}</>;
  return (
    <section className="panneau sy-bloc" aria-label={`Dépenses cumulées, ${libelleMois(mois)}`}>
      <div className="sy-tete"><Surtitre>Dépenses cumulées · {libelleMois(mois)}</Surtitre>
        <select aria-label="Mode du cumul" value={mode} onChange={(e) => setMode(e.target.value as ModeCumul)}>{MODES_CUMUL.map((x) => <option key={x.cle} value={x.cle}>{x.libelle}</option>)}</select>
        <span className="marge-auto" />
        <span className="mono">dépensé {euros(m.depense)}{m.budgetTotal ? ` / ${euros(m.budgetTotal)}` : ""}</span>
        {m.jourDepassement >= 0 && <Etat ton="crit" point={false}>{`budget dépassé le ${court(m.days[m.jourDepassement])}`}</Etat>}
      </div>
      {mode === "multiples" ? (
        <div className="fi-multiples">{m.series.map((s) => { const max = Math.max(1, s.budget, s.total); return (
          <article key={s.categorie} className="fi-multiple"><header><strong>{s.categorie}</strong><span className={`mono ${s.budget && s.total > s.budget ? "crit" : "discret"}`}>{euros(s.total)}{s.budget ? ` / ${euros(s.budget)}` : ""}</span></header>
            <svg viewBox="0 0 200 60" className="sy-svg" role="img" aria-label={`${s.categorie} : ${euros(s.total)}`}>
              {s.budget > 0 && <line x1={0} x2={200} y1={58 - (s.budget / max) * 54} y2={58 - (s.budget / max) * 54} stroke="var(--encre2)" strokeDasharray="3 2" />}
              <polyline points={s.valeurs.map((v, i) => `${(i * 200) / Math.max(1, n - 1)},${58 - (v / max) * 54}`).join(" ")} fill="none" stroke={s.couleur} strokeWidth={2} />
            </svg></article>); })}</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="sy-svg fi-cumul" role="img" aria-label={`Cumul ${MODES_CUMUL.find((x) => x.cle === mode)?.libelle} : ${euros(m.depense)} dépensés`}>
          {axe}
          {mode === "categories" && (() => { let bas = Array(n).fill(0); return m.series.map((s) => { const haut = bas.map((b, i) => b + (s.valeurs[i] || 0)); const d = `M${haut.map((v, i) => `${x(i)},${y(v)}`).join(" L")} L${bas.map((v, i) => `${x(i)},${y(v)}`).reverse().join(" L")} Z`; bas = haut; return <path key={s.categorie} d={d} fill={s.couleur} opacity={0.75}><title>{`${s.categorie} : ${euros(s.total)}`}</title></path>; }); })()}
          {mode === "budget" && <>
            {m.budgetTotal > 0 && <><line x1={x(0)} x2={x(n - 1)} y1={y(m.budgetTotal)} y2={y(m.budgetTotal)} stroke="var(--crit)" strokeDasharray="4 3" /><polyline points={ligne(m.rythme)} fill="none" stroke="var(--encre2)" strokeDasharray="2 3" /></>}
            <polyline points={ligne(m.revenus.map(Number))} fill="none" stroke="var(--ok)" strokeWidth={1.5} />
            <polyline points={ligne(m.total)} fill="none" stroke="var(--encre)" strokeWidth={2.5} />
          </>}
          {mode === "trajectories" && m.series.map((s) => <polyline key={s.categorie} points={ligne(s.valeurs)} fill="none" stroke={s.couleur} strokeWidth={2}><title>{s.categorie}</title></polyline>)}
          {mode === "daily" && <>
            {m.totalJour.map((v, i) => <rect key={i} x={x(i) - 4} y={y(v)} width={8} height={Math.max(0, y(0) - y(v))} fill="var(--encre3)" opacity={0.6}><title>{`${court(m.days[i])} : ${euros(v)}`}</title></rect>)}
            <polyline points={ligne(m.total)} fill="none" stroke="var(--encre)" strokeWidth={2.5} />
          </>}
        </svg>
      )}
      {mode !== "multiples" && <ul className="sy-legende">
        {(mode === "budget" || mode === "daily") ? <><li><span className="fi-trait" style={{ borderColor: "var(--encre)" }} />dépenses cumulées</li>{mode === "budget" && <><li><span className="fi-trait" style={{ borderColor: "var(--ok)" }} />revenus cumulés</li>{m.budgetTotal > 0 && <><li><span className="fi-trait pointille" style={{ borderColor: "var(--crit)" }} />budget</li><li><span className="fi-trait pointille" style={{ borderColor: "var(--encre2)" }} />rythme prévu</li></>}</>}</>
          : m.series.map((s) => <li key={s.categorie}><span className="point" style={{ background: s.couleur }} />{s.categorie}{s.autres ? ` (${s.membres.length})` : ""} <span className="mono discret">{euros(s.total)}</span></li>)}
      </ul>}
    </section>
  );
}

export function FluxBudget({ finance, jour, version }: { finance: AccesFinance; jour: string; version: number }) {
  const [type, setType] = useState<"mensuel" | "patrimoine">("mensuel");
  const [periode, setPeriode] = useState<"mois" | "precedent" | "annee" | "douze">("mois");
  const [brut, setBrut] = useState<{ donnees: unknown; erreur: string | null }>({ donnees: null, erreur: null });
  useEffect(() => { let vivant = true; finance.lire("sankey-data").then((d) => vivant && setBrut({ donnees: d, erreur: null })).catch((e) => vivant && setBrut({ donnees: null, erreur: e instanceof ErreurFinance ? e.code : String(e) })); return () => { vivant = false; }; }, [finance, version]);
  const bornes = useMemo(() => {
    const m = jour.slice(0, 7); const fin = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0, 12)).toISOString().slice(0, 10);
    if (periode === "precedent") { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 2, 1, 12)).toISOString().slice(0, 7); return { from: `${d}-01`, to: fin(d) }; }
    if (periode === "annee") return { from: `${jour.slice(0, 4)}-01-01`, to: jour };
    if (periode === "douze") { const d = new Date(`${jour}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 364); return { from: d.toISOString().slice(0, 10), to: jour }; }
    return { from: `${m}-01`, to: fin(m) };
  }, [periode, jour]);
  const boite = useRef<HTMLDivElement>(null); const [largeur, setLargeur] = useState(800);
  useEffect(() => { const el = boite.current; if (!el) return; const o = new ResizeObserver(([e]) => setLargeur(Math.max(320, e.contentRect.width))); o.observe(el); return () => o.disconnect(); }, []);
  const res = useMemo(() => {
    if (!brut.donnees) return null;
    try { const d = normaliserSankey(brut.donnees); return { g: type === "mensuel" ? grapheMensuel(d, bornes) : graphePatrimoine(d, bornes.to) }; }
    catch (e) { return { erreur: (e as Error).message }; }
  }, [brut.donnees, type, bornes]);
  const H = 380; const marge = 150;
  const disp = res && "g" in res && res.g && res.g.liens.length ? disposerSankey(res.g, largeur - 2 * marge, H) : null;
  return (
    <section className="panneau sy-bloc" aria-label="Flux du budget">
      <div className="sy-tete"><Surtitre>Flux</Surtitre>
        <Segment etiquette="Type de flux" valeur={type} onChange={setType} options={[{ valeur: "mensuel", libelle: "Revenus → comptes → dépenses" }, { valeur: "patrimoine", libelle: "Patrimoine" }]} />
        <select aria-label="Période des flux" value={periode} onChange={(e) => setPeriode(e.target.value as typeof periode)}><option value="mois">Ce mois</option><option value="precedent">Mois précédent</option><option value="annee">Cette année</option><option value="douze">12 derniers mois</option></select>
        <span className="marge-auto mono discret">{type === "patrimoine" ? `soldes au ${court(bornes.to)}` : `${court(bornes.from)} → ${court(bornes.to)}`}</span>
      </div>
      <div ref={boite}>
        {brut.erreur ? <p role="alert"><Etat ton="crit">Budget</Etat> {messageFinance(brut.erreur)}</p>
          : !res ? <p className="surtitre zone-charge">Lecture des flux…</p>
          : "erreur" in res ? <p role="alert"><Etat ton="crit">Budget</Etat> {res.erreur}</p>
          : !disp ? <p className="discret">Aucun flux sur cette période.</p>
          : <svg viewBox={`0 0 ${largeur} ${H + 30}`} className="fi-sankey" role="img" aria-label={`Flux : ${res.g!.liens.length} liaisons`}>
            {res.g!.colonnes.map((col, i) => <text key={col} x={marge + (i * (largeur - 2 * marge - disp.epaisseur)) / 2 + disp.epaisseur / 2} y={H + 24} textAnchor="middle" className="sy-txt discret">{col}</text>)}
            <g transform={`translate(${marge},0)`}>
              {disp.liens.map((l, i) => <path key={i} d={l.chemin} fill="none" stroke={disp.noeuds.find((nd) => nd.id === (type === "mensuel" && l.cible.startsWith("category:") ? l.cible : l.source))?.couleur} strokeOpacity={0.35} strokeWidth={l.epaisseur}><title>{`${disp.noeuds.find((nd) => nd.id === l.source)?.nom} → ${disp.noeuds.find((nd) => nd.id === l.cible)?.nom} : ${euros(l.valeur)}`}</title></path>)}
              {disp.noeuds.map((nd) => <g key={nd.id}><rect x={nd.x} y={nd.y} width={disp.epaisseur} height={nd.h} fill={nd.couleur} rx={2} />
                <text x={nd.col === 2 ? nd.x + disp.epaisseur + 6 : nd.col === 0 ? nd.x - 6 : nd.x + disp.epaisseur / 2} y={nd.col === 1 ? nd.y - 4 : nd.y + nd.h / 2 + 4} textAnchor={nd.col === 2 ? "start" : nd.col === 0 ? "end" : "middle"} className="sy-txt">{nd.nom} {euros(nd.valeur)}</text></g>)}
            </g>
          </svg>}
      </div>
    </section>
  );
}
