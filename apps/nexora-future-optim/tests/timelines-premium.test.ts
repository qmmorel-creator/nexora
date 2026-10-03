// Timelines premium (Ref #688) : styles déclarés partout, couleurs normalisées.
import { describe, expect, it } from "vitest";
import { normaliserPrefs, STYLES_GANTT } from "../src/donnees/prefs";
import { hex6, STYLES_PREMIUM } from "../src/optim/timelines-premium.mjs";

describe("timelines premium", () => {
  it("chaque style premium est un style de Gantt enregistrable", () => {
    for (const s of STYLES_PREMIUM) expect(STYLES_GANTT as readonly string[]).toContain(s);
  });
  it("un style premium enregistré est relu tel quel, un style inconnu retombe sur le défaut", () => {
    expect(normaliserPrefs({ gantt: "niveaux" }).gantt).toBe("niveaux");
    expect(normaliserPrefs({ gantt: "lentilles" }).gantt).toBe(normaliserPrefs({}).gantt);
  });
  it("hex6 accepte #rgb, #rrggbb et rgb(), sinon gris ardoise", () => {
    expect(hex6("#abc")).toBe("#aabbcc");
    expect(hex6("#2F6FD6")).toBe("#2F6FD6");
    expect(hex6("rgb(10, 20, 30)")).toBe("#0a141e");
    expect(hex6("var(--x)")).toBe("#5b6b82");
    expect(hex6(undefined)).toBe("#5b6b82");
  });
});
