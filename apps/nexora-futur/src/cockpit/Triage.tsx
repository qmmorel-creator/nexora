// Triage par règles (Ref #661, lot 8) : une décision à la fois. Chaque carte
// cite la règle qui l'a fait naître ; une touche décide ; « Annuler » défait
// la dernière décision quand c'est possible (pas une catégorisation bancaire).
import { useEffect, useMemo, useRef, useState } from "react";
import { useDonnees, type Donnees, type Mutation } from "../donnees/magasin";
import type { Source } from "../donnees/source";
import type { SyntheseBudget } from "../donnees/finance";
import { ajouterJours, type Tache } from "../donnees/modele";
import { basculerHabitude, poserNonApplicable } from "../donnees/habitudes";
import { fusionnerPrefs } from "../donnees/prefs";
import { activitesDe, avancementObjectifs } from "../donnees/sport";
import { LIBELLES_REGLES, cartesTriage, nettoyerReports, type Action, type Carte, type Choix, type Contexte, type Moment, type RegleId, type ReglesTriage } from "../donnees/triage";
import { archiverTache, basculer, modifier, remettre, restaurerTache } from "./actions";
import { naviguer } from "../navigation/routeur";
import { Bouton, Cartouche, Etat, Segment, Surtitre } from "../composants";
import { useNotifier } from "./Notifications";

export function contexteTriage(d: Donnees, extra: Partial<Contexte> = {}): Contexte {
  return { ...d, jour: d.aujourdhui, membres: d.membresEquipe, journalHabitudes: d.journalHabitudes, nonApplicables: d.nonApplicables, themesHabitudes: d.themesHabitudes, ...extra };
}
// Nombre de cartes du matin tirées des seules données Firebase (sans budget ni sport) : pour les compteurs.
export function compterTriage(d: Donnees) {
  return cartesTriage(contexteTriage(d), d.prefs.triage.regles, "matin", nettoyerReports(d.prefs.triage.reports, d.aujourdhui)).length;
}

// Données hors Firebase : opérations à catégoriser (relais Finances) et sport de la semaine (relais Corps).
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
const COULEURS: Record<RegleId, string> = { retard: "var(--crit)", "sans-date": "var(--alerte)", "sans-projet": "var(--alerte)", assistant: "var(--info)", dependance: "var(--accent)", reunion: "var(--info)", operation: "var(--ok)", habitude: "var(--ok)", sport: "var(--ok)", glisse: "var(--alerte)" };

export function PageTriage({ d, source, onOuvrir }: { d: Donnees; source: Source; onOuvrir: (id: string) => void }) {
  const { executer, ecrireJson } = useDonnees();
  const notifier = useNotifier();
  const extras = useExtras(source, d);
  const [moment, setMoment] = useState<Moment>(() => (new Date().getHours() >= 15 ? "soir" : "matin"));
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
  const zone = useRef<HTMLDivElement>(null);

  const ecrirePrefs = (f: (p: ReturnType<typeof nettoyerReports>) => Record<string, string>, r: ReglesTriage = regles) =>
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
      case "ouvrir": onOuvrir(a.id); return null;
      case "aller": naviguer(a.chemin); return null;
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
        await ecrirePrefs((r) => ({ ...r, [carte.cle]: jusqua }));
        annuler = () => ecrirePrefs((r) => { const x = { ...r }; delete x[carte.cle]; return x; });
        break;
      }
    }
    return { carte, libelle: `${ch.libelle}${ch.detail ? ` · ${ch.detail}` : ""}`, annuler };
  }
  async function decider(ch: Choix | "passer") {
    if (!cour || depart) return;
    setDepart(ch === "passer" ? "part-bas" : ch.action.genre === "faite" ? "part-haut" : "part-droite");
    await new Promise((r) => setTimeout(r, 260));
    try {
      if (ch === "passer") { setPassees((p) => [...p.filter((k) => k !== cour.cle), cour.cle]); setDepart(""); return; }
      const x = await appliquer(cour, ch);
      // Décision et fin d'animation dans le même rendu : aucun état intermédiaire.
      if (x) setDecisions((l) => [...l, x]);
      setDepart("");
    } catch (e) { setDepart(""); notifier({ message: `Décision non enregistrée : ${(e as Error).message}`, ton: "crit" }); }
  }
  async function defaire() {
    const x = decisions[decisions.length - 1]; if (!x) return;
    if (!x.annuler) { notifier({ message: "Cette décision ne s'annule pas ici : la catégorie se change dans Finances.", ton: "info" }); return; }
    try { await x.annuler(); setDecisions((l) => l.slice(0, -1)); setPassees((p) => p.filter((k) => k !== x.carte.cle)); setRevenues((r) => [x.carte, ...r.filter((c) => c.cle !== x.carte.cle)]); }
    catch (e) { notifier({ message: `Annulation impossible : ${(e as Error).message}`, ton: "crit" }); }
  }
  // L'écouteur est inscrit une fois et lit l'état COURANT : une touche frappée
  // juste après un changement de carte s'applique à la carte affichée.
  const vivant = useRef({ cour, depart, decider, defaire });
  vivant.current = { cour, depart, decider, defaire };
  useEffect(() => {
    const ecoute = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (cible && /^(INPUT|SELECT|TEXTAREA)$/.test(cible.tagName)) || document.querySelector('[role="dialog"]')) return;
      const { cour: c, depart: enCours, decider: dec, defaire: def } = vivant.current;
      const k = touche(e);
      // Phase de capture : une touche du Triage ne déclenche pas aussi un raccourci du Cockpit.
      const prendre = () => { e.preventDefault(); e.stopPropagation(); };
      if (enCours && (k === "U" || k === "→" || c?.choix.some((x) => x.touche === k))) { prendre(); return; } // décision en cours
      if (k === "U") { prendre(); def(); return; }
      if (!c) return;
      if (k === "→") { prendre(); dec("passer"); return; }
      const ch = c.choix.find((x) => x.touche === k);
      if (ch) { prendre(); dec(ch); }
    };
    window.addEventListener("keydown", ecoute, true);
    return () => window.removeEventListener("keydown", ecoute, true);
  }, []);

  const majRegles = (r: ReglesTriage) => ecrirePrefs((x) => x, r).catch((e) => notifier({ message: `Réglage non enregistré : ${(e as Error).message}`, ton: "crit" }));
  return (
    <div className="espace tr" ref={zone}>
      <Cartouche surtitre={`Triage du ${moment} · règles sans IA`} titre="Triage" meta={<><span>{file.length} à décider</span><span>{decisions.length} décidées</span>{extras.chargeOps && <span>lecture du budget…</span>}</>}
        actions={<><Segment etiquette="Moment" valeur={moment} onChange={(m) => { setMoment(m); setPassees([]); setRevenues([]); }} options={[{ valeur: "matin", libelle: "Matin" }, { valeur: "soir", libelle: "Soir" }]} />
          <Bouton variante="discret" aria-expanded={reglesOuvertes} onClick={() => setReglesOuvertes((x) => !x)}>Règles</Bouton></>} />
      {reglesOuvertes && <Reglages regles={regles} moment={moment} onChange={majRegles} />}
      <div className="tr-zone">
        <div className="tr-pile" aria-live="polite">
          {cour ? file.slice(0, 3).reverse().map((c, k, arr) => {
            const profondeur = arr.length - 1 - k;
            return (
              <article key={c.cle} className={`tr-c ${profondeur ? `d${profondeur}` : depart}`} aria-hidden={profondeur ? true : undefined} aria-label={profondeur ? undefined : `Carte de triage : ${c.titre}`}>
                <div className="tr-type" style={{ color: COULEURS[c.regle] }}><i style={{ background: COULEURS[c.regle] }} />{LIBELLES_REGLES[c.regle]}</div>
                <h3>{c.titre}</h3>
                <div className="discret">{c.meta}</div>
                <div className="tr-regle"><b>Règle</b><span>{c.motif}</span></div>
                {c.proposition && <div className="tr-prop"><span className="surtitre">Proposition</span><b>{c.proposition}</b>{c.choix[0]?.touche === "Entrée" && <span className="kbd">Entrée</span>}</div>}
              </article>
            );
          }) : (
            <div className="tr-fin">
              <span className="surtitre">{decisions.length ? "Triage terminé" : "Rien à trier"}</span>
              <h3>{decisions.length ? `${decisions.length} décision${decisions.length > 1 ? "s" : ""}, chacune avec sa règle.` : `Aucune carte pour le ${moment}.`}</h3>
              {decisions.length > 0 && <ul>{decisions.map((x) => <li key={x.carte.cle}><span className="mono discret">{x.libelle}</span><span>{x.carte.titre}</span></li>)}</ul>}
              <div><Bouton onClick={() => naviguer("/")}>Revenir au Fil du jour</Bouton></div>
            </div>
          )}
        </div>
        <aside className="tr-cote" aria-label="Décisions">
          <div><Surtitre>Progression · {decisions.length}/{total}</Surtitre><div className="tr-prog">{Array.from({ length: Math.min(total, 40) }, (_, i) => <i key={i} className={i < decisions.length ? "on" : ""} />)}</div></div>
          {cour && <div><Surtitre>Actions pour cette carte</Surtitre>
            <div className="tr-actions">
              {cour.choix.map((ch) => <button key={ch.touche} type="button" onClick={() => decider(ch)}><span className="kbd">{ch.touche}</span><span>{ch.libelle}</span><small>{ch.detail || ""}</small></button>)}
              <button type="button" onClick={() => decider("passer")}><span className="kbd">→</span><span>Passer</span><small>revient en fin de pile</small></button>
            </div></div>}
          <button type="button" className="tr-annuler" disabled={!decisions.length || !!depart} onClick={defaire}><span className="kbd">U</span><span>Annuler la dernière décision</span></button>
          <p className="discret tr-note">Aucune IA : les propositions viennent du jour le moins chargé, de la personne la moins chargée de l'équipe, du projet nommé dans le titre et de la catégorie suggérée par le serveur.</p>
        </aside>
      </div>
    </div>
  );
}

function Reglages({ regles: enregistrees, moment, onChange: enregistrer }: { regles: ReglesTriage; moment: Moment; onChange: (r: ReglesTriage) => void }) {
  // Affichage immédiat, enregistrement ensuite (la clé est écrite de façon asynchrone).
  const [regles, setRegles] = useState(enregistrees);
  useEffect(() => setRegles(enregistrees), [enregistrees]);
  const onChange = (r: ReglesTriage) => { setRegles(r); enregistrer(r); };
  const ids = (moment === "soir" ? ["glisse", "reunion", "habitude"] : ["retard", "dependance", "reunion", "assistant", "sans-projet", "sans-date", "operation", "habitude", "sport"]) as RegleId[];
  const nombre = (cle: "retardJours" | "habitudeJours" | "reunionJours" | "revoirJours", libelle: string, min: number, max: number) => (
    <label className="tr-nb">{libelle}<input type="number" min={min} max={max} value={regles[cle]} onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n >= min && n <= max) onChange({ ...regles, [cle]: n }); }} /> j</label>
  );
  return (
    <section className="panneau tr-regles" aria-label="Règles du triage">
      <div className="tr-regles-l">{ids.map((id) => <label key={id} className="tr-case"><input type="checkbox" checked={regles.actives[id]} onChange={(e) => onChange({ ...regles, actives: { ...regles.actives, [id]: e.target.checked } })} />{LIBELLES_REGLES[id]}</label>)}</div>
      <div className="tr-regles-l">{nombre("retardJours", "Retard et inactivité au-delà de", 0, 90)}{nombre("habitudeJours", "Habitude manquée depuis", 2, 30)}{nombre("reunionJours", "Réunions des derniers", 1, 90)}{nombre("revoirJours", "« Revoir » dans", 1, 30)}</div>
      <p className="discret"><Etat ton="info" point={false}>Synchronisé</Etat> Les règles sont enregistrées dans tes préférences Futur.</p>
    </section>
  );
}
