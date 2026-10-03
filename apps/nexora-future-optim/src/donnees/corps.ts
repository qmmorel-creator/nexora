// Corps (Ref #689) : séries des cartes, portées du prototype hybride v4.
// Vue Jour : valeur du jour, moyenne mobile et faisceau min–max sur 7 jours
// glissants ; vues Semaine et Mois : moyenne, minimum et maximum de chaque
// période. Les jours sans relevé restent vides (jamais inventés).
import { ajouterJours } from "./modele";
import type { Releve } from "./sante";
import type { RegroupementCorps } from "./prefs";

export interface Seau { cle: string; debut: string; fin: string; jours: string[]; }

const lundi = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); const n = (d.getUTCDay() + 6) % 7; return ajouterJours(iso, -n); };

// Les n derniers jours jusqu'à `jour` inclus, regroupés.
export function seaux(jour: string, n: number, mode: RegroupementCorps): Seau[] {
  const out: Seau[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = ajouterJours(jour, -i), k = mode === "semaine" ? lundi(d) : mode === "mois" ? d.slice(0, 7) : d;
    const der = out[out.length - 1];
    if (!der || der.cle !== k) out.push({ cle: k, debut: d, fin: d, jours: [d] });
    else { der.fin = d; der.jours.push(d); }
  }
  return out;
}

export const valeurReleve = (r: Releve | undefined, cle: string) => { const v = r ? r[cle] : null; return typeof v === "number" && Number.isFinite(v) ? v : null; };
const moy = (l: number[]) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);

export interface PointSerie { valeur: number | null; bas: number | null; haut: number | null; ligne: number | null; nb: number; }

export function serieMetrique(releves: Releve[], cle: string, s: Seau[], mode: RegroupementCorps): PointSerie[] {
  const parDate = new Map(releves.map((r) => [r.date, r]));
  const v = (d: string) => valeurReleve(parDate.get(d), cle);
  if (mode === "jour") {
    return s.map((x) => {
      const fen = Array.from({ length: 7 }, (_, i) => v(ajouterJours(x.debut, -i))).filter((y): y is number => y !== null);
      return { valeur: v(x.debut), bas: fen.length ? Math.min(...fen) : null, haut: fen.length ? Math.max(...fen) : null, ligne: moy(fen), nb: v(x.debut) === null ? 0 : 1 };
    });
  }
  return s.map((x) => {
    const l = x.jours.map(v).filter((y): y is number => y !== null);
    const m = moy(l);
    return { valeur: m, bas: l.length ? Math.min(...l) : null, haut: l.length ? Math.max(...l) : null, ligne: m, nb: l.length };
  });
}

// Dernière valeur connue et statistiques des jours de la période.
export function resumeMetrique(releves: Releve[], cle: string, jour: string, n: number) {
  const debut = ajouterJours(jour, -(n - 1));
  const l = releves.filter((r) => r.date >= debut && r.date <= jour).sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ date: r.date, v: valeurReleve(r, cle) })).filter((x): x is { date: string; v: number } => x.v !== null);
  const vals = l.map((x) => x.v);
  return { dernier: l[l.length - 1] || null, moyenne: moy(vals), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, nb: vals.length };
}
