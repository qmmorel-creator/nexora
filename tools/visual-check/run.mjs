// Contrôle visuel hors ligne : construit le banc d'essai, ouvre les deux
// diagrammes dans un navigateur, vérifie la géométrie des annotations et écrit
// une capture. Sort en erreur si un contrôle échoue.
import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { buildHarness } from "./build-harness.mjs";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".png": "image/png", ".json": "application/json" };

function serve(dir) {
  const server = http.createServer(async (req, res) => {
    const rel = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(dir, rel === "/" ? "index.html" : rel);
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" }).end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ["playwright", "playwright-core"]) {
    try { return require(id); } catch { /* essai suivant */ }
  }
  return null;
}

const dir = await buildHarness();
const playwright = loadPlaywright();
if (!playwright) {
  console.log(`Banc d'essai construit : ${dir}`);
  console.log("playwright n'est pas installé — ouvrir le banc à la main :");
  console.log(`  npx http-server ${path.relative(process.cwd(), dir)}`);
  process.exit(0);
}

const { server, port } = await serve(dir);
const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await playwright.chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
// Babel signale en console qu'il ne stylise pas un script de plus de 500 Ko :
// c'est attendu pour un fichier de 2,5 Mo, et sans effet sur le rendu.
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("[BABEL]")) pageErrors.push("console: " + m.text()); });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load", timeout: 90000 });
await page.waitForSelector(".lp-gantt-wrap", { timeout: 90000 });
await page.waitForTimeout(2500);

const seen = await page.evaluate(() => {
  const rects = (sel) => [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim() };
  });
  return {
    ganttBlocks: document.querySelectorAll(".lp-gantt-tblock").length,
    ganttBlockLabels: rects(".lp-gantt-tblock-label"),
    ganttFrames: rects(".lp-gantt-frame"),
    ganttFrameLabels: rects(".lp-gantt-frame-label"),
    miniBlocks: document.querySelectorAll(".lp-widget-minigantt-tblock").length,
    miniPhases: rects(".lp-widget-minigantt-phase"),
    miniFrames: rects(".lp-widget-minigantt-frame"),
    miniFrameLabels: rects(".lp-widget-minigantt-frame-label"),
    miniRows: rects(".lp-widget-minigantt-row"),
    miniBands: rects(".lp-widget-minigantt-tblock"),
  };
});

const shot = path.join(dir, "annotations.png");
await page.screenshot({ path: shot, fullPage: true });
await browser.close();
server.close();

// --- Contrôles -------------------------------------------------------------
// Le scénario pose deux blocs et deux encadrés par diagramme, dont « Jalons
// clés » sur des tâches NON successives : il doit donner deux cadres, donc
// trois cadres au total par diagramme.
const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

expect(pageErrors.length === 0, `erreurs JavaScript au rendu :\n    ${pageErrors.slice(0, 5).join("\n    ")}`);
expect(seen.ganttBlocks > 0, "Gantt complet : aucun bloc temporel dessiné");
expect(seen.ganttBlockLabels.length === 2, `Gantt complet : ${seen.ganttBlockLabels.length} étiquette(s) de bloc, 2 attendues`);
expect(seen.ganttFrames.length === 3, `Gantt complet : ${seen.ganttFrames.length} cadre(s), 3 attendus (l'encadré non successif doit en produire deux)`);
expect(seen.miniBlocks === 2, `Mini-Gantt : ${seen.miniBlocks} bloc(s) temporel(s), 2 attendus`);
expect(seen.miniPhases.length === 2, `Mini-Gantt : ${seen.miniPhases.length} titre(s) de bloc dans la bande d’en-tête, 2 attendus`);
expect(seen.miniFrames.length === 3, `Mini-Gantt : ${seen.miniFrames.length} cadre(s), 3 attendus`);

// « Le bloc temporel emporte tout » : une bande continue sur toute la hauteur des
// lignes, en-têtes de groupe et interlignes compris — et non un morceau par
// groupe, ce qui laissait une bande claire à chaque en-tête.
if (seen.miniRows.length && seen.miniBands.length) {
  const top = Math.min(...seen.miniRows.map((r) => r.y));
  const bottom = Math.max(...seen.miniRows.map((r) => r.y + r.h));
  seen.miniBands.forEach((band, i) => {
    expect(band.y <= top + 2, `Mini-Gantt : la bande ${i + 1} commence sous la première ligne (${band.y} > ${top})`);
    expect(band.y + band.h >= bottom - 2, `Mini-Gantt : la bande ${i + 1} s'arrête avant la dernière ligne (${band.y + band.h} < ${bottom})`);
  });
}

for (const [name, frames] of [["Gantt complet", seen.ganttFrames], ["Mini-Gantt", seen.miniFrames]]) {
  frames.forEach((f, i) => expect(f.w > 4 && f.h > 4, `${name} : cadre ${i + 1} de surface nulle (${f.w}×${f.h})`));
}

// Étiquettes lisibles : aucune ne doit en recouvrir une autre.
for (const [name, labels] of [["Gantt complet", seen.ganttFrameLabels], ["Mini-Gantt", seen.miniFrameLabels], ["Mini-Gantt (titres de bloc)", seen.miniPhases]]) {
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(!overlap, `${name} : les étiquettes « ${a.text} » et « ${b.text} » se superposent`);
    }
  }
}

console.log(`Capture : ${shot}`);
if (failures.length) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`Contrôle visuel : OK (${seen.ganttFrames.length} cadres et ${seen.ganttBlockLabels.length} blocs dans le Gantt complet, ${seen.miniFrames.length} cadres et ${seen.miniBlocks} blocs dans le Mini-Gantt)`);
