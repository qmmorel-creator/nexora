/* Fiche mémo PDF (#289). Comme les autres suites, les fonctions pures sont
   extraites du bundle RÉELLEMENT construit — jamais recopiées — entre les
   sentinelles NEXORA:MEMO-PDF-CORE. Le dessin jsPDF (NEXORA:MEMO-PDF-DRAW,
   index.html.part-003) n'est pas testé ici : comme pour le module Devis,
   jsPDF n'est chargé que via CDN dans le navigateur, jamais en npm côté
   Node — voir le commentaire en tête de quotes.test.mjs. */

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

const M = vm.runInThisContext(
  `(function () {\n${slice("MEMO-PDF-CORE")}\n;return {
    memoSlug, memoFileName, memoHexToRgb, memoContrastInk, memoInitials,
    memoInlineSegments, memoMarkdownBlocks, memoTaskFields,
  };\n})`
)();

// --- memoSlug / memoFileName ------------------------------------------------

test("memoSlug : minuscules, accents retirés, tirets, jamais de tiret en bout", () => {
  assert.equal(M.memoSlug("Réunion expertise amiable Maïa-CNR"), "reunion-expertise-amiable-maia-cnr");
  assert.equal(M.memoSlug("  --Titre !!  "), "titre");
  assert.equal(M.memoSlug(""), "tache");
  assert.equal(M.memoSlug(null), "tache");
});

test("memoFileName : nom stable et sûr, format imposé", () => {
  assert.equal(
    M.memoFileName("Réunion expertise amiable Maïa-CNR", "2026-09-22T10:00:00.000Z"),
    "nexora-fiche-memo-reunion-expertise-amiable-maia-cnr-2026-09-22.pdf"
  );
  assert.equal(M.memoFileName("x", ""), "nexora-fiche-memo-x-0000-00-00.pdf");
});

// --- Couleurs / contraste ----------------------------------------------------

test("memoHexToRgb : décode un hex valide, repli neutre sinon", () => {
  assert.deepEqual(M.memoHexToRgb("#1FA971"), [31, 169, 113]);
  assert.deepEqual(M.memoHexToRgb("DC2626"), [220, 38, 38]);
  assert.deepEqual(M.memoHexToRgb("pas-une-couleur"), [140, 148, 165]);
});

test("memoContrastInk : jamais un texte illisible sur sa propre couleur de fond", () => {
  assert.equal(M.memoContrastInk("#101B2D"), "#FFFFFF"); // fond très sombre -> texte blanc
  assert.equal(M.memoContrastInk("#FFF2CC"), "#101B2D"); // fond très clair -> encre foncée
});

test("memoInitials : jusqu'à deux initiales, majuscules, jamais vide", () => {
  assert.equal(M.memoInitials("Claire Dufour"), "CD");
  assert.equal(M.memoInitials("Quentin"), "Q");
  assert.equal(M.memoInitials(""), "?");
  assert.equal(M.memoInitials("  "), "?");
});

// --- Segments en ligne --------------------------------------------------------

test("memoInlineSegments : gras, italique, code et lien reconnus séparément", () => {
  const segs = M.memoInlineSegments("Un **gras**, un *italique*, un `code` et un [lien](https://x.com)");
  assert.deepEqual(segs.map((s) => s.text), ["Un ", "gras", ", un ", "italique", ", un ", "code", " et un ", "lien"]);
  assert.equal(segs[1].bold, true);
  assert.equal(segs[3].italic, true);
  assert.equal(segs[5].code, true);
  assert.equal(segs[7].href, "https://x.com");
});

test("memoInlineSegments : texte sans marqueur reste un seul segment brut", () => {
  const segs = M.memoInlineSegments("Rien de spécial ici.");
  assert.deepEqual(segs, [{ text: "Rien de spécial ici." }]);
});

// --- Blocs Markdown ------------------------------------------------------------

test("memoMarkdownBlocks : titres, paragraphe, listes, cases à cocher", () => {
  const blocks = M.memoMarkdownBlocks("# Titre\n\nParagraphe **gras**.\n\n- item\n\n- [ ] à faire\n- [x] fait\n");
  assert.deepEqual(blocks.map((b) => b.type), ["h2", "p", "li", "task", "task"]);
  assert.equal(blocks[3].checked, false);
  assert.equal(blocks[4].checked, true);
});

test("memoMarkdownBlocks : callout Obsidian, un niveau, texte imbriqué préservé", () => {
  const blocks = M.memoMarkdownBlocks("> [!warning] Attention\n> corps du callout\n> deuxième ligne");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "callout");
  assert.equal(blocks[0].calloutType, "warning");
  assert.equal(blocks[0].title, "Attention");
  assert.equal(blocks[0].blocks.length, 2);
  assert.equal(blocks[0].blocks[0].segments[0].text, "corps du callout");
});

test("memoMarkdownBlocks : un type de callout inconnu retombe sur « note »", () => {
  const blocks = M.memoMarkdownBlocks("> [!custom] Titre\n> corps");
  assert.equal(blocks[0].calloutType, "note");
});

test("memoMarkdownBlocks : tableau GFM, alignements et cellules", () => {
  const blocks = M.memoMarkdownBlocks("| A | B |\n|---|--:|\n| 1 | 2 |\n| 3 | 4 |\n");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "table");
  assert.deepEqual(blocks[0].aligns, ["", "right"]);
  assert.equal(blocks[0].rows.length, 2);
  assert.equal(blocks[0].rows[0][0][0].text, "1");
});

test("memoMarkdownBlocks : texte vide ne produit aucun bloc", () => {
  assert.deepEqual(M.memoMarkdownBlocks(""), []);
  assert.deepEqual(M.memoMarkdownBlocks(null), []);
});

// --- Sélection des champs réellement présents ---------------------------------

const catalogs = {
  projects: [{ id: "p1", name: "Digue confortement", color: "#0E9488" }],
  statuses: [{ id: "s1", name: "En cours", color: "#2563EB" }],
  taskTypes: [{ id: "t1", name: "Chantier", color: "#B45309" }],
  teamMembers: [{ id: "u1", name: "Claire Dufour", color: "#0E9488", avatarDataUrl: null }],
  criticalities: [{ id: "urgent", name: "Urgent", color: "#DC2626" }],
  tasks: [{ id: "dep1", title: "Étude géotechnique préalable" }],
};

test("memoTaskFields : n'invente rien — un champ absent est null, pas une valeur fabriquée", () => {
  const f = M.memoTaskFields({ title: "Sans rien" }, catalogs);
  assert.equal(f.hasDescription, false);
  assert.equal(f.hasReport, false);
  assert.equal(f.project, null);
  assert.equal(f.taskType, null);
  assert.equal(f.status, null);
  assert.equal(f.criticality, null);
  assert.equal(f.responsible, null);
  assert.equal(f.progress, null);
  assert.deepEqual(f.checklist, []);
  assert.deepEqual(f.attachments, []);
  assert.deepEqual(f.dependencies, []);
  assert.equal(f.milestone, false);
});

test("memoTaskFields : reprend les champs présents avec leurs couleurs réelles", () => {
  const f = M.memoTaskFields({
    title: "Coordination chantier",
    desc: "Un texte.",
    meetingReport: "",
    projectId: "p1", statusId: "s1", taskTypeId: "t1", criticality: "urgent",
    milestone: true,
    start: "2026-08-03", end: "2026-10-18",
    assignee: "Claire Dufour",
    progress: 62,
    dependsOn: ["dep1", "dep-inconnu"],
    checklist: [{ text: "Faire X", done: true, end: "2026-08-05" }, { text: "  " }],
    attachments: [{ name: "Plan.pdf", type: "file" }],
  }, catalogs);

  assert.equal(f.hasDescription, true);
  assert.equal(f.hasReport, false); // meetingReport vide -> absent, jamais un bloc vide
  assert.deepEqual(f.project, { name: "Digue confortement", color: "#0E9488" });
  assert.deepEqual(f.status, { name: "En cours", color: "#2563EB" });
  assert.deepEqual(f.taskType, { name: "Chantier", color: "#B45309" });
  assert.deepEqual(f.criticality, { name: "Urgent", color: "#DC2626" });
  assert.equal(f.milestone, true);
  assert.equal(f.progress, 62);
  assert.equal(f.responsible.name, "Claire Dufour");
  assert.equal(f.responsible.initials, "CD");
  assert.equal(f.responsible.color, "#0E9488");
  assert.equal(f.checklist.length, 1, "une sous-tâche sans texte ne doit pas apparaître");
  assert.equal(f.checklist[0].text, "Faire X");
  assert.equal(f.attachments.length, 1);
  assert.equal(f.dependencies.length, 1, "une dépendance vers une tâche supprimée doit disparaître, pas planter");
  assert.equal(f.dependencies[0].title, "Étude géotechnique préalable");
});

test("memoTaskFields : progression hors bornes est ramenée entre 0 et 100", () => {
  assert.equal(M.memoTaskFields({ title: "x", progress: 500 }, catalogs).progress, 100);
  assert.equal(M.memoTaskFields({ title: "x", progress: -20 }, catalogs).progress, 0);
});

test("memoTaskFields : un responsable sans fiche annuaire garde son nom et une couleur de repli", () => {
  const f = M.memoTaskFields({ title: "x", assignee: "Personne Inconnue" }, catalogs);
  assert.equal(f.responsible.name, "Personne Inconnue");
  assert.equal(f.responsible.avatarDataUrl, null);
  assert.ok(f.responsible.color);
});
