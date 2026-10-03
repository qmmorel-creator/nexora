// Espaces (Ref #657) : bande de bascule et navigation des espaces. Les pages
// Corps et Équipe vivent dans Corps.tsx et Equipe.tsx (Ref #660).
import { useEffect, useMemo, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import type { Rapport, Source } from "../donnees/source";
import { estEnRetard } from "../donnees/modele";
import { etatsDuJour } from "../donnees/habitudes";
import { naviguer } from "../navigation/routeur";

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
    corps: [["Le pixel du jour, heat map", "disponible"], ["Sport, objectifs, calendrier", "objectifs modifiables"], ["Santé, santé × sport", "lecture seule"], ["Photos avant / après", "comparaison"]],
    equipe: [["Charge par personne", "disponible"], ["Charge du personnel", "saisie"], ["Organigramme, fiche personne", "disponible"]],
  };
  return (
    <nav className="nav" aria-label={`Navigation ${espace}`}>
      <div className="nav-titre surtitre">{ESPACES.find((e) => e.id === espace)?.nom}</div>
      {(LOTS[espace] || []).map(([n, s]) => <div key={n} className="nav-item nav-statique"><span>{n}</span><span className="nav-n mono">{s}</span></div>)}
    </nav>
  );
}
