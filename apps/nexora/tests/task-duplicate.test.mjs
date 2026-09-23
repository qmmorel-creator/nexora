import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Duplication d'une tâche depuis sa fiche (#334). Mêmes règles que les autres
// bancs de ce dossier : on vérifie l'interface RÉELLEMENT construite
// (.build/index.html), jamais une copie du code à côté.
const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

test("la fiche tâche propose un bouton Dupliquer, à côté de Supprimer", async () => {
  assert.match(html, /\{!isNew && onDuplicate && \(/);
  assert.match(html, /onClick=\{\(\) => onDuplicate\(task\)\}[^}]*>/);
  assert.match(html, />Dupliquer\s*\n\s*<\/button>/);
});

test("buildTaskDuplicate repart de zéro sur le suivi, jamais sur l'identité", async () => {
  const match = html.match(/function buildTaskDuplicate\(task, statuses, projects, taskTypes\) \{[\s\S]*?\n\}/);
  assert.ok(match, "buildTaskDuplicate introuvable dans .build/index.html");
  const source = match[0];
  // Nouvel identifiant et statut initial cohérent (jamais celui de l'original,
  // qui peut être "Terminé") — réutilise getDefaultStatusForTask, déjà utilisé
  // à la création d'une tâche.
  assert.match(source, /id: uid\(\)/);
  assert.match(source, /getDefaultStatusForTask\(statuses, projects, taskTypes, task\.projectId, task\.taskTypeId\)/);
  assert.match(source, /statusId: initialStatus \? initialStatus\.id : task\.statusId/);
  // Progression et checklist repartent à zéro / non cochées.
  assert.match(source, /progress: 0/);
  assert.match(source, /done: false/);
  // Aucune métadonnée de suivi/audit copiée depuis l'original.
  assert.match(source, /comparison: null/);
  assert.match(source, /source: null/);
  assert.match(source, /sourceMessageId: null/);
});

test("la fiche se remonte entièrement au changement de tâche (jamais d'état d'une autre fiche affiché)", async () => {
  // La clé posée sur <TaskModal> force React à démonter/remonter le composant
  // dès que l'identifiant de la tâche affichée change — sans elle, dupliquer
  // depuis la fiche laisserait voir les champs de l'ORIGINAL avec l'identifiant
  // de la COPIE.
  assert.match(html, /<TaskModal key=\{taskModal\?\.id \|\| "new"\}/);
});
