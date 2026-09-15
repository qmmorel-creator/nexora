/* Nuage de points « échéances » (issue #46).
   La tranche pure est extraite du bundle construit : le test porte sur ce qui
   est réellement déployé. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:DEADLINE-SCATTER:START ===";
const END = "// === NEXORA:DEADLINE-SCATTER:END ===";
const EXPORTS = [
  "SCATTER_LANE_FIELDS", "SCATTER_POINT_RADIUS", "SCATTER_POINT_GAP",
  "SCATTER_LANE_LABEL_LIMIT", "SCATTER_MIN_SPAN_DAYS",
  "scatterDaysToDeadline", "scatterBuildLanes", "scatterPackLane",
  "scatterVisibleLabels", "scatterDomain",
];

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START), to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc du nuage de points introuvable dans dist/index.html");
const {
  SCATTER_LANE_FIELDS, SCATTER_POINT_RADIUS, SCATTER_POINT_GAP,
  SCATTER_LANE_LABEL_LIMIT, SCATTER_MIN_SPAN_DAYS,
  scatterDaysToDeadline, scatterBuildLanes, scatterPackLane, scatterVisibleLabels, scatterDomain,
} = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const laneOf = (t) => ({ key: t.projectId, label: t.projectId, color: "#000", order: 0 });

test("le retard est négatif, l'avance positive, aujourd'hui vaut zéro", () => {
  assert.equal(scatterDaysToDeadline("2026-09-20", "2026-09-15"), 5);
  assert.equal(scatterDaysToDeadline("2026-09-15", "2026-09-15"), 0, "Due aujourd'hui n'est pas en retard.");
  assert.equal(scatterDaysToDeadline("2026-09-10", "2026-09-15"), -5);
});

test("une échéance portant une heure reste comptée au bon jour", () => {
  // Cas réel : une date venue de Google Calendar peut arriver horodatée.
  // Sans ancrage à une heure fixe, l'écart cesse d'être un multiple exact de la
  // journée et l'arrondi se met à trancher — un jour de plus ou de moins.
  assert.equal(scatterDaysToDeadline("2026-09-20", "2026-09-15"), 5);
  assert.equal(scatterDaysToDeadline("2026-09-14", "2026-09-15"), -1);
});

test("une date absente ou mal formée ne produit jamais de point", () => {
  for (const bad of [null, undefined, "", "demain", "2026-13-45", 20260915]) {
    assert.equal(scatterDaysToDeadline(bad, "2026-09-15"), null);
  }
});

test("une tâche sans échéance est écartée, pas placée à zéro", () => {
  const lanes = scatterBuildLanes(
    [{ id: "a", projectId: "P", end: "2026-09-20" }, { id: "b", projectId: "P" }],
    laneOf, "2026-09-15",
  );
  assert.equal(lanes.length, 1);
  assert.deepEqual(lanes[0].points.map((p) => p.id), ["a"], "La tâche sans date fausserait la lecture à l'origine.");
});

test("l'échéance est lue dans le champ `end` du modèle Nexora", () => {
  // Régression vécue : le bloc lisait `endDate`, un champ que la tâche Nexora
  // ne porte pas. Rien ne plantait — le nuage restait simplement vide, quel que
  // soit le filtre, ce qui est le pire mode de panne pour un widget.
  const [lane] = scatterBuildLanes([{ id: "a", projectId: "P", end: "2026-09-20" }], laneOf, "2026-09-15");
  assert.equal(lane.points[0].days, 5);
  assert.deepEqual(
    scatterBuildLanes([{ id: "b", projectId: "P", endDate: "2026-09-20" }], laneOf, "2026-09-15"), [],
    "Un champ qui n'existe pas dans le modèle ne doit jamais suffire à placer un point.",
  );
});

test("les couloirs sont ordonnés par rang puis par libellé", () => {
  const tasks = [
    { id: "1", projectId: "Zèbre", end: "2026-09-20" },
    { id: "2", projectId: "Avion", end: "2026-09-20" },
  ];
  const lanes = scatterBuildLanes(tasks, (t) => ({ key: t.projectId, label: t.projectId, order: 0 }), "2026-09-15");
  assert.deepEqual(lanes.map((l) => l.label), ["Avion", "Zèbre"]);
});

test("deux points au même jour ne se recouvrent pas", () => {
  const points = [
    { id: "a", title: "A", days: 3 }, { id: "b", title: "B", days: 3 }, { id: "c", title: "C", days: 3 },
  ];
  const packed = scatterPackLane(points, { laneHeight: 60, xOf: (d) => d * 10 });
  const rows = packed.map((p) => p.row);
  assert.equal(new Set(rows).size, 3, "Trois points au même X doivent occuper trois rangées.");
  assert.ok(rows.includes(0) && rows.includes(1) && rows.includes(-1),
    "Les rangées alternent autour du centre pour équilibrer le nuage.");
});

test("deux points assez éloignés partagent la rangée centrale", () => {
  const packed = scatterPackLane(
    [{ id: "a", title: "A", days: 0 }, { id: "b", title: "B", days: 30 }],
    { laneHeight: 60, xOf: (d) => d * 10 },
  );
  assert.deepEqual(packed.map((p) => p.row), [0, 0]);
});

test("un couloir trop étroit n'escamote aucun point", () => {
  const points = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, title: "T", days: 2 }));
  const packed = scatterPackLane(points, { laneHeight: 12, xOf: (d) => d * 10 });
  assert.equal(packed.length, 8, "Un point caché serait un mensonge ; on accepte le serrage.");
  // Compter ne suffit pas : un point rendu inexploitable serait tout aussi perdu.
  packed.forEach((p) => {
    assert.ok(p && typeof p === "object", "Chaque point doit rester un point.");
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), "Un point sans coordonnée ne serait pas dessiné.");
    assert.ok(p.id, "Sans identifiant, l'infobulle ne pourrait plus retrouver la tâche.");
  });
});

test("le rangement est déterministe", () => {
  const points = [{ id: "b", title: "B", days: 1 }, { id: "a", title: "A", days: 1 }];
  const once = scatterPackLane(points, { laneHeight: 60, xOf: (d) => d * 10 });
  const twice = scatterPackLane([...points].reverse(), { laneHeight: 60, xOf: (d) => d * 10 });
  assert.deepEqual(once.map((p) => [p.id, p.row]), twice.map((p) => [p.id, p.row]));
});

test("au-delà du seuil, aucune étiquette n'est affichée", () => {
  const points = Array.from({ length: SCATTER_LANE_LABEL_LIMIT + 1 }, (_, i) => ({ id: `t${i}`, title: "T", days: i }));
  const packed = scatterPackLane(points, { laneHeight: 60, xOf: (d) => d * 40 });
  assert.equal(scatterVisibleLabels(packed).size, 0);
});

test("sous le seuil, deux étiquettes trop proches n'en laissent qu'une", () => {
  const packed = scatterPackLane(
    [{ id: "a", title: "Rapport annuel", days: 0 }, { id: "b", title: "Rapport annuel", days: 1 }],
    { laneHeight: 10, xOf: (d) => d * 3 },
  );
  const visibles = scatterVisibleLabels(packed);
  assert.ok(visibles.size < 2, "Deux étiquettes côte à côte se superposeraient.");
});

test("un point isolé garde son étiquette", () => {
  const packed = scatterPackLane([{ id: "a", title: "Seul", days: 0 }], { laneHeight: 60, xOf: (d) => d * 10 });
  assert.deepEqual([...scatterVisibleLabels(packed)], ["a"]);
});

test("l'origine reste toujours dans le champ, même sans retard", () => {
  const lanes = [{ points: [{ days: 40 }, { days: 60 }] }];
  const { min, max } = scatterDomain(lanes);
  assert.ok(min <= 0, "Sans l'origine, on ne verrait plus ce qui sépare le retard de l'avance.");
  assert.ok(max >= 60);
});

test("les points extrêmes ne touchent pas les bords du champ", () => {
  // Collé au bord, le point le plus en retard chevauchait la pastille de
  // couleur du couloir : la marge n'est pas décorative, elle évite un défaut.
  const { min, max } = scatterDomain([{ points: [{ days: -6 }, { days: 12 }] }]);
  assert.ok(min < -6, `Le retard le plus ancien touche le bord (min = ${min}).`);
  assert.ok(max > 12, `L'échéance la plus lointaine touche le bord (max = ${max}).`);
});

test("un nuage d'un seul jour ne s'étale pas absurdement", () => {
  const { min, max } = scatterDomain([{ points: [{ days: 0 }] }]);
  assert.ok(max - min >= SCATTER_MIN_SPAN_DAYS);
});

test("sans aucune tâche, le champ reste centré sur aujourd'hui", () => {
  const { min, max } = scatterDomain([]);
  assert.ok(min < 0 && max > 0);
});

test("les trois champs de couloir annoncés sont bien ceux demandés", () => {
  assert.deepEqual(SCATTER_LANE_FIELDS, ["project", "status", "criticality"]);
  assert.ok(SCATTER_POINT_RADIUS > 0 && SCATTER_POINT_GAP >= 0);
});
