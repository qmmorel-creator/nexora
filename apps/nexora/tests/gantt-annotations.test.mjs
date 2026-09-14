import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Les fonctions testées sont extraites de l'interface RÉELLEMENT construite
// (dist/index.html, reconstruit par `npm run build` juste avant `npm test`),
// entre les deux sentinelles du bloc d'annotations. Aucune copie du code n'est
// maintenue à côté : si le bloc change dans l'interface, ces tests suivent.
const START = "// === NEXORA:GANTT-ANNOTATIONS:START ===";
const END = "// === NEXORA:GANTT-ANNOTATIONS:END ===";
const EXPORTS = [
  "isGanttIsoDate",
  "validateTemporalBlock",
  "normalizeTemporalBlocks",
  "normalizeHighlightFrames",
  "ganttContinuousRuns",
  "ganttFrameSegments",
  "pruneHighlightFrames",
  "GANTT_BLOCK_DEFAULT_COLOR",
  "GANTT_FRAME_DEFAULT_COLOR",
  "GANTT_FRAME_DEFAULT_PADDING",
  "GANTT_FRAME_MAX_PADDING",
];

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc d'annotations Gantt introuvable dans dist/index.html");

// Évalué dans le realm courant (et non dans un contexte vm isolé) : les objets
// retournés partagent les prototypes du test, ce que deepStrictEqual exige.
const factory = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
);
const {
  isGanttIsoDate,
  validateTemporalBlock,
  normalizeTemporalBlocks,
  normalizeHighlightFrames,
  ganttContinuousRuns,
  ganttFrameSegments,
  pruneHighlightFrames,
  GANTT_BLOCK_DEFAULT_COLOR,
  GANTT_FRAME_DEFAULT_COLOR,
  GANTT_FRAME_DEFAULT_PADDING,
  GANTT_FRAME_MAX_PADDING,
} = factory();

const block = (patch) => ({ id: "b1", title: "Études", startDate: "2026-03-01", endDate: "2026-06-30", ...patch });
const row = (id, groupKey, top, height, startIdx, endIdx) => ({ id, groupKey, top, height, startIdx, endIdx });

test("les dates d'un bloc temporel sont validées avant tout enregistrement", () => {
  assert.equal(validateTemporalBlock(block()).ok, true);

  assert.equal(validateTemporalBlock(block({ title: "   " })).ok, false);
  assert.match(validateTemporalBlock(block({ title: "" })).error, /titre/i);

  for (const bad of ["", "2026-13-01", "2026-02-30", "01/03/2026", "2026-3-1", null, undefined, 20260301]) {
    assert.equal(validateTemporalBlock(block({ startDate: bad })).ok, false, `début invalide accepté : ${bad}`);
    assert.equal(validateTemporalBlock(block({ endDate: bad })).ok, false, `fin invalide acceptée : ${bad}`);
  }

  // Une journée unique reste valide ; une fin antérieure au début ne l'est pas.
  assert.equal(validateTemporalBlock(block({ startDate: "2026-03-01", endDate: "2026-03-01" })).ok, true);
  const inverted = validateTemporalBlock(block({ startDate: "2026-06-30", endDate: "2026-03-01" }));
  assert.equal(inverted.ok, false);
  assert.match(inverted.error, /postérieure/i);

  assert.equal(isGanttIsoDate("2024-02-29"), true, "année bissextile");
  assert.equal(isGanttIsoDate("2026-02-29"), false, "année non bissextile");
});

test("une configuration Gantt sans annotations donne des listes vides", () => {
  for (const empty of [undefined, null, {}, "", 0, { temporalBlocks: undefined }]) {
    assert.deepEqual(normalizeTemporalBlocks(empty && empty.temporalBlocks), []);
    assert.deepEqual(normalizeHighlightFrames(empty && empty.highlightFrames), []);
  }
});

test("les blocs invalides sont ignorés au rendu, les valides reçoivent leurs valeurs par défaut", () => {
  const normalized = normalizeTemporalBlocks([
    block(),
    block({ id: "b2", color: "#112233", borderStyle: "solid" }),
    block({ id: "b3", endDate: "2026-01-01" }), // fin avant début
    block({ id: "", title: "Sans identifiant" }),
    null,
    "pas un bloc",
  ]);
  assert.deepEqual(normalized.map((b) => b.id), ["b1", "b2"]);
  assert.equal(normalized[0].color, GANTT_BLOCK_DEFAULT_COLOR);
  assert.equal(normalized[0].borderStyle, "dashed");
  assert.equal(normalized[1].color, "#112233");
  assert.equal(normalized[1].borderStyle, "solid");
  assert.equal(normalized[0].title, "Études");
});

test("les encadrés sont normalisés sans perdre la sélection de tâches", () => {
  const [frame] = normalizeHighlightFrames([
    { id: "f1", taskIds: ["t1", "t2", "t1", "", null, 42], padding: "9" },
  ]);
  assert.deepEqual(frame.taskIds, ["t1", "t2"], "doublons et entrées illisibles retirés");
  assert.equal(frame.color, GANTT_FRAME_DEFAULT_COLOR);
  assert.equal(frame.borderStyle, "dashed");
  assert.equal(frame.padding, 9);
  assert.equal(frame.label, "");

  const [clamped] = normalizeHighlightFrames([{ id: "f2", taskIds: ["t1"], padding: 999 }]);
  assert.equal(clamped.padding, GANTT_FRAME_MAX_PADDING);
  const [fallback] = normalizeHighlightFrames([{ id: "f3", taskIds: ["t1"], padding: "beaucoup" }]);
  assert.equal(fallback.padding, GANTT_FRAME_DEFAULT_PADDING);
  // Un encadré vide est conservé tel quel par la normalisation : c'est le rendu
  // qui ne dessine rien, pour ne jamais perdre une configuration en cours.
  assert.equal(normalizeHighlightFrames([{ id: "f4", taskIds: [] }]).length, 1);
});

test("les groupes continus suivent l'ordre d'affichage du Gantt", () => {
  const ordered = ["t1", "t2", "t3", "t4", "t5"];
  assert.deepEqual(ganttContinuousRuns(ordered, ["t2", "t3"]), [["t2", "t3"]]);
  assert.deepEqual(ganttContinuousRuns(ordered, ["t1", "t2", "t4", "t5"]), [["t1", "t2"], ["t4", "t5"]]);
  assert.deepEqual(ganttContinuousRuns(ordered, ["t1", "t3", "t5"]), [["t1"], ["t3"], ["t5"]]);
  // L'ordre de sélection n'a pas d'importance : seul l'ordre visuel compte.
  assert.deepEqual(ganttContinuousRuns(ordered, ["t3", "t2"]), [["t2", "t3"]]);
  assert.deepEqual(ganttContinuousRuns(ordered, ["absente"]), []);
  assert.deepEqual(ganttContinuousRuns(ordered, []), []);
  assert.deepEqual(ganttContinuousRuns(undefined, ["t1"]), []);
});

test("un encadré sur des tâches successives produit un seul cadre ajusté", () => {
  const rows = [
    row("t1", "g1", 0, 34, 10, 20),
    row("t2", "g1", 34, 34, 15, 40),
    row("t3", "g1", 68, 34, 5, 12),
  ];
  const [segment, ...rest] = ganttFrameSegments(rows, { id: "f1", taskIds: ["t1", "t2"], padding: 4 });
  assert.equal(rest.length, 0);
  assert.deepEqual(segment.ids, ["t1", "t2"]);
  // Bornes verticales : les deux lignes concernées, marge comprise.
  assert.equal(segment.top, -4);
  assert.equal(segment.height, 34 + 34 + 8);
  // Bornes temporelles : début le plus ancien, fin la plus tardive.
  assert.equal(segment.startIdx, 10);
  assert.equal(segment.endIdx, 40);
  assert.equal(segment.padding, 4);

  // Une seule tâche : le cadre s'ajuste à cette ligne, et à elle seule.
  const [single] = ganttFrameSegments(rows, { id: "f2", taskIds: ["t3"], padding: 0 });
  assert.deepEqual(single.ids, ["t3"]);
  assert.equal(single.top, 68);
  assert.equal(single.height, 34);
  assert.equal(single.startIdx, 5);
  assert.equal(single.endIdx, 12);
});

test("des tâches non successives produisent un cadre par groupe continu", () => {
  const rows = [
    row("t1", "g1", 0, 30, 0, 5),
    row("t2", "g1", 30, 30, 2, 9),
    row("t3", "g1", 60, 30, 1, 4),
    row("t4", "g1", 90, 30, 7, 11),
  ];
  const segments = ganttFrameSegments(rows, { id: "f1", taskIds: ["t1", "t2", "t4"], padding: 0 });
  assert.equal(segments.length, 2);
  assert.deepEqual(segments[0].ids, ["t1", "t2"]);
  assert.deepEqual(segments[1].ids, ["t4"]);
  assert.equal(segments[0].height, 60);
  assert.equal(segments[1].top, 90);
  // Aucun cadre ne déborde sur les lignes non sélectionnées.
  assert.ok(segments[0].top + segments[0].height <= segments[1].top);
});

test("une frontière de groupe coupe la continuité visuelle", () => {
  const rows = [
    row("t1", "g1", 0, 30, 0, 5),
    row("t2", "g2", 56, 30, 3, 8), // en-tête de groupe intercalé
  ];
  const segments = ganttFrameSegments(rows, { id: "f1", taskIds: ["t1", "t2"], padding: 0 });
  assert.equal(segments.length, 2, "deux groupes distincts = deux cadres");
  assert.deepEqual(segments.map((s) => s.ids), [["t1"], ["t2"]]);
});

test("une tâche supprimée, filtrée ou repliée est ignorée sans casser le rendu", () => {
  const rows = [
    row("t1", "g1", 0, 30, 0, 5),
    row("t3", "g1", 30, 30, 8, 12),
  ];
  // t2 n'est plus visible : t1 et t3 ne sont pas adjacentes dans les données,
  // mais elles le sont à l'écran — un seul cadre, sans erreur.
  const segments = ganttFrameSegments(rows, { id: "f1", taskIds: ["t1", "t2", "t3"], padding: 0 });
  assert.equal(segments.length, 1);
  assert.deepEqual(segments[0].ids, ["t1", "t3"]);

  // Plus aucune tâche valide : aucun cadre, et surtout aucune exception.
  assert.deepEqual(ganttFrameSegments(rows, { id: "f2", taskIds: ["disparue"] }), []);
  assert.deepEqual(ganttFrameSegments([], { id: "f3", taskIds: ["t1"] }), []);
  assert.deepEqual(ganttFrameSegments(undefined, undefined), []);
  assert.deepEqual(ganttFrameSegments(rows, null), []);
});

test("le nettoyage explicite retire les tâches disparues et les encadrés vidés", () => {
  const frames = [
    { id: "f1", taskIds: ["t1", "supprimee"], label: "Lot critique" },
    { id: "f2", taskIds: ["disparue"] },
    { id: "f3", taskIds: ["t2", "t3"] },
  ];
  const pruned = pruneHighlightFrames(frames, ["t1", "t2", "t3"]);
  assert.deepEqual(pruned.map((f) => f.id), ["f1", "f3"]);
  assert.deepEqual(pruned[0].taskIds, ["t1"]);
  assert.equal(pruned[0].label, "Lot critique");
  assert.deepEqual(pruneHighlightFrames(frames, []), []);
  assert.deepEqual(pruneHighlightFrames(undefined, ["t1"]), []);
});
