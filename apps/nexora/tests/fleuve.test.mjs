/* Vue « Fleuve du temps » (#515) : le temps coule vers le spectateur, chaque
   tâche ouverte est un bateau posé à son échéance. La tranche testée est
   extraite du bundle RÉELLEMENT construit, jamais recopiée ; elle s'appuie
   sur la normalisation de la Carte, extraite de la même façon. Le moteur
   three.js n'est pas testé ici. */

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

const F = vm.runInThisContext(
  `(function () {\n${slice("CARTE")}\n${slice("FLEUVE")}\n;return {
    carteNormalize, CARTE_NONE, normalizeFleuveViewPrefs, fleuveMatches, fleuveViewFilterCount, fleuveQuickProjects,
    fleuveMondayOffset, fleuveWeekOf, fleuveWeekLabel, fleuveDayLabel, fleuveIso, fleuveDayFromIso, fleuveRelText,
    fleuveTarget, fleuveClampDay, fleuveStepWeek, fleuveWheelDays, fleuveMilestoneLit, fleuveResolveQuality,
    fleuveKindOf, fleuveHours, fleuveSpread, fleuveBuild, fleuveFrise, fleuveFriseDay, fleuveJamText,
    FLEUVE_CAPACITY_DEFAULT, FLEUVE_MAX_LATE, FLEUVE_LANES, FLEUVE_DZ,
  };\n})`
)();

// Samedi 26 septembre 2026, comme la maquette validée.
const NOW = Date.parse("2026-09-26T10:00:00");
const iso = (d) => { const x = new Date(NOW); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() + d); const p = (n) => String(n).padStart(2, "0"); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const statuses = [{ id: "s1", name: "À planifier" }, { id: "s3", name: "En cours" }, { id: "s5", name: "Terminé" }, { id: "s6", name: "Information" }];
const projects = [
  { id: "lot", name: "Lot 2B", color: "#8b5cf6" },
  { id: "pass", name: "Passerelle quai Nord", color: "#e07b1a" },
  { id: "jardin", name: "Jardin", color: "#22a06b" },
];
const ctx = { projects, projectFolders: [], statuses, taskTypes: [{ id: "tt1", name: "Tâches" }], teamMembers: [{ name: "Quentin" }] };
const T = (id, projectId, start, end, extra = {}) => ({ id, title: "Tâche " + id, projectId, statusId: "s1", taskTypeId: "tt1", start: iso(start), end: iso(end), progress: 0, ...extra });
const norm = (tasks) => F.carteNormalize(ctx, tasks, { now: NOW });

test("semaines : lundi de la semaine, libellés S, S+1 et dates en français", () => {
  const n = norm([]);
  const monday = F.fleuveMondayOffset(n.today);
  assert.equal(monday, -5, "le lundi 21 septembre est cinq jours avant le samedi 26");
  assert.equal(F.fleuveWeekOf(0, monday), 0);
  assert.equal(F.fleuveWeekOf(1, monday), 0, "dimanche : encore cette semaine");
  assert.equal(F.fleuveWeekOf(2, monday), 1, "lundi 28 : S+1");
  assert.equal(F.fleuveWeekOf(-6, monday), -1);
  assert.equal(F.fleuveWeekLabel(0), "cette semaine");
  assert.equal(F.fleuveWeekLabel(2), "S+2");
  assert.equal(F.fleuveWeekLabel(-1), "S-1");
  assert.equal(F.fleuveDayLabel(n.today, 0, true), "sam. 26 sept. 2026");
  assert.equal(F.fleuveDayLabel(n.today, 5, false), "jeu. 1er oct.");
  assert.equal(F.fleuveIso(n.today, 12), "2026-10-08");
  assert.equal(F.fleuveDayFromIso("2026-10-08", n.today), 12);
  assert.equal(F.fleuveRelText(0), "Aujourd'hui");
  assert.equal(F.fleuveRelText(1), "dans 1 jour");
  assert.equal(F.fleuveRelText(-3.2), "il y a 4 jours");
});

test("charge : barque, voilier, péniche ; créneau horaire, sinon repli sur la durée en jours", () => {
  assert.equal(F.fleuveKindOf(3), "barque");
  assert.equal(F.fleuveKindOf(4), "barque");
  assert.equal(F.fleuveKindOf(10), "voilier");
  assert.equal(F.fleuveKindOf(12.5), "peniche");
  const [a, b, c, d] = norm([
    T("a", "lot", 2, 2, { startTime: "09:00", endTime: "11:30" }),
    T("b", "lot", 2, 4),
    T("c", "lot", 2, 30),
    T("d", "lot", 2, 2),
  ]).tasks;
  assert.equal(F.fleuveHours(a), 2.5, "créneau 9 h – 11 h 30");
  assert.equal(F.fleuveHours(b), 10.5, "3 jours × 3,5 h");
  assert.equal(F.fleuveHours(c), 40, "plafond à 40 h");
  assert.equal(F.fleuveHours(d), 3.5, "une journée sans créneau");
});

test("répartition : jours ouvrés de la tâche, retard sur aujourd'hui", () => {
  const n = norm([]);
  const monday = F.fleuveMondayOffset(n.today);
  // Du lundi 28 septembre (J+2) au vendredi 9 octobre (J+13) : 10 jours ouvrés.
  const s = F.fleuveSpread(n.today, monday, 2, 13, 20);
  assert.deepEqual(Object.keys(s).sort(), ["1", "2"]);
  assert.ok(Math.abs(s[1] - 10) < 1e-9 && Math.abs(s[2] - 10) < 1e-9);
  // Tâche en retard : toute la charge sur aujourd'hui (semaine en cours).
  assert.deepEqual(F.fleuveSpread(n.today, monday, -9, -3, 7), { 0: 7 });
});

test("placement : bateaux à leur échéance, sans chevauchement dans un couloir", () => {
  const tasks = [];
  for (let i = 0; i < 14; i++) tasks.push(T("m" + i, "lot", 10, 10, { startTime: "08:00", endTime: "09:00" }));
  tasks.push(T("x", "pass", 20, 20));
  const m = F.fleuveBuild(norm(tasks), {});
  const x = m.byId.x;
  assert.ok(x.day >= 20.5 && x.day < 20.5 + 1e-9, "posé au milieu de son jour d'échéance");
  assert.ok(F.FLEUVE_LANES.indexOf(x.lat) !== -1);
  // Même couloir : coques séparées d'au moins leur longueur.
  const byLane = {};
  m.boats.forEach((b) => { (byLane[b.lane] = byLane[b.lane] || []).push(b); });
  Object.values(byLane).forEach((list) => {
    list.sort((a, b) => a.day - b.day);
    for (let i = 1; i < list.length; i++) assert.ok((list[i].day - list[i - 1].day) * F.FLEUVE_DZ >= 1.5 - 1e-6, "écart suffisant entre deux barques");
  });
  // Dérive bornée : au-delà, les bateaux rejoignent le radeau de la semaine.
  m.boats.forEach((b) => assert.ok(b.day - (b.due + 0.5) <= 0.9 + 1e-9));
  const raft = m.clusters.find((c) => !c.late);
  assert.ok(raft, "un radeau regroupe les bateaux sans place");
  assert.equal(raft.week, F.fleuveWeekOf(10, m.monday));
  assert.equal(m.boats.length + raft.ids.length, 15);
  assert.equal(m.counters.grouped, raft.ids.length);
});

test("plafond : au-delà de maxBoats, regroupement par semaine", () => {
  const tasks = [];
  for (let i = 0; i < 30; i++) tasks.push(T("p" + i, "lot", 2 + i, 2 + i));
  const m = F.fleuveBuild(norm(tasks), { maxBoats: 10 });
  assert.equal(m.boats.length, 10);
  assert.equal(m.clusters.reduce((n, c) => n + c.ids.length, 0), 20);
  assert.ok(m.clusters.every((c) => c.ids.length > 0 && Number.isFinite(c.day)));
});

test("statuts : en retard échoué, critique, focus, terminée et information exclues", () => {
  const tasks = [
    T("late", "lot", -12, -5, { criticality: "urgent" }),
    T("crit", "pass", 3, 5, { criticality: "urgent" }),
    T("focus", "jardin", 4, 6, { focus: true }),
    T("done", "lot", 2, 4, { statusId: "s5" }),
    T("info", "lot", 2, 4, { statusId: "s6" }),
    { id: "nodate", title: "Sans date", projectId: "lot", statusId: "s1", taskTypeId: "tt1" },
  ];
  const m = F.fleuveBuild(norm(tasks), {});
  const late = m.byId.late;
  assert.ok(late.grounded && late.late && late.lateDays === 5, "la tâche en retard est échouée");
  assert.ok(late.day < 0, "les épaves sont en aval d'aujourd'hui");
  assert.equal(late.side, 1);
  assert.ok(m.byId.crit.crit && !m.byId.crit.grounded, "critique : bateau à flot dans un remous");
  assert.ok(m.byId.focus.focus);
  assert.ok(!m.byId.done && !m.byId.info, "terminées et informations ne naviguent pas");
  assert.equal(m.undated, 1);
  assert.equal(m.counters.late, 1);
  assert.equal(m.counters.crit, 2);
  assert.equal(m.counters.focus, 1);
});

test("épaves : côtés alternés, au plus douze, le reste en tas d'épaves", () => {
  const tasks = [];
  for (let i = 0; i < 15; i++) tasks.push(T("l" + i, "lot", -20, -1 - i));
  const m = F.fleuveBuild(norm(tasks), {});
  assert.equal(m.wrecks.length, F.FLEUVE_MAX_LATE);
  assert.deepEqual(m.wrecks.slice(0, 4).map((b) => b.side), [1, -1, 1, -1]);
  assert.equal(m.wrecks[0].lateDays, 1, "la moins en retard au plus près d'aujourd'hui");
  const heap = m.clusters.find((c) => c.late);
  assert.equal(heap.ids.length, 3);
  assert.equal(m.counters.late, 15);
});

test("jalons : portiques à leur date, réunis quand ils se touchent ; illuminés une fois franchis", () => {
  const tasks = [
    T("j1", "lot", 13, 13, { milestone: true }),
    T("j2", "pass", 26, 26, { milestone: true }),
    T("j3", "jardin", 26, 26, { milestone: true }),
    T("j0", "lot", -40, -40, { milestone: true }),
  ];
  const m = F.fleuveBuild(norm(tasks), {});
  assert.equal(m.portiques.length, 2);
  assert.equal(m.portiques[0].day, 13);
  assert.equal(m.portiques[0].title, "Tâche j1");
  assert.deepEqual(m.portiques[1].ids, ["j2", "j3"]);
  assert.match(m.portiques[1].title, /^2 jalons/);
  assert.equal(m.past, 1, "un jalon trop ancien n'a pas de portique");
  assert.equal(m.boats.length, 0, "un jalon n'est pas un bateau");
  assert.equal(F.fleuveMilestoneLit(13, 12), false);
  assert.equal(F.fleuveMilestoneLit(13, 13.5), true);
});

test("dépendances : cordes entre bateaux dessinés, sans doublon", () => {
  const tasks = [T("a", "lot", 2, 3), T("b", "lot", 4, 6, { dependsOn: ["a", "zz"] }), T("c", "lot", 4, 8, { dependsOn: ["b"] })];
  tasks[0].dependsOn = ["b"];
  const m = F.fleuveBuild(norm(tasks), {});
  assert.equal(m.links.length, 2);
  assert.ok(m.links.some((l) => l.includes("a") && l.includes("b")));
  assert.ok(m.links.some((l) => l[0] === "b" && l[1] === "c"));
});

test("charge par semaine : bouchon au-delà de la capacité, message N h pour M h", () => {
  const tasks = [];
  // Semaine S+2 (5 au 11 octobre) : 8 tâches de 2 jours = 56 h.
  for (let i = 0; i < 8; i++) tasks.push(T("j" + i, "lot", 9 + (i % 3), 10 + (i % 3)));
  tasks.push(T("light", "pass", 16, 16));
  const m = F.fleuveBuild(norm(tasks), { capacity: 35 });
  const s2 = m.weeks.find((w) => w.k === 2);
  assert.equal(s2.hours, 56);
  assert.equal(s2.capacity, 35);
  assert.ok(s2.over, "la semaine S+2 est chargée");
  assert.equal(F.fleuveJamText(s2), "56 h prévues pour 35 h disponibles");
  assert.ok(m.boats.filter((b) => b.week === 2).every((b) => b.jam));
  assert.equal(m.byId.light.jam, false);
  assert.equal(m.counters.busiest, 2);
  // Capacité paramétrable : 60 h, plus de bouchon.
  const m2 = F.fleuveBuild(norm(tasks), { capacity: 60 });
  assert.equal(m2.weeks.find((w) => w.k === 2).over, false);
  assert.equal(m2.counters.busiest, null);
  // Semaine en cours : seuls ses jours ouvrés restants comptent (au moins un).
  assert.equal(m.weeks[0].capacity, 7, "un samedi : 1 jour minimum, soit 7 h");
});

test("horizon : six semaines au moins, seize au plus, le reste compté plus loin", () => {
  const m = F.fleuveBuild(norm([T("a", "lot", 2, 3)]), {});
  assert.equal(m.nWeeks, 6);
  assert.equal(m.range.navMax, m.monday + 7 * 7 - 1 + 0.5, "jusqu'au dimanche de S+6");
  assert.equal(m.range.navMin, -4);
  const far = F.fleuveBuild(norm([T("a", "lot", 2, 3), T("b", "lot", 60, 70), T("c", "lot", 300, 300)]), {});
  assert.equal(far.nWeeks, 10);
  assert.equal(far.outside, 1);
  const frise = F.fleuveFrise(far);
  assert.equal(frise.weeks.length, 11);
  assert.ok(frise.today > 0 && frise.today < frise.weeks[1].left);
  assert.ok(Math.abs(F.fleuveFriseDay(far, 0) - far.range.navMin) < 1e-9);
  assert.ok(Math.abs(F.fleuveFriseDay(far, 1) - far.range.navMax) < 1e-9);
});

test("navigation par date : semaine, bornes, molette et cartouche", () => {
  const n = norm([]);
  const m = F.fleuveBuild(n, {});
  assert.equal(F.fleuveStepWeek(0, 1, m.range), 7);
  assert.equal(F.fleuveStepWeek(6.6, -1, m.range), 0);
  assert.equal(F.fleuveStepWeek(0, -1, m.range), -4, "borné à l'aval");
  assert.equal(F.fleuveClampDay(999, m.range), m.range.navMax);
  assert.equal(F.fleuveWheelDays(100, 0), 1.2);
  assert.equal(F.fleuveWheelDays(3, 1), 1.5);
  assert.equal(F.fleuveWheelDays(1e6, 0), 3, "un geste brutal reste mesuré");
  const t = F.fleuveTarget(m, 12.4);
  assert.equal(t.date, "jeu. 8 oct. 2026");
  assert.equal(t.week, "S+2");
  assert.equal(t.sub, "dans 12 jours");
  assert.equal(t.iso, "2026-10-08");
  assert.equal(F.fleuveTarget(m, 0).week, "cette semaine");
});

test("qualité : basse sur petit écran et gros volume", () => {
  assert.equal(F.fleuveResolveQuality("auto", 1400, 40), "high");
  assert.equal(F.fleuveResolveQuality("auto", 600, 40), "low");
  assert.equal(F.fleuveResolveQuality("auto", 1400, 200), "low");
  assert.equal(F.fleuveResolveQuality("high", 600, 200), "high");
});

test("préférences : normalisation et filtres rapides", () => {
  const d = F.normalizeFleuveViewPrefs(null);
  assert.deepEqual(d, { projects: [], assignees: [], focusOnly: false, capacity: F.FLEUVE_CAPACITY_DEFAULT, quality: "auto", animate: true, labels: true, legend: true, filter: null });
  const p = F.normalizeFleuveViewPrefs({ projects: ["lot", "lot", 3, ""], assignees: "x", focusOnly: 1, capacity: "42.3", quality: "ultra", animate: false, labels: false, legend: false, filter: [] });
  assert.deepEqual(p.projects, ["lot"]);
  assert.deepEqual(p.assignees, []);
  assert.equal(p.focusOnly, true);
  assert.equal(p.capacity, 42.5);
  assert.equal(p.quality, "auto");
  assert.equal(p.filter, null);
  assert.equal(F.normalizeFleuveViewPrefs({ capacity: 0 }).capacity, F.FLEUVE_CAPACITY_DEFAULT);
  assert.equal(F.normalizeFleuveViewPrefs({ capacity: 500 }).capacity, 168);
  assert.equal(F.fleuveViewFilterCount(p), 2);

  const [a, b, c] = norm([T("a", "lot", 2, 3, { assignee: "Quentin", focus: true }), T("b", "pass", 2, 3), T("c", null, 2, 3)]).tasks;
  assert.ok(F.fleuveMatches(a, { projects: ["lot"] }));
  assert.ok(!F.fleuveMatches(b, { projects: ["lot"] }));
  assert.ok(F.fleuveMatches(c, { projects: [F.CARTE_NONE] }));
  assert.ok(F.fleuveMatches(a, { assignees: ["Quentin"], focusOnly: true }));
  assert.ok(!F.fleuveMatches(b, { assignees: ["Quentin"] }));
  assert.ok(!F.fleuveMatches(b, { focusOnly: true }));
  const opts = F.fleuveQuickProjects([a, b, c], norm([]).projects, ["jardin"]);
  assert.deepEqual(opts.map((o) => [o.id, o.count]), [["lot", 1], ["pass", 1], ["jardin", 0], [F.CARTE_NONE, 1]]);
});
