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
    carteEmojiIcon, carteThemeOverrides, carteTaskLevel, carteDimmedProjects, carteInitials, carteAvatarAnchor, carteHazard, carteDangerSign,
    carteLook, carteTotemColumn, CARTE_TOTEM_MARGIN,
    carteLanternRate, cartePigeonSpeed, carteAriadne, CARTE_ARIADNE_MAX, carteDaylight, carteRegroup, CARTE_GROUPINGS, carteMilestoneProgress,
    carteFolderGroups, carteViewFilterCount, carteViewFilterReset, CARTE_NO_FOLDER, carteQuickOptions, CARTE_NONE,
    carteIncomplete, carteDrift, carteQuests, CARTE_QUEST_KINDS, carteResources, carteShiftIso, carteShiftPatch, carteUndoPatch,
    carteEvents, carteClaimTile, carteStrategicAlpha, CARTE_DIST_MAX, carteBuildable, carteNearestBuildable, carteGroupAnchor, carteTeleportPhase, cartePersonSocle, carteFigurineTint, carteFlagStyle, carteCriticalFx, CARTE_CRITICAL_FX_KINDS, CARTE_FIGURINE_BASE, CARTE_AVATAR_ANCHOR, CARTE_TP_DUR, CARTE_TP_SWAP, carteToWorld, carteNormalizeViews, CARTE_VIEWS_MAX,
    carteNormalizeWheel, CARTE_ROAD_LANTERN, carteKenneyBuilding, carteRegradeHsl, CARTE_KENNEY_HOUSES, CARTE_WHEEL_ACTIONS, CARTE_WHEEL_DEFAULT, CARTE_WHEEL_MAX, carteDueTodayPatch, carteInnerRadius, carteHoloTabs, carteHoloBlocks, carteHoloInline,
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
  assert.deepEqual(p.crits, []); assert.equal(p.quality, "auto");
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

test("#450 : panneau danger sur les tâches ouvertes de criticité moyenne seulement", () => {
  const t = (o) => ({ state: "doing", criticality: "moyen", overdue: false, ...o });
  assert.equal(C.carteDangerSign(t({})), true);
  assert.equal(C.carteDangerSign(t({ state: "todo", overdue: true })), true, "aussi en retard, au-dessus du réveil");
  assert.equal(C.carteDangerSign(t({ criticality: "urgent" })), false, "l'urgente a son incendie");
  assert.equal(C.carteDangerSign(t({ criticality: "bas" })), false);
  assert.equal(C.carteDangerSign(t({ criticality: null })), false);
  assert.equal(C.carteDangerSign(t({ state: "done" })), false);
  assert.equal(C.carteDangerSign(t({ state: "info" })), false);
  assert.equal(C.carteDangerSign(null), false);
  assert.match(C.carteLook("ville").sig[0][1], /panneau danger/, "la légende l'annonce");
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
  assert.equal(C.carteViewFilterCount(cfg), 1, "seule la criticité reste un filtre propre à la vue (reprise de l'ancienne valeur)");
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

// ---------- Pilotage depuis la carte (#468 à #481) ----------
const pilotCtx = { projects: [{ id: "p", name: "P" }], statuses, taskTypes, projectFolders: [], teamMembers: [{ name: "Léo" }] };
const pilotTasks = [
  // En retard, sans responsable.
  { id: "late", title: "Livrer", projectId: "p", statusId: "s1", start: "2026-09-01", end: "2026-09-20" },
  // Bloquée par « late », et commence avant sa fin : conflit.
  { id: "blk", title: "Recette", projectId: "p", statusId: "s1", start: "2026-09-15", end: "2026-10-10", assignee: "Léo", dependsOn: ["late"] },
  // En dérive : 10 % alors que 80 % du temps est écoulé.
  { id: "drf", title: "Chantier", projectId: "p", statusId: "s3", start: "2026-09-17", end: "2026-09-26", progress: 10, assignee: "Léo" },
  // Sans échéance, oubliée.
  { id: "old", title: "Idée", projectId: "p", statusId: "s1", assignee: "Léo", lastInteraction: "2026-07-01T00:00:00Z" },
  // Échéance aujourd'hui, complète.
  { id: "tod", title: "Appel", projectId: "p", statusId: "s1", start: "2026-09-24", end: "2026-09-24", assignee: "Léo" },
  // Terminée et information : jamais dans le journal.
  { id: "fin", title: "Fait", projectId: "p", statusId: "s5", end: "2026-09-01" },
  { id: "inf", title: "Info", projectId: "p", statusId: "s1", taskTypeId: "tt4" },
];
const pilotNorm = () => { const n = C.carteNormalize(pilotCtx, pilotTasks, { now: NOW }); n.taskById = Object.fromEntries(n.tasks.map((t) => [t.id, t])); return n; };

test("brouillard de guerre : fiche incomplète d'une tâche ouverte uniquement (#468)", () => {
  const by = pilotNorm().taskById;
  assert.deepEqual(C.carteIncomplete(by.late), ["unassigned"]);
  assert.deepEqual(C.carteIncomplete(by.old), ["nodue", "stale"]);
  assert.deepEqual(C.carteIncomplete(by.tod), []);
  assert.deepEqual(C.carteIncomplete(by.fin), []);
  assert.deepEqual(C.carteIncomplete(by.inf), [], "une information n'est pas à compléter");
  assert.deepEqual(C.carteIncomplete({ ...by.old, progress: 30 }), ["nodue"], "commencée : plus oubliée");
});

test("journal de quêtes : catégories, ordre et exclusions (#473)", () => {
  const n = pilotNorm();
  const q = C.carteQuests(n);
  const kinds = (id) => q.filter((x) => x.taskId === id).map((x) => x.kind);
  assert.deepEqual(kinds("late"), ["late", "unassigned"]);
  assert.deepEqual(kinds("blk"), ["blocked", "conflict"]);
  assert.deepEqual(kinds("drf"), ["drift"]);
  assert.deepEqual(kinds("old"), ["nodue", "stale"]);
  assert.deepEqual(kinds("tod"), []);
  assert.deepEqual(kinds("fin"), []); assert.deepEqual(kinds("inf"), []);
  const order = C.CARTE_QUEST_KINDS.map((k) => k.id);
  for (let i = 1; i < q.length; i++) assert.ok(order.indexOf(q[i - 1].kind) <= order.indexOf(q[i].kind), "trié par catégorie");
  assert.match(q.find((x) => x.kind === "blocked").detail, /Livrer/);
  // Restreint aux tâches visibles.
  assert.deepEqual(C.carteQuests(n, new Set(["drf"])).map((x) => x.kind), ["drift"]);
  // Fin avant début : conflit même sans prédécesseur.
  const n2 = C.carteNormalize(pilotCtx, [{ id: "x", projectId: "p", statusId: "s1", start: "2026-10-05", end: "2026-10-01", assignee: "Léo" }], { now: NOW });
  assert.deepEqual(C.carteQuests(n2).map((x) => x.kind), ["conflict"]);
});

test("dérive : hors de la période ou sans dates, jamais (#473)", () => {
  const by = pilotNorm().taskById;
  const today = pilotNorm().today;
  assert.equal(C.carteDrift(by.drf, today), true);
  assert.equal(C.carteDrift({ ...by.drf, progress: 60 }, today), false);
  assert.equal(C.carteDrift(by.old, today), false);
  assert.equal(C.carteDrift(by.drf, today + 30), false);
});

test("barre de ressources : compteurs par clé (#478)", () => {
  const r = C.carteResources(pilotNorm());
  assert.deepEqual(r.late, ["late"]);
  assert.deepEqual(r.today, ["tod"]);
  assert.deepEqual(r.doing, ["drf"]);
  assert.deepEqual(r.blocked, ["blk"]);
  assert.deepEqual(r.incomplete.sort(), ["late", "old"]);
  assert.deepEqual(C.carteResources(pilotNorm(), new Set(["tod"])).late, []);
});

test("menu d'action rapide : décalage des dates et annulation (#469, #475)", () => {
  assert.equal(C.carteShiftIso("2026-09-30", 1), "2026-10-01");
  assert.equal(C.carteShiftIso("2026-12-28", 7), "2027-01-04");
  assert.equal(C.carteShiftIso("", 1), null);
  assert.deepEqual(C.carteShiftPatch({ start: "2026-09-10", end: "2026-09-20" }, 7), { start: "2026-09-17", end: "2026-09-27" });
  assert.deepEqual(C.carteShiftPatch({ end: "2026-09-20" }, 1), { end: "2026-09-21" });
  assert.deepEqual(C.carteShiftPatch({}, 1, NOW), { start: "2026-09-25", end: "2026-09-25" }, "sans date : demain");
  assert.deepEqual(C.carteUndoPatch({ start: "2026-09-10", assignee: "Léo" }, { start: "x", end: "y", assignee: "Zoé" }), { start: "2026-09-10", end: null, assignee: "Léo" });
});

test("vie de la carte : création, avancement, fin, jalon (#480)", () => {
  const a = [{ id: "1", state: "todo", progress: 0 }, { id: "2", state: "doing", progress: 20 }, { id: "3", state: "doing", progress: 50, milestone: true }];
  const b = [{ id: "1", state: "done", progress: 0 }, { id: "2", state: "doing", progress: 40 }, { id: "3", state: "done", progress: 100, milestone: true }, { id: "4", state: "todo", progress: 0 }];
  assert.deepEqual(C.carteEvents(a, b), [
    { type: "done", id: "1" }, { type: "progress", id: "2", from: 20, to: 40 }, { type: "milestone", id: "3" }, { type: "created", id: "4" },
  ]);
  assert.deepEqual(C.carteEvents(null, b), [], "premier affichage : rien");
  assert.deepEqual(C.carteEvents(b, b), []);
});

test("construire ici : la nouvelle tâche prend la parcelle choisie (#470)", () => {
  const mem = { projects: { p: "0,0" }, tasks: { a: "1,0" } };
  const pending = { projectId: "p", key: "2,1", known: new Set(["a"]) };
  const tasks = [{ id: "a", projectId: "p" }, { id: "z", projectId: "q" }, { id: "b", projectId: "p" }];
  assert.deepEqual(C.carteClaimTile(mem, pending, tasks).claim, { id: "b", key: "2,1" });
  assert.equal(C.carteClaimTile(mem, null, tasks), mem);
  assert.equal(C.carteClaimTile(mem, pending, tasks.slice(0, 2)), mem, "rien de nouveau : mémoire inchangée");
  // La disposition respecte la parcelle réservée.
  const w = world(1, 3);
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  const l0 = C.carteBuild({ projects: n.projects, tasks: n.tasks });
  const free = l0.territories[0].tiles.find((k) => !l0.occupancy[k] && !l0.tiles[k].road && !l0.tiles[k].lava && l0.tiles[k].kind !== "hub");
  const known = new Set(n.tasks.map((t) => t.id));
  const n2 = C.carteNormalize(w.ctx, w.tasks.concat([{ id: "nouvelle", projectId: "p0", statusId: "s1" }]), { now: NOW });
  const mem2 = C.carteClaimTile(l0.memory, { projectId: "p0", key: free, known }, n2.tasks);
  const l1 = C.carteBuild({ projects: n2.projects, tasks: n2.tasks, memory: mem2 });
  assert.equal(l1.pois.find((p) => p.taskId === "nouvelle").key, free);
  // Parcelle déjà occupée par une tâche (masquée par les filtres) : la
  // nouvelle la partage, l'ancienne ne bouge pas.
  const busy = l0.pois[0];
  const mem3 = C.carteClaimTile(l0.memory, { projectId: "p0", key: busy.key, known }, n2.tasks);
  const l3 = C.carteBuild({ projects: n2.projects, tasks: n2.tasks, memory: mem3 });
  assert.equal(l3.pois.find((p) => p.taskId === "nouvelle").key, busy.key);
  assert.equal(l3.pois.find((p) => p.taskId === busy.taskId).key, busy.key);
});

test("zoom stratégique et vues enregistrées (#476, #481)", () => {
  // Seuil repoussé (#507) : rien avant 120, plan pur à 150 et au-delà.
  assert.deepEqual([19, 80, 95, 120, 135, 150, 190].map(C.carteStrategicAlpha), [0, 0, 0, 0, 0.5, 1, 1]);
  assert.ok(C.CARTE_DIST_MAX > 150, "le recul maximal laisse une plage de plan pur");
  assert.equal(C.carteNormalizeViews([{ name: "loin", dist: 999 }])[0].dist, C.CARTE_DIST_MAX);
  const v = C.carteNormalizeViews([{ name: " Nord ", x: 3, z: 4, yaw: 1, pitch: 9, dist: 2 }, { name: "" }, null, "x"]);
  assert.deepEqual(v, [{ name: "Nord", x: 3, z: 4, yaw: 1, pitch: 1.5, dist: 7 }]);
  assert.equal(C.carteNormalizeViews(Array.from({ length: 20 }, (_, i) => ({ name: "v" + i }))).length, C.CARTE_VIEWS_MAX);
  const p = C.normalizeCarteViewPrefs({});
  assert.equal(p.fog, true); assert.equal(p.minimap, true); assert.equal(p.miniature, true); assert.equal(p.life, true); assert.equal(p.plan, false);
  assert.deepEqual(p.views, []);
  assert.equal(C.normalizeCarteViewPrefs({ fog: false, plan: true }).fog, false);
  assert.equal(C.normalizeCarteViewPrefs({ fog: false, plan: true }).plan, true);
});

test("#488 : totem thématique par dossier, sommet à la hauteur demandée, couleur du projet", () => {
  for (const th of C.CARTE_THEMES) {
    for (const h of [0.6, 2.4, 6.5]) {
      const c = C.carteTotemColumn(h, "#e07a3f", "#9a9488", th.id);
      assert.equal(c.h, h, th.id);
      const top = Math.max(...c.parts.map((p) => p.p[1] + p.s[1]));
      assert.ok(Math.abs(top - h) < 1e-6, `${th.id} h=${h} : sommet ${top}`);
      assert.ok(c.parts.some((p) => p.c === "#e07a3f"), `${th.id} : couleur du projet`);
      c.parts.forEach((p) => { assert.ok(["box", "cyl", "hex", "cone", "pyr", "ball", "dome"].includes(p.g)); [...p.p, ...p.s].forEach((v) => assert.ok(Number.isFinite(v))); });
    }
    // La couronne s'enrichit avec les paliers.
    assert.ok(C.carteHubModel(th.id, 5, "#123456", "normal").length > C.carteHubModel(th.id, 0, "#123456", "normal").length, th.id);
  }
  // Deux thèmes différents, deux silhouettes différentes.
  const sig = (id) => C.carteTotemColumn(3, "#123456", "#999999", id).parts.map((p) => p.g).join();
  assert.notEqual(sig("hautemontagne"), sig("foret"));
});

test("#489 : roue d'action personnalisable, huit actions au plus, dans l'ordre choisi", () => {
  assert.deepEqual(C.normalizeCarteViewPrefs({}).wheel, C.CARTE_WHEEL_DEFAULT);
  assert.deepEqual(C.carteNormalizeWheel(["criticality", "inconnue", "dates", "criticality"]), ["criticality", "dates"]);
  assert.deepEqual(C.carteNormalizeWheel([]), C.CARTE_WHEEL_DEFAULT, "roue vide : retour au choix par défaut");
  assert.equal(C.carteNormalizeWheel(C.CARTE_WHEEL_ACTIONS.map((a) => a.id)).length, C.CARTE_WHEEL_MAX);
  assert.ok(C.CARTE_WHEEL_ACTIONS.length >= 12, "catalogue plus large que la roue");
  assert.deepEqual(C.carteDueTodayPatch({ start: "2026-09-10", end: "2026-09-30" }, NOW), { start: "2026-09-10", end: "2026-09-24" });
  assert.deepEqual(C.carteDueTodayPatch({ start: "2026-10-10", end: "2026-10-30" }, NOW), { start: "2026-09-24", end: "2026-09-24" });
  assert.deepEqual(C.carteDueTodayPatch({}, NOW), { start: "2026-09-24", end: "2026-09-24" });
});

test("#491 : écartement des dossiers et densité des tâches", () => {
  const w = world(10, 120);
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  const layout = (o) => C.carteBuild({ projects: n.projects, tasks: n.tasks, ...o });
  // Réglages par défaut : disposition historique, octet pour octet.
  assert.deepEqual(JSON.stringify(layout({ expansion: 1, density: 3 })), JSON.stringify(layout({})));
  // Écartement : distance minimale (en cases) entre deux dossiers différents.
  const minGap = (l) => {
    let m = Infinity;
    l.territories.forEach((a) => l.territories.forEach((b) => {
      const ga = l.projectById[a.projectId].group, gb = l.projectById[b.projectId].group;
      if (a === b || (ga && ga === gb)) return;
      m = Math.min(m, C.carteDist(a.slot[0], a.slot[1], b.slot[0], b.slot[1]));
    }));
    return m;
  };
  assert.ok(minGap(layout({ expansion: 0 })) <= minGap(layout({ expansion: 1 })));
  assert.ok(minGap(layout({ expansion: 3 })) >= 4, "îles lointaines : au moins trois cases de mer entre deux dossiers");
  // Densité : rayon des territoires et tâches groupées autour du cœur.
  assert.equal(C.carteInnerRadius(20, 3), 3);
  assert.ok(C.carteInnerRadius(10, 5) < 3, "dense : territoire resserré");
  assert.ok(C.carteInnerRadius(60, 1) > 3, "clairsemé : territoire plus vaste");
  const ringMean = (l) => { let s = 0, k = 0; l.pois.forEach((p) => { s += l.tiles[p.key].ring; k++; }); return s / k; };
  const dense = layout({ density: 5 }), sparse = layout({ density: 1 });
  assert.ok(ringMean(dense) < ringMean(sparse), "les tâches sont plus proches du cœur en densité forte");
  assert.ok(Object.values(sparse.tiles).filter((t) => t.inner).length > Object.values(dense.tiles).filter((t) => t.inner).length, "plus de cases d'habillage en densité faible");
  const p = C.normalizeCarteViewPrefs({});
  assert.equal(p.expansion, 1); assert.equal(p.density, 3);
  assert.equal(C.normalizeCarteViewPrefs({ expansion: 9, density: 0 }).expansion, 4);
  assert.equal(C.normalizeCarteViewPrefs({ expansion: 9, density: 0 }).density, 1);
});

test("#493 : déplacement de l'arpenteur en option, actif par défaut", () => {
  assert.equal(C.normalizeCarteViewPrefs({}).walk, true);
  assert.equal(C.normalizeCarteViewPrefs({ walk: false }).walk, false);
});

test("#494 : hologramme — onglets selon le contenu, texte en paragraphes", () => {
  assert.deepEqual(C.carteHoloTabs({ desc: "", report: " " }), []);
  assert.deepEqual(C.carteHoloTabs({ desc: "a", report: "" }).map((t) => t.id), ["desc"]);
  assert.deepEqual(C.carteHoloTabs({ desc: "a", report: "b" }).map((t) => t.id), ["desc", "report"]);
  // Remplacé par le rendu Markdown (#502) : un paragraphe, deux puces, un blanc.
  assert.deepEqual(C.carteHoloBlocks("Intro **gras**\n- point 1\n2) point 2\n\n\nFin").map((b) => b.type), ["p", "li", "li", "gap", "p"]);
  const n = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes }, [{ id: "x", projectId: "p", statusId: "s1", meetingReport: "CR" }], { now: NOW });
  assert.equal(n.tasks[0].report, "CR");
  assert.equal(C.normalizeCarteViewPrefs({}).holo, true);
});

test("#496 : effets avancés actifs par défaut, lanterne de route lumineuse", () => {
  assert.equal(C.normalizeCarteViewPrefs({}).fx, true);
  assert.equal(C.normalizeCarteViewPrefs(null).fx, true);
  assert.equal(C.normalizeCarteViewPrefs({ fx: false }).fx, false);
  assert.equal(C.normalizeCarteViewPrefs({ fx: 0 }).fx, true);
  // La lanterne porte une pièce lumineuse (bloom) au-dessus du poteau.
  const glow = C.CARTE_ROAD_LANTERN.filter((p) => p.m === "g");
  assert.equal(glow.length, 1);
  assert.ok(glow[0].p[1] > 0.4);
});

test("#499 : immeubles Kenney — thèmes, stades, découpe à l'avancement", () => {
  const t = (o) => ({ id: "k1", kind: "task", state: "doing", progress: 40, ...o });
  assert.equal(C.carteKenneyBuilding(t(), "foret"), null);
  assert.equal(C.carteKenneyBuilding(t({ kind: "meeting" }), "ville"), null);
  assert.equal(C.carteKenneyBuilding(t({ state: "info" }), "ville"), null);
  assert.equal(C.carteKenneyBuilding(t({ state: "todo", progress: 0 }), "ville"), null);
  const doing = C.carteKenneyBuilding(t(), "ville");
  assert.ok(C.CARTE_KENNEY_HOUSES.includes(doing.name));
  assert.equal(doing.built, 0.4);
  // Même tâche, même immeuble ; un chantier à peine commencé garde un socle.
  assert.equal(C.carteKenneyBuilding(t(), "campagne").name, doing.name);
  assert.equal(C.carteKenneyBuilding(t({ progress: 0, state: "todo" }), "ville"), null);
  assert.equal(C.carteKenneyBuilding(t({ progress: 2 }), "ville").built, 0.08);
  assert.equal(C.carteKenneyBuilding(t({ state: "done", progress: 10 }), "ville").built, 1);
});

test("#499 : sans corps, le modèle d'une tâche garde ses indices (échafaudage)", () => {
  const task = { id: "b1", kind: "task", state: "doing", progress: 50, statusColor: "#0EA5E9", checklistTotal: 0, checklistDone: 0 };
  const full = C.carteTaskModel(task, "ville", {});
  const bare = C.carteTaskModel(task, "ville", { body: false });
  assert.ok(bare.length < full.length);
  assert.ok(bare.some((p) => p.g === "cyl" && p.c === "#c9a060"), "l'échafaudage reste");
  const done = C.carteTaskModel({ ...task, state: "done" }, "ville", { body: false });
  // Plus aucune pièce haute : seules la dalle et les indices au sol restent.
  assert.ok(done.every((p) => p.p[1] + p.s[1] < 1.2));
});

test("#499 : recoloration de la planche Kenney vers la palette diorama", () => {
  // Bleu vif -> terre cuite / ocre (teinte chaude), saturation bornée.
  const [h, s, l] = C.carteRegradeHsl(0.6, 0.8, 0.5);
  assert.ok(h >= 0.03 && h <= 0.11);
  assert.ok(s <= 0.62);
  assert.ok(l <= 0.72 && l > 0.5);
  // Gris : pointe de chaleur, luminosité conservée.
  assert.deepEqual(C.carteRegradeHsl(0.5, 0.05, 0.4), [0.08, 0.12, 0.4]);
  // Rouges et oranges : inchangés.
  assert.deepEqual(C.carteRegradeHsl(0.05, 0.7, 0.5), [0.05, 0.7, 0.5]);
});

test("clic droit : parcelle constructible et parcelle libre la plus proche (#503)", () => {
  const w = world(2, 6, { perProject: 1 });
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  const L = C.carteBuild({ projects: n.projects, tasks: n.tasks });
  const occupied = {};
  L.pois.forEach((p) => { (occupied[p.key] = occupied[p.key] || []).push(p.taskId); });
  const terr = L.territories.find((t) => t.projectId === "p0");
  const busyKey = L.pois.find((p) => L.tiles[p.key].projectId === "p0").key;
  // Case occupée : pas constructible, mais la plus proche libre est proposée.
  assert.equal(C.carteBuildable(L, busyKey, occupied), null);
  const near = C.carteNearestBuildable(L, busyKey, occupied);
  assert.ok(near && near.projectId === "p0" && near.key !== busyKey);
  assert.ok(C.carteBuildable(L, near.key, occupied));
  // Case libre : proposée telle quelle.
  assert.deepEqual(C.carteNearestBuildable(L, near.key, occupied), near);
  // Cœur du projet (hub) ou totem : une parcelle libre du même territoire.
  const hubKey = Object.keys(L.tiles).find((k) => L.tiles[k].kind === "hub" && L.tiles[k].projectId === "p0");
  assert.equal(C.carteBuildable(L, hubKey, occupied), null);
  const fromHub = C.carteNearestBuildable(L, hubKey, occupied);
  assert.equal(fromHub.projectId, "p0");
  assert.equal(C.carteDist(L.tiles[fromHub.key].q, L.tiles[fromHub.key].r, terr.q, terr.r), 1);
  assert.equal(C.carteNearestBuildable(L, null, occupied, "p0").projectId, "p0");
  // Déterministe.
  assert.deepEqual(C.carteNearestBuildable(L, hubKey, occupied), fromHub);
  // Hors territoire ou territoire plein : rien.
  const sea = Object.keys(L.tiles).find((k) => !L.tiles[k].projectId);
  if (sea) assert.equal(C.carteNearestBuildable(L, sea, occupied), null);
  const full = {};
  terr.tiles.forEach((k) => { full[k] = ["x"]; });
  assert.equal(C.carteNearestBuildable(L, hubKey, full), null);
  // Une liste vide n'occupe pas la case (tâches filtrées).
  assert.ok(C.carteBuildable(L, near.key, { [near.key]: [] }));
});

test("filtres rapides multi-sélection : normalisation et compatibilité (#506)", () => {
  // Ancienne valeur unique reprise.
  assert.deepEqual(C.normalizeCarteViewPrefs({ crit: "urgent" }).crits, ["urgent"]);
  assert.deepEqual(C.normalizeCarteViewPrefs({ crit: "all" }).crits, []);
  assert.deepEqual(C.normalizeCarteViewPrefs({}).crits, []);
  // La liste nouvelle l'emporte sur l'ancienne valeur restée dans l'objet.
  assert.deepEqual(C.normalizeCarteViewPrefs({ crit: "urgent", crits: [] }).crits, []);
  assert.deepEqual(C.normalizeCarteViewPrefs({ crits: ["bas", "urgent", "bas", "nope", 3, C.CARTE_NONE] }).crits, ["bas", "urgent", C.CARTE_NONE]);
  const p = C.normalizeCarteViewPrefs({ statuses: ["s1", "s1", "", null, "s3"], assignees: "Alice" });
  assert.deepEqual(p.statuses, ["s1", "s3"]);
  assert.deepEqual(p.assignees, []);
  assert.equal(C.normalizeCarteViewPrefs({ statuses: Array.from({ length: 500 }, (_, i) => "s" + i) }).statuses.length, 200);
  // Stable : normaliser deux fois ne change rien.
  const q = C.normalizeCarteViewPrefs({ crit: "moyen", statuses: ["s2"], assignees: ["Bob"] });
  assert.deepEqual(C.normalizeCarteViewPrefs(q), q);
  assert.equal(C.carteViewFilterCount(q), 3);
  assert.equal(C.carteViewFilterCount(C.normalizeCarteViewPrefs({ ...q, ...C.carteViewFilterReset() })), 0);
});

test("filtres rapides multi-sélection : filtrage et options (#506)", () => {
  const t = (criticality, statusId, assignee) => ({ criticality, statusId, assignee, oldDone: false });
  const a = t("urgent", "s1", "Alice"), b = t("bas", "s3", "Bob"), c = t(null, "s3", null);
  const f = (x) => [a, b, c].filter((k) => C.carteMatches(k, C.normalizeCarteViewPrefs(x)));
  assert.deepEqual(f({}), [a, b, c]);
  assert.deepEqual(f({ crits: ["urgent", "bas"] }), [a, b], "plusieurs criticités : OU");
  assert.deepEqual(f({ crits: [C.CARTE_NONE] }), [c], "« Sans criticité »");
  assert.deepEqual(f({ statuses: ["s3"] }), [b, c]);
  assert.deepEqual(f({ assignees: ["Alice", C.CARTE_NONE] }), [a, c], "« Sans responsable »");
  assert.deepEqual(f({ statuses: ["s3"], assignees: ["Bob"] }), [b], "entre filtres : ET");
  assert.deepEqual(f({ crit: "urgent" }), [a], "ancienne valeur unique toujours comprise");
  // Cosmos et Timeline 3D gardent la criticité unique : carteMatches la lit.
  assert.equal(C.carteMatches(b, { crit: "urgent" }), false);
  const statuses = [{ id: "s1", name: "À planifier", color: "#64748B" }, { id: "s2", name: "Attente" }, { id: "s3", name: "En cours", color: "#0EA5E9" }];
  const o = C.carteQuickOptions([a, b, c, { ...b, assigneeColor: "#f00" }], statuses, { statuses: ["s2"], assignees: ["Zoé"] });
  assert.deepEqual(o.statuses.map((x) => [x.id, x.count]), [["s1", 1], ["s2", 0], ["s3", 3]], "ordre de Nexora ; valeur retenue gardée");
  assert.deepEqual(o.assignees.map((x) => [x.id, x.count]), [["Alice", 1], ["Bob", 2], ["Zoé", 0], [C.CARTE_NONE, 1]]);
  assert.equal(o.assignees.find((x) => x.id === "Bob").color, "#f00");
  assert.deepEqual(o.crits.map((x) => x.count), [1, 0, 2, 1]);
});

test("pastille de dossier : point d'arrivée au centre du dossier (#504)", () => {
  const w = world(12, 30);
  const n = C.carteNormalize(w.ctx, w.tasks, { now: NOW });
  const L = C.carteBuild({ projects: n.projects, tasks: n.tasks });
  const occupied = {};
  L.pois.forEach((p) => { (occupied[p.key] = occupied[p.key] || []).push(p.taskId); });
  const ids = n.projects.filter((p) => p.folderId === "f0").map((p) => p.id);
  assert.ok(ids.length >= 2);
  const a = C.carteGroupAnchor(L, ids, occupied);
  assert.ok(a && ids.includes(a.projectId), "le point est dans un territoire du dossier");
  const t = L.tiles[a.key];
  assert.ok(t.inner && t.kind !== "water" && !t.lava, "case intérieure praticable");
  assert.ok(!occupied[a.key], "une case libre l'emporte");
  assert.ok(a.radius > 0);
  // Le plus proche du centre des territoires du dossier.
  const terrs = L.territories.filter((x) => ids.includes(x.projectId));
  const cx = terrs.reduce((s2, x) => s2 + C.carteToWorld(x.q, x.r).x, 0) / terrs.length;
  const cz = terrs.reduce((s2, x) => s2 + C.carteToWorld(x.q, x.r).z, 0) / terrs.length;
  const d = Math.hypot(a.x - cx, a.z - cz);
  terrs.forEach((tr) => tr.tiles.forEach((k) => { const u = L.tiles[k]; if (u.kind === "water" || u.lava || occupied[k]) return; const p = C.carteToWorld(u.q, u.r); assert.ok(Math.hypot(p.x - cx, p.z - cz) >= d - 1e-9); }));
  assert.deepEqual(C.carteGroupAnchor(L, ids, occupied), a, "déterministe");
  // Un seul projet : son territoire ; aucun projet connu : rien.
  assert.equal(C.carteGroupAnchor(L, [ids[0]], occupied).projectId, ids[0]);
  assert.equal(C.carteGroupAnchor(L, ["inconnu"], occupied), null);
  assert.equal(C.carteGroupAnchor(null, ids), null);
});

test("téléportation magique : chronologie et préférence (#505)", () => {
  assert.ok(C.CARTE_TP_DUR >= 0.6 && C.CARTE_TP_DUR <= 0.9, "courte : 0,6 à 0,9 s");
  const p0 = C.carteTeleportPhase(0);
  assert.equal(p0.side, "from"); assert.equal(p0.keeper.sx, 1); assert.equal(p0.keeper.visible, true); assert.equal(p0.done, false);
  const mid = C.carteTeleportPhase(C.CARTE_TP_SWAP - 0.01);
  assert.equal(mid.side, "from"); assert.ok(mid.keeper.sx < 0.2 && mid.keeper.sy > 1.5, "dissous et étiré avant le saut"); assert.equal(mid.keeper.visible, false);
  assert.ok(mid.a.alpha > 0 && mid.b.alpha > 0, "les deux cercles se chevauchent au moment du saut");
  const after = C.carteTeleportPhase(C.CARTE_TP_SWAP + 0.01);
  assert.equal(after.side, "to");
  const end = C.carteTeleportPhase(C.CARTE_TP_DUR);
  assert.equal(end.done, true); assert.deepEqual([end.keeper.sx, end.keeper.sy, end.keeper.visible], [1, 1, true]);
  assert.equal(end.a.alpha, 0); assert.equal(end.b.alpha, 0);
  for (let t = 0; t <= 1; t += 0.02) {
    const p = C.carteTeleportPhase(t);
    [p.a.alpha, p.b.alpha].forEach((v) => assert.ok(v >= 0 && v <= 1));
    assert.ok(p.keeper.sx > 0 && p.keeper.sx <= 1 && p.keeper.sy >= 1 && p.keeper.sy <= 1.71);
  }
  assert.equal(C.normalizeCarteViewPrefs({}).teleport, false, "désactivée par défaut");
  assert.equal(C.normalizeCarteViewPrefs({ teleport: true }).teleport, true);
  assert.equal(C.normalizeCarteViewPrefs({ teleport: "oui" }).teleport, false);
});

test("hologramme en Markdown : segments stylés (#502)", () => {
  assert.deepEqual(C.carteHoloInline("a **gras** et *ital* `code` ~~barré~~ [lien](https://x.fr) fin"), [
    { t: "a " }, { t: "gras", b: true }, { t: " et " }, { t: "ital", i: true }, { t: " " }, { t: "code", code: true }, { t: " " }, { t: "barré", s: true }, { t: " lien fin" },
  ]);
  assert.deepEqual(C.carteHoloInline("**gras _et ital_**"), [{ t: "gras ", b: true }, { t: "et ital", b: true, i: true }]);
  assert.deepEqual(C.carteHoloInline("nom_de_fichier reste tel quel"), [{ t: "nom_de_fichier reste tel quel" }], "un tiret bas dans un mot n'est pas de l'italique");
  assert.deepEqual(C.carteHoloInline("`**pas gras**`"), [{ t: "**pas gras**", code: true }]);
  assert.deepEqual(C.carteHoloInline(""), []);
});

test("hologramme en Markdown : blocs, cases, citations et call-outs (#502)", () => {
  const T = { note: {}, info: {}, tip: {}, warning: {}, danger: {} };
  const b = C.carteHoloBlocks([
    "# Titre", "## Sous-titre", "Texte **gras**", "", "", "- puce", "  - sous-puce", "1. un", "- [ ] à faire", "- [x] fait",
    "> citation", "> suite", "", "> [!WARNING] Attention **forte**", "> - point", "> texte", "", "> [!inconnu]", "> corps",
    ":::callout-tip Astuce", "contenu", ":::", "---", "| A | B |", "|---|:-:|", "| 1 | 2 |",
  ].join("\n"), T);
  assert.deepEqual(b.map((x) => x.type), ["h", "h", "p", "gap", "li", "li", "li", "task", "task", "quote", "gap", "callout", "gap", "callout", "callout", "hr", "row", "row"]);
  assert.deepEqual([b[0].level, b[1].level], [1, 2]);
  assert.deepEqual([b[4].depth, b[5].depth, b[6].n], [0, 1, 1]);
  assert.deepEqual([b[7].done, b[8].done], [false, true]);
  assert.equal(b[9].children.length, 2, "citation sur deux lignes");
  assert.equal(b[11].kind, "warning");
  assert.deepEqual(b[11].title, [{ t: "Attention " }, { t: "forte", b: true }]);
  assert.deepEqual(b[11].children.map((x) => x.type), ["li", "p"]);
  assert.equal(b[13].kind, "note", "type inconnu : note, comme dans le reste de l'app");
  assert.deepEqual(b[13].title, []);
  assert.equal(b[14].kind, "tip");
  assert.deepEqual(b[14].children.map((x) => x.runs[0].t), ["contenu"]);
  assert.deepEqual(b[16].runs.map((r) => r.t).join(""), "A  ·  B");
  // Sans table fournie, les cinq types de l'app restent reconnus.
  assert.equal(C.carteHoloBlocks("> [!danger] x")[0].kind, "danger");
  assert.deepEqual(C.carteHoloBlocks(""), []);
  assert.deepEqual(C.carteHoloBlocks("\n\nA\n\n").map((x) => x.type), ["p"], "pas de blanc en tête ni en fin");
});

test("figurine des responsables : socle à la couleur, repli procédural (#501)", () => {
  const base = C.carteNormalize({ projects: [{ id: "p" }], statuses, taskTypes, teamMembers: [{ name: "Léo", color: "#123456" }] }, [{ id: "x", projectId: "p", statusId: "s3", assignee: "Léo" }], { now: NOW }).tasks[0];
  const withFig = C.carteTaskModel(base, "ville", { detail: 2, figure: false });
  const proc = C.carteTaskModel(base, "ville", { detail: 2 });
  // Avec la figurine Kenney : seul le socle reste, bas, à la couleur de la personne.
  const socle = withFig.filter((p) => p.p[0] < -0.3 && (p.c === "#123456" || p.p[1] < 0.2));
  assert.ok(withFig.some((p) => p.c === "#123456"), "repère de couleur conservé");
  assert.ok(Math.max(...withFig.filter((p) => p.c === "#123456").map((p) => p.p[1] + p.s[1])) <= C.CARTE_FIGURINE_BASE + 1e-9, "socle bas, sous la figurine");
  assert.ok(socle.length >= 2, "disque et liseré");
  assert.ok(withFig.length < proc.length, "le bonhomme procédural n'est pas dessiné en double");
  // Repli : sans figurine (modèles indisponibles), le bonhomme procédural.
  assert.ok(Math.max(...proc.filter((p) => p.p[0] < -0.3).map((p) => p.p[1] + p.s[1])) >= 0.85);
  // Masqué sur demande dans les deux cas.
  assert.ok(!C.carteTaskModel(base, "ville", { detail: 2, figure: false, people: false }).some((p) => p.c === "#123456"));
  // Socle centré sous l'ancre du badge d'initiales.
  const disc = C.cartePersonSocle("#abcdef", 1);
  assert.ok(disc.every((p) => Math.abs(p.p[0] - C.CARTE_AVATAR_ANCHOR[0]) < 1e-9 && Math.abs(p.p[2] - C.CARTE_AVATAR_ANCHOR[2]) < 1e-9));
  // Teinte partielle : plus claire que la couleur, jamais blanche.
  assert.match(C.carteFigurineTint("#123456"), /^#[0-9a-f]{6}$/i);
  assert.notEqual(C.carteFigurineTint("#123456").toLowerCase(), "#ffffff");
  assert.notEqual(C.carteFigurineTint("#123456").toLowerCase(), "#123456");
});

test("drapeaux des totems : forme et pommeau pour chaque thème (#508)", () => {
  const seen = new Set();
  C.CARTE_THEMES.forEach((th) => {
    const f = C.carteFlagStyle(th.id);
    assert.ok(["rect", "swallowtail", "pennant"].includes(f.shape), `${th.id} : forme ${f.shape}`);
    assert.equal(f.code, { rect: 0, swallowtail: 1, pennant: 2 }[f.shape]);
    assert.match(f.finial, /^#[0-9a-f]{6}$/i);
    seen.add(f.shape);
  });
  assert.equal(seen.size, 3, "les trois formes servent");
  assert.equal(C.carteFlagStyle("foret").shape, "swallowtail", "bannière à queue d'aronde en forêt");
  assert.equal(C.carteFlagStyle("mer").shape, "pennant");
  assert.equal(C.carteFlagStyle("cyberpunk").finial, "#3ef0ff");
  assert.deepEqual(C.carteFlagStyle("inconnu"), { shape: "rect", code: 0, finial: "#d9b23a" }, "repli");
});

test("fléaux des tâches critiques selon le thème, orage en repli (#509)", () => {
  const kinds = new Set();
  C.CARTE_THEMES.forEach((th) => {
    const f = C.carteCriticalFx(th.id);
    assert.ok(C.CARTE_CRITICAL_FX_KINDS[f.id], `${th.id} : effet ${f.id} inconnu`);
    assert.ok(f.label && f.legend, `${th.id} : libellés`);
    assert.match(f.a, /^#[0-9a-f]{6}$/i); assert.match(f.b, /^#[0-9a-f]{6}$/i);
    kinds.add(f.id);
    // La légende du thème annonce son fléau.
    assert.ok(C.carteLook(th.id).sig.some((l) => l[1].includes(f.legend)), `${th.id} : légende`);
  });
  assert.equal(kinds.size, 8, "les huit effets servent");
  assert.deepEqual(
    ["grandnord", "desert", "volcan", "foret", "mer", "ile", "cyberpunk", "campagne", "marais"].map((id) => C.carteCriticalFx(id).id),
    ["blizzard", "sandstorm", "lava", "leaves", "whirlpool", "whirlpool", "glitch", "storm", "miasma"],
  );
  assert.equal(C.carteCriticalFx("inconnu").id, "storm", "l'éclair reste le repli");
  assert.equal(C.carteCriticalFx(undefined).id, "storm");
  // Codes du shader uniques, de 0 à 7 ; l'orage n'a pas de particules (il garde son rendu).
  const codes = Object.values(C.CARTE_CRITICAL_FX_KINDS).map((k) => k.kind).sort();
  assert.deepEqual(codes, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(C.CARTE_CRITICAL_FX_KINDS.storm.count, 0);
  Object.values(C.CARTE_CRITICAL_FX_KINDS).forEach((k) => assert.ok(k.count <= 80, "léger : 80 particules au plus par tâche"));
});
