import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { suivreSession } from "./donnees/firebase";
import { FournisseurDonnees } from "./donnees/magasin";
import { sourceFirebase } from "./donnees/source-firebase";
import type { Source } from "./donnees/source";
import { Connexion } from "./ecrans/Connexion";
import { Coquille } from "./optim/Coquille";

// Démonstration locale (VITE_DEMO=1) : données fictives en mémoire, sans
// Firebase. La constante est remplacée au build ; en production la branche
// et le module de démonstration disparaissent du paquet.
const DEMO = import.meta.env.VITE_DEMO === "1";

function Espace({ email, source, demo }: { email: string; source: Source; demo?: boolean }) {
  return <FournisseurDonnees source={source}><Coquille email={email} demo={demo} /></FournisseurDonnees>;
}

function AppDemo() {
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    Promise.all([import("./demo/donnees"), import("./donnees/source"), import("./demo/finance"), import("./donnees/modele")]).then(([d, s, f, m]) => {
      const src = s.sourceMemoire(d.donneesDemo(), d.rapportsDemo, f.financeDemo(m.aujourdhuiParis()));
      (window as unknown as { __nexoraDemo: unknown }).__nexoraDemo = src;
      setSource(src);
    });
  }, []);
  return source ? <Espace email="demo@exemple.invalid" source={source} demo /> : null;
}

export function App() {
  const [session, setSession] = useState<User | null | undefined>(undefined);
  useEffect(() => (DEMO ? undefined : suivreSession(setSession)), []);
  if (DEMO) return <AppDemo />;
  if (session === undefined) return <main className="ox-centre"><p className="ox-dim">Chargement…</p></main>;
  if (!session) return <Connexion />;
  return <Espace email={session.email || ""} source={sourceFirebase} />;
}
