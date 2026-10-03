import { describe, expect, it } from "vitest";
import { ErreurLectureSeule, ecritureAutorisee, exigerEcriture } from "../src/donnees/garde";
import { CLES_ECRITURE_OUVERTES } from "../src/donnees/config";

describe("garde d'écriture", () => {
  it("clés ouvertes : tâches et archive (#655), journal, habitudes et préférences Futur (#669), réglages, équipe et notes (#663)", () => {
    expect([...CLES_ECRITURE_OUVERTES].sort()).toEqual([
      "nexora:activityLog", "nexora:dashboards", "nexora:favorites", "nexora:futurPrefs", "nexora:habitLog", "nexora:habitSkips", "nexora:habitThemes",
      "nexora:metaFilters", "nexora:projectFolders", "nexora:projects", "nexora:sportGoals", "nexora:staffing", "nexora:statuses", "nexora:taskArchive",
      "nexora:taskDefaults", "nexora:taskTemplates", "nexora:taskTypes", "nexora:tasks", "nexora:teamMembers", "nexora:teams", "nexora:todayWidgets", "nexora:workshops",
    ]);
  });
  it("finances, devis, factures et Finance PRO restent fermés", () => {
    for (const cle of ["nexora:quotes", "nexora:invoices", "nexora:proMissions", "nexora:proPayments", "nexora:expenses", "nexora:financeProSettings"]) expect(ecritureAutorisee(cle, CLES_ECRITURE_OUVERTES)).toBe(false);
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
