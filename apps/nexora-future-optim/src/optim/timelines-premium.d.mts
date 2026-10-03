// Types du module timelines-premium.mjs (dessins copiés du prototype, Ref #688).
export type StylePremium = "briques" | "conduite" | "nuages" | "niveaux" | "trajectoires" | "prismes";
export declare const STYLES_PREMIUM: StylePremium[];
export declare function hex6(couleur: string | undefined | null): string;
export declare function dessinerBarre(svg: SVGSVGElement, style: StylePremium, options: {
  largeur: number; hauteur: number; couleur: string; avancement: number | null; id: string;
  libDebut?: string; libFin?: string; jours?: number; compact?: boolean;
}): void;
