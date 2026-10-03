import { describe, expect, it } from "vitest";
import { router } from "../netlify/functions/_partage/relais-finance";

const P = (s = "") => new URLSearchParams(s);
describe("relais Finances : liste blanche (#659)", () => {
  it("lectures transmises avec les seuls paramètres validés", () => {
    expect(router("GET", "/api/futur/finance/budget-summary", P("month=2026-10&x=1"), null)).toEqual({ ok: true, methode: "GET", url: "https://nexora-project.org/api/nexora/finance-budget-summary?month=2026-10" });
    expect(router("GET", "/api/futur/finance/budget-summary", P("from=2026-01-01&to=2026-03-31"), null)).toMatchObject({ ok: true, url: expect.stringContaining("from=2026-01-01&to=2026-03-31") });
    expect(router("GET", "/api/futur/finance/wealth-series", P("step=week&from=2025-10-01&to=2026-10-01"), null)).toMatchObject({ ok: true });
    expect(router("GET", "/api/futur/finance/transactions-data", P(), null)).toMatchObject({ ok: true, url: "https://nexora-project.org/api/nexora/finance-transactions-data" });
  });
  it("paramètres invalides et routes inconnues refusés", () => {
    expect(router("GET", "/api/futur/finance/budget-summary", P("month=2026-13"), null)).toEqual({ ok: false, statut: 400, erreur: "invalid_month" });
    expect(router("GET", "/api/futur/finance/budget-summary", P("from=2026-03-01&to=2026-01-01"), null)).toMatchObject({ erreur: "invalid_period" });
    expect(router("GET", "/api/futur/finance/wealth-series", P("step=year"), null)).toMatchObject({ erreur: "invalid_step" });
    expect(router("GET", "/api/futur/finance/references", P(), null)).toMatchObject({ statut: 404 });
    expect(router("GET", "/api/futur/finance/../finance-owner-transactions", P(), null)).toMatchObject({ statut: 404 });
  });
  it("seule la catégorisation est écrite, corps reconstruit", () => {
    const r = router("PATCH", "/api/futur/finance/categoriser", P(), { transactionId: "t1", category: "Courses", subcategory: "", idempotencyKey: "k1", operation: "edit", amount: -9999 });
    expect(r).toEqual({ ok: true, methode: "PATCH", url: "https://nexora-project.org/api/nexora/finance-owner-transactions", corps: JSON.stringify({ transactionId: "t1", category: "Courses", subcategory: null, idempotencyKey: "futur:k1" }) });
    expect(router("PATCH", "/api/futur/finance/categoriser", P(), { transactionId: "t1", idempotencyKey: "k" })).toMatchObject({ erreur: "category_required" });
    expect(router("PATCH", "/api/futur/finance/categoriser", P(), { transactionId: "t1", category: "C" })).toMatchObject({ erreur: "idempotency_key_required" });
    expect(router("POST", "/api/futur/finance/categoriser", P(), {})).toMatchObject({ statut: 405 });
    expect(router("PATCH", "/api/futur/finance/edit", P(), {})).toMatchObject({ statut: 405 });
    expect(router("DELETE", "/api/futur/finance/categoriser", P(), {})).toMatchObject({ statut: 405 });
  });
});
