import { describe, expect, it } from "vitest";
import { budgetProjet, chargeParPersonne, documentsProjet, friseProjet, grilleHabitudes, journalProjet, prochainesEtapes, reunionsProjet, risquesProjet, santeProjet } from "../src/donnees/projet";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const J = "2026-10-03";
const T: Tache[] = [
  { id: "a", title: "FOR-0129", projectId: "p1", statusId: "s3", start: "2026-07-20", end: "2026-08-20", progress: 60, assignee: "Vincent B.", criticality: "urgent", attachments: [{ id: "x", type: "link", name: "Plan", url: "https://drive.google.com/a", provider: "google-drive" }] },
  { id: "b", title: "PV DREAL", projectId: "p1", statusId: "s1", start: "2026-09-01", end: "2026-10-10", dependsOn: ["a"], assignee: "Vincent B.", attachments: [{ id: "y", type: "link", name: "Plan bis", url: "https://drive.google.com/a" }] },
  { id: "c", title: "Visite", projectId: "p1", statusId: "s1", start: "2026-10-07", end: "2026-10-07", milestone: true, taskTypeId: "tt3", assignee: "Quentin Morel" },
  { id: "d", title: "Copil passé", projectId: "p2", secondaryProjectId: "p1", statusId: "s5", taskTypeId: "tt3", start: "2026-09-20", end: "2026-09-20" },
  { id: "e", title: "Autre projet", projectId: "p2", statusId: "s1", end: "2026-10-05", assignee: "Vincent B." },
];

describe("page projet", () => {
  it("santé : avancement moyen (terminées = 100 %), retards, prochaine échéance, jalon", () => {
    const s = santeProjet(T, "p1", CAT, J);
    expect(s).toMatchObject({ total: 4, ouvertes: 3, terminees: 1, retards: 1, avancement: 40 });
    expect([s.prochaine?.id, s.jalon?.id]).toEqual(["c", "c"]);
  });
  it("prochaines étapes triées par échéance", () => {
    expect(prochainesEtapes(T, "p1", CAT).map((t) => t.id)).toEqual(["a", "c", "b"]);
  });
  it("frise 12 semaines bornée à la fenêtre", () => {
    const f = friseProjet(T, "p1", CAT, J);
    expect(f.debut).toBe("2026-09-05");
    // « a » (ouverte) finit avant la fenêtre : épinglée au bord gauche, en retard.
    // « b » commence avant : bornée à 0.
    expect(f.barres.map((b) => [b.t.id, b.debut, b.fin, b.retard])).toEqual([["a", 0, 1, true], ["b", 0, 36, false], ["c", 32, 33, false]]);
  });
  it("réunions à venir et passées (projet secondaire compris)", () => {
    const r = reunionsProjet(T, "p1", CAT, J);
    expect([r.aVenir.map((t) => t.id), r.passees.map((t) => t.id)]).toEqual([["c"], ["d"]]);
  });
  it("budget : port de computeBudgetStats", () => {
    expect(budgetProjet({ budgetInitial: 50000 }, [{ projectId: "p1", amount: 30000, status: "payee" }, { projectId: "p1", amount: "1200" }, { projectId: "p2", amount: 9 }], "p1"))
      .toMatchObject({ actuel: 50000, payee: 30000, engagee: 1200, consomme: 31200, reste: 18800, pct: 62 });
    expect(budgetProjet(undefined, [], "p1")).toMatchObject({ actuel: 0, pct: 0 });
  });
  it("documents dédoublonnés par adresse", () => {
    expect(documentsProjet(T, "p1").map((d) => [d.nom, d.drive])).toEqual([["Plan", true]]);
  });
  it("risques : bloquée, urgente en retard", () => {
    expect(risquesProjet(T, "p1", CAT, J).map((r) => [r.genre, r.t.id])).toEqual([["retard-urgent", "a"], ["bloquee", "b"]]);
  });
  it("journal filtré par projet", () => {
    expect(journalProjet([{ type: "completed", projectId: "p1", taskTitle: "x" }, { type: "created", projectId: "p2" }], "p1").map((a) => a.libelle)).toEqual(["terminée"]);
  });
});

describe("espaces", () => {
  it("charge par personne : retards d'abord, membres sans tâche inclus", () => {
    const c = chargeParPersonne(T, CAT, J);
    // Vincent : échéances le 5 et le 10 octobre, toutes deux dans les 7 jours.
    expect(c.map((x) => [x.nom, x.ouvertes, x.retards, x.semaine])).toEqual([["Vincent B.", 3, 1, 2], ["Quentin Morel", 1, 0, 1]]);
  });
  it("grille d'habitudes : 12 semaines du lundi, futur marqué", () => {
    const g = grilleHabitudes([{ id: "t", name: "x", habits: [{ id: "h1", name: "a" }, { id: "h2", name: "b" }] }], [{ habitId: "h1", date: J }], J);
    expect(g.length).toBe(12);
    const derniere = g[11];
    expect(derniere[0].jour).toBe("2026-09-28");
    expect(derniere[5]).toMatchObject({ jour: J, part: 0.5, futur: false });
    expect(derniere[6].futur).toBe(true);
  });
});
