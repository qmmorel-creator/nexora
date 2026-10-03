// Identité « Clarté » (piste D, choisie par Quentin le 03/10/2026 pour
// Futur, à la place de « Plan » — Ref #654).
// Source unique des jetons : les variables CSS sont générées depuis ce fichier
// et tests/jetons.test.ts vérifie les contrastes AA dans les deux modes.

export type Mode = "clair" | "sombre";
export type Densite = "compacte" | "confortable";

export const COULEURS: Record<Mode, Record<string, string>> = {
  clair: {
    fond: "#f6f7f9", surface: "#ffffff", rail: "#eef0f4", quadrillage: "#f6f7f9",
    encre: "#111827", encre2: "#4b5563", encre3: "#5b6472",
    ligne: "#e3e6eb", ligne2: "#eef0f3", "ligne-champ": "#848d9b", sel: "#eef0ff",
    accent: "#4f46e5", "accent-survol": "#4338ca", "sur-accent": "#ffffff", "accent-doux": "#e8e7fd",
    crit: "#b91c1c", "crit-fond": "#fde8e8", alerte: "#92400e", "alerte-fond": "#fef3c7",
    ok: "#15803d", "ok-fond": "#dcfce7", info: "#1d4ed8", "info-fond": "#dbeafe",
    focus: "#4f46e5",
  },
  sombre: {
    fond: "#0f1115", surface: "#16191f", rail: "#0b0d10", quadrillage: "#0f1115",
    encre: "#e8eaee", encre2: "#a8b0bc", encre3: "#8a93a0",
    ligne: "#262b33", ligne2: "#1c2027", "ligne-champ": "#6b7482", sel: "#1f2433",
    accent: "#8b87ff", "accent-survol": "#a5a2ff", "sur-accent": "#12103a", "accent-doux": "#262448",
    crit: "#f87171", "crit-fond": "#3b1416", alerte: "#fbbf24", "alerte-fond": "#3a2a0c",
    ok: "#4ade80", "ok-fond": "#10291a", info: "#7aa7ff", "info-fond": "#15223d",
    focus: "#8b87ff",
  },
};

export const FORMES = {
  "r": "8px", "r-puce": "6px", "r-case": "4px", "trait": "1px",
  "titre": "'Inter Tight', 'Inter', system-ui, sans-serif",
  "texte": "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
  "mono": "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  // Libellés (surtitres, en-têtes de colonnes) : en texte, sans capitales.
  "libelle": "'Inter', system-ui, sans-serif", "libelle-casse": "none", "libelle-espace": "0", "t-libelle": "12px",
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
