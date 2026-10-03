/* Synchronisation bancaire Enable Banking (issue #677) : module serveur
   compilé tel quel (esbuild), réseau remplacé par une fausse banque et une
   fausse base Budget. Vérifie le jeton signé, le `state` à usage unique et un
   passage complet : création, rapprochement, aucun doublon au second passage. */

import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { build } from "esbuild";

const outfile = new URL("../.build/bank-sync-server.test-bundle.mjs", import.meta.url).pathname;
await build({
  entryPoints: [new URL("../netlify/functions/_shared/bank-sync.ts", import.meta.url).pathname],
  bundle: true, platform: "node", format: "esm", outfile, packages: "external", logLevel: "silent",
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const env = new Map();
globalThis.Netlify = { env: { get: (name) => env.get(name) } };
const S = await import(outfile);

const finance = { url: "https://base.test", secretKey: "service" };
const config = { appId: "app-123", privateKey: pem };

test("configuration : clé en base64 ou en clair, clé illisible signalée", () => {
  env.clear();
  assert.deepEqual(S.requireEnableBankingConfig().missing, ["ENABLE_BANKING_APP_ID", "ENABLE_BANKING_PRIVATE_KEY_B64"]);
  env.set("ENABLE_BANKING_APP_ID", "app-123");
  env.set("ENABLE_BANKING_PRIVATE_KEY_B64", Buffer.from(pem).toString("base64"));
  assert.equal(S.requireEnableBankingConfig().config.privateKey, pem);
  env.delete("ENABLE_BANKING_PRIVATE_KEY_B64");
  env.set("ENABLE_BANKING_PRIVATE_KEY", pem.replace(/\n/g, "\\n"));
  assert.equal(S.requireEnableBankingConfig().config.privateKey, pem);
  env.set("ENABLE_BANKING_PRIVATE_KEY", "pas une clé");
  assert.match(S.requireEnableBankingConfig().missing.join(), /clé illisible/);
  assert.equal(S.redirectUrl(), "https://nexora-project.org/api/finance/enable-banking/callback");
});

test("jeton JWT RS256 vérifiable avec la clé publique", () => {
  const jwt = S.enableBankingJwt(config, Date.parse("2026-10-03T12:00:00Z"));
  const [h, p, sig] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url")), { typ: "JWT", alg: "RS256", kid: "app-123" });
  const payload = JSON.parse(Buffer.from(p, "base64url"));
  assert.equal(payload.iss, "enablebanking.com");
  assert.equal(payload.aud, "api.enablebanking.com");
  assert.ok(payload.exp - payload.iat <= 86400);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(sig, "base64url")));
});

// Fausse banque + fausse base : enregistre les écritures.
function fakeNetwork({ ledger, links, connections, rules = [], bank = {} }) {
  const writes = { imports: [], reconciliations: [], linkPatches: [], connectionPatches: [], authPatches: [] };
  const reply = (body, status = 200) => new Response(body == null ? "" : JSON.stringify(body), { status });
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;
    if (url.host === "api.enablebanking.com") {
      assert.match(init.headers.authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
      const m = url.pathname.match(/^\/accounts\/([^/]+)\/(transactions|balances)$/);
      if (m && m[2] === "transactions") {
        const all = bank[m[1]] || [];
        // Deux pages pour éprouver continuation_key.
        if (!url.searchParams.get("continuation_key")) return reply({ transactions: all.slice(0, 1), continuation_key: all.length > 1 ? "p2" : null });
        return reply({ transactions: all.slice(1), continuation_key: null });
      }
      if (m) return reply({ balances: [{ balance_type: "CLBD", balance_amount: { amount: "1500.00", currency: "EUR" }, reference_date: "2026-10-03" }] });
      if (url.pathname === "/sessions" && method === "POST") return reply({ session_id: "sess-2", access: { valid_until: "2027-03-31T00:00:00Z" }, accounts: [{ uid: "uid-new", identification_hash: "H1", name: "Compte", currency: "EUR", account_id: { iban: "FR7612345678901234567890123" } }] });
      return reply({ error: "not_found" }, 404);
    }
    assert.equal(url.host, "base.test");
    const table = url.pathname.replace("/rest/v1/", "");
    if (table === "finance_bank_connections" && method === "GET") return reply(connections);
    if (table === "finance_bank_connections" && method === "PATCH") { writes.connectionPatches.push(body); return reply(null, 204); }
    if (table === "finance_bank_connections" && method === "POST") { writes.connectionUpsert = body; return reply([body], 201); }
    if (table === "finance_bank_account_links" && method === "GET") return reply(links);
    if (table === "finance_bank_account_links" && method === "PATCH") { writes.linkPatches.push(body); return reply([{ ...links[0], ...body }]); }
    if (table === "finance_bank_account_links" && method === "POST") { writes.linkUpsert = body; return reply(body, 201); }
    if (table === "finance_bank_auth_requests" && method === "PATCH") {
      writes.authPatches.push(url.search);
      return reply(url.searchParams.get("state") === `eq.${"a".repeat(48)}` ? [{ state: "a".repeat(48), aspsp_name: "Revolut", aspsp_country: "FR" }] : []);
    }
    if (table === "finance_merchant_rules") return reply(rules);
    if (table === "finance_transactions_current") {
      const account = url.searchParams.get("account_id").replace("eq.", "");
      return reply(ledger.filter((row) => row.account_id === account));
    }
    if (table === "rpc/finance_apply_transaction_write") {
      writes.imports.push(body);
      ledger.push({ ...body.p_transaction, reconciled: false });
      return reply({ transaction_id: body.p_transaction.transaction_id, idempotent: false });
    }
    if (table === "rpc/finance_set_transaction_reconciliation") {
      writes.reconciliations.push(body);
      const row = ledger.find((r) => r.transaction_id === body.p_transaction_id);
      Object.assign(row, { reconciled: true, reconciliation_id: body.p_reconciliation_id, reconciliation_date: body.p_reconciliation_date });
      return reply({ ok: true });
    }
    throw new Error(`requête inattendue ${method} ${url}`);
  };
  return writes;
}

const tx = (ref, amount, date, name, indicator = "DBIT") => ({ entry_reference: ref, transaction_amount: { amount, currency: "EUR" }, credit_debit_indicator: indicator, status: "BOOK", booking_date: date, creditor: { name } });

test("passage complet : rapproche la saisie, crée le reste, rien au second passage", async () => {
  const ledger = [{ transaction_id: "manual-1", account_id: "revolut", signed_amount: -42, bank_date: "2026-10-01", effective_date: "2026-10-01", transaction_type: "Dépense", reconciled: false }];
  const links = [
    { account_key: "hash:H1", aspsp_key: "FR:revolut", account_uid: "uid-1", label: "Revolut", account_id: "revolut", import_from: "2026-09-25", last_synced_at: null },
    { account_key: "hash:H2", aspsp_key: "FR:revolut", account_uid: "uid-2", label: "Épargne", account_id: null, import_from: null },
  ];
  const connections = [{ aspsp_key: "FR:revolut", aspsp_name: "Revolut", session_id: "sess-1", valid_until: "2027-03-31T00:00:00Z" }];
  const rules = [{ rule_id: "r", pattern: "Netlify", match_type: "contains", category: "Abonnements", subcategory: "Thalvego", priority: 130, confidence: 1, active: true }];
  const bank = { "uid-1": [tx("A", "42.00", "2026-10-02", "Super U"), tx("B", "19.00", "2026-10-02", "Netlify Inc"), tx("C", "5.00", "2026-09-10", "Ancienne"), { ...tx("D", "3.00", "2026-10-03", "En attente"), status: "PDNG" }] };
  const writes = fakeNetwork({ ledger, links, connections, rules, bank });
  const now = new Date("2026-10-03T08:00:00Z");

  const first = await S.runSync(config, finance, { now });
  assert.deepEqual([first.created, first.reconciled, first.errors], [1, 1, 0]);
  assert.equal(first.accounts.length, 1, "compte ignoré non synchronisé");
  const [account] = first.accounts;
  assert.equal(account.dateFrom, "2026-09-25");
  assert.deepEqual(account.skipped, { pending: 1, beforeImportFrom: 1, otherCurrency: 0, ignored: 0, invalid: 0, statuses: { PDNG: 1 }, upcomingUndated: 0 });
  assert.equal(account.samples.pending[0].label, "En attente");
  assert.deepEqual(account.balance, { amount: 1500, currency: "EUR", type: "CLBD", date: "2026-10-03" });
  assert.equal(writes.imports[0].p_operation, "import");
  assert.equal(writes.imports[0].p_transaction.category, "Abonnements");
  assert.equal(writes.imports[0].p_idempotency_key, `enable-banking:${writes.imports[0].p_transaction.transaction_id}`);
  assert.equal(writes.reconciliations.find((r) => r.p_transaction_id === "manual-1").p_reconciliation_date, "2026-10-02");
  assert.equal(writes.linkPatches.length, 1);
  assert.ok(writes.connectionPatches[0].last_sync_result);

  links[0].last_synced_at = now.toISOString();
  const second = await S.runSync(config, finance, { now });
  assert.deepEqual([second.created, second.reconciled, second.accounts[0].already], [0, 0, 2]);
  assert.equal(ledger.length, 2, "aucun doublon");
});

test("écritures plafonnées : passage partiel repris sans doublon, date de synchro figée jusqu'au bout", async () => {
  const ledger = [{ transaction_id: "manual-1", account_id: "revolut", signed_amount: -42, bank_date: "2026-10-01", transaction_type: "Dépense", reconciled: false }];
  const links = [{ account_key: "hash:H1", aspsp_key: "FR:revolut", account_uid: "uid-1", label: "Revolut", account_id: "revolut", import_from: "2026-09-25", last_synced_at: null }];
  const connections = [{ aspsp_key: "FR:revolut", aspsp_name: "Revolut", session_id: "s", valid_until: "2027-03-31T00:00:00Z" }];
  const bank = { "uid-1": [tx("A", "42.00", "2026-10-02", "Super U"), tx("B", "19.00", "2026-10-02", "Netlify"), tx("C", "7.00", "2026-10-02", "Café")] };
  const writes = fakeNetwork({ ledger, links, connections, bank });
  const now = new Date("2026-10-03T08:00:00Z");
  const r1 = await S.runSync(config, finance, { now, maxWrites: 1 });
  assert.deepEqual([r1.partial, r1.reconciled, r1.created, r1.accounts[0].remaining], [true, 1, 0, 2], "le rapprochement passe avant toute création");
  assert.equal(writes.linkPatches.length, 0, "date de synchro non avancée");
  const r2 = await S.runSync(config, finance, { now, maxWrites: 1 });
  assert.deepEqual([r2.partial, r2.created], [true, 1]);
  const r3 = await S.runSync(config, finance, { now, maxWrites: 1 });
  assert.deepEqual([r3.partial, r3.created, r3.accounts[0].remaining], [false, 1, 0]);
  assert.equal(writes.linkPatches.length, 1);
  assert.equal(ledger.length, 3, "1 saisie rapprochée + 2 créations, aucun doublon");
});

test("opération à venir : créée à sa date future sans rapprochement, rapprochée à la comptabilisation", async () => {
  const ledger = [];
  const links = [{ account_key: "hash:H1", aspsp_key: "FR:ce", account_uid: "uid-1", label: "Courant", account_id: "courant_ce", import_from: "2026-09-28", last_synced_at: null }];
  const connections = [{ aspsp_key: "FR:ce", aspsp_name: "CE", session_id: "s", valid_until: "2027-03-31T00:00:00Z" }];
  const bank = { "uid-1": [{ ...tx("S2", "45.00", null, "Free Mobile"), status: "OTHR", value_date: "2026-10-08" }] };
  const writes = fakeNetwork({ ledger, links, connections, bank });
  const r1 = await S.runSync(config, finance, { now: new Date("2026-10-03T08:00:00Z") });
  assert.deepEqual([r1.created, r1.reconciled], [1, 0]);
  assert.equal(writes.imports[0].p_transaction.bank_date, "2026-10-08");
  assert.equal(writes.reconciliations.length, 0, "pas de rapprochement avant le passage en banque");
  bank["uid-1"] = [tx("B9", "45.00", "2026-10-09", "Free Mobile")];
  links[0].last_synced_at = null;
  const r2 = await S.runSync(config, finance, { now: new Date("2026-10-09T08:00:00Z") });
  assert.deepEqual([r2.created, r2.reconciled], [0, 1]);
  assert.equal(ledger.length, 1, "aucun doublon");
  assert.equal(ledger[0].reconciled, true);
});

test("erreurs par compte : consentement expiré, banque déconnectée", async () => {
  const links = [
    { account_key: "k1", aspsp_key: "FR:a", account_uid: "u1", account_id: "x", import_from: "2026-10-01" },
    { account_key: "k2", aspsp_key: "FR:b", account_uid: null, account_id: "y", import_from: "2026-10-01" },
  ];
  fakeNetwork({ ledger: [], links, connections: [{ aspsp_key: "FR:a", aspsp_name: "A", session_id: "s", valid_until: "2026-10-01T00:00:00Z" }] });
  const result = await S.runSync(config, finance, { now: new Date("2026-10-03T08:00:00Z") });
  assert.deepEqual(result.accounts.map((a) => a.error), ["consent_expired", "bank_not_connected"]);
});

test("retour de la banque : state inconnu refusé, state valide ouvre la session sans écraser la liaison", async () => {
  const writes = fakeNetwork({ ledger: [], links: [], connections: [] });
  await assert.rejects(S.completeAuthorization(config, finance, "code", "pas-un-state"), /invalid_callback/);
  await assert.rejects(S.completeAuthorization(config, finance, "code", "b".repeat(48)), /auth_request_unknown_or_expired/);
  assert.match(writes.authPatches[0], /consumed_at=is\.null/);
  assert.match(writes.authPatches[0], /created_at=gte\./);
  const done = await S.completeAuthorization(config, finance, "code", "a".repeat(48));
  assert.deepEqual(done, { aspspKey: "FR:revolut", aspspName: "Revolut", accounts: 1 });
  assert.equal(writes.connectionUpsert.session_id, "sess-2");
  assert.equal(writes.linkUpsert[0].account_key, "hash:H1");
  assert.ok(!("account_id" in writes.linkUpsert[0]) && !("import_from" in writes.linkUpsert[0]), "liaison existante conservée");
  assert.ok(!JSON.stringify(writes.connectionUpsert.accounts).includes("12345678901234567890"), "IBAN complet jamais stocké");
});

test("état pour l'interface : aucun identifiant de session", async () => {
  fakeNetwork({ ledger: [], links: [{ account_key: "k", aspsp_key: "FR:a", account_uid: "u", label: "L", account_id: null }], connections: [{ aspsp_key: "FR:a", aspsp_name: "A", session_id: "secret-session", valid_until: "2027-01-01T00:00:00Z" }] });
  const status = await S.readStatus(finance, new Date("2026-10-03T00:00:00Z"));
  assert.doesNotMatch(JSON.stringify(status), /secret-session|"u"/);
  assert.equal(status.connections[0].consent.state, "ok");
  assert.equal(status.accounts[0].connected, true);
});
