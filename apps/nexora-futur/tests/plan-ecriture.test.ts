import { describe, expect, it } from "vitest";
import { ErreurConflit, LIMITE_SEGMENT, idSegment, planifierEcriture } from "../src/donnees/plan-ecriture";
import { reconstituer } from "../src/donnees/segments";

const T = "2026-10-03T12:00:00.000Z";

describe("plan d'écriture (port de nexoraDirectStorage.set)", () => {
  it("écrit en ligne une petite valeur, avec la source navigateur", () => {
    const ops = planifierEcriture("nexora:tasks", "[]", null, null, T, "r2");
    expect(ops).toEqual([{ type: "ecrire", id: "nexora:tasks", donnees: { value: "[]", updatedAt: T, revision: "r2", source: "browser", storageMode: "inline", chunkCount: 0, totalLength: 2 } }]);
  });
  it("refuse si la révision distante a changé depuis la lecture", () => {
    expect(() => planifierEcriture("k", "x", "r1", { revision: "r9" }, T, "r2")).toThrow(ErreurConflit);
  });
  it("refuse si la session n'a jamais lu une clé existante", () => {
    expect(() => planifierEcriture("k", "x", undefined, { revision: "r1" }, T, "r2")).toThrow(/n'a pas chargé/);
  });
  it("refuse si la clé est apparue depuis une lecture « absente »", () => {
    expect(() => planifierEcriture("k", "x", null, { revision: "r1" }, T, "r2")).toThrow(ErreurConflit);
  });
  it("utilise updatedAt comme jeton quand revision manque (manifestes anciens)", () => {
    expect(() => planifierEcriture("k", "x", "2026-01-01", { updatedAt: "2026-01-01" }, T, "r2")).not.toThrow();
  });
  it("découpe en segments, supprime l'ancienne génération, et se relit à l'identique", () => {
    const texte = "a".repeat(LIMITE_SEGMENT * 2 + 10);
    const ancien = { storageMode: "chunked-v1", chunkIds: ["k--nexora-chunk--r1-0000"], revision: "r1" };
    const ops = planifierEcriture("k", texte, "r1", ancien, T, "r2");
    expect(ops[0]).toEqual({ type: "supprimer", id: "k--nexora-chunk--r1-0000" });
    const segs = ops.filter((o) => o.type === "ecrire" && o.id !== "k");
    expect(segs.map((o) => o.id)).toEqual([0, 1, 2].map((i) => idSegment("k", "r2", i)));
    const man = ops.find((o) => o.type === "ecrire" && o.id === "k");
    if (!man || man.type !== "ecrire") throw new Error("manifeste absent");
    expect(man.donnees).toMatchObject({ value: null, storageMode: "chunked-v1", chunkCount: 3, totalLength: texte.length, revision: "r2" });
    const relu = reconstituer("k", man.donnees as never, segs.map((o) => (o.type === "ecrire" ? o.donnees : null)) as never);
    expect(relu).toBe(texte);
  });
});
