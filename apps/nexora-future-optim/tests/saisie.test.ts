import { describe, expect, it } from "vitest";
import { analyserSaisie, lireDate, type ContexteSaisie } from "../src/donnees/saisie";

// Samedi 3 octobre 2026.
const ctx: ContexteSaisie = {
  aujourdhui: "2026-10-03",
  personnes: [{ id: "v", nom: "Vincent B." }, { id: "m", nom: "Maïa Sonnier" }, { id: "q", nom: "Quentin" }],
  projets: [{ id: "p1", nom: "CTEX6" }, { id: "p2", nom: "Lot 2B" }, { id: "p3", nom: "Communication" }],
  types: [{ id: "t1", nom: "Tâches" }, { id: "t2", nom: "Réunions" }],
  criticites: [{ valeur: "urgent", alias: ["urgent", "u", "!"] }, { valeur: "moyen", alias: ["moyen", "m"] }, { valeur: "bas", alias: ["bas", "b"] }],
};

describe("dates", () => {
  it("relatives", () => {
    expect(lireDate("aujourd'hui", ctx.aujourdhui)).toBe("2026-10-03");
    expect(lireDate("demain", ctx.aujourdhui)).toBe("2026-10-04");
    expect(lireDate("vendredi", ctx.aujourdhui)).toBe("2026-10-09");
    expect(lireDate("samedi", ctx.aujourdhui)).toBe("2026-10-10");
    expect(lireDate("lun", ctx.aujourdhui)).toBe("2026-10-05");
    expect(lireDate("+3j", ctx.aujourdhui)).toBe("2026-10-06");
    expect(lireDate("+2s", ctx.aujourdhui)).toBe("2026-10-17");
    expect(lireDate("+1m", "2026-01-31")).toBe("2026-02-28");
  });
  it("absolues", () => {
    expect(lireDate("9/10", ctx.aujourdhui)).toBe("2026-10-09");
    expect(lireDate("15/01", ctx.aujourdhui)).toBe("2027-01-15");
    expect(lireDate("31/02", ctx.aujourdhui)).toBeNull();
    expect(lireDate("9/10/27", ctx.aujourdhui)).toBe("2027-10-09");
    expect(lireDate("bonjour", ctx.aujourdhui)).toBeNull();
  });
});

describe("saisie rapide", () => {
  it("cas complet de la maquette", () => {
    const s = analyserSaisie("Relancer bureau de contrôle vendredi @Vincent #CTEX6 !urgent", ctx);
    expect(s).toMatchObject({ titre: "Relancer bureau de contrôle", start: "2026-10-09", end: "2026-10-09", assignee: "Vincent B.", projectId: "p1", criticality: "urgent" });
    expect(s.inconnus).toEqual([]);
  });
  it("accents et préfixes", () => {
    const s = analyserSaisie("Point charge @maia #lot /reu", ctx);
    expect(s).toMatchObject({ titre: "Point charge", assignee: "Maïa Sonnier", projectId: "p2", taskTypeId: "t2" });
  });
  it("intervalle de dates et heures", () => {
    const s = analyserSaisie("Audit du 5/10 au 9/10 14h-15h30", ctx);
    expect(s).toMatchObject({ titre: "Audit", start: "2026-10-05", end: "2026-10-09", startTime: "14:00", endTime: "15:30" });
  });
  it("mois en lettres", () => {
    expect(analyserSaisie("Copil 12 oct", ctx)).toMatchObject({ titre: "Copil", end: "2026-10-12" });
    expect(analyserSaisie("Bilan dans 2 semaines", ctx)).toMatchObject({ titre: "Bilan", end: "2026-10-17" });
  });
  it("signale ce qui n'est pas reconnu sans l'avaler dans le titre", () => {
    const s = analyserSaisie("Tâche @inconnu #nulpart", ctx);
    expect(s.titre).toBe("Tâche");
    expect(s.inconnus).toEqual(["@inconnu", "#nulpart"]);
  });
  it("garde les nombres ordinaires dans le titre", () => {
    expect(analyserSaisie("Commander 3 palettes", ctx).titre).toBe("Commander 3 palettes");
    expect(analyserSaisie("Lot 2B réunion", ctx).titre).toBe("Lot 2B réunion");
  });
});
