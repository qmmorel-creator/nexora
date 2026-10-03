import { afterEach, describe, expect, it, vi } from "vitest";
import { configurationDirecte, servirFinance } from "../netlify/functions/_partage/finance-directe";

// Finances en direct sur Supabase KDM360 (sevrage de Nexora, #721) : fetch
// Supabase simulé, aucune valeur de secret réelle (clé factice).
const SUPABASE = "https://kdm360.test";
const CLE = "cle-factice";
const env = (vars: Record<string, string>) => (nom: string) => vars[nom];
const AVEC_CLE = env({ KDM360_SUPABASE_URL: SUPABASE, KDM360_SUPABASE_SECRET_KEY: CLE });

const TABLES: Record<string, unknown[]> = {
  finance_transactions_current: [
    { transaction_id: "t1", effective_date: "2026-09-10", bank_date: "2026-09-10", transaction_type: "Dépense", account_id: "a1", signed_amount: -42.5, merchant: "Marché", category: "Courses", subcategory: "Alimentation", description: null, category_confidence: 1, cancels_transaction_id: null, raw: null },
    { transaction_id: "t2", effective_date: "2026-09-01", bank_date: "2026-09-01", transaction_type: "Revenu", account_id: "a1", signed_amount: 2000, merchant: "Salaire", category: "Revenus", subcategory: "Salaire", description: null, category_confidence: 1, cancels_transaction_id: null, raw: null },
  ],
  finance_accounts_current: [{ account_id: "a1", name: "Courant", bank: "b1", account_type: "courant", opening_balance: 100, color: "#000", active: true }],
  finance_categories_current: [{ category: "Courses", color: "#0a0", active: true }, { category: "Revenus", color: "#00a", active: true }],
  finance_subcategories_current: [{ category: "Courses", subcategory: "Alimentation", active: true }, { category: "Revenus", subcategory: "Salaire", active: true }],
  finance_banks: [{ bank_id: "b1", name: "Banque", color: "#111" }],
  finance_account_types: [{ id: "courant", name: "Courant", color: "#222" }],
  finance_account_balances: [],
};

type Appel = { url: string; init?: RequestInit };
function simulerSupabase(rpc: unknown = { idempotent: false, revision: 2 }) {
  const appels: Appel[] = [];
  const fetchSimule = vi.fn(async (entree: string | URL | Request, init?: RequestInit) => {
    const url = String(entree);
    appels.push({ url, init });
    if (!url.startsWith(SUPABASE)) return new Response(JSON.stringify({ ok: true, relais: true }), { status: 200 });
    const u = new URL(url);
    if (u.pathname === "/rest/v1/rpc/finance_apply_transaction_write") return new Response(JSON.stringify(rpc), { status: 200 });
    const table = u.pathname.replace("/rest/v1/", "");
    let lignes = TABLES[table] || [];
    const id = u.searchParams.get("transaction_id");
    if (id) lignes = lignes.filter((l) => `eq.${(l as { transaction_id: string }).transaction_id}` === id);
    return new Response(JSON.stringify(lignes), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchSimule);
  return appels;
}

const servir = (methode: string, route: string, corps: unknown = null, e = AVEC_CLE) => {
  const u = new URL("https://optim.test/api/optim/finance/" + route);
  return servirFinance({ methode, chemin: u.pathname, params: u.searchParams, corps, jeton: "jeton-test" }, e);
};

afterEach(() => { vi.unstubAllGlobals(); });

describe("finances en direct sur Supabase KDM360 (#721)", () => {
  it("bascule : clé posée → direct, URL par défaut si KDM360_SUPABASE_URL est absente", () => {
    expect(configurationDirecte(env({}))).toBeNull();
    expect(configurationDirecte(env({ KDM360_SUPABASE_SECRET_KEY: CLE }))).toEqual({ url: "https://ftgmjaozveprnshkdosj.supabase.co", secretKey: CLE });
  });

  it("budget-summary : lit les tables Budget sur Supabase et calcule la synthèse", async () => {
    const appels = simulerSupabase();
    const r = await servir("GET", "budget-summary?month=2026-09");
    expect(r.status).toBe(200);
    const corps = await r.json();
    expect(corps.ok).toBe(true);
    expect(corps.data.totals).toMatchObject({ expenses: 42.5, income: 2000 });
    expect(appels.every((a) => a.url.startsWith(SUPABASE + "/rest/v1/"))).toBe(true);
    expect(appels.map((a) => new URL(a.url).pathname).sort()).toEqual([
      "/rest/v1/finance_account_balances", "/rest/v1/finance_account_types", "/rest/v1/finance_accounts_current", "/rest/v1/finance_banks",
      "/rest/v1/finance_categories_current", "/rest/v1/finance_subcategories_current", "/rest/v1/finance_transactions_current",
    ]);
    const tx = appels.find((a) => a.url.includes("finance_transactions_current"))!;
    expect(tx.url).toContain("order=transaction_id.asc&limit=1000&offset=0");
    expect((tx.init?.headers as Record<string, string>).apikey).toBe(CLE);
  });

  it("budget-summary par période et erreurs de validation identiques au relais", async () => {
    simulerSupabase();
    const p = await (await servir("GET", "budget-summary?from=2026-09-01&to=2026-09-30")).json();
    expect(p.data.totals).toMatchObject({ expenses: 42.5, income: 2000, net: 1957.5 });
    const m = await servir("GET", "budget-summary?month=2026-13");
    expect(m.status).toBe(400); expect(await m.json()).toEqual({ ok: false, error: "invalid_month" });
    const d = await servir("GET", "budget-summary?from=2026-02-31&to=2026-03-01");
    expect(d.status).toBe(400); expect(await d.json()).toEqual({ ok: false, error: "invalid_period" });
  });

  it("sankey-data et transactions-data : mêmes tables et colonnes que l'amont", async () => {
    const appels = simulerSupabase();
    const s = await (await servir("GET", "sankey-data")).json();
    expect(Object.keys(s.data).sort()).toEqual(["accountTypes", "accounts", "balances", "banks", "categories", "transactions"]);
    expect(appels.find((a) => a.url.includes("finance_categories_current"))!.url).toContain("select=category,color&");
    appels.length = 0;
    const t = await (await servir("GET", "transactions-data")).json();
    expect(Object.keys(t.data).sort()).toEqual(["accounts", "transactions"]);
    expect(appels.find((a) => a.url.includes("finance_transactions_current"))!.url).toContain("select=*&");
  });

  it("lecture en échec : finance_read_failed (502)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 })));
    const r = await servir("GET", "wealth-series?step=month");
    expect(r.status).toBe(502);
    expect(await r.json()).toEqual({ ok: false, error: "finance_read_failed", detail: "boom" });
  });

  it("catégorisation : RPC finance_apply_transaction_write avec la clé « nexora:optim:<clé> »", async () => {
    const appels = simulerSupabase();
    const r = await servir("PATCH", "categoriser", { transactionId: "t1", category: "Revenus", subcategory: "Salaire", idempotencyKey: "k-123", operation: "edit", signedAmount: -9999 });
    expect(r.status).toBe(200);
    const corps = await r.json();
    expect(corps).toMatchObject({ ok: true, operation: "categorize", result: { idempotent: false } });
    expect(corps.transaction).toMatchObject({ transaction_id: "t1", category: "Revenus", subcategory: "Salaire", category_confidence: 1, signed_amount: -42.5 });
    const rpc = appels.filter((a) => a.url === SUPABASE + "/rest/v1/rpc/finance_apply_transaction_write");
    expect(rpc).toHaveLength(1);
    expect(rpc[0].init?.method).toBe("POST");
    const envoi = JSON.parse(String(rpc[0].init?.body));
    expect(envoi.p_operation).toBe("update");
    expect(envoi.p_idempotency_key).toBe("nexora:optim:k-123");
    expect(envoi.p_transaction.signed_amount).toBe(-42.5); // aucun autre champ ne passe
  });

  it("catégorisation refusée : clé manquante, catégorie inconnue, transaction absente", async () => {
    const appels = simulerSupabase();
    const sansCle = await servir("PATCH", "categoriser", { transactionId: "t1", category: "Courses" });
    expect(sansCle.status).toBe(400); expect(await sansCle.json()).toEqual({ ok: false, error: "idempotency_key_required" });
    expect(appels).toHaveLength(0); // refusé avant tout appel
    const inconnue = await servir("PATCH", "categoriser", { transactionId: "t1", category: "Inconnue", idempotencyKey: "k" });
    expect(inconnue.status).toBe(400); expect(await inconnue.json()).toEqual({ ok: false, error: "category_not_found" });
    const absente = await servir("PATCH", "categoriser", { transactionId: "zz", category: "Courses", idempotencyKey: "k" });
    expect(absente.status).toBe(404); expect(await absente.json()).toEqual({ ok: false, error: "transaction_not_found" });
    expect(appels.some((a) => a.url.includes("/rpc/"))).toBe(false);
  });

  it("sans KDM360_SUPABASE_SECRET_KEY : repli sur le relais nexora-project, jeton transmis", async () => {
    const appels = simulerSupabase();
    const r = await servir("PATCH", "categoriser", { transactionId: "t1", category: "Courses", idempotencyKey: "k1" }, env({ KDM360_SUPABASE_URL: SUPABASE }));
    expect(r.status).toBe(200);
    expect(appels).toHaveLength(1);
    expect(appels[0].url).toBe("https://nexora-project.org/api/nexora/finance-owner-transactions");
    expect((appels[0].init?.headers as Record<string, string>).authorization).toBe("Bearer jeton-test");
    expect(JSON.parse(String(appels[0].init?.body)).idempotencyKey).toBe("optim:k1");
    appels.length = 0;
    await servir("GET", "budget-summary?month=2026-09", null, env({}));
    expect(appels.map((a) => a.url)).toEqual(["https://nexora-project.org/api/nexora/finance-budget-summary?month=2026-09"]);
  });
});
