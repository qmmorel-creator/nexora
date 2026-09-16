import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:BOARD-SEARCH:START ===";
const END = "// === NEXORA:BOARD-SEARCH:END ===";
const EXPORTS = ["normalizeSearchText", "taskMatchesTextQuery", "filterTasksByText"];

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc du filtre textuel introuvable dans .build/index.html");

const { normalizeSearchText, taskMatchesTextQuery, filterTasksByText } =
  vm.runInThisContext(`(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`)();

const TASKS = [
  { id: "t1", title: "Réserve n° 8", desc: "Constat contradictoire à reprendre.", assignee: "Dupont" },
  { id: "t2", title: "Plan de charge — mars", desc: "", assignee: "Martin" },
  { id: "t3", title: "Réunion CODIR", desc: "Préparer le plan de communication.", assignee: "Dupont" },
  { id: "t4", title: "Sans description", assignee: "Dupont" },
];

test("la recherche ignore la casse et les accents, dans les deux sens", () => {
  assert.equal(normalizeSearchText("Réserve"), "reserve");
  assert.ok(taskMatchesTextQuery(TASKS[0], "reserve"), "sans accent doit trouver avec accent");
  assert.ok(taskMatchesTextQuery(TASKS[0], "RÉSERVE"), "avec accent et majuscules doit trouver aussi");
  assert.ok(taskMatchesTextQuery(TASKS[2], "reunion codir"));
});

test("tous les mots doivent être présents, dans n'importe quel ordre", () => {
  // Chercher la chaîne entière manquerait « Plan de charge — mars ».
  assert.ok(taskMatchesTextQuery(TASKS[1], "plan mars"));
  assert.ok(taskMatchesTextQuery(TASKS[1], "mars plan"));
  assert.ok(!taskMatchesTextQuery(TASKS[1], "plan avril"));
});

test("la description compte autant que le nom", () => {
  assert.ok(taskMatchesTextQuery(TASKS[0], "contradictoire"), "trouvé dans la description seule");
  assert.ok(taskMatchesTextQuery(TASKS[2], "communication"));
});

test("le reste de la tâche ne compte PAS", () => {
  // C'est ce qui distingue ce filtre de la recherche des autres vues : chercher
  // un responsable ne doit pas ramener toutes ses tâches.
  assert.ok(!taskMatchesTextQuery(TASKS[0], "Dupont"));
  assert.deepEqual(filterTasksByText(TASKS, "Dupont"), []);
});

test("une tâche sans description ne fait pas tomber la comparaison", () => {
  assert.ok(taskMatchesTextQuery(TASKS[3], "sans"));
  assert.ok(!taskMatchesTextQuery(TASKS[3], "inexistant"));
  assert.ok(!taskMatchesTextQuery(null, "quoi que ce soit"));
});

test("une requête vide ne filtre rien, et rend LE MÊME tableau", () => {
  // Un filtre qui masquerait tout tant qu'on n'a pas fini de taper serait
  // inutilisable ; et rendre le même tableau évite de recalculer les vues.
  assert.equal(filterTasksByText(TASKS, ""), TASKS);
  assert.equal(filterTasksByText(TASKS, "   "), TASKS);
  assert.equal(filterTasksByText(TASKS, null), TASKS);
});

test("le filtre garde l'ordre d'origine et ne duplique rien", () => {
  const out = filterTasksByText(TASKS, "e");
  assert.deepEqual(out.map((t) => t.id), TASKS.filter((t) => out.includes(t)).map((t) => t.id));
  assert.equal(new Set(out.map((t) => t.id)).size, out.length);
});

test("aucune correspondance rend une liste vide, pas la liste entière", () => {
  // La confusion coûterait cher : l'utilisateur croirait son filtre sans effet.
  assert.deepEqual(filterTasksByText(TASKS, "zzz"), []);
});

test("une entrée qui n'est pas une liste ne fait pas tomber le filtre", () => {
  assert.deepEqual(filterTasksByText(undefined, "plan"), []);
  assert.deepEqual(filterTasksByText(null, ""), []);
});
