import { describe, expect, it } from "vitest";
import { formaterSante, graduationsSante, libellePearson, mesureSante, pearson, relevesDe, santeSport, serieSante } from "../src/donnees/sante";
import { ajuster, alignement, appliquer, composer, ecartJours, matriceCss, photoDroite, transformAjustement, type Photo } from "../src/donnees/photos";

describe("Santé (#660, port de NEXORA:HEALTH)", () => {
  const rel = relevesDe({ records: [{ date: "2026-10-01", weight: 80, recovery: 50 }, { date: "2026-10-02", weight: 79, recovery: 70 }, { date: "2026-10-03", weight: 78.5 }, { date: "x" }] });
  it("série par jour : trous gardés, moyenne mobile, extrêmes", () => {
    const s = serieSante(rel, { mesure: "weight", periode: "7", regroupement: "day", jours: 2 }, "2026-10-03");
    expect(s.points.map((p) => p.a)).toEqual([null, null, null, null, 80, 79, 78.5]);
    expect(s.points[6].mobile).toBe(78.75);
    expect(s.min?.a).toBe(78.5); expect(s.max?.a).toBe(80);
    expect(formaterSante(s.moyenne, mesureSante("weight"))).toBe("79,2 kg");
  });
  it("graduations, corrélation et libellé", () => {
    expect(graduationsSante(78.5, 80)).toEqual([78.5, 79, 79.5, 80]);
    expect(pearson([[1, 2], [2, 4], [3, 6]])).toBeCloseTo(1);
    expect(pearson([[1, 2], [2, 4]])).toBeNull();
    expect(libellePearson(-0.6)).toBe("lien fort, sens opposé");
    expect(libellePearson(0.05)).toBe("aucun lien");
  });
  it("santé × sport : un jour sans sport compte 0, décalage d'un jour", () => {
    const x = santeSport(rel, [{ id: "1", date: "2026-10-01", sport: "C", title: "", total: 60, moving: null, distance: null, elevation: null, hr: null, maxHr: null, url: null }], { mesure: "recovery", mesureSport: "total", periode: "7", regroupement: "day", decalage: 1 }, "2026-10-03");
    expect(x.lag).toBe(1);
    const p = x.points.find((q) => q.key === "2026-10-01")!;
    expect(p.a).toBe(70); expect(p.b).toBe(1);
  });
});

describe("Photos (#660, port de NEXORA:BODY-PHOTOS)", () => {
  it("similarité sans reflet ajustée aux moindres carrés", () => {
    const t = ajuster([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 5, y: 5 }, { x: 5, y: 25 }])!;
    expect(appliquer(t, { x: 10, y: 0 }).y).toBeCloseTo(25);
    expect(t.a).toBeCloseTo(0); expect(t.b).toBeCloseTo(2);
    expect(ajuster([{ x: 1, y: 1 }], [{ x: 2, y: 2 }])).toBeNull();
    expect(composer({ a: 1, b: 0, tx: 3, ty: 0 }, { a: 2, b: 0, tx: 0, ty: 0 })).toEqual({ a: 2, b: 0, tx: 3, ty: 0 });
    expect(matriceCss({ a: 1, b: 0, tx: 2, ty: 3 }, 0.5)).toBe("matrix(0.5, 0, 0, 0.5, 1, 1.5)");
  });
  const ref: Photo = { id: "ref-0001", status: "ready", date: "2026-04-06", width: 600, height: 900, landmarks: { leftEye: { x: 0.45, y: 1 / 6 }, rightEye: { x: 0.55, y: 1 / 6 } } };
  const ph: Photo = { id: "ph-00001", status: "ready", date: "2026-10-01", width: 600, height: 900, landmarks: { leftEye: { x: 0.5, y: 0.2 }, rightEye: { x: 0.6, y: 0.2 } }, adjust: { "ref-0001": { dx: 10 } } };
  it("alignement : repères communs, ajustement composé après, repères manquants signalés", () => {
    const a = alignement(ph, ref);
    expect(a.ok).toBe(true);
    if (a.ok) { expect(a.transform.tx).toBeCloseTo(-30 + 10); expect(a.residu).toBeCloseTo(10); }
    expect(alignement({ ...ph, landmarks: {} }, ref)).toEqual({ ok: false, raison: "photo" });
    expect(alignement(ph, { ...ref, landmarks: {} })).toEqual({ ok: false, raison: "reference" });
    expect(transformAjustement({ rot: 0, scale: 0, dx: 0, dy: 0 }, 100, 100)).toEqual({ a: 1, b: 0, tx: 0, ty: 0 });
  });
  it("photo de droite par défaut et écart en jours", () => {
    expect(photoDroite([ref, ph, { ...ph, id: "pending-1", status: "pending", date: "2026-12-01" }], "ref-0001", "")?.id).toBe("ph-00001");
    expect(ecartJours("2026-10-01", "2026-10-03")).toBe("+2 jours");
    expect(ecartJours("2026-10-03", "2026-10-02")).toBe("−1 jour");
    expect(ecartJours("2026-10-03", "2026-10-03")).toBe("même jour");
  });
});
