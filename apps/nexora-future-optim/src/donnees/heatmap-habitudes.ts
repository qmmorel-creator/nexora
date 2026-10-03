// Heatmap mensuelle des habitudes (retour du 03/10/2026) : portage du widget
// « Heat map » d'habitudes de Nexora (index.html.part-002, habitValueIntensity,
// habitIntensityColor, habitCellColors, habitCellBackground, habitMonthDays).
// Une case par jour ; une couleur par habitude du thème posée ce jour-là ;
// plusieurs habitudes = dégradé conique à parts égales (« facettes »).
import { ajouterJours } from "./modele";
import type { EntreeHabitude, Habitude, ThemeHabitudes } from "./habitudes";

export function intensite(h: Habitude, valeur?: number): number {
  const min = Number.isFinite(h.min) ? h.min : 0;
  const max = Number.isFinite(h.max) && h.max > min ? h.max : min + 10;
  const v = Number.isFinite(valeur) ? (valeur as number) : min;
  return Math.max(0, Math.min(1, (v - min) / (max - min)));
}
// Mélange avec du blanc : t = 0 reste légèrement teinté (une valeur posée reste visible), t = 1 = couleur pleine.
export function couleurIntensite(hex: string, t: number): string {
  const c = String(hex || "").replace("#", "");
  if (c.length !== 6) return hex;
  const k = 0.22 + Math.max(0, Math.min(1, t)) * 0.78, m = (ch: number) => Math.round(255 - (255 - ch) * k), x = (n: number) => n.toString(16).padStart(2, "0");
  return "#" + x(m(parseInt(c.slice(0, 2), 16))) + x(m(parseInt(c.slice(2, 4), 16))) + x(m(parseInt(c.slice(4, 6), 16)));
}
// Couleurs d'un jour pour un thème, dans l'ordre des habitudes du thème. `couleur` permet la surcharge d'Optim.
export function couleursDuJour(theme: ThemeHabitudes, journal: EntreeHabitude[], date: string, couleur: (h: Habitude) => string = (h) => h.color): string[] {
  const parHabitude = new Map(journal.filter((e) => e.date === date).map((e) => [e.habitId, e]));
  return theme.habits.flatMap((h) => { const e = parHabitude.get(h.id); return e ? [h.kind === "numeric" ? couleurIntensite(couleur(h), intensite(h, e.value)) : couleur(h)] : []; });
}
// Une couleur : aplat ; plusieurs : dégradé conique à parts égales.
export function fondFacettes(couleurs: string[], vide = "transparent"): string {
  const l = couleurs.filter(Boolean);
  if (!l.length) return vide;
  if (l.length === 1) return l[0];
  const s = 360 / l.length;
  return `conic-gradient(from 45deg, ${l.map((c, i) => `${c} ${i * s}deg ${(i + 1) * s}deg`).join(", ")})`;
}
// Grille d'un mois : 6 semaines pleines, lundi en tête (42 jours).
export function grilleMois(annee: number, mois0: number): { date: string; jour: number; dansMois: boolean }[] {
  const premier = `${annee}-${String(mois0 + 1).padStart(2, "0")}-01`;
  const dow = (new Date(`${premier}T12:00:00Z`).getUTCDay() + 6) % 7;
  const debut = ajouterJours(premier, -dow);
  return Array.from({ length: 42 }, (_, i) => { const date = ajouterJours(debut, i); return { date, jour: Number(date.slice(8)), dansMois: Number(date.slice(5, 7)) === mois0 + 1 }; });
}
