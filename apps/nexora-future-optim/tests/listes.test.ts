// Listes déroulantes (retour du 03/10/2026) : recherche, « Tout cocher » (avec limite), « Tout décocher ».
import { describe, expect, it } from "vitest";
import { filtrerOptions, toutCocher, toutDecocher } from "../src/optim/ListeCoches";

const O = [{ id: "a", libelle: "Lot 2B" }, { id: "b", libelle: "Énergie" }, { id: "c", libelle: "Communication", groupe: "Com" }, { id: "d", libelle: "Désactivé", desactive: true }];
describe("listes à cases", () => {
  it("recherche sans accents ni casse, aussi sur le groupe", () => {
    expect(filtrerOptions(O, "energie").map((o) => o.id)).toEqual(["b"]);
    expect(filtrerOptions(O, "COM").map((o) => o.id)).toEqual(["c"]);
    expect(filtrerOptions(O, "  ")).toHaveLength(4);
  });
  it("tout cocher ajoute les visibles non désactivés, sans dépasser la limite", () => {
    expect(toutCocher(["c"], O)).toEqual(["c", "a", "b"]);
    expect(toutCocher([], O, 2)).toEqual(["a", "b"]);
    expect(toutCocher(["a", "b"], O, 2)).toEqual(["a", "b"]);
  });
  it("tout décocher ne retire que les visibles", () => {
    expect(toutDecocher(["a", "b", "c"], filtrerOptions(O, "lot"))).toEqual(["b", "c"]);
    expect(toutDecocher(["a", "b"], O)).toEqual([]);
  });
});
