import { describe, expect, it } from "vitest";
import { pixelTaskDate, pixelTasksForDay } from "../src/nexora/pixel-tasks-nexora";

// Module « Tâches du jour » de Nexora repris tel quel (retour du 03/10/2026) :
// on vérifie que la copie garde les règles de Nexora.
const S = [{ id: "s1", name: "À planifier" }, { id: "s5", name: "Terminé" }];
const J = "2026-10-03";
describe("Pixel Tasks repris de Nexora", () => {
  it("une tâche s'affiche à une seule date (jalon : début, durée : fin)", () => {
    expect(pixelTaskDate({ milestone: true, start: "2026-10-05", end: "2026-10-09" })).toBe("2026-10-05");
    expect(pixelTaskDate({ start: "2026-10-01", end: "2026-10-09" })).toBe("2026-10-09");
    expect(pixelTaskDate({ start: "", end: "NaN-NaN-NaN" })).toBeNull();
  });
  it("retards reportés sur aujourd'hui, fantômes hors score", () => {
    const ts = [
      { id: "a", statusId: "s1", start: "2026-09-20", end: "2026-09-25" },
      { id: "b", statusId: "s1", start: "2026-10-01", end: "2026-10-10" },
      { id: "c", statusId: "s5", end: J },
    ];
    const r = pixelTasksForDay(ts, J, J, S, { ghosts: true });
    expect(r.items.find((x) => x.task.id === "a")).toMatchObject({ carried: true, lateDays: 8 });
    expect(r.items.find((x) => x.task.id === "b")?.ghost).toBe(true);
    expect([r.done, r.total, r.ghosts]).toEqual([1, 2, 1]);
  });
});
