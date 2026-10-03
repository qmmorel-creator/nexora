// Photos corporelles (Ref #660, lot 7) : port du calcul de nexora-project,
// bloc NEXORA:BODY-PHOTOS (part-003:41408-41675). Futur ne fait que la
// COMPARAISON (décision de Quentin) : ni envoi, ni repères, ni suppression.
export type Point = { x: number; y: number };
export type Similarite = { a: number; b: number; tx: number; ty: number };
export interface Ajustement { dx: number; dy: number; rot: number; scale: number }
export interface Photo {
  id: string; status: "pending" | "ready"; date: string; dateSource?: string; width: number; height: number; createdAt?: string;
  landmarks?: { leftEye?: Point | null; rightEye?: Point | null; navel?: Point | null };
  adjust?: Record<string, Partial<Ajustement>>;
}
export const REPERES = ["leftEye", "rightEye", "navel"] as const;
export const IDENTITE: Similarite = { a: 1, b: 0, tx: 0, ty: 0 };

export const appliquer = (t: Similarite, p: Point): Point => ({ x: t.a * p.x - t.b * p.y + t.tx, y: t.b * p.x + t.a * p.y + t.ty });
// t2 ∘ t1 : applique t1 puis t2.
export const composer = (t2: Similarite, t1: Similarite): Similarite => ({
  a: t2.a * t1.a - t2.b * t1.b, b: t2.a * t1.b + t2.b * t1.a,
  tx: t2.a * t1.tx - t2.b * t1.ty + t2.tx, ty: t2.b * t1.tx + t2.a * t1.ty + t2.ty,
});
// bodyPhotoFit : similarité sans reflet, moindres carrés (Procrustes 2D).
export function ajuster(src: Point[], dst: Point[]): Similarite | null {
  const n = Math.min(src.length, dst.length);
  if (n < 2) return null;
  let mpx = 0, mpy = 0, mqx = 0, mqy = 0;
  for (let i = 0; i < n; i++) { mpx += src[i].x; mpy += src[i].y; mqx += dst[i].x; mqy += dst[i].y; }
  mpx /= n; mpy /= n; mqx /= n; mqy /= n;
  let somme = 0, re = 0, im = 0;
  for (let i = 0; i < n; i++) {
    const zx = src[i].x - mpx, zy = src[i].y - mpy, wx = dst[i].x - mqx, wy = dst[i].y - mqy;
    somme += zx * zx + zy * zy; re += zx * wx + zy * wy; im += zx * wy - zy * wx;
  }
  if (!(somme > 1e-9)) return null;
  const a = re / somme, b = im / somme;
  if (!(a * a + b * b > 1e-12)) return null;
  return { a, b, tx: mqx - (a * mpx - b * mpy), ty: mqy - (b * mpx + a * mpy) };
}
export function residu(t: Similarite | null, src: Point[], dst: Point[]) {
  if (!t || !src.length) return null;
  let s = 0;
  src.forEach((p, i) => { const q = appliquer(t, p); s += (q.x - dst[i].x) ** 2 + (q.y - dst[i].y) ** 2; });
  return Math.sqrt(s / src.length);
}
const enPixels = (p: Point | null | undefined, w: number, h: number) => (p ? { x: p.x * w, y: p.y * h } : null);
// bodyPhotoPairs
export function paires(photo: Photo, ref: Photo) {
  const src: Point[] = [], dst: Point[] = [];
  REPERES.forEach((k) => { const p = enPixels(photo.landmarks?.[k], photo.width, photo.height), q = enPixels(ref.landmarks?.[k], ref.width, ref.height); if (p && q) { src.push(p); dst.push(q); } });
  return { src, dst };
}
const nombre = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const normaliserAjustement = (a?: Partial<Ajustement>): Ajustement => ({ dx: nombre(a?.dx), dy: nombre(a?.dy), rot: nombre(a?.rot), scale: nombre(a?.scale) });
// bodyPhotoAdjustTransform : rotation et échelle autour du centre du cadre de la référence, puis décalage.
export function transformAjustement(adj: Partial<Ajustement> | undefined, w: number, h: number): Similarite {
  const { dx, dy, rot, scale } = normaliserAjustement(adj);
  const s = 1 + scale / 100, r = (rot * Math.PI) / 180, a = s * Math.cos(r), b = s * Math.sin(r), cx = w / 2, cy = h / 2;
  return { a, b, tx: cx + dx - (a * cx - b * cy), ty: cy + dy - (b * cx + a * cy) };
}
// bodyPhotoAlignment : recalculé depuis les repères ; l'ajustement manuel rangé par référence est composé après.
export function alignement(photo: Photo | null, ref: Photo | null): { ok: true; transform: Similarite; residu: number | null } | { ok: false; raison: "missing" | "reference" | "photo" } {
  if (!photo || !ref) return { ok: false, raison: "missing" };
  if (photo.id === ref.id) return { ok: true, transform: IDENTITE, residu: 0 };
  const { src, dst } = paires(photo, ref);
  const auto = ajuster(src, dst);
  if (!auto) { const manque = (p: Photo) => !p.landmarks?.leftEye || !p.landmarks?.rightEye; return { ok: false, raison: manque(ref) ? "reference" : "photo" }; }
  const adj = photo.adjust?.[ref.id];
  const neutre = !adj || Object.values(normaliserAjustement(adj)).every((v) => !v);
  const transform = neutre ? auto : composer(transformAjustement(adj, ref.width, ref.height), auto);
  return { ok: true, transform, residu: residu(transform, src, dst) };
}
// bodyPhotoCssMatrix
export function matriceCss(t: Similarite, k = 1) {
  const f = (v: number) => Number(v.toFixed(6));
  return `matrix(${f(k * t.a)}, ${f(k * t.b)}, ${f(-k * t.b)}, ${f(k * t.a)}, ${f(k * t.tx)}, ${f(k * t.ty)})`;
}
export const trierPhotos = (photos: Photo[]) => [...photos].sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)));
// bodyPhotoRightPhoto
export function photoDroite(photos: Photo[], refId: string | null, droiteId: string) {
  const prets = trierPhotos(photos).filter((p) => p.status === "ready" && p.id !== refId);
  return prets.find((p) => p.id === droiteId) || prets[prets.length - 1] || null;
}
export const dateFr = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split("-").reverse().join("/") : "—");
// bodyPhotoDeltaLabel
export function ecartJours(de: string, a: string) {
  const n = Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);
  if (!n) return "même jour";
  return `${n > 0 ? "+" : "−"}${Math.abs(n)} jour${Math.abs(n) > 1 ? "s" : ""}`;
}
export function photosDe(data: unknown): { photos: Photo[]; referenceId: string | null } {
  const d = data as { photos?: unknown; referenceId?: unknown };
  if (!Array.isArray(d?.photos)) throw new Error("Réponse Photos invalide.");
  return { photos: d.photos.filter((p): p is Photo => !!p && typeof p === "object" && typeof (p as Photo).id === "string"), referenceId: typeof d.referenceId === "string" ? d.referenceId : null };
}
