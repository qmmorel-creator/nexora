import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Le Métro (ProjectMetroView) et le Mini-Gantt (WidgetMiniGantt) partagent des
// fonctions pures (#29) mais sont deux composants JSX distincts, chacun avec
// sa propre gestion du pointeur : rien n'empêche l'un de dériver de l'autre
// sur un geste qu'on attend pourtant commun (glisser, annuler, ouvrir,
// sélectionner, encadrer). Ce test, sur le modèle de
// minigantt-settings-parity.test.mjs, vérifie la présence de chacun dans les
// DEUX composants réellement construits — pas une resimulation du geste
// (aucun DOM ici), mais un garde-fou structurel contre une régression future.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function sliceFunctionBody(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name} introuvable dans .build/index.html`);
  const next = html.indexOf("\nfunction ", start + 10);
  assert.ok(next > start, `fin de ${name} introuvable`);
  return html.slice(start, next);
}

const metro = sliceFunctionBody("ProjectMetroView");
const gantt = sliceFunctionBody("WidgetMiniGantt");

// --- Glisser -----------------------------------------------------------
test("glisser une tâche est possible dans le Métro ET le Mini-Gantt", () => {
  assert.match(metro, /const startDragTask = \(/, "le Métro a perdu le glisser de station");
  assert.match(gantt, /const startBarDrag = \(/, "le Mini-Gantt a perdu le glisser de barre");
  // Les deux suivent l'état "moved" pour distinguer un glisser réel d'un simple
  // clic (sans quoi tout clic ouvrirait la fiche ET l'aurait discrètement décalée).
  assert.match(metro, /moved:\s*false/);
  assert.match(gantt, /moved:\s*false/);
});

// --- Annuler -------------------------------------------------------------
test("un glisser qui déplace une date se corrige d'un « Annuler » — Métro et Mini-Gantt", () => {
  assert.match(metro, /actionLabel:\s*"Annuler"/, "le glisser du Métro n'annule plus");
  assert.match(gantt, /actionLabel:\s*"Annuler"/, "le glisser du Mini-Gantt n'annule plus");
});

// --- Ouvrir ----------------------------------------------------------------
test("un clic qui n'a pas bougé ouvre la fiche — dans les deux, jamais pendant un glisser", () => {
  // Métro : le clic ET le glisser partagent le même geste pointeur ; seul
  // l'absence de mouvement ("!d.moved") ouvre la fiche au relâchement.
  assert.match(metro, /else if \(d && !d\.moved && d\.task\) \{\s*\n\s*onOpen\(d\.task\);/,
    "le Métro ouvre la fiche même après un glisser qui a bougé");
  // Mini-Gantt : clic et glisser sont deux gestes séparés (la poignée de
  // glisser n'est pas la zone de clic) — le garde-fou est donc un flag posé
  // par le glisser et lu par le clic, plutôt qu'un unique gestionnaire.
  assert.match(gantt, /suppressClickRef\.current = true/, "le Mini-Gantt ne bloque plus le clic après un glisser");
  assert.match(gantt, /if \(suppressClickRef\.current\)/, "le clic du Mini-Gantt ne lit plus le garde-fou anti-glisser");
});

// --- Sélectionner ------------------------------------------------------
test("la sélection multiple existe des deux côtés, avec un compteur visible", () => {
  assert.match(metro, /const toggleSelect = /, "le Métro a perdu sa sélection multiple");
  assert.match(gantt, /const toggleSelected = /, "le Mini-Gantt a perdu sa sélection multiple");
  assert.match(metro, /lp-pm-selection-count/, "le Métro n'affiche plus le nombre de tâches sélectionnées");
  assert.match(gantt, /lp-widget-minigantt-selection-count/, "le Mini-Gantt n'affiche plus le nombre de tâches sélectionnées");
});

// --- Coche d'encadré -------------------------------------------------------
test("une station/tâche sélectionnée se distingue visuellement — encadrée ou surlignée", () => {
  // Mini-Gantt : la sélection EST la coche d'encadré (#48) — cocher une ligne
  // pose l'encadré, il n'y a qu'un seul geste pour les deux.
  assert.match(gantt, /checked=\{selectedSet\.has\(t\.id\)\}/, "la coche d'encadré du Mini-Gantt a disparu");
  // Métro : pas de case à cocher (les stations sont des points sur une carte,
  // pas des lignes de tableau) — la sélection se voit à un anneau autour de la
  // station, avec la même couleur d'accent ("signal") que le reste de l'appli.
  assert.match(metro, /stroke=\{selectedIds\.has\(t\.id\)\s*\?\s*"var\(--signal\)"/,
    "la station sélectionnée du Métro ne se distingue plus visuellement");
});
