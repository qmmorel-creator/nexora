/* Focus Journée (#333) : widget mono-jour qui réutilise EXACTEMENT le zoom
   jour du Calendrier (calendarDayModel, testé à part dans calendar.test.mjs)
   — cette suite ne couvre que ce qui est PROPRE à Focus Journée : la date
   affichée par le widget (normalizeFocusDayDate), le bouton « Aujourd'hui »
   et le changement de jour via le sélecteur de date. Même principe que les
   autres suites : la tranche testée est extraite du bundle RÉELLEMENT
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
    iso, addDays, normalizeFocusDayDate, calendarDayModel,
  };\n})`
)();

// Le widget stocke la date choisie dans widget.focusDayDate, exactement
// comme staffingOffset pour Charge personnel : un patch sur LA CONFIGURATION
// DU WIDGET, jamais un état partagé ailleurs. On simule ici ce cycle
// « widget → setDate → onUpdateWidget » sans avoir besoin de React.
function makeWidget(focusDayDate) {
  return { id: "w1", type: "focusDay", focusDayDate };
}
function setDate(widget, next) {
  return { ...widget, focusDayDate: C.normalizeFocusDayDate(next) };
}

const statuses = [{ id: "s1", name: "À planifier" }, { id: "s2", name: "En cours" }, { id: "s3", name: "Terminé" }];
const projects = [{ id: "p1", name: "PCH VA", color: "#245edb" }];
const ctx = { statuses, taskTypes: [], projects };
const task = (id, extra) => ({ id, title: `Tâche ${id}`, projectId: "p1", statusId: "s1", start: "2026-09-23", end: "2026-09-23", ...extra });

test("normalizeFocusDayDate : une date ISO valide reste inchangée", () => {
  assert.equal(C.normalizeFocusDayDate("2026-09-23"), "2026-09-23");
  assert.equal(C.normalizeFocusDayDate("2026-01-01"), "2026-01-01");
});

test("normalizeFocusDayDate : absente, vide ou invalide retombe sur aujourd'hui", () => {
  const today = C.iso(new Date());
  for (const bad of [undefined, null, "", "23/09/2026", "2026-9-23", 42, {}]) {
    assert.equal(C.normalizeFocusDayDate(bad), today, `« ${bad} » doit retomber sur aujourd'hui`);
  }
});

test("calcul des tâches du jour affiché : le widget interroge calendarDayModel sur SA date, pas sur aujourd'hui", () => {
  const tasks = [
    task("t1", { start: "2026-09-23", end: "2026-09-23", startTime: "09:00", endTime: "10:00" }),
    task("t2", { start: "2026-09-23", end: "2026-09-23" }), // journée entière
    task("t3", { start: "2026-09-24", end: "2026-09-24", startTime: "14:00", endTime: "15:00" }), // un autre jour
  ];
  const widget = makeWidget("2026-09-23");
  const model = C.calendarDayModel(tasks, ctx, C.normalizeFocusDayDate(widget.focusDayDate));
  assert.equal(model.date, "2026-09-23");
  assert.equal(model.total, 2, "seules les tâches du 23 comptent");
  assert.deepEqual(model.timed.map((r) => r.task.id), ["t1"]);
  assert.deepEqual(model.allDay.map((r) => r.task.id), ["t2"]);

  const nextDayModel = C.calendarDayModel(tasks, ctx, "2026-09-24");
  assert.equal(nextDayModel.total, 1);
  assert.deepEqual(nextDayModel.timed.map((r) => r.task.id), ["t3"]);
});

test("bouton « Aujourd'hui » : ramène toujours la date affichée sur le jour courant", () => {
  const today = C.iso(new Date());
  const yesterday = C.addDays(today, -1);
  let widget = makeWidget(yesterday);
  assert.equal(widget.focusDayDate, yesterday);

  widget = setDate(widget, today); // clic sur « Aujourd'hui »
  assert.equal(widget.focusDayDate, today);

  // Rejouer le bouton depuis n'importe quelle date, y compris déjà aujourd'hui,
  // reste idempotent.
  widget = setDate(widget, today);
  assert.equal(widget.focusDayDate, today);
});

test("sélecteur de date : choisir un jour change la seule date du widget, et donc les tâches affichées", () => {
  const tasks = [
    task("past", { start: "2026-09-20", end: "2026-09-20" }),
    task("future", { start: "2026-10-05", end: "2026-10-05", startTime: "08:00", endTime: "09:00" }),
  ];
  let widget = makeWidget("2026-09-23");
  widget = setDate(widget, "2026-10-05"); // saisie de l'input type="date"
  assert.equal(widget.focusDayDate, "2026-10-05");

  const model = C.calendarDayModel(tasks, ctx, widget.focusDayDate);
  assert.equal(model.total, 1);
  assert.deepEqual(model.timed.map((r) => r.task.id), ["future"]);
});

test("sélecteur de date : une saisie vide ou invalide ne casse pas le widget (retombe sur aujourd'hui)", () => {
  const today = C.iso(new Date());
  let widget = makeWidget("2026-09-23");
  widget = setDate(widget, "");
  assert.equal(widget.focusDayDate, today);
});

/* Retour de test (Ref #333, réouverte) : le mode `compact` de
   CalendarDayTimeline — ajouté pour la mini-grille du widget Calendrier —
   supprime les hachures des heures creuses et la ligne statut/échéance sous
   le titre de chaque tâche. Focus Journée n'a pas de grille semaine/mois à
   alléger, donc rien ne justifie qu'il perde ce détail visuel : il doit
   appeler CalendarDayTimeline SANS `compact`, pour un rendu identique à celui
   du Calendrier plein écran (CalendarView, non compact) sur le même jour. */
test("Focus Journée appelle CalendarDayTimeline sans `compact` (même esthétique que le Calendrier plein écran)", () => {
  assert.match(
    html,
    /<CalendarDayTimeline dateIso=\{dateIso\} tasks=\{tasks\} ctx=\{ctx\} onOpen=\{onOpen\} fit \/>/,
    "WidgetFocusDay doit réutiliser CalendarDayTimeline sans compact (hachures et ligne statut/échéance à conserver)"
  );
  assert.doesNotMatch(
    html,
    /<CalendarDayTimeline dateIso=\{dateIso\} tasks=\{tasks\} ctx=\{ctx\} onOpen=\{onOpen\} compact \/>/,
    "le mode compact de CalendarDayTimeline ne doit plus être utilisé par Focus Journée"
  );
});

/* Retour de test (Ref #333) : un widget Focus Journée bas ne doit jamais
   cumuler un défilement vertical du corps du widget ET un défilement
   horizontal de la frise — une seule barre de défilement à la fois, comme
   pour le Treemap (#332). `.lp-cal-day-fit` fait de `.lp-cal-track-scroll`
   l'unique conteneur qui défile (dans les deux sens si besoin) à la place du
   corps du widget. */
test("le mode `fit` de CalendarDayTimeline fait de la frise l'unique conteneur qui défile (pas de double défilement)", () => {
  assert.match(html, /\.lp-cal-day-fit\{ height:100%; \}/);
  assert.match(html, /\.lp-cal-day-fit \.lp-cal-track-scroll\{ flex:1 1 auto; min-height:0; overflow:auto; \}/);
});

/* Retour de test (Ref #343) : le mode `fit` seul ne suffisait pas — le corps
   générique du widget (.lp-widget-body) garde par défaut son propre
   overflow:auto vertical (prévu pour les widgets qui débordent), qui
   s'ajoutait PAR-DESSUS le défilement déjà porté par .lp-cal-track-scroll dès
   que le contenu total (en-tête récap + chips + frise) dépassait la hauteur
   du widget — deux barres de défilement en même temps, capture jointe à
   l'issue #343. Même correctif que pour le Treemap (#332,
   .lp-widget-treemap-scroll en overflow:hidden) : le corps du widget ne défile
   plus jamais quand il porte Focus Journée (.lp-cal-day-fit), seule
   .lp-cal-track-scroll reste le conteneur qui défile. */
test("le corps du widget ne défile plus jamais par-dessus Focus Journée (une seule barre de défilement à la fois, Ref #343)", () => {
  assert.match(
    html,
    /\.lp-widget-body:has\(\.lp-cal-day-fit\)\{ overflow:hidden; \}/,
    "le corps générique du widget (.lp-widget-body) doit passer en overflow:hidden quand il porte Focus Journée (.lp-cal-day-fit), comme pour le Treemap (#332)"
  );
});
