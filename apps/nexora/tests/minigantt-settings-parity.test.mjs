import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Mêmes règles que les autres suites du Mini-Gantt : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite, entre les sentinelles du bloc.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:GANTT-ANNOTATIONS:START ===";
const END = "// === NEXORA:GANTT-ANNOTATIONS:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc d'annotations Gantt introuvable dans .build/index.html");

const EXPORTS = ["MINIGANTT_GROUPBY_FIELDS", "miniGanttGroupByKeys", "miniGanttWindowMessage", "miniGanttPinnedWindow"];
const { MINIGANTT_GROUPBY_FIELDS, miniGanttGroupByKeys, miniGanttWindowMessage, miniGanttPinnedWindow } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

// --- Regroupements ---------------------------------------------------------
test("les regroupements du Mini-Gantt couvrent l'inactivité et la période", () => {
  // La vue et le menu « Regrouper » n'en connaissaient qu'une partie, alors que
  // la fiche du widget allait plus loin : c'est le reproche de l'issue #86.
  ["project", "status", "criticality", "taskType", "assignee", "milestone", "inactivity", "period"]
    .forEach((key) => assert.ok(MINIGANTT_GROUPBY_FIELDS.includes(key), `regroupement manquant : ${key}`));
  const keys = miniGanttGroupByKeys(null);
  assert.equal(keys[0], "none", "« Aucun regroupement » vient toujours en tête");
  assert.deepEqual(keys.slice(1), MINIGANTT_GROUPBY_FIELDS);
});

test("la liste des regroupements ne dépend d'aucun argument", () => {
  // Les champs personnalisés ont disparu : il ne reste que le catalogue fixe,
  // et l'appelant n'a plus rien à fournir pour l'obtenir en entier.
  assert.deepEqual(miniGanttGroupByKeys(), miniGanttGroupByKeys(null));
  assert.deepEqual(miniGanttGroupByKeys({}), miniGanttGroupByKeys(undefined));
  assert.ok(!miniGanttGroupByKeys().some((k) => k.startsWith("cf:")));
});

// --- Fenêtre à dates fixes -------------------------------------------------
test("seul le cadrage « Dates fixes » exige deux dates", () => {
  assert.equal(miniGanttWindowMessage({ mode: "auto" }, "", ""), "");
  assert.equal(miniGanttWindowMessage({ mode: "rolling" }, "", ""), "");
  assert.equal(miniGanttWindowMessage(undefined, "", ""), "");
});

test("une fenêtre incomplète ou à l'envers est signalée, pas avalée", () => {
  const fixe = { mode: "fixed" };
  assert.match(miniGanttWindowMessage(fixe, "", "2026-12-31"), /date de début/);
  assert.match(miniGanttWindowMessage(fixe, "pas une date", "2026-12-31"), /date de début/);
  assert.match(miniGanttWindowMessage(fixe, "2026-01-01", ""), /date de fin/);
  assert.match(miniGanttWindowMessage(fixe, "2026-12-31", "2026-01-01"), /postérieure/);
  assert.equal(miniGanttWindowMessage(fixe, "2026-01-01", "2026-12-31"), "");
  // Le message double le garde-fou du rendu, il ne le remplace pas : une
  // fenêtre refusée ici est déjà ignorée par le cadrage.
  assert.equal(miniGanttPinnedWindow({ miniGanttRange: fixe, miniGanttWindow: { start: "", end: "2026-12-31" } }), null);
});

// --- Un seul formulaire pour la fiche et pour la vue ------------------------
test("la fiche du widget et la vue Gantt partagent le MÊME formulaire", () => {
  const definitions = html.match(/function MiniGanttDisplayFields\(/g) || [];
  assert.equal(definitions.length, 1, "le formulaire d'affichage doit être défini une seule fois");
  const usages = html.match(/<MiniGanttDisplayFields\b/g) || [];
  assert.equal(usages.length, 2, "il doit être utilisé par la fiche du widget ET par les réglages de la vue");

  // Les réglages de la vue ne gardent aucune copie des champs : tout passe par
  // le composant partagé, sans quoi les deux panneaux pourraient redivergent.
  const debut = html.indexOf("function MiniGanttViewSettings(");
  const fin = html.indexOf("function MiniGanttView(", debut);
  assert.ok(debut !== -1 && fin > debut, "réglages de la vue Gantt introuvables");
  const vue = html.slice(debut, fin);
  assert.match(vue, /<MiniGanttDisplayFields/);
  ["Couleur des barres", "Ordre des lignes", "Étendue temporelle", "Mode d'affichage"]
    .forEach((label) => assert.ok(!vue.includes(label), `réglage recopié dans la vue : ${label}`));
});

test("le menu « Regrouper » de la barre d'outils lit la même liste", () => {
  const menu = html.indexOf('<DropdownButton label="Regrouper"');
  assert.ok(menu !== -1, "menu « Regrouper » introuvable");
  const extrait = html.slice(menu, menu + 400);
  assert.match(extrait, /miniGanttGroupByKeys\(ctx\)/);
});
