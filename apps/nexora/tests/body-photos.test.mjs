/* Photos corporelles — avant / après (#616).
   1. Bloc pur NEXORA:BODY-PHOTOS, extrait du bundle RÉELLEMENT construit :
      similarité (Umeyama/Procrustes 2D), ajustements, conversions, dates, EXIF.
   2. Routes : la VRAIE logique (_shared/body-photos.ts) exécutée avec une
      session, des métadonnées et un stockage d'octets factices — refus sans propriétaire,
      méthodes interdites, validation, idempotence, aucune URL de stockage.
   3. Raccordements du widget dans le bundle (catalogue, taille, rendu,
      en-tête, fiche) et de la route. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// --- 1. Bloc pur -------------------------------------------------------------

const html = await read("../.build/index.html");
function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  assert.equal(html.indexOf(start, from + 1), -1, `bloc ${name} en double`);
  return html.slice(from + start.length, to);
}
const B = vm.runInThisContext(`(function () {\n${slice("BODY-PHOTOS")}\n;return {
  BODY_PHOTO_LANDMARKS, BODY_PHOTO_IDENTITY, BODY_PHOTO_STEPS, bodyPhotoApply, bodyPhotoCompose, bodyPhotoInvert, bodyPhotoDeterminant,
  bodyPhotoParams, bodyPhotoFit, bodyPhotoResidual, bodyPhotoToPixels, bodyPhotoToUnit, bodyPhotoPairs, bodyPhotoAdjustTransform,
  bodyPhotoNudge, bodyPhotoAlignment, bodyPhotoCssMatrix, bodyPhotoDefaultDate, bodyPhotoDaysBetween, bodyPhotoDeltaLabel,
  bodyPhotoSorted, bodyPhotoSpec, bodyPhotoRightPhoto, bodyPhotoFitSize, bodyPhotoExifInfo, bodyPhotoIsNeutral, bodyPhotoFormatDate,
};\n})`)();

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} ≠ ${b} (± ${tol})`);
const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
const similarity = (scale, deg, tx, ty) => ({ a: scale * Math.cos((deg * Math.PI) / 180), b: scale * Math.sin((deg * Math.PI) / 180), tx, ty });

// Référence : 1000 × 1500 px ; repères en pixels.
const REF_PX = { leftEye: { x: 430, y: 310 }, rightEye: { x: 575, y: 305 }, navel: { x: 505, y: 905 } };
const unit = (px, w, h) => Object.fromEntries(Object.entries(px).map(([k, p]) => [k, p ? { x: p.x / w, y: p.y / h } : null]));
const reference = { id: "ref-00000001", width: 1000, height: 1500, date: "2026-01-10", landmarks: unit(REF_PX, 1000, 1500), adjust: {} };
// Photo dont on CONNAÎT la transformation vers la référence : ses repères
// sont ceux de la référence passés par l'inverse de cette transformation.
function photoFrom(t, id = "photo-0000001", w = 1200, h = 1800, keys = ["leftEye", "rightEye", "navel"]) {
  const inv = B.bodyPhotoInvert(t);
  const px = Object.fromEntries(B.BODY_PHOTO_LANDMARKS.map(({ key }) => [key, keys.includes(key) ? B.bodyPhotoApply(inv, REF_PX[key]) : null]));
  return { id, width: w, height: h, date: "2026-03-01", landmarks: unit(px, w, h), adjust: {} };
}

test("repères : trois, dans l'ordre œil gauche, œil droit, nombril", () => {
  assert.deepEqual(B.BODY_PHOTO_LANDMARKS.map((l) => l.key), ["leftEye", "rightEye", "navel"]);
  assert.deepEqual(B.BODY_PHOTO_STEPS, { move: 1, rot: 0.1, scale: 0.1 });
});

test("une transformation connue est retrouvée (tolérance < 0,5 px)", () => {
  const truth = similarity(0.83, 6.5, 41.2, -27.9);
  const photo = photoFrom(truth);
  const al = B.bodyPhotoAlignment(photo, reference);
  assert.equal(al.ok, true);
  const p = B.bodyPhotoParams(al.transform);
  close(p.scale, 0.83, 1e-9, "échelle");
  close(p.rotation, 6.5, 1e-7, "rotation");
  close(p.tx, 41.2, 1e-6, "tx");
  close(p.ty, -27.9, 1e-6, "ty");
  for (const { key } of B.BODY_PHOTO_LANDMARKS) {
    const mapped = B.bodyPhotoApply(al.transform, B.bodyPhotoToPixels(photo.landmarks[key], photo.width, photo.height));
    assert.ok(dist(mapped, REF_PX[key]) < 0.5, `${key} superposé à la référence`);
  }
  assert.ok(al.residual < 1e-6);
  // N'importe quel point de la photo, pas seulement les repères.
  const any = { x: 123, y: 1456 };
  assert.ok(dist(B.bodyPhotoApply(al.transform, any), B.bodyPhotoApply(truth, any)) < 0.5);
});

test("avec deux points (les yeux), la transformation est exacte", () => {
  const truth = similarity(1.27, -12, -80, 64);
  const photo = photoFrom(truth, "photo-0000002", 900, 1200, ["leftEye", "rightEye"]);
  assert.equal(photo.landmarks.navel, null);
  const al = B.bodyPhotoAlignment(photo, reference);
  assert.equal(al.ok, true);
  assert.deepEqual(al.keys, ["leftEye", "rightEye"]);
  for (const k of ["a", "b", "tx", "ty"]) close(al.transform[k], truth[k], 1e-9, k);
  assert.ok(al.residual < 1e-9, "résidu nul à deux points");
  // Directement sur la fonction d'estimation.
  const src = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
  const dst = [{ x: 5, y: 5 }, { x: 5, y: 25 }];
  const t = B.bodyPhotoFit(src, dst);
  assert.ok(dist(B.bodyPhotoApply(t, src[0]), dst[0]) < 1e-12 && dist(B.bodyPhotoApply(t, src[1]), dst[1]) < 1e-12);
  close(B.bodyPhotoParams(t).rotation, 90, 1e-9, "quart de tour");
  close(B.bodyPhotoParams(t).scale, 2, 1e-12, "échelle 2");
});

test("trois points bruités : le résultat minimise l'erreur résiduelle", () => {
  const truth = similarity(0.95, 3, 12, -8);
  const photo = photoFrom(truth, "photo-0000003");
  // Bruit déterministe de quelques pixels sur les repères de la photo.
  const noise = { leftEye: [2.1, -1.4], rightEye: [-1.7, 2.6], navel: [3.2, 1.1] };
  for (const [k, [nx, ny]] of Object.entries(noise)) {
    photo.landmarks[k] = { x: photo.landmarks[k].x + nx / photo.width, y: photo.landmarks[k].y + ny / photo.height };
  }
  const { src, dst } = B.bodyPhotoPairs(photo, reference);
  const best = B.bodyPhotoFit(src, dst);
  const r = B.bodyPhotoResidual(best, src, dst);
  assert.ok(r > 0.1 && r < 5, `résidu plausible (${r})`);
  // Aucune similarité voisine (chaque paramètre déplacé) ne fait mieux.
  const deltas = [1e-3, -1e-3, 0.05, -0.05];
  for (const k of ["a", "b"]) for (const d of deltas.slice(0, 2)) assert.ok(B.bodyPhotoResidual({ ...best, [k]: best[k] + d }, src, dst) >= r - 1e-9, `${k} ${d}`);
  for (const k of ["tx", "ty"]) for (const d of deltas) assert.ok(B.bodyPhotoResidual({ ...best, [k]: best[k] + d }, src, dst) >= r - 1e-9, `${k} ${d}`);
  // Ni la vraie transformation, ni l'ajustement exact sur les deux yeux seuls.
  assert.ok(B.bodyPhotoResidual(truth, src, dst) >= r);
  assert.ok(B.bodyPhotoResidual(B.bodyPhotoFit(src.slice(0, 2), dst.slice(0, 2)), src, dst) >= r);
  // Et le calcul complet rend ce même minimum.
  close(B.bodyPhotoAlignment(photo, reference).residual, r, 1e-12, "résidu de l'alignement");
});

test("aucun reflet : déterminant toujours positif, même face à des points en miroir", () => {
  const src = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 40, y: 300 }];
  const mirrored = src.map((p) => ({ x: -p.x + 500, y: p.y }));
  const t = B.bodyPhotoFit(src, mirrored);
  assert.ok(B.bodyPhotoDeterminant(t) > 0, "déterminant > 0");
  // Matrice 2×2 effective [[a, −b], [b, a]] : déterminant = a·a − (−b)·b.
  assert.ok(t.a * t.a + t.b * t.b > 0);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1000;
  for (let i = 0; i < 200; i++) {
    const s = [0, 1, 2].map(() => ({ x: rnd(), y: rnd() }));
    const d = [0, 1, 2].map(() => ({ x: rnd(), y: rnd() }));
    const fit = B.bodyPhotoFit(s, d);
    if (fit) assert.ok(B.bodyPhotoDeterminant(fit) > 0);
  }
  assert.equal(B.bodyPhotoFit([{ x: 1, y: 1 }], [{ x: 2, y: 2 }]), null, "un seul point");
  assert.equal(B.bodyPhotoFit([{ x: 1, y: 1 }, { x: 1, y: 1 }], [{ x: 0, y: 0 }, { x: 5, y: 5 }]), null, "points confondus");
});

test("composition, inverse et ajustements manuels", () => {
  const t1 = similarity(1.1, 20, 5, -3), t2 = similarity(0.7, -45, 100, 40);
  const p = { x: 37, y: -12 };
  assert.ok(dist(B.bodyPhotoApply(B.bodyPhotoCompose(t2, t1), p), B.bodyPhotoApply(t2, B.bodyPhotoApply(t1, p))) < 1e-9);
  assert.ok(dist(B.bodyPhotoApply(B.bodyPhotoCompose(B.bodyPhotoInvert(t1), t1), p), p) < 1e-9);

  // Ajustement neutre = identité.
  const id = B.bodyPhotoAdjustTransform({ dx: 0, dy: 0, rot: 0, scale: 0 }, 1000, 1500);
  for (const k of ["a", "b", "tx", "ty"]) close(id[k], B.BODY_PHOTO_IDENTITY[k], 1e-12, k);
  // Rotation et échelle autour du centre du cadre : le centre ne bouge que du décalage.
  const adj = B.bodyPhotoAdjustTransform({ dx: 3, dy: -2, rot: 90, scale: 10 }, 1000, 1500);
  assert.ok(dist(B.bodyPhotoApply(adj, { x: 500, y: 750 }), { x: 503, y: 748 }) < 1e-9);
  assert.ok(dist(B.bodyPhotoApply(adj, { x: 600, y: 750 }), { x: 503, y: 748 + 110 }) < 1e-9);

  // L'ajustement de CETTE référence se compose après le calcul automatique.
  const photo = photoFrom(similarity(0.9, 2, 10, 10), "photo-0000004");
  const auto = B.bodyPhotoAlignment(photo, reference).transform;
  photo.adjust = { [reference.id]: { dx: 2, dy: -1, rot: 0, scale: 0 } };
  const al = B.bodyPhotoAlignment(photo, reference);
  const q = { x: 321, y: 654 };
  const a0 = B.bodyPhotoApply(auto, q), a1 = B.bodyPhotoApply(al.transform, q);
  close(a1.x - a0.x, 2, 1e-9, "dx");
  close(a1.y - a0.y, -1, 1e-9, "dy");
  assert.ok(al.residual > al.autoResidual, "l'ajustement s'écarte du calcul automatique");
  photo.adjust = { [reference.id]: { dx: 0, dy: 0, rot: 1.5, scale: -2 } };
  const rot = B.bodyPhotoAlignment(photo, reference).transform;
  close(B.bodyPhotoParams(rot).rotation - B.bodyPhotoParams(auto).rotation, 1.5, 1e-9, "rotation ajoutée");
  close(B.bodyPhotoParams(rot).scale / B.bodyPhotoParams(auto).scale, 0.98, 1e-12, "échelle ajoutée");

  // Pas des boutons et du clavier.
  assert.deepEqual(B.bodyPhotoNudge(undefined, "dx", 1), { dx: 1, dy: 0, rot: 0, scale: 0 });
  assert.deepEqual(B.bodyPhotoNudge({ dx: 1, dy: 0, rot: 0.2, scale: 0 }, "rot", -1), { dx: 1, dy: 0, rot: 0.1, scale: 0 });
  assert.deepEqual(B.bodyPhotoNudge({}, "scale", 1), { dx: 0, dy: 0, rot: 0, scale: 0.1 });
  assert.equal(B.bodyPhotoIsNeutral({ dx: 0 }), true);
});

test("changer de référence réaligne les photos, sans replacer les repères", () => {
  const A = { ...reference };
  const Bp = photoFrom(similarity(1.2, -4, -30, 15), "photo-B000001", 1100, 1600);
  const C = photoFrom(similarity(0.75, 9, 60, -40), "photo-C000001", 1300, 1900);
  // Un ajustement fait pour la référence A ne s'applique pas sous la référence B.
  C.adjust = { [A.id]: { dx: 25, dy: 0, rot: 0, scale: 0 } };
  const underB = B.bodyPhotoAlignment(C, Bp);
  assert.equal(underB.ok, true);
  for (const { key } of B.BODY_PHOTO_LANDMARKS) {
    const mapped = B.bodyPhotoApply(underB.transform, B.bodyPhotoToPixels(C.landmarks[key], C.width, C.height));
    assert.ok(dist(mapped, B.bodyPhotoToPixels(Bp.landmarks[key], Bp.width, Bp.height)) < 0.5, `${key} sur la référence B`);
  }
  // C sous A (avec son ajustement), puis A sous B : cohérent par composition.
  const cToA = B.bodyPhotoAlignment({ ...C, adjust: {} }, A).transform;
  const aToB = B.bodyPhotoAlignment(A, Bp).transform;
  const q = { x: 400, y: 1000 };
  assert.ok(dist(B.bodyPhotoApply(B.bodyPhotoCompose(aToB, cToA), q), B.bodyPhotoApply(underB.transform, q)) < 0.5);
  // La référence face à elle-même : identité.
  assert.deepEqual(B.bodyPhotoAlignment(Bp, Bp).transform, B.BODY_PHOTO_IDENTITY);
});

test("photo sans repères : comparaison refusée, avec la photo en cause", () => {
  const bare = { id: "photo-bare0001", width: 800, height: 1200, landmarks: { leftEye: null, rightEye: null, navel: null } };
  assert.deepEqual(B.bodyPhotoAlignment(bare, reference), { ok: false, reason: "photo" });
  assert.deepEqual(B.bodyPhotoAlignment(photoFrom(similarity(1, 0, 0, 0)), { ...reference, landmarks: { leftEye: null, rightEye: null, navel: null } }), { ok: false, reason: "reference" });
  // Un œil et le nombril suffisent aussi (deux paires communes).
  const two = photoFrom(similarity(1, 3, 2, 2), "photo-two00001", 1200, 1800, ["leftEye", "navel"]);
  assert.equal(B.bodyPhotoAlignment(two, reference).ok, true);
});

test("conversions de coordonnées et matrice CSS", () => {
  assert.deepEqual(B.bodyPhotoToPixels({ x: 0.25, y: 0.5 }, 800, 600), { x: 200, y: 300 });
  assert.equal(B.bodyPhotoToPixels(null, 800, 600), null);
  assert.deepEqual(B.bodyPhotoToUnit({ x: 200, y: 900 }, 800, 600), { x: 0.25, y: 1 }, "borné à 0–1");
  assert.equal(B.bodyPhotoCssMatrix({ a: 2, b: 0.5, tx: 10, ty: -4 }, 0.5), "matrix(1, 0.25, -0.25, 1, 5, -2)");
  assert.deepEqual(B.bodyPhotoFitSize(4032, 3024), { width: 2400, height: 1800 });
  assert.deepEqual(B.bodyPhotoFitSize(800, 600), { width: 800, height: 600 }, "jamais agrandie");
});

test("date par défaut : EXIF, sinon date d'import", () => {
  assert.deepEqual(B.bodyPhotoDefaultDate("2026:03:14 08:12:00", "2026-10-02"), { date: "2026-03-14", source: "exif" });
  assert.deepEqual(B.bodyPhotoDefaultDate("0000:00:00 00:00:00", "2026-10-02"), { date: "2026-10-02", source: "import" });
  assert.deepEqual(B.bodyPhotoDefaultDate("2026:02:30 10:00:00", "2026-10-02"), { date: "2026-10-02", source: "import" }, "date impossible");
  assert.deepEqual(B.bodyPhotoDefaultDate("2027:01:01 10:00:00", "2026-10-02"), { date: "2026-10-02", source: "import" }, "date future");
  assert.deepEqual(B.bodyPhotoDefaultDate(null, "2026-10-02"), { date: "2026-10-02", source: "import" });
  assert.equal(B.bodyPhotoDaysBetween("2026-03-29", "2026-03-30"), 1, "passage à l'heure d'été");
  assert.equal(B.bodyPhotoDeltaLabel("2026-01-10", "2026-03-01"), "+50 jours");
  assert.equal(B.bodyPhotoDeltaLabel("2026-01-10", "2026-01-09"), "−1 jour");
  assert.equal(B.bodyPhotoDeltaLabel("2026-01-10", "2026-01-10"), "même jour");
  assert.equal(B.bodyPhotoFormatDate("2026-03-01"), "01/03/2026");
});

// JPEG minimal portant un segment EXIF (TIFF petit-boutiste) : orientation 6
// en IFD0, DateTimeOriginal dans le sous-IFD EXIF.
function exifJpeg(date, little = true) {
  const tiff = [];
  const u16 = (v) => (little ? [v & 255, v >> 8] : [v >> 8, v & 255]);
  const u32 = (v) => (little ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
  const dateBytes = [...Buffer.from(date + "\0", "latin1")];
  // En-tête (8) + IFD0 (2 + 2×12 + 4 = 30) -> sous-IFD à 38 (2 + 12 + 4 = 18) -> texte à 56.
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(2), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(6), 0, 0, ...u16(0x8769), ...u16(4), ...u32(1), ...u32(38), ...u32(0));
  tiff.push(...u16(1), ...u16(0x9003), ...u16(2), ...u32(dateBytes.length), ...u32(56), ...u32(0));
  tiff.push(...dateBytes);
  const app1 = [...Buffer.from("Exif\0\0", "latin1"), ...tiff];
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xd9]).buffer;
}

test("EXIF : date de prise de vue et orientation lues, entrée illisible tolérée", () => {
  assert.deepEqual({ ...B.bodyPhotoExifInfo(exifJpeg("2025:12:24 18:30:00")) }, { date: "2025:12:24 18:30:00", orientation: 6 });
  assert.deepEqual({ ...B.bodyPhotoExifInfo(exifJpeg("2024:06:01 07:00:00", false)) }, { date: "2024:06:01 07:00:00", orientation: 6 }, "grand-boutiste");
  assert.deepEqual({ ...B.bodyPhotoExifInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer) }, { date: null, orientation: 1 }, "PNG");
  assert.deepEqual({ ...B.bodyPhotoExifInfo(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 40]).buffer) }, { date: null, orientation: 1 }, "segment tronqué");
});

test("réglage du widget, tri de la galerie et photo de droite", () => {
  assert.deepEqual({ ...B.bodyPhotoSpec(undefined) }, { rightId: "", split: 50, showLandmarks: false });
  assert.deepEqual({ ...B.bodyPhotoSpec({ bodyPhotos: { rightId: "x", split: 140, showLandmarks: true } }) }, { rightId: "x", split: 100, showLandmarks: true });
  const photos = [
    { id: "c", date: "2026-05-01", createdAt: "1", status: "ready" },
    { id: "a", date: "2026-01-01", createdAt: "1", status: "ready" },
    { id: "b", date: "2026-03-01", createdAt: "1", status: "ready" },
    { id: "p", date: "2026-06-01", createdAt: "1", status: "pending" },
  ];
  assert.deepEqual(B.bodyPhotoSorted(photos).map((p) => p.id), ["a", "b", "c", "p"], "la plus récente à droite");
  assert.equal(B.bodyPhotoRightPhoto(photos, "a", "").id, "c", "par défaut la plus récente prête, hors référence");
  assert.equal(B.bodyPhotoRightPhoto(photos, "a", "b").id, "b");
  assert.equal(B.bodyPhotoRightPhoto(photos, "a", "a").id, "c", "jamais la référence");
  assert.equal(B.bodyPhotoRightPhoto([photos[1]], "a", ""), null);
});

// --- 2. Routes -----------------------------------------------------------------

const compiled = await transform(await read("../netlify/functions/_shared/body-photos.ts"), { loader: "ts", format: "esm" });
const R = await import("data:text/javascript;base64," + Buffer.from(compiled.code).toString("base64"));

const NOW = new Date("2026-10-02T10:00:00Z");
const OWNER = "Bearer jeton-proprietaire";
// JPEG minimal : SOI, SOF0 (200 × 100), EOI.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x64, 0x00, 0xc8, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xd9]);

function setup({ blobsFail = null } = {}) {
  const docs = new Map();
  const files = new Map();
  let reference = null;
  const calls = { owner: 0, uploads: 0, store: 0 };
  const store = {
    async list() { calls.store++; return [...docs.values()].map((d) => structuredClone(d)); },
    async get(id) { calls.store++; return docs.has(id) ? structuredClone(docs.get(id)) : null; },
    async createPending(meta) { calls.store++; if (docs.has(meta.id)) return { meta: structuredClone(docs.get(meta.id)), created: false }; docs.set(meta.id, structuredClone(meta)); return { meta, created: true }; },
    async update(id, patch) { calls.store++; docs.set(id, { ...docs.get(id), ...structuredClone(patch) }); },
    async remove(id) { calls.store++; docs.delete(id); if (reference === id) reference = null; },
    async getReference() { return reference; },
    async setReference(id) { reference = id; },
  };
  // Message d'erreur volontairement indiscret : il ne doit jamais ressortir.
  const fail = (op) => { if (blobsFail === op) throw new Error("9 FAILED_PRECONDITION: projects/nexora-cb20d/databases/(default)/documents/bodyPhotoBlobs/blob-secret"); };
  const blobs = {
    async find(photoId) { fail("find"); for (const [id, f] of files) if (f.photoId === photoId) return id; return null; },
    async put(photoId, bytes) { fail("put"); calls.uploads++; const id = `blob-secret-${files.size + 1}`; files.set(id, { photoId, bytes }); return id; },
    async get(blobId) { fail("get"); return files.get(blobId)?.bytes || null; },
    async remove(blobId) { fail("remove"); files.delete(blobId); },
  };
  const handler = R.createBodyPhotosHandler({
    requireOwner: async (req) => { calls.owner++; return req.headers.get("authorization") === OWNER ? null : R.json({ ok: false, error: "unauthorized" }, 401); },
    store,
    blobs,
    now: () => NOW,
  });
  const call = (method, path = "", { auth = OWNER, headers = {}, body } = {}) => handler(new Request(`https://nexora.test/api/nexora/body-photos${path}`, {
    method, body, headers: { ...(auth ? { authorization: auth } : {}), ...headers },
  }));
  const upload = (key = "cle-import-0001", extra = {}) => call("POST", "", {
    body: JPEG, headers: { "content-type": "image/jpeg", "x-idempotency-key": key, "x-photo-date": "2026-09-30", "x-date-source": "exif", ...extra },
  });
  return { call, upload, docs, files, calls, getReference: () => reference };
}

const LEAKS = /blobId|blob-secret|nexora-cb20d|projects\/|FAILED_PRECONDITION/;

test("routes : refus sans session du propriétaire, avant toute lecture", async () => {
  const s = setup();
  await s.upload();
  const id = "cle-import-0001";
  const attempts = [
    ["GET", ""], ["POST", ""], ["GET", `/${id}/image`], ["PATCH", `/${id}`], ["DELETE", `/${id}`], ["PUT", "/reference"],
  ];
  for (const auth of [null, "Bearer autre-compte", "Basic x"]) {
    for (const [method, path] of attempts) {
      const before = s.calls.store;
      const res = await s.call(method, path, { auth, body: method === "GET" ? undefined : "{}", headers: { "content-type": "application/json" } });
      assert.ok(res.status === 401 || res.status === 403, `${method} ${path} sans propriétaire : ${res.status}`);
      assert.equal(s.calls.store, before, `${method} ${path} : aucune lecture ni écriture avant le refus`);
      const text = await res.text();
      assert.doesNotMatch(text, /image|landmarks|2026-/, "aucune donnée dans le refus");
    }
  }
  assert.equal(s.files.size, 1, "le refus n'a rien supprimé");
});

test("routes : méthodes interdites et chemins inconnus", async () => {
  const s = setup();
  for (const [method, path, allow] of [["DELETE", "", "GET, POST"], ["PUT", "", "GET, POST"], ["GET", "/reference", "PUT"], ["POST", "/cle-import-0001", "PATCH, DELETE"], ["GET", "/cle-import-0001", "PATCH, DELETE"], ["DELETE", "/cle-import-0001/image", "GET"]]) {
    const res = await s.call(method, path);
    assert.equal(res.status, 405, `${method} ${path}`);
    assert.equal(res.headers.get("allow"), allow);
  }
  for (const path of ["/a", "/cle-import-0001/autre", "/../x", "/cle-import-0001/image/x"]) assert.equal((await s.call("GET", path)).status, 404, path);
  assert.equal(s.calls.owner, 0, "méthode ou chemin refusés sans consulter la session");
});

test("import : validation du type, de la clé, de la date, de la taille et du contenu", async () => {
  const s = setup();
  const cases = [
    [{ "content-type": "image/png" }, 415],
    [{ "content-type": "image/heic" }, 415],
    [{ "x-idempotency-key": "court" }, 400],
    [{ "x-idempotency-key": "../../etc" }, 400],
    [{ "x-photo-date": "2026-02-30" }, 400],
    [{ "x-photo-date": "30/09/2026" }, 400],
    [{ "x-photo-date": "2026-10-05" }, 400],
    [{ "x-photo-date": "1980-01-01" }, 400],
    [{ "x-date-source": "gps" }, 400],
  ];
  for (const [headers, status] of cases) assert.equal((await s.upload("cle-import-0002", headers)).status, status, JSON.stringify(headers));
  const big = await s.call("POST", "", { body: JPEG, headers: { "content-type": "image/jpeg", "content-length": String(R.BODY_PHOTO_MAX_BYTES + 1), "x-idempotency-key": "cle-import-0003", "x-photo-date": "2026-09-30" } });
  assert.equal(big.status, 413);
  const notJpeg = await s.call("POST", "", { body: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8]), headers: { "content-type": "image/jpeg", "x-idempotency-key": "cle-import-0004", "x-photo-date": "2026-09-30" } });
  assert.equal(notJpeg.status, 400);
  assert.equal((await notJpeg.json()).error, "invalid_image");
  assert.equal(s.docs.size, 0, "aucune entrée créée par un import refusé");
  assert.equal(s.files.size, 0);
});

test("import : idempotent, dimensions lues dans le JPEG, aucune URL de stockage renvoyée", async () => {
  const s = setup();
  const first = await s.upload();
  assert.equal(first.status, 201);
  const text = await first.text();
  assert.doesNotMatch(text, LEAKS);
  const { photo } = JSON.parse(text).data;
  assert.equal(photo.id, "cle-import-0001");
  assert.deepEqual([photo.width, photo.height, photo.date, photo.dateSource, photo.status], [200, 100, "2026-09-30", "exif", "ready"]);
  const again = await s.upload();
  assert.equal(again.status, 200);
  assert.equal((await again.json()).data.duplicate, true);
  assert.equal(s.calls.uploads, 1, "une seule écriture des octets pour la même clé");
  assert.equal(s.files.size, 1);
  // Reprise après coupure : métadonnée « en attente » et fichier déjà déposé.
  s.docs.set("cle-import-0009", { ...s.docs.get("cle-import-0001"), id: "cle-import-0009", status: "pending", blobId: null });
  s.files.set("blob-secret-99", { photoId: "cle-import-0009", bytes: JPEG });
  const resumed = await s.upload("cle-import-0009");
  assert.equal(resumed.status, 200);
  assert.equal(s.calls.uploads, 1, "le fichier existant est retrouvé, pas renvoyé");
  assert.equal(s.docs.get("cle-import-0009").blobId, "blob-secret-99");
});

test("import : échec du stockage -> 502 générique, aucune métadonnée orpheline", async () => {
  const s = setup({ blobsFail: "put" });
  const res = await s.upload();
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.doesNotMatch(text, LEAKS, "message brut du stockage jamais renvoyé");
  assert.equal(s.docs.size, 0);
});

test("liste et image : sans identifiant de stockage, en-têtes privés et sans cache", async () => {
  const s = setup();
  await s.upload("cle-import-0001");
  await s.upload("cle-import-0002", { "x-photo-date": "2026-01-15" });
  const list = await s.call("GET");
  assert.equal(list.headers.get("cache-control"), "private, no-store");
  const text = await list.text();
  assert.doesNotMatch(text, LEAKS);
  assert.deepEqual(JSON.parse(text).data.photos.map((p) => p.id), ["cle-import-0002", "cle-import-0001"], "triées par date");
  const img = await s.call("GET", "/cle-import-0001/image");
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal(img.headers.get("cache-control"), "private, no-store");
  assert.equal(img.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(new Uint8Array(await img.arrayBuffer()), JPEG);
  assert.equal((await s.call("GET", "/cle-import-0404/image")).status, 404);
});

test("modification : date, repères et ajustements validés", async () => {
  const s = setup();
  await s.upload();
  const patch = (body) => s.call("PATCH", "/cle-import-0001", { body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  assert.equal((await patch({ date: "2026-13-01" })).status, 400);
  assert.equal((await patch({ blobId: "x" })).status, 400, "champ inconnu refusé");
  assert.equal((await patch({ landmarks: { leftEye: { x: 1.2, y: 0.5 } } })).status, 400);
  assert.equal((await patch({ landmarks: { forehead: { x: 0.2, y: 0.5 } } })).status, 400);
  assert.equal((await patch({ adjust: { referenceId: "cle-import-0002", value: { dx: 1, rot: 90 } } })).status, 400, "rotation hors bornes");
  assert.equal((await patch({})).status, 400);
  const ok = await patch({ date: "2026-08-01", landmarks: { leftEye: { x: 0.4, y: 0.2 }, rightEye: { x: 0.6, y: 0.2 }, navel: null } });
  assert.equal(ok.status, 200);
  const { photo } = (await ok.json()).data;
  assert.equal(photo.dateSource, "manual");
  assert.deepEqual(photo.landmarks, { leftEye: { x: 0.4, y: 0.2 }, rightEye: { x: 0.6, y: 0.2 }, navel: null });
  await patch({ adjust: { referenceId: "cle-import-0002", value: { dx: 2, dy: -1, rot: 0.3, scale: 0.1 } } });
  assert.deepEqual(s.docs.get("cle-import-0001").adjust, { "cle-import-0002": { dx: 2, dy: -1, rot: 0.3, scale: 0.1 } });
  await patch({ adjust: { referenceId: "cle-import-0002", value: null } });
  assert.deepEqual(s.docs.get("cle-import-0001").adjust, {}, "remise à zéro");
  assert.equal((await s.call("PATCH", "/cle-import-0404", { body: JSON.stringify({ date: "2026-08-01" }) })).status, 404);
});

test("référence unique et suppression sans orphelin", async () => {
  const s = setup();
  await s.upload("cle-import-0001");
  const put = (id) => s.call("PUT", "/reference", { body: JSON.stringify({ id }), headers: { "content-type": "application/json" } });
  assert.equal((await put("cle-import-0404")).status, 404);
  assert.equal((await put("cle-import-0001")).status, 200);
  assert.equal(s.getReference(), "cle-import-0001");

  // Stockage des octets en panne : rien n'est effacé, ni octets ni métadonnée.
  const broken = setup({ blobsFail: "remove" });
  await broken.upload();
  const failed = await broken.call("DELETE", "/cle-import-0001");
  assert.equal(failed.status, 502);
  assert.doesNotMatch(await failed.text(), LEAKS);
  assert.equal(broken.docs.size, 1);
  assert.equal(broken.files.size, 1);

  const res = await s.call("DELETE", "/cle-import-0001");
  assert.equal(res.status, 200);
  assert.equal(s.docs.size, 0, "métadonnée supprimée");
  assert.equal(s.files.size, 0, "octets supprimés");
  assert.equal(s.getReference(), null, "référence libérée");
  assert.equal((await s.call("DELETE", "/cle-import-0001")).status, 404);
  // Métadonnée restée après une coupure (fichier déjà absent) : supprimable.
  s.docs.set("cle-import-0005", { id: "cle-import-0005", status: "ready", blobId: "blob-disparu", date: "2026-01-01", createdAt: "", landmarks: {}, adjust: {} });
  assert.equal((await s.call("DELETE", "/cle-import-0005")).status, 200);
  assert.equal(s.docs.size, 0);
});

// --- 3. Raccordements ------------------------------------------------------------

test("bundle : widget au catalogue, taille, rendu, en-tête et fiche", () => {
  assert.match(html, /\{ key: "bodyPhotos", label: "Photos corporelles — avant \/ après", icon: Camera, group: "Santé & sport" \}/);
  assert.match(html, /if \(type === "bodyPhotos"\) return \{ w: 8, h: 10 \};/);
  assert.match(html, /hasHeaderToolbar=\{[^}]*w\.type === "bodyPhotos"/);
  assert.match(html, /\{w\.type === "bodyPhotos" && \(\s*<WidgetBodyPhotos widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\} onUpdateWidget=\{\(patch\) => updateWidget\(w\.id, patch\)\} \/>/);
  assert.match(html, /if \(type === "bodyPhotos"\) data\.bodyPhotos = \{ \.\.\.bodyPhotoConfig \};/);
  assert.match(html, /\{type === "bodyPhotos" && \(/);
  assert.match(html, /function WidgetBodyPhotos\(\{ widget, externalToolbarSlot, onUpdateWidget \}\)/);
  assert.match(html, /role="slider"[^>]*aria-valuenow=/);
  assert.match(html, /Aucune photo : importe ta première photo/);
  // Le navigateur ne parle qu'à la route Nexora, jamais à un stockage Google.
  const ui = html.slice(html.indexOf("// --- Photos corporelles"), html.indexOf("function WidgetBodyPhotos"));
  assert.doesNotMatch(ui, /googleapis|drive\.google|googleusercontent/);
  assert.match(ui, /fetch\(`\/api\/nexora\/body-photos/);
});

test("route : requireOwner, Firestore dédié, chemins", async () => {
  const source = await read("../netlify/functions/body-photos.ts");
  assert.match(source, /requireOwner,/);
  assert.match(source, /blobs: firestoreBodyPhotoBlobs\(\)/);
  assert.match(source, /path: \["\/api\/nexora\/body-photos", "\/api\/nexora\/body-photos\/\*"\]/);
  const storeSource = await read("../netlify/functions/_shared/body-photos-store.ts");
  assert.doesNotMatch(storeSource, /googleapis|getStorage|getSignedUrl|makePublic|NEXORA_DRIVE_ROOT_FOLDER_ID/, "aucun lien public, aucun autre stockage");
  assert.match(storeSource, /collection\(PHOTOS\)/);
  const code = storeSource.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /kv_store/, "hors du stockage synchronisé de l'application");
});

// --- 4. Stockage Firestore réel, sur un faux Firestore en mémoire -------------

import { build } from "esbuild";

// Faux Firestore : juste ce que _shared/body-photos-store.ts utilise.
function memoryFirestore() {
  const docs = new Map();
  let commits = 0;
  const snap = (path) => ({ id: path.split("/").pop(), exists: docs.has(path), data: () => docs.get(path) });
  const docRef = (path) => ({
    path, id: path.split("/").pop(),
    get: async () => snap(path),
    set: async (v, o) => { docs.set(path, o?.merge ? { ...(docs.get(path) || {}), ...v } : v); },
    update: async (v) => { docs.set(path, { ...docs.get(path), ...v }); },
    collection: (name) => colRef(`${path}/${name}`),
  });
  const colRef = (path) => ({
    doc: (id) => docRef(`${path}/${id}`),
    get: async () => ({ docs: [...docs.keys()].filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")).map(snap) }),
    listDocuments: async () => [...docs.keys()].filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")).map(docRef),
  });
  const db = {
    docs, get commits() { return commits; },
    collection: (name) => colRef(name),
    getAll: async (...refs) => refs.map((r) => snap(r.path)),
    batch: () => {
      const ops = [];
      return {
        set: (r, v) => ops.push(() => docs.set(r.path, v)),
        delete: (r) => ops.push(() => docs.delete(r.path)),
        commit: async () => { commits++; ops.forEach((op) => op()); },
      };
    },
    runTransaction: async (fn) => fn({
      get: async (r) => snap(r.path),
      create: (r, v) => docs.set(r.path, v),
      set: (r, v, o) => docs.set(r.path, o?.merge ? { ...(docs.get(r.path) || {}), ...v } : v),
      delete: (r) => docs.delete(r.path),
    }),
  };
  return db;
}

const storeBundle = await build({
  entryPoints: [new URL("../netlify/functions/_shared/body-photos-store.ts", import.meta.url).pathname],
  bundle: true, write: false, format: "esm", platform: "node", logLevel: "silent",
  plugins: [{
    name: "faux-firestore",
    setup(b) {
      b.onResolve({ filter: /^\.\/nexora\.js$/ }, () => ({ path: "faux-nexora", namespace: "faux" }));
      b.onLoad({ filter: /.*/, namespace: "faux" }, () => ({ contents: "export const getDb = () => globalThis.__fauxFirestore;", loader: "js" }));
    },
  }],
});
const S = await import("data:text/javascript;base64," + Buffer.from(storeBundle.outputFiles[0].text).toString("base64"));

test("stockage Firestore : découpage en morceaux < 1 Mio, relecture identique, suppression complète", async () => {
  const db = (globalThis.__fauxFirestore = memoryFirestore());
  const blobs = S.firestoreBodyPhotoBlobs();
  assert.equal(S.BODY_PHOTO_CHUNK_BYTES, 900_000);
  const big = new Uint8Array(R.BODY_PHOTO_MAX_BYTES).map((_, i) => (i * 31 + 7) % 256);
  assert.equal(await blobs.find("cle-import-0001"), null);
  assert.equal(await blobs.put("cle-import-0001", big), "cle-import-0001");
  assert.equal(db.commits, 1, "morceaux et manifeste en un seul lot atomique");
  const chunks = [...db.docs.keys()].filter((k) => k.startsWith("bodyPhotoBlobs/cle-import-0001/chunks/"));
  assert.equal(chunks.length, 6, "5 Mo -> 6 morceaux");
  for (const k of chunks) assert.ok(db.docs.get(k).data.length <= 900_000, "chaque document sous 1 Mio");
  assert.deepEqual(db.docs.get("bodyPhotoBlobs/cle-import-0001"), { ...db.docs.get("bodyPhotoBlobs/cle-import-0001"), chunks: 6, bytes: big.length });
  assert.equal(await blobs.find("cle-import-0001"), "cle-import-0001", "reprise : octets retrouvés");
  assert.deepEqual(await blobs.get("cle-import-0001"), big, "relecture octet pour octet");
  const small = new Uint8Array([1, 2, 3]);
  await blobs.put("cle-import-0002", small);
  assert.deepEqual(await blobs.get("cle-import-0002"), small);
  await blobs.remove("cle-import-0001");
  assert.equal([...db.docs.keys()].filter((k) => k.startsWith("bodyPhotoBlobs/cle-import-0001")).length, 0, "aucun morceau orphelin");
  assert.equal(await blobs.get("cle-import-0001"), null);
  await blobs.remove("cle-import-0001"); // rejouable
  // Morceau resté sans manifeste (écriture interrompue) : supprimé aussi.
  db.docs.set("bodyPhotoBlobs/cle-import-0003/chunks/0", { data: Buffer.from([9]) });
  assert.equal(await blobs.find("cle-import-0003"), null, "sans manifeste, rien n'est considéré comme écrit");
  await blobs.remove("cle-import-0003");
  assert.equal(db.docs.has("bodyPhotoBlobs/cle-import-0003/chunks/0"), false);
  assert.ok([...db.docs.keys()].every((k) => !k.startsWith("users/")), "rien sous users/{uid}/kv_store");
});

test("stockage Firestore + route : parcours complet import, image, suppression", async () => {
  const db = (globalThis.__fauxFirestore = memoryFirestore());
  const handler = R.createBodyPhotosHandler({
    requireOwner: async (req) => (req.headers.get("authorization") === OWNER ? null : R.json({ ok: false, error: "unauthorized" }, 401)),
    store: S.firestoreBodyPhotoStore(),
    blobs: S.firestoreBodyPhotoBlobs(),
    now: () => NOW,
  });
  const call = (method, path = "", init = {}) => handler(new Request(`https://nexora.test/api/nexora/body-photos${path}`, { method, ...init, headers: { authorization: OWNER, ...(init.headers || {}) } }));
  const up = await call("POST", "", { body: JPEG, headers: { "content-type": "image/jpeg", "x-idempotency-key": "cle-import-0001", "x-photo-date": "2026-09-30" } });
  assert.equal(up.status, 201);
  assert.equal(db.docs.get("bodyPhotos/cle-import-0001").status, "ready");
  assert.equal((await call("PUT", "/reference", { body: JSON.stringify({ id: "cle-import-0001" }) })).status, 200);
  const img = await call("GET", "/cle-import-0001/image");
  assert.deepEqual(new Uint8Array(await img.arrayBuffer()), JPEG);
  const list = await (await call("GET")).text();
  assert.doesNotMatch(list, /blobId/);
  assert.equal(JSON.parse(list).data.referenceId, "cle-import-0001");
  assert.equal((await call("DELETE", "/cle-import-0001")).status, 200);
  assert.deepEqual([...db.docs.keys()].filter((k) => !k.startsWith("bodyPhotoSettings")), [], "ni métadonnée ni octet restant");
  assert.equal(db.docs.get("bodyPhotoSettings/main").referenceId, null);
});
