// Lentille Densité (Ref #658) : heat map mensuelle, heat map croisée et Pixel
// Tasks, sur les tâches de la requête. Un clic ouvre la liste des tâches de la
// case ; un clic sur une tâche ouvre sa fiche.
import { useMemo, useState } from "react";
import { estEnRetard, estTerminee, type Catalogues, type Tache } from "../donnees/modele";
import type { ChampGroupe } from "../donnees/requete";
import { AXES_CROISES, MESURES_CROISEES, densiteMois, fondConique, grilleCroisee, pixels, type AxeCroise, type MesureCroisee, type VuePixels } from "../donnees/suivi";
import type { PrefsDensite } from "../donnees/prefs";
import { Bouton, Segment, Surtitre } from "../composants";

interface Props {
  taches: Tache[]; cat: Catalogues; aujourdhui: string; groupe: ChampGroupe; selection?: string;
  prefs: PrefsDensite; setPrefs: (p: PrefsDensite) => void; onSelect: (id: string) => void; onOuvrir: (id: string) => void;
}
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisPlus = (m: string, n: number) => { const [a, b] = m.split("-").map(Number); const t = a * 12 + b - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
const court = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function Densite({ taches, cat, aujourdhui, groupe, selection, prefs, setPrefs, onSelect, onOuvrir }: Props) {
  const [premierMois, setPremierMois] = useState(() => moisPlus(aujourdhui.slice(0, 7), -1));
  const [choix, setChoix] = useState<{ titre: string; taches: Tache[] } | null>(null);
  const mois = useMemo(() => (prefs.mode === "mois" ? densiteMois(taches, cat, premierMois, aujourdhui) : []), [prefs.mode, taches, cat, premierMois, aujourdhui]);
  const croisee = useMemo(() => (prefs.mode === "croisee" ? grilleCroisee(taches, cat, aujourdhui, prefs.lignes as AxeCroise, prefs.colonnes as AxeCroise, prefs.mesure as MesureCroisee) : null), [prefs, taches, cat, aujourdhui]);
  const px = useMemo(() => (prefs.mode === "pixels" ? pixels(taches, cat, aujourdhui, prefs.vue as VuePixels, groupe === "aucun" ? "project" : groupe) : null), [prefs, taches, cat, aujourdhui, groupe]);
  const couleur = (t: Tache) => cat.projets.find((p) => p.id === t.projectId)?.color || "var(--encre3)";
  const lien = (t: Tache) => (
    <button key={t.id} type="button" data-id={t.id} className={`ag-el ${selection === t.id ? "sel" : ""} ${estEnRetard(t, cat.statuts, aujourdhui) ? "retard" : ""}`} style={{ ["--c" as string]: couleur(t) }}
      onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)}>{t.milestone ? "◆ " : ""}{t.title || "Sans titre"} <span className="mono discret">{t.end ? court(t.end) : ""}</span></button>
  );
  const pourcentage = prefs.mesure === "progress" || prefs.mesure === "criticality";

  return (
    <div className="densite">
      <div className="fr-outils">
        <Segment etiquette="Mode de densité" valeur={prefs.mode} onChange={(mode) => { setChoix(null); setPrefs({ ...prefs, mode }); }}
          options={[{ valeur: "mois", libelle: "Mois" }, { valeur: "croisee", libelle: "Croisée" }, { valeur: "pixels", libelle: "Pixels" }]} />
        {prefs.mode === "mois" && <>
          <span className="marge-auto" />
          <Bouton variante="discret" aria-label="Mois précédents" onClick={() => setPremierMois(moisPlus(premierMois, -1))}>←</Bouton>
          <Bouton variante="discret" onClick={() => setPremierMois(moisPlus(aujourdhui.slice(0, 7), -1))}>Aujourd'hui</Bouton>
          <Bouton variante="discret" aria-label="Mois suivants" onClick={() => setPremierMois(moisPlus(premierMois, 1))}>→</Bouton>
        </>}
        {prefs.mode === "croisee" && <>
          <label className="insp-case">Lignes <select aria-label="Lignes" value={prefs.lignes} onChange={(e) => setPrefs({ ...prefs, lignes: e.target.value, colonnes: e.target.value === prefs.colonnes ? prefs.lignes : prefs.colonnes })}>{AXES_CROISES.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}</select></label>
          <label className="insp-case">Colonnes <select aria-label="Colonnes" value={prefs.colonnes} onChange={(e) => setPrefs({ ...prefs, colonnes: e.target.value, lignes: e.target.value === prefs.lignes ? prefs.colonnes : prefs.lignes })}>{AXES_CROISES.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}</select></label>
          <label className="insp-case">Mesure <select aria-label="Mesure" value={prefs.mesure} onChange={(e) => setPrefs({ ...prefs, mesure: e.target.value })}>{MESURES_CROISEES.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}</select></label>
        </>}
        {prefs.mode === "pixels" && <>
          <Segment etiquette="Période des pixels" valeur={prefs.vue} onChange={(vue) => setPrefs({ ...prefs, vue })} options={[{ valeur: "jour", libelle: "Jours" }, { valeur: "semaine", libelle: "Semaines" }, { valeur: "mois", libelle: "Mois" }]} />
          <span className="marge-auto mono discret">1 tâche = 1 pixel · regroupé comme la requête · score {px?.score ?? 0} % terminées</span>
        </>}
      </div>

      <div className="de-corps">
        <div className="de-vue">
          {prefs.mode === "mois" && (
            <div className="de-mois" aria-label="Heat map mensuelle">
              {mois.map((m) => (
                <section key={m.mois} className="de-un-mois panneau" aria-label={`${MOIS[+m.mois.slice(5) - 1]} ${m.mois.slice(0, 4)}`}>
                  <Surtitre>{MOIS[+m.mois.slice(5) - 1]} {m.mois.slice(0, 4)}</Surtitre>
                  <div className="de-jours">
                    {["L", "M", "M", "J", "V", "S", "D"].map((x, i) => <span key={i} className="mono discret de-entete">{x}</span>)}
                    {Array.from({ length: m.decalage }, (_, i) => <span key={`v${i}`} />)}
                    {m.jours.map((j) => (
                      <button key={j.date} type="button" className={`de-jour ${j.retard ? "retard" : ""} ${j.date === aujourdhui ? "auj" : ""} ${j.taches.length ? "plein" : ""}`}
                        style={{ background: j.taches.length ? fondConique(j.couleurs) : undefined }} aria-label={`${j.date} : ${j.taches.length} tâche(s)${j.retard ? ", retard" : ""}`}
                        disabled={!j.taches.length} onClick={() => setChoix({ titre: `Échéances du ${court(j.date)}`, taches: j.taches })}>
                        <span className="mono">{+j.date.slice(8)}</span>{j.taches.length > 1 && <span className="de-n mono">{j.taches.length}</span>}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
          {croisee && (croisee.lignes.length ? (
            <div className="tb-defil">
              <table className="tb de-croisee" aria-label="Heat map croisée">
                <thead><tr><th>{AXES_CROISES.find((a) => a.id === prefs.lignes)?.libelle} × {AXES_CROISES.find((a) => a.id === prefs.colonnes)?.libelle}</th>{croisee.colonnes.map((c) => <th key={c.id}>{c.libelle}</th>)}</tr></thead>
                <tbody>
                  {croisee.lignes.map((l) => (
                    <tr key={l.id}><th>{l.libelle}</th>
                      {croisee.colonnes.map((c) => {
                        const x = croisee.cellule(l.id, c.id);
                        if (!x) return <td key={c.id} className="de-vide" />;
                        const f = Math.min(1, x.valeur / croisee.max);
                        return <td key={c.id}><button type="button" className="de-case mono" style={{ ["--f" as string]: `${Math.round(8 + f * 72)}%` }} aria-label={`${l.libelle} × ${c.libelle} : ${x.valeur}${pourcentage ? " %" : ""}`}
                          onClick={() => setChoix({ titre: `${l.libelle} × ${c.libelle}`, taches: x.taches })}>{x.valeur}{pourcentage ? " %" : ""}</button></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="vide"><p>Aucune tâche à croiser.</p></div>)}
          {px && (
            <div className="tb-defil">
              <table className="tb de-pixels" aria-label="Pixel Tasks">
                <thead><tr><th />{px.colonnes.map((c) => <th key={c} className={c === px.courante ? "auj" : ""}>{prefs.vue === "mois" ? `${MOIS[+c.slice(5, 7) - 1].slice(0, 4)}.` : court(c)}</th>)}</tr></thead>
                <tbody>
                  {px.lignes.map((l) => (
                    <tr key={l.cle}><th>{l.couleur && <span className="point" style={{ background: l.couleur }} />}{l.libelle}</th>
                      {l.cases.map((c) => (
                        <td key={c.debut} className={c.debut === px.courante ? "auj" : ""}>
                          <div className="de-px">{c.taches.map((t) => (
                            <button key={t.id} type="button" className={`de-pixel ${estTerminee(t, cat.statuts) ? "fini" : estEnRetard(t, cat.statuts, aujourdhui) ? "retard" : ""} ${selection === t.id ? "sel" : ""}`}
                              aria-label={`${t.title}${estTerminee(t, cat.statuts) ? ", terminée" : estEnRetard(t, cat.statuts, aujourdhui) ? ", en retard" : ""}`} title={t.title} onClick={() => onSelect(t.id)} onDoubleClick={() => onOuvrir(t.id)} />
                          ))}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="discret de-legende"><span className="de-pixel fini" /> terminée · <span className="de-pixel" /> ouverte · <span className="de-pixel retard" /> en retard (reportée sur la période en cours)</p>
            </div>
          )}
        </div>
        {choix && (
          <aside className="panneau de-choix" aria-label={choix.titre}>
            <div className="ag-jour-tete"><div><Surtitre>{choix.taches.length} tâche(s)</Surtitre><strong>{choix.titre}</strong></div><Bouton variante="discret" aria-label="Fermer la liste" onClick={() => setChoix(null)}>×</Bouton></div>
            <div className="ag-journee">{choix.taches.map(lien)}</div>
          </aside>
        )}
      </div>
    </div>
  );
}
