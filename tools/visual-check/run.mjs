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

// Le banc est HORS LIGNE par construction. Certaines données de démonstration
// portent une icône distante (une URL d'image dans un type de tâche) : la
// requête échoue, et cet échec réseau n'est pas un défaut de rendu. On la sert
// donc localement, plutôt que de relâcher le contrôle des erreurs de console.
const TRANSPARENT_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue();
  return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG });
});

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
    miniBlocks: document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-tblock").length,
    miniPhases: rects("#harness-first-minigantt .lp-widget-minigantt-phase"),
    miniFrames: rects("#harness-first-minigantt .lp-widget-minigantt-frame"),
    miniFrameLabels: rects("#harness-first-minigantt .lp-widget-minigantt-frame-label"),
    miniRows: rects("#harness-first-minigantt .lp-widget-minigantt-row"),
    miniBands: rects("#harness-first-minigantt .lp-widget-minigantt-tblock"),
    miniDecisions: rects("#harness-first-minigantt .lp-widget-minigantt-phase.is-decision"),
    miniRisks: rects(".lp-widget-minigantt-risk"),
    secondRisks: rects("#harness-second-minigantt .lp-widget-minigantt-risk"),
    secondBands: rects("#harness-second-minigantt .lp-widget-minigantt-tblock"),
    secondMetaChips: rects("#harness-second-minigantt .lp-widget-minigantt-phase.is-meta"),
    miniRiskLabels: rects("#harness-first-minigantt .lp-widget-minigantt-risk-label"),
    miniMarkers: rects("#harness-first-minigantt .lp-widget-minigantt-marker"),
    miniLegend: rects("#harness-first-minigantt .lp-widget-minigantt-legend-item"),
    scatterDots: rects("#harness-scatter .lp-widget-scatter-dot"),
    scatterLabels: rects("#harness-scatter .lp-widget-scatter-point-label"),
    scatterLaneLabels: rects("#harness-scatter .lp-widget-scatter-lane-label"),
    scatterTodayAxis: rects("#harness-scatter .lp-widget-scatter-axis-today"),
    // Le cadre de référence est le SVG lui-même, pas le conteneur du banc : ce
    // dernier a une marge intérieure, et un point ou une étiquette pouvait
    // déborder du dessin tout en restant « dans » le conteneur.
    scatterBox: (() => { const r = document.querySelector("#harness-scatter svg").getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    // Les points en retard portent une couleur d'alerte distincte : c'est la
    // lecture immédiate du widget, elle doit tenir dans le rendu, pas seulement
    // en logique. On relève la couleur plutôt que de la coder en dur ici — le
    // contrôle porte sur la distinction, pas sur une teinte précise.
    scatterDotFills: [...document.querySelectorAll("#harness-scatter .lp-widget-scatter-dot")]
      .map((el) => ({ fill: (el.getAttribute("fill") || "").toUpperCase(), x: Math.round(el.getBoundingClientRect().x) })),
    scatterLaneColors: [...document.querySelectorAll("#harness-scatter .lp-widget-scatter-lane-mark")]
      .map((el) => (el.getAttribute("fill") || "").toUpperCase()),
    windowDots: document.querySelectorAll("#harness-scatter-window .lp-widget-scatter-dot").length,
    windowBeyond: document.querySelectorAll("#harness-scatter-window .lp-widget-scatter-dot.is-beyond").length,
    windowOverflowText: [...document.querySelectorAll("#harness-scatter-window .lp-widget-scatter-overflow")].map((e) => e.textContent.trim()),
    windowTicks: [...document.querySelectorAll("#harness-scatter-window .lp-widget-scatter-tick")].map((e) => e.textContent.trim()),
    heatRowHeads: [...document.querySelectorAll("#harness-heatmap .lp-widget-hmgrid-rowhead")].map((e) => e.textContent.trim()),
    heatColHeads: [...document.querySelectorAll("#harness-heatmap .lp-widget-hmgrid-colhead")].map((e) => e.textContent.trim()),
    // Relevé VOLONTAIREMENT indépendant de la classe « is-empty » : s'en servir
    // pour désigner les cases vides reviendrait à vérifier la propriété avec la
    // chose même qu'on teste, et la garde ne pourrait plus échouer.
    heatCells: [...document.querySelectorAll("#harness-heatmap .lp-widget-hmgrid-cell")].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim(), bg: getComputedStyle(el).backgroundColor, w: Math.round(r.width), h: Math.round(r.height) };
    }),
    heatLateCells: [...document.querySelectorAll("#harness-heatmap-late .lp-widget-hmgrid-cell")].map((el) => ({
      text: el.textContent.trim(),
      bg: getComputedStyle(el).backgroundColor,
    })),
    scatterCritLanes: rects("#harness-scatter-crit .lp-widget-scatter-lane-label").map((r) => r.text),
    scatterEmptyText: (document.querySelector("#harness-scatter-empty .lp-widget-scatter.is-empty") || {}).textContent || "",
    statusTileNames: rects("#harness-treemap-status .lp-widget-treemap-tile-name").map((r) => r.text),
    statusTiles: rects("#harness-treemap-status .lp-widget-treemap-tile").map((r) => r.text),
    statusGroupLabels: rects("#harness-treemap-status .lp-widget-treemap-group-label").map((r) => r.text),
    statusEmpty: (document.querySelector("#harness-treemap-status .lp-empty, #harness-treemap-status .lp-widget-treemap-empty") || {}).textContent || "",
    miniRiskButton: [...document.querySelectorAll("#harness-first-minigantt button")].some((b) => b.textContent.trim() === "+ Risque"),
    miniFields: (() => {
      const host = document.querySelector("#harness-first-minigantt");
      const hb = host.getBoundingClientRect();
      return [...host.querySelectorAll(".lp-widget-minigantt-fields-aligned")].map((el) => {
        const b = el.getBoundingClientRect();
        const last = el.children.length ? el.children[el.children.length - 1].getBoundingClientRect() : null;
        return {
          // Ce qui dépasse de la colonne, et ce qui dépasse du widget lui-même.
          overflow: last ? Math.round(last.right - b.right) : 0,
          outside: last ? Math.round(last.right - hb.right) : 0,
        };
      });
    })(),
    miniBlockAlign: (() => {
      const host = document.querySelector("#harness-first-minigantt");
      const centre = (el) => { const b = el.getBoundingClientRect(); return b.x + b.width / 2; };
      return [...host.querySelectorAll(".lp-widget-minigantt-phase[data-block-id]")].map((chip) => {
        const band = host.querySelector(`.lp-widget-minigantt-tblock[data-block-id="${chip.getAttribute("data-block-id")}"]`);
        if (!band) return null;
        return { t: chip.textContent.trim(), gap: Math.round(Math.abs(centre(chip) - centre(band))) };
      }).filter(Boolean);
    })(),
    metro: (() => {
      const host = document.querySelector("#harness-metro");
      if (!host) return null;
      const hb = host.getBoundingClientRect();
      const rel = (el) => { const b = el.getBoundingClientRect(); return { t: el.textContent.trim().slice(0, 30), x: Math.round(b.x - hb.x), y: Math.round(b.y - hb.y), w: Math.round(b.width), h: Math.round(b.height) }; };
      const all = (sel) => [...host.querySelectorAll(sel)].map(rel);
      const axes = all(".lp-pm-original-axis");
      const rows = all(".lp-pm-row");
      return {
        bands: all(".lp-pm-tblock"),
        bandLabels: all(".lp-pm-tblock-label"),
        frames: all(".lp-pm-frame"),
        strip: all(".lp-pm-strip-item"),
        risks: all(".lp-pm-risk"),
        axisBottom: axes.length ? Math.max(...axes.map((a) => a.y + a.h)) : 0,
        firstRowTop: rows.length ? Math.min(...rows.map((r) => r.y)) : 0,
        layer: (() => { const el = host.querySelector(".lp-pm-annot-layer"); return el ? rel(el) : null; })(),
      };
    })(),
    treemapTiles: rects("#harness-treemap .lp-widget-treemap-tile"),
    treemapNames: rects("#harness-treemap .lp-widget-treemap-tile-name"),
    treemapRings: document.querySelectorAll("#harness-treemap .lp-widget-treemap-ring").length,
    treemapLegend: rects("#harness-treemap .lp-widget-treemap-legend-item"),
    treemapUpcoming: rects("#harness-treemap .lp-widget-treemap-upcoming-item"),
    treemapUpcomingNarrow: rects("#harness-treemap-narrow .lp-widget-treemap-upcoming-item"),
    treemapGroupTints: [...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-group")].map((el) => getComputedStyle(el).backgroundColor),
    treemapBox: (() => { const r = document.querySelector("#harness-treemap .lp-widget-treemap-scroll").getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    narrowTiles: rects("#harness-treemap-narrow .lp-widget-treemap-tile"),
    narrowBox: (() => { const r = document.querySelector("#harness-treemap-narrow .lp-widget-treemap-scroll").getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
  };
});

const shot = path.join(dir, "annotations.png");
await page.screenshot({ path: shot, fullPage: true });

// Treemap projets : le clic ouvre le bon projet, et la fiche du widget expose
// bien le filtre de taille, le filtre de coloration et les champs des tuiles.
const treemap = { opened: "", fieldRows: 0, colorModes: 0, sizeFilterFields: 0 };
try {
  const biggest = page.locator("#harness-treemap .lp-widget-treemap-tile").first();
  await biggest.click();
  await page.waitForTimeout(250);
  treemap.opened = (await page.locator("#harness-treemap-opened").innerText()).trim();
  await page.locator("#harness-open-treemap-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  treemap.colorModes = await page.locator(".lp-modal .lp-density-btn", { hasText: /Même filtre|Second filtre|Criticité moyenne/ }).count();
  treemap.fieldRows = await page.locator(".lp-modal .lp-gantt-annot-head").count();
  await page.locator(".lp-modal .lp-widget-appearance-toggle", { hasText: "Tâches comptées pour la surface" }).click();
  await page.waitForTimeout(300);
  treemap.sizeFilterFields = await page.locator(".lp-modal .lp-widget-appearance-panel .lp-filter-multiselect, .lp-modal .lp-widget-appearance-panel .lp-field").count();
  await page.locator(".lp-modal").getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(400);
} catch (error) {
  treemap.error = String(error).split("\n")[0];
}

// Poignée d'avancement du Mini-Gantt : elle doit rester SOUS le pointeur. Le
// geste est rejoué pour de vrai — appui, déplacement, relâchement — et l'écart
// final entre la poignée et la souris est mesuré. Un pourcentage calculé sur la
// piste entière plutôt que sur la barre laissait la poignée loin derrière.
const drag = { gap: null, before: null, after: null };
try {
  const handle = page.locator("#harness-first-minigantt .lp-widget-minigantt-progress-handle").first();
  const bar = page.locator("#harness-first-minigantt .lp-widget-minigantt-bar").first();
  // La souris de Playwright travaille en coordonnées de FENÊTRE : sans ce
  // défilement, la poignée resterait sous la ligne de flottaison et le geste
  // ne l'atteindrait jamais.
  await handle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const barBox = await bar.boundingBox();
  const handleBox = await handle.boundingBox();
  drag.before = Math.round(handleBox.x + handleBox.width / 2);
  // Cible : 75 % de la largeur de la barre, bien à droite de la position initiale.
  const targetX = Math.round(barBox.x + barBox.width * 0.75);
  const targetY = Math.round(barBox.y + barBox.height / 2);
  await page.mouse.move(drag.before, Math.round(handleBox.y + handleBox.height / 2));
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 12 });
  await page.waitForTimeout(200);
  await page.mouse.up();
  await page.waitForTimeout(250);
  const moved = await page.locator("#harness-first-minigantt .lp-widget-minigantt-progress-handle").first().boundingBox();
  drag.after = Math.round(moved.x + moved.width / 2);
  drag.gap = Math.abs(drag.after - targetX);
} catch (error) {
  drag.error = String(error).split("\n")[0];
}

/* Infobulle de la heat map mensuelle (issue #54). Deux pannes distinctes, que
   seul un rendu réel départage : une infobulle laissée dans l'arbre du widget
   se décale dès qu'un ancêtre porte un transform, et une infobulle collée à
   « pointeur + 12 » sort du cadre près d'un bord.

   Ce que le banc contrôle ici est ce qu'un test unitaire ne peut pas voir : où
   l'infobulle est RENDUE, et qu'elle tient dans la fenêtre. La bascule d'un
   bord à l'autre, elle, est une fonction pure — sept tests l'éprouvent sur les
   deux axes, y compris une infobulle plus large que la fenêtre. La reproduire
   ici demanderait de contraindre la fenêtre autour d'une case porteuse, sans
   rien prouver de plus. */
const infobulle = { parent: "", flipped: null, dansCadre: null, cursorX: null, tipLeft: null, marge: null };
try {
  const hote = "#harness-heatmap-month";
  await page.locator(hote).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const cases = page.locator(`${hote} .lp-widget-heatmap-cell`);
  const total = await cases.count();
  const vue = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
  // La case porteuse la plus à droite ET visible : c'est elle qui force la bascule.
  let cible = null;
  for (let i = 0; i < total; i++) {
    const boite = await cases.nth(i).boundingBox();
    if (!boite) continue;
    const cx = Math.round(boite.x + boite.width / 2), cy = Math.round(boite.y + boite.height / 2);
    if (cx < 0 || cx > vue.w || cy < 0 || cy > vue.h) continue;
    await page.mouse.move(cx, cy);
    await page.waitForTimeout(40);
    if (await page.locator(".lp-widget-heatmap-tip").count()) {
      if (!cible || cx > cible.cx) cible = { cx, cy };
    }
  }
  if (cible) {
    await page.mouse.move(cible.cx, cible.cy);
    await page.waitForTimeout(250);
    Object.assign(infobulle, await page.evaluate(({ cx }) => {
      const tip = document.querySelector(".lp-widget-heatmap-tip");
      if (!tip) return { parent: "(absente)" };
      const r = tip.getBoundingClientRect();
      return {
        parent: tip.parentElement === document.body ? "body" : String(tip.parentElement.className || tip.parentElement.tagName),
        flipped: r.left < cx,
        dansCadre: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
        cursorX: cx,
        tipLeft: Math.round(r.left),
        marge: Math.round(window.innerWidth - cx),
      };
    }, cible));
  } else {
    infobulle.parent = "(aucune case porteuse visible)";
  }
  await page.mouse.move(2, 2);
  await page.waitForTimeout(200);
} catch (error) {
  infobulle.error = String(error).split("\n")[0];
}

/* Bandeau de paramètres du widget (issue #56). Le contrôle porte sur ce qui
   défile SOUS le bandeau, pas sur le bandeau lui-même : la panne réelle était
   un axe collant calé sur une barre d'onglets absente, qui laissait une bande
   de 82 px où le contenu défilait à découvert. */
const bandeau = { axisTop: null, headOpaque: false, headZ: "", contentAboveAxis: 0, axisY: null, headBottom: null };
try {
  const hote = "#harness-metro-widget";
  await page.locator(hote).scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  // Faire défiler POUR DE VRAI : sans défilement, rien ne peut passer derrière.
  await page.locator(`${hote} .lp-widget-embed-body`).evaluate((el) => { el.scrollTop = 140; });
  await page.waitForTimeout(400);
  Object.assign(bandeau, await page.evaluate((sel) => {
    const axis = document.querySelector(`${sel} .lp-pm-sticky-axis-shell`);
    const head = document.querySelector(`${sel} .lp-widget-head`);
    const body = document.querySelector(`${sel} .lp-widget-embed-body`);
    const axisStyle = axis ? getComputedStyle(axis) : null;
    const headStyle = head ? getComputedStyle(head) : null;
    const axisBox = axis ? axis.getBoundingClientRect() : null;
    const headBox = head ? head.getBoundingClientRect() : null;
    const bg = headStyle ? headStyle.backgroundColor : "";
    /* Le seul contrôle qui dise vraiment « rien ne passe » : ce que le
       navigateur donne à voir juste sous le bandeau. Compter les boîtes ne
       conclut rien — le grand SVG du planning traverse légitimement l'axe, qui
       le recouvre. On interroge donc le rendu, à trois abscisses, sur la
       première ligne de pixels sous le bandeau. */
    let contentAboveAxis = 0;
    if (headBox && axis) {
      /* L'axe est volontairement transparent au pointeur — le planning reste
         cliquable dessous. Le sondage le rend donc cliquable le temps de la
         mesure, faute de quoi elementFromPoint le traverse et rapporte une
         panne là où l'affichage est juste. */
      const avant = axis.style.pointerEvents;
      axis.style.pointerEvents = "auto";
      for (const part of [0.3, 0.55, 0.8]) {
        const x = Math.round(headBox.left + headBox.width * part);
        const el = document.elementFromPoint(x, Math.round(headBox.bottom) + 3);
        if (!el) continue;
        const couvert = el === axis || axis.contains(el) || el.closest(".lp-widget-head");
        if (!couvert) contentAboveAxis++;
      }
      axis.style.pointerEvents = avant;
    }
    return {
      axisTop: axisStyle ? axisStyle.top : null,
      headOpaque: !!bg && bg !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(bg),
      headZ: headStyle ? headStyle.zIndex : "",
      contentAboveAxis,
      axisY: axisBox ? Math.round(axisBox.top) : null,
      headBottom: headBox ? Math.round(headBox.bottom) : null,
      bodyPadTop: body ? Math.ceil(parseFloat(getComputedStyle(body).paddingTop) || 0) : 0,
    };
  }, hote));
} catch (error) {
  bandeau.error = String(error).split("\n")[0];
}

/* Coche du Mini-Gantt (issue #48). Rien de ce qui suit n'est visible d'un test
   unitaire : la logique pose bien l'icône et le logo, c'est le RENDU qui décide
   de les afficher — et le premier lot ne les affichait pas.

   Le second Mini-Gantt est choisi parce qu'il n'a AUCUNE annotation propre :
   tout ce qui apparaît après la coche vient donc de la coche. */
const coche = { frames: 0, icons: 0, corners: 0, leftGap: null, rightGap: null, cornerInside: null, apres: 0 };
try {
  const hote = "#harness-second-minigantt";
  const boite = page.locator(`${hote} .lp-widget-minigantt-select`).first();
  await boite.scrollIntoViewIfNeeded();
  await boite.check();
  await page.waitForTimeout(400);
  Object.assign(coche, await page.evaluate((sel) => {
    const rect = (el) => (el ? el.getBoundingClientRect() : null);
    const cadre = rect(document.querySelector(`${sel} .lp-widget-minigantt-frame`));
    // La barre de la ligne cochée : c'est elle que le trait du cadre recoupait.
    const ligne = document.querySelector(`${sel} .lp-widget-minigantt-row.is-selected`)
      || document.querySelector(`${sel} .lp-widget-minigantt-row`);
    const barre = rect(ligne && ligne.querySelector(".lp-widget-minigantt-bar"));
    const coin = rect(document.querySelector(`${sel} .lp-widget-minigantt-frame-corner`));
    return {
      frames: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame`).length,
      icons: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame-label .lp-widget-minigantt-frame-icon`).length,
      corners: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame-corner`).length,
      leftGap: cadre && barre ? Math.round(barre.left - cadre.left) : null,
      rightGap: cadre && barre ? Math.round(cadre.right - barre.right) : null,
      // Le logo doit rester DANS la largeur du cadre : accroché par son bord
      // gauche, il déborderait à droite sans qu'aucune erreur ne se produise.
      cornerInside: cadre && coin ? Math.round(cadre.right - coin.right) : null,
    };
  }, hote));
  // Décocher doit tout retirer : sans cela le cadre s'accumulerait à chaque coche.
  await page.locator(`${hote} .lp-widget-minigantt-select`).first().uncheck();
  await page.waitForTimeout(400);
  coche.apres = await page.locator(`${hote} .lp-widget-minigantt-frame`).count();
} catch (error) {
  coche.error = String(error).split("\n")[0];
}

// Nuage des échéances : l'infobulle doit apparaître au survol MÊME à faible
// densité — c'est elle qui rend acceptable le masquage des étiquettes. Le clic
// doit ouvrir la tâche, et la fiche exposer le choix des couloirs.
const scatter = { tip: "", opened: "", laneOptions: 0, savedLaneField: "" };
try {
  const dot = page.locator("#harness-scatter .lp-widget-scatter-dot").first();
  await dot.hover();
  await page.waitForTimeout(250);
  scatter.tip = (await page.locator("#harness-scatter .lp-widget-scatter-tip").innerText()).trim();
  await dot.click();
  await page.waitForTimeout(250);
  scatter.opened = (await page.locator("#harness-scatter-opened").innerText()).trim();
  await page.locator("#harness-open-scatter-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  const laneSelect = page.locator(".lp-modal select").filter({ has: page.locator('option[value="criticality"]') }).first();
  scatter.laneOptions = await laneSelect.locator("option").count();
  // Enregistrer un autre couloir doit remonter jusqu'au widget : sans câblage
  // dans la fiche, le réglage se perdrait silencieusement à la sauvegarde.
  await laneSelect.selectOption("status");
  await page.locator(".lp-modal").getByRole("button", { name: /Enregistrer|Créer|Ajouter/ }).first().click();
  await page.waitForTimeout(500);
  scatter.savedLaneField = await page.evaluate(() =>
    [...document.querySelectorAll("#harness-scatter .lp-widget-scatter-lane-label")].map((e) => e.textContent).join("|"));
} catch (error) {
  scatter.error = String(error).split("\n")[0];
}

// Treemap par statut (issue #47) : la fiche doit proposer le champ qui porte
// les tuiles, et ne plus proposer ce qui n'a de sens que sur un projet.
const statusTreemap = { tileByOptions: 0, offersFolder: true, tileNameLabel: "" };
try {
  await page.locator("#harness-open-status-treemap-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  const tileBySelect = page.locator(".lp-modal select").filter({ has: page.locator('option[value="taskType"]') }).first();
  statusTreemap.tileByOptions = await tileBySelect.locator("option").count();
  statusTreemap.offersFolder = await page.locator(".lp-modal .lp-density-btn", { hasText: /^Dossier$/ }).count() > 0;
  statusTreemap.tileNameLabel = (await page.locator(".lp-modal .lp-gantt-annot-head").first().innerText()).trim();
  // Le CATALOGUE des champs disponibles, pas la liste des champs déjà retenus :
  // c'est lui que le champ des tuiles doit filtrer.
  await page.locator(".lp-modal").getByTitle("Champs disponibles").first().click();
  await page.waitForTimeout(300);
  statusTreemap.fieldLabels = (await page.locator(".lp-dropdown-group-label", { hasText: "Champs disponibles" })
    .locator("xpath=following-sibling::label").allInnerTexts()).map((t) => t.trim());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.locator(".lp-modal").getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(400);
} catch (error) {
  statusTreemap.error = String(error).split("\n")[0];
}

// Heat map (issue #51) : l'infobulle doit nommer le croisement, et la fiche
// proposer les deux axes ET la mesure.
const heatmap = { tip: "", axisOptions: 0, metricOptions: 0, savedCols: "" };
try {
  const plein = page.locator("#harness-heatmap .lp-widget-hmgrid-cell:not(.is-empty)").first();
  await plein.hover();
  await page.waitForTimeout(250);
  heatmap.tip = (await page.locator(".lp-widget-hmgrid-tip").innerText()).trim();
  await page.locator("#harness-open-heatmap-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  const lignes = page.locator(".lp-modal select").filter({ has: page.locator('option[value="month"]') }).first();
  heatmap.axisOptions = await lignes.locator("option").count();
  const mesure = page.locator(".lp-modal select").filter({ has: page.locator('option[value="criticality"]') }).nth(1);
  heatmap.metricOptions = await page.locator(".lp-modal select").filter({ has: page.locator('option[value="progress"]') }).first().locator("option").count();
  // Changer l'axe des colonnes doit remonter jusqu'au widget : sans câblage
  // dans la fiche, le réglage se perdrait à l'enregistrement.
  await page.locator(".lp-modal select").filter({ has: page.locator('option[value="month"]') }).nth(1).selectOption("criticality");
  await page.locator(".lp-modal").getByRole("button", { name: /Enregistrer|Créer|Ajouter/ }).first().click();
  await page.waitForTimeout(500);
  heatmap.savedCols = await page.evaluate(() =>
    [...document.querySelectorAll("#harness-heatmap .lp-widget-hmgrid-colhead")].map((e) => e.textContent.trim()).join("|"));
  void mesure;
} catch (error) {
  heatmap.error = String(error).split("\n")[0];
}

// Fiche de tâche d'un projet Google Calendar : la case « méta bloc » doit être
// présente, cochée pour cette tâche, et son habillage réglable au même endroit.
const taskMeta = { checkbox: 0, checked: false, controls: 0, hints: [], riskButton: 0, riskRows: 0, riskSeverities: 0 };
try {
  await page.locator("#harness-open-task-modal").click();
  await page.waitForSelector(".lp-modal #task-meta-block", { timeout: 10000 });
  const box = page.locator(".lp-modal #task-meta-block");
  taskMeta.checkbox = await box.count();
  taskMeta.checked = await box.isChecked();
  taskMeta.controls = await page.locator(".lp-modal .lp-density-btn", { hasText: /Phase|Fenêtre de décision|Pointillés|Continue/ }).count();
  taskMeta.hints = (await page.locator(".lp-modal .lp-gantt-annot-hint").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
  // Les risques de délai appartiennent à la tâche : ils doivent s'éditer ici.
  const addRisk = page.locator(".lp-modal").getByRole("button", { name: "Ajouter un risque de délai" });
  taskMeta.riskButton = await addRisk.count();
  if (taskMeta.riskButton) {
    await addRisk.click();
    await page.waitForTimeout(300);
    taskMeta.riskRows = await page.locator(".lp-modal .lp-gantt-annot-item").count();
    taskMeta.riskSeverities = await page.locator(".lp-modal .lp-density-btn", { hasText: /^(faible|moyen|élevé|critique)$/ }).count();
  }
  await page.locator(".lp-modal").getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(400);
} catch (error) {
  taskMeta.error = String(error).split("\n")[0];
}

// Recherche rapide des listes déroulantes des paramètres : on ouvre la fiche
// d'un risque, on filtre la liste des tâches et on vérifie que la sélection
// s'applique. Sans ce contrôle, une liste déroulante peut redevenir un <select>
// brut sans que rien ne le signale.
const dropdown = { triggers: 0, before: 0, after: 0, chosen: "" };
try {
  await page.locator("#harness-first-minigantt").getByRole("button", { name: "+ Jalon" }).click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  // Dans la fiche d'un jalon, la PREMIÈRE liste déroulante est le type ; la
  // seconde est la tâche rattachée, celle qu'on veut contrôler ici.
  const triggers = page.locator(".lp-modal .lp-activity-search-trigger");
  dropdown.triggers = await triggers.count();
  if (dropdown.triggers > 1) {
    await triggers.nth(1).click();
    await page.waitForSelector(".lp-activity-search-menu input", { timeout: 5000 });
    dropdown.before = await page.locator(".lp-activity-search-menu .lp-activity-search-option").count();
    await page.locator(".lp-activity-search-menu input").fill("revue");
    await page.waitForTimeout(250);
    dropdown.after = await page.locator(".lp-activity-search-menu .lp-activity-search-option").count();
    // « Aucune tâche » reste en tête de liste (le rattachement est facultatif) :
    // on clique l'option réellement cherchée, pas la première venue.
    await page.locator(".lp-activity-search-menu .lp-activity-search-option", { hasText: "Revue DOE" }).first().click();
    await page.waitForTimeout(250);
    dropdown.chosen = (await triggers.nth(1).innerText()).replace(/\s+/g, " ").trim();
  }
} catch (error) {
  dropdown.error = String(error).split("\n")[0];
}

// Portée des listes déroulantes : la fiche du widget est filtrée sur un seul
// projet, les tâches proposées doivent l'être aussi.
const scoped = { options: [], labels: [] };
try {
  // Referme d'abord la modale du widget, sinon son voile intercepte les clics.
  await page.locator(".lp-modal").getByRole("button", { name: "Terminé" }).click();
  await page.waitForTimeout(400);
  await page.locator("#harness-open-widget-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(500);
  await page.locator(".lp-modal .lp-widget-appearance-toggle", { hasText: "Jalons" }).click();
  await page.waitForTimeout(400);
  await page.locator(".lp-modal .lp-gantt-annot-head").last().click();
  await page.waitForTimeout(300);
  await page.locator(".lp-modal .lp-activity-search-trigger").nth(1).click();
  await page.waitForSelector(".lp-activity-search-menu", { timeout: 5000 });
  scoped.labels = (await page.locator(".lp-activity-search-menu .lp-activity-option-main").allTextContents())
    .filter((l) => l.trim() !== "Aucune tâche");
  scoped.options = await page.locator(".lp-activity-search-menu .lp-activity-search-option").allTextContents();
} catch (error) {
  scoped.error = String(error).split("\n")[0];
}

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
expect(seen.miniBlocks === 3, `Mini-Gantt : ${seen.miniBlocks} bande(s) de bloc, 3 attendues (2 phases + 1 fenêtre de décision)`);
expect(seen.miniPhases.length === 3, `Mini-Gantt : ${seen.miniPhases.length} titre(s) de bloc dans la bande d’en-tête, 3 attendus`);
expect(seen.miniDecisions.length === 1, `Mini-Gantt : ${seen.miniDecisions.length} fenêtre(s) de décision, 1 attendue`);
// Trois risques portent sur une tâche visible, le quatrième vise une tâche
// supprimée : il doit être ignoré sans erreur.
expect(seen.miniRisks.length === 8, `Mini-Gantt : ${seen.miniRisks.length} couloir(s) de risque au total, 8 attendus (4 par widget)`);
// Les risques appartiennent à la tâche : le second widget, sans aucune
// annotation propre, doit les afficher lui aussi.
expect(seen.secondRisks.length === 4, `Second Mini-Gantt : ${seen.secondRisks.length} couloir(s) de risque, 4 attendus — un risque porté par la tâche doit apparaître dans tous les widgets`);
// Méta bloc défini dans les Réglages : il doit atteindre un widget qui n'a
// aucune annotation propre, et son titre ne doit pas être modifiable là.
// Deux méta blocs atteignent ce widget : celui des Réglages et celui porté par
// la tâche Google Calendar cochée depuis sa fiche.
expect(seen.secondBands.length === 2, `Second Mini-Gantt : ${seen.secondBands.length} bande(s) de méta bloc, 2 attendues (Réglages + tâche calendrier)`);
expect(seen.secondMetaChips.length === 2, `Second Mini-Gantt : ${seen.secondMetaChips.length} titre(s) de méta bloc, 2 attendus`);
expect(seen.secondMetaChips.some((c) => /Congés d/.test(c.text)), `Second Mini-Gantt : le bloc issu de la tâche calendrier n'est pas dessiné (${seen.secondMetaChips.map((c) => c.text).join(", ")})`);
// Le jeu d'essai pose DEUX risques qui se chevauchent sur la même tâche : leurs
// couloirs s'empilent, leurs étiquettes doivent rester lisibles côte à côte ou
// l'une sous l'autre — jamais l'une par-dessus l'autre (contrôle de
// superposition ci-dessous).
// Colonne de champs : rien ne doit sortir de la colonne, ni a fortiori du
// widget — c'est ainsi que l'anneau d'avancement se retrouvait tronqué.
expect(seen.miniFields.length > 0, "Mini-Gantt : aucune colonne de champs alignée");
seen.miniFields.forEach((f, i) => {
  expect(f.overflow <= 0, `Mini-Gantt : les champs de la ligne ${i + 1} dépassent de ${f.overflow} px de leur colonne`);
  expect(f.outside <= 0, `Mini-Gantt : les champs de la ligne ${i + 1} sortent de ${f.outside} px hors du widget`);
});

// L'étiquette d'un bloc temporel doit être CENTRÉE sur sa bande : une largeur
// estimée trop généreuse la décalait visiblement vers la gauche.
expect(seen.miniBlockAlign.length > 0, "Mini-Gantt : aucune étiquette de bloc appariée à sa bande");
seen.miniBlockAlign.forEach((b) => {
  expect(b.gap <= 3, `Mini-Gantt : l'étiquette « ${b.t} » est décalée de ${b.gap} px par rapport à sa bande`);
});

expect(seen.miniRiskLabels.length >= 2, `Mini-Gantt : ${seen.miniRiskLabels.length} étiquette(s) de risque, au moins 2 attendues`);
// Deux jalons de configuration et une annotation partagent la bande de repères.
expect(seen.miniMarkers.length === 3, `Mini-Gantt : ${seen.miniMarkers.length} repère(s) jalon/annotation, 3 attendus`);
expect(seen.miniLegend.length >= 3, `Mini-Gantt : légende à ${seen.miniLegend.length} entrée(s), au moins 3 attendues`);
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

seen.miniRisks.forEach((risk, i) => {
  expect(risk.w > 2 && risk.h > 2, `Mini-Gantt : couloir de risque ${i + 1} de surface nulle (${risk.w}×${risk.h})`);
});

for (const [name, frames] of [["Gantt complet", seen.ganttFrames], ["Mini-Gantt", seen.miniFrames]]) {
  frames.forEach((f, i) => expect(f.w > 4 && f.h > 4, `${name} : cadre ${i + 1} de surface nulle (${f.w}×${f.h})`));
}

// Étiquettes lisibles : aucune ne doit en recouvrir une autre.
for (const [name, labels] of [["Gantt complet", seen.ganttFrameLabels], ["Mini-Gantt", seen.miniFrameLabels], ["Mini-Gantt (titres de bloc)", seen.miniPhases], ["Second Mini-Gantt (méta blocs)", seen.secondMetaChips], ["Mini-Gantt (repères)", seen.miniMarkers], ["Mini-Gantt (légende)", seen.miniLegend], ["Mini-Gantt (étiquettes de risque)", seen.miniRiskLabels]]) {
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(!overlap, `${name} : les étiquettes « ${a.text} » et « ${b.text} » se superposent`);
    }
  }
}

expect(!dropdown.error, `contrôle des listes déroulantes interrompu : ${dropdown.error}`);
expect(dropdown.triggers > 1, "Paramètres : la sélection de tâche d'un jalon n'est pas une liste déroulante avec recherche");
expect(dropdown.before > 1, `Paramètres : la liste déroulante ne propose que ${dropdown.before} option(s)`);
expect(dropdown.after > 0 && dropdown.after < dropdown.before, `Paramètres : la recherche rapide ne filtre pas (${dropdown.before} → ${dropdown.after})`);
expect(/Revue DOE/.test(dropdown.chosen), `Paramètres : la sélection ne s'applique pas (« ${dropdown.chosen} »)`);

// --- Vue Métro : les annotations du Gantt, sur un plan de lignes ------------
expect(!!seen.metro, "Vue Métro : le banc n'a pas monté la vue");
if (seen.metro) {
  const m = seen.metro;
  // Trois bandes : deux blocs propres à la vue et un méta bloc des Réglages.
  expect(m.bands.length === 3, `Vue Métro : ${m.bands.length} bande(s) de bloc temporel, 3 attendues (2 propres + 1 méta)`);
  expect(m.bandLabels.length === m.bands.length, `Vue Métro : ${m.bandLabels.length} étiquette(s) de bloc pour ${m.bands.length} bande(s)`);
  m.bands.forEach((b, i) => expect(b.w > 1 && b.h > 20, `Vue Métro : bande ${i + 1} de surface nulle (${b.w}×${b.h})`));

  // Un encadré par groupe continu de lignes de projet.
  expect(m.frames.length === 2, `Vue Métro : ${m.frames.length} cadre(s), 2 attendus`);
  m.frames.forEach((f) => expect(f.w > 10 && f.h > 20, `Vue Métro : cadre « ${f.t} » de surface nulle (${f.w}×${f.h})`));

  // La bande de repères s'intercale entre l'axe des dates et la première ligne :
  // elle ne doit ni passer sous l'axe, ni recouvrir une ligne de projet.
  expect(m.strip.length === 2, `Vue Métro : ${m.strip.length} repère(s) jalon/annotation, 2 attendus`);
  m.strip.forEach((item) => {
    expect(item.y >= m.axisBottom - 1, `Vue Métro : le repère « ${item.t} » passe sous l'axe des dates (${item.y} < ${m.axisBottom})`);
    expect(item.y + item.h <= m.firstRowTop + 1, `Vue Métro : le repère « ${item.t} » recouvre la première ligne de projet (${item.y + item.h} > ${m.firstRowTop})`);
  });
  for (let i = 0; i < m.strip.length; i++) {
    for (let j = i + 1; j < m.strip.length; j++) {
      const a = m.strip[i], b = m.strip[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      expect(!overlap, `Vue Métro : les repères « ${a.t} » et « ${b.t} » se superposent`);
    }
  }

  // Les risques portés par les tâches apparaissent ici aussi, sans réglage.
  expect(m.risks.length > 0, "Vue Métro : aucun couloir de risque, alors que des tâches en portent");
  m.risks.forEach((r) => expect(r.w > 2 && r.h > 2, `Vue Métro : couloir de risque de surface nulle (${r.w}×${r.h})`));
}

// --- Treemap projets -------------------------------------------------------
// Une tuile = un projet : jamais plus de tuiles que de projets du jeu d'essai.
expect(seen.treemapTiles.length > 0, "Treemap : aucune tuile dessinée");
expect(seen.treemapTiles.length <= 4, `Treemap : ${seen.treemapTiles.length} tuiles pour 4 projets — une tuile doit représenter un projet, jamais une tâche`);
expect(seen.treemapRings > 0, "Treemap : aucun anneau de progression");
expect(seen.treemapLegend.length > 0, "Treemap : légende absente alors que la coloration est active");
seen.treemapTiles.forEach((t, i) => {
  expect(t.w > 4 && t.h > 4, `Treemap : tuile ${i + 1} de surface nulle (${t.w}×${t.h})`);
  expect(
    t.x >= seen.treemapBox.x - 1 && t.y >= seen.treemapBox.y - 1
      && t.x + t.w <= seen.treemapBox.x + seen.treemapBox.w + 1
      && t.y + t.h <= seen.treemapBox.y + seen.treemapBox.h + 1,
    `Treemap : la tuile « ${t.text.split("\n")[0]} » déborde du cadre du widget`
  );
});
for (let i = 0; i < seen.treemapTiles.length; i++) {
  for (let j = i + 1; j < seen.treemapTiles.length; j++) {
    const a = seen.treemapTiles[i], b = seen.treemapTiles[j];
    const overlap = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
    expect(!overlap, `Treemap : deux tuiles se chevauchent (${a.text.split("\n")[0]} / ${b.text.split("\n")[0]})`);
  }
}
// Widget étroit : les tuiles se simplifient, elles ne débordent pas.
expect(seen.narrowTiles.length > 0, "Treemap étroit : aucune tuile");
seen.narrowTiles.forEach((t) => {
  expect(
    t.x + t.w <= seen.narrowBox.x + seen.narrowBox.w + 1 && t.y + t.h <= seen.narrowBox.y + seen.narrowBox.h + 1,
    `Treemap étroit : une tuile déborde du cadre (${t.w}×${t.h})`
  );
});

// Prochaines tâches : présentes dans les grandes tuiles, jamais débordantes, et
// moins nombreuses dans une tuile plus basse.
expect(seen.treemapUpcoming.length > 0, "Treemap : aucune prochaine tâche listée alors que le réglage est actif");
expect(
  seen.treemapUpcomingNarrow.length < seen.treemapUpcoming.length,
  `Treemap : ${seen.treemapUpcomingNarrow.length} ligne(s) dans le widget étroit contre ${seen.treemapUpcoming.length} dans le grand — le nombre doit suivre la hauteur de la tuile`
);
seen.treemapUpcoming.forEach((u) => {
  expect(
    u.y >= seen.treemapBox.y - 1 && u.y + u.h <= seen.treemapBox.y + seen.treemapBox.h + 1,
    "Treemap : une ligne de prochaine tâche sort du cadre du widget"
  );
});

// Bande de groupe du Mini-Gantt : un fond teinté, plus un aplat blanc.
expect(seen.treemapGroupTints.length > 0, "Mini-Gantt groupé : aucun groupe trouvé");
seen.treemapGroupTints.forEach((bg, i) => {
  const transparent = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
  expect(!transparent, `Mini-Gantt : le groupe ${i + 1} n'a pas de fond coloré (${bg})`);
});

// --- Nuage des échéances ---------------------------------------------------
// Quatre tâches datées sur cinq : la cinquième n'a pas de date de fin et ne doit
// jamais devenir un point — la placer à l'origine serait un contresens.
expect(seen.scatterDots.length === 4, `Nuage : ${seen.scatterDots.length} point(s) pour 4 tâches datées — une tâche sans échéance a dû être placée à tort`);
expect(seen.scatterLaneLabels.length === 2, `Nuage : ${seen.scatterLaneLabels.length} couloir(s), 2 projets datés attendus`);
expect(seen.scatterTodayAxis.length === 1, "Nuage : l'axe « aujourd'hui » est absent — sans lui, rien ne sépare le retard de l'avance");
{
  // Les deux points les plus à gauche sont les tâches en retard. Ils doivent
  // porter UNE couleur d'alerte, et surtout PAS celle de leur couloir : sans
  // cette seconde condition, le contrôle resterait vert si le retard reprenait
  // simplement la couleur du projet — deux tâches en retard du même projet
  // partageraient alors leur teinte sans que rien ne les signale.
  const byX = [...seen.scatterDotFills].sort((a, b) => a.x - b.x);
  const lateFills = new Set(byX.slice(0, 2).map((d) => d.fill));
  const laneColors = new Set(seen.scatterLaneColors);
  expect(lateFills.size === 1, `Nuage : les deux tâches en retard n'ont pas la même couleur (${[...lateFills].join(", ")})`);
  expect(laneColors.size > 0, "Nuage : les pastilles de couleur des couloirs ont disparu");
  expect(
    ![...lateFills].some((f) => laneColors.has(f)),
    `Nuage : le retard reprend la couleur de son couloir (${[...lateFills].join(", ")}) — rien ne le signale`
  );
  const restFills = new Set(byX.slice(2).map((d) => d.fill));
  expect(![...lateFills].some((f) => restFills.has(f)), "Nuage : le retard n'est pas distingué des tâches à venir");
}
seen.scatterDots.forEach((d, i) => {
  expect(d.w > 0 && d.h > 0, `Nuage : point ${i + 1} de surface nulle`);
  expect(
    d.x >= seen.scatterBox.x - 1 && d.y >= seen.scatterBox.y - 1
      && d.x + d.w <= seen.scatterBox.x + seen.scatterBox.w + 1
      && d.y + d.h <= seen.scatterBox.y + seen.scatterBox.h + 1,
    `Nuage : un point sort du cadre du widget`
  );
});
// Deux tâches partagent exactement la même échéance : leurs points doivent être
// séparés, sinon la répartition en essaim ne sert à rien.
for (let i = 0; i < seen.scatterDots.length; i++) {
  for (let j = i + 1; j < seen.scatterDots.length; j++) {
    const a = seen.scatterDots[i], b = seen.scatterDots[j];
    expect(Math.abs(a.x - b.x) > 1 || Math.abs(a.y - b.y) > 1, "Nuage : deux points sont exactement superposés");
  }
}
// Le retard est à GAUCHE de l'origine, l'avance à droite.
const todayX = seen.scatterTodayAxis.length ? seen.scatterTodayAxis[0].x : null;
if (todayX !== null) {
  const late = seen.scatterDots.filter((d) => d.x + d.w / 2 < todayX - 1).length;
  expect(late === 2, `Nuage : ${late} point(s) à gauche de l'origine, 2 tâches en retard attendues`);
}
// Faible densité : quatre points seulement, les étiquettes doivent rester visibles.
expect(seen.scatterLabels.length > 0, "Nuage : aucune étiquette alors que la densité est faible");
// Et lisibles jusqu'au bout : une étiquette rognée par le bord droit ne dit
// plus de quelle tâche il s'agit.
seen.scatterLabels.forEach((l) => {
  expect(
    l.x >= seen.scatterBox.x - 1 && l.x + l.w <= seen.scatterBox.x + seen.scatterBox.w + 1,
    `Nuage : l'étiquette « ${l.text} » sort du cadre du widget`
  );
});
// Couloirs par criticité : l'urgence se lit de haut en bas.
expect(
  seen.scatterCritLanes.join("|") === "Urgent|Moyen|Bas|Sans criticité",
  `Nuage par criticité : couloirs dans l'ordre « ${seen.scatterCritLanes.join(" / ")} », « Urgent / Moyen / Bas / Sans criticité » attendu`
);
// Sans aucune tâche datée, le widget le dit au lieu d'afficher un axe vide.
expect(/Aucune tâche/.test(seen.scatterEmptyText), "Nuage vide : le widget n'explique pas pourquoi il n'affiche rien");

// --- Fenêtre fixe (issue #50) ----------------------------------------------
// Fenêtre J-3 → J+5 sur les mêmes quatre tâches datées : deux d'entre elles
// débordent. Elles doivent rester DESSINÉES et COMPTÉES — une fenêtre qui
// masque sans le dire serait un filtre déguisé.
expect(seen.windowDots === 4, `Fenêtre : ${seen.windowDots} point(s) sur 4 — la fenêtre a fait disparaître une tâche`);
// sc1 et sc2 sont toutes deux à J-6, sc4 à J+12 : deux débordements à gauche,
// un à droite.
expect(seen.windowBeyond === 3, `Fenêtre : ${seen.windowBeyond} point(s) marqué(s) hors fenêtre, 3 attendus`);
expect(seen.windowOverflowText.length === 2, `Fenêtre : ${seen.windowOverflowText.length} compteur(s) de débordement, 2 attendus (un par bout)`);
{
  const gauche = seen.windowOverflowText.find((t) => t.startsWith("\u25C2")) || "";
  const droite = seen.windowOverflowText.find((t) => t.endsWith("\u25B8")) || "";
  expect(/^\u25C2 2 au-delà$/.test(gauche), `Fenêtre : compteur de gauche « ${gauche} », « ◂ 2 au-delà » attendu`);
  expect(/^1 au-delà \u25B8$/.test(droite), `Fenêtre : compteur de droite « ${droite} », « 1 au-delà ▸ » attendu`);
}
// L'axe est borné par le réglage, plus par les tâches : sans cela, rien n'aurait
// changé et les contrôles ci-dessus passeraient pour de mauvaises raisons.
{
  const jours = seen.windowTicks.map((t) => (t === "aujourd'hui" ? 0 : Number(t.replace("J+", "").replace("J", ""))));
  expect(jours.every((j) => j >= -3 && j <= 5), `Fenêtre : graduations hors de la plage réglée (${seen.windowTicks.join(" ")})`);
  // Les DEUX bornes doivent être graduées : sans elles, rien ne dit jusqu'où va
  // la plage, et un chevron posé au bord reste une énigme.
  expect(jours.includes(-3) && jours.includes(5),
    `Fenêtre : bornes non graduées (${seen.windowTicks.join(" ")}) — J-3 et J+5 attendus`);
}

expect(!scatter.error, `contrôle du Nuage interrompu : ${scatter.error}`);
expect(/jour|aujourd/i.test(scatter.tip), `Nuage : l'infobulle ne donne pas l'échéance (« ${scatter.tip} »)`);
expect(/^sc[1-4]$/.test(scatter.opened), `Nuage : le clic n'ouvre pas la tâche (« ${scatter.opened} »)`);
expect(scatter.laneOptions === 3, `Nuage : ${scatter.laneOptions} choix de couloir dans la fiche, 3 attendus`);
expect(
  scatter.savedLaneField === "À planifier|Attente tiers",
  `Nuage : le couloir choisi dans la fiche n'a pas été enregistré (couloirs après sauvegarde : « ${scatter.savedLaneField} », noms de statuts attendus)`
);

// --- Treemap par statut (issue #47) ----------------------------------------
// Les tuiles portent des NOMS DE STATUT, pas des noms de projet : c'est tout le
// point de l'issue, et c'est aussi ce qui casserait en silence si le champ de
// rattachement n'était pas transmis au bloc de calcul.
expect(seen.statusTileNames.length > 0, `Treemap par statut : aucune tuile (${seen.statusEmpty.slice(0, 120)})`);
{
  const statuts = ["À planifier", "Attente tiers", "En cours", "Terminé", "Information", "Sans statut"];
  const projets = ["Lot 2B", "CTEX6", "Agenda perso"];
  seen.statusTileNames.forEach((name) => {
    expect(statuts.includes(name), `Treemap par statut : la tuile « ${name} » n'est pas un statut`);
    expect(!projets.includes(name), `Treemap par statut : la tuile « ${name} » est restée un projet`);
  });
  // Regroupement « Dossier » demandé lui aussi : il doit retomber sur « aucun »,
  // sans produire de bande.
  expect(seen.statusGroupLabels.length === 0, `Treemap par statut : regroupement par dossier conservé (${seen.statusGroupLabels.join(" / ")})`);
}
expect(!statusTreemap.error, `contrôle du Treemap par statut interrompu : ${statusTreemap.error}`);
expect(statusTreemap.tileByOptions === 4, `Treemap : ${statusTreemap.tileByOptions} choix de champ de tuile dans la fiche, 4 attendus`);
expect(!statusTreemap.offersFolder, "Treemap par statut : la fiche propose encore un regroupement par dossier");
expect(
  Array.isArray(statusTreemap.fieldLabels) && statusTreemap.fieldLabels.length > 0,
  "Treemap par statut : aucun champ de tuile listé dans la fiche"
);
// Budget, dossier, priorité, risques : des notions de projet. Proposées ici,
// elles donneraient des cases qui se cochent et que l'enregistrement retire.
["Budget", "Dossier", "Priorité du projet", "Risques"].forEach((mot) => {
  const trouve = (statusTreemap.fieldLabels || []).filter((l) => l.includes(mot));
  expect(trouve.length === 0, `Treemap par statut : la fiche propose encore « ${trouve.join(", ")} »`);
});
expect(
  /statut/i.test(statusTreemap.tileNameLabel),
  `Treemap par statut : le premier champ de tuile s'intitule « ${statusTreemap.tileNameLabel} » au lieu de nommer le statut`
);

// --- Heat map (issue #51) --------------------------------------------------
// Toutes les cases ont la MÊME taille : c'est ce qui sépare ce widget du
// Treemap, où la surface encode un comptage.
expect(seen.heatRowHeads.length > 0 && seen.heatColHeads.length > 0,
  `Heat map : grille vide (${seen.heatRowHeads.length} ligne(s), ${seen.heatColHeads.length} colonne(s))`);
expect(seen.heatCells.length === seen.heatRowHeads.length * seen.heatColHeads.length,
  `Heat map : ${seen.heatCells.length} case(s) pour ${seen.heatRowHeads.length}×${seen.heatColHeads.length} — la grille n'est pas complète`);
{
  const tailles = new Set(seen.heatCells.map((c) => `${c.w}x${c.h}`));
  expect(tailles.size === 1, `Heat map : ${tailles.size} tailles de case différentes (${[...tailles].join(", ")}) — elles doivent être identiques`);
}
// CASE VIDE contre CASE À ZÉRO — le cœur de l'issue. « Aucune tâche à ce
// croisement » n'est pas « des tâches, mais aucune en retard ». Ce qui distingue
// les deux dans le rendu : la case à zéro porte un chiffre ET une couleur, la
// case vide n'a ni l'un ni l'autre. Le scénario « tâches en retard » croisé aux
// mois garantit qu'il existe bien des deux sortes — sans quoi le contrôle ne
// prouverait rien.
{
  const opaque = (bg) => /^rgba?\(/.test(bg) && bg !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(bg);
  const zeros = seen.heatLateCells.filter((c) => c.text === "0");
  const sansChiffre = seen.heatLateCells.filter((c) => c.text === "");
  expect(zeros.length > 0, "Heat map : aucune case à zéro dans le scénario « tâches en retard » — le contrôle ne prouverait rien");
  expect(sansChiffre.length > 0, "Heat map : aucune case vide dans le scénario — le contrôle ne prouverait rien");
  zeros.forEach((c) => {
    expect(opaque(c.bg), `Heat map : une case à zéro n'a pas de couleur (${c.bg}) — elle se confondrait avec une case vide`);
  });
  sansChiffre.forEach((c) => {
    expect(!opaque(c.bg), `Heat map : une case sans tâche porte une couleur de mesure (${c.bg}) — elle se lirait comme un zéro`);
  });
}
// Dans la grille par statut, toute case colorée porte sa valeur, et toute case
// sans valeur reste incolore : même règle, vérifiée sur un second jeu.
seen.heatCells.forEach((c) => {
  const opaque = /^rgba?\(/.test(c.bg) && c.bg !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(c.bg);
  expect(opaque === (c.text !== ""), `Heat map : case « ${c.text || "(vide)"} » de fond ${c.bg} — couleur et valeur doivent aller ensemble`);
});
expect(!heatmap.error, `contrôle de la Heat map interrompu : ${heatmap.error}`);
expect(/×/.test(heatmap.tip), `Heat map : l'infobulle ne nomme pas le croisement (« ${heatmap.tip} »)`);
expect(heatmap.axisOptions === 6, `Heat map : ${heatmap.axisOptions} champ(s) d'axe dans la fiche, 6 attendus`);
expect(heatmap.metricOptions === 4, `Heat map : ${heatmap.metricOptions} mesure(s) dans la fiche, 4 attendues`);
expect(/Urgent|Moyen|Bas|criticité/i.test(heatmap.savedCols),
  `Heat map : l'axe des colonnes choisi dans la fiche n'a pas été enregistré (colonnes : « ${heatmap.savedCols} »)`);

expect(!infobulle.error, `contrôle de l'infobulle de la heat map interrompu : ${infobulle.error}`);
expect(infobulle.parent === "body", `Heat map mensuelle : l'infobulle est rendue dans « ${infobulle.parent} » au lieu de la racine — un ancêtre transformé la décalerait`);
expect(infobulle.dansCadre === true, "Heat map mensuelle : l'infobulle sort de la fenêtre au lieu de basculer");
expect(infobulle.tipLeft !== null, "Heat map mensuelle : aucune infobulle n'a pu être déclenchée — le contrôle ne prouve rien");

expect(!bandeau.error, `contrôle du bandeau de paramètres interrompu : ${bandeau.error}`);
/* Le rectangle de collage part du bord intérieur de la zone défilante : l'axe
   doit donc remonter du remplissage haut pour se coller au bandeau. Contrôler
   « top: 0 » laisserait passer précisément la panne d'origine. */
expect(bandeau.axisTop === `${-bandeau.bodyPadTop}px`,
  `Widget : l'axe collant se fige à « ${bandeau.axisTop} », attendu « ${-bandeau.bodyPadTop}px » (remplissage de la zone défilante) — sinon le contenu défile à découvert dans cette bande`);
expect(bandeau.headOpaque, "Widget : le bandeau de paramètres n'a pas de fond opaque — le contenu transparaît derrière lui");
expect(bandeau.headZ !== "auto" && Number(bandeau.headZ) > 0, `Widget : le bandeau de paramètres reste au plan par défaut (z-index « ${bandeau.headZ} ») — un élément positionné du contenu se peint par-dessus`);
expect(bandeau.contentAboveAxis === 0, `Widget : sur 3 points sondés juste sous le bandeau, ${bandeau.contentAboveAxis} montrent le planning au lieu de l'axe — le contenu défile à découvert`);
expect(bandeau.axisY !== null && bandeau.headBottom !== null && bandeau.axisY - bandeau.headBottom <= 2,
  `Widget : ${bandeau.axisY - bandeau.headBottom} px séparent le bandeau de l'axe — c'est la bande où le contenu passe`);

expect(!coche.error, `contrôle de la coche du Mini-Gantt interrompu : ${coche.error}`);
expect(coche.frames === 1, `Coche du Mini-Gantt : ${coche.frames} encadré(s) après la coche, 1 attendu`);
expect(coche.icons === 1, `Coche du Mini-Gantt : ${coche.icons} icône(s) affichée(s) — l'encadré de coche n'a pas d'étiquette, c'est l'icône qui en tient lieu`);
expect(coche.corners === 1, `Coche du Mini-Gantt : ${coche.corners} logo(s) de coin, 1 attendu en haut à droite`);
expect(coche.leftGap !== null && coche.leftGap >= 6, `Coche du Mini-Gantt : le trait gauche du cadre passe à ${coche.leftGap} px de la barre — il la recoupe`);
expect(coche.rightGap !== null && coche.rightGap >= 6, `Coche du Mini-Gantt : le trait droit du cadre passe à ${coche.rightGap} px de la barre — il la recoupe`);
expect(coche.cornerInside !== null && coche.cornerInside >= 0, `Coche du Mini-Gantt : le logo de coin déborde de ${-coche.cornerInside} px hors du cadre`);
expect(coche.apres === 0, `Coche du Mini-Gantt : ${coche.apres} encadré(s) restant(s) après avoir décoché, 0 attendu`);

expect(!treemap.error, `contrôle du Treemap interrompu : ${treemap.error}`);
expect(treemap.opened === "p1" || treemap.opened === "p2" || treemap.opened === "p3" || treemap.opened === "p4", `Treemap : le clic n'ouvre pas un projet (« ${treemap.opened} »)`);
expect(treemap.colorModes === 3, `Treemap : ${treemap.colorModes} mode(s) de coloration dans la fiche, 3 attendus`);
expect(treemap.fieldRows >= 5, `Treemap : ${treemap.fieldRows} champ(s) de tuile réordonnables, au moins 5 attendus`);
expect(treemap.sizeFilterFields > 0, "Treemap : le filtre de taille n'expose pas le moteur de filtres avancés");

expect(!drag.error, `contrôle du glisser d'avancement interrompu : ${drag.error}`);
expect(drag.after !== drag.before, "Mini-Gantt : la poignée d'avancement n'a pas bougé pendant le glisser");
expect(drag.gap !== null && drag.gap <= 6, `Mini-Gantt : la poignée d'avancement s'arrête à ${drag.gap} px du pointeur — elle doit le suivre`);

expect(!taskMeta.error, `contrôle de la fiche de tâche interrompu : ${taskMeta.error}`);
expect(taskMeta.checkbox === 1, "Fiche de tâche : la case « méta bloc temporel » est absente d'une tâche de projet Google Calendar");
expect(taskMeta.checked, "Fiche de tâche : la case « méta bloc temporel » ne reflète pas le réglage enregistré");
expect(taskMeta.controls >= 4, `Fiche de tâche : ${taskMeta.controls} réglage(s) esthétique(s), au moins 4 attendus (nature et bordure)`);
// Le titre et les dates viennent de la tâche, pas d'une saisie : la fiche doit
// le dire, et la portée du bloc doit rester réglable ici.
expect(taskMeta.hints.some((h) => /Congés d.août.+05\/08\/2026.+19\/08\/2026/.test(h)), `Fiche de tâche : les dates reprises de la tâche ne sont pas rappelées (${taskMeta.hints.join(" | ")})`);
expect(taskMeta.hints.some((h) => /tableaux de bord/i.test(h)), `Fiche de tâche : la portée du méta bloc n'est pas expliquée (${taskMeta.hints.join(" | ")})`);
// Les risques de délai appartiennent à la tâche : c'est dans SA fiche qu'ils
// s'éditent, plus dans les annotations d'un widget.
expect(taskMeta.riskButton === 1, "Fiche de tâche : impossible d'ajouter un risque de délai");
expect(taskMeta.riskRows >= 1, `Fiche de tâche : ${taskMeta.riskRows} risque(s) après ajout, au moins 1 attendu`);
expect(taskMeta.riskSeverities === 4, `Fiche de tâche : ${taskMeta.riskSeverities} niveau(x) de gravité, 4 attendus`);
expect(!seen.miniRiskButton, "Mini-Gantt : le bouton « + Risque » devrait avoir disparu — les risques s'éditent dans la fiche de la tâche");

expect(!scoped.error, `contrôle de la portée des listes déroulantes interrompu : ${scoped.error}`);
expect(scoped.labels.length === 2, `Paramètres : ${scoped.labels.length} tâche(s) proposée(s), 2 attendues (seul le projet filtré)`);
expect(scoped.labels.every((l) => /FOR-0129|DREAL/.test(l)), `Paramètres : des tâches hors filtre sont proposées (${scoped.labels.join(", ")})`);

console.log(`Capture : ${shot}`);
if (failures.length) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`Contrôle visuel : OK (${seen.ganttFrames.length} cadres et ${seen.ganttBlockLabels.length} blocs dans le Gantt complet, ${seen.miniFrames.length} cadres et ${seen.miniBlocks} blocs dans le Mini-Gantt)`);
