/* Filtre avancé « Sans responsable » (#445) : la valeur comparée pour le
   critère Responsable. Extraite du bundle RÉELLEMENT construit
   (.build/index.html), jamais recopiée. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:ASSIGNEE-FILTER:START ===";
const END = "// === NEXORA:ASSIGNEE-FILTER:END ===";
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc ASSIGNEE-FILTER introuvable dans .build/index.html");
const { NO_ASSIGNEE_FILTER, assigneeFilterValue } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { NO_ASSIGNEE_FILTER, assigneeFilterValue };\n})`
)();

// Même règle que matchSelectFilter : liste vide = neutre, « isnot » = exclusion.
const matches = (values, mode, task) => {
  if (!values.length) return true;
  const inList = values.includes(assigneeFilterValue(task));
  return mode === "isnot" ? !inList : inList;
};

test("#445 : une tâche sans responsable porte la sentinelle", () => {
  assert.equal(assigneeFilterValue({}), NO_ASSIGNEE_FILTER);
  assert.equal(assigneeFilterValue({ assignee: "" }), NO_ASSIGNEE_FILTER);
  assert.equal(assigneeFilterValue({ assignee: "   " }), NO_ASSIGNEE_FILTER, "des blancs ne font pas un responsable");
  assert.equal(assigneeFilterValue({ assignee: null }), NO_ASSIGNEE_FILTER);
  assert.equal(assigneeFilterValue(null), NO_ASSIGNEE_FILTER);
  assert.equal(assigneeFilterValue({ assignee: " Maïa Sonnier " }), "Maïa Sonnier");
});

test("#445 : « Sans responsable » se sélectionne et s'exclut", () => {
  const sans = { assignee: "" }, maia = { assignee: "Maïa Sonnier" };
  assert.equal(matches([NO_ASSIGNEE_FILTER], "is", sans), true);
  assert.equal(matches([NO_ASSIGNEE_FILTER], "is", maia), false);
  // Exclure les tâches sans responsable.
  assert.equal(matches([NO_ASSIGNEE_FILTER], "isnot", sans), false);
  assert.equal(matches([NO_ASSIGNEE_FILTER], "isnot", maia), true);
  // Combinée à une personne.
  assert.equal(matches([NO_ASSIGNEE_FILTER, "Maïa Sonnier"], "is", maia), true);
  assert.equal(matches([NO_ASSIGNEE_FILTER, "Maïa Sonnier"], "is", { assignee: "Quentin" }), false);
});
