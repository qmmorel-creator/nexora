import { describe, expect, it } from "vitest";
import { ErreurLectureSeule, ecritureAutorisee, exigerEcriture } from "../src/donnees/garde";
import { CLES_ECRITURE_OUVERTES } from "../src/donnees/config";

describe("garde d'écriture", () => {
  it("clés ouvertes : tâches et archive (#655), journal, habitudes et préférences Futur (#669)", () => {
    expect([...CLES_ECRITURE_OUVERTES].sort()).toEqual(["nexora:activityLog", "nexora:futurPrefs", "nexora:habitLog", "nexora:habitSkips", "nexora:taskArchive", "nexora:tasks"]);
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
