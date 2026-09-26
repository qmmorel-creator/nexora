/* Mode focus (#512) : champ booléen `focus` de la tâche et son critère dans
   tous les systèmes de filtres (filtre global et méta-filtres, filtres
   avancés, filtres de widgets et de pages, filtres rapides Carte / Cosmos /
   Timeline 3D, vues enregistrées). Les fonctions sont extraites du bundle
   RÉELLEMENT construit (.build/index.html), jamais recopiées. */

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

// Une fonction nommée du bundle, jusqu'à son accolade fermante (les fonctions
// extraites ici ne contiennent ni chaîne ni regex à accolade).
function fn(name) {
  const head = `function ${name}(`;
  const from = html.indexOf(head);
  assert.ok(from !== -1, `fonction ${name} introuvable dans .build/index.html`);
  let i = html.indexOf("{", html.indexOf(")", from)), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}" && --depth === 0) break;
  }
  return html.slice(from, i + 1);
}

const F = vm.runInThisContext(`(function () {
  ${slice("TASK-FOCUS")}
  const NO_PROJECT_FILTER = "__nexora_without_project__";
  function assigneeFilterValue(t) { return (t && t.assignee) || ""; }
  function getTaskType(t) { return t && t.milestone ? "milestone" : "action"; }
  function isTaskLate() { return false; }
  function isTaskDoneGlobal(t) { return !!(t && t.done); }
  function isTaskUrgent() { return false; }
  function taskInteractionAgeDays() { return 0; }
  function matchesDatePreset() { return true; }
  function taskSearchHaystack(t) { return String(t.title || "").toLowerCase(); }
  function resolveProjectFilterIds(ids) { return ids; }
  function dayIndex() { return 0; }
  function iso() { return "2026-09-26"; }
  const defaultFilters = () => ({
    search: "", milestone: "all", focus: "all", progressMin: 0, progressMax: 100, startFrom: "", startTo: "", endFrom: "", endTo: "", lateOnly: false,
    dueWithinDays: "", pastDays: "", inactivityDays: "", quickDatePreset: "", showDone: true, urgentOnly: false, advanced: { op: "and", items: [] },
  });
  ${fn("matchSelectFilter")}
  ${fn("taskAdvancedFieldValue")}
  ${fn("evalFilterCondition")}
  ${fn("evalFilterGroup")}
  ${fn("countFilterGroup")}
  ${fn("matchTaskFilters")}
  ${fn("activeFilterCount")}
  ${fn("widgetDefaultFilter")}
  ${fn("activeWidgetFilterCount")}
  ${fn("applyWidgetFilter")}
  return { isTaskFocus, normalizeFocusFilter, matchFocusFilter, evalFilterGroup, matchTaskFilters, activeFilterCount,
    widgetDefaultFilter, activeWidgetFilterCount, applyWidgetFilter, defaultFilters };
})`)();

const C = vm.runInThisContext(
  `(function () {\n${slice("CARTE")}\n${slice("COSMOS")}\n${slice("TIMELINE3D")}\n;return { carteNormalize, carteMatches, normalizeCarteViewPrefs, normalizeCosmosViewPrefs, normalizeTimeline3dViewPrefs,
    carteViewFilterCount, carteViewFilterReset, carteFocusCount, CARTE_WHEEL_ACTIONS };\n})`
)();

const tasks = [
  { id: "a", title: "Dossier A", progress: 0, focus: true },
  { id: "b", title: "Dossier B", progress: 0, focus: false },
  { id: "c", title: "Dossier C", progress: 0 },
  { id: "d", title: "Dossier D", progress: 0, focus: "true" },
];
const ids = (list) => list.map((t) => t.id);

test("#512 : seul `true` met une tâche en focus ; absent vaut false", () => {
  assert.deepEqual(ids(tasks.filter(F.isTaskFocus)), ["a"]);
  assert.equal(F.isTaskFocus(null), false);
  assert.equal(F.isTaskFocus(undefined), false);
});

test("#512 : filtre global tri-état, neutre par défaut et pour un filtre enregistré avant ce champ", () => {
  const f = F.defaultFilters();
  assert.equal(f.focus, "all");
  const run = (patch) => ids(tasks.filter((t) => F.matchTaskFilters(t, { ...f, ...patch }, {})));
  assert.deepEqual(run({}), ["a", "b", "c", "d"]);
  assert.deepEqual(run({ focus: "yes" }), ["a"]);
  assert.deepEqual(run({ focus: "no" }), ["b", "c", "d"]);
  // Filtre enregistré avant #512 : pas de clé, ou une valeur inconnue.
  const legacy = { ...f }; delete legacy.focus;
  assert.deepEqual(ids(tasks.filter((t) => F.matchTaskFilters(t, legacy, {}))), ["a", "b", "c", "d"]);
  assert.deepEqual(run({ focus: "n'importe quoi" }), ["a", "b", "c", "d"]);
  assert.equal(F.normalizeFocusFilter(undefined), "all");
});

test("#512 : le compteur de filtres actifs compte le mode focus", () => {
  const f = F.defaultFilters();
  assert.equal(F.activeFilterCount(f), 0);
  assert.equal(F.activeFilterCount({ ...f, focus: "yes" }), 1);
  assert.equal(F.activeFilterCount({ ...f, focus: "no" }), 1);
  const legacy = { ...f }; delete legacy.focus;
  assert.equal(F.activeFilterCount(legacy), 0);
});

test("#512 : critère « Mode focus » des filtres avancés, avec « N'est pas » et en groupe OU", () => {
  const cond = (mode, values) => ({ op: "and", items: [{ field: "focus", mode, values }] });
  assert.deepEqual(ids(tasks.filter((t) => F.evalFilterGroup(t, cond("is", ["yes"])))), ["a"]);
  assert.deepEqual(ids(tasks.filter((t) => F.evalFilterGroup(t, cond("is", ["no"])))), ["b", "c", "d"]);
  assert.deepEqual(ids(tasks.filter((t) => F.evalFilterGroup(t, cond("isnot", ["yes"])))), ["b", "c", "d"]);
  assert.deepEqual(ids(tasks.filter((t) => F.evalFilterGroup(t, cond("is", [])))), ["a", "b", "c", "d"], "liste vide = neutre");
  const or = { op: "or", items: [{ field: "focus", mode: "is", values: ["yes"] }, { field: "title", mode: "contains", textValue: "Dossier C" }] };
  assert.deepEqual(ids(tasks.filter((t) => F.evalFilterGroup(t, or))), ["a", "c"]);
});

test("#512 : filtres de widgets et de pages (onlyFocus), neutres par défaut", () => {
  assert.equal(F.widgetDefaultFilter().onlyFocus, false);
  assert.equal(F.activeWidgetFilterCount(F.widgetDefaultFilter()), 0);
  assert.equal(F.activeWidgetFilterCount({ onlyFocus: true }), 1);
  assert.deepEqual(ids(F.applyWidgetFilter(tasks, { onlyFocus: true }, {})), ["a"]);
  assert.deepEqual(ids(F.applyWidgetFilter(tasks, {}, {})), ["a", "b", "c", "d"], "filtre de widget antérieur : rien d'exclu");
  // Combiné au critère avancé : focus ET hors focus = rien.
  assert.deepEqual(ids(F.applyWidgetFilter(tasks, { onlyFocus: true, advanced: { op: "and", items: [{ field: "focus", mode: "is", values: ["no"] }] } }, {})), []);
});

test("#512 : la Carte lit le champ, et ses filtres rapides (Carte, Cosmos, Timeline 3D) le filtrent", () => {
  const ctx = { projects: [{ id: "p", name: "P" }], projectFolders: [], statuses: [], taskTypes: [], teamMembers: [] };
  const norm = C.carteNormalize(ctx, tasks.map((t) => ({ ...t, projectId: "p" })), { now: Date.parse("2026-09-26T10:00:00") });
  const byId = Object.fromEntries(norm.tasks.map((t) => [t.id, t]));
  assert.equal(byId.a.focus, true);
  assert.equal(byId.b.focus, false);
  assert.equal(byId.c.focus, false);
  assert.equal(byId.d.focus, false, "une chaîne n'est pas un booléen");
  assert.equal(C.carteFocusCount(norm.tasks), 1);
  for (const normalize of [C.normalizeCarteViewPrefs, C.normalizeCosmosViewPrefs, C.normalizeTimeline3dViewPrefs]) {
    assert.equal(normalize({}).focusOnly, false, "désactivé par défaut");
    const on = normalize({ focusOnly: true });
    assert.equal(on.focusOnly, true);
    assert.deepEqual(norm.tasks.filter((t) => C.carteMatches(t, on)).map((t) => t.id), ["a"]);
    assert.equal(norm.tasks.filter((t) => C.carteMatches(t, normalize({}))).length, 4);
  }
  assert.equal(C.carteViewFilterCount({ focusOnly: true }), 1);
  assert.equal(C.carteViewFilterCount({}), 0);
  assert.equal(C.carteViewFilterReset().focusOnly, false);
  assert.ok(C.CARTE_WHEEL_ACTIONS.some((a) => a.id === "focus"), "bascule dans la roue d'action");
});

test("#512 : le halo de la Carte, la fiche et les filtres sont bien câblés dans le bundle", () => {
  // Moteur : halo instancié, rafraîchi à chaque image, exposé au banc visuel.
  assert.match(html, /function buildFocus\(list, q\)/);
  assert.match(html, /placeFocus\(t\);/);
  assert.match(html, /focus: S\.focusFx \? S\.focusFx\.list\.length : 0/);
  assert.match(html, /MAT\.focusRing, selRingMat/, "les anneaux passent au bloom");
  // Interface : fiche tâche, barre d'outils, filtres rapides des vues 3D.
  for (const hook of ["data-task-focus-toggle", "data-focus-toolbar-toggle", "data-focus-widget-filter", "data-focus-filter", "data-focus-row-toggle", "data-carte-focus-toggle"]) {
    assert.ok(html.includes(hook), `repère ${hook} absent`);
  }
  for (const view of ["carte", "cosmos", "timeline3d"]) assert.ok(html.includes(`view: "${view}"`) || html.includes(`view="${view}"`), `filtre rapide focus absent de ${view}`);
});
