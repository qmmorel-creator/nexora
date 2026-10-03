import { useState, type FormEvent } from "react";
import { connexionEmail, connexionGoogle } from "../donnees/firebase";

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
    <main className="centre">
      <form className="carte connexion" onSubmit={soumettre}>
        <h1>Nexora Futur</h1>
        <p className="discret">Même compte que Nexora. Lecture seule pendant le développement.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="mdp">Mot de passe</label>
        <input id="mdp" type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required />
        {erreur && <p className="erreur" role="alert">{erreur}</p>}
        <button type="submit" className="principal" disabled={enCours}>{enCours ? "Connexion…" : "Se connecter"}</button>
        <button type="button" onClick={google}>Continuer avec Google</button>
      </form>
    </main>
  );
}
