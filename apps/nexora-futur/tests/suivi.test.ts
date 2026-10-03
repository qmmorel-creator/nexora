import { describe, expect, it } from "vitest";
import { criticiteTache, densiteMois, empilees, faits, fondConique, grilleCroisee, indicateurs, jauge, niveauCriticite, pixels, squarifier, termineesParSemaine, treemapProjets } from "../src/donnees/suivi";
import type { Catalogues, Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const J = "2026-10-03";
const C: Catalogues = { ...CAT, projets: [{ id: "p1", name: "CTEX6", color: "#d64545", priority: "high" }, { id: "p2", name: "Lot 2B", color: "#7c5cd6" }, { id: "p3", name: "Vide" }] };
const T: Tache[] = [
  { id: "a", projectId: "p1", statusId: "s1", end: "2026-10-01", criticality: "urgent", progress: 20, lastInteraction: "2026-10-03T08:00:00Z" },
  { id: "b", projectId: "p1", statusId: "s5", end: "2026-10-05", milestone: true, start: "2026-10-05", progress: 100, completedAt: "2026-09-30T10:00:00Z" },
  { id: "c", projectId: "p2", statusId: "s3", start: "2026-09-20", end: "2026-10-05", progress: 50, lastInteraction: "2026-10-03T08:00:00Z", comparison: { enabled: true, referenceStart: "2026-09-01", referenceEnd: "2026-10-02" } },
  { id: "d", projectId: "p2", statusId: "s1", lastInteraction: "2026-09-01T08:00:00Z" },
];
const maintenant = new Date("2026-10-03T12:00:00Z");

describe("criticité (part-002:10822)", () => {
  it("poids : retard 40, urgent 25, échéance ≤ 7 j 10, jalon 10, inactivité 10, priorité 15/5 ; terminée = 0", () => {
    expect(criticiteTache(faits(T[0], C, J, maintenant)).score).toBe(40 + 25 + 15);
    expect(criticiteTache(faits(T[1], C, J, maintenant)).score).toBe(0);
    expect(criticiteTache(faits(T[2], C, J, maintenant)).score).toBe(10 + 5);
    expect(criticiteTache(faits(T[3], C, J, maintenant)).score).toBe(10 + 5);
    expect(niveauCriticite(80).libelle).toBe("Critique"); expect(niveauCriticite(49).libelle).toBe("Vigilance"); expect(niveauCriticite(0).libelle).toBe("Maîtrisé");
  });
});

describe("treemap", () => {
  it("tuiles par projet, projet vide masqué ou pesant 12 % du max", () => {
    const r = treemapProjets(T, C, J, "taille", {});
    expect(r.map((x) => [x.projet.id, x.taille, x.retards, x.terminees])).toEqual([["p1", 2, 1, 1], ["p2", 2, 0, 0]]);
    const v = treemapProjets(T, C, J, "taille", {}, true);
    expect(v.find((x) => x.projet.id === "p3")).toMatchObject({ taille: 0, poids: 1 });
    expect(treemapProjets(T, C, J, "derive", {}).find((x) => x.projet.id === "p2")).toMatchObject({ derive: 3, valeur: 3 });
  });
  it("squarified : couvre exactement le rectangle", () => {
    const t = squarifier([{ poids: 6 }, { poids: 6 }, { poids: 4 }, { poids: 3 }, { poids: 2 }, { poids: 2 }, { poids: 1 }], { x: 0, y: 0, w: 600, h: 400 });
    expect(t.length).toBe(7);
    expect(Math.round(t.reduce((s, r) => s + r.w * r.h, 0))).toBe(240000);
    t.forEach((r) => { expect(r.x + r.w).toBeLessThanOrEqual(600.0001); expect(r.y + r.h).toBeLessThanOrEqual(400.0001); });
  });
});

describe("indicateurs et graphiques", () => {
  it("KPI de computeKpiValue", () => {
    expect(indicateurs(T, C, {})).toEqual({ count: 4, avgProgress: Math.round(170 / 4), milestoneCount: 1, urgentCount: 1, avgDrift: 3, overdueVsRefCount: 1, avecReference: 1 });
  });
  it("jauge : avancement moyen (terminée = 100) ou part de terminées", () => {
    expect(jauge(T, C, "doneRatio")).toBe(25);
    expect(jauge(T, C, "avgProgress")).toBe(Math.round((20 + 100 + 50 + 0) / 4));
  });
  it("barres empilées : projet × statut", () => {
    const e = empilees(T, "project", "status", C);
    expect(e.series.map((s) => [s.cle, s.valeur])).toEqual([["s1", 2], ["s3", 1], ["s5", 1]]);
    expect(e.barres.map((b) => [b.cle, b.parts.map((p) => p.valeur)])).toEqual([["p1", [1, 0, 1]], ["p2", [1, 1, 0]]]);
  });
  it("terminées par semaine sur completedAt (lundi → dimanche)", () => {
    const r = termineesParSemaine(T, J, 3);
    expect(r.semaines.map((s) => [s.lundi, s.valeur])).toEqual([["2026-09-14", 0], ["2026-09-21", 0], ["2026-09-28", 1]]);
  });
});

describe("densité", () => {
  it("mois : tâches sur leur fin, couleurs des projets, retard", () => {
    const m = densiteMois(T, C, "2026-10", J, 1)[0];
    expect(m.decalage).toBe(3); // 1er octobre 2026 = jeudi
    expect(m.jours[0]).toMatchObject({ date: "2026-10-01", couleurs: ["#d64545"], retard: true });
    expect(m.jours[4].couleurs).toEqual(["#d64545", "#7c5cd6"]);
    expect(fondConique(["#a", "#b"])).toBe("conic-gradient(from 45deg, #a 0% 50%, #b 50% 100%)");
  });
  it("croisée : projet × mois, cases vides absentes, sans échéance à part", () => {
    const g = grilleCroisee(T, C, J, "project", "month", "count");
    expect(g.lignes.map((l) => l.id)).toEqual(["p1", "p2"]);
    expect(g.colonnes.map((c) => c.libelle)).toEqual(["oct. 26", "Sans échéance"]);
    expect(g.cellule("p2", "2026-10")?.valeur).toBe(1);
    expect(g.cellule("p2", "__none")?.valeur).toBe(1);
    expect(g.cellule("p1", "__none")).toBeNull();
    expect(grilleCroisee(T, C, J, "project", "status", "late").cellule("p1", "s1")?.valeur).toBe(1);
  });
  it("pixels : date du jalon ou de fin ; la période en cours reprend les retards", () => {
    const p = pixels(T, C, J, "semaine", "project", 4);
    expect(p.courante).toBe("2026-09-28");
    const p1 = p.lignes.find((l) => l.cle === "p1")!;
    const cour = p1.cases.find((c) => c.debut === "2026-09-28")!;
    expect(cour.taches.map((t) => t.id)).toEqual(["a"]);
    const suiv = p1.cases.find((c) => c.debut === "2026-10-05")!;
    expect(suiv.taches.map((t) => t.id)).toEqual(["b"]);
  });
});

import { analyserMarkdown, notesTableaux, segmentsEnLigne } from "../src/donnees/notes";
describe("notes des tableaux de bord (lecture)", () => {
  it("collecte les widgets note, pages et ancien format à plat", () => {
    const n = notesTableaux([{ name: "Pilotage", pages: [{ name: "Semaine", widgets: [{ id: "w1", type: "note", title: "À retenir", content: "# Titre" }, { id: "w2", type: "chart" }, { id: "w3", type: "note", content: "  " }] }] }, { name: "Ancien", widgets: [{ id: "w4", type: "note", content: "x" }] }], { pages: [{ name: "Matin", widgets: [{ id: "w5", type: "note", content: "y" }] }] });
    expect(n.map((x) => [x.id, x.tableau, x.page, x.titre])).toEqual([["w5", "Aujourd'hui", "Matin", "Note"], ["w1", "Pilotage", "Semaine", "À retenir"], ["w4", "Ancien", "", "Note"]]);
  });
  it("Markdown : titres, cases, encadré, tableau ; liens non http ignorés", () => {
    const b = analyserMarkdown("# Titre\n- [x] fait\n- [ ] à faire\n:::callout-warning Attention\nTexte **gras**\n:::\n| a | b |\n|---|---|\n| 1 | 2 |\nfin");
    expect(b.map((x) => x.genre)).toEqual(["titre", "liste", "encadre", "tableau", "paragraphe"]);
    expect((b[1] as { elements: { coche?: boolean }[] }).elements.map((e) => e.coche)).toEqual([true, false]);
    expect((b[3] as { lignes: string[][] }).lignes).toEqual([["a", "b"], ["1", "2"]]);
    const seg = segmentsEnLigne("voir [doc](https://x.fr) et [js](javascript:alert(1))");
    expect(seg.filter((s) => s.genre === "lien")).toEqual([{ genre: "lien", texte: "doc", url: "https://x.fr" }]);
  });
});
describe("pixels : score", () => {
  it("une tâche reportée n'est comptée qu'une fois", () => {
    const p = pixels([{ id: "x", projectId: "p1", statusId: "s1", end: "2026-09-22" }, { id: "y", projectId: "p1", statusId: "s5", end: "2026-09-30" }], C, J, "semaine", "project", 4);
    expect(p.lignes[0].cases.flatMap((c) => c.taches).map((t) => t.id).sort()).toEqual(["x", "x", "y"]);
    expect(p.score).toBe(50);
  });
});
