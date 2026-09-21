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
  memberInitials, memberRoleInTeam, transverseTeamLinks, reorderOrgHierarchyRoots,
} = vm.runInThisContext(
  `(function () {\n` +
  // STAFFING_COLOR_CHOICES est déclaré juste après ce bloc dans la source
  // réelle (couleur de repli d'une équipe sans couleur valide) — un unique
  // repli déterministe suffit ici, la palette elle-même est testée ailleurs.
  `const STAFFING_COLOR_CHOICES = ["#64748B"];\n` +
  `${html.slice(from + START.length, to)}\n` +
  `;return { normalizeTeams, teamAncestorAndSelfIds, teamDescendantAndSelfIds, memberTeamIds, memberManagerName, memberDescendantAndSelfNames, buildOrgHierarchyTree, memberInitials, memberRoleInTeam, transverseTeamLinks, reorderOrgHierarchyRoots };\n})`
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

test("buildOrgHierarchyTree : multi-équipe sans responsable apparaît dans CHACUNE de ses équipes (#212)", () => {
  const teams = [team("a"), team("b")];
  const members = [member("Alice", { teamIds: ["a", "b"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  const teamA = roots.find((r) => r.team.id === "a");
  const teamB = roots.find((r) => r.team.id === "b");
  assert.equal(teamA.children.length, 1);
  assert.equal(teamA.children[0].member.name, "Alice");
  assert.equal(teamB.children.length, 1);
  assert.equal(teamB.children[0].member.name, "Alice");
  // La carte de la première équipe reste l'instance "canonique" (elle
  // porterait les subordonnés éventuels) ; celle de la seconde est une
  // carte dupliquée, sans enfants propres.
  assert.equal(teamA.children[0].children.length, 0);
  assert.equal(teamB.children[0].children.length, 0);
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

test("reorderOrgHierarchyRoots : une équipe transverse tout à droite se rapproche de son partenaire (#235)", () => {
  // a, b : deux équipes ordinaires ; c porte un lien transverse vers a (mais
  // apparaît en dernier dans le catalogue, donc tout à droite avant tri).
  const teams = [team("a"), team("b"), team("c", { parentTeamId: "a", parentLinkType: "transverse" })];
  const roots = buildOrgHierarchyTree(teams, []);
  assert.deepEqual(roots.map((r) => r.team.id), ["a", "b", "c"]);
  const reordered = reorderOrgHierarchyRoots(roots, teams);
  assert.deepEqual(reordered.map((r) => r.team.id), ["a", "c", "b"]);
});

test("reorderOrgHierarchyRoots : le partenaire peut être imbriqué (pas lui-même une racine)", () => {
  // b est imbriquée sous a (parentTeamId classique) ; d porte un lien
  // transverse vers b — sa racine de rattachement est donc a, pas b.
  const teams = [
    team("a"), team("b", { parentTeamId: "a" }), team("c"),
    team("d", { parentTeamId: "b", parentLinkType: "transverse" }),
  ];
  const roots = buildOrgHierarchyTree(teams, []);
  assert.deepEqual(roots.map((r) => r.team.id), ["a", "c", "d"]);
  const reordered = reorderOrgHierarchyRoots(roots, teams);
  assert.deepEqual(reordered.map((r) => r.team.id), ["a", "d", "c"]);
});

test("reorderOrgHierarchyRoots : aucun lien transverse → ordre inchangé", () => {
  const teams = [team("a"), team("b"), team("c")];
  const roots = buildOrgHierarchyTree(teams, []);
  const reordered = reorderOrgHierarchyRoots(roots, teams);
  assert.deepEqual(reordered.map((r) => r.team.id), ["a", "b", "c"]);
});

test("reorderOrgHierarchyRoots : ne modifie pas le tableau reçu (nouvelle liste)", () => {
  const teams = [team("a"), team("b", { parentTeamId: "a", parentLinkType: "transverse" })];
  const roots = buildOrgHierarchyTree(teams, []);
  const before = roots.slice();
  const reordered = reorderOrgHierarchyRoots(roots, teams);
  assert.deepEqual(roots, before);
  assert.notEqual(reordered, roots);
});

test("memberInitials", () => {
  assert.equal(memberInitials("Alice Dupont"), "AD");
  assert.equal(memberInitials("Marc"), "M");
  assert.equal(memberInitials(""), "");
  assert.equal(memberInitials(undefined), "");
});

test("memberRoleInTeam ne renvoie un poste que pour l'équipe demandée", () => {
  const m = member("Yann", { teamRoles: { a: "Ingénieur", b: "Technicien" } });
  assert.equal(memberRoleInTeam(m, "a"), "Ingénieur");
  assert.equal(memberRoleInTeam(m, "b"), "Technicien");
  assert.equal(memberRoleInTeam(m, "c"), "");
  assert.equal(memberRoleInTeam(m, null), "");
  assert.equal(memberRoleInTeam(null, "a"), "");
  assert.equal(memberRoleInTeam(member("Sans poste"), "a"), "");
});

test("buildOrgHierarchyTree : le nœud d'équipe porte son responsable résolu (leadMember)", () => {
  const teams = [team("a", { leadName: "Claire Dupont" })];
  const members = [member("Claire Dupont", { teamIds: ["a"] }), member("Marc", { teamIds: ["a"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  assert.equal(roots[0].type, "team");
  assert.equal(roots[0].leadMember?.name, "Claire Dupont");
});

test("buildOrgHierarchyTree : leadMember est null quand le nom du responsable ne résout plus", () => {
  const teams = [team("a", { leadName: "Personne Partie" })];
  const members = [member("Marc", { teamIds: ["a"] })];
  const roots = buildOrgHierarchyTree(teams, members);
  assert.equal(roots[0].leadMember, null);
});

test("buildOrgHierarchyTree : roleTeamId suit la première équipe résolue, même sous un responsable", () => {
  const teams = [team("a"), team("b")];
  const members = [
    member("Alice", { teamIds: ["a"] }),
    // Yann coche l'équipe b mais reporte à Alice : il doit tout de même
    // porter le poste qu'il a dans l'équipe b (roleTeamId = "b"), le
    // rattachement hiérarchique (sous Alice) ne changeant pas où lire son poste.
    member("Yann", { teamIds: ["b"], managerName: "Alice", teamRoles: { b: "Contributeur" } }),
  ];
  const roots = buildOrgHierarchyTree(teams, members);
  const teamA = roots.find((r) => r.team.id === "a");
  const yannNode = teamA.children[0].children[0];
  assert.equal(yannNode.member.name, "Yann");
  assert.equal(yannNode.roleTeamId, "b");
  assert.equal(memberRoleInTeam(yannNode.member, yannNode.roleTeamId), "Contributeur");
});
