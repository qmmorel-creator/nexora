// Phrase (Ref #708) : tests portés de apps/nexora-futur/tests/phrase.test.ts ; seul le dernier
// cas est adapté aux préférences d'Optim (nexora:optimPrefs, sans « frise » de Futur).
import { describe, expect, it } from "vitest";
import { DEFAUTS, calcul, choisir, cle, epingler, MAX_TUILES, normaliserPhrase, options, texte, type Contexte, type Phrase } from "../src/donnees/phrase";
import { fusionnerPrefs, normaliserPrefs } from "../src/donnees/prefs";
import type { Tache } from "../src/donnees/modele";
import type { SyntheseBudget } from "../src/donnees/finance";
import { CAT } from "./fixtures";

const J = "2026-10-03";
const t = (id: string, x: Partial<Tache>): Tache => ({ id, title: id, projectId: "p1", statusId: "s1", taskTypeId: "tt1", start: "2026-09-01", end: J, ...x });
const budget = (mois: string, actual: number): SyntheseBudget => ({ month: mois, tracking: [{ category: "Logement", budget: 1000, actual, remaining: 1000 - actual, over: actual > 1000 }, { category: "Loisirs", budget: 100, actual: 50, remaining: 50, over: false }],
  catalogs: { accounts: [], categories: [{ name: "Logement", subcategories: [] }, { name: "Loisirs", subcategories: [] }] } } as unknown as SyntheseBudget);
const ctx = (x: Partial<Contexte> = {}): Contexte => ({
  ...CAT, aujourdhui: J, membresEquipe: [{ id: "m1", name: "Vincent B.", capacityPerDay: 1 }],
  taches: [t("a", { end: "2026-09-20", assignee: "Vincent B." }), t("b", { end: "2026-09-25", assignee: "Vincent B.", projectId: "p2" }), t("c", { end: "2026-10-05" }), t("d", { end: "2026-09-01", statusId: "s5" }), t("e", { end: "2026-09-01", projectId: "cal" })],
  themesHabitudes: [{ id: "th", name: "Santé", color: "#0a0", selectionMode: "multi", habits: [{ id: "h1", name: "Eau", color: "#0af", kind: "check", min: 0, max: 1 }] }],
  journalHabitudes: [{ id: `h1|${J}`, habitId: "h1", date: J }, { id: "h1|2026-10-02", habitId: "h1", date: "2026-10-02" }], nonApplicables: [{ id: "h1|2026-10-01", habitId: "h1", date: "2026-10-01" }],
  sport: [{ id: "s", date: "2026-10-01", sport: "Course", title: "", total: 45, moving: 40, distance: 8, elevation: 0, hr: null, maxHr: null, url: null }],
  budget: (m) => (m === "2026-10" ? budget(m, 900) : m === "2026-09" ? budget(m, 1200) : m === "2026-08" ? budget(m, 400) : null), ...x,
});

describe("Phrase (Ref #679)", () => {
  it("tâches : retards hors calendriers, filtre par personne et par projet", () => {
    const r = calcul(DEFAUTS, ctx());
    expect(r.chiffre).toBe("2");
    expect(r.phrase).toBe("tâches, dont 2 pour Vincent B.");
    expect(calcul({ ...DEFAUTS, ou: "p2" }, ctx()).chiffre).toBe("1");
    expect(calcul({ ...DEFAUTS, etat: "semaine" }, ctx()).chiffre).toBe("1");
    expect(calcul({ ...DEFAUTS, etat: "faites" }, ctx()).chiffre).toBe("1");
    expect(options("ou", ctx()).map((o) => o[0])).toEqual(["tous", "p1", "p2"]);
  });
  it("dépenses : somme des mois de la période, filtre par catégorie, attente puis erreur", () => {
    expect(calcul({ ...DEFAUTS, quoi: "depenses" }, ctx()).chiffre).toBe("950 €");
    const trois = calcul({ ...DEFAUTS, quoi: "depenses", per: "trois", cat: "Logement" }, ctx());
    expect(trois.chiffre).toBe("2\u202f500 €");
    expect(trois.phrase).toBe("dépensés sur 3\u202f000 € budgétés, il reste 500 €");
    expect(calcul({ ...DEFAUTS, quoi: "depenses", per: "dernier", cat: "Logement" }, ctx()).phrase).toMatch(/budget dépassé/);
    expect(calcul({ ...DEFAUTS, quoi: "depenses" }, ctx({ budget: () => null })).detail.type).toBe("attente");
    expect(calcul({ ...DEFAUTS, quoi: "depenses" }, ctx({ budget: () => "erreur" })).chiffre).toBe("—");
  });
  it("sport, charge, habitudes", () => {
    const s = calcul({ ...DEFAUTS, quoi: "sport" }, ctx());
    expect([s.chiffre, s.phrase]).toEqual(["45 min", "1 séance cette semaine"]);
    expect(calcul({ ...DEFAUTS, quoi: "sport" }, ctx({ sport: null })).chiffre).toBe("…");
    const c = calcul({ ...DEFAUTS, quoi: "charge", qui2: "Vincent B." }, ctx());
    expect(c.detail.type === "grille" && c.detail.lignes[0].cases.length).toBe(7);
    const h = calcul({ ...DEFAUTS, quoi: "habitudes", perH: "7" }, ctx());
    expect(h.chiffre).toBe("33 %"); // 2 faits sur 6 jours applicables (un « non applicable »)
  });
  it("texte, clé et changement de modèle", () => {
    expect(texte(DEFAUTS, ctx())).toBe("Montre les tâches en retard de tout le monde sur tous les projets");
    const dep = choisir({ ...DEFAUTS, qui: "Vincent B." }, "quoi", "depenses");
    expect(dep).toEqual({ ...DEFAUTS, quoi: "depenses" });
    expect(cle({ ...DEFAUTS, cat: "Loisirs" })).toBe(cle(DEFAUTS)); // mot sans objet pour les tâches
    expect(cle({ ...DEFAUTS, qui: "Vincent B." })).not.toBe(cle(DEFAUTS));
  });
  it("préférences : vues et tuiles normalisées, fusion sans perte", () => {
    const n = normaliserPhrase({ vues: [{ id: "v1", nom: " Retards ", ph: { quoi: "taches", qui: "X", inconnu: 3 } }, { id: "v2", nom: "", ph: DEFAUTS }, { id: "v3", nom: "Bad", ph: { quoi: "rien" } }], tuiles: [DEFAUTS, { quoi: "x" }] });
    expect(n.vues).toEqual([{ id: "v1", nom: "Retards", ph: { ...DEFAUTS, qui: "X" } }]);
    expect(n.tuiles).toEqual([DEFAUTS]);
    let p = n; for (let i = 0; i < 8; i++) p = epingler(p, { ...DEFAUTS, etat: String(i) } as Phrase);
    expect(p.tuiles.length).toBe(MAX_TUILES);
    expect(epingler(p, p.tuiles[0])).toBe(p);
    const fus = fusionnerPrefs({ gantt: "niveaux", inconnu: 1 }, { phrase: n });
    expect(fus.inconnu).toBe(1);
    expect(normaliserPrefs(fus).phrase).toEqual(n);
    expect(normaliserPrefs(fus).gantt).toBe("niveaux");
    expect(normaliserPrefs(fus).vues).toEqual([]); // vues de Planning et Projets : séparées, intactes
  });
});
