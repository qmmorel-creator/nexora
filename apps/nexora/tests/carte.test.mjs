/* Vue Carte (#361) : disposition hexagonale, thèmes, paliers, normalisation
   des tâches et modèles procéduraux. La tranche testée est extraite du bundle
   RÉELLEMENT construit, jamais recopiée. Le moteur three.js est éprouvé par le
   banc visuel (tools/visual-check). */

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
  `(function () {\n${slice("CARTE")}\n;return {
    carteHash, carteStage, carteNormalize, carteBuild, carteTerritoryStats, carteTaskModel, carteHubModel,
    carteDecorModel, carteLegend, carteMatches, normalizeCarteViewPrefs, carteDist, CARTE_THEMES, CARTE_THEME_BY_ID,
    carteEmojiIcon, carteThemeOverrides, carteTaskLevel, carteDimmedProjects, carteInitials, carteAvatarAnchor, carteHazard,
    carteLook, carteTotemColumn, CARTE_TOTEM_MARGIN,
    carteLanternRate, cartePigeonSpeed, carteAriadne, CARTE_ARIADNE_MAX, carteDaylight, carteRegroup, CARTE_GROUPINGS, carteMilestoneProgress,
    carteFolderGroups, carteViewFilterCount, carteViewFilterReset, CARTE_NO_FOLDER,
  };\n})`
)();

const NOW = Date.parse("2026-09-24T10:00:00");
const statuses = [
  { id: "s1", name: "À planifier", color: "#64748B" },
  { id: "s2", name: "Attente tiers", color: "#8B5CF6" },
  { id: "s3", name: "En cours", color: "#0EA5E9" },
  { id: "s5", name: "Terminé", color: "#22B07D" },
  { id: "s6", name: "Information", color: "#64748B" },
  { id: "s7", name: "Urgent client", color: "#DC2626" },
];
const taskTypes = [
  { id: "tt1", name: "Tâches" }, { id: "tt2", name: "Planning" }, { id: "tt3", name: "Réunions" }, { id: "tt4", name: "Information" },
];

function world(nProjects, nTasks, opts = {}) {
  const folders = Array.from({ length: 6 }, (_, i) => ({ id: "f" + i, name: "Dossier " + i }));
  const projects = Array.from({ length: nProjects }, (_, i) => ({ id: "p" + i, name: "Projet " + i, color: "#336699", folderId: i % 5 === 4 ? "folder-a-trier" : "f" + (i % 6) }));
  const tasks = Array.from({ length: nTasks }, (_, j) => ({
    id: "t" + j, title: "Tâche " + j, projectId: "p" + (j % Math.max(1, opts.perProject || nProjects)), statusId: statuses[j % 5].id,
    taskTypeId: taskTypes[j % 4].id, start: "2026-09-10", end: "2026-10-02",
  }));
  return { ctx: { projects, projectFolders: folders, statuses, taskTypes, teamMembers: [] }, tasks };
}
const build = (w, memory, themeOverrides) => {
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  return C.carteBuild({ projects: n.projects, tasks: n.tasks, memory, themeOverrides });
};

test("paliers décidés : 0-19, 20-39, 40-59, 60-79, 80-99, 100 %", () => {
  assert.deepEqual([0, 19, 20, 39, 40, 59, 60, 79, 80, 99, 100, -5, NaN].map(C.carteStage), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 0, 0]);
});

test("familles d'état, type, criticité et indices de dates tirés des vrais champs", () => {
  const ctx = { projects: [{ id: "p", name: "P" }], statuses, taskTypes, projectFolders: [], teamMembers: [{ name: "Léo", color: "#ff0000" }] };
  const tasks = [
    { id: "a", projectId: "p", statusId: "s5", completedAt: "2026-09-22T08:00:00Z" },
    { id: "b", projectId: "p", statusId: "s1", taskTypeId: "tt4" },
    { id: "c", projectId: "p", statusId: "s3", progress: 45, taskTypeId: "tt3" },
    { id: "d", projectId: "p", statusId: "s2", milestone: true, taskTypeId: "tt3" },
    { id: "e", projectId: "p", statusId: "s1", end: "2026-09-20", start: "2026-09-18", criticality: "moyen" },
    { id: "f", projectId: "p", statusId: "s1", start: "2026-10-05", end: "2026-10-30", assignee: "Léo" },
    { id: "g", projectId: "p", statusId: "s7", end: "2026-09-28", lastInteraction: "2026-07-01T00:00:00Z" },
    { id: "h", projectId: "zz", statusId: "s1" },
  ];
  const n = C.carteNormalize(ctx, tasks, { now: NOW });
  const by = Object.fromEntries(n.tasks.map((t) => [t.id, t]));
  assert.equal(by.a.state, "done"); assert.equal(by.a.recentDone, true);
  assert.equal(by.b.state, "info");
  assert.equal(by.c.state, "doing"); assert.equal(by.c.kind, "meeting"); assert.equal(by.c.progress, 45);
  assert.equal(by.d.state, "waiting"); assert.equal(by.d.kind, "milestone");
  assert.equal(by.e.overdue, true); assert.equal(by.e.lateDays, 4); assert.equal(by.e.criticality, "moyen"); assert.equal(by.e.duration, 3);
  assert.equal(by.f.future, true); assert.equal(by.f.assigneeColor, "#ff0000");
  assert.equal(by.g.criticality, "urgent", "un statut nommé « urgent » vaut criticité urgente, comme isTaskUrgent");
  assert.equal(by.g.soon, true); assert.equal(by.g.stale, true);
  assert.equal(by.h.projectId, null, "projet inconnu : tâche orpheline");
});

test("mêmes données, même carte ; 15 thèmes disponibles", () => {
  const w = world(20, 300);
  assert.equal(JSON.stringify(build(w)), JSON.stringify(build(w)));
  assert.equal(C.CARTE_THEMES.length, 15);
  ["cyberpunk", "ville", "desert", "mer", "lac", "montagne", "hautemontagne", "marais", "jungle", "volcan", "ile"].forEach((id) => assert.ok(C.CARTE_THEME_BY_ID[id], id));
});

test("ajouter un projet et des tâches ne déplace aucun territoire existant", () => {
  const w = world(12, 200);
  const before = build(w);
  w.ctx.projects.push({ id: "p-new", name: "Nouveau", folderId: "f1" });
  w.tasks.push({ id: "t-new", projectId: "p-new", statusId: "s1" }, { id: "t-new2", projectId: "p3", statusId: "s1" });
  const after = build(w);
  Object.keys(before.memory.projects).forEach((id) => assert.equal(after.memory.projects[id], before.memory.projects[id], id));
});

test("avec la mémoire de l'appareil, une suppression ne décale ni territoire ni tâche", () => {
  const w = world(12, 200);
  const before = build(w);
  w.ctx.projects.splice(3, 1);
  w.tasks = w.tasks.filter((t) => t.projectId !== "p3" && t.id !== "t10");
  const after = build(w, before.memory);
  Object.keys(after.memory.projects).forEach((id) => assert.equal(after.memory.projects[id], before.memory.projects[id], id));
  Object.keys(after.memory.tasks).forEach((id) => assert.equal(after.memory.tasks[id], before.memory.tasks[id], id));
});

test("un thème par dossier, régions voisines différentes, isolés en île, préférence respectée", () => {
  const w = world(24, 100);
  const L = build(w);
  w.ctx.projects.forEach((p) => {
    const expected = p.folderId === "folder-a-trier" ? "ile" : L.groupThemes[p.folderId];
    assert.equal(L.themes[p.id], expected, p.id);
  });
  const L2 = build(w, null, { f0: "volcan" });
  assert.equal(L2.themes.p0, "volcan");
  const cyber = build(w, null, { f0: "cyberpunk" });
  assert.equal(cyber.themes.p0, "cyberpunk");
  assert.equal(cyber.themes.p6, "cyberpunk", "tous les projets du dossier gardent le même thème");
  assert.equal(cyber.themes.p1, L.themes.p1, "les autres dossiers gardent leur thème automatique");
  assert.deepEqual(cyber.territories.map((t) => [t.projectId, t.q, t.r]), L.territories.map((t) => [t.projectId, t.q, t.r]), "le thème ne déplace aucun projet");
  assert.equal(C.carteThemeOverrides([{ id: "f0", mapTheme: "cyberpunk" }], {}).f0, "cyberpunk");
  assert.match(C.carteLegend("cyberpunk").lines.find(([label]) => label === "Tâche")[1], /Module/);
});

test("routes seulement entre projets d'un même dossier ; tâches dans leur territoire", () => {
  const w = world(18, 400);
  const L = build(w);
  L.routes.forEach((r) => assert.equal(L.projectById[r.from].group, L.projectById[r.to].group));
  L.pois.forEach((p) => assert.equal(L.tiles[p.key].projectId, p.projectId));
});

test("tâches sans projet : territoire « Terre inconnue » signalé", () => {
  const w = world(3, 9);
  w.tasks.push({ id: "orph", projectId: "absent", statusId: "s1" });
  const L = build(w);
  const poi = L.pois.find((p) => p.taskId === "orph");
  assert.equal(poi.projectId, "__terre-inconnue__");
  assert.equal(L.projectById["__terre-inconnue__"].name, "Terre inconnue");
});

test("statistiques et palier d'un territoire : les informations ne comptent pas", () => {
  const n = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [
    { id: "1", projectId: "p", statusId: "s5" }, { id: "2", projectId: "p", statusId: "s5" },
    { id: "3", projectId: "p", statusId: "s1" }, { id: "4", projectId: "p", statusId: "s6" },
  ], { now: NOW });
  const s = C.carteTerritoryStats(n.tasks);
  assert.equal(s.pct, 67); assert.equal(s.stage, 3); assert.equal(s.info, 1);
});

test("modèles valides pour chaque thème, état et palier", () => {
  const w = world(4, 60);
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  for (const th of C.CARTE_THEMES) {
    for (let st = 0; st <= 5; st++) for (const pr of ["high", "normal", "low"]) C.carteHubModel(th.id, st, "#123456", pr).forEach(check);
    n.tasks.forEach((t) => [0, 1, 2].forEach((d) => C.carteTaskModel({ ...t, checklistTotal: 3, checklistDone: 1, stale: true, overdue: true }, th.id, { detail: d, secondaryColor: "#00ff00" }).forEach(check)));
    C.carteDecorModel({ q: 1, r: 2, kind: "land" }, th.pal, th.id).forEach(check);
    assert.equal(C.carteLegend(th.id).lines.length, 10);
  }
  function check(p) {
    assert.ok(["box", "cyl", "hex", "cone", "pyr", "ball", "dome"].includes(p.g), p.g);
    assert.match(p.c, /^#[0-9a-fA-F]{6}$/);
    [...p.p, ...p.s].forEach((v) => assert.ok(Number.isFinite(v)));
  }
});

test("#376 : la construction d'une tâche en cours monte de façon continue avec l'avancement", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const height = (pr) => C.carteTaskModel({ ...base, progress: pr }, "ville", { detail: 0, plinth: false }).filter((p) => p.c !== "#c9a060").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  assert.ok(height(20) < height(25) && height(25) < height(50) && height(50) < height(90), `${height(20)} < ${height(25)} < ${height(50)} < ${height(90)}`);
});

test("filtres de la vue et préférences normalisées", () => {
  const t = { state: "done", criticality: "urgent", overdue: false, oldDone: true };
  assert.equal(C.carteMatches(t, {}), true, "#372 : terminée visible par défaut, même ancienne");
  assert.equal(C.carteMatches(t, { hideOldDone: true }), false, "masquée seulement sur demande");
  assert.equal(C.carteMatches(t, { crit: "urgent" }), true);
  assert.equal(C.carteMatches(t, { crit: "moyen" }), false);
  assert.equal(C.carteMatches(t, { states: ["todo"], late: true }), true, "#400 : les puces d'état et « En retard » n'existent plus");
  assert.equal(C.normalizeCarteViewPrefs({}).hideOldDone, false);
  const p = C.normalizeCarteViewPrefs({ crit: "nope", quality: "ultra", folderThemes: { f1: "volcan", f2: "inconnu" } });
  assert.equal(p.crit, "all"); assert.equal(p.quality, "auto");
  assert.deepEqual(p.folderThemes, { f1: "volcan" });
});

test("grand volume : 300 projets et 12 000 tâches disposés en moins de 3 s", () => {
  const w = world(300, 12000);
  const t0 = Date.now();
  const L = build(w);
  const ms = Date.now() - t0;
  assert.equal(L.pois.length, 12000);
  assert.ok(ms < 3000, `${ms} ms`);
});

test("#366 : seules les icônes emoji passent dans les étiquettes 3D", () => {
  assert.equal(C.carteEmojiIcon("🏗️"), "🏗️");
  ["iconify:thesvg-color/gmail", "tabler:map-2", "https://x.y/i.png", "data:image/png;base64,AA", "abc", "", null].forEach((i) => assert.equal(C.carteEmojiIcon(i), "", String(i)));
});

test("#368 : le thème enregistré sur le dossier prime sur la préférence de vue", () => {
  const o = C.carteThemeOverrides([{ id: "f1", mapTheme: "volcan" }, { id: "f2", mapTheme: "inconnu" }, { id: "f3" }], { f1: "mer", f3: "lac", f9: "nope" });
  assert.deepEqual(o, { f1: "volcan", f3: "lac" });
});

test("#364 et #365 : préférences du filtre général et du panneau", () => {
  const f = { statusIds: ["s1"], excludeDone: true };
  assert.deepEqual(C.normalizeCarteViewPrefs({ filter: f }).filter, f);
  assert.equal(C.normalizeCarteViewPrefs({ filter: [1] }).filter, null);
  assert.equal(C.normalizeCarteViewPrefs({}).panel, true);
  assert.equal(C.normalizeCarteViewPrefs({ panel: false }).panel, false);
});

test("#374 : grisés = projets avec des tâches mais aucune affichée ; un projet vide ne l'est pas", () => {
  const tasks = [{ id: "a", projectId: "p1" }, { id: "b", projectId: "p1" }, { id: "c", projectId: "p2" }, { id: "d", projectId: null }];
  const dim = C.carteDimmedProjects(tasks, new Set(["a"]));
  assert.deepEqual([...dim].sort(), ["__terre-inconnue__", "p2"]);
  assert.equal(dim.has("p3"), false);
  assert.equal(C.carteDimmedProjects(tasks, new Set(["a", "c", "d"])).size, 0);
});

test("#380 : la hauteur construite est proportionnelle au pourcentage d'avancement", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const built = (pr) => C.carteTaskModel({ ...base, progress: pr }, "ville", { detail: 0, plinth: false }).filter((p) => p.c !== "#c9a060").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  const full = C.carteTaskModel({ ...base, state: "done" }, "ville", { detail: 0, plinth: false }).reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  [25, 50, 75].forEach((pr) => assert.ok(Math.abs(built(pr) / full - pr / 100) < 0.06, `${pr} % : ${(built(pr) / full * 100).toFixed(0)} % de la hauteur finale`));
  assert.ok(full >= 3, `bâtiment terminé nettement agrandi (${full.toFixed(2)})`);
});

test("#395 : l'amplitude de construction est forte dans tous les thèmes", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const top = (parts) => parts.filter((p) => p.m !== "t" && p.m !== "h").reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  C.CARTE_THEMES.forEach((th) => {
    const full = top(C.carteTaskModel({ ...base, state: "done" }, th.id, { detail: 0 }));
    const quarter = top(C.carteTaskModel({ ...base, progress: 25 }, th.id, { detail: 0 }).filter((p) => p.c !== "#c9a060"));
    assert.ok(full >= 3, `${th.id} : terminé à ${full.toFixed(2)}`);
    assert.ok(full - quarter >= 2, `${th.id} : écart 25 % → 100 % de ${(full - quarter).toFixed(2)}`);
  });
});

test("#407 : le sol garde le relief du thème, quelle que soit l'échéance ; le bâtiment ne porte plus de socle", () => {
  const ctx = { projects: [{ id: "p", name: "P" }], statuses, taskTypes, projectFolders: [] };
  const mk = (tasks) => { const n = C.carteNormalize(ctx, tasks, { now: NOW }); return { n, L: C.carteBuild({ projects: n.projects, tasks: n.tasks }) }; };
  const empty = mk([]).L;
  const { n, L } = mk([
    { id: "late", projectId: "p", statusId: "s1", start: "2026-09-01", end: "2026-09-10" },
    { id: "far", projectId: "p", statusId: "s1", start: "2026-09-20", end: "2026-12-20" },
    { id: "nod", projectId: "p", statusId: "s1" },
  ]);
  ["late", "far", "nod"].forEach((id) => {
    const k = L.pois.find((p) => p.taskId === id).key;
    assert.equal(L.tiles[k].h, empty.tiles[k].h, `${id} : même hauteur qu'une case vide`);
    assert.equal(L.tiles[k].kind, empty.tiles[k].kind, `${id} : même nature de case`);
  });
  const model = C.carteTaskModel({ ...n.tasks[0], state: "done" }, "ville", { detail: 0 });
  assert.equal(model.filter((p) => p.g === "hex" && p.s[1] > 0.1).length, 0, "aucun socle d'avancement");
});

test("#408 : le thème Volcan porte des coulées de lave, où l'on ne bâtit pas", () => {
  const ctx = { projects: [{ id: "p", name: "P", folderId: "f" }], projectFolders: [{ id: "f", name: "F" }], statuses, taskTypes };
  const tasks = Array.from({ length: 20 }, (_, i) => ({ id: "t" + i, projectId: "p", statusId: "s1" }));
  const n = C.carteNormalize(ctx, tasks, { now: NOW });
  const L = C.carteBuild({ projects: n.projects, tasks: n.tasks, themeOverrides: { f: "volcan" } });
  const lava = Object.keys(L.tiles).filter((k) => L.tiles[k].lava && !L.tiles[k].road);
  assert.ok(lava.length >= 4, `${lava.length} cases de lave`);
  assert.ok(lava.every((k) => L.tiles[k].theme === "volcan"), "lave propre au Volcan");
  assert.ok(!L.pois.some((p) => L.tiles[p.key].lava), "aucune tâche sur la lave");
  const other = C.carteBuild({ projects: n.projects, tasks: n.tasks, themeOverrides: { f: "montagne" } });
  assert.equal(Object.keys(other.tiles).filter((k) => other.tiles[k].lava).length, 0, "pas de lave ailleurs");
});

test("#409 : la récurrence n'est plus dessinée", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1", recurrence: { unit: "week", every: 1 } }], { now: NOW }).tasks[0];
  const plain = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  C.CARTE_THEMES.forEach((th) => {
    assert.deepEqual(C.carteTaskModel(base, th.id, { detail: 2 }), C.carteTaskModel(plain, th.id, { detail: 2 }), th.id);
    assert.ok(!C.carteLegend(th.id).lines.some((it) => /Récurrente/.test(it[0])), `${th.id} : pas de ligne Récurrente`);
  });
});

test("#379 : dalle claire et, pour une tâche à faire, jalon au fanion de son statut", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s1", taskTypeId: "tt1" }], { now: NOW }).tasks[0];
  const parts = C.carteTaskModel(base, "ville", { detail: 0 });
  assert.ok(parts.some((p) => p.g === "hex" && p.c === "#fff8e8"), "dalle claire");
  assert.ok(parts.some((p) => p.g === "box" && p.c === base.statusColor), "fanion à la couleur du statut");
});

test("#382 : initiales et avatar du responsable", () => {
  assert.equal(C.carteInitials("Maïa Sonnier"), "MS");
  assert.equal(C.carteInitials("Quentin"), "Q");
  assert.equal(C.carteInitials("anne-laure masson"), "AM");
  assert.equal(C.carteInitials(""), "?");
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes, teamMembers: [{ name: "Léo", color: "#123456" }] }, [{ id: "x", projectId: "p", statusId: "s1", assignee: "Léo" }], { now: NOW }).tasks[0];
  const parts = C.carteTaskModel(base, "ville", { detail: 2 });
  assert.ok(parts.some((p) => p.g === "cyl" && p.c === "#123456"), "silhouette à la couleur de l'utilisateur");
  assert.ok(C.carteAvatarAnchor(base)[1] > 0.5, "badge au-dessus de la tête");
  assert.ok(!C.carteTaskModel({ ...base, overdue: true, criticality: "urgent" }, "ville", { detail: 0 }).some((p) => p.c === "#ff5a1f"), "pas de brasier dans le modèle");
});

test("#385/#406/#414 : incendie si urgente, horloge si en retard, gros éclairs si les deux", () => {
  const t = (o) => ({ state: "doing", criticality: "moyen", overdue: false, ...o });
  assert.equal(C.carteHazard(t({ criticality: "urgent" })), "fire");
  assert.equal(C.carteHazard(t({ overdue: true })), "clock");
  assert.equal(C.carteHazard(t({ overdue: true, criticality: "urgent" })), "tempest");
  assert.equal(C.carteHazard(t({})), null);
  assert.equal(C.carteHazard(t({ state: "done", criticality: "urgent" })), null);
  assert.equal(C.carteHazard(t({ state: "info", criticality: "urgent" })), null);
});

// Un seul style de carte, Classique (#404).
test("#404 : un seul style, Classique ; d'anciennes préférences de style sont ignorées", () => {
  const p = C.normalizeCarteViewPrefs({ style: "dnd", folderLieux: { f1: "cite" }, states: ["todo"], late: true });
  ["style", "folderLieux", "states", "late"].forEach((k) => assert.ok(!(k in p), k + " n'est plus une préférence"));
  assert.equal(C.carteLook("ville").label, "Ville");
  assert.equal(C.carteLook("inconnu").label, C.CARTE_THEMES[0].label);
  const base = { id: "x", state: "doing", kind: "task", progress: 40, duration: 5, criticality: null, overdue: false, soon: false, future: false, assignee: null, checklistTotal: 0, checklistDone: 0, recurring: false, attachments: 0, hasReport: false, fromEmail: false, stale: false, startTime: null, secondaryProjectId: null };
  assert.deepEqual(C.carteTaskModel(base, "ville", { style: "dnd", lieu: "arene" }), C.carteTaskModel(base, "ville", {}), "un ancien style ne change rien au modèle");
});

test("#395 : colonne de totem aux couleurs du projet, hauteur demandée", () => {
  const c = C.carteTotemColumn(3.2, "#e07a3f", "#9a9488");
  assert.equal(c.h, 3.2);
  assert.ok(Math.abs(Math.max(...c.parts.map((p) => p.p[1] + p.s[1])) - 3.2) < 1e-9, "sommet de la colonne à la hauteur demandée");
  assert.ok(c.parts.some((p) => p.c === "#e07a3f"), "cerclée de la couleur du projet");
  assert.deepEqual(C.carteTotemColumn(-1, "#e07a3f"), { parts: [], h: 0 }, "pas de colonne si le cœur est déjà assez haut");
  assert.ok(C.CARTE_TOTEM_MARGIN >= 1, "le totem dépasse nettement la plus haute tâche");
});

test("#398 : le bonhomme du responsable, à tous les niveaux de détail, masquable dans les options", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes, teamMembers: [{ name: "Léo", color: "#123456" }] }, [{ id: "x", projectId: "p", statusId: "s3", assignee: "Léo" }], { now: NOW }).tasks[0];
  C.CARTE_THEMES.forEach((th) => [0, 1, 2].forEach((detail) => {
    const parts = C.carteTaskModel(base, th.id, { detail });
    assert.ok(parts.some((p) => p.c === "#123456"), `${th.id}, détail ${detail} : pas de bonhomme`);
    assert.ok(Math.max(...parts.map((p) => (p.p[0] < -0.3 ? p.p[1] + p.s[1] : 0))) >= 0.85, `${th.id}, détail ${detail} : bonhomme trop petit`);
    assert.ok(!C.carteTaskModel(base, th.id, { detail, people: false }).some((p) => p.c === "#123456"), `${th.id} : bonhomme masqué sur demande`);
  }));
  assert.ok(!C.carteTaskModel({ ...base, assignee: null, assigneeColor: null }, "ville", { detail: 2 }).some((p) => p.c === "#123456"), "pas de bonhomme sans responsable");
  assert.equal(C.normalizeCarteViewPrefs({}).people, true);
  assert.equal(C.normalizeCarteViewPrefs({ people: false }).people, false);
});

test("#392 : une pastille par dossier, avancement cumulé, projets sans dossier en dernier", () => {
  const ctx = {
    projectFolders: [{ id: "f1", name: "Chantiers", color: "#112233" }, { id: "f2", name: "Perso" }],
    projects: [{ id: "a", folderId: "f1", color: "#aa0000" }, { id: "b", folderId: "f1" }, { id: "c" }, { id: "d", folderId: "f2", color: "#00aa00" }],
    statuses, taskTypes,
  };
  const norm = C.carteNormalize(ctx, [
    { id: "1", projectId: "a", statusId: "s5" }, { id: "2", projectId: "a", statusId: "s3" },
    { id: "3", projectId: "b", statusId: "s5" }, { id: "4", projectId: "c", statusId: "s3" }, { id: "5", projectId: "d", statusId: "s1" },
  ], { now: NOW });
  const layout = C.carteBuild({ projects: norm.projects, tasks: norm.tasks });
  const by = {};
  norm.tasks.forEach((t) => { (by[t.projectId] = by[t.projectId] || []).push(t); });
  const stats = {};
  layout.territories.forEach((tr) => { stats[tr.projectId] = C.carteTerritoryStats(by[tr.projectId] || []); });
  const groups = C.carteFolderGroups(layout, stats, ctx.projectFolders);
  assert.deepEqual(groups.map((g) => g.name), ["Chantiers", "Perso", "Sans dossier"]);
  const f1 = groups[0];
  assert.deepEqual(f1.projects.slice().sort(), ["a", "b"]);
  assert.equal(f1.pct, 67, "2 terminées sur 3");
  assert.equal(f1.color, "#112233", "couleur du dossier");
  assert.equal(groups[1].color, "#00aa00", "à défaut, couleur du premier projet");
  assert.equal(groups[2].id, C.CARTE_NO_FOLDER);
});

test("#400 : « Masquer les terminées depuis 30 jours » vaut aussi sans date de complétion", () => {
  const n = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [
    { id: "old", projectId: "p", statusId: "s5", end: "2026-07-01" },
    { id: "recent", projectId: "p", statusId: "s5", end: "2026-09-20" },
    { id: "stamped", projectId: "p", statusId: "s5", end: "2026-07-01", completedAt: "2026-09-20T10:00:00" },
  ], { now: NOW }).tasks;
  const by = Object.fromEntries(n.map((t) => [t.id, t]));
  assert.equal(by.old.oldDone, true);
  assert.equal(by.recent.oldDone, false);
  assert.equal(by.stamped.oldDone, false, "la date de complétion prime");
  assert.equal(C.carteMatches(by.old, { hideOldDone: true }), false);
});

test("#400 : les filtres propres à la vue se comptent et se remettent à zéro", () => {
  const cfg = C.normalizeCarteViewPrefs({ states: ["todo"], crit: "urgent", late: true });
  assert.equal(C.carteViewFilterCount(cfg), 1, "seule la criticité reste un filtre propre à la vue");
  assert.equal(C.carteViewFilterCount(C.normalizeCarteViewPrefs({ ...cfg, ...C.carteViewFilterReset() })), 0);
  assert.equal(C.carteViewFilterCount(C.normalizeCarteViewPrefs({})), 0);
});

test("#401 : la carte simplifiée est une préférence de la vue, désactivée par défaut", () => {
  assert.equal(C.normalizeCarteViewPrefs({}).simplify, false);
  assert.equal(C.normalizeCarteViewPrefs({ simplify: true }).simplify, true);
  assert.equal(C.normalizeCarteViewPrefs(C.carteViewFilterReset()).simplify, false, "« Tout afficher » ne force pas le mode");
});

test("#419 : le jalon est une borne milliaire, la même dans tous les thèmes, à la couleur de son type", () => {
  const milestoneTypes = [{ id: "std", name: "Jalon", symbol: "diamond", color: "#4F6AF5" }, { id: "liv", name: "Livraison", symbol: "triangle", color: "#22B07D" }];
  const mk = (o) => C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes, milestoneTypes }, [{ id: "x", projectId: "p", statusId: "s3", taskTypeId: "tt3", milestone: true, ...o }], { now: NOW }).tasks[0];
  const liv = mk({ milestoneTypeId: "liv" });
  assert.equal(liv.kind, "milestone");
  assert.equal(liv.milestoneColor, "#22B07D");
  assert.equal(liv.milestoneSymbol, "triangle");
  assert.equal(mk({ milestoneTypeId: "inconnu" }).milestoneColor, "#4F6AF5", "type inconnu : premier du catalogue");
  const shape = (t, th) => C.carteTaskModel(t, th, { detail: 0 }).map((p) => p.g + ":" + p.c).join(",");
  C.CARTE_THEMES.forEach((th) => {
    assert.equal(shape(liv, th.id), shape(liv, "ville"), `${th.id} : même borne`);
    assert.deepEqual(C.carteLegend(th.id).lines.find((l) => l[0] === "Jalon"), ["Jalon", "Borne milliaire à la couleur du type"]);
  });
  const open = C.carteTaskModel(liv, "ville", { detail: 0 });
  assert.ok(open.some((p) => p.c === "#22B07D"), "tête à la couleur du type");
  const top = (parts) => parts.reduce((m, p) => Math.max(m, p.p[1] + p.s[1]), 0);
  assert.ok(top(open) < 1.6, `borne basse : ${top(open).toFixed(2)}`);
  const done = C.carteTaskModel({ ...liv, state: "done" }, "ville", { detail: 0 });
  assert.ok(done.length >= open.length + 10, "couronne de laurier une fois terminé");
  assert.ok(done.some((p) => p.m === "g"), "pierre lumineuse une fois terminé");
});

test("#430 : jours d'inactivité et vitesse du pigeon", () => {
  const n = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [
    { id: "a", projectId: "p", statusId: "s2", lastInteraction: "2026-09-10T10:00:00" },
    { id: "b", projectId: "p", statusId: "s5", completedAt: "2026-09-20T10:00:00" },
    { id: "c", projectId: "p", statusId: "s5", completedAt: "2026-08-01T10:00:00" },
  ], { now: NOW }).tasks;
  const by = Object.fromEntries(n.map((t) => [t.id, t]));
  assert.equal(by.a.idleDays, 14);
  assert.equal(by.c.idleDays, null, "sans interaction connue");
  assert.ok(C.cartePigeonSpeed(0) > C.cartePigeonSpeed(7) && C.cartePigeonSpeed(7) > C.cartePigeonSpeed(60));
  assert.ok(C.cartePigeonSpeed(1000) >= 0.15, "le pigeon ne s'arrête jamais");
});

test("#431 : la lanterne pulse de plus en plus vite quand l'échéance approche", () => {
  const t = (dueIn) => ({ soon: dueIn >= 0 && dueIn <= 7, overdue: dueIn < 0, dueIn });
  assert.ok(C.carteLanternRate(t(0)) > C.carteLanternRate(t(3)) && C.carteLanternRate(t(3)) > C.carteLanternRate(t(7)));
  assert.equal(C.carteLanternRate(t(-2)), null, "en retard : c'est l'horloge");
  assert.equal(C.carteLanternRate({ soon: false, overdue: false, dueIn: 20 }), null);
});

test("#435 : fil d'Ariane, les prochaines échéances dans l'ordre", () => {
  const tasks = [
    { id: "a", state: "doing", end: 12, dueIn: 2, overdue: false },
    { id: "b", state: "todo", end: 10, dueIn: 0, overdue: false },
    { id: "c", state: "done", end: 11, dueIn: 1, overdue: false },
    { id: "d", state: "doing", end: 5, dueIn: -5, overdue: true },
    { id: "e", state: "todo", end: 30, dueIn: 20, overdue: false, criticality: "urgent" },
    { id: "f", state: "todo", end: 40, dueIn: 30, overdue: false },
  ];
  assert.deepEqual(C.carteAriadne(tasks, 3).map((t) => t.id), ["b", "a", "e"]);
  assert.deepEqual(C.carteAriadne(tasks).map((t) => t.id), ["b", "a", "e", "f"], "ni terminées ni retards");
  assert.equal(C.CARTE_ARIADNE_MAX, 8);
  assert.equal(C.carteAriadne(Array.from({ length: 20 }, (_, i) => ({ id: "t" + i, state: "todo", end: i, dueIn: i }))).length, 8);
});

test("#436 : jour et nuit à l'heure réelle, la nuit reste lisible", () => {
  const noon = C.carteDaylight(12), night = C.carteDaylight(23), dusk = C.carteDaylight(19);
  assert.equal(noon.k, 1); assert.equal(noon.evening, false);
  assert.ok(night.k >= 0.5 && night.k < dusk.k && dusk.k < 1);
  assert.equal(night.evening, true); assert.equal(C.carteDaylight(6.5).evening, true);
  assert.notEqual(noon.sky, night.sky);
});

test("#437 : avancement d'un jalon pour l'anneau de progression", () => {
  assert.equal(C.carteMilestoneProgress({ state: "doing", progress: 40 }), 40);
  assert.equal(C.carteMilestoneProgress({ state: "done", progress: 10 }), 100);
  assert.equal(C.carteMilestoneProgress({ state: "todo", progress: 250 }), 100);
  assert.equal(C.carteMilestoneProgress(null), 0);
});

test("#425 à #436 : les animations d'ambiance sont une préférence active par défaut", () => {
  assert.equal(C.normalizeCarteViewPrefs({}).ambient, true);
  assert.equal(C.normalizeCarteViewPrefs({ ambient: false }).ambient, false);
});

test("#435 : le mode Fil d'Ariane est une préférence inactive par défaut", () => {
  assert.equal(C.normalizeCarteViewPrefs({}).ariadne, false);
  assert.equal(C.normalizeCarteViewPrefs({ ariadne: true }).ariadne, true);
});

test("#438 : regroupement des régions par responsable, statut, type ou criticité", () => {
  const n = C.carteNormalize({ projects: [{ id: "p1", name: "Alpha", folderId: "f1" }, { id: "p2", name: "Beta" }], projectFolders: [{ id: "f1", name: "Dossier" }], statuses, taskTypes }, [
    { id: "a", projectId: "p1", statusId: "s3", assignee: "Léo", taskTypeId: "tt1", criticality: "urgent" },
    { id: "b", projectId: "p2", statusId: "s3", assignee: "Léo", taskTypeId: "tt3" },
    { id: "c", projectId: "p1", statusId: "s1", assignee: "Ana", taskTypeId: "tt1" },
    { id: "d", statusId: "s1" },
  ], { now: NOW });
  assert.equal(C.carteRegroup(n, "folder"), n, "par dossier : rien ne change");
  assert.deepEqual(C.CARTE_GROUPINGS.map((g) => g.id), ["folder", "assignee", "status", "type", "criticality"]);
  const byA = C.carteRegroup(n, "assignee", {});
  assert.equal(byA.groupBy, "assignee");
  const proj = (r, id) => r.projects.find((p) => p.id === r.tasks.find((t) => t.id === id).projectId);
  assert.equal(proj(byA, "a").folderName, "Léo");
  assert.equal(proj(byA, "a"), proj(byA, "a"));
  assert.notEqual(proj(byA, "a").id, proj(byA, "b").id, "même responsable, projets différents : deux territoires");
  assert.equal(proj(byA, "a").group, proj(byA, "b").group, "… dans la même région");
  assert.equal(proj(byA, "a").name, "Alpha");
  assert.equal(proj(byA, "d").folderName, "Sans responsable");
  assert.equal(proj(byA, "d").name, "Sans projet");
  assert.equal(byA.tasks.find((t) => t.id === "a").sourceProjectId, "p1", "le vrai projet reste connu");
  // Ordre des régions : alphabétique, « Sans responsable » en dernier.
  const regions = [...new Set(byA.projects.slice().sort((x, y) => x.order - y.order).map((p) => p.folderName))];
  assert.deepEqual(regions, ["Ana", "Léo", "Sans responsable"]);
  // Statut : ordre du catalogue.
  const byS = C.carteRegroup(n, "status", { statuses });
  assert.deepEqual([...new Set(byS.projects.slice().sort((x, y) => x.order - y.order).map((p) => p.folderName))], ["À planifier", "En cours"]);
  assert.equal(proj(byS, "a").groupColor, "#0EA5E9");
  assert.equal(proj(C.carteRegroup(n, "criticality", {}), "a").folderName, "Urgente");
  assert.equal(proj(C.carteRegroup(n, "type", { taskTypes }), "b").folderName, "Réunions");
  // La disposition accepte le regroupement : une région par valeur.
  const l = C.carteBuild({ projects: byA.projects, tasks: byA.tasks, memory: {} });
  assert.equal(l.territories.length, byA.projects.length);
  assert.ok(!l.territories.some((t) => t.projectId === "__terre-inconnue__"));
  assert.equal(C.normalizeCarteViewPrefs({}).groupBy, "folder");
  assert.equal(C.normalizeCarteViewPrefs({ groupBy: "assignee" }).groupBy, "assignee");
  assert.equal(C.normalizeCarteViewPrefs({ groupBy: "n'importe" }).groupBy, "folder");
});
