import type { Config } from "@netlify/functions";
import { createHash } from "node:crypto";
import {
  buildCategorizedTransaction,
  buildCreateTransaction,
  buildEditedTransaction,
  validateAccount,
  validateCategoryPair
} from "../../lib/finance-validation.mjs";
import { applyFinanceTransactionWrite, getFinanceCatalogs, getFinanceTransaction } from "./_shared/finance.js";
import { requireOwnerFinance } from "./_shared/finance-owner.js";
import { json } from "./_shared/nexora.js";

// Écritures Budget depuis l'interface Nexora (#586), pour la session du
// PROPRIÉTAIRE uniquement : catégoriser une opération (PATCH) et saisir une
// opération à la main (POST). Même validation et même fonction SQL
// (finance_apply_transaction_write, avec file d'écriture et idempotence) que
// l'API de l'assistant (/api/finance/transactions). Le propriétaire décide
// lui-même : pas d'aperçu à confirmer, et sa catégorie vaut confiance 1.
// #618 : `operation: "edit"` (PATCH) modifie n'importe quelle transaction —
// dates, type, compte, montant, libellé, catégorie, description, étiquette —
// par la même fonction SQL (opération `update`). `expectedRevision` refuse la
// modification si la ligne a changé depuis son affichage.
const OPTIONS = { allowEmptySubcategory: true };

function idempotencyKeyOf(body: Record<string, unknown>) {
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  if (!key) throw new Error("idempotency_key_required");
  if (key.length > 200) throw new Error("idempotency_key_too_long");
  return `nexora:${key}`;
}

export default async (req: Request) => {
  if (req.method !== "POST" && req.method !== "PATCH") return json({ ok: false, error: "method_not_allowed" }, 405);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_body" }, 400);
    const idempotencyKey = idempotencyKeyOf(body);
    const catalogs = await getFinanceCatalogs(access.config);

    if (req.method === "POST") {
      const transactionId = `nx-fin-${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 24)}`;
      const transaction = buildCreateTransaction({ ...body, categoryConfidence: 1 }, transactionId, { ...OPTIONS, source: "nexora" });
      validateAccount(catalogs, String(transaction.account_id));
      validateCategoryPair(catalogs, String(transaction.category), transaction.subcategory as string | null, OPTIONS);
      const result = await applyFinanceTransactionWrite(access.config, "create", transaction, idempotencyKey);
      return json({ ok: true, operation: "create", result, transaction }, result?.idempotent ? 200 : 201);
    }

    const transactionId = typeof body.transactionId === "string" ? body.transactionId.trim() : "";
    if (!transactionId) return json({ ok: false, error: "transaction_id_required" }, 400);
    const existing = await getFinanceTransaction(access.config, transactionId);
    if (!existing) return json({ ok: false, error: "transaction_not_found" }, 404);
    if (body.operation === "edit") {
      if (body.expectedRevision != null && Number(body.expectedRevision) !== Number(existing.revision)) {
        return json({ ok: false, error: "transaction_modified_elsewhere", revision: existing.revision }, 409);
      }
      const { transaction, categoryChanged } = buildEditedTransaction(existing, body);
      validateAccount(catalogs, String(transaction.account_id));
      if (categoryChanged) validateCategoryPair(catalogs, String(transaction.category), transaction.subcategory as string | null, OPTIONS);
      const result = await applyFinanceTransactionWrite(access.config, "update", transaction, idempotencyKey);
      return json({ ok: true, operation: "edit", result, transaction });
    }
    const transaction = buildCategorizedTransaction(existing, { ...body, categoryConfidence: 1 }, OPTIONS);
    validateAccount(catalogs, String(transaction.account_id));
    validateCategoryPair(catalogs, String(transaction.category), transaction.subcategory as string | null, OPTIONS);
    const result = await applyFinanceTransactionWrite(access.config, "update", transaction, idempotencyKey);
    return json({ ok: true, operation: "categorize", result, transaction });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /(_required|_too_long|^invalid_|_not_found|unsupported_|_must_be_)/.test(message);
    return json({ ok: false, error: clientError ? message : "finance_write_failed", detail: clientError ? undefined : message }, clientError ? 400 : 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-owner-transactions", method: ["POST", "PATCH"] };
