/* Heures des tâches (#294, #299) pour l'API utilisée par ChatGPT.

   `startTime` porte sur la date `start`, `endTime` sur la date `end`, au
   format HH:MM, heure de Paris : les champs que lit la vue Calendrier. Une
   valeur vide (ou null) efface l'heure : la tâche est alors « sur la journée ».
   Mêmes règles que la fiche tâche, mais une API refuse plutôt que de corriger
   en silence : une fin sans début, ou une fin qui ne suit pas le début le
   même jour, est une erreur. Seul un début sans fin est complété (une heure). */
export const TASK_TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function minutes(value) {
  const match = TASK_TIME_PATTERN.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function label(total) {
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function present(value) {
  return value != null && String(value).trim() !== "";
}

// Contrôle de forme seul, avant de connaître les dates (PATCH) : la cohérence
// avec les dates est vérifiée ensuite par resolveTaskTimes.
export function parseTaskTimeInput(value, field) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const text = value.trim();
  if (!text) return "";
  if (minutes(text) == null) throw new Error(`invalid_${field}`);
  return text;
}

export function resolveTaskTimes({ start, end, startTime, endTime }) {
  const s0 = parseTaskTimeInput(startTime, "start_time");
  const e0 = parseTaskTimeInput(endTime, "end_time");
  if (!s0 && !e0) return { startTime: "", endTime: "" };
  if (!s0) throw new Error("invalid_end_time_without_start_time");
  const first = start || end || "";
  const last = end || start || "";
  if (!first) throw new Error("invalid_times_without_dates");
  const s = minutes(s0);
  if (!e0) return { startTime: s0, endTime: label(Math.min(s + 60, 23 * 60 + 59)) };
  if (first === last && minutes(e0) <= s) throw new Error("invalid_end_time_before_start_time");
  return { startTime: s0, endTime: e0 };
}

// La requête parle-t-elle des heures ? (clé présente, même vide : effacer.)
export function taskTimesProvided(input) {
  return !!input && typeof input === "object" && ("startTime" in input || "endTime" in input);
}
