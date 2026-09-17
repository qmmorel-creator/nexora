import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/* Plafond d'affichage du Mini-Gantt (#115).

   Le diagramme montrait au plus vingt barres et douze jalons — y compris dans
   la VUE Gantt, qui occupe la page entière. Des tâches visibles dans le Tableur
   et dans le Métro n'y apparaissaient donc pas, sans que rien ne le dise, y
   compris à statut identique. Le plafond reste celui des tuiles de tableau de
   bord ; la vue, elle, montre tout.

   Mêmes règles que les autres suites du Mini-Gantt : la fonction testée est
   extraite de l'interface RÉELLEMENT construite, entre les sentinelles du bloc. */
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:GANTT-ANNOTATIONS:START ===";
const END = "// === NEXORA:GANTT-ANNOTATIONS:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc d'annotations Gantt introuvable dans .build/index.html");

const EXPORTS = ["miniGanttCapRows", "MINIGANTT_WIDGET_MAX_BARS", "MINIGANTT_WIDGET_MAX_MILESTONES"];
const { miniGanttCapRows, MINIGANTT_WIDGET_MAX_BARS, MINIGANTT_WIDGET_MAX_MILESTONES } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const AUJOURDHUI = "2026-09-17";
const jour = (n) => {
  const d = new Date(Date.UTC(2026, 8, 17));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// Barre de trois jours, décalée de `n` jours par rapport à aujourd'hui.
const barre = (id, n) => ({ id, title: id, start: jour(n), end: jour(n + 3), milestone: false });
const ids = (list) => list.map((t) => t.id);

test("les plafonds sont ceux d'une tuile de tableau de bord", () => {
  assert.equal(MINIGANTT_WIDGET_MAX_BARS, 20);
  assert.equal(MINIGANTT_WIDGET_MAX_MILESTONES, 12);
});

test("sous le plafond, la liste revient ENTIÈRE et triée", () => {
  const lignes = [barre("c", 4), barre("a", 0), barre("b", 2)];
  assert.deepEqual(ids(miniGanttCapRows(lignes, 20, "start", AUJOURDHUI)), ["a", "b", "c"]);
});

test("au-delà du plafond, l'à-venir passe avant le passé", () => {
  // Trente tâches passées, trois à venir : c'est le cas qui faisait disparaître
  // tout le futur d'un widget chargé d'historique.
  const passees = Array.from({ length: 30 }, (_, i) => barre("p" + i, -100 - i));
  const futures = [barre("f1", 1), barre("f2", 5), barre("f3", 9)];
  const gardees = miniGanttCapRows([...passees, ...futures], 20, "start", AUJOURDHUI);
  assert.equal(gardees.length, 20);
  ["f1", "f2", "f3"].forEach((id) => assert.ok(ids(gardees).includes(id), id + " doit rester affichée"));
  // Le passé retenu est le plus RÉCENT, jamais le plus ancien.
  assert.ok(ids(gardees).includes("p0"));
  assert.ok(!ids(gardees).includes("p29"));
});

test("la vue plein écran ne plafonne RIEN : `Infinity` rend tout", () => {
  const lignes = Array.from({ length: 250 }, (_, i) => barre("t" + i, i - 125));
  const gardees = miniGanttCapRows(lignes, Infinity, "start", AUJOURDHUI);
  assert.equal(gardees.length, 250);
  // Et la liste reste triée, comme sous plafond.
  assert.deepEqual(ids(gardees), ids([...lignes].sort((a, b) => a.start.localeCompare(b.start))));
});

test("un jalon s'ordonne par sa date de fin, la seule qu'il porte", () => {
  const jalon = (id, n) => ({ id, title: id, start: jour(n), end: jour(n), milestone: true });
  const lignes = [jalon("m2", 5), jalon("m1", 1), jalon("m3", 9)];
  assert.deepEqual(ids(miniGanttCapRows(lignes, 12, "end", AUJOURDHUI)), ["m1", "m2", "m3"]);
});

// --- Câblage dans l'interface ----------------------------------------------
test("la VUE Gantt lève le plafond, le widget le garde", () => {
  // La vue passe `showAllRows` ; aucun widget enregistré ne le porte.
  assert.match(html, /showAllRows\s*\n\s*groupBy=\{widget\.groupBy\}/);
  assert.match(html, /bubbleMode, showAllRows \}\) \{/);
  assert.match(
    html,
    /const rowLimits = showAllRows\s*\n\s*\? \{ bars: Infinity, milestones: Infinity \}\s*\n\s*: \{ bars: MINIGANTT_WIDGET_MAX_BARS, milestones: MINIGANTT_WIDGET_MAX_MILESTONES \};/
  );
  // Plus aucun plafond écrit en dur dans le rendu des lignes.
  assert.match(html, /miniGanttCapRows\(tasks\.filter\(\(t\) => !t\.milestone && t\.start && t\.end\), barLimit, "start"/);
  assert.match(html, /miniGanttCapRows\(tasks\.filter\(\(t\) => t\.milestone && t\.end\), milestoneLimit, "end"/);
});

test("ce qui n'est pas affiché est COMPTÉ et dit", () => {
  // Le silence était la moitié du défaut : une tâche absente du diagramme ne se
  // distinguait pas d'une tâche qu'aucun filtre ne retient.
  assert.match(html, /const hiddenCount = useMemo\(\(\) => \{/);
  assert.match(html, /lp-widget-minigantt-hidden-note/);
  // Les jalons masqués par le réglage « afficher les jalons » ne comptent pas :
  // ils sont cachés à la demande.
  assert.match(html, /const considered = showMilestones \? \(tasks \|\| \[\]\) : \(tasks \|\| \[\]\)\.filter\(\(t\) => !t\.milestone\);/);
});
