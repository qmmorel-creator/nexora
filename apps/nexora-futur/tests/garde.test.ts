import { describe, expect, it } from "vitest";
import { ErreurLectureSeule, ecritureAutorisee, exigerEcriture } from "../src/donnees/garde";
import { CLES_ECRITURE_OUVERTES } from "../src/donnees/config";

describe("garde d'écriture", () => {
  it("seules les tâches et l'archive sont ouvertes (lot 2, #655)", () => {
    expect([...CLES_ECRITURE_OUVERTES].sort()).toEqual(["nexora:taskArchive", "nexora:tasks"]);
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
