// Espaces (Ref #657) : bande de bascule et pages Finances, Corps, Équipe.
import { useEffect, useMemo, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import type { Rapport, Source } from "../donnees/source";
import { estEnRetard } from "../donnees/modele";
import { chargeParPersonne, grilleHabitudes } from "../donnees/projet";
import { etatsDuJour } from "../donnees/habitudes";
import { ajouterJours } from "../donnees/modele";
import { HabitudesJour } from "./Habitudes";
import { naviguer } from "../navigation/routeur";
import { Bouton, Cartouche, Etat, Surtitre } from "../composants";
import { initiales } from "./Lignes";

export type Espace = "fil" | "chantiers" | "finances" | "corps" | "equipe";
export const ESPACES: { id: Espace; nom: string; touche: string; defaut: string; lettre: string }[] = [
  { id: "fil", nom: "Fil du jour", touche: "j", defaut: "/", lettre: "J" },
  { id: "chantiers", nom: "Chantiers", touche: "c", defaut: "/taches", lettre: "C" },
  { id: "finances", nom: "Finances", touche: "f", defaut: "/finances", lettre: "€" },
  { id: "corps", nom: "Corps", touche: "s", defaut: "/corps", lettre: "♥" },
  { id: "equipe", nom: "Équipe", touche: "e", defaut: "/equipe", lettre: "◎" },
];
// Dernière adresse de chaque espace (Ref #669) : la session en cours d'abord,
// puis nexora:futurPrefs (synchronisée entre appareils), puis l'ancienne
// mémoire locale du lot 4, puis l'adresse par défaut.
const memoire = new Map<Espace, string>();
const ANCIENNE_MEMOIRE = "nexora-futur:espaces";
export function memoriser(espace: Espace, adresse: string) { memoire.set(espace, adresse); }
export function allerEspace(espace: Espace, prefs: Record<string, string> = {}) {
  let ancienne: string | undefined;
  try { const m = JSON.parse(localStorage.getItem(ANCIENNE_MEMOIRE) || "{}"); if (typeof m[espace] === "string") ancienne = m[espace]; } catch { /* absente */ }
  const cible = [memoire.get(espace), prefs[espace], ancienne].find((x) => typeof x === "string" && x.startsWith("/")) || ESPACES.find((e) => e.id === espace)!.defaut;
  const [chemin, q] = cible.split("?");
  naviguer(chemin, new URLSearchParams(q || ""));
}

export function useRapportDuJour(source: Source, jour: string) {
  const [r, setR] = useState<Rapport | null>(null);
  useEffect(() => { let vivant = true; source.rapports?.(jour).then((x) => vivant && setR(x.matin)).catch(() => vivant && setR(null)); return () => { vivant = false; }; }, [source, jour]);
  return r;
}

export function Bande({ actif, d, budget }: { actif: Espace; d: Donnees; budget: Rapport | null }) {
  const retards = useMemo(() => d.taches.filter((t) => estEnRetard(t, d.statuts, d.aujourdhui)).length, [d.taches, d.statuts, d.aujourdhui]);
  const hab = useMemo(() => { const e = etatsDuJour(d.themesHabitudes, d.journalHabitudes, d.nonApplicables, d.aujourdhui); return e.total ? `${e.faites}/${e.total}` : ""; }, [d.themesHabitudes, d.journalHabitudes, d.nonApplicables, d.aujourdhui]);
  const b = budget?.budget as { ok?: boolean; toCategorize?: number } | undefined;
  const signaux: Partial<Record<Espace, string>> = { chantiers: retards ? String(retards) : "", finances: b?.ok && b.toCategorize ? String(b.toCategorize) : "", corps: hab };
  return (
    <nav className="bande" aria-label="Espaces">
      <span className="logo" aria-hidden="true">N</span>
      {ESPACES.map((e) => (
        <a key={e.id} href={e.defaut} className={`bande-el ${actif === e.id ? "actif" : ""}`} aria-current={actif === e.id ? "page" : undefined}
          onClick={(ev) => { ev.preventDefault(); allerEspace(e.id, d.prefs.espaces); }} title={`${e.nom} (g puis ${e.touche})`}>
          <span className="bande-i" aria-hidden="true">{e.lettre}</span><span className="bande-nom">{e.nom}</span>
          {signaux[e.id] && <span className={`bande-n mono ${e.id === "chantiers" ? "crit" : ""}`}>{signaux[e.id]}</span>}
        </a>
      ))}
    </nav>
  );
}

export function NavEspace({ espace }: { espace: Espace }) {
  const LOTS: Record<string, [string, string][]> = {
    finances: [["Synthèse, période libre", "disponible"], ["À catégoriser, transactions", "disponible"], ["Patrimoine", "disponible"], ["Graphiques budget, cumul, flux", "disponible"], ["Devis, factures, Finance PRO", "lecture seule"]],
    corps: [["Habitudes (12 semaines)", "disponible"], ["Cocher les habitudes", "disponible"], ["Sport, santé, photos", "lot 7 · #660"]],
    equipe: [["Charge par personne", "disponible"], ["Charge du personnel, organigramme", "lot 7 · #660"]],
  };
  return (
    <nav className="nav" aria-label={`Navigation ${espace}`}>
      <div className="nav-titre surtitre">{ESPACES.find((e) => e.id === espace)?.nom}</div>
      {(LOTS[espace] || []).map(([n, s]) => <div key={n} className="nav-item nav-statique"><span>{n}</span><span className="nav-n mono">{s}</span></div>)}
    </nav>
  );
}

export function PageEquipe({ d }: { d: Donnees }) {
  const charge = useMemo(() => chargeParPersonne(d.taches, d, d.aujourdhui), [d]);
  const equipe = (nom: string) => { const m = d.membres.find((x) => x.name === nom); return (m?.teamIds || []).map((id) => d.equipes.find((t) => t.id === id)?.name).filter(Boolean).join(", "); };
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Équipe" titre="Charge par personne" meta={<><span>{charge.length} personnes</span><span>{charge.reduce((a, c) => a + c.retards, 0)} retards</span></>} />
      <div className="panneau espace-table" role="table" aria-label="Charge par personne">
        <div role="row" className="et-ligne et-tete surtitre"><span role="columnheader">Personne</span><span role="columnheader">Ouvertes</span><span role="columnheader">En retard</span><span role="columnheader">7 jours</span><span role="columnheader">Prochaine échéance</span></div>
        {charge.map((c) => (
          <a key={c.nom} role="row" className="et-ligne" href={`/taches?r=${encodeURIComponent(c.nom)}`} onClick={(e) => { e.preventDefault(); naviguer("/taches", new URLSearchParams({ r: c.nom })); }}>
            <span role="cell" className="et-nom"><span className="avatar">{initiales(c.nom)}</span>{c.nom}<span className="discret">{equipe(c.nom)}</span></span>
            <span role="cell" className="mono">{c.ouvertes}</span>
            <span role="cell">{c.retards ? <Etat ton="crit" point={false}>{c.retards}</Etat> : <span className="mono discret">0</span>}</span>
            <span role="cell" className="mono">{c.semaine}</span>
            <span role="cell" className="et-proch">{c.prochaine ? <><span className="mono">{c.prochaine.end?.slice(8, 10)}/{c.prochaine.end?.slice(5, 7)}</span> {c.prochaine.title}</> : <span className="discret">—</span>}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function PageCorps({ d }: { d: Donnees }) {
  const [jour, setJour] = useState(d.aujourdhui);
  const grille = useMemo(() => grilleHabitudes(d.themesHabitudes, d.journalHabitudes, d.nonApplicables, d.aujourdhui), [d.themesHabitudes, d.journalHabitudes, d.nonApplicables, d.aujourdhui]);
  const premier = grille[0][0].jour;
  const libelle = jour === d.aujourdhui ? "Aujourd'hui" : jour === ajouterJours(d.aujourdhui, -1) ? "Hier" : new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Corps" titre="Habitudes" meta={<span>12 semaines · un clic sur un jour pour le compléter</span>} />
      <section className="panneau espace-bloc" aria-label="Grille des habitudes">
        <Surtitre>Part des habitudes validées par jour (hors non applicables)</Surtitre>
        <div className="hab-grille">
          {["L", "M", "M", "J", "V", "S", "D"].map((j, k) => <span key={k} className="hab-j mono discret" style={{ gridRow: k + 2 }}>{j}</span>)}
          {grille.map((s, i) => s.map((c, k) => (c.futur
            ? <span key={c.jour} className="hab-c futur" style={{ gridColumn: i + 2, gridRow: k + 2 }} />
            : <button key={c.jour} type="button" className={`hab-c hab-c-btn ${c.jour === jour ? "auj" : ""}`} style={{ gridColumn: i + 2, gridRow: k + 2, opacity: 0.15 + 0.85 * c.part }}
              aria-pressed={c.jour === jour} aria-label={`${c.jour} : ${c.nb} sur ${c.total}`} title={`${c.jour} : ${c.nb}/${c.total}`} onClick={() => setJour(c.jour)} />
          )))}
        </div>
      </section>
      <section className="panneau espace-bloc" aria-label={`Habitudes, ${libelle}`}>
        <div className="corps-jour">
          <Bouton variante="discret" aria-label="Jour précédent" disabled={jour <= premier} onClick={() => setJour(ajouterJours(jour, -1))}>←</Bouton>
          <Surtitre>{libelle}</Surtitre>
          <Bouton variante="discret" aria-label="Jour suivant" disabled={jour >= d.aujourdhui} onClick={() => setJour(ajouterJours(jour, 1))}>→</Bouton>
          {jour !== d.aujourdhui && <Bouton variante="discret" onClick={() => setJour(d.aujourdhui)}>Aujourd'hui</Bouton>}
        </div>
        <HabitudesJour jour={jour} />
      </section>
    </div>
  );
}
