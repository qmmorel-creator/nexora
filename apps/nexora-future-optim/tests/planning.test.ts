import { describe, expect, it } from "vitest";
import { cheminCritique, comparaison, fenetreFrise, figerReference, graduations, journeeAgenda, lignesFrise, lundiDe, normaliserComparaison, semaineAgenda, syntheseGroupe, trancheHoraire, uniteAxe } from "../src/donnees/planning";
import { decalerDates, modifierPlusieurs } from "../src/donnees/operations";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const S = CAT.statuts;

describe("chemin critique (part-000:3587)", () => {
  it("remonte les prédécesseurs qui finissent le plus tard, toutes les branches à égalité", () => {
    const T: Tache[] = [
      { id: "fin", end: "2026-10-30", dependsOn: ["a", "b", "c"] },
      { id: "a", end: "2026-10-20", dependsOn: ["x"] }, { id: "b", end: "2026-10-20" }, { id: "c", end: "2026-10-10" },
      { id: "x", end: "2026-10-01" }, { id: "hors", end: "2026-10-05" }, { id: "sans-date" },
    ];
    expect([...cheminCritique(T)].sort()).toEqual(["a", "b", "fin", "x"]);
  });
  it("vide sans tâche datée", () => { expect(cheminCritique([{ id: "a" }]).size).toBe(0); });
});

describe("comparaison à la référence (part-002:9227-9420)", () => {
  const t: Tache = { id: "t", start: "2026-10-05", end: "2026-10-12", comparison: { enabled: true, referenceStart: "2026-10-01", referenceEnd: "2026-10-10" } };
  it("écarts : positif = retard, négatif = avance", () => {
    expect(comparaison(t, null)).toMatchObject({ ecartDebut: 4, ecartFin: 2, tonFin: "retard" });
    expect(comparaison({ ...t, end: "2026-10-08" }, null)).toMatchObject({ ecartFin: -2, tonFin: "avance" });
  });
  it("désactivée : aucune comparaison, même avec une baseline", () => {
    expect(comparaison({ ...t, comparison: { enabled: false, referenceEnd: "2026-10-10" } }, { t: { start: "2026-10-01", end: "2026-10-02" } })).toBeNull();
  });
  it("repli sur nexora:taskBaselines seulement sans comparaison posée", () => {
    expect(comparaison({ id: "t", start: "2026-10-05", end: "2026-10-12" }, { t: { start: "2026-10-05", end: "2026-10-10" } })).toMatchObject({ ecartFin: 2 });
    expect(comparaison({ id: "t", start: "2026-10-05", end: "2026-10-12", comparison: null }, { t: { start: "2026-10-05", end: "2026-10-10" } })).toMatchObject({ ecartFin: 2 });
  });
  it("jalon : référence de début = référence de fin", () => {
    expect(comparaison({ id: "j", milestone: true, start: "2026-10-12", end: "2026-10-12", comparison: { enabled: true, referenceEnd: "2026-10-15" } }, null)).toMatchObject({ referenceStart: "2026-10-15", ecartDebut: -3, ecartFin: -3 });
  });
  it("figer : l'ancienne référence part dans l'historique (« Initiale » la première fois) ; mode initiale", () => {
    const f1 = figerReference(t, "2026-10-03")!;
    expect(f1).toMatchObject({ enabled: true, referenceStart: "2026-10-05", referenceEnd: "2026-10-12", capturedAt: "2026-10-03" });
    expect(f1.history).toEqual([{ start: "2026-10-01", end: "2026-10-10", capturedAt: null, label: "Initiale" }]);
    const t2 = { ...t, end: "2026-10-20", comparison: f1 };
    const f2 = figerReference(t2, "2026-10-04")!;
    expect(f2.history.map((h) => h.label)).toEqual(["Initiale", null]);
    expect(comparaison(t2, null, "initiale")).toMatchObject({ referenceEnd: "2026-10-10", ecartFin: 10 });
    expect(comparaison(t2, null, "courante")).toMatchObject({ referenceEnd: "2026-10-12", ecartFin: 8 });
  });
  it("normalisation : rien à garder → null", () => {
    expect(normaliserComparaison({ enabled: false })).toBeNull();
    expect(figerReference({ id: "x", start: "2026-10-01" })).toBeNull();
  });
});

describe("frise", () => {
  const T: Tache[] = [
    { id: "a", start: "2026-10-01", end: "2026-10-10", progress: 50, statusId: "s3" },
    { id: "b", start: "2026-10-05", end: "2026-10-05", milestone: true, statusId: "s5" },
    { id: "c", start: "2026-10-12" }, { id: "d", start: "2026-10-20", end: "2026-10-11", statusId: "s5" },
  ];
  it("barres datées, jalons avec fin, dates inversées remises dans l'ordre", () => {
    expect(lignesFrise(T).map((l) => [l.t.id, l.debut, l.fin, l.jalon])).toEqual([["a", "2026-10-01", "2026-10-10", false], ["b", "2026-10-05", "2026-10-05", true], ["d", "2026-10-11", "2026-10-20", false]]);
  });
  it("synthèse : étendue et avancement pondéré par la durée", () => {
    // a : 10 j à 50 ; b : jalon terminé 1 j à 100 ; d : terminée 10 j à 100.
    expect(syntheseGroupe(lignesFrise(T), S)).toEqual({ debut: "2026-10-01", fin: "2026-10-20", avancement: Math.round((10 * 50 + 100 + 10 * 100) / 21) });
  });
  it("fenêtre et axe", () => {
    const f = fenetreFrise(lignesFrise(T), "2026-10-03");
    expect(f.debut).toBe("2026-09-29");
    expect(uniteAxe(18)).toBe("jour"); expect(uniteAxe(70)).toBe("semaine"); expect(uniteAxe(71)).toBe("mois"); expect(uniteAxe(551)).toBe("trimestre"); expect(uniteAxe(1501)).toBe("annee");
    const g = graduations({ debut: "2026-09-15", jours: 120 });
    expect(g.unite).toBe("mois");
    expect(g.traits.map((x) => x.libelle)).toEqual(["oct.", "nov.", "déc.", "janv. 2027"]);
    const z = fenetreFrise(lignesFrise(T), "2026-10-03", 2);
    expect(z.jours).toBeLessThan(f.jours);
  });
});

describe("agenda (NEXORA:CALENDAR)", () => {
  const L = "2026-09-28";
  const T: Tache[] = [
    { id: "long", title: "Long", start: "2026-09-25", end: "2026-09-30" },
    { id: "deux", title: "Deux", start: "2026-09-29", end: "2026-09-30" },
    { id: "h", title: "Réunion", start: "2026-09-30", end: "2026-09-30", startTime: "09:00", endTime: "10:30" },
    { id: "jour", title: "Journée", end: "2026-09-30" },
    { id: "fini", title: "Fini", end: "2026-09-30", statusId: "s5" },
  ];
  it("lundi de la semaine", () => { expect(lundiDe("2026-10-04")).toBe(L); expect(lundiDe(L)).toBe(L); });
  it("bandeaux sur pistes, journée entière avant les heures, terminées exclues", () => {
    const s = semaineAgenda(T, S, L, 4);
    expect(s.bandeaux.map((b) => [b.t.id, b.col0, b.col1, b.piste, b.coupeDebut])).toEqual([["long", 0, 2, 0, true], ["deux", 1, 2, 1, false]]);
    expect(s.jours[2].taches.map((t) => t.id)).toEqual(["jour", "h"]);
    expect(s.jours[2].total).toBe(4);
  });
  it("case pleine : le reste est compté", () => {
    const s = semaineAgenda(T, S, L, 2);
    expect(s.jours[2]).toMatchObject({ masquees: 2 });
    expect(s.jours[2].taches).toEqual([]);
  });
  it("frise du jour : terminées comprises, tranche horaire", () => {
    const j = journeeAgenda(T, S, "2026-09-30");
    expect(j.horaires.map((x) => [x.t.id, x.debut, x.fin])).toEqual([["h", 540, 630]]);
    expect(j.journee.map((x) => x.t.id)).toEqual(["deux", "fini", "jour", "long"]);
    expect([j.total, j.finies, j.minutesPlanifiees]).toEqual([5, 1, 90]);
    expect(trancheHoraire({ id: "m", start: "2026-09-29", end: "2026-10-01", startTime: "22:00", endTime: "08:00" }, "2026-09-30")).toEqual({ debut: 0, fin: 1440 });
  });
});

describe("édition en masse (part-003:1624)", () => {
  const T: Tache[] = [{ id: "a", projectId: "p1", statusId: "s1", start: "2026-10-01", end: "2026-10-03" }, { id: "g", projectId: "cal", end: "2026-10-02" }, { id: "b", projectId: "p1", statusId: "s1" }];
  it("décale les dates, saute les tâches sans date, refuse Google Calendar", () => {
    const r = modifierPlusieurs(T, ["a", "g", "b"], decalerDates(2), CAT);
    expect(r.taches.find((t) => t.id === "a")).toMatchObject({ start: "2026-10-03", end: "2026-10-05" });
    expect([r.modifiees, r.refusees]).toEqual([1, 1]);
  });
  it("type à statut imposé : le statut suit", () => {
    const r = modifierPlusieurs(T, ["a", "b"], () => ({ taskTypeId: "tt4" }), CAT);
    expect(r.taches.filter((t) => t.projectId === "p1").map((t) => t.statusId)).toEqual(["s6", "s6"]);
  });
});

import { couloirs } from "../src/donnees/planning";
describe("bulles : couloirs", () => {
  it("côte à côte sans chevauchement ; largeur minimale prise en compte", () => {
    const L = lignesFrise([
      { id: "a", start: "2026-10-01", end: "2026-10-03" }, { id: "b", start: "2026-10-04", end: "2026-10-06" },
      { id: "c", start: "2026-10-02", end: "2026-10-05" }, { id: "d", start: "2026-10-05", end: "2026-10-05", milestone: true },
    ]);
    expect(couloirs(L, 1).map((c) => c.map((l) => l.t.id))).toEqual([["a", "b"], ["c"], ["d"]]);
    expect(couloirs(L, 5).map((c) => c.map((l) => l.t.id))).toEqual([["a"], ["c"], ["b"], ["d"]]);
  });
});
