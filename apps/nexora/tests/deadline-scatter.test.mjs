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
  "SCATTER_LANE_LABEL_LIMIT", "SCATTER_MIN_SPAN_DAYS", "SCATTER_WINDOW_MAX_DAYS",
  "SCATTER_WINDOW_DEFAULT_BEFORE", "SCATTER_WINDOW_DEFAULT_AFTER",
  "scatterDaysToDeadline", "scatterBuildLanes", "scatterPackLane",
  "scatterVisibleLabels", "scatterDomain",
  "scatterNormalizeWindow", "scatterClampDays", "scatterWindowOverflow",
  "scatterTicks", "SCATTER_MINOR_PER_MAJOR", "SCATTER_LANE_TINT",
];

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START), to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc du nuage de points introuvable dans dist/index.html");
const {
  SCATTER_LANE_FIELDS, SCATTER_POINT_RADIUS, SCATTER_POINT_GAP,
  SCATTER_LANE_LABEL_LIMIT, SCATTER_MIN_SPAN_DAYS, SCATTER_WINDOW_MAX_DAYS,
  SCATTER_WINDOW_DEFAULT_BEFORE, SCATTER_WINDOW_DEFAULT_AFTER,
  scatterDaysToDeadline, scatterBuildLanes, scatterPackLane, scatterVisibleLabels, scatterDomain,
  scatterNormalizeWindow, scatterClampDays, scatterWindowOverflow,
  scatterTicks, SCATTER_MINOR_PER_MAJOR, SCATTER_LANE_TINT,
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

/* ------------------------------------------------------------------------- *
 * Fenêtre d'affichage (issue #50). Une seule échéance lointaine suffisait à
 * tasser tout le nuage autour de l'origine.
 * ------------------------------------------------------------------------- */

test("sans réglage, la fenêtre reste automatique", () => {
  // Compatibilité : tous les nuages déjà posés passent par ce chemin.
  assert.equal(scatterNormalizeWindow({}).mode, "auto");
  assert.equal(scatterNormalizeWindow(undefined).mode, "auto");
  assert.equal(scatterNormalizeWindow({ scatterWindowMode: "inventé" }).mode, "auto");
});

test("une borne absurde est ramenée dans les limites, jamais à zéro", () => {
  // Une borne à zéro effondrerait ce côté de l'axe : tous les points s'y
  // empileraient, et le widget deviendrait une colonne.
  const cas = [
    [{ scatterWindowBefore: 0 }, "before", 1],
    [{ scatterWindowBefore: -40 }, "before", 1],
    [{ scatterWindowAfter: 99999 }, "after", SCATTER_WINDOW_MAX_DAYS],
    [{ scatterWindowAfter: "abc" }, "after", SCATTER_WINDOW_DEFAULT_AFTER],
    // `null` et "" valent zéro pour Number : une valeur absente, ou un champ que
    // l'on vient de vider, doit revenir au défaut et non au minimum d'un jour.
    [{ scatterWindowBefore: null }, "before", SCATTER_WINDOW_DEFAULT_BEFORE],
    [{ scatterWindowAfter: "" }, "after", SCATTER_WINDOW_DEFAULT_AFTER],
    [{ scatterWindowAfter: 12.6 }, "after", 13],
  ];
  for (const [widget, champ, attendu] of cas) {
    assert.equal(scatterNormalizeWindow(widget)[champ], attendu, `${champ} pour ${JSON.stringify(widget)}`);
  }
});

test("en fenêtre fixe, l'axe ne dépend plus des tâches", () => {
  // C'est tout le point : une tâche à J+400 ne doit plus étirer le champ.
  const lanes = [{ points: [{ days: 400 }, { days: -300 }] }];
  const fixe = scatterDomain(lanes, { mode: "fixed", before: 30, after: 90 });
  assert.deepEqual([fixe.min, fixe.max], [-30, 90]);
  const auto = scatterDomain(lanes, { mode: "auto", before: 30, after: 90 });
  assert.ok(auto.min <= -300 && auto.max >= 400, "en automatique, l'axe suit toujours les tâches");
});

test("un point hors fenêtre est rabattu sur le bord, pas supprimé ni déplacé au hasard", () => {
  const domain = { min: -30, max: 90 };
  assert.deepEqual(scatterClampDays(400, domain), { plotDays: 90, beyond: "high" });
  assert.deepEqual(scatterClampDays(-300, domain), { plotDays: -30, beyond: "low" });
  assert.deepEqual(scatterClampDays(5, domain), { plotDays: 5, beyond: null });
  // Les bornes elles-mêmes sont DANS la fenêtre : les rabattre les ferait
  // passer pour des débordements alors qu'elles sont exactement à la limite.
  assert.deepEqual(scatterClampDays(90, domain), { plotDays: 90, beyond: null });
  assert.deepEqual(scatterClampDays(-30, domain), { plotDays: -30, beyond: null });
});

test("ce qui déborde est compté de chaque côté", () => {
  // Une fenêtre qui masque sans le dire serait un filtre déguisé.
  const domain = { min: -30, max: 90 };
  // Les deux tâches posées EXACTEMENT sur les bornes sont dans la fenêtre :
  // les compter comme débordements annoncerait un « au-delà » que le dessin ne
  // montre pas, et contredirait le rabattement, qui les laisse rondes.
  const lanes = [
    { points: [{ days: -300 }, { days: -100 }, { days: 5 }, { days: -30 }] },
    { points: [{ days: 400 }, { days: 89 }, { days: 90 }] },
  ];
  assert.deepEqual(scatterWindowOverflow(lanes, domain), { low: 2, high: 1 });
  lanes.forEach((lane) => lane.points.forEach((p) => {
    const compte = p.days < domain.min || p.days > domain.max;
    assert.equal(scatterClampDays(p.days, domain).beyond !== null, compte,
      `« ${p.days} j » : le comptage et le rabattement ne disent pas la même chose`);
  }));
  assert.deepEqual(scatterWindowOverflow(lanes, { min: -500, max: 500 }), { low: 0, high: 0 });
  assert.deepEqual(scatterWindowOverflow([], domain), { low: 0, high: 0 });
});

test("aucune tâche n'est perdue par la fenêtre", () => {
  // Le comptage total doit être le même quelle que soit la plage affichée :
  // la fenêtre décide de la MISE EN PAGE, jamais du périmètre.
  const tasks = [
    { id: "a", projectId: "P", end: "2027-12-31" },
    { id: "b", projectId: "P", end: "2026-09-16" },
    { id: "c", projectId: "P", end: "2024-01-01" },
  ];
  const lanes = scatterBuildLanes(tasks, laneOf, "2026-09-15");
  const total = lanes.reduce((n, l) => n + l.points.length, 0);
  assert.equal(total, 3);
  const domain = scatterDomain(lanes, { mode: "fixed", before: 30, after: 90 });
  const { low, high } = scatterWindowOverflow(lanes, domain);
  assert.equal(low + high, 2, "deux tâches hors fenêtre, toujours comptées");
  assert.equal(total - low - high, 1, "une seule tâche dans la fenêtre");
});

/* ------------------------------------------------------------------------- *
 * Graduations et sous-grille (issue #53).
 * ------------------------------------------------------------------------- */

test("aucune graduation ne sort du champ, même quand il ne contient pas l'origine", () => {
  // Le champ straddle toujours zéro dans l'application ; la fonction, elle, doit
  // rester juste pour n'importe quel champ — sinon un repère « aujourd'hui »
  // apparaîtrait hors de la plage, à un endroit qui ne veut rien dire.
  const { major, minor } = scatterTicks({ min: 10, max: 40 });
  assert.ok(!major.includes(0), "l'origine n'appartient pas à ce champ : elle ne doit pas y être graduée");
  [...major, ...minor].forEach((d) => {
    assert.ok(d >= 10 && d <= 40, `graduation ${d} hors du champ 10 → 40`);
  });
  assert.ok(major.length > 0, "un champ sans origine garde tout de même des repères");
});

test("l'origine est toujours graduée, et rien ne sort du champ", () => {
  // Sans l'origine, plus rien ne sépare visuellement le retard de l'avance.
  for (const domain of [{ min: -30, max: 90 }, { min: -7, max: 7 }, { min: -200, max: 400 }, { min: -1, max: 6 }]) {
    const { major, minor } = scatterTicks(domain);
    assert.ok(major.includes(0), `origine absente pour ${JSON.stringify(domain)}`);
    [...major, ...minor].forEach((d) => {
      assert.ok(d >= domain.min && d <= domain.max, `graduation ${d} hors du champ ${JSON.stringify(domain)}`);
    });
    assert.deepEqual(major, [...major].sort((a, b) => a - b), "les graduations doivent être ordonnées");
  }
});

test("la sous-grille ne double jamais une graduation principale", () => {
  // Deux traits superposés se liraient comme un trait plus épais, donc comme un
  // repère — exactement ce que la sous-grille ne doit pas être.
  for (const domain of [{ min: -30, max: 90 }, { min: -7, max: 7 }, { min: -200, max: 400 }]) {
    const { major, minor } = scatterTicks(domain);
    const doublons = minor.filter((d) => major.includes(d));
    assert.deepEqual(doublons, [], `sous-grille superposée aux repères pour ${JSON.stringify(domain)}`);
  }
});

test("il y a bien une sous-grille entre deux graduations voisines", () => {
  // Sans elle, entre « J+15 » et « J+30 » un point se lit « quelque part au
  // milieu » : c'est tout l'objet de l'issue.
  const { major, minor } = scatterTicks({ min: -30, max: 90 });
  assert.ok(major.length >= 2, "au moins deux graduations principales attendues");
  for (let i = 0; i < major.length - 1; i++) {
    const entre = minor.filter((d) => d > major[i] && d < major[i + 1]);
    assert.ok(entre.length > 0, `aucune sous-graduation entre ${major[i]} et ${major[i + 1]}`);
  }
  assert.equal(SCATTER_MINOR_PER_MAJOR, 5);
});

test("en fenêtre fixe, les deux bornes réglées restent graduées", () => {
  const { major } = scatterTicks({ min: -3, max: 5, windowed: true });
  assert.ok(major.includes(-3) && major.includes(5), `bornes non graduées (${major.join(" ")})`);
  assert.ok(major.includes(0), "l'origine reste graduée");
});

test("la teinte des couloirs reste un fond, pas une couleur", () => {
  // Au-delà, elle concurrence les points et la zone de retard.
  assert.ok(SCATTER_LANE_TINT > 0, "un couloir sans teinte ne se distingue plus");
  assert.ok(SCATTER_LANE_TINT <= 0.2, `teinte de ${SCATTER_LANE_TINT} : le fond passerait devant les points`);
});

test("une étiquette a besoin de place des deux côtés, pas seulement à droite", () => {
  // Près du bord droit, l'étiquette est rabattue vers la gauche : ne vérifier
  // que la droite la laissait recouvrir l'étiquette du point précédent.
  const packed = scatterPackLane(
    [{ id: "a", title: "Réception", days: 0 }, { id: "b", title: "Relance presse", days: 1 }, { id: "c", title: "Devis", days: 60 }],
    { laneHeight: 10, xOf: (d) => d * 4 },
  );
  const visibles = scatterVisibleLabels(packed);
  assert.ok(!visibles.has("b"), "« b » est serré entre deux voisins : son étiquette ne tient d'aucun côté");
  assert.ok(visibles.has("c"), "« c » est isolé : il garde son étiquette");
});
