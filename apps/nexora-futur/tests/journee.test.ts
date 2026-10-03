import { describe, expect, it } from "vitest";
import { aCaser, angleMinute, minuteDuPoint, premierCreneau, echeancesDuJour, evenementsDuJour, glissent, horizon, modeParHeure, pointsAttention, termineesLe } from "../src/donnees/journee";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const J = "2026-10-03";
const T: Tache[] = [
  { id: "a", title: "Point hebdo", projectId: "p1", statusId: "s3", taskTypeId: "tt3", start: J, end: J, startTime: "08:30", endTime: "09:00" },
  { id: "b", title: "Revue", projectId: "p1", statusId: "s3", start: J, end: J, startTime: "08:45", endTime: "10:00" },
  { id: "c", title: "Après", projectId: "p1", statusId: "s1", start: J, end: J, startTime: "14:00" },
  { id: "d", title: "Échéance du jour", projectId: "p1", statusId: "s1", start: "2026-09-30", end: J },
  { id: "e", title: "En retard", projectId: "p1", statusId: "s1", start: "2026-08-01", end: "2026-08-15" },
  { id: "f", title: "Fini aujourd'hui", projectId: "p1", statusId: "s5", start: J, end: J, completedAt: "2026-10-03T09:12:00Z" },
  { id: "g", title: "Réunion sans CR", projectId: "p1", statusId: "s5", taskTypeId: "tt3", start: "2026-09-29", end: "2026-09-29" },
  { id: "h", title: "Agenda", projectId: "cal", statusId: "s1", start: "2026-09-01", end: "2026-09-01" },
  { id: "i", title: "Jalon", projectId: "p2", statusId: "s1", start: "2026-10-05", end: "2026-10-05", milestone: true },
];

describe("fil du jour", () => {
  it("mode selon l'heure", () => {
    expect([modeParHeure(7), modeParHeure(11), modeParHeure(18), modeParHeure(19)]).toEqual(["matin", "journee", "journee", "soir"]);
  });
  it("évènements horaires, chevauchements en colonnes, fin par défaut +60 min", () => {
    const ev = evenementsDuJour(T, J);
    expect(ev.map((e) => [e.t.id, e.debut, e.fin, e.colonne, e.colonnes])).toEqual([["a", 510, 540, 0, 2], ["b", 525, 600, 1, 2], ["c", 840, 900, 0, 1]]);
  });
  it("échéances, à caser (hors calendrier), horizon", () => {
    expect(echeancesDuJour(T, J, CAT).map((t) => t.id)).toEqual(["d"]);
    expect(aCaser(T, J, CAT).map((t) => t.id)).toEqual(["e", "d"]);
    const h = horizon(T, J, CAT, 3);
    expect(h.map((x) => [x.jour, x.elements.map((t) => t.id)])).toEqual([[J, ["a", "b", "c", "d"]], ["2026-10-04", []], ["2026-10-05", ["i"]]]);
  });
  it("bilan du soir", () => {
    expect(termineesLe(T, J, CAT).map((t) => t.id)).toEqual(["f"]);
    expect(glissent(T, J, CAT).map((t) => t.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("points d'attention : retards, réunions sans compte rendu", () => {
    expect(pointsAttention(T, J, CAT).map((p) => [p.genre, p.t.id])).toEqual([["retard", "e"], ["compte-rendu", "g"]]);
  });
});

describe("cadran (Ref #678)", () => {
  it("midi en haut, minuit en bas, 6 h à gauche, 18 h à droite", () => {
    const p = (m: number) => [Math.round(Math.cos(angleMinute(m)) * 100) + 0, Math.round(Math.sin(angleMinute(m)) * 100) + 0];
    expect(p(720)).toEqual([0, -100]);
    expect(p(0)).toEqual([0, 100]);
    expect(p(360)).toEqual([-100, 0]);
    expect(p(1080)).toEqual([100, 0]);
  });
  it("le point visé donne la minute, calée au quart d'heure", () => {
    expect(minuteDuPoint(0, -10)).toBe(720);
    expect(minuteDuPoint(10, 0)).toBe(1080);
    expect(minuteDuPoint(-10, 0)).toBe(360);
    expect(minuteDuPoint(0, 10)).toBe(0);
    const a = angleMinute(10 * 60 + 37);
    expect(minuteDuPoint(Math.cos(a), Math.sin(a))).toBe(10 * 60 + 30);
  });
  it("premier créneau libre après l'heure donnée", () => {
    const ev = [{ debut: 600, fin: 720 }, { debut: 750, fin: 810 }];
    expect(premierCreneau(ev, 610)).toBe(810);
    expect(premierCreneau(ev, 500)).toBe(510);
    expect(premierCreneau(ev, 610, 30)).toBe(720);
    expect(premierCreneau(ev, 20 * 60 + 10)).toBeNull();
  });
});
