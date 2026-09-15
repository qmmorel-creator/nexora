/* Fiabilité de la synchronisation entre postes (issue #39).
   La logique pure est extraite du bundle construit, pour que le test porte sur
   ce qui est réellement déployé et non sur une copie. */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInThisContext } from "node:vm";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const html = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "dist", "index.html"),
  "utf8",
);

const slice = (start, end) => {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  assert.ok(a !== -1 && b !== -1, `Bloc sentinelle introuvable : ${start}`);
  const bloc = html.slice(a, b);
  return bloc.slice(bloc.lastIndexOf("*/") === -1 ? 0 : 0); // bloc complet, commentaires inclus
};

/* --- Le plafond keepalive --------------------------------------------------- */

const unload = slice("// === NEXORA:UNLOAD-FLUSH:START ===", "// === NEXORA:UNLOAD-FLUSH:END ===");
/* On n'évalue que les trois déclarations pures : le reste du bloc pose des
   écouteurs sur document/window, absents ici. */
const pures = unload.slice(unload.indexOf("const NEXORA_KEEPALIVE_MAX_BYTES"), unload.indexOf("let nexoraPageLeaving"));
const { NEXORA_KEEPALIVE_MAX_BYTES, nexoraBodyBytes, nexoraUseKeepalive } = runInThisContext(
  `(() => { ${pures}\n return { NEXORA_KEEPALIVE_MAX_BYTES, nexoraBodyBytes, nexoraUseKeepalive } })()`,
);

test("la taille du corps est mesurée en octets UTF-8, pas en caractères", () => {
  assert.equal(nexoraBodyBytes("abc"), 3);
  // « é » occupe deux octets : compter les caractères sous-estimerait le corps
  // et laisserait passer une requête que le navigateur refuserait.
  assert.equal(nexoraBodyBytes("éé"), 4);
  assert.equal(nexoraBodyBytes(null), 0);
});

test("une forme de corps inconnue interdit le keepalive", () => {
  assert.equal(nexoraUseKeepalive(nexoraBodyBytes({ flux: true })), false);
});

test("le keepalive s'arrête sous le plafond de la spécification fetch", () => {
  assert.equal(nexoraUseKeepalive(0), true);
  assert.equal(nexoraUseKeepalive(NEXORA_KEEPALIVE_MAX_BYTES), true);
  assert.equal(nexoraUseKeepalive(NEXORA_KEEPALIVE_MAX_BYTES + 1), false);
  assert.ok(NEXORA_KEEPALIVE_MAX_BYTES < 64 * 1024, "Le plafond doit rester sous les 64 Kio de la spécification.");
});

/* --- Les clés d'interface --------------------------------------------------- */

const interfaceKeys = [
  "nexora:dashboards", "nexora:dashboardFolders", "nexora:views", "nexora:todayWidgets",
  "nexora:viewPrefs", "nexora:viewOrder", "nexora:enabledViews", "nexora:shortcutPrefs",
];

const interfaceBloc = slice("// === NEXORA:INTERFACE-SYNC:START ===", "// === NEXORA:INTERFACE-SYNC:END ===");

test("les sept clés d'interface sont rattachées au rattrapage", () => {
  for (const key of interfaceKeys) {
    assert.ok(interfaceBloc.includes(`"${key}"`), `${key} n'est pas rattachée au rattrapage.`);
  }
});

test("chaque clé d'interface est associée à un setter qui existe dans le bundle", () => {
  const setters = [...interfaceBloc.matchAll(/,\s*(set[A-Z]\w+)\]/g)].map((m) => m[1]);
  assert.equal(setters.length, interfaceKeys.length, "Une clé d'interface est sans setter.");
  for (const setter of setters) {
    // Le setter doit exister ailleurs que dans ce bloc, sinon adopter une
    // valeur distante lèverait une ReferenceError au moment le plus mal choisi.
    const total = (html.match(new RegExp(`\\b${setter}\\b`, "g")) || []).length;
    assert.ok(total >= 2, `${setter} n'est déclaré nulle part ailleurs : l'adoption d'une valeur distante échouerait.`);
  }
});

test("les boucles de rattrapage utilisent la liste élargie", () => {
  const usages = (html.match(/firebaseWatchedEntries\(\)/g) || []).length;
  assert.ok(usages >= 3,
    "firebaseWatchedEntries doit alimenter les écoutes, le contrôle de fraîcheur et l'adoption d'une valeur distante.");
});

/* --- Ce qui est fusionnable, et ce qui ne doit surtout pas l'être ----------- */

const mergeable = (() => {
  const a = html.indexOf("const NEXORA_MERGEABLE_KEYS = new Set([");
  const b = html.indexOf("]);", a);
  assert.ok(a !== -1 && b !== -1, "NEXORA_MERGEABLE_KEYS introuvable.");
  return html.slice(a, b);
})();

test("les tableaux de bord et les vues enregistrées restent fusionnables", () => {
  // Acquis d'un autre correctif, conservé ici comme garde : ce sont des listes
  // d'objets portant un id, et deux postes qui modifient deux tableaux
  // différents doivent voir leurs deux modifications survivre.
  assert.ok(mergeable.includes('"nexora:dashboards"'), "nexora:dashboards doit être fusionnable.");
  assert.ok(mergeable.includes('"nexora:views"'), "nexora:views doit être fusionnable.");
});

test("l'ordre des vues et les réglages scalaires ne sont PAS fusionnables", () => {
  // viewOrder est un ORDRE : le fusionner par identifiant le détruirait.
  assert.ok(!mergeable.includes('"nexora:viewOrder"'),
    "nexora:viewOrder est un ordre : la fusion par identifiant en perdrait le sens.");
  for (const key of ["nexora:viewPrefs", "nexora:enabledViews", "nexora:shortcutPrefs", "nexora:todayWidgets"]) {
    assert.ok(!mergeable.includes(`"${key}"`),
      `${key} n'est pas une collection identifiable : la fusion la déclarerait toujours non résolue.`);
  }
});
