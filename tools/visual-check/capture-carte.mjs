// Captures du code publié, dans le banc hors ligne et avec ses seules données fictives.
import http from "node:http";
import path from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { buildHarness } from "./build-harness.mjs";
const dir = await buildHarness();
const out = path.resolve("captures-carte");
await mkdir(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".png": "image/png", ".glb": "model/gltf-binary" };
const server = http.createServer(async (req, res) => {
  const relative = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(dir, "." + (relative === "/" ? "/index.html" : relative));
  if (!file.startsWith(dir + path.sep)) return res.writeHead(403).end();
  try { const body = await readFile(file); res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
try {
  browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(90000);
  page.on("pageerror", (e) => errors.push(e.message));
  // Aucun accès Firebase ni à un compte réel. Les CDN sont remplacés par le banc.
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(origin + "/") || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
    return route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") });
  });
  await page.goto(origin + "/index.html?app=1&view=carte&carte=demo", { waitUntil: "load" });
  await page.waitForSelector('.lp-carte-stage[data-carte-status="ready"]');
  for (let i = 0; i < 3; i++) {
    const close = page.locator('.lp-modal [aria-label="Fermer"]');
    if (!await close.count()) break;
    await close.first().click();
  }
  await page.waitForFunction(() => window.__carteBench?.engine?.fxState().models, { timeout: 90000 });
  await page.evaluate(() => { window.__carteBench.engine.setQuality("high"); window.__carteBench.engine.overview(); });
  await page.waitForTimeout(5000);
  const cdp = await page.context().newCDPSession(page);
  const shot = async (name) => {
    const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(out, name), Buffer.from(data, "base64"));
  };
  await shot("nexora-carte-vue-ensemble.png");
  assert.equal(await page.evaluate(() => window.__carteBench.engine.frameProject("banc-p6", 18, 0.65)), true);
  await page.waitForTimeout(2500);
  await shot("nexora-carte-jardin.png");
  assert.equal(await page.evaluate(() => window.__carteBench.engine.frameProject("banc-p4", 22, 0.65)), true);
  await page.waitForTimeout(2500);
  await shot("nexora-carte-chantier.png");
  const diagnostics = await page.evaluate(() => ({ ...window.__carteBench.engine.performanceStats(), effects: window.__carteBench.engine.fxState() }));
  await writeFile(path.join(out, "diagnostics.json"), JSON.stringify({ productionCommit: process.env.PRODUCTION_COMMIT, renderer: "Chromium SwiftShader — données de démonstration", diagnostics, errors }, null, 2));
  assert.deepEqual(errors, []);
  console.log("Trois captures 3D écrites ; modèles chargés ; aucune erreur JavaScript.");
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
