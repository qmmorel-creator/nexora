// Guide de démarrage (Ref #663), à la manière du README de nexora-project :
// montré à la première visite (prefs.guideVu), puis par la palette.
import { useEffect } from "react";
import { Bouton, Kbd } from "../composants";

const SECTIONS: [string, string][] = [
  ["Fil du jour", "L'accueil : la journée sur un cadran de 24 h, vos habitudes en « pixel du jour », le briefing du matin et le bilan du soir. Glissez une tâche « À caser » sur une heure du cadran pour la planifier."],
  ["Cockpit des tâches", "Toutes les tâches, avec des lentilles : Liste, Colonnes, Frise, Agenda, Tableur, Densité, Synthèse (touches 1 à 8). La fiche s'ouvre à droite."],
  ["Triage", "Une décision à la fois : retards sans activité, tâches à dater ou à ranger, réunions sans compte rendu, habitudes manquées. Touches A, R, S, U."],
  ["Phrase", "Posez une question en phrase, changez un mot souligné, enregistrez la vue (S) ou épinglez-la (E)."],
  ["Espaces", "Chantiers (projets), Finances, Corps (habitudes, sport, santé, photos), Équipe (charge, organigramme). Accès par la bande de gauche ou g puis une lettre."],
  ["Réglages", "Projets, statuts, types, modèles, habitudes, équipe, ateliers, méta-filtres, objectifs sport, données et sauvegarde."],
  ["Données partagées", "Futur lit et écrit les mêmes données que Nexora actuel. Chaque écriture vérifie la version lue et rejoue seulement votre modification en cas de conflit : rien n'est écrasé. Finances, devis et factures restent en lecture."],
];

export function Guide({ onFermer }: { onFermer: () => void }) {
  useEffect(() => {
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onFermer(); } };
    window.addEventListener("keydown", echap, true);
    return () => window.removeEventListener("keydown", echap, true);
  }, [onFermer]);
  return (
    <div className="guide-fond" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-titre">
        <h2 id="guide-titre">Bienvenue dans Nexora Futur</h2>
        <p className="discret">L'essentiel en une minute. Tout se retrouve avec <Kbd>⌘K</Kbd> (ou Ctrl K) ; <Kbd>?</Kbd> affiche les raccourcis.</p>
        <ol className="guide-liste">{SECTIONS.map(([t, x]) => <li key={t}><b>{t}</b><span>{x}</span></li>)}</ol>
        <div className="guide-pied"><Bouton variante="principal" autoFocus onClick={onFermer}>C'est parti</Bouton><span className="discret">Le guide reste dans la palette : « Guide de démarrage ».</span></div>
      </div>
    </div>
  );
}
