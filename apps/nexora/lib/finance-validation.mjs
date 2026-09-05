const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TYPES = new Set(["Dépense", "Revenu", "Remboursement"]);

function requiredText(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field}_too_long`);
  return result;
}

function optionalText(value, max = 1000) {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("invalid_text_field");
  const result = value.trim();
  if (result.length > max) throw new Error("text_field_too_long");
  return result || null;
}

export function validateCategoryPair(catalogs, category, subcategory) {
  const activeCategory = catalogs.categories.some(item => item.category === category);
  const activePair = catalogs.subcategories.some(item => item.category === category && item.subcategory === subcategory);
  if (!activeCategory) throw new Error("category_not_found");
  if (!activePair) throw new Error("subcategory_not_found_for_category");
}

export function validateAccount(catalogs, accountId) {
  if (!catalogs.accounts.some(item => item.account_id === accountId)) throw new Error("account_not_found");
}

export function buildCreateTransaction(input, transactionId) {
  const transactionType = requiredText(input.transactionType, "transaction_type", 100);
  if (!TYPES.has(transactionType)) throw new Error("unsupported_transaction_type");
  const bankDate = requiredText(input.bankDate, "bank_date", 10);
  const effectiveDate = optionalText(input.effectiveDate, 10) || bankDate;
  if (!DATE.test(bankDate) || !DATE.test(effectiveDate)) throw new Error("invalid_dates");
  const amount = Number(input.signedAmount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("invalid_signed_amount");
  if (transactionType === "Dépense" && amount > 0) throw new Error("expense_amount_must_be_negative");
  if ((transactionType === "Revenu" || transactionType === "Remboursement") && amount < 0) {
    throw new Error("income_amount_must_be_positive");
  }
  const categoryConfidence = input.categoryConfidence == null ? null : Number(input.categoryConfidence);
  if (categoryConfidence != null && (!Number.isFinite(categoryConfidence) || categoryConfidence < 0 || categoryConfidence > 1)) {
    throw new Error("invalid_category_confidence");
  }
  return {
    transaction_id: transactionId,
    bank_date: bankDate,
    effective_date: effectiveDate,
    transaction_type: transactionType,
    account_id: requiredText(input.accountId, "account_id", 200),
    payment_method_id: optionalText(input.paymentMethodId, 200),
    signed_amount: amount,
    merchant: optionalText(input.merchant, 500),
    category: requiredText(input.category, "category", 200),
    subcategory: requiredText(input.subcategory, "subcategory", 200),
    category_confidence: categoryConfidence,
    description: optionalText(input.description, 2000),
    status: "Réalisé",
    source: "assistant_personnel",
    source_id: optionalText(input.sourceId, 500),
    tag: optionalText(input.tag, 200)
  };
}

export function buildCategorizedTransaction(existing, input) {
  if (!existing || typeof existing !== "object") throw new Error("transaction_not_found");
  const categoryConfidence = input.categoryConfidence == null ? existing.category_confidence : Number(input.categoryConfidence);
  if (categoryConfidence != null && (!Number.isFinite(categoryConfidence) || categoryConfidence < 0 || categoryConfidence > 1)) {
    throw new Error("invalid_category_confidence");
  }
  return {
    transaction_id: existing.transaction_id,
    bank_date: existing.bank_date,
    effective_date: existing.effective_date,
    created_at: existing.created_at,
    transaction_type: existing.transaction_type,
    account_id: existing.account_id,
    payment_method_id: existing.payment_method_id,
    signed_amount: existing.signed_amount,
    merchant: existing.merchant,
    category: requiredText(input.category, "category", 200),
    subcategory: requiredText(input.subcategory, "subcategory", 200),
    description: existing.description,
    status: existing.status,
    source: existing.source,
    transfer_id: existing.transfer_id,
    cancels_transaction_id: existing.cancels_transaction_id,
    category_confidence: categoryConfidence,
    tag: existing.tag,
    source_id: existing.source_id
  };
}
