import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même règle que les autres suites : la fonction testée est extraite de
// l'interface RÉELLEMENT construite, entre les sentinelles du bloc.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:CURRENT-PROJECT-FILTER:START ===";
const END = "// === NEXORA:CURRENT-PROJECT-FILTER:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de la sentinelle « Projet courant » introuvable dans .build/index.html");

const { CURRENT_PROJECT_FILTER, CURRENT_PROJECT_FILTER_NONE, getProjectFilterIds, resolveProjectFilterIds } =
  vm.runInThisContext(
    `(function () {\n${html.slice(from + START.length, to)}\n` +
    `;return { CURRENT_PROJECT_FILTER, CURRENT_PROJECT_FILTER_NONE, getProjectFilterIds, resolveProjectFilterIds };\n})`
  )();

test("un filtre sans la sentinelle ressort inchangé", () => {
  assert.deepEqual(resolveProjectFilterIds(["p1", "p2"], { activeProjectIds: ["p3"] }), ["p1", "p2"]);
  assert.equal(resolveProjectFilterIds(undefined, { activeProjectIds: ["p3"] }), undefined);
  assert.equal(resolveProjectFilterIds([], { activeProjectIds: ["p3"] }).length, 0);
});

test("« Projet courant » se développe avec le(s) projet(s) actuellement ouvert(s)", () => {
  assert.deepEqual(resolveProjectFilterIds([CURRENT_PROJECT_FILTER], { activeProjectIds: ["p1"] }), ["p1"]);
  // Combiné à d'autres projets explicites : union, sans doublon.
  assert.deepEqual(
    resolveProjectFilterIds(["p2", CURRENT_PROJECT_FILTER], { activeProjectIds: ["p1", "p2"] }).sort(),
    ["p1", "p2"]
  );
});

test("« Projet courant » sans projet ouvert ne matche jamais rien — jamais tout le portefeuille", () => {
  assert.deepEqual(resolveProjectFilterIds([CURRENT_PROJECT_FILTER], { activeProjectIds: [] }), [CURRENT_PROJECT_FILTER_NONE]);
  assert.deepEqual(resolveProjectFilterIds([CURRENT_PROJECT_FILTER], {}), [CURRENT_PROJECT_FILTER_NONE]);
  assert.deepEqual(resolveProjectFilterIds([CURRENT_PROJECT_FILTER], undefined), [CURRENT_PROJECT_FILTER_NONE]);
  // Combinée à un projet explicite, elle s'efface simplement sans neutraliser le reste.
  assert.deepEqual(resolveProjectFilterIds(["p2", CURRENT_PROJECT_FILTER], { activeProjectIds: [] }), ["p2"]);
});

test("getProjectFilterIds lit la condition « project » du filtre avancé", () => {
  assert.deepEqual(getProjectFilterIds({ advanced: { items: [{ field: "project", mode: "is", values: ["p1"] }] } }), ["p1"]);
  assert.deepEqual(getProjectFilterIds({ advanced: { items: [{ field: "project", mode: "isnot", values: ["p1"] }] } }), []);
  assert.deepEqual(getProjectFilterIds({}), []);
  assert.deepEqual(getProjectFilterIds(undefined), []);
});
