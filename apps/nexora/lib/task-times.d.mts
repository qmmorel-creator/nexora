export const TASK_TIME_PATTERN: RegExp;
export function parseTaskTimeInput(value: unknown, field: string): string;
export function resolveTaskTimes(input: {
  start?: string | null;
  end?: string | null;
  startTime?: unknown;
  endTime?: unknown;
}): { startTime: string; endTime: string };
export function taskTimesProvided(input: unknown): boolean;
export function isZeroDurationTask(input: {
  start?: string | null;
  end?: string | null;
  startTime?: unknown;
  endTime?: unknown;
}): boolean;
