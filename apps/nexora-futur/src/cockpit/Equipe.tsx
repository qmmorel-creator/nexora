// Espace Équipe (Ref #660, lot 7) : charge par personne, charge du personnel
// (affectations par jour), organigramme et fiche personne. LECTURE SEULE
// (décision de Quentin, 2026-10-03) : affectations, ateliers, équipes et
// fiches se modifient dans nexora-project.
import { useMemo, useState } from "react";
import type { Donnees } from "../donnees/magasin";
import { estEnRetard, estTerminee } from "../donnees/modele";
import { chargeParPersonne } from "../donnees/projet";
import {
  arbreOrganisation, capacite, chargeMembre, codeAtelier, compteJour, couleurPersonne, equipesDe, fenetre, idCase, joursGrille, liensTransverses, normaliserEquipes, parCase,
  personnesGrille, planDeCharge, posteDans, remplissage, tachesActives, tachesDuJour, totauxAteliers, type MembreEquipe, type Noeud, type Plage,
} from "../donnees/equipe";
import { naviguer } from "../navigation/routeur";
import { Bouton, Cartouche, Etat, Segment, Surtitre } from "../composants";
import { initiales } from "./Lignes";

type Onglet = "charge" | "personnel" | "organigramme";

export function PageEquipe({ d }: { d: Donnees }) {
  const [onglet, setOnglet] = useState<Onglet>("charge");
  const [fiche, setFiche] = useState<string | null>(null);
  const titres: Record<Onglet, string> = { charge: "Charge par personne", personnel: "Charge du personnel", organigramme: "Organigramme" };
  return (
    <div className="espace">
      <Cartouche surtitre="Espace Équipe" titre={titres[onglet]} actions={
        <Segment etiquette="Rubrique" valeur={onglet} onChange={setOnglet} options={[{ valeur: "charge", libelle: "Charge par personne" }, { valeur: "personnel", libelle: "Charge du personnel" }, { valeur: "organigramme", libelle: "Organigramme" }]} />
      } />
      <div className={`eq-zone ${fiche ? "avec-fiche" : ""}`}>
        <div className="eq-principal">
          {onglet === "charge" && <ChargeParPersonne d={d} ouvrir={setFiche} />}
          {onglet === "personnel" && <ChargePersonnel d={d} ouvrir={setFiche} />}
          {onglet === "organigramme" && <Organigramme d={d} ouvrir={setFiche} />}
        </div>
        {fiche && <FichePersonne d={d} nom={fiche} fermer={() => setFiche(null)} />}
      </div>
    </div>
  );
}

const Avatar = ({ nom, couleur }: { nom: string; couleur?: string }) => <span className="avatar" style={couleur ? { background: couleur, color: "#fff" } : undefined}>{initiales(nom)}</span>;

function ChargeParPersonne({ d, ouvrir }: { d: Donnees; ouvrir: (n: string) => void }) {
  const charge = useMemo(() => chargeParPersonne(d.taches, d, d.aujourdhui), [d]);
  const equipe = (nom: string) => equipesDe(d.membresEquipe.find((x) => x.name === nom)).map((id) => d.equipes.find((t) => t.id === id)?.name).filter(Boolean).join(", ");
  return (
    <div className="panneau espace-table" role="table" aria-label="Charge par personne">
      <div role="row" className="et-ligne et-tete surtitre"><span role="columnheader">Personne</span><span role="columnheader">Ouvertes</span><span role="columnheader">En retard</span><span role="columnheader">7 jours</span><span role="columnheader">Prochaine échéance</span></div>
      {charge.map((c) => (
        <div key={c.nom} role="row" className="et-ligne">
          <span role="cell" className="et-nom"><button type="button" className="eq-lien" onClick={() => ouvrir(c.nom)}><Avatar nom={c.nom} />{c.nom}</button><span className="discret">{equipe(c.nom)}</span></span>
          <span role="cell" className="mono"><a href={`/taches?r=${encodeURIComponent(c.nom)}`} onClick={(e) => { e.preventDefault(); naviguer("/taches", new URLSearchParams({ r: c.nom })); }}>{c.ouvertes}</a></span>
          <span role="cell">{c.retards ? <Etat ton="crit" point={false}>{c.retards}</Etat> : <span className="mono discret">0</span>}</span>
          <span role="cell" className="mono">{c.semaine}</span>
          <span role="cell" className="et-proch">{c.prochaine ? <><span className="mono">{c.prochaine.end?.slice(8, 10)}/{c.prochaine.end?.slice(5, 7)}</span> {c.prochaine.title}</> : <span className="discret">—</span>}</span>
        </div>
      ))}
    </div>
  );
}

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];
function ChargePersonnel({ d, ouvrir }: { d: Donnees; ouvrir: (n: string) => void }) {
  const [plage, setPlage] = useState<Plage>("twoWeeks");
  const [decalage, setDecalage] = useState(0);
  const [weekEnds, setWeekEnds] = useState(true);
  const [taches, setTaches] = useState(false);
  const f = fenetre(plage, decalage, d.aujourdhui);
  const jours = joursGrille(f, d.aujourdhui, weekEnds);
  const cases = useMemo(() => parCase(d.affectations), [d.affectations]);
  const personnes = useMemo(() => personnesGrille(d.membresEquipe, d.affectations), [d.membresEquipe, d.affectations]);
  const index = useMemo(() => tachesActives(d.taches, d.statuts), [d.taches, d.statuts]);
  const totaux = totauxAteliers(cases, personnes, jours);
  const taille = plage === "month" ? 26 : plage === "twoWeeks" ? 44 : 84;
  const libelle = plage === "month" ? new Date(`${f.start}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }) : `${f.start.slice(8, 10)}/${f.start.slice(5, 7)} – ${f.end.slice(8, 10)}/${f.end.slice(5, 7)}`;
  return (
    <section className="panneau sy-bloc" aria-label="Charge du personnel">
      <div className="sy-tete">
        <Segment etiquette="Plage" valeur={plage} onChange={(v) => { setPlage(v); setDecalage(0); }} options={[{ valeur: "week", libelle: "Semaine" }, { valeur: "twoWeeks", libelle: "2 semaines" }, { valeur: "month", libelle: "Mois" }]} />
        <Bouton variante="discret" aria-label="Période précédente" onClick={() => setDecalage((x) => Math.max(-24, x - 1))}>‹</Bouton>
        <strong>{libelle}</strong>
        <Bouton variante="discret" aria-label="Période suivante" onClick={() => setDecalage((x) => Math.min(24, x + 1))}>›</Bouton>
        {decalage !== 0 && <Bouton variante="discret" onClick={() => setDecalage(0)}>Aujourd'hui</Bouton>}
        <span className="marge-auto" />
        <label className="eq-opt"><input type="checkbox" checked={weekEnds} onChange={(e) => setWeekEnds(e.target.checked)} /> Week-ends</label>
        <label className="eq-opt"><input type="checkbox" checked={taches} onChange={(e) => setTaches(e.target.checked)} /> Tâches du jour</label>
      </div>
      <p className="discret">Lecture seule : les affectations se posent dans nexora-project (widget Charge personnel).</p>
      <div className="eq-defile">
        <table className="eq-grille" style={{ ["--case" as string]: `${taille}px` }} aria-label="Affectations par personne et par jour">
          <thead><tr><th className="eq-pers">Personne</th>{jours.map((j) => <th key={j.iso} className={`${j.weekend ? "we" : ""} ${j.today ? "auj" : ""}`} title={j.iso}><span className="mono">{JOURS_COURTS[j.dow]}</span><b className="mono">{j.num}</b></th>)}<th className="eq-postes">Postes</th></tr></thead>
          <tbody>
            {personnes.map((nom) => {
              const m = d.membresEquipe.find((x) => x.name === nom); const cap = capacite(m?.capacityPerDay); const charge = chargeMembre(cases, nom, jours);
              return (
                <tr key={nom}>
                  <th className="eq-pers"><button type="button" className="eq-lien" onClick={() => ouvrir(nom)}><Avatar nom={nom} couleur={m ? undefined : couleurPersonne(nom)} />{nom}</button></th>
                  {jours.map((j) => {
                    const ids = cases.get(idCase(nom, j.iso)) || []; const r = remplissage(ids, d.ateliers); const t = tachesDuJour(index, nom, j.iso);
                    const depasse = ids.length + t.length > cap;
                    const lib = r?.single ? (taille >= 62 ? r.single.name : taille >= 22 ? codeAtelier(r.single.name) : "") : "";
                    return (
                      <td key={j.iso} className={`${j.weekend ? "we" : ""} ${j.today ? "auj" : ""}`}>
                        <span className={`eq-case ${r ? "pleine" : ""} ${depasse && (ids.length || t.length) ? "depasse" : ""}`} style={{ background: r?.background }}
                          title={`${nom}, ${j.iso} : ${r ? r.shops.map((w) => w.name).join(", ") : "aucun poste"}${t.length ? ` · ${t.length} tâche${t.length > 1 ? "s" : ""} active${t.length > 1 ? "s" : ""}` : ""}${depasse ? ` · au-delà de la capacité (${cap})` : ""}`}>
                          {lib}{taches && t.length > 0 && <i className="eq-nt mono">{t.length}</i>}
                        </span>
                      </td>
                    );
                  })}
                  <td className="eq-postes"><span className="mono">{charge}</span><span className="eq-barre"><i style={{ width: `${Math.min(100, (charge / Math.max(1, jours.length * 1.4)) * 100)}%` }} /></span></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><th className="eq-pers surtitre">Présents</th>{jours.map((j) => <td key={j.iso} className="mono discret">{compteJour(cases, personnes, j.iso) || ""}</td>)}<td /></tr></tfoot>
        </table>
      </div>
      <div className="co-leg">{d.ateliers.map((w) => <span key={w.id}><span className="hp-dot" style={{ background: w.color }} />{w.name} <span className="mono discret">{totaux.get(w.id) || 0} j</span></span>)}<span className="discret"><span className="eq-case depasse mini" /> au-delà de la capacité</span></div>
    </section>
  );
}

function Organigramme({ d, ouvrir }: { d: Donnees; ouvrir: (n: string) => void }) {
  const racines = useMemo(() => arbreOrganisation(d.equipesBrutes, d.membresEquipe), [d.equipesBrutes, d.membresEquipe]);
  const liens = useMemo(() => liensTransverses(d.equipesBrutes), [d.equipesBrutes]);
  const charge = useMemo(() => new Map(chargeParPersonne(d.taches, d, d.aujourdhui).map((c) => [c.nom, c])), [d]);
  const rendre = (n: Noeud, k: number): JSX.Element => (
    <li key={k}>
      {n.type === "equipe" ? (
        <div className="og-eq" style={{ ["--c" as string]: n.equipe?.color || "var(--encre3)" }}>
          <b>{n.equipe ? n.equipe.name : "Sans équipe"}</b>
          {n.responsable && <span className="discret">{n.equipe?.leadTitle || "Responsable"} : {n.responsable.name}</span>}
          {liens.filter((l) => l.de.id === n.equipe?.id).map((l) => <span key={l.vers.id} className="og-trans">↔ lien transverse avec {l.vers.name}</span>)}
        </div>
      ) : (
        <button type="button" className={`og-pers ${n.doublon ? "doublon" : ""}`} onClick={() => ouvrir(n.membre.name)}>
          <Avatar nom={n.membre.name} />
          <span><b>{n.membre.name}</b><small className="discret">{posteDans(n.membre, n.equipeRole) || (n.doublon ? "aussi dans cette équipe" : "")}</small></span>
          {charge.get(n.membre.name)?.retards ? <Etat ton="crit" point={false}>{charge.get(n.membre.name)!.retards}</Etat> : null}
        </button>
      )}
      {n.enfants.length > 0 && <ul>{n.enfants.map(rendre)}</ul>}
    </li>
  );
  if (!racines.length) return <p className="discret">Aucune équipe ni personne dans l'annuaire.</p>;
  return (
    <section className="panneau sy-bloc og" aria-label="Organigramme">
      <p className="discret">Lecture seule. Le plan Métro, ses dispositions et l'édition des équipes restent dans nexora-project.</p>
      <div className="og-defile"><ul className="og-arbre">{racines.map(rendre)}</ul></div>
    </section>
  );
}

function FichePersonne({ d, nom, fermer }: { d: Donnees; nom: string; fermer: () => void }) {
  const m: MembreEquipe | undefined = d.membresEquipe.find((x) => x.name === nom);
  const equipes = normaliserEquipes(d.equipesBrutes).filter((t) => equipesDe(m).includes(t.id));
  const plan = useMemo(() => planDeCharge(d.taches, d.statuts, nom, d.aujourdhui), [d.taches, d.statuts, nom, d.aujourdhui]);
  const enCours = d.taches.filter((t) => t.assignee === nom && !estTerminee(t, d.statuts)).sort((a, b) => (a.end || "9").localeCompare(b.end || "9")).slice(0, 30);
  const cap = capacite(m?.capacityPerDay);
  return (
    <aside className="panneau eq-fiche" aria-label={`Fiche de ${nom}`}>
      <div className="eq-fiche-tete"><Avatar nom={nom} couleur={m ? undefined : couleurPersonne(nom)} /><div><h2>{nom}</h2>{m?.email && <span className="discret mono">{m.email}</span>}</div><Bouton variante="discret" aria-label="Fermer la fiche" onClick={fermer}>×</Bouton></div>
      {!m && <p className="discret">Personne hors annuaire (vue seulement dans les affectations).</p>}
      <dl className="eq-kv"><dt>Capacité</dt><dd className="mono">{cap} poste{cap > 1 ? "s" : ""} / jour</dd>
        <dt>Équipes</dt><dd>{equipes.length ? equipes.map((t) => <span key={t.id} className="eq-puce" style={{ ["--c" as string]: t.color }}>{t.name}{posteDans(m, t.id) ? ` · ${posteDans(m, t.id)}` : ""}</span>) : <span className="discret">aucune</span>}</dd>
        {m?.managerName && <><dt>Responsable</dt><dd>{m.managerName}</dd></>}</dl>
      <Surtitre>Plan de charge · 30 jours</Surtitre>
      <div className="eq-plan" aria-label="Tâches actives par jour">{plan.map((p) => <i key={p.jour} title={`${p.jour} : ${p.nb} tâche${p.nb > 1 ? "s" : ""}`} className={p.nb >= 3 ? "haut" : p.nb ? "plein" : ""} style={{ height: `${8 + Math.min(4, p.nb) * 7}px` }} />)}</div>
      <Surtitre>Tâches en cours · {enCours.length}</Surtitre>
      <div className="eq-taches">{enCours.map((t) => <div key={t.id} className="co-l deux"><span className={estEnRetard(t, d.statuts, d.aujourdhui) ? "crit" : ""}>{t.title}</span><span className="mono discret">{t.end ? `${t.end.slice(8, 10)}/${t.end.slice(5, 7)}` : "—"}</span></div>)}{!enCours.length && <p className="discret">Aucune tâche en cours.</p>}</div>
      <Bouton onClick={() => naviguer("/taches", new URLSearchParams({ r: nom }))}>Voir ses tâches dans le Cockpit</Bouton>
    </aside>
  );
}
