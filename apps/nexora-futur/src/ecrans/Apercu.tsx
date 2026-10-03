import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { deconnexion, ecouterCle, type LectureCle } from "../donnees/firebase";
import { analyserJson } from "../donnees/segments";
import { aujourdhuiParis, estEnRetard, estTerminee, type Projet, type Statut, type Tache } from "../donnees/modele";

type Etat = { lecture: LectureCle | null; erreur: string | null; charge: boolean };
const VIDE: Etat = { lecture: null, erreur: null, charge: false };

function useCle(cle: string): Etat {
  const [etat, setEtat] = useState<Etat>(VIDE);
  useEffect(() => ecouterCle(cle, (lecture) => setEtat({ lecture, erreur: null, charge: true }), (e) => setEtat((x) => ({ ...x, erreur: e.message, charge: true }))), [cle]);
  return etat;
}

const heure = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" }) : "—");

export function Apercu({ utilisateur }: { utilisateur: User }) {
  const p = useCle("nexora:projects");
  const t = useCle("nexora:tasks");
  const s = useCle("nexora:statuses");
  const projets = useMemo(() => analyserJson<Projet[]>("nexora:projects", p.lecture?.texte || "", []), [p.lecture]);
  const taches = useMemo(() => analyserJson<Tache[]>("nexora:tasks", t.lecture?.texte || "", []), [t.lecture]);
  const statuts = useMemo(() => analyserJson<Statut[]>("nexora:statuses", s.lecture?.texte || "", []), [s.lecture]);
  const jour = aujourdhuiParis();
  const ouvertes = taches.filter((x) => !estTerminee(x, statuts));
  const retards = taches.filter((x) => estEnRetard(x, statuts, jour));
  const erreurs = [p, t, s].map((x) => x.erreur).filter(Boolean);
  const charge = p.charge && t.charge && s.charge;

  return (
    <div className="page">
      <header className="entete">
        <strong>Nexora Futur</strong>
        <span className="pastille">Lecture seule</span>
        <span className="discret marge-auto">{utilisateur.email}</span>
        <button onClick={() => deconnexion()}>Se déconnecter</button>
      </header>
      <main className="contenu">
        <h1>Lot 0 · accès aux données</h1>
        <p className="discret">Cet écran prouve que Nexora Futur lit tes données réelles en direct, sans pouvoir les modifier. L'interface définitive arrive avec les lots suivants (#652).</p>
        {erreurs.length > 0 && <div className="erreur" role="alert">{erreurs.join(" · ")}</div>}
        {!charge ? <p className="discret">Lecture de Firebase…</p> : (
          <>
            <div className="chiffres">
              <div className="carte"><b>{projets.length}</b><span>projets</span></div>
              <div className="carte"><b>{taches.length}</b><span>tâches</span></div>
              <div className="carte"><b>{ouvertes.length}</b><span>ouvertes</span></div>
              <div className="carte"><b className="alerte">{retards.length}</b><span>en retard</span></div>
            </div>
            <h2>Projets</h2>
            <ul className="projets">
              {projets.map((pr) => {
                const siennes = ouvertes.filter((x) => x.projectId === pr.id);
                return (
                  <li key={pr.id}><span className="point" style={{ background: pr.color || "#888" }} />{pr.name || "Sans nom"}<span className="discret marge-auto">{siennes.length} ouvertes</span></li>
                );
              })}
            </ul>
          </>
        )}
      </main>
      <footer className="etat" aria-live="polite">
        <span>Tâches : révision {t.lecture?.revision?.slice(0, 8) || "—"} · mise à jour {heure(t.lecture?.misAJour)}</span>
        <span className="marge-auto">Synchronisation temps réel · aucune écriture possible</span>
      </footer>
    </div>
  );
}
