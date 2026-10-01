/* Mesures santé (#594).
   1. Parité du parseur serveur (_shared/health.ts) avec OS360 : cas figés
      dans fixtures/os360-parite-sante.json, produits par les fonctions
      d'origine d'OS360 (`qc`, `osHealthHeader`, `osHealthImportNumber`, `Kc`,
      `A`, `_e`, commit 13197da) avant le retrait du moteur (#597).
   2. Fonctions pures du widget, extraites du bundle RÉELLEMENT construit.
   3. Raccordements et route serveur. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// --- 1. Parité avec OS360 -------------------------------------------------

const ts = async (path) => {
  const compiled = await transform(await read(path), { loader: "ts", format: "esm" });
  return import("data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64"));
};
const N = await ts("../netlify/functions/_shared/health.ts");
const S = await ts("../netlify/functions/_shared/sport.ts");
const parity = JSON.parse(await read("./fixtures/os360-parite-sante.json"));

test("parité OS360 : mêmes mesures et mêmes refus que `qc`, sur les cas figés", () => {
  assert.ok(parity.cases.length >= 10);
  for (const c of parity.cases) {
    if (c.error) {
      assert.throws(() => N.healthRecords(S.sportCsvRows(c.csv)), (e) => e.message === c.error, c.name);
    } else {
      assert.deepEqual(N.healthRecords(S.sportCsvRows(c.csv)), c.records, c.name);
    }
  }
  assert.ok(parity.cases.find((c) => c.name === "valide").records.length > 100, "jeu conséquent");
});

test("colonnes et en-têtes : 26, dans l'ordre d'OS360", () => {
  assert.equal(N.HEALTH_COLUMNS.length, 26);
  assert.equal(N.HEALTH_HEADERS.length, 26);
  assert.equal(N.HEALTH_COLUMNS[0], "date");
  assert.equal(N.healthHeader("  Récupération   WHOOP (%) "), "recuperation whoop (%)");
  assert.equal(N.healthNumber("84,1%", "recovery", "2026-01-01", "R"), 84.1, "points de pourcentage, jamais 0,841");
  assert.equal(N.healthNumber("—", "steps", "2026-01-01", "P"), null);
});

// --- 2. Widget : fonctions pures du bundle construit ----------------------

const html = await read("../.build/index.html");
function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}
const H = vm.runInThisContext(`(function () {\n${slice("SPORT")}\n${slice("HEALTH")}\n;return {
  HEALTH_METRICS, HEALTH_GROUPS, healthMetric, healthChartSpec, healthRows, healthMean, healthSeries, healthFormat, healthTicks,
};\n})`)();

const records = [
  { date: "2026-09-21", sleepHours: 7, weight: 80, recovery: 60 },
  { date: "2026-09-22", sleepHours: 6, weight: null, recovery: 40 },
  { date: "2026-09-24", sleepHours: 8, weight: 79.5, recovery: null },
  { date: "2026-09-29", sleepHours: 5, weight: 79, recovery: 90 },
  { date: "2026-10-02", sleepHours: 9, weight: 78, recovery: 50 },
];

test("mesures : 25 mesures d'OS360 en 5 familles, réglages par défaut", () => {
  assert.equal(H.HEALTH_METRICS.length, 25);
  assert.deepEqual(H.HEALTH_GROUPS, ["Corps", "Sommeil", "Récupération", "Activité", "Nutrition"]);
  for (const m of H.HEALTH_METRICS) assert.ok(H.HEALTH_GROUPS.includes(m.group), m.key);
  assert.deepEqual(H.HEALTH_METRICS.map((m) => m.key).sort(), N.HEALTH_COLUMNS.slice(1).sort(), "toutes les colonnes de la source, aucune autre");
  assert.deepEqual(H.healthChartSpec(undefined), { metric: "sleepHours", metricB: "", period: "90", from: "", to: "", days: 30, bucket: "day", mean: true });
  assert.equal(H.healthChartSpec({ health: { metric: "inconnue", metricB: "weight" } }).metric, "sleepHours");
  assert.equal(H.healthChartSpec({ health: { metricB: "weight" } }).metricB, "weight");
  assert.throws(() => H.healthRows({}), /Réponse Santé invalide/);
});

test("série : moyenne des jours renseignés, trous gardés, moyenne 7 jours, rien après aujourd'hui", () => {
  const spec = (patch) => ({ ...H.healthChartSpec(undefined), period: "custom", from: "2026-09-21", to: "2026-10-04", ...patch });
  const day = H.healthSeries(records, spec(), "2026-09-30");
  assert.equal(day.points.length, 10, "du 21 au 30 septembre : rien après aujourd'hui");
  assert.deepEqual(day.points.slice(0, 4).map((p) => p.a), [7, 6, null, 8]);
  assert.equal(day.points[3].rolling, 7, "21, 22 et 24 : (7 + 6 + 8) / 3");
  assert.equal(day.points.at(-1).rolling, 6.5, "24 et 29 dans la fenêtre du 30");
  assert.equal(day.last.a, 5);
  assert.equal(day.count, 4);
  const week = H.healthSeries(records, spec({ bucket: "week", metric: "weight", metricB: "recovery" }), "2026-10-04");
  assert.deepEqual(week.points.map((p) => p.key), ["2026-09-21", "2026-09-28"]);
  assert.deepEqual(week.points.map((p) => p.a), [79.75, 78.5], "moyenne, jamais somme ; null ignoré");
  assert.deepEqual(week.points.map((p) => p.b), [50, 70]);
  assert.equal(week.points[0].rolling, null, "moyenne mobile : jours seulement");
  assert.equal(week.metricB.key, "recovery");
  assert.equal(H.healthSeries(records, spec({ metricB: "sleepHours" }), "2026-09-30").metricB, null, "même mesure : pas de seconde courbe");
  assert.equal(H.healthSeries([], spec(), "2026-09-30").count, 0);
});

test("formats et axes", () => {
  assert.equal(H.healthFormat(7.25, H.healthMetric("sleepHours")), "7,3 h");
  assert.equal(H.healthFormat(12345, H.healthMetric("steps")), "12\u202f345");
  assert.equal(H.healthFormat(null, H.healthMetric("hrv")), "—");
  assert.deepEqual(H.healthTicks(78, 80), [78, 78.5, 79, 79.5, 80]);
  assert.deepEqual(H.healthTicks(77.8, 80.2), [77.5, 78, 78.5, 79, 79.5, 80, 80.5], "bornes rondes encadrantes");
  assert.deepEqual(H.healthTicks(5, 5), [4, 4.5, 5, 5.5, 6]);
  assert.deepEqual(H.healthTicks(NaN, 1), [0, 1]);
  assert.equal(H.healthMean([null, 2, 4]), 3);
  assert.equal(H.healthMean([null]), null);
});

// --- 3. Raccordements et route -------------------------------------------

test("widget rattaché au catalogue, au rendu, à l'en-tête et à la fiche", () => {
  assert.match(html, /key: "healthChart", label: "Graphique santé"/);
  assert.match(html, /w\.type === "healthChart" && \(\s*<WidgetHealthChart widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "healthChart"/);
  assert.match(html, /if \(type === "healthChart"\) data\.health = \{ \.\.\.healthConfig \};/);
  assert.match(html, /fetch\("\/api\/nexora\/health-records"/);
  assert.doesNotMatch(html, /2PACX-/, "aucune feuille publiée dans le front");
});

test("route serveur : lecture seule, session du propriétaire, URL jamais renvoyée", async () => {
  const source = await read("../netlify/functions/health-records.ts");
  assert.match(source, /path: "\/api\/nexora\/health-records", method: \["GET"\]/);
  assert.match(source, /if \(req\.method !== "GET"\)/);
  assert.match(source, /const denied = await requireOwner\(req\);\n  if \(denied\) return denied;/);
  assert.match(source, /Netlify\.env\.get\("NEXORA_HEALTH_CSV_URL"\)/);
  assert.match(source, /json\(\{ ok: true, data: \{ records, readAt: new Date\(\)\.toISOString\(\) \} \}\)/);
  assert.doesNotMatch(source, /detail: [^}]*\burl\b/);
  assert.doesNotMatch(source + await read("../netlify/functions/_shared/health.ts"), /docs\.google\.com|output=csv/, "aucune URL de source dans le code");
});
