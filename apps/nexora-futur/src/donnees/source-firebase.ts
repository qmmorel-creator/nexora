import { auth, ecouterCle } from "./firebase";
import { modifierCle } from "./ecriture-firebase";
import type { RapportsJour, Source } from "./source";

async function rapports(jour: string): Promise<RapportsJour> {
  const jeton = await auth.currentUser?.getIdToken();
  if (!jeton) throw new Error("Non authentifié");
  const r = await fetch(`/api/futur/rapports?jour=${encodeURIComponent(jour)}`, { headers: { authorization: `Bearer ${jeton}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) throw new Error(d.error === "configuration_missing" ? "Rapports indisponibles : configuration serveur incomplète." : "Rapports indisponibles.");
  return { matin: d.matin ?? null, soir: d.soir ?? null };
}

export const sourceFirebase: Source = { ecouter: ecouterCle, modifier: modifierCle, rapports };
