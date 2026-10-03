import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { suivreSession } from "./donnees/firebase";
import { Connexion } from "./ecrans/Connexion";
import { Apercu } from "./ecrans/Apercu";
import { Reference } from "./ecrans/Reference";

export function App() {
  const [session, setSession] = useState<User | null | undefined>(undefined);
  useEffect(() => suivreSession(setSession), []);
  // Page de référence de l'identité : sans données, accessible sans connexion.
  if (window.location.pathname === "/reference") return <Reference />;
  if (session === undefined) return <main className="centre quadrillage"><p className="surtitre">Chargement…</p></main>;
  return session ? <Apercu utilisateur={session} /> : <Connexion />;
}
