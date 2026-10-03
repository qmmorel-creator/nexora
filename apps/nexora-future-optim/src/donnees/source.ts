// Source de données (Ref #655) : Firebase en production, mémoire pour la
// démonstration locale et les tests de parcours. Même contrat, même garde.
import type { LectureCle } from "./firebase";
import { exigerEcriture } from "./garde";
import { CLES_ECRITURE_OUVERTES } from "./config";

export interface RapportsJour { matin: Rapport | null; soir: Rapport | null; }
export interface Rapport {
  reportId?: string;
  summary?: Record<string, number>;
  rows?: { occurredAt?: string; treatment?: string; projectType?: string | null; result?: string; taskId?: string | null }[];
  budget?: { ok: boolean; [k: string]: unknown };
}
// Finances (Ref #659) : lectures relayées vers nexora-project et la seule
// catégorisation. Le code d'erreur du serveur est conservé pour le message.
export class ErreurFinance extends Error { constructor(public code: string) { super(code); this.name = "ErreurFinance"; } }
export type RessourceFinance = "budget-summary" | "wealth-series" | "sankey-data" | "transactions-data";
export interface Categorisation { transactionId: string; category: string; subcategory: string | null; idempotencyKey: string; }
export interface AccesFinance {
  lire(ressource: RessourceFinance, params?: Record<string, string>): Promise<unknown>;
  categoriser(c: Categorisation): Promise<void>;
}
// Corps (Ref #660) : sport, santé et photos lus par relais (lecture seule).
export class ErreurCorps extends Error { constructor(public code: string) { super(code); this.name = "ErreurCorps"; } }
export type RessourceCorps = "sport-activities" | "health-records" | "body-photos";
export interface AccesCorps {
  lire(ressource: RessourceCorps): Promise<unknown>;
  image(id: string): Promise<Blob>;
}
export interface Source {
  ecouter(cle: string, rappel: (l: LectureCle | null) => void, erreur: (e: Error) => void): () => void;
  modifier(cle: string, transformer: (texte: string) => string): Promise<{ revision: string }>;
  rapports?(jour: string): Promise<RapportsJour>;
  finance?: AccesFinance;
  corps?: AccesCorps;
}

export function sourceMemoire(initial: Record<string, unknown>, rapports?: (jour: string) => RapportsJour, finance?: AccesFinance, corps?: AccesCorps): Source & { valeur(cle: string): unknown } {
  const valeurs = new Map<string, { texte: string; revision: string }>(Object.entries(initial).map(([k, v]) => [k, { texte: JSON.stringify(v), revision: "r0" }]));
  const ecoutes = new Map<string, Set<(l: LectureCle | null) => void>>();
  let n = 0;
  const lecture = (cle: string): LectureCle | null => { const v = valeurs.get(cle); return v ? { cle, texte: v.texte, revision: v.revision, misAJour: new Date().toISOString() } : null; };
  return {
    ecouter(cle, rappel) {
      const s = ecoutes.get(cle) || new Set(); s.add(rappel); ecoutes.set(cle, s);
      queueMicrotask(() => rappel(lecture(cle)));
      return () => { s.delete(rappel); };
    },
    async modifier(cle, transformer) {
      exigerEcriture(cle, CLES_ECRITURE_OUVERTES);
      const texte = transformer(valeurs.get(cle)?.texte || "");
      const revision = `r${++n}`;
      valeurs.set(cle, { texte, revision });
      await new Promise((r) => setTimeout(r, 30));
      ecoutes.get(cle)?.forEach((f) => f(lecture(cle)));
      return { revision };
    },
    valeur(cle) { const v = valeurs.get(cle); return v ? JSON.parse(v.texte) : undefined; },
    ...(rapports ? { rapports: async (jour: string) => rapports(jour) } : {}),
    ...(finance ? { finance } : {}),
    ...(corps ? { corps } : {}),
  };
}
