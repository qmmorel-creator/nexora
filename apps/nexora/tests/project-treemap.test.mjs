import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même principe que gantt-annotations.test.mjs : les fonctions testées sont
// extraites de l'interface RÉELLEMENT construite, entre sentinelles. Aucune
// copie du code n'est maintenue à côté. Le bloc du Treemap s'appuie sur
// lerpColor, lui aussi encadré par des sentinelles : les deux tranches sont
// concaténées, jamais recopiées.
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
  "computeTreemapProjects",
  "treemapTaskCriticality",
  "treemapCriticalityLevel",
  "treemapColorDomain",
  "treemapTileColor",
  "treemapTextColor",
  "treemapTileDensity",
  "treemapSecondaryFieldBudget",
  "squarifyTreemap",
  "treemapGroupRects",
  "normalizeProjectTreemapConfig",
  "treemapLegendBuckets",
  "treemapUpcomingCapacity",
  "TREEMAP_CRITICALITY_WEIGHTS",
  "TREEMAP_NEUTRAL_COLOR",
  "TREEMAP_DEFAULT_FIELDS",
  "TREEMAP_TILE_FIELDS",
  "TREEMAP_TILE_BY",
  "TREEMAP_TILE_BY_LABELS",
  "TREEMAP_PROJECT_ONLY_FIELDS",
];

// Évalué dans le realm courant : deepStrictEqual exige des prototypes partagés.
const T = vm.runInThisContext(
  `(function () {\n${slice("COLOR-UTILS")}\n${slice("PROJECT-TREEMAP")}\n;return { ${EXPORTS.join(", ")} };\n})`
)();

const projects = [
  { id: "p1", name: "Lot 2B", color: "#8B5CF6", priority: "high", folderId: "f1" },
  { id: "p2", name: "CTEX6", color: "#D64545", priority: "normal", folderId: "f1" },
  { id: "p3", name: "Communication", color: "#F2A93B", priority: "low", folderId: "f2" },
];

const task = (patch) => ({ id: "t", projectId: "p1", title: "Tâche", progress: 0, end: "2026-09-30", ...patch });

// Faits injectés par l'application : le bloc pur ne connaît ni les statuts ni
// le calendrier, il ne fait que compter et pondérer.
const facts = (patch) => ({ done: false, late: false, urgent: false, milestone: false, daysToDue: 30, inactivityDays: 0, ...patch });
const factsById = (map) => (t) => facts(map[t.id] || {});

test("la surface d'une tuile vient du COUNT() des tâches retenues par le filtre de taille", () => {
  const tasks = [
    task({ id: "a", projectId: "p1" }),
    task({ id: "b", projectId: "p1" }),
    task({ id: "c", projectId: "p1" }),
    task({ id: "d", projectId: "p2" }),
    task({ id: "e", projectId: "p3" }),
  ];
  const rows = T.computeTreemapProjects({
    projects, tasks,
    sizeMatch: (t) => t.id !== "c",          // le filtre exclut une tâche
    factsOf: factsById({}),
  });
  // À égalité de COUNT(), l'ordre est alphabétique : « Communication » avant « CTEX6 ».
  assert.deepEqual(rows.map((r) => [r.projectId, r.sizeCount]), [["p1", 2], ["p3", 1], ["p2", 1]]);
  // taskCount reste le total du projet dans le périmètre du widget : la tâche
  // exclue par le filtre de taille n'a pas disparu du projet.
  assert.equal(rows[0].taskCount, 3);
  // Une tuile = un projet : jamais plus de lignes que de projets.
  assert.equal(rows.length, 3);
});

test("un projet sans tâche correspondante est masqué, ou gardé en tuile minimale", () => {
  const tasks = [task({ id: "a", projectId: "p1" }), task({ id: "b", projectId: "p1" })];
  const hidden = T.computeTreemapProjects({ projects, tasks, factsOf: factsById({}) });
  assert.deepEqual(hidden.map((r) => r.projectId), ["p1"]);

  const shown = T.computeTreemapProjects({ projects, tasks, factsOf: factsById({}), showZeroProjects: true });
  assert.deepEqual(shown.map((r) => r.projectId).sort(), ["p1", "p2", "p3"]);
  const zero = shown.find((r) => r.projectId === "p2");
  assert.equal(zero.sizeCount, 0);
  // Poids non nul, sinon le pavage ferait disparaître la tuile ; mais bien
  // inférieur à celui d'un projet qui porte réellement des tâches.
  assert.ok(zero.weight > 0 && zero.weight < shown[0].weight, `poids inattendu : ${zero.weight}`);
});

test("le filtre de coloration est indépendant de celui de la taille", () => {
  const tasks = [
    task({ id: "a", projectId: "p1" }), task({ id: "b", projectId: "p1" }), task({ id: "c", projectId: "p1" }),
    task({ id: "d", projectId: "p2" }),
  ];
  const rows = T.computeTreemapProjects({
    projects, tasks,
    sizeMatch: () => true,
    colorMatch: (t) => t.id === "a" || t.id === "d",
    colorMode: "secondaryFilterGradient",
    factsOf: factsById({}),
  });
  const p1 = rows.find((r) => r.projectId === "p1");
  assert.equal(p1.sizeCount, 3);
  assert.equal(p1.colorCount, 1);
  assert.equal(p1.colorValue, 1, "la couleur suit le second filtre, pas la taille");

  const same = T.computeTreemapProjects({
    projects, tasks, colorMatch: (t) => t.id === "a", colorMode: "sizeFilterGradient", factsOf: factsById({}),
  });
  assert.equal(same.find((r) => r.projectId === "p1").colorValue, 3, "en mode « même filtre », la couleur suit la taille");
});

test("la criticité d'une tâche est déterministe et justifiable ligne à ligne", () => {
  const W = T.TREEMAP_CRITICALITY_WEIGHTS;
  // Une tâche terminée ne pèse jamais : un projet tout fait doit rester calme.
  assert.deepEqual(T.treemapTaskCriticality(facts({ done: true, late: true, urgent: true })), { score: 0, reasons: [] });

  const late = T.treemapTaskCriticality(facts({ late: true, projectPriority: "high" }));
  assert.equal(late.score, W.late + W.projectPriorityHigh);
  assert.deepEqual(late.reasons.map((r) => r.points), [W.late, W.projectPriorityHigh]);

  // « Échéance proche » ne s'ajoute pas au retard : une tâche en retard n'est
  // pas aussi une tâche qui approche de son échéance.
  assert.equal(T.treemapTaskCriticality(facts({ late: true, daysToDue: -2 })).score, W.late);
  assert.equal(T.treemapTaskCriticality(facts({ daysToDue: 3 })).score, W.dueSoon);
  assert.equal(T.treemapTaskCriticality(facts({ daysToDue: 30 })).score, 0);
  assert.equal(T.treemapTaskCriticality(facts({ inactivityDays: 14 })).score, W.stale);
  assert.equal(T.treemapTaskCriticality(facts({ milestone: true })).score, W.milestone);

  // Le score est borné : le cumul maximal ne dépasse jamais 100.
  const worst = T.treemapTaskCriticality(facts({ late: true, urgent: true, milestone: true, inactivityDays: 99, projectPriority: "high" }));
  assert.equal(worst.score, 100);

  assert.equal(T.treemapCriticalityLevel(0).key, "controlled");
  assert.equal(T.treemapCriticalityLevel(25).key, "watch");
  assert.equal(T.treemapCriticalityLevel(49).key, "watch");
  assert.equal(T.treemapCriticalityLevel(50).key, "high");
  assert.equal(T.treemapCriticalityLevel(100).key, "critical");
});

test("la criticité d'un projet est la moyenne de ses tâches retenues", () => {
  const W = T.TREEMAP_CRITICALITY_WEIGHTS;
  const tasks = [
    task({ id: "a", projectId: "p2" }),
    task({ id: "b", projectId: "p2" }),
  ];
  const rows = T.computeTreemapProjects({
    projects, tasks, colorMode: "averageCriticality",
    factsOf: factsById({ a: { late: true }, b: { done: true } }),
  });
  const p2 = rows[0];
  // p2 est en priorité « normale » : la tâche en retard porte aussi ce poids.
  assert.equal(p2.criticality.score, Math.round((W.late + W.projectPriorityNormal + 0) / 2));
  assert.equal(p2.colorValue, p2.criticality.score);
  assert.equal(p2.lateCount, 1);
  assert.equal(p2.doneCount, 1);
});

test("statut dominant, responsable principal et prochain jalon sortent des tâches réelles", () => {
  const tasks = [
    task({ id: "a", projectId: "p1", statusId: "s1", assignee: "Quentin" }),
    task({ id: "b", projectId: "p1", statusId: "s1", assignee: "Vincent" }),
    task({ id: "c", projectId: "p1", statusId: "s2", assignee: "Quentin", end: "2026-10-05", title: "Jalon lointain" }),
    task({ id: "d", projectId: "p1", statusId: "s2", assignee: "", end: "2026-09-18", title: "Jalon proche" }),
  ];
  const [p1] = T.computeTreemapProjects({
    projects, tasks,
    factsOf: factsById({ c: { milestone: true, daysToDue: 21 }, d: { milestone: true, daysToDue: 4 } }),
  });
  assert.equal(p1.dominantStatusId, "s1");
  assert.equal(p1.owner, "Quentin");
  assert.equal(p1.nextMilestone.title, "Jalon proche", "le jalon le plus proche l'emporte");
  assert.equal(p1.endDate, "2026-10-05", "la dernière échéance est la plus tardive");

  // Un jalon déjà passé n'est pas « le prochain ».
  const [only] = T.computeTreemapProjects({
    projects, tasks: [task({ id: "z", projectId: "p1" })],
    factsOf: factsById({ z: { milestone: true, daysToDue: -3 } }),
  });
  assert.equal(only.nextMilestone, null);
});

test("l'échelle de couleur réserve la couleur forte aux valeurs réellement hautes", () => {
  const rows = [{ colorValue: 0 }, { colorValue: 5 }, { colorValue: 10 }];
  const domain = T.treemapColorDomain(rows, "sizeFilterGradient");
  assert.deepEqual(domain, { min: 0, max: 10, top: 10 });
  // Domaine minuscule : l'échelle ne se replie pas sur lui, sinon « 2 tâches en
  // retard » afficherait le rouge le plus vif dans un portefeuille tranquille.
  const tiny = T.treemapColorDomain([{ colorValue: 0 }, { colorValue: 2 }], "sizeFilterGradient");
  assert.equal(tiny.top, 2, "le maximum réel reste connu, pour la légende");
  assert.ok(tiny.max >= 4, `échelle repliée sur un domaine minuscule (${tiny.max})`);
  assert.notEqual(
    T.treemapTileColor(2, tiny, "ember", "lowToHigh"),
    T.treemapTileColor(10, { min: 0, max: 10, top: 10 }, "ember", "lowToHigh"),
    "deux tâches en retard ne doivent pas être colorées comme un maximum réel"
  );
  // La criticité garde un domaine fixe : deux widgets côte à côte donnent la
  // même couleur au même score.
  assert.deepEqual(T.treemapColorDomain(rows, "averageCriticality"), { min: 0, max: 100 });

  const low = T.treemapTileColor(0, domain, "ember", "lowToHigh");
  const high = T.treemapTileColor(10, domain, "ember", "lowToHigh");
  assert.notEqual(low, high);
  // Inverser le sens échange les deux extrémités.
  assert.equal(T.treemapTileColor(0, domain, "ember", "highToLow"), high);
  assert.equal(T.treemapTileColor(10, domain, "ember", "highToLow"), low);

  // Domaine plat ou valeur absente : couleur neutre, jamais une alerte.
  assert.equal(T.treemapTileColor(0, { min: 0, max: 0 }, "ember", "lowToHigh"), T.TREEMAP_NEUTRAL_COLOR);
  assert.equal(T.treemapTileColor(null, domain, "ember", "lowToHigh"), T.TREEMAP_NEUTRAL_COLOR);

  // Le texte reste lisible sur les deux extrémités de chaque palette.
  assert.equal(T.treemapTextColor("#FFFFFF"), "#0B1526");
  assert.equal(T.treemapTextColor("#1E4C8A"), "#FFFFFF");
});

test("le pavage remplit exactement le rectangle sans chevauchement", () => {
  const items = [
    { id: "p1", weight: 6 }, { id: "p2", weight: 6 }, { id: "p3", weight: 4 },
    { id: "p4", weight: 3 }, { id: "p5", weight: 2 }, { id: "p6", weight: 1 },
  ];
  const rect = { x: 0, y: 0, w: 600, h: 400 };
  const tiles = T.squarifyTreemap(items, rect);
  assert.equal(tiles.length, items.length);

  const area = tiles.reduce((s, t) => s + t.w * t.h, 0);
  assert.ok(Math.abs(area - rect.w * rect.h) < 1, `surface couverte ${area} au lieu de ${rect.w * rect.h}`);

  tiles.forEach((t) => {
    assert.ok(t.w > 0 && t.h > 0, `tuile ${t.id} de surface nulle`);
    assert.ok(t.x >= -0.01 && t.y >= -0.01 && t.x + t.w <= rect.w + 0.01 && t.y + t.h <= rect.h + 0.01, `tuile ${t.id} hors du cadre`);
  });

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i], b = tiles[j];
      const overlap = a.x < b.x + b.w - 0.01 && b.x < a.x + a.w - 0.01 && a.y < b.y + b.h - 0.01 && b.y < a.y + a.h - 0.01;
      assert.ok(!overlap, `les tuiles ${a.id} et ${b.id} se chevauchent`);
    }
  }

  // Le poids le plus fort donne la plus grande surface.
  const biggest = tiles.reduce((m, t) => (t.w * t.h > m.w * m.h ? t : m), tiles[0]);
  assert.ok(["p1", "p2"].includes(biggest.id));

  // Cas dégradés : aucun plantage, aucune tuile fantôme.
  assert.deepEqual(T.squarifyTreemap([], rect), []);
  assert.deepEqual(T.squarifyTreemap(items, { x: 0, y: 0, w: 0, h: 400 }), []);
  assert.deepEqual(T.squarifyTreemap([{ id: "x", weight: 0 }], rect), []);
  assert.equal(T.squarifyTreemap([{ id: "seul", weight: 3 }], rect).length, 1);
});

test("les groupes se partagent la hauteur au prorata de leur poids", () => {
  const groups = [
    { key: "f1", rows: [{ weight: 6 }, { weight: 2 }] },
    { key: "f2", rows: [{ weight: 2 }] },
    { key: "f3", rows: [] },
  ];
  const laid = T.treemapGroupRects(groups, { x: 0, y: 0, w: 500, h: 400 }, { headerH: 20, gap: 8, minBodyH: 40 });
  assert.deepEqual(laid.map((g) => g.group.key), ["f1", "f2"], "un groupe vide n'occupe aucune place");
  assert.ok(laid[0].bodyRect.h > laid[1].bodyRect.h, "le groupe le plus lourd est le plus haut");
  assert.equal(laid[0].headerRect.y, 0);
  assert.equal(laid[0].bodyRect.y, 20);
  assert.ok(laid[1].headerRect.y >= laid[0].bodyRect.y + laid[0].bodyRect.h, "les groupes ne se recouvrent pas");
  // Hauteur insuffisante : chaque groupe garde sa hauteur minimale utile.
  const tight = T.treemapGroupRects(groups, { x: 0, y: 0, w: 500, h: 30 }, { headerH: 20, gap: 8, minBodyH: 40 });
  tight.forEach((g) => assert.ok(g.bodyRect.h >= 40));
});

test("la densité d'une tuile décide du nombre de champs, jamais l'inverse", () => {
  assert.equal(T.treemapTileDensity(240, 160), "large");
  assert.equal(T.treemapTileDensity(140, 90), "medium");
  assert.equal(T.treemapTileDensity(60, 40), "small");
  // Une tuile large mais plate reste une petite tuile : la hauteur compte autant.
  assert.equal(T.treemapTileDensity(400, 30), "small");
  // Le mode compact abaisse les seuils sans les supprimer.
  assert.equal(T.treemapTileDensity(160, 100, true), "large");
  assert.equal(T.treemapTileDensity(160, 100, false), "medium");

  assert.equal(T.treemapSecondaryFieldBudget("large"), 3);
  assert.equal(T.treemapSecondaryFieldBudget("medium"), 1);
  assert.equal(T.treemapSecondaryFieldBudget("small"), 0);
});

test("une configuration absente, partielle ou illisible reste affichable", () => {
  const fresh = T.normalizeProjectTreemapConfig(undefined);
  assert.deepEqual(fresh.fields, T.TREEMAP_DEFAULT_FIELDS);
  assert.equal(fresh.colorMode, "sizeFilterGradient");
  assert.equal(fresh.palette, "ember");
  assert.equal(fresh.direction, "lowToHigh");
  assert.equal(fresh.groupBy, "none");
  assert.equal(fresh.showProgressRing, true);
  assert.equal(fresh.showZeroProjects, false);

  // Le nom du projet est réinséré même si la configuration l'a perdu : sans lui
  // la tuile ne désigne plus rien.
  const stripped = T.normalizeProjectTreemapConfig({ treemapFields: ["progress", "inconnu", "cf:abc", "progress"] });
  assert.deepEqual(stripped.fields, ["projectName", "progress", "cf:abc"]);

  // Un mode ou une palette inconnus retombent sur une valeur sûre.
  assert.equal(T.normalizeProjectTreemapConfig({ treemapColorMode: "n'importe quoi" }).colorMode, "sizeFilterGradient");
  assert.equal(T.normalizeProjectTreemapConfig({ treemapPalette: "arc-en-ciel" }).palette, "ember");
  // En mode criticité, la palette d'état est le défaut naturel.
  assert.equal(T.normalizeProjectTreemapConfig({ treemapColorMode: "averageCriticality" }).palette, "levels");
  assert.equal(T.normalizeProjectTreemapConfig({ treemapGap: 99 }).gap, 12);
  assert.equal(T.normalizeProjectTreemapConfig({ treemapGap: -4 }).gap, 0);

  // Un filtre supprimé est un filtre absent : tout compter plutôt que rien.
  assert.equal(T.normalizeProjectTreemapConfig({}).sizeFilter, null);
  assert.equal(T.normalizeProjectTreemapConfig({}).colorFilter, null);
});

test("la légende décrit des tranches réellement peuplées", () => {
  const rows = [{ colorValue: 0 }, { colorValue: 4 }, { colorValue: 8 }, { colorValue: 8 }];
  const buckets = T.treemapLegendBuckets(rows, "sizeFilterGradient", "ember", "lowToHigh");
  assert.ok(buckets.length >= 2 && buckets.length <= 4, `${buckets.length} tranches`);
  assert.equal(buckets.reduce((s, b) => s + b.count, 0), rows.length, "chaque projet tombe dans exactement une tranche");
  assert.equal(buckets[buckets.length - 1].count, 2, "la dernière tranche inclut le maximum");
  // Les bornes sont entières : un comptage de tâches n'a pas de décimale.
  buckets.forEach((b) => assert.match(b.label, /^\d+(–\d+)?$/, `libellé de tranche illisible : ${b.label}`));
  // Un comptage de 0 à 2 donne une tranche par valeur, pas des quarts de 0,5.
  const small = T.treemapLegendBuckets([{ colorValue: 0 }, { colorValue: 1 }, { colorValue: 2 }], "sizeFilterGradient", "ember", "lowToHigh");
  assert.deepEqual(small.map((b) => b.label), ["0", "1", "2"]);
  assert.deepEqual(small.map((b) => b.count), [1, 1, 1]);

  // Rien à colorer : pas de légende trompeuse.
  assert.deepEqual(T.treemapLegendBuckets([{ colorValue: 0 }], "sizeFilterGradient", "ember", "lowToHigh"), []);

  const levels = T.treemapLegendBuckets(
    [{ colorValue: 5 }, { colorValue: 30 }, { colorValue: 80 }],
    "averageCriticality", "levels", "lowToHigh"
  );
  assert.deepEqual(levels.map((b) => b.key), ["controlled", "watch", "high", "critical"]);
  assert.deepEqual(levels.map((b) => b.count), [1, 1, 0, 1]);
});

test("les prochaines tâches vont de la plus ancienne à la plus récente", () => {
  const tasks = [
    task({ id: "a", projectId: "p1", title: "Tard", end: "2026-10-20" }),
    task({ id: "b", projectId: "p1", title: "Dépassée", end: "2026-08-01" }),
    task({ id: "c", projectId: "p1", title: "Bientôt", end: "2026-09-15" }),
    task({ id: "d", projectId: "p1", title: "Terminée", end: "2026-08-05" }),
    task({ id: "e", projectId: "p1", title: "Sans échéance", end: "" }),
  ];
  const [p1] = T.computeTreemapProjects({
    projects, tasks,
    factsOf: factsById({ b: { late: true }, d: { done: true } }),
  });
  // Ni les terminées, ni celles sans échéance : la liste répond à « quoi ensuite ».
  assert.deepEqual(p1.upcoming.map((u) => u.title), ["Dépassée", "Bientôt", "Tard"]);
  assert.equal(p1.upcoming[0].late, true, "l'échéance dépassée est signalée, et vient en tête");
  assert.equal(p1.upcoming[1].late, false);
  assert.equal(p1.upcomingTotal, 3);
});

test("le nombre de tâches affichées suit la hauteur réelle de la tuile", () => {
  // Rien ne tient : mieux vaut aucune ligne qu'une ligne coupée en deux.
  assert.equal(T.treemapUpcomingCapacity(60, 60), 0);
  assert.equal(T.treemapUpcomingCapacity(70, 60), 0);
  assert.equal(T.treemapUpcomingCapacity(74, 60), 1);
  assert.equal(T.treemapUpcomingCapacity(102, 60), 3);
  // Plafonné : au-delà, la tuile deviendrait une liste, plus une tuile.
  assert.equal(T.treemapUpcomingCapacity(2000, 60), 8);
  // Entrées illisibles : zéro, jamais NaN lignes.
  assert.equal(T.treemapUpcomingCapacity(undefined, undefined), 0);
  assert.equal(T.treemapUpcomingCapacity("abc", 10), 0);
  // Tuile trop étroite : une puce suivie de trois points n'apprend rien.
  assert.equal(T.treemapUpcomingCapacity(200, 60, 60), 0);
  assert.ok(T.treemapUpcomingCapacity(200, 60, 200) > 0);
});

test("l'affichage des prochaines tâches est un réglage, désactivé par défaut", () => {
  assert.equal(T.normalizeProjectTreemapConfig({}).showUpcoming, false);
  assert.equal(T.normalizeProjectTreemapConfig({ treemapShowUpcoming: true }).showUpcoming, true);
  assert.equal(T.normalizeProjectTreemapConfig({ treemapShowUpcoming: "oui" }).showUpcoming, false);
});

/* ------------------------------------------------------------------------- *
 * Champ qui porte les tuiles (issue #47). Jusqu'ici une tuile était toujours
 * un projet ; elle peut désormais être un statut, un type ou une criticité.
 * ------------------------------------------------------------------------- */

const entities = [
  { id: "s1", name: "À planifier", color: "#64748B" },
  { id: "s2", name: "En cours", color: "#0EA5E9" },
];
const byStatus = (t) => t.statusId;

test("les quatre champs annoncés sont bien ceux demandés, et tous étiquetés", () => {
  assert.deepEqual(T.TREEMAP_TILE_BY, ["project", "status", "taskType", "criticality"]);
  T.TREEMAP_TILE_BY.forEach((key) => {
    const l = T.TREEMAP_TILE_BY_LABELS[key];
    assert.ok(l && l.label && l.tileName && l.plural, `libellés manquants pour « ${key} »`);
  });
});

test("sans rattachement explicite, une tuile reste un projet", () => {
  // La compatibilité n'est pas une politesse : tous les widgets déjà posés sur
  // un tableau de bord passent par ce chemin.
  const rows = T.computeTreemapProjects({
    projects: [{ id: "p1", name: "Chantier" }],
    tasks: [{ id: "t1", projectId: "p1", statusId: "s1" }],
  });
  assert.deepEqual(rows.map((r) => r.projectId), ["p1"]);
  assert.equal(rows[0].sizeCount, 1);
});

test("les tuiles se regroupent sur le champ demandé", () => {
  const rows = T.computeTreemapProjects({
    projects: entities,
    tasks: [
      { id: "t1", projectId: "p1", statusId: "s1" },
      { id: "t2", projectId: "p2", statusId: "s1" },
      { id: "t3", projectId: "p1", statusId: "s2" },
    ],
    bucketIdOf: byStatus,
  });
  assert.deepEqual(rows.map((r) => [r.projectId, r.sizeCount]), [["s1", 2], ["s2", 1]]);
});

test("seules les tuiles déclarées existent, et une tuile fourre-tout ne perd rien", () => {
  // Le bloc ne fabrique JAMAIS de tuile à partir des tâches : c'est l'appelant
  // qui déclare les entités. Sans cette règle, une valeur erronée en base
  // créerait une tuile fantôme que rien dans l'interface ne saurait nommer.
  const orpheline = { id: "t2", projectId: "p1", statusId: "s9-inconnu" };
  const sansDeclaration = T.computeTreemapProjects({
    projects: entities,
    tasks: [{ id: "t1", projectId: "p1", statusId: "s1" }, orpheline],
    bucketIdOf: byStatus,
  });
  assert.deepEqual(sansDeclaration.map((r) => r.projectId), ["s1"]);
  assert.equal(sansDeclaration.reduce((n, r) => n + r.sizeCount, 0), 1);

  // L'interface, elle, déclare une tuile « sans valeur » : c'est ce qui garantit
  // qu'aucune tâche du périmètre ne disparaisse du comptage sans qu'on le voie.
  const avecFourreTout = T.computeTreemapProjects({
    projects: [...entities, { id: "__none__", name: "Sans statut", color: "#94A3B8" }],
    tasks: [{ id: "t1", projectId: "p1", statusId: "s1" }, { id: "t2", projectId: "p1" }],
    bucketIdOf: (t) => t.statusId || "__none__",
  });
  assert.equal(avecFourreTout.reduce((n, r) => n + r.sizeCount, 0), 2);
  assert.ok(avecFourreTout.some((r) => r.projectId === "__none__" && r.sizeCount === 1));
});

test("le score de criticité d'une tâche ne dépend pas de l'axe choisi", () => {
  // Régression possible : la priorité du projet était lue sur l'ENTITÉ de la
  // tuile. Groupé par statut, « projet prioritaire » se serait évaporé, et la
  // même tâche aurait affiché deux scores selon le réglage du widget.
  const tasks = [{ id: "t1", projectId: "p1", statusId: "s1" }];
  const factsOf = () => ({ late: true, projectPriority: "high" });
  const parProjet = T.computeTreemapProjects({
    projects: [{ id: "p1", name: "Chantier", priority: "high" }], tasks, factsOf,
  });
  const parStatut = T.computeTreemapProjects({
    projects: entities, tasks, factsOf, bucketIdOf: byStatus,
  });
  assert.equal(parProjet[0].criticality.score, parStatut[0].criticality.score);
  assert.ok(parStatut[0].criticality.score >= T.TREEMAP_CRITICALITY_WEIGHTS.late + T.TREEMAP_CRITICALITY_WEIGHTS.projectPriorityHigh);
});

test("les champs propres au projet sont retirés dès que la tuile n'en est plus un", () => {
  const projet = T.normalizeProjectTreemapConfig({ treemapTileBy: "project", treemapFields: ["projectName", "budget", "folder", "riskCount", "priority", "progress"] });
  assert.ok(T.TREEMAP_PROJECT_ONLY_FIELDS.every((k) => projet.fields.includes(k)), "sur un projet, ces champs restent proposés");
  const statut = T.normalizeProjectTreemapConfig({ treemapTileBy: "status", treemapFields: ["projectName", "budget", "folder", "riskCount", "priority", "progress"] });
  assert.deepEqual(statut.fields, ["projectName", "progress"]);
});

test("le statut dominant d'une tuile de statut est une tautologie, donc retiré", () => {
  const statut = T.normalizeProjectTreemapConfig({ treemapTileBy: "status", treemapFields: ["projectName", "dominantStatus", "progress"] });
  assert.deepEqual(statut.fields, ["projectName", "progress"]);
  const type = T.normalizeProjectTreemapConfig({ treemapTileBy: "taskType", treemapFields: ["projectName", "dominantStatus", "progress"] });
  assert.ok(type.fields.includes("dominantStatus"), "sur un type, le statut dominant reste une information");
});

test("le nom de la tuile reste toujours affiché, quel que soit le champ", () => {
  T.TREEMAP_TILE_BY.forEach((key) => {
    const cfg = T.normalizeProjectTreemapConfig({ treemapTileBy: key, treemapFields: ["progress"] });
    assert.equal(cfg.fields[0], "projectName", `sans son nom, une tuile « ${key} » ne désigne rien`);
  });
});

test("regrouper par dossier ou priorité retombe sur « aucun » hors des projets", () => {
  // Ces deux notions sont des attributs de projet : conservées, elles
  // produiraient des bandes vides que rien n'expliquerait.
  for (const groupBy of ["folder", "priority"]) {
    assert.equal(T.normalizeProjectTreemapConfig({ treemapTileBy: "project", treemapGroupBy: groupBy }).groupBy, groupBy);
    assert.equal(T.normalizeProjectTreemapConfig({ treemapTileBy: "status", treemapGroupBy: groupBy }).groupBy, "none");
  }
  // « Responsable » et « criticité » se calculent par tuile : ils survivent.
  for (const groupBy of ["owner", "criticality"]) {
    assert.equal(T.normalizeProjectTreemapConfig({ treemapTileBy: "status", treemapGroupBy: groupBy }).groupBy, groupBy);
  }
});

test("un champ de tuile inconnu est refusé", () => {
  const cfg = T.normalizeProjectTreemapConfig({ treemapTileBy: "criticality", treemapFields: ["projectName", "inventé", "progress"] });
  assert.deepEqual(cfg.fields, ["projectName", "progress"]);
});
