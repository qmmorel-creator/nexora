// Sport (retour du 03/10/2026) : onglet séparé de Corps, en deux sous-onglets.
// - Tableau de bord : « Résumé sport », « Graphique sport » en répartition
//   (1 carré = 1 h) et en calendrier annuel, comme les widgets de Nexora
//   (index.html.part-003 : WidgetSportSummary, SportWaffleView, SportCalendarView).
// - Activité : la carte « Activité et sport », sans le détail des séances.
// Calculs : src/donnees/sport.ts (resume, repartition, calendrier, portés de Nexora).
import { useMemo, useState } from "react";
import { avancementObjectifs, calendrier, couleurSport, duree, formaterValeur, ilYa, nomsSports, PERIODES_SPORT, repartition, resume, type Activite, type PeriodeSport } from "../donnees/sport";
import { ONGLETS_SPORT, type OngletSport } from "../donnees/prefs";
import { naviguer, useRoute } from "../navigation/routeur";
import { dateCourte, jourCourt, useOptim } from "./contexte";
import { useCorps } from "./corps-donnees";
import { BlocSport } from "./Corps";

const LIB_ONGLET: Record<OngletSport, string> = { tableau: "Tableau de bord", activite: "Activité" };
const libPeriode = (p: PeriodeSport) => (PERIODES_SPORT.find((x) => x.valeur === p)?.libelle || p).toLowerCase();
const h = (v: number) => formaterValeur(v, "h");
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const JOURS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

function Periodes({ valeur, choisir, nom }: { valeur: PeriodeSport; choisir: (p: PeriodeSport) => void; nom: string }) {
  return <div className="hx-seg is-xs" role="group" aria-label={nom}>{PERIODES_SPORT.map((p) => <button key={p.valeur} type="button" aria-pressed={valeur === p.valeur} onClick={() => choisir(p.valeur)}>{p.libelle}</button>)}</div>;
}

function Resume({ activites, ordre }: { activites: Activite[]; ordre: string[] }) {
  const { jour, d, prefs, ecrirePrefs } = useOptim();
  const periode = prefs.corps.sportResume;
  const r = useMemo(() => resume(activites, jour, periode, ordre), [activites, jour, periode, ordre]);
  const obj = useMemo(() => avancementObjectifs(activites, d.objectifsSport, jour), [activites, d.objectifsSport, jour]);
  const max = Math.max(0, ...r.parSport.map((s) => s.hours));
  const ecartSemaine = r.semaine.hours - r.semainePrec.hours;
  const ligne = (t: { count: number; km: number; elevation: number }) => <span className="ox-sp-l"><span>{formaterValeur(t.count, "séances")}</span>{t.km > 0 && <span>{formaterValeur(t.km, "km")}</span>}{t.elevation > 0 && <span>{formaterValeur(t.elevation, "m")} D+</span>}</span>;
  return (
    <section className="hx-tile ox-sp-resume">
      <header className="hx-th"><h2>Résumé sport</h2></header>
      <div className="ox-sp-cartes">
        <div className="ox-sp-carte"><small>Dernière séance</small>
          {r.derniere ? <><span className="ox-sp-t"><i style={{ background: couleurSport(r.derniere.sport, ordre) }} />{r.derniere.sport}{r.derniere.title ? ` · ${r.derniere.title}` : ""}</span>
            <b>{duree(r.derniere.total)}</b>
            <span className="ox-sp-l"><span>{jourCourt(r.derniere.date)} {dateCourte(r.derniere.date)}, {ilYa(r.ilYaJours ?? 0)}</span>{typeof r.derniere.distance === "number" && r.derniere.distance > 0 && <span>{formaterValeur(r.derniere.distance, "km")}</span>}{typeof r.derniere.elevation === "number" && r.derniere.elevation > 0 && <span>{formaterValeur(r.derniere.elevation, "m")} D+</span>}</span></>
            : <span className="hx-dim">Aucune séance dans le journal.</span>}</div>
        <div className="ox-sp-carte"><small>Semaine en cours</small><b>{h(r.semaine.hours)}</b>{ligne(r.semaine)}
          <span className={`ox-sp-l ${ecartSemaine > 0 ? "is-up" : ecartSemaine < 0 ? "is-down" : ""}`}>{ecartSemaine === 0 ? "comme la semaine dernière à ce jour" : `${ecartSemaine > 0 ? "+" : "−"}${h(Math.abs(ecartSemaine))} par rapport à la semaine dernière à ce jour`}</span>
          {obj.hebdo && <span className="ox-sp-obj"><span className="ox-sp-jauge"><b style={{ width: `${Math.min(100, obj.hebdo.fait / obj.hebdo.cible * 100)}%` }} /></span>Objectif {h(obj.hebdo.cible)} · {Math.round(obj.hebdo.fait / obj.hebdo.cible * 100)} %</span>}</div>
        <div className="ox-sp-carte"><small>Mois en cours</small><b>{h(r.mois.hours)}</b>{ligne(r.mois)}</div>
      </div>
      <div className="ox-sp-barres" role="list" aria-label={`Heures par sport, ${libPeriode(periode)}`}>
        <div className="ox-sp-bh"><small>Heures par sport · {libPeriode(periode)} · {h(r.totalHeures)}</small><Periodes valeur={periode} nom="Période des heures par sport" choisir={(p) => void ecrirePrefs({ corps: { ...prefs.corps, sportResume: p } })} /></div>
        {!r.parSport.length && <p className="hx-dim">Aucune séance sur la période.</p>}
        {r.parSport.map((s) => <div key={s.name} className="ox-sp-barre" role="listitem"><span title={s.name}><i style={{ background: s.color }} />{s.name}</span><span className="ox-sp-piste"><b style={{ width: `${max ? s.hours / max * 100 : 0}%`, background: s.color }} /></span><span>{h(s.hours)} <small className="hx-dim">· {Math.round(s.share * 100)} % · {formaterValeur(s.count, "séances")}</small></span></div>)}
      </div>
    </section>
  );
}

function Repartition({ activites, ordre }: { activites: Activite[]; ordre: string[] }) {
  const { jour, prefs, ecrirePrefs } = useOptim();
  const periode = prefs.corps.sportRepartition;
  const r = useMemo(() => repartition(activites, periode, jour, ordre), [activites, periode, jour, ordre]);
  return (
    <section className="hx-tile ox-sp-waffle">
      <header className="hx-th"><h2>Répartition <small>1 carré = 1 h · {h(r.total)}</small></h2><span className="ox-sp" /><Periodes valeur={periode} nom="Période de la répartition" choisir={(p) => void ecrirePrefs({ corps: { ...prefs.corps, sportRepartition: p } })} /></header>
      {!r.parSport.length ? <p className="hx-dim">Aucune activité sur la période.</p> : r.parSport.map((s) => {
        const vus = Math.min(s.carres, 2000), part = r.total ? Math.round(s.heures / r.total * 100) : 0;
        return <div key={s.nom} className="ox-sp-ws">
          <div className="ox-sp-wh"><span><i style={{ background: s.couleur }} /><b>{s.nom}</b></span><span>{h(s.heures)} · {part} %</span></div>
          <div className="ox-sp-wg" role="img" aria-label={`${s.nom} : ${h(s.heures)}`}>{Array.from({ length: vus }, (_, k) => <span key={k} style={{ background: k === s.carres - 1 && s.dernier < 1 ? `linear-gradient(to top, ${s.couleur} ${Math.round(s.dernier * 100)}%, #e8edf5 0)` : s.couleur }} />)}</div>
        </div>;
      })}
      {r.manquantes > 0 && <p className="hx-hint">{r.manquantes} activité{r.manquantes > 1 ? "s" : ""} sans durée totale, exclue{r.manquantes > 1 ? "s" : ""}.</p>}
      {r.tropGrand && <p className="hx-hint">Plus de 2 000 heures pour un sport : seuls les 2 000 premiers carrés sont dessinés.</p>}
    </section>
  );
}

function CalendrierAnnuel({ activites, ordre }: { activites: Activite[]; ordre: string[] }) {
  const { jour } = useOptim();
  const annees = useMemo(() => [...new Set([jour.slice(0, 4), ...activites.map((a) => a.date.slice(0, 4)).filter((y) => /^\d{4}$/.test(y))])].sort().reverse(), [activites, jour]);
  const [annee, setAnnee] = useState(jour.slice(0, 4));
  const c = useMemo(() => calendrier(activites, annee, ordre), [activites, annee, ordre]);
  const parSport = useMemo(() => { const m = new Map<string, number>(); c.jours.forEach((j) => j.sports.forEach((s) => m.set(s, (m.get(s) || 0) + 1))); return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")); }, [c]);
  const mois = c.jours.filter((j) => j.date.endsWith("-01")).map((j) => ({ semaine: j.semaine, lib: MOIS[Number(j.date.slice(5, 7)) - 1] }));
  const parDate = useMemo(() => { const m = new Map<string, Activite[]>(); activites.forEach((a) => { if (a.date.startsWith(annee)) m.set(a.date, [...(m.get(a.date) || []), a]); }); return m; }, [activites, annee]);
  const nb = c.jours.reduce((t, j) => t + j.nb, 0);
  return (
    <section className="hx-tile ox-sp-cal">
      <header className="hx-th"><h2>Calendrier sportif <small>{c.joursActifs} jour{c.joursActifs > 1 ? "s" : ""} actif{c.joursActifs > 1 ? "s" : ""} · {nb} séance{nb > 1 ? "s" : ""}</small></h2><span className="ox-sp" />
        <div className="hx-seg is-xs" role="group" aria-label="Année">{annees.slice(0, 6).map((y) => <button key={y} type="button" aria-pressed={annee === y} onClick={() => setAnnee(y)}>{y}</button>)}</div></header>
      <div className="ox-sp-calz">
        <div className="ox-sp-calg" style={{ ["--sem" as string]: c.semaines }}>
          {mois.map((m) => <b key={m.lib} className="ox-sp-calm" style={{ gridColumn: m.semaine + 2, gridRow: 1 }}>{m.lib}</b>)}
          {[0, 2, 4].map((k) => <small key={k} className="ox-sp-cald" style={{ gridColumn: 1, gridRow: k + 2 }}>{JOURS[k]}</small>)}
          {c.jours.map((j) => { const acts = parDate.get(j.date) || [];
            return <i key={j.date} className={`ox-sp-calc ${j.nb ? "" : "is-vide"} ${j.date === jour ? "is-today" : ""}`} style={{ gridColumn: j.semaine + 2, gridRow: j.dow + 2, background: j.nb ? j.fond : undefined, opacity: j.nb ? j.teinte : undefined }}
              title={`${JOURS[j.dow]} ${dateCourte(j.date)}${acts.length ? acts.map((a) => `\n${a.sport}${a.title ? " · " + a.title : ""} : ${typeof a.total === "number" ? h(a.total / 60) : "—"}`).join("") : "\nAucune séance"}`} />; })}
        </div>
      </div>
      <p className="hx-sleg">{parSport.length ? parSport.map(([s, n]) => <span key={s}><i style={{ background: couleurSport(s, ordre) }} />{s} · {n} j</span>) : <span className="hx-dim">Aucune activité en {annee}.</span>}</p>
    </section>
  );
}

export function Sport() {
  const { prefs, ecrirePrefs, d, jour } = useOptim();
  const { activites, charge, erreurSport } = useCorps();
  const route = useRoute();
  const seg = route.segments[1];
  const onglet: OngletSport = (ONGLETS_SPORT as readonly string[]).includes(seg || "") ? (seg as OngletSport) : prefs.corps.ongletSport;
  const choisir = (o: OngletSport) => { void ecrirePrefs({ corps: { ...prefs.corps, ongletSport: o } }); naviguer(`/sport/${o}`); };
  const ordre = useMemo(() => nomsSports(activites), [activites]);
  const c = prefs.corps, majCorps = (p: Partial<typeof c>) => void ecrirePrefs({ corps: { ...c, ...p } });
  return (
    <main className="hx-main ox-sport" data-scroll>
      <div className="hx-hello hx-row"><div><h1>Sport</h1><p>Journal sportif relayé (Strava). {activites.filter((a) => a.date >= jour.slice(0, 4) + "-01-01" && a.date <= jour).length} séances depuis le 1er janvier.</p></div>
        <div className="hx-seg" role="group" aria-label="Sport">{ONGLETS_SPORT.map((o) => <button key={o} type="button" aria-pressed={onglet === o} onClick={() => choisir(o)}>{LIB_ONGLET[o]}</button>)}</div></div>
      {!charge && <p className="hx-dim">Chargement des activités…</p>}
      {erreurSport && <p className="ox-alerte">Sport indisponible : {erreurSport}.</p>}
      {charge && !activites.length && !erreurSport && <p className="hx-dim">Aucune activité relayée.</p>}
      {activites.length > 0 && (onglet === "tableau" ? <>
        <Resume activites={activites} ordre={ordre} />
        <div className="ox-sp-grid"><Repartition activites={activites} ordre={ordre} /><CalendrierAnnuel activites={activites} ordre={ordre} /></div>
      </> : <section className="hx-tile"><header className="hx-th"><h2>Activité et sport</h2></header><BlocSport activites={activites} c={c} setReg={(r) => majCorps({ regroupementSport: r })} maj={majCorps} detail={false} /></section>)}
      {onglet === "activite" && d.objectifsSport.weeklyHours == null && activites.length > 0 && <p className="hx-hint">Aucun objectif hebdomadaire de sport défini : la ligne d'objectif est masquée.</p>}
    </main>
  );
}
