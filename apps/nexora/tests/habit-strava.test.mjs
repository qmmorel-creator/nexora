/* Habitudes cochées par Strava (#593). Tranche extraite du bundle RÉELLEMENT
   construit (NEXORA:HABITS), comme les autres suites ; raccordements vérifiés
   sur le même bundle. */

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
    normalizeHabits, normalizeHabitThemes, normalizeHabitLog, normalizeHabitStrava, habitStravaActivities, habitStravaEntries, toggleHabitLogEntry,
  };\n})`
)();

const run = (date, total = 45, sport = "Course à pied") => ({ id: `${date}|${sport}`, date, sport, title: "", total });
const themes = [
  { id: "sport", name: "Sport", selectionMode: "multi", habits: [
    { id: "cf", name: "CrossFit", kind: "check", strava: { sports: ["CrossFit"], minMinutes: 30, since: "2026-09-01" } },
    { id: "run", name: "Course", kind: "check", strava: { sports: ["Course à pied", "Trail"], since: "" } },
    { id: "eau", name: "Eau", kind: "numeric", min: 0, max: 3, strava: { sports: ["CrossFit"] } },
  ] },
  { id: "jour", name: "Journée", selectionMode: "single", habits: [
    { id: "actif", name: "Actif", kind: "check", strava: { sports: ["CrossFit"] } },
    { id: "repos", name: "Repos", kind: "check" },
  ] },
];

test("liaison : normalisée, gardée par les habitudes à cocher seulement", () => {
  assert.equal(H.normalizeHabitStrava({ sports: [] }), null, "sans sport : pas de liaison");
  assert.equal(H.normalizeHabitStrava(null), null);
  assert.deepEqual(H.normalizeHabitStrava({ sports: ["Trail", "Trail", 3, " "], minMinutes: "29.6", since: "01/09/2026" }), { sports: ["Trail"], minMinutes: 30, since: "" });
  const habits = H.normalizeHabits(themes[0].habits);
  assert.deepEqual(habits[0].strava, { sports: ["CrossFit"], minMinutes: 30, since: "2026-09-01" });
  assert.equal(habits[2].strava, undefined, "habitude chiffrée : jamais liée");
  assert.equal(H.normalizeHabits([{ id: "x", name: "X" }])[0].strava, undefined, "habitude non liée : forme inchangée");
});

test("séances correspondantes : sport, durée minimale, date de départ", () => {
  const habit = H.normalizeHabits(themes[0].habits)[0];
  const acts = [run("2026-09-10", 60, "CrossFit"), run("2026-09-10", 20, "CrossFit"), run("2026-09-10", 90)];
  assert.deepEqual(H.habitStravaActivities(habit, acts, "2026-09-10").map((a) => a.total), [60]);
  assert.deepEqual(H.habitStravaActivities(habit, [run("2026-08-31", 60, "CrossFit")], "2026-08-31"), [], "avant « à partir du »");
  assert.deepEqual(H.habitStravaActivities(habit, [{ ...run("2026-09-11", 0, "CrossFit"), total: null }], "2026-09-11"), [], "durée inconnue < minimum");
  assert.deepEqual(H.habitStravaActivities({ id: "n", name: "n" }, acts, "2026-09-10"), []);
});

test("coches ajoutées : jours passés, idempotentes, jamais une coche retirée ni un jour non applicable", () => {
  const acts = [run("2026-09-10", 60, "CrossFit"), run("2026-09-12"), run("2026-09-12", 50, "Trail"), run("2026-09-13", 60, "CrossFit"), run("2026-10-05")];
  const log = [{ habitId: "run", date: "2026-09-01" }];
  const skips = [{ habitId: "cf", date: "2026-09-13" }];
  const added = H.habitStravaEntries(themes, log, skips, acts, "2026-10-01");
  assert.deepEqual(added.map((e) => e.id), ["actif|2026-09-10", "cf|2026-09-10", "run|2026-09-12", "actif|2026-09-13"],
    "séance future exclue, deux séances le même jour = une coche, jour non applicable exclu, habitude chiffrée ignorée");
  const merged = H.normalizeHabitLog([...log, ...added]);
  assert.deepEqual(H.habitStravaEntries(themes, merged, skips, acts, "2026-10-01"), [], "relancer n'ajoute rien");
  assert.ok(merged.some((e) => e.id === "run|2026-09-01"), "coche manuelle sans séance conservée");
});

test("thème « choix unique » : pas de coche si une autre habitude l'est déjà ce jour-là", () => {
  const acts = [run("2026-09-10", 60, "CrossFit"), run("2026-09-11", 60, "CrossFit")];
  const log = H.toggleHabitLogEntry([], themes, "repos", "2026-09-10");
  const added = H.habitStravaEntries(themes, log, [], acts, "2026-10-01").filter((e) => e.habitId === "actif");
  assert.deepEqual(added.map((e) => e.date), ["2026-09-11"]);
});

test("raccordements : synchronisation au démarrage, réglage dans les thèmes, infobulle Quick Habit", () => {
  assert.match(html, /useSportHabitSync\(habitThemes, habitSkips, setHabitLog, dataLoaded && !syncBlocked\);/);
  assert.match(html, /added\.length \? normalizeHabitLog\(\[\.\.\.normalizeHabitLog\(prev\), \.\.\.added\]\) : prev/, "ajout seulement");
  assert.match(html, /habit\.kind !== "numeric" && <HabitStravaLink habit=\{habit\}/);
  assert.equal((html.match(/title=\{habitStravaTitle\(habit, date\)\}/g) || []).length, 2);
});
