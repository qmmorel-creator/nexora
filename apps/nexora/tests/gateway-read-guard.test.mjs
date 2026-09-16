/* Garde-fou de lecture de la passerelle (issue #40).

   L'adaptateur Firestore direct refusait déjà d'écrire une clé dont la dernière
   lecture avait échoué. La passerelle — la seule qui tourne sur le site déployé
   — ne le faisait pas, et ne gardait même pas trace d'une lecture ratée.

   Comme partout ici, le code testé est extrait du bundle construit plutôt que
   recopié : un test qui passe sur une copie pendant que l'application diverge ne
   prouve rien. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const START = "// === NEXORA:GATEWAY-READ-GUARD:START ===";
const END = "// === NEXORA:GATEWAY-READ-GUARD:END ===";

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", ".build", "index.html"),
  "utf8",
);
const from = html.indexOf(START);
const to = html.indexOf(END, from);
assert.ok(from !== -1 && to > from, "bloc du garde-fou introuvable dans .build/index.html");
const bloc = html.slice(from + START.length, to);

/* Le bloc est une paire de méthodes d'objet littéral : on le referme pour
   l'évaluer, en lui injectant les registres et le transport que l'application
   lui fournit normalement. */
const makeAdapter = (request) => {
  const readErrors = new Map();
  const knownRevisions = new Map();
  const knownValues = new Map();
  const factory = runInThisContext(
    `(function (nexoraServerStorageRequest, __nexoraReadErrors, __nexoraKnownRevisions, __nexoraKnownValues) {
       return ({${bloc}});
     })`,
  );
  const adapter = factory(request, readErrors, knownRevisions, knownValues);
  return { adapter, readErrors, knownRevisions, knownValues };
};

test("une lecture ratée est retenue, et bloque l'écriture suivante", async () => {
  const calls = [];
  const { adapter, readErrors } = makeAdapter(async (action) => {
    calls.push(action);
    if (action === "get") throw new Error("Passerelle Nexora indisponible (503).");
    return { revision: "r2", value: "{}" };
  });

  await assert.rejects(() => adapter.get("nexora:viewPrefs"));
  assert.equal(readErrors.has("nexora:viewPrefs"), true, "la lecture ratée doit laisser une trace");

  // C'est le cœur de l'issue #40 : sans ce refus, l'écriture partait sans
  // expectedRevision, le serveur répondait 409, et une préférence scalaire —
  // non fusionnable — finissait en « donnée en attente de synchronisation »
  // alors qu'aucune autre session n'était en cause.
  await assert.rejects(
    () => adapter.set("nexora:viewPrefs", "{}"),
    (e) => e.code === "NEXORA_READ_UNSAFE",
  );
  assert.equal(calls.filter((c) => c === "set").length, 0, "aucune écriture ne doit partir");
});

test("« Key not found » n'est pas une lecture ratée", async () => {
  const { adapter, readErrors } = makeAdapter(async (action) => {
    if (action === "get") throw new Error("Key not found: nexora:views");
    return { revision: "r1", value: "[]" };
  });

  await assert.rejects(() => adapter.get("nexora:views"));
  assert.equal(readErrors.has("nexora:views"), false, "une clé absente est écrivable sans risque");
  await adapter.set("nexora:views", "[]"); // ne doit pas lever
});

test("une lecture réussie efface la trace et débloque l'écriture", async () => {
  let failNext = true;
  const { adapter, readErrors, knownRevisions } = makeAdapter(async (action) => {
    if (action === "get") {
      if (failNext) { failNext = false; throw new Error("Timeout de lecture Firebase"); }
      return { revision: "r7", value: "{}" };
    }
    return { revision: "r8", value: "{}" };
  });

  await assert.rejects(() => adapter.get("nexora:shortcutPrefs"));
  await adapter.get("nexora:shortcutPrefs");
  assert.equal(readErrors.has("nexora:shortcutPrefs"), false);

  await adapter.set("nexora:shortcutPrefs", "{}");
  assert.equal(knownRevisions.get("nexora:shortcutPrefs"), "r8");
});

test("l'écriture transmet la révision connue, et s'en passe quand il n'y en a pas", async () => {
  const payloads = [];
  const { adapter, knownRevisions } = makeAdapter(async (action, payload) => {
    if (action === "set") payloads.push(payload);
    return { revision: "r3", value: "{}" };
  });

  await adapter.set("nexora:startupPref", "{}");
  assert.equal("expectedRevision" in payloads[0], false, "clé jamais lue : le serveur tranche");

  knownRevisions.set("nexora:startupPref", "r3");
  await adapter.set("nexora:startupPref", "{}");
  assert.equal(payloads[1].expectedRevision, "r3");
});
