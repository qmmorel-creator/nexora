// Copie de secours locale (Ref #663), à la manière de nexora:rescue:* de
// nexora-project : la valeur calculée est gardée dans le navigateur AVANT
// l'envoi, effacée une fois l'écriture confirmée. Si l'onglet se ferme ou si
// l'écriture échoue, la copie reste et est proposée au démarrage.
export const PREFIXE_SECOURS = "nexora-futur:secours:";
export interface CopieSecours { cle: string; texte: string; le: string; erreur?: string }
type Stock = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const stock = (): Stock | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function garderSecours(cle: string, texte: string, le = new Date().toISOString(), s: Stock | null = stock()) {
  try { s?.setItem(PREFIXE_SECOURS + cle, JSON.stringify({ cle, texte, le } satisfies CopieSecours)); } catch { /* quota : on écrit quand même */ }
}
export function marquerEchec(cle: string, erreur: string, s: Stock | null = stock()) {
  try { const v = s?.getItem(PREFIXE_SECOURS + cle); if (v) s!.setItem(PREFIXE_SECOURS + cle, JSON.stringify({ ...JSON.parse(v), erreur })); } catch { /* rien */ }
}
export function oublierSecours(cle: string, s: Stock | null = stock()) { try { s?.removeItem(PREFIXE_SECOURS + cle); } catch { /* rien */ } }
export function copiesSecours(s: Stock | null = stock()): CopieSecours[] {
  if (!s) return [];
  const l: CopieSecours[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k?.startsWith(PREFIXE_SECOURS)) continue;
    try { const v = JSON.parse(s.getItem(k) || ""); if (v && typeof v.cle === "string" && typeof v.texte === "string") l.push(v); } catch { /* copie illisible ignorée */ }
  }
  return l.sort((a, b) => a.le.localeCompare(b.le));
}
