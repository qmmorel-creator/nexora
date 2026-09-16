import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Mêmes règles que les autres bancs : les fonctions testées sont extraites de
// l'interface RÉELLEMENT construite, jamais recopiées à côté.
const START = "// === NEXORA:WIDGET-TRANSFER:START ===";
const END = "// === NEXORA:WIDGET-TRANSFER:END ===";
const EXPORTS = [
  "WIDGET_TRANSFER_MODES",
  "widgetTransferNormalizeMode",
  "widgetTransferTargets",
  "widgetTransferLocate",
  "widgetTransferCopy",
  "widgetTransferApply",
];

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de transfert de widget introuvable dans dist/index.html");

const {
  WIDGET_TRANSFER_MODES,
  widgetTransferNormalizeMode,
  widgetTransferTargets,
  widgetTransferLocate,
  widgetTransferCopy,
  widgetTransferApply,
} = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

// Deux plans : « Aujourd'hui » à page unique, un tableau de bord à deux pages.
const boards = () => ([
  { id: "today", name: "Aujourd'hui", pages: [{ id: "tp", name: "Aujourd'hui", widgets: [{ id: "w0", title: "Point du jour" }] }] },
  {
    id: "d1",
    name: "Chantiers",
    pages: [
      { id: "p1", name: "Page 1", widgets: [{ id: "w1", title: "Retards", limit: 6, layout: { x: 3, y: 2, w: 4, h: 5 } }] },
      { id: "p2", name: "Suivi", widgets: [] },
    ],
  },
]);
const widgetsOf = (list, boardId, pageId) =>
  list.find((b) => b.id === boardId).pages.find((p) => p.id === pageId).widgets;
const ids = (list, boardId, pageId) => widgetsOf(list, boardId, pageId).map((w) => w.id);

let counter = 0;
const makeId = () => `new-${++counter}`;

test("les destinations nomment la page seulement quand il y en a plusieurs", () => {
  const targets = widgetTransferTargets(boards());
  assert.deepEqual(targets.map((t) => t.label), ["Aujourd'hui", "Chantiers › Page 1", "Chantiers › Suivi"]);
  // « Aujourd'hui › Aujourd'hui » était le libellé naturel, et il n'a aucun
  // sens : l'onglet n'existe pas à l'écran quand il est seul.
  assert.equal(targets[0].pageId, "tp");
});

test("un plan sans page ne propose aucune destination", () => {
  assert.deepEqual(widgetTransferTargets([{ id: "vide", name: "Vide", pages: [] }]), []);
  assert.deepEqual(widgetTransferTargets(undefined), []);
});

test("déplacer retire de la source et pose dans la destination", () => {
  const out = widgetTransferApply(boards(), "w1", { boardId: "today", pageId: "tp" }, "move", makeId);
  assert.deepEqual(ids(out, "d1", "p1"), [], "le widget doit QUITTER sa page d'origine");
  assert.deepEqual(ids(out, "today", "tp"), ["w0", "w1"]);
  // Même identifiant : c'est le même widget, pas une copie.
  assert.equal(widgetsOf(out, "today", "tp")[1].title, "Retards");
});

test("déplacer oublie la position : la grille de destination replace le widget", () => {
  // Reprise telle quelle, la position d'origine chevaucherait ce qui occupe
  // déjà ces cases sur l'autre page — sans erreur, et sans que rien ne bouge.
  const out = widgetTransferApply(boards(), "w1", { boardId: "d1", pageId: "p2" }, "move", makeId);
  assert.equal(widgetsOf(out, "d1", "p2")[0].layout, undefined);
});

test("dupliquer laisse l'original en place et pose une copie d'identité distincte", () => {
  const out = widgetTransferApply(boards(), "w1", { boardId: "d1", pageId: "p2" }, "duplicate", makeId);
  assert.deepEqual(ids(out, "d1", "p1"), ["w1"], "l'original ne bouge pas");
  const copie = widgetsOf(out, "d1", "p2")[0];
  assert.notEqual(copie.id, "w1", "Un identifiant partagé ferait bouger l'original avec la copie.");
  assert.equal(copie.title, "Retards (copie)");
});

test("les réglages en cours dans la fiche partent avec le widget déplacé", () => {
  // Sans cela, « Enregistrer » et « Changer de tableau de bord » se
  // contrediraient : le widget arriverait avec sa configuration d'avant.
  const out = widgetTransferApply(boards(), "w1", { boardId: "d1", pageId: "p2" }, "move", makeId, { title: "Retards (7 j)", limit: 12 });
  const moved = widgetsOf(out, "d1", "p2")[0];
  assert.equal(moved.title, "Retards (7 j)");
  assert.equal(moved.limit, 12);
});

test("dupliquer enregistre aussi la fiche sur l'original", () => {
  // Sinon les réglages affichés ne partiraient qu'avec la copie, et
  // sembleraient s'être perdus sur le widget resté en place.
  const out = widgetTransferApply(boards(), "w1", { boardId: "today", pageId: "tp" }, "duplicate", makeId, { limit: 12 });
  assert.equal(widgetsOf(out, "d1", "p1")[0].limit, 12);
  assert.equal(widgetsOf(out, "today", "tp")[1].limit, 12);
});

test("déplacer vers la page où il est déjà ne change rien, et rend LA MÊME liste", () => {
  const input = boards();
  // Rendre le même objet évite une écriture distante inutile — même règle que
  // la coche du Mini-Gantt.
  assert.equal(widgetTransferApply(input, "w1", { boardId: "d1", pageId: "p1" }, "move", makeId), input);
});

test("une destination inconnue ou un widget introuvable ne touche à rien", () => {
  const input = boards();
  assert.equal(widgetTransferApply(input, "w1", { boardId: "fantome", pageId: "p1" }, "move", makeId), input);
  assert.equal(widgetTransferApply(input, "w1", { boardId: "d1", pageId: "fantome" }, "move", makeId), input);
  assert.equal(widgetTransferApply(input, "inconnu", { boardId: "d1", pageId: "p2" }, "move", makeId), input);
  assert.equal(widgetTransferApply(input, "w1", null, "move", makeId), input);
});

test("dupliquer sur place ne perd pas l'original", () => {
  const out = widgetTransferApply(boards(), "w1", { boardId: "d1", pageId: "p1" }, "duplicate", makeId);
  assert.equal(widgetsOf(out, "d1", "p1").length, 2, "poser avant de retirer effacerait la copie");
  assert.equal(widgetsOf(out, "d1", "p1")[0].id, "w1");
});

test("un mode inconnu déplace plutôt que de dupliquer au hasard", () => {
  assert.deepEqual(WIDGET_TRANSFER_MODES, ["move", "duplicate"]);
  assert.equal(widgetTransferNormalizeMode("copier"), "move");
  assert.equal(widgetTransferNormalizeMode(undefined), "move");
  assert.equal(widgetTransferNormalizeMode("duplicate"), "duplicate");
});

test("localiser un widget dit de quel plan et de quelle page il vient", () => {
  assert.deepEqual(widgetTransferLocate(boards(), "w1").boardId, "d1");
  assert.deepEqual(widgetTransferLocate(boards(), "w1").pageId, "p1");
  assert.equal(widgetTransferLocate(boards(), "absent"), null);
});

test("la copie ne garde ni l'identifiant ni la position de l'original", () => {
  const copie = widgetTransferCopy({ id: "w1", title: "Retards", layout: { x: 1, y: 1, w: 2, h: 2 } }, makeId);
  assert.notEqual(copie.id, "w1");
  assert.equal(copie.layout, undefined);
});

test("les plans non concernés sont rendus À L'IDENTIQUE", () => {
  // Un plan recréé sans raison ferait repartir une écriture Firebase pour
  // chaque tableau de bord à chaque transfert.
  const input = boards();
  const out = widgetTransferApply(input, "w1", { boardId: "d1", pageId: "p2" }, "move", makeId);
  assert.equal(out[0], input[0], "« Aujourd'hui » n'est pas concerné : il doit être rendu tel quel");
});
