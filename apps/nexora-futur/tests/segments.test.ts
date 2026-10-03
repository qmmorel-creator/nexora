import { describe, expect, it } from "vitest";
import { analyserJson, reconstituer } from "../src/donnees/segments";

describe("stockage segmenté", () => {
  it("lit une valeur en ligne", () => {
    expect(reconstituer("k", { value: "[1,2]" }, [])).toBe("[1,2]");
  });
  it("recolle les segments dans l'ordre", () => {
    const m = { storageMode: "chunked-v1", chunkIds: ["a", "b"], revision: "r1", totalLength: 7 };
    expect(reconstituer("k", m, [{ parentKey: "k", revision: "r1", chunk: "[1,2" }, { parentKey: "k", revision: "r1", chunk: ",3]" }])).toBe("[1,2,3]");
  });
  it("refuse un segment absent ou d'une autre révision", () => {
    const m = { storageMode: "chunked-v1", chunkIds: ["a"], revision: "r1" };
    expect(() => reconstituer("k", m, [null])).toThrow(/absent/);
    expect(() => reconstituer("k", m, [{ parentKey: "k", revision: "r0", chunk: "x" }])).toThrow(/autre révision/);
  });
  it("refuse une longueur incohérente", () => {
    const m = { storageMode: "chunked-v1", chunkIds: ["a"], revision: "r1", totalLength: 10 };
    expect(() => reconstituer("k", m, [{ parentKey: "k", revision: "r1", chunk: "abc" }])).toThrow(/3\/10/);
  });
  it("signale un JSON invalide", () => {
    expect(analyserJson("k", "", [])).toEqual([]);
    expect(() => analyserJson("k", "{", [])).toThrow(/illisible/);
  });
});
