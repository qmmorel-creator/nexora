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
  // La colonne d'étiquettes de gauche a UNE seule définition, partagée par
  // toutes les couches en superposition.
  assert.match(html, /const layerInsetLeft = bubbleMode \? 0 : "calc\(26% \+ 6px\)";/);
  // Une seule occurrence : celle de la définition ci-dessus. Toute couche qui
  // recopierait ce retrait se désalignerait le jour où il change.
  assert.equal((html.match(/calc\(26% \+ 6px\)/g) || []).length, 1,
    "une couche garde un retrait codé en dur au lieu de lire layerInsetLeft");
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
  // ...et l'auto-dimensionnement du widget appelle la MÊME fonction.
  assert.match(html, /const bubbleH = bubbleHeightPx\(w\);/);
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
  assert.match(html, /<RowFields t=\{t\} box=\{\{ left: leftPct \+ "%", width: widthPct \+ "%" \}\} \/>/);
  // Bulle de jalon : la boîte fixe qu'elle partage avec ses champs.
  assert.match(html, /<RowFields t=\{t\} box=\{\{ left: msBox\.fieldsLeft, width: BUBBLE_MILESTONE_W \+ "px" \}\} \/>/);
  assert.match(html, /style=\{\{ marginTop: "var\(--lp-bubble-h\)", marginLeft: fieldsBox\.left, width: fieldsBox\.width \}\}/);
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
