import { useState, type FormEvent } from "react";
import { connexionEmail, connexionGoogle } from "../donnees/firebase";
import { Bouton, Champ, Etat, Surtitre } from "../composants";

const messageErreur = (e: unknown) => {
  const code = (e as { code?: string })?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "E-mail ou mot de passe incorrect.";
  if (code.includes("unauthorized-domain")) return "Ce domaine n'est pas autorisé dans Firebase Auth.";
  if (code.includes("popup-closed")) return "Fenêtre Google fermée avant la fin de la connexion.";
  return "Connexion impossible. Réessaie, puis vérifie ta connexion réseau.";
};

export function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e: FormEvent) => {
    e.preventDefault();
    setEnCours(true); setErreur("");
    try { await connexionEmail(email, motDePasse); } catch (x) { setErreur(messageErreur(x)); } finally { setEnCours(false); }
  };
  const google = async () => {
    setErreur("");
    try { await connexionGoogle(); } catch (x) { setErreur(messageErreur(x)); }
  };

  return (
    <main className="centre quadrillage">
      <form className="panneau connexion" onSubmit={soumettre}>
        <div className="connexion-cartouche">
          <Surtitre>Nexora · plan de travail</Surtitre>
          <h1>Nexora Futur</h1>
          <Etat ton="info">Lecture seule pendant le développement</Etat>
        </div>
        <div className="connexion-corps">
          <Champ libelle="E-mail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Champ libelle="Mot de passe" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required erreur={erreur || undefined} />
          <Bouton type="submit" variante="principal" disabled={enCours}>{enCours ? "Connexion…" : "Se connecter"}</Bouton>
          <Bouton onClick={google}>Continuer avec Google</Bouton>
        </div>
        <div className="connexion-pied mono">Même compte que Nexora · nexora-cb20d</div>
      </form>
    </main>
  );
}
