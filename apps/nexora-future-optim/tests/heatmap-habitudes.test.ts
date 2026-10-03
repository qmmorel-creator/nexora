// Heatmap mensuelle des habitudes (retour du 03/10/2026) : règles reprises de Nexora.
import { describe, expect, it } from "vitest";
import { couleurIntensite, couleursDuJour, fondFacettes, grilleMois, intensite } from "../src/donnees/heatmap-habitudes";
import type { ThemeHabitudes } from "../src/donnees/habitudes";

const TH: ThemeHabitudes = { id: "t", name: "Santé", color: "#000000", selectionMode: "multi", habits: [
  { id: "eau", name: "Eau", color: "#0000ff", kind: "check", min: 0, max: 1 },
  { id: "pas", name: "Pas", color: "#ff0000", kind: "numeric", min: 0, max: 10 },
  { id: "med", name: "Méditation", color: "#00ff00", kind: "check", min: 0, max: 1 },
] };
describe("heatmap des habitudes", () => {
  it("couleurs du jour dans l'ordre du thème, intensité pour les habitudes chiffrées", () => {
    const j = [{ id: "1", habitId: "med", date: "2026-10-01" }, { id: "2", habitId: "eau", date: "2026-10-01" }, { id: "3", habitId: "pas", date: "2026-10-01", value: 10 }, { id: "4", habitId: "eau", date: "2026-10-02" }];
    expect(couleursDuJour(TH, j, "2026-10-01")).toEqual(["#0000ff", "#ff0000", "#00ff00"]);
    expect(couleursDuJour(TH, j, "2026-10-02")).toEqual(["#0000ff"]);
    expect(couleursDuJour(TH, j, "2026-10-03")).toEqual([]);
    expect(couleursDuJour(TH, j, "2026-10-02", () => "#123456")).toEqual(["#123456"]);
  });
  it("intensité bornée, plancher de couleur visible", () => {
    expect(intensite(TH.habits[1], 5)).toBe(0.5);
    expect(intensite(TH.habits[1], 99)).toBe(1);
    expect(couleurIntensite("#ff0000", 1)).toBe("#ff0000");
    expect(couleurIntensite("#ff0000", 0)).toBe("#ffc7c7");
  });
  it("facettes : aplat pour une couleur, dégradé conique à parts égales sinon", () => {
    expect(fondFacettes([], "#eee")).toBe("#eee");
    expect(fondFacettes(["#111111"])).toBe("#111111");
    expect(fondFacettes(["#a", "#b"])).toBe("conic-gradient(from 45deg, #a 0deg 180deg, #b 180deg 360deg)");
  });
  it("grille de mois : 42 jours, lundi en tête", () => {
    const g = grilleMois(2026, 9); // octobre 2026 : le 1er est un jeudi
    expect(g).toHaveLength(42);
    expect(g[0]).toEqual({ date: "2026-09-28", jour: 28, dansMois: false });
    expect(g[3]).toEqual({ date: "2026-10-01", jour: 1, dansMois: true });
  });
});
