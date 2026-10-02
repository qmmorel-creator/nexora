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
  healthSportSpec, healthPearson, healthSportSeries, healthPearsonLabel, HEALTH_SPORT_BUCKETS,
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
  assert.deepEqual(H.healthChartSpec(undefined), { metric: "sleepHours", metricB: "", period: "90", from: "", to: "", days: 30, bucket: "day", mean: true, meanDays: 7, showMin: false, showMax: false, showDev: true });
  assert.equal(H.healthChartSpec({ health: { showDev: false } }).showDev, false, "écart à la moyenne décochable (#611)");
  assert.deepEqual(["3", 1, "abc", 400, 14.6].map((v) => H.healthChartSpec({ health: { meanDays: v } }).meanDays), [3, 7, 7, 365, 15], "moyenne mobile : 2 à 365 jours (#608)");
  assert.deepEqual([H.healthChartSpec({ health: { showMin: true } }).showMin, H.healthChartSpec({ health: { showMax: "oui" } }).showMax], [true, false]);
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
  // #608 : en semaine, moyenne mobile des 7 jours finissant au dernier jour affiché de la semaine.
  assert.deepEqual(week.points.map((p) => p.rolling), [79.75, 78.5], "fenêtres du 21 au 27 et du 28/09 au 04/10");
  assert.deepEqual([week.min.a, week.max.a, week.min.b.value, week.max.b.value], [{ value: 78.5, key: "2026-09-28", label: week.points[1].label }, { value: 79.75, key: "2026-09-21", label: week.points[0].label }, 50, 70], "min et max des points affichés");
  const day3 = H.healthSeries(records, spec({ meanDays: 3 }), "2026-09-30");
  assert.deepEqual(day3.points.slice(0, 4).map((p) => p.rolling), [7, 6.5, 6.5, 7], "moyenne mobile sur 3 jours");
  assert.equal(day3.meanDays, 3);
  assert.deepEqual([day3.min.a.value, day3.max.a.value, day3.min.b], [5, 8, null]);
  assert.deepEqual([week.average, week.averageB, day3.averageB], [79.125, 60, null], "moyenne de la période, par mesure");
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

test("en-tête : min, max et moyenne mobile sur X jours à cocher (#608)", () => {
  assert.match(html, /checked=\{spec\.showMin\} onChange=\{\(\) => update\(\{ showMin: !spec\.showMin \}\)\}/);
  assert.match(html, /checked=\{spec\.showMax\} onChange=\{\(\) => update\(\{ showMax: !spec\.showMax \}\)\}/);
  assert.match(html, /<HealthDaysInput value=\{spec\.meanDays\} disabled=\{!spec\.mean\} onChange=\{\(v\) => update\(\{ meanDays: v \}\)\} \/>/);
  // #611 : panneaux par mesure (bande min–max, moyenne, écart), plus de second axe.
  assert.match(html, /checked=\{spec\.showDev\} onChange=\{\(\) => update\(\{ showDev: !spec\.showDev \}\)\}/);
  assert.match(html, /<HealthBandChart points=\{data\.points\} series=\{series\} showDev=\{spec\.showDev\} rollingLabel=\{rollingLabel\} \/>/);
  assert.doesNotMatch(html.slice(html.indexOf("function WidgetHealthChart("), html.indexOf("function WidgetHealthChart(") + 6000), /<HealthDualChart/);
});

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

// --- Croisement santé × sport (#595) ---

const acts = [
  { id: "1", date: "2026-09-21", sport: "CrossFit", total: 60, distance: null },
  { id: "2", date: "2026-09-22", sport: "Course à pied", total: 30, distance: 6 },
  { id: "3", date: "2026-09-22", sport: "CrossFit", total: 60, distance: null },
  { id: "4", date: "2026-09-29", sport: "Course à pied", total: 90, distance: 15 },
  { id: "5", date: "2026-10-02", sport: "Trail", total: 300, distance: 30 },
];

test("croisement : réglages, coefficient de Pearson et sa lecture", () => {
  assert.deepEqual(H.healthSportSpec(undefined), { metric: "recovery", measure: "total", sports: [], period: "90", from: "", to: "", days: 30, bucket: "day", lag: 0 });
  assert.equal(H.healthSportSpec({ cross: { bucket: "month", lag: 2 } }).bucket, "day", "pas de mois : trop peu de paires");
  assert.equal(H.healthSportSpec({ cross: { lag: 2 } }).lag, 0);
  assert.deepEqual(H.HEALTH_SPORT_BUCKETS.map((b) => b.value), ["day", "week"]);
  assert.equal(H.healthPearson([[1, 2], [2, 4], [3, 6]]), 1);
  assert.equal(H.healthPearson([[1, 3], [2, 2], [3, 1]]), -1);
  assert.equal(H.healthPearson([[1, 2], [2, 4]]), null, "moins de 3 paires");
  assert.equal(H.healthPearson([[1, 2], [1, 3], [1, 4]]), null, "sans variation");
  assert.equal(H.healthPearson([[1, null], [2, 4], [3, 6], [4, 8]]), 1, "paires incomplètes ignorées");
  assert.equal(H.healthPearsonLabel(null), "pas assez de jours renseignés");
  assert.equal(H.healthPearsonLabel(0.05), "aucun lien");
  assert.equal(H.healthPearsonLabel(-0.6), "lien fort, sens opposé");
  assert.equal(H.healthPearsonLabel(0.35), "lien modéré, même sens");
});

test("croisement : paires par jour (0 sans séance), santé du lendemain, semaines, rien après aujourd'hui", () => {
  const spec = (patch) => ({ ...H.healthSportSpec(undefined), period: "custom", from: "2026-09-21", to: "2026-09-30", ...patch });
  const day = H.healthSportSeries(records, acts, spec(), "2026-09-30");
  assert.equal(day.points.length, 10);
  assert.deepEqual(day.points.slice(0, 4).map((p) => [p.key, p.a, p.b]), [["2026-09-21", 60, 1], ["2026-09-22", 40, 1.5], ["2026-09-23", null, 0], ["2026-09-24", null, 0]]);
  assert.equal(day.unit, "h");
  assert.equal(day.pairs, 3, "jours avec une mesure santé");
  const lag = H.healthSportSeries(records, acts, spec({ lag: 1 }), "2026-09-30");
  assert.deepEqual(lag.points.slice(0, 2).map((p) => [p.key, p.a, p.b]), [["2026-09-21", 40, 1], ["2026-09-22", null, 1.5]], "séance du 21, récupération du 22");
  assert.equal(lag.points.at(-1).key, "2026-09-29", "la santé de demain n'existe pas encore");
  assert.equal(lag.lag, 1);
  const week = H.healthSportSeries(records, acts, spec({ bucket: "week", lag: 1, measure: "distance", sports: ["Course à pied"] }), "2026-10-04");
  assert.equal(week.lag, 0, "décalage : jours seulement");
  assert.deepEqual(week.points.map((p) => [p.key, p.a, p.b]), [["2026-09-21", 50, 6], ["2026-09-28", 90, 15]]);
  assert.equal(week.unit, "km");
});

test("croisement : rattaché au catalogue, au rendu, à l'en-tête et à la fiche ; lit les deux sources", () => {
  assert.match(html, /key: "healthSportChart", label: "Santé × sport"/);
  assert.match(html, /w\.type === "healthSportChart" && \(\s*<WidgetHealthSportChart widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "healthSportChart"/);
  assert.match(html, /if \(type === "healthSportChart"\) data\.cross = \{ \.\.\.crossConfig \};/);
  assert.match(html, /function WidgetHealthSportChart\([^)]*\) \{\n  const health = useHealthData\(\);\n  const sport = useSportData\(\);/);
  assert.match(html, /pas une cause/);
});
