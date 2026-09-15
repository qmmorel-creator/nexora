import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Même technique que criticality.test.mjs : la fusion de conflit est extraite de
// dist/index.html (reconstruit par `npm run build` juste avant `npm test`) entre
// ses deux sentinelles. Aucune copie du code n'est maintenue à côté — un test qui
// passerait sur une copie pendant que l'application diverge ne prouverait rien.
const START = "// === NEXORA:SYNCMERGE:START ===";
const END = "// === NEXORA:SYNCMERGE:END ===";
const EXPORTS = ["NEXORA_MERGEABLE_KEYS", "NEXORA_MERGE_ID_GETTERS", "mergeItemTimestamp", "stampChangedEntities", "mergeKeyedCollections"];

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const from = html.indexOf(START);
const to = html.indexOf(END);
assert.ok(from !== -1 && to > from, "bloc de fusion introuvable dans dist/index.html");

const factory = vm.runInThisContext(
  `(function () {\n${html.slice(from + START.length, to)}\n;return { ${EXPORTS.join(", ")} };\n})`
);
const { NEXORA_MERGEABLE_KEYS, mergeItemTimestamp, stampChangedEntities, mergeKeyedCollections } = factory();

// ---------------------------------------------------------------------------
// Le registre : une clé absente d'ici n'est PAS fusionnée — elle est bloquée.
// ---------------------------------------------------------------------------

test("les collections de tableaux de bord, vues et types sont fusionnables", () => {
  // Le 409 signalé : poser un filtre sur un Mini-Gantt écrit nexora:dashboards,
  // qui n'était pas déclarée ici. Un conflit BLOQUAIT donc la clé, et plus aucun
  // réglage de tableau de bord ne partait jusqu'au rechargement de l'onglet.
  for (const key of ["nexora:dashboards", "nexora:dashboardFolders", "nexora:views", "nexora:taskTypes"]) {
    assert.ok(NEXORA_MERGEABLE_KEYS.has(key), `${key} doit être fusionnable`);
  }
});

test("nexora:viewPrefs reste volontairement hors du registre", () => {
  // Ses sous-objets n'ont ni identifiant ni horodatage : un même réglage modifié
  // des deux côtés se trancherait au hasard. Bloquer la clé conserve la copie de
  // secours locale et prévient l'utilisateur — c'est le comportement voulu.
  assert.ok(!NEXORA_MERGEABLE_KEYS.has("nexora:viewPrefs"));
});

// ---------------------------------------------------------------------------
// L'horodatage, seul moyen de départager deux modifications concurrentes.
// ---------------------------------------------------------------------------

test("mergeItemTimestamp lit updatedAt, celui que les vues portent désormais", () => {
  assert.equal(mergeItemTimestamp({ updatedAt: "2026-09-15T10:00:00.000Z" }), Date.parse("2026-09-15T10:00:00.000Z"));
  assert.equal(mergeItemTimestamp({}), 0, "sans horodatage, aucune préférence");
  assert.equal(mergeItemTimestamp({ updatedAt: "pas une date" }), 0);
  assert.equal(mergeItemTimestamp(null), 0);
});

// ---------------------------------------------------------------------------
// La fusion elle-même, sur la forme réelle d'une vue enregistrée.
// ---------------------------------------------------------------------------

const view = (id, patch = {}) => ({ id, name: "Vue " + id, view: "gantt", filters: {}, ...patch });
const merge = (local, remote, base) => mergeKeyedCollections("nexora:views", local, remote, base);

test("une vue ajoutée de chaque côté : les deux sont conservées", () => {
  const base = [view("a")];
  const result = merge([view("a"), view("b")], [view("a"), view("c")], base);
  assert.deepEqual(result.merged.map((v) => v.id).sort(), ["a", "b", "c"]);
  assert.deepEqual(result.unresolved, []);
});

test("la même vue modifiée des deux côtés : la plus récente gagne", () => {
  const base = [view("a", { updatedAt: "2026-09-15T08:00:00.000Z" })];
  const local = [view("a", { name: "locale", updatedAt: "2026-09-15T10:00:00.000Z" })];
  const remote = [view("a", { name: "distante", updatedAt: "2026-09-15T09:00:00.000Z" })];
  assert.equal(merge(local, remote, base).merged[0].name, "locale");
  assert.equal(merge(remote, local, base).merged[0].name, "locale", "l'arbitrage ne dépend pas du côté");
});

test("sans horodatage, la version déjà enregistrée est gardée et le conflit signalé", () => {
  // Comportement d'avant l'horodatage : il subsiste pour les vues créées par une
  // version antérieure. Rien n'est écrasé en silence — l'utilisateur est prévenu.
  const base = [view("a")];
  const result = merge([view("a", { name: "locale" })], [view("a", { name: "distante" })], base);
  assert.equal(result.merged[0].name, "distante");
  assert.equal(result.unresolved.length, 1);
});

test("une vue modifiée d'un seul côté passe sans être signalée", () => {
  const base = [view("a", { name: "origine" })];
  const result = merge([view("a", { name: "modifiée" })], [view("a", { name: "origine" })], base);
  assert.equal(result.merged[0].name, "modifiée");
  assert.deepEqual(result.unresolved, [], "une modification non concurrente n'est pas un conflit");
});

test("une vue supprimée d'un côté et intacte de l'autre disparaît", () => {
  const base = [view("a"), view("b")];
  const result = merge([view("a")], [view("a"), view("b")], base);
  assert.deepEqual(result.merged.map((v) => v.id), ["a"]);
});

test("supprimée d'un côté, modifiée de l'autre : la modification survit et est signalée", () => {
  const base = [view("a"), view("b")];
  const result = merge([view("a")], [view("a"), view("b", { name: "encore utile" })], base);
  assert.deepEqual(result.merged.map((v) => v.id).sort(), ["a", "b"]);
  assert.equal(result.unresolved.length, 1, "une suppression contredite doit être signalée");
});

test("les types de tâche se fusionnent de la même façon", () => {
  const result = mergeKeyedCollections(
    "nexora:taskTypes",
    [{ id: "tt1", name: "Étude" }, { id: "tt2", name: "Chantier" }],
    [{ id: "tt1", name: "Étude" }, { id: "tt3", name: "Réunion" }],
    [{ id: "tt1", name: "Étude" }],
  );
  assert.deepEqual(result.merged.map((t) => t.id).sort(), ["tt1", "tt2", "tt3"]);
});

test("une forme non fusionnable renvoie null plutôt que de deviner", () => {
  assert.equal(merge("texte", [view("a")], []), null);
  assert.equal(merge([view("a")], null, []), null);
});

// ---------------------------------------------------------------------------
// L'horodatage automatique : ce qui donne à la fusion de quoi trancher.
// ---------------------------------------------------------------------------

test("seule l'entité réellement modifiée est horodatée", () => {
  const a = { id: "a", name: "A" };
  const b = { id: "b", name: "B" };
  const next = stampChangedEntities([a, b], [a, { ...b, name: "B bis" }]);
  assert.equal(next[0].updatedAt, undefined, "une entité intacte ne doit pas être horodatée");
  assert.match(next[1].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(next[1].name, "B bis");
});

test("une entité ajoutée n'est pas horodatée", () => {
  // Personne d'autre ne la possède : la fusion la conserve sans arbitrage, et
  // l'horodater n'apporterait rien.
  const a = { id: "a" };
  const next = stampChangedEntities([a], [a, { id: "b" }]);
  assert.equal(next[1].updatedAt, undefined);
});

test("un chargement depuis Firebase ne réhorodate rien", () => {
  // C'est le cas critique : l'état précédent est vide (ou porte des valeurs par
  // défaut aux identifiants différents). Horodater ici écraserait précisément
  // l'information que la fusion doit lire.
  const loaded = [{ id: "a", updatedAt: "2026-09-01T00:00:00.000Z" }, { id: "b" }];
  assert.deepEqual(stampChangedEntities([], loaded), loaded);
  assert.deepEqual(stampChangedEntities([{ id: "défaut-aléatoire" }], loaded), loaded);
});

test("un horodatage plus ancien est bien remplacé par la modification", () => {
  const was = { id: "a", updatedAt: "2026-09-01T00:00:00.000Z" };
  const next = stampChangedEntities([was], [{ ...was, name: "modifié" }]);
  assert.ok(Date.parse(next[0].updatedAt) > Date.parse(was.updatedAt));
});

test("l'horodatage ne touche pas ce qui n'est pas une liste d'entités", () => {
  const obj = { pages: [] };
  assert.equal(stampChangedEntities([], obj), obj);
  assert.equal(stampChangedEntities(obj, obj), obj);
  const sansId = [{ name: "sans identifiant" }];
  assert.deepEqual(stampChangedEntities([{ id: "a" }], sansId), sansId);
});

test("horodatage puis fusion : la session la plus récente l'emporte", () => {
  // Le parcours complet, tel qu'il se joue entre deux ordinateurs. Le PC pro a
  // enregistré ce matin ; le PC perso enregistre maintenant. C'est le scénario
  // qui, avant ce lot, bloquait la clé au lieu de la fusionner.
  const base = [{ id: "d1", name: "Tableau", widgets: [] }];
  const distant = [{ ...base[0], widgets: ["ancien filtre"], updatedAt: "2026-09-15T08:00:00.000Z" }];
  const local = stampChangedEntities(base, [{ ...base[0], widgets: ["nouveau filtre"] }]);
  assert.ok(Date.parse(local[0].updatedAt) > Date.parse(distant[0].updatedAt));
  const merged = mergeKeyedCollections("nexora:dashboards", local, distant, base);
  assert.deepEqual(merged.merged[0].widgets, ["nouveau filtre"]);
  assert.deepEqual(merged.unresolved, [], "un arbitrage par horodatage n'est pas un conflit à signaler");
});

test("deux enregistrements dans la même milliseconde ne sont pas départagés", () => {
  // Limite assumée de l'arbitrage par horodatage : à égalité, la version déjà
  // enregistrée est gardée et le conflit signalé, jamais tranché au hasard.
  const base = [{ id: "d1", widgets: [] }];
  const at = "2026-09-15T08:00:00.000Z";
  const merged = mergeKeyedCollections(
    "nexora:dashboards",
    [{ id: "d1", widgets: ["local"], updatedAt: at }],
    [{ id: "d1", widgets: ["distant"], updatedAt: at }],
    base,
  );
  assert.deepEqual(merged.merged[0].widgets, ["distant"]);
  assert.equal(merged.unresolved.length, 1);
});
