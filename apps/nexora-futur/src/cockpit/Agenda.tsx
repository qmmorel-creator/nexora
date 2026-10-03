// Lentille Agenda (Ref #658) : grille continue de semaines (tâches ouvertes,
// multi-jours en bandeaux) et frise horaire du jour choisi (toutes les tâches,
// terminées comprises). Port de CalendarBoard / CalendarDayTimeline.
import { useEffect, useMemo, useRef, useState } from "react";
import { ajouterJours, estEnRetard, type Catalogues, type Tache } from "../donnees/modele";
import { colonnesHoraires, journeeAgenda, libelleMinutes, lundiDe, minutesDe, semaineAgenda } from "../donnees/planning";
import { heureParis } from "../donnees/journee";
import { Bouton, Surtitre } from "../composants";

interface Props { taches: Tache[]; cat: Catalogues; aujourdhui: string; selection?: string; onSelect: (id: string) => void; onOuvrir: (id: string) => void; }

const JOURS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const LIGNES = 4;
const HAUTEUR_HEURE = 44;
const dateLongue = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const duree = (m: number) => { const h = Math.floor(m / 60); const r = m % 60; return h ? `${h} h${r ? ` ${String(r).padStart(2, "0")}` : ""}` : `${r} min`; };

export function Agenda({ taches, cat, aujourdhui, selection, onSelect, onOuvrir }: Props) {
  const [debut, setDebut] = useState(() => ajouterJours(lundiDe(aujourdhui), -7));
  const [semaines, setSemaines] = useState(10);
  const [jour, setJour] = useState(aujourdhui);
  const frise = useRef<HTMLDivElement>(null);
  const lundis = useMemo(() => Array.from({ length: semaines }, (_, i) => ajouterJours(debut, i * 7)), [debut, semaines]);
  const grilles = useMemo(() => lundis.map((l) => semaineAgenda(taches, cat.statuts, l, LIGNES)), [lundis, taches, cat.statuts]);
  const j = useMemo(() => journeeAgenda(taches, cat.statuts, jour), [taches, cat.statuts, jour]);
  const couleur = (t: Tache) => cat.projets.find((p) => p.id === t.projectId)?.color || "var(--encre3)";
  // La frise horaire s'ouvre sur 7 h, ou sur la première tâche si plus tôt.
  useEffect(() => { const premier = j.horaires[0]?.debut; frise.current?.scrollTo({ top: Math.max(0, Math.min(premier ?? 420, 420) / 60 - 0.5) * HAUTEUR_HEURE }); }, [jour]); // eslint-disable-line react-hooks/exhaustive-deps

  const element = (t: Tache) => (
    <button key={t.id} type="button" data-id={t.id} className={`ag-el ${selection === t.id ? "sel" : ""} ${estEnRetard(t, cat.statuts, aujourdhui) ? "retard" : ""}`} style={{ ["--c" as string]: couleur(t) }}
      onClick={(e) => { e.stopPropagation(); onSelect(t.id); }} onDoubleClick={(e) => { e.stopPropagation(); onOuvrir(t.id); }}>
      {minutesDe(t.startTime) != null && <span className="mono">{t.startTime}</span>} {t.milestone ? "◆ " : ""}{t.title || "Sans titre"}
    </button>
  );

  return (
    <div className="agenda">
      <section className="ag-grille" aria-label="Semaines">
        <div className="fr-outils">
          <Bouton variante="discret" onClick={() => setDebut(ajouterJours(debut, -28))}>4 semaines plus tôt</Bouton>
          <Bouton variante="discret" onClick={() => { setDebut(ajouterJours(lundiDe(aujourdhui), -7)); setSemaines(10); setJour(aujourdhui); }}>Aujourd'hui</Bouton>
          <span className="marge-auto mono discret">tâches ouvertes · un clic sur un jour ouvre sa frise</span>
        </div>
        <div className="ag-entete" aria-hidden="true">{JOURS.map((x) => <span key={x} className="surtitre">{x}</span>)}</div>
        {grilles.map((g) => {
          const nouveauMois = g.jours.find((d) => d.date.slice(8) === "01");
          return (
            <div key={g.lundi} className="ag-semaine" style={{ ["--pistes" as string]: g.pistes }}>
              {(nouveauMois || g.lundi === lundis[0]) && <div className="ag-mois surtitre">{MOIS[+(nouveauMois?.date || g.lundi).slice(5, 7) - 1]} {(nouveauMois?.date || g.lundi).slice(0, 4)}</div>}
              <div className="ag-jours">
                {g.jours.map((d, i) => (
                  <div key={d.date} role="button" tabIndex={0} aria-pressed={d.date === jour} aria-label={`${dateLongue(d.date)}, ${d.total} tâche(s)`}
                    className={`ag-case ${d.date === aujourdhui ? "auj" : ""} ${d.date === jour ? "choisi" : ""} ${i >= 5 ? "we" : ""}`}
                    onClick={() => setJour(d.date)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setJour(d.date); } }}>
                    <span className="ag-num mono">{+d.date.slice(8)}</span>
                    <div className="ag-liste">{d.taches.map(element)}</div>
                    {d.masquees > 0 && <span className="ag-plus mono">+{d.masquees}</span>}
                  </div>
                ))}
                {g.bandeaux.map((b) => (
                  <button key={b.t.id} type="button" data-id={b.t.id} className={`ag-bandeau ${selection === b.t.id ? "sel" : ""} ${b.coupeDebut ? "coupe-g" : ""} ${b.coupeFin ? "coupe-d" : ""}`}
                    style={{ gridColumn: `${b.col0 + 1} / ${b.col1 + 2}`, ["--piste" as string]: b.piste, ["--c" as string]: couleur(b.t) }}
                    onClick={() => onSelect(b.t.id)} onDoubleClick={() => onOuvrir(b.t.id)}>{b.t.title || "Sans titre"}</button>
                ))}
              </div>
            </div>
          );
        })}
        <Bouton variante="discret" onClick={() => setSemaines((n) => n + 8)}>8 semaines de plus</Bouton>
      </section>

      <section className="ag-jour panneau" aria-label={`Frise du ${dateLongue(jour)}`}>
        <div className="ag-jour-tete">
          <Bouton variante="discret" aria-label="Jour précédent" onClick={() => setJour(ajouterJours(jour, -1))}>←</Bouton>
          <div><Surtitre>{jour === aujourdhui ? "Aujourd'hui" : "Journée"}</Surtitre><strong className="ag-date">{dateLongue(jour)}</strong></div>
          <Bouton variante="discret" aria-label="Jour suivant" onClick={() => setJour(ajouterJours(jour, 1))}>→</Bouton>
        </div>
        <p className="mono discret">{j.total} tâche(s) · {j.finies} terminée(s) · {duree(j.minutesPlanifiees)} planifiées</p>
        {j.journee.length > 0 && <div className="ag-journee"><Surtitre>Sur la journée</Surtitre>{j.journee.map(({ t, fini }) => <div key={t.id} className={fini ? "finie" : ""}>{element(t)}</div>)}</div>}
        <div className="ag-heures" ref={frise}>
          <div className="ag-heures-in" style={{ height: 24 * HAUTEUR_HEURE }}>
            {Array.from({ length: 24 }, (_, h) => <span key={h} className="ag-h mono" style={{ top: h * HAUTEUR_HEURE }}>{String(h).padStart(2, "0")}:00</span>)}
            {jour === aujourdhui && <span className="ag-maintenant" style={{ top: (heureParis() / 60) * HAUTEUR_HEURE }} aria-hidden="true" />}
            {colonnesHoraires(j.horaires).map(({ t, fini, debut: a, fin: b, colonne, colonnes }) => (
              <button key={t.id} type="button" data-id={t.id} className={`ag-bloc ${fini ? "finie" : ""} ${selection === t.id ? "sel" : ""}`} style={{ top: (a / 60) * HAUTEUR_HEURE, height: Math.max(18, ((b - a) / 60) * HAUTEUR_HEURE - 2), left: `calc(48px + (100% - 52px) * ${colonne / colonnes})`, width: `calc((100% - 52px) / ${colonnes} - 2px)`, ["--c" as string]: couleur(t) }}
                onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)} aria-label={`${libelleMinutes(a)}–${libelleMinutes(b)} ${t.title}`}>
                <span className="mono">{libelleMinutes(a)}–{libelleMinutes(b)}</span> {t.title}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
