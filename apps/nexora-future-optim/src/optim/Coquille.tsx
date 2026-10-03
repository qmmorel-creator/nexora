// Coquille de Nexora Future Optim (Ref #688) : barre haute, navigation par
// adresse, fiche de tâche, saisie rapide, réglages, notification annulable,
// infobulles et glisser-déposer communs.
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { deconnexion } from "../donnees/firebase";
import { naviguer, useRoute } from "../navigation/routeur";
import { analyserSaisie } from "../donnees/saisie";
import { ajouterJours, CRITICITES, nouvelId, type Tache } from "../donnees/modele";
import { archiverTache, basculer, creer, dupliquerTache, modifier, remettre, restaurerTache, statutCyclique } from "../donnees/actions";
import { dateCourte, FournisseurUi, initiales, useOptim, useUi } from "./contexte";
import { installerInfobulles, installerSurvolHabitudes } from "./infobulle";
import { useGlisser } from "./glisser";
import { Accueil } from "./Accueil";
import { Journee } from "./Journee";
import { Planning } from "./Planning";
import { Projets } from "./Projets";
import { Corps } from "./Corps";
import { Argent } from "./Argent";
import { Reglages } from "./Reglages";
import { GardeEcran } from "./Garde";
import { compterTriage, Triage } from "./Triage";

const NAV: [string, string][] = [["", "Accueil"], ["journee", "Journée"], ["triage", "Triage"], ["planning", "Planning"], ["projets", "Projets"], ["corps", "Corps"], ["argent", "Argent"]];

function Fiche() {
  const { d, projet, statut, fini, retard, joursRetard, executer, jour } = useOptim();
  const { tacheId, ouvrir, notifier } = useUi();
  const t = d.taches.find((x) => x.id === tacheId);
  if (!t) return null;
  const p = projet(t.projectId), s = statut(t.statusId), ty = d.types.find((x) => x.id === t.taskTypeId);
  const deps = (t.dependsOn || []).map((id) => d.taches.find((x) => x.id === id)).filter((x): x is Tache => !!x);
  const cl = t.checklist || [], crit = CRITICITES.find((c) => c.id === t.criticality);
  const action = async (m: Parameters<typeof executer>[0], texte: string, annuler?: () => void) => {
    try { await executer(m); notifier({ texte, annuler }); } catch (e) { notifier({ texte: `Action refusée : ${(e as Error).message}` }); }
  };
  const avant = { ...t };
  return (
    <aside className="hx-panel" aria-label="Fiche de la tâche">
      <header><p className="hx-crumb"><i style={{ background: p.color }} />{p.name} · {ty?.name || "Tâche"}</p><button type="button" className="hx-x" aria-label="Fermer" onClick={() => ouvrir(null)}>×</button></header>
      <h2>{t.title}</h2>
      {(retard(t) || deps.some((x) => !fini(x))) && <p className="hx-flags">{retard(t) && <span className="is-red">{joursRetard(t)} j de retard</span>}{deps.filter((x) => !fini(x)).slice(0, 1).map((x) => <span key={x.id} className="is-amber">attend « {x.title} »</span>)}</p>}
      <dl className="hx-fields">
        <div><dt>Projet</dt><dd><span className="k-dot" style={{ ["--c" as string]: p.color }} />{p.name}</dd></div>
        <div><dt>Statut</dt><dd><span className="k-st" style={{ ["--c" as string]: s.color }}>{s.name}</span></dd></div>
        <div><dt>Échéance</dt><dd>{dateCourte(t.end)}{t.startTime ? ` · ${t.startTime}${t.endTime ? "–" + t.endTime : ""}` : ""}{t.start && !t.milestone && t.start !== t.end ? <span className="k-rel">depuis le {dateCourte(t.start)}</span> : null}</dd></div>
        <div><dt>Responsable</dt><dd>{t.assignee ? <><span className="k-av">{initiales(t.assignee)}</span>{t.assignee}</> : <span className="k-muted">Personne</span>}</dd></div>
        <div><dt>Criticité</dt><dd>{crit ? <span className="k-crit" style={{ ["--c" as string]: crit.couleur }}>{crit.nom}</span> : <span className="k-muted">Non définie</span>}</dd></div>
        {typeof t.progress === "number" && t.progress > 0 && <div><dt>Avancement</dt><dd>{t.progress} %</dd></div>}
      </dl>
      {cl.length > 0 && <><h3>Sous-tâches <span>{cl.filter((x) => x.done).length}/{cl.length}</span></h3><ul className="hx-cl">{cl.map((x) => <li key={x.id} className={x.done ? "is-done" : ""}><i>{x.done ? "✓" : ""}</i>{x.text}</li>)}</ul></>}
      {t.desc && <><h3>Description</h3><p className="ox-pre">{t.desc}</p></>}
      {deps.length > 0 && <><h3>Dépend de</h3>{deps.map((x) => <button key={x.id} type="button" className="hx-link" onClick={() => ouvrir(x.id)}>{x.title} · {fini(x) ? "terminée" : "ouverte"}</button>)}</>}
      {(t.attachments || []).length > 0 && <><h3>Pièces jointes</h3>{(t.attachments || []).map((a) => <p key={a.id} className="hx-att">{a.url ? <a href={a.url} target="_blank" rel="noreferrer noopener">{a.name || a.url}</a> : a.name}</p>)}</>}
      <footer>
        <button type="button" className="hx-btn is-primary" onClick={() => void action(basculer(t.id), `« ${t.title} » ${fini(t) ? "rouverte" : "terminée"}`, () => void executer(basculer(t.id)))}>{fini(t) ? "Rouvrir" : "Terminer"}</button>
        <button type="button" className="hx-btn" onClick={() => void action(statutCyclique(t.id), "Statut suivant", () => void executer(remettre([avant])))}>Statut suivant</button>
        <button type="button" className="hx-btn" onClick={() => void action(modifier(t.id, { ...(t.start ? { start: ajouterJours(t.start < jour ? jour : t.start, t.start < jour ? 0 : 1) } : {}), end: ajouterJours((t.end || jour) < jour ? jour : t.end || jour, (t.end || jour) < jour ? 0 : 1) }), `« ${t.title} » reportée`, () => void executer(remettre([avant])))}>Reporter</button>
        <button type="button" className="hx-btn" onClick={() => { const n: { id?: string } = {}; void action(dupliquerTache(t.id, n), `« ${t.title} » dupliquée`); }}>Dupliquer</button>
        <button type="button" className="hx-btn is-ghost" onClick={() => { ouvrir(null); void action(archiverTache(t.id), `« ${t.title} » archivée`, () => void executer(restaurerTache(t.id))); }}>Archiver</button>
      </footer>
    </aside>
  );
}

function Saisie() {
  const { d, jour, executer } = useOptim();
  const { saisie, setSaisie, notifier, ouvrir } = useUi();
  const [texte, setTexte] = useState("");
  const ctx = useMemo(() => ({ aujourdhui: jour, personnes: d.membres.map((m) => ({ id: m.name, nom: m.name })), projets: d.projets.map((p) => ({ id: p.id, nom: p.name || p.id })), types: d.types.map((t) => ({ id: t.id, nom: t.name || t.id })), criticites: [{ valeur: "urgent", alias: ["urgent", "urg"] }, { valeur: "moyen", alias: ["moyen"] }, { valeur: "bas", alias: ["bas"] }] }), [d.membres, d.projets, d.types, jour]);
  if (!saisie) return null;
  const s = analyserSaisie(texte, ctx);
  const fermer = () => { setSaisie(false); setTexte(""); };
  const soumettre = async (e: FormEvent) => {
    e.preventDefault(); if (!s.titre.trim()) return;
    const id = nouvelId();
    try {
      await executer(creer({ title: s.titre, ...(s.start ? { start: s.start } : {}), ...(s.end ? { end: s.end } : {}), ...(s.startTime ? { startTime: s.startTime } : {}), ...(s.endTime ? { endTime: s.endTime } : {}), ...(s.assignee ? { assignee: s.assignee } : {}), ...(s.projectId ? { projectId: s.projectId } : {}), ...(s.taskTypeId ? { taskTypeId: s.taskTypeId } : {}), ...(s.criticality ? { criticality: s.criticality as Tache["criticality"] } : {}) }, jour, id));
      fermer(); notifier({ texte: `Tâche « ${s.titre} » créée` }); ouvrir(id);
    } catch (x) { notifier({ texte: `Création refusée : ${(x as Error).message}` }); }
  };
  const ajouter = (m: string) => setTexte((v) => `${v.trim()} ${m}`.trim());
  return <>
    <div className="hx-scrim" onClick={fermer} />
    <form className="hx-compose" onSubmit={soumettre} aria-label="Nouvelle tâche">
      <header className="hx-th"><h2>Nouvelle tâche</h2><button type="button" className="hx-x" aria-label="Fermer" onClick={fermer}>×</button></header>
      <input autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") fermer(); }} autoComplete="off" aria-label="Titre et détails de la tâche" placeholder="Relancer BC vendredi 14h @Vincent #CTEX6 !urgent" />
      <p className="hx-prev"><span className="k-tok k-tok-title">{s.titre || "Titre"}</span>{s.jetons.map((j, i) => <span key={i} className="k-tok"><b>{j.genre}</b>{j.libelle}</span>)}{s.inconnus.map((x) => <span key={x} className="k-tok hx-red">{x} ?</span>)}</p>
      <div className="hx-pick"><span>Projet</span>{d.projets.slice(0, 10).map((p) => <button key={p.id} type="button" onClick={() => ajouter(`#${(p.name || "").replace(/\s/g, "")}`)}><i style={{ background: p.color || "#94a3b8" }} />{p.name}</button>)}</div>
      <div className="hx-pick"><span>Quand</span>{["aujourd'hui", "demain", "vendredi", "lundi"].map((x) => <button key={x} type="button" onClick={() => ajouter(x)}>{x}</button>)}</div>
      <div className="hx-pick"><span>Qui</span>{d.membres.slice(0, 8).map((m) => <button key={m.id} type="button" onClick={() => ajouter(`@${m.name.split(" ")[0]}`)}>{m.name.split(" ")[0]}</button>)}</div>
      <p className="hx-hint">Écrivez naturellement : #projet, @personne, !urgent, un jour, une heure.</p>
      <footer><button type="button" className="hx-btn is-ghost" onClick={fermer}>Annuler</button><button type="submit" className="hx-btn is-primary" disabled={!s.titre.trim()}>Créer la tâche</button></footer>
    </form></>;
}

function Notification() {
  const { notif, notifier } = useUi();
  useEffect(() => { if (!notif) return; const t = setTimeout(() => notifier(null), 6000); return () => clearTimeout(t); }, [notif, notifier]);
  if (!notif) return null;
  return <div className="hx-toast" role="status">{notif.texte}{notif.annuler && <> <button type="button" onClick={() => { const a = notif.annuler!; notifier({ texte: "Modification annulée" }); void a(); }}>Annuler</button></>}</div>;
}


function Interface({ email, demo }: { email: string; demo?: boolean }) {
  const { d, retard } = useOptim();
  const { tacheId, ouvrir, setSaisie, setReglages } = useUi();
  const route = useRoute();
  const ecran = route.segments[0] || "";
  useGlisser();
  useEffect(() => { const a = installerInfobulles(), b = installerSurvolHabitudes(); return () => { a(); b(); }; }, []);
  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (e.key === "Escape") { ouvrir(null); setSaisie(false); setReglages(null); }
      if (cible.closest("input, textarea, select, [contenteditable]")) return;
      if ((e.key === "n" || e.key === "c") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setSaisie(true); }
    };
    document.addEventListener("keydown", clavier); return () => document.removeEventListener("keydown", clavier);
  }, [ouvrir, setSaisie, setReglages]);
  const aller = (e: string, projet?: string) => { ouvrir(null); naviguer(`/${e}${projet ? "/" + encodeURIComponent(projet) : ""}`); };
  const nbRetard = d.taches.filter(retard).length;
  const nbTriage = useMemo(() => (d.charge ? compterTriage(d) : 0), [d]);
  let contenu;
  if (!d.charge) contenu = <main className="hx-main"><p className="hx-dim">Chargement de vos données…</p></main>;
  else if (ecran === "journee") contenu = <Journee email={email} />;
  else if (ecran === "planning") contenu = <Planning email={email} allerJournee={() => aller("journee")} ouvrirProjet={(id) => aller("projets", id)} />;
  else if (ecran === "projets") contenu = <Projets projetId={route.segments[1] || null} email={email} ouvrirProjet={(id) => naviguer(`/projets/${encodeURIComponent(id)}`)} />;
  else if (ecran === "corps") contenu = <Corps />;
  else if (ecran === "argent") contenu = <Argent />;
  else if (ecran === "triage") contenu = <Triage />;
  else contenu = <Accueil aller={aller} />;
  return (
    <div id="hx-app" className="ox-app">
      {demo && <div className="demo"><b>DÉMO</b> Données fictives en mémoire · rien n'est enregistré</div>}
      <header className="hx-top"><span className="hx-logo"><i />Nexora</span>
        <nav className="hx-nav" aria-label="Sections">{NAV.map(([id, l]) => <button key={id} type="button" aria-current={ecran === id ? "page" : "false"} onClick={() => aller(id)}>{l}{id === "projets" && nbRetard > 0 && <em>{nbRetard}</em>}{id === "triage" && nbTriage > 0 && <em className="is-info" title="Cartes du triage du matin">{nbTriage}</em>}</button>)}</nav>
        <span className="ox-user" title={email}>{email}</span>
        <button type="button" className="hx-btn is-primary" onClick={() => setSaisie(true)}>+ Nouvelle tâche</button>
        <button type="button" className="hx-gear" aria-label="Réglages" title="Réglages" onClick={() => setReglages("accueil")}>⚙</button>
        {!demo && <button type="button" className="hx-more is-plain" onClick={() => void deconnexion()}>Déconnexion</button>}
      </header>
      <div className={`hx-body ${tacheId ? "has-panel" : ""}`}><GardeEcran key={route.chemin} nom={ecran || "accueil"}>{contenu}</GardeEcran><GardeEcran key={"fiche-" + (tacheId || "")} nom="fiche"><Fiche /></GardeEcran></div>
      <Saisie /><Reglages /><Notification />
    </div>
  );
}

export function Coquille({ email, demo }: { email: string; demo?: boolean }) {
  return <FournisseurUi><Interface email={email} demo={demo} /></FournisseurUi>;
}
