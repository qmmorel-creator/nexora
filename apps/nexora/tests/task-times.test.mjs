/* Heures des tâches côté API assistant (#299) : la logique partagée et son
   branchement dans les fonctions Netlify et le contrat OpenAPI. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isZeroDurationTask, parseTaskTimeInput, resolveTaskTimes, taskTimesProvided } from "../lib/task-times.mjs";

const day = { start: "2026-09-24", end: "2026-09-24" };
const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8");

test("resolveTaskTimes : HH:MM conservé, une heure par défaut, vide = journée", () => {
  assert.deepEqual(resolveTaskTimes({ ...day, startTime: "17:30", endTime: "18:30" }), { startTime: "17:30", endTime: "18:30" });
  assert.deepEqual(resolveTaskTimes({ ...day, startTime: "17:30" }), { startTime: "17:30", endTime: "18:30" });
  assert.deepEqual(resolveTaskTimes({ ...day, startTime: "23:30" }), { startTime: "23:30", endTime: "23:59" });
  assert.deepEqual(resolveTaskTimes({ ...day, startTime: "", endTime: "" }), { startTime: "", endTime: "" });
  assert.deepEqual(resolveTaskTimes({ ...day, startTime: null, endTime: null }), { startTime: "", endTime: "" });
  assert.deepEqual(
    resolveTaskTimes({ start: "2026-09-24", end: "2026-09-26", startTime: "18:00", endTime: "09:00" }),
    { startTime: "18:00", endTime: "09:00" },
    "sur plusieurs jours, une heure de fin plus tôt reste légitime"
  );
});

test("resolveTaskTimes : l'API refuse plutôt que de corriger en silence", () => {
  assert.throws(() => resolveTaskTimes({ ...day, endTime: "10:00" }), /invalid_end_time_without_start_time/);
  assert.throws(() => resolveTaskTimes({ ...day, startTime: "17:30", endTime: "09:00" }), /invalid_end_time_before_start_time/);
  assert.throws(() => resolveTaskTimes({ ...day, startTime: "17:30", endTime: "17:30" }), /invalid_end_time_before_start_time/);
  assert.throws(() => resolveTaskTimes({ start: "", end: "", startTime: "10:00" }), /invalid_times_without_dates/);
  for (const bad of ["8:00", "17h30", "24:00", "5:30 PM", 930]) {
    assert.throws(() => parseTaskTimeInput(bad, "start_time"), /invalid_start_time/, String(bad));
  }
  assert.equal(parseTaskTimeInput(" 09:15 ", "start_time"), "09:15");
});

test("taskTimesProvided : une clé présente, même vide, signifie « toucher aux heures »", () => {
  assert.equal(taskTimesProvided({ startTime: "" }), true);
  assert.equal(taskTimesProvided({ endTime: null }), true);
  assert.equal(taskTimesProvided({ title: "x" }), false);
});

test("isZeroDurationTask : un jalon est une durée nulle, pas juste « même jour » (#338)", () => {
  // Même jour, pas d'horaires -> jalon.
  assert.equal(isZeroDurationTask({ ...day }), true);
  // Même jour, horaires de début/fin identiques -> toujours un jalon.
  assert.equal(isZeroDurationTask({ ...day, startTime: "09:00", endTime: "09:00" }), true);
  // Même jour, horaires distincts -> vraie durée, plus un jalon.
  assert.equal(isZeroDurationTask({ ...day, startTime: "09:00", endTime: "11:30" }), false);
  // Multi-jours -> jamais un jalon, quels que soient les horaires.
  assert.equal(isZeroDurationTask({ start: "2026-09-24", end: "2026-09-26" }), false);
  assert.equal(
    isZeroDurationTask({ start: "2026-09-24", end: "2026-09-26", startTime: "09:00", endTime: "09:00" }),
    false
  );
  // Dates manquantes -> pas un jalon.
  assert.equal(isZeroDurationTask({ start: "", end: "" }), false);
});

test("création et modification branchées sur la logique partagée", async () => {
  const create = await read("../netlify/functions/nexora-create-task.ts");
  assert.match(create, /resolveTaskTimes\(\{ start, end, startTime: body\.startTime, endTime: body\.endTime \}\)/);
  const operations = await read("../netlify/functions/nexora-task-operations.ts");
  assert.match(operations, /"startTime", "endTime"/);
  const shared = await read("../netlify/functions/_shared/nexora.ts");
  assert.match(shared, /resolveTaskTimes\(\{ start: next\.start, end: next\.end, startTime: next\.startTime, endTime: next\.endTime \}\)/);
});

test("contrat OpenAPI : heures documentées en création, modification et lecture", async () => {
  const contract = await read("../public/openapi.yaml");
  assert.equal((contract.match(/^\s+startTime:/gm) || []).length, 3);
  assert.equal((contract.match(/^\s+endTime:/gm) || []).length, 3);
});
