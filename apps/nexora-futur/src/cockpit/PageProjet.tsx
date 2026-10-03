// Page projet générée (Ref #657) : sections calculées depuis les données,
// masquables et réordonnables. Préférence synchronisée dans nexora:futurPrefs
// (Ref #669), avec repli sur l'ancienne préférence locale du lot 4.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDonnees, type Donnees } from "../donnees/magasin";
import { fusionnerPrefs, type PrefsPageProjet } from "../donnees/prefs";
import { ecartJours, estTerminee, type Projet, type Tache } from "../donnees/modele";
import { budgetProjet, chargeParPersonne, documentsProjet, friseProjet, journalProjet, prochainesEtapes, reunionsProjet, risquesProjet, santeProjet } from "../donnees/projet";
import { Bouton, Cartouche, Etat, Surtitre } from "../composants";
import { echeance, initiales } from "./Lignes";

const SECTIONS = [["etapes", "Prochaines étapes"], ["frise", "Frise · 12 semaines"], ["reunions", "Réunions et comptes rendus"], ["budget", "Budget du projet"],
  ["documents", "Documents"], ["equipe", "Équipe"], ["risques", "Risques de retard"], ["journal", "Journal du projet"]] as const;
type Cle = (typeof SECTIONS)[number][0];
const CLE_PREF = "nexora-futur:page-projet";
const CLES_SECTIONS = SECTIONS.map((s) => s[0]) as Cle[];
const estCle = (x: string): x is Cle => (CLES_SECTIONS as string[]).includes(x);
// Sections inconnues retirées, nouvelles sections ajoutées en fin d'ordre.
const normaliser = (p: PrefsPageProjet | null | undefined): { ordre: Cle[]; masquees: Cle[] } => {
  const ordre = (p?.ordre || []).filter(estCle);
  return { ordre: [...ordre, ...CLES_SECTIONS.filter((c) => !ordre.includes(c))], masquees: (p?.masquees || []).filter(estCle) };
};
const lireAncienne = (): PrefsPageProjet | null => {
  try { const v = JSON.parse(localStorage.getItem(CLE_PREF) || "null"); if (v && Array.isArray(v.ordre)) return v; } catch { /* préférence absente */ }
  return null;
};
const euros = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;
const court = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

interface Props { d: Donnees; projet: Projet; selection?: string; onOuvrir: (id: string) => void; onBasculer: (id: string) => void; lentilles: ReactNode; }

export function PageProjet({ d, projet, selection, onOuvrir, onBasculer, lentilles }: Props) {
  const jour = d.aujourdhui; const id = projet.id;
  const { ecrireJson } = useDonnees();
  // Affichage immédiat d'un réglage en cours d'enregistrement.
  const [local, setLocal] = useState<PrefsPageProjet | null>(null);
  const pref = normaliser(local ?? d.prefs.pageProjet ?? lireAncienne());
  const [reglage, setReglage] = useState(false);
  const setPref = (p: { ordre: Cle[]; masquees: Cle[] }) => {
    setLocal(p);
    ecrireJson("prefs", (v) => fusionnerPrefs(v, { pageProjet: p })).catch((e) => console.warn("Préférence non enregistrée", e));
  };
  // L'affichage local cède la place à la valeur synchronisée dès qu'elle la rejoint.
  useEffect(() => { if (local && JSON.stringify(normaliser(d.prefs.pageProjet)) === JSON.stringify(normaliser(local))) setLocal(null); }, [d.prefs.pageProjet, local]);
  const sante = useMemo(() => santeProjet(d.taches, id, d, jour), [d, id, jour]);
  const etapes = useMemo(() => prochainesEtapes(d.taches, id, d), [d, id]);
  const frise = useMemo(() => friseProjet(d.taches, id, d, jour), [d, id, jour]);
  const reunions = useMemo(() => reunionsProjet(d.taches, id, d, jour), [d, id, jour]);
  const budget = useMemo(() => budgetProjet(projet as never, d.depenses, id), [projet, d.depenses, id]);
  const docs = useMemo(() => documentsProjet(d.taches, id), [d.taches, id]);
  const equipe = useMemo(() => chargeParPersonne(d.taches, d, jour, (t) => t.projectId === id || t.secondaryProjectId === id).filter((c) => c.ouvertes > 0), [d, id, jour]);
  const risques = useMemo(() => risquesProjet(d.taches, id, d, jour), [d, id, jour]);
  const journal = useMemo(() => journalProjet(d.journal, id), [d.journal, id]);

  const lien = (t: Tache) => <button type="button" className="ligne-lien" onClick={() => onOuvrir(t.id)}>{t.milestone ? "◆ " : ""}{t.title}</button>;
  const contenu: Record<Cle, ReactNode> = {
    etapes: etapes.length ? etapes.map((t) => {
      const e = echeance(t, false, jour);
      return (
        <div key={t.id} className={`pp-ligne ${selection === t.id ? "sel" : ""}`}>
          <button type="button" role="checkbox" aria-checked={false} aria-label={`Terminer ${t.title}`} className="case" onClick={() => onBasculer(t.id)} />
          {lien(t)}<span className="avatar" title={t.assignee || "Sans responsable"}>{initiales(t.assignee) || "·"}</span><span className={`mono ech ech-${e.ton}`}>{e.texte}</span>
        </div>
      );
    }) : <p className="discret">Aucune tâche ouverte.</p>,
    frise: (
      <div className="pp-frise" style={{ height: Math.max(60, frise.barres.length * 22 + 26) }}>
        {Array.from({ length: 13 }, (_, i) => <div key={i} className="pp-semaine" style={{ left: `${(i * 7 / frise.jours) * 100}%` }}><span className="mono">{court(new Date(Date.parse(`${frise.debut}T12:00:00Z`) + i * 7 * 86400000).toISOString().slice(0, 10))}</span></div>)}
        <div className="pp-auj" style={{ left: `${(frise.auj / frise.jours) * 100}%` }} />
        {frise.barres.map((b, i) => (
          <button key={b.t.id} type="button" className={`pp-barre ${b.t.milestone ? "jalon" : ""} ${b.retard ? "retard" : ""} ${estTerminee(b.t, d.statuts) ? "finie" : ""}`} onClick={() => onOuvrir(b.t.id)} title={`${b.t.title} · ${court(b.t.start)} → ${court(b.t.end)}`}
            style={{ top: 24 + i * 22, left: `${(b.debut / frise.jours) * 100}%`, width: b.t.milestone ? undefined : `${Math.max(1, b.fin - b.debut) / frise.jours * 100}%`, background: b.t.milestone ? undefined : projet.color || "var(--encre3)" }}>
            <span>{b.t.milestone ? "◆ " : ""}{b.t.title}{b.retard ? ` · retard ${ecartJours(b.t.end!, jour)} j` : ""}</span>
          </button>
        ))}
        {!frise.barres.length && <p className="discret pp-vide">Aucune tâche datée dans la fenêtre.</p>}
      </div>
    ),
    reunions: (
      <>
        {reunions.aVenir.map((t) => <div key={t.id} className="pp-ligne"><span className="pp-date mono">{court(t.end)}</span>{lien(t)}<Etat ton="info" point={false}>à venir</Etat></div>)}
        {reunions.passees.map((t) => <div key={t.id} className="pp-ligne"><span className="pp-date mono">{court(t.end)}</span>{lien(t)}{(t.meetingReport || "").trim() ? <Etat ton="ok" point={false}>compte rendu</Etat> : <Etat ton="alerte" point={false}>compte rendu manquant</Etat>}</div>)}
        {!reunions.aVenir.length && !reunions.passees.length && <p className="discret">Aucune réunion sur 45 jours.</p>}
      </>
    ),
    budget: budget.actuel > 0 || budget.consomme > 0 ? (
      <>
        <div className="pp-jauge" role="img" aria-label={`${budget.pct} % du budget consommé`}><span style={{ width: `${Math.min(100, budget.pct)}%` }} className={budget.pct > 100 ? "depasse" : ""} /></div>
        <dl className="fil-kv">
          <div><dt>Budget</dt><dd className="mono">{euros(budget.actuel)}</dd></div>
          <div><dt>Consommé ({budget.pct} %)</dt><dd className={`mono ${budget.pct > 100 ? "crit" : ""}`}>{euros(budget.consomme)}</dd></div>
          <div><dt>Engagé · facturé · payé</dt><dd className="mono">{euros(budget.engagee)} · {euros(budget.facturee)} · {euros(budget.payee)}</dd></div>
          <div><dt>Reste</dt><dd className={`mono ${budget.reste < 0 ? "crit" : ""}`}>{euros(budget.reste)}</dd></div>
        </dl>
      </>
    ) : <p className="discret">Aucun chiffrage pour ce projet (budget initial et dépenses vides).</p>,
    documents: docs.length ? docs.map((x) => <div key={x.url} className="pp-ligne"><a href={x.url} target="_blank" rel="noopener noreferrer">{x.nom}</a><span className="discret">{x.drive ? "Drive" : "lien"} · {x.tache.title}</span></div>) : <p className="discret">Aucun document lié aux tâches.</p>,
    equipe: equipe.length ? equipe.map((c) => <div key={c.nom} className="pp-ligne"><span className="avatar">{initiales(c.nom)}</span><span>{c.nom}</span><span className="mono discret">{c.ouvertes} ouvertes</span>{c.retards > 0 && <Etat ton="crit" point={false}>{c.retards} en retard</Etat>}</div>) : <p className="discret">Aucune tâche assignée.</p>,
    risques: risques.length ? risques.map((r, i) => <div key={i} className="pp-ligne"><Etat ton={r.genre === "risque" ? "alerte" : "crit"} point={false}>{r.genre === "bloquee" ? "bloquée" : r.genre === "risque" ? "risque" : "urgent"}</Etat>{lien(r.t)}<span className="discret pp-detail">{r.texte}</span></div>) : <p className="discret">Aucun risque identifié.</p>,
    journal: journal.length ? journal.map((a, i) => <div key={a.id || i} className="pp-ligne"><span className="pp-date mono">{a.at ? new Date(a.at).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : ""}</span><span>{a.taskTitle}</span><span className="discret">{a.libelle}{a.type === "reassigned" ? ` → ${a.to || "personne"}` : a.type === "deadlineChanged" ? ` → ${court(a.toDate)}` : ""}</span></div>)
      : <p className="discret">Aucune entrée. Le journal est alimenté par Nexora actuel.</p>,
  };

  const visibles = pref.ordre.filter((c) => !pref.masquees.includes(c));
  const deplacer = (c: Cle, sens: -1 | 1) => { const o = [...pref.ordre]; const i = o.indexOf(c); const j = i + sens; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setPref({ ...pref, ordre: o }); };
  const bascule = (c: Cle) => setPref({ ...pref, masquees: pref.masquees.includes(c) ? pref.masquees.filter((x) => x !== c) : [...pref.masquees, c] });

  return (
    <div className="pp">
      <div className="zone-tete pp-tete">
        <Cartouche surtitre="Projet · page générée" titre={<><span className="point pp-point" style={{ background: projet.color || "var(--encre3)" }} />{projet.name}</>}
          meta={<><span>{sante.ouvertes} ouvertes</span><span>{sante.terminees} terminées</span>{sante.prochaine && <span>prochaine échéance {court(sante.prochaine.end)}</span>}</>}
          actions={<>{lentilles}<Bouton variante="discret" aria-expanded={reglage} onClick={() => setReglage((x) => !x)}>Personnaliser</Bouton></>} />
        <div className="pp-sante">
          <div className="panneau chiffre"><Surtitre>Avancement</Surtitre><b>{sante.avancement} %</b></div>
          <div className="panneau chiffre"><Surtitre>Retards</Surtitre><b className={sante.retards ? "crit" : ""}>{sante.retards}</b></div>
          <div className="panneau chiffre"><Surtitre>Budget consommé</Surtitre><b className={budget.pct > 100 ? "crit" : ""}>{budget.actuel > 0 ? `${budget.pct} %` : "—"}</b></div>
          <div className="panneau chiffre"><Surtitre>Prochain jalon</Surtitre><b className="pp-jalon">{sante.jalon ? `${court(sante.jalon.end)} · J−${ecartJours(jour, sante.jalon.end!)}` : "—"}</b></div>
        </div>
        {reglage && (
          <div className="panneau pp-reglage" role="group" aria-label="Sections de la page projet">
            {pref.ordre.map((c, i) => (
              <div key={c} className="pp-reglage-ligne">
                <label><input type="checkbox" checked={!pref.masquees.includes(c)} onChange={() => bascule(c)} /> {SECTIONS.find((s) => s[0] === c)?.[1]}</label>
                <button type="button" className="btn btn-discret" disabled={i === 0} aria-label="Monter" onClick={() => deplacer(c, -1)}>↑</button>
                <button type="button" className="btn btn-discret" disabled={i === pref.ordre.length - 1} aria-label="Descendre" onClick={() => deplacer(c, 1)}>↓</button>
              </div>
            ))}
            <p className="discret">Préférence propre à cet appareil.</p>
          </div>
        )}
      </div>
      <div className="pp-grille">
        {visibles.map((c) => (
          <section key={c} className={`panneau pp-section pp-${c}`} aria-label={SECTIONS.find((s) => s[0] === c)?.[1]}>
            <Surtitre>{SECTIONS.find((s) => s[0] === c)?.[1]}</Surtitre>
            {contenu[c]}
          </section>
        ))}
      </div>
    </div>
  );
}
