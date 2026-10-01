/* Widget « Graphique financier » et moteur OS360 (issue #573). */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const sha = (t) => createHash("sha256").update(t).digest("hex");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

test("moteur généré : intact, issu du générateur et de moteur.js tels que versionnés", async () => {
  const moteur = await read("../public/os360-moteur/index.html");
  const source = JSON.parse(await read("../public/os360-moteur/source.json"));
  const entree = await read("../../../outils/os360-moteur/moteur.js");
  assert.match(source.os360.commit, /^[0-9a-f]{40}$/);
  assert.equal(source.genere, sha(moteur), "index.html du moteur modifié à la main : relancer outils/os360-moteur/generer.mjs");
  assert.equal(source.moteur, sha(entree), "moteur.js a changé depuis la génération : relancer outils/os360-moteur/generer.mjs");
  assert.ok(moteur.includes(entree), "le point d'entrée du moteur est celui de moteur.js");
  assert.ok(moteur.startsWith(`<!-- Généré par outils/os360-moteur/generer.mjs depuis OS360 ${source.os360.commit}`));
});

test("moteur : montage OS360 remplacé, stockage en mémoire posé avant le module", async () => {
  const moteur = await read("../public/os360-moteur/index.html");
  assert.ok(!moteur.includes("(0,$9.jsx)(gCe,{})"), "l'application OS360 ne doit plus être montée");
  assert.match(moteur, /J\.jsx\(osSidebarSettings, \{ selected: nxMoteurWidgetId/, "réglages : panneau latéral d'OS360");
  assert.equal(moteur.split("(0,$9.jsx)(nxMoteur,{})").length - 1, 1);
  const shim = moteur.indexOf('Object.defineProperty(window, "localStorage"');
  assert.ok(shim > 0 && shim < moteur.indexOf('<script type="module"'), "le stockage en mémoire précède le module OS360");
  assert.equal(moteur.split('<script type="module"').length - 1, 1);
});

test("route : lecture seule des tables OS360, session du propriétaire", async () => {
  const source = await read("../netlify/functions/finance-budget-data.ts");
  assert.match(source, /path: "\/api\/nexora\/finance-budget-data", method: \["GET"\]/);
  assert.match(source, /await requireOwnerFinance\(req\)/);
  for (const t of ["finance_transactions_current", "finance_categories_current", "finance_subcategories_current", "finance_banks", "finance_accounts_current", "finance_account_types", "finance_category_budgets", "finance_account_balances"]) {
    assert.match(source, new RegExp(`table: "${t}"`));
  }
  assert.doesNotMatch(source, /method: "(POST|PATCH|PUT|DELETE)"|rpc\//);
});

// --- Graphique sport (#579) : le même moteur, sur le journal sportif ---------

test("moteur : journal sportif reçu par nx-sport, données d'exemple OS360 jamais affichées", async () => {
  const entree = await read("../../../outils/os360-moteur/moteur.js");
  assert.match(entree, /d\.type === "nx-sport"\) \{ rl\.replace\(d\.activities, "remote"\)/);
  // Le bundle OS360 initialise les stores avec ses données embarquées : vidés avant tout rendu.
  assert.match(entree, /nl\.replace\(\[\], "empty"\);\n    rl\.replace\(\[\], "empty"\);\n    nxMoteurPost\(\{ type: "nx-ready"/);
  assert.match(entree, /catalogue: nxMoteurCatalogue\("budget"\), catalogueSante: nxMoteurCatalogue\("health"\)/);
  assert.match(entree, /!\/\^\(layout\\\.\|sante\\\.photo\)\/\.test\(d\.type\)/, "ni mise en page OS360 ni photos corporelles");
  assert.match(entree, /widget\.domain === "health" \? sportVersion > 0 : !!budget/, "un widget Sport attend le journal");
  // Variante appliquée comme le sélecteur d'OS360, avec ses propres réglages (sinon : unités de la 1re variante).
  assert.match(entree, /if \(widget\.variant\) base = osChangeConfig\(base, "financeVariant", widget\.variant\);/);
});

