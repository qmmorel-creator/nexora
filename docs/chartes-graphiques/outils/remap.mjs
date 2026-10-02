// Remappage automatique des couleurs codées en dur de Nexora vers la palette d'un thème.
import { parse, toLch, toOklab, fromLch, mix, fmt, contrast, COLOR_RE } from './color.mjs';
const ORIG = [ // ancrages neutres de la charte actuelle (life-*) → rôle
  ['#ffffff', 'surface'], ['#f7f9fc', 'soft'], ['#f3f5f9', 'bg'], ['#dce3ed', 'border'], ['#b9c7d8', 'borderStrong'],
  ['#7a8290', 'muted'], ['#53647b', 'secondary'], ['#18263d', 'text'], ['#000000', 'text'],
].map(([h, role]) => [toOklab(parse(h))[0], role]).sort((a, b) => b[0] - a[0]);
const EXACT = { '#ff7a3d': 'signal', '#cb4000': 'signalText', '#e2483e': 'danger', '#d72c20': 'danger', '#1fa971': 'success', '#188056': 'success', '#e2a63b': 'warning', '#956816': 'warning' };
const C = (t, k) => parse(t[k]);
function neutralRamp(L, t) {
  if (L >= ORIG[0][0]) return C(t, ORIG[0][1]);
  for (let i = 0; i < ORIG.length - 1; i++) {
    const [la, ra] = ORIG[i], [lb, rb] = ORIG[i + 1];
    if (L <= la && L >= lb) return mix(C(t, ra), C(t, rb), la === lb ? 0 : (la - L) / (la - lb));
  }
  return C(t, 'text');
}
export function kindOfProp(prop) {
  if (/shadow/.test(prop)) return 'shadow';
  if (/^color$|caret|text-decoration|^--.*(ink|text|fg)/.test(prop)) return 'text';
  if (/border|outline|^stroke|column-rule|^--.*(border|line|edge|grid)/.test(prop)) return 'border';
  if (/^fill/.test(prop)) return 'fill';
  return 'bg';
}
// Renvoie [rgb, alpha, rôle] ou null (inchangé).
// data = couleur de donnée (attribut SVG, style en ligne calculé) : jamais ramenée à l'accent du thème,
// sinon deux catégories bleues ou violettes se confondraient entre elles et avec l'interface.
export function mapColor(str, kind, t, data = false) {
  const p = parse(str); if (!p) return null;
  const rgb = p.slice(0, 3), a = p[3];
  const h6 = fmt(rgb).toLowerCase();
  if (EXACT[h6]) return [C(t, EXACT[h6]), a, 'exact'];
  const [L, Ch, H] = toLch(rgb);
  if (kind === 'shadow' && a < 0.9) return t.dark ? [[0, 0, 0], Math.min(0.85, a * 2.6), 'shadow'] : [C(t, 'text'), a, 'shadow'];
  const neutral = Ch < 0.045 || (L < 0.42 && Ch < 0.075);
  if (neutral) {
    if (L > 0.9 && a < 0.95) return null;                           // voiles blancs sur fond coloré : inchangés
    if (kind === 'text' && L > 0.97) return null;                   // texte blanc posé sur aplat coloré : inchangé
    if (kind === 'bg' && L < 0.42 && a > 0.5) return [C(t, 'tooltip'), a, 'tooltip'];
    if (t.dark && kind === 'bg' && L >= 0.42 && L < 0.75 && a > 0.5) return null; // gris moyens opaques (statuts) : inchangés en sombre
    return [neutralRamp(L, t), a, 'neutral'];
  }
  const accentFam = !data && H >= 245 && H <= 292 && Ch >= 0.09;
  if (accentFam) {
    if (kind === 'text') return [L > 0.85 ? C(t, 'accentSoft') : C(t, 'accentText'), a, 'accent'];
    if (kind === 'bg' || kind === 'fill') {
      if (L >= 0.93) return [C(t, 'accentSoft'), a, 'accentSoft'];
      if (L >= 0.8) return [mix(C(t, 'accentSoft'), C(t, 'accent'), 0.22), a, 'accentSoft'];
      if (L >= 0.62) return [mix(C(t, 'accent'), C(t, 'surface'), 0.3), a, 'accent'];
      return [L < 0.45 ? C(t, 'accentHover') : C(t, 'accent'), a, 'accent'];
    }
    if (kind === 'shadow') return [L >= 0.85 ? C(t, 'accentSoft') : C(t, 'accent'), a, 'accent'];
    return [L >= 0.85 ? mix(C(t, 'accentSoft'), C(t, 'accent'), 0.35) : C(t, 'accent'), a, 'accent'];
  }
  if (!t.dark) return null;                                          // couleurs de données : intactes en clair
  const sL = toLch(C(t, 'surface'))[0];
  if (data && L > 0.86 && (kind === 'fill' || kind === 'border')) return [fromLch([sL + 0.3, Math.min(Math.max(Ch * 1.6, 0.05), 0.11), H]), a, 'pastel'];   // tracé pastel → ton moyen visible
  if (L > 0.86) return [fromLch(kind === 'border' ? [sL + 0.2, Math.min(Ch, 0.07), H] : [sL + 0.07, Math.min(Ch * 0.7, 0.05), H]), a, 'pastel'];
  if (data && kind !== 'bg' && contrast(rgb, C(t, 'surface')) < 3) {    // tracé de donnée trop sombre : éclairci jusqu'à 3:1, teinte conservée
    let l = L; let c = rgb; while (l < 0.95 && contrast(c, C(t, 'surface')) < 3) { l += 0.02; c = fromLch([l, Ch, H]); }
    return [c, a, 'datalight'];
  }
  if (L < 0.55 && kind === 'text') return [fromLch([0.82, Math.min(Ch, 0.13), H]), a, 'darktext'];
  if (L < 0.4 && kind !== 'text') return [fromLch([Math.max(L, sL + 0.12), Ch, H]), a, 'darkfill'];
  return null;
}
export function mapValue(value, prop, t, roles) {
  const kind = kindOfProp(prop);
  let changed = false;
  const out = value.replace(COLOR_RE, (m) => { const r = mapColor(m, kind, t); if (!r) return m; changed = true; roles && roles.push(r[2]); return fmt(r[0], r[1]); });
  return changed ? out : null;
}
// Découpe une liste de sélecteurs au niveau 0 (hors parenthèses).
export function splitSelectors(s) { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; }
export function scopeSelector(sel, scope) {
  return splitSelectors(sel).map((s) => {
    if (/^:root\b/.test(s)) return s.replace(/^:root/, scope);
    if (/^html\b/.test(s)) return s.replace(/^html/, scope);
    return scope + ' ' + s;
  }).join(',\n');
}
