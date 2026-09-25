/* Vue Timeline 3D (#454) : réseau du temps, projets en lignes et tâches en
   stations posées à leur échéance. La tranche testée est extraite du bundle
   RÉELLEMENT construit, jamais recopiée ; elle s'appuie sur la normalisation
   de la Carte et l'ordre des dossiers du Cosmos, extraits de la même façon.
   Le moteur three.js n'est pas testé ici. */

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

const T = vm.runInThisContext(
  `(function () {\n${slice("CARTE")}\n${slice("COSMOS")}\n${slice("TIMELINE3D")}\n;return {
    carteNormalize, timeline3dBuild, normalizeTimeline3dViewPrefs, timeline3dNextDepartures,
    timeline3dNeighbours, timeline3dNextStop, timeline3dRel, timeline3dResolveQuality,
    T3D_ORPHAN_LINE, T3D_SPEEDS, timeline3dTarget,
  };\n})`
)();

const NOW = Date.parse("2026-09-24T10:00:00");
const iso = (d) => { const x = new Date(NOW); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); const p = (n) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const statuses = [
  { id: "s1", name: "À planifier" },
  { id: "s2", name: "Attente tiers" },
  { id: "s3", name: "En cours" },
  { id: "s5", name: "Terminé" },
];
const taskTypes = [{ id: "tt1", name: "Tâches" }, { id: "tt3", name: "Réunions" }];
const folders = [
  { id: "f-b", name: "Bureau", order: 2 },
  { id: "f-a", name: "Chantiers", order: 1 },
  { id: "f-a2", name: "Lot 2", parentId: "f-a" },
];
const projects = [
  { id: "p-bureau", name: "Devis", color: "#F07C2B", folderId: "f-b" },
  { id: "p-lot", name: "Lot 2B", color: "#F2A900", folderId: "f-a2" },
  { id: "p-ecole", name: "École", color: "#1F6FD1", folderId: "f-a" },
  { id: "p-vide", name: "Sans tâche", color: "#999999", folderId: "f-a" },
];
const tasks = [
  { id: "t1", projectId: "p-lot", title: "Terrassement", statusId: "s5", taskTypeId: "tt1", start: iso(-20), end: iso(-10) },
  { id: "t2", projectId: "p-lot", title: "Coulage dalle", statusId: "s3", taskTypeId: "tt1", start: iso(-4), end: iso(3) },
  { id: "t3", projectId: "p-lot", title: "Élévation murs", statusId: "s1", taskTypeId: "tt1", start: iso(2), end: iso(20) },
  { id: "t4", projectId: "p-lot", title: "Réunion de chantier", statusId: "s1", taskTypeId: "tt3", start: iso(7), end: iso(7) },
  { id: "t5", projectId: "p-lot", title: "Hors d'eau", statusId: "s1", milestone: true, start: iso(40), end: iso(40) },
  { id: "t6", projectId: "p-bureau", title: "Facture n° 4", statusId: "s1", taskTypeId: "tt1", start: iso(1), end: iso(2), dependsOn: ["t2"] },
  { id: "t7", projectId: "p-bureau", title: "Relance", statusId: "s3", taskTypeId: "tt1", start: iso(-8), end: iso(-3) },
  { id: "t8", projectId: "p-ecole", title: "Permis", statusId: "s2", taskTypeId: "tt1", start: iso(5), end: iso(18) },
  { id: "t9", projectId: "p-ecole", title: "Sans date", statusId: "s1", taskTypeId: "tt1" },
  { id: "t10", projectId: "p-ecole", title: "Très loin", statusId: "s1", taskTypeId: "tt1", start: iso(500), end: iso(500) },
  { id: "t11", projectId: null, title: "Note libre", statusId: "s1", taskTypeId: "tt1", start: iso(4), end: iso(4) },
  { id: "t12", projectId: "p-lot", title: "Chevauchement", statusId: "s1", taskTypeId: "tt1", start: iso(10), end: iso(30), dependsOn: ["t3"] },
];
const ctx = { projects, projectFolders: folders, statuses, taskTypes, tasks };
const norm = T.carteNormalize(ctx, tasks, { now: NOW });
const M = T.timeline3dBuild(ctx, norm);

test("une ligne par projet ayant des tâches datées, dans l'ordre des dossiers racines", () => {
  assert.deepEqual(M.lines.map((l) => l.id), ["p-lot", "p-ecole", "p-bureau", T.T3D_ORPHAN_LINE]);
  assert.deepEqual(M.lines.map((l) => l.n), [1, 2, 3, 4]);
  // Un sous-dossier se range sous son dossier racine.
  assert.equal(M.lineById["p-lot"].folderId, "f-a");
  assert.equal(M.lineById["p-lot"].folderName, "Chantiers");
  assert.deepEqual(M.groups.map((g) => g.id), ["f-a", "f-b", "__t3d-sans-dossier__"]);
  assert.equal(M.lineById[T.T3D_ORPHAN_LINE].name, "Sans projet");
  assert.ok(!M.lineById["p-vide"], "un projet sans tâche datée n'a pas de ligne");
});

test("les stations sont posées à leur échéance, en jours relatifs à aujourd'hui", () => {
  const s = M.stationById;
  assert.equal(s.t2.e, 3);
  assert.equal(s.t2.s, -4);
  assert.equal(s.t1.st, "done");
  assert.equal(s.t2.st, "doing");
  assert.equal(s.t8.st, "wait");
  assert.equal(s.t4.type, "r");
  assert.equal(s.t5.type, "m");
  assert.equal(s.t7.late, true, "échéance passée, non terminée : en retard");
  assert.equal(s.t1.late, false, "une tâche terminée n'est jamais en retard");
  assert.deepEqual(M.lineById["p-lot"].stations, ["t1", "t2", "t4", "t3", "t12", "t5"]);
  assert.equal(M.lineById["p-lot"].start, -20);
  assert.equal(M.lineById["p-lot"].end, 40);
});

test("les tâches sans échéance ou hors fenêtre sont comptées à part", () => {
  assert.equal(M.undated, 1);
  assert.equal(M.outside, 1);
  assert.ok(!M.stationById.t9 && !M.stationById.t10);
});

test("une action de plus de 3 jours bifurque ; deux bifurcations qui se chevauchent prennent des côtés opposés", () => {
  const s = M.stationById;
  assert.equal(s.t2.branch, true);
  assert.equal(s.t6.branch, false);
  assert.equal(s.t4.branch, false, "une réunion reste sur la voie");
  assert.equal(s.t5.branch, false, "un jalon reste sur la voie");
  assert.equal(s.t3.branch && s.t12.branch, true);
  assert.notEqual(s.t3.side, s.t12.side);
});

test("seules les dépendances entre deux projets deviennent des correspondances", () => {
  assert.deepEqual(M.links, [["t2", "t6"]]);
  assert.deepEqual(M.stationById.t6.links, ["t2"]);
  assert.deepEqual(M.stationById.t2.links, ["t6"]);
  assert.deepEqual(M.stationById.t12.links, [], "même projet : pas de correspondance");
});

test("prochains départs : retards d'abord, puis échéances à venir ; le filtre est respecté", () => {
  assert.deepEqual(T.timeline3dNextDepartures(M, null, 4).map((x) => x.id), ["t7", "t6", "t2", "t11"]);
  const visible = new Set(["t2", "t6", "t8"]);
  assert.deepEqual(T.timeline3dNextDepartures(M, visible).map((x) => x.id), ["t6", "t2", "t8"]);
});

test("station précédente / suivante et prochain arrêt", () => {
  assert.deepEqual(T.timeline3dNeighbours(M, "t2"), { prev: "t1", next: "t4" });
  assert.deepEqual(T.timeline3dNeighbours(M, "t1"), { prev: null, next: "t2" });
  assert.equal(T.timeline3dNextStop(M, 3, "p-lot").id, "t4");
  assert.equal(T.timeline3dNextStop(M, 0, null).id, "t6");
  assert.equal(T.timeline3dNextStop(M, 100, null), null);
});

test("préférences : Grande Ligne par défaut, valeurs inconnues ramenées au défaut", () => {
  const d = T.normalizeTimeline3dViewPrefs({});
  assert.equal(d.mode, "rail");
  assert.equal(d.speed, "normal");
  assert.equal(d.board, true);
  assert.equal(d.animate, true);
  const c = T.normalizeTimeline3dViewPrefs({ mode: "cabine", speed: "fast", crit: "urgent", board: false, filter: [] });
  assert.equal(c.mode, "cabine");
  assert.equal(c.speed, "fast");
  assert.equal(c.crit, "urgent");
  assert.equal(c.board, false);
  assert.equal(c.filter, null);
  assert.equal(T.normalizeTimeline3dViewPrefs({ mode: "metro", speed: "x" }).mode, "rail");
  assert.ok(T.T3D_SPEEDS.fast > T.T3D_SPEEDS.normal && T.T3D_SPEEDS.normal > T.T3D_SPEEDS.slow);
});

test("libellés relatifs et qualité selon le volume", () => {
  assert.equal(T.timeline3dRel(0), "aujourd'hui");
  assert.equal(T.timeline3dRel(5), "J+5");
  assert.equal(T.timeline3dRel(-2), "J−2");
  assert.equal(T.timeline3dResolveQuality("auto", 100), "high");
  assert.equal(T.timeline3dResolveQuality("auto", 1000), "low");
  assert.equal(T.timeline3dResolveQuality("high", 1000), "high");
});

test("un réseau vide reste exploitable", () => {
  const empty = T.timeline3dBuild({ projectFolders: [] }, T.carteNormalize({ projects: [], statuses, taskTypes }, [], { now: NOW }));
  assert.equal(empty.lines.length, 0);
  assert.deepEqual(empty.range, { min: -7, max: 30 });
  assert.deepEqual(T.timeline3dNextDepartures(empty, null), []);
});

test("#462 : horizon — jour relatif et tâches encore à faire avant", () => {
  const h = T.timeline3dTarget(M, iso(7));
  assert.equal(h.day, 7);
  // t2 (J+3), t4 (J+7, le jour même), t6 (J+2), t7 (en retard, J-3), t11 (J+4) ;
  // t1 est terminée, t3/t8/t12/t5 tombent après l'horizon.
  assert.equal(h.count, 5);
  assert.deepEqual(T.timeline3dTarget(M, null), { day: null, count: 0 });
  assert.deepEqual(T.timeline3dTarget(M, "pas une date"), { day: null, count: 0 });
  assert.equal(T.timeline3dTarget(M, iso(-5)).count, 0, "un horizon passé ne compte que ce qui était dû avant lui");
  assert.equal(T.normalizeTimeline3dViewPrefs({ targetDate: iso(7) }).targetDate, iso(7));
  assert.equal(T.normalizeTimeline3dViewPrefs({ targetDate: "demain" }).targetDate, null);
  assert.equal(T.normalizeTimeline3dViewPrefs({}).targetDate, null);
});
