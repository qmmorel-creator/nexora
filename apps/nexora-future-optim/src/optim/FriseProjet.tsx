// Frise · 12 semaines de la page projet (Ref #710), reprise de Nexora Futur
// (PageProjet, section « frise ») : fenêtre J−28 → J+56 calculée par
// friseProjet (src/donnees/projet.ts, identique à Futur). 13 graduations
// hebdomadaires, trait d'aujourd'hui, une barre par tâche à la couleur du projet,
// jalons en losange, terminées à demi-opacité, retards sur fond rouge pâle.
import { useMemo } from "react";
import { ecartJours, estTerminee } from "../donnees/modele";
import { friseProjet } from "../donnees/projet";
import { useOptim, useUi } from "./contexte";

const court = (iso?: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
const plusJours = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

export function FriseProjet({ projetId, couleur }: { projetId: string; couleur: string }) {
  const { d, jour } = useOptim();
  const { ouvrir } = useUi();
  const frise = useMemo(() => friseProjet(d.taches, projetId, d, jour), [d, projetId, jour]);
  return (
    <section className="hx-tile ox-fp" aria-label="Frise sur 12 semaines">
      <header className="hx-th"><h2>12 semaines <small>du {court(frise.debut)} au {court(plusJours(frise.debut, frise.jours - 1))}</small></h2></header>
      <div className="ox-fp-zone" style={{ height: Math.max(60, frise.barres.length * 22 + 26) }}>
        {Array.from({ length: 13 }, (_, i) => <div key={i} className="ox-fp-sem" style={{ left: `${(i * 7 / frise.jours) * 100}%` }}><span>{court(plusJours(frise.debut, i * 7))}</span></div>)}
        <div className="ox-fp-auj" style={{ left: `${(frise.auj / frise.jours) * 100}%` }} title="Aujourd'hui" />
        {frise.barres.map((b, i) => {
          const fini = estTerminee(b.t, d.statuts), jalon = !!b.t.milestone;
          return (
            <button key={b.t.id} type="button" className={`ox-fp-b ${jalon ? "is-jalon" : ""} ${b.retard ? "is-retard" : ""} ${fini ? "is-fini" : ""}`} onClick={() => ouvrir(b.t.id)} title={`${b.t.title} · ${court(b.t.start)} → ${court(b.t.end)}`}
              style={{ top: 24 + i * 22, left: `${(b.debut / frise.jours) * 100}%`, width: jalon ? undefined : `${(Math.max(1, b.fin - b.debut) / frise.jours) * 100}%`, ["--c" as string]: couleur }}>
              <span>{jalon ? "◆ " : ""}{b.t.title}{b.retard && b.t.end ? ` · retard ${ecartJours(b.t.end, jour)} j` : ""}</span>
            </button>
          );
        })}
        {!frise.barres.length && <p className="hx-dim ox-fp-vide">Aucune tâche datée dans la fenêtre.</p>}
      </div>
    </section>
  );
}
