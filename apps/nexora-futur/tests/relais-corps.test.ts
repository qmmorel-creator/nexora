import { describe, expect, it } from "vitest";
import { routerCorps } from "../netlify/functions/_partage/relais-corps";

describe("relais Corps : liste blanche en lecture (#660)", () => {
  it("quatre lectures transmises", () => {
    expect(routerCorps("GET", "/api/futur/corps/sport-activities")).toEqual({ ok: true, url: "https://nexora-project.org/api/nexora/sport-activities", binaire: false });
    expect(routerCorps("GET", "/api/futur/corps/health-records/")).toMatchObject({ ok: true, url: "https://nexora-project.org/api/nexora/health-records" });
    expect(routerCorps("GET", "/api/futur/corps/body-photos")).toMatchObject({ ok: true, binaire: false });
    expect(routerCorps("GET", "/api/futur/corps/body-photos/abcd-1234_x/image")).toEqual({ ok: true, url: "https://nexora-project.org/api/nexora/body-photos/abcd-1234_x/image", binaire: true });
  });
  it("écritures, routes inconnues et identifiants invalides refusés", () => {
    expect(routerCorps("POST", "/api/futur/corps/body-photos")).toEqual({ ok: false, statut: 405, erreur: "method_not_allowed" });
    expect(routerCorps("PATCH", "/api/futur/corps/body-photos/abcd-1234")).toMatchObject({ statut: 405 });
    expect(routerCorps("GET", "/api/futur/corps/body-photos/reference")).toMatchObject({ statut: 404 });
    expect(routerCorps("GET", "/api/futur/corps/body-photos/../x/image")).toMatchObject({ ok: false });
    expect(routerCorps("GET", "/api/futur/corps/body-photos/court/image")).toMatchObject({ statut: 400 });
    expect(routerCorps("GET", "/api/futur/corps/finance")).toMatchObject({ statut: 404 });
  });
});
