import { describe, expect, it } from "vitest";
import { archiver, basculerTerminee, creerTache, dupliquer, horodater, modifierTache, normaliserHeures, recalerDependances, restaurer, statutSuivant, RefusOperation } from "../src/donnees/operations";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const J = "2026-10-03";
const base: Tache[] = [
  { id: "a", title: "FOR-0129", projectId: "p1", statusId: "s3", taskTypeId: "tt1", start: "2026-07-20", end: "2026-08-20" },
  { id: "b", title: "PV DREAL", projectId: "p1", statusId: "s1", taskTypeId: "tt1", start: "2026-08-01", end: "2026-08-15", dependsOn: ["a"] },
];

describe("création", () => {
  it("applique les défauts de nexora-project", () => {
    const { tache } = creerTache([], { title: "  Relancer BC " }, CAT, J, "x1");
    expect(tache).toMatchObject({ id: "x1", title: "Relancer BC", projectId: "p1", statusId: "s1", taskTypeId: "tt1", start: J, end: "2026-10-08", progress: 0, criticality: null });
    expect(tache.comparison).toEqual({ enabled: true, referenceStart: J, referenceEnd: "2026-10-08" });
  });
  it("une seule date fournie : début = fin", () => {
    expect(creerTache([], { title: "x", end: "2026-10-09" }, CAT, J).tache).toMatchObject({ start: "2026-10-09", end: "2026-10-09" });
  });
  it("type Information : statut imposé", () => {
    expect(creerTache([], { title: "x", taskTypeId: "tt4", statusId: "s3" }, CAT, J).tache.statusId).toBe("s6");
  });
  it("refuse un titre vide", () => {
    expect(() => creerTache([], { title: "  " }, CAT, J)).toThrow(RefusOperation);
  });
});

describe("dépendances (part-001:11643)", () => {
  it("recale le début sur la fin la plus tardive, en gardant la durée", () => {
    const r = recalerDependances(base);
    expect(r.find((t) => t.id === "b")).toMatchObject({ start: "2026-08-20", end: "2026-09-03" });
  });
  it("ne touche à rien si déjà conforme (même référence)", () => {
    const ok = [{ ...base[0] }, { ...base[1], start: "2026-08-21", end: "2026-08-22" }];
    expect(recalerDependances(ok)).toBe(ok);
  });
});

describe("modification", () => {
  it("jalon : fin = début ; projet secondaire identique effacé", () => {
    const r = modifierTache(base, "a", { milestone: true, secondaryProjectId: "p1" }, CAT);
    expect(r[0]).toMatchObject({ start: "2026-07-20", end: "2026-07-20", secondaryProjectId: "" });
  });
  it("refuse une tâche de projet calendrier", () => {
    expect(() => modifierTache([{ id: "g", projectId: "cal" }], "g", { title: "x" }, CAT)).toThrow(/Google Calendar/);
  });
  it("heures : fin absente → début + 60 min", () => {
    expect(normaliserHeures({ start: J, end: J, startTime: "14:00", endTime: "" })).toMatchObject({ endTime: "15:00" });
    expect(normaliserHeures({ start: J, end: J, startTime: "23:30", endTime: "" })).toMatchObject({ endTime: "23:59" });
    expect(normaliserHeures({ start: J, end: J, startTime: "", endTime: "10:00" })).toMatchObject({ startTime: "", endTime: "" });
  });
});

describe("terminer et récurrence (part-001:11852)", () => {
  it("bascule terminé / en cours avec l'avancement", () => {
    const { taches } = basculerTerminee(base, "a", CAT);
    expect(taches[0]).toMatchObject({ statusId: "s5", progress: 100 });
    expect(basculerTerminee(taches, "a", CAT).taches[0]).toMatchObject({ statusId: "s3", progress: 50 });
  });
  it("crée l'occurrence suivante (mois = 30 jours), checklist décochée", () => {
    const t: Tache = { id: "r", title: "Point hebdo", projectId: "p1", statusId: "s3", start: "2026-10-01", end: "2026-10-02", recurrence: { unit: "month", interval: 1 }, checklist: [{ id: "c", text: "x", done: true }] };
    const { occurrence } = basculerTerminee([t], "r", CAT);
    expect(occurrence).toMatchObject({ start: "2026-10-31", end: "2026-11-01", progress: 0, statusId: "s1" });
    expect(occurrence?.checklist?.[0].done).toBe(false);
    expect(occurrence?.id).not.toBe("r");
  });
  it("refuse pour un type à statut imposé", () => {
    expect(() => basculerTerminee([{ id: "i", projectId: "p1", taskTypeId: "tt4", statusId: "s6" }], "i", CAT)).toThrow(/automatique/);
  });
});

describe("horodatage (part-001:8283)", () => {
  it("completedAt posé au passage à Terminé, retiré à la réouverture", () => {
    const T = "2026-10-03T10:00:00.000Z";
    const fini = horodater(base, basculerTerminee(base, "a", CAT).taches, CAT, T);
    expect(fini[0]).toMatchObject({ completedAt: T, lastInteraction: T });
    expect(fini[1]).toBe(base[1]);
    const rouvert = horodater(fini, basculerTerminee(fini, "a", CAT).taches, CAT, T);
    expect(rouvert[0].completedAt).toBeUndefined();
  });
});

describe("statut suivant, archive, duplication", () => {
  it("fait défiler les statuts ouverts du projet", () => {
    expect(statutSuivant({ id: "x", projectId: "p2", statusId: "s1" }, CAT)).toBe("s3");
    expect(statutSuivant({ id: "x", projectId: "p2", statusId: "s6" }, CAT)).toBe("s1");
  });
  it("archive puis restaure à l'identique", () => {
    const a = archiver(base, [], "b", "2026-10-03T10:00:00Z");
    expect(a.taches.map((t) => t.id)).toEqual(["a"]);
    expect(a.archive[0]).toMatchObject({ id: "b", archivedAt: "2026-10-03T10:00:00Z" });
    const r = restaurer(a.taches, a.archive, "b");
    expect(r.archive).toEqual([]);
    expect(r.taches.find((t) => t.id === "b")).toEqual(base[1]);
  });
  it("duplique en « (copie) », statut par défaut, sans référence ni source", () => {
    const { tache } = dupliquer([{ ...base[0], source: "gmail", comparison: { enabled: true } }], "a", CAT);
    expect(tache).toMatchObject({ title: "FOR-0129 (copie)", statusId: "s1", progress: 0, comparison: null, source: null });
  });
});
