import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:ICON-URL:START ===";
const END = "// === NEXORA:ICON-URL:END ===";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc des icônes par URL introuvable dans .build/index.html");
const { normalizeIconUrl, resolveIconChoice } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { normalizeIconUrl, resolveIconChoice };\n})`
)();

test("la casse du protocole ne décide plus si l'icône s'affiche", () => {
  // C'est LE défaut de #70 : la fiche acceptait « HTTPS:// », le rendu non.
  assert.equal(normalizeIconUrl("HTTPS://cdn.exemple/logo.png"), "HTTPS://cdn.exemple/logo.png");
  assert.equal(normalizeIconUrl("Http://cdn.exemple/logo.png"), "Http://cdn.exemple/logo.png");
  assert.equal(normalizeIconUrl("https://cdn.exemple/logo.png"), "https://cdn.exemple/logo.png");
});

test("les espaces d'un copier-coller ne cassent plus l'icône", () => {
  assert.equal(normalizeIconUrl("  https://cdn.exemple/logo.png \n"), "https://cdn.exemple/logo.png");
});

test("une URL à protocole implicite devient une URL https", () => {
  // « //cdn/x.png » est valide en HTML ; elle s'affichait en toutes lettres.
  assert.equal(normalizeIconUrl("//cdn.exemple/logo.png"), "https://cdn.exemple/logo.png");
});

test("les paramètres de requête et les formats usuels passent tous", () => {
  for (const u of [
    "https://cdn.exemple/logo.png?v=3&size=64",
    "https://cdn.exemple/logo.jpg",
    "https://cdn.exemple/logo.jpeg",
    "https://cdn.exemple/logo.webp",
    "https://cdn.exemple/logo.svg",
    "https://cdn.exemple/favicon.ico",
    "https://cdn.exemple/image",          // sans extension : c'est le serveur qui décide
  ]) assert.equal(normalizeIconUrl(u), u, u);
});

test("une image en ligne data: est acceptée, les autres data: non", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  assert.equal(normalizeIconUrl(png), png);
  assert.equal(normalizeIconUrl("data:text/html,<script>alert(1)</script>"), null);
});

test("ce qui n'est pas une URL suit son propre chemin", () => {
  // tabler:, iconify: et les emojis ne doivent surtout pas être happés ici.
  assert.equal(normalizeIconUrl("tabler:alert-triangle"), null);
  assert.equal(normalizeIconUrl("iconify:mdi/home"), null);
  assert.equal(normalizeIconUrl("📊"), null);
  assert.equal(normalizeIconUrl(""), null);
  assert.equal(normalizeIconUrl("   "), null);
  assert.equal(normalizeIconUrl(null), null);
  assert.equal(normalizeIconUrl(undefined), null);
  assert.equal(normalizeIconUrl(42), null);
});

test("javascript: n'est jamais pris pour une icône", () => {
  assert.equal(normalizeIconUrl("javascript:alert(1)"), null);
  assert.equal(normalizeIconUrl("  JavaScript:alert(1)"), null);
});

/* Ce que « Enregistrer » retient de la fiche d'icône. La normalisation d'URL ne
   pouvait rien pour ce défaut-là : l'URL était bien reconnue, elle n'était
   simplement jamais transmise. */

test("une URL collée sans validation est quand même enregistrée", () => {
  // Le cas signalé : l'icône disparaissait, l'entrée retombait sur son défaut.
  assert.equal(resolveIconChoice(null, "https://cdn.exemple/logo.png"), "https://cdn.exemple/logo.png");
  assert.equal(resolveIconChoice("tabler:star", "https://cdn.exemple/logo.png"), "https://cdn.exemple/logo.png");
});

test("l'URL en attente est rendue propre, comme au rendu", () => {
  assert.equal(resolveIconChoice(null, "  HTTPS://cdn.exemple/logo.png  "), "HTTPS://cdn.exemple/logo.png");
});

test("un champ vide ou inexploitable laisse le brouillon décider", () => {
  assert.equal(resolveIconChoice("tabler:star", ""), "tabler:star");
  assert.equal(resolveIconChoice("tabler:star", "   "), "tabler:star");
  // Une saisie en cours qui n'est pas une URL ne doit pas remplacer le choix.
  assert.equal(resolveIconChoice("tabler:star", "cdn.exemple/logo.png"), "tabler:star");
  assert.equal(resolveIconChoice("tabler:star", "javascript:alert(1)"), "tabler:star");
});

test("retirer l'icône reste possible", () => {
  // Le champ est vidé en même temps que le brouillon : sans cela l'ancienne URL
  // ressusciterait à l'enregistrement.
  assert.equal(resolveIconChoice(null, ""), null);
  assert.equal(resolveIconChoice(undefined, undefined), null);
});
