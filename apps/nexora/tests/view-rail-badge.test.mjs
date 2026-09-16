import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const START = "// === NEXORA:VIEW-RAIL-COUNT:START ===";
const END = "// === NEXORA:VIEW-RAIL-COUNT:END ===";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc des compteurs du rail introuvable dans .build/index.html");
const { viewRailBadgeCount, viewRailBadgeLabel } = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { viewRailBadgeCount, viewRailBadgeLabel };\n})`
)();

const COUNTS = { projects: 4, dashboards: 2, workflows: 7, unreadNotifications: 3, dueToday: 5 };

test("chaque bulle compte ce qu'elle annonce", () => {
  assert.equal(viewRailBadgeCount("projects", COUNTS), 4);
  assert.equal(viewRailBadgeCount("dashboard", COUNTS), 2);
  assert.equal(viewRailBadgeCount("automations", COUNTS), 7);
  assert.equal(viewRailBadgeCount("notifications", COUNTS), 3);
  assert.equal(viewRailBadgeCount("today", COUNTS), 5);
});

test("le Centre de pilotage n'agrège aucune collection : pas de badge", () => {
  // Un chiffre inventé y serait pire que pas de chiffre du tout.
  assert.equal(viewRailBadgeCount("control", COUNTS), 0);
  assert.equal(viewRailBadgeCount("vue-inconnue", COUNTS), 0);
});

test("zéro ne produit pas de badge", () => {
  // L'issue ne veut un badge que si le compteur dépasse zéro.
  assert.equal(viewRailBadgeCount("projects", { projects: 0 }), 0);
  assert.equal(viewRailBadgeLabel(0), "");
  assert.equal(viewRailBadgeLabel(viewRailBadgeCount("projects", {})), "");
});

test("des données absentes ou aberrantes ne font pas tomber le compteur", () => {
  assert.equal(viewRailBadgeCount("projects", null), 0);
  assert.equal(viewRailBadgeCount("projects", { projects: -3 }), 0);
  assert.equal(viewRailBadgeCount("projects", { projects: NaN }), 0);
  assert.equal(viewRailBadgeCount("projects", { projects: "beaucoup" }), 0);
});

test("le badge reste lisible à un, deux et trois chiffres", () => {
  assert.equal(viewRailBadgeLabel(1), "1");
  assert.equal(viewRailBadgeLabel(42), "42");
  assert.equal(viewRailBadgeLabel(999), "999");
  // Au-delà, un quatrième chiffre élargirait la bulle.
  assert.equal(viewRailBadgeLabel(1000), "999+");
  assert.equal(viewRailBadgeLabel(12345), "999+");
});

test("l'ancien « 9+ » des notifications a disparu", () => {
  // Il tronquait dès dix, alors que le badge tient trois chiffres.
  assert.equal(viewRailBadgeLabel(viewRailBadgeCount("notifications", { unreadNotifications: 12 })), "12");
});
