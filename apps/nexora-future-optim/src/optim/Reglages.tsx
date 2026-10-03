// Réglages synchronisés (Ref #691) : tout ce qui se règle dans Optim, réuni
// en un seul panneau et enregistré dans nexora:optimPrefs (clé propre à ce
// site, partagée entre vos appareils). Aucune autre clé n'est écrite ici.
import { useState } from "react";
import { naviguer } from "../navigation/routeur";
import { MESURES_SANTE, mesureSante } from "../donnees/sante";
import {
  CARTES_DEFAUT, DUREES_PATRIMOINE, GROUPES_PLANNING, GROUPES_PROJET, MAX_MESURES_CARTE, ONGLETS_ARGENT, PERIODES_CORPS, REFERENCES,
  LIGNES_JOURNEE, REGROUPEMENTS, TUILES_ACCUEIL, ZOOMS_PLANNING, type CarteCorps, type TuileAccueil, type VueEnregistree,
} from "../donnees/prefs";
import { useOptim, useUi } from "./contexte";
import { estProjetCalendrier } from "../donnees/modele";
import { useCorps } from "./corps-donnees";
import { EditeurCarte } from "./Corps";
import { STYLES_DEF, ZOOMS_DEF } from "./frise";
import { LIBELLE_GROUPE } from "./Planning";
import { LIB_GROUPE, LIB_REF, ZOOMS_PROJET } from "./Projets";

export const PALETTE = ["#16a34a", "#0f9d76", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#d97706", "#64748b", "#18263d"];
const ONGLETS: [string, string][] = [["accueil", "Accueil"], ["corps", "Corps"], ["habitudes", "Habitudes"], ["gantt", "Gantt et frises"], ["argent", "Suivi du budget"], ["vues", "Vues enregistrées"]];
const NOMS_TUILES: Record<TuileAccueil, [string, string]> = {
  journee: ["Journée", "cadran, tâches du jour et retards"], corps: ["Corps", "mesures choisies et habitudes des 7 jours"],
  semaine: ["Semaine", "frise des tâches de la semaine"], projets: ["Projets", "avancement et retards par projet"], argent: ["Suivi du budget", "budget du mois"],
};
const NOMS_ONGLETS_ARGENT: Record<string, string> = { mois: "Période", patrimoine: "Patrimoine", pro: "Pro", operations: "Opérations" };
const NOMS_REGROUPEMENT: Record<string, string> = { jour: "Jour", semaine: "Semaine", mois: "Mois" };
const NOMS_ECRANS: Record<VueEnregistree["ecran"], string> = { planning: "Planning", projets: "Projets", journee: "Journée professionnelle" };

function Segment<T extends string | number>({ valeurs, valeur, libelle, choisir, nom }: { valeurs: readonly T[]; valeur: T; libelle: (v: T) => string; choisir: (v: T) => void; nom: string }) {
  return <div className="hx-seg is-sm" role="group" aria-label={nom}>{valeurs.map((v) => <button key={String(v)} type="button" aria-pressed={valeur === v} onClick={() => choisir(v)}>{libelle(v)}</button>)}</div>;
}
const Ligne = ({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) => <div className="ox-sligne"><span><b>{titre}</b>{aide && <small>{aide}</small>}</span><div>{children}</div></div>;

function OngletAccueil() {
  const { prefs, ecrirePrefs } = useOptim();
  const a = prefs.accueil, ordre = [...a.tuiles, ...TUILES_ACCUEIL.filter((t) => !a.tuiles.includes(t))];
  const poser = (tuiles: TuileAccueil[]) => void ecrirePrefs({ accueil: { ...a, tuiles } });
  const deplacer = (t: TuileAccueil, sens: -1 | 1) => { const l = [...a.tuiles], i = l.indexOf(t), j = i + sens; if (i < 0 || j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; poser(l); };
  const corps = a.corps, plein = corps.length >= MAX_MESURES_CARTE;
  const basculerMesure = (k: string) => void ecrirePrefs({ accueil: { ...a, corps: corps.includes(k) ? corps.filter((x) => x !== k) : [...corps, k].slice(0, MAX_MESURES_CARTE) } });
  const groupes = [...new Set(MESURES_SANTE.map((m) => m.group))];
  return <>
    <h3 className="ox-sh">Tuiles affichées <small>cochées = visibles ; flèches = ordre</small></h3>
    <ol className="ox-tuiles">{ordre.map((t) => { const on = a.tuiles.includes(t), i = a.tuiles.indexOf(t); return <li key={t} className={on ? "" : "is-off"}>
      <label><input type="checkbox" checked={on} onChange={() => poser(on ? a.tuiles.filter((x) => x !== t) : [...a.tuiles, t])} /><b>{NOMS_TUILES[t][0]}</b><small>{NOMS_TUILES[t][1]}</small></label>
      <span><button type="button" className="hx-more is-plain" disabled={!on || i === 0} aria-label={`Monter ${NOMS_TUILES[t][0]}`} onClick={() => deplacer(t, -1)}>↑</button><button type="button" className="hx-more is-plain" disabled={!on || i === a.tuiles.length - 1} aria-label={`Descendre ${NOMS_TUILES[t][0]}`} onClick={() => deplacer(t, 1)}>↓</button></span></li>; })}</ol>
    <p className="hx-hint">Les largeurs s'ajustent pour que chaque rangée soit pleine.</p>
    <label className="hx-sopt"><input type="checkbox" checked={a.pixels} onChange={(e) => void ecrirePrefs({ accueil: { ...a, pixels: e.target.checked } })} /><span><b>Pixels au cœur du cadran</b><small>Pixel des tâches et pixel des habitudes ; décoché, le cadran n'affiche que les deux compteurs.</small></span></label>
    <BlocsAccueil />
    <h3 className="ox-sh">Mesures de la tuile Corps <small>{corps.length} / {MAX_MESURES_CARTE}</small></h3>
    <div className="ox-choix">
      <div><h4>Activité</h4><label className={!corps.includes("sport") && plein ? "is-off" : ""}><input type="checkbox" checked={corps.includes("sport")} disabled={!corps.includes("sport") && plein} onChange={() => basculerMesure("sport")} />Sport de la semaine</label></div>
      {groupes.map((g) => <div key={g}><h4>{g}</h4>{MESURES_SANTE.filter((m) => m.group === g).map((m) => { const on = corps.includes(m.key), off = !on && plein; return <label key={m.key} className={off ? "is-off" : ""}><input type="checkbox" checked={on} disabled={off} onChange={() => basculerMesure(m.key)} />{m.label}</label>; })}</div>)}
    </div>
  </>;
}

// Contenu des blocs Journée et Semaine (retour du 03/10/2026).
function BlocsAccueil() {
  const { d, prefs, ecrirePrefs } = useOptim();
  const a = prefs.accueil, j = a.journee, s = a.semaine;
  const majJ = (p: Partial<typeof j>) => void ecrirePrefs({ accueil: { ...a, journee: { ...j, ...p } } });
  const majS = (p: Partial<typeof s>) => void ecrirePrefs({ accueil: { ...a, semaine: { ...s, ...p } } });
  const Case = ({ on, maj, titre, aide }: { on: boolean; maj: (v: boolean) => void; titre: string; aide?: string }) => <label className="ox-scase"><input type="checkbox" checked={on} onChange={(e) => maj(e.target.checked)} /><span><b>{titre}</b>{aide && <small>{aide}</small>}</span></label>;
  const projets = d.projets.filter((p) => !estProjetCalendrier(d.projets, p.id));
  return <>
    <h3 className="ox-sh">Bloc Journée</h3>
    <div className="ox-scases"><Case on={j.cadran} maj={(v) => majJ({ cadran: v })} titre="Cadran" /><Case on={j.aujourdhui} maj={(v) => majJ({ aujourdhui: v })} titre="Aujourd'hui" aide="tâches échues ce jour" /><Case on={j.rattraper} maj={(v) => majJ({ rattraper: v })} titre="À rattraper" aide="tâches en retard" /><Case on={j.calendriers} maj={(v) => majJ({ calendriers: v })} titre="Rendez-vous des calendriers" aide="dans « Aujourd'hui »" /></div>
    <Ligne titre="Lignes par liste"><Segment nom="Lignes par liste" valeurs={LIGNES_JOURNEE} valeur={j.lignes as (typeof LIGNES_JOURNEE)[number]} libelle={(n) => String(n)} choisir={(n) => majJ({ lignes: n })} /></Ligne>
    <h3 className="ox-sh">Bloc Semaine</h3>
    <Ligne titre="Durée"><Segment nom="Durée du bloc Semaine" valeurs={[7, 14] as const} valeur={s.jours} libelle={(n) => (n === 7 ? "7 jours" : "14 jours")} choisir={(n) => majS({ jours: n })} /></Ligne>
    <Ligne titre="Début"><Segment nom="Début du bloc Semaine" valeurs={["aujourdhui", "lundi"] as const} valeur={s.debut} libelle={(x) => (x === "lundi" ? "Lundi" : "Aujourd'hui")} choisir={(x) => majS({ debut: x })} /></Ligne>
    <div className="ox-scases"><Case on={s.calendriers} maj={(v) => majS({ calendriers: v })} titre="Rendez-vous des calendriers" /><Case on={s.retards} maj={(v) => majS({ retards: v })} titre="Tâches en retard" aide="échues avant la période" /><Case on={s.terminees} maj={(v) => majS({ terminees: v })} titre="Tâches terminées" /><Case on={s.jalonsSeuls} maj={(v) => majS({ jalonsSeuls: v })} titre="Jalons seulement" /></div>
    <Ligne titre="Projets affichés" aide={s.projets.length ? `${s.projets.length} choisi${s.projets.length > 1 ? "s" : ""}` : "tous"}>{s.projets.length > 0 && <button type="button" className="hx-more" onClick={() => majS({ projets: [] })}>Tous</button>}</Ligne>
    <div className="ox-choix ox-sprojets">{projets.map((p) => { const on = s.projets.includes(p.id); return <label key={p.id}><input type="checkbox" checked={on} onChange={() => majS({ projets: on ? s.projets.filter((x) => x !== p.id) : [...s.projets, p.id] })} /><i className="hx-hdot" style={{ background: p.color || "#94a3b8" }} />{p.name}</label>; })}</div>
  </>;
}

function OngletCorps() {
  const { prefs, ecrirePrefs } = useOptim();
  const { releves } = useCorps();
  const [edition, setEdition] = useState<string | null>(null);
  const c = prefs.corps;
  const enregistrer = (carte: CarteCorps) => { void ecrirePrefs({ corps: { ...c, cartes: c.cartes.map((x) => (x.id === carte.id ? carte : x)) } }); setEdition(null); };
  const libelles = (l: string[]) => (l.length ? l.map((k) => mesureSante(k)?.label || k).join(" · ") : "aucune mesure");
  return <>
    <Ligne titre="Période affichée" aide="Écran Corps, au premier affichage"><Segment nom="Période" valeurs={PERIODES_CORPS} valeur={c.periode} libelle={(v) => (v === 365 ? "1 an" : `${v} j`)} choisir={(v) => void ecrirePrefs({ corps: { ...c, periode: v } })} /></Ligne>
    <Ligne titre="Regroupement des mesures"><Segment nom="Regroupement des mesures" valeurs={REGROUPEMENTS} valeur={c.regroupement} libelle={(v) => NOMS_REGROUPEMENT[v]} choisir={(v) => void ecrirePrefs({ corps: { ...c, regroupement: v } })} /></Ligne>
    <Ligne titre="Regroupement du sport"><Segment nom="Regroupement du sport" valeurs={REGROUPEMENTS} valeur={c.regroupementSport} libelle={(v) => NOMS_REGROUPEMENT[v]} choisir={(v) => void ecrirePrefs({ corps: { ...c, regroupementSport: v } })} /></Ligne>
    <h3 className="ox-sh">Cartes <small>titre libre, jusqu'à {MAX_MESURES_CARTE} mesures chacune</small></h3>
    {c.cartes.map((carte) => edition === carte.id
      ? <EditeurCarte key={carte.id} carte={carte} releves={releves} fermer={() => setEdition(null)} enregistrer={enregistrer} />
      : <div key={carte.id} className="ox-scarte"><span><b>{carte.titre}</b><small>{libelles(carte.mesures)}</small></span><button type="button" className="hx-more" onClick={() => setEdition(carte.id)}>Modifier</button></div>)}
    <button type="button" className="hx-more is-plain" onClick={() => void ecrirePrefs({ corps: { ...c, cartes: CARTES_DEFAUT } })}>Rétablir les quatre cartes par défaut</button>
  </>;
}

function OngletHabitudes() {
  const { d, prefs, ecrirePrefs, couleurHabitude } = useOptim();
  const poser = (id: string, c: string | null) => { const n = { ...prefs.couleursHabitudes }; if (c) n[id] = c; else delete n[id]; void ecrirePrefs({ couleursHabitudes: n }); };
  return <>
    <p className="hx-hint">Chaque habitude garde sa couleur partout : anneau du cadran, pixel du jour, liaisons. Sans choix ici, la couleur définie dans Nexora s'applique. Ce réglage ne modifie pas Nexora.</p>
    {d.themesHabitudes.filter((t) => t.habits.length).map((t) => <div key={t.id}><h3><i style={{ background: t.color }} />{t.name} <small>{t.selectionMode === "single" ? "un seul choix" : "plusieurs possibles"}</small></h3>
      {t.habits.map((h) => { const cur = couleurHabitude(h); return <div key={h.id} className="hx-hset"><span className="hx-hname"><i className="hx-hdot" style={{ background: cur }} />{h.name}</span>
        <span className="hx-swatches">{PALETTE.map((c) => <button key={c} type="button" className={c === cur ? "is-on" : ""} style={{ background: c }} aria-label={`Couleur ${c} pour ${h.name}`} onClick={() => poser(h.id, c)} />)}<input type="color" value={cur} aria-label={`Autre couleur pour ${h.name}`} onChange={(e) => poser(h.id, e.target.value)} /></span>
        {prefs.couleursHabitudes[h.id] ? <button type="button" className="hx-more" onClick={() => poser(h.id, null)}>Couleur de Nexora</button> : <span className="hx-dim">couleur de Nexora</span>}</div>; })}</div>)}
    {!d.themesHabitudes.some((t) => t.habits.length) && <p className="hx-dim">Aucune habitude définie dans Nexora.</p>}
  </>;
}

function OngletGantt() {
  const { prefs, ecrirePrefs } = useOptim();
  const pl = prefs.planning, pj = prefs.projets;
  return <>
    <h3 className="ox-sh">Représentation des barres <small>Planning, Projets et tuile Semaine</small></h3>
    <div className="ox-styles" role="radiogroup" aria-label="Représentation des barres">{STYLES_DEF.map((s) => <label key={s.id} className={prefs.gantt === s.id ? "is-on" : ""}><input type="radio" name="ox-style" checked={prefs.gantt === s.id} onChange={() => void ecrirePrefs({ gantt: s.id })} /><span><b>{s.libelle}</b><small>{s.aide}</small></span></label>)}</div>
    <h3 className="ox-sh">Planning</h3>
    <Ligne titre="Zoom"><Segment nom="Zoom du planning" valeurs={ZOOMS_PLANNING} valeur={pl.zoom} libelle={(z) => ZOOMS_DEF[z].libelle} choisir={(z) => void ecrirePrefs({ planning: { ...pl, zoom: z } })} /></Ligne>
    <Ligne titre="Grouper par"><Segment nom="Groupement du planning" valeurs={GROUPES_PLANNING} valeur={pl.groupe} libelle={(g) => LIBELLE_GROUPE[g]} choisir={(g) => void ecrirePrefs({ planning: { ...pl, groupe: g } })} /></Ligne>
    <h3 className="ox-sh">Projets</h3>
    <Ligne titre="Zoom"><Segment nom="Zoom des projets" valeurs={ZOOMS_PROJET} valeur={pj.zoom} libelle={(z) => ZOOMS_DEF[z].libelle} choisir={(z) => void ecrirePrefs({ projets: { ...pj, zoom: z } })} /></Ligne>
    <Ligne titre="Grouper par"><Segment nom="Groupement des projets" valeurs={GROUPES_PROJET} valeur={pj.groupe} libelle={(g) => LIB_GROUPE[g]} choisir={(g) => void ecrirePrefs({ projets: { ...pj, groupe: g } })} /></Ligne>
    <Ligne titre="Comparer à"><Segment nom="Référence des projets" valeurs={REFERENCES} valeur={pj.reference} libelle={(r) => LIB_REF[r]} choisir={(r) => void ecrirePrefs({ projets: { ...pj, reference: r } })} /></Ligne>
    <p className="hx-hint">Ces choix sont aussi ceux que vous faites directement sur les écrans : la dernière valeur utilisée est mémorisée.</p>
  </>;
}

function OngletArgent() {
  const { prefs, ecrirePrefs } = useOptim();
  const a = prefs.argent;
  return <>
    <Ligne titre="Évolution du patrimoine" aide="Durée N de la courbe et de la carte « Sur N mois »"><Segment nom="Durée du patrimoine" valeurs={DUREES_PATRIMOINE} valeur={a.patrimoineMois as (typeof DUREES_PATRIMOINE)[number]} libelle={(n) => `${n} mois`} choisir={(n) => void ecrirePrefs({ argent: { ...a, patrimoineMois: n } })} /></Ligne>
    <Ligne titre="Onglet ouvert" aide="Dernier onglet utilisé, repris à l'ouverture"><Segment nom="Onglet Argent" valeurs={ONGLETS_ARGENT} valeur={a.onglet} libelle={(o) => NOMS_ONGLETS_ARGENT[o]} choisir={(o) => void ecrirePrefs({ argent: { ...a, onglet: o } })} /></Ligne>
  </>;
}

function OngletVues() {
  const { prefs, ecrirePrefs } = useOptim();
  const { setReglages, setVueEnAttente, notifier } = useUi();
  const [nom, setNom] = useState<{ id: string; v: string } | null>(null);
  const renommer = (id: string, v: string) => { const n = v.trim().slice(0, 80); setNom(null); if (n) void ecrirePrefs({ vues: prefs.vues.map((x) => (x.id === id ? { ...x, nom: n } : x)) }); };
  const supprimer = (v: VueEnregistree) => {
    const avant = prefs.vues;
    void ecrirePrefs({ vues: avant.filter((x) => x.id !== v.id) });
    notifier({ texte: `Vue « ${v.nom} » supprimée`, annuler: () => ecrirePrefs({ vues: avant }) });
  };
  const ouvrir = (v: VueEnregistree) => { setVueEnAttente(v); setReglages(null); naviguer(v.ecran === "journee" ? "/journee/pro" : `/${v.ecran}`); };
  if (!prefs.vues.length) return <p className="hx-dim">Aucune vue enregistrée. Sur Planning ou Projets, réglez filtres, zoom et groupement, puis « + Enregistrer la vue ».</p>;
  return <>{(["planning", "projets", "journee"] as const).map((e) => { const l = prefs.vues.filter((v) => v.ecran === e); return l.length ? <div key={e}><h3 className="ox-sh">{NOMS_ECRANS[e]} <small>{l.length}</small></h3>
    <ul className="ox-vues">{l.map((v) => <li key={v.id}>
      {nom?.id === v.id
        ? <input autoFocus value={nom.v} maxLength={80} aria-label="Nouveau nom" onChange={(ev) => setNom({ id: v.id, v: ev.target.value })} onBlur={() => renommer(v.id, nom.v)} onKeyDown={(ev) => { if (ev.key === "Enter") renommer(v.id, nom.v); if (ev.key === "Escape") { ev.stopPropagation(); setNom(null); } }} />
        : <span><b>{v.nom}</b><small>{[v.zoom && ZOOMS_DEF[v.zoom].libelle, v.style && STYLES_DEF.find((s) => s.id === v.style)?.libelle, v.groupe && `groupé par ${(LIBELLE_GROUPE as Record<string, string>)[v.groupe] || (LIB_GROUPE as Record<string, string>)[v.groupe] || v.groupe}`].filter(Boolean).join(" · ")}</small></span>}
      <span><button type="button" className="hx-more" onClick={() => ouvrir(v)}>Ouvrir</button><button type="button" className="hx-more is-plain" onClick={() => setNom({ id: v.id, v: v.nom })}>Renommer</button><button type="button" className="hx-more is-plain" onClick={() => supprimer(v)}>Supprimer</button></span></li>)}</ul></div> : null; })}</>;
}

export function Reglages() {
  const { reglages, setReglages } = useUi();
  if (!reglages) return null;
  const actif = ONGLETS.some(([id]) => id === reglages) ? reglages : "accueil";
  return <>
    <div className="hx-scrim" onClick={() => setReglages(null)} />
    <section className="hx-settings" role="dialog" aria-label="Réglages">
      <header className="hx-th"><h2>Réglages</h2><button type="button" className="hx-x" aria-label="Fermer" onClick={() => setReglages(null)}>×</button></header>
      <nav className="hx-stabs">{ONGLETS.map(([id, l]) => <button key={id} type="button" className={actif === id ? "is-on" : ""} aria-current={actif === id ? "page" : undefined} onClick={() => setReglages(id)}>{l}</button>)}</nav>
      <div className="hx-sbody">
        {actif === "accueil" ? <OngletAccueil /> : actif === "corps" ? <OngletCorps /> : actif === "habitudes" ? <OngletHabitudes /> : actif === "gantt" ? <OngletGantt /> : actif === "argent" ? <OngletArgent /> : <OngletVues />}
        <p className="hx-hint is-foot">Réglages synchronisés entre vos appareils (clé nexora:optimPrefs, propre à ce site). Nexora n'est pas modifié.</p>
      </div>
    </section></>;
}
