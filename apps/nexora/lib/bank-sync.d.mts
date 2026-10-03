export const MATCH_DAYS: number;
export const UNCLASSIFIED: string;
export const CONSENT_WARNING_DAYS: number;
export const RESYNC_OVERLAP_DAYS: number;
export type BankAccountSummary = { accountKey: string; uid: string; label: string; ibanMasked: string; currency: string; cashAccountType: string | null };
export type ExistingTransaction = Record<string, any> & { transaction_id: string; account_id: string };
export type SyncPlan = {
  create: Array<{ transaction: Record<string, unknown>; reconciliationId: string; reconciliationDate: string; ruleId: string | null }>;
  reconcile: Array<{ transactionId: string; reconciliationId: string; reconciliationDate: string; bank: { date: string; amount: number; merchant: string } }>;
  already: number;
  skipped: { pending: number; beforeImportFrom: number; otherCurrency: number };
};
export function aspspKeyOf(name: string, country?: string): string;
export function accountKeyOf(account: Record<string, any>): string;
export function maskIban(iban: string | null | undefined): string;
export function describeSessionAccounts(accounts: unknown): BankAccountSummary[];
export function normalizeBankTransaction(tx: Record<string, any>): { bankId: string | null; amount: number; currency: string; bankDate: string; effectiveDate: string; merchant: string; description: string | null } | null;
export function withExternalIds(accountKey: string, normalized: Array<Record<string, any>>): Array<Record<string, any>>;
export function findMerchantRule(rules: Array<Record<string, any>>, tx: Record<string, any>, accountId: string): Record<string, any> | null;
export function buildImportedTransaction(tx: Record<string, any>, accountId: string, rule: Record<string, any> | null): Record<string, unknown>;
export function planAccountSync(input: { accountKey: string; accountId: string; importFrom: string | null; bankTransactions: unknown[]; existing: ExistingTransaction[]; rules: Array<Record<string, any>> }): SyncPlan;
export function syncDateFrom(input: { importFrom: string | null; lastSyncedAt: string | null; today: string }): string;
export function consentStatus(validUntil: string | null | undefined, now?: Date): { state: "ok" | "soon" | "expired" | "unknown"; daysLeft: number | null };
export function bankReportSection(connections: unknown, now?: Date): {
  banks: Array<{ name: string; validUntil: string; consent: string; daysLeft: number | null; lastSyncAt: string | null; created: number; reconciled: number; errors: Array<{ account: string; error: string }> }>;
  alerts: string[];
};
export function pickBalance(balances: unknown): { amount: number; currency: string; type: string | null; date: string | null } | null;
