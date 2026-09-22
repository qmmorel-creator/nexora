/* Fiche projet PDF (#291). Comme les autres suites, les fonctions pures sont
   extraites du bundle RÉELLEMENT construit — jamais recopiées — entre leurs
   sentinelles (NEXORA:PROJECT-PDF-CORE et les briques qu'il réutilise). Le
   dessin jsPDF (NEXORA:PROJECT-PDF-DRAW) est éprouvé par la recette rasterisée
   de tools/pdf-check : jsPDF n'est chargé que par CDN dans le navigateur,
   jamais en npm côté apps/nexora (voir quotes.test.mjs). */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as F from "./fixtures/project-pdf-fixtures.mjs";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const P = vm.runInThisContext(
  `(function () {\n${["DATE-UTILS", "TASK-STATUS", "TASK-KIND", "CRITICALITY", "MEMO-PDF-CORE", "PROJECT-PDF-CORE"].map(slice).join("\n")}
  ;return {
    memoSlug, memoFileName, metroRowProgress, projectPdfFileName, projectPdfSafeText,
    projectPdfContrastRatio, projectPdfChipColors, projectPdfTextOnPaper, projectPdfImageSource,
    projectPdfMember, projectPdfNextCritical, projectPdfData, projectPdfMetroProjection,
    projectPdfBoxesOverlap, projectPdfSeparators, projectPdfSeparatorUnit, projectPdfFmtDate, CRITICALITIES,
  };\n})`
)();

// Largeur approximative d'Helvetica (mm) : suffisante pour éprouver le placement.
const measure = (text, pt, bold) => String(text).length * pt * 0.3528 * (bold ? 0.56 : 0.52);
const ctx = { statuses: F.statuses };

// --- Règle d'avancement partagée avec la Vue Métro ---------------------------

test("metroRowProgress : moyenne des tâches non-jalons, une tâche terminée compte 100 %", () => {
  const tasks = [
    { statusId: "s3", progress: 40, milestone: false },
    { statusId: "s5", progress: 10, milestone: false }, // terminée : 100, pas 10
    { statusId: "s3", milestone: false },                // sans avancement : 0
    { statusId: "s3", progress: 90, milestone: true },   // jalon : ignoré
  ];
  assert.equal(P.metroRowProgress(tasks, ctx), Math.round((40 + 100 + 0) / 3));
});

test("metroRowProgress : null sans tâche non-jalon (indicateur non déterminable)", () => {
  assert.equal(P.metroRowProgress([], ctx), null);
  assert.equal(P.metroRowProgress([{ statusId: "s3", milestone: true, progress: 50 }], ctx), null);
});

test("la Vue Métro calcule l'avancement de ses lignes avec la même fonction (aucun calcul parallèle)", () => {
  assert.match(html, /const avgProgress = metroRowProgress\(pTasks, ctx\) \?\? 0;/);
  assert.doesNotMatch(html, /const progressVals = pTasks\.map/);
});

// --- Nom de fichier, texte sûr --------------------------------------------------

test("projectPdfFileName : nexora-fiche-projet-<slug>-<AAAA-MM-JJ>.pdf", () => {
  assert.equal(P.projectPdfFileName("Médiation Maïa Sonnier", "2026-09-22"), "nexora-fiche-projet-mediation-maia-sonnier-2026-09-22.pdf");
  assert.equal(P.projectPdfFileName("", "2026-09-22"), "nexora-fiche-projet-projet-2026-09-22.pdf");
  assert.equal(P.projectPdfFileName("!!!", ""), "nexora-fiche-projet-projet-0000-00-00.pdf");
});

test("memoSlug garde son repli historique pour la fiche mémo", () => {
  assert.equal(P.memoSlug(""), "tache");
  assert.equal(P.memoFileName("", "2026-09-22"), "nexora-fiche-memo-tache-2026-09-22.pdf");
});

test("projectPdfSafeText : conserve le français, convertit les flèches, retire l'illisible", () => {
  assert.equal(P.projectPdfSafeText("Réunion Maïa — « cœur » l’été 3 €"), "Réunion Maïa — « cœur » l’été 3 €");
  assert.equal(P.projectPdfSafeText("A → B ⇒ C"), "A -> B => C");
  assert.equal(P.projectPdfSafeText("✅ Livré 🚧 chantier"), "Livré chantier");
  assert.equal(P.projectPdfSafeText(null), "");
});

// --- Couleurs et contraste ----------------------------------------------------

test("projectPdfContrastRatio : valeurs WCAG de référence", () => {
  assert.equal(Math.round(P.projectPdfContrastRatio("#000000", "#FFFFFF")), 21);
  assert.equal(P.projectPdfContrastRatio("#777777", "#777777"), 1);
});

test("projectPdfChipColors : toute pastille de catalogue atteint 4,5:1 (WCAG AA)", () => {
  const colors = [
    ...F.statuses.map((s) => s.color), ...F.taskTypes.map((t) => t.color), ...P.CRITICALITIES.map((c) => c.color),
    "#14B8A6", "#f1f443", "#bdcaff", "#5ff762", "#adfe16", "#FF7A3D", "pas-une-couleur",
  ];
  colors.forEach((hex) => {
    const c = P.projectPdfChipColors(hex);
    assert.ok(P.projectPdfContrastRatio(c.bg, c.ink) >= 4.5, `${hex} -> ${c.bg}/${c.ink}`);
  });
});

test("projectPdfChipColors : garde la couleur du catalogue quand elle est déjà lisible", () => {
  assert.equal(P.projectPdfChipColors("#DC2626").bg, "#DC2626");
  assert.equal(P.projectPdfChipColors("#0EA5E9").bg, "#0EA5E9"); // encre foncée plutôt qu'un texte blanc illisible
  assert.equal(P.projectPdfChipColors("#0EA5E9").ink, "#10151F");
});

test("projectPdfTextOnPaper : texte coloré assombri jusqu'à 4,5:1 sur blanc", () => {
  ["#14B8A6", "#F2A93B", "#adfe16", "#1FA971"].forEach((hex) => {
    assert.ok(P.projectPdfContrastRatio(P.projectPdfTextOnPaper(hex), "#FFFFFF") >= 4.5, hex);
  });
});

// --- Images ----------------------------------------------------------------------

test("projectPdfImageSource : PNG/JPEG ou URL seulement ; emoji et icônes retombent sur le repli", () => {
  assert.equal(P.projectPdfImageSource("data:image/png;base64,AAAA").format, "PNG");
  assert.equal(P.projectPdfImageSource("data:image/jpeg;base64,AAAA").format, "JPEG");
  assert.equal(P.projectPdfImageSource("https://exemple.org/a.png").kind, "url");
  assert.equal(P.projectPdfImageSource("🚧"), null);
  assert.equal(P.projectPdfImageSource("tabler:world|#7C5CFF"), null);
  assert.equal(P.projectPdfImageSource("data:image/svg+xml;base64,AAAA"), null);
  assert.equal(P.projectPdfImageSource(null), null);
});

test("projectPdfMember : initiales et couleur d'équipe de l'application, jamais de responsable inventé", () => {
  assert.equal(P.projectPdfMember("", F.teamMembers), null);
  const q = P.projectPdfMember("Quentin", F.teamMembers);
  assert.deepEqual([q.initials, q.color, q.image], ["Q", "#869afe", null]);
  assert.equal(P.projectPdfMember("Inconnu Total", F.teamMembers).initials, "IT");
});

// --- Agrégation : cas réel « Médiation Maïa Sonnier » ------------------------

const maia = P.projectPdfData("qjah9det", F.maiaCatalogs, F.MAIA_TODAY);

test("Maïa : couleur du projet et métadonnées strictement propres au projet", () => {
  assert.equal(maia.project.color, "#14B8A6");
  assert.equal(maia.project.name, "Médiation Maïa Sonnier");
  // Ni description, ni responsable, ni statut, ni type : absents des données projet.
  assert.deepEqual(Object.keys(maia.project).sort(), ["color", "id", "image", "name"]);
  assert.equal(maia.project.image, null); // icône « tabler:route » : marqueur de couleur
});

test("Maïa : indicateurs de synthèse", () => {
  assert.deepEqual(maia.counts, { total: 5, active: 4, inProgress: 3, done: 1, waitingThird: 1, blocked: 1, upcomingMilestones: 2 });
  assert.deepEqual(maia.period, { start: "2026-09-18", end: "2026-11-30" });
  assert.equal(maia.progress, 0); // une seule tâche non-jalon, à 0 %
  assert.equal(maia.perimeterCount, 1);
  assert.deepEqual(maia.statusColors, { inProgress: "#0EA5E9", done: "#22B07D", waitingThird: "#8B5CF6" });
});

test("Maïa : tâches en cours, jalon urgent, attente tiers et réunion terminée", () => {
  const titles = (list) => list.map((r) => r.title);
  const inProgress = maia.taskRows.filter((r) => r.status?.name === "En cours");
  assert.deepEqual(titles(inProgress).sort(), ["Deadline Envois Docs Expertise", "Envoyer la dernière note PN", "Fournir Note de Synthèse des bétons"]);
  assert.equal(maia.nextCritical.row.title, "Envoyer la dernière note PN");
  assert.equal(maia.nextCritical.reason, "urgent");
  assert.equal(maia.nextCritical.overdue, true);
  assert.equal(maia.nextCritical.row.milestone, true);
  assert.deepEqual(titles(maia.taskRows.filter((r) => r.status?.name === "Attente tiers")), ["Rapport des Experts"]);
  const meeting = maia.taskRows.find((r) => r.title === "Réunion expertise amiable Maïa-CNR");
  assert.equal(meeting.done, true);
  assert.equal(meeting.lastMilestone, true); // seule tâche terminée admise : le dernier jalon franchi
  assert.equal(maia.taskRows.filter((r) => r.done).length, 1);
});

test("Maïa : les tâches d'un autre projet n'entrent jamais dans la fiche", () => {
  assert.ok(!maia.taskRows.some((r) => r.title === "Tâche d'un autre projet"));
  assert.ok(!maia.metroTasks.some((r) => r.title === "Tâche d'un autre projet"));
});

test("Maïa : répartition par statut et par type avec les couleurs du catalogue", () => {
  assert.deepEqual(maia.byStatus.map((s) => [s.name, s.color, s.count]), [["En cours", "#0EA5E9", 3], ["Attente tiers", "#8B5CF6", 1]]);
  assert.deepEqual(maia.byType.map((s) => [s.name, s.color, s.count]), [["Tâches", "#4F6AF5", 4]]);
});

test("projectPdfData : lecture seule, les catalogues ne sont jamais modifiés", () => {
  const catalogs = F.makeLongCatalogs();
  const before = JSON.stringify(catalogs);
  P.projectPdfData(F.LONG_PROJECT_ID, catalogs, F.MAIA_TODAY);
  assert.equal(JSON.stringify(catalogs), before);
});

test("projectPdfData : projet inconnu -> null ; attente tiers non déterminable sans statut", () => {
  assert.equal(P.projectPdfData("absent", F.maiaCatalogs, F.MAIA_TODAY), null);
  const noThird = { ...F.maiaCatalogs, statuses: F.statuses.filter((s) => s.id !== "s2"), tasks: F.maiaTasks.filter((t) => t.statusId !== "s2") };
  assert.equal(P.projectPdfData("qjah9det", noThird, F.MAIA_TODAY).counts.waitingThird, null);
});

test("projectPdfData : un projet sans tâche n'invente ni période ni avancement ni échéance", () => {
  const d = P.projectPdfData("qjah9det", { ...F.maiaCatalogs, tasks: [] }, F.MAIA_TODAY);
  assert.equal(d.period, null);
  assert.equal(d.progress, null);
  assert.equal(d.nextCritical, null);
  assert.deepEqual(d.taskRows, []);
});

// --- Échéance critique -------------------------------------------------------------

test("projectPdfNextCritical : urgente la plus proche, même en retard ; sinon prochain jalon ; sinon rien", () => {
  const T = F.MAIA_TODAY;
  const a = { title: "a", end: "2026-10-05", criticality: "urgent" };
  const b = { title: "b", end: "2026-09-01", criticality: "urgent" };
  const m = { title: "m", end: "2026-10-01", milestone: true };
  const old = { title: "old", end: "2026-09-01", milestone: true };
  assert.equal(P.projectPdfNextCritical([a, b, m], T).task.title, "b");
  assert.equal(P.projectPdfNextCritical([m, old, { title: "x", end: "2026-09-25" }], T).task.title, "m");
  assert.equal(P.projectPdfNextCritical([old, { title: "x", end: "2026-09-25" }], T), null);
});

// --- Dépendances et périmètre ---------------------------------------------------

test("dépendances : uniquement réelles et résolubles ; inter-projets = correspondance", () => {
  const catalogs = F.makeLongCatalogs();
  catalogs.tasks[4].dependsOn = ["n-existe-pas"];
  const d = P.projectPdfData(F.LONG_PROJECT_ID, catalogs, F.MAIA_TODAY);
  assert.ok(!d.dependencies.some((x) => x.fromId === "n-existe-pas"));
  const cross = d.dependencies.filter((x) => x.cross);
  assert.deepEqual(cross.map((x) => [x.fromId, x.toId, x.otherProjectId]), [["P1", "L9", "partner"]]);
  assert.deepEqual(d.partners.map((p) => p.name), ["Bouclage DREAL"]);
  assert.equal(d.perimeterCount, 2);
});

// --- Projection Métro ------------------------------------------------------------

function assertNoOverlap(proj) {
  const s = proj.stations;
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      assert.ok(!P.projectPdfBoxesOverlap(s[i].box, s[j].box), `libellés superposés : ${s[i].item.t.title} / ${s[j].item.t.title}`);
      assert.ok(!P.projectPdfBoxesOverlap(s[i].box, s[j].glyph), `libellé sur une station : ${s[i].item.t.title} / ${s[j].item.t.title}`);
    }
  }
  s.forEach((st) => {
    assert.ok(st.box.x1 >= 0 && st.box.x2 <= proj.width, `libellé hors cadre : ${st.item.t.title}`);
  });
}

test("projection Maïa : une station par tâche datée, grammaire Métro, aucun chevauchement", () => {
  const proj = P.projectPdfMetroProjection(maia, { width: 178, measure });
  assert.equal(proj.numbered, false);
  assert.equal(proj.stations.length, 5);
  const kinds = Object.fromEntries(proj.stations.map((s) => [s.item.t.title, s.item.kind]));
  assert.equal(kinds["Fournir Note de Synthèse des bétons"], "action");      // bifurcation
  assert.equal(kinds["Envoyer la dernière note PN"], "milestone");           // jalon
  assertNoOverlap(proj);
  assert.ok(proj.todayX > proj.xStart && proj.todayX < proj.xEnd); // 22 sept. dans la période
});

test("projection : légende limitée aux codes réellement visibles", () => {
  const proj = P.projectPdfMetroProjection(maia, { width: 178, measure });
  assert.deepEqual(proj.legend, { milestone: true, action: true, done: true, late: true, dependency: false, correspondence: false, shared: false, today: true, future: true });
});

test("projection projet long : dépendances, correspondance et tronc commun ; aucun chevauchement", () => {
  const d = P.projectPdfData(F.LONG_PROJECT_ID, F.makeLongCatalogs(), F.MAIA_TODAY);
  const proj = P.projectPdfMetroProjection(d, { width: 178, measure });
  assert.equal(proj.stations.length, 26);
  assert.ok(proj.connectors.length > 0);
  assert.equal(proj.correspondences.length, 1);
  assert.equal(proj.legend.shared, true);
  assertNoOverlap(proj);
});

test("projection trop haute : bascule en stations numérotées, toujours sans chevauchement", () => {
  const d = P.projectPdfData(F.LONG_PROJECT_ID, F.makeLongCatalogs(), F.MAIA_TODAY);
  const proj = P.projectPdfMetroProjection(d, { width: 178, measure, maxHeight: 20 });
  assert.equal(proj.numbered, true);
  assert.deepEqual(proj.stations.map((s) => s.number).sort((a, b) => a - b), Array.from({ length: 26 }, (_, i) => i + 1));
  assertNoOverlap(proj);
});

test("projection : aucune tâche datée -> pas de vue Métro (section retirée)", () => {
  assert.equal(P.projectPdfMetroProjection({ ...maia, metroTasks: [] }, { width: 178, measure }), null);
});

test("projection : « aujourd'hui » absent quand il tombe hors période", () => {
  const proj = P.projectPdfMetroProjection({ ...maia, today: "2027-03-01" }, { width: 178, measure });
  assert.equal(proj.todayX, null);
  assert.equal(proj.legend.today, false);
  assert.equal(proj.legend.future, false);
});

test("colonnes temporelles : semaine, mois ou trimestre selon la durée, libellés réels", () => {
  assert.equal(P.projectPdfSeparatorUnit(30), "week");
  assert.equal(P.projectPdfSeparatorUnit(73), "month");
  assert.equal(P.projectPdfSeparatorUnit(1200), "quarter");
  assert.deepEqual(P.projectPdfSeparators("2026-09-18", "2026-11-30", "month").map((s) => s.label), ["sept. 2026", "oct.", "nov."]);
  assert.equal(P.projectPdfFmtDate("2026-09-18"), "18 sept. 2026");
  assert.equal(P.projectPdfFmtDate(""), "");
});
