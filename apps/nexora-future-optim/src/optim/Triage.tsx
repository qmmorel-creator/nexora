// Triage par règles (Ref #707), repris de Nexora Futur (lot 8, #661) et
// réécrit dans le langage d'Optim. Une décision à la fois, sans IA : chaque
// carte cite la règle qui l'a fait naître ; une touche décide ; U défait la
// dernière décision quand c'est possible (pas une catégorisation bancaire).
import { useEffect, useMemo, useRef, useState } from "react";
import type { Donnees, Mutation } from "../donnees/magasin";
import type { Source } from "../donnees/source";
import type { SyntheseBudget } from "../donnees/finance";
import { ajouterJours, type Tache } from "../donnees/modele";
import { basculerHabitude, poserNonApplicable } from "../donnees/habitudes";
import { fusionnerPrefs } from "../donnees/prefs";
import { activitesDe, avancementObjectifs } from "../donnees/sport";
import { archiverTache, basculer, modifier, remettre, restaurerTache } from "../donnees/actions";
import { LIBELLES_REGLES, cartesTriage, nettoyerReports, type Action, type Carte, type Choix, type Contexte, type Moment, type RegleId, type ReglesTriage } from "../donnees/triage";
import { naviguer, useRoute } from "../navigation/routeur";
import { useOptim, useUi } from "./contexte";

export function contexteTriage(d: Donnees, extra: Partial<Contexte> = {}): Contexte {
  return { ...d, jour: d.aujourdhui, membres: d.membresEquipe, journalHabitudes: d.journalHabitudes, nonApplicables: d.nonApplicables, themesHabitudes: d.themesHabitudes, ...extra };
}
// Nombre de cartes du matin tirées des seules données Firebase (sans budget ni sport) : compteur de la navigation.
export function compterTriage(d: Donnees) {
  return cartesTriage(contexteTriage(d), d.prefs.triage.regles, "matin", nettoyerReports(d.prefs.triage.reports, d.aujourdhui)).length;
}
export const momentParDefaut = (h = new Date().getHours()): Moment => (h >= 15 ? "soir" : "matin");

// Données hors Firebase : opérations à catégoriser (relais finance) et sport de la semaine (relais corps).
function useExtras(source: Source, d: Donnees) {
  const [ops, setOps] = useState<{ operations: Contexte["operations"]; categories: Contexte["categories"] } | null>(null);
  const [sport, setSport] = useState<Contexte["sport"]>(null);
  const mois = d.aujourdhui.slice(0, 7);
  useEffect(() => {
    let vivant = true;
    if (source.finance) source.finance.lire("budget-summary", { month: mois }).then((x) => { const s = x as SyntheseBudget; if (vivant) setOps({ operations: s.toCategorize || [], categories: s.catalogs?.categories || [] }); }).catch(() => vivant && setOps({ operations: [], categories: [] }));
    return () => { vivant = false; };
  }, [source, mois]);
  const cible = d.objectifsSport.weeklyHours;
  useEffect(() => {
    let vivant = true;
    if (source.corps && cible) source.corps.lire("sport-activities").then((x) => { if (!vivant) return; const o = avancementObjectifs(activitesDe(x), d.objectifsSport, d.aujourdhui).hebdo; setSport(o ? { cible: o.cible, fait: o.fait } : null); }).catch(() => vivant && setSport(null));
    return () => { vivant = false; };
  }, [source, cible, d.aujourdhui]); // eslint-disable-line react-hooks/exhaustive-deps
  return { ...(ops || {}), sport, chargeOps: !!source.finance && !ops };
}

interface Decision { carte: Carte; libelle: string; annuler?: () => Promise<unknown>; }
const touche = (e: KeyboardEvent) => (e.key === "Enter" ? "Entrée" : e.key.length === 1 ? e.key.toUpperCase() : e.key === "ArrowRight" ? "→" : e.key);
const COULEURS: Record<RegleId, string> = { retard: "var(--red)", "sans-date": "#d97706", "sans-projet": "#d97706", assistant: "var(--blue)", dependance: "#7c3aed", reunion: "var(--blue)", operation: "#16a34a", habitude: "#16a34a", sport: "#0e7490", glisse: "#d97706" };
// Adresses de Futur → écrans d'Optim.
const ADRESSES: Record<string, string> = { "/finances": "/argent", "/corps": "/corps" };

export function Triage() {
  const { d, source, executer, ecrireJson } = useOptim();
  const { notifier, ouvrir } = useUi();
  const route = useRoute();
  const extras = useExtras(source, d);
  const [moment, setMoment] = useState<Moment>(() => { const m = route.params.get("moment"); return m === "soir" || m === "matin" ? m : momentParDefaut(); });
  const [passees, setPassees] = useState<string[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  // Cartes annulées : elles reviennent en tête même si la règle ne les retient
  // plus (l'annulation rafraîchit la dernière activité de la tâche).
  const [revenues, setRevenues] = useState<Carte[]>([]);
  const [depart, setDepart] = useState("");
  const [reglesOuvertes, setReglesOuvertes] = useState(false);
  const regles = d.prefs.triage.regles;
  const reports = useMemo(() => nettoyerReports(d.prefs.triage.reports, d.aujourdhui), [d.prefs.triage.reports, d.aujourdhui]);
  const decidees = useMemo(() => new Set(decisions.map((x) => x.carte.cle)), [decisions]);
  const toutes = useMemo(() => cartesTriage(contexteTriage(d, { operations: extras.operations, categories: extras.categories, sport: extras.sport }), regles, moment, reports), [d, extras.operations, extras.categories, extras.sport, regles, moment, reports]);
  // Ordre de la file : les cartes passées reviennent en fin de pile.
  const file = useMemo(() => {
    const tete = revenues.filter((c) => !decidees.has(c.cle) && !passees.includes(c.cle));
    const cles = new Set(tete.map((c) => c.cle));
    const restantes = [...revenues.filter((c) => passees.includes(c.cle)), ...toutes].filter((c, i, l) => !decidees.has(c.cle) && !cles.has(c.cle) && l.findIndex((x) => x.cle === c.cle) === i);
    return [...tete, ...restantes.filter((c) => !passees.includes(c.cle)), ...passees.map((k) => restantes.find((c) => c.cle === k)).filter((c): c is Carte => !!c)];
  }, [toutes, decidees, passees, revenues]);
  const total = file.length + decisions.length;
  const cour = file[0];

  const ecrireReports = (f: (p: Record<string, string>) => Record<string, string>, r: ReglesTriage = regles) =>
    ecrireJson("prefs", (v) => fusionnerPrefs(v, { triage: { regles: r, reports: f(nettoyerReports((v as { triage?: { reports?: unknown } } | null)?.triage?.reports, d.aujourdhui)) } }));
  const tache = (id: string) => d.taches.find((t) => t.id === id);
  const avecUndo = async (m: Mutation, avant: Tache | undefined) => { await executer(m); return avant ? () => executer(remettre([avant])) : undefined; };

  async function appliquer(carte: Carte, ch: Choix): Promise<Decision | null> {
    const a: Action = ch.action;
    let annuler: Decision["annuler"];
    switch (a.genre) {
      case "dater": { const t = tache(a.id); annuler = await avecUndo(modifier(a.id, { end: a.date, start: t?.start && t.start <= a.date ? t.start : a.date }), t); break; }
      case "faite": annuler = await avecUndo(basculer(a.id), tache(a.id)); break;
      case "reassigner": annuler = await avecUndo(modifier(a.id, { assignee: a.qui }), tache(a.id)); break;
      case "projet": annuler = await avecUndo(modifier(a.id, { projectId: a.projectId }), tache(a.id)); break;
      case "archiver": await executer(archiverTache(a.id)); annuler = () => executer(restaurerTache(a.id)); break;
      case "ouvrir": ouvrir(a.id); return null;
      case "aller": naviguer(ADRESSES[a.chemin] || a.chemin); return null;
      case "categoriser":
        if (!source.finance) return null;
        await source.finance.categoriser({ transactionId: a.op.id, category: a.category, subcategory: a.subcategory, idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}` });
        break;
      case "habitude": {
        const themes = d.themesHabitudes;
        if (a.na) { await ecrireJson("nonApplicables", (l) => poserNonApplicable(l, themes, a.habitId, a.date, true)); annuler = () => ecrireJson("nonApplicables", (l) => poserNonApplicable(l, themes, a.habitId, a.date, false)); }
        else { await ecrireJson("journalHabitudes", (l) => basculerHabitude(l, themes, a.habitId, a.date)); annuler = () => ecrireJson("journalHabitudes", (l) => basculerHabitude(l, themes, a.habitId, a.date)); }
        break;
      }
      case "revoir": {
        const jusqua = ajouterJours(d.aujourdhui, regles.revoirJours);
        await ecrireReports((r) => ({ ...r, [carte.cle]: jusqua }));
        annuler = () => ecrireReports((r) => { const x = { ...r }; delete x[carte.cle]; return x; });
        break;
      }
    }
    return { carte, libelle: `${ch.libelle}${ch.detail ? ` · ${ch.detail}` : ""}`, annuler };
  }
  async function decider(ch: Choix | "passer") {
    if (!cour || depart) return;
    setDepart(ch === "passer" ? "is-bas" : ch.action.genre === "faite" ? "is-haut" : "is-droite");
    await new Promise((r) => setTimeout(r, 260));
    try {
      if (ch === "passer") { setPassees((p) => [...p.filter((k) => k !== cour.cle), cour.cle]); setDepart(""); return; }
      const x = await appliquer(cour, ch);
      // Décision et fin d'animation dans le même rendu : aucun état intermédiaire.
      if (x) setDecisions((l) => [...l, x]);
      setDepart("");
    } catch (e) { setDepart(""); notifier({ texte: `Décision non enregistrée : ${(e as Error).message}` }); }
  }
  async function defaire() {
    const x = decisions[decisions.length - 1]; if (!x) return;
    if (!x.annuler) { notifier({ texte: "Cette décision ne s'annule pas ici : la catégorie se change dans Argent › Opérations." }); return; }
    try { await x.annuler(); setDecisions((l) => l.slice(0, -1)); setPassees((p) => p.filter((k) => k !== x.carte.cle)); setRevenues((r) => [x.carte, ...r.filter((c) => c.cle !== x.carte.cle)]); }
    catch (e) { notifier({ texte: `Annulation impossible : ${(e as Error).message}` }); }
  }
  // L'écouteur est inscrit une fois, en capture, et lit l'état COURANT : une
  // touche frappée juste après un changement de carte vise la carte affichée.
  const vivant = useRef({ cour, depart, decider, defaire });
  vivant.current = { cour, depart, decider, defaire };
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (cible && /^(INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) || document.querySelector('[role="dialog"]')) return;
      const { cour: c, depart: enCours, decider: dec, defaire: def } = vivant.current;
      const k = touche(e);
      // Une touche du Triage ne déclenche pas aussi un raccourci d'Optim (N, C : saisie).
      const prendre = () => { e.preventDefault(); e.stopPropagation(); };
      const passer = k === "→" || k === "S";
      if (enCours && (k === "U" || passer || c?.choix.some((x) => x.touche === k))) { prendre(); return; }
      if (k === "U") { prendre(); def(); return; }
      if (!c) return;
      if (passer) { prendre(); dec("passer"); return; }
      const ch = c.choix.find((x) => x.touche === k);
      if (ch) { prendre(); dec(ch); }
    };
    window.addEventListener("keydown", ecoute, true);
    return () => window.removeEventListener("keydown", ecoute, true);
  }, []);

  const majRegles = (r: ReglesTriage) => ecrireReports((x) => x, r).catch((e) => notifier({ texte: `Réglage non enregistré : ${(e as Error).message}` }));
  const choisirMoment = (m: Moment) => { setMoment(m); setPassees([]); setRevenues([]); naviguer("/triage", new URLSearchParams({ moment: m }), true); };
  return (
    <main className="hx-main ox-triage" data-scroll>
      <div className="hx-hello is-tight"><h1>Triage du {moment}</h1><p>{file.length} à décider · {decisions.length} décidée{decisions.length > 1 ? "s" : ""} · règles sans IA{extras.chargeOps ? " · lecture du budget…" : ""}</p>
        <div className="ox-trtete"><div className="hx-seg is-sm" role="group" aria-label="Moment">{(["matin", "soir"] as const).map((m) => <button key={m} type="button" aria-pressed={moment === m} onClick={() => choisirMoment(m)}>{m === "matin" ? "Matin" : "Soir"}</button>)}</div>
          <button type="button" className="hx-more" aria-expanded={reglesOuvertes} onClick={() => setReglesOuvertes((x) => !x)}>Règles {reglesOuvertes ? "▴" : "▾"}</button></div></div>
      {reglesOuvertes && <ReglesTriagePanneau regles={regles} moment={moment} onChange={majRegles} />}
      <div className="ox-trzone">
        <div className="ox-trpile" aria-live="polite">
          {cour ? file.slice(0, 3).reverse().map((c, k, arr) => {
            const profondeur = arr.length - 1 - k;
            return (
              <article key={c.cle} className={`hx-tile ox-trc ${profondeur ? `is-d${profondeur}` : depart}`} aria-hidden={profondeur ? true : undefined} aria-label={profondeur ? undefined : `Carte de triage : ${c.titre}`}>
                <div className="ox-trtype" style={{ color: COULEURS[c.regle] }}><i style={{ background: COULEURS[c.regle] }} />{LIBELLES_REGLES[c.regle]}</div>
                <h2>{c.tacheId && !profondeur ? <button type="button" className="ox-link" onClick={() => ouvrir(c.tacheId!)}>{c.titre}</button> : c.titre}</h2>
                <p className="hx-dim">{c.meta}</p>
                <div className="ox-trregle"><b>Règle</b><span>{c.motif}</span></div>
                {c.proposition && <div className="ox-trprop"><small>Proposition</small><b>{c.proposition}</b>{c.choix[0]?.touche === "Entrée" && <kbd>Entrée</kbd>}</div>}
              </article>
            );
          }) : (
            <section className="hx-tile ox-trfin">
              <small>{decisions.length ? "Triage terminé" : "Rien à trier"}</small>
              <h2>{decisions.length ? `${decisions.length} décision${decisions.length > 1 ? "s" : ""}, chacune avec sa règle.` : `Aucune carte pour le ${moment}.`}</h2>
              {decisions.length > 0 && <ul>{decisions.map((x) => <li key={x.carte.cle}><span className="hx-dim">{x.libelle}</span><span>{x.carte.titre}</span></li>)}</ul>}
              <div><button type="button" className="hx-btn" onClick={() => naviguer("/journee")}>Revenir à la Journée</button></div>
            </section>
          )}
        </div>
        <aside className="hx-tile ox-trcote" aria-label="Décisions">
          <div><h3 className="ox-sh">Progression <small>{decisions.length}/{total}</small></h3><div className="ox-trprog">{Array.from({ length: Math.min(total, 40) }, (_, i) => <i key={i} className={i < decisions.length ? "is-on" : ""} />)}</div></div>
          {cour && <div><h3 className="ox-sh">Actions pour cette carte</h3>
            <div className="ox-tractions">
              {cour.choix.map((ch) => <button key={ch.touche} type="button" onClick={() => void decider(ch)}><kbd>{ch.touche}</kbd><span>{ch.libelle}</span><small>{ch.detail || ""}</small></button>)}
              <button type="button" onClick={() => void decider("passer")}><kbd>S</kbd><span>Passer</span><small>fin de pile · aussi →</small></button>
            </div></div>}
          <button type="button" className="ox-trannuler" disabled={!decisions.length || !!depart} onClick={() => void defaire()}><kbd>U</kbd><span>Annuler la dernière décision</span></button>
          <p className="hx-hint">Aucune IA : les propositions viennent du jour le moins chargé, de la personne la moins chargée de l'équipe, du projet nommé dans le titre et de la catégorie suggérée par le serveur.</p>
        </aside>
      </div>
    </main>
  );
}

function ReglesTriagePanneau({ regles: enregistrees, moment, onChange: enregistrer }: { regles: ReglesTriage; moment: Moment; onChange: (r: ReglesTriage) => void }) {
  // Affichage immédiat, enregistrement ensuite (la clé est écrite de façon asynchrone).
  const [regles, setRegles] = useState(enregistrees);
  useEffect(() => setRegles(enregistrees), [enregistrees]);
  const onChange = (r: ReglesTriage) => { setRegles(r); enregistrer(r); };
  const ids = (moment === "soir" ? ["glisse", "reunion", "habitude"] : ["retard", "dependance", "reunion", "assistant", "sans-projet", "sans-date", "operation", "habitude", "sport"]) as RegleId[];
  const nombre = (cle: "retardJours" | "habitudeJours" | "reunionJours" | "revoirJours", libelle: string, min: number, max: number) => (
    <label className="ox-trnb">{libelle}<input type="number" min={min} max={max} value={regles[cle]} onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n >= min && n <= max) onChange({ ...regles, [cle]: n }); }} /> j</label>
  );
  return (
    <section className="hx-tile ox-trregles" aria-label="Règles du triage">
      <div className="ox-trregles-l">{ids.map((id) => <label key={id}><input type="checkbox" checked={regles.actives[id]} onChange={(e) => onChange({ ...regles, actives: { ...regles.actives, [id]: e.target.checked } })} />{LIBELLES_REGLES[id]}</label>)}</div>
      <div className="ox-trregles-l">{nombre("retardJours", "Retard et inactivité au-delà de", 0, 90)}{nombre("habitudeJours", "Habitude manquée depuis", 2, 30)}{nombre("reunionJours", "Réunions des derniers", 1, 90)}{nombre("revoirJours", "« Revoir » dans", 1, 30)}</div>
      <p className="hx-hint">Règles synchronisées entre vos appareils (nexora:optimPrefs).</p>
    </section>
  );
}
