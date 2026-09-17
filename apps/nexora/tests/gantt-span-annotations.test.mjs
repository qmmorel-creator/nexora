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
  "normalizeMiniGanttSpanCap",
  "MINIGANTT_SPAN_CAPS",
  "MILESTONE_TYPE_SEED",
  "MILESTONE_SYMBOLS",
  "MILESTONE_SYMBOL_KEYS",
  "milestoneSymbolFor",
  "normalizeMilestoneTypes",
  "milestoneTypeFor",
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
  normalizeMiniGanttSpanCap,
  MINIGANTT_SPAN_CAPS,
  MILESTONE_TYPE_SEED,
  MILESTONE_SYMBOLS,
  MILESTONE_SYMBOL_KEYS,
  milestoneSymbolFor,
  normalizeMilestoneTypes,
  milestoneTypeFor,
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

// --- Bouts d'une annotation horizontale (#93) ------------------------------
test("les bouts se règlent extrémité par extrémité, et retombent sur le rond creux", () => {
  const [normalisee] = normalizeMiniGanttSpans([span()]);
  assert.equal(normalisee.capStart, "circle", "valeur par défaut : le rendu d'avant le réglage");
  assert.equal(normalisee.capEnd, "circle");

  // Les deux extrémités sont indépendantes : « |———▶ » doit être exprimable.
  const [fleche] = normalizeMiniGanttSpans([span({ capStart: "bar", capEnd: "arrow" })]);
  assert.equal(fleche.capStart, "bar");
  assert.equal(fleche.capEnd, "arrow");

  // Un bout inconnu ne fait pas disparaître le trait : il retombe sur le rond.
  for (const bad of [undefined, null, "", "triangle", 7]) {
    assert.equal(normalizeMiniGanttSpanCap(bad), "circle", `bout invalide accepté : ${bad}`);
  }
  MINIGANTT_SPAN_CAPS.forEach((cap) => assert.equal(normalizeMiniGanttSpanCap(cap), cap));
  assert.ok(MINIGANTT_SPAN_CAPS.includes("none"), "« aucun bout » doit rester possible");

  // Normaliser deux fois ne change plus rien.
  const une = normalizeMiniGanttSpans([span({ capStart: "diamond", capEnd: "none" })]);
  assert.deepEqual(normalizeMiniGanttSpans(une), une);
});

// --- Catalogue des types de jalon (#94) ------------------------------------
test("le catalogue propose au moins vingt symboles, tous distincts", () => {
  assert.ok(MILESTONE_SYMBOLS.length >= 20, `${MILESTONE_SYMBOLS.length} symboles, 20 au minimum attendus`);
  assert.equal(new Set(MILESTONE_SYMBOL_KEYS).size, MILESTONE_SYMBOLS.length, "deux symboles partagent une clé");
  assert.equal(new Set(MILESTONE_SYMBOLS.map((s) => s.d)).size, MILESTONE_SYMBOLS.length, "deux symboles ont le même tracé");
  MILESTONE_SYMBOLS.forEach((symbol) => {
    assert.ok(symbol.label && symbol.label.trim(), `symbole sans libellé : ${symbol.key}`);
    assert.match(symbol.d, /^M/, `tracé SVG douteux pour ${symbol.key}`);
  });
  // Une clé inconnue ne laisse jamais un repère sans dessin.
  for (const inconnu of [undefined, null, "", "pas-un-symbole", 3]) {
    assert.equal(milestoneSymbolFor(inconnu), MILESTONE_SYMBOLS[0]);
  }
});

test("un catalogue absent ou illisible rend celui de départ, jamais rien", () => {
  for (const empty of [undefined, null, [], {}, "", 0, [null], [{}], [{ id: "x" }], [{ name: "Sans id" }]]) {
    assert.deepEqual(normalizeMilestoneTypes(empty), MILESTONE_TYPE_SEED.map((t) => ({ ...t })));
  }
  // Les cinq identifiants historiques SONT ceux du catalogue de départ : c'est
  // ce qui laisse à un jalon déjà posé son type, son nom et sa couleur.
  assert.deepEqual(
    MILESTONE_TYPE_SEED.map((t) => t.id),
    ["standard", "decision", "contractual", "delivery", "commissioning"],
  );
  MILESTONE_TYPE_SEED.forEach((t) => assert.ok(MILESTONE_SYMBOL_KEYS.includes(t.symbol), `symbole inconnu : ${t.symbol}`));
  // Deux types de départ ne partagent ni symbole ni couleur.
  assert.equal(new Set(MILESTONE_TYPE_SEED.map((t) => t.symbol)).size, MILESTONE_TYPE_SEED.length);
  assert.equal(new Set(MILESTONE_TYPE_SEED.map((t) => t.color)).size, MILESTONE_TYPE_SEED.length);
});

test("un type réglé dans les Réglages est nettoyé sans être dénaturé", () => {
  const [type] = normalizeMilestoneTypes([{ id: "t1", name: "  Revue de conception  ", symbol: "shield", color: "#112233" }]);
  assert.deepEqual(type, { id: "t1", name: "Revue de conception", symbol: "shield", color: "#112233" });

  // Un symbole inconnu retombe sur le premier, une couleur absente sur celle
  // du type de départ : un type reste toujours dessinable.
  const [bancal] = normalizeMilestoneTypes([{ id: "t2", name: "Sans rien", symbol: "licorne" }]);
  assert.equal(bancal.symbol, MILESTONE_SYMBOLS[0].key);
  assert.equal(bancal.color, MILESTONE_TYPE_SEED[0].color);

  // Idempotence : relire une configuration déjà enregistrée ne la déforme pas.
  const une = normalizeMilestoneTypes([{ id: "t3", name: "Essais", symbol: "bolt", color: "#F2A93B" }]);
  assert.deepEqual(normalizeMilestoneTypes(une), une);
});

test("un jalon dont le type a disparu prend le premier du catalogue, pas rien", () => {
  const catalogue = [
    { id: "a", name: "Revue", symbol: "shield", color: "#112233" },
    { id: "b", name: "Essais", symbol: "bolt", color: "#F2A93B" },
  ];
  assert.equal(milestoneTypeFor(catalogue, "b").name, "Essais");
  for (const perdu of ["supprime", undefined, null, ""]) {
    assert.equal(milestoneTypeFor(catalogue, perdu).id, "a", `type perdu mal rattrapé : ${perdu}`);
  }
  // Sans catalogue du tout, on retombe sur le type de départ.
  assert.equal(milestoneTypeFor(null, "decision").id, "decision");
  assert.equal(milestoneTypeFor(undefined, "inconnu").id, MILESTONE_TYPE_SEED[0].id);
});
