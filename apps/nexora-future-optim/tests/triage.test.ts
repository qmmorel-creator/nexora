import { describe, expect, it } from "vitest";
import { REGLES_DEFAUT, cartesTriage, jourLibre, nettoyerReports, normaliserRegles, projetProbable, relaisPour, type Contexte } from "../src/donnees/triage";
import { fusionnerPrefs, normaliserPrefs } from "../src/donnees/prefs";

const J = "2026-10-03"; // samedi
const base = (taches: Contexte["taches"], extra: Partial<Contexte> = {}): Contexte => ({
  jour: J, maintenant: new Date("2026-10-03T08:00:00Z"), taches,
  projets: [{ id: "p1", name: "CTEX6" }, { id: "p2", name: "Lot 2B" }, { id: "pt", name: "Inbox", folderId: "folder-a-trier" }, { id: "cal", name: "Agenda", gcalSource: true }],
  statuts: [{ id: "s1", name: "À faire" }, { id: "s5", name: "Terminé" }], types: [{ id: "tt1", name: "Tâches" }, { id: "tt3", name: "Réunions" }],
  membres: [{ id: "a", name: "Alice", teamIds: ["e"] }, { id: "b", name: "Bruno", teamIds: ["e"] }, { id: "c", name: "Chloé", teamIds: ["x"] }],
  journalHabitudes: [], nonApplicables: [], themesHabitudes: [], ...extra,
});
const vieux = "2026-09-01T00:00:00Z";

describe("Triage par règles (#661)", () => {
  it("retard : seulement au-delà de N jours de retard ET d'inactivité ; terminées et calendriers exclus", () => {
    const c = cartesTriage(base([
      { id: "r1", title: "Vieux retard", projectId: "p1", statusId: "s1", end: "2026-09-20", assignee: "Alice", lastInteraction: vieux },
      { id: "r2", title: "Retard récent", projectId: "p1", statusId: "s1", end: "2026-10-01", lastInteraction: vieux },
      { id: "r3", title: "Retard mais actif", projectId: "p1", statusId: "s1", end: "2026-09-20", lastInteraction: "2026-10-02T10:00:00Z" },
      { id: "r4", title: "Fait", projectId: "p1", statusId: "s5", end: "2026-09-20" },
      { id: "r5", title: "Agenda", projectId: "cal", statusId: "s1", end: "2026-09-20" },
    ]), REGLES_DEFAUT, "matin");
    expect(c.map((x) => x.tacheId)).toEqual(["r1"]);
    expect(c[0].motif).toBe("En retard de 13 jours, sans activité depuis plus de 3 jours (réglage : 3 j)");
    expect(c[0].choix.map((x) => x.touche)).toEqual(["Entrée", "R", "F", "N", "A"]);
    expect(c[0].choix[1].action).toEqual({ genre: "reassigner", id: "r1", qui: "Bruno" });
  });
  it("jour libre : premier jour ouvré sans tâche active (week-end sauté)", () => {
    const ctx = base([{ id: "x", title: "Occupé lundi", projectId: "p1", statusId: "s1", start: "2026-10-05", end: "2026-10-05", assignee: "Alice" }]);
    expect(jourLibre(ctx, "Alice")).toBe("2026-10-06");
    expect(jourLibre(ctx, undefined)).toBe("2026-10-05");
    expect(relaisPour(ctx, "Chloé")).toBeNull();
  });
  it("ranger : projet nommé dans le titre, sinon le plus fréquent de la personne ; assistant avant sans projet", () => {
    const taches = [
      { id: "a1", title: "Relancer le BE sur ctex6", statusId: "s1", source: "assistant", end: "2026-10-10" },
      { id: "a2", title: "Appeler Paul", projectId: "pt", statusId: "s1", assignee: "Alice", end: "2026-10-10" },
      { id: "h1", title: "x", projectId: "p2", statusId: "s1", assignee: "Alice", end: "2026-10-20" },
    ];
    const ctx = base(taches);
    expect(projetProbable(ctx, taches[0])).toEqual({ id: "p1", raison: "« CTEX6 » est dans le titre" });
    expect(projetProbable(ctx, taches[1])).toEqual({ id: "p2", raison: "projet le plus fréquent de Alice" });
    const c = cartesTriage(ctx, REGLES_DEFAUT, "matin");
    expect(c.map((x) => `${x.regle}:${x.tacheId}`)).toEqual(["assistant:a1", "sans-projet:a2"]);
    expect(c[0].choix[0].action).toEqual({ genre: "projet", id: "a1", projectId: "p1" });
  });
  it("dépendance qui bloque un jalon, réunion sans compte rendu, tâche sans date", () => {
    const c = cartesTriage(base([
      { id: "j", title: "Dépôt DP", projectId: "p1", statusId: "s1", milestone: true, start: "2026-10-10", end: "2026-10-10", dependsOn: ["d"] },
      { id: "d", title: "Note de calcul", projectId: "p1", statusId: "s1", start: "2026-10-01", end: "2026-10-12", lastInteraction: "2026-10-02T00:00:00Z" },
      { id: "m", title: "Réunion chantier", projectId: "p1", statusId: "s1", taskTypeId: "tt3", start: "2026-10-01", end: "2026-10-01", meetingReport: "" },
      { id: "m2", title: "Réunion avec CR", projectId: "p1", statusId: "s1", taskTypeId: "tt3", end: "2026-10-01", meetingReport: "Fait." },
      { id: "s", title: "Sans date", projectId: "p2", statusId: "s1" },
    ]), REGLES_DEFAUT, "matin");
    expect(c.map((x) => x.regle)).toEqual(["dependance", "reunion", "sans-date"]);
    expect(c[0].choix[0].action).toEqual({ genre: "dater", id: "d", date: "2026-10-09" });
    expect(c[1].choix[0].action).toEqual({ genre: "ouvrir", id: "m" });
  });
  it("opérations : proposition seulement si la catégorie suggérée est complète", () => {
    const op = (id: string, category: string, subcategory: string | null) => ({ id, date: "2026-10-01", label: id, amount: -12, type: "Dépense", account: "CC", category, subcategory, confidence: 0.8, reason: "confiance" });
    const c = cartesTriage(base([], { operations: [op("o1", "Courses", null), op("o2", "Logement", null)], categories: [{ name: "Courses", subcategories: [] }, { name: "Logement", subcategories: ["Loyer"] }, { name: "Loisirs", subcategories: [] }] }), REGLES_DEFAUT, "matin");
    expect(c[0].choix[0]).toMatchObject({ touche: "Entrée", action: { genre: "categoriser", category: "Courses" } });
    expect(c[1].choix[0].touche).toBe("1");
    expect(c[1].proposition).toBe("Aucune catégorie sûre : choisir ou ouvrir Finances");
  });
  it("habitude manquée N jours de suite (non applicables sautés), thème à choix unique ignoré", () => {
    const themes = [{ id: "t", name: "Santé", color: "#000", selectionMode: "multi" as const, habits: [{ id: "h", name: "Étirements", color: "#0a0", kind: "check" as const, min: 0, max: 10 }, { id: "k", name: "Lecture", color: "#00a", kind: "check" as const, min: 0, max: 10 }] },
      { id: "l", name: "Lieu", color: "#000", selectionMode: "single" as const, habits: [{ id: "b", name: "Bureau", color: "#00f", kind: "check" as const, min: 0, max: 10 }] }];
    const journal = [{ id: "h|2026-09-28", habitId: "h", date: "2026-09-28" }, { id: "k|2026-10-02", habitId: "k", date: "2026-10-02" }, { id: "k|2026-09-01", habitId: "k", date: "2026-09-01" }, { id: "b|2026-09-01", habitId: "b", date: "2026-09-01" }];
    const c = cartesTriage(base([], { themesHabitudes: themes, journalHabitudes: journal, nonApplicables: [{ id: "h|2026-10-01", habitId: "h", date: "2026-10-01" }] }), REGLES_DEFAUT, "matin");
    expect(c.map((x) => x.titre)).toEqual(["Étirements : 3 jours manqués"]);
    expect(c[0].choix.find((x) => x.touche === "X")?.action).toEqual({ genre: "habitude", habitId: "h", date: "2026-10-02", na: true });
  });
  it("sport en retard sur le rythme ; soir : échéances du jour", () => {
    const sport = cartesTriage(base([], { sport: { cible: 5, fait: 1 } }), REGLES_DEFAUT, "matin");
    expect(sport.map((x) => x.regle)).toEqual(["sport"]);
    expect(cartesTriage(base([], { sport: { cible: 5, fait: 4 } }), REGLES_DEFAUT, "matin")).toEqual([]);
    const soir = cartesTriage(base([{ id: "g", title: "Due aujourd'hui", projectId: "p1", statusId: "s1", end: J, assignee: "Alice" }]), REGLES_DEFAUT, "soir");
    expect(soir.map((x) => x.cle)).toEqual(["glisse:g:2026-10-03"]);
    expect(soir[0].choix[0].action).toEqual({ genre: "dater", id: "g", date: "2026-10-05" });
  });
  it("règles réglables, reports échus oubliés, règle désactivée sans carte", () => {
    const t = [{ id: "s", title: "Sans date", projectId: "p2", statusId: "s1" }];
    expect(cartesTriage(base(t), { ...REGLES_DEFAUT, actives: { ...REGLES_DEFAUT.actives, "sans-date": false } }, "matin")).toEqual([]);
    expect(cartesTriage(base(t), REGLES_DEFAUT, "matin", { "sans-date:s": "2026-10-06" })).toEqual([]);
    expect(nettoyerReports({ a: "2026-10-03", b: "2026-10-04", c: 3 }, J)).toEqual({ b: "2026-10-04" });
    expect(normaliserRegles({ retardJours: 500, actives: { retard: false } })).toMatchObject({ retardJours: 90, actives: { retard: false, sport: true } });
    const p = fusionnerPrefs({ inconnu: 1 }, { triage: { regles: REGLES_DEFAUT, reports: { x: "2026-10-09" } } });
    expect(p.inconnu).toBe(1);
    expect(normaliserPrefs(p).triage.reports).toEqual({ x: "2026-10-09" });
  });
});
