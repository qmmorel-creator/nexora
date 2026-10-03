// Icônes des représentations de Gantt (retour du 03/10/2026) : de petites images
// SVG (nettes à toute taille, aux couleurs du site) remplacent le texte des
// boutons ; le nom et la description s'affichent au survol (title) et sont lus
// par les lecteurs d'écran (aria-label du bouton).
import type { ReactNode } from "react";
import type { StyleGantt } from "../donnees/prefs";

const C = "var(--ico, #245edb)", P = "var(--ico-p, #c7d6f7)", E = "var(--ico-e, #18263d)";
const DESSINS: Record<StyleGantt, ReactNode> = {
  ruban: <><rect x="3" y="5" width="34" height="8" rx="2" fill={P} /><rect x="3" y="5" width="20" height="8" rx="2" fill={C} /></>,
  pixels: <>{Array.from({ length: 8 }, (_, i) => <rect key={i} x={3 + i * 4.3} y="6" width="3.4" height="6" rx=".6" fill={i < 5 ? C : P} />)}</>,
  comete: <><path d="M4 9 L31 7 L31 11 Z" fill={P} /><circle cx="32" cy="9" r="3.6" fill={C} /></>,
  ecart: <><rect x="3" y="4" width="34" height="3" rx="1.5" fill={P} /><rect x="3" y="4" width="26" height="3" rx="1.5" fill={E} /><rect x="3" y="11" width="18" height="3" rx="1.5" fill={C} /><rect x="21" y="11" width="8" height="3" fill="#dc2626" opacity=".7" /></>,
  pont: <><path d="M4 14 Q20 -2 36 14" fill="none" stroke={P} strokeWidth="3" strokeLinecap="round" /><path d="M4 14 Q12 4 20 6" fill="none" stroke={C} strokeWidth="3" strokeLinecap="round" /></>,
  compte: <><line x1="3" y1="9" x2="17" y2="9" stroke={P} strokeWidth="2" strokeDasharray="2 2" /><rect x="17" y="6" width="20" height="6" rx="2" fill={C} /></>,
  jauge: <><rect x="3" y="7.5" width="34" height="3" rx="1.5" fill={P} /><rect x="3" y="7.5" width="18" height="3" rx="1.5" fill={C} /><circle cx="21" cy="9" r="3.6" fill="#fff" stroke={C} strokeWidth="2" /></>,
  briques: <>{Array.from({ length: 5 }, (_, i) => <g key={i}><rect x={3 + i * 7} y="7" width="6" height="7" rx="1" fill={i < 3 ? C : P} /><rect x={4.8 + i * 7} y="5.4" width="2.4" height="1.6" rx=".4" fill={i < 3 ? C : P} /></g>)}</>,
  conduite: <><rect x="4" y="6" width="32" height="6" rx="3" fill="#fff" stroke={C} strokeWidth="1" /><rect x="5" y="7.3" width="17" height="3.4" rx="1.7" fill={C} /><rect x="2.5" y="4.5" width="3" height="9" rx="1" fill={E} /><rect x="34.5" y="4.5" width="3" height="9" rx="1" fill={E} /></>,
  nuages: <>{[[6, 8], [9, 11], [11, 7], [14, 10], [16, 6.5], [18, 12], [21, 8], [24, 10.5], [27, 7], [30, 11], [33, 9]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i < 6 ? 1.2 : 1} fill={i < 6 ? C : "none"} stroke={i < 6 ? "none" : C} strokeWidth=".7" />)}<circle cx="4" cy="9" r="1.8" fill={E} /><circle cx="36" cy="9" r="1.8" fill="#fff" stroke={E} strokeWidth="1" /></>,
  niveaux: <><path d="M3 9 C10 2, 30 2, 37 9 C30 16, 10 16, 3 9 Z" fill={P} stroke={C} strokeWidth=".9" /><path d="M10 9 C14 5, 24 5, 28 9 C24 13, 14 13, 10 9 Z" fill="none" stroke={C} strokeWidth=".8" /><path d="M15 9 C17 7, 21 7, 23 9 C21 11, 17 11, 15 9 Z" fill={C} /></>,
  trajectoires: <><path d="M4 9 C10 3, 16 3, 22 9 C27 14, 32 14, 36 9" fill="none" stroke={P} strokeWidth="1" /><path d="M4 9 C10 14, 16 13, 22 9 C27 5, 32 5, 36 9" fill="none" stroke={E} strokeWidth="1" /><path d="M4 9 C10 4.5, 16 4.5, 22 9" fill="none" stroke={C} strokeWidth="2" /><circle cx="22" cy="9" r="2.6" fill={C} stroke="#fff" strokeWidth="1" /></>,
  prismes: <><path d="M3 9 L14 3.5 L27 4.5 L37 9 L26 14 L13 14.5 Z" fill={P} /><path d="M3 9 L14 3.5 L18 9 Z M14 3.5 L27 4.5 L18 9 Z M3 9 L18 9 L13 14.5 Z" fill={C} opacity=".75" /><line x1="20" y1="3.5" x2="20" y2="14.5" stroke={E} strokeWidth="1.4" /></>,
};

export function IconeStyle({ style }: { style: StyleGantt }) {
  return <svg className="ox-ico-style" viewBox="0 0 40 18" width="40" height="18" aria-hidden="true" focusable="false">{DESSINS[style]}</svg>;
}
