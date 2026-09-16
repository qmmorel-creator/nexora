import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même technique que gantt-annotations.test.mjs : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite (.build/index.html, reconstruit par
// `npm run build` juste avant `npm test`), entre les deux sentinelles du bloc
// Criticité. Aucune copie du code n'est maintenue à côté.
const START = "// === NEXORA:CRITICALITY:START ===";
const END = "// === NEXORA:CRITICALITY:END ===";
const EXPORTS = ["CRITICALITIES", "criticalityOf", "planUrgentMigration"];

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc Criticité introuvable dans .build/index.html");

const factory = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
);
const { CRITICALITIES, criticalityOf, planUrgentMigration } = factory();

// Reproduit la règle de portée de l'application : un statut propre à un projet
// n'est proposable que dans ce projet, un statut global l'est partout.
const statusesForProject = (statuses, projects, projectId) =>
  (statuses || []).filter((s) => (s.projectId ? s.projectId === projectId : true));

const URGENT = { id: "st-urgent", name: "Urgent" };
const ENCOURS = { id: "st-encours", name: "En cours" };
const TERMINE = { id: "st-termine", name: "Terminé" };
const plan = (tasks, statuses, projects = []) =>
  planUrgentMigration({ tasks, statuses, projects, statusesForProject });

test("les trois valeurs existent, dans l'ordre Bas → Moyen → Urgent", () => {
  assert.deepEqual(CRITICALITIES.map((c) => c.id), ["bas", "moyen", "urgent"]);
  assert.deepEqual(CRITICALITIES.map((c) => c.name), ["Bas", "Moyen", "Urgent"]);
  for (const c of CRITICALITIES) assert.match(c.color, /^#[0-9A-Fa-f]{6}$/, c.id + " sans couleur");
});

test("criticalityOf résout une valeur posée et ignore le reste", () => {
  assert.equal(criticalityOf({ criticality: "urgent" }).name, "Urgent");
  assert.equal(criticalityOf({ criticality: "inconnu" }), null);
  assert.equal(criticalityOf({}), null);
  assert.equal(criticalityOf(null), null);
});

test("une tâche au statut Urgent passe en criticité urgente et au statut En cours", () => {
  const result = plan([{ id: "t1", statusId: "st-urgent", projectId: "p1" }], [URGENT, ENCOURS]);
  assert.deepEqual(result.reassign, [{ taskId: "t1", statusId: "st-encours" }]);
  assert.deepEqual(result.removeStatusIds, ["st-urgent"]);
  assert.deepEqual(result.keptStatusIds, []);
});

test("les tâches qui n'étaient pas urgentes ne bougent pas", () => {
  const result = plan(
    [{ id: "t1", statusId: "st-termine", projectId: "p1" }, { id: "t2", statusId: "st-encours", projectId: "p1" }],
    [URGENT, ENCOURS, TERMINE],
  );
  assert.deepEqual(result.reassign, []);
  // Le statut Urgent n'est plus référencé : il part quand même, c'est la demande.
  assert.deepEqual(result.removeStatusIds, ["st-urgent"]);
});

test("le statut Urgent est retiré même si aucune tâche ne l'utilise", () => {
  const result = plan([], [URGENT, ENCOURS]);
  assert.deepEqual(result.removeStatusIds, ["st-urgent"]);
});

test("rien à faire quand aucun statut Urgent n'existe : la reprise est idempotente", () => {
  const result = plan([{ id: "t1", statusId: "st-encours", projectId: "p1", criticality: "urgent" }], [ENCOURS, TERMINE]);
  assert.deepEqual(result, { reassign: [], removeStatusIds: [], keptStatusIds: [] });
});

test("plusieurs statuts Urgent propres à des projets : chacun est traité dans sa portée", () => {
  const statuses = [
    { id: "u-global", name: "Urgent" },
    { id: "u-p2", name: "Urgent", projectId: "p2" },
    { id: "ec-p1", name: "En cours", projectId: "p1" },
    { id: "ec-p2", name: "En cours", projectId: "p2" },
  ];
  const result = plan(
    [{ id: "t1", statusId: "u-global", projectId: "p1" }, { id: "t2", statusId: "u-p2", projectId: "p2" }],
    statuses,
    [{ id: "p1" }, { id: "p2" }],
  );
  const byTask = Object.fromEntries(result.reassign.map((r) => [r.taskId, r.statusId]));
  assert.equal(byTask.t1, "ec-p1", "la tâche du projet 1 doit prendre le En cours du projet 1");
  assert.equal(byTask.t2, "ec-p2", "la tâche du projet 2 doit prendre le En cours du projet 2");
  assert.deepEqual(result.removeStatusIds.sort(), ["u-global", "u-p2"]);
});

test("aucun En cours dans la portée : la tâche est laissée intacte et le statut survit", () => {
  const statuses = [{ id: "u-global", name: "Urgent" }, { id: "ec-p1", name: "En cours", projectId: "p1" }];
  const result = plan([{ id: "t1", statusId: "u-global", projectId: "p2" }], statuses, [{ id: "p1" }, { id: "p2" }]);
  assert.deepEqual(result.reassign, [], "aucune tâche ne doit être déplacée au hasard");
  assert.deepEqual(result.keptStatusIds, ["u-global"]);
  assert.deepEqual(result.removeStatusIds, [], "un statut encore référencé ne doit jamais être retiré");
});

test("un statut Urgent partiellement remplaçable est conservé pour tout le monde", () => {
  // t1 peut être repris, t2 non : supprimer le statut casserait t2.
  const statuses = [{ id: "u-global", name: "Urgent" }, { id: "ec-p1", name: "En cours", projectId: "p1" }];
  const result = plan(
    [{ id: "t1", statusId: "u-global", projectId: "p1" }, { id: "t2", statusId: "u-global", projectId: "p2" }],
    statuses,
    [{ id: "p1" }, { id: "p2" }],
  );
  assert.deepEqual(result.reassign, [{ taskId: "t1", statusId: "ec-p1" }]);
  assert.deepEqual(result.removeStatusIds, []);
  assert.deepEqual(result.keptStatusIds, ["u-global"]);
});

test("« URGENT », « urgent » et « en Cours » sont reconnus quelle que soit la casse", () => {
  const result = plan(
    [{ id: "t1", statusId: "u", projectId: "p1" }],
    [{ id: "u", name: "URGENT" }, { id: "ec", name: "en Cours" }],
  );
  assert.deepEqual(result.reassign, [{ taskId: "t1", statusId: "ec" }]);
});

test("un statut Urgent n'est jamais choisi comme remplaçant de lui-même", () => {
  // Pas de « En cours » du tout : le seul candidat serait l'Urgent lui-même.
  const result = plan([{ id: "t1", statusId: "u", projectId: "p1" }], [{ id: "u", name: "Urgent" }]);
  assert.deepEqual(result.reassign, []);
  assert.deepEqual(result.keptStatusIds, ["u"]);
});

test("des tâches ou des statuts malformés ne font pas échouer la reprise", () => {
  const result = plan([null, { id: "t1" }, { id: "t2", statusId: "u", projectId: "p1" }], [{ id: "u" }, ENCOURS, null]);
  // { id: "u" } n'a pas de nom : ce n'est pas un statut Urgent, rien ne bouge.
  assert.deepEqual(result, { reassign: [], removeStatusIds: [], keptStatusIds: [] });
});
