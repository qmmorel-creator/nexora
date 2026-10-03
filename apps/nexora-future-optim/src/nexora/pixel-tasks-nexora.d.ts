// Types minimaux du module généré pixel-tasks-nexora.jsx (code de Nexora repris tel quel).
import type { ReactElement } from "react";
export const PIXEL_TASKS_CSS: string;
export interface CtxNexora { statuses: unknown[]; projects: unknown[]; projectFolders: unknown[]; taskTypes: unknown[]; teamMembers: unknown[]; tasks: unknown[] }
export function WidgetPixelTasks(p: {
  widget: Record<string, unknown>; tasks: unknown[]; ctx: CtxNexora; onOpen: (id: string) => void;
  onToggleDone: (id: string) => void; onUpdateTask: (id: string, patch: Record<string, unknown>) => void;
  onCreateTask: ((data: Record<string, unknown>) => unknown) | null; onUpdateWidget: (patch: Record<string, unknown>) => void;
  onEditWidget?: () => void; externalToolbarSlot: HTMLElement | null;
}): ReactElement;
export function pixelTaskUpdateLabel(patch: Record<string, unknown>): () => string;
export function isTaskDoneGlobal(t: unknown, ctx: CtxNexora): boolean;
export function pixelTaskDate(t: unknown): string | null;
export function pixelTasksForDay(tasks: unknown[], date: string, today: string, statuses: unknown[], options?: { ghosts?: boolean; futureDays?: number }): { items: { task: { id: string }; lateDays: number; carried: boolean; ghost?: boolean; future?: boolean }[]; done: number; total: number; ghosts: number; future: number };
