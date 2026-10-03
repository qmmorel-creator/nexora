import { describe, expect, it } from "vitest";
import { appliquerMutation, CLES } from "../src/donnees/magasin";
import { sourceMemoire } from "../src/donnees/source";
import { archiverTache, restaurerTache, modifier } from "../src/donnees/actions";
import type { Tache } from "../src/donnees/modele";
import { CAT } from "./fixtures";

const T: Tache[] = [{ id: "a", title: "A", projectId: "p1", statusId: "s1" }, { id: "b", title: "B", projectId: "p1", statusId: "s1" }];

async function lancer(src: ReturnType<typeof sourceMemoire>, m: Parameters<typeof appliquerMutation>[1]) {
  await appliquerMutation(src, m, () => CAT, { taches: JSON.stringify(src.valeur(CLES.taches) ?? []), archive: JSON.stringify(src.valeur(CLES.archive) ?? []) }, () => "2026-10-03T10:00:00.000Z");
}

describe("appliquerMutation", () => {
  it("archive puis restaure (aller-retour, deux clés)", async () => {
    const src = sourceMemoire({ [CLES.taches]: T, [CLES.archive]: [] });
    await lancer(src, archiverTache("b"));
    expect((src.valeur(CLES.taches) as Tache[]).map((t) => t.id)).toEqual(["a"]);
    expect((src.valeur(CLES.archive) as Tache[]).map((t) => t.id)).toEqual(["b"]);
    await lancer(src, restaurerTache("b"));
    expect((src.valeur(CLES.taches) as Tache[]).map((t) => t.id).sort()).toEqual(["a", "b"]);
    expect(src.valeur(CLES.archive)).toEqual([]);
  });
  it("horodate une modification et n'écrit pas l'archive inutilement", async () => {
    const src = sourceMemoire({ [CLES.taches]: T, [CLES.archive]: [{ id: "z" }] });
    await lancer(src, modifier("a", { title: "A2" }));
    expect((src.valeur(CLES.taches) as Tache[])[0]).toMatchObject({ title: "A2", lastInteraction: "2026-10-03T10:00:00.000Z" });
    expect((src.valeur(CLES.taches) as Tache[])[1].lastInteraction).toBeUndefined();
  });
  it("refuse d'écrire une clé non ouverte (garde)", async () => {
    const src = sourceMemoire({});
    await expect(src.modifier("nexora:projects", (t) => t)).rejects.toThrow(/lecture seule/);
  });
});

describe("journal écrit par appliquerMutation (#669)", () => {
  it("une modification journalisée ; un champ sans suivi n'écrit rien", async () => {
    const src = sourceMemoire({ [CLES.taches]: T, [CLES.archive]: [] });
    await lancer(src, modifier("a", { statusId: "s5" }));
    expect((src.valeur(CLES.journal) as { type: string; taskId: string; at: string }[]).map((e) => [e.type, e.taskId, e.at])).toEqual([["completed", "a", "2026-10-03T10:00:00.000Z"]]);
    await lancer(src, modifier("b", { title: "B2" }));
    expect((src.valeur(CLES.journal) as unknown[]).length).toBe(1);
  });
  it("archiver journalise « deleted », comme Nexora actuel", async () => {
    const src = sourceMemoire({ [CLES.taches]: T, [CLES.archive]: [], [CLES.journal]: [{ id: "old", type: "created", taskId: "z", at: "2026-01-01T00:00:00.000Z" }] });
    await lancer(src, archiverTache("b"));
    expect((src.valeur(CLES.journal) as { type: string; taskId: string }[]).map((e) => `${e.taskId}:${e.type}`)).toEqual(["b:deleted", "z:created"]);
  });
  it("un échec du journal est signalé sans annuler la modification", async () => {
    const src = sourceMemoire({ [CLES.taches]: T, [CLES.archive]: [] });
    const enPanne = { modifier: (cle: string, f: (t: string) => string) => (cle === CLES.journal ? Promise.reject(new Error("réseau")) : src.modifier(cle, f)) };
    const r = await appliquerMutation(enPanne, modifier("a", { assignee: "Q" }), () => CAT, { taches: JSON.stringify(T), archive: "[]" });
    expect(r.journal).toBe("réseau");
    expect((src.valeur(CLES.taches) as Tache[])[0].assignee).toBe("Q");
  });
});
