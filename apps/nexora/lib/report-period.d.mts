export type ReportKind = "morning" | "evening";
export type ReportPeriod = {
  kind: ReportKind;
  timeZone: "Europe/Paris";
  localDate: string;
  start: string;
  end: string;
};
export function parisCivilDate(now?: Date): string;
export function parisLocalClock(now?: Date): { date: string; hour: number; minute: number };
export function reportPeriod(kind: ReportKind, at?: Date): ReportPeriod;
export function shouldRunReport(
  local: { hour: number; minute: number },
  targetHour: number,
  targetMinute: number,
  toleranceMinutes?: number
): boolean;
