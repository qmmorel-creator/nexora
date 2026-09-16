import test from "node:test";
import assert from "node:assert/strict";
import { reportPeriod } from "../lib/report-period.mjs";
import {
  buildCategorizedTransaction,
  buildCreateTransaction,
  validateAccount,
  validateCategoryPair
} from "../lib/finance-validation.mjs";

test("gateway is deliberately read-only by construction", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-read.ts", import.meta.url), "utf8"));
  assert.match(source, /method: \["GET"\]/);
  assert.doesNotMatch(source, /\.set\(|\.update\(|\.delete\(|runTransaction/);
});

test("gateway preserves Nexora chunked storage validation", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  assert.match(source, /chunked-v1/);
  assert.match(source, /parentKey !== key/);
  assert.match(source, /totalLength/);
});

test("serverless configuration uses the Netlify Functions environment", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  assert.match(source, /Netlify\.env\.get\("FIREBASE_SERVICE_ACCOUNT_JSON"\)/);
  assert.match(source, /Netlify\.env\.get\("NEXORA_USER_UID"\)/);
  assert.doesNotMatch(source, /process\.env/);
});

test("health reports finance readiness without exposing the secret", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-health.ts", import.meta.url), "utf8"));
  assert.match(source, /requireFinanceConfig/);
  assert.match(source, /controlledWritesEnabled: financeConfigured/);
  assert.match(source, /operations: financeConfigured \? \["create", "categorize"\]/);
  assert.doesNotMatch(source, /secretKey\s*:/);
});

test("createTask is authenticated, idempotent and transaction-backed", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-create-task.ts", import.meta.url), "utf8"));
  const shared = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  assert.match(source, /isAuthorized/);
  assert.match(source, /idempotency_key_required/);
  assert.match(shared, /runTransaction/);
  assert.match(shared, /item\.idempotencyKey === idempotencyKey/);
  assert.match(shared, /\[\.\.\.active\.items, \.\.\.archive\.items\]\.find/);
  assert.doesNotMatch(source, /method: \["GET"\]/);
});

test("Nexora task gateway accepts validated Google Drive links without duplicates", async () => {
  const createSource = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-create-task.ts", import.meta.url), "utf8"));
  const updateSource = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-task-operations.ts", import.meta.url), "utf8"));
  const shared = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  const contract = await import("node:fs/promises").then(fs => fs.readFile(new URL("../public/openapi.yaml", import.meta.url), "utf8"));
  assert.match(createSource, /parseGoogleDriveAttachments\(body\.attachments\)/);
  assert.match(updateSource, /addAttachments/);
  assert.match(shared, /drive\.google\.com/);
  assert.match(shared, /docs\.google\.com/);
  assert.match(shared, /mergeGoogleDriveAttachments/);
  assert.match(contract, /GoogleDriveAttachment/);
});

test("Gmail information tasks require and use the received date as a milestone", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-create-task.ts", import.meta.url), "utf8"));
  assert.match(source, /information_received_date_required/);
  assert.match(source, /isGmailInformation \? receivedDate/);
  assert.match(source, /milestone: isGmailInformation \? true/);
  assert.match(source, /sourceReceivedDate: receivedDate/);
  assert.match(source, /sourceThreadId/);
});

test("task management supports authenticated search, update, completion and archive", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-task-operations.ts", import.meta.url), "utf8"));
  const shared = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  assert.match(source, /isAuthorized/);
  assert.match(source, /sourceMessageId/);
  assert.match(source, /sourceThreadId/);
  assert.match(source, /updatedFrom/);
  assert.match(source, /"complete", "archive"/);
  assert.match(shared, /mutateTaskAtomically/);
  assert.match(shared, /runTransaction/);
  assert.match(shared, /next\.completedAt = now/);
  assert.match(shared, /next\.archivedAt = now/);
  assert.match(shared, /mutation\.action === "complete" && current\.completedAt/);
  assert.match(shared, /archivedMatches\.length === 1/);
  assert.match(shared, /Mail d’origine/);
  assert.match(shared, /next\.start = current\.sourceReceivedDate/);
});

test("OpenAPI contract exposes only implemented Nexora operations and no secrets", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile(new URL("../public/openapi.yaml", import.meta.url), "utf8"));
  assert.match(source, /openapi: 3\.1\.0/);
  assert.match(source, /operationId: searchNexoraTasks/);
  assert.match(source, /operationId: mutateNexoraTask/);
  assert.match(source, /bearerAuth/);
  assert.doesNotMatch(source, /FIREBASE_SERVICE_ACCOUNT_JSON|NEXORA_ASSISTANT_API_KEY|private_key/);
});

test("morning and evening report periods use Europe/Paris boundaries", () => {
  assert.deepEqual(reportPeriod("morning", new Date("2026-09-02T12:00:00Z")), {
    kind: "morning",
    timeZone: "Europe/Paris",
    localDate: "2026-09-02",
    start: "2026-09-01T18:30:00.000Z",
    end: "2026-09-02T05:00:00.000Z"
  });
  assert.deepEqual(reportPeriod("evening", new Date("2026-01-15T12:00:00Z")), {
    kind: "evening",
    timeZone: "Europe/Paris",
    localDate: "2026-01-15",
    start: "2026-01-15T06:00:00.000Z",
    end: "2026-01-15T19:30:00.000Z"
  });
});

test("report periods remain correct across daylight-saving changes", () => {
  const spring = reportPeriod("morning", new Date("2026-03-29T12:00:00Z"));
  assert.equal(spring.start, "2026-03-28T19:30:00.000Z");
  assert.equal(spring.end, "2026-03-29T05:00:00.000Z");
  const autumn = reportPeriod("morning", new Date("2026-10-25T12:00:00Z"));
  assert.equal(autumn.start, "2026-10-24T18:30:00.000Z");
  assert.equal(autumn.end, "2026-10-25T06:00:00.000Z");
});

test("audit and report endpoints are authenticated and idempotent", async () => {
  const audit = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-audit.ts", import.meta.url), "utf8"));
  const reports = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-reports.ts", import.meta.url), "utf8"));
  const reporting = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/reporting.ts", import.meta.url), "utf8"));
  const shared = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/nexora.ts", import.meta.url), "utf8"));
  assert.match(audit, /isAuthorized/);
  assert.match(audit, /idempotencyKey/);
  assert.match(reporting, /emailsMarkedImportant/);
  assert.match(reports, /persist/);
  assert.match(shared, /assistant_audit/);
  assert.match(shared, /createHash\("sha256"\)/);
  assert.match(shared, /ensureAuditEventInTransaction/);
});

test("scheduled reports guard Paris local time across both UTC offsets", async () => {
  const morning = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-report-morning-scheduled.ts", import.meta.url), "utf8"));
  const evening = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/nexora-report-evening-scheduled.ts", import.meta.url), "utf8"));
  // Le garde porte désormais sur une FENÊTRE autour de l'heure de Paris, pas sur la
  // minute exacte : une invocation retardée d'une minute annulait la journée entière,
  // en silence. Son comportement est couvert par report-schedule.test.mjs ; ce qui se
  // vérifie ici est ce qu'aucun test de comportement ne peut voir — que les fonctions
  // appellent bien le garde partagé, et que la DOUBLE programmation, qui absorbe le
  // changement d'heure, est toujours en place.
  assert.match(morning, /shouldRunReport\(local, 7, 0\)/);
  assert.match(morning, /schedule: "0 5,6 \* \* \*"/);
  assert.match(evening, /shouldRunReport\(local, 20, 30\)/);
  assert.match(evening, /schedule: "30 18,19 \* \* \*"/);
  assert.match(morning, /saveAssistantReport/);
  assert.match(evening, /saveAssistantReport/);
});

test("finance creation enforces dates, signs and controlled transaction types", () => {
  const transaction = buildCreateTransaction({
    bankDate: "2026-09-02",
    transactionType: "Dépense",
    accountId: "courant_ce",
    signedAmount: -42.5,
    category: "Alimentation",
    subcategory: "Courses",
    merchant: "Exemple"
  }, "ast-fin-test");
  assert.equal(transaction.effective_date, "2026-09-02");
  assert.equal(transaction.status, "Réalisé");
  assert.equal(transaction.source, "assistant_personnel");
  assert.throws(() => buildCreateTransaction({
    bankDate: "2026-09-02",
    transactionType: "Dépense",
    accountId: "courant_ce",
    signedAmount: 42.5,
    category: "Alimentation",
    subcategory: "Courses"
  }, "ast-fin-test-2"), /expense_amount_must_be_negative/);
  assert.throws(() => buildCreateTransaction({
    bankDate: "2026-09-02",
    transactionType: "Transfert",
    accountId: "courant_ce",
    signedAmount: -10,
    category: "Transferts internes",
    subcategory: "Virement entre comptes"
  }, "ast-fin-test-3"), /unsupported_transaction_type/);
});

test("finance categorization preserves transaction data and validates catalogs", () => {
  const catalogs = {
    accounts: [{ account_id: "courant_ce" }],
    categories: [{ category: "Achats" }],
    subcategories: [{ category: "Achats", subcategory: "Vêtements" }]
  };
  validateAccount(catalogs, "courant_ce");
  validateCategoryPair(catalogs, "Achats", "Vêtements");
  assert.throws(() => validateCategoryPair(catalogs, "Achats", "Courses"), /subcategory_not_found_for_category/);
  const updated = buildCategorizedTransaction({
    transaction_id: "tx-1",
    bank_date: "2026-09-01",
    effective_date: "2026-09-15",
    transaction_type: "Dépense",
    account_id: "bourso",
    signed_amount: -63.5,
    merchant: "Marchand",
    category: "À classer",
    subcategory: "À déterminer",
    status: "Réalisé",
    revision: 2
  }, { category: "Achats", subcategory: "Vêtements", categoryConfidence: 1 });
  assert.equal(updated.effective_date, "2026-09-15");
  assert.equal(updated.signed_amount, -63.5);
  assert.equal(updated.category, "Achats");
  assert.equal(updated.subcategory, "Vêtements");
});

test("finance gateway only calls the approved RPC and gates autonomous writes", async () => {
  const endpoint = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/finance-transactions.ts", import.meta.url), "utf8"));
  const shared = await import("node:fs/promises").then(fs => fs.readFile(new URL("../netlify/functions/_shared/finance.ts", import.meta.url), "utf8"));
  assert.match(endpoint, /body\.confirmed === true/);
  assert.match(endpoint, /body\.allowAutoCommit === true/);
  assert.match(endpoint, /Math\.abs\(amount\) > 200/);
  assert.match(endpoint, /confidence < 0\.85/);
  assert.match(endpoint, /!confirmed && \(!allowAutoCommit \|\| confirmation\.required\)/);
  assert.match(endpoint, /idempotency_key_required/);
  assert.match(shared, /rpc\/finance_apply_transaction_write/);
  assert.match(shared, /KDM360_SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(endpoint, /delete|cancel|adjust|transfer/i);
  assert.doesNotMatch(shared, /method: "DELETE"/);
});
