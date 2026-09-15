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
  "metroFrameSegments",
  "GANTT_BLOCK_DEFAULT_COLOR",
  "GANTT_FRAME_DEFAULT_COLOR",
  "GANTT_FRAME_DEFAULT_PADDING",
  "GANTT_FRAME_MAX_PADDING",
  "miniGanttToggleTaskFrame",
  "MINIGANTT_CHECK_FRAME_ICON",
  "MINIGANTT_CHECK_FRAME_CORNER_ICON",
  "MINIGANTT_FRAME_SIDE_MARGIN",
  "MINIGANTT_FRAME_MIN_WIDTH_PCT",
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
  miniGanttToggleTaskFrame,
  MINIGANTT_CHECK_FRAME_ICON,
  MINIGANTT_CHECK_FRAME_CORNER_ICON,
  MINIGANTT_FRAME_SIDE_MARGIN,
  MINIGANTT_FRAME_MIN_WIDTH_PCT,
  isGanttIsoDate,
  validateTemporalBlock,
  normalizeTemporalBlocks,
  normalizeHighlightFrames,
  ganttContinuousRuns,
  ganttFrameSegments,
  pruneHighlightFrames,
  metroFrameSegments,
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
  `(function () {\n${html.slice(from + START.length, to)}\n;return { normalizeMiniGanttMilestones, normalizeMiniGanttRisks, normalizeMiniGanttNotes, miniGanttRiskSegments, miniGanttRiskLabelLayout, MINIGANTT_RISK_LABEL_LINES, miniGanttSelectionWindow, miniGanttRowEmphasis, normalizeTemporalBlocks, MINIGANTT_RISK_DEFAULT_DAYS, GANTT_DECISION_DEFAULT_COLOR, MINIGANTT_RISK_DEFAULT_COLOR };\n})`
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

const TASKRISK = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { normalizeTaskDelayRisks, collectTaskDelayRisks, applyTaskDelayRisks, miniGanttRiskSegments, MINIGANTT_RISK_DEFAULT_DAYS };\n})`
)();

test("les risques de délai sont portés par la tâche, pas par le widget", () => {
  const tasks = [
    { id: "t1", delayRisks: [{ id: "r1", title: "Fournisseur", severity: "high" }, { id: "r2", title: "Météo" }] },
    { id: "t2", delayRisks: [] },
    { id: "t3" },
    { id: "t4", delayRisks: "pas une liste" },
    null,
  ];
  const flat = TASKRISK.collectTaskDelayRisks(tasks);
  assert.deepEqual(flat.map((r) => [r.taskId, r.id]), [["t1", "r1"], ["t1", "r2"]]);
  // La liste à plat est directement exploitable par le calcul des couloirs.
  const segments = TASKRISK.miniGanttRiskSegments([{ id: "t1", startIdx: 0, endIdx: 10 }], flat);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].endIdx - segments[0].startIdx, TASKRISK.MINIGANTT_RISK_DEFAULT_DAYS.high);
  assert.deepEqual(TASKRISK.collectTaskDelayRisks(undefined), []);

  // Un risque stocké sur la tâche ne porte pas d'identifiant de tâche redondant.
  const [stored] = TASKRISK.normalizeTaskDelayRisks([{ id: "r1", title: "A" }]);
  assert.ok(!("taskId" in stored));
  assert.equal(stored.severity, "medium");
});

test("réécrire la liste à plat ne touche que les tâches réellement changées", () => {
  const tasks = [
    { id: "t1", delayRisks: [{ id: "r1", title: "A", color: "#D64545", style: "hatched", severity: "medium", startOffset: null, endOffset: null }] },
    { id: "t2", delayRisks: [{ id: "r2", title: "B", color: "#D64545", style: "hatched", severity: "medium", startOffset: null, endOffset: null }] },
    { id: "t3" },
  ];
  const flat = TASKRISK.collectTaskDelayRisks(tasks);

  // Sans changement, aucune écriture — sinon chaque ouverture de l'éditeur
  // marquerait toutes les tâches comme modifiées.
  const calls = [];
  assert.deepEqual(TASKRISK.applyTaskDelayRisks(flat, tasks, (id, patch) => calls.push([id, patch])), []);
  assert.equal(calls.length, 0);

  // Supprimer le risque de t2 vide bien sa liste : sans ça, la suppression
  // ne serait jamais enregistrée.
  const removed = flat.filter((r) => r.taskId !== "t2");
  const writes = [];
  assert.deepEqual(TASKRISK.applyTaskDelayRisks(removed, tasks, (id, patch) => writes.push([id, patch])), ["t2"]);
  assert.deepEqual(writes, [["t2", { delayRisks: [] }]]);

  // Déplacer un risque d'une tâche à l'autre touche les deux.
  const moved = flat.map((r) => (r.id === "r1" ? { ...r, taskId: "t3" } : r));
  assert.deepEqual(TASKRISK.applyTaskDelayRisks(moved, tasks, () => {}).sort(), ["t1", "t3"]);

  // Une tâche absente de la liste fournie n'est jamais vidée par erreur.
  assert.deepEqual(TASKRISK.applyTaskDelayRisks([], [tasks[0]], () => {}), ["t1"]);
  assert.deepEqual(TASKRISK.applyTaskDelayRisks([], [{ id: "t9" }], () => {}), []);
});

const META = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { normalizeMetaTemporalBlocks, metaBlocksForDashboard, GANTT_DECISION_DEFAULT_COLOR };\n})`
)();

test("un méta bloc sans liste de tableaux vaut pour tous, y compris les futurs", () => {
  const blocks = [{ id: "m1", title: "Congés", startDate: "2026-08-01", endDate: "2026-08-21" }];
  const [normalized] = META.normalizeMetaTemporalBlocks(blocks);
  assert.equal(normalized.dashboardIds, null, "absent = tous");
  // Un tableau de bord qui n'existait pas à la création reçoit quand même le bloc.
  assert.equal(META.metaBlocksForDashboard(blocks, "tableau-cree-plus-tard").length, 1);
  // Hors tableau de bord (page « Aujourd'hui »), seuls ces blocs-là s'appliquent.
  assert.equal(META.metaBlocksForDashboard(blocks, null).length, 1);
});

test("une sélection explicite de tableaux de bord est respectée", () => {
  const blocks = [
    { id: "m1", title: "Congés", startDate: "2026-08-01", endDate: "2026-08-21", dashboardIds: ["d1", "d2"] },
    { id: "m2", title: "Fermeture", startDate: "2026-12-24", endDate: "2026-12-31", dashboardIds: [] },
  ];
  assert.deepEqual(META.metaBlocksForDashboard(blocks, "d1").map((b) => b.id), ["m1"]);
  assert.deepEqual(META.metaBlocksForDashboard(blocks, "d3").map((b) => b.id), []);
  // Une sélection explicite ne s'applique jamais hors tableau de bord.
  assert.deepEqual(META.metaBlocksForDashboard(blocks, null).map((b) => b.id), []);
  // Un tableau de bord supprimé reste dans la liste sans rien casser.
  assert.equal(META.metaBlocksForDashboard(blocks, "d2").length, 1);
});

test("un méta bloc illisible est ignoré, jamais dessiné", () => {
  const blocks = META.normalizeMetaTemporalBlocks([
    { id: "m1", title: "Valide", startDate: "2026-08-01", endDate: "2026-08-21" },
    { id: "m2", title: "Fin avant début", startDate: "2026-08-21", endDate: "2026-08-01" },
    { id: "m3", title: "Date folle", startDate: "2026-02-30", endDate: "2026-03-05" },
    { id: "m4", startDate: "2026-08-01", endDate: "2026-08-21" },
    { title: "Sans identifiant", startDate: "2026-08-01", endDate: "2026-08-21" },
    null,
  ]);
  assert.deepEqual(blocks.map((b) => b.id), ["m1"]);
  assert.deepEqual(META.normalizeMetaTemporalBlocks(undefined), []);
  // La nature « fenêtre de décision » et ses valeurs par défaut sont partagées
  // avec les blocs de widget : une seule règle pour les deux.
  const [decision] = META.normalizeMetaTemporalBlocks([{ id: "m5", title: "Arbitrage", startDate: "2026-05-04", endDate: "2026-05-06", kind: "decision" }]);
  assert.equal(decision.kind, "decision");
  assert.equal(decision.color, META.GANTT_DECISION_DEFAULT_COLOR);
  assert.equal(decision.borderStyle, "dashed");
});

const TASKMETA = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { metaBlocksFromTasks, mergeMetaTemporalBlocks, normalizeTaskMetaBlock, carryOverTaskMetaBlocks, calendarTaskEventKey, metaBlocksForDashboard, GANTT_BLOCK_DEFAULT_COLOR, GANTT_DECISION_DEFAULT_COLOR };\n})`
)();

const calTask = (patch) => ({
  id: "t1",
  title: "Congés d'été",
  start: "2026-08-03",
  end: "2026-08-21",
  googleEventId: "ev-1",
  gcalCalendarId: "cal-perso",
  ...patch,
});

test("une tâche calendrier cochée devient un méta bloc dont les dates suivent la tâche", () => {
  const [block] = TASKMETA.metaBlocksFromTasks([calTask({ metaBlock: { enabled: true } })]);
  assert.equal(block.id, "task:t1");
  assert.equal(block.title, "Congés d'été");
  assert.equal(block.startDate, "2026-08-03");
  assert.equal(block.endDate, "2026-08-21");
  assert.equal(block.kind, "phase");
  assert.equal(block.color, TASKMETA.GANTT_BLOCK_DEFAULT_COLOR);
  assert.equal(block.borderStyle, "dashed");
  assert.equal(block.dashboardIds, null, "absent = tous les tableaux de bord");

  // Déplacer l'événement déplace le bloc : rien n'est recopié.
  const [moved] = TASKMETA.metaBlocksFromTasks([calTask({ start: "2026-09-01", end: "2026-09-10", title: "Congés reportés", metaBlock: { enabled: true } })]);
  assert.equal(moved.startDate, "2026-09-01");
  assert.equal(moved.endDate, "2026-09-10");
  assert.equal(moved.title, "Congés reportés");
});

test("seules les tâches cochées et datées produisent un bloc", () => {
  const blocks = TASKMETA.metaBlocksFromTasks([
    calTask({ metaBlock: { enabled: true } }),
    calTask({ id: "t2", metaBlock: { enabled: false } }),
    calTask({ id: "t3" }),
    calTask({ id: "t4", start: "", end: "", metaBlock: { enabled: true } }),
    calTask({ id: "t5", start: "2026-08-21", end: "2026-08-03", metaBlock: { enabled: true } }),
    calTask({ id: "t6", title: "   ", metaBlock: { enabled: true } }),
    { metaBlock: { enabled: true } },
    null,
  ]);
  assert.deepEqual(blocks.map((b) => b.id), ["task:t1"]);
  assert.deepEqual(TASKMETA.metaBlocksFromTasks(undefined), []);

  // Un jalon n'a pas de date de fin : le bloc tient sur sa seule journée.
  const [jalon] = TASKMETA.metaBlocksFromTasks([calTask({ id: "t7", milestone: true, end: "", metaBlock: { enabled: true } })]);
  assert.equal(jalon.startDate, "2026-08-03");
  assert.equal(jalon.endDate, "2026-08-03");
});

test("l'habillage et la portée d'un méta bloc de tâche suivent les mêmes règles que ceux des Réglages", () => {
  const [decision] = TASKMETA.metaBlocksFromTasks([
    calTask({ metaBlock: { enabled: true, kind: "decision", borderStyle: "solid", dashboardIds: ["d1", 42, ""] } }),
  ]);
  assert.equal(decision.kind, "decision");
  assert.equal(decision.color, TASKMETA.GANTT_DECISION_DEFAULT_COLOR);
  assert.equal(decision.borderStyle, "solid");
  assert.deepEqual(decision.dashboardIds, ["d1"]);
  assert.deepEqual(TASKMETA.metaBlocksForDashboard([decision], "d1").map((b) => b.id), ["task:t1"]);
  assert.deepEqual(TASKMETA.metaBlocksForDashboard([decision], "d2").map((b) => b.id), []);

  assert.equal(TASKMETA.normalizeTaskMetaBlock(null), null);
  assert.equal(TASKMETA.normalizeTaskMetaBlock({ enabled: false, color: "#fff" }), null);
});

test("les blocs des Réglages et ceux des tâches se cumulent", () => {
  const merged = TASKMETA.mergeMetaTemporalBlocks(
    [{ id: "m1", title: "Fermeture", startDate: "2026-12-24", endDate: "2026-12-31" }],
    [calTask({ metaBlock: { enabled: true } })]
  );
  assert.deepEqual(merged.map((b) => b.id), ["m1", "task:t1"]);
  assert.deepEqual(TASKMETA.mergeMetaTemporalBlocks(undefined, undefined), []);
});

test("une resynchronisation du calendrier ne perd pas le réglage méta bloc", () => {
  const before = [
    calTask({ metaBlock: { enabled: true, kind: "decision", borderStyle: "solid", color: "#123456" } }),
    calTask({ id: "t2", googleEventId: "ev-2" }),
    { id: "t3", title: "Réunion publique", syncedCalendarId: "ics-1", syncedCalendarKey: "k-9", metaBlock: { enabled: true } },
  ];
  // L'import reconstruit les tâches : nouvel identifiant Nexora, même événement.
  const after = TASKMETA.carryOverTaskMetaBlocks(before, [
    calTask({ id: "neuf-1", start: "2026-08-10", end: "2026-08-28" }),
    calTask({ id: "neuf-2", googleEventId: "ev-2" }),
    { id: "neuf-3", title: "Réunion publique", start: "2026-09-02", end: "2026-09-02", syncedCalendarId: "ics-1", syncedCalendarKey: "k-9" },
  ]);
  assert.deepEqual(after[0].metaBlock, { enabled: true, kind: "decision", color: "#123456", borderStyle: "solid", dashboardIds: null });
  assert.equal(after[1].metaBlock, undefined, "une tâche jamais cochée le reste");
  assert.equal(after[2].metaBlock.enabled, true, "les calendriers publics utilisent leur propre clé stable");

  // Le bloc reporté suit les nouvelles dates de l'événement.
  const [block] = TASKMETA.metaBlocksFromTasks(after);
  assert.equal(block.id, "task:neuf-1");
  assert.equal(block.endDate, "2026-08-28");

  // Sans aucun réglage à reporter, la liste ressort telle quelle.
  const fresh = [calTask({ id: "x" })];
  assert.equal(TASKMETA.carryOverTaskMetaBlocks([], fresh), fresh);
  assert.equal(TASKMETA.calendarTaskEventKey({ id: "manuelle" }), "");
});

// Deux risques qui se chevauchent dans le temps ont des couloirs empilés, à
// quelques pixels l'un de l'autre. Leurs ÉTIQUETTES, elles, se recouvraient mot
// pour mot : cinq pixels suffisent à deux filets de 9 px, pas à deux textes.
const labelOpts = { trackPx: 400, minIdx: 0, maxIdx: 100, span: 100 };
const riskSeg = (patch) => ({ id: "s1", taskId: "t1", title: "Risque", startIdx: 10, endIdx: 20, lane: 0, ...patch });

test("deux étiquettes de risque ne se recouvrent jamais", () => {
  const placed = MINI.miniGanttRiskLabelLayout([
    riskSeg({ id: "a", title: "Fournisseur" }),
    riskSeg({ id: "b", title: "Météo", lane: 1 }),
  ], labelOpts);

  const a = placed.get("a"), b = placed.get("b");
  assert.ok(a && b, "les deux étiquettes doivent être placées");
  // Même couloir, donc même point de départ naturel : la seconde est repoussée
  // vers la droite, ou passe à la ligne suivante — jamais posée par-dessus.
  const separated = b.leftPct > a.leftPct || b.line !== a.line;
  assert.ok(separated, `étiquettes superposées (${JSON.stringify(a)} / ${JSON.stringify(b)})`);
});

test("les étiquettes d'une même tâche s'enchaînent de gauche à droite", () => {
  const placed = MINI.miniGanttRiskLabelLayout([
    riskSeg({ id: "tard", title: "Tard", startIdx: 40, endIdx: 50 }),
    riskSeg({ id: "tot", title: "Tôt", startIdx: 5, endIdx: 10 }),
  ], labelOpts);
  // L'ordre de la liste ne décide de rien : c'est la position du couloir.
  assert.ok(placed.get("tot").leftPct < placed.get("tard").leftPct);
  // Deux couloirs éloignés tiennent sur la même ligne.
  assert.equal(placed.get("tot").line, 0);
  assert.equal(placed.get("tard").line, 0);
});

test("une étiquette sans place bascule à la ligne, sans mordre sur la voisine", () => {
  // Trois titres longs sur le même couloir, tout à droite de la piste : la
  // première ligne se remplit, la deuxième prend la suite, la troisième n'a
  // plus de place et n'est pas dessinée — l'infobulle du couloir reste.
  const placed = MINI.miniGanttRiskLabelLayout([
    riskSeg({ id: "x1", title: "Retard fournisseur majeur", startIdx: 60, endIdx: 62 }),
    riskSeg({ id: "x2", title: "Reprise complète du dossier", startIdx: 60, endIdx: 62 }),
    riskSeg({ id: "x3", title: "Arbitrage de gouvernance attendu", startIdx: 60, endIdx: 62 }),
  ], labelOpts);
  assert.equal(placed.get("x1").line, 0);
  assert.equal(placed.get("x2").line, 1);
  assert.equal(placed.has("x3"), false, "aucune troisième ligne : elle mordrait sur la ligne voisine");
  assert.equal(MINI.MINIGANTT_RISK_LABEL_LINES, 2);
});

test("les risques de deux tâches différentes ne se gênent pas", () => {
  const placed = MINI.miniGanttRiskLabelLayout([
    riskSeg({ id: "a", taskId: "t1", title: "Fournisseur" }),
    riskSeg({ id: "b", taskId: "t2", title: "Météo" }),
  ], labelOpts);
  // Chaque tâche a sa propre ligne de rail : même position, aucune interaction.
  assert.equal(placed.get("a").leftPct, placed.get("b").leftPct);
  assert.equal(placed.get("a").line, 0);
  assert.equal(placed.get("b").line, 0);
});

test("sans piste mesurée ni titre, aucune étiquette n'est placée", () => {
  assert.equal(MINI.miniGanttRiskLabelLayout([riskSeg({})], { ...labelOpts, trackPx: 0 }).size, 0);
  assert.equal(MINI.miniGanttRiskLabelLayout([riskSeg({ title: "" })], labelOpts).size, 0);
  assert.equal(MINI.miniGanttRiskLabelLayout(undefined, labelOpts).size, 0);
  assert.equal(MINI.miniGanttRiskLabelLayout([null], labelOpts).size, 0);
});

// --- Encadrés dans la vue Métro -------------------------------------------
// Les lignes du Métro sont des PROJETS. La continuité d'un encadré s'y apprécie
// donc sur l'ordre d'affichage des projets, pas sur celui des tâches.
const metroOpts = (order, byTask) => ({ projectOrder: order, projectOf: (id) => byTask[id] || null });

test("un encadré sur des lignes de projet voisines donne un seul cadre", () => {
  const segs = metroFrameSegments(
    [{ id: "f1", label: "Lot critique", taskIds: ["a", "b", "c"] }],
    metroOpts(["p1", "p2", "p3"], { a: "p1", b: "p2", c: "p2" })
  );
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0].projectIds, ["p1", "p2"]);
  assert.deepEqual(segs[0].taskIds.sort(), ["a", "b", "c"]);
});

test("des lignes de projet non voisines donnent un cadre chacune", () => {
  const segs = metroFrameSegments(
    [{ id: "f1", label: "Jalons clés", taskIds: ["a", "c"] }],
    metroOpts(["p1", "p2", "p3"], { a: "p1", c: "p3" })
  );
  // La ligne p2 n'est pas concernée : aucun cadre ne doit l'englober.
  assert.deepEqual(segs.map((s) => s.projectIds), [["p1"], ["p3"]]);
  assert.notEqual(segs[0].id, segs[1].id, "deux cadres du même encadré gardent des identifiants distincts");
});

test("une tâche d'un projet replié ou absent est ignorée sans casser le cadre", () => {
  const segs = metroFrameSegments(
    [{ id: "f1", label: "Lot", taskIds: ["a", "fantome", "b"] }],
    metroOpts(["p1"], { a: "p1", b: "p1" })
  );
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0].taskIds, ["a", "b"]);

  // Plus aucune tâche visible : pas de cadre fantôme.
  assert.deepEqual(metroFrameSegments([{ id: "f1", taskIds: ["fantome"] }], metroOpts(["p1"], {})), []);
  assert.deepEqual(metroFrameSegments(undefined, metroOpts(["p1"], {})), []);
  assert.deepEqual(metroFrameSegments([null], metroOpts(["p1"], {})), []);
});

test("l'ordre des lignes prime sur l'ordre des tâches de l'encadré", () => {
  const segs = metroFrameSegments(
    [{ id: "f1", taskIds: ["c", "a"] }],
    metroOpts(["p1", "p2"], { a: "p1", c: "p2" })
  );
  assert.equal(segs.length, 1);
  assert.deepEqual(segs[0].projectIds, ["p1", "p2"], "p1 vient avant p2 quel que soit l'ordre de taskIds");
});


/* Coche d'une ligne du Mini-Gantt → encadré automatique (issue #48).
   Ce qui compte n'est pas de savoir poser un encadré, mais de ne jamais
   effacer celui que l'utilisateur a posé à la main. */
test("cocher pose un encadré autour de la seule tâche, avec l'icône", () => {
  const out = miniGanttToggleTaskFrame([], "t1", true, () => "f1");
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].taskIds, ["t1"]);
  assert.equal(out[0].autoTaskId, "t1");
  assert.equal(out[0].iconUrl, MINIGANTT_CHECK_FRAME_ICON);
  assert.equal(out[0].label, "", "L'icône remplace le texte : pas d'étiquette.");
});

test("décocher retire l'encadré de la coche", () => {
  const posed = miniGanttToggleTaskFrame([], "t1", true, () => "f1");
  assert.deepEqual(miniGanttToggleTaskFrame(posed, "t1", false), []);
});

test("décocher n'efface JAMAIS un encadré posé à la main sur la même tâche", () => {
  const manuel = { id: "m1", label: "Jalon contractuel", taskIds: ["t1"], autoTaskId: "" };
  const avec = miniGanttToggleTaskFrame([manuel], "t1", true, () => "f1");
  assert.equal(avec.length, 2);
  const apres = miniGanttToggleTaskFrame(avec, "t1", false);
  assert.deepEqual(apres, [manuel], "Seul l'encadré automatique doit partir.");
});

test("cocher deux fois ne crée pas de doublon, et rend le même tableau", () => {
  const une = miniGanttToggleTaskFrame([], "t1", true, () => "f1");
  const deux = miniGanttToggleTaskFrame(une, "t1", true, () => "f2");
  assert.equal(deux, une, "Rendre le même tableau évite une écriture distante inutile.");
});

test("décocher une tâche sans encadré ne change rien", () => {
  const liste = [{ id: "m1", taskIds: ["t2"], autoTaskId: "" }];
  assert.equal(miniGanttToggleTaskFrame(liste, "t1", false), liste);
});

test("la normalisation conserve l'icône et le marqueur d'origine", () => {
  const [f] = normalizeHighlightFrames([
    { id: "f1", taskIds: ["t1"], iconUrl: MINIGANTT_CHECK_FRAME_ICON, autoTaskId: "t1" },
  ]);
  assert.equal(f.iconUrl, MINIGANTT_CHECK_FRAME_ICON, "Sans cela l'icône disparaîtrait au rechargement.");
  assert.equal(f.autoTaskId, "t1", "Sans cela décocher ne saurait plus quel encadré retirer.");
});

/* Logo du coin haut droit et écart à la barre (retour de test sur #48). */
test("cocher pose aussi le logo du coin haut droit", () => {
  const [f] = miniGanttToggleTaskFrame([], "t1", true, () => "f1");
  assert.equal(f.cornerIconUrl, MINIGANTT_CHECK_FRAME_CORNER_ICON);
  assert.notEqual(MINIGANTT_CHECK_FRAME_CORNER_ICON, MINIGANTT_CHECK_FRAME_ICON, "Les deux logos sont distincts.");
});

test("un encadré automatique posé AVANT cette version reçoit le logo de coin", () => {
  // Sans cette reprise, le logo n'apparaîtrait que sur les encadrés cochés
  // après la mise à jour : ceux déjà en place resteraient nus, sans rien pour
  // le signaler.
  const [f] = normalizeHighlightFrames([{ id: "f1", taskIds: ["t1"], autoTaskId: "t1" }]);
  assert.equal(f.cornerIconUrl, MINIGANTT_CHECK_FRAME_CORNER_ICON);
});

test("un encadré posé à la main ne reçoit aucun logo de coin", () => {
  const [f] = normalizeHighlightFrames([{ id: "m1", label: "Jalon", taskIds: ["t1"] }]);
  assert.equal(f.cornerIconUrl, "", "Le logo appartient à la coche, pas à tous les encadrés.");
});

test("le cadre s'écarte de la barre, et n'est jamais plus étroit qu'elle", () => {
  // La barre du Mini-Gantt a une largeur plancher de 2 % ; un cadre autorisé à
  // descendre en dessous couperait en deux la barre d'une tâche d'un seul jour.
  assert.ok(MINIGANTT_FRAME_SIDE_MARGIN > 0, "Sans marge, le trait du cadre touche la barre.");
  assert.ok(MINIGANTT_FRAME_MIN_WIDTH_PCT >= 2, "Le plancher du cadre doit valoir au moins celui de la barre.");
});
