/* Habit Tracker (#193). Comme les autres suites, la tranche testée est
   extraite du bundle RÉELLEMENT construit — jamais recopiée — entre les
   sentinelles NEXORA:HABITS, avec NEXORA:DATE-UTILS pour les vraies `iso`. */

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

const H = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("HABITS")}\n;return {
    normalizeHabitSelectionMode, normalizeHabitKind, normalizeHabits, normalizeHabitThemes,
    habitThemeById, habitById, habitLogCellId, normalizeHabitLog,
    habitLogHabitIdsForDate, habitLogValueForDate, toggleHabitLogEntry, setHabitLogValue, habitThemeUsage,
    habitCellColors, habitCellBackground, habitValueIntensity, habitIntensityColor,
    habitMonthDays, habitYearWeeks,
  };\n})`
)();

const theme = (id, extra) => ({ id, name: `Thème ${id}`, ...extra });
const habit = (id, extra) => ({ id, name: `Habitude ${id}`, color: "#2C6BE0", ...extra });

// --- normalizeHabitThemes / normalizeHabits ---------------------------------

test("normalizeHabitThemes : un thème sans nom est ignoré", () => {
  const [t] = H.normalizeHabitThemes([theme("a", { name: "" }), theme("b")]);
  assert.equal(t.id, "b");
});

test("normalizeHabitThemes : id dupliqué -> le premier gagne", () => {
  const out = H.normalizeHabitThemes([theme("a", { name: "Premier" }), theme("a", { name: "Second" })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Premier");
});

test("normalizeHabitThemes : mode invalide retombe sur 'single'", () => {
  const [t] = H.normalizeHabitThemes([theme("a", { selectionMode: "n'importe quoi" })]);
  assert.equal(t.selectionMode, "single");
});

test("normalizeHabitThemes : les habitudes imbriquées sont normalisées (id/couleur de repli)", () => {
  const [t] = H.normalizeHabitThemes([theme("a", { habits: [{ name: "Sans id ni couleur" }] })]);
  assert.equal(t.habits.length, 1);
  assert.equal(t.habits[0].id, "Sans id ni couleur"); // repli sur le nom
  assert.ok(t.habits[0].color);
});

test("habitThemeById / habitById retrouvent thème et habitude d'un id", () => {
  const themes = [theme("a", { habits: [habit("h1"), habit("h2")] })];
  assert.equal(H.habitThemeById(themes, "a").id, "a");
  assert.equal(H.habitById(themes, "h2").habit.id, "h2");
  assert.equal(H.habitById(themes, "h2").theme.id, "a");
  assert.equal(H.habitById(themes, "inconnu"), null);
});

// --- Journal (normalizeHabitLog / toggleHabitLogEntry) ----------------------

test("habitLogCellId est dérivé, jamais aléatoire", () => {
  assert.equal(H.habitLogCellId("h1", "2026-09-20"), "h1|2026-09-20");
});

test("normalizeHabitLog : entrée sans date ISO valide écartée", () => {
  const out = H.normalizeHabitLog([{ habitId: "h1", date: "pas une date" }, { habitId: "h1", date: "2026-09-20" }]);
  assert.equal(out.length, 1);
});

test("normalizeHabitLog : une habitude supprimée du catalogue quitte le journal", () => {
  const out = H.normalizeHabitLog([{ habitId: "h1", date: "2026-09-20" }, { habitId: "h2", date: "2026-09-20" }], ["h2"]);
  assert.deepEqual(out.map((e) => e.habitId), ["h2"]);
});

test("toggleHabitLogEntry : thème 'single' -> cocher une habitude retire les autres du même thème ce jour-là", () => {
  const themes = [theme("t1", { selectionMode: "single", habits: [habit("bureau"), habit("teletravail")] })];
  let log = H.toggleHabitLogEntry([], themes, "bureau", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20"), ["bureau"]);
  log = H.toggleHabitLogEntry(log, themes, "teletravail", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20"), ["teletravail"]);
});

test("toggleHabitLogEntry : thème 'single' -> recocher la même habitude la décoche", () => {
  const themes = [theme("t1", { selectionMode: "single", habits: [habit("meds")] })];
  let log = H.toggleHabitLogEntry([], themes, "meds", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20"), ["meds"]);
  log = H.toggleHabitLogEntry(log, themes, "meds", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20"), []);
});

test("toggleHabitLogEntry : thème 'multi' -> les habitudes sont indépendantes", () => {
  const themes = [theme("t1", { selectionMode: "multi", habits: [habit("crossfit"), habit("marche")] })];
  let log = H.toggleHabitLogEntry([], themes, "crossfit", "2026-09-20");
  log = H.toggleHabitLogEntry(log, themes, "marche", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20").sort(), ["crossfit", "marche"]);
});

test("toggleHabitLogEntry : deux thèmes différents le même jour ne se marchent jamais dessus", () => {
  const themes = [
    theme("job", { selectionMode: "single", habits: [habit("bureau")] }),
    theme("sport", { selectionMode: "multi", habits: [habit("crossfit")] }),
  ];
  let log = H.toggleHabitLogEntry([], themes, "bureau", "2026-09-20");
  log = H.toggleHabitLogEntry(log, themes, "crossfit", "2026-09-20");
  assert.deepEqual(H.habitLogHabitIdsForDate(log, "2026-09-20").sort(), ["bureau", "crossfit"]);
});

test("habitThemeUsage compte les coches du thème dans le journal", () => {
  const themes = [theme("t1", { habits: [habit("h1"), habit("h2")] })];
  const log = [
    { habitId: "h1", date: "2026-09-01" },
    { habitId: "h2", date: "2026-09-02" },
    { habitId: "h1", date: "2026-09-03" },
  ];
  assert.equal(H.habitThemeUsage(log, themes, "t1"), 3);
  assert.equal(H.habitThemeUsage(log, themes, "inconnu"), 0);
});

// --- Coloration --------------------------------------------------------------

test("habitCellBackground : une couleur -> aplat, aucune -> repli", () => {
  assert.equal(H.habitCellBackground([], "#EEE"), "#EEE");
  assert.equal(H.habitCellBackground(["#2C6BE0"]), "#2C6BE0");
});

test("habitCellBackground : plusieurs couleurs -> dégradé conique en parts égales", () => {
  const bg = H.habitCellBackground(["#2C6BE0", "#1FA971"]);
  assert.ok(bg.startsWith("conic-gradient(from 45deg,"));
  assert.ok(bg.includes("#2C6BE0 0deg 180deg"));
  assert.ok(bg.includes("#1FA971 180deg 360deg"));
});

test("habitCellColors ne retient que les habitudes du thème effectivement cochées", () => {
  const t = { habits: [habit("h1", { color: "#111111" }), habit("h2", { color: "#222222" })] };
  const log = [{ habitId: "h1", date: "2026-09-20" }, { habitId: "h9-inconnu", date: "2026-09-20" }];
  assert.deepEqual(H.habitCellColors(t, log, "2026-09-20"), ["#111111"]);
});

test("habitCellColors ignore les coches d'une autre date", () => {
  const t = { habits: [habit("h1", { color: "#111111" })] };
  const log = [{ habitId: "h1", date: "2026-09-19" }];
  assert.deepEqual(H.habitCellColors(t, log, "2026-09-20"), []);
});

// --- Habitudes « numeric » ----------------------------------------------------

test("normalizeHabits : type numeric par défaut min 0 / max min+10, kind invalide -> check", () => {
  const [h1, h2] = H.normalizeHabits([
    { id: "h1", name: "Verres d'eau", kind: "numeric" },
    { id: "h2", name: "Autre", kind: "n'importe quoi" },
  ]);
  assert.equal(h1.kind, "numeric");
  assert.equal(h1.min, 0);
  assert.equal(h1.max, 10);
  assert.equal(h2.kind, "check");
});

test("normalizeHabits : min/max fournis et cohérents sont conservés", () => {
  const [h] = H.normalizeHabits([{ id: "h1", name: "Sommeil", kind: "numeric", min: 4, max: 9 }]);
  assert.equal(h.min, 4);
  assert.equal(h.max, 9);
});

test("setHabitLogValue : pose puis efface une valeur, bornée à [min,max]", () => {
  const themes = [theme("t1", { habits: [habit("h1", { kind: "numeric", min: 0, max: 8 })] })];
  let log = H.setHabitLogValue([], themes, "h1", "2026-09-20", 12);
  assert.equal(H.habitLogValueForDate(log, "h1", "2026-09-20"), 8); // borné au max
  log = H.setHabitLogValue(log, themes, "h1", "2026-09-20", 3);
  assert.equal(H.habitLogValueForDate(log, "h1", "2026-09-20"), 3);
  log = H.setHabitLogValue(log, themes, "h1", "2026-09-20", "");
  assert.equal(H.habitLogValueForDate(log, "h1", "2026-09-20"), null);
});

test("habitValueIntensity : 0 au minimum, 1 au maximum", () => {
  const h = habit("h1", { kind: "numeric", min: 2, max: 10 });
  assert.equal(H.habitValueIntensity(h, 2), 0);
  assert.equal(H.habitValueIntensity(h, 10), 1);
  assert.equal(H.habitValueIntensity(h, 6), 0.5);
});

test("habitIntensityColor : intensité croissante -> couleur plus saturée (plus proche de la couleur pleine)", () => {
  const low = H.habitIntensityColor("#2C6BE0", 0);
  const high = H.habitIntensityColor("#2C6BE0", 1);
  assert.equal(high, "#2c6be0");
  assert.notEqual(low, high);
});

test("habitCellColors : habitude numeric -> couleur graduée selon la valeur posée", () => {
  const t = { habits: [habit("h1", { color: "#2C6BE0", kind: "numeric", min: 0, max: 10 })] };
  const log = [{ id: "x", habitId: "h1", date: "2026-09-20", value: 10 }];
  assert.deepEqual(H.habitCellColors(t, log, "2026-09-20"), ["#2c6be0"]);
});

// --- Grille mensuelle ---------------------------------------------------------

test("habitMonthDays : toujours 42 cases (6 semaines), lundi en tête", () => {
  const t = theme("t1", { habits: [habit("h1")] });
  const days = H.habitMonthDays(t, [], 2026, 8); // septembre 2026 (0-indexé)
  assert.equal(days.length, 42);
  assert.equal(new Date(days[0].date + "T00:00:00").getDay(), 1); // lundi
});

test("habitMonthDays : marque le jour d'aujourd'hui et distingue passé/futur", () => {
  const t = theme("t1", { habits: [habit("h1")] });
  const today = new Date();
  const days = H.habitMonthDays(t, [], today.getFullYear(), today.getMonth());
  const todayCell = days.find((d) => d.isToday);
  assert.ok(todayCell, "le mois courant doit contenir le jour du jour");
  assert.equal(todayCell.isFuture, false);
});

test("habitMonthDays : isWeekend marque samedi et dimanche", () => {
  const t = theme("t1", { habits: [habit("h1")] });
  const days = H.habitMonthDays(t, [], 2026, 8); // septembre 2026
  const sat = days.find((d) => d.date === "2026-09-05");
  const mon = days.find((d) => d.date === "2026-09-07");
  assert.equal(sat.isWeekend, true);
  assert.equal(mon.isWeekend, false);
});

test("habitMonthDays : une coche loguée colore la bonne case", () => {
  const t = theme("t1", { habits: [habit("h1", { color: "#ABCDEF" })] });
  const log = [{ habitId: "h1", date: "2026-09-15" }];
  const days = H.habitMonthDays(t, log, 2026, 8);
  const cell = days.find((d) => d.date === "2026-09-15");
  assert.deepEqual(cell.colors, ["#ABCDEF"]);
});

// --- Grille annuelle -----------------------------------------------------------

test("habitYearWeeks : 53 semaines, chaque mois n'apparaît qu'une fois en repère", () => {
  const t = theme("t1", { habits: [habit("h1")] });
  const weeks = H.habitYearWeeks(t, [], 2026);
  assert.equal(weeks.length, 53);
  const labels = weeks.map((w) => w.monthLabel).filter(Boolean);
  assert.equal(labels.length, 12, "un seul repère par mois sur l'année");
  assert.equal(new Set(labels).size, 12, "jamais deux mois avec le même repère");
});

test("habitYearWeeks : la toute première semaine n'est jamais une frontière de mois", () => {
  const t = theme("t1", { habits: [habit("h1")] });
  const weeks = H.habitYearWeeks(t, [], 2026);
  assert.equal(weeks[0].monthBoundary, false);
});

test("habitYearWeeks : les jours hors de l'année n'ont jamais de couleur", () => {
  const t = theme("t1", { habits: [habit("h1", { color: "#123456" })] });
  // Un jour de décembre 2025 (dans la grille de janvier) porte une coche :
  // elle ne doit jamais teinter une case hors année.
  const log = [{ habitId: "h1", date: "2025-12-30" }];
  const weeks = H.habitYearWeeks(t, log, 2026);
  const outOfYearDay = weeks[0].days.find((d) => d.date === "2025-12-30");
  assert.ok(outOfYearDay, "ce jour doit exister dans la grille (semaine de padding)");
  assert.equal(outOfYearDay.inYear, false);
  assert.deepEqual(outOfYearDay.colors, []);
});
