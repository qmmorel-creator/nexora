import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

/* Widget « Bulles » (#92). Les fonctions testées sont extraites de l'interface
   RÉELLEMENT construite (.build/index.html, reconstruit par `npm run build`
   juste avant `npm test`), entre les sentinelles du bloc « Bulles ». Aucune
   copie du code n'est maintenue à côté : si le bloc change, ces tests suivent.

   Le bloc des annotations Gantt est extrait LUI AUSSI, pour une seule raison :
   `bubbleMacroSegments` reçoit `ganttFrameSegments` en argument, et ce test
   doit vérifier le contrat avec la VRAIE fonction — pas avec un mannequin qui
   dirait ce qu'on veut entendre. */
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function extract(start, end, exports) {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${start} introuvable dans .build/index.html`);
  return vm.runInThisContext(
    `(function () {\n${html.slice(from + start.length, to)}\n;return { ${exports.join(", ")} };\n})`
  )();
}

const { ganttFrameSegments } = extract(
  "// === NEXORA:GANTT-ANNOTATIONS:START ===",
  "// === NEXORA:GANTT-ANNOTATIONS:END ===",
  ["ganttFrameSegments"],
);

const {
  BUBBLES_DEFAULTS,
  BUBBLE_MACRO_DEFAULT_COLOR,
  BUBBLE_MACRO_OPACITY_MAX,
  BUBBLE_MACRO_BORDER_WIDTH_MAX,
  BUBBLE_MACRO_CLEARANCE,
  BUBBLE_MACRO_NEST_STEP,
  BUBBLE_PALETTE,
  BUBBLE_ROW_FIELD_OPTIONS,
  normalizeBubbleFields,
  normalizeBubbleFieldsLayout,
  normalizeBubbleSize,
  normalizeBubbleDescriptionLines,
  bubbleHeightPx,
  bubbleRowExtent,
  BUBBLE_MIN_PX,
  BUBBLE_MILESTONE_W,
  BUBBLE_HEIGHT_PX,
  BUBBLE_DESC_LINE_PX,
  BUBBLE_DESC_LINES_MAX,
  normalizeBubbleOpacity,
  normalizeBubbleBorderWidth,
  validateBubbleMacro,
  normalizeBubbleMacros,
  pruneBubbleMacros,
  bubbleMacroFill,
  bubbleMacroBorder,
  normalizeBubblesWidget,
  bubblePaletteColor,
  bubbleColorMap,
  bubbleLegendEntries,
  bubbleMacroSegments,
  bubbleMacroProgress,
  bubbleRowOrder,
  bubbleLaneRows,
  bubbleLaneHeightPx,
  bubbleEffectiveFieldsLayout,
  normalizeBubbleLayout,
  BUBBLE_LAYOUTS,
  BUBBLE_FIELDS_LAYOUTS,
  BUBBLE_FIELDS_COMPACT_PX,
  BUBBLE_LANE_GAP_PX,
  BUBBLE_FIELDS_COMPACT_LINE_PX,
  BUBBLE_FIELDS_COMPACT_LINES_MAX,
  bubbleCompactFieldsHeight,
  bubbleLaneDateRoom,
} = extract(
  "// === NEXORA:BUBBLES:START ===",
  "// === NEXORA:BUBBLES:END ===",
  [
    "BUBBLES_DEFAULTS", "BUBBLE_MACRO_DEFAULT_COLOR", "BUBBLE_MACRO_OPACITY_MAX",
    "BUBBLE_MACRO_BORDER_WIDTH_MAX", "BUBBLE_MACRO_CLEARANCE", "BUBBLE_MACRO_NEST_STEP",
    "BUBBLE_PALETTE", "BUBBLE_ROW_FIELD_OPTIONS",
    "normalizeBubbleFields", "normalizeBubbleFieldsLayout",
    "normalizeBubbleSize", "normalizeBubbleOpacity", "normalizeBubbleBorderWidth",
    "normalizeBubbleDescriptionLines", "bubbleHeightPx",
    "bubbleRowExtent", "BUBBLE_MIN_PX", "BUBBLE_MILESTONE_W",
    "BUBBLE_HEIGHT_PX", "BUBBLE_DESC_LINE_PX", "BUBBLE_DESC_LINES_MAX",
    "validateBubbleMacro", "normalizeBubbleMacros", "pruneBubbleMacros",
    "bubbleMacroFill", "bubbleMacroBorder", "normalizeBubblesWidget",
    "bubblePaletteColor", "bubbleColorMap", "bubbleLegendEntries",
    "bubbleMacroSegments", "bubbleMacroProgress", "bubbleRowOrder",
    "bubbleLaneRows", "bubbleLaneHeightPx", "bubbleEffectiveFieldsLayout",
    "normalizeBubbleLayout", "BUBBLE_LAYOUTS", "BUBBLE_FIELDS_LAYOUTS",
    "BUBBLE_FIELDS_COMPACT_PX", "BUBBLE_LANE_GAP_PX",
    "BUBBLE_FIELDS_COMPACT_LINE_PX", "BUBBLE_FIELDS_COMPACT_LINES_MAX",
    "bubbleCompactFieldsHeight", "bubbleLaneDateRoom",
  ],
);

// --- Validation et normalisation d'une macro-bulle -------------------------

test("une macro-bulle sans libellé est refusée, une macro-bulle sans tâche est acceptée", () => {
  assert.equal(validateBubbleMacro({ label: "" }).ok, false);
  assert.equal(validateBubbleMacro({ label: "   " }).ok, false);
  assert.match(validateBubbleMacro({}).error, /libellé/i);
  assert.equal(validateBubbleMacro({ label: "Phase essais" }).ok, true);
  assert.equal(validateBubbleMacro({ label: "Phase essais", taskIds: [] }).ok, true);
});

test("la normalisation borne l'opacité, l'épaisseur et la couleur, et dédoublonne les tâches", () => {
  const [macro] = normalizeBubbleMacros([{
    id: "m1", label: "Essais", taskIds: ["a", "a", "b", "", 42],
    color: "rouge", opacity: 250, borderWidth: 99, borderStyle: "pointillés",
  }]);
  assert.deepEqual(macro.taskIds, ["a", "b"]);
  assert.equal(macro.color, BUBBLE_MACRO_DEFAULT_COLOR);
  assert.equal(macro.opacity, BUBBLE_MACRO_OPACITY_MAX);
  assert.equal(macro.borderWidth, BUBBLE_MACRO_BORDER_WIDTH_MAX);
  assert.equal(macro.borderStyle, "solid");
  assert.equal(macro.showProgress, true);
  assert.equal(normalizeBubbleOpacity(-10), 0);
  assert.equal(normalizeBubbleBorderWidth(1.3), 1.5);
  assert.equal(normalizeBubbleBorderWidth(0), 0);
  assert.equal(normalizeBubbleBorderWidth("x"), 1.5);
});

test("une macro-bulle garde ses propriétés inconnues et son identité", () => {
  const [macro] = normalizeBubbleMacros([{ id: "m1", label: "L", futur: { a: 1 } }]);
  assert.equal(macro.id, "m1");
  assert.deepEqual(macro.futur, { a: 1 });
  assert.deepEqual(normalizeBubbleMacros([{ label: "sans id" }]), []);
  assert.deepEqual(normalizeBubbleMacros("pas une liste"), []);
});

test("le remplissage est translucide, le cadre plein, et une épaisseur nulle retire le trait", () => {
  assert.equal(bubbleMacroFill({ color: "#245EDB", opacity: 20 }), "color-mix(in srgb, #245EDB 20%, transparent)");
  assert.equal(bubbleMacroFill({}), `color-mix(in srgb, ${BUBBLE_MACRO_DEFAULT_COLOR} 12%, transparent)`);
  assert.equal(bubbleMacroBorder({ color: "#245EDB", borderWidth: 2, borderStyle: "dashed" }), "2px dashed #245EDB");
  assert.equal(bubbleMacroBorder({ borderWidth: 0 }), "none");
});

test("le nettoyage retire les tâches disparues mais conserve la macro-bulle vidée", () => {
  const pruned = pruneBubbleMacros(
    [{ id: "m1", label: "Essais", taskIds: ["a", "disparue"] }, { id: "m2", label: "Vide", taskIds: ["fantome"] }],
    ["a", "b"],
  );
  assert.equal(pruned.length, 2);
  assert.deepEqual(pruned[0].taskIds, ["a"]);
  assert.deepEqual(pruned[1].taskIds, []);
});

// --- Réglages du widget ---------------------------------------------------

test("un réglage absent ou invalide retombe sur son défaut", () => {
  const w = normalizeBubblesWidget({ type: "bubbles", bubbleSize: "géant", bubbleFieldsLayout: "diagonal" });
  assert.equal(w.bubbleSize, BUBBLES_DEFAULTS.bubbleSize);
  assert.equal(w.bubbleFieldsLayout, BUBBLES_DEFAULTS.bubbleFieldsLayout);
  assert.deepEqual(w.bubbleFields, BUBBLES_DEFAULTS.bubbleFields);
  assert.equal(w.bubbleColorBy, "status");
  assert.equal(w.bubbleShowDates, true);
  assert.equal(w.bubbleShowDescription, false);
  assert.equal(w.bubbleMacroGrouping, true);
  assert.equal(normalizeBubbleSize("large"), "large");
  assert.equal(normalizeBubbleFieldsLayout("inline"), "inline");
});

test("une liste de champs vide est un choix, pas une absence de réglage", () => {
  assert.deepEqual(normalizeBubbleFields([]), []);
  assert.deepEqual(normalizeBubbleFields(["status", "status", "", "end"]), ["status", "end"]);
  assert.deepEqual(normalizeBubbleFields(undefined), BUBBLES_DEFAULTS.bubbleFields);
});

test("passer un widget de Mini-Gantt à Bulles conserve fenêtre, zoom, tri et annotations", () => {
  const miniGantt = {
    id: "w1", type: "minigantt", title: "Plan",
    groupBy: "project", showMilestones: false,
    miniGanttSort: "end", miniGanttSortDir: "desc", miniGanttZoomLevel: 3,
    miniGanttRange: { mode: "fixed" }, miniGanttWindow: { start: "2026-01-01", end: "2026-06-30" },
    ganttAnnotations: { temporalBlocks: [{ id: "b1", title: "Études" }] },
  };
  const w = normalizeBubblesWidget({ ...miniGantt, type: "bubbles" });
  assert.equal(w.id, "w1");
  assert.equal(w.groupBy, "project");
  assert.equal(w.showMilestones, false);
  assert.equal(w.miniGanttSort, "end");
  assert.equal(w.miniGanttSortDir, "desc");
  assert.equal(w.miniGanttZoomLevel, 3);
  assert.deepEqual(w.miniGanttWindow, { start: "2026-01-01", end: "2026-06-30" });
  assert.deepEqual(w.ganttAnnotations, miniGantt.ganttAnnotations);
});

// --- Couleur par « grouper par » ------------------------------------------

test("la couleur d'une bulle est celle de son groupe quand la valeur en a une", () => {
  const groups = [
    { key: "s1", label: "À faire", color: "#F2A93B", tasks: [{ id: "t1" }, { id: "t2" }] },
    { key: "s2", label: "Fait", color: "#22B07D", tasks: [{ id: "t3" }] },
  ];
  const map = bubbleColorMap(groups);
  assert.equal(map.get("t1").color, "#F2A93B");
  assert.equal(map.get("t1").groupLabel, "À faire");
  assert.equal(map.get("t3").color, "#22B07D");
  assert.equal(map.get("inconnue"), undefined);
});

test("un groupe sans couleur propre reçoit une teinte de palette stable", () => {
  const groups = [{ key: "Jean Dupont", label: "Jean Dupont", color: "var(--text-muted)", tasks: [{ id: "t1" }] }];
  const first = bubbleColorMap(groups).get("t1").color;
  assert.ok(BUBBLE_PALETTE.includes(first));
  // Même valeur, autre rang, autre jeu de groupes : même couleur.
  const autre = bubbleColorMap([
    { key: "Zoé", label: "Zoé", color: "var(--text-muted)", tasks: [{ id: "t9" }] },
    { key: "Jean Dupont", label: "Jean Dupont", color: "var(--text-muted)", tasks: [{ id: "t1" }] },
  ]).get("t1").color;
  assert.equal(autre, first);
  assert.equal(bubblePaletteColor("Jean Dupont"), first);
  assert.equal(bubblePaletteColor(""), bubblePaletteColor(""));
});

test("la légende ne liste que les groupes représentés, avec leur effectif", () => {
  const entries = bubbleLegendEntries([
    { key: "s1", label: "À faire", color: "#F2A93B", tasks: [{ id: "t1" }, { id: "t2" }] },
    { key: "s2", label: "Fait", color: "#22B07D", tasks: [] },
    { key: "__none", label: "Non défini", color: "#CBD5E1", tasks: [{ id: "t3" }] },
  ]);
  assert.deepEqual(entries.map((e) => e.key), ["s1", "__none"]);
  assert.equal(entries[0].count, 2);
  assert.equal(entries[1].color, "#CBD5E1");
});

// --- Géométrie des macro-bulles ------------------------------------------

const rows = [
  { id: "a", groupKey: "g1", top: 0, height: 40, startIdx: 10, endIdx: 20 },
  { id: "b", groupKey: "g1", top: 40, height: 40, startIdx: 15, endIdx: 30 },
  { id: "c", groupKey: "g1", top: 80, height: 40, startIdx: 40, endIdx: 50 },
  { id: "d", groupKey: "g2", top: 120, height: 40, startIdx: 12, endIdx: 18 },
];

test("des tâches contiguës donnent UNE enveloppe, bornée par leurs dates extrêmes", () => {
  const segs = bubbleMacroSegments(rows, { id: "m1", label: "Essais", taskIds: ["a", "b"] }, ganttFrameSegments, 0);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].startIdx, 10);
  assert.equal(segs[0].endIdx, 30);
  assert.equal(segs[0].top, 0 - BUBBLE_MACRO_CLEARANCE);
  assert.equal(segs[0].height, 80 + BUBBLE_MACRO_CLEARANCE * 2);
  assert.equal(segs[0].macro.label, "Essais");
});

test("des tâches non contiguës, ou séparées par un en-tête de groupe, donnent plusieurs enveloppes", () => {
  assert.equal(bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: ["a", "c"] }, ganttFrameSegments).length, 2);
  // a et d se suivent dans la liste mais changent de groupe : deux enveloppes.
  assert.equal(bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: ["a", "d"] }, ganttFrameSegments).length, 2);
});

test("l'imbrication écarte les enveloppes qui se recouvrent", () => {
  const [niveau0] = bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: ["a", "b"] }, ganttFrameSegments, 0);
  const [niveau1] = bubbleMacroSegments(rows, { id: "m2", label: "L2", taskIds: ["a", "b"] }, ganttFrameSegments, 1);
  assert.equal(niveau0.top - niveau1.top, BUBBLE_MACRO_NEST_STEP);
  assert.equal(niveau1.height - niveau0.height, BUBBLE_MACRO_NEST_STEP * 2);
});

test("une macro-bulle sans tâche, ou sans lignes visibles, ne dessine rien", () => {
  assert.deepEqual(bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: [] }, ganttFrameSegments), []);
  assert.deepEqual(bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: ["absente"] }, ganttFrameSegments), []);
  assert.deepEqual(bubbleMacroSegments([], { id: "m1", label: "L", taskIds: ["a"] }, ganttFrameSegments), []);
  assert.deepEqual(bubbleMacroSegments(rows, { id: "m1", label: "L", taskIds: ["a"] }, null), []);
});

// --- Avancement agrégé ---------------------------------------------------

test("l'avancement agrégé est pondéré par la durée", () => {
  assert.equal(bubbleMacroProgress([{ progress: 0, days: 90 }, { progress: 100, days: 10 }]), 10);
  assert.equal(bubbleMacroProgress([{ progress: 50, days: 10 }, { progress: 100, days: 10 }]), 75);
  assert.equal(bubbleMacroProgress([{ days: 10 }, { progress: 100, days: 10 }]), 50);
  assert.equal(bubbleMacroProgress([{ progress: 420, days: 5 }]), 100);
  assert.equal(bubbleMacroProgress([{ progress: -20, days: 5 }]), 0);
});

test("sans durée exploitable, l'avancement agrégé reste une moyenne simple", () => {
  assert.equal(bubbleMacroProgress([{ progress: 100, days: 0 }, { progress: 0, days: 0 }]), 50);
  assert.equal(bubbleMacroProgress([]), null);
  assert.equal(bubbleMacroProgress("rien"), null);
});

// --- Ordre des lignes ----------------------------------------------------

test("le regroupement amène les tâches d'une macro-bulle côte à côte, dans l'ordre des macro-bulles", () => {
  const ids = ["t1", "t2", "t3", "t4", "t5"];
  const macros = [
    { id: "m1", label: "B", taskIds: ["t4", "t2"] },
    { id: "m2", label: "A", taskIds: ["t5"] },
  ];
  assert.deepEqual(bubbleRowOrder(ids, macros, { grouping: true }), ["t4", "t2", "t5", "t1", "t3"]);
});

test("une tâche partagée par deux macro-bulles suit la première qui la réclame", () => {
  const macros = [
    { id: "m1", label: "1", taskIds: ["t2"] },
    { id: "m2", label: "2", taskIds: ["t2", "t3"] },
  ];
  assert.deepEqual(bubbleRowOrder(["t1", "t2", "t3"], macros, { grouping: true }), ["t2", "t3", "t1"]);
});

test("regroupement désactivé : l'ordre du tri est rendu tel quel", () => {
  const ids = ["t1", "t2", "t3"];
  const macros = [{ id: "m1", label: "1", taskIds: ["t3"] }];
  assert.deepEqual(bubbleRowOrder(ids, macros, { grouping: false }), ids);
  assert.deepEqual(bubbleRowOrder(ids, macros, null), ids);
  // Une tâche rattachée mais absente de l'affichage n'est pas inventée.
  assert.deepEqual(bubbleRowOrder(ids, [{ id: "m", label: "m", taskIds: ["hors-champ"] }], { grouping: true }), ids);
});

// --- Branchement dans l'interface ------------------------------------------
//
// Les fonctions ci-dessus peuvent toutes être justes sans que le widget existe.
// Ces contrôles-là vérifient le CÂBLAGE, au mot près, là où une omission ne se
// verrait qu'à l'usage : un type absent du catalogue, un rendu jamais appelé,
// une taille par défaut oubliée.

test("les champs proposés sous la bulle sont tous rendus par FieldValue", () => {
  // Proposer une clé que FieldValue ignore afficherait une case à cocher sans
  // effet. On lit donc les clés que FieldValue traite vraiment, dans sa source.
  const from = html.indexOf("function FieldValue(");
  assert.ok(from !== -1, "FieldValue introuvable");
  const source = html.slice(from, from + 6000);
  BUBBLE_ROW_FIELD_OPTIONS.forEach((key) => {
    assert.match(source, new RegExp(`fieldKey === "${key}"`), `FieldValue ne rend pas le champ « ${key} »`);
  });
  // Et les défauts font partie des champs proposés.
  BUBBLES_DEFAULTS.bubbleFields.forEach((key) => {
    assert.ok(BUBBLE_ROW_FIELD_OPTIONS.includes(key), `le champ par défaut « ${key} » n'est pas proposé`);
  });
});

test("le widget « Bulles » est câblé partout où un type doit être connu", () => {
  assert.match(html, /\{ key: "bubbles", label: "Bulles", icon: CircleDot, group: "Planning" \}/);
  assert.match(html, /if \(type === "bubbles"\) return \{ w: 8, h: 7 \};/);
  assert.match(html, /type === "minigantt" \|\| type === "bubbles" \|\|/, "le filtre de tâches ignore le type Bulles");
  assert.match(html, /w\.type === "bubbles" && \(\s*<WidgetBubbles/, "le tableau de bord ne rend pas le widget Bulles");
  assert.match(html, /} else if \(w\.type === "bubbles"\) \{/, "l'auto-dimensionnement ignore le type Bulles");
  assert.match(html, /function WidgetBubbles\(props\) \{\s*return <WidgetMiniGantt \{\.\.\.props\} bubbleMode \/>;/,
    "le widget Bulles ne réutilise pas le diagramme du Mini-Gantt");
});

test("le mode bulles ne s'active que par son drapeau", () => {
  // La bascule est un paramètre du Mini-Gantt : hors de ce mode, aucune des
  // branches de bulles ne s'exécute.
  assert.match(html, /const bubbleCfg = bubbleMode \? normalizeBubblesWidget\(widget\) : null;/);
  assert.match(html, /if \(bubbleMode\) return BubbleRow\(t\);/);
  assert.match(html, /if \(bubbleMode\) return BubbleMilestoneRow\(t\);/);
  /* La colonne d'étiquettes de gauche a UNE seule définition, partagée par
     toutes les couches en superposition. Elle lit désormais `--mg-label-w`,
     la variable que le rendu pose après avoir mesuré la colonne : le 26 %
     n'est plus qu'un repli, pour la trame qui précède la mesure. */
  assert.match(html, /const layerInsetLeft = bubbleMode \? 0 : "calc\(var\(--mg-label-w, 26%\) \+ 6px\)";/);
  // Une seule occurrence : celle de la définition ci-dessus. Toute couche qui
  // recopierait ce retrait se désalignerait le jour où il change.
  assert.equal((html.match(/calc\(var\(--mg-label-w, 26%\) \+ 6px\)/g) || []).length, 1,
    "une couche garde un retrait codé en dur au lieu de lire layerInsetLeft");
  // Et plus personne ne refigure les 26 % dans le rendu : la feuille de style
  // les garde comme repli, le rendu lit la variable.
  assert.equal((html.match(/calc\(26% \+ 6px\)/g) || []).length, 0,
    "un retrait de colonne est resté figé à 26 % dans le rendu");
});

test("les réglages des bulles et ceux du Mini-Gantt ne partagent aucune clé d'affichage", () => {
  // Deux widgets, deux jeux de clés : c'est ce qui permet de passer de l'un à
  // l'autre sans que le réglage de l'un écrase celui de l'autre.
  const bubbleKeys = Object.keys(BUBBLES_DEFAULTS);
  assert.ok(bubbleKeys.every((k) => k.startsWith("bubble")), `clé de réglage hors préfixe : ${bubbleKeys.join(", ")}`);
  assert.ok(!bubbleKeys.includes("colorBy"), "les bulles ne doivent pas réutiliser colorBy, qui n'a que trois valeurs");
  assert.ok(!bubbleKeys.includes("miniGanttFields"));
});

// --- Lignes de description réglables (#97) ---------------------------------

test("le nombre de lignes de description est borné, et vaut 1 par défaut", () => {
  assert.equal(BUBBLES_DEFAULTS.bubbleDescriptionLines, 1);
  assert.equal(normalizeBubbleDescriptionLines(2), 2);
  assert.equal(normalizeBubbleDescriptionLines(0), 1);
  assert.equal(normalizeBubbleDescriptionLines(-4), 1);
  assert.equal(normalizeBubbleDescriptionLines(99), BUBBLE_DESC_LINES_MAX);
  assert.equal(normalizeBubbleDescriptionLines(2.4), 2);
  assert.equal(normalizeBubbleDescriptionLines("trois"), 1);
  assert.equal(normalizeBubbleDescriptionLines(undefined), 1);
  // Un widget enregistré avant ce réglage lit donc 1 ligne : l'affichage qu'il
  // avait, au pixel près.
  assert.equal(normalizeBubblesWidget({ type: "bubbles" }).bubbleDescriptionLines, 1);
});

test("la hauteur de bulle se paie en pixels, et seulement si la description est affichée", () => {
  const h = (w) => bubbleHeightPx(w);
  // Sans description, le réglage de lignes est inerte — y compris s'il traîne
  // dans un widget dont on a décoché la description.
  assert.equal(h({ bubbleSize: "normal" }), BUBBLE_HEIGHT_PX.normal);
  assert.equal(h({ bubbleSize: "normal", bubbleDescriptionLines: 3 }), BUBBLE_HEIGHT_PX.normal);
  assert.equal(h({ bubbleSize: "compact" }), BUBBLE_HEIGHT_PX.compact);
  assert.equal(h({ bubbleSize: "large" }), BUBBLE_HEIGHT_PX.large);
  // Une ligne de description ne coûte rien : c'est la hauteur historique.
  assert.equal(h({ bubbleShowDescription: true, bubbleDescriptionLines: 1 }), BUBBLE_HEIGHT_PX.normal);
  // Chaque ligne SUPPLÉMENTAIRE se paie, à toutes les densités.
  assert.equal(h({ bubbleShowDescription: true, bubbleDescriptionLines: 2 }), BUBBLE_HEIGHT_PX.normal + BUBBLE_DESC_LINE_PX);
  assert.equal(h({ bubbleShowDescription: true, bubbleDescriptionLines: 3 }), BUBBLE_HEIGHT_PX.normal + BUBBLE_DESC_LINE_PX * 2);
  assert.equal(h({ bubbleSize: "compact", bubbleShowDescription: true, bubbleDescriptionLines: 3 }),
    BUBBLE_HEIGHT_PX.compact + BUBBLE_DESC_LINE_PX * 2);
  // Valeur invalide : la hauteur reste celle du défaut, jamais NaN.
  assert.equal(h({ bubbleSize: "géant", bubbleShowDescription: true, bubbleDescriptionLines: "x" }), BUBBLE_HEIGHT_PX.normal);
  assert.equal(h(null), BUBBLE_HEIGHT_PX.normal);
});

test("la hauteur de bulle n'a qu'une source : le rendu et l'auto-dimensionnement l'appellent", () => {
  // Le rendu la pose en variable CSS...
  assert.match(html, /"--lp-bubble-h": bubbleHeightPx\(widget\) \+ "px"/);
  assert.match(html, /"--lp-bubble-desc-lines": bubbleCfg\.bubbleDescriptionLines/);
  /* ...et l'auto-dimensionnement du widget appelle la MÊME fonction, par
     l'intermédiaire de `bubbleLaneHeightPx` — la hauteur d'une LIGNE de bulles,
     bandeau condensé compris (#120, #122). Elle n'ajoute rien à la hauteur de
     la bulle : elle la relit. */
  assert.match(html, /const laneH = bubbleLaneHeightPx\(w\);/);
  assert.match(html, /function bubbleLaneHeightPx\(widget, compactLines\) \{[\s\S]*?return bubbleHeightPx\(widget\) \+ fields;/);
  // Aucun des deux ne recopie les nombres : c'était le piège d'un widget qui se
  // redimensionne à une hauteur qui n'est pas celle qu'il dessine.
  assert.doesNotMatch(html, /bubbleSize === "compact" \? 34/);
  assert.doesNotMatch(html, /--lp-bubble-h:\s*\d+px/, "la feuille de style refixe une hauteur de bulle");
  // La description est coupée par la variable, pas par une valeur en dur.
  assert.match(html, /-webkit-line-clamp:var\(--lp-bubble-desc-lines, 1\)/);
});

// --- Étendue réelle d'une ligne (#104) -------------------------------------
//
// L'enveloppe d'une macro-bulle se calculait sur les DATES. Or une bulle courte
// s'étend au-delà de sa date de fin (largeur minimale en pixels) et la bulle
// d'un jalon s'étend des deux côtés de sa date unique (elle est centrée) :
// toutes deux sortaient du cadre.

test("l'étendue d'une ligne tient compte de la largeur minimale d'une bulle", () => {
  // 10 px par jour : une bulle de 90 px couvre 9 jours.
  const courte = bubbleRowExtent({ startIdx: 100, endIdx: 102 }, 10);
  assert.equal(courte.startIdx, 100, "le début ne bouge pas : la bulle part de sa date");
  assert.equal(courte.endIdx, 100 + BUBBLE_MIN_PX / 10);
  assert.ok(courte.endIdx > 102, "une tâche de deux jours occupe plus que deux jours");
  // Une tâche déjà plus longue que le plancher n'est pas étendue.
  const longue = bubbleRowExtent({ startIdx: 100, endIdx: 200 }, 10);
  assert.deepEqual(longue, { startIdx: 100, endIdx: 200 });
});

test("l'étendue d'un jalon s'étend des DEUX côtés de sa date", () => {
  const half = BUBBLE_MILESTONE_W / 2 / 10;
  const jalon = bubbleRowExtent({ startIdx: 150, endIdx: 150, milestone: true }, 10);
  assert.equal(jalon.startIdx, 150 - half);
  assert.equal(jalon.endIdx, 150 + half);
  // Une piste plus large donne moins de jours pour la même largeur en pixels.
  const large = bubbleRowExtent({ startIdx: 150, endIdx: 150, milestone: true }, 40);
  assert.ok(large.endIdx - large.startIdx < jalon.endIdx - jalon.startIdx);
});

test("sans mesure de piste, l'étendue reste celle des dates", () => {
  // Au premier rendu la piste n'est pas mesurée : mieux vaut les dates nues
  // qu'une marge inventée à partir d'un repli.
  assert.deepEqual(bubbleRowExtent({ startIdx: 10, endIdx: 12 }, 0), { startIdx: 10, endIdx: 12 });
  assert.deepEqual(bubbleRowExtent({ startIdx: 10, endIdx: 12 }, -5), { startIdx: 10, endIdx: 12 });
  assert.deepEqual(bubbleRowExtent({ startIdx: 10, endIdx: 12 }, "x"), { startIdx: 10, endIdx: 12 });
  assert.equal(bubbleRowExtent(null, 10), null);
  assert.equal(bubbleRowExtent({ startIdx: "hier", endIdx: 12 }, 10), null);
});

test("seules les macro-bulles utilisent cette étendue, pas les encadrés du Gantt", () => {
  // Les encadrés entourent des BARRES, dont la géométrie suit exactement les
  // dates : leur donner la marge d'une bulle les élargirait pour rien.
  const macro = html.indexOf("const bubbleMacroShapes");
  const frames = html.indexOf("const frameShapes");
  assert.ok(macro !== -1 && frames !== -1);
  const corpsMacro = html.slice(macro, macro + 1800);
  const corpsFrames = html.slice(frames, frames + 1200);
  assert.match(corpsMacro, /bubbleRowExtent\(/, "les macro-bulles n'utilisent pas l'étendue réelle");
  assert.doesNotMatch(corpsFrames, /bubbleRowExtent\(/, "les encadrés du Gantt ont été contaminés");
});

// --- Champs sous la bulle (#103) et infobulle des poignées (#106) ----------

test("les champs sous la bulle reçoivent la boîte de la bulle", () => {
  // Bulle de tâche : sa gauche et sa largeur en pourcentage de la piste.
  assert.match(html, /<RowFields t=\{t\} box=\{\{ left: leftPct \+ "%", width: widthPct \+ "%" \}\} color=\{bubbleColorOf\(t\)\} \/>/);
  // Bulle de jalon : la boîte fixe qu'elle partage avec ses champs.
  assert.match(html, /<RowFields t=\{t\} box=\{\{ left: msBox\.fieldsLeft, width: BUBBLE_MILESTONE_W \+ "px" \}\} color=\{bubbleColorOf\(t\)\} \/>/);
  assert.match(html, /style=\{\{ marginTop: "var\(--lp-bubble-h\)", marginLeft: fieldsBox\.left, width: fieldsBox\.width \}\}/);
  /* Le bandeau condensé suit la même règle, par le même procédé : en flux,
     décalé de la hauteur de la bulle, à la largeur de sa boîte (#122). */
  assert.match(html, /marginTop: "var\(--lp-bubble-h\)", marginLeft: compactBox\.left, width: compactBox\.width/);
});

test("l'infobulle se tait pendant un glisser et au survol d'une poignée", () => {
  assert.match(html, /const openTip = \(t, e\) => \{\s*if \(dragStateRef\.current\) return;/);
  assert.match(html, /const handleHoverGuard = \{/);
  /* Posé sur les SIX poignées : début, fin et avancement de la bulle, et les
     trois mêmes sur la barre du Mini-Gantt — le défaut y est moins visible
     (une barre fait 9 px de haut) mais il est de même nature. */
  assert.equal((html.match(/\{\.\.\.handleHoverGuard\}/g) || []).length, 6,
    "une poignée n'écarte pas l'infobulle");
});

// --- Couloirs : les bulles côte à côte (#120) ------------------------------
//
// Le widget reprenait la géométrie du Mini-Gantt — une tâche, une ligne — et
// dix tâches disjointes dans le temps donnaient dix lignes empilées. Ce qu'on
// veut, c'est Bubble Plan : les bulles d'un couloir se suivent horizontalement
// et on ne descend d'une ligne que lorsqu'il n'y a plus la place.

const ligne = (id, startIdx, endIdx, extra) => ({ id, startIdx, endIdx, ...extra });

test("des bulles disjointes dans le temps tiennent sur une seule ligne", () => {
  // 10 px par jour : une bulle de 90 px couvre 9 jours. Trois tâches de 20
  // jours espacées de 30 ne se gênent donc pas.
  const lanes = bubbleLaneRows(
    [ligne("a", 0, 20), ligne("b", 50, 70), ligne("c", 100, 120)],
    { pxPerDay: 10 },
  );
  assert.equal(lanes.length, 1, "trois bulles disjointes occupent trois lignes");
  assert.deepEqual(lanes[0].items.map((r) => r.id), ["a", "b", "c"]);
  assert.equal(lanes[0].index, 0);
});

test("deux bulles qui se chevauchent descendent d'une ligne, pas les suivantes", () => {
  const lanes = bubbleLaneRows(
    [ligne("a", 0, 40), ligne("b", 20, 60), ligne("c", 100, 140)],
    { pxPerDay: 10 },
  );
  assert.equal(lanes.length, 2);
  // « c » retrouve la première ligne : elle est libre après « a ».
  assert.deepEqual(lanes[0].items.map((r) => r.id), ["a", "c"]);
  assert.deepEqual(lanes[1].items.map((r) => r.id), ["b"]);
});

test("le chevauchement se mesure à l'écran, pas au calendrier", () => {
  /* Deux tâches d'un jour à trois jours d'écart ne se chevauchent pas au
     calendrier. Leurs bulles, elles, ne descendent jamais sous 90 px : à 10 px
     par jour, chacune occupe neuf jours et elles se recouvrent largement. Les
     poser sur la même ligne les rendrait illisibles — c'est tout l'objet de
     `bubbleRowExtent` (#104). */
  const serrees = bubbleLaneRows([ligne("a", 0, 0), ligne("b", 3, 3)], { pxPerDay: 10 });
  assert.equal(serrees.length, 2);
  // La même paire sur une piste dix fois plus large tient sur une ligne : une
  // bulle de 90 px n'y couvre plus qu'un jour.
  const larges = bubbleLaneRows([ligne("a", 0, 0), ligne("b", 3, 3)], { pxPerDay: 100 });
  assert.equal(larges.length, 1);
});

test("un écart minimal sépare deux bulles voisines", () => {
  /* Sans lui, deux bulles qui se suivent se toucheraient bord à bord et on
     lirait une seule bulle coupée d'un trait. L'écart vaut BUBBLE_LANE_GAP_PX
     à l'écran : à 1 px par jour, il pèse donc huit jours. */
  const px = 1;
  const finDeA = BUBBLE_MIN_PX / px; // « a » occupe 90 jours à cette échelle
  const colles = bubbleLaneRows([ligne("a", 0, 0), ligne("b", finDeA + 2, finDeA + 2)], { pxPerDay: px, gapPx: BUBBLE_LANE_GAP_PX });
  assert.equal(colles.length, 2, "deux bulles se touchent au lieu de se séparer");
  const espacees = bubbleLaneRows([ligne("a", 0, 0), ligne("b", finDeA + 20, finDeA + 20)], { pxPerDay: px });
  assert.equal(espacees.length, 1);
});

test("un jalon réserve la place de sa bulle, des deux côtés de sa date", () => {
  // Bulle de jalon : 120 px de large, centrée. À 10 px par jour, elle occupe
  // six jours de part et d'autre.
  const lanes = bubbleLaneRows(
    [ligne("j1", 100, 100, { milestone: true }), ligne("j2", 105, 105, { milestone: true })],
    { pxPerDay: 10 },
  );
  assert.equal(lanes.length, 2);
});

test("l'ordre reçu est respecté : le rangement ne retrie rien", () => {
  // C'est le tri choisi par l'utilisateur. Le retrier ici ferait mentir le
  // réglage « ordre des lignes » du widget.
  const lanes = bubbleLaneRows(
    [ligne("tard", 100, 120), ligne("tot", 0, 20), ligne("milieu", 50, 70)],
    { pxPerDay: 10 },
  );
  assert.equal(lanes.length, 1);
  assert.deepEqual(lanes[0].items.map((r) => r.id), ["tard", "tot", "milieu"]);
});

test("« une tâche, une ligne » reste possible, et ne range rien", () => {
  const lanes = bubbleLaneRows(
    [ligne("a", 0, 20), ligne("b", 50, 70)],
    { pxPerDay: 10, packing: false },
  );
  assert.equal(lanes.length, 2);
  assert.deepEqual(lanes.map((l) => l.items.length), [1, 1]);
  assert.deepEqual(lanes.map((l) => l.key), ["a", "b"]);
});

test("sans piste mesurée, le rangement retombe sur les dates seules", () => {
  // Au premier rendu la piste n'est pas mesurée. Mieux vaut des couloirs
  // calculés sur les dates qu'une géométrie inventée : la mesure tombe à la
  // trame suivante et le rangement se refait.
  const lanes = bubbleLaneRows([ligne("a", 0, 10), ligne("b", 20, 30)], {});
  assert.equal(lanes.length, 1);
  assert.deepEqual(lanes[0].items.map((r) => r.id), ["a", "b"]);
});

test("une liste vide ou sans identifiant ne fabrique aucun couloir", () => {
  assert.deepEqual(bubbleLaneRows([], { pxPerDay: 10 }), []);
  assert.deepEqual(bubbleLaneRows(null, { pxPerDay: 10 }), []);
  assert.deepEqual(bubbleLaneRows([{ startIdx: 0, endIdx: 1 }], { pxPerDay: 10 }), []);
  // Une ligne sans dates exploitables n'est pas dessinée : elle ne peut pas
  // non plus réserver de place, et garde sa propre ligne.
  const lanes = bubbleLaneRows([ligne("x", "hier", 10), ligne("a", 0, 10)], { pxPerDay: 10 });
  assert.equal(lanes.length, 2);
});

test("le mode de disposition se règle, et « couloirs » est le défaut", () => {
  assert.deepEqual(BUBBLE_LAYOUTS, ["lanes", "rows"]);
  assert.equal(BUBBLES_DEFAULTS.bubbleLayout, "lanes");
  assert.equal(normalizeBubbleLayout(undefined), "lanes");
  assert.equal(normalizeBubbleLayout("rows"), "rows");
  assert.equal(normalizeBubbleLayout("colonnes"), "lanes");
  assert.equal(normalizeBubblesWidget({}).bubbleLayout, "lanes");
  assert.equal(normalizeBubblesWidget({ bubbleLayout: "rows" }).bubbleLayout, "rows");
});

test("le rendu décide en un seul endroit entre lignes et couloirs", () => {
  assert.match(html, /const bubblePacked = bubbleMode && normalizeBubbleLayout\(bubbleCfg\.bubbleLayout\) === "lanes";/);
  assert.match(html, /bubblePacked\s*\? BubbleLanes\(list\)/);
  // La mesure des lignes reste indexée PAR TÂCHE : toutes celles d'un couloir
  // pointent sur le même élément, et les macro-bulles continuent de lire
  // rowRects[idDeTâche] sans rien savoir des couloirs.
  assert.match(html, /lane\.items\.forEach\(\(row\) => \{\s*if \(el\) rowNodes\.current\[row\.id\] = el;/);
});

// --- Description : deux étages de teinte (#121) ----------------------------

test("avec la description, l'en-tête garde la couleur de base et le corps s'éclaircit", () => {
  // L'en-tête porte la couleur ; le fond de la bulle, lui, s'allège pour que
  // les deux étages se distinguent.
  assert.match(html, /const headTint = `color-mix\(in srgb, \$\{color\} 26%, transparent\)`;/);
  assert.match(html, /background: `color-mix\(in srgb, \$\{color\} \$\{showDesc \? 5 : 10\}%, var\(--surface\)\)`/);
  /* En `transparent` et non sur la surface du thème : posé en aplat, l'en-tête
     aurait masqué le lavis d'avancement qui court derrière lui. */
  assert.doesNotMatch(html, /const headTint = `color-mix\(in srgb, \$\{color\} 26%, var\(--surface\)\)`;/);
  // Le bandeau épouse le titre : étiré, il repeindrait la zone de description.
  assert.match(html, /\.lp-bubble\.has-desc \.lp-bubble-head\{ flex:0 1 auto;/);
  // Sans description, rien ne change : pas de classe, pas de fond d'en-tête.
  assert.match(html, /const headStyle = showDesc\s*\?[\s\S]*?: undefined;/);
});

// --- Champs condensés rattachés à la bulle (#122) --------------------------

test("la disposition condensée existe, et les couloirs l'imposent", () => {
  assert.deepEqual(BUBBLE_FIELDS_LAYOUTS, ["under", "inline", "compact"]);
  assert.equal(BUBBLES_DEFAULTS.bubbleFieldsLayout, "compact");
  assert.equal(normalizeBubbleFieldsLayout("compact"), "compact");
  // Hors couloirs, le choix est respecté tel quel.
  assert.equal(bubbleEffectiveFieldsLayout({ bubbleLayout: "rows", bubbleFieldsLayout: "under" }), "under");
  assert.equal(bubbleEffectiveFieldsLayout({ bubbleLayout: "rows", bubbleFieldsLayout: "inline" }), "inline");
  /* En couloirs, une bulle a des VOISINES : des champs qui s'étalent en
     plusieurs rangées ou qui débordent à droite viendraient se poser sur
     elles. Le bandeau condensé est la seule forme qui tienne. */
  assert.equal(bubbleEffectiveFieldsLayout({ bubbleLayout: "lanes", bubbleFieldsLayout: "under" }), "compact");
  assert.equal(bubbleEffectiveFieldsLayout({ bubbleLayout: "lanes", bubbleFieldsLayout: "inline" }), "compact");
});

test("la hauteur d'une ligne de bulles compte le bandeau condensé", () => {
  const base = BUBBLE_HEIGHT_PX.normal;
  // Bandeau affiché : la hauteur d'une ligne vaut la bulle plus le bandeau.
  assert.equal(
    bubbleLaneHeightPx({ bubbleLayout: "lanes", bubbleFields: ["status"] }),
    base + BUBBLE_FIELDS_COMPACT_PX,
  );
  // Aucun champ coché : pas de bandeau, donc pas de hauteur en plus.
  assert.equal(bubbleLaneHeightPx({ bubbleLayout: "lanes", bubbleFields: [] }), base);
  // Hors couloirs et champs « sous la bulle » : la ligne est mesurée au rendu,
  // cette fonction ne promet que la bulle.
  assert.equal(bubbleLaneHeightPx({ bubbleLayout: "rows", bubbleFieldsLayout: "under", bubbleFields: ["status"] }), base);
  // La densité et les lignes de description continuent de compter.
  assert.equal(
    bubbleLaneHeightPx({ bubbleLayout: "lanes", bubbleFields: ["status"], bubbleSize: "compact", bubbleShowDescription: true, bubbleDescriptionLines: 2 }),
    BUBBLE_HEIGHT_PX.compact + BUBBLE_DESC_LINE_PX + BUBBLE_FIELDS_COMPACT_PX,
  );
});

test("le bandeau condensé reprend le trait et la couleur de sa bulle", () => {
  // Rattaché : pas de bord haut, les arrondis bas de la bulle, sa couleur.
  assert.match(html, /\.lp-bubble-fields\.is-compact\{[^}]*border-top:0;/);
  assert.match(html, /\.lp-bubble-fields\.is-compact\{[^}]*border-radius:0 0 var\(--radius-sm\) var\(--radius-sm\);/);
  assert.match(html, /background: color \? `color-mix\(in srgb, \$\{color\} 8%, var\(--surface\)\)` : "var\(--surface\)"/);
  /* Il PASSE À LA LIGNE plutôt que de tronquer (#122) : beaucoup de champs et
     il ne restait qu'un « Quentin · À pla… » qui ne disait plus rien. Sa
     hauteur est posée par le rendu, la même pour toutes les bulles du widget. */
  assert.match(html, /\.lp-bubble-fields\.is-compact\{[^}]*flex-wrap:wrap;/);
  assert.match(html, /\.lp-bubble-fields\.is-compact\{[^}]*height:var\(--lp-bubble-fields-h, 16px\);/);
  assert.match(html, /"--lp-bubble-fields-h": bubbleCompactFieldsHeight\(compactFieldLines\) \+ "px"/);
  // Point médian entre deux valeurs, jamais avant la première.
  assert.match(html, /\.lp-bubble-fields\.is-compact > \* \+ \*::before\{\s*content:"·";/);
  /* Les valeurs restent celles de FieldValue : c'est la feuille de style qui
     condense, pas un second formateur qui finirait par diverger. */
  assert.match(html, /\.lp-bubble-fields\.is-compact \.lp-chip\{/);
});

test("la place libre entre deux voisines se mesure sur les boîtes DESSINÉES", () => {
  /* Les dates s'écrivent DEHORS, à gauche et à droite de la bulle. Seules sur
     leur ligne, elles ne recouvraient que du vide ; rangées côte à côte, elles
     se posaient sur la bulle voisine (retour de test).

     Le calcul ne passe PAS par `bubbleRowExtent` : celle-là modélise ce qu'une
     bulle occupe pour le RANGEMENT, à partir des seules dates, alors que la
     boîte d'un jalon est recalée contre le bord de la piste dès qu'elle y
     dépasserait. Les deux divergent donc au bord, et c'est la boîte dessinée
     qui décide s'il reste la place d'écrire une date. */
  assert.match(html, /const bubbleSlotBoxPx = \(t\) => \{/);
  assert.match(html, /bubbleTrackPx - centerPx < half \? bubbleTrackPx - BUBBLE_MILESTONE_W : centerPx - half/);
  assert.match(html, /before: prev \? Math\.max\(0, \(box\.leftPx - prev\.rightPx\) \/ 2\) : Infinity,/);
  assert.match(html, /after: next \? Math\.max\(0, \(next\.leftPx - box\.rightPx\) \/ 2\) : Infinity,/);
  // Et l'affichage d'une date retient la plus petite des deux places : le bord
  // de la piste, et la voisine.
  assert.match(html, /laneRoom && Number\.isFinite\(laneRoom\.before\) \? laneRoom\.before : Infinity,/);
});

// --- Retours de test du 17/09 ----------------------------------------------

test("les dates de deux bulles voisines se partagent l'écart qui les sépare", () => {
  /* Elles se posent dans le MÊME intervalle : la date de fin de l'une à droite,
     la date de début de la suivante à gauche. Chacune croyait avoir tout
     l'écart pour elle, et les deux s'écrivaient l'une sur l'autre (#120). */
  const room = bubbleLaneDateRoom([
    { id: "a", leftPx: 0, rightPx: 100 },
    { id: "b", leftPx: 200, rightPx: 300 },
  ]);
  assert.equal(room.get("a").after, 50, "la moitié de l'écart, pas l'écart entier");
  assert.equal(room.get("b").before, 50);
  // Aux extrémités, il n'y a pas de voisine à ménager.
  assert.equal(room.get("a").before, Infinity);
  assert.equal(room.get("b").after, Infinity);
});

test("le partage de l'écart se fait sur la position RÉELLE, pas sur l'ordre reçu", () => {
  // L'ordre du couloir suit le tri de l'utilisateur, pas le temps : le calcul
  // trie donc lui-même sur la gauche mesurée.
  const room = bubbleLaneDateRoom([
    { id: "tard", leftPx: 400, rightPx: 500 },
    { id: "tot", leftPx: 0, rightPx: 100 },
  ]);
  assert.equal(room.get("tot").after, 150);
  assert.equal(room.get("tard").before, 150);
  // Deux bulles qui se touchent ne laissent aucune place, jamais une négative.
  const colle = bubbleLaneDateRoom([
    { id: "a", leftPx: 0, rightPx: 100 },
    { id: "b", leftPx: 90, rightPx: 200 },
  ]);
  assert.equal(colle.get("a").after, 0);
  assert.equal(colle.get("b").before, 0);
  // Une boîte sans géométrie exploitable n'entre pas dans le calcul.
  assert.equal(bubbleLaneDateRoom([{ id: "x" }, null, { leftPx: 1, rightPx: 2 }]).size, 0);
  assert.equal(bubbleLaneDateRoom(null).size, 0);
});

test("la hauteur du bandeau condensé suit le nombre de lignes, et se borne", () => {
  // Une ligne : la hauteur d'origine, au pixel près — un widget qui tient sur
  // une ligne ne bouge pas.
  assert.equal(bubbleCompactFieldsHeight(1), BUBBLE_FIELDS_COMPACT_PX);
  assert.equal(bubbleCompactFieldsHeight(2), BUBBLE_FIELDS_COMPACT_PX + BUBBLE_FIELDS_COMPACT_LINE_PX);
  assert.equal(bubbleCompactFieldsHeight(3), BUBBLE_FIELDS_COMPACT_PX + BUBBLE_FIELDS_COMPACT_LINE_PX * 2);
  /* Au-delà de quatre lignes, les champs occuperaient plus de place que la
     bulle et ce ne serait plus un bandeau. */
  assert.equal(bubbleCompactFieldsHeight(99), bubbleCompactFieldsHeight(BUBBLE_FIELDS_COMPACT_LINES_MAX));
  // Valeurs absurdes : une ligne, jamais NaN ni zéro.
  assert.equal(bubbleCompactFieldsHeight(0), BUBBLE_FIELDS_COMPACT_PX);
  assert.equal(bubbleCompactFieldsHeight(-3), BUBBLE_FIELDS_COMPACT_PX);
  assert.equal(bubbleCompactFieldsHeight("beaucoup"), BUBBLE_FIELDS_COMPACT_PX);
  assert.equal(bubbleCompactFieldsHeight(undefined), BUBBLE_FIELDS_COMPACT_PX);
});

test("la hauteur d'une ligne de couloir suit celle du bandeau", () => {
  const base = BUBBLE_HEIGHT_PX.normal;
  const w = { bubbleLayout: "lanes", bubbleFields: ["status", "assignee", "end"] };
  assert.equal(bubbleLaneHeightPx(w, 1), base + bubbleCompactFieldsHeight(1));
  assert.equal(bubbleLaneHeightPx(w, 3), base + bubbleCompactFieldsHeight(3));
  // Sans champ, pas de bandeau : le nombre de lignes ne change rien.
  assert.equal(bubbleLaneHeightPx({ bubbleLayout: "lanes", bubbleFields: [] }, 3), base);
});

test("le nombre de lignes du bandeau est MESURÉ, et régularisé pour tout le widget", () => {
  /* On compte les lignes par les offsetTop DISTINCTS des pastilles, et non par
     la hauteur du bandeau : celle-ci est justement ce qu'on lui impose, et la
     mesurer reviendrait à se mesurer soi-même — la hauteur ne pourrait alors
     que croître, jamais revenir. */
  assert.match(html, /tops\.add\(Math\.round\(child\.offsetTop\)\);/);
  assert.doesNotMatch(html, /setCompactFieldLines\([^)]*scrollHeight/);
  // La plus haute l'emporte, et c'est elle que toutes les bulles adoptent.
  assert.match(html, /lines = Math\.max\(lines, tops\.size \|\| 1\);/);
});

// --- Couloirs réservés des annotations en mode bulles (#93) ----------------

test("en bulles, les traits quittent les lignes pour leur propre couloir", () => {
  /* Le rattachement à une tâche décide de la hauteur d'un trait. En Gantt, une
     tâche est une ligne fine ; en bulles, c'est une BOÎTE, et le trait lui
     passait en plein milieu. */
  assert.match(html, /const spanLayer = \(bubbleMode \|\| !rowsBand \|\| !spanShapes\.length\) \? null : \(/);
  assert.match(html, /const bubbleSpanLane = \(!bubbleMode \|\| !bubbleSpanRows\.length\) \? null : \(/);
  // Un trait par ligne, triés par date de début.
  assert.match(html, /a\.startIdx - b\.startIdx/);
  assert.match(html, /className="lp-widget-minigantt-row lp-bubble-annot-row"/);
  // Et les deux couloirs sont NOMMÉS.
  assert.match(html, /<div className="lp-bubble-lane-caption">Jalons<\/div>/);
  assert.match(html, /<div className="lp-bubble-lane-caption">Annotations horizontales<\/div>/);
  /* La légende est sur sa propre ligne, pleine largeur : lui donner une colonne
     à gauche décalerait la piste de ces bandes, et toutes les couches
     superposées avec elle. */
  assert.match(html, /\.lp-widget-minigantt\.is-bubbles \.lp-bubble-lane-caption\{/);
});

// --- Blocs temporels et pied de réserve (#113) -----------------------------

test("la couche des blocs temporels comprend le débord réservé en pied", () => {
  /* Le pied de réserve a été ajouté sous les lignes ; les blocs, eux, sont une
     bande continue calculée sur les seules boîtes de lignes. Ils s'arrêtaient
     donc où s'arrêtaient les lignes, et non où s'arrête le diagramme. */
  assert.match(html, /height: rowsBand\.height \+ rowsTail,/);
  assert.doesNotMatch(html, /top: rowsBand\.top,\s*height: rowsBand\.height,\s*\};/);
});
