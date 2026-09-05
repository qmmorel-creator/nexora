export type FinanceCatalogs = {
  accounts: Array<{ account_id: string }>;
  categories: Array<{ category: string }>;
  subcategories: Array<{ category: string; subcategory: string }>;
};
export function validateCategoryPair(catalogs: FinanceCatalogs, category: string, subcategory: string): void;
export function validateAccount(catalogs: FinanceCatalogs, accountId: string): void;
export function buildCreateTransaction(input: Record<string, unknown>, transactionId: string): Record<string, unknown>;
export function buildCategorizedTransaction(existing: Record<string, unknown>, input: Record<string, unknown>): Record<string, unknown>;
