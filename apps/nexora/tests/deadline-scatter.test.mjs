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
  "SCATTER_MIN_SPAN_DAYS", "SCATTER_WINDOW_MAX_DAYS", "SCATTER_LABEL_MAX_POINTS",
  "SCATTER_WINDOW_DEFAULT_BEFORE", "SCATTER_WINDOW_DEFAULT_AFTER",
  "scatterDaysToDeadline", "scatterBuildLanes", "scatterPackLane",
  "scatterDomain", "scatterPlaceLabels", "scatterLabelWidth", "scatterBoxesOverlap", "scatterLabelCandidates",
  "scatterNormalizeWindow", "scatterClampDays", "scatterWindowOverflow",
  "scatterTicks", "SCATTER_MINOR_PER_MAJOR", "SCATTER_LANE_TINT",
];

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START), to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc du nuage de points introuvable dans .build/index.html");
const {
  SCATTER_LANE_FIELDS, SCATTER_POINT_RADIUS, SCATTER_POINT_GAP,
  SCATTER_MIN_SPAN_DAYS, SCATTER_WINDOW_MAX_DAYS, SCATTER_LABEL_MAX_POINTS,
  SCATTER_WINDOW_DEFAULT_BEFORE, SCATTER_WINDOW_DEFAULT_AFTER,
  scatterDaysToDeadline, scatterBuildLanes, scatterPackLane, scatterDomain,
  scatterPlaceLabels, scatterLabelWidth, scatterBoxesOverlap, scatterLabelCandidates,
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


/* ------------------------------------------------------------------------- *
 * Moteur d'étiquettes (issue #53). Poser le plus d'étiquettes possible, tant
 * qu'aucune n'en recouvre une autre ni ne masque un point.
 * ------------------------------------------------------------------------- */

const CADRE = { laneTop: 0, laneBottom: 120, plotLeft: 0, plotRight: 900 };
const boiteDe = (point, placement) => {
  const w = scatterLabelWidth(point.title);
  const h = 11, half = h / 2;
  const x0 = placement.anchor === "start" ? placement.x
    : placement.anchor === "end" ? placement.x - w
    : placement.x - w / 2;
  return { x0, x1: x0 + w, y0: placement.y - half, y1: placement.y + half };
};
const boitesPlacees = (points, placements) =>
  points.filter((p) => placements.has(p.id)).map((p) => boiteDe(p, placements.get(p.id)));

test("un point isolé prend l'emplacement le plus lisible : à droite", () => {
  const placements = scatterPlaceLabels([{ id: "a", title: "Seul", x: 100, y: 60 }], CADRE);
  const a = placements.get("a");
  assert.ok(a, "un point seul doit être étiqueté");
  assert.equal(a.anchor, "start");
  assert.ok(a.x > 100, "l'étiquette se pose à droite du point");
  assert.equal(a.y, 60, "sans voisin, aucun déport vertical");
  assert.equal(a.leader, null, "et donc aucun trait de rappel");
});

test("aucune étiquette n'en recouvre une autre, sur un couloir chargé", () => {
  // C'est LA propriété du moteur. Trente points serrés : certains resteront
  // sans étiquette, mais deux étiquettes ne doivent jamais se superposer.
  const points = Array.from({ length: 30 }, (_, i) => ({
    id: `t${i}`, title: `Tâche ${i}`, x: 40 + i * 14, y: 60 + ((i % 3) - 1) * 11,
  }));
  const placements = scatterPlaceLabels(points, CADRE);
  const boites = boitesPlacees(points, placements);
  assert.ok(boites.length > 0, "au moins une étiquette placée");
  for (let i = 0; i < boites.length; i++) {
    for (let j = i + 1; j < boites.length; j++) {
      assert.ok(!scatterBoxesOverlap(boites[i], boites[j]),
        `deux étiquettes se recouvrent : ${JSON.stringify(boites[i])} et ${JSON.stringify(boites[j])}`);
    }
  }
});

test("une étiquette ne masque jamais un point, même un point sans étiquette", () => {
  const points = Array.from({ length: 20 }, (_, i) => ({
    id: `t${i}`, title: `Réunion de chantier ${i}`, x: 30 + i * 21, y: 60,
  }));
  const placements = scatterPlaceLabels(points, CADRE);
  points.filter((p) => placements.has(p.id)).forEach((p) => {
    const boite = boiteDe(p, placements.get(p.id));
    points.filter((q) => q.id !== p.id).forEach((q) => {
      const pastille = { x0: q.x - 4.5, x1: q.x + 4.5, y0: q.y - 4.5, y1: q.y + 4.5 };
      assert.ok(!scatterBoxesOverlap(boite, pastille),
        `l'étiquette de « ${p.id} » masque le point « ${q.id} »`);
    });
  });
});

test("aucune étiquette ne sort du couloir ni du dessin", () => {
  // Déborder du couloir la ferait lire comme appartenant au couloir voisin.
  const points = Array.from({ length: 25 }, (_, i) => ({
    id: `t${i}`, title: "Organisation réunion sur site", x: 20 + i * 36, y: 60,
  }));
  const placements = scatterPlaceLabels(points, CADRE);
  points.filter((p) => placements.has(p.id)).forEach((p) => {
    const b = boiteDe(p, placements.get(p.id));
    assert.ok(b.x0 >= CADRE.plotLeft - 0.01 && b.x1 <= CADRE.plotRight + 0.01,
      `« ${p.id} » sort du dessin (${b.x0} → ${b.x1})`);
    assert.ok(b.y0 >= CADRE.laneTop - 0.01 && b.y1 <= CADRE.laneBottom + 0.01,
      `« ${p.id} » sort du couloir (${b.y0} → ${b.y1})`);
  });
});

test("le moteur pose PLUS d'étiquettes que le simple « à droite si la place y est »", () => {
  // Tout l'objet de l'issue : l'ancien moteur n'essayait qu'un emplacement.
  const points = Array.from({ length: 14 }, (_, i) => ({
    id: `t${i}`, title: `Tâche ${i}`, x: 60 + i * 26, y: 60,
  }));
  const placements = scatterPlaceLabels(points, CADRE);
  const largeur = scatterLabelWidth("Tâche 0");
  const aDroiteSeulement = points.filter((p, i) => {
    const suivant = points[i + 1];
    return !suivant || suivant.x - p.x >= largeur;
  }).length;
  assert.ok(placements.size > aDroiteSeulement,
    `${placements.size} étiquette(s) posée(s) contre ${aDroiteSeulement} en ne regardant qu'à droite — le moteur n'apporte rien`);
});

test("quand la place est là, tout le monde est étiqueté", () => {
  const points = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, title: "Lot", x: 40 + i * 100, y: 60 }));
  assert.equal(scatterPlaceLabels(points, CADRE).size, 8);
});

test("tout rappel proposé est un coude, jamais une diagonale", () => {
  // Une diagonale se lirait comme une liaison entre deux objets ; un coude se
  // lit comme un renvoi.
  const candidats = scatterLabelCandidates({ x: 200, y: 60 }, 80,
    { radius: 4.5, height: 11, gap: 3, lead: 14, row: 12 });
  const avecRappel = candidats.filter((c) => c.leader);
  assert.ok(avecRappel.length > 0, "aucun emplacement déporté proposé");
  avecRappel.forEach((v) => {
    assert.equal(v.leader.length, 4, "le rappel est un coude : deux segments horizontaux et un vertical");
    const [p0, p1, p2, p3] = v.leader;
    assert.equal(p0[1], p1[1], "le premier segment est horizontal");
    assert.equal(p1[0], p2[0], "le coude est vertical");
    assert.equal(p2[1], p3[1], "le dernier segment est horizontal");
    assert.equal(p3[1], v.y, "le rappel aboutit à la hauteur de l'étiquette");
  });
});

test("un amas serré fait déporter des étiquettes plutôt que les abandonner", () => {
  // Huit points en trente pixels : ni la droite, ni la gauche, ni le dessus ne
  // suffisent. Sans déport, presque tout l'amas resterait muet.
  const points = Array.from({ length: 8 }, (_, i) => ({
    id: `a${i}`, title: `PCH VA - Suivi transfert ${i}`, x: 300 + i * 4, y: 60,
  }));
  const placements = scatterPlaceLabels(points, CADRE);
  const deportees = [...placements.values()].filter((v) => v.leader);
  assert.ok(deportees.length > 0, "aucune étiquette déportée sur un amas serré");
  assert.ok(placements.size >= 3, `${placements.size} étiquette(s) sur un amas de 8 — le déport n'apporte rien`);
});

test("le placement est déterministe, même quand l'ordre change tout", () => {
  // Sur un amas, le premier servi prend la meilleure place : si l'ordre de
  // parcours suivait celui du tableau, les étiquettes sauteraient d'un rendu à
  // l'autre au moindre tri. Un jeu régulier ne prouverait rien — tout le monde
  // y tient à droite quel que soit l'ordre.
  const points = Array.from({ length: 18 }, (_, i) => ({
    id: `t${i}`, title: `Réunion de chantier ${i}`, x: 300 + i * 5, y: 60,
  }));
  const une = scatterPlaceLabels(points, CADRE);
  const deux = scatterPlaceLabels([...points].reverse(), CADRE);
  assert.ok(une.size > 0 && une.size < points.length,
    `${une.size} étiquette(s) sur ${points.length} : l'amas doit forcer des arbitrages, sinon l'ordre n'a aucun effet`);
  assert.deepEqual([...une.entries()].sort(), [...deux.entries()].sort());
});

test("un couloir bas n'autorise ni dessus, ni dessous, ni déport", () => {
  // Une étiquette qui déborde du couloir se lit comme appartenant au couloir
  // voisin. Sur un couloir serré, il ne reste que la droite et la gauche.
  const etroit = { laneTop: 52, laneBottom: 68, plotLeft: 0, plotRight: 900 };
  // Quatre points serrés : les deux du milieu n'ont de place ni à droite ni à
  // gauche. Sur un couloir haut ils passeraient au-dessus et en dessous ; ici
  // ils doivent rester muets plutôt que de déborder sur le couloir voisin.
  const points = [
    { id: "a", title: "Revue DOE", x: 200, y: 60 },
    { id: "b", title: "Travaux levée réserves", x: 206, y: 60 },
    { id: "c", title: "Organisation réunion", x: 212, y: 60 },
    { id: "d", title: "Point GESCO", x: 218, y: 60 },
  ];
  const placements = scatterPlaceLabels(points, etroit);
  assert.ok(placements.size > 0, "un couloir serré garde tout de même des étiquettes");
  assert.ok(placements.size < points.length,
    "sans arbitrage, la borne du couloir ne serait jamais mise à l'épreuve");
  assert.ok(!placements.has("b") && !placements.has("c"),
    "les points serrés du milieu ne peuvent tenir que hors du couloir : ils restent sans étiquette");
  [...placements.values()].forEach((v) => {
    assert.equal(v.y, 60, "sur un couloir serré, aucune étiquette ne quitte la hauteur du point");
    assert.equal(v.leader, null, "et aucune n'est déportée : le déport sortirait du couloir");
  });
  points.filter((p) => placements.has(p.id)).forEach((p) => {
    const b = boiteDe(p, placements.get(p.id));
    assert.ok(b.y0 >= etroit.laneTop && b.y1 <= etroit.laneBottom,
      `« ${p.id} » sort du couloir (${b.y0} → ${b.y1})`);
  });
});

test("un couloir déraisonnablement dense n'est pas étiqueté du tout", () => {
  // Le placement coûterait plus cher que ce qu'il rapporte, et aucune étiquette
  // n'y serait lisible de toute façon.
  const points = Array.from({ length: SCATTER_LABEL_MAX_POINTS + 1 }, (_, i) => ({
    id: `t${i}`, title: "T", x: i, y: 60,
  }));
  assert.equal(scatterPlaceLabels(points, CADRE).size, 0);
  assert.equal(scatterPlaceLabels([], CADRE).size, 0);
});

test("deux rectangles jointifs ne se recouvrent pas", () => {
  // Sinon deux étiquettes qui se suivent exactement seraient refusées, et le
  // moteur en poserait moins que la place ne le permet.
  const a = { x0: 0, x1: 10, y0: 0, y1: 10 };
  assert.equal(scatterBoxesOverlap(a, { x0: 10, x1: 20, y0: 0, y1: 10 }), false);
  assert.equal(scatterBoxesOverlap(a, { x0: 9.9, x1: 20, y0: 0, y1: 10 }), true);
  assert.equal(scatterBoxesOverlap(a, { x0: 0, x1: 10, y0: 10, y1: 20 }), false);
});
