/* Garde-fou structurel du monofichier : compile-ui.mjs n'exige qu'UN SEUL
   bloc <script type="text/babel"> dans tout le HTML concaténé (build.mjs) et
   le transforme tel quel — tout code placé APRÈS sa balise </script> de
   fermeture (par exemple dans un fragment ajouté après celui qui referme le
   script, comme l'ancien part-004 avant sa fusion dans part-003) devient du
   texte HTML inerte : jamais exécuté, jamais une erreur de build, seulement
   un `ReferenceError` en production au premier rendu qui le référence.
   Régression réelle observée le 2026-09-22 (module Finance PRO) : ce test
   la reproduit et la garde fermée. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function babelScriptBounds(source) {
  const openTag = /<script\b[^>]*\btype="text\/babel"[^>]*>/.exec(source);
  assert.ok(openTag, "bloc <script type=\"text/babel\"> introuvable");
  const open = openTag.index + openTag[0].length;
  const close = source.indexOf("</script>", open);
  assert.ok(close > open, "</script> de fermeture introuvable après l'ouverture");
  return { open, close };
}

test("un seul bloc <script type=\"text/babel\"> dans le HTML concaténé (contrat de compile-ui.mjs)", () => {
  const matches = [...html.matchAll(/<script\b[^>]*\btype="text\/babel"[^>]*>/g)];
  assert.equal(matches.length, 1);
});

test("les identifiants Finance PRO sont déclarés À L'INTÉRIEUR du script réellement compilé", () => {
  const { open, close } = babelScriptBounds(html);
  const mustBeInsideScript = [
    "seedProExpenseCategories",
    "seedFinanceProSettings",
    "function FinanceProView",
    "function WidgetFinanceProSynthese",
    "function WidgetFinanceProEcheances",
  ];
  for (const needle of mustBeInsideScript) {
    const at = html.indexOf(needle);
    assert.ok(at !== -1, `${needle} introuvable dans le HTML concaténé`);
    assert.ok(at > open && at < close, `${needle} est HORS du bloc <script> (à l'offset ${at}, script = [${open}, ${close}])`);
  }
});
