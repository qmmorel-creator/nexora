import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { deconnexion, ecouterCle, type LectureCle } from "../donnees/firebase";
import { analyserJson } from "../donnees/segments";
import { aujourdhuiParis, estEnRetard, estTerminee, type Projet, type Statut, type Tache } from "../donnees/modele";
import { Bouton, Cartouche, Etat, Surtitre } from "../composants";
import { ReglagesApparence } from "../composants/ReglagesApparence";

type Lecture = { lecture: LectureCle | null; erreur: string | null; charge: boolean };
const VIDE: Lecture = { lecture: null, erreur: null, charge: false };

function useCle(cle: string): Lecture {
  const [etat, setEtat] = useState<Lecture>(VIDE);
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
        <span className="logo" aria-hidden="true">N</span>
        <strong className="entete-titre">Nexora Futur</strong>
        <Etat ton="info">Lecture seule</Etat>
        <span className="marge-auto" />
        <ReglagesApparence />
        <span className="discret mono">{utilisateur.email}</span>
        <Bouton variante="discret" onClick={() => deconnexion()}>Se déconnecter</Bouton>
      </header>
      <main className="contenu quadrillage">
        <div className="feuille">
          <Cartouche surtitre="Lot 1 · identité Plan" titre="Accès aux données"
            meta={<><span>Firebase nexora-cb20d</span><span>Lecture seule</span><span>Temps réel</span></>} />
          <p className="discret">Cet écran prouve que Nexora Futur lit tes données réelles sans pouvoir les modifier. Le Cockpit arrive au lot 2 (#655).</p>
          {erreurs.length > 0 && <p role="alert"><Etat ton="crit">{erreurs.join(" · ")}</Etat></p>}
          {!charge ? <p className="surtitre">Lecture de Firebase…</p> : (
            <>
              <div className="chiffres">
                <div className="panneau chiffre"><Surtitre>Projets</Surtitre><b>{projets.length}</b></div>
                <div className="panneau chiffre"><Surtitre>Tâches</Surtitre><b>{taches.length}</b></div>
                <div className="panneau chiffre"><Surtitre>Ouvertes</Surtitre><b>{ouvertes.length}</b></div>
                <div className="panneau chiffre"><Surtitre>En retard</Surtitre><b className="crit">{retards.length}</b></div>
              </div>
              <Surtitre>Projets · tâches ouvertes</Surtitre>
              <ul className="projets panneau">
                {projets.map((pr) => (
                  <li key={pr.id}><span className="point" style={{ background: pr.color || "var(--encre3)" }} />{pr.name || "Sans nom"}<span className="mono discret marge-auto">{ouvertes.filter((x) => x.projectId === pr.id).length}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      </main>
      <footer className="etat-barre mono" aria-live="polite">
        <span>Tâches · révision {t.lecture?.revision?.slice(0, 8) || "—"} · {heure(t.lecture?.misAJour)}</span>
        <span className="marge-auto">Synchronisé en temps réel · aucune écriture possible</span>
      </footer>
    </div>
  );
}
