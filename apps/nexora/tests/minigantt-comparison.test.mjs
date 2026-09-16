import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Mêmes règles que gantt-annotations.test.mjs : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite (.build/index.html, reconstruit
// par `npm run build` juste avant `npm test`), entre les sentinelles du bloc
// concerné. Aucune copie du code n'est maintenue à côté.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function bloc(nom, exports) {
  const START = `// === NEXORA:${nom}:START ===`;
  const END = `// === NEXORA:${nom}:END ===`;
  const from = html.indexOf(START);
  const to = html.indexOf(END);
  assert.ok(from !== -1 && to > from, `bloc ${nom} introuvable dans .build/index.html`);
  return vm.runInThisContext(
    `(function () {\n${html.slice(from + START.length, to)}\n;return { ${exports.join(", ")} };\n})`
  )();
}

const {
  normalizeTaskComparison,
  taskComparisonErrors,
  taskComparisonIsValid,
  taskComparisonFromCurrentDates,
  withCreationComparison,
  miniGanttComparisonEnabledOn,
  miniGanttTaskComparison,
  miniGanttComparisonTone,
  miniGanttComparisonDeltaLabel,
  miniGanttComparisonToneLabel,
  miniGanttComparisonDeltaAria,
  miniGanttComparisonBars,
  miniGanttComparisonMilestone,
  miniGanttComparisonRangeIndices,
  miniGanttComparisonTooltipLines,
  miniGanttComparisonLabelVisible,
  miniGanttComparisonToneColor,
  miniGanttComparisonZonePattern,
  miniGanttComparisonZoneColor,
  miniGanttRiskSegments,
  normalizeTemporalBlocks,
  normalizeHighlightFrames,
  normalizeMiniGanttMilestones,
  normalizeMiniGanttNotes,
  ganttDayNumber,
  MINIGANTT_COMPARISON_REF_COLOR,
  MINIGANTT_COMPARISON_AHEAD_COLOR,
  MINIGANTT_COMPARISON_LATE_COLOR,
} = bloc("GANTT-ANNOTATIONS", [
  "normalizeTaskComparison", "taskComparisonErrors", "taskComparisonIsValid",
  "taskComparisonFromCurrentDates", "withCreationComparison",
  "miniGanttComparisonEnabledOn", "miniGanttTaskComparison",
  "miniGanttComparisonTone", "miniGanttComparisonDeltaLabel", "miniGanttComparisonToneLabel",
  "miniGanttComparisonDeltaAria", "miniGanttComparisonBars", "miniGanttComparisonMilestone",
  "miniGanttComparisonRangeIndices", "miniGanttComparisonTooltipLines",
  "miniGanttComparisonLabelVisible", "miniGanttComparisonToneColor", "miniGanttComparisonZonePattern",
  "miniGanttComparisonZoneColor",
  "miniGanttRiskSegments", "normalizeTemporalBlocks", "normalizeHighlightFrames",
  "normalizeMiniGanttMilestones", "normalizeMiniGanttNotes", "ganttDayNumber",
  "MINIGANTT_COMPARISON_REF_COLOR", "MINIGANTT_COMPARISON_AHEAD_COLOR", "MINIGANTT_COMPARISON_LATE_COLOR",
]);

const { widgetTransferCopy, widgetTransferApply } = bloc("WIDGET-TRANSFER", [
  "widgetTransferCopy", "widgetTransferApply",
]);

// Tâche de référence utilisée par la plupart des cas : 12/08 → 18/09 prévu.
const tache = (patch) => ({
  id: "t1", title: "Exploitation Année 1", start: "2026-08-12", end: "2026-09-18",
  ...patch,
});
const ref = (start, end, enabled = true) => ({ comparison: { enabled, referenceStart: start, referenceEnd: end } });
const fenetre = (from, to) => ({
  minIdx: ganttDayNumber(from), maxIdx: ganttDayNumber(to),
  span: ganttDayNumber(to) - ganttDayNumber(from),
});

// 1. Un widget d'avant ce changement --------------------------------------
test("un widget sans propriété de comparaison reste en mode standard", () => {
  assert.equal(miniGanttComparisonEnabledOn({}), false);
  assert.equal(miniGanttComparisonEnabledOn({ type: "minigantt" }), false);
  assert.equal(miniGanttComparisonEnabledOn(null), false);
  assert.equal(miniGanttComparisonEnabledOn(undefined), false);
  // Une valeur héritée qui ne serait pas un booléen strict ne l'active pas non plus.
  assert.equal(miniGanttComparisonEnabledOn({ miniGanttComparisonEnabled: "oui" }), false);
  assert.equal(miniGanttComparisonEnabledOn({ miniGanttComparisonEnabled: 1 }), false);
});

// 2. Activation et désactivation dans les paramètres -----------------------
test("l'activation du mode est propre au widget, et l'interrupteur écrit la même propriété que le sélecteur rapide", () => {
  assert.equal(miniGanttComparisonEnabledOn({ miniGanttComparisonEnabled: true }), true);
  assert.equal(miniGanttComparisonEnabledOn({ miniGanttComparisonEnabled: false }), false);
  // Les paramètres du widget enregistrent la propriété…
  assert.match(html, /data\.miniGanttComparisonEnabled = miniGanttComparisonEnabled;/);
  // …et le sélecteur rapide de l'en-tête écrit la MÊME, jamais un état local.
  assert.match(html, /onUpdateWidget\(\{ miniGanttComparisonEnabled: !!on \}\)/);
});

// 3. Duplication d'un widget ------------------------------------------------
test("le mode comparaison suit la duplication d'un widget, d'un onglet et d'un tableau de bord", () => {
  const source = { id: "w1", type: "minigantt", title: "Planning", miniGanttComparisonEnabled: true };
  const copie = widgetTransferCopy(source, () => "w2");
  assert.equal(copie.miniGanttComparisonEnabled, true);
  assert.equal(copie.id, "w2");
  // L'original n'est pas touché : écriture immuable.
  assert.equal(source.id, "w1");

  const boards = [
    { id: "b1", name: "A", pages: [{ id: "p1", widgets: [source] }] },
    { id: "b2", name: "B", pages: [{ id: "p2", widgets: [] }] },
  ];
  const next = widgetTransferApply(boards, "w1", { boardId: "b2", pageId: "p2" }, "duplicate", () => "w9");
  assert.equal(next[1].pages[0].widgets[0].miniGanttComparisonEnabled, true);
  assert.equal(next[0].pages[0].widgets[0].miniGanttComparisonEnabled, true);
  // La duplication d'un onglet ou d'un tableau de bord recopie les widgets
  // champ par champ : une copie superficielle suffit donc à emporter le mode.
  const ongletCopie = { ...boards[0].pages[0], widgets: boards[0].pages[0].widgets.map((w) => ({ ...w, id: "x" })) };
  assert.equal(ongletCopie.widgets[0].miniGanttComparisonEnabled, true);
});

// 4. Tâche sans comparaison -------------------------------------------------
test("une tâche sans comparaison garde le rendu standard", () => {
  assert.equal(miniGanttTaskComparison(tache()), null);
  assert.equal(miniGanttTaskComparison(tache({ comparison: null })), null);
  assert.equal(miniGanttTaskComparison(tache({ comparison: { enabled: false, referenceStart: "2026-08-01", referenceEnd: "2026-09-01" } })), null);
  assert.equal(normalizeTaskComparison(undefined), null);
  assert.equal(normalizeTaskComparison({}), null);
  // Une comparaison désactivée mais DÉJÀ renseignée se conserve : désactiver ne
  // doit jamais effacer l'historique.
  assert.deepEqual(
    normalizeTaskComparison({ enabled: false, referenceStart: "2026-08-01", referenceEnd: "2026-09-01" }),
    { enabled: false, referenceStart: "2026-08-01", referenceEnd: "2026-09-01" }
  );
});

// 5. Dates de référence valides --------------------------------------------
test("une tâche avec des dates de référence valides expose les deux écarts séparément", () => {
  const cmp = miniGanttTaskComparison(tache(ref("2026-08-12", "2026-09-18")));
  assert.ok(cmp);
  assert.equal(cmp.milestone, false);
  assert.equal(cmp.referenceStart, "2026-08-12");
  assert.equal(cmp.referenceEnd, "2026-09-18");
  assert.equal(cmp.currentStart, "2026-08-12");
  assert.equal(cmp.currentEnd, "2026-09-18");
  assert.equal(cmp.startDeltaDays, 0);
  assert.equal(cmp.endDeltaDays, 0);
});

// 6, 7, 8. Avance, retard, conforme ----------------------------------------
test("avance, retard et conformité suivent la convention négatif/positif/zéro", () => {
  const avance = miniGanttTaskComparison(tache({ start: "2026-08-09", end: "2026-09-15", ...ref("2026-08-12", "2026-09-18") }));
  assert.equal(avance.startDeltaDays, -3);
  assert.equal(avance.endDeltaDays, -3);
  assert.equal(avance.endTone, "ahead");
  assert.equal(miniGanttComparisonDeltaLabel(avance.endDeltaDays), "−3 j");

  const retard = miniGanttTaskComparison(tache({ start: "2026-08-15", end: "2026-09-26", ...ref("2026-08-12", "2026-09-18") }));
  assert.equal(retard.startDeltaDays, 3);
  assert.equal(retard.endDeltaDays, 8);
  assert.equal(retard.endTone, "late");
  assert.equal(miniGanttComparisonDeltaLabel(retard.endDeltaDays), "+8 j");

  const conforme = miniGanttTaskComparison(tache(ref("2026-08-12", "2026-09-18")));
  assert.equal(conforme.startTone, "ontime");
  assert.equal(conforme.endTone, "ontime");
  assert.equal(miniGanttComparisonDeltaLabel(0), "0 j");

  assert.equal(miniGanttComparisonTone(-1), "ahead");
  assert.equal(miniGanttComparisonTone(0), "ontime");
  assert.equal(miniGanttComparisonTone(1), "late");
  assert.equal(miniGanttComparisonToneLabel("ahead"), "avance");
  assert.equal(miniGanttComparisonToneLabel("late"), "retard");
  assert.equal(miniGanttComparisonToneLabel("ontime"), "conforme");
});

// 9. Début en retard, fin en avance ----------------------------------------
test("une fin en avance se peint en vert, et porte sa valeur", () => {
  // Terminer plus tôt que prévu est la seule avance qu'une tâche démarrée à
  // l'heure peut montrer : elle doit se voir, et en vert.
  const cmp = miniGanttTaskComparison(tache({ start: "2026-08-12", end: "2026-09-05", ...ref("2026-08-12", "2026-09-18") }));
  assert.equal(cmp.startDeltaDays, 0);
  assert.equal(cmp.endDeltaDays, -13);
  assert.equal(cmp.endTone, "ahead");
  const bars = miniGanttComparisonBars(cmp, fenetre("2026-08-01", "2026-10-01"));
  assert.equal(bars.ahead, null, "rien avant le début : la tâche a démarré à l'heure");
  assert.equal(bars.late, null);
  assert.ok(bars.freed, "le temps rendu à la fin est une zone à part entière");
  assert.equal(miniGanttComparisonZoneColor("freed"), MINIGANTT_COMPARISON_AHEAD_COLOR);
  // Et son chiffre s'affiche comme celui des autres zones dès qu'il tient.
  assert.equal(miniGanttComparisonLabelVisible(bars.freed, { trackPx: 600 }), true);
  assert.equal(miniGanttComparisonDeltaLabel(cmp.endDeltaDays), "\u221213 j");
});

test("un début en retard et une fin en avance se lisent séparément", () => {
  const cmp = miniGanttTaskComparison(tache({ start: "2026-08-15", end: "2026-09-14", ...ref("2026-08-12", "2026-09-18") }));
  assert.equal(cmp.startDeltaDays, 3);
  assert.equal(cmp.startTone, "late");
  assert.equal(cmp.endDeltaDays, -4);
  assert.equal(cmp.endTone, "ahead");

  const bars = miniGanttComparisonBars(cmp, fenetre("2026-08-01", "2026-10-01"));
  // Démarrage tardif : aucune zone d'avance à gauche.
  assert.equal(bars.ahead, null);
  // Fin anticipée : aucun dépassement, mais une trace de la référence non consommée.
  assert.equal(bars.late, null);
  assert.ok(bars.freed);
  assert.ok(bars.reference);
});

// 10. Période actuelle entièrement décalée ---------------------------------
test("une période entièrement décalée garde la barre initiale ET la barre actuelle visibles", () => {
  const cmp = miniGanttTaskComparison(tache({ start: "2026-10-01", end: "2026-10-20", ...ref("2026-08-12", "2026-09-18") }));
  const w = fenetre("2026-08-01", "2026-11-01");
  const bars = miniGanttComparisonBars(cmp, w);
  assert.ok(bars.reference, "la barre de référence reste dessinée, même sans recouvrement");
  assert.ok(bars.late, "tout l'actuel est en dépassement");
  assert.equal(bars.ahead, null);
  assert.equal(bars.freed, null);
  // Les deux occupent des plages distinctes de la piste.
  const finReference = bars.reference.leftPct + bars.reference.widthPct;
  assert.ok(bars.late.leftPct >= finReference - 0.001, "le dépassement commence à la fin de la référence");
  assert.equal(cmp.startDeltaDays, 50);
  assert.equal(cmp.endDeltaDays, 32);
});

test("une superposition parfaite laisse la référence discernable, et la barre reste à sa place", () => {
  const cmp = miniGanttTaskComparison(tache(ref("2026-08-12", "2026-09-18")));
  const bars = miniGanttComparisonBars(cmp, fenetre("2026-08-01", "2026-10-01"));
  assert.ok(bars.reference);
  assert.equal(bars.ahead, null);
  assert.equal(bars.late, null);
  assert.equal(bars.freed, null);
  // Le contour, lui, est porté par la feuille de style : la barre de référence
  // déborde de 2 px en haut et en bas sans changer la hauteur de la ligne.
  // La référence vit sur un RAIL FIN sous la barre : c'est la structure, et non
  // un habillage, qui sépare le délai prévu du délai réel.
  assert.match(html, /\.lp-widget-minigantt-refbar\{\s*\n\s*position:absolute; top:11px; height:4px;/);
});

// 11. Jalons ----------------------------------------------------------------
test("un jalon se compare sans qu'aucune durée ne soit fabriquée", () => {
  const jalon = (end, refEnd) => miniGanttTaskComparison({
    id: "m1", title: "Mise en service", milestone: true, start: end, end,
    comparison: { enabled: true, referenceEnd: refEnd },
  });

  const retard = jalon("2026-09-26", "2026-09-18");
  assert.equal(retard.milestone, true);
  assert.equal(retard.referenceStart, "2026-09-18");
  assert.equal(retard.referenceEnd, "2026-09-18");
  assert.equal(retard.startDeltaDays, 8);
  assert.equal(retard.endDeltaDays, 8);
  assert.equal(retard.endTone, "late");

  assert.equal(jalon("2026-09-15", "2026-09-18").endDeltaDays, -3);
  assert.equal(jalon("2026-09-15", "2026-09-18").endTone, "ahead");
  assert.equal(jalon("2026-09-18", "2026-09-18").endDeltaDays, 0);
  assert.equal(jalon("2026-09-18", "2026-09-18").endTone, "ontime");

  // Un jalon n'a pas de barre : seules les deux positions et leur liaison.
  assert.equal(miniGanttComparisonBars(retard, fenetre("2026-09-01", "2026-10-01")), null);
  const geo = miniGanttComparisonMilestone(retard, fenetre("2026-09-01", "2026-10-01"));
  assert.equal(geo.referenceVisible, true);
  assert.equal(geo.currentVisible, true);
  assert.ok(geo.link, "un segment fin relie les deux positions");
  assert.ok(geo.currentLeftPct > geo.referenceLeftPct);

  // Jalon conforme : les deux losanges coïncident, aucun segment à tracer.
  assert.equal(miniGanttComparisonMilestone(jalon("2026-09-18", "2026-09-18"), fenetre("2026-09-01", "2026-10-01")).link, null);
  // Et une barre n'est jamais demandée à une tâche avec durée.
  assert.equal(miniGanttComparisonMilestone(miniGanttTaskComparison(tache(ref("2026-08-12", "2026-09-18"))), fenetre("2026-08-01", "2026-10-01")), null);
});

// 12. Référence invalide ou incomplète --------------------------------------
test("une référence invalide ou incomplète ne casse rien : la tâche garde le rendu standard", () => {
  assert.equal(miniGanttTaskComparison(tache(ref(null, "2026-09-18"))), null);
  assert.equal(miniGanttTaskComparison(tache(ref("2026-08-12", null))), null);
  assert.equal(miniGanttTaskComparison(tache(ref("2026-02-30", "2026-09-18"))), null);
  assert.equal(miniGanttTaskComparison(tache(ref("12/08/2026", "2026-09-18"))), null);
  // Fin de référence antérieure au début : refusée.
  assert.equal(miniGanttTaskComparison(tache(ref("2026-09-18", "2026-08-12"))), null);
  // Une tâche sans dates actuelles n'a rien à comparer.
  assert.equal(miniGanttTaskComparison({ id: "t", start: null, end: null, ...ref("2026-08-12", "2026-09-18") }), null);

  // Messages de saisie, champ par champ.
  assert.match(taskComparisonErrors({ enabled: true, referenceStart: null, referenceEnd: "2026-09-18" }, {}).start, /Renseigner le début/);
  assert.match(taskComparisonErrors({ enabled: true, referenceStart: "2026-08-12", referenceEnd: null }, {}).end, /Renseigner la fin/);
  assert.match(taskComparisonErrors({ enabled: true, referenceEnd: null }, { milestone: true }).end, /Renseigner le jalon/);
  assert.match(taskComparisonErrors({ enabled: true, referenceStart: "2026-13-01", referenceEnd: "2026-09-18" }, {}).start, /invalide/);
  assert.match(taskComparisonErrors({ enabled: true, referenceStart: "2026-09-18", referenceEnd: "2026-08-12" }, {}).end, /postérieure ou égale/);
  // Un jalon ne réclame jamais de début de référence.
  assert.equal(taskComparisonErrors({ enabled: true, referenceEnd: "2026-09-18" }, { milestone: true }).start, "");
  assert.equal(taskComparisonIsValid({ enabled: true, referenceEnd: "2026-09-18" }, { milestone: true }), true);
  assert.equal(taskComparisonIsValid({ enabled: true, referenceStart: "2026-08-12", referenceEnd: "2026-09-18" }, {}), true);
  assert.equal(taskComparisonIsValid({ enabled: true }, {}), false);
  // Comparaison désactivée : aucune erreur, donc aucun blocage.
  assert.equal(taskComparisonIsValid({ enabled: false }, {}), true);
  // Et la fiche refuse bien d'enregistrer tant qu'une erreur reste.
  assert.match(html, /if \(comparisonBlocksSave\) return;/);
});

// 13. Plage automatique ------------------------------------------------------
test("la plage automatique englobe les dates de référence, avant comme après l'actuel", () => {
  const taches = [
    tache({ id: "a", start: "2026-10-01", end: "2026-10-20", ...ref("2026-08-12", "2026-09-18") }),
    { id: "m", milestone: true, start: "2026-10-05", end: "2026-10-05", comparison: { enabled: true, referenceEnd: "2026-12-24" } },
    tache({ id: "c" }),
  ];
  const idx = miniGanttComparisonRangeIndices(taches, true);
  assert.deepEqual(idx.slice().sort((x, y) => x - y), [
    ganttDayNumber("2026-08-12"), ganttDayNumber("2026-09-18"),
    ganttDayNumber("2026-12-24"), ganttDayNumber("2026-12-24"),
  ].sort((x, y) => x - y));
  const min = Math.min(...idx);
  const max = Math.max(...idx);
  assert.ok(min < ganttDayNumber("2026-10-01"), "la référence antérieure repousse la borne gauche");
  assert.ok(max > ganttDayNumber("2026-10-20"), "la référence postérieure repousse la borne droite");
  // Mode standard : la plage ne bouge pas d'un jour.
  assert.deepEqual(miniGanttComparisonRangeIndices(taches, false), []);
  // La borne est bien versée dans les min/max du widget.
  assert.match(html, /Math\.min\(\.\.\.allForRange\.map\(\(t\) => dayIndex\(t\.start \|\| t\.end\)\), \.\.\.comparisonRangeIdx\)/);
  assert.match(html, /Math\.max\(\.\.\.allForRange\.map\(\(t\) => dayIndex\(t\.end\)\), \.\.\.comparisonRangeIdx\)/);
});

test("une référence hors de la fenêtre affichée est rognée, jamais supprimée", () => {
  const cmp = miniGanttTaskComparison(tache({ start: "2026-10-01", end: "2026-10-20", ...ref("2026-08-12", "2026-09-18") }));
  const bars = miniGanttComparisonBars(cmp, fenetre("2026-09-01", "2026-11-01"));
  assert.ok(bars.reference);
  assert.equal(bars.reference.clippedStart, true, "la troncature est signalée pour que le trait devienne pointillé");
  assert.equal(bars.reference.leftPct, 0);
  // Référence entièrement hors champ : rien à dessiner, et surtout pas d'erreur.
  const horsChamp = miniGanttComparisonBars(cmp, fenetre("2026-10-01", "2026-11-01"));
  assert.equal(horsChamp.reference, null);
  assert.ok(horsChamp.late, "la tâche, elle, reste dessinée");
});

// 14. Les références ne suivent JAMAIS les dates actuelles -------------------
test("déplacer les dates actuelles laisse les dates de référence intactes", () => {
  const avant = tache(ref("2026-08-12", "2026-09-18"));
  // Un glisser-déposer dans le Mini-Gantt n'écrit que `start` / `end`.
  const apres = { ...avant, start: "2026-09-01", end: "2026-10-30" };
  assert.deepEqual(normalizeTaskComparison(apres.comparison), normalizeTaskComparison(avant.comparison));
  const cmp = miniGanttTaskComparison(apres);
  assert.equal(cmp.referenceStart, "2026-08-12");
  assert.equal(cmp.referenceEnd, "2026-09-18");
  assert.equal(cmp.startDeltaDays, 20);
  assert.equal(cmp.endDeltaDays, 42);
  // Le glisser-déposer du widget ne touche toujours que les dates actuelles.
  assert.match(html, /onUpdateTask\(d\.taskId, \{ start: nd \}\)/);
  assert.match(html, /onUpdateTask\(d\.taskId, \{ end: nd \}\)/);
});

// 15. Copier les dates actuelles comme référence -----------------------------
test("« Copier les dates actuelles comme référence » ne s'exécute que sur demande explicite", () => {
  assert.deepEqual(
    taskComparisonFromCurrentDates({ start: "2026-08-15", end: "2026-09-26" }),
    { enabled: true, referenceStart: "2026-08-15", referenceEnd: "2026-09-26" }
  );
  // Un jalon copie sa date unique dans la seule référence qui le concerne.
  assert.deepEqual(
    taskComparisonFromCurrentDates({ milestone: true, start: "2026-09-26", end: "2026-09-26" }),
    { enabled: true, referenceStart: null, referenceEnd: "2026-09-26" }
  );
  // Sans dates exploitables, rien n'est copié.
  assert.equal(taskComparisonFromCurrentDates({ start: null, end: null }), null);
  assert.equal(taskComparisonFromCurrentDates(null), null);
  // Elle est branchée sur un clic, et sur rien d'autre.
  assert.match(html, /onClick=\{copyCurrentDatesAsReference\}/);
  assert.equal((html.match(/copyCurrentDatesAsReference\(\)/g) || []).length, 0,
    "aucun appel automatique : seule la poignée du bouton référence la fonction");
});

// Création d'une tâche : la référence naît calée sur les dates demandées ------
test("une tâche NOUVELLE naît avec sa planification initiale pour référence", () => {
  const creee = withCreationComparison({ id: "n1", title: "Nouvelle", start: "2026-08-12", end: "2026-09-18" });
  assert.deepEqual(creee.comparison, { enabled: true, referenceStart: "2026-08-12", referenceEnd: "2026-09-18" });
  // Elle est donc conforme à elle-même au premier jour : aucun écart inventé.
  const cmp = miniGanttTaskComparison(creee);
  assert.equal(cmp.startDeltaDays, 0);
  assert.equal(cmp.endDeltaDays, 0);

  // Un jalon ne reçoit que la référence qui le concerne.
  const jalon = withCreationComparison({ id: "n2", milestone: true, start: "2026-09-18", end: "2026-09-18" });
  assert.deepEqual(jalon.comparison, { enabled: true, referenceStart: null, referenceEnd: "2026-09-18" });

  // …puis elle ne bouge plus : déplacer la tâche creuse un écart, elle reste.
  const deplacee = { ...creee, start: "2026-08-19", end: "2026-09-30" };
  assert.deepEqual(deplacee.comparison, creee.comparison);
  assert.equal(miniGanttTaskComparison(deplacee).endDeltaDays, 12);
});

test("le calage à la création ne touche ni les tâches déjà décidées, ni celles sans dates", () => {
  // Une comparaison déjà posée — par la fiche, qui la montre et la laisse
  // modifier avant d'enregistrer — n'est jamais écrasée.
  const decidee = { id: "d", start: "2026-08-12", end: "2026-09-18", comparison: { enabled: true, referenceStart: "2026-07-01", referenceEnd: "2026-08-01" } };
  assert.equal(withCreationComparison(decidee), decidee);
  // Une comparaison volontairement désactivée compte AUSSI comme une décision.
  const refusee = { id: "r", start: "2026-08-12", end: "2026-09-18", comparison: { enabled: false, referenceStart: "2026-07-01", referenceEnd: "2026-08-01" } };
  assert.equal(withCreationComparison(refusee), refusee);
  // Sans dates exploitables, il n'y a rien à figer.
  const sansDates = { id: "s", title: "Sans date", start: null, end: null };
  assert.equal(withCreationComparison(sansDates), sansDates);
  assert.equal(withCreationComparison(null), null);
  // Écriture immuable : la tâche d'origine n'est jamais modifiée sur place.
  const source = { id: "i", start: "2026-08-12", end: "2026-09-18" };
  const sortie = withCreationComparison(source);
  assert.notEqual(sortie, source);
  assert.equal(source.comparison, undefined);
});

test("une tâche EXISTANTE ne gagne jamais de référence toute seule", () => {
  // Le calage est réservé à la création : la fiche le conditionne à `isNew`, et
  // le premier geste sur le bloc l'arrête définitivement.
  assert.match(html, /if \(!isNew \|\| comparisonTouched\.current\) return;/);
  assert.match(html, /comparisonTouched\.current = true;/);
  assert.match(html, /isNew \? comparisonSeed\(\) : \{ enabled: false, referenceStart: null, referenceEnd: null \}/);
  // Et les tâches importées d'un agenda restent en dehors : leurs dates
  // appartiennent à Google Calendar et sont réécrites à chaque synchronisation.
  const importee = { id: "g", start: "2026-08-05", end: "2026-08-19", gcalImported: true };
  assert.equal(normalizeTaskComparison(importee.comparison), null);
});

// 16. Compatibilité avec les blocs, encadrés, risques et annotations ---------
test("le mode comparaison n'altère ni les blocs, ni les encadrés, ni les risques, ni les notes", () => {
  const blocs = normalizeTemporalBlocks([{ id: "b", title: "Études", startDate: "2026-03-01", endDate: "2026-06-30" }]);
  const cadres = normalizeHighlightFrames([{ id: "f", taskIds: ["t1"] }]);
  const jalons = normalizeMiniGanttMilestones([{ id: "j", title: "DCE", date: "2026-05-01" }]);
  const notes = normalizeMiniGanttNotes([{ id: "n", title: "Note", anchor: { kind: "task", id: "t1" } }]);
  const segments = miniGanttRiskSegments(
    [{ id: "t1", endIdx: ganttDayNumber("2026-09-18") }],
    [{ id: "r1", taskId: "t1", title: "Fournisseur", severity: "high" }]
  );
  // Rien de tout cela ne change parce qu'une comparaison existe sur la tâche.
  const cmp = miniGanttTaskComparison(tache(ref("2026-08-12", "2026-09-18")));
  assert.ok(cmp);
  assert.equal(blocs.length, 1);
  assert.equal(cadres.length, 1);
  assert.equal(jalons.length, 1);
  assert.equal(notes.length, 1);
  assert.equal(segments.length, 1);
  // Une tâche porteuse de couloirs de risque masque les libellés chiffrés pour
  // ne pas superposer deux textes sur la même bande — les barres restent là.
  const zone = { leftPct: 10, widthPct: 40 };
  assert.equal(miniGanttComparisonLabelVisible(zone, { trackPx: 600, hasRisks: true }), false);
  assert.equal(miniGanttComparisonLabelVisible(zone, { trackPx: 600, hasRisks: false }), true);
  // Et jamais sous la ligne « Aujourd'hui ».
  assert.equal(miniGanttComparisonLabelVisible(zone, { trackPx: 600, todayPct: 30 }), false);
  assert.equal(miniGanttComparisonLabelVisible(zone, { trackPx: 600, todayPct: 90 }), true);
});

// 17. Aucune régression du rendu standard -----------------------------------
test("mode standard : aucune barre de référence, aucune zone, aucune ligne plus haute", () => {
  const taches = [tache(ref("2026-08-12", "2026-09-18"))];
  assert.deepEqual(miniGanttComparisonRangeIndices(taches, false), []);
  // La table des comparaisons est vide tant que le widget est en mode standard.
  assert.match(html, /const map = new Map\(\);\s*\n\s*if \(!comparisonOn\) return map;/);
  // Les éléments de comparaison ne se rendent que si `cmpBars` / `cmpMs` existe.
  assert.match(html, /cmpBars && cmpBars\.reference && /);
  assert.match(html, /cmpMs && cmpMs\.referenceVisible && /);
  // Les barres comparées vivent en position absolue dans la piste : la hauteur
  // de ligne est inchangée.
  // Les écarts partagent CE MÊME RAIL, jamais la bande de la barre : à hauteur
  // égale ils se lisaient comme son prolongement, et la poignée d'avancement
  // semblait avoir devant elle une course qui n'existait pas.
  assert.match(html, /\.lp-widget-minigantt-cmpzone\{ position:absolute; top:11px; height:4px;/);
  // La barre actuelle, elle, reste exactement ce qu'elle était : rien ne s'y
  // ajoute, aucune classe de comparaison ne la touche.
  assert.doesNotMatch(html, /lp-widget-minigantt-bar\.is-compared/);
  assert.match(html, /<div className="lp-widget-minigantt-bar" style=\{\{ left: left \+ "%"/);
});

// 18. Widget étroit ----------------------------------------------------------
test("sur un widget étroit, seuls les libellés chiffrés disparaissent", () => {
  const cmp = miniGanttTaskComparison(tache({ start: "2026-08-15", end: "2026-09-26", ...ref("2026-08-12", "2026-09-18") }));
  const bars = miniGanttComparisonBars(cmp, fenetre("2026-08-01", "2026-10-01"));
  assert.ok(bars.reference, "la barre de référence est dessinée quelle que soit la largeur");
  assert.ok(bars.late, "la zone de retard aussi");
  // Piste de 120 px : le libellé ne tient pas dans une zone de 8 jours sur 61.
  assert.equal(miniGanttComparisonLabelVisible(bars.late, { trackPx: 120 }), false);
  // Piste large : il s'affiche.
  assert.equal(miniGanttComparisonLabelVisible(bars.late, { trackPx: 900 }), true);
  assert.equal(miniGanttComparisonLabelVisible(null, { trackPx: 900 }), false);
});

// 19. Infobulle --------------------------------------------------------------
test("l'infobulle enrichie n'est jamais persistante et garde le détail complet", () => {
  const fr = (d) => d.split("-").reverse().join("/");
  const cmp = miniGanttTaskComparison(tache({ start: "2026-08-15", end: "2026-09-26", ...ref("2026-08-12", "2026-09-18") }));
  assert.deepEqual(miniGanttComparisonTooltipLines(cmp, fr), [
    { key: "ref", label: "Référence", value: "12/08/2026 → 18/09/2026" },
    { key: "cur", label: "Actuel", value: "15/08/2026 → 26/09/2026" },
    { key: "start", label: "Début", value: "+3 j", tone: "late" },
    { key: "end", label: "Fin", value: "+8 j", tone: "late" },
  ]);

  const jalon = miniGanttTaskComparison({ id: "m", milestone: true, start: "2026-09-26", end: "2026-09-26", comparison: { enabled: true, referenceEnd: "2026-09-18" } });
  assert.deepEqual(miniGanttComparisonTooltipLines(jalon, fr), [
    { key: "ref", label: "Jalon de référence", value: "18/09/2026" },
    { key: "cur", label: "Jalon actuel", value: "26/09/2026" },
    { key: "end", label: "Écart", value: "+8 j", tone: "late" },
  ]);
  assert.deepEqual(miniGanttComparisonTooltipLines(null), []);
  // Elle disparaît avec le survol : c'est `hover` qui la porte, et la sortie le vide.
  assert.match(html, /onMouseLeave=\{\(\) => setHover\(null\)\}/);
  assert.match(html, /const hoverCmp = comparisonByTask\.get\(hover\.t\.id\) \|\| null;/);
});

// 20. Sérialisation et restauration ------------------------------------------
test("la comparaison traverse sérialisation et restauration sans perte ni migration", () => {
  const stockee = tache(ref("2026-08-12", "2026-09-18"));
  const relue = JSON.parse(JSON.stringify(stockee));
  assert.deepEqual(normalizeTaskComparison(relue.comparison), { enabled: true, referenceStart: "2026-08-12", referenceEnd: "2026-09-18" });
  assert.deepEqual(miniGanttTaskComparison(relue), miniGanttTaskComparison(stockee));

  // Une tâche d'avant ce changement reste valide, et ne gagne aucun objet vide.
  const ancienne = JSON.parse(JSON.stringify(tache()));
  assert.equal(normalizeTaskComparison(ancienne.comparison), null);
  assert.equal(miniGanttTaskComparison(ancienne), null);

  // Le widget suit la même règle : la propriété est un booléen simple.
  const widget = JSON.parse(JSON.stringify({ id: "w", type: "minigantt", miniGanttComparisonEnabled: true }));
  assert.equal(miniGanttComparisonEnabledOn(widget), true);

  // Aucune initialisation silencieuse au CHARGEMENT : la normalisation ne
  // fabrique jamais une référence à partir des dates actuelles. Seule la
  // création d'une tâche en pose une, et elle est visible dans la fiche.
  assert.equal(normalizeTaskComparison({ enabled: true }).referenceStart, null);
  assert.equal(normalizeTaskComparison({ enabled: true }).referenceEnd, null);
});

// Accessibilité et cohérence des repères ------------------------------------
test("l'avance et le retard ne passent jamais par la seule couleur", () => {
  assert.equal(miniGanttComparisonToneColor("ahead"), MINIGANTT_COMPARISON_AHEAD_COLOR);
  assert.equal(miniGanttComparisonToneColor("late"), MINIGANTT_COMPARISON_LATE_COLOR);
  assert.notEqual(miniGanttComparisonToneColor("ontime"), MINIGANTT_COMPARISON_LATE_COLOR);
  // Motifs distincts : hachures montantes pour le retard, descendantes pour
  // l'avance, pointillé dilué pour la référence non consommée.
  const late = miniGanttComparisonZonePattern("late");
  const ahead = miniGanttComparisonZonePattern("ahead");
  const freed = miniGanttComparisonZonePattern("freed");
  assert.match(late, /repeating-linear-gradient\(45deg/);
  assert.match(ahead, /repeating-linear-gradient\(-45deg/);
  // Les DEUX formes d'avance sont vertes et hachurées dans le même sens : une
  // tâche terminée plus tôt doit afficher du vert, pas un gris de référence.
  assert.match(freed, /repeating-linear-gradient\(-45deg/);
  assert.ok(freed.includes(MINIGANTT_COMPARISON_AHEAD_COLOR));
  assert.ok(!freed.includes(MINIGANTT_COMPARISON_REF_COLOR));
  assert.equal(miniGanttComparisonZoneColor("freed"), MINIGANTT_COMPARISON_AHEAD_COLOR);
  assert.equal(miniGanttComparisonZoneColor("ahead"), MINIGANTT_COMPARISON_AHEAD_COLOR);
  assert.equal(miniGanttComparisonZoneColor("late"), MINIGANTT_COMPARISON_LATE_COLOR);
  assert.notEqual(late, ahead);
  assert.notEqual(late, freed);
  // …sans pour autant se confondre : le motif reste plus aéré à la fin.
  assert.notEqual(ahead, freed);
  // Libellé accessible, en toutes lettres.
  assert.equal(miniGanttComparisonDeltaAria(8, "Fin"), "Fin : 8 jours de retard.");
  assert.equal(miniGanttComparisonDeltaAria(-1, "Début"), "Début : 1 jour d'avance.");
  assert.equal(miniGanttComparisonDeltaAria(0, "Jalon"), "Jalon : conforme à la référence.");
  // Et la légende reprend exactement ces couleurs et ces motifs.
  assert.match(html, /key: "cmp-ahead", label: "Avance"/);
  assert.match(html, /key: "cmp-late", label: "Retard"/);
  assert.match(html, /key: "cmp-ref", label: "Initial"/);
  assert.match(html, /key: "cmp-current", label: "Actuel"/);
});
