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

// ---------------------------------------------------------------------------
// Mini-Gantt : fenêtres de décision, jalons, risques, annotations
// ---------------------------------------------------------------------------
const MINI = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { normalizeMiniGanttMilestones, normalizeMiniGanttRisks, normalizeMiniGanttNotes, miniGanttRiskSegments, miniGanttSelectionWindow, miniGanttRowEmphasis, normalizeTemporalBlocks, MINIGANTT_RISK_DEFAULT_DAYS, GANTT_DECISION_DEFAULT_COLOR, MINIGANTT_RISK_DEFAULT_COLOR };\n})`
)();

test("un bloc temporel peut être une fenêtre de décision", () => {
  const [phase, decision] = MINI.normalizeTemporalBlocks([
    { id: "b1", title: "Études", startDate: "2026-03-01", endDate: "2026-06-30" },
    { id: "b2", title: "Validation budget", startDate: "2026-04-01", endDate: "2026-04-03", kind: "decision" },
  ]);
  assert.equal(phase.kind, "phase");
  assert.equal(decision.kind, "decision");
  // La teinte violette est le défaut d'une fenêtre de décision, pas celui d'une phase.
  assert.equal(decision.color, MINI.GANTT_DECISION_DEFAULT_COLOR);
  assert.notEqual(phase.color, MINI.GANTT_DECISION_DEFAULT_COLOR);
  // Une couleur explicite reste prioritaire.
  const [forced] = MINI.normalizeTemporalBlocks([{ id: "b3", title: "X", startDate: "2026-01-01", endDate: "2026-01-02", kind: "decision", color: "#123456" }]);
  assert.equal(forced.color, "#123456");
});

test("les jalons de configuration sont validés et typés", () => {
  const list = MINI.normalizeMiniGanttMilestones([
    { id: "m1", title: "Décision CODIR", date: "2026-05-12", type: "decision" },
    { id: "m2", title: "Permis", date: "2026-06-01" },
    { id: "m3", title: "Sans date" },
    { id: "m4", title: "  ", date: "2026-06-01" },
    { id: "m5", title: "Date folle", date: "2026-02-30" },
    { title: "Sans identifiant", date: "2026-06-01" },
  ]);
  assert.deepEqual(list.map((m) => m.id), ["m1", "m2"]);
  assert.equal(list[0].type, "decision");
  assert.equal(list[1].type, "standard", "type inconnu ou absent = standard");
  assert.ok(list[0].color && list[0].color !== list[1].color, "chaque type a sa couleur par défaut");
  assert.equal(list[1].taskId, null, "un jalon peut n'être rattaché à aucune tâche");
});

test("les risques prennent des valeurs par défaut sûres", () => {
  const [risk] = MINI.normalizeMiniGanttRisks([{ id: "r1", taskId: "t1", title: " Retard fournisseur " }]);
  assert.equal(risk.title, "Retard fournisseur");
  assert.equal(risk.style, "hatched", "une incertitude de délai est hachurée par défaut");
  assert.equal(risk.severity, "medium");
  assert.equal(risk.color, MINI.MINIGANTT_RISK_DEFAULT_COLOR);
  assert.equal(risk.startOffset, null);
  assert.equal(risk.endOffset, null);
  // Entrées inexploitables écartées, jamais une exception.
  assert.deepEqual(MINI.normalizeMiniGanttRisks([{ id: "r2" }, null, "texte", { taskId: "t1" }]), []);
  assert.deepEqual(MINI.normalizeMiniGanttRisks(undefined), []);
  const [style] = MINI.normalizeMiniGanttRisks([{ id: "r3", taskId: "t1", style: "pointillé", severity: "énorme" }]);
  assert.equal(style.style, "hatched");
  assert.equal(style.severity, "medium");
});

test("plusieurs risques sur une tâche se suivent après la fin de la barre", () => {
  const rows = [{ id: "t1", startIdx: 0, endIdx: 10 }, { id: "t2", startIdx: 4, endIdx: 8 }];
  const segments = MINI.miniGanttRiskSegments(rows, [
    { id: "r1", taskId: "t1", title: "Fournisseur", severity: "low" },
    { id: "r2", taskId: "t1", title: "Météo", severity: "high" },
    { id: "r3", taskId: "t2", title: "Validation", severity: "medium" },
  ]);
  const t1 = segments.filter((s) => s.taskId === "t1");
  assert.equal(t1.length, 2);
  // Le premier démarre à la fin de la barre, le second enchaîne sur le premier.
  assert.equal(t1[0].startIdx, 10);
  assert.equal(t1[0].endIdx, 10 + MINI.MINIGANTT_RISK_DEFAULT_DAYS.low);
  assert.equal(t1[1].startIdx, t1[0].endIdx);
  assert.equal(t1[1].endIdx, t1[0].endIdx + MINI.MINIGANTT_RISK_DEFAULT_DAYS.high);
  // Chaînés, ils ne se recouvrent pas : un seul couloir suffit.
  assert.deepEqual(t1.map((s) => s.lane), [0, 0]);
  // Chaque tâche a sa propre origine.
  const t2 = segments.filter((s) => s.taskId === "t2");
  assert.equal(t2[0].startIdx, 8);
});

test("les décalages explicites sont respectés et les recouvrements empilés", () => {
  const rows = [{ id: "t1", startIdx: 0, endIdx: 20 }];
  const segments = MINI.miniGanttRiskSegments(rows, [
    { id: "r1", taskId: "t1", title: "A", startOffset: 0, endOffset: 10 },
    { id: "r2", taskId: "t1", title: "B", startOffset: 5, endOffset: 12 },
    { id: "r3", taskId: "t1", title: "C", startOffset: 12, endOffset: 14 },
  ]);
  assert.deepEqual(segments.map((s) => [s.startIdx, s.endIdx]), [[20, 30], [25, 32], [32, 34]]);
  // A et B se recouvrent : B passe au couloir suivant. C ne recouvre personne.
  assert.deepEqual(segments.map((s) => s.lane), [0, 1, 0]);
});

test("un risque dont la tâche n'est pas visible est ignoré sans erreur", () => {
  const rows = [{ id: "t1", startIdx: 0, endIdx: 5 }];
  const segments = MINI.miniGanttRiskSegments(rows, [
    { id: "r1", taskId: "t1", title: "Visible" },
    { id: "r2", taskId: "supprimee", title: "Tâche disparue" },
    { id: "r3", taskId: "filtree", title: "Masquée par un filtre" },
  ]);
  assert.deepEqual(segments.map((s) => s.id), ["r1"]);
  assert.deepEqual(MINI.miniGanttRiskSegments([], [{ id: "r1", taskId: "t1" }]), []);
  assert.deepEqual(MINI.miniGanttRiskSegments(undefined, undefined), []);
  assert.deepEqual(MINI.miniGanttRiskSegments([{ id: "t1", endIdx: NaN }], [{ id: "r1", taskId: "t1" }]), []);
});

test("la fenêtre de zoom couvre la sélection, ses risques et une marge", () => {
  const rows = [
    { id: "t1", startIdx: 10, endIdx: 20 },
    { id: "t2", startIdx: 30, endIdx: 40 },
    { id: "t3", startIdx: 0, endIdx: 100 },
  ];
  const segments = MINI.miniGanttRiskSegments(rows, [{ id: "r1", taskId: "t2", severity: "high" }]);
  const win = MINI.miniGanttSelectionWindow(rows, ["t1", "t2"], segments, 2);
  assert.equal(win.minIdx, 8, "début le plus ancien moins la marge");
  // t2 finit à 40, son risque « high » prolonge de 10 jours, plus la marge.
  assert.equal(win.maxIdx, 52);
  // Une seule tâche : la fenêtre se resserre sur elle, jamais sur tout le Gantt.
  const single = MINI.miniGanttSelectionWindow(rows, ["t1"], [], 0);
  assert.deepEqual([single.minIdx, single.maxIdx], [10, 20]);
  assert.equal(MINI.miniGanttSelectionWindow(rows, [], [], 1), null);
  assert.equal(MINI.miniGanttSelectionWindow(rows, ["inconnue"], [], 1), null);
  assert.equal(MINI.miniGanttSelectionWindow(undefined, undefined, undefined), null);
});

test("l'accentuation d'une ligne se déduit des risques et du chemin critique", () => {
  const segments = [
    { id: "r1", taskId: "t1", severity: "low" },
    { id: "r2", taskId: "t2", severity: "critical" },
    { id: "r3", taskId: "t3", severity: "medium" },
  ];
  const critical = new Set(["t1", "t4"]);
  // Un risque élevé prime sur le chemin critique : c'est l'alerte la plus forte.
  assert.equal(MINI.miniGanttRowEmphasis("t2", segments, critical), "risk");
  // Sinon le chemin critique prime sur un simple risque de faible gravité.
  assert.equal(MINI.miniGanttRowEmphasis("t1", segments, critical), "critical");
  assert.equal(MINI.miniGanttRowEmphasis("t3", segments, critical), "watch");
  assert.equal(MINI.miniGanttRowEmphasis("t4", segments, critical), "critical");
  assert.equal(MINI.miniGanttRowEmphasis("t5", segments, critical), "none");
  assert.equal(MINI.miniGanttRowEmphasis("t5", [], null), "none");
});

test("les annotations exigent une ancre exploitable", () => {
  const notes = MINI.normalizeMiniGanttNotes([
    { id: "n1", title: "Relance", anchor: { kind: "task", id: "t1" } },
    { id: "n2", title: "Comité", anchor: { kind: "date", date: "2026-05-12" } },
    { id: "n3", title: "Sans ancre", anchor: { kind: "task" } },
    { id: "n4", title: "Date invalide", anchor: { kind: "date", date: "pas une date" } },
    { id: "n5", anchor: { kind: "date", date: "2026-05-12" } },
  ]);
  assert.deepEqual(notes.map((n) => n.id), ["n1", "n2"]);
  assert.equal(notes[0].anchor.kind, "task");
  assert.equal(notes[1].anchor.date, "2026-05-12");
  assert.equal(notes[0].text, "", "le texte est facultatif");
});

test("normaliser deux fois une liste ne change plus rien", () => {
  // Le rendu normalise une liste déjà normalisée : sans idempotence, « pas de
  // décalage » (null) devenait « décalage de 0 jour » et tous les couloirs
  // d'incertitude s'effondraient à une journée.
  const once = MINI.normalizeMiniGanttRisks([{ id: "r1", taskId: "t1", title: "A", severity: "high" }]);
  const twice = MINI.normalizeMiniGanttRisks(once);
  assert.deepEqual(twice, once);
  assert.equal(twice[0].startOffset, null);
  assert.equal(twice[0].endOffset, null);

  const rows = [{ id: "t1", startIdx: 0, endIdx: 10 }];
  const direct = MINI.miniGanttRiskSegments(rows, once);
  const rerun = MINI.miniGanttRiskSegments(rows, twice);
  assert.deepEqual(rerun, direct);
  assert.equal(direct[0].endIdx - direct[0].startIdx, MINI.MINIGANTT_RISK_DEFAULT_DAYS.high);

  // Une chaîne vide de formulaire vaut aussi « absent ».
  const [blank] = MINI.normalizeMiniGanttRisks([{ id: "r2", taskId: "t1", startOffset: "", endOffset: "" }]);
  assert.equal(blank.startOffset, null);
  assert.equal(blank.endOffset, null);
  // Un vrai zéro reste un zéro.
  const [zero] = MINI.normalizeMiniGanttRisks([{ id: "r3", taskId: "t1", startOffset: 0, endOffset: 4 }]);
  assert.equal(zero.startOffset, 0);
  assert.equal(zero.endOffset, 4);
});
