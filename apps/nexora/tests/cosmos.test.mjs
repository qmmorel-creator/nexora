/* Vue Cosmos (#402) : univers de galaxies (dossiers), planètes (projets) et
   satellites (tâches). La tranche testée est extraite du bundle RÉELLEMENT
   construit, jamais recopiée ; elle s'appuie sur la normalisation de la Carte,
   extraite de la même façon. Le moteur three.js est éprouvé par le banc visuel
   (tools/visual-check). */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const C = vm.runInThisContext(
  `(function () {\n${slice("CARTE")}\n${slice("COSMOS")}\n;return {
    carteNormalize, cosmosBuild, cosmosAssign, cosmosSlotRing, cosmosCapacity, cosmosPathOf, cosmosFrame,
    cosmosSearch, cosmosLabelOrder, normalizeCosmosViewPrefs, cosmosResolveQuality, cosmosFolderRoots,
    COSMOS_ORPHAN_PROJECT, COSMOS_UNSORTED_GALAXY, COSMOS_RINGS,
  };\n})`
)();

const NOW = Date.parse("2026-09-24T10:00:00");
const statuses = [
  { id: "s1", name: "À planifier", color: "#64748B" },
  { id: "s2", name: "Attente tiers", color: "#8B5CF6" },
  { id: "s3", name: "En cours", color: "#0EA5E9" },
  { id: "s5", name: "Terminé", color: "#22B07D" },
  { id: "s6", name: "Information", color: "#64748B" },
];
const folders = [
  { id: "f-val", name: "Vallabrègues", color: "#2F7FD8" },
  { id: "f-avi", name: "Avignon Nord", color: "#8B5CF6" },
  { id: "f-sub", name: "Lot 2", parentId: "f-val" },
  { id: "f-subsub", name: "Lot 2b", parentId: "f-sub" },
  { id: "f-vide", name: "Dossier vide" },
  { id: "folder-a-trier", name: "À trier" },
];
const projects = [
  { id: "p-passe", name: "Passe amont", color: "#1F9D8F", folderId: "f-val" },
  { id: "p-mach", name: "Machine", color: "#2F5FB3", folderId: "f-val" },
  { id: "p-canal", name: "Canal", color: "#D99A2B", folderId: "f-sub" },
  { id: "p-deep", name: "Écluse", color: "#B05BB8", folderId: "f-subsub" },
  { id: "p-digue", name: "Digue", color: "#6D5BD0", folderId: "f-avi" },
  { id: "p-idees", name: "Idées", color: "#94A3B8", folderId: "folder-a-trier" },
  { id: "p-perdu", name: "Sans dossier connu", color: "#94A3B8", folderId: "f-disparu" },
  { id: "p-vide", name: "Projet vide", color: "#94A3B8", folderId: "f-avi" },
];
function tasksFor() {
  const out = [];
  ["p-passe", "p-mach", "p-canal", "p-deep", "p-digue", "p-idees"].forEach((pid, j) => {
    for (let i = 0; i < 6; i++) out.push({ id: `${pid}-t${i}`, title: `Tâche ${pid} ${i}`, projectId: pid, statusId: statuses[(i + j) % 5].id, end: "2026-09-" + String(10 + i * 3).padStart(2, "0") });
  });
  out.push({ id: "t-vannes", title: "Vérifier les vannes", projectId: "p-passe", statusId: "s3", end: "2026-09-20", criticality: "urgent" });
  out.push({ id: "t-orphan", title: "Note sans projet", projectId: null, statusId: "s1" });
  return out;
}
const ctx = { projects, projectFolders: folders, statuses, taskTypes: [], teamMembers: [] };
const build = (tasks, memory, c = ctx) => {
  const norm = C.carteNormalize(c, tasks, { now: NOW });
  return { norm, model: C.cosmosBuild(c, norm, { memory }) };
};

test("un dossier racine = une galaxie, même vide ; « À trier » regroupe les projets sans dossier", () => {
  const { model } = build(tasksFor());
  const names = model.galaxies.map((g) => g.name);
  assert.deepEqual(names, ["Avignon Nord", "Dossier vide", "Vallabrègues", "À trier"]);
  const vide = model.galaxies.find((g) => g.id === "f-vide");
  assert.equal(vide.projectIds.length, 0);
  assert.ok(vide.radius > 0);
  const unsorted = model.galaxyById[C.COSMOS_UNSORTED_GALAXY];
  assert.ok(unsorted.projectIds.includes("p-idees"));
  assert.ok(unsorted.projectIds.includes("p-perdu"), "un dossier introuvable ne fait pas disparaître le projet");
  assert.ok(unsorted.projectIds.includes(C.COSMOS_ORPHAN_PROJECT), "les tâches sans projet forment la planète « Sans projet »");
  assert.equal(model.satellites["t-orphan"].planetId, C.COSMOS_ORPHAN_PROJECT);
  assert.equal(model.planets["p-vide"].taskIds.length, 0);
});

test("un sous-dossier devient un amas de sa galaxie racine, sous-sous-dossiers compris", () => {
  const { model } = build(tasksFor());
  const g = model.galaxyById["f-val"];
  assert.deepEqual(g.direct.sort(), ["p-mach", "p-passe"]);
  assert.equal(g.amas.length, 1);
  assert.equal(g.amas[0].folderId, "f-sub");
  assert.deepEqual(g.amas[0].projectIds.sort(), ["p-canal", "p-deep"]);
  assert.equal(model.planets["p-deep"].amasId, "amas:f-sub");
  const a = g.amas[0];
  const d = Math.hypot(model.planets["p-canal"].local.x - a.center.x, model.planets["p-canal"].local.z - a.center.z);
  assert.ok(d < a.radius, "la planète orbite autour du centre de l'amas");
});

test("les positions sont déterministes et ne dépendent pas de l'ordre des données", () => {
  const a = build(tasksFor()).model;
  const b = build(tasksFor().reverse(), undefined, { ...ctx, projects: projects.slice().reverse(), projectFolders: folders.slice().reverse() }).model;
  for (const id of Object.keys(a.planets)) assert.deepEqual(a.planets[id].world, b.planets[id].world, id);
  for (const id of Object.keys(a.satellites)) assert.equal(a.satellites[id].angle, b.satellites[id].angle, id);
  for (const g of a.galaxies) assert.deepEqual(g.pos, b.galaxyById[g.id].pos);
});

test("avec la mémoire, ajouter un projet ou une tâche ne déplace rien d'existant", () => {
  const first = build(tasksFor()).model;
  const more = tasksFor();
  more.push({ id: "new-0", title: "Nouvelle", projectId: "p-passe", statusId: "s1" });
  const ctx2 = { ...ctx, projects: [...projects, { id: "p-new", name: "Nouveau", folderId: "f-val" }], projectFolders: [...folders, { id: "f-new", name: "Nouveau dossier" }] };
  const second = build(more, first.memory, ctx2).model;
  for (const id of Object.keys(first.planets)) assert.deepEqual(second.planets[id].local, first.planets[id].local, id);
  for (const id of Object.keys(first.satellites)) {
    assert.equal(second.satellites[id].angle, first.satellites[id].angle, id);
    assert.equal(second.satellites[id].ring, first.satellites[id].ring, id);
  }
  for (const g of first.galaxies) assert.equal(second.galaxyById[g.id].slot, g.slot);
  assert.ok(second.planets["p-new"]);
  assert.ok(second.galaxyById["f-new"]);
});

test("un projet qui franchit un palier de taille élargit les orbites sans changer places ni angles", () => {
  const first = build(tasksFor()).model;
  const more = tasksFor();
  for (let i = 0; i < 25; i++) more.push({ id: `new-${i}`, title: `Nouvelle ${i}`, projectId: "p-passe", statusId: "s1" });
  const second = build(more, first.memory).model;
  for (const id of Object.keys(first.planets)) {
    assert.equal(second.planets[id].slot, first.planets[id].slot, id);
    assert.equal(second.planets[id].angle, first.planets[id].angle, id);
  }
  for (const id of Object.keys(first.satellites)) assert.equal(second.satellites[id].slot, first.satellites[id].slot, id);
  assert.ok(second.planets["p-mach"].orbitRadius >= first.planets["p-mach"].orbitRadius);
});

test("les planètes d'un système ne se chevauchent pas, satellites compris", () => {
  const vf = [{ id: "vf", name: "Gros dossier" }];
  const vp = Array.from({ length: 25 }, (_, i) => ({ id: `vp${i}`, name: `Projet ${i}`, folderId: "vf" }));
  const vt = Array.from({ length: 1000 }, (_, i) => ({ id: `vt${i}`, title: `T${i}`, projectId: vp[i % 25].id, statusId: statuses[i % 5].id }));
  const c = { projects: vp, projectFolders: vf, statuses, taskTypes: [], teamMembers: [] };
  const { model } = build(vt, undefined, c);
  const ps = Object.values(model.planets);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const d = Math.hypot(ps[i].world.x - ps[j].world.x, ps[i].world.z - ps[j].world.z);
    assert.ok(d >= ps[i].reach + ps[j].reach - 0.01, `${ps[i].name} / ${ps[j].name} : ${d.toFixed(1)}`);
  }
});

test("attribution des places : unique, stable, et la mémoire est purgée des disparus", () => {
  const ids = Array.from({ length: 200 }, (_, i) => "x" + i);
  const slots = C.cosmosAssign(ids, {}, "t", C.COSMOS_RINGS.satellite);
  assert.equal(new Set(Object.values(slots)).size, 200);
  assert.deepEqual(C.cosmosAssign(ids, {}, "t", C.COSMOS_RINGS.satellite), slots);
  const again = C.cosmosAssign(ids.concat(["y"]), slots, "t", C.COSMOS_RINGS.satellite);
  ids.forEach((id) => assert.equal(again[id], slots[id]));
  const { model } = build(tasksFor(), { s: { disparu: 3 }, p: { fantome: 1 } });
  assert.equal(model.memory.s.disparu, undefined);
  assert.equal(model.memory.p.fantome, undefined);
});

test("anneaux : capacité croissante et place → anneau", () => {
  assert.deepEqual(C.cosmosSlotRing(0, [10, 6]), { ring: 0, index: 0, count: 10 });
  assert.deepEqual(C.cosmosSlotRing(10, [10, 6]), { ring: 1, index: 0, count: 16 });
  assert.equal(C.cosmosCapacity(11, [10, 6]), 26);
});

test("les galaxies ne se chevauchent pas", () => {
  const { model } = build(tasksFor());
  const gs = model.galaxies;
  for (let i = 0; i < gs.length; i++) for (let j = i + 1; j < gs.length; j++) {
    const d = Math.hypot(gs[i].pos.x - gs[j].pos.x, gs[i].pos.z - gs[j].pos.z);
    assert.ok(d > gs[i].radius + gs[j].radius, `${gs[i].name} / ${gs[j].name}`);
  }
});

test("compteurs : galaxie et planète reprennent les états de la Carte", () => {
  const { model } = build(tasksFor());
  const p = model.planets["p-passe"];
  assert.equal(p.stats.total, 7);
  assert.equal(p.taskIds.length, 7);
  const g = model.galaxyById["f-val"];
  assert.equal(g.stats.total, 7 + 6 + 6 + 6);
  assert.equal(g.stats.projects, 4);
});

test("chemins, cadrages et recherche", () => {
  const { norm, model } = build(tasksFor());
  assert.deepEqual(C.cosmosPathOf(model, "task", "t-vannes"), { galaxyId: "f-val", planetId: "p-passe", taskId: "t-vannes" });
  assert.equal(C.cosmosPathOf(model, "task", "inconnue"), null);
  const fu = C.cosmosFrame(model, "universe");
  const fg = C.cosmosFrame(model, "galaxy", "f-val");
  const fp = C.cosmosFrame(model, "planet", "p-passe");
  assert.ok(fu.dist > fg.dist && fg.dist > fp.dist);
  const res = C.cosmosSearch(model, norm, "vall");
  assert.equal(res[0].kind, "galaxy");
  assert.equal(C.cosmosSearch(model, norm, "vannes")[0].id, "t-vannes");
  assert.equal(C.cosmosSearch(model, norm, "lot 2")[0].id, "f-val", "un sous-dossier mène à sa galaxie");
  assert.equal(C.cosmosSearch(model, norm, "ecluse")[0].id, "p-deep", "recherche sans accents");
  assert.deepEqual(C.cosmosSearch(model, norm, "  "), []);
});

test("ordre des libellés : sélection, retard, urgence, puis échéance", () => {
  const { norm } = build(tasksFor());
  const list = norm.tasks.filter((t) => t.projectId === "p-passe");
  const ordered = C.cosmosLabelOrder(list, "p-passe-t5");
  assert.equal(ordered[0].id, "p-passe-t5");
  assert.ok(ordered.findIndex((t) => t.state === "done") > ordered.findIndex((t) => t.overdue));
});

test("préférences et qualité automatique", () => {
  const d = C.normalizeCosmosViewPrefs(null);
  assert.equal(d.animate, true);
  assert.equal(d.quality, "auto");
  assert.equal(d.crit, "all");
  // Comme la Carte (#400) : plus de puces d'état ; d'anciennes valeurs sont ignorées.
  const v = C.normalizeCosmosViewPrefs({ states: ["todo"], late: true, crit: "x", quality: "ultra", animate: false, filter: [] });
  assert.equal(v.states, undefined);
  assert.equal(v.late, undefined);
  assert.equal(v.crit, "all");
  assert.equal(v.quality, "auto");
  assert.equal(v.animate, false);
  assert.equal(v.filter, null);
  assert.equal(C.cosmosResolveQuality("auto", 12000, 300), "low");
  assert.equal(C.cosmosResolveQuality("auto", 900, 10), "medium");
  assert.equal(C.cosmosResolveQuality("high", 12000, 300), "high");
});

test("volume : 300 projets et 12 000 tâches en moins de 3 s, sans place partagée", () => {
  const vf = Array.from({ length: 12 }, (_, i) => ({ id: `vf${i}`, name: `Dossier ${i}` }));
  const vp = Array.from({ length: 300 }, (_, i) => ({ id: `vp${i}`, name: `Projet ${i}`, folderId: vf[i % 12].id }));
  const vt = Array.from({ length: 12000 }, (_, i) => ({ id: `vt${i}`, title: `T${i}`, projectId: vp[i % 300].id, statusId: statuses[i % 5].id }));
  const c = { projects: vp, projectFolders: vf, statuses, taskTypes: [], teamMembers: [] };
  const t0 = Date.now();
  const norm = C.carteNormalize(c, vt, { now: NOW });
  const model = C.cosmosBuild(c, norm, {});
  const again = C.cosmosBuild(c, norm, { memory: model.memory });
  assert.ok(Date.now() - t0 < 3000, "trop lent : " + (Date.now() - t0) + " ms");
  assert.equal(model.galaxies.length, 12);
  assert.equal(Object.keys(model.satellites).length, 12000);
  const perPlanet = {};
  Object.values(model.satellites).forEach((s) => { const k = s.planetId + ":" + s.slot; assert.ok(!perPlanet[k], "place partagée " + k); perPlanet[k] = 1; });
  Object.keys(model.planets).forEach((id) => assert.deepEqual(again.planets[id].world, model.planets[id].world));
});
