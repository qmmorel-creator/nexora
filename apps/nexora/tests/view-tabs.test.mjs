/* Barre d'onglets = Réglages > Vues affichées : vues cochées, dans l'ordre
   choisi. La tranche testée vient du bundle réellement construit. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const start = "// === NEXORA:VIEW-TABS:START ===";
const end = "// === NEXORA:VIEW-TABS:END ===";
assert.ok(html.includes(start) && html.includes(end), "bloc VIEW-TABS introuvable");
const code = html.slice(html.indexOf(start) + start.length, html.indexOf(end));

const META = ["dashboard", "projects", "gantt", "heatmap", "timeline", "radar", "today", "calendar", "table", "quotes"].map((key) => ({ key }));
const tabBarViewKeysFor = vm.runInNewContext(`${code}\n;tabBarViewKeysFor`, { ALL_VIEWS_META: META });

test("toutes les vues cochées apparaissent, pas seulement les vues projet", () => {
  const keys = tabBarViewKeysFor(null, {});
  assert.ok(keys.includes("calendar") && keys.includes("quotes") && keys.includes("today"));
  assert.equal(keys.includes("dashboard"), false, "le tableau de bord garde son bouton dédié");
});

test("l'ordre choisi est respecté, les vues ajoutées depuis viennent à la suite", () => {
  const keys = tabBarViewKeysFor(["calendar", "gantt", "projects"], {});
  assert.deepEqual([...keys.slice(0, 3)], ["calendar", "gantt", "projects"]);
  assert.equal(keys.length, META.length - 1);
});

test("une vue décochée ou inconnue n'apparaît pas", () => {
  const keys = tabBarViewKeysFor(["timeline", "ancienneVue", "radar", "radar"], { timeline: false });
  assert.equal(keys.includes("timeline"), false);
  assert.equal(keys.includes("ancienneVue"), false);
  assert.equal(keys.filter((k) => k === "radar").length, 1);
});

test("la barre d'onglets est branchée sur cette liste", () => {
  assert.match(html, /\{tabBarViewKeys\.map\(\(k\) => \{/);
  assert.doesNotMatch(html, /PROJECT_TAB_VIEW_KEYS\.filter\(\(k\) => enabledViews\[k\] !== false\)\.map/);
});

test("les vues de tâches suivent le projet / dossier sélectionné", () => {
  for (const view of ["calendar"]) {
    assert.match(html, new RegExp(`view === "${view}" && <[A-Za-z]+View tasks=\\{filteredTasks\\}`), view);
  }
  assert.match(html, /applyWidgetFilter\(boardTasks, \{ projectIds: activeProjectIdsForScope \}, ctx\)/, "Aujourd'hui");
  assert.match(html, /const PROJECT_SCOPED_VIEW_KEYS = \[\.\.\.PROJECT_TAB_VIEW_KEYS, "today", "calendar"\];/);
  assert.match(html, /cfg\.view \|\| \(PROJECT_SCOPED_VIEW_KEYS\.includes\(view\) \? view : "projects"\)/, "la vue en cours est conservée");
});
