import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même règle que les autres suites : les fonctions testées sont extraites de
// l'interface RÉELLEMENT construite, entre les sentinelles du bloc « Équipes ».
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:TEAMS:START ===";
const END = "// === NEXORA:TEAMS:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc des équipes introuvable dans .build/index.html");

const {
  normalizeTeams, teamAncestorAndSelfIds, teamDescendantAndSelfIds,
  memberTeamIds, memberManagerName, memberDescendantAndSelfNames, buildOrgHierarchyTree,
} = vm.runInThisContext(
  `(function () {\n` +
  // STAFFING_COLOR_CHOICES est déclaré juste après ce bloc dans la source
  // réelle (couleur de repli d'une équipe sans couleur valide) — un unique
  // repli déterministe suffit ici, la palette elle-même est testée ailleurs.
  `const STAFFING_COLOR_CHOICES = ["#64748B"];\n` +
  `${html.slice(from + START.length, to)}\n` +
  `;return { normalizeTeams, teamAncestorAndSelfIds, teamDescendantAndSelfIds, memberTeamIds, memberManagerName, memberDescendantAndSelfNames, buildOrgHierarchyTree };\n})`
)();

const team = (id, extra) => ({ id, name: `Équipe ${id}`, ...extra });
const member = (name, extra) => ({ id: name, name, ...extra });

test("normalizeTeams : parentTeamId inexistant retombe sur premier niveau", () => {
  const [t] = normalizeTeams([team("a", { parentTeamId: "ghost" })]);
  assert.equal(t.parentTeamId, "");
});

test("normalizeTeams : une équipe ne peut pas être sa propre parente", () => {
  const [t] = normalizeTeams([team("a", { parentTeamId: "a" })]);
  assert.equal(t.parentTeamId, "");
});

test("normalizeTeams : casse un cycle A→B→A (les deux bords ne peuvent pas survivre)", () => {
  const [a, b] = normalizeTeams([
    team("a", { parentTeamId: "b" }),
    team("b", { parentTeamId: "a" }),
  ]);
  // Le cycle est cassé : au moins une équipe (celle qui reboucle en premier
  // dans la chaîne) perd son parentTeamId. Jamais les deux equipes ne
  // continuent de se pointer l'une l'autre.
  assert.ok(a.parentTeamId === "" || b.parentTeamId === "");
});

test("normalizeTeams : une chaîne valide (B sous A) est conservée", () => {
  const teams = normalizeTeams([team("a"), team("b", { parentTeamId: "a" })]);
  assert.equal(teams.find((t) => t.id === "b").parentTeamId, "a");
});

test("teamAncestorAndSelfIds / teamDescendantAndSelfIds", () => {
  const teams = [team("a"), team("b", { parentTeamId: "a" }), team("c", { parentTeamId: "b" })];
  assert.deepEqual([...teamAncestorAndSelfIds("c", teams)].sort(), ["a", "b", "c"]);
  assert.deepEqual([...teamDescendantAndSelfIds("a", teams)].sort(), ["a", "b", "c"]);
  assert.deepEqual([...teamDescendantAndSelfIds("c", teams)].sort(), ["c"]);
});

test("memberDescendantAndSelfNames suit la chaîne de responsables", () => {
  const members = [member("Alice"), member("Bob", { managerName: "Alice" }), member("Chloé", { managerName: "Bob" })];
  assert.deepEqual([...memberDescendantAndSelfNames("Alice", members)].sort(), ["Alice", "Bob", "Chloé"]);
  assert.deepEqual([...memberDescendantAndSelfNames("Chloé", members)].sort(), ["Chloé"]);
});

test("buildOrgHierarchyTree : une équipe, deux personnes — arbre à un seul niveau", () => {
  const teams = [team("a")];
  const members = [member("Alice", { teamIds: ["a"] }), member("Bob", { teamIds: ["a"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].type, "team");
  assert.equal(roots[0].team.id, "a");
  assert.deepEqual(roots[0].children.map((c) => c.member.name).sort(), ["Alice", "Bob"]);
});

test("buildOrgHierarchyTree : équipes imbriquées (parentTeamId)", () => {
  const teams = [team("a"), team("b", { parentTeamId: "a" })];
  const members = [member("Alice", { teamIds: ["a"] }), member("Bob", { teamIds: ["b"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].team.id, "a");
  const [aliceNode, teamBNode] = roots[0].children.sort((x, y) => (x.type === "team" ? 1 : -1) - (y.type === "team" ? 1 : -1));
  assert.equal(aliceNode.member.name, "Alice");
  assert.equal(teamBNode.type, "team");
  assert.equal(teamBNode.team.id, "b");
  assert.equal(teamBNode.children[0].member.name, "Bob");
});

test("buildOrgHierarchyTree : un responsable direct prime sur le rattachement d'équipe", () => {
  const teams = [team("a")];
  const members = [
    member("Alice", { teamIds: ["a"] }),
    member("Bob", { teamIds: ["a"], managerName: "Alice" }),
  ];
  const roots = buildOrgHierarchyTree(teams, members);
  // Bob n'est plus un enfant direct de l'équipe : il est sous Alice.
  assert.equal(roots[0].children.length, 1);
  const aliceNode = roots[0].children[0];
  assert.equal(aliceNode.member.name, "Alice");
  assert.equal(aliceNode.children.length, 1);
  assert.equal(aliceNode.children[0].member.name, "Bob");
});

test("buildOrgHierarchyTree : multi-équipe sans responsable n'apparaît qu'une fois (première équipe)", () => {
  const teams = [team("a"), team("b")];
  const members = [member("Alice", { teamIds: ["a", "b"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  const teamA = roots.find((r) => r.team.id === "a");
  const teamB = roots.find((r) => r.team.id === "b");
  assert.equal(teamA.children.length, 1);
  assert.equal(teamB.children.length, 0);
});

test("buildOrgHierarchyTree : personne sans équipe ni responsable → « Sans équipe »", () => {
  const roots = buildOrgHierarchyTree([], [member("Alice")]);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].team, null);
  assert.equal(roots[0].children[0].member.name, "Alice");
});

test("buildOrgHierarchyTree : un cycle de responsables (A→B→A) ne boucle jamais et ne perd personne", () => {
  const teams = [team("a")];
  const members = [
    member("Alice", { teamIds: ["a"], managerName: "Bob" }),
    member("Bob", { teamIds: ["a"], managerName: "Alice" }),
  ];
  const roots = buildOrgHierarchyTree(teams, members);
  // Les deux retombent sous leur équipe plutôt que de créer un cycle.
  const names = roots[0].children.filter((c) => c.type === "person").map((c) => c.member.name).sort();
  assert.deepEqual(names, ["Alice", "Bob"]);
});
