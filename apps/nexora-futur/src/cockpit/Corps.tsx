// Espace Corps (Ref #660, lot 7) : habitudes (« pixel du jour », semaine,
// heat map), sport, santé et photos avant / après. Sport, santé et photos
// sont LUS par relais vers nexora-project (décision de Quentin, 2026-10-03).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import { ErreurCorps, type AccesCorps, type RessourceCorps } from "../donnees/source";
import { couleursCase, fondCase } from "../donnees/habitudes";
import { ajouterJours } from "../donnees/modele";
import {
  MESURES, PERIODES_SPORT, activitesDe, avancementObjectifs, calendrier, couleurSport, duree, formaterValeur, graduationsRondes, ilYa, nomsSports, resume, seriesEmpilees, filtrer,
  type Activite, type Mesure, type PeriodeSport, type Regroupement,
} from "../donnees/sport";
import { MESURES_SANTE, formaterSante, graduationsSante, libellePearson, mesureSante, relevesDe, santeSport, serieSante, type Releve } from "../donnees/sante";
import { alignement, dateFr, ecartJours, matriceCss, photoDroite, photosDe, trierPhotos, type Photo } from "../donnees/photos";
import { Bouton, Cartouche, Etat, Segment, Surtitre } from "../composants";
import { PixelDuJour, SemaineHabitudes } from "./PixelDuJour";

type Onglet = "habitudes" | "sport" | "sante" | "photos";

// Une lecture par ressource et par session : changer d'onglet ne relance rien.
const cache = new Map<string, Promise<unknown>>();
function useCorps<T>(corps: AccesCorps | undefined, ressource: RessourceCorps, convertir: (x: unknown) => T) {
  const [etat, setEtat] = useState<{ donnees: T | null; erreur: string | null }>({ donnees: null, erreur: null });
  useEffect(() => {
    if (!corps) { setEtat({ donnees: null, erreur: "indisponible" }); return; }
    let vivant = true;
    const p = cache.get(ressource) || corps.lire(ressource);
    cache.set(ressource, p);
    p.then((x) => vivant && setEtat({ donnees: convertir(x), erreur: null }))
      .catch((e) => { cache.delete(ressource); if (vivant) setEtat({ donnees: null, erreur: e instanceof ErreurCorps ? e.code : (e as Error).message }); });
    return () => { vivant = false; };
  }, [corps, ressource]); // eslint-disable-line react-hooks/exhaustive-deps
  return etat;
}
const MESSAGES: Record<string, string> = {
  sport_configuration_missing: "Le journal sportif n'est pas configuré dans nexora-project.",
  health_configuration_missing: "Le suivi santé n'est pas configuré dans nexora-project.",
  sport_source_failed: "La feuille « Activités Strava » ne répond pas. Réessaie plus tard.",
  health_source_failed: "La feuille Santé ne répond pas. Réessaie plus tard.",
  body_photos_storage_failed: "Le stockage des photos a refusé la lecture. Réessaie plus tard.",
  corps_relay_failed: "nexora-project n'a pas répondu à temps. Réessaie plus tard.",
  configuration_missing: "Le relais n'est pas configuré sur nexora-futur.",
  unauthorized: "Session expirée : reconnecte-toi.",
  indisponible: "Lecture indisponible dans ce mode.",
};
const Erreur = ({ code }: { code: string }) => <p role="alert" className="fi-erreur"><Etat ton="crit">Lecture</Etat> {MESSAGES[code] || `Lecture impossible (${code}).`}</p>;
const Chargement = ({ quoi }: { quoi: string }) => <p className="surtitre zone-charge">Lecture {quoi}…</p>;

export function PageCorps({ d, corps }: { d: Donnees; corps: AccesCorps | undefined }) {
  const [onglet, setOnglet] = useState<Onglet>("habitudes");
  const titres: Record<Onglet, string> = { habitudes: "Habitudes", sport: "Sport", sante: "Santé", photos: "Photos avant / après" };
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Corps" titre={titres[onglet]} actions={
        <Segment etiquette="Rubrique" valeur={onglet} onChange={setOnglet} options={[{ valeur: "habitudes", libelle: "Habitudes" }, { valeur: "sport", libelle: "Sport" }, { valeur: "sante", libelle: "Santé" }, { valeur: "photos", libelle: "Photos" }]} />
      } />
      {onglet === "habitudes" && <Habitudes d={d} />}
      {onglet === "sport" && <Sport d={d} corps={corps} />}
      {onglet === "sante" && <Sante d={d} corps={corps} />}
      {onglet === "photos" && <Photos corps={corps} />}
    </div>
  );
}

/* ---------------------------------------------------------------- Habitudes */
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function Habitudes({ d }: { d: Donnees }) {
  const auj = d.aujourdhui;
  const [jour, setJour] = useState(auj);
  const [themeId, setThemeId] = useState<string>("");
  const theme = d.themesHabitudes.find((t) => t.id === themeId) || d.themesHabitudes[0];
  const [mois, setMois] = useState(auj.slice(0, 7));
  const lundi = (x: string) => { const dow = (new Date(`${x}T12:00:00Z`).getUTCDay() + 6) % 7; return ajouterJours(x, -dow); };
  const cases = useMemo(() => {
    const premier = `${mois}-01`; const debut = lundi(premier);
    return Array.from({ length: 42 }, (_, i) => { const x = ajouterJours(debut, i); return { x, dans: x.slice(0, 7) === mois, fond: theme ? fondCase(couleursCase(theme, d.journalHabitudes, x), "") : "" }; });
  }, [mois, theme, d.journalHabitudes]);
  const annee = useMemo(() => {
    const fin = lundi(auj); const debut = ajouterJours(fin, -7 * 52);
    return Array.from({ length: 53 * 7 }, (_, i) => { const x = ajouterJours(debut, i); return { x, futur: x > auj, fond: theme ? fondCase(couleursCase(theme, d.journalHabitudes, x), "") : "" }; });
  }, [auj, theme, d.journalHabitudes]);
  const decalerMois = (n: number) => { const [a, m] = mois.split("-").map(Number); const t = new Date(Date.UTC(a, m - 1 + n, 1)); setMois(t.toISOString().slice(0, 7)); };
  return (
    <div className="co-hab">
      <div className="co-col">
        <PixelDuJour jour={jour} setJour={setJour} aujourdhui={auj} />
        <SemaineHabitudes jour={jour} setJour={setJour} aujourdhui={auj} />
      </div>
      <section className="panneau co-heat" aria-label="Heat map des habitudes">
        <div className="sy-tete">
          <Surtitre>Heat map</Surtitre>
          <select className="co-select" aria-label="Thème" value={theme?.id || ""} onChange={(e) => setThemeId(e.target.value)}>{d.themesHabitudes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <span className="marge-auto" />
          <Bouton variante="discret" aria-label="Mois précédent" onClick={() => decalerMois(-1)}>‹</Bouton>
          <strong>{MOIS[+mois.slice(5, 7) - 1]} {mois.slice(0, 4)}</strong>
          <Bouton variante="discret" aria-label="Mois suivant" onClick={() => decalerMois(1)}>›</Bouton>
        </div>
        <div className="co-mois">
          {["L", "M", "M", "J", "V", "S", "D"].map((j, k) => <span key={k} className="co-dow mono">{j}</span>)}
          {cases.map((c) => (
            <button key={c.x} type="button" className={`co-cell ${c.dans ? "" : "hors"} ${c.x === auj ? "auj" : ""} ${c.x === jour ? "sel" : ""} ${c.x > auj ? "futur" : ""}`} style={{ background: c.fond || undefined }} disabled={c.x > auj}
              onClick={() => setJour(c.x)} aria-label={`${c.x}`} aria-pressed={c.x === jour}><span className="co-num mono">{+c.x.slice(8)}</span></button>
          ))}
        </div>
        <div className="co-leg">{theme?.habits.map((h) => <span key={h.id}><span className="hp-dot" style={{ background: h.color }} />{h.name}</span>)}</div>
        <Surtitre>52 dernières semaines</Surtitre>
        <div className="co-annee" aria-hidden="true">{annee.map((c) => <i key={c.x} title={c.x} style={{ background: c.futur ? "transparent" : c.fond || undefined }} />)}</div>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------- Sport */
function BarresEmpilees({ barres, sports, unite }: { barres: { key: string; label: string; values: Record<string, number>; total: number }[]; sports: { name: string; color: string }[]; unite: string }) {
  const W = 760, H = 220, G = 44, B = 22;
  const max = Math.max(0, ...barres.map((b) => b.total));
  const ticks = graduationsRondes(max); const haut = ticks[ticks.length - 1] || 1;
  const pas = (W - G) / Math.max(1, barres.length); const lb = Math.max(2, Math.min(22, pas * 0.7));
  const y = (v: number) => H - B - (v / haut) * (H - B - 8);
  const tous = Math.max(1, Math.ceil(barres.length / 12));
  return (
    <svg className="co-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Barres empilées, ${barres.length} périodes`}>
      {ticks.map((t) => <g key={t}><line x1={G} x2={W} y1={y(t)} y2={y(t)} className="co-grille" /><text x={G - 6} y={y(t) + 4} textAnchor="end" className="co-axe">{t.toLocaleString("fr-FR")}</text></g>)}
      {barres.map((b, i) => { let acc = 0; const x = G + i * pas + (pas - lb) / 2; return (
        <g key={b.key}><title>{`${b.label} : ${formaterValeur(b.total, unite)}`}</title>
          {sports.map((s) => { const v = b.values[s.name] || 0; if (!v) return null; const y0 = y(acc), y1 = y(acc + v); acc += v; return <rect key={s.name} x={x} y={y1} width={lb} height={Math.max(0.5, y0 - y1)} rx={1.5} style={{ fill: s.color }} />; })}
          {i % tous === 0 && <text x={x + lb / 2} y={H - 6} textAnchor="middle" className="co-axe">{b.label.replace(/ \d{4}$/, "")}</text>}
        </g>); })}
    </svg>
  );
}
function Sport({ d, corps }: { d: Donnees; corps: AccesCorps | undefined }) {
  const { donnees: rows, erreur } = useCorps<Activite[]>(corps, "sport-activities", activitesDe);
  const [periode, setPeriode] = useState<PeriodeSport>("year");
  const [mesure, setMesure] = useState<Mesure>("total");
  const [regroupement, setRegroupement] = useState<Regroupement>("week");
  const [annee, setAnnee] = useState(d.aujourdhui.slice(0, 4));
  const auj = d.aujourdhui;
  const ordre = useMemo(() => (rows ? nomsSports(rows) : []), [rows]);
  if (erreur) return <Erreur code={erreur} />;
  if (!rows) return <Chargement quoi="du journal sportif" />;
  const r = resume(rows, auj, periode, ordre);
  const o = avancementObjectifs(rows, d.objectifsSport, auj);
  const serie = seriesEmpilees(rows, { periode, mesure, regroupement }, auj, ordre);
  const cal = calendrier(rows, annee, ordre);
  const dernieres = filtrer(rows, periode, auj).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  const comp = (a: number, b: number) => (b ? <span className={a >= b ? "ok" : "crit"}>{a >= b ? "+" : "−"}{Math.abs(a - b).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h</span> : null);
  return (
    <>
      <p className="discret">Lecture seule : le journal vient de la feuille « Activités Strava », par nexora-project.</p>
      <div className="fi-cartes">
        <div className="panneau sy-carte"><Surtitre>Dernière séance</Surtitre>{r.derniere ? <><span className="sy-valeur">{r.derniere.sport}</span><span className="sy-detail">{ilYa(r.ilYaJours || 0)} · {duree(r.derniere.total)}{r.derniere.distance ? ` · ${r.derniere.distance.toLocaleString("fr-FR")} km` : ""}</span></> : <span className="discret">aucune</span>}</div>
        <div className="panneau sy-carte"><Surtitre>Cette semaine</Surtitre><span className="sy-valeur mono">{formaterValeur(r.semaine.hours, "h")}</span><span className="sy-detail">{r.semaine.count} séance{r.semaine.count > 1 ? "s" : ""} · {comp(r.semaine.hours, r.semainePrec.hours)} vs semaine dernière à date</span></div>
        <div className="panneau sy-carte"><Surtitre>Ce mois</Surtitre><span className="sy-valeur mono">{formaterValeur(r.mois.hours, "h")}</span><span className="sy-detail">{r.mois.count} séances · {r.mois.km.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} km</span></div>
        {o.hebdo && <div className="panneau sy-carte"><Surtitre>Objectif {o.hebdo.cible} h / semaine</Surtitre><span className="sy-valeur mono">{Math.round(o.hebdo.ratio * 100)} %</span><span className="co-jauge"><i style={{ width: `${Math.min(100, o.hebdo.ratio * 100)}%` }} /></span><span className="sy-detail">{o.hebdo.reste ? `reste ${formaterValeur(o.hebdo.reste, "h")}` : "atteint"}</span></div>}
        {o.annuels.map((g) => <div key={g.id} className="panneau sy-carte"><Surtitre>{g.libelle} · {g.cible.toLocaleString("fr-FR")} km / an</Surtitre><span className="sy-valeur mono">{Math.round(g.fait).toLocaleString("fr-FR")} km</span><span className="co-jauge"><i style={{ width: `${Math.min(100, g.ratio * 100)}%` }} /><b style={{ left: `${Math.min(100, (g.attendu / g.cible) * 100)}%` }} /></span><span className={`sy-detail ${g.ecart < 0 ? "crit" : "ok"}`}>{g.ecart >= 0 ? "en avance" : "en retard"} de {Math.abs(Math.round(g.ecart)).toLocaleString("fr-FR")} km sur le rythme</span></div>)}
      </div>
      <section className="panneau sy-bloc" aria-label="Graphique sport">
        <div className="sy-tete">
          <Segment etiquette="Période" valeur={periode} onChange={setPeriode} options={PERIODES_SPORT.map((p) => ({ valeur: p.valeur, libelle: p.libelle }))} />
          <Segment etiquette="Mesure" valeur={mesure} onChange={setMesure} options={MESURES.map((m) => ({ valeur: m.valeur, libelle: m.libelle }))} />
          <Segment etiquette="Regroupement" valeur={regroupement} onChange={setRegroupement} options={[{ valeur: "day", libelle: "Jour" }, { valeur: "week", libelle: "Semaine" }, { valeur: "month", libelle: "Mois" }]} />
        </div>
        <BarresEmpilees barres={serie.barres} sports={serie.sports} unite={serie.unite} />
        <div className="co-leg">{serie.sports.map((s) => <span key={s.name}><span className="hp-dot" style={{ background: s.color }} />{s.name} <span className="mono discret">{formaterValeur(s.total, serie.unite)}</span></span>)}{serie.missing > 0 && <span className="discret">{serie.missing} séance{serie.missing > 1 ? "s" : ""} sans valeur, non comptée{serie.missing > 1 ? "s" : ""}</span>}</div>
      </section>
      <div className="co-deux">
        <section className="panneau sy-bloc" aria-label="Heures par sport">
          <Surtitre>Heures par sport · {PERIODES_SPORT.find((p) => p.valeur === periode)?.libelle.toLowerCase()}</Surtitre>
          <div className="co-part">{r.parSport.map((s) => <i key={s.name} title={`${s.name} ${Math.round(s.share * 100)} %`} style={{ flex: s.hours || 0.0001, background: s.color }} />)}</div>
          {r.parSport.map((s) => <div key={s.name} className="co-l"><span><span className="hp-dot" style={{ background: s.color }} /> {s.name}</span><span className="mono">{formaterValeur(s.hours, "h")}</span><span className="mono discret">{Math.round(s.share * 100)} %</span></div>)}
        </section>
        <section className="panneau sy-bloc" aria-label="Dernières séances">
          <Surtitre>Dernières séances</Surtitre>
          <table className="tb"><thead><tr><th>Date</th><th>Sport</th><th>Durée</th><th>Distance</th><th>FC</th></tr></thead>
            <tbody>{dernieres.map((a) => <tr key={a.id}><td className="mono">{dateFr(a.date)}</td><td><span className="hp-dot" style={{ background: couleurSport(a.sport, ordre) }} /> {a.sport}</td><td className="mono">{duree(a.total)}</td><td className="mono">{a.distance ? `${a.distance.toLocaleString("fr-FR")} km` : "—"}</td><td className="mono">{a.hr ?? "—"}</td></tr>)}</tbody></table>
        </section>
      </div>
      <section className="panneau sy-bloc" aria-label={`Calendrier ${annee}`}>
        <div className="sy-tete"><Surtitre>Calendrier {annee}</Surtitre><span className="mono discret">{cal.joursActifs} jours actifs</span><span className="marge-auto" />
          <Bouton variante="discret" aria-label="Année précédente" onClick={() => setAnnee(String(+annee - 1))}>‹</Bouton><Bouton variante="discret" aria-label="Année suivante" disabled={annee >= auj.slice(0, 4)} onClick={() => setAnnee(String(+annee + 1))}>›</Bouton></div>
        <div className="co-cal" style={{ gridTemplateColumns: `repeat(${cal.semaines}, 11px)` }}>
          {cal.jours.map((j) => <i key={j.date} title={`${dateFr(j.date)}${j.nb ? ` · ${j.sports.join(", ")} · ${duree(j.minutes)}` : ""}`} style={{ gridColumn: j.semaine + 1, gridRow: j.dow + 1, background: j.fond || undefined, opacity: j.nb ? j.teinte : 1 }} className={j.nb ? "" : "vide"} />)}
        </div>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------- Santé */
function Courbe({ points, mesure }: { points: { key: string; label: string; a: number | null; mobile: number | null }[]; mesure: ReturnType<typeof mesureSante> }) {
  const W = 760, H = 220, G = 48, B = 22;
  const vals = points.flatMap((p) => [p.a, p.mobile]).filter((v): v is number => v !== null);
  if (!vals.length) return <p className="discret">Aucune valeur sur la période.</p>;
  const ticks = graduationsSante(Math.min(...vals), Math.max(...vals)); const lo = ticks[0], hi = ticks[ticks.length - 1];
  const x = (i: number) => G + (i / Math.max(1, points.length - 1)) * (W - G - 8);
  const y = (v: number) => H - B - ((v - lo) / (hi - lo || 1)) * (H - B - 8);
  const trace = (k: "a" | "mobile") => { let s = ""; let en = false; points.forEach((p, i) => { const v = p[k]; if (v === null) { en = false; return; } s += `${en ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; en = true; }); return s; };
  const tous = Math.max(1, Math.ceil(points.length / 8));
  return (
    <svg className="co-graph" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Courbe ${mesure?.label || ""}`}>
      {ticks.map((t) => <g key={t}><line x1={G} x2={W} y1={y(t)} y2={y(t)} className="co-grille" /><text x={G - 6} y={y(t) + 4} textAnchor="end" className="co-axe">{t.toLocaleString("fr-FR")}</text></g>)}
      <path d={trace("a")} className="co-ligne" />
      <path d={trace("mobile")} className="co-moy" />
      {points.map((p, i) => p.a !== null && <circle key={p.key} cx={x(i)} cy={y(p.a)} r={points.length > 60 ? 1.4 : 2.6} className="co-pt"><title>{`${p.label} : ${formaterSante(p.a, mesure)}`}</title></circle>)}
      {points.map((p, i) => i % tous === 0 && <text key={`l${p.key}`} x={x(i)} y={H - 6} textAnchor="middle" className="co-axe">{p.label.slice(0, 5)}</text>)}
    </svg>
  );
}
function Sante({ d, corps }: { d: Donnees; corps: AccesCorps | undefined }) {
  const { donnees: releves, erreur } = useCorps<Releve[]>(corps, "health-records", relevesDe);
  const { donnees: activites } = useCorps<Activite[]>(corps, "sport-activities", activitesDe);
  const [mesure, setMesure] = useState("weight");
  const [periode, setPeriode] = useState<PeriodeSport>("90");
  const [regroupement, setRegroupement] = useState<Regroupement>("day");
  if (erreur) return <Erreur code={erreur} />;
  if (!releves) return <Chargement quoi="du suivi santé" />;
  const presentes = MESURES_SANTE.filter((m) => releves.some((r) => typeof r[m.key] === "number"));
  const s = serieSante(releves, { mesure, periode, regroupement, jours: 7 }, d.aujourdhui);
  const croise = activites ? santeSport(releves, activites, { mesure: "recovery", mesureSport: "total", periode: "90", regroupement: "day", decalage: 1 }, d.aujourdhui) : null;
  return (
    <>
      <p className="discret">Lecture seule : les mesures viennent de la feuille Santé (Whoop, balance, nutrition), par nexora-project.</p>
      <div className="fi-cartes">
        <div className="panneau sy-carte"><Surtitre>Dernière valeur</Surtitre><span className="sy-valeur mono">{formaterSante(s.dernier?.a, s.mesure)}</span><span className="sy-detail">{s.dernier?.label || ""}</span></div>
        <div className="panneau sy-carte"><Surtitre>Moyenne de la période</Surtitre><span className="sy-valeur mono">{formaterSante(s.moyenne, s.mesure)}</span><span className="sy-detail">{s.nb} {regroupement === "day" ? "jours" : "périodes"} renseignés</span></div>
        <div className="panneau sy-carte"><Surtitre>Plus bas</Surtitre><span className="sy-valeur mono">{formaterSante(s.min?.a, s.mesure)}</span><span className="sy-detail">{s.min?.label || ""}</span></div>
        <div className="panneau sy-carte"><Surtitre>Plus haut</Surtitre><span className="sy-valeur mono">{formaterSante(s.max?.a, s.mesure)}</span><span className="sy-detail">{s.max?.label || ""}</span></div>
      </div>
      <section className="panneau sy-bloc" aria-label="Courbe santé">
        <div className="sy-tete">
          <select className="co-select" aria-label="Mesure" value={mesure} onChange={(e) => setMesure(e.target.value)}>
            {[...new Set(presentes.map((m) => m.group))].map((g) => <optgroup key={g} label={g}>{presentes.filter((m) => m.group === g).map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</optgroup>)}
          </select>
          <Segment etiquette="Période" valeur={periode} onChange={setPeriode} options={[{ valeur: "30", libelle: "30 j" }, { valeur: "90", libelle: "90 j" }, { valeur: "year", libelle: "Année" }, { valeur: "365", libelle: "365 j" }, { valeur: "all", libelle: "Tout" }]} />
          <Segment etiquette="Regroupement" valeur={regroupement} onChange={setRegroupement} options={[{ valeur: "day", libelle: "Jour" }, { valeur: "week", libelle: "Semaine" }, { valeur: "month", libelle: "Mois" }]} />
        </div>
        <Courbe points={s.points} mesure={s.mesure} />
        <div className="co-leg"><span><span className="co-trait" /> {s.mesure?.label}</span><span><span className="co-trait moy" /> moyenne mobile 7 jours</span></div>
      </section>
      {croise && <section className="panneau sy-bloc" aria-label="Santé et sport">
        <Surtitre>Récupération du lendemain × durée de sport · 90 jours</Surtitre>
        <p><strong className="mono">{croise.r === null ? "—" : croise.r.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</strong> <span className="discret">· {libellePearson(croise.r)} · {croise.paires} jours comparés</span></p>
      </section>}
    </>
  );
}

/* ------------------------------------------------------------------- Photos */
function useImage(corps: AccesCorps | undefined, id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    if (!corps || !id) return;
    let vivant = true; let u: string | null = null;
    setUrl(null); setErreur(null);
    corps.image(id).then((b) => { u = URL.createObjectURL(b); if (vivant) setUrl(u); else URL.revokeObjectURL(u); })
      .catch((e) => vivant && setErreur(e instanceof ErreurCorps ? e.code : (e as Error).message));
    return () => { vivant = false; if (u) URL.revokeObjectURL(u); };
  }, [corps, id]);
  return { url, erreur };
}
function Photos({ corps }: { corps: AccesCorps | undefined }) {
  const { donnees, erreur } = useCorps(corps, "body-photos", photosDe);
  const [droiteId, setDroiteId] = useState("");
  const [split, setSplit] = useState(50);
  const boite = useRef<HTMLDivElement>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => { const el = boite.current; if (!el) return; const ro = new ResizeObserver(() => setLargeur(el.clientWidth)); ro.observe(el); return () => ro.disconnect(); }, [donnees]);
  const photos = donnees?.photos || [];
  const ref = photos.find((p) => p.id === donnees?.referenceId && p.status === "ready") || trierPhotos(photos).find((p) => p.status === "ready") || null;
  const droite = photoDroite(photos, ref?.id || null, droiteId);
  const imgRef = useImage(corps, ref?.id), imgDroite = useImage(corps, droite?.id);
  if (erreur) return <Erreur code={erreur} />;
  if (!donnees) return <Chargement quoi="des photos" />;
  if (!ref || !droite) return <p className="discret">Il faut au moins deux photos prêtes dans nexora-project pour comparer.</p>;
  const al = alignement(droite, ref);
  const hautMax = 520; const k = Math.min(largeur / ref.width, hautMax / ref.height) || 0;
  const w = ref.width * k, h = ref.height * k;
  const placer = (clientX: number, el: HTMLElement) => { const r = el.getBoundingClientRect(); setSplit(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))); };
  return (
    <>
      <p className="discret">Comparaison seule : l'envoi, les repères et la suppression restent dans nexora-project.</p>
      <div className="co-photos">
        <section className="panneau sy-bloc" aria-label="Avant / après">
          <div ref={boite} className="co-scene">
            {k > 0 && (
              <div className="co-cadre" style={{ width: w, height: h }} onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); placer(e.clientX, e.currentTarget); }} onPointerMove={(e) => { if (e.buttons) placer(e.clientX, e.currentTarget); }}>
                {imgRef.url && <img src={imgRef.url} alt={`Référence du ${dateFr(ref.date)}`} style={{ width: w, height: h }} draggable={false} />}
                <div className="co-couche" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
                  {imgDroite.url && <img src={imgDroite.url} alt={`Photo du ${dateFr(droite.date)}, alignée sur la référence`} draggable={false}
                    style={{ width: droite.width, height: droite.height, transformOrigin: "0 0", transform: al.ok ? matriceCss(al.transform, k) : `scale(${k})` }} />}
                </div>
                <span className="co-etiq g">Référence · {dateFr(ref.date)}</span>
                <span className="co-etiq d">{dateFr(droite.date)} · {ecartJours(ref.date, droite.date)}</span>
                <div className="co-poignee" style={{ left: `${split}%` }}>
                  <span role="slider" tabIndex={0} aria-label="Curseur avant / après" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} aria-valuetext={`${Math.round(split)} % référence`}
                    onKeyDown={(e) => { const p = e.shiftKey ? 10 : 1; const m: Record<string, number> = { ArrowLeft: split - p, ArrowDown: split - p, ArrowRight: split + p, ArrowUp: split + p, Home: 0, End: 100 }; if (e.key in m) { e.preventDefault(); setSplit(Math.min(100, Math.max(0, m[e.key]))); } }}>⇔</span>
                </div>
              </div>
            )}
          </div>
          {!al.ok && <p className="discret">{al.raison === "reference" ? "La référence n'a pas ses repères (yeux) : photos superposées sans alignement." : "Cette photo n'a pas ses repères (yeux) : superposée sans alignement."}</p>}
          {(imgRef.erreur || imgDroite.erreur) && <Erreur code={imgRef.erreur || imgDroite.erreur || ""} />}
        </section>
        <section className="panneau sy-bloc" aria-label="Galerie">
          <Surtitre>Galerie · {photos.length} photo{photos.length > 1 ? "s" : ""}</Surtitre>
          {trierPhotos(photos).map((p: Photo) => (
            <button key={p.id} type="button" className={`co-vign ${p.id === droite.id ? "sel" : ""}`} disabled={p.id === ref.id || p.status !== "ready"} aria-pressed={p.id === droite.id} onClick={() => setDroiteId(p.id)}>
              <span className="mono">{dateFr(p.date)}</span><span className="discret">{p.id === ref.id ? "référence" : ecartJours(ref.date, p.date)}</span>
            </button>
          ))}
        </section>
      </div>
    </>
  );
}
