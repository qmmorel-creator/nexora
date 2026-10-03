/* eslint-disable */
// @ts-nocheck
// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (retour du 03/10/2026).
// Comparaison des photos corporelles de Nexora (dernier commit du dossier source : 9c48970), reprise telle quelle.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useBodyPhotoUrl } from "./photos-adaptateur";

// — index.html.part-003, ligne 42274
// === NEXORA:BODY-PHOTOS:START ===
// Repères, dans l'ordre de pose. Convention : gauche et droite SUR L'IMAGE
// (pas l'œil anatomique), pour qu'un selfie miroir et une photo prise par un
// tiers se pointent de la même façon.
const BODY_PHOTO_LANDMARKS = [
  { key: "leftEye", label: "Œil gauche", hint: "Clique sur l’œil situé à gauche de l’image." },
  { key: "rightEye", label: "Œil droit", hint: "Clique sur l’œil situé à droite de l’image." },
  { key: "navel", label: "Nombril", hint: "Clique sur le nombril." },
];
const BODY_PHOTO_MAX_SIDE = 2400;
const BODY_PHOTO_QUALITY = 0.9;
// Pas des ajustements fins : 1 px (du cadre de la référence), 0,1°, 0,1 %.
const BODY_PHOTO_STEPS = { move: 1, rot: 0.1, scale: 0.1 };

// Similarité 2D sans déformation, notée { a, b, tx, ty } :
//   x' = a·x − b·y + tx ;  y' = b·x + a·y + ty   (a = s·cos θ, b = s·sin θ).
// Sa matrice linéaire [[a, −b], [b, a]] a pour déterminant a² + b² > 0 : une
// similarité ainsi écrite ne peut PAS produire de reflet.
const BODY_PHOTO_IDENTITY = { a: 1, b: 0, tx: 0, ty: 0 };

function bodyPhotoApply(t, p) {
  return { x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty };
}

// t2 ∘ t1 : applique t1 puis t2.
function bodyPhotoCompose(t2, t1) {
  return {
    a: t2.a * t1.a - t2.b * t1.b,
    b: t2.a * t1.b + t2.b * t1.a,
    tx: t2.a * t1.tx - t2.b * t1.ty + t2.tx,
    ty: t2.b * t1.tx + t2.a * t1.ty + t2.ty,
  };
}

function bodyPhotoInvert(t) {
  const s2 = t.a * t.a + t.b * t.b;
  const a = t.a / s2, b = -t.b / s2;
  return { a, b, tx: -(a * t.tx - b * t.ty), ty: -(b * t.tx + a * t.ty) };
}

function bodyPhotoDeterminant(t) {
  return t.a * t.a + t.b * t.b;
}

// Échelle, rotation (degrés) et translation lisibles d'une similarité.
function bodyPhotoParams(t) {
  return { scale: Math.hypot(t.a, t.b), rotation: (Math.atan2(t.b, t.a) * 180) / Math.PI, tx: t.tx, ty: t.ty };
}

// Estimation au sens des moindres carrés (Umeyama / Procrustes en 2D) de la
// similarité qui envoie src[i] sur dst[i]. En nombres complexes z = src −
// moyenne, w = dst − moyenne : a + i·b = Σ conj(z)·w / Σ |z|². Exacte avec
// deux points distincts ; avec trois, minimise la somme des carrés des
// écarts. Rotation propre par construction (jamais de reflet). null si moins
// de deux paires ou points confondus.
function bodyPhotoFit(src, dst) {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;
  let mpx = 0, mpy = 0, mqx = 0, mqy = 0;
  for (let i = 0; i < n; i++) { mpx += src[i].x; mpy += src[i].y; mqx += dst[i].x; mqy += dst[i].y; }
  mpx /= n; mpy /= n; mqx /= n; mqy /= n;
  let sum = 0, re = 0, im = 0;
  for (let i = 0; i < n; i++) {
    const zx = src[i].x - mpx, zy = src[i].y - mpy;
    const wx = dst[i].x - mqx, wy = dst[i].y - mqy;
    sum += zx * zx + zy * zy;
    re += zx * wx + zy * wy;
    im += zx * wy - zy * wx;
  }
  if (!(sum > 1e-9)) return null;
  const a = re / sum, b = im / sum;
  if (!(a * a + b * b > 1e-12)) return null;
  return { a, b, tx: mqx - (a * mpx - b * mpy), ty: mqy - (b * mpx + a * mpy) };
}

// Écart quadratique moyen (px du cadre de la référence) entre les repères
// transformés de la photo et ceux de la référence.
function bodyPhotoResidual(t, src, dst) {
  if (!t || !src.length) return null;
  let s = 0;
  for (let i = 0; i < src.length; i++) {
    const p = bodyPhotoApply(t, src[i]);
    s += (p.x - dst[i].x) ** 2 + (p.y - dst[i].y) ** 2;
  }
  return Math.sqrt(s / src.length);
}

// Coordonnées normalisées 0–1 de l'image stockée <-> pixels de cette image.
function bodyPhotoToPixels(point, width, height) {
  return point ? { x: point.x * width, y: point.y * height } : null;
}
function bodyPhotoToUnit(point, width, height) {
  const clamp = (v) => Math.min(1, Math.max(0, v));
  return { x: clamp(point.x / width), y: clamp(point.y / height) };
}

// Paires de repères communs à la photo et à la référence, en pixels de chacune.
function bodyPhotoPairs(photo, reference) {
  const src = [], dst = [], keys = [];
  for (const { key } of BODY_PHOTO_LANDMARKS) {
    const p = bodyPhotoToPixels(photo?.landmarks?.[key], photo?.width, photo?.height);
    const q = bodyPhotoToPixels(reference?.landmarks?.[key], reference?.width, reference?.height);
    if (p && q) { src.push(p); dst.push(q); keys.push(key); }
  }
  return { src, dst, keys };
}

function bodyPhotoNormalizeAdjust(adj) {
  const n = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return { dx: n(adj?.dx), dy: n(adj?.dy), rot: n(adj?.rot), scale: n(adj?.scale) };
}
function bodyPhotoIsNeutral(adj) {
  const a = bodyPhotoNormalizeAdjust(adj);
  return !a.dx && !a.dy && !a.rot && !a.scale;
}

// Ajustement manuel (mode « Affiner »), exprimé dans le cadre de la
// référence : rotation et échelle autour du centre du cadre, puis décalage.
function bodyPhotoAdjustTransform(adj, width, height) {
  const { dx, dy, rot, scale } = bodyPhotoNormalizeAdjust(adj);
  const s = 1 + scale / 100;
  const r = (rot * Math.PI) / 180;
  const a = s * Math.cos(r), b = s * Math.sin(r);
  const cx = width / 2, cy = height / 2;
  return { a, b, tx: cx + dx - (a * cx - b * cy), ty: cy + dy - (b * cx + a * cy) };
}

// Un pas d'ajustement fin ; `axis` : dx, dy, rot ou scale.
function bodyPhotoNudge(adj, axis, direction) {
  const next = bodyPhotoNormalizeAdjust(adj);
  const step = axis === "rot" ? BODY_PHOTO_STEPS.rot : axis === "scale" ? BODY_PHOTO_STEPS.scale : BODY_PHOTO_STEPS.move;
  next[axis] = Math.round((next[axis] + direction * step) * 1000) / 1000;
  return next;
}

// Alignement d'une photo sur la référence (pixels de la photo -> pixels de
// la référence). Toujours recalculé depuis les repères des deux photos :
// changer de référence réaligne tout. Les ajustements manuels sont rangés par
// référence (`adjust[referenceId]`) et composés APRÈS le calcul automatique.
function bodyPhotoAlignment(photo, reference) {
  if (!photo || !reference) return { ok: false, reason: "missing" };
  if (photo.id === reference.id) return { ok: true, transform: BODY_PHOTO_IDENTITY, auto: BODY_PHOTO_IDENTITY, residual: 0, keys: [] };
  const { src, dst, keys } = bodyPhotoPairs(photo, reference);
  const auto = bodyPhotoFit(src, dst);
  if (!auto) {
    const lacks = (p) => !p?.landmarks?.leftEye || !p?.landmarks?.rightEye;
    return { ok: false, reason: lacks(reference) ? "reference" : "photo" };
  }
  const adj = photo.adjust?.[reference.id];
  const transform = adj && !bodyPhotoIsNeutral(adj) ? bodyPhotoCompose(bodyPhotoAdjustTransform(adj, reference.width, reference.height), auto) : auto;
  return { ok: true, transform, auto, residual: bodyPhotoResidual(transform, src, dst), autoResidual: bodyPhotoResidual(auto, src, dst), keys };
}

// CSS `matrix(a, b, c, d, e, f)` (x' = a·x + c·y + e) de la similarité, mise à
// l'échelle `k` de l'affichage (px affichés par px de la référence).
function bodyPhotoCssMatrix(t, k = 1) {
  const f = (v) => Number(v.toFixed(6));
  return `matrix(${f(k * t.a)}, ${f(k * t.b)}, ${f(-k * t.b)}, ${f(k * t.a)}, ${f(k * t.tx)}, ${f(k * t.ty)})`;
}

function bodyPhotoIsDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Date par défaut d'une photo : date de prise de vue EXIF
// (« AAAA:MM:JJ HH:MM:SS ») si elle est valide, sinon la date d'import.
function bodyPhotoDefaultDate(exifDate, importDate) {
  const m = typeof exifDate === "string" ? exifDate.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})/) : null;
  const iso = m ? `${m[1]}-${m[2]}-${m[3]}` : "";
  if (bodyPhotoIsDate(iso) && iso >= "1990-01-01" && iso <= importDate) return { date: iso, source: "exif" };
  return { date: importDate, source: "import" };
}

function bodyPhotoDaysBetween(from, to) {
  return Math.round((Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) / 86400000);
}

function bodyPhotoFormatDate(iso) {
  if (!bodyPhotoIsDate(iso)) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Écart en jours, signé : « +12 jours », « −3 jours », « même jour ».
function bodyPhotoDeltaLabel(from, to) {
  const n = bodyPhotoDaysBetween(from, to);
  if (!n) return "même jour";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)} jour${Math.abs(n) > 1 ? "s" : ""}`;
}

// Tri de la galerie : la plus ancienne à gauche, la plus récente à droite.
function bodyPhotoSorted(photos) {
  return [...(photos || [])].sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

// Réglage mémorisé dans le widget : photo de droite, position du curseur (%),
// repères visibles.
function bodyPhotoSpec(widget) {
  const s = widget?.bodyPhotos && typeof widget.bodyPhotos === "object" ? widget.bodyPhotos : {};
  const split = Number(s.split);
  const crops = {};
  if (s.crops && typeof s.crops === "object") {
    for (const [id, c] of Object.entries(s.crops)) { const n = bodyPhotoNormalizeCrop(c); if (n) crops[id] = n; }
  }
  return {
    rightId: typeof s.rightId === "string" ? s.rightId : "",
    split: Number.isFinite(split) ? Math.min(100, Math.max(0, split)) : 50,
    showLandmarks: s.showLandmarks === true,
    crops,
  };
}

// Rognage (#633) : UN rectangle commun, dans le cadre de la référence, en
// unités (0–1 de sa largeur et de sa hauteur). Les deux photos comparées et
// les repères sont rognés pareil : l'alignement est conservé. Rangé par
// référence (`crops[referenceId]`) : changer de référence change de cadre.
// Non destructif : les originaux ne sont jamais modifiés.
const BODY_PHOTO_CROP_MIN = 0.1;
const BODY_PHOTO_CROP_FULL = { x: 0, y: 0, w: 1, h: 1 };
// Rectangle valide, borné et arrondi, ou null (absent, abîmé, ou plein cadre).
function bodyPhotoNormalizeCrop(c) {
  if (!c || typeof c !== "object") return null;
  const v = [c.x, c.y, c.w, c.h];
  if (!v.every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const r = (n) => Math.round(n * 10000) / 10000;
  const w = Math.min(1, Math.max(BODY_PHOTO_CROP_MIN, c.w));
  const h = Math.min(1, Math.max(BODY_PHOTO_CROP_MIN, c.h));
  const x = Math.min(1 - w, Math.max(0, c.x));
  const y = Math.min(1 - h, Math.max(0, c.y));
  if (w >= 0.9999 && h >= 0.9999) return null;
  return { x: r(x), y: r(y), w: r(w), h: r(h) };
}
// Zone affichée, en pixels de la référence : origine, taille, proportion.
function bodyPhotoCropView(crop, width, height) {
  const c = bodyPhotoNormalizeCrop(crop) || BODY_PHOTO_CROP_FULL;
  return { x: c.x * width, y: c.y * height, w: c.w * width, h: c.h * height, ratio: (c.w * width) / (c.h * height) };
}
// Glisser le cadre (`move`) ou une poignée (n, s, e, w, ne, nw, se, sw) de
// (dx, dy) unités depuis le rectangle `start`. Le côté opposé reste fixe, la
// taille ne descend pas sous le minimum, le cadre ne sort jamais de l'image.
function bodyPhotoCropDrag(start, handle, dx, dy) {
  const s = bodyPhotoNormalizeCrop(start) || BODY_PHOTO_CROP_FULL;
  const min = BODY_PHOTO_CROP_MIN;
  let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
  if (handle === "move") {
    const nx = Math.min(1 - s.w, Math.max(0, s.x + dx));
    const ny = Math.min(1 - s.h, Math.max(0, s.y + dy));
    return { x: nx, y: ny, w: s.w, h: s.h };
  }
  if (handle.includes("w")) x0 = Math.min(x1 - min, Math.max(0, x0 + dx));
  if (handle.includes("e")) x1 = Math.max(x0 + min, Math.min(1, x1 + dx));
  if (handle.includes("n")) y0 = Math.min(y1 - min, Math.max(0, y0 + dy));
  if (handle.includes("s")) y1 = Math.max(y0 + min, Math.min(1, y1 + dy));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// Photo de droite effective : celle choisie si elle existe encore et n'est
// pas la référence, sinon la plus récente hors référence.
function bodyPhotoRightPhoto(photos, referenceId, rightId) {
  const ready = bodyPhotoSorted(photos).filter((p) => p.status === "ready" && p.id !== referenceId);
  return ready.find((p) => p.id === rightId) || ready[ready.length - 1] || null;
}

// Dimensions après réduction au côté long `max` (jamais agrandies).
function bodyPhotoFitSize(width, height, max = BODY_PHOTO_MAX_SIDE) {
  const k = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

// Lecture EXIF d'un JPEG (ArrayBuffer) : date de prise de vue
// (DateTimeOriginal, sinon DateTime) et orientation. Écrite pour Nexora,
// limitée à ces deux informations ; toute structure inattendue -> null.
function bodyPhotoExifInfo(buffer) {
  const out = { date: null, orientation: 1 };
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return out;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset);
      if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return out;
      const length = view.getUint16(offset + 2);
      if (marker === 0xffe1 && offset + 10 <= view.byteLength && view.getUint32(offset + 4) === 0x45786966) {
        const tiff = offset + 10;
        const little = view.getUint16(tiff) === 0x4949;
        const u16 = (p) => view.getUint16(p, little);
        const u32 = (p) => view.getUint32(p, little);
        const ascii = (p, n) => { let s = ""; for (let i = 0; i < n && p + i < view.byteLength; i++) { const c = view.getUint8(p + i); if (!c) break; s += String.fromCharCode(c); } return s; };
        const readIfd = (start) => {
          const tags = {};
          if (start + 2 > view.byteLength) return tags;
          const count = u16(start);
          for (let i = 0; i < count; i++) {
            const e = start + 2 + i * 12;
            if (e + 12 > view.byteLength) break;
            const tag = u16(e), type = u16(e + 2), n = u32(e + 4);
            if (type === 3) tags[tag] = u16(e + 8);
            else if (type === 4) tags[tag] = u32(e + 8);
            else if (type === 2) tags[tag] = ascii(n <= 4 ? e + 8 : tiff + u32(e + 8), n);
          }
          return tags;
        };
        const ifd0 = readIfd(tiff + u32(tiff + 4));
        if (ifd0[0x0112]) out.orientation = ifd0[0x0112];
        const exif = ifd0[0x8769] ? readIfd(tiff + ifd0[0x8769]) : {};
        out.date = exif[0x9003] || exif[0x9004] || ifd0[0x0132] || null;
        return out;
      }
      offset += 2 + length;
    }
  } catch { /* EXIF illisible : date d'import */ }
  return out;
}
// Taille d'en-tête lue pour l'EXIF et les dimensions : jamais le fichier
// entier en mémoire (une photo de téléphone pèse 3 à 20 Mo).
const BODY_PHOTO_HEAD_BYTES = 256 * 1024;

// Dimensions d'un JPEG lues dans son segment SOF (en-tête seulement) ; null
// si ce n'en est pas un ou si le segment n'est pas dans l'en-tête fourni.
function bodyPhotoJpegSize(buffer) {
  try {
    const v = new DataView(buffer);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
    let i = 2;
    while (i + 9 < v.byteLength) {
      if (v.getUint8(i) !== 0xff) return null;
      const marker = v.getUint8(i + 1);
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      const length = v.getUint16(i + 2);
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = v.getUint16(i + 5), width = v.getUint16(i + 7);
        return width > 0 && height > 0 ? { width, height } : null;
      }
      if (marker === 0xda || marker === 0xd9) return null;
      i += 2 + length;
    }
  } catch { /* en-tête illisible */ }
  return null;
}

// Dimensions affichées après orientation EXIF : 5 à 8 = quart de tour.
function bodyPhotoOrientedSize(width, height, orientation) {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

// Décodage réduit demandé au navigateur : seulement si l'image dépasse le
// côté long cible et que ses dimensions sont connues ; null sinon.
function bodyPhotoDecodePlan(size, orientation) {
  if (!size) return null;
  const oriented = bodyPhotoOrientedSize(size.width, size.height, orientation);
  if (Math.max(oriented.width, oriented.height) <= BODY_PHOTO_MAX_SIDE) return null;
  return bodyPhotoFitSize(oriented.width, oriented.height);
}
// === NEXORA:BODY-PHOTOS:END ===
// — index.html.part-003, ligne 42835
const BODY_PHOTO_CSS = `
.nx-bp{position:relative;display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;padding:8px;box-sizing:border-box;color:var(--life-text,#18263d);font-size:12px;background:var(--life-surface,#fff)}
.nx-bp:fullscreen{padding:16px}
.nx-bp-stage{position:relative;flex:1 1 auto;min-height:120px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.nx-bp-frame{position:relative;overflow:hidden;background:#0f1724;border-radius:9px;touch-action:none;user-select:none;-webkit-user-select:none}
.nx-bp-frame img{position:absolute;left:0;top:0;max-width:none;transform-origin:0 0;pointer-events:none;-webkit-user-drag:none}
.nx-bp-layer{position:absolute;inset:0;overflow:hidden}
.nx-bp-label{position:absolute;top:8px;padding:3px 8px;border-radius:6px;background:rgba(15,23,36,.72);color:#fff;font-size:11px;font-weight:600;pointer-events:none;white-space:nowrap}
.nx-bp-handle{position:absolute;top:0;bottom:0;width:0;margin-left:-1px;border-left:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,36,.35);pointer-events:none}
.nx-bp-knob{position:absolute;top:50%;left:-1px;box-sizing:border-box;width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;background:#fff;border:2px solid var(--life-blue,#245edb);box-shadow:0 2px 8px rgba(15,23,36,.35);display:flex;align-items:center;justify-content:center;color:var(--life-blue,#245edb);font-weight:700;font-size:13px;cursor:ew-resize;pointer-events:auto;touch-action:none}
.nx-bp-knob:focus-visible{outline:3px solid #9cc0ff;outline-offset:2px}
.nx-bp-overlay{position:absolute;inset:0;pointer-events:none}
.nx-bp-crop{position:absolute;box-sizing:border-box;border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,36,.6),0 0 0 9999px rgba(15,23,36,.55);cursor:move;touch-action:none}
.nx-bp-crop:focus-visible{outline:3px solid #9cc0ff;outline-offset:2px}
/* Poignées DANS le cadre : au bord de l'image, une poignée centrée sur le trait serait à moitié coupée et insaisissable. */
.nx-bp-crop-handle{position:absolute;width:16px;height:16px;box-sizing:border-box;background:#fff;border:2px solid var(--life-blue,#245edb);border-radius:3px;touch-action:none}
.nx-bp-crop-handle.nw{left:0;top:0;cursor:nwse-resize}.nx-bp-crop-handle.n{left:calc(50% - 8px);top:0;cursor:ns-resize}.nx-bp-crop-handle.ne{right:0;top:0;cursor:nesw-resize}.nx-bp-crop-handle.e{right:0;top:calc(50% - 8px);cursor:ew-resize}
.nx-bp-crop-handle.se{right:0;bottom:0;cursor:nwse-resize}.nx-bp-crop-handle.s{left:calc(50% - 8px);bottom:0;cursor:ns-resize}.nx-bp-crop-handle.sw{left:0;bottom:0;cursor:nesw-resize}.nx-bp-crop-handle.w{left:0;top:calc(50% - 8px);cursor:ew-resize}
.nx-bp-gallery{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;flex:0 0 auto}
.nx-bp-thumb{position:relative;flex:0 0 auto;width:92px;border:1px solid var(--life-border,#dce3ed);border-radius:9px;background:var(--life-soft,#f7f9fc);overflow:hidden}
.nx-bp-thumb.is-ref{border-color:#c48a00;box-shadow:0 0 0 1px #c48a00}
.nx-bp-thumb.is-right{border-color:var(--life-blue,#245edb);box-shadow:0 0 0 1px var(--life-blue,#245edb)}
.nx-bp-thumb-img{display:block;width:100%;height:96px;padding:0;border:0;background:#e6ebf2 center/cover no-repeat;cursor:pointer}
.nx-bp-thumb-date{display:flex;justify-content:space-between;align-items:center;gap:4px;padding:3px 5px 0;font-size:11px;font-variant-numeric:tabular-nums}
.nx-bp-thumb-actions{display:flex;flex-wrap:wrap;gap:2px;padding:3px 4px 4px}
.nx-bp-thumb-actions button{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 4px;border:1px solid var(--life-border,#dce3ed);border-radius:6px;background:#fff;color:var(--life-secondary,#53647b);cursor:pointer}
.nx-bp-thumb-actions button:hover{color:var(--life-blue,#245edb);border-color:var(--life-blue,#245edb)}
.nx-bp-thumb-actions button.danger:hover{color:#b42318;border-color:#b42318}
.nx-bp-badge{position:absolute;top:4px;left:4px;padding:1px 6px;border-radius:5px;background:#c48a00;color:#fff;font-size:10px;font-weight:700}
.nx-bp-badge.warn{background:#b42318}
.nx-bp-thumb input[type=date]{width:100%;height:24px;font:inherit;font-size:11px;border:1px solid var(--life-border,#dce3ed);border-radius:5px}
.nx-bp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;flex:1;text-align:center;color:var(--life-secondary,#53647b);border:1px dashed var(--life-border-strong,#b9c7d8);border-radius:12px;padding:16px}
.nx-bp-empty strong{color:var(--life-text,#18263d);font-size:13px}
.nx-bp-drop{position:absolute;inset:4px;z-index:5;display:flex;align-items:center;justify-content:center;border:2px dashed var(--life-blue,#245edb);border-radius:12px;background:rgba(234,240,255,.92);color:var(--life-blue,#245edb);font-weight:650;font-size:14px;pointer-events:none}
.nx-bp-uploads{display:flex;flex-direction:column;gap:3px;flex:0 0 auto}
.nx-bp-upload{display:flex;align-items:center;gap:8px}
.nx-bp-upload span:first-child{flex:0 1 180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-bp-upload progress{flex:1 1 auto;height:8px}
.nx-bp-upload .err{color:#b42318}
.nx-bp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;flex:0 0 auto}
.nx-bp-bar button,.nx-bp-bar select,.nx-bp-bar input{height:28px;padding:0 9px;font:inherit;border:1px solid var(--life-border,#dce3ed);border-radius:9px;background:#fff;color:var(--life-text,#18263d);cursor:pointer}
.nx-bp-bar button.primary{background:var(--life-blue,#245edb);border-color:var(--life-blue,#245edb);color:#fff;font-weight:600}
.nx-bp-bar button.active{background:var(--life-blue-soft,#eaf0ff);border-color:var(--life-blue,#245edb);color:var(--life-blue,#245edb)}
.nx-bp-bar .grow{flex:1 1 auto}
.nx-bp-hint{color:var(--life-secondary,#53647b)}
.nx-bp-hint strong{color:var(--life-text,#18263d)}
.nx-bp-point{position:absolute;width:28px;height:28px;margin:-14px 0 0 -14px;padding:0;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(15,23,36,.5);cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700}
.nx-bp-point:focus-visible{outline:3px solid #9cc0ff;outline-offset:2px}
.nx-bp-point.dragging{cursor:grabbing}
.nx-bp-loupe{position:absolute;top:8px;right:8px;width:132px;height:132px;border-radius:50%;border:3px solid #fff;box-shadow:0 4px 16px rgba(15,23,36,.45);background-color:#0f1724;background-repeat:no-repeat;pointer-events:none;z-index:3}
.nx-bp-loupe::after{content:"";position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border:1px solid #ff3b30;border-radius:50%}
.nx-bp-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0;max-width:100%;font-size:11px;color:#203246}
.nx-bp-tools button,.nx-bp-tools select{height:24px;padding:0 7px;font:inherit;border:1px solid #d8e1eb;border-radius:5px;background:#fff;color:#203246;cursor:pointer}
.nx-bp-tools button.active{background:#e7efff;border-color:#24569a;color:#24569a;font-weight:600}
.nx-bp-tools .count{color:#60717c;white-space:nowrap}
.lp-widget-head-toolbar:has(.nx-bp-tools){flex-wrap:wrap;overflow:visible;row-gap:5px}
@media (max-width:479px){.nx-bp-thumb{width:78px}.nx-bp-thumb-img{height:80px}}
`;
// — index.html.part-003, ligne 42895
const BODY_PHOTO_COLORS = { leftEye: "#2a78d6", rightEye: "#0f9d76", navel: "#eb6834" };
// — index.html.part-003, ligne 42898
function useBodyPhotoFrame(boxRef, ratio) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return undefined;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  if (!box.w || !box.h || !(ratio > 0)) return { w: 0, h: 0 };
  const w = Math.min(box.w, box.h * ratio);
  return { w: Math.floor(w), h: Math.floor(w / ratio) };
}
// — index.html.part-003, ligne 42918
function BodyPhotoMarks({ reference, photo, transform, width, height, view }) {
  // `view` : zone rognée (pixels de la référence) ; sans rognage, tout le cadre.
  const v = view || { x: 0, y: 0, w: reference.width };
  const k = width / v.w;
  const pt = (p, ph, t) => {
    const px = bodyPhotoToPixels(p, ph.width, ph.height);
    return px ? bodyPhotoApply(t, px) : null;
  };
  const refPts = Object.fromEntries(BODY_PHOTO_LANDMARKS.map(({ key }) => [key, pt(reference.landmarks?.[key], reference, BODY_PHOTO_IDENTITY)]));
  const phPts = photo && transform ? Object.fromEntries(BODY_PHOTO_LANDMARKS.map(({ key }) => [key, pt(photo.landmarks?.[key], photo, transform)])) : {};
  const s = (p) => ({ x: (p.x - v.x) * k, y: (p.y - v.y) * k });
  const L = refPts.leftEye && s(refPts.leftEye), R = refPts.rightEye && s(refPts.rightEye), N = refPts.navel && s(refPts.navel);
  return (
    <svg className="nx-bp-overlay" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {L && R && <line x1={0} x2={width} y1={(L.y + R.y) / 2} y2={(L.y + R.y) / 2} stroke="#fff" strokeOpacity=".7" strokeDasharray="6 4" />}
      {N && <line x1={N.x} x2={N.x} y1={0} y2={height} stroke="#fff" strokeOpacity=".7" strokeDasharray="6 4" />}
      {L && R && <line x1={L.x} y1={L.y} x2={R.x} y2={R.y} stroke="#fff" strokeOpacity=".9" />}
      {BODY_PHOTO_LANDMARKS.map(({ key }) => {
        const r = refPts[key] && s(refPts[key]);
        const p = phPts[key] && s(phPts[key]);
        return (
          <g key={key} data-landmark={key}>
            {r && <circle cx={r.x} cy={r.y} r={7} fill="none" stroke={BODY_PHOTO_COLORS[key]} strokeWidth={2.5} data-role="reference" />}
            {p && <path d={`M${p.x - 6} ${p.y}H${p.x + 6}M${p.x} ${p.y - 6}V${p.y + 6}`} stroke={BODY_PHOTO_COLORS[key]} strokeWidth={2.5} data-role="photo" />}
          </g>
        );
      })}
    </svg>
  );
}
// — index.html.part-003, ligne 42954
function BodyPhotoCompare({ reference, photo, alignment, split, onSplit, onSplitCommit, showLandmarks, crop }) {
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  // Rognage (#633) : le cadre prend la proportion de la zone gardée ; les deux
  // images et les repères reçoivent le même zoom et le même décalage.
  const view = bodyPhotoCropView(crop, reference.width, reference.height);
  const frame = useBodyPhotoFrame(boxRef, view.ratio);
  const refImg = useBodyPhotoUrl(reference.id);
  const phImg = useBodyPhotoUrl(photo.id);
  const drag = useRef(false);
  const k = frame.w / view.w;
  const shift = `translate(${-(view.x * k).toFixed(3)}px, ${-(view.y * k).toFixed(3)}px)`;
  const setFromEvent = (e) => {
    const rect = frameRef.current.getBoundingClientRect();
    onSplit(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
  };
  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    drag.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setFromEvent(e);
  };
  const onPointerMove = (e) => { if (drag.current) setFromEvent(e); };
  const onPointerUp = () => { if (drag.current) { drag.current = false; onSplitCommit(); } };
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 1;
    const moves = { ArrowLeft: split - step, ArrowDown: split - step, ArrowRight: split + step, ArrowUp: split + step, Home: 0, End: 100, PageDown: split - 10, PageUp: split + 10 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const v = Math.min(100, Math.max(0, Math.round(moves[e.key] * 10) / 10));
    onSplit(v);
    onSplitCommit(v);
  };
  const deltaLabel = `${bodyPhotoFormatDate(photo.date)} · ${bodyPhotoDeltaLabel(reference.date, photo.date)}`;
  return (
    <div className="nx-bp-stage" ref={boxRef}>
      {frame.w > 0 && (
        <div className="nx-bp-frame" ref={frameRef} data-testid="body-photo-frame" style={{ width: frame.w, height: frame.h }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {refImg.url && <img src={refImg.url} alt={`Référence du ${bodyPhotoFormatDate(reference.date)}`} data-role="reference" style={{ width: reference.width * k, height: reference.height * k, transform: shift }} />}
          <div className="nx-bp-layer" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
            {phImg.url && <img src={phImg.url} alt={`Photo du ${bodyPhotoFormatDate(photo.date)}, alignée sur la référence`} data-role="photo"
              style={{ width: photo.width, height: photo.height, transform: `${shift} ${bodyPhotoCssMatrix(alignment.transform, k)}` }} />}
          </div>
          {showLandmarks && <BodyPhotoMarks reference={reference} photo={photo} transform={alignment.transform} width={frame.w} height={frame.h} view={view} />}
          <span className="nx-bp-label" style={{ left: 8 }}>Référence · {bodyPhotoFormatDate(reference.date)}</span>
          <span className="nx-bp-label" style={{ right: 8 }}>{deltaLabel}</span>
          <div className="nx-bp-handle" style={{ left: `${split}%` }}>
            <div className="nx-bp-knob" role="slider" tabIndex={0} aria-label="Curseur avant / après"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(split)} aria-valuetext={`${Math.round(split)} % référence`}
              onKeyDown={onKeyDown}>⇔</div>
          </div>
        </div>
      )}
      {(refImg.error || phImg.error) && <div className="nx-bp-hint" role="alert">{refImg.error || phImg.error}</div>}
    </div>
  );
}
// — index.html.part-003, ligne 43198
const BODY_PHOTO_CROP_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
// — index.html.part-003, ligne 43199
function BodyPhotoCrop({ reference, photo, alignment, crop, onSave, onClose }) {
  const boxRef = useRef(null);
  const frame = useBodyPhotoFrame(boxRef, reference.width / reference.height);
  const refImg = useBodyPhotoUrl(reference.id);
  const phImg = useBodyPhotoUrl(photo.id);
  const [rect, setRect] = useState(() => bodyPhotoNormalizeCrop(crop) || { ...BODY_PHOTO_CROP_FULL });
  const drag = useRef(null);
  const k = frame.w / reference.width;
  const pct = (v) => `${(v * 100).toFixed(3)}%`;
  const onPointerDown = (handle) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { handle, start: rect, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d || !frame.w) return;
    setRect(bodyPhotoCropDrag(d.start, d.handle, (e.clientX - d.x) / frame.w, (e.clientY - d.y) / frame.h));
  };
  const onPointerUp = () => { drag.current = null; };
  const onKeyDown = (e) => {
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    const step = e.shiftKey ? 0.05 : 0.01;
    setRect((r) => (e.altKey ? bodyPhotoCropDrag(r, "se", d[0] * step, d[1] * step) : bodyPhotoCropDrag(r, "move", d[0] * step, d[1] * step)));
  };
  const full = !bodyPhotoNormalizeCrop(rect);
  const sizeLabel = `${Math.round(rect.w * reference.width)} × ${Math.round(rect.h * reference.height)} px`;
  return (
    <>
      <div className="nx-bp-bar">
        <span className="nx-bp-hint grow">Glisse le cadre ou ses poignées. Le rognage s’applique aux deux photos de la comparaison ; les originaux ne sont pas modifiés.</span>
        <span className="nx-bp-hint">{full ? "Image entière" : sizeLabel}</span>
      </div>
      <div className="nx-bp-stage" ref={boxRef}>
        {frame.w > 0 && (
          <div className="nx-bp-frame" data-testid="body-photo-crop" style={{ width: frame.w, height: frame.h }}
            onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {refImg.url && <img src={refImg.url} alt="" style={{ width: frame.w, height: frame.h }} />}
            {phImg.url && alignment?.ok && <img src={phImg.url} alt="" data-role="photo"
              style={{ width: photo.width, height: photo.height, transform: bodyPhotoCssMatrix(alignment.transform, k), opacity: 0.5 }} />}
            <div className="nx-bp-crop" role="group" tabIndex={0}
              aria-label="Cadre de rognage : flèches pour déplacer, Alt + flèches pour redimensionner, Maj pour aller plus vite"
              style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
              onPointerDown={onPointerDown("move")} onKeyDown={onKeyDown}>
              {BODY_PHOTO_CROP_HANDLES.map((h) => (
                <span key={h} className={`nx-bp-crop-handle ${h}`} data-handle={h} onPointerDown={onPointerDown(h)} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="nx-bp-bar">
        <button type="button" disabled={full} onClick={() => setRect({ ...BODY_PHOTO_CROP_FULL })} title="Retirer le rognage">Tout afficher</button>
        <span className="grow" />
        <button type="button" onClick={onClose}>Annuler</button>
        <button type="button" className="primary" onClick={() => onSave(bodyPhotoNormalizeCrop(rect))}>Enregistrer</button>
      </div>
    </>
  );
}

export { BODY_PHOTO_CSS, bodyPhotoSpec, bodyPhotoSorted, bodyPhotoRightPhoto, bodyPhotoAlignment, bodyPhotoFormatDate, bodyPhotoDeltaLabel, bodyPhotoNormalizeCrop, BodyPhotoCompare, BodyPhotoCrop };
