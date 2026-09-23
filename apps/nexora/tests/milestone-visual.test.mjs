/* Ref #342 : le RENDU visuel d'un jalon (losange plutôt que barre — Mini-Gantt,
   mode Bulles, exports PDF Fiche mémo/Fiche projet) suit désormais le seul
   jour de début/fin, sans les horaires — jamais le champ `task.milestone`
   stocké tel quel, qui lui en tient compte depuis #338 (voir task-times.test).

   Comme les autres suites, `isMilestoneVisual` est extraite du bundle
   RÉELLEMENT construit (.build/index.html), entre les sentinelles
   NEXORA:TASK-KIND — aucune copie du code n'est maintenue à côté. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function extract(start, end, exports) {
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${start} introuvable dans .build/index.html`);
  return vm.runInThisContext(
    `(function () {\n${html.slice(from + start.length, to)}\n;return { ${exports.join(", ")} };\n})`
  )();
}

const { isMilestoneVisual, getTaskType } = extract(
  "// === NEXORA:TASK-KIND:START ===",
  "// === NEXORA:TASK-KIND:END ===",
  ["isMilestoneVisual", "getTaskType"],
);

// --- La fonction pure -------------------------------------------------------

test("isMilestoneVisual : même jour de début/fin -> losange, peu importe les horaires", () => {
  // Même jour, horaires distincts : un jalon en base (#338) le refuserait,
  // le rendu l'accepte quand même (c'est tout l'objet de #342).
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "2026-09-24", startTime: "09:00", endTime: "11:30", milestone: false }), true);
  // Même jour, sans horaires, milestone déjà à false : toujours un losange.
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "2026-09-24", milestone: false }), true);
});

test("isMilestoneVisual : un jalon posé EXPLICITEMENT reste un losange même multi-jours", () => {
  // La bascule manuelle de la fiche tâche force normalement end = start, mais
  // la fonction respecte quand même un `milestone: true` explicite : le choix
  // de l'utilisateur prime toujours sur la comparaison de jours.
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "2026-09-28", milestone: true }), true);
});

test("isMilestoneVisual : tâche multi-jours sans jalon explicite -> barre", () => {
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "2026-09-28", milestone: false }), false);
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "2026-09-28" }), false);
});

test("isMilestoneVisual : dates manquantes -> jamais un losange", () => {
  assert.equal(isMilestoneVisual({ start: "", end: "" }), false);
  assert.equal(isMilestoneVisual({ start: "2026-09-24", end: "" }), false);
  assert.equal(isMilestoneVisual(null), false);
  assert.equal(isMilestoneVisual(undefined), false);
});

test("getTaskType n'est pas touché : il continue de lire le champ stocké tel quel", () => {
  // #342 ne change QUE le rendu (isMilestoneVisual) : le classement "type"
  // utilisé ailleurs (filtres, tableur, groupements) reste sur le champ brut.
  assert.equal(getTaskType({ milestone: false, start: "2026-09-24", end: "2026-09-24" }), "action");
  assert.equal(getTaskType({ milestone: true }), "milestone");
});

// --- Câblage dans le Mini-Gantt / Bulles ------------------------------------

test("le Mini-Gantt (barre et Bulles) reclasse ses tâches avec isMilestoneVisual, pas le champ brut", () => {
  const from = html.indexOf("function WidgetMiniGantt(");
  assert.ok(from !== -1, "WidgetMiniGantt introuvable");
  const source = html.slice(from, from + 1200);
  assert.match(source, /tasks = useMemo\(\s*\(\) => \(tasks \|\| \[\]\)\.map\(\(t\) => \(t && t\.milestone !== isMilestoneVisual\(t\) \? \{ \.\.\.t, milestone: isMilestoneVisual\(t\) \} : t\)\),/,
    "le widget ne recale pas ses tâches sur isMilestoneVisual avant de les répartir en barres/jalons");
});

test("le widget continue de séparer barres et jalons sur task.milestone (déjà recalé plus haut)", () => {
  // Le filtre lui-même n'a pas besoin de changer : c'est l'entrée `tasks` qui
  // porte désormais le critère visuel — un seul endroit à maintenir.
  assert.match(html, /tasks\.filter\(\(t\) => !t\.milestone && t\.start && t\.end\), barLimit, "start"/);
  assert.match(html, /tasks\.filter\(\(t\) => t\.milestone && t\.end\), milestoneLimit, "end"/);
});

// --- Câblage dans les exports PDF -------------------------------------------

test("la fiche projet dessine son losange d'après isMilestoneVisual, pas le champ brut", () => {
  const from = html.indexOf("function projectPdfData(");
  assert.ok(from !== -1, "projectPdfData introuvable");
  const source = html.slice(from, from + 6000);
  assert.match(source, /milestone: isMilestoneVisual\(t\)/,
    "rowOf lit encore le champ milestone brut au lieu du critère visuel");
});

test("la fiche mémo n'affiche la capsule « Jalon » que via isMilestoneVisual", () => {
  assert.match(html, /if \(isMilestoneVisual\(f\)\) \{/,
    "la capsule Jalon de la fiche mémo lit encore f.milestone tel quel");
});
