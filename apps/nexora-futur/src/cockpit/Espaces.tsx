// Espaces (Ref #657) : bande de bascule et pages Finances, Corps, Équipe.
import { useEffect, useMemo, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import type { Rapport, Source } from "../donnees/source";
import { estEnRetard } from "../donnees/modele";
import { chargeParPersonne, grilleHabitudes } from "../donnees/projet";
import { habitudesDuJour } from "../donnees/journee";
import { naviguer } from "../navigation/routeur";
import { Cartouche, Etat, Surtitre } from "../composants";
import { initiales } from "./Lignes";

export type Espace = "fil" | "chantiers" | "finances" | "corps" | "equipe";
export const ESPACES: { id: Espace; nom: string; touche: string; defaut: string; lettre: string }[] = [
  { id: "fil", nom: "Fil du jour", touche: "j", defaut: "/", lettre: "J" },
  { id: "chantiers", nom: "Chantiers", touche: "c", defaut: "/taches", lettre: "C" },
  { id: "finances", nom: "Finances", touche: "f", defaut: "/finances", lettre: "€" },
  { id: "corps", nom: "Corps", touche: "s", defaut: "/corps", lettre: "♥" },
  { id: "equipe", nom: "Équipe", touche: "e", defaut: "/equipe", lettre: "◎" },
];
const CLE_MEMOIRE = "nexora-futur:espaces";
export function memoriser(espace: Espace, adresse: string) {
  try { const m = JSON.parse(localStorage.getItem(CLE_MEMOIRE) || "{}"); m[espace] = adresse; localStorage.setItem(CLE_MEMOIRE, JSON.stringify(m)); } catch { /* mémoire de session */ }
}
export function allerEspace(espace: Espace) {
  let cible = ESPACES.find((e) => e.id === espace)!.defaut;
  try { const m = JSON.parse(localStorage.getItem(CLE_MEMOIRE) || "{}"); if (typeof m[espace] === "string" && m[espace].startsWith("/")) cible = m[espace]; } catch { /* défaut */ }
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
  const hab = useMemo(() => { const h = habitudesDuJour(d.themesHabitudes, d.journalHabitudes, d.aujourdhui).flatMap((x) => x.habitudes); return h.length ? `${h.filter((x) => x.fait).length}/${h.length}` : ""; }, [d]);
  const b = budget?.budget as { ok?: boolean; toCategorize?: number } | undefined;
  const signaux: Partial<Record<Espace, string>> = { chantiers: retards ? String(retards) : "", finances: b?.ok && b.toCategorize ? String(b.toCategorize) : "", corps: hab };
  return (
    <nav className="bande" aria-label="Espaces">
      <span className="logo" aria-hidden="true">N</span>
      {ESPACES.map((e) => (
        <a key={e.id} href={e.defaut} className={`bande-el ${actif === e.id ? "actif" : ""}`} aria-current={actif === e.id ? "page" : undefined}
          onClick={(ev) => { ev.preventDefault(); allerEspace(e.id); }} title={`${e.nom} (g puis ${e.touche})`}>
          <span className="bande-i" aria-hidden="true">{e.lettre}</span><span className="bande-nom">{e.nom}</span>
          {signaux[e.id] && <span className={`bande-n mono ${e.id === "chantiers" ? "crit" : ""}`}>{signaux[e.id]}</span>}
        </a>
      ))}
    </nav>
  );
}

export function NavEspace({ espace }: { espace: Espace }) {
  const LOTS: Record<string, [string, string][]> = {
    finances: [["Synthèse du rapport", "disponible"], ["Budget du mois, transactions, patrimoine, flux", "lot 6 · #659"], ["Devis, factures, Finance PRO", "lot 6 · #659"]],
    corps: [["Habitudes (12 semaines)", "disponible"], ["Sport, santé, photos", "lot 7 · #660"], ["Cocher les habitudes", "décision attendue"]],
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
  const grille = useMemo(() => grilleHabitudes(d.themesHabitudes, d.journalHabitudes, d.aujourdhui), [d.themesHabitudes, d.journalHabitudes, d.aujourdhui]);
  const auj = useMemo(() => habitudesDuJour(d.themesHabitudes, d.journalHabitudes, d.aujourdhui), [d]);
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Corps" titre="Habitudes" meta={<span>12 semaines · lecture seule</span>} />
      <section className="panneau espace-bloc" aria-label="Grille des habitudes">
        <Surtitre>Part des habitudes faites par jour</Surtitre>
        <div className="hab-grille">
          {["L", "M", "M", "J", "V", "S", "D"].map((j, k) => <span key={k} className="hab-j mono discret" style={{ gridRow: k + 2 }}>{j}</span>)}
          {grille.map((s, i) => s.map((c, k) => (
            <span key={c.jour} className={`hab-c ${c.futur ? "futur" : ""} ${c.jour === d.aujourdhui ? "auj" : ""}`} style={{ gridColumn: i + 2, gridRow: k + 2, opacity: c.futur ? 1 : 0.15 + 0.85 * c.part }} title={`${c.jour} : ${c.nb} habitude(s)`} />
          )))}
        </div>
      </section>
      <section className="panneau espace-bloc"><Surtitre>Aujourd'hui</Surtitre>
        {auj.map(({ theme, habitudes }) => <div key={theme.id} className="fil-habitudes"><span className="discret">{theme.name}</span>{habitudes.map(({ h, fait, valeur }) => <Etat key={h.id} ton={fait ? "ok" : "neutre"} point={false}>{fait ? "✓ " : ""}{h.name}{valeur !== undefined ? ` · ${valeur}` : ""}</Etat>)}</div>)}
        {!auj.length && <p className="discret">Aucune habitude configurée.</p>}
      </section>
    </div>
  );
}

export function PageFinances({ rapport }: { rapport: Rapport | null }) {
  const b = rapport?.budget as Record<string, unknown> | undefined;
  const euros = (n: unknown) => (typeof n === "number" ? `${Math.round(n).toLocaleString("fr-FR")} €` : "—");
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Finances" titre="Budget du mois" meta={<span>source : rapport de 7 h · détail complet au lot 6</span>} />
      {b?.ok === true ? (
        <section className="panneau espace-bloc">
          <dl className="fil-kv">
            <div><dt>Reste à dépenser</dt><dd className="mono">{euros(b.remaining)}</dd></div>
            <div><dt>Dépenses</dt><dd className="mono">{euros(b.expenses)}</dd></div>
            <div><dt>Revenus</dt><dd className="mono">{euros(b.income)}</dd></div>
            <div><dt>Solde net</dt><dd className="mono">{euros(b.net)}</dd></div>
            <div><dt>Budget</dt><dd className="mono">{euros(b.budget)}</dd></div>
            <div><dt>Opérations à catégoriser</dt><dd className="mono">{String(b.toCategorize ?? "—")}</dd></div>
          </dl>
          {Array.isArray(b.overBudget) && b.overBudget.length > 0 && <><Surtitre>Catégories dépassées</Surtitre>{(b.overBudget as { category?: string; budget?: number; actual?: number }[]).map((c, i) => <div key={i} className="pp-ligne"><Etat ton="crit" point={false}>dépassé</Etat><span>{c.category}</span><span className="mono discret">{euros(c.actual)} / {euros(c.budget)}</span></div>)}</>}
          {Array.isArray(b.nearBudget) && b.nearBudget.length > 0 && <><Surtitre>Proches du budget</Surtitre>{(b.nearBudget as { category?: string; budget?: number; actual?: number }[]).map((c, i) => <div key={i} className="pp-ligne"><Etat ton="alerte" point={false}>≥ 90 %</Etat><span>{c.category}</span><span className="mono discret">{euros(c.actual)} / {euros(c.budget)}</span></div>)}</>}
        </section>
      ) : <section className="panneau espace-bloc"><p className="discret">Pas de rapport du matin aujourd'hui, ou budget indisponible dans ce rapport. Les widgets Budget complets arrivent au lot 6 (#659).</p></section>}
    </div>
  );
}
