import { describe, expect, it } from "vitest";
import { ajouterAuJournal, entreesJournal, PLAFOND_JOURNAL, type EntreeJournal } from "../src/donnees/journal";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const AT = "2026-10-03T10:00:00.000Z";
let n = 0; const id = () => `e${++n}`;
const types = (l: EntreeJournal[]) => l.map((e) => `${e.taskId}:${e.type}`);

describe("journal d'activité (port de part-001:11405)", () => {
  it("création, statut, terminée, rouverte, réaffectation, échéance, suppression", () => {
    const avant: Tache[] = [
      { id: "a", title: "A", statusId: "s1", projectId: "p1" }, { id: "b", title: "B", statusId: "s1" }, { id: "c", title: "C", statusId: "s5" },
      { id: "d", title: "D", assignee: "Vincent", end: "2026-10-05" }, { id: "x", title: "X" },
    ];
    const apres: Tache[] = [
      { id: "a", title: "A", statusId: "s3", projectId: "p1" }, { id: "b", title: "B", statusId: "s5" }, { id: "c", title: "C", statusId: "s1" },
      { id: "d", title: "D", assignee: "Quentin", end: "2026-10-07" }, { id: "n", title: "N" },
    ];
    const e = entreesJournal(avant, apres, CAT.statuts, AT, id);
    expect(types(e)).toEqual(["a:statusChanged", "b:completed", "c:reopened", "d:reassigned", "d:deadlineChanged", "n:created", "x:deleted"]);
    expect(e.find((x) => x.type === "reassigned")).toMatchObject({ from: "Vincent", to: "Quentin", at: AT, taskTitle: "D" });
    expect(e.find((x) => x.type === "deadlineChanged")).toMatchObject({ fromDate: "2026-10-05", toDate: "2026-10-07", milestone: false });
  });
  it("bloquée / débloquée selon les dépendances terminées", () => {
    const avant: Tache[] = [{ id: "p", statusId: "s1" }, { id: "q", dependsOn: [] }];
    const bloque = entreesJournal(avant, [{ id: "p", statusId: "s1" }, { id: "q", dependsOn: ["p"] }], CAT.statuts, AT, id);
    expect(types(bloque)).toEqual(["q:blocked"]);
    const debloque = entreesJournal([{ id: "p", statusId: "s1" }, { id: "q", dependsOn: ["p"] }], [{ id: "p", statusId: "s5" }, { id: "q", dependsOn: ["p"] }], CAT.statuts, AT, id);
    expect(types(debloque)).toEqual(["p:completed", "q:unblocked"]);
  });
  it("rien à journaliser quand seuls d'autres champs changent", () => {
    expect(entreesJournal([{ id: "a", title: "A" }], [{ id: "a", title: "A2", desc: "x" }], CAT.statuts, AT, id)).toEqual([]);
  });
  it("dédoublonne une entrée identique de moins de 5 minutes (Nexora actuel ouvert)", () => {
    const existant: EntreeJournal[] = [{ id: "z", type: "completed", taskId: "b", at: "2026-10-03T09:57:00.000Z" }, { id: "y", type: "reassigned", taskId: "d", from: "V", to: "Q", at: "2026-10-03T09:59:00.000Z" }];
    const neuves: EntreeJournal[] = [
      { id: "1", type: "completed", taskId: "b", at: AT }, // doublon (3 min)
      { id: "2", type: "reassigned", taskId: "d", from: "V", to: "R", at: AT }, // valeurs différentes
      { id: "3", type: "reopened", taskId: "b", at: AT },
    ];
    expect(ajouterAuJournal(existant, neuves).map((e) => e.id)).toEqual(["2", "3", "z", "y"]);
    const vieux: EntreeJournal[] = [{ id: "z", type: "completed", taskId: "b", at: "2026-10-03T09:54:00.000Z" }];
    expect(ajouterAuJournal(vieux, [neuves[0]]).map((e) => e.id)).toEqual(["1", "z"]);
  });
  it("plafond de 2 000 entrées, les plus récentes en tête", () => {
    const plein = Array.from({ length: PLAFOND_JOURNAL }, (_, i) => ({ id: `o${i}`, type: "created", taskId: `t${i}`, at: "2026-01-01T00:00:00.000Z" }));
    const r = ajouterAuJournal(plein, [{ id: "neuf", type: "created", taskId: "n", at: AT }]);
    expect(r.length).toBe(PLAFOND_JOURNAL);
    expect(r[0].id).toBe("neuf");
    expect(r[r.length - 1].id).toBe(`o${PLAFOND_JOURNAL - 2}`);
  });
});
