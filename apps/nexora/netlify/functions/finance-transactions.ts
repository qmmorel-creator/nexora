import type { Config } from "@netlify/functions";
import { createHash } from "node:crypto";
import {
  buildCategorizedTransaction,
  buildCreateTransaction,
  validateAccount,
  validateCategoryPair
} from "../../lib/finance-validation.mjs";
import {
  applyFinanceTransactionWrite,
  getFinanceCatalogs,
  getFinanceTransaction,
  requireFinanceConfig
} from "./_shared/finance.js";
import { isAuthorized, json, recordAuditEvent, requireConfig } from "./_shared/nexora.js";

function text(value: unknown, max: number) {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error("invalid_text_field");
  const result = value.trim();
  if (result.length > max) throw new Error("text_field_too_long");
  return result;
}

function generatedTransactionId(idempotencyKey: string) {
  return `ast-fin-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
}

function confirmationPolicy(amount: number, categoryConfidence: unknown) {
  const confidence = categoryConfidence == null ? null : Number(categoryConfidence);
  const reasons: string[] = [];
  if (Math.abs(amount) > 200) reasons.push("unusual_amount_over_200_eur");
  if (confidence == null || !Number.isFinite(confidence) || confidence < 0.85) reasons.push("category_confidence_below_85_percent");
  return { required: reasons.length > 0, reasons };
}

export default async (req: Request) => {
  if (!new Set(["POST", "PATCH"]).has(req.method)) return json({ ok: false, error: "method_not_allowed" }, 405);
  const assistant = requireConfig();
  if (assistant.missing.length || !assistant.uid || !assistant.apiKey) {
    return json({ ok: false, error: "configuration_missing", missing: assistant.missing }, 503);
  }
  if (!isAuthorized(req, assistant.apiKey)) return json({ ok: false, error: "unauthorized" }, 401);
  const finance = requireFinanceConfig();
  if (finance.missing.length || !finance.secretKey) return json({ ok: false, error: "finance_configuration_missing", missing: finance.missing }, 503);

  try {
    const body = await req.json() as Record<string, unknown>;
    const idempotencyKey = text(body.idempotencyKey, 500);
    if (!idempotencyKey) return json({ ok: false, error: "idempotency_key_required" }, 400);
    const confirmed = body.confirmed === true;
    const allowAutoCommit = body.allowAutoCommit === true;
    const catalogs = await getFinanceCatalogs({ url: finance.url, secretKey: finance.secretKey });

    if (req.method === "POST") {
      const transactionId = text(body.transactionId, 500) || generatedTransactionId(idempotencyKey);
      const transaction = buildCreateTransaction(body, transactionId);
      validateAccount(catalogs, String(transaction.account_id));
      validateCategoryPair(catalogs, String(transaction.category), String(transaction.subcategory));
      const confirmation = confirmationPolicy(Number(transaction.signed_amount), transaction.category_confidence);
      const preview = {
        operation: "create",
        transaction,
        highValue: Math.abs(Number(transaction.signed_amount)) > 200,
        requiresConfirmation: confirmation.required,
        confirmationReasons: confirmation.reasons
      };
      if (!confirmed && (!allowAutoCommit || confirmation.required)) return json({ ok: true, committed: false, preview });

      const result = await applyFinanceTransactionWrite(
        { url: finance.url, secretKey: finance.secretKey },
        "create",
        transaction,
        idempotencyKey
      );
      await recordAuditEvent(assistant.uid, {
        idempotencyKey: `finance_created:${idempotencyKey}`,
        eventType: "finance_transaction_created",
        title: String(transaction.merchant || transaction.description || transaction.transaction_id),
        metadata: {
          transactionId: transaction.transaction_id,
          accountId: transaction.account_id,
          signedAmount: transaction.signed_amount,
          category: transaction.category,
          subcategory: transaction.subcategory
        }
      });
      return json({ ok: true, committed: true, operation: "create", result, transaction }, result?.idempotent ? 200 : 201);
    }

    const transactionId = text(body.transactionId, 500);
    if (!transactionId) return json({ ok: false, error: "transaction_id_required" }, 400);
    const existing = await getFinanceTransaction({ url: finance.url, secretKey: finance.secretKey }, transactionId);
    if (!existing) return json({ ok: false, error: "transaction_not_found" }, 404);
    const transaction = buildCategorizedTransaction(existing, body);
    validateAccount(catalogs, String(transaction.account_id));
    validateCategoryPair(catalogs, String(transaction.category), String(transaction.subcategory));
    const confirmation = confirmationPolicy(Number(transaction.signed_amount), transaction.category_confidence);
    const preview = {
      operation: "categorize",
      transactionId,
      previous: { category: existing.category, subcategory: existing.subcategory },
      next: { category: transaction.category, subcategory: transaction.subcategory },
      requiresConfirmation: confirmation.required,
      confirmationReasons: confirmation.reasons
    };
    if (!confirmed && (!allowAutoCommit || confirmation.required)) return json({ ok: true, committed: false, preview });

    const result = await applyFinanceTransactionWrite(
      { url: finance.url, secretKey: finance.secretKey },
      "update",
      transaction,
      idempotencyKey
    );
    await recordAuditEvent(assistant.uid, {
      idempotencyKey: `finance_categorized:${idempotencyKey}`,
      eventType: "finance_transaction_categorized",
      title: String(existing.merchant || existing.description || transactionId),
      metadata: {
        transactionId,
        previousCategory: existing.category,
        previousSubcategory: existing.subcategory,
        category: transaction.category,
        subcategory: transaction.subcategory
      }
    });
    return json({ ok: true, committed: true, operation: "categorize", result, transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /(_required|_too_long|^invalid_|_not_found|unsupported_|_must_be_)/.test(message);
    return json({ ok: false, error: clientError ? message : "finance_write_failed", detail: clientError ? undefined : message }, clientError ? 400 : 502);
  }
};

export const config: Config = { path: "/api/finance/transactions", method: ["POST", "PATCH"] };
