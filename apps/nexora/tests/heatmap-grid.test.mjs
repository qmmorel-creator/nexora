/* Heat map en grille (issue #51).
   Comme les autres blocs, la tranche testée est extraite du bundle RÉELLEMENT
   construit. Elle s'appuie sur les palettes et le score de criticité du
   Treemap : les tranches sont concaténées, jamais recopiées. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans dist/index.html`);
  return html.slice(from + start.length, to);
}

const EXPORTS = [
  "HEATMAP_AXIS_FIELDS", "HEATMAP_METRICS", "HEATMAP_AXIS_LABELS", "HEATMAP_METRIC_LABELS",
  "HEATMAP_MAX_MONTHS", "HEATMAP_MIN_COLOR_SPAN",
  "heatmapCellKey", "heatmapMonthOf", "heatmapMonthRange", "heatmapMonthAxis",
  "heatmapCellValue", "heatmapBuildGrid", "heatmapColorDomain", "heatmapNormalizeConfig",
  "heatmapMonthLabel", "heatmapOrderCriticalities",
  "TREEMAP_CRITICALITY_WEIGHTS",
];

// Évalué dans le realm courant : deepStrictEqual exige des prototypes partagés.
const H = vm.runInThisContext(
  `(function () {\n${slice("COLOR-UTILS")}\n${slice("PROJECT-TREEMAP")}\n${slice("HEATMAP-GRID")}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const projets = [{ id: "p1", name: "Lot 2B" }, { id: "p2", name: "CTEX6" }];
const statuts = [{ id: "s1", name: "À planifier" }, { id: "s2", name: "En cours" }];
const parProjet = (t) => t.projectId;
const parStatut = (t) => t.statusId;
const cell = (grid, r, c) => grid.cells.get(H.heatmapCellKey(r, c));

test("les axes et les métriques annoncés sont tous étiquetés", () => {
  H.HEATMAP_AXIS_FIELDS.forEach((k) => assert.ok(H.HEATMAP_AXIS_LABELS[k], `axe « ${k} » sans libellé`));
  H.HEATMAP_METRICS.forEach((k) => assert.ok(H.HEATMAP_METRIC_LABELS[k], `métrique « ${k} » sans libellé`));
});

test("une case vide et une case à zéro ne sont pas la même information", () => {
  // « Aucune tâche à ce croisement » n'est pas « des tâches, mais aucune en
  // retard ». Confondre les deux, c'est afficher un zéro là où l'on ne sait rien.
  const grid = H.heatmapBuildGrid({
    tasks: [{ id: "t1", projectId: "p1", statusId: "s1" }],
    rowEntities: projets, colEntities: statuts,
    rowIdOf: parProjet, colIdOf: parStatut,
    metric: "late", factsOf: () => ({ late: false }),
  });
  const zero = cell(grid, "p1", "s1");
  assert.ok(zero, "le croisement porte une tâche : la case doit exister");
  assert.equal(zero.value, 0, "aucune tâche en retard : la valeur est zéro");
  assert.equal(zero.count, 1, "mais une tâche est bien là");
  assert.equal(cell(grid, "p2", "s2"), undefined, "aucune tâche à ce croisement : pas de case du tout");
});

test("la grille ne fabrique jamais de ligne ni de colonne à partir des tâches", () => {
  // Une valeur erronée en base créerait sinon une case que rien ne saurait
  // nommer. Les tâches écartées sont comptées, pour que l'écart se voie.
  const grid = H.heatmapBuildGrid({
    tasks: [
      { id: "t1", projectId: "p1", statusId: "s1" },
      { id: "t2", projectId: "p9-inconnu", statusId: "s1" },
      { id: "t3", projectId: "p1", statusId: "s9-inconnu" },
      { id: "t4", projectId: "p1" },
    ],
    rowEntities: projets, colEntities: statuts,
    rowIdOf: parProjet, colIdOf: parStatut,
  });
  assert.deepEqual(grid.rows.map((r) => r.id), ["p1", "p2"]);
  assert.deepEqual(grid.cols.map((c) => c.id), ["s1", "s2"]);
  assert.equal(grid.cells.size, 1);
  assert.equal(grid.ignored, 3, "les trois tâches hors grille doivent être comptées");
});

test("chaque tâche de la grille est comptée une fois et une seule", () => {
  const tasks = [
    { id: "t1", projectId: "p1", statusId: "s1" },
    { id: "t2", projectId: "p1", statusId: "s1" },
    { id: "t3", projectId: "p1", statusId: "s2" },
    { id: "t4", projectId: "p2", statusId: "s2" },
  ];
  const grid = H.heatmapBuildGrid({
    tasks, rowEntities: projets, colEntities: statuts, rowIdOf: parProjet, colIdOf: parStatut,
  });
  const total = [...grid.cells.values()].reduce((n, c) => n + c.count, 0);
  assert.equal(total + grid.ignored, tasks.length);
  const vus = [...grid.cells.values()].flatMap((c) => c.tasks.map((t) => t.id));
  assert.equal(new Set(vus).size, vus.length, "une tâche ne doit pas apparaître dans deux cases");
  assert.equal(cell(grid, "p1", "s1").count, 2);
});

test("chaque métrique mesure bien ce qu'elle annonce", () => {
  const tasks = [
    { id: "a", progress: 0 },
    { id: "b", progress: 100 },
    { id: "c", progress: 50 },
  ];
  const enRetard = (t) => ({ late: t.id !== "c" });
  assert.equal(H.heatmapCellValue(tasks, "count", () => ({})), 3);
  assert.equal(H.heatmapCellValue(tasks, "late", enRetard), 2);
  assert.equal(H.heatmapCellValue(tasks, "progress", () => ({})), 50);
  // La criticité réutilise le score du Treemap : deux widgets côte à côte
  // doivent donner la même valeur à la même tâche.
  assert.equal(
    H.heatmapCellValue([{ id: "a" }], "criticality", () => ({ late: true })),
    H.TREEMAP_CRITICALITY_WEIGHTS.late,
  );
  assert.equal(H.heatmapCellValue([], "count", () => ({})), 0);
});

test("une progression aberrante est ramenée entre 0 et 100", () => {
  assert.equal(H.heatmapCellValue([{ progress: 500 }, { progress: -80 }], "progress", () => ({})), 50);
  assert.equal(H.heatmapCellValue([{ progress: "x" }], "progress", () => ({})), 0);
});

test("le mois d'une échéance, et rien d'autre", () => {
  assert.equal(H.heatmapMonthOf("2026-09-15"), "2026-09");
  for (const mauvais of [null, undefined, "", "demain", 20260915, "26-09-15"]) {
    assert.equal(H.heatmapMonthOf(mauvais), null, `« ${mauvais} » ne doit pas produire de mois`);
  }
});

test("la suite des mois est contiguë, y compris à cheval sur une année", () => {
  // Sauter un mois sans tâche laisserait croire que deux colonnes voisines sont
  // consécutives alors qu'un mois vide les sépare.
  assert.deepEqual(H.heatmapMonthRange("2026-11", "2027-02"), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.deepEqual(H.heatmapMonthRange("2026-09", "2026-09"), ["2026-09"]);
  assert.deepEqual(H.heatmapMonthRange("2027-01", "2026-01"), [], "bornes inversées : rien");
  assert.deepEqual(H.heatmapMonthRange(null, "2026-01"), []);
});

test("l'axe des mois comble les trous entre deux échéances éloignées", () => {
  const axe = H.heatmapMonthAxis(["2026-09", "2026-12"], "2026-09-15");
  assert.deepEqual(axe.ids, ["2026-09", "2026-10", "2026-11", "2026-12"]);
  assert.equal(axe.before, false);
  assert.equal(axe.after, false);
});

test("au-delà du plafond, l'axe des mois se borne mais ne jette rien", () => {
  // Borner l'affichage ne doit jamais revenir à filtrer les données : les mois
  // écartés sont signalés des deux côtés.
  const axe = H.heatmapMonthAxis(["2010-01", "2040-01"], "2026-09-15");
  assert.equal(axe.ids.length, H.HEATMAP_MAX_MONTHS);
  assert.ok(axe.before, "des mois sont écartés avant : il faut le dire");
  assert.ok(axe.after, "des mois sont écartés après : il faut le dire");
  // La plage retenue doit contenir le mois de référence — c'est de là qu'on regarde.
  assert.ok(axe.ids.includes("2026-09"), `le mois courant est hors de la plage retenue (${axe.ids[0]} → ${axe.ids[axe.ids.length - 1]})`);
});

test("sans aucune échéance, l'axe des mois est vide plutôt qu'inventé", () => {
  assert.deepEqual(H.heatmapMonthAxis([], "2026-09-15"), { ids: [], before: false, after: false });
  assert.deepEqual(H.heatmapMonthAxis([null, undefined], "2026-09-15").ids, []);
});

test("criticité et progression gardent un domaine fixe de 0 à 100", () => {
  // Deux heat maps côte à côte doivent donner la même couleur à la même valeur.
  const cells = new Map([["x", { value: 12 }]]);
  assert.deepEqual(H.heatmapColorDomain(cells, "criticality"), { min: 0, max: 100 });
  assert.deepEqual(H.heatmapColorDomain(cells, "progress"), { min: 0, max: 100 });
});

test("un comptage minuscule n'affiche pas tout au maximum de l'échelle", () => {
  // Sans plancher, la case à deux tâches d'une grille minuscule sortirait à la
  // couleur la plus forte — celle qu'on veut réserver aux valeurs élevées.
  const domaine = H.heatmapColorDomain(new Map([["a", { value: 2 }], ["b", { value: 1 }]]), "count");
  assert.equal(domaine.max, H.HEATMAP_MIN_COLOR_SPAN);
  assert.equal(H.heatmapColorDomain(new Map([["a", { value: 40 }]]), "count").max, 40);
  assert.equal(H.heatmapColorDomain(new Map(), "count").max, H.HEATMAP_MIN_COLOR_SPAN);
});

test("deux axes identiques ne donneraient qu'une diagonale : la config les sépare", () => {
  assert.equal(H.heatmapNormalizeConfig({ heatmapRowField: "status", heatmapColField: "status" }).colField, "project");
  assert.equal(H.heatmapNormalizeConfig({ heatmapRowField: "project", heatmapColField: "project" }).colField, "status");
  const garde = H.heatmapNormalizeConfig({ heatmapRowField: "criticality", heatmapColField: "month" });
  assert.deepEqual([garde.rowField, garde.colField], ["criticality", "month"]);
});

test("un réglage inconnu retombe sur un défaut utilisable", () => {
  const cfg = H.heatmapNormalizeConfig({ heatmapRowField: "inventé", heatmapColField: "aussi", heatmapMetric: "nimporte", heatmapPalette: "rose" });
  assert.deepEqual([cfg.rowField, cfg.colField], ["project", "status"]);
  assert.equal(cfg.metric, "count");
  assert.ok(cfg.palette, "une palette valide est toujours choisie");
  assert.equal(H.heatmapNormalizeConfig(undefined).rowField, "project");
});

test("un mois s'abrège sans devenir illisible, et une valeur douteuse ne casse rien", () => {
  // L'en-tête d'une colonne ne peut pas porter « Septembre 2026 » sans écraser
  // les autres : l'abrégé n'est pas une coquetterie.
  assert.equal(H.heatmapMonthLabel("2026-09"), "sept. 26");
  assert.equal(H.heatmapMonthLabel("2027-01"), "janv. 27");
  assert.equal(H.heatmapMonthLabel("2026-12"), "déc. 26");
  for (const mauvais of ["2026-13", "2026-00", "abc", "", null, undefined]) {
    const out = H.heatmapMonthLabel(mauvais);
    assert.equal(typeof out, "string", `« ${mauvais} » doit rendre une chaîne, pas planter l'en-tête`);
  }
});

test("sur un axe, la criticité se lit de la plus urgente à la moins urgente", () => {
  // CRITICALITIES est déclaré du plus bas au plus haut — hors des sentinelles,
  // donc reproduit ici dans cet ordre-là : repris tel quel, l'axe mettait
  // « Bas » en tête, là où l'œil doit tomber sur « Urgent ». Que la fonction
  // soit bien appliquée à la vraie liste est tenu par un invariant de dépôt.
  const declare = [{ id: "bas" }, { id: "moyen" }, { id: "urgent" }];
  assert.deepEqual(H.heatmapOrderCriticalities(declare).map((c) => c.id), ["urgent", "moyen", "bas"]);
  // Une valeur inconnue passe en dernier plutôt que de remonter en tête.
  const avecInconnue = H.heatmapOrderCriticalities([{ id: "bas" }, { id: "zzz" }, { id: "urgent" }]);
  assert.deepEqual(avecInconnue.map((c) => c.id), ["urgent", "bas", "zzz"]);
  assert.deepEqual(H.heatmapOrderCriticalities([]), []);
  assert.deepEqual(H.heatmapOrderCriticalities(null), []);
});
