// Types minimaux du module généré finance-nexora.jsx (code de Nexora repris
// tel quel, non typé) — Ref #690.
import type { ReactElement } from "react";
export interface GrapheSankey { nodes: unknown[]; links: unknown[]; summary?: unknown }
export const FINANCE_SANKEY_DEFAULT_CONFIG: Record<string, unknown>;
export const FINANCE_SANKEY_CSS: string;
export const FINANCE_BUDGET_CHART_CSS: string;
export const FINANCE_BUDGET_CUMUL_CSS: string;
export function financeSankeyNormalize(raw: unknown): unknown;
export function financeSankeyBuild(type: "financeSankeyMonthly" | "financeSankeyWealth", data: unknown, config: Record<string, unknown>, today?: string, now?: Date): { graph: GrapheSankey; period: string };
export function financeCumulModel(charts: unknown): { series: unknown[]; days: string[]; spent: number; budgetTotal: number };
export function financeBudgetEuro(v: number): string;
export function financeChartTicks(max: number): { ticks: number[]; max: number };
export function financeChartShortEuro(v: number): string;
export function FinanceSankeyChart(p: { graph: GrapheSankey; config: Record<string, unknown>; title: string; period: string; showData?: boolean; onToggleData?: () => void }): ReactElement;
export function FinanceCumulCategories(p: { model: unknown }): ReactElement;
