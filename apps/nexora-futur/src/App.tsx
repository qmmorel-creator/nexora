import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { suivreSession } from "./donnees/firebase";
import { FournisseurDonnees } from "./donnees/magasin";
import { sourceFirebase } from "./donnees/source-firebase";
import type { Source } from "./donnees/source";
import { Connexion } from "./ecrans/Connexion";
import { Reference } from "./ecrans/Reference";
import { Cockpit } from "./cockpit/Cockpit";
import { FournisseurNotifications } from "./cockpit/Notifications";
import { CLE_CAPTURE, lireCapture } from "./donnees/capture";

// Démonstration locale (VITE_DEMO=1) : données fictives en mémoire, sans
// Firebase. La constante est remplacée au build ; en production la branche
// et le module de démonstration disparaissent du paquet.
const DEMO = import.meta.env.VITE_DEMO === "1";

// Capture externe (#663) : la demande est gardée dès le chargement, avant la
// connexion, pour survivre au cycle d'authentification (comme nexora-project).
try { const c = lireCapture(window.location.search); if (c) sessionStorage.setItem(CLE_CAPTURE, JSON.stringify(c)); } catch { /* stockage indisponible */ }

function Espace({ utilisateur, source }: { utilisateur: Pick<User, "email">; source: Source }) {
  return (
    <FournisseurNotifications>
      <FournisseurDonnees source={source}><Cockpit utilisateur={utilisateur} /></FournisseurDonnees>
    </FournisseurNotifications>
  );
}

function AppDemo() {
  const [source, setSource] = useState<Source | null>(null);
  useEffect(() => {
    Promise.all([import("./demo/donnees"), import("./donnees/source"), import("./demo/finance"), import("./donnees/modele"), import("./demo/corps")]).then(([d, s, f, m, c]) => {
      const src = s.sourceMemoire(d.donneesDemo(), d.rapportsDemo, f.financeDemo(m.aujourdhuiParis()), c.corpsDemo(m.aujourdhuiParis()));
      (window as unknown as { __nexoraDemo: unknown }).__nexoraDemo = src;
      setSource(src);
    });
  }, []);
  return source ? <Espace utilisateur={{ email: "demo@exemple.invalid" }} source={source} /> : null;
}

export function App() {
  const [session, setSession] = useState<User | null | undefined>(undefined);
  useEffect(() => (DEMO ? undefined : suivreSession(setSession)), []);
  const source = useMemo(() => sourceFirebase, []);
  if (window.location.pathname === "/reference") return <Reference />;
  if (DEMO) return <AppDemo />;
  if (session === undefined) return <main className="centre quadrillage"><p className="surtitre">Chargement…</p></main>;
  if (!session) return <Connexion />;
  return <Espace utilisateur={session} source={source} />;
}
