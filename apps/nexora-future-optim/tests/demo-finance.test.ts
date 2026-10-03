import { describe, expect, it } from "vitest";
import { financeDemo } from "../src/demo/finance";

// Démo Argent (#690) : les ressources fictives doivent concorder entre elles,
// comme les vraies (même grand livre côté nexora-project).
describe("démo finance cohérente", () => {
  const demo = financeDemo("2026-10-03");
  it("aucune opération après aujourd'hui", () => {
    expect(demo.etat().every((t) => t.date <= "2026-10-03")).toBe(true);
  });
  it("patrimoine : points en fin de mois, dernier point = aujourd'hui = synthèse", async () => {
    const s = await demo.lire("wealth-series", { step: "month", from: "2026-07-01", to: "2026-10-03" }) as { points: { date: string; total: number }[] };
    expect(s.points.map((p) => p.date)).toEqual(["2026-07-31", "2026-08-31", "2026-09-30", "2026-10-03"]);
    const r = await demo.lire("budget-summary", { month: "2026-10" }) as { wealth: { total: number } };
    expect(s.points.at(-1)!.total).toBeCloseTo(r.wealth.total, 0);
  });
});
