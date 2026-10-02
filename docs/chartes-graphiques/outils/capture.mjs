import { open } from './lib.mjs';
import { seedEntries } from './seed.mjs';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
const [, , outDir = 'shots/base', cssFile = '', attrs = '', only = '', fontsUrl = ''] = process.argv;
mkdirSync(outDir, { recursive: true });
const seed = seedEntries();
const css = cssFile && existsSync(cssFile) ? readFileSync(cssFile, 'utf8') : '';
const init = `(() => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); const s = ${JSON.stringify(seed)}; for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded','1'); } })();`;
const { b, p } = await open({ init });
const W = (k, v) => JSON.stringify({ key: 'nexora:' + k, value: JSON.stringify(v), updatedAt: new Date().toISOString(), revision: 'r' + Math.random(), source: 'demo', storageMode: 'inline', chunkCount: 0 });
async function load(pref, dash) {
  if (p.url().startsWith('http')) { await p.waitForTimeout(1500); }
  if (p.url().startsWith('http')) await p.evaluate(({ a, b, c }) => { localStorage.setItem('nexora-demo:v1:nexora:startupPref', a); if (c) localStorage.setItem('nexora-demo:v1:nexora:activeDashboardId', b); }, { a: W('startupPref', pref), b: W('activeDashboardId', dash), c: !!dash });
  await p.goto('http://127.0.0.1:8888/', { waitUntil: 'networkidle', timeout: 180000 });
  if (!p.__seeded) { p.__seeded = 1; return load(pref, dash); }
  await p.waitForTimeout(2500);
  await p.evaluate(({ css, attrs, fontsUrl }) => {
    attrs.split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); document.documentElement.setAttribute(k, v); });
    if (fontsUrl) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = fontsUrl; document.head.appendChild(l); }
    if (css) { const st = document.createElement('style'); st.id = 'charte-css'; st.textContent = css; document.body.appendChild(st); }
  }, { css, attrs, fontsUrl });
  await p.waitForTimeout(1200); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
  await p.keyboard.press('Escape');
  const ign = p.getByRole('button', { name: 'Ignorer', exact: true }); if (await ign.count()) { await ign.first().click().catch(() => {}); await p.waitForTimeout(400); }
}
const view = (v) => () => load({ mode: 'view', value: v });
const dash = (id) => () => load({ mode: 'dashboard', value: id }, id);
const scenes = [
  ['01-dashboard-pilotage', dash('d1')],
  ['02-dashboard-planning-equipe', dash('d2')],
  ['03-dashboard-suivi', dash('d3')],
  ['04-planning-projets', view('projects')],
  ['05-gantt', view('gantt')],
  ['06-aujourdhui', view('today')],
  ['07-calendrier', view('calendar')],
  ['08-tableur', view('table')],
  ['09-fiche-tache', async () => { await dash('d1')(); await p.getByText('Réunion Expert', { exact: true }).first().click(); await p.waitForTimeout(1500); }],
];
for (const [name, go] of scenes) {
  if (only && !only.split(',').some(o => name.startsWith(o))) continue;
  try { await go(); await p.mouse.move(5, 995); await p.waitForTimeout(400); await p.screenshot({ path: `${outDir}/${name}.png` }); console.log('ok', name);
    if (name.includes('dashboard')) { const cards = p.locator('.lp-widget-card'); const n = await cards.count(); for (let i = 0; i < n; i++) { const c = cards.nth(i); const t = ((await c.locator('.lp-widget-title').first().textContent().catch(() => '')) || 'w' + i).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); await c.screenshot({ path: `${outDir}/widget-${t}.png` }).catch(() => {}); } } } catch (e) { console.log('FAIL', name, String(e).slice(0, 150)); }
}
await b.close();
