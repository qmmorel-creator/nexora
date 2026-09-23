/* Calendrier (#294) : grille continue + frise horaire du jour. Même principe
   que les autres suites : la tranche testée est extraite du bundle RÉELLEMENT
   construit, jamais recopiée. */

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
  `(function () {\n${slice("DATE-UTILS")}\n${slice("TEXT-MATCH")}\n${slice("TASK-STATUS")}\n${slice("FIXED-PAGES")}\n${slice("CALENDAR")}\n;return {
    calendarTimeToMinutes, calendarMinutesToLabel, calendarDurationLabel, normalizeTaskTimes,
    calendarTaskRange, calendarTaskIsTimed, calendarTaskSlice, calendarWeekStart, calendarDayOfWeek,
    calendarTasksOnDate, calendarCompareTasks, normalizeCalendarRows, normalizeCalendarViewPrefs,
    calendarWeekLayout, calendarDayModel, calendarWeekStarts, calendarMonthTitle, calendarLongDate, calendarShortDate,
  };\n})`
)();

const statuses = [{ id: "s1", name: "À planifier" }, { id: "s2", name: "En cours" }, { id: "s3", name: "Terminé" }];
const projects = [{ id: "p1", name: "PCH VA", color: "#245edb" }, { id: "p2", name: "Perso", color: "#8a3ffc" }];
const ctx = { statuses, taskTypes: [], projects };
const task = (id, extra) => ({ id, title: `Tâche ${id}`, projectId: "p1", statusId: "s1", start: "2026-09-23", end: "2026-09-23", ...extra });

test("calendarTimeToMinutes : HH:MM strict, tout le reste vaut null", () => {
  assert.equal(C.calendarTimeToMinutes("08:21"), 501);
  assert.equal(C.calendarTimeToMinutes("00:00"), 0);
  assert.equal(C.calendarTimeToMinutes("23:59"), 1439);
  for (const bad of ["", null, undefined, "24:00", "8:21", "12:60", "midi", "12h30"]) {
    assert.equal(C.calendarTimeToMinutes(bad), null, `« ${bad} » n'est pas une heure`);
  }
});

test("calendarMinutesToLabel / calendarDurationLabel : libellés de la frise", () => {
  assert.equal(C.calendarMinutesToLabel(501), "08:21");
  assert.equal(C.calendarMinutesToLabel(1440), "24:00");
  assert.equal(C.calendarDurationLabel(45), "45 min");
  assert.equal(C.calendarDurationLabel(60), "1 h");
  assert.equal(C.calendarDurationLabel(90), "1 h 30");
  assert.equal(C.calendarDurationLabel(125), "2 h 05");
});

test("normalizeTaskTimes : heures cohérentes avant enregistrement", () => {
  const day = { start: "2026-09-24", end: "2026-09-24" };
  assert.deepEqual(C.normalizeTaskTimes({ ...day, startTime: "17:30", endTime: "18:30" }), { startTime: "17:30", endTime: "18:30" });
  assert.deepEqual(C.normalizeTaskTimes({ ...day, startTime: "17:30", endTime: "" }), { startTime: "17:30", endTime: "18:30" }, "sans fin : une heure");
  assert.deepEqual(C.normalizeTaskTimes({ ...day, startTime: "17:30", endTime: "09:00" }), { startTime: "17:30", endTime: "18:30" }, "fin avant début le même jour : recalée");
  assert.deepEqual(C.normalizeTaskTimes({ ...day, startTime: "23:30", endTime: "" }), { startTime: "23:30", endTime: "23:59" }, "jamais au-delà de 23:59");
  assert.deepEqual(C.normalizeTaskTimes({ ...day, startTime: "", endTime: "10:00" }), { startTime: "", endTime: "" }, "une fin sans début n'a pas de sens");
  assert.deepEqual(C.normalizeTaskTimes({ start: "", end: "", startTime: "10:00", endTime: "11:00" }), { startTime: "", endTime: "" }, "sans date : pas d'heure");
  assert.deepEqual(
    C.normalizeTaskTimes({ start: "2026-09-24", end: "2026-09-26", startTime: "18:00", endTime: "09:00" }),
    { startTime: "18:00", endTime: "09:00" },
    "sur plusieurs jours, une fin plus tôt dans la journée reste légitime"
  );
});

test("calendarTaskSlice : premier, dernier et jours intermédiaires d'une tâche horodatée", () => {
  const t = task("t", { start: "2026-09-21", end: "2026-09-23", startTime: "14:00", endTime: "10:00" });
  assert.deepEqual(C.calendarTaskSlice(t, "2026-09-21"), { startMin: 840, endMin: 1440 });
  assert.deepEqual(C.calendarTaskSlice(t, "2026-09-22"), { startMin: 0, endMin: 1440 }, "jour intermédiaire = 0 h → 24 h");
  assert.deepEqual(C.calendarTaskSlice(t, "2026-09-23"), { startMin: 0, endMin: 600 });
  assert.equal(C.calendarTaskSlice(t, "2026-09-24"), null, "hors de la tâche");
  assert.equal(C.calendarTaskSlice(task("u"), "2026-09-23"), null, "sans heure : pas sur la frise");
  assert.deepEqual(C.calendarTaskSlice(task("v", { startTime: "09:00" }), "2026-09-23"), { startMin: 540, endMin: 600 }, "sans fin : une heure");
});

test("calendarTaskRange : un jalon (fin seule) et des dates inversées restent lisibles", () => {
  assert.deepEqual(C.calendarTaskRange({ end: "2026-09-23" }), { start: "2026-09-23", end: "2026-09-23" });
  assert.deepEqual(C.calendarTaskRange({ start: "2026-09-25", end: "2026-09-23" }), { start: "2026-09-23", end: "2026-09-25" });
  assert.equal(C.calendarTaskRange({}), null);
});

test("calendarWeekStart : les semaines commencent le lundi", () => {
  assert.equal(C.calendarWeekStart("2026-09-23"), "2026-09-21");
  assert.equal(C.calendarWeekStart("2026-09-21"), "2026-09-21");
  assert.equal(C.calendarWeekStart("2026-09-27"), "2026-09-21", "le dimanche appartient à la semaine qui finit");
  assert.equal(C.calendarDayOfWeek("2026-09-27"), 6);
  assert.deepEqual(C.calendarWeekStarts("2026-09-21", 3), ["2026-09-21", "2026-09-28", "2026-10-05"]);
});

test("calendarWeekLayout : la grille masque les tâches terminées", () => {
  const tasks = [task("open", { startTime: "10:00" }), task("done", { statusId: "s3", startTime: "08:00" })];
  const week = C.calendarWeekLayout(tasks, ctx, "2026-09-21", 4);
  const wed = week.days[2];
  assert.deepEqual(wed.items.map((t) => t.id), ["open"]);
  assert.equal(wed.total, 1);
});

test("calendarWeekLayout : bandeaux multi-jours rangés en pistes, découpés à la semaine", () => {
  const tasks = [
    task("a", { start: "2026-09-21", end: "2026-09-23" }),
    task("b", { start: "2026-09-22", end: "2026-09-25" }),
    task("c", { start: "2026-09-26", end: "2026-10-02" }),
    task("d", { start: "2026-09-15", end: "2026-09-22" }),
  ];
  const week = C.calendarWeekLayout(tasks, ctx, "2026-09-21", 4);
  const byId = Object.fromEntries(week.spans.map((s) => [s.task.id, s]));
  assert.equal(byId.d.clipStart, true, "commence avant la semaine");
  assert.equal(byId.d.col0, 0);
  assert.equal(byId.c.clipEnd, true, "finit après la semaine");
  assert.equal(byId.c.col1, 6);
  assert.notEqual(byId.a.lane, byId.d.lane, "deux bandeaux qui se chevauchent ne partagent pas une piste");
  assert.notEqual(byId.a.lane, byId.b.lane);
  assert.equal(byId.c.lane, 0, "une piste libérée est réutilisée");
  assert.equal(week.laneCount, 3);
});

test("calendarWeekLayout : au-delà des lignes disponibles, « +N » compte le reste", () => {
  const tasks = [
    task("span", { start: "2026-09-22", end: "2026-09-24" }),
    ...["07:00", "08:00", "09:00", "10:00", "11:00"].map((h, i) => task("t" + i, { startTime: h })),
  ];
  const week = C.calendarWeekLayout(tasks, ctx, "2026-09-21", 4);
  const wed = week.days[2];
  assert.equal(wed.items.length, 3, "4 lignes dont une prise par le bandeau");
  assert.deepEqual(wed.items.map((t) => t.startTime), ["07:00", "08:00", "09:00"], "triées par heure");
  assert.equal(wed.hidden, 2);
  assert.equal(wed.total, 6);
});

test("calendarCompareTasks : journée entière d'abord, puis par heure, puis par titre", () => {
  const list = [
    task("x", { title: "B", startTime: "09:00" }),
    task("y", { title: "Z" }),
    task("z", { title: "A", startTime: "09:00" }),
    task("w", { title: "C", startTime: "07:30" }),
  ].sort(C.calendarCompareTasks);
  assert.deepEqual(list.map((t) => t.id), ["y", "w", "z", "x"]);
});

test("calendarDayModel : la frise montre aussi les tâches terminées du jour", () => {
  const tasks = [
    task("m", { startTime: "07:30", endTime: "08:00", statusId: "s3" }),
    task("n", { startTime: "10:00", endTime: "11:30" }),
    task("o", { title: "CR", statusId: "s3" }),
    task("p", { start: "2026-09-22", end: "2026-09-25" }),
    task("q", { start: "2026-09-24", end: "2026-09-24", startTime: "09:00" }),
  ];
  const day = C.calendarDayModel(tasks, ctx, "2026-09-23");
  assert.deepEqual(day.timed.map((r) => r.task.id), ["m", "n"]);
  assert.equal(day.timed[0].done, true);
  assert.deepEqual(day.allDay.map((r) => r.task.id).sort(), ["o", "p"]);
  assert.equal(day.total, 4);
  assert.equal(day.doneCount, 2);
  assert.equal(day.plannedMinutes, 120);
});

test("normalizeCalendarViewPrefs : valeurs par défaut et bornes", () => {
  assert.deepEqual(C.normalizeCalendarViewPrefs(undefined), { rowsPerCell: 4, showTimes: true, filter: null });
  assert.equal(C.normalizeCalendarViewPrefs({ rowsPerCell: 42 }).rowsPerCell, 8);
  assert.equal(C.normalizeCalendarViewPrefs({ rowsPerCell: 0 }).rowsPerCell, 2);
  assert.equal(C.normalizeCalendarViewPrefs({ rowsPerCell: "abc" }).rowsPerCell, 4);
  assert.equal(C.normalizeCalendarViewPrefs({ showTimes: false }).showTimes, false);
  assert.deepEqual(C.normalizeCalendarViewPrefs({ filter: { projectIds: ["p1"] } }).filter, { projectIds: ["p1"] });
});

test("libellés de dates en français", () => {
  assert.equal(C.calendarMonthTitle("2026-09-23"), "Septembre 2026");
  assert.equal(C.calendarLongDate("2026-09-24"), "Jeudi 24 septembre 2026");
  assert.equal(C.calendarShortDate("2026-10-01"), "1 oct.");
});

test("la vue et le widget Calendrier sont déclarés", () => {
  assert.match(html, /\{ key: "calendar", label: "Calendrier", iconKey: "tabler:calendar-month" \}/);
  assert.match(html, /\{ key: "calendar", label: "Calendrier", icon: CalendarDays, group: "Planning" \}/);
  assert.match(html, /view === "calendar" && <CalendarView /);
  assert.match(html, /w\.type === "calendar" && \(/);
});
