import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const CACHE = new URL('./cache/', import.meta.url).pathname; mkdirSync(CACHE, { recursive: true });
function viaCurl(url) {
  const h = createHash('sha1').update(url).digest('hex');
  const f = CACHE + h, m = f + '.json';
  if (!existsSync(f)) {
    const hdr = execFileSync('curl', ['-sSL', '--retry', '3', '-A', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36', '-D', '-', '-o', f, url], { maxBuffer: 1e8 }).toString();
    const blocks = hdr.trim().split(/\r?\n\r?\n/); const last = blocks[blocks.length - 1];
    const ct = (last.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || 'application/javascript';
    const st = +(last.match(/HTTP\/\S+\s+(\d+)/) || [0, 200])[1];
    writeFileSync(m, JSON.stringify({ ct, st }));
  }
  const { ct, st } = JSON.parse(readFileSync(m, 'utf8'));
  return { status: st, contentType: ct, body: readFileSync(f), headers: { 'access-control-allow-origin': '*' } };
}
export async function open({ width = 1600, height = 1000, init } = {}) {
  const b = await chromium.launch({ args: ['--proxy-server=http://127.0.0.1:44355', '--proxy-bypass-list=<-loopback>;127.0.0.1'] });
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.route(/^https:\/\//, async (r) => { try { const res = viaCurl(r.request().url()); await r.fulfill({ ...res, headers: { ...res.headers, 'content-type': res.contentType } }); } catch (e) { await r.abort(); } });
  if (init) await ctx.addInitScript(init);
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERR', String(e).slice(0, 200)));
  return { b, ctx, p };
}
