import { describe, expect, it } from "vitest";
import { COULEURS, COUPLES_AA, COUPLES_CONTOUR, contraste, feuilleJetons } from "../src/theme/jetons";
import { normaliser } from "../src/theme/apparence";

describe("jetons Plan", () => {
  for (const mode of ["clair", "sombre"] as const) {
    it(`contrastes AA en ${mode}`, () => {
      const c = COULEURS[mode];
      const echecs = COUPLES_AA.map(([t, f]) => [t, f, contraste(c[t], c[f])] as const).filter(([, , r]) => r < 4.5).map(([t, f, r]) => `${t}/${f} ${r.toFixed(2)}`);
      expect(echecs).toEqual([]);
    });
    it(`contours de commandes à 3:1 en ${mode}`, () => {
      const c = COULEURS[mode];
      expect(COUPLES_CONTOUR.filter(([a, b]) => contraste(c[a], c[b]) < 3)).toEqual([]);
    });
  }
  it("les deux modes définissent les mêmes jetons", () => {
    expect(Object.keys(COULEURS.sombre).sort()).toEqual(Object.keys(COULEURS.clair).sort());
  });
  it("la feuille générée couvre clair, auto, sombre et densité", () => {
    const f = feuilleJetons();
    expect(f).toContain("--accent:#c2410c");
    expect(f).toContain('prefers-color-scheme: dark){:root[data-mode="auto"]');
    expect(f).toContain(':root[data-mode="sombre"]');
    expect(f).toContain(':root[data-densite="confortable"]');
  });
});

describe("apparence", () => {
  it("normalise les valeurs inconnues vers les défauts", () => {
    expect(normaliser(null)).toEqual({ mode: "auto", densite: "compacte" });
    expect(normaliser({ mode: "fluo", densite: "confortable" })).toEqual({ mode: "auto", densite: "confortable" });
    expect(normaliser({ mode: "sombre" })).toEqual({ mode: "sombre", densite: "compacte" });
  });
});
