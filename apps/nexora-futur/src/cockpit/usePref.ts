// Préférence de nexora:futurPrefs avec affichage immédiat (Ref #658) : la
// valeur locale s'efface dès que la valeur synchronisée la rejoint.
import { useEffect, useState } from "react";
import { useDonnees } from "../donnees/magasin";
import { fusionnerPrefs, type PrefsFutur } from "../donnees/prefs";

type Cle = "frise" | "tableur" | "densite" | "synthese";
export function usePref<K extends Cle>(cle: K): [PrefsFutur[K], (v: PrefsFutur[K]) => void] {
  const { d, ecrireJson } = useDonnees();
  const [local, setLocal] = useState<PrefsFutur[K] | undefined>(undefined);
  const distant = d.prefs[cle];
  useEffect(() => { if (local !== undefined && JSON.stringify(local) === JSON.stringify(distant)) setLocal(undefined); }, [distant, local]);
  const changer = (v: PrefsFutur[K]) => {
    setLocal(v);
    ecrireJson("prefs", (x) => fusionnerPrefs(x, { [cle]: v } as Partial<PrefsFutur>)).catch((e) => console.warn("Préférence non enregistrée", e));
  };
  return [local !== undefined ? local : distant, changer];
}
