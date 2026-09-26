/* Vue Réunions 3D (#514) : filtrage des réunions, périodes, gradins,
   synthèse, nettoyage des extraits et points notés. La tranche testée est
   extraite du bundle RÉELLEMENT construit, jamais recopiée. Le moteur
   three.js est éprouvé par le banc visuel (tools/visual-check).
   Toutes les réunions ci-dessous sont FICTIVES. */

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

const R = vm.runInThisContext(
  `(function () {\n${slice("REUNIONS3D")}\n;return {
    normalizeReunions3dViewPrefs, reunions3dPeriod, reunions3dShift, reunions3dIsoWeek, reunions3dReportText,
    reunions3dCleanLines, reunions3dPoints, reunions3dTablets, reunions3dStateOf, reunions3dCollect, reunions3dInPeriod,
    reunions3dQuickFilter, reunions3dSummary, reunions3dProjects, reunions3dTiers, reunions3dDims, reunions3dStateText,
    reunions3dModel, REU3D_NO_PROJECT, REU3D_MAX_FILS,
  };\n})`
)();

const TODAY = "2026-09-26";
const statuses = [
  { id: "s1", name: "À planifier" }, { id: "s3", name: "En cours" }, { id: "s5", name: "Terminé" }, { id: "s8", name: "OK" },
];
const taskTypes = [{ id: "tt1", name: "Tâches" }, { id: "tt2", name: "Planning" }, { id: "tt3", name: "Réunions" }, { id: "tt9", name: "Réunion" }];
const projects = [{ id: "p1", name: "Passerelle", color: "#E07A3F" }, { id: "p2", name: "École", color: "#245EDB" }];
const ctx = { statuses, taskTypes, projects };
const M = (id, date, extra = {}) => ({ id, title: "Réunion " + id, taskTypeId: "tt3", projectId: "p1", statusId: "s1", start: date, end: date, checklist: [], ...extra });

test("préférences : valeurs par défaut et normalisation", () => {
  assert.deepEqual(R.normalizeReunions3dViewPrefs(null), { period: "week", anchor: null, quick: "all", projectId: null, quality: "auto", animate: true });
  const p = R.normalizeReunions3dViewPrefs({ period: "month", anchor: "2026-09-12", quick: "noreport", projectId: "p2", quality: "low", animate: false });
  assert.deepEqual(p, { period: "month", anchor: "2026-09-12", quick: "noreport", projectId: "p2", quality: "low", animate: false });
  const bad = R.normalizeReunions3dViewPrefs({ period: "year", anchor: "12/09/2026", quick: "x", projectId: 4, quality: "ultra" });
  assert.equal(bad.period, "week"); assert.equal(bad.anchor, null); assert.equal(bad.quick, "all"); assert.equal(bad.projectId, null); assert.equal(bad.quality, "auto");
});

test("périodes : semaine ISO, mois, libellés et navigation", () => {
  const w = R.reunions3dPeriod("week", null, TODAY);
  assert.deepEqual([w.from, w.to, w.label, w.key, w.current], ["2026-09-21", "2026-09-27", "S39 · 21–27 sept.", "2026-W39", true]);
  const m = R.reunions3dPeriod("month", null, TODAY);
  assert.deepEqual([m.from, m.to, m.label, m.current], ["2026-09-01", "2026-09-30", "Septembre 2026", true]);
  // Semaine à cheval sur deux mois.
  assert.equal(R.reunions3dPeriod("week", "2026-10-01", TODAY).label, "S40 · 28 sept. – 4 oct.");
  // Semaine 53 et changement d'année.
  assert.deepEqual(R.reunions3dIsoWeek("2027-01-01"), { y: 2026, w: 53 });
  assert.deepEqual(R.reunions3dIsoWeek("2025-12-29"), { y: 2026, w: 1 });
  assert.equal(R.reunions3dShift("week", null, -1, TODAY), "2026-09-14");
  assert.equal(R.reunions3dShift("week", "2026-09-14", 1, TODAY), "2026-09-21");
  assert.equal(R.reunions3dShift("month", null, 1, TODAY), "2026-10-01");
  assert.equal(R.reunions3dShift("month", "2026-01-15", -1, TODAY), "2025-12-01");
  assert.equal(R.reunions3dPeriod("month", "2026-02-10", TODAY).to, "2026-02-28");
  assert.equal(R.reunions3dPeriod("month", "2026-02-10", TODAY).current, false);
});

test("filtrage : seules les tâches de type Réunion(s), datées, triées", () => {
  const tasks = [
    M("a", "2026-09-22", { startTime: "14:00" }),
    M("b", "2026-09-22", { startTime: "09:30", taskTypeId: "tt9" }),
    { id: "c", title: "Préparer la réunion", taskTypeId: "tt1", start: "2026-09-22", end: "2026-09-22" },
    M("d", null, { start: null, end: null }),
    M("e", "2026-09-21"),
  ];
  const list = R.reunions3dCollect(ctx, tasks);
  assert.deepEqual(list.map((m) => m.id), ["e", "b", "a"]);
  assert.equal(list[1].time, "09:30");
  assert.equal(list[0].projectName, "Passerelle");
  assert.equal(R.reunions3dCollect({ ...ctx, projects: [] }, [M("x", "2026-09-22")])[0].projectId, R.REU3D_NO_PROJECT);
});

test("état : lu sur le statut, jamais déduit de la date", () => {
  const [past, done, ok, doing] = R.reunions3dCollect(ctx, [
    M("p", "2026-09-01"), M("d", "2026-09-02", { statusId: "s5" }), M("o", "2026-09-03", { statusId: "s8" }), M("g", "2026-09-04", { statusId: "s3" }),
  ]);
  assert.equal(past.state, "open");
  assert.equal(past.dark, false);
  assert.equal(done.state, "done");
  assert.equal(done.dark, true);
  assert.equal(ok.state, "done");
  assert.equal(doing.state, "ongoing");
  assert.equal(R.reunions3dStateText(done), "Terminée · aucun compte rendu");
});

test("compte rendu formel : champ dédié, champ personnalisé ou titre dans la description", () => {
  assert.equal(R.reunions3dReportText({ meetingReport: "  " }), "");
  assert.equal(R.reunions3dReportText({ meetingReport: "Relevé" }), "Relevé");
  assert.equal(R.reunions3dReportText({ customFields: { cf1: "Notes" } }, [{ id: "cf1", name: "Compte-rendu" }]), "Notes");
  assert.equal(R.reunions3dReportText({ desc: "## Compte rendu\n- point" }), "## Compte rendu\n- point");
  assert.equal(R.reunions3dReportText({ desc: "Ordre du jour : préparer le compte rendu" }), "");
  const [m] = R.reunions3dCollect(ctx, [M("r", "2026-09-22", { statusId: "s5", desc: "Ordre du jour", meetingReport: "- Planning validé\n- Réserves levées" })]);
  assert.equal(m.report, true);
  assert.equal(m.hasNotes, true);
  assert.equal(m.dark, false);
  assert.deepEqual(m.lines, ["Planning validé", "Réserves levées"]);
  assert.equal(m.points, 2);
});

test("extraits : call-outs, liens et chemins réseau retirés, lignes tronquées", () => {
  const text = [
    "## Compte rendu",
    "## Points traités",
    "> [!WARNING] Réception le **15 octobre**",
    "> Sans DOE complet, rien ne bouge.",
    "- Voir le [plan d'exécution](https://exemple.test/plan.pdf) du lot",
    "- Dossier sur \\\\serveur\\partage\\chantier\\2026 et C:\\Users\\moi\\notes.txt",
    "- https://exemple.test/seulement-un-lien",
    "- [x] Garde-corps reposés",
    "- [ ] Relancer le **bureau de contrôle**",
    "---",
    "| a | b |",
    "🚧 Sécurité : balisage à renforcer",
    "x".repeat(200),
  ].join("\n");
  const lines = R.reunions3dCleanLines(text, 60);
  assert.deepEqual(lines.slice(0, 6), [
    "Points traités",
    "Voir le plan d'exécution du lot",
    "Dossier sur et",
    "☑ Garde-corps reposés",
    "☐ Relancer le bureau de contrôle",
    "Sécurité : balisage à renforcer",
  ]);
  assert.ok(!lines.some((l) => /https?:|\\\\|C:\\|\[!|>/.test(l)), JSON.stringify(lines));
  const long = lines[lines.length - 1];
  assert.ok(long.length <= 60 && long.endsWith("…"), long);
});

test("points notés : puces non vides et checklist ; tablettes limitées à 5 avec « +N »", () => {
  assert.equal(R.reunions3dPoints("- un\n* deux\n1. trois\n-\n- https://exemple.test\ntexte libre", [{ text: "action" }, { text: " " }]), 4);
  assert.equal(R.reunions3dPoints("", null), 0);
  assert.deepEqual(R.reunions3dTablets(3).map((t) => [t.n, t.more]), [[1, 0], [2, 0], [3, 0]]);
  assert.deepEqual(R.reunions3dTablets(5).map((t) => t.more), [0, 0, 0, 0, 0]);
  const t = R.reunions3dTablets(12);
  assert.equal(t.length, R.REU3D_MAX_FILS);
  assert.deepEqual(t[4], { n: 5, more: 8 });
  assert.equal(R.reunions3dTablets(0).length, 0);
});

test("période, filtres rapides, synthèse et légende", () => {
  const list = R.reunions3dCollect(ctx, [
    M("1", "2026-09-14", { statusId: "s5" }),
    M("2", "2026-09-21", { statusId: "s5", meetingReport: "- a\n- b\n- c" }),
    M("3", "2026-09-22", { statusId: "s5", desc: "Notes brèves", projectId: "p2" }),
    M("4", "2026-09-23", { statusId: "s5" }),
    M("5", "2026-09-24", { statusId: "s3" }),
    M("6", "2026-09-25", { desc: "- ordre du jour\n- second point", projectId: "p2" }),
    M("7", "2026-10-02"),
  ]);
  const w = R.reunions3dPeriod("week", null, TODAY);
  const inW = R.reunions3dInPeriod(list, w);
  assert.deepEqual(inW.map((m) => m.id), ["2", "3", "4", "5", "6"]);
  assert.deepEqual(R.reunions3dSummary(inW), { total: 5, notes: 3, report: 1, open: 2, planned: 1, dark: 1, points: 5 });
  assert.deepEqual(R.reunions3dQuickFilter(inW, "notes").map((m) => m.id), ["2", "3", "6"]);
  assert.deepEqual(R.reunions3dQuickFilter(inW, "noreport").map((m) => m.id), ["4"]);
  assert.deepEqual(R.reunions3dQuickFilter(inW, "upcoming").map((m) => m.id), ["5", "6"]);
  assert.deepEqual(R.reunions3dQuickFilter(inW, "all", "p2").map((m) => m.id), ["3", "6"]);
  assert.deepEqual(R.reunions3dProjects(inW).map((p) => [p.name, p.count]), [["Passerelle", 3], ["École", 2]]);
  const model = R.reunions3dModel(list, { period: "month", quick: "notes" }, TODAY);
  assert.equal(model.period.label, "Septembre 2026");
  assert.equal(model.summary.total, 6); // la synthèse porte sur toute la période
  assert.equal(model.shown.length, 3);
});

test("gradins : chronologie de haut en bas, au moins 3 gradins, jours regroupés", () => {
  // Une semaine : un gradin par jour (peu de réunions par jour).
  const week = R.reunions3dCollect(ctx, ["2026-09-21", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-24", "2026-09-25"].map((d, i) => M("w" + i, d)));
  const tw = R.reunions3dTiers(week);
  assert.ok(tw.rows.length >= 3);
  // Rangée 0 (en bas, près de la scène) = la plus récente.
  const bottom = tw.rows.find((r) => r.row === 0), top = tw.rows.find((r) => r.row === tw.rows.length - 1);
  assert.ok(bottom.from > top.to, JSON.stringify(tw.rows.map((r) => r.title)));
  // Ordre chronologique dans chaque gradin et d'un gradin à l'autre.
  const flat = tw.rows.flatMap((r) => r.items.map((m) => m.date));
  assert.deepEqual(flat, [...flat].sort());
  // Sept réunions sur cinq jours : regroupées en gradins de jours consécutifs
  // (plus lisible que cinq gradins), comme sur la maquette validée.
  assert.equal(tw.rows[0].title, "21–22 sept.");
  // Trois jours : un gradin par jour.
  const three = R.reunions3dTiers(R.reunions3dCollect(ctx, [M("t1", "2026-09-21"), M("t2", "2026-09-23"), M("t3", "2026-09-25")]));
  assert.deepEqual(three.rows.map((r) => r.title), ["Lun. 21 sept.", "Mer. 23 sept.", "Ven. 25 sept."]);
  assert.deepEqual(three.rows.map((r) => r.row), [2, 1, 0]);
  // Un mois chargé : les jours consécutifs sont regroupés.
  const month = [];
  for (let d = 1; d <= 30; d++) if (d % 7 !== 6 && d % 7 !== 0) month.push(M("m" + d, "2026-09-" + String(d).padStart(2, "0")));
  const tm = R.reunions3dTiers(R.reunions3dCollect(ctx, month));
  assert.ok(tm.rows.length >= 3 && tm.rows.length < 22, tm.rows.length);
  assert.ok(tm.rows.some((r) => r.days.length > 1));
  assert.match(tm.rows[0].title, /^1er–\d+ sept\.$|^\d+–\d+ sept\.$/);
  assert.equal(tm.rows.reduce((n, r) => n + r.items.length, 0), month.length);
  assert.equal(tm.dims.bay, R.reunions3dDims(tm.maxPerRow).bay);
  // Deux jours seulement : deux gradins, pas trois.
  assert.equal(R.reunions3dTiers(R.reunions3dCollect(ctx, [M("x", "2026-09-21"), M("y", "2026-09-22")])).rows.length, 2);
  // Rien sur la période.
  assert.deepEqual(R.reunions3dTiers([]).rows, []);
  // Gradin à cheval sur deux mois.
  const cross = R.reunions3dTiers(R.reunions3dCollect(ctx, ["2026-09-29", "2026-09-29", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-02"].map((d, i) => M("c" + i, d))), { width: 700, height: 2000 });
  assert.ok(cross.rows.every((r) => r.title.length > 0));
});
