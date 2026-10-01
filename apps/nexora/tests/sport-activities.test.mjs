/* Widget « Activités sport » (issue #578).
   1. Parité du parseur serveur (_shared/sport.ts) avec OS360 : les fonctions
      d'origine (`_e`, `Jc`, `Kc`, `ve`, `S`, `A`) sont extraites de la copie
      du bundle OS360 versionnée dans public/os360-moteur/ (commit 13197da) et
      comparées sur un jeu de données fictif conséquent.
   2. Fonctions pures du widget, extraites du bundle RÉELLEMENT construit.
   3. Raccordements (catalogue, rendu, en-tête, fiche) et route serveur. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// --- 1. Parité avec OS360 -------------------------------------------------

const bundle = await read("../public/os360-moteur/index.html");
// Le bundle redéfinit des noms (React a aussi son `Jc`, son `_e`…) : on garde
// la définition qui porte la marque de la fonction OS360 voulue.
function os360Function(name, marker) {
  const found = [];
  for (let from = bundle.indexOf(`function ${name}(`); from !== -1; from = bundle.indexOf(`function ${name}(`, from + 1)) {
    if (/[\w$.]/.test(bundle[from - 1])) continue;
    const end = bundle.slice(from).search(/\}(function |var |async function |let |const )/);
    const body = bundle.slice(from, from + end + 1);
    if (body.includes(marker)) found.push(body);
  }
  assert.equal(found.length, 1, `fonction OS360 ${name} introuvable ou ambiguë`);
  return found[0];
}
const OS360 = vm.runInThisContext(`(function () {
${os360Function("A", "T12:00:00Z")}
${os360Function("S", "protocol===`https:`")}
${os360Function("ve", "n\\/a")}
${os360Function("Kc", "Date civile invalide")}
${os360Function("_e", "CSV incomplet")}
${os360Function("Jc", "Colonnes du journal sportif incompatibles")}
return { csv: _e, activities: Jc };
})`)();

const compiled = await transform(await read("../netlify/functions/_shared/sport.ts"), { loader: "ts", format: "esm" });
const N = await import("data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64"));

const HEADER = "Date,Sport,Titre,Durée totale (min),Durée en mouvement (min),Distance (km),Dénivelé positif (m),FC moyenne (bpm),FC maximale (bpm),Début ISO,Fin ISO,ID événement,Calendrier ID,Lien événement,ID activité Strava,Sport Strava d'origine";

// Jeu fictif déterministe : ~900 lignes couvrant les cas limites de `Jc`.
function fixture() {
  let seed = 42;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const sports = ["Course à pied", "CrossFit", "Vélo", "Vélo électrique", "Natation", "Randonnée", "Yoga"];
  const numbers = ["", "—", "-", "n/a", "NULL", "abc", "0", "12", "12,5", "1 234", " 45 ", "7.75", "1 002,25"];
  const titles = ["Sortie", 'Fractionné "10×400"', "Tempo, puis retour", "Ligne\nsur deux", "", "🏃 Trail"];
  const urls = ["https://www.google.com/calendar/event?eid=abc", "http://exemple.invalid/x", "https://user:pw@exemple.invalid/", "pas une url", "", " HTTPS://Exemple.INVALID/a b?x=1 "];
  const quote = (v) => (/[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v);
  const lines = [HEADER];
  for (let i = 0; i < 900; i++) {
    const day = String(1 + rnd(28)).padStart(2, "0");
    const month = String(1 + rnd(12)).padStart(2, "0");
    const year = 2020 + rnd(7);
    if (i % 97 === 5) { lines.push(",,,,,,,,,,,,,,,"); continue; } // ligne vide, sautée
    if (i % 113 === 7) { lines.push(lines[lines.length - 1]); continue; } // doublon exact
    const id = i % 9 === 0 ? "" : `_evt${rnd(20000)}`; // identifiants absents ou en double
    const cal = i % 11 === 0 ? "" : "cal@import.calendar.google.com";
    const row = [
      i % 5 === 0 ? `${year}-${month}-${day}` : `${day}/${month}/${year}`,
      sports[rnd(sports.length)], titles[rnd(titles.length)],
      numbers[rnd(numbers.length)], numbers[rnd(numbers.length)], numbers[rnd(numbers.length)], numbers[rnd(numbers.length)],
      numbers[rnd(numbers.length)], numbers[rnd(numbers.length)],
      `${year}-${month}-${day}T08:00:00+02:00`, `${year}-${month}-${day}T09:00:00+02:00`, id, cal, urls[rnd(urls.length)],
      String(1000 + i), i % 2 ? "Run" : "WeightTraining",
    ];
    lines.push((i % 37 === 3 ? row.slice(0, 13 - rnd(4)) : row).map(quote).join(","));
  }
  return lines.join(rnd(2) ? "\r\n" : "\n") + "\n";
}

const JC_FIELDS = ["id", "date", "sport", "title", "total", "moving", "distance", "elevation", "hr", "maxHr", "url"];
const pick = (a) => Object.fromEntries(JC_FIELDS.map((k) => [k, a[k]]));

test("parité OS360 : découpage CSV identique à `_e`", () => {
  const csv = fixture();
  assert.deepStrictEqual(N.sportCsvRows(csv), OS360.csv(csv));
  for (const text of ['a,"b\r\nc",d\r\n\r\n', 'x,"y ""z"""\n', ",,\n,\n", ""]) assert.deepStrictEqual(N.sportCsvRows(text), OS360.csv(text), JSON.stringify(text));
});

test("parité OS360 : activités identiques à `Jc` sur ~900 lignes", () => {
  const rows = OS360.csv(fixture());
  const expected = OS360.activities(rows);
  const actual = N.sportActivities(rows);
  assert.ok(expected.length > 600, `jeu trop petit : ${expected.length}`);
  assert.ok(expected.some((a) => a.id.startsWith("manual-")) && expected.some((a) => !a.id.startsWith("manual-")));
  assert.ok(expected.some((a) => a.url === null) && expected.some((a) => a.url));
  assert.deepStrictEqual(actual.map(pick), expected);
});

test("parité OS360 : mêmes refus (colonnes, HTML, guillemet, date)", () => {
  const cases = [
    [],
    [["Date", "Sport", "Titre"]],
    [HEADER.replace("Calendrier ID", "Calendrier").split(",")],
    [HEADER.split(","), ["31/02/2026", "Course à pied", "x", "1", "", "", "", "", "", "", "", "e", "c", ""]],
  ];
  for (const rows of cases) {
    let message = "";
    try { OS360.activities(rows); } catch (e) { message = e.message; }
    assert.ok(message, "OS360 aurait dû refuser");
    assert.throws(() => N.sportActivities(rows), { message });
  }
  for (const text of ["<!doctype html><html>", 'a,"b\n']) {
    let message = "";
    try { OS360.csv(text); } catch (e) { message = e.message; }
    assert.throws(() => N.sportCsvRows(text), { message });
  }
});

test("tous les champs : début, fin, identifiants et colonnes Strava en plus", () => {
  const rows = OS360.csv(`${HEADER}\n01/08/2026,Course à pied,Sortie,61,55,"10,2",120,140,171,2026-08-01T08:00:00+02:00,2026-08-01T09:01:00+02:00,_e1,cal@x,https://www.google.com/calendar/event?eid=1,123456,Run\n`);
  const [a] = N.sportActivities(rows);
  assert.deepEqual(a, {
    id: "cal@x|_e1", date: "2026-08-01", sport: "Course à pied", title: "Sortie", total: 61, moving: 55, distance: 10.2, elevation: 120, hr: 140, maxHr: 171,
    url: "https://www.google.com/calendar/event?eid=1", start: "2026-08-01T08:00:00+02:00", end: "2026-08-01T09:01:00+02:00", eventId: "_e1", calendarId: "cal@x",
    extra: { "ID activité Strava": "123456", "Sport Strava d'origine": "Run" },
  });
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
const EXPORTS = ["SPORT_COLUMNS", "SPORT_DEFAULT_COLUMNS", "SPORT_PERIODS", "sportSpec", "sportPeriodRange", "sportRows", "sportAllColumns", "sportNames", "sportFilter", "sportText", "sportSearch", "sportSort", "sportCsv",
  "SPORT_MEASURES", "SPORT_BUCKETS", "SPORT_PALETTE", "SPORT_MAX_BUCKETS", "sportChartSpec", "sportMeasureValue", "sportBucketKey", "sportIsoWeek", "sportBucketLabel", "sportStackSeries", "sportNiceTicks", "sportFormatValue",
  "SPORT_CARD_MEASURES", "SPORT_AGGS", "sportDays", "sportBlockSpec", "sportAggregate", "sportBlockLabel"];
const W = vm.runInThisContext(`(function () {\n${slice("SPORT")}\n;return { ${EXPORTS.join(", ")} };\n})`)();

const payload = {
  activities: [
    { id: "c|1", date: "2026-09-28", sport: "Course à pied", title: "Footing; léger", total: 45, moving: 42, distance: 8.5, elevation: 60, hr: 140, maxHr: 165, url: "https://www.google.com/calendar/event?eid=1", start: "", end: "", eventId: "1", calendarId: "c", extra: { "ID activité Strava": "111", "Sport Strava d'origine": "Run" } },
    { id: "c|2", date: "2026-09-30", sport: "CrossFit", title: 'WOD "Fran"', total: 60, moving: null, distance: null, elevation: null, hr: 130, maxHr: null, url: null, start: "", end: "", eventId: "2", calendarId: "c", extra: {} },
    { id: "c|3", date: "2026-10-01", sport: "Course à pied", title: "Fractionné", total: 1234.5, moving: 50, distance: 10, elevation: 20, hr: null, maxHr: null, url: null, start: "", end: "", eventId: "3", calendarId: "c", extra: {} },
    { id: "manual-4|x", date: "2025-12-31", sport: "Vélo", title: "", total: 90, moving: 80, distance: 30, elevation: 400, hr: 120, maxHr: 150, url: null, start: "", end: "", eventId: "", calendarId: "", extra: {} },
  ],
  readAt: "2026-10-01T08:00:00.000Z",
};

test("widget rattaché au catalogue, au rendu, à l'en-tête et à la fiche", () => {
  assert.match(html, /key: "sportActivities", label: "Activités sport"/);
  assert.match(html, /w\.type === "sportActivities" && \(\s*<WidgetSportActivities widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "sportActivities"/);
  assert.match(html, /if \(type === "sportActivities"\) data\.sport = \{ \.\.\.sportConfig \};/);
  assert.match(html, /fetch\("\/api\/nexora\/sport-activities"/);
  assert.doesNotMatch(html, /docs\.google\.com\/spreadsheets\/d\/e\/[^"'`]*gid=1900000002/, "l'URL de la source n'est pas dans le front");
  for (const label of ["Tous les sports", "Période", "Rechercher dans tous les champs…", "Export CSV", "Actualiser"]) assert.ok(html.includes(label), label);
});

test("tous les champs : connus, puis colonnes en plus de la feuille", () => {
  const rows = W.sportRows(payload);
  assert.equal(rows[0]["x:ID activité Strava"], "111");
  assert.ok(!("extra" in rows[0]));
  const cols = W.sportAllColumns(rows);
  assert.deepEqual(cols.slice(-2).map((c) => c.label), ["ID activité Strava", "Sport Strava d'origine"]);
  assert.deepEqual(W.SPORT_COLUMNS.slice(0, 9).map((c) => c.key), ["date", "sport", "title", "total", "moving", "distance", "elevation", "hr", "maxHr"]);
  assert.ok(W.SPORT_DEFAULT_COLUMNS.every((k) => W.SPORT_COLUMNS.some((c) => c.key === k)));
  assert.throws(() => W.sportRows({}), /Réponse Sport invalide/);
});

test("périodes : semaine ISO (lundi), mois, glissantes, dates libres", () => {
  const today = "2026-10-01"; // jeudi
  const r = (period, extra = {}) => W.sportPeriodRange({ period, ...extra }, today);
  assert.deepEqual(r("all"), { from: "", to: "" });
  assert.deepEqual(r("today"), { from: today, to: today });
  assert.deepEqual(r("week"), { from: "2026-09-28", to: "2026-10-04" });
  assert.deepEqual(W.sportPeriodRange({ period: "week" }, "2026-10-04"), { from: "2026-09-28", to: "2026-10-04" }, "dimanche");
  assert.deepEqual(W.sportPeriodRange({ period: "week" }, "2026-09-28"), { from: "2026-09-28", to: "2026-10-04" }, "lundi");
  assert.deepEqual(r("month"), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(r("previousMonth"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(W.sportPeriodRange({ period: "previousMonth" }, "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(r("year"), { from: "2026-01-01", to: "2026-12-31" });
  assert.deepEqual(r("7"), { from: "2026-09-25", to: today });
  assert.deepEqual(r("custom", { from: "2026-09-29", to: "" }), { from: "2026-09-29", to: "" });
  assert.deepEqual(r("custom", { from: "n'importe quoi", to: "2026-09-30" }), { from: "", to: "2026-09-30" });
  assert.equal(W.sportSpec({ sport: { period: "inconnue" } }).period, "all");
  assert.deepEqual(W.sportSpec(undefined).columns, W.SPORT_DEFAULT_COLUMNS);
});

test("filtres sport et période, sports triés par nombre d'activités", () => {
  const rows = W.sportRows(payload);
  assert.deepEqual(W.sportNames(rows), [{ name: "Course à pied", count: 2 }, { name: "CrossFit", count: 1 }, { name: "Vélo", count: 1 }]);
  const ids = (spec) => W.sportFilter(rows, { sports: [], period: "all", ...spec }, "2026-10-01").map((r) => r.id);
  assert.deepEqual(ids({}), ["c|1", "c|2", "c|3", "manual-4|x"]);
  assert.deepEqual(ids({ sports: ["Course à pied"] }), ["c|1", "c|3"]);
  assert.deepEqual(ids({ period: "week" }), ["c|1", "c|2", "c|3"]);
  assert.deepEqual(ids({ period: "month", sports: ["CrossFit", "Course à pied"] }), ["c|3"]);
  assert.deepEqual(ids({ period: "custom", from: "2025-01-01", to: "2025-12-31" }), ["manual-4|x"]);
});

test("recherche sur tous les champs, tri numérique et vides en fin", () => {
  const rows = W.sportRows(payload);
  assert.deepEqual(W.sportSearch(rows, "run").map((r) => r.id), ["c|1"], "colonne Strava non affichée cherchée aussi");
  assert.deepEqual(W.sportSearch(rows, "FRAN").map((r) => r.id), ["c|2"]);
  assert.deepEqual(W.sportSort(rows, "total", false).map((r) => r.id), ["c|3", "manual-4|x", "c|2", "c|1"]);
  assert.deepEqual(W.sportSort(rows, "moving", true).map((r) => r.id), ["c|1", "c|3", "manual-4|x", "c|2"]);
  assert.deepEqual(W.sportSort(rows, "moving", false).map((r) => r.id), ["manual-4|x", "c|3", "c|1", "c|2"], "vides toujours en fin");
  assert.deepEqual(W.sportSort(rows, "date", false).map((r) => r.id), ["c|3", "c|2", "c|1", "manual-4|x"]);
});

test("affichage et CSV pour Excel : virgule décimale, « ; », guillemets", () => {
  assert.equal(W.sportText("total", 1234.5), "1 234,5");
  assert.equal(W.sportText("hr", null), "");
  const rows = W.sportRows(payload).slice(0, 3);
  const cols = W.SPORT_COLUMNS.filter((c) => ["date", "title", "total", "distance"].includes(c.key));
  const csv = W.sportCsv(rows, cols).split("\r\n");
  assert.equal(csv[0], "Date;Titre;Durée totale (min);Distance (km)");
  assert.equal(csv[1], '2026-09-28;"Footing; léger";45;8,5');
  assert.equal(csv[2], '2026-09-30;"WOD ""Fran""";60;');
  assert.equal(csv[3], "2026-10-01;Fractionné;1234,5;10");
});

// --- Diagramme empilé par sport (#579) ---

test("diagramme : rattaché au catalogue, au rendu, à l'en-tête et à la fiche", () => {
  assert.match(html, /key: "sportChart", label: "Sport par activité \(barres empilées\)"/);
  assert.match(html, /w\.type === "sportChart" && \(\s*<WidgetSportChart widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\}/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| w\.type === "sportChart"/);
  assert.match(html, /if \(type === "sportChart"\) data\.sport = \{ \.\.\.sportChartConfig \};/);
  assert.match(html, /aria-label="Mesure"/);
  assert.match(html, /aria-label="Agrégation"/);
  assert.deepEqual(W.SPORT_MEASURES.map((m) => m.value), ["count", "total", "moving", "distance", "elevation"]);
  assert.deepEqual(W.SPORT_BUCKETS.map((b) => b.value), ["day", "week", "month"]);
  assert.deepEqual({ ...W.sportChartSpec(undefined), columns: undefined }, { columns: undefined, sports: [], period: "365", from: "", to: "", days: 30, measure: "total", bucket: "week" });
});

test("semaines ISO : lundi, numéro, années à 53 semaines", () => {
  assert.equal(W.sportBucketKey("2026-10-01", "week"), "2026-09-28");
  assert.equal(W.sportBucketKey("2026-10-04", "week"), "2026-09-28", "dimanche → lundi précédent");
  assert.equal(W.sportBucketKey("2026-09-28", "week"), "2026-09-28");
  assert.equal(W.sportBucketKey("2026-10-01", "month"), "2026-10");
  assert.equal(W.sportBucketKey("2026-10-01", "day"), "2026-10-01");
  assert.deepEqual(W.sportIsoWeek("2026-09-28"), { year: 2026, week: 40 });
  assert.deepEqual(W.sportIsoWeek("2020-12-28"), { year: 2020, week: 53 });
  assert.deepEqual(W.sportIsoWeek("2021-01-04"), { year: 2021, week: 1 });
  assert.deepEqual(W.sportIsoWeek("2024-12-30"), { year: 2025, week: 1 });
  assert.deepEqual(W.sportIsoWeek("2026-01-05"), { year: 2026, week: 2 });
  assert.deepEqual(W.sportIsoWeek("2025-12-29"), { year: 2026, week: 1 });
  assert.equal(W.sportBucketLabel("2024-12-30", "week"), "S01 2025");
  assert.equal(W.sportBucketLabel("2026-09", "month"), "sept. 2026");
  assert.equal(W.sportBucketLabel("2026-09-03", "day"), "03/09/2026");
});

test("séries : piles par sport, périodes vides remplies, heures, valeurs manquantes signalées", () => {
  const rows = W.sportRows(payload);
  const order = W.sportNames(rows).map((s) => s.name);
  const spec = (patch) => ({ sports: [], period: "custom", from: "2026-09-21", to: "2026-10-04", measure: "total", bucket: "week", ...patch });
  const week = W.sportStackSeries(rows, spec(), "2026-10-01", order);
  assert.deepEqual(week.buckets.map((b) => b.key), ["2026-09-21", "2026-09-28"], "semaine vide gardée");
  assert.equal(week.buckets[0].total, 0);
  assert.deepEqual(week.buckets[1].values, { "Course à pied": (45 + 1234.5) / 60, CrossFit: 1 });
  assert.equal(week.unit, "h");
  assert.deepEqual(week.sports.map((s) => s.name), ["Course à pied", "CrossFit"]);
  assert.deepEqual(week.sports.map((s) => s.color), [W.SPORT_PALETTE[0], W.SPORT_PALETTE[1]]);

  const moving = W.sportStackSeries(rows, spec({ measure: "moving" }), "2026-10-01", order);
  assert.equal(moving.missing, 1, "CrossFit sans durée en mouvement");
  assert.deepEqual(moving.sports.map((s) => s.name), ["Course à pied"]);

  const count = W.sportStackSeries(rows, spec({ measure: "count", bucket: "day", from: "2026-09-28", to: "2026-10-01" }), "2026-10-01", order);
  assert.deepEqual(count.buckets.map((b) => [b.key, b.total]), [["2026-09-28", 1], ["2026-09-29", 0], ["2026-09-30", 1], ["2026-10-01", 1]]);

  const month = W.sportStackSeries(rows, spec({ measure: "elevation", bucket: "month", period: "all" }), "2026-10-01", order);
  assert.equal(month.buckets[0].key, "2025-12");
  assert.equal(month.buckets.at(-1).key, "2026-10", "jusqu'à aujourd'hui");
  assert.equal(month.buckets.length, 11);
  assert.equal(month.buckets[0].values["Vélo"], 400);
  assert.equal(month.sports.find((s) => s.name === "Vélo").color, W.SPORT_PALETTE[2], "couleur stable, même filtrée");

  const filtered = W.sportStackSeries(rows, spec({ sports: ["Vélo"], period: "all", bucket: "month" }), "2026-10-01", order);
  assert.deepEqual(filtered.sports.map((s) => [s.name, s.color]), [["Vélo", W.SPORT_PALETTE[2]]]);

  const many = W.sportStackSeries(rows, spec({ period: "custom", from: "2000-01-01", to: "2026-10-01", bucket: "day" }), "2026-10-01", order);
  assert.equal(many.tooMany, true);
  assert.equal(many.buckets.length, W.SPORT_MAX_BUCKETS);
});

test("axe et formats", () => {
  assert.deepEqual(W.sportNiceTicks(0), [0, 1]);
  assert.deepEqual(W.sportNiceTicks(9.3), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(W.sportNiceTicks(100), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(W.sportNiceTicks(12), [0, 2.5, 5, 7.5, 10, 12.5]);
  assert.equal(W.sportFormatValue(1, "séances"), "1 séance");
  assert.equal(W.sportFormatValue(3, "séances"), "3 séances");
  assert.equal(W.sportFormatValue(1.256, "h"), "1,26 h");
  assert.equal(W.sportFormatValue(1234.56, "km"), "1 234,6 km");
  assert.equal(W.sportFormatValue(2100.4, "m"), "2 100 m");
});

// --- Bloc de carte « Total sport » (#580) ---

test("bloc de carte : type, icône, valeur, libellé, éditeur, validité sans tâche", () => {
  assert.match(html, /\{ key:"sportAggregate", label:"Total sport" \}/);
  assert.match(html, /sportAggregate:"tabler:run"/);
  assert.match(html, /if \(b\.kind==="sportAggregate"\) return <SportAggregateValue block=\{b\} \/>;/);
  assert.match(html, /if \(b\.kind==="sportAggregate"\) return sportBlockLabel\(b\);/);
  assert.match(html, /b\.kind === "sportAggregate" && \(\s*<SportBlockEditor block=\{b\}/);
  // Passer un bloc en « Total sport » : libellé automatique et icône sport, pas ceux de l'ancien type.
  assert.match(html, /\.\.\.\(e\.target\.value==="sportAggregate" \? \{label:"",icon:CUSTOM_CARD_DEFAULT_ICONS\.sportAggregate\} : \{\}\)/);
  // Ni l'avertissement « aucune tâche de référence » ni le refus d'enregistrer pour ce bloc.
  assert.equal(html.split('["aggregate","staticText","daysRemaining","sportAggregate"].includes(b.kind)').length - 1, 2);
  assert.doesNotMatch(html, /\["aggregate","staticText","daysRemaining"\]\.includes/);
  // La lecture du journal ne se fait que dans le composant du bloc, pas dans la carte.
  assert.match(html, /function SportAggregateValue\(\{ block \}\) \{\n  const \{ rows, error \} = useSportData\(\);/);
});

test("bloc de carte : réglages par défaut et période glissante libre", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(W.sportBlockSpec({}))), { sports: [], period: "month", from: "", to: "", days: 30, measure: "total", agg: "sum" });
  assert.equal(W.sportBlockSpec({ sportMeasure: "inconnue", sportAgg: "x" }).measure, "total");
  assert.equal(W.sportDays("abc"), 30);
  assert.equal(W.sportDays(0), 30);
  assert.equal(W.sportDays(12.4), 12);
  assert.equal(W.sportDays(99999), 3660);
  assert.deepEqual(W.sportPeriodRange({ period: "rolling", days: 3 }, "2026-10-01"), { from: "2026-09-29", to: "2026-10-01" });
  assert.equal(W.sportSpec({ sport: { period: "rolling", days: "14" } }).days, 14);
  assert.equal(W.sportBlockLabel({ sportMeasure: "distance", sportAgg: "max" }), "Distance · maximum");
  assert.deepEqual(W.SPORT_AGGS.map((a) => a.value), ["sum", "avg", "max", "min", "count"]);
  assert.deepEqual(W.SPORT_CARD_MEASURES.map((m) => m.value), ["count", "total", "moving", "distance", "elevation", "hr", "maxHr"]);
});

test("bloc de carte : somme, moyenne, extrêmes, nombre ; FC pondérée par la durée comme OS360", () => {
  const rows = W.sportRows(payload);
  const today = "2026-10-01";
  const agg = (b) => W.sportAggregate(rows, W.sportBlockSpec({ sportPeriod: "all", ...b }), today);
  assert.deepEqual(agg({}), { value: (45 + 60 + 1234.5 + 90) / 60, unit: "h", activities: 4 });
  assert.deepEqual(agg({ sportMeasure: "count" }), { value: 4, unit: "séances", activities: 4 });
  assert.deepEqual(agg({ sportMeasure: "moving", sportAgg: "count" }), { value: 3, unit: "séances", activities: 4 }, "valeurs renseignées seulement");
  assert.equal(agg({ sportMeasure: "distance", sportAgg: "avg" }).value, (8.5 + 10 + 30) / 3);
  assert.equal(agg({ sportMeasure: "elevation", sportAgg: "max" }).value, 400);
  assert.equal(agg({ sportMeasure: "elevation", sportAgg: "min" }).value, 20);
  assert.equal(agg({ sportMeasure: "hr", sportAgg: "avg" }).value, (140 * 45 + 130 * 60 + 120 * 90) / (45 + 60 + 90));
  assert.equal(agg({ sportMeasure: "maxHr", sportAgg: "max" }).unit, "bpm");
  assert.deepEqual(agg({ sportSports: ["CrossFit"], sportMeasure: "distance" }), { value: null, unit: "km", activities: 1 }, "aucune valeur : vide, jamais 0");
  assert.equal(agg({ sportPeriod: "week", sportSports: ["Course à pied"], sportMeasure: "distance" }).value, 18.5);
  assert.equal(agg({ sportPeriod: "rolling", sportDays: 2, sportMeasure: "count" }).value, 2);
  assert.equal(agg({ sportPeriod: "custom", sportFrom: "2025-01-01", sportTo: "2025-12-31", sportMeasure: "elevation" }).value, 400);
  assert.equal(W.sportFormatValue(141.7, "bpm"), "142 bpm");
});

// --- 3. Route serveur -----------------------------------------------------

test("route serveur : lecture seule, session du propriétaire, URL jamais renvoyée", async () => {
  const source = await read("../netlify/functions/sport-activities.ts");
  const owner = await read("../netlify/functions/_shared/owner.ts");
  assert.match(source, /path: "\/api\/nexora\/sport-activities", method: \["GET"\]/);
  assert.match(source, /if \(req\.method !== "GET"\)/);
  assert.match(source, /const denied = await requireOwner\(req\);\n  if \(denied\) return denied;/);
  assert.match(source, /Netlify\.env\.get\("NEXORA_SPORT_CSV_URL"\)/);
  assert.match(owner, /getAuth\(\)\.verifyIdToken\(token\)/);
  assert.match(owner, /decoded\.uid !== ownerUid/);
  // La réponse ne contient que les activités et l'heure de lecture.
  assert.match(source, /json\(\{ ok: true, data: \{ activities, readAt: new Date\(\)\.toISOString\(\) \} \}\)/);
  assert.doesNotMatch(source, /detail: [^}]*\burl\b/);
  assert.doesNotMatch(source, /docs\.google\.com|output=csv/, "aucune URL de source dans le code");
});
