import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Mêmes règles que les autres suites du Gantt : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite, entre les sentinelles du bloc
// d'annotations. Aucune copie du code n'est maintenue à côté.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:GANTT-ANNOTATIONS:START ===";
const END = "// === NEXORA:GANTT-ANNOTATIONS:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc d'annotations Gantt introuvable dans .build/index.html");

const EXPORTS = [
  "validateMiniGanttSpan",
  "normalizeMiniGanttSpans",
  "normalizeMiniGanttSpanThickness",
  "normalizeMiniGanttSpanOpacity",
  "miniGanttSpanRows",
  "miniGanttMilestoneShape",
  "MINIGANTT_MILESTONE_TYPES",
  "MINIGANTT_MILESTONE_SHAPES",
  "MINIGANTT_SPAN_DEFAULT_COLOR",
  "MINIGANTT_SPAN_DEFAULT_THICKNESS",
  "MINIGANTT_SPAN_MAX_THICKNESS",
  "MINIGANTT_SPAN_DEFAULT_OPACITY",
];
const {
  validateMiniGanttSpan,
  normalizeMiniGanttSpans,
  normalizeMiniGanttSpanThickness,
  normalizeMiniGanttSpanOpacity,
  miniGanttSpanRows,
  miniGanttMilestoneShape,
  MINIGANTT_MILESTONE_TYPES,
  MINIGANTT_MILESTONE_SHAPES,
  MINIGANTT_SPAN_DEFAULT_COLOR,
  MINIGANTT_SPAN_DEFAULT_THICKNESS,
  MINIGANTT_SPAN_MAX_THICKNESS,
  MINIGANTT_SPAN_DEFAULT_OPACITY,
} = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const span = (patch) => ({
  id: "s1", label: "Tirage", startDate: "2026-03-01", endDate: "2026-04-15", taskId: "t1", ...patch,
});

// --- Validation ------------------------------------------------------------
test("une annotation horizontale demande deux dates et une tâche", () => {
  assert.equal(validateMiniGanttSpan(span()).ok, true);

  // Le texte est facultatif : un trait nu reste un repère valable.
  assert.equal(validateMiniGanttSpan(span({ label: "" })).ok, true);

  for (const bad of ["", "2026-13-01", "2026-02-30", "01/03/2026", null, undefined, 20260301]) {
    assert.equal(validateMiniGanttSpan(span({ startDate: bad })).ok, false, `début invalide accepté : ${bad}`);
    assert.equal(validateMiniGanttSpan(span({ endDate: bad })).ok, false, `fin invalide acceptée : ${bad}`);
  }

  // Une journée unique reste valide ; une fin antérieure au début ne l'est pas.
  assert.equal(validateMiniGanttSpan(span({ startDate: "2026-03-01", endDate: "2026-03-01" })).ok, true);
  assert.match(validateMiniGanttSpan(span({ startDate: "2026-04-15", endDate: "2026-03-01" })).error, /postérieure/i);

  // Sans tâche, rien ne dit à quelle hauteur poser le trait.
  for (const bad of ["", null, undefined, 42]) {
    const verdict = validateMiniGanttSpan(span({ taskId: bad }));
    assert.equal(verdict.ok, false, `tâche invalide acceptée : ${bad}`);
    assert.match(verdict.error, /tâche/i);
  }

  assert.equal(validateMiniGanttSpan(null).ok, false);
  assert.equal(validateMiniGanttSpan("n'importe quoi").ok, false);
});

// --- Normalisation ---------------------------------------------------------
test("une liste absente ou illisible donne une liste vide, jamais une erreur", () => {
  for (const empty of [undefined, null, {}, "", 0, [null], [{}], [{ id: "x" }]]) {
    assert.deepEqual(normalizeMiniGanttSpans(empty), []);
  }
});

test("la normalisation pose les défauts et rogne les réglages hors bornes", () => {
  const [normalisee] = normalizeMiniGanttSpans([span()]);
  assert.equal(normalisee.color, MINIGANTT_SPAN_DEFAULT_COLOR);
  assert.equal(normalisee.thickness, MINIGANTT_SPAN_DEFAULT_THICKNESS);
  assert.equal(normalisee.opacity, MINIGANTT_SPAN_DEFAULT_OPACITY);
  assert.equal(normalisee.borderStyle, "dashed", "le style par défaut est celui des autres annotations");
  assert.equal(normalisee.position, "center");
  assert.equal(normalisee.label, "Tirage");

  const [continu] = normalizeMiniGanttSpans([span({ borderStyle: "solid", position: "above", label: "  Essais  " })]);
  assert.equal(continu.borderStyle, "solid");
  assert.equal(continu.position, "above");
  assert.equal(continu.label, "Essais", "le texte est détouré de ses espaces");

  // Une position inconnue retombe sur « sur la ligne », jamais sur rien.
  assert.equal(normalizeMiniGanttSpans([span({ position: "ailleurs" })])[0].position, "center");

  // Épaisseur : au demi-pixel, entre 0,5 px et le plafond.
  assert.equal(normalizeMiniGanttSpanThickness(undefined), MINIGANTT_SPAN_DEFAULT_THICKNESS);
  assert.equal(normalizeMiniGanttSpanThickness(""), MINIGANTT_SPAN_DEFAULT_THICKNESS);
  assert.equal(normalizeMiniGanttSpanThickness("pas un nombre"), MINIGANTT_SPAN_DEFAULT_THICKNESS);
  assert.equal(normalizeMiniGanttSpanThickness(0), 0.5, "un trait d'épaisseur nulle serait invisible");
  assert.equal(normalizeMiniGanttSpanThickness(1.3), 1.5);
  assert.equal(normalizeMiniGanttSpanThickness(99), MINIGANTT_SPAN_MAX_THICKNESS);

  // Opacité : en pourcent, jamais sous 10 % (invisible) ni au-dessus de 100 %.
  assert.equal(normalizeMiniGanttSpanOpacity(undefined), MINIGANTT_SPAN_DEFAULT_OPACITY);
  assert.equal(normalizeMiniGanttSpanOpacity(0), 10);
  assert.equal(normalizeMiniGanttSpanOpacity(250), 100);
  assert.equal(normalizeMiniGanttSpanOpacity(42.4), 42);

  // Normaliser deux fois ne change plus rien : c'est ce qui permet de relire
  // une configuration déjà enregistrée sans la déformer.
  const une = normalizeMiniGanttSpans([span({ thickness: 3.2, opacity: 55, borderStyle: "solid" })]);
  assert.deepEqual(normalizeMiniGanttSpans(une), une);
});

// --- Placement vertical ----------------------------------------------------
const rows = [{ id: "t1", top: 100, height: 20 }, { id: "t2", top: 140, height: 20 }];

test("le trait se pose sur la ligne de SA tâche, à la position choisie", () => {
  const [centre] = miniGanttSpanRows(rows, [span()]);
  assert.equal(centre.y, 110, "sur la ligne = milieu de la ligne");

  const [dessus] = miniGanttSpanRows(rows, [span({ position: "above" })]);
  assert.equal(dessus.y, 104, "au-dessus = retrait depuis le haut de la ligne");

  const [dessous] = miniGanttSpanRows(rows, [span({ position: "below" })]);
  assert.equal(dessous.y, 116, "en dessous = retrait depuis le bas de la ligne");

  // Le retrait ne sort jamais de sa ligne, même très basse.
  const [serree] = miniGanttSpanRows([{ id: "t1", top: 0, height: 8 }], [span({ position: "above" })]);
  assert.equal(serree.y, 2);

  // La tâche choisie décide de la hauteur, pas l'ordre de la liste.
  const [seconde] = miniGanttSpanRows(rows, [span({ taskId: "t2" })]);
  assert.equal(seconde.y, 150);
});

test("une annotation dont la tâche n'est pas affichée est ignorée, pas dessinée ailleurs", () => {
  assert.deepEqual(miniGanttSpanRows(rows, [span({ taskId: "disparue" })]), []);
  assert.deepEqual(miniGanttSpanRows([], [span()]), []);
  assert.deepEqual(miniGanttSpanRows(null, [span()]), []);
  assert.deepEqual(miniGanttSpanRows(rows, null), []);
  // Une entrée invalide est écartée sans emporter les valides avec elle.
  const gardees = miniGanttSpanRows(rows, [span({ id: "ko", endDate: "pas une date" }), span()]);
  assert.equal(gardees.length, 1);
  assert.equal(gardees[0].span.id, "s1");
});

// --- Formes des jalons -----------------------------------------------------
test("chaque type de jalon a SA forme, et deux types n'en partagent jamais une", () => {
  const formes = MINIGANTT_MILESTONE_TYPES.map((type) => miniGanttMilestoneShape(type));
  assert.equal(new Set(formes).size, MINIGANTT_MILESTONE_TYPES.length, "deux types se ressembleraient");
  MINIGANTT_MILESTONE_TYPES.forEach((type) => {
    assert.equal(miniGanttMilestoneShape(type), MINIGANTT_MILESTONE_SHAPES[type]);
  });
  // Un type inconnu ou absent retombe sur la forme du jalon standard.
  for (const inconnu of [undefined, null, "", "autre chose", 7]) {
    assert.equal(miniGanttMilestoneShape(inconnu), MINIGANTT_MILESTONE_SHAPES.standard);
  }
});
