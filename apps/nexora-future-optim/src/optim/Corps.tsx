// Corps (Ref #689) : Partition sur les relevés réels. Quatre cartes
// configurables (titre libre, jusqu'à quatre mesures), deux colonnes sur grand
// écran, regroupement Jour / Semaine / Mois, faisceaux de variation ; sport
// en barres empilées par discipline ; grille des habitudes.
import { useState, type ReactNode } from "react";
import { ajouterJours } from "../donnees/modele";
import { MESURES_SANTE, formaterSante, mesureSante, type Releve } from "../donnees/sante";
import { couleurSport, nomsSports, type Activite } from "../donnees/sport";
import { resumeMetrique, seaux, serieMetrique, type Seau } from "../donnees/corps";
import { MAX_MESURES_CARTE, PERIODES_CORPS, REGROUPEMENTS, type CarteCorps, type PrefsCorps, type RegroupementCorps } from "../donnees/prefs";
import { dateCourte, hm, jourCourt, MOIS_C, semaineIso, useOptim } from "./contexte";
import { styleMesure, useCorps } from "./corps-donnees";
import { useActionsHabitudes, useJour } from "./jour";

const LIB_REG: Record<RegroupementCorps, string> = { jour: "Jour", semaine: "Semaine", mois: "Mois" };
const libelleSeau = (s: Seau, m: RegroupementCorps) => (m === "semaine" ? `S${semaineIso(s.debut)}` : m === "mois" ? MOIS_C[Number(s.cle.slice(5, 7)) - 1] : dateCourte(s.debut));
const titreSeau = (s: Seau, m: RegroupementCorps) => (m === "semaine" ? `Semaine ${semaineIso(s.debut)} · du ${dateCourte(s.debut)} au ${dateCourte(s.fin)}` : m === "mois" ? `${MOIS_C[Number(s.cle.slice(5, 7)) - 1]} ${s.cle.slice(0, 4)}${s.jours.length < 28 ? " (partiel)" : ""}` : `${jourCourt(s.debut)} ${dateCourte(s.debut)}`);

// Lissage des courbes (même tracé que le prototype).
function lisse(pts: [number, number][]) {
  if (!pts.length) return "";
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; }
  return d;
}

function Graphique({ releves, cle, s, mode, W }: { releves: Releve[]; cle: string; s: Seau[]; mode: RegroupementCorps; W: number }) {
  const m = mesureSante(cle), st = styleMesure(cle), pts = serieMetrique(releves, cle, s, mode);
  const fmt = (v: number) => formaterSante(v, m);
  const H = W < 1000 ? 120 : 104, L = 6, R = 78, T = 12, B = 20, n = pts.length;
  const connus = pts.map((p, i) => ({ ...p, i })).filter((p) => p.valeur !== null || p.bas !== null);
  if (!connus.length) return <p className="hx-dim ox-vide">Aucun relevé sur la période.</p>;
  const tous = connus.flatMap((p) => [p.bas, p.haut, p.valeur]).filter((v): v is number => v !== null);
  if (st.objectif != null) tous.push(st.objectif);
  const y0v = Math.min(...tous), y1v = Math.max(...tous), pad = (y1v - y0v) * .12 || 1;
  const bas = st.min != null ? Math.max(st.min, y0v - pad) : y0v - pad, haut = st.max != null ? Math.min(st.max, y1v + pad) : y1v + pad;
  const X = (i: number) => L + (n > 1 ? i / (n - 1) : .5) * (W - L - R), Y = (v: number) => T + (1 - (v - bas) / (haut - bas || 1)) * (H - T - B);
  const pas = Math.max(1, Math.ceil(n / (W < 1000 ? 5 : 9))), slot = (W - L - R) / Math.max(1, n);
  const faisceau = connus.filter((p) => p.bas !== null && p.haut !== null);
  const ligne = connus.filter((p) => p.ligne !== null);
  const derniere = [...pts].reverse().find((p) => p.valeur !== null);
  const iDer = derniere ? pts.lastIndexOf(derniere) : -1;
  return (
    <svg className="hx-mc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={m?.label || cle}>
      {(st.zones || []).map(([a, b, c]) => { const ya = Y(Math.min(b, haut)), yb = Y(Math.max(a, bas)); return yb > ya ? <rect key={c} x={L} y={ya} width={W - L - R} height={yb - ya} fill={c} opacity=".06" /> : null; })}
      {s.map((x, i) => (i % pas === 0 ? <g key={x.cle}><line x1={X(i)} y1={T} x2={X(i)} y2={H - B} stroke="#eef1f5" /><text x={X(i)} y={H - 5} className="hx-mct" textAnchor={i === 0 ? "start" : "middle"}>{libelleSeau(x, mode)}</text></g> : null))}
      {st.objectif != null && <><line x1={L} y1={Y(st.objectif)} x2={W - R} y2={Y(st.objectif)} stroke={st.couleur} strokeDasharray="4 4" opacity=".55" /><text x={W - R + 6} y={Y(st.objectif) + 4} className="hx-mct">obj. {fmt(st.objectif)}</text></>}
      {st.barres
        ? pts.map((p, i) => { if (p.valeur === null) return null; const bw = Math.max(2, Math.min(18, slot * .6)), ok = st.objectif != null && p.valeur >= st.objectif; return <rect key={i} x={X(i) - bw / 2} y={Y(p.valeur)} width={bw} height={Math.max(1, Y(bas) - Y(p.valeur))} rx={Math.min(4, bw / 2)} fill={st.couleur} opacity={st.objectif == null || ok ? .9 : .4} data-tip={`${titreSeau(s[i], mode)}|${m?.label} : ${fmt(p.valeur)}${mode !== "jour" ? " par jour en moyenne" : ""}`} />; })
        : <>
          {faisceau.length > 1 && <path d={`${lisse(faisceau.map((p) => [X(p.i), Y(p.haut!)]))} L${faisceau.slice().reverse().map((p) => `${X(p.i).toFixed(1)} ${Y(p.bas!).toFixed(1)}`).join(" L")} Z`} fill={st.couleur} opacity=".11" />}
          {ligne.length > 1 && <path d={lisse(ligne.map((p) => [X(p.i), Y(p.ligne!)]))} fill="none" stroke={st.couleur} strokeWidth="2.2" strokeLinecap="round" />}
          {pts.map((p, i) => p.valeur === null ? null : <circle key={i} cx={X(i)} cy={Y(p.valeur)} r={n > 60 ? 1.6 : 3} fill={st.points ? st.points(p.valeur) : st.couleur} opacity={st.points ? .9 : .5} />)}
          {pts.map((p, i) => <rect key={"h" + i} x={X(i) - slot / 2} y={T} width={slot} height={H - T - B} fill="transparent"
            data-tip={`${titreSeau(s[i], mode)}|${m?.label} : ${p.valeur === null ? "pas de relevé" : fmt(p.valeur) + (mode !== "jour" ? ` (moyenne de ${p.nb} j)` : "")}${p.bas !== null && p.haut !== null ? `|Faisceau : ${fmt(p.bas)} → ${fmt(p.haut)}${mode === "jour" ? " sur 7 jours" : ""}` : ""}`} />)}
        </>}
      {derniere && derniere.valeur !== null && <><circle cx={X(iDer)} cy={Y(derniere.valeur)} r="4.5" fill="#fff" stroke={st.points ? st.points(derniere.valeur) : st.couleur} strokeWidth="2.4" pointerEvents="none" /><text x={X(iDer) + 10} y={Y(derniere.valeur) + 4} className="hx-mcv">{fmt(derniere.valeur)}</text></>}
    </svg>
  );
}

function LigneMesure({ releves, cle, c, demi }: { releves: Releve[]; cle: string; c: PrefsCorps; demi: boolean }) {
  const { jour } = useOptim();
  const m = mesureSante(cle), st = styleMesure(cle), r = resumeMetrique(releves, cle, jour, c.periode);
  const ecart = r.dernier && r.moyenne ? (r.dernier.v - r.moyenne) / Math.abs(r.moyenne) * 100 : null;
  const bon = ecart === null ? null : st.inverse ? ecart < 0 : ecart > 0;
  return (
    <div className="hx-mrow2"><div className="hx-mhd"><small>{m?.label || cle}</small><b>{r.dernier ? formaterSante(r.dernier.v, m) : "—"}</b>
      {ecart !== null && <span className={Math.abs(ecart) < 2 ? "hx-dim" : bon ? "hx-green" : "hx-red"}>{ecart >= 0 ? "↑" : "↓"} {Math.abs(ecart).toFixed(0)} % vs moyenne</span>}
      <span className="hx-dim">{r.nb ? `moy. ${formaterSante(r.moyenne, m)} · min ${formaterSante(r.min, m)} · max ${formaterSante(r.max, m)}` : "aucun relevé"}{r.dernier && r.dernier.date !== jour ? ` · dernier : ${dateCourte(r.dernier.date)}` : ""}</span></div>
      <Graphique releves={releves} cle={cle} s={seaux(jour, c.periode, c.regroupement)} mode={c.regroupement} W={demi ? 660 : 1240} /></div>
  );
}

// Éditeur d'une carte : titre libre, jusqu'à quatre mesures.
function EditeurCarte({ carte, releves, fermer, enregistrer }: { carte: CarteCorps; releves: Releve[]; fermer: () => void; enregistrer: (c: CarteCorps) => void }) {
  const [titre, setTitre] = useState(carte.titre);
  const [mesures, setMesures] = useState(carte.mesures);
  const avecDonnees = new Set(releves.flatMap((r) => Object.keys(r).filter((k) => typeof r[k] === "number")));
  const groupes = [...new Set(MESURES_SANTE.map((m) => m.group))];
  const plein = mesures.length >= MAX_MESURES_CARTE;
  return (
    <div className="ox-editeur" role="dialog" aria-label={`Modifier la carte ${carte.titre}`}>
      <label className="ox-titre">Titre de la carte<input value={titre} maxLength={60} onChange={(e) => setTitre(e.target.value)} autoFocus /></label>
      <p className="hx-hint">Mesures affichées : {mesures.length} / {MAX_MESURES_CARTE}{plein ? " — décochez-en une pour en choisir une autre." : ""}</p>
      <div className="ox-choix">{groupes.map((g) => <div key={g}><h4>{g}</h4>{MESURES_SANTE.filter((m) => m.group === g).map((m) => {
        const on = mesures.includes(m.key);
        return <label key={m.key} className={!on && plein ? "is-off" : ""}><input type="checkbox" checked={on} disabled={!on && plein} onChange={() => setMesures(on ? mesures.filter((x) => x !== m.key) : [...mesures, m.key])} />{m.label}{!avecDonnees.has(m.key) && <small className="hx-dim"> aucun relevé</small>}</label>;
      })}</div>)}</div>
      <footer><button type="button" className="hx-btn is-ghost" onClick={fermer}>Annuler</button><button type="button" className="hx-btn is-primary" onClick={() => enregistrer({ ...carte, titre: titre.trim() || carte.titre, mesures })}>Enregistrer</button></footer>
    </div>
  );
}

function Section({ id, titre, resume, ouvert, basculer, action, children }: { id: string; titre: string; resume: ReactNode; ouvert: boolean; basculer: () => void; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`hx-tile hx-csec ${ouvert ? "" : "is-closed"}`} data-carte={id}>
      <div className="ox-csh"><button type="button" className="hx-csh" aria-expanded={ouvert} onClick={basculer}><span className="hx-chev">{ouvert ? "▾" : "▸"}</span><h2>{titre}</h2><span className="hx-csum">{resume}</span></button>{action}</div>
      {ouvert && <div className="hx-csb">{children}</div>}
    </section>
  );
}

// Sport : minutes empilées par discipline, objectif proportionné à la période.
function BlocSport({ activites, c, setReg }: { activites: Activite[]; c: PrefsCorps; setReg: (r: RegroupementCorps) => void }) {
  const { jour, d } = useOptim();
  const mode = c.regroupementSport, s = seaux(jour, c.periode, mode), ordre = nomsSports(activites);
  const objSemaine = (d.objectifsSport.weeklyHours || 0) * 60;
  const objectif = (x: Seau) => objSemaine * (mode === "jour" ? 1 / 7 : mode === "semaine" ? 1 : x.jours.length / 7);
  const B = s.map((x) => { const par: Record<string, number> = {}; activites.filter((a) => a.date >= x.debut && a.date <= x.fin).forEach((a) => { par[a.sport] = (par[a.sport] || 0) + (a.total || 0); }); return { x, par, tot: Object.values(par).reduce((t, v) => t + v, 0) }; });
  const W = 1240, H = 170, L = 6, R = 78, T = 18, Bm = 22, n = B.length;
  const max = Math.max(...B.map((b) => objectif(b.x)), ...B.map((b) => b.tot)) * 1.12 || 60;
  const slot = (W - L - R) / n, bw = Math.max(2, Math.min(34, slot * .62)), Y = (v: number) => T + (1 - v / max) * (H - T - Bm), pas = Math.max(1, Math.ceil(n / 14));
  const debutPeriode = ajouterJours(jour, -(c.periode - 1));
  const parSport: Record<string, { m: number; n: number }> = {};
  activites.filter((a) => a.date >= debutPeriode && a.date <= jour).forEach((a) => { parSport[a.sport] = parSport[a.sport] || { m: 0, n: 0 }; parSport[a.sport].m += a.total || 0; parSport[a.sport].n++; });
  const lundi = (() => { const dt = new Date(`${jour}T12:00:00Z`); return ajouterJours(jour, -((dt.getUTCDay() + 6) % 7)); })();
  const semaine = activites.filter((a) => a.date >= lundi && a.date <= jour).reduce((t, a) => t + (a.total || 0), 0);
  const recentes = activites.filter((a) => a.date <= jour).slice(-6).reverse();
  return <>
    <div className="hx-mrow2"><div className="hx-mhd"><small>Sport</small><b>{hm(Math.round(semaine))}{objSemaine > 0 && <span className="hx-dim"> / {d.objectifsSport.weeklyHours} h</span>}</b><span className="hx-dim">cette semaine</span>
      <div className="hx-seg is-xs">{REGROUPEMENTS.map((r) => <button key={r} type="button" aria-pressed={mode === r} onClick={() => setReg(r)}>{LIB_REG[r]}</button>)}</div></div>
      <div>
        <svg className="hx-mc" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Minutes de sport par ${LIB_REG[mode].toLowerCase()}`}>
          <defs>{B.map((b, i) => { if (!b.tot) return null; const x = L + (i + .5) * slot - bw / 2, y = Y(b.tot), r = Math.min(4, bw / 2); return <clipPath key={i} id={`spk-${i}`}><path d={`M${x} ${Y(0)} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${Y(0)} Z`} /></clipPath>; })}</defs>
          {[0, .5, 1].map((f) => <line key={f} x1={L} x2={W - R} y1={Y(max / 1.12 * f)} y2={Y(max / 1.12 * f)} stroke="#eef1f5" />)}
          {objSemaine > 0 && mode !== "mois" && <><line x1={L} x2={W - R} y1={Y(objectif(B[0].x))} y2={Y(objectif(B[0].x))} stroke="#0e7490" strokeDasharray="4 4" opacity=".6" /><text x={W - R + 6} y={Y(objectif(B[0].x)) + 4} className="hx-mct">obj. {hm(Math.round(objectif(B[0].x)))}</text></>}
          {B.map((b, i) => {
            const x = L + (i + .5) * slot - bw / 2; let y = Y(0);
            return <g key={b.x.cle}>
              {objSemaine > 0 && mode === "mois" && <line x1={x - 3} x2={x + bw + 3} y1={Y(objectif(b.x))} y2={Y(objectif(b.x))} stroke="#0e7490" strokeDasharray="3 3" opacity=".7" />}
              {b.tot > 0 && <g clipPath={`url(#spk-${i})`} data-tip={`${titreSeau(b.x, mode)}|Total : ${hm(Math.round(b.tot))}${objSemaine ? ` sur un objectif de ${hm(Math.round(objectif(b.x)))}` : ""}|${Object.entries(b.par).map(([k, v]) => `${k} : ${hm(Math.round(v))}`).join(" · ")}`}>
                {ordre.map((k) => { const v = b.par[k] || 0; if (!v) return null; const h = Y(0) - Y(v); y -= h; return <rect key={k} x={x} y={y} width={bw} height={h} fill={couleurSport(k, ordre)} stroke="#fff" strokeWidth="1.5" />; })}
                <rect x={x} y={Y(b.tot)} width={bw} height={Y(0) - Y(b.tot)} fill="transparent" /></g>}
              {b.tot > 0 && n <= 26 && <text x={x + bw / 2} y={Y(b.tot) - 6} className="hx-mcl" textAnchor="middle">{(b.tot / 60).toFixed(1).replace(".", ",")} h</text>}
              {i % pas === 0 && <text x={x + bw / 2} y={H - 6} className="hx-mct" textAnchor="middle">{libelleSeau(b.x, mode)}</text>}
            </g>;
          })}
          <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} stroke="#c9ccd1" />
        </svg>
        <div className="hx-sleg is-tot">{ordre.filter((k) => parSport[k]).map((k) => <span key={k}><i style={{ background: couleurSport(k, ordre) }} />{k} <b>{hm(Math.round(parSport[k].m))}</b> · {parSport[k].n} séance{parSport[k].n > 1 ? "s" : ""}</span>)}</div>
      </div></div>
    {recentes.length > 0 && <table className="hx-stab"><thead><tr><th>Date</th><th>Sport</th><th>Séance</th><th>Durée</th><th>Distance</th><th>D+</th><th>FC moy.</th></tr></thead>
      <tbody>{recentes.map((a) => <tr key={a.id || a.date + a.title}><td>{jourCourt(a.date)} {dateCourte(a.date)}</td><td><i style={{ background: couleurSport(a.sport, ordre) }} />{a.sport}</td><td>{a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.title}</a> : a.title}</td><td>{a.total ? hm(Math.round(a.total)) : "—"}</td><td>{a.distance ? `${String(a.distance).replace(".", ",")} km` : "—"}</td><td>{a.elevation ? `${a.elevation} m` : "—"}</td><td>{a.hr ? `${a.hr} bpm` : "—"}</td></tr>)}</tbody></table>}
  </>;
}

// Grille des habitudes : une case par jour, cliquable (règles de Nexora).
function GrilleHabitudes({ n }: { n: number }) {
  const { etats, couleurHabitude, jour, d } = useJour();
  const act = useActionsHabitudes();
  const jours = Array.from({ length: n }, (_, i) => ajouterJours(jour, i - n + 1));
  const parJour = new Map(jours.map((x) => [x, etats(x)]));
  const cellules: ReactNode[] = [<span key="c0" />, ...jours.map((x, i) => <span key={"d" + x} className={`hx-hgd ${x === jour ? "is-today" : ""}`}>{n <= 30 || i % 7 === 0 ? Number(x.slice(8)) : ""}</span>), <span key="c1" />];
  d.themesHabitudes.filter((t) => t.habits.length).forEach((t) => {
    cellules.push(<span key={"t" + t.id} className="hx-hgl is-theme" style={{ ["--c" as string]: t.color }}><b>{t.name}</b><small>{t.selectionMode === "single" ? "un seul choix" : ""}</small></span>, ...jours.map((x) => <span key={t.id + x} />), <span key={t.id + "r"} />);
    t.habits.forEach((h) => {
      const col = couleurHabitude(h); let ok = 0, tot = 0;
      cellules.push(<span key={h.id} className="hx-hgl is-sub" data-hp={h.id}><i className="hx-hdot" style={{ background: col }} />{h.name}</span>);
      jours.forEach((x) => {
        const e = parJour.get(x)!.parTheme.find((p) => p.theme.id === t.id)?.habitudes.find((y) => y.h.id === h.id);
        const etat = e?.etat || "a-faire"; if (etat !== "na") { tot++; if (etat !== "a-faire") ok++; }
        const cls = etat === "fait" ? "is-done" : etat === "partiel" ? "is-part" : etat === "na" ? "is-na" : "is-todo";
        cellules.push(<button key={h.id + x} type="button" className={`hx-hc ${cls}`} data-hp={h.id} aria-label={`${h.name} le ${dateCourte(x)}`} data-tip={`${h.name}|${dateCourte(x)} · ${etat === "fait" ? "faite" : etat === "partiel" ? `${e?.valeur ?? 0} / ${h.max}` : etat === "na" ? "non applicable" : "à faire"}`}
          style={{ ["--c" as string]: col, ["--f" as string]: etat === "partiel" ? Math.min(1, (e?.valeur ?? 0) / (h.max || 1)) : 1 }}
          onClick={() => (h.kind === "numeric" ? act.pas(h, x, e?.valeur ?? null, 1, etat === "na") : act.basculer(h.id, x, etat === "na"))} />);
      });
      cellules.push(<span key={h.id + "%"} className="hx-hgr">{tot ? Math.round(ok / tot * 100) : 0} %</span>);
    });
  });
  if (!d.themesHabitudes.some((t) => t.habits.length)) return <p className="hx-dim">Aucune habitude définie dans Nexora.</p>;
  return <div className="hx-hg" style={{ ["--n" as string]: n }}>{cellules}</div>;
}

export function Corps() {
  const { prefs, ecrirePrefs, d, jour } = useOptim();
  const { releves, activites, charge, erreurSante, erreurSport } = useCorps();
  const { etats } = useJour();
  const [edition, setEdition] = useState<string | null>(null);
  const c = prefs.corps;
  const majCorps = (p: Partial<PrefsCorps>) => void ecrirePrefs({ corps: { ...c, ...p } });
  const replie = (id: string) => c.replies.includes(id);
  const basculer = (id: string) => majCorps({ replies: replie(id) ? c.replies.filter((x) => x !== id) : [...c.replies, id] });
  const derniere = (cle: string) => { const r = resumeMetrique(releves, cle, jour, 365); return r.dernier ? formaterSante(r.dernier.v, mesureSante(cle)) : "—"; };
  const carte = (k: CarteCorps) => (
    <Section key={k.id} id={k.id} titre={k.titre} ouvert={!replie(k.id)} basculer={() => basculer(k.id)}
      resume={k.mesures.slice(0, 2).map((x) => `${(mesureSante(x)?.label || x).toLowerCase()} ${derniere(x)}`).join(" · ") || "aucune mesure"}
      action={<button type="button" className="hx-more is-plain ox-mod" onClick={() => setEdition(edition === k.id ? null : k.id)} aria-expanded={edition === k.id}>Modifier</button>}>
      {edition === k.id && <EditeurCarte carte={k} releves={releves} fermer={() => setEdition(null)} enregistrer={(nv) => { majCorps({ cartes: c.cartes.map((x) => (x.id === nv.id ? nv : x)) }); setEdition(null); }} />}
      {!k.mesures.length ? <p className="hx-dim">Aucune mesure choisie. « Modifier » pour en ajouter jusqu'à {MAX_MESURES_CARTE}.</p> : k.mesures.map((x) => <LigneMesure key={x} releves={releves} cle={x} c={c} demi />)}
    </Section>
  );
  const eh = etats(jour);
  return (
    <main className="hx-main hx-corps2" data-scroll>
      <div className="hx-hello hx-row"><div><h1>Corps</h1><p>Trait : moyenne · faisceau : minimum et maximum (sur 7 jours glissants en vue Jour, dans chaque période sinon) · points : valeur du jour ou moyenne de la période. Chaque carte se renomme et reçoit jusqu'à {MAX_MESURES_CARTE} mesures (« Modifier »).</p></div>
        <div className="hx-opts"><span>Période</span><div className="hx-seg is-sm">{PERIODES_CORPS.map((p) => <button key={p} type="button" aria-pressed={c.periode === p} onClick={() => majCorps({ periode: p })}>{p === 365 ? "1 an" : `${p} j`}</button>)}</div>
          <span>Regrouper par</span><div className="hx-seg is-sm">{REGROUPEMENTS.map((r) => <button key={r} type="button" aria-pressed={c.regroupement === r} onClick={() => majCorps({ regroupement: r })}>{LIB_REG[r]}</button>)}</div></div></div>
      {!charge && <p className="hx-dim">Chargement des relevés santé et des activités…</p>}
      {(erreurSante || erreurSport) && <p className="ox-alerte">{erreurSante && <>Santé indisponible : {erreurSante}. </>}{erreurSport && <>Sport indisponible : {erreurSport}.</>}</p>}
      <div className="hx-cgrid">{c.cartes.map(carte)}</div>
      <Section id="act" titre="Activité et sport" ouvert={!replie("act")} basculer={() => basculer("act")} resume={`${activites.filter((a) => a.date >= ajouterJours(jour, -6)).length} séances sur 7 jours`}>
        {activites.length ? <BlocSport activites={activites} c={c} setReg={(r) => majCorps({ regroupementSport: r })} /> : <p className="hx-dim">{charge ? "Aucune activité relayée." : "…"}</p>}
      </Section>
      <Section id="hab" titre="Habitudes" ouvert={!replie("hab")} basculer={() => basculer("hab")} resume={`${eh.faites}/${eh.total} aujourd'hui`}>
        <GrilleHabitudes n={Math.min(c.periode, 30)} />{c.periode > 30 && <p className="hx-hint">Habitudes limitées aux 30 derniers jours pour rester lisibles.</p>}
      </Section>
      {d.objectifsSport.weeklyHours == null && activites.length > 0 && <p className="hx-hint">Aucun objectif hebdomadaire de sport défini dans Nexora : la ligne d'objectif est masquée.</p>}
    </main>
  );
}
