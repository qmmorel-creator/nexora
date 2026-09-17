/* Pastille « Synchro MCP » contre bandeau de conflit.

   Le bandeau orange « Une autre session a enregistré des changements » se
   déclenchait avec un seul onglet ouvert : une écriture de la passerelle
   assistant/MCP était indiscernable d'une deuxième session humaine. Les clés
   concernées sont pourtant fusionnables (NEXORA_MERGEABLE_KEYS) et ne perdent
   jamais rien. Ce test vérifie le marquage d'origine et le partage du rendu.

   Comme les autres tests de synchronisation, la logique est extraite du bundle
   réellement construit (.build/index.html) entre ses sentinelles — aucune copie
   du code n'est maintenue à côté. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

const block = (start, end) => {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from !== -1 && to > from, `bloc introuvable dans .build/index.html : ${start}`);
  return html.slice(from + start.length, to);
};

const factory = (start, end, exports) =>
  vm.runInThisContext(
    `(function () {\n${block(start, end)}\n;return { ${exports.join(", ")} };\n})`,
  )();

const { NEXORA_SOURCE_ASSISTANT, NEXORA_SOURCE_BROWSER, storageSourceTag } = factory(
  "// === NEXORA:SYNC-SOURCE:START ===",
  "// === NEXORA:SYNC-SOURCE:END ===",
  ["NEXORA_SOURCE_ASSISTANT", "NEXORA_SOURCE_BROWSER", "storageSourceTag"],
);

const { isAssistantMergeableChange, splitRemoteChanges, remoteChangeLabel } = factory(
  "// === NEXORA:MCP-SYNC-SPLIT:START ===",
  "// === NEXORA:MCP-SYNC-SPLIT:END ===",
  ["isAssistantMergeableChange", "splitRemoteChanges", "remoteChangeLabel"],
);

// ---------------------------------------------------------------------------
// L'origine d'une écriture
// ---------------------------------------------------------------------------

test("les deux origines portent les valeurs attendues par le serveur", () => {
  // Elles doivent rester identiques à NEXORA_WRITE_SOURCE (_shared/nexora.ts)
  // et à WRITE_SOURCE (nexora-storage.mts) : ce sont les mêmes chaînes qui
  // traversent Firestore.
  assert.equal(NEXORA_SOURCE_ASSISTANT, "assistant-api");
  assert.equal(NEXORA_SOURCE_BROWSER, "browser");
});

test("un manifeste sans origine reste une origine inconnue, jamais devinée", () => {
  assert.equal(storageSourceTag(undefined), null);
  assert.equal(storageSourceTag({}), null);
  assert.equal(storageSourceTag({ source: "" }), null);
  assert.equal(storageSourceTag({ source: 42 }), null);
  assert.equal(storageSourceTag({ source: "assistant-api" }), "assistant-api");
});

// ---------------------------------------------------------------------------
// Le partage : pastille discrète ou bandeau plein écran
// ---------------------------------------------------------------------------

const MERGEABLE = new Set(["nexora:tasks", "nexora:projects"]);

test("une écriture MCP sur une clé fusionnable ne passe pas par le bandeau", () => {
  const { assistant, conflicts } = splitRemoteChanges(
    { "nexora:tasks": { revision: "r1", source: "assistant-api" } },
    MERGEABLE,
  );
  assert.deepEqual(assistant, ["nexora:tasks"]);
  assert.deepEqual(conflicts, []);
});

test("une autre session humaine garde le bandeau, même sur une clé fusionnable", () => {
  const { assistant, conflicts } = splitRemoteChanges(
    { "nexora:tasks": { revision: "r1", source: "browser" } },
    MERGEABLE,
  );
  assert.deepEqual(assistant, []);
  assert.deepEqual(conflicts, ["nexora:tasks"]);
});

test("une clé non fusionnable garde le bandeau quelle que soit l'origine", () => {
  // Rien ne garantit ici l'absence de perte : la vigilance reste entière.
  const { assistant, conflicts } = splitRemoteChanges(
    { "nexora:viewPrefs": { revision: "r1", source: "assistant-api" } },
    MERGEABLE,
  );
  assert.deepEqual(assistant, []);
  assert.deepEqual(conflicts, ["nexora:viewPrefs"]);
});

test("une origine inconnue (manifeste ancien) garde le comportement d'avant", () => {
  const { assistant, conflicts } = splitRemoteChanges(
    { "nexora:tasks": { revision: "r1", source: null } },
    MERGEABLE,
  );
  assert.deepEqual(assistant, []);
  assert.deepEqual(conflicts, ["nexora:tasks"]);
  assert.equal(isAssistantMergeableChange("nexora:tasks", undefined, MERGEABLE), false);
});

test("les deux populations cohabitent sans se recouvrir", () => {
  const { assistant, conflicts } = splitRemoteChanges(
    {
      "nexora:tasks": { revision: "r1", source: "assistant-api" },
      "nexora:projects": { revision: "r2", source: "browser" },
    },
    MERGEABLE,
  );
  assert.deepEqual(assistant, ["nexora:tasks"]);
  assert.deepEqual(conflicts, ["nexora:projects"]);
});

test("aucune écriture distante : aucune des deux alertes", () => {
  assert.deepEqual(splitRemoteChanges({}, MERGEABLE), { assistant: [], conflicts: [] });
  assert.deepEqual(splitRemoteChanges(undefined, MERGEABLE), { assistant: [], conflicts: [] });
});

// ---------------------------------------------------------------------------
// Le câblage réel : marquage à l'écriture, propagation à la lecture, rendu
// ---------------------------------------------------------------------------

test("les deux écritures manifestes du client portent l'origine navigateur", () => {
  // Inline ET segmenté : un manifeste non marqué serait relu comme « origine
  // inconnue » et rallumerait le bandeau.
  const marked = html.match(/source:NEXORA_SOURCE_BROWSER/g) || [];
  assert.equal(marked.length, 2, `manifestes marqués : ${marked.length}, 2 attendus`);
});

test("watch() et checkRevision() transmettent l'origine au React", () => {
  assert.match(html, /onChange\(remoteRevision, storageSourceTag\(snap\.data\(\)\)\)/);
  assert.match(html, /return \{ revision:storageRevisionToken\(data\), source:storageSourceTag\(data\) \}/);
  assert.match(html, /return \{ revision:result\.revision, source:storageSourceTag\(result\) \}/);
  assert.match(html, /window\.storage\.watch\(key, async \(revision, source\) =>/);
});

test("le bandeau plein écran ne lit plus que les vrais conflits", () => {
  assert.match(html, /remoteConflictKeys\.length > 0 &&/);
  assert.match(html, /className="lp-mcp-sync-pill"/);
  assert.match(html, /Synchro MCP…/);
  // La pastille ne doit pas emprunter la classe du bandeau : celle-ci réserve
  // une hauteur en haut de page (voir le useLayoutEffect de réservation).
  assert.doesNotMatch(html, /className="lp-mcp-sync-pill lp-sync-blocked-banner"/);
});

test("les fonctions Netlify marquent leurs propres écritures", async () => {
  const shared = await readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8");
  assert.match(shared, /export const NEXORA_WRITE_SOURCE = "assistant-api";/);
  const tagged = shared.match(/source: NEXORA_WRITE_SOURCE/g) || [];
  assert.equal(tagged.length, 2, `manifestes assistant marqués : ${tagged.length}, 2 attendus (inline et segmenté)`);

  const relay = await readFile(new URL("../netlify/functions/nexora-storage.mts", import.meta.url), "utf8");
  assert.match(relay, /const WRITE_SOURCE = "browser";/);
  assert.match(relay, /source: stringField\(WRITE_SOURCE\)/);
  assert.match(relay, /source: result\.source/);
});

// --- Le bandeau nomme l'origine (#111) --------------------------------------
//
// Il ne disait que « tasks », et un bandeau qui reparaît sans qu'on sache d'où
// vient l'écriture n'est pas diagnosticable : « autre session » désigne un vrai
// second onglet, « origine inconnue » un manifeste antérieur au marquage —
// deux causes opposées derrière le même message.

test("le bandeau de conflit nomme la clé ET l'origine de l'écriture", () => {
  assert.equal(remoteChangeLabel("nexora:tasks", { source: "browser" }), "tasks (autre session)");
  assert.equal(remoteChangeLabel("nexora:tasks", { source: "assistant-api" }), "tasks (assistant)");
  // Manifeste écrit avant le marquage : c'est une cause à part entière, et elle
  // se lit maintenant au lieu de se deviner.
  assert.equal(remoteChangeLabel("nexora:tasks", { source: null }), "tasks (origine inconnue)");
  assert.equal(remoteChangeLabel("nexora:tasks", {}), "tasks (origine inconnue)");
  assert.equal(remoteChangeLabel("nexora:tasks", undefined), "tasks (origine inconnue)");
  // Une origine inconnue du client est rendue telle quelle plutôt qu'effacée.
  assert.equal(remoteChangeLabel("nexora:views", { source: "import" }), "views (import)");
});
