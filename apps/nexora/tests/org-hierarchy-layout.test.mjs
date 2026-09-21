import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// #243 : même règle que les autres suites — la fonction testée est extraite
// de l'interface RÉELLEMENT construite, entre les sentinelles dédiées.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:ORGHIER-LAYOUT:START ===";
const END = "// === NEXORA:ORGHIER-LAYOUT:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc du layout par contour introuvable dans .build/index.html");

const { orgHierLayoutSiblings } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { orgHierLayoutSiblings };\n})`
)();

const GAP = 18;
// Contour d'une simple feuille de largeur w (une seule profondeur).
const leaf = (w) => ({ left: [-w / 2], right: [w / 2] });
// Contour d'un sous-arbre à deux profondeurs : un panneau étroit (parentW) en
// haut, mais très large (childrenW) une fois qu'on descend d'un niveau — le
// cas typique d'une équipe avec beaucoup d'enfants, cité par #243.
const wideBelow = (parentW, childrenW) => ({
  left: [-parentW / 2, -childrenW / 2],
  right: [parentW / 2, childrenW / 2],
});

test("orgHierLayoutSiblings : deux feuilles simples gardent l'écart standard", () => {
  const { offsets } = orgHierLayoutSiblings([leaf(100), leaf(100)], GAP);
  assert.equal(offsets[0], 0);
  assert.equal(offsets[1], 100 / 2 + GAP + 100 / 2); // 118
});

test("orgHierLayoutSiblings : un sous-arbre large EN PROFONDEUR ne pousse pas son voisin feuille aussi loin qu'un rectangle englobant le ferait", () => {
  // Reproduit le cas de la capture #243 : une équipe « Resp » avec des
  // enfants larges (400px de profondeur), à côté d'une équipe racine
  // simple sans enfant (juste un panneau de 220px).
  const parentW = 220;
  const childrenW = 400;
  const { offsets, mergedRight } = orgHierLayoutSiblings([wideBelow(parentW, childrenW), leaf(parentW)], GAP);
  // Avec l'ancien algorithme « rectangle englobant » (subtreeCross), le
  // voisin aurait été décalé de subtreeCross(large)/2 + GAP + subtreeCross(leaf)/2,
  // soit childrenW/2 + GAP + parentW/2 — ici 200 + 18 + 110 = 328.
  const oldRectangleOffset = childrenW / 2 + GAP + parentW / 2;
  // Avec le contour, seule la profondeur 0 (les deux panneaux eux-mêmes,
  // 220px chacun) doit respecter le gap : le voisin peut donc s'approcher
  // bien plus près, sans jamais chevaucher le panneau parent lui-même.
  const expectedContourOffset = parentW / 2 + GAP + parentW / 2; // 240
  assert.equal(offsets[1], expectedContourOffset);
  assert.ok(offsets[1] < oldRectangleOffset, "le contour doit resserrer nettement par rapport au rectangle englobant");
  // L'écart resserré est significatif : au moins 20 % plus étroit ici.
  assert.ok(offsets[1] <= oldRectangleOffset * 0.8);
  // Le contour fusionné doit malgré tout couvrir toute la largeur réelle du
  // sous-arbre large à la profondeur où il s'étale (aucun chevauchement
  // réel n'est introduit par le resserrement).
  assert.equal(mergedRight[1], childrenW / 2);
});

test("orgHierLayoutSiblings : jamais de chevauchement réel à une profondeur partagée", () => {
  // Deux sous-arbres larges en profondeur des deux côtés : le gap standard
  // doit être respecté à la profondeur où les deux s'étalent, même si leurs
  // propres nœuds (profondeur 0) sont étroits.
  const a = wideBelow(100, 300);
  const b = wideBelow(100, 300);
  const { offsets } = orgHierLayoutSiblings([a, b], GAP);
  const gapAtDepth1 = offsets[1] + b.left[1] - a.right[1];
  assert.ok(gapAtDepth1 >= GAP - 1e-9);
});

test("orgHierLayoutSiblings : un seul sous-arbre reste à l'offset 0", () => {
  const { offsets, mergedLeft, mergedRight } = orgHierLayoutSiblings([leaf(80)], GAP);
  assert.deepEqual(offsets, [0]);
  assert.deepEqual(mergedLeft, [-40]);
  assert.deepEqual(mergedRight, [40]);
});
