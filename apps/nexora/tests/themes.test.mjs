/* Thèmes activables (#621).
   1. Bloc pur NEXORA:THEMES, extrait du bundle RÉELLEMENT construit : préférence
      normalisée, mode système, polices, application sur un document factice.
   2. Script du <head> : mêmes thèmes et mêmes polices que le catalogue.
   3. Couche CSS générée (style#nexora-themes) : présente pour chaque thème × mode,
      et identique à ce que produit son générateur (docs/chartes-graphiques/outils). */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const html = await read("../.build/index.html");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  assert.equal(html.indexOf(start, from + 1), -1, `bloc ${name} en double`);
  return html.slice(from + start.length, to);
}
const T = vm.runInThisContext(`(function () {\n${slice("THEMES")}\n;return {
  NEXORA_THEMES, NEXORA_THEME_MODES, NEXORA_THEME_STORAGE_KEY, nexoraThemeChoice, nexoraThemeAttributes, nexoraThemeFontsHref, applyNexoraTheme,
};\n})`)();

test("préférence absente, inconnue ou abîmée : thème d'origine, mode clair", () => {
  for (const a of [undefined, null, {}, { theme: "inconnu", themeMode: "nuit" }, "texte"]) {
    assert.deepEqual(T.nexoraThemeChoice(a), { theme: "nexora", mode: "clair" });
    assert.equal(T.nexoraThemeAttributes(a, true), null);
  }
});

test("Bauhaus et Dessau : attributs posés, mode système résolu", () => {
  assert.deepEqual(T.nexoraThemeAttributes({ theme: "bauhaus", themeMode: "sombre" }, false), { theme: "bauhaus", mode: "sombre" });
  assert.deepEqual(T.nexoraThemeAttributes({ theme: "dessau" }, true), { theme: "dessau", mode: "clair" });
  assert.deepEqual(T.nexoraThemeAttributes({ theme: "dessau", themeMode: "systeme" }, true), { theme: "dessau", mode: "sombre" });
  assert.deepEqual(T.nexoraThemeAttributes({ theme: "dessau", themeMode: "systeme" }, false), { theme: "dessau", mode: "clair" });
  assert.equal(T.nexoraThemeAttributes({ theme: "nexora", themeMode: "sombre" }, true), null);
});

test("polices : une feuille Google Fonts par thème activable, aucune pour Nexora", () => {
  assert.equal(T.nexoraThemeFontsHref("nexora"), "");
  assert.match(T.nexoraThemeFontsHref("bauhaus"), /^https:\/\/fonts\.googleapis\.com\/css2\?family=Outfit:.*&display=swap$/);
  assert.match(T.nexoraThemeFontsHref("dessau"), /family=Jost:/);
});

function fakeDocument() {
  const attrs = new Map();
  const nodes = new Map();
  const doc = {
    documentElement: { setAttribute: (k, v) => attrs.set(k, String(v)), removeAttribute: (k) => attrs.delete(k) },
    head: { appendChild: (n) => nodes.set(n.id, n) },
    getElementById: (id) => nodes.get(id) || null,
    createElement: () => { const a = {}; const n = { setAttribute: (k, v) => { a[k] = v; }, getAttribute: (k) => a[k] ?? null, remove: () => nodes.delete(n.id) }; Object.defineProperty(n, "href", { set: (v) => { a.href = v; } }); return n; },
  };
  const store = new Map();
  const storage = { setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  return { doc, attrs, nodes, store, storage };
}

test("application puis retrait : attributs, lien de polices et copie locale cohérents", () => {
  const { doc, attrs, nodes, store, storage } = fakeDocument();
  T.applyNexoraTheme(doc, { theme: "bauhaus", mode: "sombre" }, storage);
  assert.equal(attrs.get("data-nexora-theme"), "bauhaus");
  assert.equal(attrs.get("data-nexora-mode"), "sombre");
  assert.match(nodes.get("nexora-theme-fonts").getAttribute("href"), /Outfit/);
  assert.deepEqual(JSON.parse(store.get(T.NEXORA_THEME_STORAGE_KEY)), { theme: "bauhaus", mode: "sombre" });
  T.applyNexoraTheme(doc, { theme: "dessau", mode: "clair" }, storage);
  assert.match(nodes.get("nexora-theme-fonts").getAttribute("href"), /Jost/);
  T.applyNexoraTheme(doc, null, storage);
  assert.equal(attrs.size, 0);
  assert.equal(nodes.size, 0, "le lien de polices est retiré avec le thème");
  assert.equal(store.size, 0);
});

test("stockage indisponible : le thème s'applique quand même", () => {
  const { doc, attrs } = fakeDocument();
  T.applyNexoraTheme(doc, { theme: "dessau", mode: "clair" }, { setItem() { throw new Error("quota"); } });
  assert.equal(attrs.get("data-nexora-theme"), "dessau");
});

test("sans stockage fourni (page d'accueil) : thème retiré, copie locale intacte", () => {
  const { doc, attrs, store, storage } = fakeDocument();
  T.applyNexoraTheme(doc, { theme: "bauhaus", mode: "clair" }, storage);
  T.applyNexoraTheme(doc, null);
  assert.equal(attrs.size, 0);
  assert.ok(store.has(T.NEXORA_THEME_STORAGE_KEY), "le choix reste pour la reconnexion");
});

test("script du <head> : mêmes thèmes et mêmes polices que le catalogue", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  const m = head.match(/var polices = (\{[^}]*\});/);
  assert.ok(m, "script de thème introuvable dans le <head>");
  const polices = vm.runInThisContext(`(${m[1]})`);
  const activables = T.NEXORA_THEMES.filter((t) => t.key !== "nexora");
  assert.deepEqual(Object.keys(polices).sort(), activables.map((t) => t.key).sort());
  for (const t of activables) assert.equal(polices[t.key], t.fonts, `polices de ${t.key}`);
  assert.ok(head.includes(`localStorage.getItem("${T.NEXORA_THEME_STORAGE_KEY}")`), "le <head> lit la même clé locale");
});

test("Observatoire : sombre imposé, quel que soit le mode enregistré", () => {
  for (const themeMode of [undefined, "clair", "sombre", "systeme", "nuit"]) {
    for (const prefersDark of [false, true]) {
      assert.deepEqual(T.nexoraThemeAttributes({ theme: "observatoire", themeMode }, prefersDark), { theme: "observatoire", mode: "sombre" });
    }
  }
  assert.match(T.nexoraThemeFontsHref("observatoire"), /family=Sora:/);
  const head = html.slice(0, html.indexOf("</head>"));
  const m = head.match(/var modeFixe = (\{[^}]*\});/);
  assert.ok(m, "le <head> impose aussi le mode des thèmes à mode unique");
  const modeFixe = vm.runInThisContext(`(${m[1]})`);
  const fixes = Object.fromEntries(T.NEXORA_THEMES.filter((t) => t.fixedMode).map((t) => [t.key, t.fixedMode]));
  assert.deepEqual(modeFixe, fixes);
});

test("couche CSS : chaque thème activable est défini dans chacun de ses modes", () => {
  const debut = html.indexOf('<style id="nexora-themes">');
  assert.ok(debut !== -1, "style#nexora-themes absent du bundle");
  const css = html.slice(debut, html.indexOf("</style>", debut));
  for (const t of T.NEXORA_THEMES.filter((x) => x.key !== "nexora")) {
    for (const mode of t.fixedMode ? [t.fixedMode] : ["clair", "sombre"]) {
      assert.ok(css.includes(`:root[data-nexora-theme="${t.key}"][data-nexora-mode="${mode}"]`), `${t.key} ${mode} absent`);
    }
  }
});

test("couche CSS à jour avec son générateur", async () => {
  const { genererCouche } = await import("../../../docs/chartes-graphiques/outils/integration.mjs");
  const source = await read("../source/index.html.part-004");
  const debut = '<style id="nexora-themes">\n';
  const bloc = source.slice(source.indexOf(debut) + debut.length, source.indexOf("</style><!-- /nexora-themes -->"));
  assert.equal(bloc, genererCouche(), "relancer : node docs/chartes-graphiques/outils/integration.mjs");
});

test("couche CSS : aucune couleur invalide (rgba à cinq composantes, ignorée par le navigateur)", () => {
  const debut = html.indexOf('<style id="nexora-themes">');
  const css = html.slice(debut, html.indexOf("</style>", debut));
  const invalides = css.match(/rgba\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*\)/g) || [];
  assert.deepEqual(invalides, [], `${invalides.length} couleur(s) invalide(s)`);
});
