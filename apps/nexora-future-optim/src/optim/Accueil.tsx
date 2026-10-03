// Accueil (Ref #688) : Mosaïque condensée — Journée (Cadran agrandi,
// Aujourd'hui, À rattraper), Corps, Semaine, Projets, bandeau Argent.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { ajouterJours, estProjetCalendrier, type Tache } from "../donnees/modele";
import { lignesFrise } from "../donnees/planning";
import { santeProjet } from "../donnees/projet";
import type { SyntheseBudget } from "../donnees/finance";
import { dateCourte, hm, jourCourt, jourLong, majuscule, useOptim, useUi } from "./contexte";
import { ListeCoches } from "./ListeCoches";
import { formaterSante, mesureSante, MESURES_SANTE } from "../donnees/sante";
import { resumeMetrique } from "../donnees/corps";
import { LARGEURS_ACCUEIL, LARGEURS_ACCUEIL_MOYEN, MAX_MESURES_CARTE, placerTuiles, type TuileAccueil } from "../donnees/prefs";
import { styleMesure, useCorps } from "./corps-donnees";
import { Grille, graduations, HAUTEUR_RANGEE, infobulle, LigneGantt, ranger, tx, type Plage } from "./frise";
import { Cadran, Coche, heureParisDec, hmf, PixelHabitudes, useElementsHoraires, useJour } from "./jour";
import { SelecteurStyle, useDebordRuban } from "./Planning";

const euro = (v?: number) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }) : "—");

function LigneTache({ t, sansProjet }: { t: Tache; sansProjet?: boolean }) {
  const { projet, fini, retard, joursRetard, jour } = useOptim();
  const { ouvrir, tacheId } = useUi();
  const p = projet(t.projectId);
  return <li className={`hx-tr ${fini(t) ? "is-done" : ""} ${tacheId === t.id ? "is-sel" : ""}`}><Coche t={t} /><button type="button" className="hx-tt" onClick={() => ouvrir(t.id)}>{t.milestone ? "◆ " : ""}{t.title}</button>
    {!sansProjet && <span className="hx-pj"><i style={{ background: p.color }} />{p.name}</span>}
    {retard(t) ? <span className="hx-due is-late">−{joursRetard(t)} j</span> : <span className="hx-due">{t.end === jour ? (t.startTime || "auj.") : dateCourte(t.end)}</span>}</li>;
}

function Semaine({ ouvrirPlanning }: { ouvrirPlanning: () => void }) {
  const { d, jour, prefs, projet, statut, fini, retard, joursRetard } = useOptim();
  const { ouvrir, tacheId } = useUi();
  // Contenu réglable (Réglages › Accueil › Bloc Semaine).
  const o = prefs.accueil.semaine;
  const lundi = ajouterJours(jour, -((new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7));
  const debut = o.debut === "lundi" ? lundi : jour;
  const r: Plage = { zoom: "semaine", debut, fin: ajouterJours(debut, o.jours - 1), jours: o.jours };
  const calendrier = (t: Tache) => estProjetCalendrier(d.projets, t.projectId);
  const ts = d.taches.filter((t) => (o.terminees || !fini(t)) && statut(t.statusId).name.toLowerCase() !== "information" && !!t.end
    && (o.calendriers || !calendrier(t)) && (!o.jalonsSeuls || !!t.milestone) && (!o.projets.length || o.projets.includes(t.projectId || ""))
    && (t.end >= r.debut || (o.retards && retard(t))) && (t.milestone ? t.end : t.start || t.end) <= r.fin);
  const ref = useDebordRuban([ts, prefs.gantt]);
  const infos = (t: Tache) => ({ fini: fini(t), retard: retard(t), joursRetard: joursRetard(t), jour });
  const projets = d.projets.map((p) => ({ p, pk: ranger(lignesFrise(ts.filter((t) => t.projectId === p.id)), r, prefs.gantt, 640) })).filter((x) => x.pk.elements.length);
  return (
    <section className="hx-tile hx-t-week"><header className="hx-th"><h2>{o.jours === 14 ? "Deux semaines" : "Semaine"}</h2><SelecteurStyle petit /><button type="button" className="hx-more" onClick={ouvrirPlanning}>Ouvrir ›</button></header>
      <div className="hx-tl is-mini" ref={ref}>
        <div className="hx-tlhead"><span /><div className="hx-tltrack">{graduations(r).map((k) => <span key={k.iso} className={`hx-tick ${k.iso === jour ? "is-today" : ""}`} style={{ left: `${tx(r, k.iso)}%`, width: `${100 / r.jours}%` }}>{k.libelle}</span>)}</div></div>
        {projets.map(({ p, pk }) => <div key={p.id} className="hx-lane" data-lane-project={p.id}><span className="hx-lh is-static" style={{ ["--c" as string]: p.color }}><b>{p.name}</b></span>
          <div className="hx-ltrack" data-rs={r.debut} data-rn={r.jours} style={{ height: pk.rangees * HAUTEUR_RANGEE + 6 }}><Grille r={r} jour={jour} />
            {pk.elements.map((el) => <LigneGantt key={el.l.t.id} el={el} r={r} style={prefs.gantt} couleur={projet(el.l.t.projectId).color} statuts={d.statuts} infos={infos(el.l.t)} selection={tacheId === el.l.t.id} ouvrir={ouvrir} info={infobulle(el.l.t, el.l, p.name || "", statut(el.l.t.statusId).name, infos(el.l.t))} />)}
          </div></div>)}
        {!projets.length && <p className="hx-empty">Rien d'échu sur la période{o.projets.length || o.jalonsSeuls || !o.calendriers ? " avec les réglages du bloc" : ""}.</p>}
      </div>
    </section>
  );
}

function BandeauArgent({ ouvrir }: { ouvrir: () => void }) {
  const { source, jour } = useOptim();
  const [s, setS] = useState<SyntheseBudget | null>(null);
  const [erreur, setErreur] = useState("");
  useEffect(() => {
    let vivant = true;
    if (!source.finance) { setErreur("Budget non relayé."); return; }
    source.finance.lire("budget-summary", { month: jour.slice(0, 7) }).then((x) => { if (vivant) setS(x as SyntheseBudget); }).catch((e: Error) => { if (vivant) setErreur(e.message || "indisponible"); });
    return () => { vivant = false; };
  }, [source, jour]);
  const jourMois = Number(jour.slice(8)), nbJours = new Date(Date.UTC(+jour.slice(0, 4), +jour.slice(5, 7), 0)).getUTCDate();
  return (
    <section className="hx-tile hx-t-money"><header className="hx-th"><h2>Suivi du budget <small>{majuscule(new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${jour.slice(0, 7)}-01T12:00:00Z`)))}</small></h2><button type="button" className="hx-more" onClick={ouvrir}>Ouvrir ›</button></header>
      {!s ? <p className="hx-dim">{erreur ? `Budget indisponible pour l'instant (${erreur}). Il arrive avec le lot Argent.` : "Chargement du budget…"}</p> : (
        <div className="hx-mstrip">
          <div><small>Reste à dépenser</small><b>{euro(s.totals.remaining)}</b><span className="hx-dim">{euro(s.totals.remaining / Math.max(1, nbJours - jourMois + 1))}/jour</span></div>
          <div className="is-wide"><small>Rythme du mois · {euro(s.totals.expenses)} sur {euro(s.totals.budget)}</small><span className="hx-pace"><i style={{ width: `${Math.min(100, Math.round(s.totals.expenses / Math.max(1, s.totals.budget) * 100))}%` }} /><b style={{ left: `${Math.round(jourMois / nbJours * 100)}%` }} /></span>
            {(() => { const ecart = s.totals.expenses - s.totals.budget * jourMois / nbJours; return <span className={ecart > 0 ? "hx-red" : "hx-dim"}>{ecart > 0 ? `${euro(ecart)} au-dessus du rythme` : "dans le rythme"}</span>; })()}</div>
          <div><small>Dépassement</small>{s.overBudget.length ? <><b className="hx-red">{s.overBudget[0]}</b><span className="hx-dim">{s.overBudget.length > 1 ? `et ${s.overBudget.length - 1} autre(s)` : ""}</span></> : <b className="hx-green">aucun</b>}</div>
          <div><small>Patrimoine</small><b>{euro(s.wealth?.total)}</b></div>
          <div className="is-wide"><small>À classer · {s.toCategorize.length}</small>{s.toCategorize.slice(0, 2).map((x) => <span key={x.id} className="hx-cls">{x.label} <span className="hx-num">{euro(x.amount)}</span></span>)}{!s.toCategorize.length && <span className="hx-dim">Tout est classé</span>}</div>
        </div>)}
    </section>
  );
}

// Tuile Corps : jusqu'à quatre mesures au choix (« Données ▾ »), synchronisées
// dans nexora:optimPrefs, puis les pixels d'habitudes des 7 derniers jours.
function TuileCorps({ aller }: { aller: (ecran: string) => void }) {
  const { jour, prefs, ecrirePrefs, d } = useOptim();
  const { etats } = useJour();
  const { releves, activites } = useCorps();
  const [choix, setChoix] = useState(false);
  const sel = prefs.accueil.corps;
  const lundi = (() => { const dt = new Date(`${jour}T12:00:00Z`); return ajouterJours(jour, -((dt.getUTCDay() + 6) % 7)); })();
  const kpi = (k: string) => {
    if (k === "sport") {
      const min = activites.filter((a) => a.date >= lundi && a.date <= jour).reduce((t, a) => t + (a.total || 0), 0), obj = d.objectifsSport.weeklyHours;
      return <div key={k}><small>Sport</small><b>{hm(Math.round(min))}{obj ? <span>/{obj} h</span> : null}</b>{obj ? <span className="hx-bar"><i style={{ width: `${Math.min(100, min / (obj * 60) * 100)}%`, background: "#0e7490" }} /></span> : null}</div>;
    }
    const m = mesureSante(k), r = resumeMetrique(releves, k, jour, 30), st = styleMesure(k);
    const pts = releves.filter((x) => typeof x[k] === "number").slice(-7).map((x) => x[k] as number);
    const mn = Math.min(...pts), mx = Math.max(...pts);
    return <div key={k}><small>{m?.label || k}</small><b>{r.dernier ? formaterSante(r.dernier.v, m) : "—"}</b>
      {pts.length > 1 && <svg width="56" height="14" viewBox="0 0 56 14" aria-hidden="true"><polyline fill="none" stroke={st.couleur} strokeWidth="1.5" points={pts.map((v, i) => `${(i / (pts.length - 1) * 54 + 1).toFixed(1)},${(13 - (mx > mn ? (v - mn) / (mx - mn) : .5) * 12).toFixed(1)}`).join(" ")} /></svg>}</div>;
  };
  return (
    <section className="hx-tile hx-t-body"><header className="hx-th"><h2>Corps</h2>
      <span className="ox-rel"><button type="button" className="hx-more is-plain" aria-expanded={choix} onClick={() => setChoix(!choix)}>Données ▾</button>
        {choix && <div className="hx-pop" role="dialog" aria-label="Données affichées"><header><b>Données affichées · {sel.length} / {MAX_MESURES_CARTE}</b><button type="button" className="hx-x" aria-label="Fermer" onClick={() => setChoix(false)}>×</button></header>
          <ListeCoches options={[{ id: "sport", libelle: "Sport de la semaine", groupe: "Activité" }, ...MESURES_SANTE.map((m) => ({ id: m.key, libelle: m.label, groupe: m.group }))]} choisis={sel} max={MAX_MESURES_CARTE} libelleRecherche="Rechercher une mesure" changer={(ids) => void ecrirePrefs({ accueil: { ...prefs.accueil, corps: ids.slice(0, MAX_MESURES_CARTE) } })} />
          <p className="hx-hint">Choix synchronisé entre vos appareils.</p></div>}</span>
      <button type="button" className="hx-more" onClick={() => aller("corps")}>Ouvrir ›</button></header>
      <div className="hx-kpis is-2">{sel.map(kpi)}</div>
          <div className="hx-hstrip ox-hstrip" title="Habitudes des 7 derniers jours">{Array.from({ length: 7 }, (_, i) => ajouterJours(jour, i - 6)).map((x) => { const e = etats(x); return <span key={x} className={x === jour ? "is-today" : ""} title={`${dateCourte(x)} · ${e.faites}/${e.total}`}><PixelHabitudes date={x} taille={7} ecart={1.5} /><small>{jourCourt(x).slice(0, 2)}</small><em>{e.faites}/{e.total}</em></span>; })}</div>
    </section>
  );
}

export function Accueil({ aller }: { aller: (ecran: string, projet?: string) => void }) {
  const { d, jour, prefs, fini, retard } = useOptim();
  const { setReglages } = useUi();
  const { tachesDuJour, compteTaches, etats } = useJour();
  const horaires = useElementsHoraires()(jour);
  const maintenant = heureParisDec();
  const suivant = horaires.find((i) => i.h0 >= maintenant && !i.fini);
  const aujourdhui = tachesDuJour(jour).filter((t) => !retard(t));
  const enRetard = d.taches.filter((t) => retard(t)).sort((a, b) => (a.end || "").localeCompare(b.end || ""));
  const ct = compteTaches(jour), eh = etats(jour);
  // Contenu réglable (Réglages › Accueil › Bloc Journée).
  const oj = prefs.accueil.journee;
  const jourListe = oj.calendriers ? aujourdhui : aujourdhui.filter((t) => !estProjetCalendrier(d.projets, t.projectId));
  return (
    <main className="hx-main hx-home" data-scroll>
      <div className="hx-hello is-tight"><h1>{majuscule(jourLong(jour))}</h1><p>{(() => { const n = aujourdhui.filter((t) => !fini(t)).length; return `${n} tâche${n > 1 ? "s" : ""} aujourd'hui`; })()} · <span className="hx-red">{enRetard.length} en retard</span> · {suivant ? <>ensuite <b>{hmf(suivant.h0)} {suivant.titre}</b></> : "plus rien d'horodaté"} · habitudes {eh.faites}/{eh.total}</p></div>
      {(() => {
        const tuiles: Record<TuileAccueil, ReactNode> = {
          journee: <>
        <section className="hx-tile hx-t-day"><header className="hx-th"><h2>Journée <small>{ct.faites}/{ct.total} tâches · habitudes {eh.faites}/{eh.total}</small></h2><button type="button" className="hx-more" onClick={() => aller("journee")}>Ouvrir ›</button></header>
          <div className={`hx-dayin ${oj.cadran ? "" : "ox-sanscadran"}`}>{oj.cadran && <div className="hx-mini"><Cadran date={jour} taille={240} mini pixels={prefs.accueil.pixels} /></div>}
            {(oj.aujourdhui || oj.rattraper) && <div className={`hx-daycols ${oj.aujourdhui && oj.rattraper ? "" : "ox-unecol"}`}>
              {oj.aujourdhui && <div><h3 className="hx-h3">Aujourd'hui <small>{jourListe.length}</small></h3><ul className="hx-list">{jourListe.slice(0, oj.lignes).map((t) => <LigneTache key={t.id} t={t} />)}</ul>{jourListe.length > oj.lignes && <button type="button" className="hx-more" onClick={() => aller("journee")}>+ {jourListe.length - oj.lignes} autres</button>}{!jourListe.length && <p className="hx-dim">Rien d'échu aujourd'hui.</p>}</div>}
              {oj.rattraper && <div><h3 className="hx-h3">À rattraper <span className="hx-red">{enRetard.length}</span><button type="button" className="hx-more" onClick={() => aller("planning")}>Planning ›</button></h3><ul className="hx-list">{enRetard.slice(0, oj.lignes).map((t) => <LigneTache key={t.id} t={t} sansProjet />)}</ul>{enRetard.length > oj.lignes && <button type="button" className="hx-more" onClick={() => aller("planning")}>+ {enRetard.length - oj.lignes} autres</button>}</div>}
            </div>}
            {!oj.cadran && !oj.aujourdhui && !oj.rattraper && <p className="hx-dim">Bloc vide : choisissez son contenu dans Réglages › Accueil.</p>}</div></section></>,
          corps: <TuileCorps aller={aller} />,
          semaine: <Semaine ouvrirPlanning={() => aller("planning")} />,
          projets: <>
        <section className="hx-tile hx-t-proj"><header className="hx-th"><h2>Projets</h2><button type="button" className="hx-more" onClick={() => aller("projets")}>Ouvrir ›</button></header>
          <ul className="hx-plmini">{d.projets.map((p) => { const s = santeProjet(d.taches, p.id, d, jour); return s.total ? <li key={p.id}><button type="button" onClick={() => aller("projets", p.id)}><i style={{ background: p.color || "#94a3b8" }} />{p.name}</button><span className="hx-bar"><i style={{ width: `${s.avancement}%`, background: p.color || "#94a3b8" }} /></span><span className="hx-num">{s.avancement} %</span><span className={`hx-num ${s.retards ? "hx-red" : "hx-dim"}`}>{s.retards ? `${s.retards} ret.` : "—"}</span></li> : null; })}</ul></section></>,
          argent: <BandeauArgent ouvrir={() => aller("argent")} />,
        };
        // Tuiles et ordre choisis dans les réglages (#691), rangées toujours pleines.
        const liste = prefs.accueil.tuiles, w = placerTuiles(liste, LARGEURS_ACCUEIL), wm = placerTuiles(liste, LARGEURS_ACCUEIL_MOYEN);
        if (!liste.length) return <p className="hx-dim">Aucune tuile affichée. <button type="button" className="hx-more" onClick={() => setReglages("accueil")}>Choisir les tuiles ›</button></p>;
        return <div className="hx-grid ox-grid">{liste.map((t, k) => <div key={t} className="ox-cell" data-tuile={t} style={{ "--w": w[k], "--wm": wm[k] } as CSSProperties}>{tuiles[t]}</div>)}</div>;
      })()}
    </main>
  );
}
