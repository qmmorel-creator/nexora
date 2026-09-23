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
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (m.text().includes("[BABEL]")) return;
  /* Le banc monte EXPRÈS une icône dont le chargement échoue (issue #70) :
     c'est le seul moyen d'éprouver le repli, et cet échec EST le sujet du
     contrôle, pas un défaut. Reconnu à son adresse, et à elle seule, pour ne
     rien relâcher d'autre. */
  if ((m.location()?.url || "").includes("icone-volontairement-cassee")) return;
  pageErrors.push("console: " + m.text());
});

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
await page.waitForSelector(".lp-widget-minigantt", { timeout: 90000 });
await page.waitForTimeout(2500);

const seen = await page.evaluate(() => {
  const rects = (sel) => [...document.querySelectorAll(sel)].map((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), text: el.textContent.trim() };
  });
  return {
    miniBlocks: document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-tblock").length,
    miniPhases: rects("#harness-first-minigantt .lp-widget-minigantt-phase"),
    miniFrames: rects("#harness-first-minigantt .lp-widget-minigantt-frame"),
    miniFrameLabels: rects("#harness-first-minigantt .lp-widget-minigantt-frame-label"),
    miniRows: rects("#harness-first-minigantt .lp-widget-minigantt-row"),
    miniBands: rects("#harness-first-minigantt .lp-widget-minigantt-tblock"),
    miniDecisions: rects("#harness-first-minigantt .lp-widget-minigantt-phase.is-decision"),
    // Portée aux DEUX widgets historiques : non ancré, ce compte changeait
    // à chaque Mini-Gantt ajouté au banc pour une autre raison.
    miniRisks: rects("#harness-first-minigantt .lp-widget-minigantt-risk, #harness-second-minigantt .lp-widget-minigantt-risk"),
    secondRisks: rects("#harness-second-minigantt .lp-widget-minigantt-risk"),
    secondBands: rects("#harness-second-minigantt .lp-widget-minigantt-tblock"),
    secondMetaChips: rects("#harness-second-minigantt .lp-widget-minigantt-phase.is-meta"),
    // Mode Comparaison : tout est relevé sur le widget dédié, jumeau du second
    // au mode près — ce qui permet de comparer les hauteurs de ligne des deux.
    cmpStrips: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmpstrip"),
    cmpSegRef: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmpseg.is-reference"),
    /* La durée initiale, cerclée par-dessus les trames : elle doit être là sur
       CHAQUE ligne comparée, quelle que soit la coloration dessous. */
    cmpRefFrames: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpref")].map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      /* Le ruban de la MÊME ligne : les deux anneaux doivent partager sommet et
         hauteur, faute de quoi ils s'accolent au lieu de se superposer et la
         tâche conforme porte un liseré épais sur tout son pourtour. */
      const ruban = el.closest(".lp-widget-minigantt-row")?.querySelector(".lp-widget-minigantt-cmpstrip");
      const rr = ruban ? ruban.getBoundingClientRect() : null;
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        fond: cs.backgroundColor, bord: cs.borderTopWidth,
        dTop: rr ? Math.round(r.top - rr.top) : null,
        dH: rr ? Math.round(r.height - rr.height) : null,
      };
    }),
    cmpSegLate: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmpseg.is-late"),
    cmpSegAhead: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmpseg.is-ahead"),
    /* Couleur RÉELLEMENT peinte des segments d'avance. Elle est portée par le
       MOTIF, pas par un contour : le ruban n'en a aucun. On lit donc la première
       couleur du dégradé hachuré, telle que le navigateur la calcule. */
    cmpAheadColors: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpseg.is-ahead")].map((el) => {
      const c = getComputedStyle(el).backgroundImage;
      const m = c.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      const [r, v, b] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [];
      return { c: m ? m[0] : c.slice(0, 40), vert: Number.isFinite(v) && v > r + 40 && v > b + 40 };
    }),
    // Jonctions SANS bordure : c'est la trame, et elle seule, qui sépare deux
    // segments. Un liseré suffirait à rendre le ruban brouillon.
    cmpSegBorders: [...new Set([...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpseg")].map((el) => getComputedStyle(el).borderTopWidth + "/" + getComputedStyle(el).borderLeftWidth))],
    // Segments JOINTIFS : d'un ruban à l'autre, le bord droit d'un segment doit
    // coïncider avec le bord gauche du suivant, à moins d'un pixel.
    cmpSegGaps: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpstrip")].map((strip) => {
      const segs = [...strip.querySelectorAll(".lp-widget-minigantt-cmpseg")]
        .map((el) => el.getBoundingClientRect())
        .sort((a, b) => a.left - b.left);
      let pire = 0;
      for (let i = 1; i < segs.length; i += 1) pire = Math.max(pire, Math.abs(segs[i].left - segs[i - 1].right));
      return Math.round(pire);
    }),
    cmpLabels: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmplabel"),
    // Hauteurs comparées : le ruban ne doit jamais avoir la géométrie de la
    // barre, sinon il se lit comme son prolongement.
    cmpStripHeights: [...new Set([...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpstrip")].map((el) => Math.round(el.getBoundingClientRect().height)))],
    cmpBarHeights: [...new Set([...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-bar")].map((el) => Math.round(el.getBoundingClientRect().height)))],
    // Le ruban vit SOUS la barre et COLLÉ à elle : c'est ce qui laisse la barre
    // actuelle seule sur sa ligne tout en gardant les deux étages solidaires.
    cmpStripUnderBar: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-row")].map((row) => {
      const bar = row.querySelector(".lp-widget-minigantt-bar");
      const strip = row.querySelector(".lp-widget-minigantt-cmpstrip");
      if (!bar || !strip) return null;
      return Math.round(strip.getBoundingClientRect().top - bar.getBoundingClientRect().bottom);
    }).filter((v) => v !== null),
    // Contour noir de la barre comparée : la tâche RÉELLE reste l'objet le plus
    // net de la ligne. Le widget standard, lui, ne doit pas bouger.
    cmpBarOutlined: document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-bar.is-compared").length,
    standardBarOutlined: document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-bar.is-compared, #harness-second-minigantt .lp-widget-minigantt-bar.is-compared").length,
    /* Le cadre doit l'emporter sur TOUT : une barre qui le traverse ne doit pas
       le recouvrir. C'est l'ordre d'empilement des deux couches qui le dit. */
    bandZ: (() => {
      const fond = document.querySelector("#harness-first-minigantt .lp-widget-minigantt-band-layer");
      const cadres = document.querySelector("#harness-first-minigantt .lp-widget-minigantt-band-frames");
      const ligne = document.querySelector("#harness-first-minigantt .lp-widget-minigantt-row");
      const z = (el) => (el ? Number(getComputedStyle(el).zIndex) : null);
      return { fond: z(fond), cadres: z(cadres), ligne: z(ligne) };
    })(),
    // Le remplissage, lui, ne porte plus aucun trait : il ferait double emploi.
    bandFillBorders: [...new Set([...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-tblock")].map((el) => getComputedStyle(el).borderLeftWidth))],
    cmpChips: rects("#harness-comparison-minigantt .lp-widget-minigantt-cmpchip"),
    cmpGhosts: rects("#harness-comparison-minigantt .lp-widget-minigantt-ms-ghost"),
    cmpLinks: rects("#harness-comparison-minigantt .lp-widget-minigantt-ms-link"),
    // La légende a été retirée des deux diagrammes : plus aucune bande ne redit
    // ce que les formes montrent déjà.
    legendRows: document.querySelectorAll(".lp-widget-minigantt-legend, .lp-widget-minigantt-legend-items, .lp-widget-minigantt-legend-item").length,
    // Épaisseur RÉELLEMENT peinte des traits d'un bloc temporel : le jeu d'essai
    // en règle un à 4 px et laisse les autres au défaut de 1,5 px.
    /* Le trait vit désormais sur la couche des CADRES, au premier plan ; le
       remplissage reste derrière les barres, sur la couche des bandes. */
    bandBorders: [...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-tblock-frame")].map((el) => ({
      // Déclarée (le réglage) ET utilisée (ce que le navigateur peint, arrondi
      // au pixel entier) : la seconde seule ne distinguerait pas 1,5 px de 1 px.
      g: el.style.borderLeftWidth, d: el.style.borderRightWidth,
      h: getComputedStyle(el).borderTopWidth, b: getComputedStyle(el).borderBottomWidth,
      peint: getComputedStyle(el).borderLeftWidth, style: getComputedStyle(el).borderLeftStyle,
    })),
    cmpRows: rects("#harness-comparison-minigantt .lp-widget-minigantt-row"),
    cmpModeButtons: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpmode button")].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains("active") })),
    standardStrips: document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-cmpstrip, #harness-second-minigantt .lp-widget-minigantt-cmpstrip, #harness-nofields-minigantt .lp-widget-minigantt-cmpstrip").length,
    standardRows: rects("#harness-second-minigantt .lp-widget-minigantt-row"),
    // Avancement à 100 % : la poignée devient une pastille de validation.
    doneHandles: [...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-progress-handle.is-done")].map((el) => {
      const b = el.getBoundingClientRect();
      const c = getComputedStyle(el).backgroundColor;
      const [r, v, bl] = (c.match(/\d+/g) || []).map(Number);
      return { w: Math.round(b.width), h: Math.round(b.height), coches: el.querySelectorAll("svg").length, vert: Number.isFinite(v) && v > r + 40 && v > bl + 40 };
    }),
    plainHandles: [...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-progress-handle:not(.is-done)")].map((el) => ({
      w: Math.round(el.getBoundingClientRect().width),
      coches: el.querySelectorAll("svg").length,
    })),
    // Ordre des lignes : barres et jalons doivent se mêler, pas se suivre.
    ordreTitres: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-label-title")].map((el) => el.textContent.trim()),
    ordreParTitre: [...document.querySelectorAll("#harness-nofields-minigantt .lp-widget-minigantt-label-title")].map((el) => el.textContent.trim()),
    /* Barre d'outils : toutes les commandes sur UNE bande, au-dessus de l'axe.
       On mesure leurs sommets — empilées en colonne, ils diffèrent. */
    toolbarTops: [...new Set([...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-toolbar > *")].map((el) => Math.round(el.getBoundingClientRect().top)))],
    toolbarCount: document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-toolbar > *").length,
    toolbarAboveAxis: (() => {
      const bar = document.querySelector("#harness-comparison-minigantt .lp-widget-minigantt-toolbar");
      const axe = document.querySelector("#harness-comparison-minigantt .lp-widget-minigantt-axis");
      if (!bar || !axe) return null;
      return Math.round(axe.getBoundingClientRect().top - bar.getBoundingClientRect().bottom);
    })(),
    // Sous-grille : le contexte temporel entre deux graduations étiquetées.
    anneesSubTicks: document.querySelectorAll("#harness-years-minigantt .lp-widget-minigantt-axis-subtick:not(.is-fine)").length,
    anneesTicks: document.querySelectorAll("#harness-years-minigantt .lp-widget-minigantt-axis-tick").length,
    anneesGrille: document.querySelectorAll("#harness-years-minigantt .lp-widget-minigantt-sub-sep:not(.is-fine)").length,
    // Troisième niveau : un cran plus fin encore que la sous-grille
    // (année → trimestre → mois). Il porte la classe `is-fine`.
    anneesSubTicks3: document.querySelectorAll("#harness-years-minigantt .lp-widget-minigantt-axis-subtick.is-fine").length,
    anneesGrille3: document.querySelectorAll("#harness-years-minigantt .lp-widget-minigantt-sub-sep.is-fine").length,
    // Cadrage glissant : l'axe suit le calendrier, les tâches hors fenêtre sortent.
    rollingRows: document.querySelectorAll("#harness-rolling-minigantt .lp-widget-minigantt-row").length,
    rollingAxis: [...document.querySelectorAll("#harness-rolling-minigantt .lp-widget-minigantt-axis-tick-label")].map((el) => el.textContent.trim()),
    standardRowCount: document.querySelectorAll("#harness-second-minigantt .lp-widget-minigantt-row").length,
    miniRiskLabels: rects("#harness-first-minigantt .lp-widget-minigantt-risk-label"),
    miniMarkers: rects("#harness-first-minigantt .lp-widget-minigantt-marker"),
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
    // Fond des couloirs : chaque bande porte la couleur de son entité, en aplat
    // très pâle. Relevé avec son opacité — une teinte à zéro ne distingue rien.
    scatterBands: [...document.querySelectorAll("#harness-scatter .lp-widget-scatter-band")]
      .map((el) => ({ fill: (el.getAttribute("fill") || "").toUpperCase(), opacity: Number(el.getAttribute("fill-opacity")) })),
    scatterMajorAxes: document.querySelectorAll("#harness-scatter .lp-widget-scatter-axis, #harness-scatter .lp-widget-scatter-axis-today").length,
    scatterMinorAxes: document.querySelectorAll("#harness-scatter .lp-widget-scatter-subaxis").length,
    // Couloir dense : géométrie RÉELLEMENT rendue des étiquettes. C'est la seule
    // façon de vérifier qu'elles ne se chevauchent pas — le calcul du moteur
    // repose sur une largeur estimée, le navigateur, lui, mesure vraiment.
    denseLabels: [...document.querySelectorAll("#harness-scatter-dense .lp-widget-scatter-point-label")].map((el) => {
      const r = el.getBoundingClientRect();
      return { text: el.textContent.trim(), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
    }),
    denseDots: [...document.querySelectorAll("#harness-scatter-dense .lp-widget-scatter-dot")].map((el) => {
      const r = el.getBoundingClientRect();
      return { fill: (el.getAttribute("fill") || "").toUpperCase(), stroke: (el.getAttribute("stroke") || "").toUpperCase(),
               x: Math.round(r.x + r.width / 2), x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
    }),
    denseLeaders: document.querySelectorAll("#harness-scatter-dense .lp-widget-scatter-leader").length,
    denseTodayX: (() => { const el = document.querySelector("#harness-scatter-dense .lp-widget-scatter-axis-today"); return el ? el.getBoundingClientRect().x : null; })(),
    denseBox: (() => { const r = document.querySelector("#harness-scatter-dense svg").getBoundingClientRect(); return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; })(),
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
    /* Alignement des titres de bloc dans un widget SANS bande de repères. La
       largeur de la piste se mesurait sur cette bande-là : sans elle, la mesure
       ne tombait jamais et les titres se centraient sur une piste imaginaire de
       420 px, loin de leur bande (retour de test). Le second Mini-Gantt n'a
       aucune annotation propre — donc aucune bande de repères — et porte
       pourtant deux méta blocs : c'est exactement le cas qui échouait. */
    secondBlockAlign: (() => {
      const host = document.querySelector("#harness-second-minigantt");
      const centre = (el) => { const b = el.getBoundingClientRect(); return b.x + b.width / 2; };
      return [...host.querySelectorAll(".lp-widget-minigantt-phase[data-block-id]")].map((chip) => {
        const band = host.querySelector(`.lp-widget-minigantt-tblock[data-block-id="${chip.getAttribute("data-block-id")}"]`);
        if (!band) return null;
        return { t: chip.textContent.trim(), gap: Math.round(Math.abs(centre(chip) - centre(band))) };
      }).filter(Boolean);
    })(),
    secondStrip: document.querySelectorAll("#harness-second-minigantt .lp-widget-minigantt-strip-track").length,
    /* TOUTES les pistes d'un même widget portent la même échelle temporelle :
       elles doivent donc avoir la même largeur, au pixel près. L'axe avait une
       marge droite de 20 px et aucune réserve pour la colonne de champs — il
       était plus large que les lignes de 60 à 230 px selon les champs
       affichés, et tout l'axe tombait à côté. « Aujourd'hui » le rendait
       seulement visible, en s'écartant de son propre trait vertical. C'est la
       DEUXIÈME fois que ce défaut frappe (les titres de bloc avant lui) : on le
       mesure plutôt que d'y revenir une troisième. */
    largeursPistes: ["#harness-first-minigantt", "#harness-second-minigantt", "#harness-comparison-minigantt", "#harness-nofields-minigantt"].map((sel) => {
      const host = document.querySelector(sel);
      if (!host) return null;
      const largeur = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
      const pistes = [
        largeur(host.querySelector(".lp-widget-minigantt-axis-track")),
        largeur(host.querySelector(".lp-widget-minigantt-phases-track")),
        largeur(host.querySelector(".lp-widget-minigantt-strip-track")),
        largeur(host.querySelector(".lp-widget-minigantt-track")),
        largeur(host.querySelector(".lp-widget-minigantt-gridoverlay")),
      ].filter((v) => v !== null);
      return { sel, min: Math.min(...pistes), max: Math.max(...pistes), n: pistes.length };
    }).filter(Boolean),
    // Le repère « Aujourd'hui » de l'axe et le trait vertical du diagramme
    // décrivent la même date : ils doivent tomber au même endroit.
    reperesAujourdhui: ["#harness-first-minigantt", "#harness-second-minigantt", "#harness-comparison-minigantt"].map((sel) => {
      const host = document.querySelector(sel);
      const centre = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.x + b.width / 2; };
      const etiquette = centre(host && host.querySelector(".lp-widget-minigantt-axis-today"));
      const trait = centre(host && host.querySelector(".lp-widget-minigantt-todayline"));
      if (etiquette === null || trait === null) return null;
      return { sel, ecart: Math.round(Math.abs(etiquette - trait)) };
    }).filter(Boolean),
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
    /* Annotations horizontales (#93), traits verticaux de jalon (#95) et
       formes de repère (#94) : tout se relève sur le premier Mini-Gantt, le
       seul du banc à les porter. */
    spans: (() => {
      const host = document.querySelector("#harness-first-minigantt");
      if (!host) return null;
      const hb = host.getBoundingClientRect();
      const traits = [...host.querySelectorAll(".lp-widget-minigantt-span")].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          texte: el.textContent.trim(),
          x: Math.round(b.x - hb.x), y: Math.round(b.y - hb.y), w: Math.round(b.width),
          milieu: Math.round(b.y - hb.y + b.height / 2),
          // Les bouts sont des tracés SVG posés en enfants directs du trait :
          // l'étiquette, elle, est un bouton. « Aucun » rend une place vide.
          bouts: [...el.children].filter((child) => child.tagName.toLowerCase() === "svg")
            .map((child) => child.querySelector("path")?.getAttribute("d") || ""),
        };
      });
      // Ligne de « Demande lame pour piste d'accès » (t2), la tâche visée.
      const ligne = [...host.querySelectorAll(".lp-widget-minigantt-row")]
        .find((el) => /Demande lame/.test(el.textContent));
      const lb = ligne ? ligne.getBoundingClientRect() : null;
      return {
        traits,
        ligneVisee: lb ? { haut: Math.round(lb.y - hb.y), bas: Math.round(lb.y - hb.y + lb.height) } : null,
        // Le calque des traits doit passer AU-DESSUS des lignes, sinon le trait
        // disparaîtrait sous la barre qu'il accompagne.
        zTrait: (() => { const el = host.querySelector(".lp-widget-minigantt-span-layer"); return el ? getComputedStyle(el).zIndex : ""; })(),
        zLigne: ligne ? getComputedStyle(ligne).zIndex : "",
      };
    })(),
    /* Colonne d'étiquettes calée sur son contenu (retour de test). Les 26 %
       figés laissaient un blanc entre le dernier mot et la piste dès que les
       titres étaient courts. On relève, sur un diagramme à titres COURTS, ce
       blanc et la largeur de la colonne ; puis, sur un diagramme à titres
       LONGS, que la colonne tient toujours le plafond — elle ne doit que
       rétrécir, jamais grandir. Et les couches superposées doivent suivre la
       colonne : elles partaient d'un 26 % écrit en dur. */
    colonne: (() => {
      const relever = (id) => {
        const host = document.querySelector(id);
        const root = host ? host.querySelector(".lp-widget-minigantt") : null;
        if (!root) return null;
        const label = root.querySelector(".lp-widget-minigantt-label");
        const track = root.querySelector(".lp-widget-minigantt-track");
        const grille = root.querySelector(".lp-widget-minigantt-gridoverlay");
        const bande = root.querySelector(".lp-widget-minigantt-band-layer");
        if (!label || !track) return null;
        /* Le dernier mot RÉELLEMENT peint, pas le bord de la boîte : le titre
           est un `flex:1`, sa boîte épouse la colonne et dirait donc toujours
           « aucun blanc ». On mesure le texte lui-même. */
        const range = document.createRange();
        let contenu = 0;
        root.querySelectorAll(".lp-widget-minigantt-label").forEach((el) => {
          const gauche = el.getBoundingClientRect().left;
          [...el.children].forEach((enfant) => {
            range.selectNodeContents(enfant);
            const texte = range.getBoundingClientRect();
            const droite = texte.width ? texte.right : enfant.getBoundingClientRect().right;
            contenu = Math.max(contenu, droite - gauche);
          });
        });
        const g = label.getBoundingClientRect();
        const p = track.getBoundingClientRect();
        return {
          largeur: Math.round(g.width),
          plafond: Math.round(root.getBoundingClientRect().width * 0.26),
          blanc: Math.round(p.left - g.left - contenu),
          ecartGrille: grille ? Math.round(grille.getBoundingClientRect().left - p.left) : null,
          ecartBande: bande ? Math.round(bande.getBoundingClientRect().left - p.left) : null,
        };
      };
      return { courts: relever("#harness-labels-minigantt"), longs: relever("#harness-first-minigantt") };
    })(),
    /* Dernière ligne coupée (retour de test) : une ligne peint SOUS sa boîte —
       rail de comparaison, couloirs de risque, étiquettes — dans l'interligne
       de la suivante, et la dernière n'en a pas. Le widget coupant à son bord,
       tout cela y disparaissait. On relève le point le plus BAS peint par la
       dernière ligne, et le bord intérieur du widget. */
    piedDeLigne: (() => {
      const host = document.querySelector("#harness-tail-minigantt");
      const root = host ? host.querySelector(".lp-widget-minigantt") : null;
      if (!root) return null;
      const rows = [...root.querySelectorAll(".lp-widget-minigantt-row")];
      const last = rows[rows.length - 1];
      if (!last) return null;
      const bas = last.getBoundingClientRect().bottom;
      let plusBas = bas;
      let coupable = "";
      last.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        if (r.bottom > plusBas) { plusBas = r.bottom; coupable = el.className.toString(); }
      });
      const b = root.getBoundingClientRect();
      const cs = getComputedStyle(root);
      return {
        debord: +(plusBas - bas).toFixed(1),
        coupable,
        // Bord INTÉRIEUR : c'est là que `overflow:hidden` tranche.
        marge: +(b.bottom - parseFloat(cs.borderBottomWidth || 0) - plusBas).toFixed(1),
        coupe: cs.overflowY,
        lignes: rows.length,
      };
    })(),
    /* Trait vertical d'un jalon (#95) : deux des quatre repères le portent, et
       chacun doit PROLONGER son losange — départ au repère, arrivée au bas des
       lignes. Tout est relevé dans le référentiel du widget. */
    rules: (() => {
      const host = document.querySelector("#harness-first-minigantt");
      if (!host) return { premier: 0, second: 0, z: "", traits: [], lignes: null };
      const base = host.getBoundingClientRect();
      const repere = (id) => {
        const el = [...host.querySelectorAll(".lp-widget-minigantt-marker.is-milestone")]
          .find((m) => (m.textContent || "").trim().startsWith(id));
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.x - base.x), haut: Math.round(b.y - base.y), bas: Math.round(b.y - base.y + b.height) };
      };
      const lignes = [...host.querySelectorAll(".lp-widget-minigantt-row")].map((el) => el.getBoundingClientRect());
      return {
        premier: host.querySelectorAll(".lp-widget-minigantt-rule").length,
        second: document.querySelectorAll("#harness-second-minigantt .lp-widget-minigantt-rule").length,
        z: (() => { const el = host.querySelector(".lp-widget-minigantt-rule-layer"); return el ? getComputedStyle(el).zIndex : ""; })(),
        traits: [...host.querySelectorAll(".lp-widget-minigantt-rule")].map((el) => {
          const b = el.getBoundingClientRect();
          return {
            x: Math.round(b.x - base.x), haut: Math.round(b.y - base.y), bas: Math.round(b.y - base.y + b.height),
            // Épaisseur RÉELLEMENT peinte : c'est elle que l'issue met en cause,
            // pas la valeur enregistrée.
            epaisseur: getComputedStyle(el).borderLeftWidth,
          };
        }),
        lignes: lignes.length ? {
          haut: Math.round(Math.min(...lignes.map((b) => b.y)) - base.y),
          bas: Math.round(Math.max(...lignes.map((b) => b.y + b.height)) - base.y),
        } : null,
        codir: repere("Décision CODIR"),
        essais: repere("Essais en eau"),
      };
    })(),
    /* Un symbole par type de jalon : deux types ne doivent jamais se
       ressembler. Le repère est un tracé SVG depuis que les symboles sont
       réglables — son empreinte est donc le tracé lui-même, plus sa couleur :
       un même symbole en deux couleurs reste deux repères distincts. */
    markerShapes: [...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-marker svg path")]
      .map((el) => el.getAttribute("d") || ""),
    markerPrints: [...new Set([...document.querySelectorAll("#harness-first-minigantt .lp-widget-minigantt-marker svg")]
      .map((el) => [el.querySelector("path")?.getAttribute("d"), getComputedStyle(el).color].join("|")))],
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

/* Rail des vues (issue #65). Les grandes cartes rectangulaires doivent être
   redevenues des bulles, alignées sur la ligne centrale et de hauteur
   régulière — ce qui ne se lit que sur un rendu. */
const rail = {};
try {
  await page.locator("#harness-view-rail").scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  Object.assign(rail, await page.evaluate(() => {
    const nav = document.querySelector("#harness-view-rail");
    const btns = [...nav.querySelectorAll(".lp-view-rail-btn")];
    const rects = btns.map((b) => b.getBoundingClientRect());
    const cs = btns.map((b) => getComputedStyle(b));
    const ligne = getComputedStyle(nav, "::before");
    const badges = [...nav.querySelectorAll(".lp-view-rail-btn-count")];
    const roundel = nav.querySelector(".lp-view-rail-folder");
    const rRoundel = roundel ? roundel.getBoundingClientRect() : null;
    const centre = (r) => Math.round(r.left + r.width / 2);
    const ecarts = [];
    for (let i = 1; i < rects.length; i++) ecarts.push(Math.round(rects[i].top - rects[i - 1].bottom));
    return {
      nb: btns.length,
      // Rondes : autant de haut que de large, et un rayon en pourcentage.
      rondes: rects.every((r) => Math.abs(r.width - r.height) <= 1) && cs.every((c) => c.borderRadius === "50%"),
      hauteurs: [...new Set(rects.map((r) => Math.round(r.height)))],
      // Aucune bulle ne doit provoquer de rupture de hauteur.
      hauteurMax: Math.max(...rects.map((r) => Math.round(r.height))),
      // Espacement régulier entre toutes les bulles.
      ecarts: [...new Set(ecarts)],
      // Toutes centrées sur la même verticale, roundels de dossier compris.
      centres: [...new Set(rects.map(centre).concat(rRoundel ? [centre(rRoundel)] : []))],
      ligneVisible: ligne.display !== "none" && parseFloat(ligne.width) > 0,
      // Le libellé reste dans le DOM (lecteurs d'écran) mais ne prend pas de place.
      libelleInvisible: [...nav.querySelectorAll(".lp-view-rail-label")].every((l) => l.getBoundingClientRect().width <= 2),
      libelleDansLeDom: nav.querySelector(".lp-view-rail-label")?.textContent.trim() || "",
      // Un badge par bulle qui en a un — jamais sur celle qui n'en a pas.
      nbBadges: badges.length,
      badgesLargeurs: badges.map((b) => Math.round(b.getBoundingClientRect().width)),
      /* Lisibilité réelle : le texte du badge tient-il dans le badge ? Comparer
         des largeurs entre elles ne conclut rien — un compteur court se loge
         déjà dans la largeur plancher, et seul le débordement ment. */
      badgesTronques: badges.filter((b) => b.scrollWidth > b.clientWidth + 1).length,
      // Le badge se pose sur le bord inférieur droit, sans s'éloigner de la bulle.
      badgeAncre: badges.every((b) => {
        const rb = b.getBoundingClientRect();
        const bulle = b.closest(".lp-view-rail-btn").getBoundingClientRect();
        /* Ancré au coin inférieur droit, et pas plus large que sa bulle : un
           compteur qui déborderait des deux côtés cesserait d'être un badge. */
        return rb.right > bulle.right - 2 && rb.bottom > bulle.bottom - 2 && rb.width < bulle.width;
      }),
    };
  }));
} catch (error) {
  rail.error = String(error).split("\n")[0];
}

/* Heat map mensuelle (issue #68). Le reflow est du CSS pur : il ne se vérifie
   que sur un rendu, à deux largeurs. */
const mois = { large: null, etroit: null, passe: null };
try {
  const mesure = async (hote) => {
    await page.locator(hote).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    return page.evaluate((sel) => {
      const conteneur = document.querySelector(`${sel} .lp-widget-heatmap-months`);
      const blocs = [...document.querySelectorAll(`${sel} .lp-widget-heatmap-month`)];
      const boite = conteneur ? conteneur.getBoundingClientRect() : null;
      const rects = blocs.map((b) => b.getBoundingClientRect());
      return {
        blocs: blocs.length,
        // Autant de « top » distincts que de lignes occupées par les mois.
        lignes: new Set(rects.map((r) => Math.round(r.top))).size,
        // Un mois qui déborde du conteneur est un mois qu'on ne peut pas lire.
        debordent: boite ? rects.filter((r) => r.left < boite.left - 1 || r.right > boite.right + 1).length : -1,
        // Barre de défilement horizontale : ce que l'issue demande de supprimer.
        defileH: conteneur ? Math.round(conteneur.scrollWidth - conteneur.clientWidth) : -1,
        titres: blocs.map((b) => (b.querySelector(".lp-widget-heatmap-month-title")?.textContent || "").trim()),
        // Ce qui reste sous le dernier mois : le calendrier doit occuper la
        // hauteur offerte, pas se tasser en haut d'un grand vide.
        videEnBas: boite && rects.length ? Math.round(boite.bottom - Math.max(...rects.map((r) => r.bottom))) : -1,
      };
    }, hote);
  };
  mois.large = await mesure("#harness-heatmap-month-large");
  mois.etroit = await mesure("#harness-heatmap-month-etroit");
  mois.passe = await page.evaluate((sel) => {
    const passees = [...document.querySelectorAll(`${sel} .lp-widget-heatmap-cell-past`)];
    const colorees = [...document.querySelectorAll(`${sel} .lp-widget-heatmap-cell`)]
      .filter((c) => { const bg = getComputedStyle(c).backgroundColor; return bg && bg !== "rgba(0, 0, 0, 0)"; });
    const une = passees[0];
    const numero = une ? une.querySelector(".lp-widget-heatmap-daynum") : null;
    return {
      nbPassees: passees.length,
      nbColorees: colorees.length,
      // Le voile : posé en ::after, il ne se lit que sur le style calculé.
      voile: une ? getComputedStyle(une, "::after").opacity : "",
      // Sur une case lavée, le blanc deviendrait illisible.
      numeroBlanc: numero ? getComputedStyle(numero).color === "rgb(255, 255, 255)" : null,
    };
  }, "#harness-heatmap-month-large");
} catch (error) {
  mois.error = String(error).split("\n")[0];
}

/* Icônes par URL (issue #70). La reconnaissance est couverte par un test
   unitaire ; ce qui ne l'est pas, c'est ce que le navigateur AFFICHE — une URL
   non reconnue retombait sur la branche « emoji » et s'écrivait en toutes
   lettres, sans la moindre erreur. */
const icones = { cas: [] };
try {
  await page.locator("#harness-icon-urls").scrollIntoViewIfNeeded();
  // Laisser le temps aux chargements (et aux échecs) de se produire.
  await page.waitForTimeout(600);
  icones.cas = await page.evaluate(() => [...document.querySelectorAll("#harness-icon-urls > span")].map((sp) => {
    const img = sp.querySelector("img");
    const svg = sp.querySelector("svg");
    const boite = sp.getBoundingClientRect();
    return {
      nom: sp.dataset.icon,
      img: !!img,
      // Le repli : une icône, pas un trou ni une image cassée.
      repli: !img && !!svg,
      // Une URL rendue en toutes lettres : le symptôme exact de l'issue.
      texte: sp.textContent.trim(),
      largeur: Math.round(boite.width),
      hauteur: Math.round(boite.height),
    };
  }));
} catch (error) {
  icones.error = String(error).split("\n")[0];
}

/* Colonne de champs du Mini-Gantt (issue #66). Elle réservait 232 px quoi
   qu'elle contienne : un seul anneau d'avancement écrasait la piste de près de
   deux cents pixels pour rien. Aucun test unitaire ne peut le voir — la largeur
   est MESURÉE sur le rendu. */
const colonne = { cinq: null, un: null, zero: null, pisteUn: null, pisteCinq: null, pisteZero: null };
try {
  const largeur = async (hote) => {
    await page.locator(hote).scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    return page.evaluate((sel) => {
      const champs = document.querySelector(`${sel} .lp-widget-minigantt-fields-aligned`);
      const racine = document.querySelector(`${sel} .lp-widget-minigantt`);
      const piste = document.querySelector(`${sel} .lp-widget-minigantt-track`);
      const bordRacine = racine ? racine.getBoundingClientRect().right : null;
      const bordPiste = piste ? piste.getBoundingClientRect().right : null;
      return {
        // Sans aucun champ configuré, la colonne n'est pas rendue du tout :
        // `colonnes` vaut alors zéro, et c'est la bonne réponse.
        colonnes: document.querySelectorAll(`${sel} .lp-widget-minigantt-fields-aligned`).length,
        width: champs ? Math.round(champs.getBoundingClientRect().width) : null,
        // Ce que la colonne coûte VRAIMENT à la piste : l'écart entre le bord
        // droit de la piste et celui du widget. C'est la seule mesure qui vaut
        // pour les trois cas, y compris celui où la colonne n'existe pas.
        reste: bordRacine !== null && bordPiste !== null ? Math.round(bordRacine - bordPiste) : null,
      };
    }, hote);
  };
  const cinq = await largeur("#harness-first-minigantt");
  const un = await largeur("#harness-second-minigantt");
  const zero = await largeur("#harness-nofields-minigantt");
  colonne.cinq = cinq.width; colonne.pisteCinq = cinq.reste;
  colonne.un = un.width; colonne.pisteUn = un.reste;
  colonne.zero = zero.colonnes; colonne.pisteZero = zero.reste;
} catch (error) {
  colonne.error = String(error).split("\n")[0];
}

/* Coche du Mini-Gantt (issue #48). Rien de ce qui suit n'est visible d'un test
   unitaire : la logique pose bien ce qu'il faut, c'est le RENDU qui décide de
   l'afficher — et un premier lot avait livré un cadre entièrement nu.

   Le second Mini-Gantt est choisi parce qu'il n'a AUCUNE annotation propre :
   tout ce qui apparaît après la coche vient donc de la coche. */
const coche = { frames: 0, icons: 0, corners: 0, cornerOpacity: "", leftGap: null, rightGap: null, cornerOffsetX: null, cornerOffsetY: null, apres: 0, boutons: [], lignes: 0, titreGras: "", ombreBarre: "", cochee: null, apresCochee: null };
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
    const coinEl = document.querySelector(`${sel} .lp-widget-minigantt-frame-corner`);
    const coin = rect(coinEl);
    return {
      frames: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame`).length,
      icons: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame-label .lp-widget-minigantt-frame-icon`).length,
      corners: document.querySelectorAll(`${sel} .lp-widget-minigantt-frame-corner`).length,
      cornerOpacity: coinEl ? getComputedStyle(coinEl).opacity : "",
      leftGap: cadre && barre ? Math.round(barre.left - cadre.left) : null,
      rightGap: cadre && barre ? Math.round(cadre.right - barre.right) : null,
      /* La pastille est CENTRÉE sur le coin supérieur droit : elle chevauche
         volontairement le trait, moitié dedans moitié dehors. Ce qu'on contrôle
         est donc son centre, pas son bord — un ancrage par le bord gauche la
         ferait flotter entièrement hors du cadre sans la moindre erreur. */
      cornerOffsetX: cadre && coin ? Math.round(cadre.right - (coin.left + coin.width / 2)) : null,
      cornerOffsetY: cadre && coin ? Math.round(cadre.top - (coin.top + coin.height / 2)) : null,
      /* « Supprimer focus et présenter » (#48). Les boutons de zoom − / Auto / +
         et les trois « + Bloc / + Encadré / + Jalon » restent : on relève donc
         TOUS les libellés de la barre de contrôles et on vérifie qu'aucun mode
         n'y subsiste, plutôt que de compter — un décompte laisserait passer un
         mode qui prendrait la place d'un bouton retiré. */
      boutons: Array.from(document.querySelectorAll(`${sel} .lp-widget-minigantt-toolbar button`))
        .map((b) => (b.textContent || "").trim()),
      /* L'emphase demandée : gras du titre et liseré rouge épais de la barre.
         Mesuré sur le RENDU : une règle bien écrite mais surclassée par une
         autre ne se voit que là. */
      lignes: document.querySelectorAll(`${sel} .lp-widget-minigantt-row.is-selected`).length,
      titreGras: ligne ? getComputedStyle(ligne.querySelector(".lp-widget-minigantt-label-title") || ligne).fontWeight : "",
      ombreBarre: ligne && ligne.querySelector(".lp-widget-minigantt-bar")
        ? getComputedStyle(ligne.querySelector(".lp-widget-minigantt-bar")).boxShadow
        : "",
    };
  }, hote));
  /* La coche LIT les encadrés : après le geste, elle doit se voir cochée sans
     qu'aucun état éphémère ne la soutienne. */
  coche.cochee = await boite.isChecked();
  /* Décocher doit tout retirer : sans cela le cadre s'accumulerait à chaque
     coche. Le banc a grossi : sans ce recentrage, la case peut se retrouver
     hors de la fenêtre au moment du second geste et le contrôle expire sans
     que rien ne soit en cause. */
  const boite2 = page.locator(`${hote} .lp-widget-minigantt-select`).first();
  await boite2.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  /* Clic à la position mesurée plutôt que `uncheck()` : poser l'encadré change
     la hauteur du widget, et sur un banc devenu long l'heuristique de stabilité
     de Playwright peut attendre indéfiniment un élément qui, lui, ne bouge
     plus. Le clic reste un VRAI clic de souris — on ne contourne que l'attente,
     pas l'interaction. */
  {
    const b = await boite2.boundingBox();
    await page.mouse.click(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2));
  }
  await page.waitForTimeout(400);
  coche.apres = await page.locator(`${hote} .lp-widget-minigantt-frame`).count();
  coche.apresCochee = await boite2.isChecked();
} catch (error) {
  coche.error = String(error).split("\n")[0];
}

/* Changer de tableau de bord depuis la fiche du widget (issue #58).
   La logique du transfert est couverte par tests/widget-transfer.test.mjs ; ce
   qui ne l'est pas, c'est la fiche : le bouton peut disparaître, la liste
   proposer la mauvaise chose, ou le bouton de validation partir sans les
   réglages en cours — autant de pannes muettes. */
const transfert = { bouton: 0, options: 0, defaut: "", ici: 0, done: "", recherche: 0, filtrees: -1, filtreLabel: "", videMessage: 0 };
try {
  await page.locator("#harness-open-treemap-form").click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(300);
  transfert.bouton = await page.locator(".lp-modal .lp-widget-transfer .lp-btn-mini").count();
  await page.locator(".lp-modal .lp-widget-transfer .lp-btn-mini").click();
  const cible = page.locator(".lp-modal .lp-widget-transfer-panel .lp-color-select").first();
  // La destination proposée d'emblée ne doit PAS être celle où le widget se
  // trouve déjà : ouvrir sur « ici » invite à valider un transfert vide.
  transfert.defaut = (await cible.locator(".lp-color-select-label").innerText()).trim();
  await cible.locator(".lp-color-select-btn").click();
  await page.waitForTimeout(250);
  transfert.options = await cible.locator(".lp-color-select-option").count();
  transfert.ici = await cible.locator(".lp-color-select-option", { hasText: "— ici" }).count();
  /* Recherche rapide (retour de Quentin sur #58). Elle doit filtrer sur le nom
     de la PAGE autant que sur celui du tableau, et ignorer les accents. */
  transfert.recherche = await cible.locator(".lp-select-search").count();
  if (transfert.recherche) {
    await cible.locator(".lp-select-search").fill("suivi");
    await page.waitForTimeout(250);
    transfert.filtrees = await cible.locator(".lp-color-select-option").count();
    transfert.filtreLabel = (await cible.locator(".lp-color-select-option").first().innerText()).trim();
    await cible.locator(".lp-select-search").fill("zzz");
    await page.waitForTimeout(250);
    transfert.videMessage = await cible.locator(".lp-select-empty").count();
    await cible.locator(".lp-select-search").fill("");
    await page.waitForTimeout(250);
  }
  await cible.locator(".lp-color-select-option", { hasText: "Chantiers › Suivi" }).first().click();
  await page.waitForTimeout(250);
  await page.locator(".lp-modal .lp-widget-transfer-modes label").nth(1).click();
  await page.locator(".lp-modal .lp-widget-transfer-panel .lp-btn-primary").click();
  await page.waitForTimeout(400);
  transfert.done = (await page.locator("#harness-transfer-done").innerText()).trim();
} catch (error) {
  transfert.error = String(error).split("\n")[0];
}

/* Bandeau de paramètres du widget (issue #56). Le contrôle porte sur ce qui
   défile SOUS le bandeau, pas sur le bandeau lui-même : la panne réelle était
   un axe collant calé sur une barre d'onglets absente, qui laissait une bande
   de 82 px où le contenu défilait à découvert. */
const bandeau = { axisTop: null, headOpaque: false, headZ: "", contentAboveAxis: 0, axisY: null, headBottom: null, bodyPadTop: 0 };
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
const heatmap = { tip: "", axisOptions: 0, metricOptions: 0, savedCols: "", listHead: "", listItems: 0, listInvite: "" };
try {
  const plein = page.locator("#harness-heatmap .lp-widget-hmgrid-cell:not(.is-empty)").first();
  await plein.hover();
  await page.waitForTimeout(250);
  heatmap.tip = (await page.locator(".lp-widget-hmgrid-tip").innerText()).trim();

  // Découpe en deux volets : le volet de droite existe AVANT tout clic (avec son
  // invite), et le clic sur une case le remplit. Le faire apparaître au clic
  // redimensionnerait la grille et ferait sauter les cases sous le curseur.
  heatmap.listInvite = (await page.locator("#harness-heatmap .lp-widget-hmgrid-tasklist-empty").innerText().catch(() => "")).trim();
  await plein.click();
  await page.waitForTimeout(250);
  heatmap.listHead = (await page.locator("#harness-heatmap .lp-widget-hmgrid-tasklist-head span").first().innerText()).trim();
  heatmap.listItems = await page.locator("#harness-heatmap .lp-widget-hmgrid-tasklist-item").count();

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
const taskComparison = { checkbox: 0, checkedAtOpen: null, fieldsAtOpen: -1, fieldsAfterCheck: -1, errors: [], start: "", end: "", errorsAfterCopy: -1, fieldsAfterUncheck: -1, startAfterRecheck: "" };
try {
  await page.locator("#harness-open-task-modal").click();
  await page.waitForSelector(".lp-modal #task-meta-block", { timeout: 10000 });
  const box = page.locator(".lp-modal #task-meta-block");
  taskMeta.checkbox = await box.count();
  taskMeta.checked = await box.isChecked();
  taskMeta.controls = await page.locator(".lp-modal .lp-density-btn", { hasText: /Phase|Fenêtre de décision|Pointillés|Continue/ }).count();
  taskMeta.hints = (await page.locator(".lp-modal .lp-gantt-annot-hint").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
  /* Criticité (issue #69) : sur la même ligne que Projet, Statut et Type, et
     porteuse d'une pastille. Les deux se vérifient au rendu et nulle part
     ailleurs — un champ déplacé dans le JSX peut très bien retomber à la ligne
     faute de règle de mise en page. */
  Object.assign(taskMeta, await page.evaluate(() => {
    const rangee = document.querySelector(".lp-modal .lp-row4");
    const champs = rangee ? [...rangee.children] : [];
    const hauts = champs.map((c) => Math.round(c.getBoundingClientRect().top));
    const critique = champs[champs.length - 1];
    const bouton = critique ? critique.querySelector(".lp-color-select-btn") : null;
    const voisins = [...(rangee ? rangee.querySelectorAll(".lp-color-select-btn, .lp-field > select, .lp-field > input") : [])];
    return {
      // Quatre champs, tous sur la MÊME ligne : des « top » identiques.
      critFields: champs.length,
      critSameRow: hauts.length ? hauts.every((h) => Math.abs(h - hauts[0]) <= 1) : false,
      critLabel: critique ? (critique.querySelector("label")?.textContent || "").replace(/\s+/g, " ").trim() : "",
      // Hauteurs alignées : un <select> natif à côté de trois boutons ne
      // tombait pas à la même hauteur, et c'est visible immédiatement.
      critHeights: [...new Set(voisins.map((v) => Math.round(v.getBoundingClientRect().height)))],
      // Pastille de la valeur choisie : absente tant que rien n'est choisi.
      critDotOnValue: bouton ? bouton.querySelectorAll(".lp-color-select-dot").length : -1,
    };
  }));
  // Ouvrir la liste : trois niveaux à pastille, « Non définie » sans pastille.
  await page.locator(".lp-modal .lp-row4 .lp-field:last-child .lp-color-select-btn").click();
  await page.waitForTimeout(250);
  Object.assign(taskMeta, await page.evaluate(() => {
    const options = [...document.querySelectorAll(".lp-modal .lp-row4 .lp-field:last-child .lp-color-select-option")];
    const couleur = (el) => {
      const dot = el.querySelector(".lp-color-select-dot");
      return dot ? getComputedStyle(dot).backgroundColor : "";
    };
    const rond = (el) => {
      const dot = el.querySelector(".lp-color-select-dot");
      if (!dot) return "";
      const r = dot.getBoundingClientRect();
      // « Rond » se vérifie sur le rendu : un rayon en pourcentage sur un carré.
      return `${Math.round(r.width)}x${Math.round(r.height)}:${getComputedStyle(dot).borderRadius}`;
    };
    return {
      critOptions: options.map((o) => o.textContent.replace(/\s+/g, " ").trim()),
      critDots: options.map(couleur),
      critShape: options.slice(1).map(rond),
    };
  }));
  await page.locator(".lp-modal .lp-row4 .lp-field:last-child .lp-color-select-option").nth(1).click();
  await page.waitForTimeout(250);
  taskMeta.critDotAfterPick = await page.locator(".lp-modal .lp-row4 .lp-field:last-child .lp-color-select-btn .lp-color-select-dot").count();

  /* Tableaux Markdown (issue #71). Le rendu est couvert par
     tests/markdown-table.test.mjs ; ce qui ne l'est pas, c'est le va-et-vient
     Édition → Aperçu → Édition dans la vraie fiche, et le fait que le texte
     source en ressorte à l'octet près. */
  const TABLEAU_MD = "| N° de réserve | Statut / observations |\n|---:|---|\n| 5 | Non fait. |\n| 8 | Non fait : absence de constat contradictoire… |";
  await page.locator(".lp-modal .lp-desc-mode-toggle button", { hasText: "Édition" }).click();
  await page.waitForTimeout(200);
  const zone = page.locator(".lp-modal textarea").first();
  await zone.fill(TABLEAU_MD);
  await page.waitForTimeout(200);
  await page.locator(".lp-modal .lp-desc-mode-toggle button", { hasText: "Aperçu" }).click();
  await page.waitForTimeout(300);
  Object.assign(taskMeta, await page.evaluate(() => {
    const t = document.querySelector(".lp-modal .lp-desc-preview table.lp-md-table");
    const wrap = document.querySelector(".lp-modal .lp-desc-preview .lp-md-table-wrap");
    const modale = document.querySelector(".lp-modal");
    return {
      mdTables: document.querySelectorAll(".lp-modal .lp-desc-preview table.lp-md-table").length,
      mdHeaders: t ? [...t.querySelectorAll("th")].map((c) => c.textContent.trim()) : [],
      mdCells: t ? t.querySelectorAll("td").length : 0,
      mdAlign: t ? getComputedStyle(t.querySelector("th")).textAlign : "",
      // Des paragraphes pleins de barres verticales : le symptôme d'origine.
      mdPipeParagraphs: [...document.querySelectorAll(".lp-modal .lp-desc-preview p")].filter((p) => p.textContent.includes("|")).length,
      // Le défilement reste DANS le tableau : la modale ne s'élargit pas.
      mdScrollsItself: wrap ? getComputedStyle(wrap).overflowX === "auto" : false,
      mdModalOverflow: modale ? Math.round(modale.scrollWidth - modale.clientWidth) : -1,
    };
  }));
  await page.locator(".lp-modal .lp-desc-mode-toggle button", { hasText: "Édition" }).click();
  await page.waitForTimeout(250);
  taskMeta.mdRoundTrip = await page.locator(".lp-modal textarea").first().inputValue();
  taskMeta.mdSource = TABLEAU_MD;

  /* Mode comparaison de la tâche. Rien de ce qui suit ne se voit d'un test
     unitaire : les fonctions pures savent valider et copier, c'est la FICHE qui
     décide d'afficher les champs, l'erreur, et de refuser l'enregistrement. */
  const cmpBox = page.locator(".lp-modal #task-comparison");
  taskComparison.checkbox = await cmpBox.count();
  if (taskComparison.checkbox) {
    // Une tâche sans comparaison : la case est décochée et aucun champ n'est là.
    taskComparison.checkedAtOpen = await cmpBox.isChecked();
    taskComparison.fieldsAtOpen = await page.locator(".lp-modal #task-comparison-start, .lp-modal #task-comparison-end").count();
    await cmpBox.check();
    await page.waitForTimeout(300);
    taskComparison.fieldsAfterCheck = await page.locator(".lp-modal #task-comparison-start, .lp-modal #task-comparison-end").count();
    // Activée sans dates : deux erreurs explicites, à côté des champs.
    taskComparison.errors = (await page.locator(".lp-modal .lp-gantt-annot-error").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
    taskComparison.saveDisabledLook = await page.locator(".lp-modal").getByRole("button", { name: "Copier les dates actuelles comme référence" }).count();
    // Le bouton de copie remplit les deux champs, et seulement sur clic.
    await page.locator(".lp-modal").getByRole("button", { name: "Copier les dates actuelles comme référence" }).click();
    await page.waitForTimeout(300);
    taskComparison.start = await page.locator(".lp-modal #task-comparison-start").inputValue();
    taskComparison.end = await page.locator(".lp-modal #task-comparison-end").inputValue();
    taskComparison.errorsAfterCopy = await page.locator(".lp-modal .lp-gantt-annot-error").count();
    // Décocher masque les champs sans effacer ce qui vient d'être saisi.
    await cmpBox.uncheck();
    await page.waitForTimeout(250);
    taskComparison.fieldsAfterUncheck = await page.locator(".lp-modal #task-comparison-start, .lp-modal #task-comparison-end").count();
    await cmpBox.check();
    await page.waitForTimeout(250);
    taskComparison.startAfterRecheck = await page.locator(".lp-modal #task-comparison-start").inputValue();
    await cmpBox.uncheck();
    await page.waitForTimeout(200);
  }

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

/* Création d'une tâche : la référence doit naître calée sur les dates demandées,
   VISIBLE dans la fiche, suivre un changement de dates tant qu'on n'y touche
   pas, et se figer telle quelle à l'enregistrement. */
const creation = { checked: null, start: "", end: "", startApresDate: "", endApresDate: "", startApresSaisie: "", enregistre: null };
try {
  await page.locator("#harness-open-task-create").click();
  await page.waitForSelector(".lp-modal #task-comparison", { timeout: 10000 });
  creation.checked = await page.locator(".lp-modal #task-comparison").isChecked();
  creation.start = await page.locator(".lp-modal #task-comparison-start").inputValue();
  creation.end = await page.locator(".lp-modal #task-comparison-end").inputValue();
  creation.dates = {
    start: await page.locator(".lp-modal input[type=date]").first().inputValue(),
    end: await page.locator(".lp-modal input[type=date]").nth(1).inputValue(),
  };
  // Changer la date de début APRÈS l'ouverture : la référence suit, puisque
  // c'est bien la date demandée qui fait la planification initiale.
  await page.locator(".lp-modal input[type=date]").first().fill("2026-10-05");
  await page.waitForTimeout(350);
  creation.startApresDate = await page.locator(".lp-modal #task-comparison-start").inputValue();
  creation.endApresDate = await page.locator(".lp-modal #task-comparison-end").inputValue();
  // …mais dès qu'on saisit une référence à la main, elle cesse de suivre.
  await page.locator(".lp-modal #task-comparison-start").fill("2026-01-15");
  await page.waitForTimeout(250);
  await page.locator(".lp-modal input[type=date]").first().fill("2026-11-02");
  await page.waitForTimeout(350);
  creation.startApresSaisie = await page.locator(".lp-modal #task-comparison-start").inputValue();
  // Enregistrer fige ce qui est à l'écran.
  await page.locator('.lp-modal input[placeholder="Ex. Revue DOE"]').fill("Tâche de banc");
  await page.locator(".lp-modal").getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(400);
  creation.enregistre = JSON.parse(await page.locator("#harness-created-comparison").textContent());
} catch (error) {
  creation.error = String(error).split("\n")[0];
  // La fiche reste ouverte si un geste a échoué : la refermer, sinon tous les
  // contrôles suivants tombent sur une modale qu'ils n'attendent pas.
  try { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } catch { /* rien à refermer */ }
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

/* Parité des réglages du Gantt (#86) : la fiche du widget Mini-Gantt et les
   réglages de la vue pleine page doivent offrir les MÊMES commandes
   d'affichage, les mêmes regroupements et la même validation des dates fixes.
   Les deux panneaux sont relevés à la suite, puis comparés l'un à l'autre. */
const releverPanneau = async (bouton) => {
  const modale = page.locator(".lp-modal").last();
  await page.locator(bouton).click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  const releve = {
    labels: (await modale.locator(".lp-field > label").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
    lignes: (await modale.locator(".lp-checkbox-line").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
    boutons: (await modale.locator(".lp-density-btn").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
    aides: (await modale.locator("p").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()),
    regroupements: [],
    erreurDatesFixes: "",
  };
  const selects = modale.locator("select");
  for (let i = 0; i < await selects.count(); i += 1) {
    const options = (await selects.nth(i).locator("option").allTextContents()).map((t) => t.trim());
    if (options.includes("Aucun regroupement")) { releve.regroupements = options; break; }
  }
  // Les explications dépendent du cadrage choisi : on passe par la fenêtre
  // glissante avant de relever, sinon la sienne n'est jamais rendue.
  await modale.locator(".lp-density-btn", { hasText: "Fenêtre glissante" }).first().click();
  await page.waitForTimeout(300);
  releve.aides.push(...(await modale.locator("p").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim()));
  // Cadrage « Dates fixes » sans aucune date : les deux panneaux doivent le dire.
  await modale.locator(".lp-density-btn", { hasText: "Dates fixes" }).first().click();
  await page.waitForTimeout(300);
  releve.erreurDatesFixes = (await modale.locator(".lp-gantt-annot-error").allTextContents()).join(" ").trim();
  // Échap plutôt qu'un bouton de pied de page : les deux panneaux n'ont pas le
  // même (« Terminé » pour la vue, « Annuler »/« Enregistrer » pour la fiche),
  // et la fiche refuse justement d'enregistrer un cadrage sans dates.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return releve;
};

/* Widget « Bulles » (#92). Ce que le banc doit prouver, et que ni les tests
   d'extraction ni la relecture ne peuvent dire : les bulles se rendent, les
   champs rangés SOUS une bulle restent dans leur ligne (en position absolue,
   ils débordaient sur la ligne suivante et la hauteur mesurée les ignorait),
   et les enveloppes des macro-bulles ont une surface non nulle, restent dans
   la zone des lignes et se décalent quand elles s'imbriquent. */
const bulles = await page.evaluate(() => {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), text: el.textContent.trim() };
  };
  const root = document.querySelector("#harness-bubbles .lp-widget-minigantt");
  if (!root) return { error: "widget Bulles absent du banc" };
  const rows = [...root.querySelectorAll(".lp-widget-minigantt-row")].map((row) => ({
    row: box(row),
    bubble: row.querySelector(".lp-bubble, .lp-bubble-milestone") ? box(row.querySelector(".lp-bubble, .lp-bubble-milestone")) : null,
    fields: row.querySelector(".lp-bubble-fields") ? box(row.querySelector(".lp-bubble-fields")) : null,
  }));
  const grouped = document.querySelector("#harness-bubbles-grouped .lp-widget-minigantt");
  /* Description sur trois lignes (#97) : on relève la bulle, sa description et
     son pied — c'est le pied qui disparaît si la hauteur ne suit pas. */
  /* Contenance d'une macro-bulle (#104) : chaque bulle de ses tâches doit être
     DANS son cadre, largeur minimale et jalon centré compris. Et largeur des
     champs (#103) : mêmes bords que la bulle au-dessus d'eux. */
  const edgeRoot = document.querySelector("#harness-bubbles-macro-edge .lp-widget-minigantt");
  const edge = edgeRoot ? {
    frames: [...edgeRoot.querySelectorAll(".lp-bubble-macro-frame")].map(box),
    bubbles: [...edgeRoot.querySelectorAll(".lp-bubble, .lp-bubble-milestone")].map(box),
    rows: [...edgeRoot.querySelectorAll(".lp-widget-minigantt-row")].map((row) => ({
      bubble: row.querySelector(".lp-bubble, .lp-bubble-milestone") ? box(row.querySelector(".lp-bubble, .lp-bubble-milestone")) : null,
      fields: row.querySelector(".lp-bubble-fields") ? box(row.querySelector(".lp-bubble-fields")) : null,
    })),
  } : null;
  /* Alignement des couches en mode bulles : la piste d'une ligne, celle de
     l'axe et la couche des macro-bulles doivent partir du MÊME bord. Un écart
     de gouttière décalait tout de 6 px, et le cadre d'une macro-bulle avec. */
  const alignement = (() => {
    const r = document.querySelector("#harness-bubbles-macro-edge .lp-widget-minigantt");
    if (!r) return null;
    const left = (sel) => { const el = r.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().left) : null; };
    return {
      ligne: left(".lp-widget-minigantt-track"),
      axe: left(".lp-widget-minigantt-axis-track"),
      grille: left(".lp-widget-minigantt-gridoverlay"),
      macros: left(".lp-bubble-macro-frames"),
    };
  })();
  const descRoot = document.querySelector("#harness-bubbles-desc .lp-widget-minigantt");
  const descRows = descRoot ? [...descRoot.querySelectorAll(".lp-widget-minigantt-row")].map((row) => {
    const bubble = row.querySelector(".lp-bubble");
    const desc = row.querySelector(".lp-bubble-desc");
    const foot = row.querySelector(".lp-bubble-foot");
    return {
      row: box(row),
      bubble: bubble ? box(bubble) : null,
      desc: desc ? { ...box(desc), lines: getComputedStyle(desc).webkitLineClamp } : null,
      foot: foot ? box(foot) : null,
    };
  }).filter((r) => r.desc) : [];
  return {
    alignement,
    edge,
    descRows,
    descBubbleH: descRoot && descRoot.querySelector(".lp-bubble")
      ? Math.round(descRoot.querySelector(".lp-bubble").getBoundingClientRect().height) : 0,
    baseBubbleH: root.querySelector(".lp-bubble")
      ? Math.round(root.querySelector(".lp-bubble").getBoundingClientRect().height) : 0,
    rows,
    bubbles: root.querySelectorAll(".lp-bubble").length,
    milestones: root.querySelectorAll(".lp-bubble-milestone").length,
    bars: root.querySelectorAll(".lp-widget-minigantt-bar").length,
    frames: [...root.querySelectorAll(".lp-bubble-macro-frame")].map(box),
    fills: [...root.querySelectorAll(".lp-bubble-macro")].map(box),
    labels: [...root.querySelectorAll(".lp-bubble-macro-label")].map(box),
    progress: [...root.querySelectorAll(".lp-bubble-macro-progress")].map(box),
    axis: root.querySelector(".lp-widget-minigantt-axis") ? box(root.querySelector(".lp-widget-minigantt-axis")) : null,
    // Le mode bulles supprime la colonne d'étiquettes de gauche : le titre vit
    // dans la bulle. La piste doit donc partir du bord du widget.
    labelColumn: root.querySelectorAll(".lp-widget-minigantt-label").length,
    legend: grouped ? [...grouped.querySelectorAll(".lp-bubble-legend-item")].map(box) : [],
    groupHeads: grouped ? grouped.querySelectorAll(".lp-widget-minigantt-group-head").length : 0,
    groupedBubbles: grouped ? grouped.querySelectorAll(".lp-bubble, .lp-bubble-milestone").length : 0,
  };
});

/* Infobulle et poignées (#106). Approcher la poignée d'avancement ouvrait
   l'infobulle juste dessus, et l'on glissait à l'aveugle. Le contrôle tient en
   deux gestes : sur le corps de la bulle l'infobulle doit paraître, sur la
   poignée elle doit se taire. */
const poignee = {};
try {
  /* Page rechargée : les scénarios précédents laissent des modales ouvertes,
     dont le voile intercepterait le survol. Le banc est sans état persistant. */
  await page.reload({ waitUntil: "load", timeout: 90000 });
  await page.waitForSelector("#harness-bubbles .lp-bubble", { timeout: 90000 });
  await page.waitForTimeout(1500);
  const bulle = page.locator("#harness-bubbles .lp-bubble").first();
  await bulle.scrollIntoViewIfNeeded();
  await bulle.locator(".lp-bubble-title").hover();
  await page.waitForTimeout(250);
  poignee.surLeCorps = await page.locator(".lp-widget-metro-tooltip").count();
  await bulle.locator(".lp-bubble-progress-handle").hover();
  await page.waitForTimeout(250);
  poignee.surLaPoignee = await page.locator(".lp-widget-metro-tooltip").count();
  // Puis on revient sur le corps : l'information ne doit pas être perdue.
  await bulle.locator(".lp-bubble-title").hover();
  await page.waitForTimeout(250);
  poignee.retourSurLeCorps = await page.locator(".lp-widget-metro-tooltip").count();
} catch (error) {
  poignee.error = String(error).split("\n")[0];
}

/* Le trait vertical se coche-t-il VRAIMENT là où l'issue le demande, dans les
   paramètres du jalon, et le diagramme suit-il ? (#95) Compter des traits déjà
   posés dans la fixture ne le dit pas : le premier essai portait un réglage qui
   ne se voyait nulle part. On ouvre donc le jalon depuis son propre losange, on
   coche, et on recompte. */
const reglageJalon = {};
try {
  await page.reload({ waitUntil: "load", timeout: 90000 });
  await page.waitForSelector("#harness-first-minigantt .lp-widget-minigantt-marker", { timeout: 90000 });
  await page.waitForTimeout(1500);
  const widget = page.locator("#harness-first-minigantt");
  reglageJalon.avant = await widget.locator(".lp-widget-minigantt-rule").count();
  // « Mise en service » n'a pas de trait dans la fixture : c'est celui-là qu'on
  // coche, en passant par son losange comme le ferait n'importe qui.
  await widget.locator(".lp-widget-minigantt-marker-label", { hasText: "Mise en service" }).first().click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  await page.waitForTimeout(400);
  const modale = page.locator(".lp-modal").last();
  const ligne = modale.locator(".lp-checkbox-line", { hasText: "trait vertical" }).first();
  reglageJalon.presente = await ligne.count();
  reglageJalon.libelle = reglageJalon.presente ? (await ligne.textContent()).replace(/\s+/g, " ").trim() : "";
  if (reglageJalon.presente) {
    const coche = ligne.locator("input[type=checkbox]");
    reglageJalon.cocheAvant = await coche.isChecked();
    await coche.click();
    await page.waitForTimeout(300);
    reglageJalon.cocheApres = await coche.isChecked();
  }
  // Le curseur d'épaisseur n'apparaît qu'une fois la case cochée : on le règle
  // dans la foulée, et le trait doit changer d'épaisseur pour de bon.
  const curseur = modale.locator(".lp-field", { hasText: "Épaisseur du trait" }).locator("input[type=range]").first();
  reglageJalon.curseur = await curseur.count();
  if (reglageJalon.curseur) {
    await curseur.fill("5");
    await page.waitForTimeout(300);
    reglageJalon.curseurLu = await curseur.inputValue();
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  reglageJalon.apres = await widget.locator(".lp-widget-minigantt-rule").count();
  reglageJalon.epaisseurs = await widget.locator(".lp-widget-minigantt-rule")
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderLeftWidth));
} catch (error) {
  reglageJalon.error = String(error).split("\n")[0];
}

const parite = {};
try {
  /* Page rechargée : les scénarios précédents laissent des modales ouvertes,
     dont le voile intercepterait les clics. Le banc est sans état persistant,
     un rechargement le remet à neuf. */
  await page.reload({ waitUntil: "load", timeout: 90000 });
  await page.waitForSelector("#harness-open-gantt-view-settings", { timeout: 90000 });
  await page.waitForTimeout(1500);
  parite.vue = await releverPanneau("#harness-open-gantt-view-settings");
  parite.widget = await releverPanneau("#harness-open-gantt-widget-form");
} catch (error) {
  parite.error = String(error).split("\n")[0];
}

// Organigramme « Métro » (#295) : plan rendu, aucun libellé ne se chevauche
// dans le rendu RÉEL (texte mesuré par le navigateur, pas l'estimation du
// layout), bifurcation alignée, correspondances basculables, zoom, clic qui
// ouvre les fiches existantes, bascule de mode, et barre d'outils tenue dans
// un widget étroit.
const orgMetro = { error: null };
try {
  const host = "#harness-orgmetro";
  await page.locator(host).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  Object.assign(orgMetro, await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const texts = [...root.querySelectorAll(".lp-orgmetro-label, .lp-orgmetro-badge")].map((el) => ({ key: el.getAttribute("data-metro-key") || el.textContent, ...box(el) }));
    const overlaps = [];
    for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i], b = texts[j];
      if (a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1) overlaps.push(a.key + " × " + b.key);
    }
    const g = root.querySelector("[data-metro-viewport]");
    return {
      stations: root.querySelectorAll(".lp-orgmetro-station").length,
      duplicates: root.querySelectorAll(".lp-orgmetro-station.is-duplicate").length,
      junctions: root.querySelectorAll(".lp-orgmetro-junction").length,
      transverse: root.querySelectorAll(".lp-orgmetro-transverse").length,
      independent: root.querySelectorAll(".lp-orgmetro-badge.is-independent").length,
      leadHalos: root.querySelectorAll(".lp-orgmetro-lead-halo").length,
      leadStars: root.querySelectorAll(".lp-orgmetro-label .lp-orgmetro-lead-star").length,
      badgeLeads: [...root.querySelectorAll(".lp-orgmetro-badge-sub")].map((el) => el.textContent),
      groups: ["lines", "branches", "correspondences", "stations", "labels"].filter((n) => root.querySelector(".lp-orgmetro-" + n)).length,
      overlaps,
      transform: g ? g.getAttribute("transform") : "",
    };
  }, host));
  const scaleOf = (t) => Number((/scale\(([\d.]+)\)/.exec(t || "") || [])[1] || 0);
  orgMetro.fitScale = scaleOf(orgMetro.transform);
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Zoom avant"]`).click();
  await page.waitForTimeout(150);
  orgMetro.zoomedScale = scaleOf(await page.locator(`${host} [data-metro-viewport]`).getAttribute("transform"));
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Ajuster à l'écran"]`).click();
  await page.waitForTimeout(150);
  orgMetro.refitScale = scaleOf(await page.locator(`${host} [data-metro-viewport]`).getAttribute("transform"));
  // Déplacement à la souris : la translation change, l'échelle non.
  const svgBox = await page.locator(`${host} .lp-orgmetro`).boundingBox();
  const before = await page.locator(`${host} [data-metro-viewport]`).getAttribute("transform");
  await page.mouse.move(svgBox.x + 30, svgBox.y + svgBox.height - 60);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + 130, svgBox.y + svgBox.height - 20, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  orgMetro.panned = before !== await page.locator(`${host} [data-metro-viewport]`).getAttribute("transform");
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Ajuster à l'écran"]`).click();
  await page.waitForTimeout(150);
  // Bascule des correspondances.
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Correspondances transverses"]`).click();
  await page.waitForTimeout(150);
  orgMetro.transverseHidden = await page.locator(`${host} .lp-orgmetro-transverse`).count();
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Correspondances transverses"]`).click();
  await page.waitForTimeout(150);
  // Survol : les relations restent pleines, le reste s'estompe.
  await page.locator(`${host} .lp-orgmetro-station[aria-label^="Sacha Morin"]`).first().hover();
  await page.waitForTimeout(200);
  orgMetro.hoverDimmed = await page.locator(`${host} .lp-orgmetro-svg.is-focusing .is-dim`).count();
  orgMetro.hoverOccurrence = await page.locator(`${host} .lp-orgmetro-occurrence`).count();
  await page.mouse.move(5, 5);
  await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro.png") });
  // Clic sur une station → fiche utilisateur existante.
  await page.locator(`${host} .lp-orgmetro-station[aria-label^="Emma Roux"]`).first().click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  orgMetro.memberModal = await page.locator(".lp-modal input").evaluateAll((els) => els.map((e) => e.value).join("|"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.locator(".lp-modal").count()) await page.locator(".lp-modal .lp-icon-btn, .lp-modal button", { hasText: /Annuler|Fermer/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  // Clic sur un bandeau d'équipe → fiche équipe existante.
  await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Plateforme"]`).click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  orgMetro.teamModal = await page.locator(".lp-modal input").evaluateAll((els) => els.map((e) => e.value).join("|"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.locator(".lp-modal").count()) await page.locator(".lp-modal button", { hasText: /Annuler|Fermer/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  // Bascule de mode dans l'en-tête : la vue hiérarchique reste intacte.
  await page.locator(`${host} .lp-orgchart-mode-btn`, { hasText: "Hiérarchique" }).click();
  await page.waitForTimeout(300);
  orgMetro.hierarchyPanels = await page.locator(`${host} .lp-orghier-node-panel`).count();
  // Troisième mode (#300) : la vue Orbital se rend depuis le même sélecteur.
  await page.locator(`${host} .lp-orgchart-mode-btn`, { hasText: "Orbital" }).click();
  await page.waitForTimeout(400);
  orgMetro.orbitalShell = await page.locator(`${host} .org-orbital-shell`).count();
  await page.locator(`${host} .lp-orgchart-mode-btn`, { hasText: "Métro" }).click();
  await page.waitForTimeout(300);
  orgMetro.backToMetro = await page.locator(`${host} .lp-orgmetro-svg`).count();
  // Widget étroit : la barre d'outils tient dans le cadre.
  orgMetro.narrow = await page.evaluate(() => {
    const host = document.querySelector("#harness-orgmetro-narrow .lp-orgmetro");
    const bar = document.querySelector("#harness-orgmetro-narrow .lp-orgmetro-toolbar");
    if (!host || !bar) return null;
    const h = host.getBoundingClientRect(), b = bar.getBoundingClientRect();
    const g = document.querySelector("#harness-orgmetro-narrow [data-metro-viewport]");
    const legend = document.querySelector("#harness-orgmetro-narrow .lp-orgmetro-legend");
    const exportLabel = document.querySelector("#harness-orgmetro-narrow .lp-orgmetro-toolbar button span");
    return {
      inside: b.left >= h.left - 1 && b.right <= h.right + 1, scroll: host.scrollWidth - host.clientWidth,
      scale: Number((/scale\(([\d.]+)\)/.exec(g ? g.getAttribute("transform") : "") || [])[1] || 0),
      legendHidden: !legend || getComputedStyle(legend).display === "none",
      exportLabelHidden: !exportLabel || getComputedStyle(exportLabel).display === "none",
    };
  });
} catch (e) {
  orgMetro.error = String(e).split("\n")[0];
}
await browser.close();
server.close();

// --- Contrôles -------------------------------------------------------------
// Le scénario pose deux blocs et deux encadrés par diagramme, dont « Jalons
// clés » sur des tâches NON successives : il doit donner deux cadres, donc
// trois cadres au total par diagramme.
const failures = [];
const expect = (ok, message) => { if (!ok) failures.push(message); };

// --- Parité des réglages du Gantt (#86) ------------------------------------
expect(!parite.error, `Réglages du Gantt : scénario de parité en échec (${parite.error})`);
if (parite.vue && parite.widget) {
  const COMMANDES = [
    "Grouper par", "Couleur des barres", "Informations affichées à côté de la barre",
    "Disposition de ces informations", "Ordre des lignes", "Étendue temporelle", "Mode d'affichage",
  ];
  COMMANDES.forEach((commande) => {
    const dansVue = parite.vue.labels.some((l) => l.startsWith(commande));
    const dansWidget = parite.widget.labels.some((l) => l.startsWith(commande));
    expect(dansWidget, `Fiche du widget Mini-Gantt : commande « ${commande} » absente`);
    expect(dansVue, `Réglages de la vue Gantt : commande « ${commande} » absente, alors que la fiche du widget l'offre`);
  });
  expect(
    parite.vue.regroupements.length > 0 && parite.vue.regroupements.join("|") === parite.widget.regroupements.join("|"),
    `Regroupements différents entre la vue et le widget :\n    vue    : ${parite.vue.regroupements.join(", ")}\n    widget : ${parite.widget.regroupements.join(", ")}`
  );
  // « Lot de travaux » était un champ personnalisé : ces champs ont été retirés,
  // et le menu ne doit plus proposer aucune clé « cf: ».
  ["Inactivité (jours)"].forEach((option) => {
    expect(parite.vue.regroupements.includes(option), `Réglages de la vue Gantt : regroupement « ${option} » absent du menu`);
  });
  expect(
    !parite.vue.regroupements.some((o) => /lot de travaux/i.test(o)),
    `Réglages de la vue Gantt : un champ personnalisé est revenu dans le menu (${parite.vue.regroupements.join(", ")})`
  );
  expect(
    /date de début/i.test(parite.vue.erreurDatesFixes),
    `Réglages de la vue Gantt : un cadrage « Dates fixes » sans date ne dit rien (« ${parite.vue.erreurDatesFixes} »)`
  );
  expect(
    parite.vue.erreurDatesFixes === parite.widget.erreurDatesFixes,
    `Message de dates fixes différent : vue « ${parite.vue.erreurDatesFixes} », widget « ${parite.widget.erreurDatesFixes} »`
  );
  // Les explications de la fiche doivent se retrouver dans la vue : c'est ce
  // qu'elle avait perdu en recopiant le formulaire au lieu de le partager.
  const AIDES = ["la fenêtre avance toute seule", "les jalons passent devant les barres", "En mode Comparaison"];
  AIDES.forEach((aide) => {
    expect(
      parite.vue.aides.some((p) => p.includes(aide)),
      `Réglages de la vue Gantt : explication manquante (« ${aide} »)`
    );
  });
}

expect(pageErrors.length === 0, `erreurs JavaScript au rendu :\n    ${pageErrors.slice(0, 5).join("\n    ")}`);
expect(seen.miniBlocks === 3, `Mini-Gantt : ${seen.miniBlocks} bande(s) de bloc, 3 attendues (2 phases + 1 fenêtre de décision)`);
expect(seen.miniPhases.length === 3, `Mini-Gantt : ${seen.miniPhases.length} titre(s) de bloc dans la bande d’en-tête, 3 attendus`);
expect(seen.miniDecisions.length === 1, `Mini-Gantt : ${seen.miniDecisions.length} fenêtre(s) de décision, 1 attendue`);

// --- Annotations horizontales (#93) ----------------------------------------
expect(seen.spans !== null, "Mini-Gantt : premier widget introuvable pour les annotations horizontales");
if (seen.spans) {
  expect(seen.spans.traits.length === 1,
    `Annotations horizontales : ${seen.spans.traits.length} trait(s) dessiné(s), 1 attendu — celui dont la tâche n'est pas affichée ne doit rien dessiner`);
  const trait = seen.spans.traits[0];
  if (trait) {
    expect(trait.bouts.length === 2, `Annotation horizontale : ${trait.bouts.length} bout(s) dessiné(s), 2 attendus`);
    expect(trait.bouts[0] !== trait.bouts[1],
      "Annotation horizontale : les deux bouts sont identiques alors qu'un trait et une flèche sont demandés — les extrémités doivent se régler séparément (#93)");
    expect(/Fenêtre de tirage/.test(trait.texte), `Annotation horizontale : texte « ${trait.texte} », « Fenêtre de tirage » attendu`);
    expect(trait.w > 20, `Annotation horizontale : largeur de ${trait.w} px — le trait doit couvrir ses deux dates`);
    const ligne = seen.spans.ligneVisee;
    expect(ligne && trait.milieu >= ligne.haut && trait.milieu <= ligne.bas,
      `Annotation horizontale : posée à y=${trait.milieu}, hors de la ligne de sa tâche (${ligne ? `${ligne.haut}→${ligne.bas}` : "introuvable"})`);
  }
  expect(Number(seen.spans.zTrait) > Number(seen.spans.zLigne || 0),
    `Annotations horizontales : le calque (z=${seen.spans.zTrait}) doit passer au-dessus des lignes (z=${seen.spans.zLigne}), sinon le trait disparaît sous la barre`);
}

// --- Trait vertical d'un jalon, propre à chaque jalon (#95) ----------------
expect(seen.rules.premier === 2,
  `Jalons : ${seen.rules.premier} trait(s) vertical(aux), 2 attendus — un par jalon COCHÉ, et deux des quatre le sont`);
expect(seen.rules.second === 0,
  `Jalons : ${seen.rules.second} trait(s) vertical(aux) dans le second Mini-Gantt, 0 attendu — il n'y porte aucun jalon`);
expect(seen.rules.z === "0",
  `Jalons : le calque des traits verticaux est en z-index ${seen.rules.z}, 0 attendu — il doit rester derrière les barres et les textes`);
{
  /* Le trait PROLONGE le losange : il part de la bande de repères, au couloir
     de son propre repère, et descend jusqu'au bas des lignes. Le compter ne
     suffisait pas — c'est précisément ce qui manquait au premier essai. */
  const lignes = seen.rules.lignes;
  expect(lignes, "Jalons : aucune ligne mesurée dans le premier Mini-Gantt");
  seen.rules.traits.forEach((trait, i) => {
    expect(trait.haut < lignes.haut,
      `Jalon ${i + 1} : le trait commence à y=${trait.haut}, sous le haut des lignes (${lignes.haut}) — il doit partir du losange, au-dessus`);
    expect(Math.abs(trait.bas - lignes.bas) <= 2,
      `Jalon ${i + 1} : le trait s'arrête à y=${trait.bas}, alors que les lignes finissent à ${lignes.bas} — il doit courir sur toute la hauteur`);
  });
  [["Décision CODIR", seen.rules.codir], ["Essais en eau", seen.rules.essais]].forEach(([nom, marque]) => {
    expect(marque, `Jalon « ${nom} » : repère introuvable dans la bande`);
    const trait = seen.rules.traits.find((t) => Math.abs(t.x - marque.x) <= 6);
    expect(trait, `Jalon « ${nom} » : aucun trait à l'aplomb du losange (x=${marque?.x})`);
    // Les deux repères ne sont pas sur le même couloir : chaque trait doit
    // démarrer dans le couloir de SON losange, pas au sommet de la bande.
    expect(trait && trait.haut >= marque.haut && trait.haut <= marque.bas,
      `Jalon « ${nom} » : le trait démarre à y=${trait?.haut}, hors de son losange (${marque?.haut}→${marque?.bas})`);
  });
  expect(seen.rules.codir && seen.rules.essais && seen.rules.codir.haut !== seen.rules.essais.haut,
    "Jalons : les deux repères cochés devraient occuper deux couloirs différents — le banc ne prouve plus rien sinon");
  /* Épaisseur propre à chaque jalon : « Décision CODIR » en porte une de 4 px,
     « Essais en eau » garde le défaut de 3 px. Les deux doivent donc différer,
     et aucune ne peut retomber sur le cheveu de 1,5 px d'avant. C'est
     l'épaisseur PEINTE qui est relevée : un navigateur ramène une bordure au
     pixel de l'écran, et c'est ce qui se voit qui est en cause. */
  const epaisseurs = seen.rules.traits.map((t) => t.epaisseur);
  expect(epaisseurs.includes("4px"),
    `Jalons : épaisseurs peintes ${epaisseurs.join(", ")} — celle réglée à 4 px n'y est pas`);
  expect(new Set(epaisseurs).size === 2,
    `Jalons : ${new Set(epaisseurs).size} épaisseur(s) distincte(s) (${epaisseurs.join(", ")}) — elle se règle jalon par jalon`);
  expect(epaisseurs.every((e) => parseFloat(e) >= 3),
    `Jalons : un trait à ${epaisseurs.join(", ")} — le défaut ne doit plus descendre sous 3 px`);
}

// --- La colonne d'étiquettes se cale sur son contenu (retour de test) ------
expect(seen.colonne && seen.colonne.courts && seen.colonne.longs,
  "Colonne d'étiquettes : widgets du scénario introuvables dans le banc");
if (seen.colonne && seen.colonne.courts && seen.colonne.longs) {
  const { courts, longs } = seen.colonne;
  expect(courts.blanc <= 10,
    `Colonne d'étiquettes : ${courts.blanc} px de blanc entre le titre le plus long et la piste — la gouttière fait 6 px, le reste est perdu`);
  expect(courts.largeur < courts.plafond - 20,
    `Colonne d'étiquettes : ${courts.largeur} px pour des titres courts, alors que le plafond des 26 % en vaut ${courts.plafond} — elle doit se caler sur son contenu`);
  // Elle ne doit JAMAIS grandir : sur des titres longs, le plafond tient, et le
  // diagramme ne perd pas un pixel de piste par rapport à avant.
  expect(Math.abs(longs.largeur - longs.plafond) <= 1,
    `Colonne d'étiquettes : ${longs.largeur} px sur des titres longs, ${longs.plafond} attendus — elle ne doit pas dépasser les 26 %`);
  // Les couches suivent la colonne, sinon la grille et les blocs temporels
  // flottent à côté de la piste.
  [["grille", courts.ecartGrille], ["bande des blocs", courts.ecartBande]].forEach(([nom, ecart]) => {
    if (ecart === null) return;
    expect(Math.abs(ecart) <= 1,
      `Colonne d'étiquettes : la ${nom} commence à ${ecart} px du bord de la piste — les couches doivent suivre la colonne mesurée`);
  });
}

// --- La dernière ligne tient entière dans le widget (retour de test) -------
expect(seen.piedDeLigne, "Dernière ligne : widget du scénario introuvable dans le banc");
if (seen.piedDeLigne) {
  const pied = seen.piedDeLigne;
  expect(pied.lignes >= 2, `Dernière ligne : ${pied.lignes} ligne(s) dans le scénario, au moins deux attendues`);
  // Sans débord, le contrôle ne prouverait rien : c'est le débord qui était coupé.
  expect(pied.debord >= 2,
    `Dernière ligne : elle ne peint que ${pied.debord} px sous sa boîte — le scénario doit porter un couloir de risque et son étiquette, sinon il ne prouve rien`);
  expect(pied.marge >= 0,
    `Dernière ligne : ${pied.coupable || "son habillage"} dépasse de ${-pied.marge} px le bord du widget (qui coupe en ${pied.coupe}) — la moitié basse de la ligne est perdue`);
}

// --- Le réglage est bien dans les paramètres du jalon, et il agit (#95) ----
expect(!reglageJalon.error, `Jalons : scénario du réglage en échec (${reglageJalon.error})`);
if (!reglageJalon.error) {
  expect(reglageJalon.presente,
    "Jalons : aucune case « trait vertical » dans les paramètres du jalon — c'est pourtant là qu'elle est demandée");
  expect(/ce jalon/i.test(reglageJalon.libelle),
    `Jalons : la case parle de « ${reglageJalon.libelle} » — elle doit viser CE jalon, pas tout le diagramme`);
  expect(reglageJalon.cocheAvant === false,
    "Jalons : « Mise en service » arrive déjà coché — le trait doit être absent par défaut");
  expect(reglageJalon.cocheApres === true,
    "Jalons : la case ne retient pas le clic");
  expect(reglageJalon.apres === reglageJalon.avant + 1,
    `Jalons : ${reglageJalon.avant} trait(s) avant, ${reglageJalon.apres} après — cocher la case doit en ajouter exactement un`);
  expect(reglageJalon.curseur,
    "Jalons : aucun curseur d'épaisseur sous la case cochée — c'est le réglage demandé");
  expect(reglageJalon.curseurLu === "5",
    `Jalons : le curseur affiche « ${reglageJalon.curseurLu} » après un réglage à 5`);
  expect((reglageJalon.epaisseurs || []).includes("5px"),
    `Jalons : épaisseurs peintes ${(reglageJalon.epaisseurs || []).join(", ")} — régler le curseur à 5 px doit se voir dans le diagramme`);
}

// --- Une forme par type de jalon (#94) -------------------------------------
expect(seen.markerShapes.length === 5,
  `Repères : ${seen.markerShapes.length} repère(s) dessiné(s), 5 attendus (4 jalons + 1 annotation)`);
expect(new Set(seen.markerShapes).size >= 4,
  `Repères : ${new Set(seen.markerShapes).size} symbole(s) distinct(s) pour ${seen.markerShapes.length} repère(s) — décision, mise en service, essais et annotation doivent se distinguer`);
expect(seen.markerPrints.length === seen.markerShapes.length,
  `Repères : ${seen.markerPrints.length} rendu(s) distinct(s) pour ${seen.markerShapes.length} repère(s) — deux repères de nature différente ne doivent jamais se dessiner pareil`);
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
// --- Échelle temporelle commune --------------------------------------------
expect(seen.largeursPistes.length >= 3, `Mini-Gantt : ${seen.largeursPistes.length} widget(s) mesuré(s) pour l'alignement des pistes, au moins 3 attendus`);
seen.largeursPistes.forEach((w) => {
  expect(w.n >= 3, `${w.sel} : seulement ${w.n} piste(s) mesurée(s) — le contrôle d'alignement ne garde plus grand-chose`);
  expect(w.max - w.min <= 1, `${w.sel} : les pistes n'ont pas la même largeur (${w.min} à ${w.max} px) — l'axe et les lignes ne portent plus la même échelle temporelle`);
});
seen.reperesAujourdhui.forEach((r) => {
  expect(r.ecart <= 2, `${r.sel} : le repère « Aujourd'hui » de l'axe est à ${r.ecart} px de son trait vertical`);
});

// Sans bande de repères, la largeur de la piste doit quand même être mesurée.
expect(seen.secondStrip === 0, `Second Mini-Gantt : il porte une bande de repères (${seen.secondStrip}) — le cas du titre désaligné ne serait plus reproduit`);
expect(seen.secondBlockAlign.length > 0, "Second Mini-Gantt : aucune étiquette de bloc appariée à sa bande");
seen.secondBlockAlign.forEach((b) => {
  expect(b.gap <= 3, `Second Mini-Gantt : l'étiquette « ${b.t} » est décalée de ${b.gap} px par rapport à sa bande — la piste n'est pas mesurée quand le widget n'a pas de bande de repères`);
});

expect(seen.miniBlockAlign.length > 0, "Mini-Gantt : aucune étiquette de bloc appariée à sa bande");
seen.miniBlockAlign.forEach((b) => {
  expect(b.gap <= 3, `Mini-Gantt : l'étiquette « ${b.t} » est décalée de ${b.gap} px par rapport à sa bande`);
});

// --- Mode Comparaison ------------------------------------------------------
// Le jeu d'essai pose une référence sur cinq tâches (retard, avance, conforme,
// décalage intégral, jalon en retard) et en laisse deux sans référence, dont un
// jalon : le widget doit accepter les deux dans le même diagramme.
expect(seen.standardStrips === 0, `Mode standard : ${seen.standardStrips} ruban(s) de comparaison dessiné(s), 0 attendu — des dates de référence sur les tâches ne doivent rien changer tant que le widget est en mode Standard`);
expect(seen.standardBarOutlined === 0, `Mode standard : ${seen.standardBarOutlined} barre(s) portent le contour de comparaison, 0 attendue`);
expect(seen.cmpStrips.length === 5, `Comparaison : ${seen.cmpStrips.length} ruban(s) de comparaison, 5 attendus (les jalons n'en ont pas)`);
expect(seen.cmpBarOutlined === 5, `Comparaison : ${seen.cmpBarOutlined} barre(s) cerclée(s) de noir, 5 attendues — la tâche réelle doit rester l'objet le plus net de la ligne`);
seen.cmpStrips.forEach((b, i) => {
  expect(b.w > 2 && b.h > 2, `Comparaison : ruban ${i + 1} de surface nulle (${b.w}×${b.h})`);
});
// « On ne sait pas si le curseur est au bout de la tâche » : le ruban ne doit
// jamais avoir la hauteur de la barre, sans quoi il se lirait comme sa suite.
expect(seen.cmpStripHeights.length && seen.cmpBarHeights.length && Math.max(...seen.cmpStripHeights) < Math.min(...seen.cmpBarHeights),
  `Comparaison : le ruban (${seen.cmpStripHeights.join("/")} px) n'est pas plus fin que les barres (${seen.cmpBarHeights.join("/")} px) — il se lirait comme leur prolongement`);
expect(seen.cmpStripUnderBar.length === 5, `Comparaison : ${seen.cmpStripUnderBar.length} ligne(s) portent barre et ruban, 5 attendues`);
expect(seen.cmpStripUnderBar.every((gap) => gap >= 0 && gap <= 1),
  `Comparaison : le ruban n'est pas collé sous la barre (écarts ${seen.cmpStripUnderBar.join("/")} px, 0 attendu) — chevauchement ou interligne`);
// Un seul bloc : aucune bordure, et aucun jour de blanc entre deux segments.
expect(seen.cmpSegBorders.every((b) => b === "0px/0px"), `Comparaison : un segment du ruban porte une bordure (${seen.cmpSegBorders.join(", ")}) — les jonctions doivent se faire par la seule trame`);
expect(seen.cmpSegGaps.every((g) => g <= 1), `Comparaison : les segments d'un ruban ne sont pas jointifs (écarts ${seen.cmpSegGaps.join("/")} px)`);

expect(seen.cmpRefFrames.length === 5, `Comparaison : ${seen.cmpRefFrames.length} période(s) de référence cerclée(s), 5 attendues — la durée initiale doit se lire sur chaque ligne comparée`);
expect(seen.cmpRefFrames.every((f) => f.w > 1 && f.h > 1), `Comparaison : un cercle de référence est de surface nulle (${JSON.stringify(seen.cmpRefFrames)})`);
expect(seen.cmpRefFrames.every((f) => f.fond === "rgba(0, 0, 0, 0)"), `Comparaison : le cercle de référence a un fond (${seen.cmpRefFrames.map((f) => f.fond).join(", ")}) — il masquerait la trame qu'il encadre`);
expect(seen.cmpRefFrames.every((f) => f.bord === "0px"), `Comparaison : le cercle de référence est posé en BORDURE (${seen.cmpRefFrames.map((f) => f.bord).join(", ")}) — son trait s'accolerait à celui du ruban au lieu de le couvrir`);
expect(seen.cmpRefFrames.every((f) => f.dTop === 0 && f.dH === 0),
  `Comparaison : le cercle de référence n'a pas la géométrie du ruban (décalages ${JSON.stringify(seen.cmpRefFrames.map((f) => [f.dTop, f.dH]))}) — les deux anneaux s'accoleraient au lieu de se superposer`);
expect(seen.cmpSegRef.length >= 1, `Comparaison : ${seen.cmpSegRef.length} segment(s) de période tenue, au moins 1 attendu`);
expect(seen.cmpSegLate.length >= 1, `Comparaison : ${seen.cmpSegLate.length} segment(s) de retard, au moins 1 attendu`);
expect(seen.cmpSegAhead.length >= 1, `Comparaison : ${seen.cmpSegAhead.length} segment(s) d'avance, au moins 1 attendu`);
// Terminer plus tôt que prévu EST une avance : le segment doit être vert à
// l'écran, pas gris. C'est ce que le premier essai ne montrait pas.
expect(seen.cmpAheadColors.every((c) => c.vert), `Comparaison : un segment d'avance n'est pas vert à l'écran (${JSON.stringify(seen.cmpAheadColors)})`);
expect(seen.cmpAheadColors.length >= 2, `Comparaison : ${seen.cmpAheadColors.length} segment(s) d'avance relevé(s), au moins 2 attendus (début anticipé et fin anticipée)`);
expect(seen.cmpGhosts.length === 1, `Comparaison : ${seen.cmpGhosts.length} losange(s) fantôme, 1 attendu (le jalon comparé ; celui sans référence n'en a pas)`);
expect(seen.cmpLinks.length === 1, `Comparaison : ${seen.cmpLinks.length} segment(s) de liaison de jalon, 1 attendu`);
expect(seen.cmpChips.length === 6, `Comparaison : ${seen.cmpChips.length} indicateur(s) d'écart, 6 attendus (5 tâches + 1 jalon)`);
expect(seen.cmpChips.every((c) => /^[+\u22120-9]/.test(c.text.trim())), `Comparaison : un indicateur d'écart ne porte ni signe ni valeur (${seen.cmpChips.map((c) => c.text.trim()).join(", ")})`);
/* Épaisseur des traits d'un bloc temporel : réglable, et RÉELLEMENT peinte.
   Elle était codée en dur à 1,5 px aux quatre endroits qui dessinent un bloc. */
expect(seen.bandBorders.length >= 2, `Blocs temporels : ${seen.bandBorders.length} bande(s) relevée(s), au moins 2 attendues`);
expect(seen.bandBorders.some((b) => b.g === "4px" && b.d === "4px" && b.peint === "4px"), `Blocs temporels : aucune bande peinte à 4 px alors que le jeu d'essai en règle une (${JSON.stringify(seen.bandBorders)})`);
expect(seen.bandBorders.some((b) => b.g === "1.5px"), `Blocs temporels : aucune bande au défaut de 1,5 px (${JSON.stringify(seen.bandBorders)})`);
expect(seen.bandBorders.some((b) => b.style === "dashed") && seen.bandBorders.some((b) => b.style === "solid"), `Blocs temporels : le choix plein / pointillés ne se voit pas (${JSON.stringify(seen.bandBorders)})`);
expect(seen.bandBorders.every((b) => b.g === b.d), `Blocs temporels : les deux montants d'une bande n'ont pas la même épaisseur (${JSON.stringify(seen.bandBorders)})`);
// Un CADRE, pas deux montants : la bande était bornée à gauche et à droite,
// sans haut ni bas — elle se lisait comme deux traits, pas comme une zone.
expect(seen.bandBorders.every((b) => b.h !== "0px" && b.b !== "0px"), `Blocs temporels : une bande n'a ni haut ni bas, ce n'est pas un cadre (${JSON.stringify(seen.bandBorders)})`);
/* « Je veux un vrai cadre, qui l'emporte sur tout le reste » : la couche des
   cadres passe au-dessus des lignes, celle du remplissage reste dessous. */
expect(seen.bandZ.cadres !== null && seen.bandZ.ligne !== null && seen.bandZ.cadres > seen.bandZ.ligne,
  `Blocs temporels : le cadre ne passe pas devant les lignes (cadres ${seen.bandZ.cadres}, ligne ${seen.bandZ.ligne})`);
expect(seen.bandZ.fond !== null && seen.bandZ.ligne !== null && seen.bandZ.fond < seen.bandZ.ligne,
  `Blocs temporels : le remplissage passe devant les lignes (fond ${seen.bandZ.fond}, ligne ${seen.bandZ.ligne}) — il masquerait les barres qu'il sert à situer`);
expect(seen.bandFillBorders.every((w) => w === "0px"), `Blocs temporels : le remplissage porte encore un trait (${seen.bandFillBorders.join(", ")}) — il ferait double emploi avec le cadre`);
expect(seen.legendRows === 0, `Légende : ${seen.legendRows} élément(s) de légende encore rendu(s), 0 attendu — la bande a été retirée des deux diagrammes`);
expect(seen.cmpModeButtons.length === 2 && seen.cmpModeButtons[1].active, `Comparaison : le sélecteur rapide n'affiche pas l'état actif (${JSON.stringify(seen.cmpModeButtons)})`);
// « Superposées sans rendre la ligne plus haute » : le widget de comparaison
// est le jumeau exact du second, au mode près. Les hauteurs de ligne doivent
// donc rester les mêmes, ligne par ligne.
expect(seen.cmpRows.length === seen.standardRows.length, `Comparaison : ${seen.cmpRows.length} ligne(s) contre ${seen.standardRows.length} en mode standard — le mode ne doit ni masquer ni ajouter de tâche`);
seen.cmpRows.forEach((row, i) => {
  const ref = seen.standardRows[i];
  if (!ref) return;
  expect(Math.abs(row.h - ref.h) <= 2, `Comparaison : la ligne ${i + 1} mesure ${row.h} px contre ${ref.h} px en mode standard — la superposition ne doit pas faire grandir la ligne`);
});

// Avancement à 100 % : le rond blanc laisse place à une pastille de validation.
// Le jeu d'essai n'a qu'une tâche terminée — les autres gardent leur rond.
expect(seen.doneHandles.length === 1, `Mini-Gantt : ${seen.doneHandles.length} pastille(s) de validation, 1 attendue (une seule tâche à 100 %)`);
expect(seen.doneHandles.every((h) => h.coches === 1), `Mini-Gantt : une pastille de validation ne porte pas sa coche (${JSON.stringify(seen.doneHandles)})`);
expect(seen.doneHandles.every((h) => h.vert), `Mini-Gantt : une pastille de validation n'est pas verte (${JSON.stringify(seen.doneHandles)})`);
expect(seen.plainHandles.length > 0, "Mini-Gantt : plus aucune poignée d'avancement ordinaire");
expect(seen.plainHandles.every((h) => h.coches === 0), "Mini-Gantt : une tâche non terminée porte une coche de validation");
expect(seen.doneHandles.every((h) => seen.plainHandles.every((p) => h.w > p.w)), `Mini-Gantt : la pastille de validation n'est pas plus grande que le rond ordinaire (${JSON.stringify(seen.doneHandles)} contre ${JSON.stringify(seen.plainHandles)})`);

// --- Ordre des lignes ------------------------------------------------------
// Le jeu d'essai place un jalon (« Ordre de service », 15/07) ENTRE deux barres.
// Tant que les jalons étaient rendus après toutes les barres, il finissait en
// bas du widget quel que soit le tri.
expect(seen.ordreTitres[0] === "Documents FOR-0129" && seen.ordreTitres[1] === "Ordre de service",
  `Mini-Gantt : l'ordre par date de début ne mêle pas barres et jalons (${seen.ordreTitres.slice(0, 4).join(" | ")})`);
expect(seen.ordreTitres[seen.ordreTitres.length - 1] === "Deadline MAJ Octopus complète",
  `Mini-Gantt : la dernière ligne n'est pas la plus tardive (${seen.ordreTitres.slice(-2).join(" | ")})`);
// Tri par titre sur un autre widget : le réglage est bien propre à chacun.
expect(seen.ordreParTitre.length > 1 && seen.ordreParTitre.join("|") === [...seen.ordreParTitre].sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true })).join("|"),
  `Mini-Gantt : le tri par titre n'est pas alphabétique (${seen.ordreParTitre.join(" | ")})`);
expect(seen.ordreParTitre.join("|") !== seen.ordreTitres.join("|"),
  "Mini-Gantt : deux widgets aux tris différents rendent le même ordre — le réglage n'est pas propre au widget");

// --- Barre d'outils --------------------------------------------------------
// Toutes les commandes d'affichage sur une seule bande, au-dessus de l'axe.
expect(seen.toolbarCount >= 4, `Barre d'outils : ${seen.toolbarCount} commande(s), au moins 4 attendues (mode, tri, étendue, zoom)`);
expect(Math.max(...seen.toolbarTops) - Math.min(...seen.toolbarTops) <= 2,
  `Barre d'outils : les commandes sont empilées au lieu d'être côte à côte (sommets à ${seen.toolbarTops.join("/")} px)`);
expect(seen.toolbarAboveAxis !== null && seen.toolbarAboveAxis >= 0, `Barre d'outils : elle n'est pas au-dessus de l'axe (${seen.toolbarAboveAxis} px)`);

// --- Sous-grille verticale -------------------------------------------------
// Neuf ans à dates fixes : l'axe n'offrait que ses graduations annuelles, sans
// rien entre elles. Les trimestres lui rendent son contexte temporel.
expect(seen.anneesTicks > 0, "Échelle annuelle : aucune graduation sur l'axe");
expect(seen.anneesSubTicks >= 20, `Échelle annuelle : ${seen.anneesSubTicks} sous-graduation(s) sur l'axe, au moins 20 attendues (les trimestres)`);
expect(seen.anneesSubTicks <= 60, `Échelle annuelle : ${seen.anneesSubTicks} sous-graduation(s) de deuxième niveau — ce sont les trimestres, pas les mois`);
expect(seen.anneesSubTicks > seen.anneesTicks, `Échelle annuelle : la sous-grille (${seen.anneesSubTicks}) n'est pas plus fine que les graduations (${seen.anneesTicks})`);
expect(seen.anneesGrille >= 20, `Échelle annuelle : ${seen.anneesGrille} trait(s) de sous-grille dans le diagramme, au moins 20 attendus`);
/* Un TROISIÈME niveau, un cran plus fin : sur neuf ans, les trimestres portent
   les années, les mois portent les trimestres. Il doit être strictement plus
   dense que le deuxième, sinon il ne raconte rien de plus. */
expect(seen.anneesSubTicks3 > seen.anneesSubTicks,
  `Échelle annuelle : le troisième niveau (${seen.anneesSubTicks3}) n'est pas plus fin que la sous-grille (${seen.anneesSubTicks}) — il devrait porter les mois`);
expect(seen.anneesGrille3 > seen.anneesGrille,
  `Échelle annuelle : la troisième grille du diagramme (${seen.anneesGrille3}) n'est pas plus fine que la deuxième (${seen.anneesGrille})`);

// --- Cadrage « Fenêtre glissante » -----------------------------------------
// Un mois avant, un mois après : le jeu d'essai s'étend de juillet à septembre,
// donc des tâches sortent forcément de la fenêtre.
expect(seen.rollingRows > 0, "Cadrage glissant : plus aucune ligne dessinée");
expect(seen.rollingRows < seen.standardRowCount,
  `Cadrage glissant : ${seen.rollingRows} ligne(s) contre ${seen.standardRowCount} en automatique — les tâches hors fenêtre devraient sortir`);

expect(seen.miniRiskLabels.length >= 2, `Mini-Gantt : ${seen.miniRiskLabels.length} étiquette(s) de risque, au moins 2 attendues`);
// Deux jalons de configuration et une annotation partagent la bande de repères.
expect(seen.miniMarkers.length === 5, `Mini-Gantt : ${seen.miniMarkers.length} repère(s) jalon/annotation, 5 attendus`);
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

for (const [name, frames] of [["Mini-Gantt", seen.miniFrames]]) {
  frames.forEach((f, i) => expect(f.w > 4 && f.h > 4, `${name} : cadre ${i + 1} de surface nulle (${f.w}×${f.h})`));
}

// Étiquettes lisibles : aucune ne doit en recouvrir une autre.
for (const [name, labels] of [["Mini-Gantt", seen.miniFrameLabels], ["Mini-Gantt (titres de bloc)", seen.miniPhases], ["Second Mini-Gantt (méta blocs)", seen.secondMetaChips], ["Mini-Gantt (repères)", seen.miniMarkers], ["Mini-Gantt (étiquettes de risque)", seen.miniRiskLabels], ["Comparaison (écarts)", seen.cmpLabels]]) {
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
  // Depuis #53, la couleur d'un point est celle de son GROUPE, en retard comme
  // à venir : c'est l'agrégation qu'on doit lire d'un coup d'œil. Le retard se
  // signale au CONTOUR. Vérifier ici que le remplissage suit bien le couloir —
  // et non plus qu'il s'en écarte, ce qui était la règle d'avant.
  const laneColors = new Set(seen.scatterLaneColors);
  expect(laneColors.size > 0, "Nuage : les pastilles de couleur des couloirs ont disparu");
  seen.scatterDotFills.forEach((d) => {
    expect(laneColors.has(d.fill),
      `Nuage : un point est rempli en ${d.fill}, qui n'est la couleur d'aucun couloir — l'agrégation ne se lit plus`);
  });
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
// --- Couloirs teintés et sous-grille (issue #53) ---------------------------
// Chaque couloir porte la couleur de son entité : c'est ce qui permet de
// retrouver sa ligne sans relire les libellés.
expect(seen.scatterBands.length === seen.scatterLaneLabels.length,
  `Nuage : ${seen.scatterBands.length} bande(s) de couloir pour ${seen.scatterLaneLabels.length} couloir(s) — chacun doit avoir la sienne`);
{
  const couleurs = new Set(seen.scatterLaneColors);
  seen.scatterBands.forEach((b) => {
    expect(couleurs.has(b.fill), `Nuage : une bande de couloir (${b.fill}) ne reprend pas la couleur de son entité`);
    expect(b.opacity > 0 && b.opacity <= 0.2,
      `Nuage : teinte de couloir à ${b.opacity} — nulle elle ne distingue rien, forte elle passe devant les points`);
  });
  expect(new Set(seen.scatterBands.map((b) => b.fill)).size > 1,
    "Nuage : tous les couloirs ont la même teinte — le contrôle ne prouverait rien");
}
// Une sous-grille non étiquetée, plus dense que les graduations : sans elle,
// entre deux repères un point se lit « quelque part au milieu ».
expect(seen.scatterMinorAxes > seen.scatterMajorAxes,
  `Nuage : ${seen.scatterMinorAxes} trait(s) de sous-grille pour ${seen.scatterMajorAxes} graduation(s) — la sous-grille doit être plus fine`);

// --- Moteur d'étiquettes sur un couloir dense (issue #53) ------------------
// 36 tâches à titres longs. La règle : poser le plus d'étiquettes possible,
// tant qu'aucune n'en recouvre une autre ni ne masque un point.
{
  const chevauche = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  expect(seen.denseLabels.length >= 12,
    `Nuage dense : ${seen.denseLabels.length} étiquette(s) sur 36 tâches — le moteur doit en poser bien davantage`);
  for (let i = 0; i < seen.denseLabels.length; i++) {
    for (let j = i + 1; j < seen.denseLabels.length; j++) {
      const a = seen.denseLabels[i], b = seen.denseLabels[j];
      expect(!chevauche(a, b), `Nuage dense : « ${a.text} » et « ${b.text} » se recouvrent`);
    }
  }
  // Et aucune n'avale un point : une étiquette posée sur une pastille cache la
  // tâche qu'elle est censée désigner.
  seen.denseLabels.forEach((l) => {
    seen.denseDots.forEach((d) => {
      expect(!chevauche(l, d), `Nuage dense : l'étiquette « ${l.text} » recouvre un point`);
    });
  });
  // Rien ne sort du dessin.
  seen.denseLabels.forEach((l) => {
    expect(l.x0 >= seen.denseBox.x0 - 1 && l.x1 <= seen.denseBox.x1 + 1,
      `Nuage dense : l'étiquette « ${l.text} » sort du cadre`);
  });
  // Les amas serrés doivent produire des rappels en coude, sinon le moteur
  // retombe sur « à droite ou rien ».
  expect(seen.denseLeaders > 0, "Nuage dense : aucune étiquette déportée — les amas resteraient muets");
}
// La couleur d'un point suit son GROUPE des deux côtés de l'origine. Avant
// l'issue #53, tout ce qui était en retard virait au rouge et l'agrégation
// disparaissait de la moitié gauche du nuage.
{
  const enRetard = seen.denseDots.filter((d) => seen.denseTodayX !== null && d.x < seen.denseTodayX - 1);
  const aVenir = seen.denseDots.filter((d) => seen.denseTodayX !== null && d.x > seen.denseTodayX + 1);
  expect(enRetard.length > 0 && aVenir.length > 0, "Nuage dense : le jeu doit contenir des tâches des deux côtés");
  expect(new Set(enRetard.map((d) => d.fill)).size > 1,
    "Nuage dense : toutes les tâches en retard ont la même couleur — la couleur du groupe est écrasée");
  // Le retard reste signalé, mais par le contour, pas en confisquant la teinte.
  expect(enRetard.every((d) => d.stroke && d.stroke !== aVenir[0].stroke),
    "Nuage dense : rien ne distingue plus une tâche en retard d'une tâche à venir");
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
  // Retour de Quentin sur #51 : deux volets, comme la vue Heat map calendaire.
  expect(/Clique sur une case/.test(heatmap.listInvite),
    `Heat map : le volet de droite n'est pas apparent avant le clic (« ${heatmap.listInvite} »)`);
  expect(/×/.test(heatmap.listHead),
    `Heat map : le volet de droite ne nomme pas le croisement retenu (« ${heatmap.listHead} »)`);
  expect(heatmap.listItems > 0,
    `Heat map : ${heatmap.listItems} tâche(s) listée(s) dans le volet de droite après le clic sur une case pleine`);
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

expect(!treemap.error, `contrôle du Treemap interrompu : ${treemap.error}`);
expect(treemap.opened === "p1" || treemap.opened === "p2" || treemap.opened === "p3" || treemap.opened === "p4", `Treemap : le clic n'ouvre pas un projet (« ${treemap.opened} »)`);
expect(treemap.colorModes === 3, `Treemap : ${treemap.colorModes} mode(s) de coloration dans la fiche, 3 attendus`);
expect(treemap.fieldRows >= 5, `Treemap : ${treemap.fieldRows} champ(s) de tuile réordonnables, au moins 5 attendus`);
expect(treemap.sizeFilterFields > 0, "Treemap : le filtre de taille n'expose pas le moteur de filtres avancés");

expect(!drag.error, `contrôle du glisser d'avancement interrompu : ${drag.error}`);
expect(drag.after !== drag.before, "Mini-Gantt : la poignée d'avancement n'a pas bougé pendant le glisser");
expect(drag.gap !== null && drag.gap <= 6, `Mini-Gantt : la poignée d'avancement s'arrête à ${drag.gap} px du pointeur — elle doit le suivre`);

expect(!rail.error, `contrôle du rail des vues interrompu : ${rail.error}`);
expect(rail.nb === 4, `Rail : ${rail.nb} bulles rendues, 4 attendues`);
expect(rail.rondes, "Rail : les entrées ne sont pas des bulles rondes — les grandes cartes rectangulaires sont toujours là");
expect((rail.hauteurs || []).length === 1, `Rail : ${(rail.hauteurs || []).length} hauteurs différentes (${(rail.hauteurs || []).join(", ")} px) — aucune bulle ne doit rompre la hauteur`);
expect(rail.hauteurMax <= 44, `Rail : la plus haute bulle fait ${rail.hauteurMax} px — c'est encore une carte, pas une bulle`);
expect((rail.ecarts || []).length === 1, `Rail : l'espacement vertical varie (${(rail.ecarts || []).join(", ")} px) — il doit être régulier`);
expect((rail.centres || []).length === 1, `Rail : ${(rail.centres || []).length} axes verticaux différents — bulles et roundels doivent partager la ligne centrale`);
expect(rail.ligneVisible, "Rail : la ligne verticale centrale a disparu");
expect(rail.libelleInvisible, "Rail : le libellé occupe encore de la place — c'est lui qui faisait les grandes cartes");
expect(rail.libelleDansLeDom.length > 0, "Rail : le libellé a quitté le DOM — le bouton n'aurait plus de nom accessible");
expect(rail.nbBadges === 3, `Rail : ${rail.nbBadges} badge(s), 3 attendus — celle sans compteur ne doit pas en porter`);
// Un, deux et trois chiffres doivent tous tenir sans être rognés.
expect(rail.badgesTronques === 0,
  `Rail : ${rail.badgesTronques} badge(s) tronqué(s) — un compteur à trois chiffres doit rester lisible (largeurs : ${(rail.badgesLargeurs || []).join(", ")} px)`);
expect(rail.badgeAncre, "Rail : un badge n'est pas posé sur le bord inférieur droit de sa bulle");

expect(!mois.error, `contrôle de la heat map mensuelle interrompu : ${mois.error}`);
expect(mois.large && mois.large.blocs === 3, `Heat map mensuelle : ${mois.large && mois.large.blocs} mois rendus, 3 attendus`);
expect(mois.large && mois.large.lignes === 1, `Heat map mensuelle large : les mois occupent ${mois.large && mois.large.lignes} ligne(s), 1 attendue`);
expect(mois.etroit && mois.etroit.lignes === 3, `Heat map mensuelle étroite : les mois occupent ${mois.etroit && mois.etroit.lignes} ligne(s), 3 attendues — ils doivent passer les uns sous les autres`);
for (const [nom, m] of [["large", mois.large], ["étroite", mois.etroit]]) {
  expect(m && m.debordent === 0, `Heat map mensuelle ${nom} : ${m && m.debordent} mois débordent du cadre`);
  expect(m && m.defileH <= 0, `Heat map mensuelle ${nom} : ${m && m.defileH} px de défilement horizontal — il ne doit plus y en avoir`);
  expect(m && m.blocs === 3 && m.titres.every((t) => t.length > 0), `Heat map mensuelle ${nom} : un mois a perdu son titre (${m && m.titres.join(" | ")})`);
}
expect(mois.large && mois.large.videEnBas <= 8,
  `Heat map mensuelle large : ${mois.large && mois.large.videEnBas} px de vide sous le calendrier — il doit occuper la hauteur offerte`);
// L'ordre chronologique doit survivre au passage à la ligne.
expect(mois.large && mois.etroit && mois.large.titres.join("|") === mois.etroit.titres.join("|"),
  `Heat map mensuelle : l'ordre des mois change avec la largeur (${mois.large && mois.large.titres.join("|")} contre ${mois.etroit && mois.etroit.titres.join("|")})`);
expect(mois.passe && mois.passe.nbPassees >= 1, "Heat map mensuelle : aucune case passée n'est lavée — le passé ne se distingue pas du futur");
expect(mois.passe && mois.passe.nbPassees < mois.passe.nbColorees,
  `Heat map mensuelle : ${mois.passe && mois.passe.nbPassees} case(s) lavée(s) sur ${mois.passe && mois.passe.nbColorees} colorée(s) — les échéances à venir ne doivent pas l'être`);
expect(mois.passe && Number(mois.passe.voile) > 0 && Number(mois.passe.voile) < 1,
  `Heat map mensuelle : le voile du passé est à l'opacité « ${mois.passe && mois.passe.voile} » — la couleur de projet doit rester reconnaissable`);
expect(mois.passe && mois.passe.numeroBlanc === false,
  "Heat map mensuelle : le numéro d'un jour passé reste blanc sur une case lavée — il devient illisible");

expect(!icones.error, `contrôle des icônes par URL interrompu : ${icones.error}`);
expect(icones.cas.length === 4, `Icônes : ${icones.cas.length} cas rendus, 4 attendus`);
for (const cas of icones.cas) {
  // Aucune URL ne doit jamais s'écrire en toutes lettres, quel que soit le cas.
  expect(cas.texte === "", `Icône « ${cas.nom} » : l'URL est rendue en toutes lettres (« ${cas.texte.slice(0, 40)}… »)`);
}
for (const nom of ["minuscule", "majuscule", "espaces"]) {
  const cas = icones.cas.find((c) => c.nom === nom);
  expect(cas && cas.img, `Icône « ${nom} » : aucune image rendue — la reconnaissance dépend encore de la forme de l'URL`);
}
{
  const casse = icones.cas.find((c) => c.nom === "casse");
  expect(casse && casse.repli, "Icône « casse » : un chargement raté ne tombe pas sur un repli — le menu garderait une image cassée");
  const bonne = icones.cas.find((c) => c.nom === "minuscule");
  expect(casse && bonne && casse.largeur === bonne.largeur && casse.hauteur === bonne.hauteur,
    `Icône « casse » : le repli fait ${casse && casse.largeur}×${casse && casse.hauteur} px contre ${bonne && bonne.largeur}×${bonne && bonne.hauteur} px pour une icône chargée — le menu bougerait`);
}

expect(!colonne.error, `contrôle de la colonne de champs interrompu : ${colonne.error}`);
/* Le plancher de 232 px donnait EXACTEMENT la même largeur aux trois cas. Que
   les trois diffèrent est ce qui prouve que la mesure décide, et non un
   nombre écrit en dur. */
expect(colonne.zero === 0, `Mini-Gantt : sans aucun champ, ${colonne.zero} colonne(s) de droite sont encore rendues — il n'en faut aucune`);
expect(colonne.pisteZero !== null && colonne.pisteZero <= 10,
  `Mini-Gantt : sans aucun champ, la piste s'arrête encore à ${colonne.pisteZero} px du bord — elle doit aller jusqu'au bout`);
expect(colonne.un !== null && colonne.un > 0 && colonne.un < 140,
  `Mini-Gantt : avec un seul champ, la colonne fait ${colonne.un} px — elle doit se régler sur son contenu, pas sur un plancher`);
expect(colonne.cinq !== null && colonne.cinq > colonne.un,
  `Mini-Gantt : cinq champs (${colonne.cinq} px) ne prennent pas plus de place qu'un seul (${colonne.un} px) — la mesure ne suit plus le contenu`);
/* Et la place gagnée doit revenir à la PISTE : une colonne étroite qui laisse
   quand même la piste s'arrêter au même endroit n'aurait rien réglé. */
expect(colonne.pisteUn !== null && colonne.pisteCinq !== null && colonne.pisteUn < colonne.pisteCinq,
  `Mini-Gantt : la piste s'arrête à ${colonne.pisteUn} px du bord avec un champ contre ${colonne.pisteCinq} px avec cinq — la place gagnée ne lui revient pas`);

expect(!coche.error, `contrôle de la coche du Mini-Gantt interrompu : ${coche.error}`);
expect(coche.frames === 1, `Coche du Mini-Gantt : ${coche.frames} encadré(s) après la coche, 1 attendu`);
// « Ne garder que l'image à droite, en transparence, pas celle de gauche » (#48).
expect(coche.icons === 0, `Coche du Mini-Gantt : ${coche.icons} image(s) à gauche du cadre, 0 attendue`);
expect(coche.corners === 1, `Coche du Mini-Gantt : ${coche.corners} pastille(s) de coin, 1 attendue en haut à droite`);
expect(coche.cornerOpacity === "1",
  `Coche du Mini-Gantt : la pastille est peinte à l'opacité « ${coche.cornerOpacity} » — Quentin l'a demandée pleine`);
expect(coche.leftGap !== null && coche.leftGap >= 6, `Coche du Mini-Gantt : le trait gauche du cadre passe à ${coche.leftGap} px de la barre — il la recoupe`);
expect(coche.rightGap !== null && coche.rightGap >= 6, `Coche du Mini-Gantt : le trait droit du cadre passe à ${coche.rightGap} px de la barre — il la recoupe`);
expect(coche.cornerOffsetX !== null && Math.abs(coche.cornerOffsetX) <= 2 && Math.abs(coche.cornerOffsetY) <= 2,
  `Coche du Mini-Gantt : la pastille est décalée de (${coche.cornerOffsetX}, ${coche.cornerOffsetY}) px du coin supérieur droit du cadre — elle doit y rester centrée`);
expect(coche.apres === 0, `Coche du Mini-Gantt : ${coche.apres} encadré(s) restant(s) après avoir décoché, 0 attendu`);
expect(coche.boutons.length > 0, "Mini-Gantt : aucun bouton relevé dans la barre de contrôles — le contrôle des modes retirés passerait à vide");
expect(!coche.boutons.some((t) => /focus|présenter|quitter|zoom \(/i.test(t)),
  `Mini-Gantt : la barre de contrôles porte encore « ${coche.boutons.join(" / ")} » — Focus, Présenter et le cadrage sur la sélection ont été retirés (#48)`);
expect(coche.cochee === true && coche.apresCochee === false,
  `Coche du Mini-Gantt : la case se lit « ${coche.cochee} » une fois l'encadré posé et « ${coche.apresCochee} » une fois retiré — elle doit suivre l'encadré`);
expect(coche.lignes === 1, `Coche du Mini-Gantt : ${coche.lignes} ligne(s) marquée(s) is-selected, 1 attendue`);
expect(Number(coche.titreGras) >= 700,
  `Coche du Mini-Gantt : le titre de la tâche cochée est peint en graisse ${coche.titreGras || "inconnue"} — Quentin l'a demandé en gras`);
expect(/rgb\(214, 69, 69\)/.test(coche.ombreBarre) && /2\.5px/.test(coche.ombreBarre),
  `Coche du Mini-Gantt : la barre de la tâche cochée porte l'ombre « ${coche.ombreBarre || "aucune"} » — il faut un liseré rouge épais`);

expect(!transfert.error, `contrôle du changement de tableau de bord interrompu : ${transfert.error}`);
expect(transfert.bouton === 1, `Fiche du widget : ${transfert.bouton} bouton « Changer de tableau de bord », 1 attendu`);
expect(transfert.options === 7, `Fiche du widget : ${transfert.options} destination(s) proposée(s), 7 attendues`);
expect(transfert.defaut === "Aujourd'hui", `Fiche du widget : la destination proposée d'emblée est « ${transfert.defaut} » — ce doit être la première qui n'est pas celle où le widget se trouve déjà`);
// Recherche rapide dans la liste (retour de Quentin sur #58).
expect(transfert.recherche === 1, "Fiche du widget : la liste des destinations n'a pas de recherche rapide");
expect(transfert.filtrees === 1, `Fiche du widget : « suivi » laisse ${transfert.filtrees} destination(s), 1 attendue — la recherche doit porter sur le nom de la page`);
expect(/Suivi/.test(transfert.filtreLabel || ""), `Fiche du widget : « suivi » ne ramène pas la bonne page (« ${transfert.filtreLabel} »)`);
expect(transfert.videMessage === 1, "Fiche du widget : une recherche sans résultat n'affiche rien — l'utilisateur ne sait pas si la liste est vide ou cassée");
expect(transfert.ici === 1, `Fiche du widget : ${transfert.ici} destination marquée « ici » — l'emplacement actuel doit se reconnaître dans la liste`);
// mode | tableau | page | titre | un réglage du widget : le transfert doit
// emporter la configuration de la fiche, pas seulement l'identité du widget.
expect(/^duplicate\|d1\|p2\|/.test(transfert.done), `Fiche du widget : le transfert transmis est « ${transfert.done} », attendu « duplicate|d1|p2|… »`);
expect(/\|true$/.test(transfert.done), `Fiche du widget : les réglages du widget ne partent pas avec lui (« ${transfert.done} »)`);

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

// Mode comparaison dans la fiche de tâche.
expect(taskComparison.checkbox === 1, "Fiche de tâche : l'interrupteur « Activer le mode comparaison » est absent");
expect(taskComparison.checkedAtOpen === false, "Fiche de tâche : une tâche sans comparaison ouvre l'interrupteur déjà coché");
expect(taskComparison.fieldsAtOpen === 0, `Fiche de tâche : ${taskComparison.fieldsAtOpen} champ(s) de référence visible(s) alors que la comparaison est désactivée, 0 attendu`);
expect(taskComparison.fieldsAfterCheck === 2, `Fiche de tâche : ${taskComparison.fieldsAfterCheck} champ(s) de référence après activation, 2 attendus (début et fin)`);
expect(taskComparison.errors.length === 2, `Fiche de tâche : ${taskComparison.errors.length} erreur(s) pour une comparaison activée sans dates, 2 attendues (${taskComparison.errors.join(" | ")})`);
// La copie remplit les deux champs depuis les dates ACTUELLES de la tâche
// (Congés d'août : 05/08/2026 → 19/08/2026), et lève les erreurs.
expect(taskComparison.start === "2026-08-05" && taskComparison.end === "2026-08-19",
  `Fiche de tâche : la copie des dates actuelles donne ${taskComparison.start} → ${taskComparison.end}, 2026-08-05 → 2026-08-19 attendu`);
expect(taskComparison.errorsAfterCopy === 0, `Fiche de tâche : ${taskComparison.errorsAfterCopy} erreur(s) subsistent après la copie des dates`);
// Désactiver masque les champs SANS effacer l'historique saisi.
expect(taskComparison.fieldsAfterUncheck === 0, `Fiche de tâche : ${taskComparison.fieldsAfterUncheck} champ(s) encore visible(s) après désactivation, 0 attendu`);
expect(taskComparison.startAfterRecheck === "2026-08-05", `Fiche de tâche : la date de référence est perdue par une désactivation temporaire (${taskComparison.startAfterRecheck})`);

// Création d'une tâche : la référence naît calée sur les dates demandées.
expect(!creation.error, `contrôle de la fiche de création interrompu : ${creation.error}`);
expect(creation.checked === true, "Fiche de création : la comparaison n'est pas activée d'emblée");
expect(creation.start === creation.dates?.start && creation.end === creation.dates?.end,
  `Fiche de création : la référence (${creation.start} → ${creation.end}) ne reprend pas les dates demandées (${creation.dates?.start} → ${creation.dates?.end})`);
expect(creation.startApresDate === "2026-10-05", `Fiche de création : la référence ne suit pas un changement de date (${creation.startApresDate})`);
expect(creation.startApresSaisie === "2026-01-15", `Fiche de création : une référence saisie à la main est écrasée par un changement de date (${creation.startApresSaisie})`);
expect(creation.enregistre && creation.enregistre.enabled === true && creation.enregistre.referenceStart === "2026-01-15",
  `Fiche de création : la référence enregistrée n'est pas celle affichée (${JSON.stringify(creation.enregistre)})`);

// Tableaux Markdown (issue #71).
expect(taskMeta.mdTables === 1, `Fiche de tâche : ${taskMeta.mdTables} tableau(x) rendu(s) dans l'aperçu, 1 attendu`);
expect((taskMeta.mdHeaders || []).join("|") === "N° de réserve|Statut / observations",
  `Fiche de tâche : en-têtes du tableau « ${(taskMeta.mdHeaders || []).join("|")} »`);
expect(taskMeta.mdCells === 4, `Fiche de tâche : ${taskMeta.mdCells} cellule(s) de données, 4 attendues`);
expect(taskMeta.mdAlign === "right", `Fiche de tâche : la colonne alignée à droite (---:) est rendue « ${taskMeta.mdAlign} »`);
expect(taskMeta.mdPipeParagraphs === 0, `Fiche de tâche : ${taskMeta.mdPipeParagraphs} paragraphe(s) contiennent encore des barres verticales — le tableau est rendu comme du texte`);
expect(taskMeta.mdScrollsItself, "Fiche de tâche : le tableau ne défile pas tout seul — un tableau large élargirait la modale");
expect(taskMeta.mdModalOverflow <= 0, `Fiche de tâche : la modale déborde de ${taskMeta.mdModalOverflow} px à cause du tableau`);
/* Le va-et-vient ne doit RIEN changer au texte source : c'est la moitié de
   l'issue, et elle ne se voit que sur un aller-retour réel. */
expect(taskMeta.mdRoundTrip === taskMeta.mdSource,
  `Fiche de tâche : le Markdown source a changé après Édition → Aperçu → Édition.\n    avant : ${JSON.stringify(taskMeta.mdSource)}\n    après : ${JSON.stringify(taskMeta.mdRoundTrip)}`);

// Criticité (issue #69).
expect(taskMeta.critFields === 4, `Fiche de tâche : ${taskMeta.critFields} champ(s) sur la rangée Projet/Statut/Type/Criticité, 4 attendus`);
expect(taskMeta.critSameRow, "Fiche de tâche : les quatre champs ne sont pas sur la même ligne — la criticité est retombée en dessous");
expect(/^Criticité/.test(taskMeta.critLabel || ""), `Fiche de tâche : le quatrième champ de la rangée est « ${taskMeta.critLabel} », attendu « Criticité »`);
expect((taskMeta.critHeights || []).length === 1, `Fiche de tâche : les champs de la rangée ont ${(taskMeta.critHeights || []).length} hauteurs différentes (${(taskMeta.critHeights || []).join(", ")} px) — ils doivent s'aligner`);
expect(taskMeta.critDotOnValue === 0, "Fiche de tâche : une pastille s'affiche alors qu'aucune criticité n'est choisie — « Non définie » ne doit pas se lire comme un niveau");
expect((taskMeta.critOptions || []).join("|") === "Non définie|Bas|Moyen|Urgent",
  `Fiche de tâche : options de criticité « ${(taskMeta.critOptions || []).join("|")} » — les libellés métier ne doivent pas changer, ni l'ordre du plus bas au plus haut`);
// Feu tricolore : vert, orange, rouge. « Non définie » n'a aucune pastille.
expect((taskMeta.critDots || [])[0] === "", "Fiche de tâche : « Non définie » porte une pastille — elle se confondrait avec un niveau");
expect(/rgb\(31, 169, 113\)/.test((taskMeta.critDots || [])[1] || ""), `Fiche de tâche : « Bas » n'est pas vert (${(taskMeta.critDots || [])[1]})`);
expect(/rgb\(217, 119, 6\)/.test((taskMeta.critDots || [])[2] || ""), `Fiche de tâche : « Moyen » n'est pas orange (${(taskMeta.critDots || [])[2]})`);
expect(/rgb\(220, 38, 38\)/.test((taskMeta.critDots || [])[3] || ""), `Fiche de tâche : « Urgent » n'est pas rouge (${(taskMeta.critDots || [])[3]})`);
expect((taskMeta.critShape || []).every((f) => /^11x11:50%$/.test(f)),
  `Fiche de tâche : les pastilles ne sont pas rondes (${(taskMeta.critShape || []).join(", ")})`);
expect(taskMeta.critDotAfterPick === 1, "Fiche de tâche : après avoir choisi un niveau, la pastille n'apparaît pas sur la valeur fermée");

expect(!seen.miniRiskButton, "Mini-Gantt : le bouton « + Risque » devrait avoir disparu — les risques s'éditent dans la fiche de la tâche");

// --- Widget « Bulles » (#92) ------------------------------------------------
expect(!bulles.error, `Bulles : ${bulles.error || ""}`);
if (!bulles.error) {
  expect(bulles.bubbles > 0, "Bulles : aucune bulle rendue");
  expect(bulles.milestones > 0, "Bulles : aucun jalon rendu en bulle compacte");
  expect(bulles.bars === 0, `Bulles : ${bulles.bars} barre(s) de Mini-Gantt dessinée(s) — le mode bulles remplace la barre, il ne s'y ajoute pas`);
  expect(bulles.labelColumn === 0, "Bulles : la colonne d'étiquettes de gauche est rendue — en mode bulles, le titre vit dans la bulle");
  // Les champs sous la bulle doivent rester DANS leur ligne : c'est le défaut
  // que la position absolue produisait (débordement sur la ligne suivante).
  const debordent = bulles.rows.filter((r) => r.fields && (r.fields.bottom > r.row.bottom + 1 || r.fields.top < r.row.top - 1));
  expect(debordent.length === 0, `Bulles : ${debordent.length} ligne(s) dont les champs débordent de la ligne — ils doivent compter dans sa hauteur`);
  const horsBulle = bulles.rows.filter((r) => r.bubble && (r.bubble.bottom > r.row.bottom + 2 || r.bubble.top < r.row.top - 2));
  expect(horsBulle.length === 0, `Bulles : ${horsBulle.length} bulle(s) sortent de leur ligne`);
  // Deux macro-bulles, dont une sur des tâches NON successives : trois
  // enveloppes, chacune avec son remplissage, son libellé et sa surface.
  expect(bulles.frames.length === 3, `Bulles : ${bulles.frames.length} enveloppe(s) de macro-bulle, 3 attendues (une contiguë, une coupée en deux)`);
  expect(bulles.fills.length === bulles.frames.length, `Bulles : ${bulles.fills.length} remplissage(s) pour ${bulles.frames.length} cadre(s) — les deux couches doivent aller par paires`);
  expect(bulles.labels.length === 3, `Bulles : ${bulles.labels.length} libellé(s) de macro-bulle, 3 attendus`);
  expect(bulles.frames.every((f) => f.right - f.left > 4 && f.bottom - f.top > 4), "Bulles : une enveloppe a une surface nulle");
  const bandeHaut = Math.min(...bulles.rows.map((r) => r.row.top));
  const bandeBas = Math.max(...bulles.rows.map((r) => r.row.bottom));
  expect(bulles.frames.every((f) => f.top >= bandeHaut - 12 && f.bottom <= bandeBas + 12),
    "Bulles : une enveloppe sort de la zone des lignes");
  expect(bulles.progress.length > 0, "Bulles : aucune barre d'avancement agrégé sur les macro-bulles");
  // Imbrication : deux macro-bulles partagent une tâche, leurs enveloppes ne
  // doivent pas confondre leurs traits.
  const tops = bulles.frames.map((f) => f.top).sort((a, b) => a - b);
  expect(new Set(tops).size === tops.length, "Bulles : deux enveloppes imbriquées partagent exactement le même sommet");
  // Second widget : groupé par projet, coloré par responsable, avec légende.
  expect(bulles.groupHeads >= 2, `Bulles groupées : ${bulles.groupHeads} en-tête(s) de groupe`);
  expect(bulles.groupedBubbles > 0, "Bulles groupées : aucune bulle dans les groupes");
  expect(bulles.legend.length >= 2, `Bulles : légende à ${bulles.legend.length} rang(s), au moins 2 attendus (un par responsable présent)`);
  // Lignes de description réglables (#97) : la bulle gagne la hauteur des
  // lignes demandées, et son pied reste visible.
  // Alignement des couches : un seul bord de départ pour tout le monde.
  const al = bulles.alignement;
  expect(al && al.ligne !== null, "Bulles : piste introuvable pour le contrôle d'alignement");
  if (al) {
    ["axe", "grille", "macros"].forEach((clef) => {
      expect(al[clef] !== null && Math.abs(al[clef] - al.ligne) <= 1,
        `Bulles : la couche « ${clef} » part de ${al[clef]}px, la piste de ${al.ligne}px — les repères tombent à côté des bulles`);
    });
  }
  // Champs sous la bulle : MÊMES BORDS que la bulle (#103).
  const bordsFaux = (bulles.edge?.rows || []).filter((r) => r.bubble && r.fields
    && (Math.abs(r.fields.left - r.bubble.left) > 1 || Math.abs(r.fields.right - r.bubble.right) > 1));
  expect(bordsFaux.length === 0,
    `Bulles : ${bordsFaux.length} rangée(s) de champs qui ne tiennent pas la largeur de leur bulle`);
  // Contenance des macro-bulles (#104) : la bulle d'une tâche courte et celle
  // d'un jalon doivent rester dans le cadre.
  expect((bulles.edge?.frames || []).length === 1,
    `Bulles : ${(bulles.edge?.frames || []).length} enveloppe(s) pour la macro-bulle regroupée, 1 attendue`);
  if (bulles.edge && bulles.edge.frames.length === 1) {
    const cadre = bulles.edge.frames[0];
    const dehors = bulles.edge.bubbles.filter((b) => b.left < cadre.left - 1 || b.right > cadre.right + 1 || b.top < cadre.top - 1 || b.bottom > cadre.bottom + 1);
    expect(dehors.length === 0,
      `Bulles : ${dehors.length} bulle(s) sortent du cadre de leur macro-bulle (cadre ${cadre.left}→${cadre.right}, bulles ${bulles.edge.bubbles.map((b) => b.left + "→" + b.right).join(", ")})`);
  }
  expect(bulles.descRows.length > 0, "Bulles : aucune description rendue dans le widget à trois lignes");
  // Infobulle et poignée d'avancement (#106).
  expect(!poignee.error, `Bulles : contrôle de la poignée interrompu (${poignee.error})`);
  expect(poignee.surLeCorps === 1, `Bulles : ${poignee.surLeCorps} infobulle(s) au survol du corps de la bulle, 1 attendue`);
  expect(poignee.surLaPoignee === 0, "Bulles : l'infobulle reste ouverte au survol de la poignée d'avancement — elle la masque");
  expect(poignee.retourSurLeCorps === 1, "Bulles : l'infobulle ne revient pas quand on quitte la poignée");
  expect(bulles.descRows.every((r) => r.desc.lines === "3"),
    `Bulles : la description n'est pas coupée à 3 lignes (${(bulles.descRows[0] || {}).desc?.lines})`);
  expect(bulles.descBubbleH === bulles.baseBubbleH + 26,
    `Bulles : bulle à 3 lignes de description haute de ${bulles.descBubbleH}px, ${bulles.baseBubbleH + 26}px attendus (base ${bulles.baseBubbleH} + 2 lignes)`);
  const piedCoupe = bulles.descRows.filter((r) => r.foot && r.bubble && r.foot.bottom > r.bubble.bottom + 1);
  expect(piedCoupe.length === 0, `Bulles : ${piedCoupe.length} pied(s) de bulle coupé(s) par la hauteur de la bulle`);
  const descHorsBulle = bulles.descRows.filter((r) => r.bubble && r.row && r.bubble.bottom > r.row.bottom + 2);
  expect(descHorsBulle.length === 0, `Bulles : ${descHorsBulle.length} bulle(s) à description sortent de leur ligne`);
}

expect(!scoped.error, `contrôle de la portée des listes déroulantes interrompu : ${scoped.error}`);
expect(scoped.labels.length === 2, `Paramètres : ${scoped.labels.length} tâche(s) proposée(s), 2 attendues (seul le projet filtré)`);
expect(scoped.labels.every((l) => /FOR-0129|DREAL/.test(l)), `Paramètres : des tâches hors filtre sont proposées (${scoped.labels.join(", ")})`);

expect(!orgMetro.error, `Organigramme Métro : contrôle interrompu (${orgMetro.error})`);
if (!orgMetro.error) {
  expect(orgMetro.groups === 5, `Organigramme Métro : ${orgMetro.groups} groupe(s) SVG sémantique(s) sur 5 (lignes, branches, correspondances, stations, libellés)`);
  expect(orgMetro.stations === 20, `Organigramme Métro : ${orgMetro.stations} station(s), 20 attendues (19 personnes + 1 correspondance multi-équipe)`);
  expect(orgMetro.duplicates === 1, `Organigramme Métro : ${orgMetro.duplicates} station(s) de correspondance, 1 attendue`);
  expect(orgMetro.junctions >= 3, `Organigramme Métro : ${orgMetro.junctions} point(s) de bifurcation, au moins 3 attendus`);
  expect(orgMetro.transverse === 1, `Organigramme Métro : ${orgMetro.transverse} correspondance(s) transverse(s), 1 attendue`);
  expect(orgMetro.independent >= 2, `Organigramme Métro : ${orgMetro.independent} ligne(s) indépendante(s), 2 attendues (transverse + sans équipe)`);
  // Responsables : 6 lignes dirigées par un membre présent sur la ligne
  // (halo), 7 personnes dirigeant une équipe (étoile, Nora Vidal comprise
  // hors de la ligne Applications), et Applications nomme la sienne.
  expect(orgMetro.leadHalos === 6, `Organigramme Métro : ${orgMetro.leadHalos} halo(s) de responsable, 6 attendus`);
  expect(orgMetro.leadStars === 7, `Organigramme Métro : ${orgMetro.leadStars} étoile(s) de responsable, 7 attendues`);
  expect(orgMetro.badgeLeads.length === 1 && orgMetro.badgeLeads[0] === "Resp. Nora Vidal", `Organigramme Métro : rappel du responsable hors ligne ${JSON.stringify(orgMetro.badgeLeads)}, « Resp. Nora Vidal » attendu`);
  expect(orgMetro.overlaps.length === 0, `Organigramme Métro : libellés qui se chevauchent dans le rendu réel — ${orgMetro.overlaps.slice(0, 5).join(" ; ")}`);
  expect(orgMetro.fitScale > 0 && orgMetro.fitScale <= 1, `Organigramme Métro : échelle d'ajustement ${orgMetro.fitScale}`);
  expect(orgMetro.zoomedScale > orgMetro.fitScale, `Organigramme Métro : le zoom avant ne grossit pas (${orgMetro.fitScale} → ${orgMetro.zoomedScale})`);
  expect(Math.abs(orgMetro.refitScale - orgMetro.fitScale) < 0.001, `Organigramme Métro : « Ajuster » ne revient pas à l'échelle d'origine (${orgMetro.refitScale})`);
  expect(orgMetro.panned, "Organigramme Métro : glisser le plan ne le déplace pas");
  expect(orgMetro.transverseHidden === 0, "Organigramme Métro : les correspondances restent visibles une fois masquées");
  expect(orgMetro.hoverDimmed > 0, "Organigramme Métro : le survol ne met pas les relations en évidence");
  expect(orgMetro.hoverOccurrence === 1, `Organigramme Métro : ${orgMetro.hoverOccurrence} liaison(s) entre les occurrences d'une personne multi-équipe au survol, 1 attendue`);
  expect(/Emma Roux/.test(orgMetro.memberModal || ""), `Organigramme Métro : le clic sur une station n'ouvre pas la fiche utilisateur (${orgMetro.memberModal})`);
  expect(/Plateforme/.test(orgMetro.teamModal || ""), `Organigramme Métro : le clic sur un bandeau n'ouvre pas la fiche équipe (${orgMetro.teamModal})`);
  expect(orgMetro.hierarchyPanels > 0, "Organigramme : la bascule vers « Hiérarchique » n'affiche plus l'arbre existant");
  expect(orgMetro.orbitalShell === 1, "Organigramme : la bascule vers « Orbital » n'affiche pas la vue orbitale");
  expect(orgMetro.backToMetro === 1, "Organigramme : la bascule retour vers « Métro » échoue");
  expect(orgMetro.narrow && orgMetro.narrow.scale >= 0.6, `Organigramme Métro étroit : zoom d'ouverture ${orgMetro.narrow && orgMetro.narrow.scale}, au moins 0,6 attendu pour rester lisible`);
  expect(orgMetro.narrow && orgMetro.narrow.legendHidden, "Organigramme Métro étroit : la légende reste affichée dans un widget de 380 px");
  expect(orgMetro.narrow && !orgMetro.narrow.exportLabelHidden, "Organigramme Métro étroit : les libellés SVG/PNG ont disparu alors qu'ils tiennent à 380 px");
  expect(orgMetro.narrow && orgMetro.narrow.inside && orgMetro.narrow.scroll <= 0, `Organigramme Métro étroit : barre d'outils hors cadre ou défilement horizontal (${JSON.stringify(orgMetro.narrow)})`);
}

console.log(`Capture : ${shot}`);
if (failures.length) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`Contrôle visuel : OK (${seen.miniFrames.length} cadres et ${seen.miniBlocks} blocs dans le Mini-Gantt)`);
