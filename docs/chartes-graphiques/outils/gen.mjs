import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { CHARTES } from './palettes.mjs';
import { tokenBlock } from './tokens.mjs';
import { mapValue, mapColor, scopeSelector, kindOfProp } from './remap.mjs';
import { parse, fmt } from './color.mjs';
const here = (f) => new URL(f, import.meta.url);
const decls = JSON.parse(readFileSync(here('./donnees/css-colors.json')));
const harvest = JSON.parse(readFileSync(here('./donnees/harvest.json')));
const inkDecls = JSON.parse(readFileSync(here('./donnees/css-inkvars.json'))).filter((x) => /^(background|background-color)$/.test(x[2]) && /var\(--(ink|text-primary|text-900|craie|life-text)\b/.test(x[3]));
const base = readFileSync(here('./base.css'), 'utf8');
const TOKEN_PROPS = /^--(life-|bg$|surface|border|text-|graphite|line-blue|quai|craie|brume|rail|accent|signal|success|warning|danger|font-|fs-|ink|paper|blueprint|radius)/;
mkdirSync(here('./sortie/'), { recursive: true });
const stats = {};
for (const ch of CHARTES) {
  const parts = [`/* Nexora — charte « ${ch.nom} » (${ch.num}). ${ch.devise}\n   Couche de présentation seule : activer avec <html data-charte="${ch.id}" data-mode="clair|sombre">.\n   Polices : https://fonts.googleapis.com/css2?${ch.googleFonts}&display=swap */\n`];
  for (const [mode, t] of Object.entries(ch.modes)) {
    const S = `:root[data-charte="${ch.id}"][data-mode="${mode}"]`;
    parts.push(`\n/* ====== Thème ${mode} : tokens ====== */\n` + tokenBlock(ch, mode, t));
    // Remappage des couleurs codées en dur des feuilles de Nexora.
    const groups = new Map(); const roles = [];
    for (const [media, sel, prop, val, prio] of decls) {
      if (TOKEN_PROPS.test(prop)) continue;
      if (t.dark && /treemap-tile|treemap-chip|tm-tile/.test(sel) && kindOfProp(prop) === 'text') continue; // texte posé sur aplat de donnée
      const nv = mapValue(val, prop, t, roles); if (!nv) continue;
      const key = media + '¤' + sel; if (!groups.has(key)) groups.set(key, { media, sel, d: [] });
      groups.get(key).d.push(`${prop}: ${nv}${prio ? ' !important' : ''}`);
    }
    let css = '';
    for (const { media, sel, d } of groups.values()) {
      const rule = `${scopeSelector(sel, S)} { ${d.join('; ')}; }`;
      css += media ? `@media ${media} { ${rule} }\n` : rule + '\n';
    }
    // Attributs SVG fill/stroke et styles en ligne récurrents.
    for (const k of Object.keys(harvest.attr)) {
      const [a, v] = k.split('='); const r = mapColor(v, a === 'fill' ? 'fill' : 'border', t);
      if (r) css += `${S} [${a}="${v}"] { ${a}: ${fmt(r[0], r[1])}; }\n`;
    }
    for (const k of Object.keys(harvest.inl)) {
      const m = k.match(/^([a-z-]+): ((?:rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}))$/); if (!m) continue;
      const [, prop, v] = m; if (kindOfProp(prop) === 'text') continue; // couleurs de texte calculées par contraste : intactes
      const r = mapColor(v, kindOfProp(prop), t); if (!r) continue;
      const lp = prop === 'background' ? 'background-color' : prop === 'border' ? 'border-color' : prop;
      css += `${S} :is([style^="${prop}: ${v}"], [style*="; ${prop}: ${v}"]):not(.lp-widget-treemap-tile) { ${lp}: ${fmt(r[0], r[1])} !important; }\n`;
    }
    // Aplats « encre » : actifs/primaires → accent ; autres → aplat d'info-bulle en sombre.
    for (const [media, sel, , , prio] of inkDecls) {
      if (/weekend|legend-line|auth|landing/.test(sel)) continue;
      const active = /active|primary|selection|count|fill|bar-current|bulkbar/.test(sel);
      if (!active && !t.dark) continue;
      const imp = ' !important';
      const d = active ? `background: var(--c-accent)${imp}; color: var(--c-on-accent)${imp}; border-color: var(--c-accent)${imp}` : `background: var(--c-tooltip)${imp}; color: #fff${imp}`;
      const rule = `${scopeSelector(sel, S)} { ${d}; }`;
      css += media ? `@media ${media} { ${rule} }\n` : rule + '\n';
    }
    stats[ch.id + '/' + mode] = { regles: groups.size, roles: roles.reduce((o, r) => ((o[r] = (o[r] || 0) + 1), o), {}) };
    parts.push(`\n/* ====== Thème ${mode} : remappage des couleurs codées en dur (${groups.size} règles générées) ====== */\n` + css);
  }
  const S0 = `:root[data-charte="${ch.id}"]`;
  parts.push('\n' + base.replaceAll('§', S0));
  parts.push('\n' + readFileSync(here(`./signatures/${ch.id}.css`), 'utf8').replaceAll('§', S0));
  writeFileSync(here(`./sortie/${ch.id}.css`), parts.join(''));
}
writeFileSync(here('./sortie/stats.json'), JSON.stringify(stats, null, 1));
console.log(JSON.stringify(stats));
