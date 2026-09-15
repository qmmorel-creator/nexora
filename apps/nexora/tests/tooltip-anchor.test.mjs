import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/* Place d'une infobulle (issue #54). La fonction est extraite de l'interface
   RÉELLEMENT construite, entre ses deux sentinelles : aucune copie du code
   n'est maintenue à côté. */
const START = "// === NEXORA:TOOLTIP-ANCHOR:START ===";
const END = "// === NEXORA:TOOLTIP-ANCHOR:END ===";
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de placement d'infobulle introuvable dans dist/index.html");
const { tooltipAnchor } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { tooltipAnchor };\n})`
)();

const fenetre = { viewportWidth: 1000, viewportHeight: 800 };
const place = (patch) => tooltipAnchor({ x: 100, y: 100, width: 200, height: 60, ...fenetre, ...patch });

test("au milieu de la fenêtre, l'infobulle se pose en bas à droite du pointeur", () => {
  assert.deepEqual(place(), { left: 108, top: 108 });
});

test("près du bord droit, elle bascule à gauche du pointeur au lieu de sortir", () => {
  const { left } = place({ x: 950 });
  assert.equal(left, 950 - 200 - 8);
  assert.ok(left + 200 <= 1000, "elle doit tenir entièrement dans la fenêtre");
});

test("près du bord bas, elle bascule au-dessus du pointeur", () => {
  const { top } = place({ y: 780 });
  assert.equal(top, 780 - 60 - 8);
});

test("dans un coin, elle bascule sur les DEUX axes", () => {
  const { left, top } = place({ x: 990, y: 790 });
  assert.equal(left, 990 - 200 - 8);
  assert.equal(top, 790 - 60 - 8);
});

test("elle ne sort jamais par le haut ni par la gauche", () => {
  // Pointeur tout en haut à gauche : la bascule voudrait la poser dans le
  // négatif. C'est le rabattement qui la retient.
  const { left, top } = tooltipAnchor({ x: 2, y: 2, width: 200, height: 60, viewportWidth: 210, viewportHeight: 70 });
  assert.ok(left >= 8, `left = ${left}`);
  assert.ok(top >= 8, `top = ${top}`);
});

test("une infobulle plus large que la fenêtre commence à la marge", () => {
  // Elle déborde des deux côtés : la bascule seule la ferait sortir par la
  // gauche, ce qui coupe le début du texte — le pire des deux.
  const { left } = tooltipAnchor({ x: 300, y: 100, width: 900, height: 60, viewportWidth: 400, viewportHeight: 800 });
  assert.equal(left, 8);
});

test("des dimensions absentes ou aberrantes ne produisent jamais NaN", () => {
  for (const patch of [{ width: undefined }, { height: null }, { viewportWidth: NaN }, { width: -50 }]) {
    const { left, top } = place(patch);
    assert.ok(Number.isFinite(left) && Number.isFinite(top), `left=${left} top=${top} pour ${JSON.stringify(patch)}`);
  }
});
