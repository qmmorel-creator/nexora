import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { suivreSession } from "./donnees/firebase";
import { Connexion } from "./ecrans/Connexion";
import { Apercu } from "./ecrans/Apercu";

export function App() {
  const [session, setSession] = useState<User | null | undefined>(undefined);
  useEffect(() => suivreSession(setSession), []);
  if (session === undefined) return <main className="centre"><p className="discret">Chargement…</p></main>;
  return session ? <Apercu utilisateur={session} /> : <Connexion />;
}
