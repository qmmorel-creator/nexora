import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/* Hauteur d'un widget sur un tableau de bord (#119).

   Comme les autres suites, les fonctions testées sont extraites de l'interface
   RÉELLEMENT construite, entre les sentinelles du bloc « grille ». Aucune copie
   du code n'est maintenue à côté : si le bloc change, ces tests suivent. */
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:DASHBOARD-GRID:START ===";
const END = "// === NEXORA:DASHBOARD-GRID:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de grille introuvable dans .build/index.html");

const EXPORTS = [
  "DASHBOARD_COLS", "DASHBOARD_ROW_H", "DASHBOARD_GAP",
  "DASHBOARD_MIN_ROWS", "DASHBOARD_MAX_ROWS",
  "clampWidgetRows", "dashboardRowsToPx",
];
const {
  DASHBOARD_ROW_H, DASHBOARD_GAP,
  DASHBOARD_MIN_ROWS, DASHBOARD_MAX_ROWS,
  clampWidgetRows, dashboardRowsToPx,
} = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

test("le plafond de hauteur ne se rencontre plus en travaillant", () => {
  /* Il valait 12 unités, soit environ 970 px : un widget Bulles ou Gantt de
     trente lignes butait dessus, la poignée descendait et le widget ne
     grandissait plus. Il ne disparaît pas — une valeur infinie ferait d'un
     glissement maladroit un widget de dix écrans — mais il est porté assez
     haut pour qu'on ne le rencontre plus. */
  assert.equal(DASHBOARD_MIN_ROWS, 2);
  assert.ok(DASHBOARD_MAX_ROWS >= 40, "le plafond reste trop bas pour un long diagramme");
  assert.ok(dashboardRowsToPx(DASHBOARD_MAX_ROWS) > 3000, "moins de trois écrans de hauteur possible");
  assert.equal(dashboardRowsToPx(DASHBOARD_MIN_ROWS), (DASHBOARD_ROW_H + DASHBOARD_GAP) * 2 - DASHBOARD_GAP);
});

test("une hauteur est ramenée entre le plancher et le plafond", () => {
  assert.equal(clampWidgetRows(6), 6);
  assert.equal(clampWidgetRows(0), DASHBOARD_MIN_ROWS);
  assert.equal(clampWidgetRows(-40), DASHBOARD_MIN_ROWS);
  assert.equal(clampWidgetRows(9999), DASHBOARD_MAX_ROWS);
  // Une valeur au-delà de l'ancien plafond de 12 passe désormais telle quelle.
  assert.equal(clampWidgetRows(30), 30);
  // Une hauteur n'est jamais fractionnaire : la grille compte en unités.
  assert.equal(clampWidgetRows(7.4), 7);
  assert.equal(clampWidgetRows(NaN), DASHBOARD_MIN_ROWS);
  assert.equal(clampWidgetRows(undefined), DASHBOARD_MIN_ROWS);
});

test("un redimensionnement par le haut garde le bord bas où il est", () => {
  /* Le plafond LOCAL du geste — `y + h` — s'ajoute au plafond global, et c'est
     le plus bas des deux qui gagne : tirer vers le haut ne peut pas faire
     sortir le widget par le sommet de la grille. */
  assert.equal(clampWidgetRows(20, 8), 8);
  assert.equal(clampWidgetRows(5, 8), 5);
  // Un plafond local plus haut que le plafond global ne le relève pas.
  assert.equal(clampWidgetRows(9999, 9999), DASHBOARD_MAX_ROWS);
  // Un plafond local plus bas que le plancher ne peut pas écraser le widget.
  assert.equal(clampWidgetRows(5, 1), DASHBOARD_MIN_ROWS);
});

test("plus aucun plafond de 12 unités recopié dans le code", () => {
  /* Il vivait à QUATRE endroits : les deux calculs de redimensionnement, le
     clamp en pixels de l'aperçu pendant le geste, et le dimensionnement
     automatique. C'est exactement ainsi qu'un plafond survit à sa correction. */
  assert.doesNotMatch(html, /clamp\(h \+ dRows, 2, 12\)/);
  assert.doesNotMatch(html, /\(DASHBOARD_ROW_H\+DASHBOARD_GAP\)\*12-DASHBOARD_GAP/);
  assert.match(html, /h = clampWidgetRows\(h \+ dRows\);/);
  assert.match(html, /const maxHeight=Math\.max\(minHeight,dashboardRowsToPx\(DASHBOARD_MAX_ROWS\)\);/);
  assert.match(html, /const targetHUnits = clampWidgetRows\(/);
});
