/* Widget « Graphique financier » et moteur OS360 (issue #573). */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const sha = (t) => createHash("sha256").update(t).digest("hex");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}
const W = vm.runInThisContext(`(function () {\n${slice("OS360-WIDGET")}\n;return { os360CatalogueGroups, os360WidgetSpec, os360MessageFrom, os360PeriodConfig, os360PeriodOnly, OS360_WIDGET_DEFAULT_TYPE };\n})`)();

test("moteur généré : intact, issu du générateur et de moteur.js tels que versionnés", async () => {
  const moteur = await read("../public/os360-moteur/index.html");
  const source = JSON.parse(await read("../public/os360-moteur/source.json"));
  const entree = await read("../../../outils/os360-moteur/moteur.js");
  assert.match(source.os360.commit, /^[0-9a-f]{40}$/);
  assert.equal(source.genere, sha(moteur), "index.html du moteur modifié à la main : relancer outils/os360-moteur/generer.mjs");
  assert.equal(source.moteur, sha(entree), "moteur.js a changé depuis la génération : relancer outils/os360-moteur/generer.mjs");
  assert.ok(moteur.includes(entree), "le point d'entrée du moteur est celui de moteur.js");
  assert.ok(moteur.startsWith(`<!-- Généré par outils/os360-moteur/generer.mjs depuis OS360 ${source.os360.commit}`));
});

test("moteur : montage OS360 remplacé, stockage en mémoire posé avant le module", async () => {
  const moteur = await read("../public/os360-moteur/index.html");
  assert.ok(!moteur.includes("(0,$9.jsx)(gCe,{})"), "l'application OS360 ne doit plus être montée");
  assert.match(moteur, /J\.jsx\(osSidebarSettings, \{ selected: nxMoteurWidgetId/, "réglages : panneau latéral d'OS360");
  assert.equal(moteur.split("(0,$9.jsx)(nxMoteur,{})").length - 1, 1);
  const shim = moteur.indexOf('Object.defineProperty(window, "localStorage"');
  assert.ok(shim > 0 && shim < moteur.indexOf('<script type="module"'), "le stockage en mémoire précède le module OS360");
  assert.equal(moteur.split('<script type="module"').length - 1, 1);
});

test("widget rattaché : catalogue, rendu, en-tête, iframe isolé SANS même origine", () => {
  assert.match(html, /key: "financeOs360Chart"/);
  assert.match(html, /w\.type === "financeOs360Chart" && \(\s*<WidgetOs360Chart widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "financeOs360Chart"/);
  const iframe = html.match(/<iframe ref=\{frameRef\}[^>]*>/)?.[0] || "";
  assert.match(iframe, /sandbox="allow-scripts"/);
  assert.doesNotMatch(iframe, /allow-same-origin/);
  assert.match(html, /fetch\("\/api\/nexora\/finance-budget-data"/);
});

test("catalogue groupé et trié, spécification par défaut, messages filtrés", () => {
  const groups = W.os360CatalogueGroups([
    { type: "b", label: "Zèbre", category: "Patrimoine" }, { type: "a", label: "Donut", category: "Répartitions" },
    { type: "c", label: "Actif", category: "Patrimoine" }, { type: "d", label: "Sans catégorie" },
  ]);
  assert.deepEqual(groups.map((g) => g.category), ["Autres", "Patrimoine", "Répartitions"]);
  assert.deepEqual(groups[1].items.map((i) => i.label), ["Actif", "Zèbre"]);
  assert.deepEqual(JSON.parse(JSON.stringify(W.os360WidgetSpec({}))), { type: W.OS360_WIDGET_DEFAULT_TYPE, title: "", config: {} });
  assert.equal(W.os360WidgetSpec({ os360: { type: "budget.chart_radar_monthly", config: { a: 1 } } }).config.a, 1);
  const frame = {};
  assert.ok(W.os360MessageFrom({ source: frame, data: { source: "nx-os360-moteur", type: "nx-ready" } }, frame));
  assert.equal(W.os360MessageFrom({ source: {}, data: { source: "nx-os360-moteur" } }, frame), null, "autre fenêtre ignorée");
  assert.equal(W.os360MessageFrom({ source: frame, data: { type: "nx-ready" } }, frame), null, "message non signé ignoré");
});

test("barre de période : écrit la configuration comme osPeriodBar d'OS360", () => {
  const before = { metric: "expense", range: 30, from: "2026-01-01", to: "2026-01-31", year: 2025, linked: true };
  assert.deepEqual(JSON.parse(JSON.stringify(W.os360PeriodConfig(before, "previous"))), { metric: "expense", linked: false, periodMode: "month", periodValue: "previous", quickPeriod: "previous" });
  assert.equal(W.os360PeriodConfig({}, "2026-09").quickPeriod, "");
  assert.equal(W.os360PeriodConfig({}, "2026-09").periodValue, "2026-09");
  // Changer de graphique garde la période, rien d'autre.
  assert.deepEqual(JSON.parse(JSON.stringify(W.os360PeriodOnly({ metric: "x", color: "#fff", quickPeriod: "previous", periodValue: "previous", periodMode: "month", linked: false }))), { linked: false, periodMode: "month", periodValue: "previous", quickPeriod: "previous" });
});

test("route : lecture seule des tables OS360, session du propriétaire", async () => {
  const source = await read("../netlify/functions/finance-budget-data.ts");
  assert.match(source, /path: "\/api\/nexora\/finance-budget-data", method: \["GET"\]/);
  assert.match(source, /await requireOwnerFinance\(req\)/);
  for (const t of ["finance_transactions_current", "finance_categories_current", "finance_subcategories_current", "finance_banks", "finance_accounts_current", "finance_account_types", "finance_category_budgets", "finance_account_balances"]) {
    assert.match(source, new RegExp(`table: "${t}"`));
  }
  assert.doesNotMatch(source, /method: "(POST|PATCH|PUT|DELETE)"|rpc\//);
});
