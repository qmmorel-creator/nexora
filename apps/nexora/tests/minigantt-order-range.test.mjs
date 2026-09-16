import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Mêmes règles que les autres suites du Mini-Gantt : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite, entre les sentinelles du bloc.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const START = "// === NEXORA:GANTT-ANNOTATIONS:START ===";
const END = "// === NEXORA:GANTT-ANNOTATIONS:END ===";
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc d'annotations Gantt introuvable dans .build/index.html");

const EXPORTS = [
  "normalizeMiniGanttSort", "normalizeMiniGanttSortDir", "miniGanttSortValue", "miniGanttSortTasks",
  "MINIGANTT_SORT_KEYS", "MINIGANTT_SORT_LABELS",
  "normalizeMiniGanttRange", "miniGanttRangeWindow", "miniGanttClampWindow",
  "ganttShiftMonths", "ganttDayNumber", "MINIGANTT_RANGE_MAX_MONTHS",
  "miniGanttPinnedWindow",
];
const {
  normalizeMiniGanttSort, normalizeMiniGanttSortDir, miniGanttSortValue, miniGanttSortTasks,
  MINIGANTT_SORT_KEYS, MINIGANTT_SORT_LABELS,
  normalizeMiniGanttRange, miniGanttRangeWindow, miniGanttClampWindow,
  ganttShiftMonths, ganttDayNumber, MINIGANTT_RANGE_MAX_MONTHS,
  miniGanttPinnedWindow,
} = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const barre = (id, title, start, end) => ({ id, title, start, end, milestone: false });
const jalon = (id, title, date) => ({ id, title, start: date, end: date, milestone: true });
const ordre = (list) => list.map((t) => t.id).join(" ");

// --- Tri -------------------------------------------------------------------
test("le tri accepte trois clés, et retombe sur la date de début", () => {
  assert.deepEqual(MINIGANTT_SORT_KEYS, ["start", "end", "title"]);
  assert.equal(normalizeMiniGanttSort(undefined), "start");
  assert.equal(normalizeMiniGanttSort("progress"), "start");
  assert.equal(normalizeMiniGanttSort("title"), "title");
  assert.equal(normalizeMiniGanttSortDir(undefined), "asc");
  assert.equal(normalizeMiniGanttSortDir("desc"), "desc");
  assert.equal(normalizeMiniGanttSortDir("n'importe quoi"), "asc");
  // Chaque clé a son libellé : la fiche du widget les rend tels quels.
  MINIGANTT_SORT_KEYS.forEach((k) => assert.ok(MINIGANTT_SORT_LABELS[k], `libellé manquant pour ${k}`));
});

test("un jalon n'a qu'une date : elle vaut début comme fin", () => {
  const m = jalon("m", "Mise en service", "2026-09-18");
  assert.equal(miniGanttSortValue(m, "start"), "2026-09-18");
  assert.equal(miniGanttSortValue(m, "end"), "2026-09-18");
  const b = barre("b", "Travaux", "2026-08-01", "2026-09-30");
  assert.equal(miniGanttSortValue(b, "start"), "2026-08-01");
  assert.equal(miniGanttSortValue(b, "end"), "2026-09-30");
  assert.equal(miniGanttSortValue(b, "title"), "Travaux");
});

test("barres et jalons sont triés ENSEMBLE, dans une seule liste", () => {
  // C'est le reproche d'origine : un jalon de 2022 se retrouvait sous une tâche
  // de 2026 parce que tous les jalons étaient rendus après toutes les barres.
  const list = [
    barre("b2026", "Montage", "2026-01-10", "2026-06-30"),
    jalon("m2022", "Ordre de service", "2022-04-08"),
    barre("b2020", "Déviation RD2", "2020-06-01", "2022-02-15"),
    jalon("m2026", "Mise en service", "2026-05-07"),
  ];
  assert.equal(ordre(miniGanttSortTasks(list, "start", "asc")), "b2020 m2022 b2026 m2026");
  // Par date de fin : la déviation finit le 15/02/2022, avant l'ordre de service.
  assert.equal(ordre(miniGanttSortTasks(list, "end", "asc")), "b2020 m2022 m2026 b2026");
  // Par titre : Déviation, Mise en service, Montage, Ordre de service.
  assert.equal(ordre(miniGanttSortTasks(list, "title", "asc")), "b2020 m2026 b2026 m2022");
});

test("à position égale dans le tri, les jalons passent devant les barres", () => {
  const list = [
    barre("b", "Zèbre", "2026-09-18", "2026-09-18"),
    jalon("m", "Alpha", "2026-09-18"),
  ];
  assert.equal(ordre(miniGanttSortTasks(list, "start", "asc")), "m b");
  // …et le sens du tri ne retourne PAS cette règle : c'est une règle de
  // lisibilité, pas une seconde clé.
  assert.equal(ordre(miniGanttSortTasks(list, "start", "desc")), "m b");
  assert.equal(ordre(miniGanttSortTasks(list, "end", "desc")), "m b");
});

test("le sens décroissant retourne la clé, et le titre départage en dernier", () => {
  const list = [
    barre("a", "Aaa", "2026-01-01", "2026-02-01"),
    barre("c", "Ccc", "2026-03-01", "2026-04-01"),
    barre("b", "Bbb", "2026-02-01", "2026-03-01"),
  ];
  assert.equal(ordre(miniGanttSortTasks(list, "start", "asc")), "a b c");
  assert.equal(ordre(miniGanttSortTasks(list, "start", "desc")), "c b a");
  // Deux barres de mêmes dates : le titre tranche, donc l'ordre est stable.
  const memeDate = [
    barre("z", "Zèbre", "2026-01-01", "2026-02-01"),
    barre("e", "Éléphant", "2026-01-01", "2026-02-01"),
  ];
  assert.equal(ordre(miniGanttSortTasks(memeDate, "start", "asc")), "e z");
  assert.equal(ordre(miniGanttSortTasks(memeDate, "start", "desc")), "e z");
});

test("le tri par titre ignore la casse et les accents, et compte les nombres", () => {
  const list = [
    barre("b10", "Lot 10", "2026-01-01", "2026-02-01"),
    barre("b2", "lot 2", "2026-01-01", "2026-02-01"),
    barre("be", "Élagage", "2026-01-01", "2026-02-01"),
  ];
  assert.equal(ordre(miniGanttSortTasks(list, "title", "asc")), "be b2 b10");
});

test("le tri ne modifie jamais la liste d'origine", () => {
  const list = [barre("b", "B", "2026-02-01", "2026-03-01"), barre("a", "A", "2026-01-01", "2026-02-01")];
  const copie = [...list];
  miniGanttSortTasks(list, "start", "asc");
  assert.deepEqual(list, copie);
  assert.deepEqual(miniGanttSortTasks(null, "start", "asc"), []);
  assert.deepEqual(miniGanttSortTasks(undefined, "start", "asc"), []);
});

// --- Étendue temporelle ----------------------------------------------------
test("un widget sans réglage de cadrage reste en automatique", () => {
  assert.deepEqual(normalizeMiniGanttRange(undefined), { mode: "auto", includeToday: true, beforeMonths: 3, afterMonths: 12 });
  assert.equal(normalizeMiniGanttRange({ mode: "glissant" }).mode, "auto");
  assert.equal(normalizeMiniGanttRange({ mode: "rolling" }).mode, "rolling");
  // Les mois sont bornés : ni négatifs, ni au-delà du plafond, ni NaN.
  assert.equal(normalizeMiniGanttRange({ beforeMonths: -5 }).beforeMonths, 0);
  assert.equal(normalizeMiniGanttRange({ afterMonths: 9999 }).afterMonths, MINIGANTT_RANGE_MAX_MONTHS);
  assert.equal(normalizeMiniGanttRange({ beforeMonths: "abc" }).beforeMonths, 3);
  assert.equal(normalizeMiniGanttRange({ beforeMonths: "6" }).beforeMonths, 6);
});

test("le cadrage automatique couvre les tâches, et inclut aujourd'hui sur demande", () => {
  const bounds = { minIdx: ganttDayNumber("2026-01-01"), maxIdx: ganttDayNumber("2026-06-30"), todayIdx: ganttDayNumber("2026-09-16"), todayIso: "2026-09-16" };
  // Par défaut, aujourd'hui élargit la fenêtre : c'est le comportement historique.
  assert.deepEqual(miniGanttRangeWindow({ mode: "auto" }, bounds), { minIdx: bounds.minIdx, maxIdx: bounds.todayIdx });
  // Décoché, l'axe colle aux tâches et n'affiche plus de vide jusqu'à aujourd'hui.
  assert.deepEqual(miniGanttRangeWindow({ mode: "auto", includeToday: false }, bounds), { minIdx: bounds.minIdx, maxIdx: bounds.maxIdx });
});

test("la fenêtre glissante se compte en mois autour d'aujourd'hui", () => {
  const w = miniGanttRangeWindow({ mode: "rolling", beforeMonths: 3, afterMonths: 12 }, { todayIso: "2026-09-16", todayIdx: ganttDayNumber("2026-09-16") });
  assert.equal(w.minIdx, ganttDayNumber("2026-06-16"));
  assert.equal(w.maxIdx, ganttDayNumber("2027-09-16"));
  // Elle ne dépend PAS des tâches : c'est tout son intérêt, l'axe avance seul.
  const memeFenetre = miniGanttRangeWindow({ mode: "rolling", beforeMonths: 3, afterMonths: 12 }, { todayIso: "2026-09-16", minIdx: 0, maxIdx: 10 });
  assert.deepEqual(memeFenetre, w);
  // Un mois plus court ne fabrique jamais de date inexistante.
  assert.equal(ganttShiftMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(ganttShiftMonths("2024-03-31", -1), "2024-02-29");
  assert.equal(ganttShiftMonths("2026-01-15", -1), "2025-12-15");
  assert.equal(ganttShiftMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(ganttShiftMonths("pas une date", 1), null);
});

test("le cadrage à dates fixes ne se calcule pas ici : il vit dans miniGanttWindow", () => {
  assert.equal(miniGanttRangeWindow({ mode: "fixed" }, { minIdx: 0, maxIdx: 10, todayIdx: 5 }), null);
  // Et la fiche du widget écrit bien la fenêtre là, pas ailleurs.
  assert.match(html, /data\.miniGanttWindow = miniGanttRange\.mode === "fixed"/);
});

test("le zoom manuel ne montre plus des années vides pendant qu'il coupe les tâches", () => {
  /* Le cas de la capture : les tâches vont de 2019 à fin 2026, aujourd'hui est
     en septembre 2026. Centrée sur aujourd'hui, la fenêtre partait jusqu'en
     2030 — vide — et coupait tout ce qui précédait 2023. */
  const bornes = { minIdx: ganttDayNumber("2019-01-01"), maxIdx: ganttDayNumber("2026-09-21") };
  const centreeSurAujourdhui = { minIdx: ganttDayNumber("2022-11-01"), maxIdx: ganttDayNumber("2030-07-01") };
  const recadree = miniGanttClampWindow(centreeSurAujourdhui, bornes);
  const largeurDemandee = centreeSurAujourdhui.maxIdx - centreeSurAujourdhui.minIdx;
  // La largeur demandée est CONSERVÉE — le zoom n'est pas trahi…
  assert.equal(recadree.maxIdx - recadree.minIdx, largeurDemandee);
  // …mais il n'y a plus rien de vide après la dernière tâche…
  assert.equal(recadree.maxIdx, bornes.maxIdx);
  // …et l'axe repart au ras des premières, au lieu de les couper de trois ans.
  assert.ok(recadree.minIdx >= bornes.minIdx, "la fenêtre ne dépasse plus à gauche");
  assert.ok(recadree.minIdx - bornes.minIdx < 30, `il ne reste que ${recadree.minIdx - bornes.minIdx} jours masqués au début, contre plus de 1 400 avant`);
  assert.ok(centreeSurAujourdhui.minIdx - bornes.minIdx > 1000,
    `la fenêtre d'origine masquait ${centreeSurAujourdhui.minIdx - bornes.minIdx} jours de tâches au début`);
});

test("recadrer fait GLISSER la fenêtre, jamais rétrécir", () => {
  const bornes = { minIdx: 100, maxIdx: 200 };
  // Débordement à droite : la fenêtre recule d'autant, largeur intacte.
  assert.deepEqual(miniGanttClampWindow({ minIdx: 150, maxIdx: 230 }, bornes), { minIdx: 120, maxIdx: 200 });
  // Débordement à gauche : elle avance.
  assert.deepEqual(miniGanttClampWindow({ minIdx: 60, maxIdx: 140 }, bornes), { minIdx: 100, maxIdx: 180 });
  // Déjà dedans : on n'y touche pas.
  assert.deepEqual(miniGanttClampWindow({ minIdx: 120, maxIdx: 180 }, bornes), { minIdx: 120, maxIdx: 180 });
  // Plus large que les bornes : elle les épouse, il n'y a rien au-delà.
  assert.deepEqual(miniGanttClampWindow({ minIdx: 0, maxIdx: 400 }, bornes), { minIdx: 100, maxIdx: 200 });
  // Bornes dégénérées : rendues telles quelles plutôt que de lever.
  assert.deepEqual(miniGanttClampWindow({ minIdx: 1, maxIdx: 2 }, null), { minIdx: 1, maxIdx: 2 });
});

// --- Branchement dans le widget --------------------------------------------
test("le widget rend une seule liste triée, et n'écrase plus les tâches hors fenêtre", () => {
  // Une seule liste : plus de « toutes les barres puis tous les jalons ».
  assert.match(html, /\{orderedTasks\.map\(\(t\) => \(t\.milestone \? MilestoneRow\(t\) : Row\(t\)\)\)\}/);
  assert.doesNotMatch(html, /\{projTasks\.map\(Row\)\}/);
  // Le regroupement retrie chaque groupe, sinon l'ordre ne vaudrait que dans le premier.
  assert.match(html, /tasks: miniGanttSortTasks\(g\.tasks, sortKey, sortDir\)/);
  // Une barre entièrement hors fenêtre n'est plus écrasée contre le bord.
  assert.match(html, /if \(\(rawEndIdx < minIdx \|\| rawStartIdx > maxIdx\) && !cmpInWindow\) return null;/);
  // Et le zoom manuel passe par le recadrage.
  assert.match(html, /const manualWindow = miniGanttClampWindow\(/);
});

// --- Cadrage automatique : la plus ancienne et la plus lointaine ------------
//
// Deux causes, un seul symptôme : « le mode automatique cache des choses de
// 2022 mais me montre 2027, 2028, 2029 qui ne contiennent rien » (retour de
// test). Le passé était tronqué d'un côté sans que rien ne borne l'autre.

test("le filtre « X jours dans le passé » ne tronque plus l'axe", () => {
  // Le filtre ne regarde que la date de FIN : une tâche démarrée bien avant la
  // fenêtre le passe, et se retrouvait pourtant amputée de son début.
  // Le cadrage automatique se cale désormais sur l'étendue naturelle, point.
  assert.match(html, /const filteredMinIdx = naturalMinIdx;/);
  // Plus aucune borne gauche dérivée du filtre…
  assert.doesNotMatch(html, /const filterMinIdx =/);
  // …et la prop n'est plus transmise au widget, faute d'emploi.
  assert.doesNotMatch(html, /function WidgetMiniGantt\(\{[^}]*pastDays/);
  // Le filtre lui-même, qui choisit les TÂCHES, est intact.
  assert.match(html, /if \(f\.pastDays !== "" && f\.pastDays != null\) \{/);
});

test("la fenêtre figée héritée cède la place dès qu'un cadrage est choisi", () => {
  const fenetre = { start: "2023-01-01", end: "2029-12-31" };
  // Widget d'avant le réglage d'étendue : la fenêtre héritée s'applique encore,
  // exactement comme avant — aucune migration.
  const heritee = miniGanttPinnedWindow({ miniGanttWindow: fenetre });
  assert.equal(heritee.minIdx, ganttDayNumber("2023-01-01"));
  assert.equal(heritee.maxIdx, ganttDayNumber("2029-12-31"));
  // Elle reste la mémoire du cadrage « Dates fixes » : c'est là que ses deux
  // dates sont rangées, et ce mode continue donc de les lire.
  const fixe = miniGanttPinnedWindow({ miniGanttWindow: fenetre, miniGanttRange: { mode: "fixed" } });
  assert.equal(fixe.minIdx, ganttDayNumber("2023-01-01"));
  // Mais elle ne survit plus à un AUTRE choix : sinon le mode automatique
  // restait sans effet visible, et rien dans l'interface ne disait pourquoi.
  assert.equal(miniGanttPinnedWindow({ miniGanttWindow: fenetre, miniGanttRange: { mode: "auto" } }), null);
  assert.equal(miniGanttPinnedWindow({ miniGanttWindow: fenetre, miniGanttRange: { mode: "rolling", beforeMonths: 3, afterMonths: 3 } }), null);
});

test("une fenêtre héritée incomplète ou illisible est ignorée", () => {
  assert.equal(miniGanttPinnedWindow({}), null);
  assert.equal(miniGanttPinnedWindow(null), null);
  assert.equal(miniGanttPinnedWindow({ miniGanttWindow: { start: "2023-01-01" } }), null);
  assert.equal(miniGanttPinnedWindow({ miniGanttWindow: { start: "hier", end: "demain" } }), null);
  // Bornes inversées : la fenêtre garde au moins un jour de largeur.
  const plate = miniGanttPinnedWindow({ miniGanttWindow: { start: "2026-05-10", end: "2026-05-10" } });
  assert.equal(plate.maxIdx - plate.minIdx, 1);
});

test("en mode auto, la fenêtre couvre l'étendue entière, des deux côtés", () => {
  const bornes = {
    minIdx: ganttDayNumber("2022-03-01"),
    maxIdx: ganttDayNumber("2026-11-30"),
    todayIdx: ganttDayNumber("2026-09-16"),
    todayIso: "2026-09-16",
  };
  const w = miniGanttRangeWindow({ mode: "auto" }, bornes);
  assert.equal(w.minIdx, ganttDayNumber("2022-03-01"), "la plus ancienne date reste dans le cadre");
  assert.equal(w.maxIdx, ganttDayNumber("2026-11-30"), "et la plus lointaine aussi");
});

// --- La vue Gantt reprend les réglages du widget (#80) ----------------------
//
// Un même diagramme se pilotait de deux façons selon qu'on le regardait dans un
// tableau de bord ou en pleine page : la vue n'avait qu'un extrait de la barre
// d'outils dans l'en-tête de page, et il fallait ouvrir les réglages pour le
// reste.

test("la vue porte la MÊME barre d'outils que le widget", () => {
  // La bande pleine largeur n'est plus conditionnée à l'absence de slot : elle
  // est rendue dans les deux cas, widget comme vue.
  assert.doesNotMatch(html, /!toolbarSlot && toolbar/);
  // L'en-tête de page ne garde que ce qui lui est propre — les commandes
  // reprises dans la bande n'y sont plus en double.
  const portail = html.slice(html.indexOf("const viewToolbar = toolbarSlot ?"), html.indexOf("const Axis = () =>"));
  assert.match(portail, /Réglages de la vue/);
  assert.match(portail, /Regroupement des lignes/);
  assert.doesNotMatch(portail, /Zoom arrière/);
  assert.doesNotMatch(portail, /Ajouter un bloc/);
});

test("la vue a son propre filtre de tâches, qui resserre sans se substituer", () => {
  // Même composant de formulaire que le widget : mêmes champs, mêmes règles.
  const reglages = html.slice(html.indexOf("function MiniGanttViewSettings"), html.indexOf("function MiniGanttView("));
  assert.match(reglages, /Filtrer les tâches prises en compte/);
  assert.match(reglages, /<TaskFilterFields/);
  // Il s'applique PAR-DESSUS les tâches déjà filtrées par la page.
  assert.match(html, /widget\.filter \? applyWidgetFilter\(tasks \|\| \[\], widget\.filter, ctx\) : \(tasks \|\| \[\]\)/);
  // Et la préférence est normalisée comme les autres : absente = aucun filtre.
  assert.match(html, /filter: old\.filter && typeof old\.filter === "object" \? old\.filter : null/);
});

test("le cadre d'un bloc temporel passe devant les lignes, son remplissage derrière", () => {
  // Deux couches, et pas une : le remplissage situe, le cadre délimite.
  assert.match(html, /\.lp-widget-minigantt-band-frames\{ position:absolute; z-index:6;/);
  assert.match(html, /\.lp-widget-minigantt-band-layer\{ position:absolute; z-index:0;/);
  // Le remplissage ne porte plus de trait, le cadre ne porte plus de fond.
  assert.match(html, /"lp-widget-minigantt-tblock-frame"/);
  assert.match(html, /\.lp-widget-minigantt-tblock-frame\{[^}]*background:transparent;/);
});

test("l'axe sépare la métrique de ses bornes, sur deux lignes", () => {
  // Les bornes de la fenêtre et les graduations partageaient la même ligne,
  // dédoublonnées par la seule égalité des dates : une borne au 12/03/2022 et
  // la graduation « 2022 » se superposaient à quelques pixels près.
  assert.doesNotMatch(html, /axisDisplayTicks/);
  assert.match(html, /"lp-widget-minigantt-axis-edge-label edge-"/);
  // L'unité est la métrique : plus grande et plus sombre que les bornes.
  const metrique = html.slice(html.indexOf(".lp-widget-minigantt-axis-tick-label{"), html.indexOf(".lp-widget-minigantt-axis-edge-label{"));
  assert.match(metrique, /font-size:11px/);
  assert.match(metrique, /color:var\(--text-900\)/);
  const bornes = html.slice(html.indexOf(".lp-widget-minigantt-axis-edge-label{"));
  assert.match(bornes.slice(0, 400), /font-size:8\.5px/);
});
