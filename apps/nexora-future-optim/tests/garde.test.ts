import { describe, expect, it } from "vitest";
import { ErreurLectureSeule, ecritureAutorisee, exigerEcriture } from "../src/donnees/garde";
import { CLES_ECRITURE_OUVERTES } from "../src/donnees/config";

describe("garde d'écriture", () => {
  it("clés ouvertes : tâches et archive (#655), journal, habitudes (#669), préférences propres au site (#687), réglages de Nexora (03/10/2026)", () => {
    expect([...CLES_ECRITURE_OUVERTES].sort()).toEqual(["nexora:activityLog", "nexora:habitLog", "nexora:habitSkips", "nexora:habitThemes", "nexora:optimPrefs", "nexora:projectFolders", "nexora:projects",
      "nexora:sportGoals", "nexora:statuses", "nexora:taskArchive", "nexora:taskDefaults", "nexora:taskTemplates", "nexora:taskTypes", "nexora:tasks", "nexora:teamMembers", "nexora:teams"]);
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
