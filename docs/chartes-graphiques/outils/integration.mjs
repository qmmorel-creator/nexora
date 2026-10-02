// Génère la couche de thèmes intégrée à l'application (Ref #621) et l'écrit entre les
// marqueurs de apps/nexora/source/index.html.part-004.
//
//   node docs/chartes-graphiques/outils/integration.mjs           écrit le bloc
//   node docs/chartes-graphiques/outils/integration.mjs --check   échoue si le bloc diffère
//
// Activation dans l'application : <html data-nexora-theme="bauhaus" data-nexora-mode="clair|sombre">.
// Le remappage des couleurs codées en dur est PARTAGÉ : une règle par déclaration, dont la
// valeur est une variable --nx-rm-N ; chaque thème × mode ne fait que définir ces variables.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHARTES } from './palettes.mjs';
import { tokenBlock } from './tokens.mjs';
import { mapValue, mapColor, splitSelectors, kindOfProp } from './remap.mjs';
import { fmt } from './color.mjs';

export const THEMES_APP = ['bauhaus', 'dessau'];
const here = (f) => new URL(f, import.meta.url);
const SOURCE = new URL('../../../apps/nexora/source/index.html.part-004', import.meta.url);
const DEBUT = '<style id="nexora-themes">', FIN = '</style><!-- /nexora-themes -->';
const decls = JSON.parse(readFileSync(here('./donnees/css-colors.json')));
const harvest = JSON.parse(readFileSync(here('./donnees/harvest.json')));
const inkDecls = JSON.parse(readFileSync(here('./donnees/css-inkvars.json'))).filter((x) => /^(background|background-color)$/.test(x[2]) && /var\(--(ink|text-primary|text-900|craie|life-text)\b/.test(x[3]));
const base = readFileSync(here('./base.css'), 'utf8');
const TOKEN_PROPS = /^--(life-|bg$|surface|border|text-|graphite|line-blue|quai|craie|brume|rail|accent|signal|success|warning|danger|font-|fs-|ink|paper|blueprint|radius)/;
const ANY = ':root[data-nexora-theme]';
const scope = (sel, S) => splitSelectors(sel).map((s) => (/^:root\b/.test(s) ? s.replace(/^:root/, S) : /^html\b/.test(s) ? s.replace(/^html/, S) : S + ' ' + s)).join(',\n');

export function genererCouche(ids = THEMES_APP) {
  const chartes = ids.map((id) => CHARTES.find((c) => c.id === id) || (() => { throw new Error('Charte inconnue : ' + id); })());
  const modes = chartes.flatMap((ch) => Object.entries(ch.modes).map(([m, t]) => ({ ch, m, t })));
  const vars = new Map(); // clé (propriété|valeur d'origine) → { nom, valeurs par thème×mode }
  const variable = (prop, val, imp, valeurs) => {
    const cle = kindOfProp(prop) + '|' + val;
    if (!vars.has(cle)) vars.set(cle, { nom: '--nx-rm-' + vars.size.toString(36), valeurs });
    return `var(${vars.get(cle).nom})${imp ? ' !important' : ''}`;
  };
  // 1. Règles partagées de remappage (CSS de Nexora, aplats d'encre, attributs SVG, styles en ligne).
  const groupes = new Map();
  for (const [media, sel, prop, val, prio] of decls) {
    if (TOKEN_PROPS.test(prop)) continue;
    const valeurs = modes.map(({ ch, t }) => (t.dark && /treemap-tile|treemap-chip|tm-tile/.test(sel) && kindOfProp(prop) === 'text' ? null : mapValue(val, prop, t)));
    if (valeurs.every((v) => v === null)) continue;
    const cle = media + '¤' + sel; if (!groupes.has(cle)) groupes.set(cle, { media, sel, d: [] });
    groupes.get(cle).d.push(`${prop}: ${variable(prop, val, prio, valeurs.map((v) => v ?? val))}`);
  }
  let regles = '';
  for (const { media, sel, d } of groupes.values()) { const r = `${scope(sel, ANY)} { ${d.join('; ')}; }`; regles += media ? `@media ${media} { ${r} }\n` : r + '\n'; }
  for (const k of Object.keys(harvest.attr)) {
    const [a, v] = k.split('='); const valeurs = modes.map(({ t }) => { const r = mapColor(v, a === 'fill' ? 'fill' : 'border', t, true); return r ? fmt(r[0], r[1]) : null; });
    if (valeurs.every((x) => x === null)) continue;
    regles += `${ANY} [${a}="${v}"] { ${a}: ${variable(a, v, false, valeurs.map((x) => x ?? v))}; }\n`;
  }
  for (const k of Object.keys(harvest.inl)) {
    const m = k.match(/^([a-z-]+): ((?:rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}))$/); if (!m) continue;
    const [, prop, v] = m; if (kindOfProp(prop) === 'text') continue;
    const valeurs = modes.map(({ t }) => { const r = mapColor(v, kindOfProp(prop), t, true); return r ? fmt(r[0], r[1]) : null; });
    if (valeurs.every((x) => x === null)) continue;
    const lp = prop === 'background' ? 'background-color' : prop === 'border' ? 'border-color' : prop;
    regles += `${ANY} :is([style^="${prop}: ${v}"], [style*="; ${prop}: ${v}"]):not(.lp-widget-treemap-tile, .lp-heatmap-cell, .lp-heatmap-top *) { ${lp}: ${variable(prop, v, true, valeurs.map((x) => x ?? v))}; }\n`;
  }
  for (const [media, sel] of inkDecls) {
    if (/weekend|legend-line|auth|landing/.test(sel)) continue;
    const actif = /active|primary|selection|count|fill|bar-current|bulkbar/.test(sel);
    const d = actif ? 'background: var(--c-accent) !important; color: var(--c-on-accent) !important; border-color: var(--c-accent) !important'
      : 'background: var(--nx-ink-fill) !important; color: var(--nx-ink-on) !important';
    const r = `${scope(sel, ANY)} { ${d}; }`; regles += media ? `@media ${media} { ${r} }\n` : r + '\n';
  }
  // 2. Valeurs par thème × mode.
  let valeurs = '';
  modes.forEach(({ ch, m, t }, i) => {
    const S = `:root[data-nexora-theme="${ch.id}"][data-nexora-mode="${m}"]`;
    valeurs += tokenBlock(ch, m, t).replaceAll(`:root[data-charte="${ch.id}"][data-mode="${m}"]`, S);
    valeurs += `${S} {\n  --nx-ink-fill: ${t.dark ? 'var(--c-tooltip)' : 'var(--ink)'}; --nx-ink-on: ${t.dark ? '#fff' : 'var(--c-surface)'};\n`;
    for (const { nom, valeurs: v } of vars.values()) valeurs += `  ${nom}: ${v[i]};\n`;
    valeurs += '}\n';
  });
  // 3. Socle et signatures.
  let composants = '';
  for (const ch of chartes) {
    const S0 = `:root[data-nexora-theme="${ch.id}"]`;
    const conv = (css) => css.replaceAll('§[data-mode=', `${S0}[data-nexora-mode=`).replaceAll('§', S0);
    composants += conv(base) + '\n' + conv(readFileSync(here(`./signatures/${ch.id}.css`), 'utf8'));
  }
  const entete = `/* Thèmes Nexora (Ref #621) — GÉNÉRÉ par docs/chartes-graphiques/outils/integration.mjs, ne pas éditer à la main.\n   Thèmes : ${chartes.map((c) => c.nom).join(', ')}. Activation : <html data-nexora-theme="…" data-nexora-mode="clair|sombre">.\n   ${groupes.size} règles de remappage partagées, ${vars.size} variables par thème × mode. */\n`;
  return entete + valeurs + regles + composants;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const source = readFileSync(SOURCE, 'utf8');
  const bloc = `${DEBUT}\n${genererCouche()}${FIN}\n`;
  const a = source.indexOf(DEBUT), b = source.indexOf(FIN);
  const nouveau = a === -1 ? source.replace('</body>', bloc + '</body>') : source.slice(0, a) + bloc.trimEnd() + source.slice(b + FIN.length);
  if (process.argv.includes('--check')) {
    if (nouveau !== source) { console.error('La couche de thèmes de part-004 n\'est pas à jour : relancer integration.mjs'); process.exit(1); }
    console.log('Couche de thèmes à jour.');
  } else { writeFileSync(SOURCE, nouveau); console.log('Couche de thèmes écrite :', (bloc.length / 1024).toFixed(0), 'Ko'); }
}
