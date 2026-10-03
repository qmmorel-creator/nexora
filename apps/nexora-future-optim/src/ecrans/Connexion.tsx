import { useState, type FormEvent } from "react";
import { connexionEmail, connexionGoogle } from "../donnees/firebase";

const messageErreur = (e: unknown) => {
  const code = (e as { code?: string })?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "E-mail ou mot de passe incorrect.";
  if (code.includes("unauthorized-domain")) return "Ce domaine n'est pas encore autorisé dans Firebase Auth (Authentication › Settings › Authorized domains).";
  if (code.includes("popup-closed")) return "Fenêtre Google fermée avant la fin de la connexion.";
  return "Connexion impossible. Réessaie, puis vérifie ta connexion réseau.";
};

export function Connexion() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const soumettre = async (e: FormEvent) => {
    e.preventDefault(); setEnCours(true); setErreur("");
    try { await connexionEmail(email, motDePasse); } catch (x) { setErreur(messageErreur(x)); } finally { setEnCours(false); }
  };
  const google = async () => { setErreur(""); try { await connexionGoogle(); } catch (x) { setErreur(messageErreur(x)); } };
  return (
    <main className="ox-centre">
      <form className="ox-login" onSubmit={soumettre}>
        <span className="hx-logo"><i></i>Nexora</span>
        <h1>Connexion</h1>
        <p className="ox-dim">Vos données Nexora, avec le compte habituel.</p>
        <button type="button" className="hx-btn ox-wide" onClick={google}>Continuer avec Google</button>
        <p className="ox-sep"><span>ou</span></p>
        <label>E-mail<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label>Mot de passe<input type="password" autoComplete="current-password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} required /></label>
        {erreur && <p className="ox-err" role="alert">{erreur}</p>}
        <button type="submit" className="hx-btn is-primary ox-wide" disabled={enCours}>{enCours ? "Connexion…" : "Se connecter"}</button>
      </form>
    </main>
  );
}
