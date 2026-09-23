import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même règle que les autres suites : la fonction testée est extraite de
// l'interface RÉELLEMENT construite, entre les sentinelles du bloc.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:PROJECT-DEFAULT-VIEW:START ===";
const END = "// === NEXORA:PROJECT-DEFAULT-VIEW:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de la vue par défaut introuvable dans .build/index.html");

// Le bloc lit PROJECT_DEFAULT_VIEW_OPTIONS, déclaré juste au-dessus de lui.
const optionsFrom = html.lastIndexOf("const PROJECT_DEFAULT_VIEW_OPTIONS = [", from);
assert.ok(optionsFrom !== -1, "catalogue des vues proposées introuvable");
const optionsTo = html.indexOf("];", optionsFrom) + 2;

const { normalizeProjectDefaultView, mergeProjectNavigationDefaults, PROJECT_DEFAULT_VIEW_OPTIONS } =
  vm.runInThisContext(
    `(function () {\n${html.slice(optionsFrom, optionsTo)}\n${html.slice(from + START.length, to)}\n` +
    `;return { normalizeProjectDefaultView, mergeProjectNavigationDefaults, PROJECT_DEFAULT_VIEW_OPTIONS };\n})`
  )();

test("le réglage général n'accepte qu'une vue réellement proposée", () => {
  assert.equal(normalizeProjectDefaultView("gantt"), "gantt");
  assert.equal(normalizeProjectDefaultView("projects"), "projects");
  // Une vue retirée du produit, une clé inventée, une valeur absente : toutes
  // retombent sur « ne rien imposer » plutôt que d'ouvrir une vue inexistante.
  assert.equal(normalizeProjectDefaultView("chiffrage"), "");
  assert.equal(normalizeProjectDefaultView("calendar"), "");
  assert.equal(normalizeProjectDefaultView("n'importe quoi"), "");
  assert.equal(normalizeProjectDefaultView(undefined), "");
  assert.equal(normalizeProjectDefaultView(null), "");
});

test("le projet prime sur le dossier, qui prime sur le réglage général", () => {
  const projet = { navigationDefaults: { view: "table" } };
  const dossier = { navigationDefaults: { view: "radar" } };
  assert.equal(mergeProjectNavigationDefaults(projet, dossier, "gantt").view, "table");
  assert.equal(mergeProjectNavigationDefaults(null, dossier, "gantt").view, "radar");
  assert.equal(mergeProjectNavigationDefaults(null, null, "gantt").view, "gantt");
});

test("sans réglage général, rien n'est imposé — le comportement d'avant", () => {
  assert.equal(mergeProjectNavigationDefaults(null, null, "").view, "");
  assert.equal(mergeProjectNavigationDefaults(null, null).view, "");
  assert.equal(mergeProjectNavigationDefaults({}, {}, undefined).view, "");
  // Un réglage général devenu invalide ne doit pas s'imposer non plus.
  assert.equal(mergeProjectNavigationDefaults(null, null, "chiffrage").view, "");
});

test("le zoom et les filtres gardent leurs propres règles", () => {
  // Le réglage général ne porte QUE la vue : lui laisser emporter un zoom
  // ouvrirait une échelle que personne n'a choisie.
  const dossier = { navigationDefaults: { zoom: "month", filters: { onlyLate: true } } };
  const cfg = mergeProjectNavigationDefaults(null, dossier, "gantt");
  assert.equal(cfg.view, "gantt");
  assert.equal(cfg.zoom, "month");
  assert.deepEqual(cfg.filters, { onlyLate: true });
  assert.equal(mergeProjectNavigationDefaults(null, null, "gantt").zoom, "");
});

test("les vues proposées sont toutes des vues qui existent encore", () => {
  const keys = PROJECT_DEFAULT_VIEW_OPTIONS.map((v) => v.key);
  // #137 : "dashboard" (Tableau de bord contextuel) s'ajoute aux vues de
  // tâches déjà proposées — utile avec une page dont le filtre porte sur
  // "Projet courant".
  assert.deepEqual(keys, ["projects", "gantt", "heatmap", "radar", "table", "dashboard"]);
  keys.forEach((k) => assert.equal(normalizeProjectDefaultView(k), k));
});
