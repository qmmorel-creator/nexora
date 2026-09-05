const TIME_ZONE = "Europe/Paris";

function parisParts(now) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}

export function parisCivilDate(now = new Date()) {
  const parts = parisParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parisLocalClock(now = new Date()) {
  const parts = parisParts(now);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

function parisLocalToUtc(date, hour, minute) {
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = parisParts(new Date(guess));
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second)
    );
    const correction = target - represented;
    guess += correction;
    if (correction === 0) break;
  }
  return new Date(guess);
}

function shiftCivilDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function reportPeriod(kind, at = new Date()) {
  if (kind !== "morning" && kind !== "evening") throw new Error("invalid_report_kind");
  const date = parisCivilDate(at);
  const start = kind === "morning"
    ? parisLocalToUtc(shiftCivilDate(date, -1), 20, 30)
    : parisLocalToUtc(date, 7, 0);
  const end = kind === "morning"
    ? parisLocalToUtc(date, 7, 0)
    : parisLocalToUtc(date, 20, 30);
  return { kind, timeZone: TIME_ZONE, localDate: date, start: start.toISOString(), end: end.toISOString() };
}
