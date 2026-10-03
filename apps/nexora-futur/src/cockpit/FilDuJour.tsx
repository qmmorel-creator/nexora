// Fil du jour (Ref #656), mis en page en Cadran (Ref #678) : la journée sur
// un cadran de 24 h, les habitudes en « pixel du jour », un panneau par moment.
import { useEffect, useMemo, useState } from "react";
import { ajouterJours, ecartJours, estReunion, estTerminee, type Tache } from "../donnees/modele";
import type { Donnees } from "../donnees/magasin";
import type { RapportsJour, Source } from "../donnees/source";
import { aCaser, echeancesDuJour, evenementsDuJour, glissent, heureParis, horizon, modeParHeure, pointsAttention, premierCreneau, termineesLe, type ModeJour } from "../donnees/journee";
import { couleursCase, etatsDuJour, fondCase } from "../donnees/habitudes";
import { Cadran, MiniCadran, arcsDe } from "./Cadran";
import { Mosaique, PixelDuJour, SemaineHabitudes } from "./PixelDuJour";
import { useNotifier } from "./Notifications";
import { compterTriage } from "./Triage";
import { Bouton, Etat, Segment, Surtitre } from "../composants";
import { naviguer } from "../navigation/routeur";
import { initiales } from "./Lignes";

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateLongue = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`; };
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const LIBELLES_RESUME: [string, string][] = [["emailsAnalyzed", "E-mails analysés"], ["emailsMarkedImportant", "Marqués importants"], ["tasksCreated", "Tâches créées"], ["tasksUpdated", "Tâches mises à jour"], ["tasksCompleted", "Tâches terminées"], ["duplicatesAvoided", "Doublons évités"], ["confirmationsRequested", "Confirmations demandées"], ["errors", "Erreurs"]];
const euros = (n: unknown) => (typeof n === "number" ? `${Math.round(n).toLocaleString("fr-FR")} €` : "—");

interface Props {
  d: Donnees; source: Source; mode: ModeJour | null; setMode: (m: ModeJour) => void; selection?: string;
  onOuvrir: (id: string) => void; onPatch: (id: string, patch: Partial<Tache>, message?: string) => void; onBasculer: (id: string) => void;
}

function useRapports(source: Source, jour: string) {
  const [etat, setEtat] = useState<{ r: RapportsJour | null; erreur: string | null }>({ r: null, erreur: null });
  useEffect(() => {
    let vivant = true;
    if (!source.rapports) { setEtat({ r: null, erreur: "Rapports non disponibles dans cet environnement." }); return; }
    setEtat({ r: null, erreur: null });
    source.rapports(jour).then((r) => vivant && setEtat({ r, erreur: null })).catch((e: Error) => vivant && setEtat({ r: null, erreur: e.message }));
    return () => { vivant = false; };
  }, [source, jour]);
  return etat;
}

function Rapport({ titre, r, vide }: { titre: string; r: RapportsJour["matin"]; vide: string }) {
  if (!r) return <section className="panneau fil-carte"><Surtitre>{titre}</Surtitre><p className="discret">{vide}</p></section>;
  const s = r.summary || {};
  const b = r.budget as Record<string, unknown> | undefined;
  return (
    <section className="panneau fil-carte fil-briefing">
      <Surtitre>{titre} · généré par l'assistant</Surtitre>
      <dl className="fil-kv">{LIBELLES_RESUME.filter(([k]) => (s[k] ?? 0) > 0 || k === "emailsAnalyzed" || k === "tasksCreated").map(([k, l]) => <div key={k}><dt>{l}</dt><dd className={`mono ${k === "errors" ? "crit" : ""}`}>{s[k] ?? 0}</dd></div>)}</dl>
      {b?.ok === true && (
        <dl className="fil-kv fil-budget">
          <div><dt>Reste à dépenser</dt><dd className="mono">{euros(b.remaining)}</dd></div>
          <div><dt>Dépenses du mois</dt><dd className="mono">{euros(b.expenses)}</dd></div>
          {Array.isArray(b.overBudget) && b.overBudget.length > 0 && <div><dt>Catégories dépassées</dt><dd className="mono crit">{b.overBudget.length}</dd></div>}
          {typeof b.toCategorize === "number" && b.toCategorize > 0 && <div><dt>À catégoriser</dt><dd className="mono">{b.toCategorize}</dd></div>}
        </dl>
      )}
      {b?.ok === false && <p className="discret">Budget indisponible dans ce rapport.</p>}
      {!!r.rows?.length && <details><summary className="discret">{r.rows.length} opérations de l'assistant</summary><ul className="fil-lignes">{r.rows.slice(0, 20).map((x, i) => <li key={i}><span className="mono discret">{x.occurredAt ? new Date(x.occurredAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}</span> {x.treatment}</li>)}</ul></details>}
    </section>
  );
}

const dureeTxt = (m: number) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}` : `${m} min`;
const ecrit = (x: EventTarget | null) => x instanceof HTMLElement && (x.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(x.tagName));
const FOCUS: Partial<Record<ModeJour, [number, number]>> = { matin: [6, 12], soir: [18, 23] };

// Heat map annuelle d'un thème d'habitudes (couleurs des habitudes tenues).
function AnneeHabitudes({ d, jour }: { d: Donnees; jour: string }) {
  const [themeId, setThemeId] = useState("");
  const theme = d.themesHabitudes.find((t) => t.id === themeId) || d.themesHabitudes[0];
  const cases = useMemo(() => {
    const dow = (new Date(`${jour}T12:00:00Z`).getUTCDay() + 6) % 7; const debut = ajouterJours(jour, -dow - 7 * 39);
    return Array.from({ length: 40 * 7 }, (_, i) => { const x = ajouterJours(debut, i); return { x, futur: x > jour, fond: theme ? fondCase(couleursCase(theme, d.journalHabitudes, x), "") : "" }; });
  }, [jour, theme, d.journalHabitudes]);
  if (!theme) return <p className="discret">Aucune habitude configurée.</p>;
  return (
    <>
      <div className="ca-bloc-tete"><h2>Habitudes · 40 semaines</h2>
        <select className="co-select" aria-label="Thème de la heat map" value={theme.id} onChange={(e) => setThemeId(e.target.value)}>{d.themesHabitudes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div className="co-annee ca-annee" aria-hidden="true">{cases.map((c) => <i key={c.x} title={c.x} style={{ background: c.futur ? "transparent" : c.fond || undefined }} />)}</div>
      <div className="co-leg">{theme.habits.map((h) => <span key={h.id}><span className="hp-dot" style={{ background: h.color }} />{h.name}</span>)}</div>
    </>
  );
}

export function FilDuJour({ d, source, mode: modeChoisi, setMode, selection, onOuvrir, onPatch, onBasculer }: Props) {
  const notifier = useNotifier();
  const [maintenant, setMaintenant] = useState(heureParis());
  useEffect(() => { const i = setInterval(() => setMaintenant(heureParis()), 30_000); return () => clearInterval(i); }, []);
  const jour = d.aujourdhui;
  const [jourHab, setJourHab] = useState(jour);
  const mode = modeChoisi ?? modeParHeure(Math.floor(maintenant / 60));
  const { r, erreur } = useRapports(source, jour);
  const ev = useMemo(() => evenementsDuJour(d.taches, jour), [d.taches, jour]);
  const echeances = useMemo(() => echeancesDuJour(d.taches, jour, d), [d, jour]);
  const caser = useMemo(() => aCaser(d.taches, jour, d), [d, jour]);
  const points = useMemo(() => pointsAttention(d.taches, jour, d), [d, jour]);
  const hz = useMemo(() => horizon(d.taches, jour, d, 14), [d, jour]);
  const hab = useMemo(() => etatsDuJour(d.themesHabitudes, d.journalHabitudes, d.nonApplicables, jour), [d.themesHabitudes, d.journalHabitudes, d.nonApplicables, jour]);
  const projet = (t: Tache) => d.projets.find((p) => p.id === t.projectId);

  // ← → changent le jour des habitudes (pas au-delà d'aujourd'hui).
  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || ecrit(e.target) || document.querySelector("[role=dialog]")) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setJourHab((j) => { const n = ajouterJours(j, e.key === "ArrowLeft" ? -1 : 1); return n > jour ? j : n; });
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [jour]);

  const planifier = (id: string, m: number) => {
    const t = d.taches.find((x) => x.id === id);
    if (!t) return;
    const debut = t.start && t.start <= jour && (t.end || "") >= jour ? t.start : jour;
    onPatch(id, { start: debut, end: (t.end || "") < jour ? jour : t.end, startTime: hhmm(m), endTime: hhmm(Math.min(m + 60, 23 * 60 + 59)) }, `« ${t.title} » casée à ${hhmm(m)}.`);
  };
  const caserAuto = (t: Tache) => {
    const m = premierCreneau(ev, Math.max(maintenant, 8 * 60));
    if (m === null) { notifier({ message: "Aucun créneau libre d'une heure avant 21 h : glisse la tâche sur le cadran.", ton: "crit" }); return; }
    planifier(t.id, m);
  };

  const carteTache = (t: Tache, extra?: string, action?: JSX.Element) => (
    <div key={t.id} className={`fil-tache ${selection === t.id ? "sel" : ""}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/nexora-tache", t.id); e.dataTransfer.effectAllowed = "move"; }}>
      <button type="button" role="checkbox" aria-checked={estTerminee(t, d.statuts)} aria-label={`Terminer ${t.title}`} className="case" onClick={() => onBasculer(t.id)} />
      <span className="point" style={{ background: projet(t)?.color || "var(--encre3)" }} />
      <button type="button" className="ligne-lien" onClick={() => onOuvrir(t.id)}>{t.title}</button>
      {extra && <span className="mono fil-extra">{extra}</span>}
      {action}
    </div>
  );

  const cour = ev.find((e) => e.debut <= maintenant && maintenant < e.fin);
  const proch = ev.filter((e) => e.debut > maintenant).sort((a, b) => a.debut - b.debut)[0];
  const arcs = arcsDe(ev, (e) => projet(e.t)?.color || "var(--encre3)", maintenant).map((a) => ({
    ...a, terne: (mode === "matin" && a.debut >= 12 * 60) || (mode === "soir" && !a.passe && a.debut < 18 * 60),
  }));
  const faites = hab.parTheme.flatMap((x) => x.habitudes).filter((x) => x.etat === "fait").map((x) => ({ couleur: x.h.color, nom: x.h.name }));

  const cadran = (
    <section className="ca-zone" aria-label="Cadran de la journée">
      <Cadran arcs={arcs} maintenant={maintenant} selection={selection} focus={FOCUS[mode] ?? null} habitudes={faites} totalHabitudes={hab.total} onOuvrir={onOuvrir} onDepot={planifier}>
        <span className="surtitre">{mode === "matin" ? "Ce matin" : mode === "soir" ? "Ce soir" : "Maintenant"}</span>
        <span className="ca-heure mono">{hhmm(maintenant)}</span>
        <span className="ca-quoi">{cour ? cour.t.title : "Libre"}</span>
        <span className="ca-reste mono">{cour ? `reste ${dureeTxt(cour.fin - maintenant)}` : ""}{cour && proch ? " · " : ""}{proch ? `ensuite ${hhmm(proch.debut)}` : ""}</span>
        {hab.parTheme.length > 0 && <>
          <span className="ca-mos" title="Le pixel du jour"><Mosaique themes={d.themesHabitudes} journal={d.journalHabitudes} nonApplicables={d.nonApplicables} jour={jour} taille={14} /></span>
          <span className="ca-mos-n mono"><b>{hab.faites}</b> / {hab.total} habitudes</span>
        </>}
      </Cadran>
      {echeances.length > 0 && <div className="ca-jour-entier"><Surtitre>Toute la journée</Surtitre>{echeances.map((t) => carteTache(t, t.milestone ? "jalon" : "échéance"))}</div>}
      <ol className="ca-liste" aria-label="Créneaux du jour">
        {ev.map((e) => (
          <li key={e.t.id}>
            <button type="button" className={`ca-ev ${e.fin <= maintenant || estTerminee(e.t, d.statuts) ? "passe" : ""} ${cour === e ? "cour" : ""} ${selection === e.t.id ? "sel" : ""} ${estReunion(e.t, d.types) ? "reunion" : ""}`} onClick={() => onOuvrir(e.t.id)}>
              <span className="mono">{hhmm(e.debut)}–{hhmm(e.fin)}</span><i style={{ background: projet(e.t)?.color || "var(--encre3)" }} /><b>{e.t.title}</b>
              <span className="discret">{projet(e.t)?.name || "Sans projet"}{e.t.assignee ? ` · ${initiales(e.t.assignee)}` : ""}</span>
            </button>
          </li>
        ))}
        {!ev.length && <li className="discret">Aucun créneau horaire aujourd'hui. Glisse une tâche « À caser » sur le cadran, ou utilise « Caser ».</li>}
      </ol>
    </section>
  );

  const nbTriage = compterTriage(d);
  const lienTriage = (
    <section className="panneau fil-carte fil-triage" aria-label="Triage">
      <Surtitre>Triage du {mode === "soir" ? "soir" : "matin"}</Surtitre>
      <p className="discret">{mode === "soir" ? "Ce qui reste dû aujourd'hui, les réunions sans compte rendu et les habitudes non cochées." : nbTriage ? `${nbTriage} décision${nbTriage > 1 ? "s" : ""} : retards sans activité, tâches à ranger ou à dater, réunions sans compte rendu, habitudes manquées.` : "Rien à trier ce matin."}</p>
      <div><Bouton variante="principal" onClick={() => naviguer("/triage")}>Ouvrir le Triage</Bouton></div>
    </section>
  );
  const pixel = (
    <div className="ca-hab">
      <PixelDuJour jour={jourHab} setJour={setJourHab} aujourdhui={jour} />
      <SemaineHabitudes jour={jourHab} setJour={setJourHab} aujourdhui={jour} />
    </div>
  );
  const blocCaser = (
    <section className="panneau fil-carte" aria-label="À caser aujourd'hui"><Surtitre>À caser · glisser sur le cadran</Surtitre>
      {caser.map((t) => carteTache(t, t.end && t.end < jour ? `−${ecartJours(t.end, jour)} j` : "auj.", <Bouton variante="discret" onClick={() => caserAuto(t)} aria-label={`Caser ${t.title}`}>Caser</Bouton>))}
      {!caser.length && <p className="discret">Rien à caser : aucune échéance du jour sans heure, aucun retard.</p>}</section>
  );
  const blocPoints = (
    <section className="panneau fil-carte" aria-label="Points d'attention"><Surtitre>Points d'attention</Surtitre>
      {points.map((p) => (
        <div key={`${p.genre}-${p.t.id}`} className="fil-point">
          <Etat ton={p.genre === "retard" ? "crit" : p.genre === "compte-rendu" ? "alerte" : "accent"}>{p.texte}</Etat>
          <button type="button" className="ligne-lien" onClick={() => onOuvrir(p.t.id)}>{p.t.title}</button>
        </div>
      ))}{!points.length && <p className="discret">Rien d'urgent : aucun retard, aucune réunion sans compte rendu.</p>}</section>
  );
  const terminees = termineesLe(d.taches, jour, d);
  const restent = glissent(d.taches, jour, d);
  const reporter = (t: Tache) => onPatch(t.id, { start: t.start === t.end ? ajouterJours(jour, 1) : t.start, end: ajouterJours(jour, 1) }, `« ${t.title} » reportée à demain.`);
  const panneau = mode === "soir" ? (
    <>
      <section className="panneau fil-carte" aria-label="Bilan de la journée"><Surtitre>Bilan de la journée</Surtitre>
        <div className="ca-chiffres">
          <div><b className="mono">{ev.filter((e) => e.fin <= maintenant).length}/{ev.length}</b><span>créneaux passés</span></div>
          <div><b className="mono">{hab.faites}/{hab.total}</b><span>habitudes</span></div>
          <div><b className="mono">{terminees.length}</b><span>tâche{terminees.length > 1 ? "s" : ""} terminée{terminees.length > 1 ? "s" : ""}</span></div>
        </div>
        {terminees.map((t) => carteTache(t))}</section>
      {pixel}
      <section className="panneau fil-carte" aria-label="Ce qui reste"><Surtitre>Ce qui reste · glisse à demain ?</Surtitre>
        {restent.map((t) => <div key={t.id} className="fil-glisse">{carteTache(t)}<Bouton variante="discret" onClick={() => reporter(t)}>Demain</Bouton></div>)}
        {restent.length > 1 && <div><Bouton variante="discret" onClick={() => restent.forEach(reporter)}>Tout à demain</Bouton></div>}
        {!restent.length && <p className="discret">Rien n'est dû aujourd'hui.</p>}</section>
      {lienTriage}
      <Rapport titre="Rapport du soir" r={r?.soir ?? null} vide={erreur || "Le rapport du soir est généré à 20 h 30."} />
    </>
  ) : mode === "matin" ? (
    <>
      <Rapport titre="Briefing de 7 h" r={r?.matin ?? null} vide={erreur || "Pas encore de rapport du matin pour aujourd'hui."} />
      {lienTriage}
      {blocCaser}
      {pixel}
      {blocPoints}
    </>
  ) : (
    <>
      {pixel}
      {blocCaser}
      {blocPoints}
      {r?.matin && <Rapport titre="Briefing de 7 h" r={r.matin} vide="" />}
    </>
  );

  const semaine = useMemo(() => {
    const [a, m, j] = jour.split("-").map(Number); const dow = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
    const lundi = ajouterJours(jour, dow === 0 ? -6 : 1 - dow);
    return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
  }, [jour]);

  return (
    <div className="fil">
      <div className="fil-tete">
        <h1 className="fil-titre">{dateLongue(jour).replace(/^./, (c) => c.toUpperCase())} <span className="mono discret">{hhmm(maintenant)}</span></h1>
        <Segment etiquette="Mode du fil" valeur={mode} onChange={setMode} options={[{ valeur: "matin", libelle: "Matin" }, { valeur: "journee", libelle: "Journée" }, { valeur: "soir", libelle: "Soir" }, { valeur: "semaine", libelle: "Semaine" }]} />
      </div>
      {mode === "semaine" ? (
        <>
          <div className="fil-semaine">
            {semaine.map((j) => {
              const evs = evenementsDuJour(d.taches, j); const ech = echeancesDuJour(d.taches, j, d);
              return (
                <section key={j} className={`panneau fil-sjour ${j === jour ? "auj" : ""}`} aria-label={dateLongue(j)}>
                  <MiniCadran arcs={arcsDe(evs, (e) => projet(e.t)?.color || "var(--encre3)", null)} auj={j === jour} />
                  <Surtitre>{dateLongue(j)}</Surtitre>
                  <span className="mono discret ca-sem-n">{evs.length} créneau{evs.length > 1 ? "x" : ""} · {ech.length} échéance{ech.length > 1 ? "s" : ""}</span>
                  {evs.map((e) => <button key={e.t.id} type="button" className="fil-sev" onClick={() => onOuvrir(e.t.id)} style={{ borderLeftColor: projet(e.t)?.color }}><span className="mono">{hhmm(e.debut)}</span> {e.t.title}</button>)}
                  {ech.map((t) => <button key={t.id} type="button" className="fil-sev" onClick={() => onOuvrir(t.id)} style={{ borderLeftColor: projet(t)?.color }}><span className="mono">{t.milestone ? "◆" : "fin"}</span> {t.title}</button>)}
                  {!evs.length && !ech.length && <p className="discret">—</p>}
                </section>
              );
            })}
          </div>
          <div className="ca-sem-bas">
            <section className="panneau fil-carte" aria-label="Heat map annuelle des habitudes"><AnneeHabitudes d={d} jour={jour} /></section>
            <section className="panneau fil-carte" aria-label="Semaine des habitudes"><Surtitre>Habitudes de la semaine</Surtitre><SemaineHabitudes jour={jourHab} setJour={setJourHab} aujourdhui={jour} /></section>
          </div>
        </>
      ) : (
        <div className="ca-grille">
          {cadran}
          <div className="ca-panneau">{panneau}</div>
        </div>
      )}
      <section className="fil-horizon" aria-label="Horizon 14 jours">
        <Surtitre>Horizon 14 jours</Surtitre>
        <div className="fil-hz">
          {hz.map((x) => (
            <div key={x.jour} className={`fil-hz-jour ${x.jour === jour ? "auj" : ""} ${[0, 6].includes(new Date(`${x.jour}T12:00:00Z`).getUTCDay()) ? "we" : ""}`}>
              <b className="mono">{x.jour.slice(8, 10)}/{x.jour.slice(5, 7)}</b>
              {x.elements.slice(0, 3).map((t) => <button key={t.id} type="button" className="fil-hz-el" onClick={() => onOuvrir(t.id)} title={t.title}><i style={{ background: projet(t)?.color || "var(--encre3)" }} />{t.milestone ? "◆ " : ""}{t.title}</button>)}
              {x.elements.length > 3 && <span className="discret mono">+{x.elements.length - 3}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
