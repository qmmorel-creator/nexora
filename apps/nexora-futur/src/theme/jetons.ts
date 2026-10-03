// Identité « Plan » (piste A, choisie par Quentin le 03/10/2026 — Ref #654).
// Source unique des jetons : les variables CSS sont générées depuis ce fichier
// et tests/jetons.test.ts vérifie les contrastes AA dans les deux modes.

export type Mode = "clair" | "sombre";
export type Densite = "compacte" | "confortable";

export const COULEURS: Record<Mode, Record<string, string>> = {
  clair: {
    fond: "#eef1f4", surface: "#fbfcfd", rail: "#e4e9ee", quadrillage: "#e2e7ed",
    encre: "#14202e", encre2: "#46566a", encre3: "#5f6e80",
    ligne: "#cfd7e0", ligne2: "#e2e7ed", "ligne-champ": "#7d8a9b", sel: "#e3e9f0",
    accent: "#c2410c", "accent-survol": "#a3360a", "sur-accent": "#ffffff", "accent-doux": "#fbe7dc",
    crit: "#b42318", "crit-fond": "#fde4e1", alerte: "#8a5300", "alerte-fond": "#fdf0d5",
    ok: "#136c34", "ok-fond": "#dcf3e4", info: "#1d64c9", "info-fond": "#e1ecfb",
    focus: "#1d64c9",
  },
  sombre: {
    fond: "#0f151c", surface: "#151d26", rail: "#0c1117", quadrillage: "#18212b",
    encre: "#e6edf5", encre2: "#a9b6c5", encre3: "#8593a4",
    ligne: "#273342", ligne2: "#1d2732", "ligne-champ": "#66768a", sel: "#1e2935",
    accent: "#ff8a4c", "accent-survol": "#ffa271", "sur-accent": "#1a0d05", "accent-doux": "#3a2214",
    crit: "#ff7a6e", "crit-fond": "#3a1714", alerte: "#f5c26b", "alerte-fond": "#3a2c12",
    ok: "#4ade80", "ok-fond": "#123222", info: "#6ea8ff", "info-fond": "#14243d",
    focus: "#6ea8ff",
  },
};

export const FORMES = {
  "r": "3px", "r-puce": "3px", "r-case": "2px", "trait": "1px",
  "titre": "'IBM Plex Sans Condensed', 'IBM Plex Sans', system-ui, sans-serif",
  "texte": "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  "mono": "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
} as const;

// Échelle typographique fixe (px) et espacements (base 4).
export const ECHELLE = { "t-xs": "11px", "t-s": "12px", "t-m": "13.5px", "t-l": "16px", "t-xl": "20px", "t-xxl": "26px", "t-hero": "34px" } as const;
export const ESPACES = { "e-1": "4px", "e-2": "8px", "e-3": "12px", "e-4": "16px", "e-5": "20px", "e-6": "24px", "e-8": "32px" } as const;

export const DENSITES: Record<Densite, Record<string, string>> = {
  compacte: { "h-ligne": "34px", "h-commande": "30px", "pad-x": "16px", "taille-texte": "13.5px" },
  confortable: { "h-ligne": "42px", "h-commande": "36px", "pad-x": "20px", "taille-texte": "14.5px" },
};

// Contours de commandes (champs, cases, segments) : 3:1 minimum (WCAG 1.4.11).
export const COUPLES_CONTOUR: [string, string][] = [["ligne-champ", "surface"], ["ligne-champ", "fond"]];

// Couples texte/fond qui doivent atteindre 4,5:1 (WCAG AA, texte normal).
export const COUPLES_AA: [string, string][] = [
  ["encre", "fond"], ["encre", "surface"], ["encre", "sel"], ["encre", "rail"],
  ["encre2", "surface"], ["encre2", "fond"], ["encre2", "sel"],
  ["encre3", "surface"], ["encre3", "fond"],
  ["sur-accent", "accent"], ["sur-accent", "accent-survol"], ["accent", "surface"],
  ["crit", "surface"], ["crit", "crit-fond"], ["alerte", "alerte-fond"], ["alerte", "surface"],
  ["ok", "ok-fond"], ["info", "info-fond"], ["encre", "accent-doux"],
];

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const vars = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(";");

// Feuille de style générée : clair par défaut, sombre selon la préférence
// système (mode « auto ») ou forcé, densités.
export function feuilleJetons(): string {
  const fixes = vars({ ...FORMES, ...ECHELLE, ...ESPACES });
  return [
    `:root{${fixes};${vars(COULEURS.clair)};${vars(DENSITES.compacte)};color-scheme:light}`,
    `@media (prefers-color-scheme: dark){:root[data-mode="auto"]{${vars(COULEURS.sombre)};color-scheme:dark}}`,
    `:root[data-mode="sombre"]{${vars(COULEURS.sombre)};color-scheme:dark}`,
    `:root[data-densite="confortable"]{${vars(DENSITES.confortable)}}`,
  ].join("\n");
}
