import { useCallback, useState } from "react";
import { appliquerApparence, enregistrerApparence, lireApparence, type Apparence } from "./apparence";

export function useApparence(): [Apparence, (p: Partial<Apparence>) => void] {
  const [a, setA] = useState<Apparence>(() => lireApparence());
  const changer = useCallback((p: Partial<Apparence>) => {
    setA((x) => { const n = { ...x, ...p }; appliquerApparence(n); enregistrerApparence(n); return n; });
  }, []);
  return [a, changer];
}
