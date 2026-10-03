import { describe, expect, it } from "vitest";
import { resumeMetrique, seaux, serieMetrique } from "../src/donnees/corps";

const R = [
  { date: "2026-10-01", hrv: 50 }, { date: "2026-10-02", hrv: 60 }, { date: "2026-10-04", hrv: 40 }, { date: "2026-10-05", hrv: null },
];

describe("Corps : séries des cartes (#689)", () => {
  it("seaux : n jours jusqu'au jour inclus, regroupés par semaine ISO ou mois", () => {
    expect(seaux("2026-10-05", 3, "jour").map((s) => s.cle)).toEqual(["2026-10-03", "2026-10-04", "2026-10-05"]);
    const s = seaux("2026-10-05", 10, "semaine");
    expect(s.map((x) => [x.cle, x.jours.length])).toEqual([["2026-09-21", 2], ["2026-09-28", 7], ["2026-10-05", 1]]);
    expect(seaux("2026-10-02", 5, "mois").map((x) => x.cle)).toEqual(["2026-09", "2026-10"]);
  });
  it("vue Jour : valeur du jour, faisceau et moyenne sur 7 jours glissants, trous gardés", () => {
    const p = serieMetrique(R, "hrv", seaux("2026-10-05", 5, "jour"), "jour");
    expect(p.map((x) => x.valeur)).toEqual([50, 60, null, 40, null]);
    expect(p[4]).toMatchObject({ bas: 40, haut: 60, ligne: 50, nb: 0 });
  });
  it("vue Semaine : moyenne, minimum et maximum de la période", () => {
    const p = serieMetrique(R, "hrv", seaux("2026-10-04", 7, "semaine"), "semaine");
    expect(p[p.length - 1]).toMatchObject({ valeur: 50, bas: 40, haut: 60, nb: 3 });
  });
  it("résumé : dernière valeur connue et statistiques", () => {
    expect(resumeMetrique(R, "hrv", "2026-10-05", 30)).toEqual({ dernier: { date: "2026-10-04", v: 40 }, moyenne: 50, min: 40, max: 60, nb: 3 });
  });
});
