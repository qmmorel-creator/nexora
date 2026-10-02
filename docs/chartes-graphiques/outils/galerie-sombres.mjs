// Génère docs/chartes-graphiques/sombres/index.html : galerie des dix thèmes sombres (Ref #625).
//   node galerie-sombres.mjs [chemin version Artifact]
import { writeFileSync } from 'node:fs';
import { CHARTES } from './sombres.mjs';
import { SOMBRES, PRINCIPES } from './contenu-sombres.mjs';
import { contrast } from './color.mjs';

const VUES = [['01-dashboard-pilotage', 'Pilotage'], ['02-dashboard-planning-equipe', 'Planning & équipe'], ['03-dashboard-suivi', 'Suivi'], ['04-planning-projets', 'Planning Projets'], ['05-gantt', 'Gantt'], ['06-aujourdhui', "Aujourd'hui"], ['07-calendrier', 'Calendrier'], ['08-tableur', 'Tableur'], ['10-heatmap', 'Heat map'], ['11-pixel-tasks', 'Pixel Tasks'], ['09-fiche-tache', 'Fiche tâche']];
const WIDGETS = [['taches-actives', 'Indicateur'], ['taches-par-projet', 'Barres'], ['repartition-par-statut', 'Secteurs'], ['prochaines-echeances', 'Liste'], ['mini-gantt-chantiers', 'Mini-Gantt'], ['calendrier', 'Calendrier'], ['charge-personnel', 'Charge personnel'], ['heat-map-mensuelle', 'Heat map mensuelle'], ['chemin-critique', 'Chemin critique'], ['note-de-chantier', 'Note'], ['treemap-projets', 'Treemap'], ['bulles', 'Bulles']];
const r = (t, a, b) => contrast(t[a], t[b]).toFixed(1);
const data = CHARTES.map((c) => { const t = c.modes.sombre; return {
  id: c.id, num: c.num, nom: c.nom, devise: c.devise, dir: `${c.num}-${c.id}`, pour: SOMBRES[c.id].pour, signature: SOMBRES[c.id].signature,
  display: c.fonts.display, police: c.fonts.display.split(',')[0].replaceAll("'", ''), sw: [t.bg, t.surface, t.border, t.text, t.accent, t.signal],
  bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, accent: t.accent, onAccent: t.onAccent, border: t.border,
  mesures: [['texte', r(t, 'text', 'surface')], ['discret', r(t, 'muted', 'surface')], ['bouton', r(t, 'onAccent', 'accent')]],
}; });
const fonts = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&' + [...new Set(CHARTES.map((c) => c.googleFonts.split('&').filter((f) => !/JetBrains/.test(f))).flat())].join('&') + '&display=swap';

const html = `<title>Nexora, thèmes sombres</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta charset="utf-8">
<link rel="stylesheet" href="${fonts}">
<style>
/* Page volontairement sombre (sujet : thèmes sombres). Mise en page : sélecteur de thème en bandeau,
   visionneuse (capture + fiche), bande de vues, grille de widgets ; les couleurs de la fiche suivent le thème choisi. */
:root { color-scheme: dark;
  --bg: #0E0F12; --panel: #16181D; --line: #272A32; --ink: #ECECEF; --ink-2: #A8ABB5; --t-accent: #E3B567; --t-bg: #0F1318; --t-surface: #161B22; --t-text: #ECE7DD; --t-muted: #938D82; --t-on: #1A1408; --t-border: #28303A;
  --display: 'Bricolage Grotesque', system-ui, sans-serif; --body: 'Public Sans', system-ui, sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace; }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.55 var(--body); padding-inline: 16px; padding-block: 0 72px; }
.wrap { max-width: 1280px; margin: 0 auto; display: grid; gap: 36px; }
header { padding-top: 44px; display: grid; gap: 12px; max-width: 70ch; }
h1, h2, h3 { margin: 0; text-wrap: balance; }
h1 { font: 800 clamp(32px, 4.6vw, 52px)/1.02 var(--display); letter-spacing: -0.03em; }
h1 em { font-style: normal; color: var(--t-accent); transition: color .3s; }
h3 { font: 600 12px var(--mono); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.lead { color: var(--ink-2); font-size: 17px; margin: 0; }
.choix { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
.choix button { display: grid; gap: 7px; text-align: left; padding: 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel); color: var(--ink); cursor: pointer; font: inherit; min-width: 0; }
.choix button[aria-pressed="true"] { border-color: var(--t-accent); box-shadow: 0 0 0 1px var(--t-accent), 0 10px 30px -12px var(--t-accent); }
.choix .sw { display: flex; height: 26px; border-radius: 5px; overflow: hidden; }
.choix .sw i { flex: 1; }
.choix b { font: 700 14px var(--display); }
.choix span { font: 500 11px var(--mono); color: var(--ink-2); }
.scene { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 18px; align-items: start; }
.ecran { border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: var(--panel); }
.ecran img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; object-position: top left; cursor: zoom-in; }
.fiche { border-radius: 12px; padding: 18px; display: grid; gap: 16px; background: var(--t-surface); color: var(--t-text); border: 1px solid var(--t-border); transition: background .3s, color .3s; }
.fiche .nom { font-size: 34px; line-height: 1; font-weight: 700; }
.fiche p { margin: 0; }
.fiche .devise { color: var(--t-muted); font-size: 14px; }
.fiche ul { margin: 0; padding-left: 18px; display: grid; gap: 6px; font-size: 13.5px; }
.mesures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.mesures div { border: 1px solid var(--t-border); border-radius: 8px; padding: 7px 8px; }
.mesures b { display: block; font: 500 17px var(--mono); font-variant-numeric: tabular-nums; }
.mesures span { font-size: 11px; color: var(--t-muted); }
.pour { font-size: 13.5px; border-left: 3px solid var(--t-accent); padding-left: 10px; }
.lien { color: var(--t-accent); font-size: 13px; }
.vues { display: flex; flex-wrap: wrap; gap: 6px; }
.vues button { font: 500 13px var(--body); color: var(--ink-2); background: var(--panel); border: 1px solid var(--line); border-radius: 999px; padding: 6px 13px; cursor: pointer; }
.vues button[aria-pressed="true"] { color: var(--t-on); background: var(--t-accent); border-color: var(--t-accent); }
.widgets { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 10px; }
.widgets button { padding: 0; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--panel); cursor: zoom-in; display: grid; text-align: left; min-width: 0; }
.widgets img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; object-position: top left; display: block; }
.widgets span { font-size: 12px; padding: 6px 8px; color: var(--ink-2); }
.principes { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
.principes div { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; display: grid; gap: 4px; min-width: 0; }
.principes b { font: 700 15px var(--display); }
.principes span { color: var(--ink-2); font-size: 13.5px; }
button:focus-visible { outline: 2px solid var(--t-accent); outline-offset: 2px; }
dialog { border: 0; padding: 0; background: transparent; max-width: 96vw; }
dialog::backdrop { background: rgba(0,0,0,.85); }
dialog img { max-width: 96vw; max-height: 90vh; display: block; border-radius: 8px; }
footer { color: var(--ink-2); font-size: 13px; max-width: 80ch; }
@media (max-width: 920px) { .scene { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
<div class="wrap">
  <header>
    <h3>Nexora · Réf. #625</h3>
    <h1>Dix thèmes sombres, <em>faits pour être lus</em></h1>
    <p class="lead">Captures réelles de l'application avec données de démonstration. Choisissez un thème, puis une vue : la fiche à droite prend les couleurs du thème choisi. Chaque thème a passé un audit automatique de contraste sur 11 vues et 15 widgets.</p>
  </header>
  <section style="display:grid;gap:12px"><h3>Thème</h3><div class="choix" id="choix" role="group" aria-label="Thème"></div></section>
  <section style="display:grid;gap:12px">
    <div class="vues" id="vues" role="group" aria-label="Vue"></div>
    <div class="scene"><div class="ecran"><img id="ecran" alt="" width="1600" height="1000"></div><aside class="fiche" id="fiche"></aside></div>
  </section>
  <section style="display:grid;gap:12px"><h3>Widgets dans ce thème</h3><div class="widgets" id="widgets"></div></section>
  <section style="display:grid;gap:12px"><h3>Principes communs de lecture en sombre</h3><div class="principes">${PRINCIPES.map(([t, d]) => `<div><b>${t}</b><span>${d}</span></div>`).join('')}</div></section>
  <footer>Graphiques : heat map inversée en luminance (vide discret, plein lumineux), aplats de données assombris sous le texte blanc, voile des fenêtres sombre, pistes d'anneaux et cases vides rendues visibles. Aucun de ces thèmes n'est encore activé en production ; ceux que vous retiendrez rejoindront Bauhaus et Dessau dans Réglages → Apparence.</footer>
</div>
<dialog id="zoom"><img alt=""></dialog>
<script>
const T = ${JSON.stringify(data)};
const VUES = ${JSON.stringify(VUES)};
const WIDGETS = ${JSON.stringify(WIDGETS)};
const etat = { t: T[0], vue: VUES[0][0] };
const el = (tag, a = {}, ...k) => { const e = document.createElement(tag); for (const x in a) x === 'text' ? (e.textContent = a[x]) : e.setAttribute(x, a[x]); k.forEach((y) => y && e.append(y)); return e; };
const src = (f) => etat.t.dir + '/captures/' + f + '.webp';
const zoom = document.getElementById('zoom'); zoom.onclick = () => zoom.close();
const ouvrir = (s, l) => { const i = zoom.querySelector('img'); i.src = s; i.alt = l; zoom.showModal(); };
document.getElementById('ecran').onclick = (e) => ouvrir(e.target.src, e.target.alt);
function rendre() {
  const t = etat.t, R = document.documentElement.style;
  [['--t-accent', t.accent], ['--t-bg', t.bg], ['--t-surface', t.surface], ['--t-text', t.text], ['--t-muted', t.muted], ['--t-on', t.onAccent], ['--t-border', t.border]].forEach(([k, v]) => R.setProperty(k, v));
  document.querySelectorAll('#choix button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === t.id)));
  document.querySelectorAll('#vues button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === etat.vue)));
  const img = document.getElementById('ecran'); const lv = VUES.find((v) => v[0] === etat.vue)[1];
  img.src = src(etat.vue); img.alt = t.nom + ' — ' + lv;
  const m = el('div', { class: 'mesures' }); t.mesures.forEach(([l, v]) => m.append(el('div', {}, el('b', { text: v + ':1' }), el('span', { text: l }))));
  const ul = el('ul'); t.signature.forEach((s) => ul.append(el('li', { text: s })));
  document.getElementById('fiche').replaceChildren(
    el('h3', { text: t.num + ' · ' + t.police }), el('div', { class: 'nom', style: 'font-family:' + t.display, text: t.nom }), el('p', { class: 'devise', text: t.devise }),
    el('p', { class: 'pour', text: t.pour }), ul, m, el('a', { class: 'lien', href: t.dir + '/nexora-' + t.id + '.css', text: 'Feuille nexora-' + t.id + '.css' }));
  document.getElementById('widgets').replaceChildren(...WIDGETS.map(([f, l]) => { const s = src('widget-' + f); const b = el('button', { type: 'button', title: l }, el('img', { src: s, alt: l, loading: 'lazy' }), el('span', { text: l })); b.onclick = () => ouvrir(s, t.nom + ' — ' + l); return b; }));
}
const choix = document.getElementById('choix');
T.forEach((t) => { const sw = el('span', { class: 'sw' }); t.sw.forEach((c) => sw.append(el('i', { style: 'background:' + c }))); const b = el('button', { type: 'button', 'data-id': t.id }, sw, el('b', { text: t.nom }), el('span', { text: t.num })); b.onclick = () => { etat.t = t; rendre(); }; choix.append(b); });
const vues = document.getElementById('vues');
VUES.forEach(([f, l]) => { const b = el('button', { type: 'button', 'data-v': f, text: l }); b.onclick = () => { etat.vue = f; rendre(); }; vues.append(b); });
rendre();
</script>
`;
writeFileSync(new URL('../sombres/index.html', import.meta.url), '<!doctype html>\n<html lang="fr">\n' + html + '</html>\n');
if (process.argv[2]) writeFileSync(process.argv[2], html);
console.log('galerie sombres écrite');
