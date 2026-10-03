// Fil du jour (Ref #656) : l'accueil organisé par les heures de la journée.
import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ajouterJours, ecartJours, estReunion, estTerminee, type Tache } from "../donnees/modele";
import type { Donnees } from "../donnees/magasin";
import type { RapportsJour, Source } from "../donnees/source";
import { aCaser, echeancesDuJour, evenementsDuJour, glissent, heureParis, horizon, modeParHeure, pointsAttention, termineesLe, type ModeJour } from "../donnees/journee";
import { HabitudesJour } from "./Habitudes";
import { compterTriage } from "./Triage";
import { Bouton, Etat, Segment, Surtitre } from "../composants";
import { naviguer } from "../navigation/routeur";
import { initiales } from "./Lignes";

const PX_HEURE = 54;
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

export function FilDuJour({ d, source, mode: modeChoisi, setMode, selection, onOuvrir, onPatch, onBasculer }: Props) {
  const [maintenant, setMaintenant] = useState(heureParis());
  useEffect(() => { const i = setInterval(() => setMaintenant(heureParis()), 30_000); return () => clearInterval(i); }, []);
  const jour = d.aujourdhui;
  const mode = modeChoisi ?? modeParHeure(Math.floor(maintenant / 60));
  const { r, erreur } = useRapports(source, jour);
  const ev = useMemo(() => evenementsDuJour(d.taches, jour), [d.taches, jour]);
  const echeances = useMemo(() => echeancesDuJour(d.taches, jour, d), [d, jour]);
  const caser = useMemo(() => aCaser(d.taches, jour, d), [d, jour]);
  const points = useMemo(() => pointsAttention(d.taches, jour, d), [d, jour]);
  const hz = useMemo(() => horizon(d.taches, jour, d, 14), [d, jour]);
  const [survol, setSurvol] = useState<number | null>(null);

  const debutH = Math.min(7, ...ev.map((e) => Math.floor(e.debut / 60)));
  const finH = Math.max(21, ...ev.map((e) => Math.ceil(e.fin / 60)));
  const y = (m: number) => ((m - debutH * 60) / 60) * PX_HEURE;
  const projet = (t: Tache) => d.projets.find((p) => p.id === t.projectId);

  const minuteDepuis = (e: DragEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const m = debutH * 60 + ((e.clientY - rect.top) / PX_HEURE) * 60;
    return Math.max(debutH * 60, Math.min(finH * 60 - 15, Math.round(m / 15) * 15));
  };
  const deposer = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setSurvol(null);
    const id = e.dataTransfer.getData("text/nexora-tache");
    const t = d.taches.find((x) => x.id === id);
    if (!t) return;
    const m = minuteDepuis(e);
    const debut = t.start && t.start <= jour && (t.end || "") >= jour ? t.start : jour;
    onPatch(id, { start: debut, end: (t.end || "") < jour ? jour : t.end, startTime: hhmm(m), endTime: hhmm(Math.min(m + 60, 23 * 60 + 59)) }, `« ${t.title} » casée à ${hhmm(m)}.`);
  };

  const carteTache = (t: Tache, extra?: string) => (
    <div key={t.id} className={`fil-tache ${selection === t.id ? "sel" : ""}`} draggable onDragStart={(e) => { e.dataTransfer.setData("text/nexora-tache", t.id); e.dataTransfer.effectAllowed = "move"; }}>
      <button type="button" role="checkbox" aria-checked={estTerminee(t, d.statuts)} aria-label={`Terminer ${t.title}`} className="case" onClick={() => onBasculer(t.id)} />
      <span className="point" style={{ background: projet(t)?.color || "var(--encre3)" }} />
      <button type="button" className="ligne-lien" onClick={() => onOuvrir(t.id)}>{t.title}</button>
      {extra && <span className="mono fil-extra">{extra}</span>}
    </div>
  );

  const frise = (
    <section className="panneau fil-frise" aria-label="Frise de la journée">
      {echeances.length > 0 && <div className="fil-jour-entier"><Surtitre>Toute la journée</Surtitre>{echeances.map((t) => carteTache(t, t.milestone ? "jalon" : "échéance"))}</div>}
      <div className={`fil-heures ${survol !== null ? "survol" : ""}`} style={{ height: (finH - debutH) * PX_HEURE }}
        onDragOver={(e) => { e.preventDefault(); setSurvol(minuteDepuis(e)); }} onDragLeave={() => setSurvol(null)} onDrop={deposer}>
        {Array.from({ length: finH - debutH + 1 }, (_, i) => <div key={i} className="fil-heure" style={{ top: i * PX_HEURE }}><span className="mono">{String(debutH + i).padStart(2, "0")}:00</span></div>)}
        {ev.map((e) => {
          const fini = estTerminee(e.t, d.statuts); const passe = e.fin < maintenant;
          const court = y(e.fin) - y(e.debut) < 40;
          return (
            <button type="button" key={e.t.id} className={`fil-ev ${court ? "court" : ""} ${passe || fini ? "passe" : ""} ${selection === e.t.id ? "sel" : ""} ${estReunion(e.t, d.types) ? "reunion" : ""}`} onClick={() => onOuvrir(e.t.id)}
              style={{ top: y(e.debut) + 1, height: Math.max(22, y(e.fin) - y(e.debut) - 2), left: `calc(64px + (100% - 72px) * ${e.colonne / e.colonnes})`, width: `calc((100% - 72px) / ${e.colonnes} - 4px)`, borderLeftColor: projet(e.t)?.color || "var(--encre3)" }}>
              <b>{e.t.title}</b><span className="mono">{hhmm(e.debut)}–{hhmm(e.fin)} · {projet(e.t)?.name || "Sans projet"}{e.t.assignee ? ` · ${initiales(e.t.assignee)}` : ""}</span>
            </button>
          );
        })}
        {survol !== null && <div className="fil-depot mono" style={{ top: y(survol) }}>{hhmm(survol)}</div>}
        {maintenant >= debutH * 60 && maintenant <= finH * 60 && <div className="fil-maintenant" style={{ top: y(maintenant) }}><span className="mono">{hhmm(maintenant)}</span></div>}
        {!ev.length && <p className="fil-vide discret">Aucun créneau horaire aujourd'hui. Glisse une tâche du bac « À caser » sur une heure pour la planifier.</p>}
      </div>
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
  const colonneGauche = mode === "soir" ? (
    <>
      {lienTriage}
      <section className="panneau fil-carte"><Surtitre>Bilan · terminées aujourd'hui</Surtitre>
        {termineesLe(d.taches, jour, d).map((t) => carteTache(t))}{!termineesLe(d.taches, jour, d).length && <p className="discret">Aucune tâche terminée aujourd'hui.</p>}</section>
      <section className="panneau fil-carte"><Surtitre>Glisse à demain ?</Surtitre>
        {glissent(d.taches, jour, d).map((t) => (
          <div key={t.id} className="fil-glisse">{carteTache(t)}<Bouton variante="discret" onClick={() => onPatch(t.id, { start: t.start === t.end ? ajouterJours(jour, 1) : t.start, end: ajouterJours(jour, 1) }, `« ${t.title} » reportée à demain.`)}>Demain</Bouton></div>
        ))}{!glissent(d.taches, jour, d).length && <p className="discret">Rien n'est dû aujourd'hui.</p>}</section>
      <Rapport titre="Rapport du soir" r={r?.soir ?? null} vide={erreur || "Le rapport du soir est généré à 20 h 30."} />
    </>
  ) : (
    <>
      {mode === "matin" && <Rapport titre="Briefing de 7 h" r={r?.matin ?? null} vide={erreur || "Pas encore de rapport du matin pour aujourd'hui."} />}
      {mode === "matin" && lienTriage}
      <section className="panneau fil-carte"><Surtitre>Points d'attention</Surtitre>
        {points.map((p) => (
          <div key={`${p.genre}-${p.t.id}`} className="fil-point">
            <Etat ton={p.genre === "retard" ? "crit" : p.genre === "compte-rendu" ? "alerte" : "accent"}>{p.texte}</Etat>
            <button type="button" className="ligne-lien" onClick={() => onOuvrir(p.t.id)}>{p.t.title}</button>
          </div>
        ))}{!points.length && <p className="discret">Rien d'urgent : aucun retard, aucune réunion sans compte rendu.</p>}</section>
      {mode === "journee" && r?.matin && <Rapport titre="Briefing de 7 h" r={r.matin} vide="" />}
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
        <div className="fil-semaine">
          {semaine.map((j) => {
            const evs = evenementsDuJour(d.taches, j); const ech = echeancesDuJour(d.taches, j, d);
            return (
              <section key={j} className={`panneau fil-sjour ${j === jour ? "auj" : ""}`} aria-label={dateLongue(j)}>
                <Surtitre>{dateLongue(j)}</Surtitre>
                {evs.map((e) => <button key={e.t.id} type="button" className="fil-sev" onClick={() => onOuvrir(e.t.id)} style={{ borderLeftColor: projet(e.t)?.color }}><span className="mono">{hhmm(e.debut)}</span> {e.t.title}</button>)}
                {ech.map((t) => <button key={t.id} type="button" className="fil-sev" onClick={() => onOuvrir(t.id)} style={{ borderLeftColor: projet(t)?.color }}><span className="mono">{t.milestone ? "◆" : "fin"}</span> {t.title}</button>)}
                {!evs.length && !ech.length && <p className="discret">—</p>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="fil-grille">
          <div className="fil-col">{colonneGauche}</div>
          {frise}
          <div className="fil-col">
            <section className="panneau fil-carte" aria-label="À caser aujourd'hui"><Surtitre>À caser · glisser sur la frise</Surtitre>
              {caser.map((t) => carteTache(t, t.end && t.end < jour ? `−${ecartJours(t.end, jour)} j` : "auj."))}
              {!caser.length && <p className="discret">Rien à caser : aucune échéance du jour sans heure, aucun retard.</p>}</section>
            <section className="panneau fil-carte" aria-label="Habitudes du jour"><Surtitre>Habitudes</Surtitre><HabitudesJour jour={jour} /></section>
          </div>
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
