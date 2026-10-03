/* eslint-disable */
// @ts-nocheck
// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (retours du 03/10/2026).
// Photos corporelles de Nexora (dernier commit du dossier source : 9c48970) reprises telles quelles : calcul,
// import, repères, affinage, rognage, référence, dates, suppression, comparaison. Seule adaptation : la
// route /api/optim/photos au lieu de /api/nexora/body-photos (voir ADAPTATIONS_PHOTOS).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Crop, Crosshair, Maximize2, Star, Trash2, Upload } from "lucide-react";
import { auth, financeSankeyToday, ViewToolbarPortal } from "./photos-adaptateur";

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

const BODY_PHOTO_ERRORS = {
  unauthorized: "Accès refusé : seule la session du propriétaire Nexora accède aux photos.",
  configuration_missing: "Configuration Nexora incomplète sur le serveur.",
  payload_too_large: "Photo trop lourde, même après réduction.",
  unsupported_media_type: "Format refusé par le serveur.",
  invalid_image: "Image illisible après conversion.",
  invalid_date: "Date invalide.",
  not_found: "Photo introuvable (déjà supprimée ?).",
};

async function bodyPhotoToken() {
  const user = auth.currentUser;
  if (!user) throw new Error("Session Nexora absente : reconnecte-toi pour accéder aux photos.");
  return user.getIdToken();
}

function bodyPhotoErrorMessage(payload, status) {
  return BODY_PHOTO_ERRORS[payload?.error] || payload?.detail || payload?.error || `Opération impossible (HTTP ${status}).`;
}

async function bodyPhotoApi(path, init = {}) {
  const token = await bodyPhotoToken();
  const response = await fetch(`/api/optim/photos${path}`, {
    ...init,
    cache: "no-store",
    headers: { authorization: `Bearer ${token}`, ...(init.body && typeof init.body === "string" ? { "content-type": "application/json" } : {}), ...(init.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(bodyPhotoErrorMessage(payload, response.status));
  return payload.data;
}

// Magasin partagé par tous les widgets de la page : une seule liste, des
// images lues une fois par session (URL d'objet en mémoire, jamais en cache
// du navigateur ni sur disque).
const bodyPhotoStore = { photos: null, referenceId: null, error: null, promise: null, listeners: new Set(), urls: new Map() };
function bodyPhotoNotify() { bodyPhotoStore.listeners.forEach((fn) => fn()); }
function bodyPhotoLoad(force = false) {
  if (bodyPhotoStore.promise && !force) return bodyPhotoStore.promise;
  bodyPhotoStore.error = null;
  bodyPhotoNotify();
  bodyPhotoStore.promise = (async () => {
    try {
      const data = await bodyPhotoApi("");
      bodyPhotoStore.photos = data.photos || [];
      bodyPhotoStore.referenceId = data.referenceId || null;
    } catch (error) {
      bodyPhotoStore.error = error instanceof Error ? error.message : String(error);
      bodyPhotoStore.promise = null;
    }
    bodyPhotoNotify();
  })();
  return bodyPhotoStore.promise;
}
function bodyPhotoPut(photo) {
  const list = (bodyPhotoStore.photos || []).filter((p) => p.id !== photo.id);
  bodyPhotoStore.photos = [...list, photo];
  bodyPhotoNotify();
}
async function bodyPhotoPatch(id, body) {
  const data = await bodyPhotoApi(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) });
  bodyPhotoPut(data.photo);
  return data.photo;
}
async function bodyPhotoSetReference(id) {
  const data = await bodyPhotoApi("/reference", { method: "PUT", body: JSON.stringify({ id }) });
  bodyPhotoStore.referenceId = data.referenceId;
  bodyPhotoNotify();
}
async function bodyPhotoDelete(id) {
  await bodyPhotoApi(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  bodyPhotoStore.photos = (bodyPhotoStore.photos || []).filter((p) => p.id !== id);
  if (bodyPhotoStore.referenceId === id) bodyPhotoStore.referenceId = null;
  const entry = bodyPhotoStore.urls.get(id);
  if (entry?.url) URL.revokeObjectURL(entry.url);
  bodyPhotoStore.urls.delete(id);
  bodyPhotoNotify();
}
function bodyPhotoImage(id) {
  const cached = bodyPhotoStore.urls.get(id);
  if (cached) return cached.promise;
  const entry = { url: null, promise: null };
  entry.promise = (async () => {
    const token = await bodyPhotoToken();
    const response = await fetch(`/api/optim/photos/${encodeURIComponent(id)}/image`, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) {
      bodyPhotoStore.urls.delete(id);
      throw new Error(bodyPhotoErrorMessage(await response.json().catch(() => ({})), response.status));
    }
    entry.url = URL.createObjectURL(await response.blob());
    return entry.url;
  })();
  bodyPhotoStore.urls.set(id, entry);
  return entry.promise;
}

function useBodyPhotos() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    bodyPhotoStore.listeners.add(listener);
    bodyPhotoLoad();
    return () => { bodyPhotoStore.listeners.delete(listener); };
  }, []);
  return { photos: bodyPhotoStore.photos, referenceId: bodyPhotoStore.referenceId, error: bodyPhotoStore.error, reload: () => bodyPhotoLoad(true) };
}

// URL d'objet de l'image ; `enabled` permet de ne charger qu'à l'affichage.
function useBodyPhotoUrl(id, enabled = true) {
  const [state, setState] = useState(() => ({ id, url: bodyPhotoStore.urls.get(id)?.url || null, error: null }));
  useEffect(() => {
    if (!id || !enabled) return undefined;
    let alive = true;
    bodyPhotoImage(id).then(
      (url) => alive && setState({ id, url, error: null }),
      (error) => alive && setState({ id, url: null, error: error.message })
    );
    return () => { alive = false; };
  }, [id, enabled]);
  return state.id === id ? state : { id, url: null, error: null };
}

// Préparation dans le navigateur : date EXIF lue, image décodée AVEC son
// orientation EXIF appliquée, réduite au côté long 2 400 px, ré-encodée en
// JPEG 0,9 par un canvas — ce qui retire toutes les métadonnées (GPS compris).
// Mémoire (#616, plantage « Out of Memory » à l'import de trois photos) :
// seul l'en-tête est lu ; l'image est décodée DIRECTEMENT à la taille
// d'envoi quand le navigateur sait le faire (une photo de 48 Mpx décodée en
// entier occupe ~190 Mo) ; canevas et image décodée sont libérés aussitôt.
async function bodyPhotoDecode(file, plan) {
  if (plan) {
    try {
      const small = await createImageBitmap(file, { imageOrientation: "from-image", resizeWidth: plan.width, resizeHeight: plan.height, resizeQuality: "high" });
      // Contrôle : un navigateur qui réduirait AVANT d'orienter rendrait une
      // image déformée ; on la jette et on décode en entier.
      if (Math.abs(small.width - plan.width) <= 1 && Math.abs(small.height - plan.height) <= 1) return small;
      small.close();
    } catch { /* option non prise en charge : décodage complet */ }
  }
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

async function bodyPhotoPrepare(file, today) {
  const head = await file.slice(0, BODY_PHOTO_HEAD_BYTES).arrayBuffer();
  const exif = bodyPhotoExifInfo(head);
  const plan = bodyPhotoDecodePlan(bodyPhotoJpegSize(head), exif.orientation);
  let source;
  try {
    source = await bodyPhotoDecode(file, plan);
  } catch {
    source = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Format non décodable par ce navigateur" + (/heic|heif/i.test(file.type + file.name) ? " (HEIC : utilise Safari, ou convertis la photo en JPEG)." : "."))); };
      img.src = url;
    });
  }
  const w0 = source.naturalWidth || source.width, h0 = source.naturalHeight || source.height;
  const { width, height } = bodyPhotoFitSize(w0, h0);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  if (source.close) source.close();
  else source.src = "";
  let blob;
  try {
    blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion JPEG impossible."))), "image/jpeg", BODY_PHOTO_QUALITY));
  } finally {
    // Libère tout de suite la mémoire du canevas, sans attendre le ramasse-miettes.
    canvas.width = 0;
    canvas.height = 0;
  }
  const { date, source: dateSource } = bodyPhotoDefaultDate(exif.date, today);
  return { blob, width, height, date, dateSource };
}

// Envoi avec progression (XMLHttpRequest : fetch ne la donne pas).
function bodyPhotoSend(prepared, key, onProgress) {
  return bodyPhotoToken().then((token) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/optim/photos");
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("content-type", "image/jpeg");
    xhr.setRequestHeader("x-idempotency-key", key);
    xhr.setRequestHeader("x-photo-date", prepared.date);
    xhr.setRequestHeader("x-date-source", prepared.dateSource);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let payload = {};
      try { payload = JSON.parse(xhr.responseText); } catch { /* réponse non JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && payload.ok) resolve(payload.data.photo);
      else reject(new Error(bodyPhotoErrorMessage(payload, xhr.status)));
    };
    xhr.onerror = () => reject(new Error("Réseau indisponible pendant l'envoi."));
    xhr.send(prepared.blob);
  }));
}

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

// Couleurs des repères : œil gauche, œil droit, nombril.
const BODY_PHOTO_COLORS = { leftEye: "#2a78d6", rightEye: "#0f9d76", navel: "#eb6834" };

// Taille d'un cadre au rapport largeur/hauteur donné, logé dans une boîte.
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

// Repères et lignes de contrôle dessinés dans le cadre de la référence :
// ronds = référence, croix = photo de droite transformée. Ligne des yeux et
// verticale du nombril de la référence pour juger l'alignement d'un coup d'œil.
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

// Comparaison avant / après : référence à gauche, photo choisie à droite,
// superposées dans le même cadre (taille fixée par la référence). La photo de
// droite reçoit sa similarité en CSS `transform: matrix(...)` : composée par
// le GPU, sans redessiner l'image quand le curseur bouge — seul le
// `clip-path` du calque change.
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

// Mode « Placer les repères » : la photo en grand, une consigne par étape,
// loupe ×4, repères déplaçables à la souris, au doigt et aux flèches.
function BodyPhotoLandmarkEditor({ photo, onClose }) {
  const boxRef = useRef(null);
  const frame = useBodyPhotoFrame(boxRef, photo.width / photo.height);
  const img = useBodyPhotoUrl(photo.id);
  const [points, setPoints] = useState(() => ({ leftEye: null, rightEye: null, navel: null, ...(photo.landmarks || {}) }));
  const [dragKey, setDragKey] = useState(null);
  const [lens, setLens] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const next = BODY_PHOTO_LANDMARKS.find((l) => !points[l.key]);
  const k = frame.w / photo.width;
  const unitFromEvent = (e) => {
    const rect = e.currentTarget.closest(".nx-bp-frame").getBoundingClientRect();
    return bodyPhotoToUnit({ x: ((e.clientX - rect.left) / rect.width) * photo.width, y: ((e.clientY - rect.top) / rect.height) * photo.height }, photo.width, photo.height);
  };
  const showLens = (u) => setLens(u);
  const onFrameDown = (e) => {
    if (dragKey || !next || (e.button !== undefined && e.button !== 0)) return;
    const u = unitFromEvent(e);
    setPoints((p) => ({ ...p, [next.key]: u }));
    showLens(u);
  };
  const onFrameMove = (e) => {
    const u = unitFromEvent(e);
    if (dragKey) setPoints((p) => ({ ...p, [dragKey]: u }));
    if (e.pointerType !== "touch" || dragKey) showLens(u);
  };
  const onPointDown = (key) => (e) => {
    e.stopPropagation();
    setDragKey(key);
    e.currentTarget.closest(".nx-bp-frame").setPointerCapture?.(e.pointerId);
  };
  const endDrag = () => { setDragKey(null); };
  const onPointKey = (key) => (e) => {
    const step = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setPoints((p) => ({ ...p, [key]: null })); return; }
    if (!d) return;
    e.preventDefault();
    setPoints((p) => {
      const px = bodyPhotoToPixels(p[key], photo.width, photo.height);
      const u = bodyPhotoToUnit({ x: px.x + d[0], y: px.y + d[1] }, photo.width, photo.height);
      showLens(u);
      return { ...p, [key]: u };
    });
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await bodyPhotoPatch(photo.id, { landmarks: points });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };
  const ready = points.leftEye && points.rightEye;
  const zoom = 4;
  const lensStyle = lens && img.url ? {
    backgroundImage: `url(${img.url})`,
    backgroundSize: `${frame.w * zoom}px ${frame.h * zoom}px`,
    backgroundPosition: `${63 - lens.x * frame.w * zoom}px ${63 - lens.y * frame.h * zoom}px`,
  } : null;
  return (
    <>
      <div className="nx-bp-bar" aria-live="polite">
        <span className="nx-bp-hint grow">
          {next ? <><strong>Étape {BODY_PHOTO_LANDMARKS.indexOf(next) + 1}/3 — {next.label}.</strong> {next.hint}</>
            : <><strong>Les trois repères sont placés.</strong> Glisse-les ou sélectionne-en un et utilise les flèches (Maj : 10 px) pour les ajuster.</>}
          {next?.key === "navel" && " Facultatif : deux yeux suffisent pour aligner, le nombril rend l'alignement plus juste."}
        </span>
        {BODY_PHOTO_LANDMARKS.map((l) => points[l.key] && (
          <button key={l.key} type="button" onClick={() => setPoints((p) => ({ ...p, [l.key]: null }))} title={`Replacer : ${l.label}`}>
            <span style={{ color: BODY_PHOTO_COLORS[l.key] }}>●</span> Replacer {l.label.toLowerCase()}
          </button>
        ))}
      </div>
      <div className="nx-bp-stage" ref={boxRef}>
        {frame.w > 0 && (
          <div className="nx-bp-frame" data-testid="body-photo-landmarks" style={{ width: frame.w, height: frame.h, cursor: next ? "crosshair" : "default" }}
            onPointerDown={onFrameDown} onPointerMove={onFrameMove} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerLeave={() => !dragKey && setLens(null)}>
            {img.url && <img src={img.url} alt={`Photo du ${bodyPhotoFormatDate(photo.date)}`} style={{ width: frame.w, height: frame.h }} />}
            {BODY_PHOTO_LANDMARKS.map((l, i) => points[l.key] && (
              <button key={l.key} type="button" className={`nx-bp-point${dragKey === l.key ? " dragging" : ""}`}
                style={{ left: points[l.key].x * frame.w, top: points[l.key].y * frame.h, background: BODY_PHOTO_COLORS[l.key] }}
                aria-label={`${l.label} : déplacer avec les flèches, Suppr pour effacer`} data-landmark={l.key}
                onPointerDown={onPointDown(l.key)} onKeyDown={onPointKey(l.key)} onFocus={() => showLens(points[l.key])}>{i + 1}</button>
            ))}
            {lensStyle && <div className="nx-bp-loupe" style={lensStyle} aria-hidden="true" />}
          </div>
        )}
      </div>
      <div className="nx-bp-bar">
        {error && <span className="err" role="alert" style={{ color: "#b42318" }}>{error}</span>}
        <span className="grow" />
        <button type="button" onClick={onClose}>Annuler</button>
        <button type="button" className="primary" disabled={!ready || saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer les repères"}</button>
      </div>
    </>
  );
}

// Mode « Affiner » : la photo en transparence (pelure d'oignon) ou en
// différence sur la référence, ajustements fins composés après le calcul
// automatique, enregistrés pour CETTE référence.
function BodyPhotoRefine({ reference, photo, onClose }) {
  const boxRef = useRef(null);
  const frame = useBodyPhotoFrame(boxRef, reference.width / reference.height);
  const refImg = useBodyPhotoUrl(reference.id);
  const phImg = useBodyPhotoUrl(photo.id);
  const [adj, setAdj] = useState(() => bodyPhotoNormalizeAdjust(photo.adjust?.[reference.id]));
  const [opacity, setOpacity] = useState(50);
  const [difference, setDifference] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draft = { ...photo, adjust: { ...(photo.adjust || {}), [reference.id]: adj } };
  const alignment = bodyPhotoAlignment(draft, reference);
  const k = frame.w / reference.width;
  const nudge = (axis, dir) => setAdj((a) => bodyPhotoNudge(a, axis, dir));
  const onKeyDown = (e) => {
    const map = { ArrowLeft: ["dx", -1], ArrowRight: ["dx", 1], ArrowUp: ["dy", -1], ArrowDown: ["dy", 1], ",": ["rot", -1], ".": ["rot", 1], "-": ["scale", -1], "+": ["scale", 1], "=": ["scale", 1] };
    const m = map[e.key];
    if (!m) return;
    e.preventDefault();
    for (let i = 0; i < (e.shiftKey ? 10 : 1); i++) nudge(m[0], m[1]);
  };
  const persist = async (value) => {
    setSaving(true);
    setError("");
    try {
      await bodyPhotoPatch(photo.id, { adjust: { referenceId: reference.id, value } });
      if (value === null) setAdj(bodyPhotoNormalizeAdjust(null));
      else onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };
  if (!alignment.ok) return <div className="nx-bp-empty">Repères insuffisants pour affiner.<button type="button" className="lp-btn" onClick={onClose}>Fermer</button></div>;
  const fmt = (v, d = 1) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  return (
    <>
      <div className="nx-bp-bar">
        <label>Transparence <input type="range" min={0} max={100} value={opacity} disabled={difference} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="Transparence de la photo" style={{ width: 100, height: "auto", padding: 0, border: 0 }} /></label>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><input type="checkbox" checked={difference} onChange={() => setDifference(!difference)} style={{ height: "auto" }} />Différence</label>
        <span className="nx-bp-hint grow">Écart moyen des repères : <strong>{fmt(alignment.residual)} px</strong>{!bodyPhotoIsNeutral(adj) ? ` (calcul automatique : ${fmt(alignment.autoResidual)} px)` : ""}</span>
      </div>
      <div className="nx-bp-stage" ref={boxRef}>
        {frame.w > 0 && (
          <div className="nx-bp-frame" tabIndex={0} aria-label="Superposition : flèches pour décaler, virgule et point pour tourner, moins et plus pour l'échelle" onKeyDown={onKeyDown}
            data-testid="body-photo-refine" style={{ width: frame.w, height: frame.h }}>
            {refImg.url && <img src={refImg.url} alt="" style={{ width: frame.w, height: frame.h }} />}
            {phImg.url && <img src={phImg.url} alt="" data-role="photo"
              style={{ width: photo.width, height: photo.height, transform: bodyPhotoCssMatrix(alignment.transform, k), opacity: difference ? 1 : opacity / 100, mixBlendMode: difference ? "difference" : "normal" }} />}
            <BodyPhotoMarks reference={reference} photo={draft} transform={alignment.transform} width={frame.w} height={frame.h} />
          </div>
        )}
      </div>
      <div className="nx-bp-bar">
        <button type="button" onClick={() => nudge("dx", -1)} aria-label="Décaler de 1 px à gauche">←</button>
        <button type="button" onClick={() => nudge("dx", 1)} aria-label="Décaler de 1 px à droite">→</button>
        <button type="button" onClick={() => nudge("dy", -1)} aria-label="Décaler de 1 px vers le haut">↑</button>
        <button type="button" onClick={() => nudge("dy", 1)} aria-label="Décaler de 1 px vers le bas">↓</button>
        <button type="button" onClick={() => nudge("rot", -1)} aria-label="Tourner de 0,1° à gauche">↺ 0,1°</button>
        <button type="button" onClick={() => nudge("rot", 1)} aria-label="Tourner de 0,1° à droite">↻ 0,1°</button>
        <button type="button" onClick={() => nudge("scale", -1)} aria-label="Réduire de 0,1 %">− 0,1 %</button>
        <button type="button" onClick={() => nudge("scale", 1)} aria-label="Agrandir de 0,1 %">+ 0,1 %</button>
        <span className="nx-bp-hint">{fmt(adj.dx, 0)} / {fmt(adj.dy, 0)} px · {fmt(adj.rot)}° · {fmt(adj.scale)} %</span>
        <span className="grow" />
        {error && <span role="alert" style={{ color: "#b42318" }}>{error}</span>}
        <button type="button" disabled={saving} onClick={() => persist(null)} title="Revenir au calcul automatique à partir des repères">Remise à zéro</button>
        <button type="button" onClick={onClose}>Fermer</button>
        <button type="button" className="primary" disabled={saving} onClick={() => persist(adj)}>Enregistrer</button>
      </div>
    </>
  );
}

// Mode « Rogner » (#633) : tout le cadre de la référence, la photo alignée
// superposée en transparence, et le cadre gardé — déplaçable par son centre,
// redimensionnable par ses huit poignées (souris, doigt), au clavier par les
// flèches (Maj : pas de 5 %) ; Alt + flèches agrandit ou réduit.
const BODY_PHOTO_CROP_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
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

// Vignette de la galerie : image chargée seulement quand elle est visible.
function BodyPhotoThumb({ photo, isReference, isRight, busy, onAction }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === "undefined");
  const [editingDate, setEditingDate] = useState(false);
  useEffect(() => {
    if (visible || !ref.current) return undefined;
    const io = new IntersectionObserver((entries) => entries.some((en) => en.isIntersecting) && setVisible(true), { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [visible]);
  const ready = photo.status === "ready";
  const img = useBodyPhotoUrl(photo.id, visible && ready);
  const hasMarks = photo.landmarks?.leftEye && photo.landmarks?.rightEye;
  return (
    <div ref={ref} className={`nx-bp-thumb${isReference ? " is-ref" : ""}${isRight ? " is-right" : ""}`} data-photo-id={photo.id}>
      <button type="button" className="nx-bp-thumb-img" disabled={!ready || isReference} style={img.url ? { backgroundImage: `url(${img.url})` } : undefined}
        onClick={() => onAction("right", photo)} aria-label={`Comparer la photo du ${bodyPhotoFormatDate(photo.date)}`} title={ready ? "Afficher à droite" : "Import inachevé"} />
      {isReference && <span className="nx-bp-badge">Référence</span>}
      {!ready && <span className="nx-bp-badge warn">Import inachevé</span>}
      {ready && !hasMarks && !isReference && <span className="nx-bp-badge warn" style={{ left: "auto", right: 4 }}>Sans repères</span>}
      <div className="nx-bp-thumb-date">
        {editingDate
          ? <input type="date" autoFocus defaultValue={photo.date} aria-label="Date de la photo" onBlur={() => setEditingDate(false)}
              onKeyDown={(e) => e.key === "Escape" && setEditingDate(false)}
              onChange={(e) => { if (bodyPhotoIsDate(e.target.value)) { onAction("date", photo, e.target.value); setEditingDate(false); } }} />
          : <span title={photo.dateSource === "exif" ? "Date de prise de vue (EXIF)" : photo.dateSource === "manual" ? "Date modifiée" : "Date d'import"}>{bodyPhotoFormatDate(photo.date)}</span>}
      </div>
      <div className="nx-bp-thumb-actions">
        {ready && !isReference && <button type="button" disabled={busy} onClick={() => onAction("reference", photo)} title="Définir comme référence" aria-label="Définir comme référence"><Star size={13} /></button>}
        {ready && <button type="button" disabled={busy} onClick={() => onAction("landmarks", photo)} title="Placer les repères" aria-label="Placer les repères"><Crosshair size={13} /></button>}
        {ready && <button type="button" disabled={busy} onClick={() => setEditingDate(true)} title="Modifier la date" aria-label="Modifier la date"><CalendarDays size={13} /></button>}
        <button type="button" className="danger" disabled={busy} onClick={() => onAction("delete", photo)} title="Supprimer" aria-label="Supprimer la photo"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

function WidgetBodyPhotos({ widget, externalToolbarSlot, onUpdateWidget }) {
  const { photos, referenceId, error, reload } = useBodyPhotos();
  const spec = bodyPhotoSpec(widget);
  const update = (patch) => onUpdateWidget && onUpdateWidget({ bodyPhotos: { ...spec, ...patch } });
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [mode, setMode] = useState(null); // { kind: "landmarks" | "refine", id }
  const [split, setSplit] = useState(spec.split);
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => { setSplit(spec.split); }, [spec.split]);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const sorted = bodyPhotoSorted(photos || []);
  const ready = sorted.filter((p) => p.status === "ready");
  const reference = ready.find((p) => p.id === referenceId) || null;
  const right = bodyPhotoRightPhoto(sorted, referenceId, spec.rightId);
  const candidates = ready.filter((p) => p.id !== referenceId);
  const rightIndex = right ? candidates.findIndex((p) => p.id === right.id) : -1;
  const alignment = reference && right ? bodyPhotoAlignment(right, reference) : null;
  const editing = mode ? sorted.find((p) => p.id === mode.id) : null;
  const crop = reference ? spec.crops[reference.id] || null : null;
  const saveCrop = (value) => {
    const crops = { ...spec.crops };
    if (value) crops[reference.id] = value; else delete crops[reference.id];
    update({ crops });
    setMode(null);
  };

  // Import multiple : séquentiel, l'échec d'un fichier ne bloque pas les
  // autres ; chaque fichier garde sa clé d'idempotence pour être relancé.
  const runUpload = async (item) => {
    const set = (patch) => setUploads((list) => list.map((u) => (u.key === item.key ? { ...u, ...patch } : u)));
    try {
      set({ state: "Préparation…", progress: 0, error: "" });
      const prepared = item.prepared || await bodyPhotoPrepare(item.file, financeSankeyToday());
      set({ state: "Envoi…", progress: 0, prepared });
      const photo = await bodyPhotoSend(prepared, item.key, (p) => set({ progress: p }));
      bodyPhotoPut(photo);
      set({ state: "Importée", progress: 1, done: true });
    } catch (err) {
      set({ state: "Échec", error: err.message || String(err) });
    }
  };
  const addFiles = async (fileList) => {
    const files = [...(fileList || [])].filter((f) => /^image\//.test(f.type) || /\.(heic|heif|jpe?g|png)$/i.test(f.name));
    if (!files.length) return;
    const items = files.map((file) => ({ key: crypto.randomUUID(), file, name: file.name, state: "En attente", progress: 0, error: "" }));
    setUploads((list) => [...list.filter((u) => !u.done), ...items]);
    for (const item of items) await runUpload(item);
    setTimeout(() => setUploads((list) => list.filter((u) => !u.done)), 2500);
  };

  const act = async (kind, photo, value) => {
    setActionError("");
    if (kind === "right") { update({ rightId: photo.id }); setMode(null); return; }
    if (kind === "landmarks") { setMode({ kind: "landmarks", id: photo.id }); return; }
    if (kind === "delete" && !window.confirm(`Supprimer définitivement la photo du ${bodyPhotoFormatDate(photo.date)} ? Le fichier stocké sera effacé.`)) return;
    setBusy(true);
    try {
      if (kind === "reference") await bodyPhotoSetReference(photo.id);
      if (kind === "date") await bodyPhotoPatch(photo.id, { date: value });
      if (kind === "delete") { await bodyPhotoDelete(photo.id); if (mode?.id === photo.id) setMode(null); }
    } catch (err) {
      setActionError(err.message);
    }
    setBusy(false);
  };
  const step = (dir) => {
    const next = candidates[rightIndex + dir];
    if (next) update({ rightId: next.id });
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else rootRef.current?.requestFullscreen?.().catch(() => {});
  };

  // En plein écran, l'en-tête du widget n'est plus visible : la barre
  // d'outils passe alors dans le corps du widget.
  const toolsInner = (
      <div className="nx-bp-tools" onPointerDown={(e) => e.stopPropagation()}>
        <select aria-label="Photo de droite" title="Photo de droite" value={right?.id || ""} disabled={!candidates.length} onChange={(e) => update({ rightId: e.target.value })}>
          {!candidates.length && <option value="">Aucune photo</option>}
          {candidates.map((p) => <option key={p.id} value={p.id}>{bodyPhotoFormatDate(p.date)}</option>)}
        </select>
        <button type="button" onClick={() => step(-1)} disabled={rightIndex <= 0} aria-label="Photo précédente">‹</button>
        <button type="button" onClick={() => step(1)} disabled={rightIndex < 0 || rightIndex >= candidates.length - 1} aria-label="Photo suivante">›</button>
        <button type="button" className={spec.showLandmarks ? "active" : ""} aria-pressed={spec.showLandmarks} onClick={() => update({ showLandmarks: !spec.showLandmarks })}>Repères visibles</button>
        {reference && right && alignment?.ok && <button type="button" onClick={() => setMode({ kind: "refine", id: right.id })}>Affiner</button>}
        {reference && right && alignment?.ok && <button type="button" className={crop ? "active" : ""} aria-pressed={!!crop} title={crop ? "Modifier le rognage" : "Rogner la comparaison"} onClick={() => setMode({ kind: "crop", id: reference.id })}><Crop size={12} style={{ verticalAlign: -2 }} /> Rogner</button>}
        <button type="button" onClick={() => inputRef.current?.click()} title="Importer des photos (JPEG, PNG, HEIC)"><Upload size={12} style={{ verticalAlign: -2 }} /> Importer</button>
        <button type="button" onClick={toggleFullscreen} aria-pressed={fullscreen} title={fullscreen ? "Quitter le plein écran" : "Plein écran"}><Maximize2 size={12} style={{ verticalAlign: -2 }} /> {fullscreen ? "Quitter" : "Plein écran"}</button>
        <span className="count">{ready.length} photo{ready.length > 1 ? "s" : ""}</span>
      </div>
  );
  const tools = fullscreen || !externalToolbarSlot
    ? <div className="nx-bp-bar">{toolsInner}</div>
    : <ViewToolbarPortal slot={externalToolbarSlot}>{toolsInner}</ViewToolbarPortal>;

  let main;
  if (error) {
    main = <div className="nx-bp-empty" role="alert"><div>{error}</div><button type="button" className="lp-btn" onClick={reload}>Réessayer</button></div>;
  } else if (!photos) {
    main = <div className="nx-bp-empty">Chargement des photos…</div>;
  } else if (editing && mode.kind === "landmarks") {
    main = <BodyPhotoLandmarkEditor key={editing.id} photo={editing} onClose={() => setMode(null)} />;
  } else if (editing && mode.kind === "crop" && reference && right) {
    main = <BodyPhotoCrop key={reference.id} reference={reference} photo={right} alignment={alignment} crop={crop} onSave={saveCrop} onClose={() => setMode(null)} />;
  } else if (editing && mode.kind === "refine" && reference) {
    main = <BodyPhotoRefine key={`${editing.id}:${reference.id}`} reference={reference} photo={editing} onClose={() => setMode(null)} />;
  } else if (!sorted.length) {
    main = (
      <div className="nx-bp-empty">
        <strong>Aucune photo : importe ta première photo</strong>
        <span>Glisse-dépose une ou plusieurs photos ici, ou choisis-les (JPEG, PNG, HEIC si ton navigateur sait la lire).</span>
        <button type="button" className="lp-btn lp-btn-primary" onClick={() => inputRef.current?.click()}>Importer des photos</button>
      </div>
    );
  } else if (!reference) {
    main = <div className="nx-bp-empty"><strong>Choisis une photo de référence</strong><span>Clique sur l’étoile d’une vignette : elle servira de cadre et d’« avant » à toutes les comparaisons.</span></div>;
  } else if (!right) {
    main = <div className="nx-bp-empty"><strong>Importe une seconde photo</strong><span>La comparaison montre la référence à gauche et une autre photo à droite.</span></div>;
  } else if (!alignment.ok) {
    const target = alignment.reason === "reference" ? reference : right;
    main = (
      <div className="nx-bp-empty">
        <strong>{alignment.reason === "reference" ? "La référence n’a pas de repères" : `La photo du ${bodyPhotoFormatDate(right.date)} n’a pas de repères`}</strong>
        <span>Sans repères (au moins les deux yeux), la photo ne peut pas être alignée ni comparée.</span>
        <button type="button" className="lp-btn lp-btn-primary" onClick={() => setMode({ kind: "landmarks", id: target.id })}>Placer les repères</button>
      </div>
    );
  } else {
    main = (
      <BodyPhotoCompare reference={reference} photo={right} alignment={alignment} split={split} showLandmarks={spec.showLandmarks} crop={crop}
        onSplit={setSplit} onSplitCommit={(v) => update({ split: Math.round((v ?? split) * 10) / 10 })} />
    );
  }

  return (
    <div className="nx-bp" ref={rootRef} data-testid="body-photos"
      onDragOver={(e) => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false); }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer?.files); }}>
      <style>{BODY_PHOTO_CSS}</style>
      {tools}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif" multiple hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      {main}
      {uploads.length > 0 && (
        <div className="nx-bp-uploads" aria-live="polite">
          {uploads.map((u) => (
            <div className="nx-bp-upload" key={u.key}>
              <span title={u.name}>{u.name}</span>
              <progress max={1} value={u.progress || 0} aria-label={`Progression de ${u.name}`} />
              <span className={u.error ? "err" : ""}>{u.error ? `Échec : ${u.error}` : u.state}</span>
              {u.error && <button type="button" className="lp-btn" onClick={() => runUpload(u)}>Réessayer</button>}
              {u.error && <button type="button" className="lp-btn" onClick={() => setUploads((l) => l.filter((x) => x.key !== u.key))}>Retirer</button>}
            </div>
          ))}
        </div>
      )}
      {actionError && <div role="alert" style={{ color: "#b42318" }}>{actionError}</div>}
      {photos && sorted.length > 0 && !mode && (
        <div className="nx-bp-gallery" aria-label="Galerie des photos, de la plus ancienne à la plus récente">
          {sorted.map((p) => <BodyPhotoThumb key={p.id} photo={p} isReference={p.id === referenceId} isRight={p.id === right?.id} busy={busy} onAction={act} />)}
        </div>
      )}
      {dragOver && <div className="nx-bp-drop">Dépose tes photos pour les importer</div>}
    </div>
  );
}

export { BODY_PHOTO_CSS, bodyPhotoSpec, bodyPhotoSorted, bodyPhotoRightPhoto, bodyPhotoAlignment, bodyPhotoFormatDate, bodyPhotoDeltaLabel, bodyPhotoNormalizeCrop, BodyPhotoCompare, BodyPhotoCrop, WidgetBodyPhotos };
