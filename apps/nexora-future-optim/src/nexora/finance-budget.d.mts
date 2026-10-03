// Types minimaux du module généré finance-budget.mjs (calculs budgétaires de
// Nexora repris tels quels) — Ref #690.
export interface PeriodeNexora { from: string; to: string }
export interface DonneesBudgetNexora { transactions: { effectiveDate: string; amount: number; type: string; category: string }[] }
export function normalizeBudget(raw: unknown): DonneesBudgetNexora;
export function monthBounds(month: string): PeriodeNexora;
export function budgetTracking(data: DonneesBudgetNexora, period: PeriodeNexora): { category: string; color: string; budget: number; actual: number; remaining: number; over: boolean }[];
export function budgetCharts(data: DonneesBudgetNexora, period: PeriodeNexora, tracking: { category: string; budget: number }[]): Record<string, unknown>;
export function expensesOf<T>(list: T[]): T[];
export function incomeOf<T>(list: T[]): T[];
export function sumAbs(list: { amount: number }[]): number;
export function buildBudgetSummary(raw: unknown, month: string | null, now?: Date): { tracking: unknown; charts: unknown; totals: { expenses: number; income: number } };
// Utilisés par la finance en direct des fonctions serveur (sevrage de Nexora, #721).
export function buildBudgetPeriodTotals(raw: unknown, from: string | null, to: string | null, now?: Date): Record<string, unknown>;
export function buildWealthSeries(raw: unknown, from: string | null, to: string | null, step?: string, now?: Date): Record<string, unknown>;
