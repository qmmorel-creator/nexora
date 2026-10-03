import { describe, expect, it } from "vitest";
import { activitesDe, avancementObjectifs, bornes, calendrier, cleRegroupement, duree, filtrer, graduationsRondes, libelleRegroupement, nomsSports, normaliserObjectifs, resume, seriesEmpilees, type Activite } from "../src/donnees/sport";

const A = (date: string, sport: string, total: number | null, distance: number | null = null): Activite => ({ id: `${date}|${sport}`, date, sport, title: "", total, moving: null, distance, elevation: null, hr: null, maxHr: null, url: null });
const rows = [A("2026-09-28", "Course", 60, 10), A("2026-09-30", "Vélo", 90, 40), A("2026-10-01", "Course", 30, 5), A("2026-09-22", "Course", 45, 8), A("2026-09-21", "Vélo", null), A("2026-01-05", "Course", 40, 7)];

describe("Sport (#660, port de NEXORA:SPORT)", () => {
  it("bornes des périodes (semaine du lundi au dimanche)", () => {
    expect(bornes("week", "2026-10-03")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(bornes("month", "2026-10-03")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(bornes("previousMonth", "2026-10-03")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(bornes("7", "2026-10-03")).toEqual({ from: "2026-09-27", to: "2026-10-03" });
    expect(bornes("all", "2026-10-03")).toEqual({ from: "", to: "" });
    expect(filtrer(rows, "week", "2026-10-03", ["Course"]).length).toBe(2);
  });
  it("regroupements et libellés (semaine ISO)", () => {
    expect(cleRegroupement("2026-10-03", "week")).toBe("2026-09-28");
    expect(libelleRegroupement("2026-09-28", "week")).toBe("S40 2026");
    expect(libelleRegroupement("2026-10", "month")).toBe("oct. 2026");
    expect(graduationsRondes(13)).toEqual([0, 5, 10, 15]);
    expect(graduationsRondes(9)).toEqual([0, 2, 4, 6, 8, 10]);
  });
  it("barres empilées : périodes vides gardées, valeurs manquantes comptées", () => {
    const s = seriesEmpilees(rows, { periode: "30", mesure: "total", regroupement: "week" }, "2026-10-03", nomsSports(rows));
    expect(s.barres.map((b) => b.key)).toEqual(["2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"]);
    expect(s.barres[4].values).toEqual({ Course: 1.5, Vélo: 1.5 });
    expect(s.missing).toBe(1);
    expect(s.sports.map((x) => x.name)).toEqual(["Course", "Vélo"]);
  });
  it("résumé : semaine comparée à la précédente au même jour", () => {
    const r = resume(rows, "2026-10-03", "year", nomsSports(rows));
    expect(r.derniere?.date).toBe("2026-10-01");
    expect(r.ilYaJours).toBe(2);
    expect(r.semaine).toEqual({ count: 3, hours: 3, km: 55, elevation: 0 });
    expect(r.semainePrec.count).toBe(2);
    expect(duree(65)).toBe("1 h 05"); expect(duree(null)).toBe("—");
  });
  it("objectifs : heures de la semaine et rythme des km annuels", () => {
    const o = avancementObjectifs(rows, normaliserObjectifs({ weeklyHours: "4", yearlyKm: [{ id: "g", label: "", sports: ["Course"], km: 100 }, { id: "bad" }] }), "2026-10-03");
    expect(o.hebdo).toEqual({ cible: 4, fait: 3, ratio: 0.75, reste: 1 });
    expect(o.annuels).toHaveLength(1);
    expect(o.annuels[0]).toMatchObject({ libelle: "Course", fait: 30 });
    expect(Math.round(o.annuels[0].attendu * 100) / 100).toBe(75.62);
  });
  it("calendrier : facettes à plusieurs sports, teinte selon la durée", () => {
    const c = calendrier([...rows, A("2026-10-01", "Vélo", 120)], "2026", ["Course", "Vélo"]);
    const j = c.jours.find((x) => x.date === "2026-10-01")!;
    expect(j.sports).toEqual(["Vélo", "Course"]);
    expect(j.fond.startsWith("conic-gradient(from 45deg")).toBe(true);
    expect(j.teinte).toBe(1);
    expect(c.jours[0].dow).toBe(3);
  });
  it("réponse invalide refusée", () => {
    expect(() => activitesDe({})).toThrow("Réponse Sport invalide.");
    expect(activitesDe({ activities: [{ date: "2026-10-01", sport: "X", total: "12" }, { date: "bad" }] })).toHaveLength(1);
  });
});
