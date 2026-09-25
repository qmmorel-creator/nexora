/* Champ date d'édition de tâche (#448) : seule une date complète et plausible
   est transmise à la tâche. La fonction testée est extraite du bundle
   RÉELLEMENT construit (.build/index.html), jamais recopiée. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:DATE-INPUT:START ===";
const END = "// === NEXORA:DATE-INPUT:END ===";
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc DATE-INPUT introuvable dans .build/index.html");
const { isPlausibleDateInput } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { isPlausibleDateInput };\n})`
)();

test("#448 : une date complète et plausible est transmise", () => {
  assert.equal(isPlausibleDateInput("2026-09-25"), true);
  assert.equal(isPlausibleDateInput("1900-01-01"), true);
  assert.equal(isPlausibleDateInput("2200-12-31"), true);
});

test("#448 : les valeurs transitoires de la frappe sont retenues", () => {
  // Jour incomplet : le navigateur rend une valeur vide.
  assert.equal(isPlausibleDateInput(""), false);
  assert.equal(isPlausibleDateInput(null), false);
  assert.equal(isPlausibleDateInput(undefined), false);
  // Année tapée chiffre par chiffre : 2 → 20 → 202 → 2027.
  assert.equal(isPlausibleDateInput("0002-09-25"), false);
  assert.equal(isPlausibleDateInput("0020-09-25"), false);
  assert.equal(isPlausibleDateInput("0202-09-25"), false);
  assert.equal(isPlausibleDateInput("2027-09-25"), true);
  // Année à cinq chiffres (Chrome l'accepte) et formats étrangers.
  assert.equal(isPlausibleDateInput("20270-09-25"), false);
  assert.equal(isPlausibleDateInput("25/09/2026"), false);
});
