import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même règle que les autres bancs : les fonctions testées sont extraites de
// l'interface RÉELLEMENT assemblée, jamais recopiées à côté.
const START = "// === NEXORA:MARKDOWN:START ===";
const END = "// === NEXORA:MARKDOWN:END ===";
const EXPORTS = ["escapeHtml", "renderMarkdown", "mdTableCells", "mdTableAligns", "mdTableParse", "mdTableHtml"];

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc Markdown introuvable dans .build/index.html");

const { escapeHtml, renderMarkdown, mdTableCells, mdTableAligns, mdTableParse, mdTableHtml } =
  vm.runInThisContext(`(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`)();

// Le tableau de l'issue #71, tel que ChatGPT le produit.
const TABLE = [
  "| N° de réserve | Statut / observations |",
  "|---:|---|",
  "| 5 | Non fait. |",
  "| 8 | Non fait : absence de constat contradictoire… |",
].join("\n");

test("un tableau GFM devient un vrai tableau", () => {
  const out = renderMarkdown(TABLE);
  assert.match(out, /<table class="lp-md-table">/);
  assert.equal((out.match(/<th[ >]/g) || []).length, 2, "thead ne compte pas pour une cellule");
  assert.equal((out.match(/<tr>/g) || []).length, 3, "un en-tête et deux lignes");
  assert.equal((out.match(/<td/g) || []).length, 4);
  // Le symptôme d'origine : chaque ligne devenait un paragraphe, barres comprises.
  assert.doesNotMatch(out, /<p>\|/);
});

test("l'alignement des colonnes est respecté", () => {
  const out = renderMarkdown(TABLE);
  assert.match(out, /<th style="text-align:right">N° de réserve<\/th>/);
  assert.match(out, /<th>Statut \/ observations<\/th>/, "sans deux-points, aucun alignement imposé");
  assert.deepEqual(mdTableAligns("| :--- | :---: | ---: | --- |"), ["left", "center", "right", ""]);
});

test("le défilement appartient au tableau, pas à la modale", () => {
  // Sans cette enveloppe, un tableau large élargit toute la fiche de tâche.
  assert.match(renderMarkdown(TABLE), /<div class="lp-md-table-wrap">/);
});

test("une ligne isolée pleine de barres reste du texte", () => {
  // C'est la ligne de séparation qui fait le tableau. Sans elle, « a | b » est
  // une phrase, et la transformer en tableau serait pire que de ne rien faire.
  assert.equal(mdTableAligns("| a | b |"), null);
  assert.equal(mdTableParse(["| a | b |", "du texte"], 0), null);
  assert.match(renderMarkdown("Coût | Délai"), /<p>/);
});

test("en-tête et séparation doivent avoir le même nombre de colonnes", () => {
  assert.equal(mdTableParse(["| a | b | c |", "|---|---|"], 0), null);
});

test("les barres de bord sont facultatives", () => {
  assert.deepEqual(mdTableCells("a | b | c"), ["a", "b", "c"]);
  assert.deepEqual(mdTableCells("| a | b |"), ["a", "b"]);
  assert.match(renderMarkdown("a | b\n---|---\n1 | 2"), /<table/);
});

test("une barre échappée appartient au texte de la cellule", () => {
  // Sinon elle ouvrirait une colonne fantôme et décalerait toute la ligne.
  assert.deepEqual(mdTableCells("| a \\| b | c |"), ["a | b", "c"]);
});

test("une ligne trop courte ou trop longue ne décale pas les colonnes", () => {
  const parsed = mdTableParse(["| a | b |", "|---|---|", "| 1 |", "| 1 | 2 | 3 |"], 0);
  assert.deepEqual(parsed.body, [["1", ""], ["1", "2"]]);
});

test("le tableau s'arrête à la première ligne qui n'en est pas", () => {
  const lines = ["| a |", "|---|", "| 1 |", "", "Suite du texte"];
  const parsed = mdTableParse(lines, 0);
  assert.equal(parsed.next, 3, "la ligne vide referme le tableau");
  const out = renderMarkdown(lines.join("\n"));
  assert.match(out, /<table/);
  assert.match(out, /<p>Suite du texte<\/p>/);
});

test("le contenu des cellules reste échappé", () => {
  // Le résultat part en dangerouslySetInnerHTML : une cellule ne doit jamais
  // pouvoir poser une balise.
  const out = renderMarkdown('| a |\n|---|\n| <img src=x onerror=alert(1)> |');
  assert.doesNotMatch(out, /<img/);
  assert.match(out, /&lt;img/);
});

test("la mise en forme en ligne fonctionne dans une cellule", () => {
  const out = renderMarkdown("| a |\n|---|\n| **gras** et `code` |");
  assert.match(out, /<strong>gras<\/strong>/);
  assert.match(out, /<code>code<\/code>/);
});

test("accents, apostrophes typographiques et numéros sont préservés", () => {
  const out = renderMarkdown("| N° |\n|---|\n| Réserve n° 8 — « levée » |");
  assert.match(out, /N°/);
  assert.match(out, /Réserve n° 8 — « levée »/);
});

test("mdTableHtml n'invente pas d'attribut d'alignement", () => {
  const html = mdTableHtml({ aligns: ["", "center"], header: ["a", "b"], body: [["1", "2"]] }, (x) => x);
  assert.match(html, /<th>a<\/th>/);
  assert.match(html, /<th style="text-align:center">b<\/th>/);
});

test("les autres éléments Markdown ne régressent pas", () => {
  const out = renderMarkdown("# Titre\n- un\n- deux\n\n**gras**");
  assert.match(out, /<h2>Titre<\/h2>/);
  assert.equal((out.match(/<li>/g) || []).length, 2);
  assert.match(out, /<strong>gras<\/strong>/);
});

test("escapeHtml échappe aussi guillemets et apostrophes", () => {
  // Acquis de #60 : la garde ne doit pas se perdre en touchant à ce bloc.
  assert.equal(escapeHtml(`<a "b" 'c' & d>`), "&lt;a &quot;b&quot; &#39;c&#39; &amp; d&gt;");
});
