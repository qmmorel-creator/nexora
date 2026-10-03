import { describe, expect, it } from "vitest";
import { ErreurLectureSeule, ecritureAutorisee, exigerEcriture } from "../src/donnees/garde";
import { CLES_ECRITURE_OUVERTES } from "../src/donnees/config";

describe("garde d'écriture", () => {
  it("clés ouvertes : tâches et archive (#655), journal, habitudes et préférences Futur (#669), réglages de projet et d'habitudes (#663)", () => {
    expect([...CLES_ECRITURE_OUVERTES].sort()).toEqual([
      "nexora:activityLog", "nexora:favorites", "nexora:futurPrefs", "nexora:habitLog", "nexora:habitSkips", "nexora:habitThemes",
      "nexora:projectFolders", "nexora:projects", "nexora:statuses", "nexora:taskArchive", "nexora:taskDefaults", "nexora:taskTemplates", "nexora:taskTypes", "nexora:tasks",
    ]);
  });
  it("finances, équipe et devis restent fermés", () => {
    for (const cle of ["nexora:quotes", "nexora:invoices", "nexora:teamMembers", "nexora:staffing", "nexora:expenses", "nexora:dashboards"]) expect(ecritureAutorisee(cle, CLES_ECRITURE_OUVERTES)).toBe(false);
  });
  it("refuse toute clé non ouverte", () => {
    expect(() => exigerEcriture("nexora:tasks", [])).toThrow(ErreurLectureSeule);
    expect(ecritureAutorisee("", ["nexora:tasks"])).toBe(false);
  });
  it("accepte uniquement une clé explicitement ouverte", () => {
    expect(ecritureAutorisee("nexora:tasks", ["nexora:tasks"])).toBe(true);
    expect(ecritureAutorisee("nexora:projects", ["nexora:tasks"])).toBe(false);
  });
});
