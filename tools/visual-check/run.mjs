// Contrôle visuel hors ligne : construit le banc d'essai, ouvre les deux
// diagrammes dans un navigateur, vérifie la géométrie des annotations et écrit
// une capture. Sort en erreur si un contrôle échoue.
import http from "node:http";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
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
// WebGL logiciel (SwiftShader) : la vue Carte (#361) dessine en 3D, y compris
// sur une machine sans carte graphique.
const launchOptions = { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"], ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) };
const browser = await playwright.chromium.launch(launchOptions);
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });

// Vues 3D sous rendu logiciel : mesuré seul, une page 3D tourne à 1 ou 2
// images/s et une image dure jusqu'à 3,6 s pendant un déplacement de caméra.
// Un clic Playwright attend plusieurs images (visible, stable, cible atteinte),
// si bien que 30 s ne suffisent pas toujours quand la machine est chargée : les
// boutons HTML ne bougent pas, c'est le rendu qui n'avance plus. Les pages 3D
// reçoivent donc un délai d'attente par défaut plus long ; ce qui est vérifié
// ne change pas, seul le temps accordé pour y parvenir.
const SLOW_3D_MS = 90000;
const page3d = async (options) => {
  const pg = await browser.newPage(options);
  pg.setDefaultTimeout(SLOW_3D_MS);
  return pg;
};
// Une page 3D laissée ouverte par un scénario en échec continue de dessiner et
// affame les scénarios suivants : chaque scénario 3D ferme ses pages en sortant.
const closeScenarioPages = async () => {
  for (const pg of browser.contexts().flatMap((c) => c.pages())) if (pg !== page) await pg.close().catch(() => {});
};
// Captures des vues 3D par le protocole du navigateur : `page.screenshot`
// attend le chargement des polices, qui peut expirer sous rendu logiciel et
// interrompait tout le scénario. Une capture n'est pas un contrôle.
const shot3d = async (pg, name) => {
  try {
    const cdp = await pg.context().newCDPSession(pg);
    const sh = await cdp.send("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(dir, name), Buffer.from(sh.data, "base64"));
    await cdp.detach().catch(() => {});
  } catch (e) {
    console.warn(`Capture ${name} non écrite : ${String(e).split("\n")[0]}`);
  }
};

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
    // Le groupe du MODE seulement : #165 a ajouté, avec la même classe, le
    // groupe « Référence comparée » (Dernière revue / Plan initial) (#298).
    cmpModeButtons: [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-cmpmode[aria-label=\"Mode d'affichage du Mini-Gantt\"] button")].map((b) => ({ text: b.textContent.trim(), active: b.classList.contains("active") })),
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
    // Bandes de la barre, à 2 px près : un menu déroulant se pose 1 px plus
    // bas qu'un groupe de boutons sans pour autant ouvrir une nouvelle bande.
    ...(() => {
      const kids = [...document.querySelectorAll("#harness-comparison-minigantt .lp-widget-minigantt-toolbar > *")];
      const tops = kids.map((el) => Math.round(el.getBoundingClientRect().top)).sort((a, b) => a - b);
      const bands = [];
      tops.forEach((t) => { if (!bands.length || t - bands[bands.length - 1].top > 2) bands.push({ top: t, n: 1 }); else bands[bands.length - 1].n += 1; });
      return { toolbarRows: bands.length, toolbarFirstRow: bands.length ? bands[0].n : 0 };
    })(),
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

/* Widget « Carte (complet) » (#418) : la vraie vue Carte monte dans la
   DashboardView du banc ; posé petit (3 × 4), il invite à l'agrandir. */
const carteWidget = {};
try {
  const w = page.locator(".lp-widget-embed-carte").first();
  await w.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".lp-widget-embed-carte .lp-carte-stage")].some((e) => e.dataset.carteStatus === "ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  Object.assign(carteWidget, await page.evaluate(() => ({
    widgets: document.querySelectorAll(".lp-widget-embed-carte").length,
    canvas: document.querySelectorAll(".lp-widget-embed-carte .lp-carte-gl canvas").length,
    hint: document.querySelectorAll(".lp-widget-embed-carte .lp-carte-small-hint").length,
    toolbar: document.querySelectorAll(".lp-widget-embed-carte .lp-carte-toolbar").length,
  })));
} catch (error) {
  carteWidget.error = String(error).split("\n")[0];
}

/* Widget « Cosmos (complet) » (#439) : la vraie vue Cosmos monte dans la
   DashboardView du banc, avec sa barre d'outils, son rail et son fil
   d'Ariane ; posé petit (3 × 4), il invite à l'agrandir. */
const cosmosWidget = {};
try {
  const w = page.locator(".lp-widget-embed-cosmos").first();
  await w.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll(".lp-widget-embed-cosmos .lp-cosmos-stage")].some((e) => e.dataset.cosmosStatus === "ready"), null, { timeout: 60000 });
  await page.waitForTimeout(800);
  Object.assign(cosmosWidget, await page.evaluate(() => ({
    widgets: document.querySelectorAll(".lp-widget-embed-cosmos").length,
    canvas: document.querySelectorAll(".lp-widget-embed-cosmos .lp-cosmos-gl canvas").length,
    hint: document.querySelectorAll(".lp-widget-embed-cosmos .lp-carte-small-hint").length,
    toolbar: document.querySelectorAll(".lp-widget-embed-cosmos .lp-carte-toolbar").length,
    rail: document.querySelectorAll(".lp-widget-embed-cosmos .lp-cosmos-rail").length,
    crumbs: document.querySelectorAll(".lp-widget-embed-cosmos .lp-cosmos-crumbs").length,
    largeHint: [...document.querySelectorAll(".lp-widget-embed-cosmos")].filter((e) => e.getBoundingClientRect().width >= 700).map((e) => e.querySelectorAll(".lp-carte-small-hint").length),
  })));
} catch (error) {
  cosmosWidget.error = String(error).split("\n")[0];
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
/* La fiche de tâche est répartie en onglets (Général, Planning, Historique) :
   le méta bloc, la comparaison et les risques vivent dans « Planning », la
   rangée Projet/Statut/Type/Criticité, la description et le titre dans
   « Général ». Chaque contrôle ouvre d'abord l'onglet qui porte ce qu'il
   vérifie (#298). */
const ongletFiche = async (nom) => {
  await page.locator(".lp-modal .lp-task-tab-btn", { hasText: nom }).click();
  await page.waitForTimeout(250);
};
try {
  await page.locator("#harness-open-task-modal").click();
  await page.waitForSelector(".lp-modal .lp-task-tabs", { timeout: 10000 });
  await ongletFiche("Planning");
  await page.waitForSelector(".lp-modal #task-meta-block", { timeout: 10000 });
  const box = page.locator(".lp-modal #task-meta-block");
  taskMeta.checkbox = await box.count();
  taskMeta.checked = await box.isChecked();
  taskMeta.controls = await page.locator(".lp-modal .lp-density-btn", { hasText: /Phase|Fenêtre de décision|Pointillés|Continue/ }).count();
  taskMeta.hints = (await page.locator(".lp-modal .lp-gantt-annot-hint").allTextContents()).map((t) => t.replace(/\s+/g, " ").trim());
  await ongletFiche("Général");
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

  await ongletFiche("Planning");
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
  await page.waitForSelector(".lp-modal .lp-task-tabs", { timeout: 10000 });
  await ongletFiche("Planning");
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
  await ongletFiche("Général");
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
  // La fiche se remplit après l'ouverture de la modale : compter tout de suite
  // donnait parfois 0 sur une machine chargée. On attend les deux listes, puis
  // on compte ; délai dépassé, le compte est jugé tel quel.
  await page.waitForFunction(() => document.querySelectorAll(".lp-modal .lp-activity-search-trigger").length > 1, null, { timeout: 15000 }).catch(() => {});
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
      secondary: [...root.querySelectorAll(".lp-orgmetro-secondary")].map((el) => el.style.stroke),
      independent: root.querySelectorAll(".lp-orgmetro-badge.is-independent").length,
      leadHalos: root.querySelectorAll(".lp-orgmetro-lead-halo").length,
      relations: root.querySelectorAll(".lp-orgmetro-relation").length,
      occurrenceTarget: (() => {
        const g = [...root.querySelectorAll(".lp-orgmetro-relation-group")].find((el) => /Astreinte/.test(el.textContent));
        if (!g) return null;
        const path = g.querySelector(".lp-orgmetro-relation");
        const len = path.getTotalLength();
        const end = path.getPointAtLength(len), start = path.getPointAtLength(0);
        const ctm = path.getScreenCTM();
        const toScreen = (p) => ({ x: p.x * ctm.a + ctm.e, y: p.y * ctm.d + ctm.f });
        const pts = [toScreen(start), toScreen(end)];
        const occ = [...root.querySelectorAll('.lp-orgmetro-station[aria-label^="Sacha Morin"]')].map((el) => el.getBoundingClientRect());
        const apps = root.querySelector('.lp-orgmetro-badge[aria-label="Équipe Applications"] .lp-orgmetro-badge-bg').getBoundingClientRect();
        const near = (p, r) => Math.abs(p.y - (r.top + r.height / 2)) < 20 && Math.abs(p.x - r.left) < 260;
        // Occurrence dans Applications : sous son bandeau (celle de Données est plus haut).
        const appsSt = occ.find((r) => r.top > apps.bottom);
        return { nearApps: Boolean(appsSt) && pts.some((p) => near(p, appsSt)), occurrences: occ.length };
      })(),
      cursors: [".lp-orgmetro-line-hit", ".lp-orgmetro-junction.is-draggable", ".lp-orgmetro-station", ".lp-orgmetro-link-hit", ".lp-orgmetro-badge"].map((sel) => { const el = root.querySelector(sel); return el ? getComputedStyle(el).cursor : "absent"; }),
      relationLabels: [...root.querySelectorAll(".lp-orgmetro-relation-label")].map((el) => el.textContent),
      inactiveStations: [...root.querySelectorAll(".lp-orgmetro-station.is-inactive")].map((el) => el.getAttribute("aria-label")),
      horizontalRow: root.querySelectorAll('.lp-orgmetro-lines path.lp-orgmetro-line[data-metro-drag="branch:team:o-ops"]').length - 1,
      horizontalSameY: (() => {
        const ys = ["Luc Perrin", "Eva Moulin"].map((n) => { const r = root.querySelector(`.lp-orgmetro-station[aria-label^="${n}"]`).getBoundingClientRect(); return Math.round(r.top + r.height / 2); });
        return Math.abs(ys[0] - ys[1]) <= 1;
      })(),
      // Nora Vidal a des rattachés : elle reste une station de la ligne
      // Exploration (et non l'en-tête d'une branche à part).
      managerOnLine: (() => {
        const st = [...root.querySelectorAll(".lp-orgmetro-station")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Nora Vidal"));
        const ines = [...root.querySelectorAll(".lp-orgmetro-station")].find((el) => (el.getAttribute("aria-label") || "").startsWith("Inès Garnier"));
        if (!st || !ines) return null;
        const a = st.getBoundingClientRect(), b = ines.getBoundingClientRect();
        return Math.abs((a.left + a.width / 2) - (b.left + b.width / 2));
      })(),
      // Chiffres centrés dans leur pastille (écart des centres, en px écran).
      countOffsets: [...root.querySelectorAll(".lp-orgmetro-badge")].map((g) => {
        const bg = g.querySelector(".lp-orgmetro-badge-count-bg");
        const tx = g.querySelector(".lp-orgmetro-badge-count");
        if (!bg || !tx) return 0;
        const a = bg.getBoundingClientRect(), b = tx.getBoundingClientRect();
        return Math.max(Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)), Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)));
      }),
      leadStars: root.querySelectorAll(".lp-orgmetro-label .lp-orgmetro-lead-star").length,
      badgeLeads: [...root.querySelectorAll(".lp-orgmetro-badge-sub")].map((el) => el.textContent),
      leadTitleMetro: [...root.querySelectorAll(".lp-orgmetro-label")].some((el) => /Zoé Faure/.test(el.textContent) && /Responsable de lot/.test(el.textContent)),
      appsFirstStation: (() => {
        const labels = [...root.querySelectorAll(".lp-orgmetro-label")].filter((el) => (el.getAttribute("data-metro-key") || "").startsWith("st:team:o-apps:"));
        return labels.length ? labels[0].textContent : "";
      })(),
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
  orgMetro.secondaryWhenHidden = await page.locator(`${host} .lp-orgmetro-secondary`).count();
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Correspondances transverses"]`).click();
  await page.waitForTimeout(150);
  // Survol : les relations restent pleines, le reste s'estompe.
  await page.locator(`${host} .lp-orgmetro-station[aria-label^="Sacha Morin"]`).first().hover();
  await page.waitForTimeout(200);
  orgMetro.hoverDimmed = await page.locator(`${host} .lp-orgmetro-svg.is-focusing .is-dim`).count();
  orgMetro.hoverOccurrence = await page.locator(`${host} .lp-orgmetro-occurrence`).count();
  await page.mouse.move(5, 5);
  await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro.png") });
  // Variante ★ : responsables inscrits dans le bandeau de leur équipe.
  const leadStations0 = await page.locator(`${host} .lp-orgmetro-station`).count();
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Responsables dans le bandeau"]`).click();
  await page.waitForTimeout(200);
  orgMetro.leadBadgeSubs = await page.locator(`${host} .lp-orgmetro-badge-sub`).count();
  orgMetro.leadBadgeStationsGone = leadStations0 - await page.locator(`${host} .lp-orgmetro-station`).count();
  orgMetro.leadBadgeOverlaps = await page.evaluate((sel) => {
    const els = [...document.querySelectorAll(`${sel} .lp-orgmetro-badge-bg, ${sel} .lp-orgmetro-label`)].map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
    }
    return n;
  }, host);
  await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro-lead-badge.png") });
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Responsables dans le bandeau"]`).click();
  await page.waitForTimeout(200);
  // Clic sur une station → fiche utilisateur existante.
  await page.locator(`${host} .lp-orgmetro-station[aria-label^="Emma Roux"]`).first().click();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  orgMetro.memberModal = await page.locator(".lp-modal input").evaluateAll((els) => els.map((e) => e.value).join("|"));
  // Fiche utilisateur : équipes dans une liste déroulante à cases à cocher
  // avec recherche (fermée par défaut), plus de case « Utilisateur inactif ».
  orgMetro.memberTeamsClosed = await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-panel").count();
  orgMetro.memberTeamsLooseBoxes = await page.locator(".lp-modal .lp-field > .lp-checkbox-line input[type=checkbox]").count();
  orgMetro.memberInactiveBox = await page.locator(".lp-modal", { hasText: "Utilisateur inactif" }).count();
  await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-trigger").click();
  await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-search input").fill("plate");
  orgMetro.memberTeamsFiltered = await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-option").allInnerTexts();
  orgMetro.memberTeamsBulk = await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-actions").count();
  await page.locator(".lp-modal").first().screenshot({ path: path.join(dir, "member-teams.png") });
  await page.locator(".lp-modal .lp-member-teams-select .lp-entity-filter-trigger").click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.locator(".lp-modal").count()) await page.locator(".lp-modal .lp-icon-btn, .lp-modal button", { hasText: /Annuler|Fermer/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  // Clic sur un bandeau d'équipe → fiche équipe existante.
  // Clic simple sur un bandeau → la ligne se replie (seul le responsable
  // reste) ; second clic → elle se déplie.
  const stationsBeforeCollapse = await page.locator(`${host} .lp-orgmetro-station`).count();
  await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Exploration"]`).click();
  await page.waitForTimeout(500);
  orgMetro.collapsedBadge = await page.locator(`${host} .lp-orgmetro-badge.is-collapsed`).count();
  orgMetro.collapsedStations = stationsBeforeCollapse - await page.locator(`${host} .lp-orgmetro-station`).count();
  orgMetro.collapsedLeadKept = await page.locator(`${host} .lp-orgmetro-station[aria-label^="Inès Garnier"]`).count();
  orgMetro.collapsedHidden = await page.locator(`${host} .lp-orgmetro-station[aria-label^="Adam Colin"]`).count();
  orgMetro.collapsedModal = await page.locator(".lp-modal").count();
  await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Exploration"]`).click();
  await page.waitForTimeout(500);
  orgMetro.expandedStations = await page.locator(`${host} .lp-orgmetro-station`).count() - stationsBeforeCollapse;
  // Double-clic sur un bandeau d'équipe → fiche équipe existante.
  await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Plateforme"]`).dblclick();
  await page.waitForSelector(".lp-modal", { timeout: 10000 });
  orgMetro.teamModal = await page.locator(".lp-modal input").evaluateAll((els) => els.map((e) => e.value).join("|"));
  // Fiche équipe : un clic sur un membre ouvre son poste dans cette équipe ;
  // Entrée enregistre, Échap annule sans fermer la fiche.
  await page.locator(".lp-modal .lp-team-role-trigger", { hasText: "Zoé Faure" }).first().click();
  await page.locator(".lp-modal .lp-team-role-edit input").fill("Architecte cloud");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  orgMetro.roleSaved = await page.locator(".lp-modal .lp-team-role-trigger", { hasText: "Zoé Faure" }).first().innerText();
  await page.locator(".lp-modal .lp-team-role-trigger", { hasText: "Zoé Faure" }).first().click();
  await page.locator(".lp-modal .lp-team-role-edit input").fill("Ne pas garder");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  orgMetro.roleAfterEscape = await page.locator(".lp-modal .lp-team-role-trigger", { hasText: "Zoé Faure" }).first().innerText();
  orgMetro.modalStillOpen = await page.locator(".lp-modal").count();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  if (await page.locator(".lp-modal").count()) await page.locator(".lp-modal button", { hasText: /Annuler|Fermer/ }).first().click().catch(() => {});
  await page.waitForTimeout(200);
  // Attraper une STATION déplace toute sa ligne d'équipe.
  const badgeY = async (name) => page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe ${name}"] .lp-orgmetro-badge-bg`).evaluate((el) => el.getBoundingClientRect().top);
  const opsY0 = await badgeY("Opérations");
  const eva = await page.locator(`${host} .lp-orgmetro-station[aria-label^="Eva Moulin"]`).boundingBox();
  await page.mouse.move(eva.x + eva.width / 2, eva.y + eva.height / 2);
  await page.mouse.down();
  await page.mouse.move(eva.x + eva.width / 2, eva.y + 40, { steps: 4 });
  await page.mouse.move(eva.x + eva.width / 2, eva.y + 90, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  orgMetro.stationDragMoved = (await badgeY("Opérations")) - opsY0 > 30;
  orgMetro.stationDragModal = await page.locator(".lp-modal").count();
  // Déplacement libre : « Opérations » posée à gauche de « Produit », sur la
  // grille ; « Recentrer » rétablit la disposition par défaut.
  const badgeCenterX = async (name) => page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe ${name}"]`).evaluate((el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; });
  const opsBox = await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Opérations"] .lp-orgmetro-badge-bg`).boundingBox();
  const prodBox = await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Produit"] .lp-orgmetro-badge-bg`).boundingBox();
  await page.mouse.move(opsBox.x + 20, opsBox.y + opsBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(opsBox.x - 60, opsBox.y + opsBox.height / 2, { steps: 4 });
  await page.mouse.move(prodBox.x - 30, prodBox.y + prodBox.height / 2, { steps: 10 });
  orgMetro.dropMarker = await page.locator(`${host} .lp-orgmetro-grid`).count();
  await page.mouse.up();
  await page.waitForTimeout(300);
  orgMetro.dragModal = await page.locator(".lp-modal").count();
  orgMetro.afterDrag = (await badgeCenterX("Opérations")) < (await badgeCenterX("Produit"));
  // Aucun texte superposé après le lâcher (ajustement automatique).
  const textOverlaps = async () => page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const rs = [...root.querySelectorAll(".lp-orgmetro-label, .lp-orgmetro-badge")].map((el) => el.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n += 1;
    }
    return n;
  }, host);
  orgMetro.overlapsAfterDrag = await textOverlaps();
  // Le grand titre se déplace seul.
  const hubX = async () => page.locator(`${host} .lp-orgmetro-badge.is-hub .lp-orgmetro-badge-bg`).evaluate((el) => el.getBoundingClientRect().left);
  const hub0 = await hubX(), prod0 = await badgeCenterX("Produit");
  const hubBox = await page.locator(`${host} .lp-orgmetro-badge.is-hub .lp-orgmetro-badge-bg`).boundingBox();
  await page.mouse.move(hubBox.x + 20, hubBox.y + hubBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hubBox.x + 80, hubBox.y + hubBox.height / 2, { steps: 4 });
  await page.mouse.move(hubBox.x + 180, hubBox.y + hubBox.height / 2 - 10, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  orgMetro.hubMovedAlone = (await hubX()) - hub0 > 60 && Math.abs((await badgeCenterX("Produit")) - prod0) < 2;
  // Un lien se déplace (relation « Binôme »).
  const binomeD0 = await page.locator(`${host} .lp-orgmetro-relation-group`, { hasText: "Binôme" }).locator(".lp-orgmetro-relation").getAttribute("d");
  const pill = await page.locator(`${host} .lp-orgmetro-relation-group`, { hasText: "Binôme" }).locator(".lp-orgmetro-relation-pill").boundingBox();
  await page.mouse.move(pill.x - 25, pill.y + pill.height / 2);
  await page.mouse.down();
  await page.mouse.move(pill.x - 25, pill.y + pill.height / 2 - 30, { steps: 4 });
  await page.mouse.move(pill.x - 25, pill.y + pill.height / 2 - 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  orgMetro.linkMoved = binomeD0 !== await page.locator(`${host} .lp-orgmetro-relation-group`, { hasText: "Binôme" }).locator(".lp-orgmetro-relation").getAttribute("d");
  // Point de connexion d'un lien : il s'attrape et glisse le long du bandeau.
  {
    const port = page.locator(`${host} .lp-orgmetro-port.is-draggable`).first();
    orgMetro.portDraggable = await port.count();
    if (orgMetro.portDraggable) {
      const pb = await port.boundingBox();
      const cx = pb.x + pb.width / 2, cy = pb.y + pb.height / 2;
      // Point effectivement sous le pointeur (deux liens peuvent partager un point).
      const key = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return el ? el.getAttribute("data-metro-drag") : null; }, [cx, cy]);
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx, cy + 20, { steps: 3 });
      await page.mouse.move(cx - 10, cy + 45, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const after = await page.locator(`${host} .lp-orgmetro-port[data-metro-drag="${key}"]`).boundingBox();
      orgMetro.portMoved = Boolean(after) && Math.hypot(after.x + after.width / 2 - cx, after.y + after.height / 2 - cy) > 5;
    }
  }
  // « Cœur produit » remontée au-dessus de la barre de Produit : le lien
  // remonte depuis la barre et entre par le flanc du bandeau.
  {
    const cp = await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Cœur produit"] .lp-orgmetro-badge-bg`).boundingBox();
    await page.mouse.move(cp.x + 20, cp.y + cp.height / 2);
    await page.mouse.down();
    await page.mouse.move(cp.x + 20, cp.y - 20, { steps: 4 });
    await page.mouse.move(cp.x - 80, cp.y - 140, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    orgMetro.upMove = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const badge = root.querySelector('.lp-orgmetro-badge[aria-label="Équipe Cœur produit"] .lp-orgmetro-badge-bg').getBoundingClientRect();
      const drop = root.querySelector('.lp-orgmetro-branches path.lp-orgmetro-line[data-metro-drag="branch:team:o-core"]');
      const bar = root.querySelector('.lp-orgmetro-branches path.lp-orgmetro-line[data-metro-drag="fork:team:o-prod"]');
      const barY = bar ? bar.getBoundingClientRect().top : null;
      return { above: barY !== null && badge.bottom < barY, sideEntry: Boolean(drop) && / H /.test(drop.getAttribute("d")) && / Q /.test(drop.getAttribute("d")) };
    }, host);
    orgMetro.overlapsAfterUp = await textOverlaps();
    await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro-up.png") });
  }
  // Nœud de bifurcation de « Technique » attrapé et descendu : ses deux
  // lignes (Plateforme, Applications) suivent, la ligne Technique reste.
  const badgeTop = async (name) => (await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe ${name}"] .lp-orgmetro-badge-bg`).boundingBox()).y;
  const tech0 = await badgeTop("Technique"), plat0 = await badgeTop("Plateforme"), apps0 = await badgeTop("Applications");
  const node = await page.locator(`${host} .lp-orgmetro-junction[data-metro-drag="fork:team:o-tech"]`).boundingBox();
  await page.mouse.move(node.x + node.width / 2, node.y + node.height / 2);
  await page.mouse.down();
  await page.mouse.move(node.x + node.width / 2, node.y + 30, { steps: 4 });
  await page.mouse.move(node.x + node.width / 2 + 40, node.y + 70, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  orgMetro.forkDrag = { tech: Math.round(await badgeTop("Technique") - tech0), plat: Math.round(await badgeTop("Plateforme") - plat0), apps: Math.round(await badgeTop("Applications") - apps0) };
  orgMetro.forkJog = /H/.test(await page.locator(`${host} .lp-orgmetro-lines path[data-metro-drag="branch:team:o-tech"]`).first().getAttribute("d"));
  orgMetro.overlapsAfterFork = await textOverlaps();
  await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro-fork.png") });
  await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Recentrer et rétablir la disposition par défaut"]`).click();
  await page.waitForTimeout(300);
  orgMetro.afterReset = (await badgeCenterX("Opérations")) > (await badgeCenterX("Produit"));
  // Plus de vue hiérarchique : aucune bascule de mode, le plan Métro seul.
  orgMetro.modeButtons = await page.locator(`${host} .lp-orgchart-mode-btn`).count();
  orgMetro.hierarchyPanels = await page.locator(`${host} [class*="lp-orghier"]`).count();
  // Vues enregistrées : replier Exploration, enregistrer « Revue », tout
  // rétablir (Recentrer), puis recharger la vue → Exploration de nouveau
  // repliée.
  {
    await page.locator(`${host} .lp-orgmetro-badge[aria-label="Équipe Exploration"]`).click();
    await page.waitForTimeout(500);
    await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Vues enregistrées"]`).click();
    await page.locator(`${host} .lp-orgmetro-views input`).fill("Revue");
    await page.locator(`${host} .lp-orgmetro-views button[type="submit"]`).click();
    await page.waitForTimeout(200);
    orgMetro.viewsListed = await page.locator(`${host} .lp-orgmetro-views-name`).allInnerTexts();
    await page.locator(`${host}`).screenshot({ path: path.join(dir, "orgmetro-views.png") });
    await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Vues enregistrées"]`).click();
    await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Recentrer et rétablir la disposition par défaut"]`).click();
    await page.waitForTimeout(300);
    orgMetro.viewResetCollapsed = await page.locator(`${host} .lp-orgmetro-badge.is-collapsed`).count();
    await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Vues enregistrées"]`).click();
    await page.locator(`${host} .lp-orgmetro-views-load`, { hasText: "Revue" }).click();
    await page.waitForTimeout(400);
    orgMetro.viewReloaded = await page.locator(`${host} .lp-orgmetro-badge.is-collapsed[aria-label="Équipe Exploration"]`).count();
    await page.locator(`${host} .lp-orgmetro-toolbar button[aria-label="Recentrer et rétablir la disposition par défaut"]`).click();
    await page.waitForTimeout(300);
  }
  // Sous-équipes empilées (« Technique ») : Plateforme puis Applications,
  // l'une sous l'autre, à droite du tronc, chacune par un coude.
  const stackHost = "#harness-orgmetro-stacked";
  await page.locator(`${stackHost} .lp-orgmetro-toolbar button[aria-label="Ajuster à l'écran"]`).click().catch(() => {});
  await page.waitForTimeout(300);
  orgMetro.stacked = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const box = (name) => { const el = root.querySelector(`.lp-orgmetro-badge[aria-label="Équipe ${name}"] .lp-orgmetro-badge-bg`); return el ? el.getBoundingClientRect() : null; };
    const tech = box("Technique"), plat = box("Plateforme"), apps = box("Applications");
    if (!tech || !plat || !apps) return null;
    return {
      below: apps.top > plat.bottom,
      rightOfTrunk: plat.left > tech.left + tech.width / 2 && apps.left > tech.left + tech.width / 2,
      aligned: Math.abs(plat.left - apps.left) < 40,
      dots: root.querySelectorAll(".lp-orgmetro-junction").length,
    };
  }, stackHost);
  await page.locator(stackHost).screenshot({ path: path.join(dir, "orgmetro-stacked.png") });
  // Trait horizontal d'« Applications » remonté de 40 px : il glisse le long
  // de la ligne, le bandeau d'Applications ne bouge pas.
  {
    const elbowSel = `${stackHost} .lp-orgmetro-line[data-metro-drag="elbow:team:o-apps"]`;
    const d0 = await page.locator(elbowSel).getAttribute("d");
    const appsY0 = (await page.locator(`${stackHost} .lp-orgmetro-badge[aria-label="Équipe Applications"] .lp-orgmetro-badge-bg`).boundingBox()).y;
    // Point au milieu du segment horizontal, converti en coordonnées écran.
    const [hx, hy] = await page.evaluate((sel) => {
      const path = document.querySelector(sel);
      const m = /^M ([\d.-]+) ([\d.-]+) H ([\d.-]+)/.exec(path.getAttribute("d"));
      const pt = path.ownerSVGElement.createSVGPoint();
      pt.x = (Number(m[1]) + Number(m[3])) / 2; pt.y = Number(m[2]);
      const sp = pt.matrixTransform(path.getScreenCTM());
      return [sp.x, sp.y];
    }, elbowSel);
    await page.mouse.move(hx, hy);
    await page.mouse.down();
    await page.mouse.move(hx, hy - 15, { steps: 3 });
    await page.mouse.move(hx, hy - 40, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(300);
    const appsY1 = (await page.locator(`${stackHost} .lp-orgmetro-badge[aria-label="Équipe Applications"] .lp-orgmetro-badge-bg`).boundingBox()).y;
    orgMetro.elbowMoved = { changed: d0 !== await page.locator(elbowSel).getAttribute("d"), badgeStill: Math.abs(appsY1 - appsY0) < 1 };
    await page.locator(`${stackHost} .lp-orgmetro-toolbar button[aria-label="Recentrer et rétablir la disposition par défaut"]`).click();
    await page.waitForTimeout(300);
  }
  // Glisser la ligne de « Technique » vers le bas, au-delà du départ de
  // Plateforme : le bandeau descend, Plateforme passe au-dessus.
  {
    const techTrunk = page.locator(`${stackHost} .lp-orgmetro-line-hit[data-metro-drag="split:team:o-tech"]`).first();
    orgMetro.splitHandles = await page.locator(`${stackHost} [data-metro-drag="split:team:o-tech"]`).count();
    // Premier segment du tracé = la ligne des membres (le rail suit).
    const [tx, ty] = await techTrunk.evaluate((path) => {
      const m = /^M ([\d.-]+) ([\d.-]+) V ([\d.-]+)/.exec(path.getAttribute("d"));
      const pt = path.ownerSVGElement.createSVGPoint();
      pt.x = Number(m[1]); pt.y = Number(m[2]) + 6;
      const sp = pt.matrixTransform(path.getScreenCTM());
      return [sp.x, sp.y];
    });
    const appsTop = (await page.locator(`${stackHost} .lp-orgmetro-badge[aria-label="Équipe Applications"] .lp-orgmetro-badge-bg`).boundingBox()).y;
    await page.mouse.move(tx, ty);
    await page.mouse.down();
    await page.mouse.move(tx, ty + 30, { steps: 4 });
    await page.mouse.move(tx, appsTop - 20, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    orgMetro.split = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      const box = (name) => root.querySelector(`.lp-orgmetro-badge[aria-label="Équipe ${name}"] .lp-orgmetro-badge-bg`).getBoundingClientRect();
      const tech = box("Technique"), plat = box("Plateforme"), apps = box("Applications");
      return { platAbove: plat.bottom < tech.top, appsBelow: apps.top > tech.bottom };
    }, stackHost);
    await page.locator(stackHost).screenshot({ path: path.join(dir, "orgmetro-split.png") });
  }
  // Fiche du widget : « Disposition des équipes ». Exploration passe à
  // l'horizontale puis en verticale : elle quitte alors la liste horizontale
  // (une équipe n'a qu'une disposition). Produit en verticale : ses
  // sous-équipes s'empilent après enregistrement.
  await page.locator("#harness-open-orgchart-form").click();
  await page.waitForSelector(".lp-modal .lp-orgmetro-layout-field", { timeout: 10000 });
  const layoutRow = (name) => page.locator(".lp-modal .lp-orgmetro-layout-row", { hasText: name });
  const pick = async (rowName, team) => {
    await layoutRow(rowName).locator(".lp-entity-filter-trigger").click();
    await layoutRow(rowName).locator(".lp-entity-filter-search input").fill(team);
    await layoutRow(rowName).locator(".lp-entity-filter-option", { hasText: team }).first().locator("input").click();
    await layoutRow(rowName).locator(".lp-entity-filter-trigger").click();
  };
  await pick("Horizontale", "Exploration");
  await pick("Verticale", "Exploration");
  await pick("Verticale", "Produit");
  orgMetro.layoutSummaries = await page.locator(".lp-modal .lp-orgmetro-layout-row .lp-entity-filter-trigger").allInnerTexts();
  await page.locator(".lp-modal").first().screenshot({ path: path.join(dir, "orgchart-layout-settings.png") });
  await page.locator(".lp-modal .lp-btn-primary").last().click();
  await page.waitForTimeout(400);
  orgMetro.produitStacked = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    const box = (name) => root.querySelector(`.lp-orgmetro-badge[aria-label="Équipe ${name}"] .lp-orgmetro-badge-bg`)?.getBoundingClientRect();
    const core = box("Cœur produit"), expl = box("Exploration"), prod = box("Produit");
    return core && expl && prod ? { stacked: expl.top > core.bottom, right: core.left > prod.left + prod.width / 2 - 1 } : null;
  }, stackHost);
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

// --- Vue Carte (#361) --------------------------------------------------------
// Parcours principal (recherche, marche, lecture, fiche), lecture seule
// garantie, libellés sans chevauchement, filtres, mobile, gros volume, repli
// sans WebGL.
const carte = {};
try {
  const labelOverlaps = () => {
    const boxes = [...document.querySelectorAll(".lp-carte-label")].filter((l) => l.style.visibility === "visible").map((l) => l.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) n++;
    }
    return { n, count: boxes.length };
  };
  const closeGuide = async (pg) => {
    for (let i = 0; i < 3; i++) {
      const c = await pg.$('.lp-modal [aria-label="Fermer"]');
      if (!c) break;
      await c.click().catch(() => {});
      await pg.waitForTimeout(300);
    }
  };
  const openCarte = async (pg, scen, extra = "") => {
    await pg.goto(`http://127.0.0.1:${port}/index.html?app=1&view=carte&carte=${scen}${extra}`, { waitUntil: "load", timeout: 90000 });
    await pg.waitForSelector(".lp-carte-stage", { timeout: 90000 });
    await closeGuide(pg);
  };
  const cp = await page3d({ viewport: { width: 1400, height: 900 } });
  cp.on("pageerror", (e) => pageErrors.push("Carte : " + e.message));
  await cp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  // Parcours au clavier et à la souris : effets avancés coupés (voir harness.jsx).
  await openCarte(cp, "demo", "&carteFx=0");
  await cp.waitForSelector('.lp-carte-stage[data-carte-status="ready"]', { timeout: 60000 });
  await cp.waitForTimeout(1500);
  carte.badges = await cp.$$eval(".lp-carte-badge", (b) => b.length);
  // #392 : une pastille par dossier ; le survol déroule ses projets.
  await cp.hover(".lp-carte-badge");
  await cp.waitForTimeout(300);
  carte.folderPop = await cp.evaluate(() => ({ open: !!document.querySelector(".lp-carte-folder-pop"), projects: document.querySelectorAll(".lp-carte-folder-proj").length, total: [...document.querySelectorAll(".lp-carte-badge-count")].reduce((n, e) => n + Number(e.textContent || 0), 0) }));
  await cp.mouse.move(700, 600);
  await cp.waitForTimeout(500);
  carte.folderPopClosed = await cp.$$eval(".lp-carte-folder-pop", (e) => e.length);
  // #410 : de près, le nom des totems proches réapparaît (au moins celui du
  // territoire de l'arpenteur).
  carte.projectLabels = await cp.$$eval(".lp-carte-label--project", (l) => l.filter((x) => x.style.visibility === "visible").length);
  carte.canvas = await cp.$$eval(".lp-carte-gl canvas", (c) => c.length);
  carte.tasksBefore = await cp.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  // Recherche : le territoire « Passerelle quai Nord » est atteint.
  await cp.fill(".lp-carte-search input", "Passerelle");
  carte.suggestions = await cp.$$eval(".lp-carte-sugg button", (b) => b.map((x) => x.textContent));
  await cp.press(".lp-carte-search input", "Enter");
  // Le territoire courant ne change qu'une fois la caméra arrivée : sous rendu
  // logiciel, 1,5 s ne suffisait pas toujours (lu « p1 », le point de départ).
  // Délai dépassé : on lit quand même, le contrôle juge la valeur.
  await cp.waitForFunction(() => document.querySelector(".lp-carte-stage").dataset.carteTerritory === "banc-p4", null, { timeout: 60000 }).catch(() => {});
  await cp.waitForTimeout(1500);
  carte.territory = await cp.getAttribute(".lp-carte-stage", "data-carte-territory");
  // #365 : le panneau liste les projets de la région et les tâches du projet.
  carte.panel = await cp.evaluate(() => ({
    projects: document.querySelectorAll(".lp-carte-panel-proj").length,
    tasks: document.querySelectorAll(".lp-carte-panel-tasks button").length,
    done: [...document.querySelectorAll(".lp-carte-panel-tasks button")].filter((b) => /Terminée/.test(b.textContent)).length,
    kicker: (document.querySelector(".lp-carte-panel-kicker") || {}).textContent || "",
  }));
  // #366 : aucun identifiant d'icône technique dans les étiquettes.
  await cp.click('button:has-text("Vue d\'ensemble")');
  await cp.waitForTimeout(2000);
  // #410 : en vue d'ensemble, seul le territoire courant garde son nom.
  carte.projectLabelsFar = await cp.$$eval(".lp-carte-label--project", (l) => l.filter((x) => x.style.visibility === "visible").length);
  carte.iconLeak = await cp.evaluate(() => [...document.querySelectorAll(".lp-carte-labels, .lp-carte-ribbon, .lp-carte-panel")].some((e) => /iconify:|tabler:/.test(e.textContent)));
  await cp.click('button:has-text("Recentrer")');
  await cp.waitForTimeout(1500);
  // #374 : avec « Urgentes », les territoires sans tâche urgente sont grisés.
  // #506 : la criticité est un filtre rapide à cases à cocher (multi-sélection).
  const quick = async (kind, label) => {
    await cp.click(`.lp-carte-toolbar [data-carte-quick="${kind}"] .lp-tool-btn`);
    await cp.waitForTimeout(250);
    if (label) await cp.click(`.lp-carte-quick-menu input[aria-label="${label}"]`);
    else await cp.click(".lp-carte-quick-menu .lp-carte-quick-all");
    await cp.click(`.lp-carte-toolbar [data-carte-quick="${kind}"] .lp-tool-btn`).catch(() => {});
    await cp.waitForTimeout(800);
  };
  const shownOf = () => cp.evaluate(() => Number(document.querySelector(".lp-carte-stage").dataset.carteShown));
  carte.quick = { kinds: await cp.$$eval(".lp-carte-toolbar [data-carte-quick]", (e) => e.map((x) => x.dataset.carteQuick)), all: await shownOf() };
  // #512 : mode focus — halo posé sur les deux tâches en focus du jeu de
  // démo, filtre rapide qui les isole puis rend toute la carte.
  carte.focus = {
    halo: await cp.evaluate(() => (window.__carteBench && window.__carteBench.engine ? window.__carteBench.engine.fxState().focus : -1)),
    count: await cp.$eval('[data-focus-quick="carte"] .lp-focus-quick-count', (e) => Number(e.textContent)).catch(() => -1),
  };
  // Attente explicite : le bouton a basculé ET la scène a été recomptée (le
  // compteur de la scène diffère de l'état précédent) ; les valeurs sont
  // ensuite lues et jugées comme avant. Délai dépassé : on lit quand même.
  const focusToggled = (pressed, before) => cp.waitForFunction(([p, b]) => {
    const btn = document.querySelector('[data-focus-quick="carte"]'), st = document.querySelector(".lp-carte-stage");
    return btn && st && btn.getAttribute("aria-pressed") === p && st.dataset.carteShown !== String(b);
  }, [pressed, before], { timeout: 30000 }).catch(() => {});
  await cp.click('[data-focus-quick="carte"]');
  await focusToggled("true", carte.quick.all);
  await cp.waitForTimeout(800);
  carte.focus.shown = await shownOf();
  carte.focus.pressed = await cp.getAttribute('[data-focus-quick="carte"]', "aria-pressed");
  carte.focus.haloFiltered = await cp.evaluate(() => (window.__carteBench && window.__carteBench.engine ? window.__carteBench.engine.fxState().focus : -1));
  await cp.click('[data-focus-quick="carte"]');
  await focusToggled("false", carte.focus.shown);
  await cp.waitForTimeout(800);
  carte.focus.back = await shownOf();
  await quick("crits", "Criticité : Urgentes");
  carte.dim = await cp.evaluate(() => ({ dim: Number(document.querySelector(".lp-carte-stage").dataset.carteDimmed), all: 7, pill: !!document.querySelector(".lp-carte-filtered button") }));
  carte.quick.urgent = await shownOf();
  await quick("crits", "Criticité : Moyennes");
  carte.quick.urgentMoyen = await shownOf();
  carte.quick.count = await cp.$eval('[data-carte-quick="crits"]', (e) => Number(e.dataset.carteQuickCount));
  await quick("crits", "Criticité : Moyennes");
  // #401 : la carte simplifiée (menu « Affichage ») retire les projets écartés.
  // #400 : plus aucune puce de filtre rapide dans la barre.
  carte.chips = await cp.$$eval(".lp-carte-toolbar .lp-carte-fchip, .lp-carte-filter", (e) => e.length);
  // #435 : le mode Fil d'Ariane ne garde que les prochaines échéances, dans
  // l'ordre, et se quitte depuis sa pastille.
  const shownNow = () => cp.evaluate(() => Number(document.querySelector(".lp-carte-stage").dataset.carteShown));
  const shownBefore = await shownNow();
  await cp.click('.lp-carte-toolbar button:has-text("Fil d\'Ariane")');
  // Les étapes numérotées sont des étiquettes projetées : elles n'apparaissent
  // qu'après quelques images (lues à 0 ou 4 selon la charge). Attente
  // explicite, puis lecture et jugement comme avant.
  await cp.waitForFunction(() => document.querySelector("[data-carte-ariadne]") && document.querySelectorAll(".lp-carte-step").length > 0, null, { timeout: 60000 }).catch(() => {});
  await cp.waitForTimeout(1200);
  carte.ariadne = await cp.evaluate(() => { const pill = document.querySelector("[data-carte-ariadne]"); return { pill: !!pill, n: pill ? Number(pill.dataset.carteAriadne) : -1, steps: document.querySelectorAll(".lp-carte-step").length }; });
  carte.ariadne.before = shownBefore;
  carte.ariadne.shown = await shownNow();
  await cp.click('[data-carte-ariadne] button').catch(() => {});
  await cp.waitForTimeout(800);
  carte.ariadne.after = await shownNow();
  carte.ariadne.closed = await cp.$$eval("[data-carte-ariadne]", (e) => e.length);
  const terrOf = () => cp.evaluate(() => Number(document.querySelector(".lp-carte-stage").dataset.carteTerritories));
  const toggleSimplify = async () => {
    await cp.click('.lp-carte-toolbar button:has-text("Affichage")');
    await cp.click('label:has-text("Masquer les dossiers et projets écartés") input');
    await cp.click('.lp-carte-toolbar button:has-text("Affichage")');
    await cp.waitForTimeout(1200);
  };
  carte.simplify = { before: await terrOf() };
  await toggleSimplify();
  carte.simplify.on = await terrOf();
  await toggleSimplify();
  carte.simplify.off = await terrOf();
  // #438 : la carte se regroupe par responsable (menu « Affichage »), puis
  // revient à l'identique par dossier.
  const groupBy = async (v) => {
    await cp.click('.lp-carte-toolbar button:has-text("Affichage")');
    await cp.selectOption('select[aria-label="Regrouper la carte par"]', v);
    await cp.click('.lp-carte-toolbar button:has-text("Affichage")');
    await cp.waitForTimeout(1500);
  };
  const ribbonOf = () => cp.evaluate(() => ({ group: document.querySelector(".lp-carte-stage").dataset.carteGroup, ribbon: document.querySelector(".lp-carte-ribbon").getAttribute("aria-label"), badges: [...document.querySelectorAll(".lp-carte-badge small")].map((e) => e.textContent) }));
  await groupBy("assignee");
  carte.groupBy = { assignee: await ribbonOf(), terr: await terrOf() };
  await groupBy("folder");
  carte.groupBy.back = await ribbonOf();
  carte.groupBy.backTerr = await terrOf();
  await quick("crits", null);
  carte.quick.back = await shownOf();
  await cp.waitForTimeout(800);
  carte.dimAfter = await cp.evaluate(() => Number(document.querySelector(".lp-carte-stage").dataset.carteDimmed));
  // #364 : le moteur de filtre général s'ouvre depuis la carte.
  await cp.click('.lp-carte-toolbar button:has-text("Filtres")');
  await cp.waitForTimeout(500);
  carte.filterModal = await cp.evaluate(() => [...document.querySelectorAll(".lp-modal")].some((m) => /Filtrer la carte/.test(m.textContent)));
  await cp.keyboard.press("Escape");
  await cp.waitForTimeout(400);
  // Parcours déterministe : une tâche choisie dans le panneau (#365) y conduit
  // l'arpenteur et ouvre son détail ; détail fermé, Entrée rouvre la tâche
  // proche au clavier.
  carte.panelPick = await cp.$eval(".lp-carte-panel-tasks button .lp-carte-panel-task", (e) => e.textContent).catch(() => "");
  await cp.click(".lp-carte-panel-tasks button");
  // Sous rendu logiciel (~2 images/s), le pas de l'arpenteur est plafonné à
  // 0,05 s par image : la marche prend une vingtaine de secondes réelles.
  await cp.waitForFunction(() => document.querySelector(".lp-carte-stage").dataset.carteNear, null, { timeout: 45000 }).catch(() => {});
  carte.panelSelected = await cp.$eval(".lp-carte-detail-title", (e) => e.textContent).catch(() => "");
  await cp.click('.lp-carte-detail [aria-label="Fermer le détail"]');
  await cp.waitForTimeout(400);
  carte.near = await cp.getAttribute(".lp-carte-stage", "data-carte-near");
  carte.nearTitle = carte.near ? await cp.$eval(".lp-carte-near-title", (e) => e.textContent).catch(() => "") : "";
  carte.overlapsNear = await cp.evaluate(labelOverlaps);
  await cp.focus(".lp-carte-stage");
  await cp.keyboard.press("Enter");
  await cp.waitForSelector(".lp-carte-detail", { timeout: 5000 }).catch(() => {});
  carte.selected = await cp.getAttribute(".lp-carte-stage", "data-carte-selected");
  carte.detailTitle = await cp.$eval(".lp-carte-detail-title", (e) => e.textContent).catch(() => "");
  carte.detailSections = await cp.$$eval(".lp-carte-detail .lp-carte-section-title", (e) => e.map((x) => x.textContent));
  carte.tasksAfter = await cp.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  await shot3d(cp, "carte.png");
  // #371 : l'avancement réglé dans le volet est enregistré par Nexora.
  const progressOf = async (id) => cp.evaluate(async (tid) => { const all = JSON.parse((await window.storage.get("nexora:tasks")).value); const t = all.find((x) => x.id === tid); return t ? (t.progress || 0) : null; }, id);
  carte.progressBefore = await progressOf(carte.selected);
  const slider = await cp.$(".lp-carte-progress-edit input[type=range]");
  carte.slider = !!slider;
  if (slider) {
    await slider.focus();
    for (let i = 0; i < 4; i++) { await cp.keyboard.press(carte.progressBefore >= 80 ? "ArrowLeft" : "ArrowRight"); await cp.waitForTimeout(120); }
    // Attente explicite de l'enregistrement (sous rendu logiciel, 2,5 s fixes
    // ne suffisent pas toujours) ; délai dépassé, la valeur est jugée telle quelle.
    await cp.waitForFunction(async ([tid, before]) => { try { const t = JSON.parse((await window.storage.get("nexora:tasks")).value).find((x) => x.id === tid); return !!t && (t.progress || 0) !== before; } catch (e) { return false; } }, [carte.selected, carte.progressBefore], { timeout: 30000, polling: 500 }).catch(() => {});
    carte.progressAfter = await progressOf(carte.selected);
  }
  // « Ouvrir la fiche » ouvre la fiche Nexora habituelle.
  await cp.click(".lp-carte-detail .lp-btn-primary");
  await cp.waitForTimeout(800);
  carte.modalTitle = await cp.evaluate((t) => [...document.querySelectorAll(".lp-modal input, .lp-modal textarea")].some((i) => i.value === t), carte.detailTitle);
  // #412 : depuis la Carte, un clic sur un dossier ou un projet de la barre
  // latérale garde la Carte (sa vue par défaut ne s'applique pas) ; le filtre
  // de projets, lui, s'applique : les autres territoires sont grisés.
  await cp.keyboard.press("Escape");
  await cp.waitForTimeout(400);
  await closeGuide(cp);
  await cp.click(".lp-sidebar .lp-project-name").catch(() => {});
  await cp.waitForTimeout(1200);
  carte.stayOnProjectClick = await cp.evaluate(() => { const st = document.querySelector(".lp-carte-stage"); return { carte: !!document.querySelector(".lp-carte-view"), dimmed: st ? Number(st.dataset.carteDimmed) : -1 }; });
  await cp.close();


  // Tâche d'un calendrier public synchronisé : volet en lecture seule, rien
  // n'est enregistré (elle serait reconstruite à la synchronisation suivante).
  const sp = await page3d({ viewport: { width: 1400, height: 900 } });
  sp.on("pageerror", (e) => pageErrors.push("Carte synchronisée : " + e.message));
  await sp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  await openCarte(sp, "sync");
  await sp.waitForSelector('.lp-carte-stage[data-carte-status="ready"]', { timeout: 60000 });
  await sp.waitForTimeout(1500);
  const syncTask = () => sp.evaluate(async () => JSON.stringify(JSON.parse((await window.storage.get("nexora:tasks")).value).find((t) => t.id === "banc-tsync") || null));
  // Relevé de référence une fois la tâche chargée (lue « null » sur une
  // machine chargée, ce qui faisait conclure à tort à une modification).
  await sp.waitForFunction(async () => { try { return JSON.parse((await window.storage.get("nexora:tasks")).value).some((t) => t.id === "banc-tsync"); } catch (e) { return false; } }, null, { timeout: 60000 }).catch(() => {});
  const syncBefore = await syncTask();
  await sp.fill(".lp-carte-search input", "Jours fériés");
  await sp.press(".lp-carte-search input", "Enter");
  await sp.waitForTimeout(1500);
  await sp.click('.lp-carte-panel-tasks button:has-text("Toussaint")').catch(() => {});
  await sp.waitForSelector(".lp-carte-detail", { timeout: 15000 }).catch(() => {});
  await sp.waitForTimeout(800);
  carte.syncLock = await sp.evaluate(() => {
    const d = document.querySelector(".lp-carte-detail");
    return {
      title: ((d && d.querySelector(".lp-carte-detail-title")) || {}).textContent || "",
      text: /calendrier synchronisé/.test((d || {}).textContent || ""),
      selects: document.querySelectorAll(".lp-carte-detail select").length,
      sliders: document.querySelectorAll(".lp-carte-detail input[type=range]").length,
      doneBtn: !!document.querySelector(".lp-carte-detail .lp-carte-btn-done"),
    };
  });
  const syncAfter = await syncTask();
  carte.syncUnchanged = syncBefore !== "null" && syncBefore === syncAfter;
  if (!carte.syncUnchanged) carte.syncDiff = { before: syncBefore, after: syncAfter };
  await sp.close();

  // Mobile : manette, fiche en tiroir, aucun défilement horizontal.
  const mp = await page3d({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mp.on("pageerror", (e) => pageErrors.push("Carte mobile : " + e.message));
  await mp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  await openCarte(mp, "demo");
  const drawerClose = await mp.$(".lp-sidebar-mobile-close");
  if (drawerClose && await drawerClose.isVisible()) { await drawerClose.click(); await mp.waitForTimeout(400); }
  await mp.waitForSelector('.lp-carte-stage[data-carte-status="ready"]', { timeout: 60000 });
  await mp.waitForTimeout(1500);
  carte.mobile = await mp.evaluate(() => ({
    joystick: !!document.querySelector(".lp-carte-joy"),
    action: !!document.querySelector(".lp-carte-act"),
    scroll: document.documentElement.scrollWidth - window.innerWidth,
    panelHidden: !document.querySelector(".lp-carte-panel") && !!document.querySelector(".lp-carte-panel-toggle"),
    stageWidth: document.querySelector(".lp-carte-stage").getBoundingClientRect().width,
  }));
  await shot3d(mp, "carte-mobile.png");
  await mp.close();

  // Gros volume : 300 projets, 12 000 tâches.
  const vp = await page3d({ viewport: { width: 1400, height: 900 } });
  vp.on("pageerror", (e) => pageErrors.push("Carte volume : " + e.message));
  await vp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  const t0 = Date.now();
  await openCarte(vp, "volume");
  await vp.waitForSelector('.lp-carte-stage[data-carte-status="ready"]', { timeout: 120000 });
  await vp.waitForSelector(".lp-carte-quality-tag", { timeout: 120000 });
  carte.volumeMs = Date.now() - t0;
  carte.volumeQuality = await vp.$eval(".lp-carte-quality-tag", (e) => e.textContent);
  await vp.click('button:has-text("Vue d\'ensemble")');
  await vp.waitForTimeout(2500);
  carte.volumeOverlaps = await vp.evaluate(labelOverlaps);
  await shot3d(vp, "carte-volume.png");
  await vp.close();

  // Sans WebGL : liste de repli, fiches accessibles.
  const fp = await page3d({ viewport: { width: 1400, height: 900 } });
  fp.on("pageerror", (e) => pageErrors.push("Carte sans WebGL : " + e.message));
  await fp.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); }; });
  await fp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  await openCarte(fp, "demo");
  await fp.waitForSelector(".lp-carte-fallback", { timeout: 30000 });
  carte.fallbackProjects = await fp.$$eval(".lp-carte-fallback-proj", (d) => d.length);
  await fp.click(".lp-carte-fallback-proj summary");
  await fp.click(".lp-carte-fallback-proj .lp-carte-link-inline");
  await fp.waitForTimeout(600);
  carte.fallbackModal = await fp.$$eval(".lp-modal", (m) => m.length);
  await fp.close();
} catch (e) {
  carte.error = String(e).split("\n").filter((l) => /Timeout|waiting for|Error/.test(l)).slice(0, 3).join(" · ") + " — état : " + JSON.stringify({ territory: carte.territory, near: carte.near, selected: carte.selected, panel: carte.panel });
} finally {
  await closeScenarioPages();
}

// Gestes de la Carte (#503, #510), sur une page à part : un échec du
// parcours principal (captures) ne les empêche pas de tourner.
{
  // #503 et #510 : un VRAI clic droit (souris de Playwright, pas un appel de
  // l'API) sur une parcelle libre ouvre « Construire ici » ; un contextmenu
  // seul (Ctrl + clic sur Mac, touche Menu, relâchement perdu) aussi ; un
  // clic droit glissé fait tourner sans ouvrir le menu. Clic gauche glissé :
  // la carte se déplace sans tourner ; molette enfoncée glissée : elle tourne.
  carte.gestures = {};
  // Une page Carte restée ouverte après un échec du parcours principal
  // (rendu logiciel) affamerait celle-ci : on la ferme d'abord.
  for (const pg of browser.contexts().flatMap((c) => c.pages())) if (/view=carte/.test(pg.url())) await pg.close().catch(() => {});
  const gp = await page3d({ viewport: { width: 1400, height: 900 } });
  try {
    gp.on("pageerror", (e) => pageErrors.push("Carte (gestes) : " + e.message));
    await gp.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
    await gp.addInitScript(() => { window.__carteBench = {}; });
    await gp.goto(`http://127.0.0.1:${port}/index.html?app=1&view=carte&carte=demo&carteFx=0`, { waitUntil: "load", timeout: 90000 });
    await gp.waitForSelector(".lp-carte-stage", { timeout: 90000 });
    for (let i = 0; i < 3; i++) { const c = await gp.$('.lp-modal [aria-label="Fermer"]'); if (!c) break; await c.click().catch(() => {}); await gp.waitForTimeout(300); }
    await gp.waitForSelector('.lp-carte-stage[data-carte-status="ready"]', { timeout: 60000 });
    await gp.waitForTimeout(2500);
    const G = carte.gestures;
    const view = () => gp.evaluate(() => window.__carteBench.engine.getView());
    const menuOpen = () => gp.evaluate(() => !!document.querySelector(".lp-carte-build"));
    const bp = await gp.evaluate(() => window.__carteBench.engine.buildPoint());
    G.point = bp;
    if (bp) {
      await gp.mouse.click(bp.x, bp.y, { button: "right" });
      await gp.waitForTimeout(700);
      G.rightMenu = await menuOpen();
      G.rightMenuText = await gp.$eval(".lp-carte-build", (e) => e.textContent).catch(() => "");
      await gp.keyboard.press("Escape");
      await gp.waitForTimeout(900);
      G.afterEscape = await menuOpen();
      // contextmenu sans pointerdown ni pointerup.
      await gp.evaluate(({ x, y }) => { const c = document.querySelector("canvas.lp-carte-canvas"); c.dispatchEvent(new MouseEvent("contextmenu", { clientX: x, clientY: y, button: 2, bubbles: true, cancelable: true })); }, bp);
      await gp.waitForTimeout(700);
      G.ctxOnlyMenu = await menuOpen();
      await gp.keyboard.press("Escape");
      await gp.waitForTimeout(900);
      // Clic droit glissé : rotation, pas de menu.
      const v0 = await view();
      await gp.mouse.move(bp.x, bp.y);
      await gp.mouse.down({ button: "right" });
      await gp.mouse.move(bp.x + 90, bp.y + 10, { steps: 6 });
      await gp.mouse.up({ button: "right" });
      await gp.waitForTimeout(900);
      const v1 = await view();
      G.rightDrag = { menu: await menuOpen(), yaw: Math.abs(v1.yaw - v0.yaw) };
    }
    // Clic gauche glissé : déplacement, sans rotation ni marche.
    const box = await gp.locator("canvas.lp-carte-canvas").boundingBox();
    const cx = Math.round(box.x + box.width * 0.4), cy = Math.round(box.y + box.height * 0.55);
    const l0 = await view();
    await gp.mouse.move(cx, cy);
    await gp.mouse.down();
    await gp.mouse.move(cx + 140, cy + 60, { steps: 8 });
    await gp.mouse.up();
    await gp.waitForTimeout(900);
    const l1 = await view();
    G.leftDrag = { moved: Math.hypot(l1.x - l0.x, l1.z - l0.z), yaw: Math.abs(l1.yaw - l0.yaw), walkTo: await gp.evaluate(() => window.__carteBench.engine.fxState().walkTo) };
    // Molette enfoncée glissée : rotation.
    const m0 = await view();
    await gp.mouse.move(cx, cy);
    await gp.mouse.down({ button: "middle" });
    await gp.mouse.move(cx + 120, cy - 40, { steps: 8 });
    await gp.mouse.up({ button: "middle" });
    await gp.waitForTimeout(900);
    const m1 = await view();
    G.middleDrag = { yaw: Math.abs(m1.yaw - m0.yaw), pitch: Math.abs(m1.pitch - m0.pitch) };
    // « Construire ici » ouvre la fiche de création.
    const bp2 = await gp.evaluate(() => window.__carteBench.engine.buildPoint());
    if (bp2) {
      await gp.mouse.click(bp2.x, bp2.y, { button: "right" });
      await gp.waitForTimeout(700);
      await gp.click(".lp-carte-build button").catch(() => {});
      await gp.waitForTimeout(900);
      G.createModal = await gp.evaluate(() => document.querySelectorAll(".lp-modal").length > 0);
      // La fiche de création ouverte masquerait le ruban : on la referme.
      for (let i = 0; i < 3 && (await gp.$(".lp-modal")); i++) {
        await gp.keyboard.press("Escape").catch(() => {});
        await gp.waitForTimeout(400);
        const c = await gp.$('.lp-modal [aria-label="Fermer"]');
        if (c) await c.click().catch(() => {});
        await gp.waitForTimeout(400);
      }
    }
    // #504 : double clic sur une pastille de dossier : l'arpenteur s'y rend.
    await gp.keyboard.press("Escape").catch(() => {});
    await gp.waitForTimeout(400);
    const k0 = await gp.evaluate(() => window.__carteBench.engine.fxState());
    const badges = await gp.$$(".lp-carte-badge");
    if (badges.length > 1) {
      await badges[1].dblclick({ timeout: 60000 });
      await gp.waitForTimeout(1500);
      const k1 = await gp.evaluate(() => window.__carteBench.engine.fxState());
      G.folderGo = { goal: k1.walkTo, moved: Math.hypot(k1.keeper[0] - k0.keeper[0], k1.keeper[1] - k0.keeper[1]), pop: await gp.$$eval(".lp-carte-folder-pop", (e) => e.length) };
    }
    await shot3d(gp, "carte-gestes.png");
  } catch (e) {
    carte.gestures.error = String(e).split("\n")[0];
  }
  await gp.close();
}

// --- Vue Cosmos (#402) -------------------------------------------------------
// Trois échelles (univers, galaxie, planète), recherche, sélection et
// modification explicite d'une tâche (satellite et compteurs à jour),
// exploration sans écriture, libellés sans chevauchement, univers vide, gros
// volume, écran étroit, repli sans WebGL et tâche de calendrier synchronisé.
const cosmos = {};
try {
  const cosmosOverlaps = () => {
    const boxes = [...document.querySelectorAll(".lp-cosmos-label")].filter((l) => l.classList.contains("is-on")).map((l) => l.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) n++;
    }
    return { n, count: boxes.length };
  };
  const offline = (pg) => pg.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  const closeGuide = async (pg) => {
    for (let i = 0; i < 3; i++) {
      const c = await pg.$('.lp-modal [aria-label="Fermer"]');
      if (!c) break;
      await c.click().catch(() => {});
      await pg.waitForTimeout(300);
    }
  };
  const openCosmos = async (pg, scen) => {
    await pg.goto(`http://127.0.0.1:${port}/index.html?app=1&view=cosmos&cosmos=${scen}`, { waitUntil: "load", timeout: 90000 });
    await pg.waitForSelector(".lp-cosmos-view", { timeout: 90000 });
    await closeGuide(pg);
  };
  const attr = (pg, name) => pg.getAttribute(".lp-cosmos-stage", "data-cosmos-" + name);
  const until = (pg, name, value) => pg.waitForFunction(([n, v]) => { const s = document.querySelector(".lp-cosmos-stage"); return s && s.getAttribute("data-cosmos-" + n) === v; }, [name, value], { timeout: 60000 });
  // Les étiquettes sont projetées par le moteur 3D : elles n'existent qu'une
  // fois la scène dessinée. On attend qu'elle soit affichée avant de cliquer
  // (la stabilité image par image reste vérifiée par Playwright) ; absente,
  // l'échec dit ce qui manque au lieu d'un délai dépassé muet.
  const labelShown = (pg, sel) => pg.waitForFunction((s) => { const el = document.querySelector(s); return !!el && el.classList.contains("is-on"); }, sel, { timeout: 60000 }).catch(async () => {
    const shown = await pg.$$eval(".lp-cosmos-label.is-on", (l) => l.map((x) => x.dataset.cosmosId || x.className)).catch(() => []);
    throw new Error(`étiquette ${sel} non affichée ; étiquettes affichées dans la scène : ${shown.length} ${JSON.stringify(shown.slice(0, 8))}`);
  });
  const tasksNow = (pg) => pg.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  const qp = await page3d({ viewport: { width: 1400, height: 900 } });
  qp.on("pageerror", (e) => pageErrors.push("Cosmos : " + e.message));
  await offline(qp);
  await openCosmos(qp, "demo");
  await qp.waitForSelector('.lp-cosmos-stage[data-cosmos-status="ready"]', { timeout: 60000 });
  await qp.waitForTimeout(2500);
  cosmos.canvas = await qp.$$eval(".lp-cosmos-gl canvas", (c) => c.length);
  cosmos.tab = await qp.$$eval(".lp-detail-tab", (b) => b.some((x) => /Cosmos/.test(x.textContent) && x.classList.contains("active")));
  cosmos.tasksBefore = await tasksNow(qp);
  // Univers : une galaxie par dossier racine, vide comprise, plus « À trier ».
  cosmos.galaxyLabels = await qp.$$eval('.lp-cosmos-label--galaxy', (l) => l.filter((x) => x.classList.contains("is-on")).map((x) => x.querySelector("b").textContent));
  cosmos.overlapsUniverse = await qp.evaluate(cosmosOverlaps);
  await shot3d(qp, "cosmos-univers.png");
  // Clic : sélection ; re-clic : entrée dans la galaxie.
  await labelShown(qp, '.lp-cosmos-label--galaxy[data-cosmos-id="banc-cf1"]');
  await qp.click('.lp-cosmos-label--galaxy[data-cosmos-id="banc-cf1"]');
  await until(qp, "selected", "galaxy:banc-cf1");
  cosmos.summaryTitle = await qp.$eval(".lp-cosmos-panel .lp-cosmos-title", (e) => e.textContent).catch(() => "");
  await qp.waitForTimeout(1500);
  await labelShown(qp, '.lp-cosmos-label--galaxy[data-cosmos-id="banc-cf1"]');
  await qp.click('.lp-cosmos-label--galaxy[data-cosmos-id="banc-cf1"]');
  await until(qp, "level", "galaxy");
  await qp.waitForTimeout(2500);
  cosmos.planetLabels = await qp.$$eval('.lp-cosmos-label--planet', (l) => l.filter((x) => x.classList.contains("is-on")).length);
  cosmos.amas = await qp.$$eval('.lp-cosmos-label--amas', (l) => l.filter((x) => x.classList.contains("is-on")).map((x) => x.textContent));
  cosmos.overlapsGalaxy = await qp.evaluate(cosmosOverlaps);
  // #421 : le soleil-tableau de bord affiche l'avancement du dossier.
  cosmos.sunLabel = await qp.$$eval(".lp-cosmos-label--sun", (l) => l.filter((x) => x.classList.contains("is-on")).map((x) => x.textContent));
  await shot3d(qp, "cosmos-galaxie.png");
  // Planète : double-clic sur le projet.
  await labelShown(qp, '.lp-cosmos-label--planet[data-cosmos-id="banc-cp1"]');
  await qp.dblclick('.lp-cosmos-label--planet[data-cosmos-id="banc-cp1"]');
  await until(qp, "planet", "banc-cp1");
  await qp.waitForTimeout(2500);
  cosmos.taskLabels = await qp.$$eval('.lp-cosmos-label--task', (l) => l.filter((x) => x.classList.contains("is-on")).length);
  cosmos.overlapsPlanet = await qp.evaluate(cosmosOverlaps);
  // #421 : tâche urgente et en retard (variante E) et compteurs de la planète.
  cosmos.flagged = await qp.$eval('.lp-cosmos-label--task[data-cosmos-id="banc-ct7"]', (e) => ({ on: e.classList.contains("is-on"), urgent: e.classList.contains("is-urgent"), late: e.classList.contains("is-late"), text: e.textContent })).catch(() => null);
  cosmos.planetChips = await qp.$eval('.lp-cosmos-label--planet[data-cosmos-id="banc-cp1"]', (e) => e.textContent).catch(() => "");
  await labelShown(qp, '.lp-cosmos-label--task[data-cosmos-id="banc-ct1"]');
  await qp.click('.lp-cosmos-label--task[data-cosmos-id="banc-ct1"]');
  await until(qp, "selected", "task:banc-ct1");
  await qp.waitForSelector(".lp-carte-detail", { timeout: 5000 });
  cosmos.detailTitle = await qp.$eval(".lp-carte-detail-title", (e) => e.textContent).catch(() => "");
  await qp.waitForTimeout(2500);
  await shot3d(qp, "cosmos-planete.png");
  // Explorer (clics, orbites animées, zoom) n'a rien écrit.
  await qp.mouse.move(500, 500); await qp.mouse.wheel(0, 200); await qp.waitForTimeout(800);
  cosmos.tasksAfterExplore = await tasksNow(qp);
  // Échap : fermer la tâche, puis remonter les échelles.
  await qp.focus(".lp-cosmos-stage");
  await qp.keyboard.press("Escape"); await qp.waitForTimeout(400);
  cosmos.escSelected = await attr(qp, "selected");
  await qp.keyboard.press("Escape"); await qp.waitForTimeout(400);
  cosmos.escLevel1 = await attr(qp, "level");
  await qp.keyboard.press("Escape"); await qp.waitForTimeout(400);
  cosmos.escLevel2 = await attr(qp, "level");
  // Recherche : une tâche mène à sa planète et ouvre son volet.
  await qp.fill(".lp-cosmos-search input", "vannes");
  cosmos.suggestions = await qp.$$eval(".lp-cosmos-sugg button", (b) => b.map((x) => x.textContent));
  await qp.press(".lp-cosmos-search input", "Enter");
  await until(qp, "selected", "task:banc-ct1");
  cosmos.searchLevel = await attr(qp, "level");
  await qp.waitForTimeout(1500);
  // Modification explicite : statut « Terminé » dans le volet.
  cosmos.planetBefore = await qp.$eval('.lp-cosmos-label--planet[data-cosmos-id="banc-cp1"] em', (e) => e.textContent).catch(() => "");
  const doneId = await qp.$eval("#lp-carte-st-banc-ct1", (sel) => [...sel.options].find((o) => /termin/i.test(o.textContent)).value);
  await qp.selectOption("#lp-carte-st-banc-ct1", doneId);
  await qp.waitForTimeout(2500);
  cosmos.statusAfter = await qp.evaluate(async () => JSON.parse((await window.storage.get("nexora:tasks")).value).find((t) => t.id === "banc-ct1").statusId);
  cosmos.doneId = doneId;
  cosmos.planetAfter = await qp.$eval('.lp-cosmos-label--planet[data-cosmos-id="banc-cp1"] em', (e) => e.textContent).catch(() => "");
  cosmos.satColor = await qp.$eval('.lp-cosmos-label--task[data-cosmos-id="banc-ct1"] i', (e) => getComputedStyle(e).backgroundColor).catch(() => "");
  // Tâche de calendrier synchronisé : volet en lecture seule.
  await qp.fill(".lp-cosmos-search input", "Toussaint");
  await qp.press(".lp-cosmos-search input", "Enter");
  await until(qp, "selected", "task:banc-csync");
  await qp.waitForTimeout(800);
  cosmos.syncLock = await qp.evaluate(() => ({ text: /calendrier synchronisé/.test((document.querySelector(".lp-carte-detail") || {}).textContent || ""), selects: document.querySelectorAll(".lp-carte-detail select").length }));
  await qp.close();

  // Univers vide.
  const ep = await page3d({ viewport: { width: 1400, height: 900 } });
  ep.on("pageerror", (e) => pageErrors.push("Cosmos vide : " + e.message));
  await offline(ep);
  await openCosmos(ep, "empty");
  await ep.waitForSelector(".lp-cosmos-stage .lp-carte-empty", { timeout: 30000 });
  cosmos.empty = await ep.$eval(".lp-cosmos-stage .lp-carte-empty", (e) => e.textContent);
  await ep.close();

  // Écran étroit : panneau replié, commandes accessibles, sans défilement horizontal.
  const mp = await page3d({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  mp.on("pageerror", (e) => pageErrors.push("Cosmos mobile : " + e.message));
  await offline(mp);
  await openCosmos(mp, "demo");
  const drawerClose = await mp.$(".lp-sidebar-mobile-close");
  if (drawerClose && await drawerClose.isVisible()) { await drawerClose.click(); await mp.waitForTimeout(400); }
  await mp.waitForSelector('.lp-cosmos-stage[data-cosmos-status="ready"]', { timeout: 60000 });
  await mp.waitForTimeout(2000);
  cosmos.mobile = await mp.evaluate(() => ({
    scroll: document.documentElement.scrollWidth - window.innerWidth,
    panelHidden: !document.querySelector(".lp-cosmos-panel") && !!document.querySelector(".lp-cosmos-panel-toggle"),
    rail: !!document.querySelector(".lp-cosmos-rail"),
    crumbs: !!document.querySelector(".lp-cosmos-crumbs"),
  }));
  await shot3d(mp, "cosmos-mobile.png");
  await mp.close();

  // Gros volume : 300 projets, 12 000 tâches.
  const vp = await page3d({ viewport: { width: 1400, height: 900 } });
  vp.on("pageerror", (e) => pageErrors.push("Cosmos volume : " + e.message));
  await offline(vp);
  const t0 = Date.now();
  await openCosmos(vp, "volume");
  await vp.waitForSelector('.lp-cosmos-stage[data-cosmos-status="ready"]', { timeout: 120000 });
  await vp.waitForSelector(".lp-cosmos-quality", { timeout: 120000 });
  cosmos.volumeMs = Date.now() - t0;
  cosmos.volumeQuality = await vp.$eval(".lp-cosmos-quality", (e) => e.textContent);
  await vp.waitForTimeout(2500);
  cosmos.volumeOverlaps = await vp.evaluate(cosmosOverlaps);
  await shot3d(vp, "cosmos-volume.png");
  await labelShown(vp, '.lp-cosmos-label--galaxy[data-cosmos-id="banc-vf0"]');
  await vp.click('.lp-cosmos-label--galaxy[data-cosmos-id="banc-vf0"]');
  await until(vp, "selected", "galaxy:banc-vf0");
  await labelShown(vp, '.lp-cosmos-label--galaxy[data-cosmos-id="banc-vf0"]');
  await vp.click('.lp-cosmos-label--galaxy[data-cosmos-id="banc-vf0"]');
  await until(vp, "level", "galaxy");
  await vp.waitForTimeout(2500);
  cosmos.volumeGalaxyOverlaps = await vp.evaluate(cosmosOverlaps);
  await shot3d(vp, "cosmos-volume-galaxie.png");
  await vp.close();

  // Sans WebGL : liste de repli, fiches accessibles.
  const fp = await page3d({ viewport: { width: 1400, height: 900 } });
  fp.on("pageerror", (e) => pageErrors.push("Cosmos sans WebGL : " + e.message));
  await fp.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); }; });
  await offline(fp);
  await openCosmos(fp, "demo");
  await fp.waitForSelector(".lp-cosmos-fallback", { timeout: 30000 });
  cosmos.fallbackGalaxies = await fp.$$eval(".lp-cosmos-fallback > .lp-carte-fallback-proj", (d) => d.length);
  await fp.click(".lp-cosmos-fallback > .lp-carte-fallback-proj > summary");
  await fp.click(".lp-cosmos-fallback-planet summary");
  await fp.click(".lp-cosmos-fallback-planet .lp-carte-link-inline");
  await fp.waitForTimeout(600);
  cosmos.fallbackModal = await fp.$$eval(".lp-modal", (m) => m.length);
  await fp.close();
} catch (e) {
  cosmos.error = String(e).split("\n").filter((l) => /Timeout|waiting for|Error/.test(l)).slice(0, 3).join(" · ") || String(e).split("\n")[0];
} finally {
  await closeScenarioPages();
}
// --- Vue Réunions 3D (#514) --------------------------------------------------
// Données FICTIVES (`reunions=demo`) : la vue s'ouvre sur la semaine courante,
// le filtre de période et les filtres rapides changent la scène, la synthèse
// concorde avec la légende, un clic sélectionne une réunion et « Ouvrir la
// fiche » comme le double clic ouvrent la fiche ; rien n'est écrit ; repli
// sans WebGL. Les captures ne sont pas des contrôles : sous rendu logiciel,
// l'attente des polices peut expirer sans rien dire de la vue.
const reu = {};
try {
  const reuOffline = (pg) => pg.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  const openReu = async (pg) => {
    await pg.goto(`http://127.0.0.1:${port}/index.html?app=1&view=reunions3d&reunions=demo`, { waitUntil: "load", timeout: 90000 });
    await pg.waitForSelector(".lp-reu-view", { timeout: 90000 });
    for (let i = 0; i < 3; i++) { const c = await pg.$('.lp-modal [aria-label="Fermer"]'); if (!c) break; await c.click().catch(() => {}); await pg.waitForTimeout(300); }
  };
  const ds = (pg) => pg.evaluate(() => ({ ...document.querySelector(".lp-reu-stage").dataset }));
  const hud = (pg) => pg.evaluate(() => ({
    count: (document.querySelector(".lp-reu-count b") || {}).textContent,
    quick: Object.fromEntries([...document.querySelectorAll(".lp-reu-quick [data-reu-quick]")].map((b) => [b.dataset.reuQuick, Number(b.querySelector(".lp-reu-n").textContent)])),
    projects: [...document.querySelectorAll(".lp-reu-legend button.lp-reu-it b")].reduce((n, b) => n + Number(b.textContent), 0),
    states: Object.fromEntries([...document.querySelectorAll(".lp-reu-legend .lp-reu-ic")].map((i) => [i.className.replace(/.*is-/, ""), Number(((i.parentNode.querySelector("b") || {}).textContent) || 0)])),
  }));
  const tasksNow = (pg) => pg.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  // Rendu logiciel lent : on attend que la caméra (zoom doux) soit arrivée.
  const settle = (pg) => pg.waitForFunction(() => window.__reu3dBench && window.__reu3dBench.engine && window.__reu3dBench.engine.settled(), null, { timeout: 60000, polling: 250 });
  const rp = await page3d({ viewport: { width: 1400, height: 900 } });
  rp.on("pageerror", (e) => pageErrors.push("Réunions 3D : " + e.message));
  await reuOffline(rp);
  await openReu(rp);
  await rp.waitForSelector('.lp-reu-stage[data-reu-status="ready"]', { timeout: 60000 });
  await rp.waitForTimeout(2500);
  reu.canvas = await rp.$$eval(".lp-reu-gl canvas", (c) => c.length);
  reu.tab = await rp.$$eval(".lp-detail-tab", (b) => b.some((x) => /Réunions 3D/.test(x.textContent) && x.classList.contains("active")));
  reu.tasksBefore = await tasksNow(rp);
  reu.week = await ds(rp);
  reu.weekHud = await hud(rp);
  reu.engine = await rp.evaluate(() => (window.__reu3dBench && window.__reu3dBench.engine ? window.__reu3dBench.engine.info() : null));
  await shot3d(rp, "reunions-semaine.png"); // capture seule, pas un contrôle
  // Filtre de période : Mois, mois précédent, retour à la période courante.
  await rp.click('.lp-reu-seg button:has-text("Mois")');
  await rp.waitForFunction(() => document.querySelector(".lp-reu-stage").dataset.reuKind === "month", null, { timeout: 60000 });
  await settle(rp);
  reu.month = await ds(rp);
  reu.monthHud = await hud(rp);
  await shot3d(rp, "reunions-mois.png"); // capture seule, pas un contrôle
  // Attentes explicites : la période affichée a changé, puis la caméra s'est
  // posée (sous rendu logiciel, une image dure jusqu'à 3,6 s pendant le
  // déplacement, ce qui faisait expirer le clic suivant). Délai dépassé : on
  // lit quand même, le contrôle juge la valeur.
  const periodIs = (pred, ref) => rp.waitForFunction(([p, r]) => { const v = document.querySelector(".lp-reu-stage").dataset.reuPeriod; return p === "differs" ? v !== r : v === r; }, [pred, ref], { timeout: 60000 }).catch(() => {});
  await rp.click('.lp-reu-nav button[aria-label="Mois précédent"]');
  await periodIs("differs", reu.month.reuPeriod);
  await settle(rp);
  reu.prevMonth = (await ds(rp)).reuPeriod;
  await rp.click(".lp-reu-cur");
  await periodIs("equals", reu.month.reuPeriod);
  await settle(rp);
  reu.backMonth = (await ds(rp)).reuPeriod;
  reu.prefs = await rp.evaluate(async () => { try { return JSON.parse((await window.storage.get("nexora:viewPrefs")).value).reunions3d; } catch (e) { return null; } });
  // Filtre rapide « Sans compte rendu » : la scène ne garde que ces pupitres.
  await rp.click('.lp-reu-quick [data-reu-quick="noreport"]');
  await rp.waitForFunction(() => document.querySelector(".lp-reu-stage").dataset.reuQuick === "noreport", null, { timeout: 60000 }).catch(() => {});
  await settle(rp);
  reu.noreport = { ...(await ds(rp)), button: (await hud(rp)).quick.noreport, pupitres: await rp.evaluate(() => window.__reu3dBench.engine.info().pupitres) };
  await rp.click('.lp-reu-quick [data-reu-quick="all"]');
  await rp.click('.lp-reu-seg button:has-text("Semaine")');
  await rp.waitForFunction(() => document.querySelector(".lp-reu-stage").dataset.reuKind === "week", null, { timeout: 60000 });
  await settle(rp);
  // Clic : sélection, zoom et volet ; « Ouvrir la fiche » ouvre la fiche.
  const at = await rp.evaluate(() => window.__reu3dBench.engine.screenOf("banc-r-d1"));
  await rp.mouse.move(at.x, at.y);
  await rp.waitForTimeout(600);
  reu.tip = await rp.$eval(".lp-reu-tip", (e) => (e.hidden ? "" : e.textContent)).catch(() => "");
  await rp.mouse.click(at.x, at.y);
  await rp.waitForFunction(() => document.querySelector(".lp-reu-stage").dataset.reuSelected === "banc-r-d1", null, { timeout: 60000 });
  await settle(rp);
  reu.detail = await rp.$eval(".lp-reu-detail h3", (e) => e.textContent).catch(() => "");
  reu.zoom = await rp.evaluate(() => { const i = window.__reu3dBench.engine.info(); return i.dist / i.baseDist; });
  await shot3d(rp, "reunions-selection.png"); // capture seule, pas un contrôle
  await rp.click(".lp-reu-open");
  await rp.waitForTimeout(800);
  reu.modalButton = await rp.$$eval(".lp-modal", (m) => m.length);
  for (let i = 0; i < 3; i++) { await rp.keyboard.press("Escape"); await rp.waitForTimeout(300); if (!(await rp.$(".lp-modal"))) break; }
  for (let i = 0; i < 3; i++) { const c = await rp.$('.lp-modal [aria-label="Fermer"]'); if (!c) break; await c.click().catch(() => {}); await rp.waitForTimeout(300); }
  reu.modalClosed = await rp.$$eval(".lp-modal", (m) => m.length);
  // Échap : retour à la vue d'ensemble, puis double clic sur une autre réunion.
  await rp.focus(".lp-reu-stage");
  await rp.keyboard.press("Escape");
  await rp.waitForFunction(() => document.querySelector(".lp-reu-stage").dataset.reuSelected === "", null, { timeout: 60000 });
  await settle(rp);
  const at2 = await rp.evaluate(() => window.__reu3dBench.engine.screenOf("banc-r-d3"));
  await rp.mouse.dblclick(at2.x, at2.y);
  await rp.waitForTimeout(800);
  reu.modalDbl = await rp.$$eval(".lp-modal", (m) => m.length);
  reu.tasksAfter = await tasksNow(rp);
  await rp.close();

  // Sans WebGL : les mêmes gradins en liste, chaque réunion ouvre sa fiche.
  const fp = await page3d({ viewport: { width: 1400, height: 900 } });
  fp.on("pageerror", (e) => pageErrors.push("Réunions 3D sans WebGL : " + e.message));
  await fp.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); }; });
  await reuOffline(fp);
  await openReu(fp);
  await fp.waitForSelector(".lp-reu-fallback", { timeout: 30000 });
  reu.fallbackItems = await fp.$$eval(".lp-reu-fallback li button", (b) => b.length);
  await fp.click(".lp-reu-fallback li button");
  await fp.waitForTimeout(600);
  reu.fallbackModal = await fp.$$eval(".lp-modal", (m) => m.length);
  await fp.close();
} catch (e) {
  reu.error = String(e).split("\n").filter((l) => /Timeout|waiting for|Error/.test(l)).slice(0, 3).join(" · ") || String(e).split("\n")[0];
} finally {
  await closeScenarioPages();
}

// Vue « Fleuve du temps » (#515) : la vue s'ouvre, la date visée change
// (boutons, frise, molette), les bateaux, épaves, portiques et cordes sont là,
// un double clic sur un bateau ouvre la fiche ; explorer ne modifie rien.
// Rendu logiciel lent : « réduire les animations » rend la navigation
// immédiate, et les captures passent par le protocole du navigateur.
const fleuve = {};
try {
  const fleuveShot = shot3d;
  const offlineFleuve = (pg) => pg.route("**/*", (route) => { const url = route.request().url(); if (url.startsWith(`http://127.0.0.1:${port}`) || url.startsWith("data:") || url.startsWith("blob:")) return route.continue(); return route.fulfill({ status: 200, contentType: "image/png", body: TRANSPARENT_PNG }); });
  const openFleuve = async (pg) => {
    await pg.goto(`http://127.0.0.1:${port}/index.html?app=1&view=fleuve&fleuve=demo&fleuveQ=low`, { waitUntil: "load", timeout: 90000 });
    await pg.waitForSelector(".lp-fleuve-view", { timeout: 90000 });
    for (let i = 0; i < 3; i++) { const c = await pg.$('.lp-modal [aria-label="Fermer"]'); if (!c) break; await c.click().catch(() => {}); await pg.waitForTimeout(300); }
  };
  const fattr = (pg, name) => pg.getAttribute(".lp-fleuve-stage", "data-fleuve-" + name);
  const dayIs = (pg, min, max) => pg.waitForFunction(([lo, hi]) => { const s = document.querySelector(".lp-fleuve-stage"); const d = s ? +s.getAttribute("data-fleuve-day") : NaN; return d >= lo && d <= hi; }, [min, max == null ? 1e9 : max], { timeout: 30000 });
  const fp = await page3d({ viewport: { width: 1400, height: 900 } });
  fp.on("pageerror", (e) => pageErrors.push("Fleuve : " + e.message));
  await fp.emulateMedia({ reducedMotion: "reduce" });
  await offlineFleuve(fp);
  await openFleuve(fp);
  await fp.waitForSelector('.lp-fleuve-stage[data-fleuve-status="ready"]', { timeout: 120000 });
  await fp.waitForTimeout(2500);
  fleuve.tab = await fp.$$eval(".lp-detail-tab", (b) => b.some((x) => /Fleuve du temps/.test(x.textContent) && x.classList.contains("active")));
  fleuve.canvas = await fp.$$eval(".lp-fleuve-gl canvas", (c) => c.length);
  fleuve.state = await fp.evaluate(() => window.__fleuveBench.engine.state());
  fleuve.counter = await fp.$eval(".lp-fleuve-counter", (e) => e.textContent);
  fleuve.dayStart = await fattr(fp, "day");
  fleuve.dateStart = await fp.$eval(".lp-fleuve-date b", (e) => e.textContent);
  fleuve.tasksBefore = await fp.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  await fleuveShot(fp, "fleuve.png");
  // Deux semaines vers l'amont : la date visée passe en S+2.
  const next = await fp.$('.lp-fleuve-btn[title="Semaine suivante"]');
  await next.click(); await next.click();
  await dayIs(fp, 11);
  fleuve.dayWeek = await fattr(fp, "day");
  fleuve.dateWeek = await fp.$eval(".lp-fleuve-date b", (e) => e.textContent);
  fleuve.litWeek = (await fp.evaluate(() => window.__fleuveBench.engine.state())).lit;
  // « Aujourd'hui », puis la frise (clic aux trois quarts), puis la molette.
  await fp.click(".lp-fleuve-btn.is-gold");
  await dayIs(fp, 0, 0);
  const fr = await fp.$eval(".lp-fleuve-frise", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.75, y: r.top + r.height / 2 }; });
  await fp.mouse.click(fr.x, fr.y);
  await dayIs(fp, 25);
  fleuve.dayFrise = await fattr(fp, "day");
  fleuve.litFrise = (await fp.evaluate(() => window.__fleuveBench.engine.state())).lit;
  await fp.click(".lp-fleuve-btn.is-gold");
  await dayIs(fp, 0, 0);
  const box = await fp.$eval(".lp-fleuve-gl canvas", (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.45 }; });
  await fp.mouse.move(box.x, box.y);
  for (let i = 0; i < 5; i++) { await fp.mouse.wheel(0, 250); await fp.waitForTimeout(150); }
  await dayIs(fp, 3);
  fleuve.dayWheel = await fattr(fp, "day");
  // Double clic sur un bateau à l'écran : sélection et fiche Nexora.
  const target = await fp.evaluate(() => {
    const e = window.__fleuveBench.engine, c = document.querySelector(".lp-fleuve-gl canvas").getBoundingClientRect();
    for (const id of e.boatIds()) {
      const p = e.screenOf(id);
      if (!p || p.x < c.left + c.width * 0.2 || p.x > c.right - c.width * 0.2 || p.y < c.top + c.height * 0.25 || p.y > c.bottom - c.height * 0.25) continue;
      const el = document.elementFromPoint(p.x, p.y);
      if (el && el.tagName === "CANVAS") return { id, x: p.x, y: p.y };
    }
    return null;
  });
  fleuve.target = target;
  if (target) {
    await fp.mouse.dblclick(target.x, target.y);
    await fp.waitForSelector(".lp-modal", { timeout: 10000 }).catch(() => {});
    fleuve.fiche = await fp.evaluate((id) => {
      const m = document.querySelector(".lp-modal"); if (!m) return null;
      return { text: m.textContent.slice(0, 400), inputs: [...m.querySelectorAll("input")].map((i) => i.value).filter(Boolean).slice(0, 5) };
    }, target.id);
    fleuve.expectedTitle = JSON.parse(fleuve.tasksBefore).find((t) => t.id === target.id).title;
    fleuve.selected = await fattr(fp, "selected");
    for (let i = 0; i < 3; i++) { const c = await fp.$('.lp-modal [aria-label="Fermer"]'); if (!c) break; await c.click().catch(() => {}); await fp.waitForTimeout(400); }
    fleuve.detailTitle = await fp.$eval(".lp-carte-detail-title", (e) => e.textContent).catch(() => "");
  }
  fleuve.tasksAfter = await fp.evaluate(async () => (await window.storage.get("nexora:tasks")).value);
  await fleuveShot(fp, "fleuve-selection.png");
  await fp.close();

  // Sans WebGL : la liste de repli, semaine par semaine, ouvre la fiche.
  const fb = await page3d({ viewport: { width: 1400, height: 900 } });
  fb.on("pageerror", (e) => pageErrors.push("Fleuve sans WebGL : " + e.message));
  await fb.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { return /webgl/.test(type) ? null : orig.call(this, type, ...rest); }; });
  await offlineFleuve(fb);
  await openFleuve(fb);
  await fb.waitForSelector(".lp-fleuve-fallback", { timeout: 30000 });
  fleuve.fallbackWeeks = await fb.$$eval(".lp-fleuve-fallback details", (d) => d.length);
  await fb.click(".lp-fleuve-fallback details[open] li button");
  await fb.waitForTimeout(600);
  fleuve.fallbackModal = await fb.$$eval(".lp-modal", (m) => m.length);
  await fb.close();
} catch (e) {
  fleuve.error = String(e).split("\n").filter((l) => /Timeout|waiting for|Error/.test(l)).slice(0, 3).join(" · ");
} finally {
  await closeScenarioPages();
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
// La barre se replie (flex-wrap) : depuis le sélecteur de référence (#165),
// les annotations passent à la ligne dans un widget de 700 px. Ce qui reste
// interdit, c'est l'empilement en COLONNE : deux bandes au plus, et la
// première porte l'essentiel des commandes (#298).
expect(seen.toolbarRows <= 2 && seen.toolbarFirstRow >= 4,
  `Barre d'outils : les commandes sont empilées au lieu d'être côte à côte (${seen.toolbarRows} bande(s), sommets à ${seen.toolbarTops.join("/")} px, ${seen.toolbarFirstRow} sur la première)`);
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
// Sept axes depuis l'ajout de « Équipe » (catalogue Équipes, #159).
expect(heatmap.axisOptions === 7, `Heat map : ${heatmap.axisOptions} champ(s) d'axe dans la fiche, 7 attendus`);
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

// Rail des vues (#65) : contrôles retirés avec le rail lui-même (#259,
// suppression du bandeau latéral) — le banc montait encore son balisage sans
// plus aucune feuille de style derrière (#298).

expect(!mois.error, `contrôle de la heat map mensuelle interrompu : ${mois.error}`);
expect(mois.large && mois.large.blocs === 3, `Heat map mensuelle : ${mois.large && mois.large.blocs} mois rendus, 3 attendus`);
// Depuis #286, le widget est découpé en trois volets (calendrier | liste |
// détail) : même large, le calendrier n'a plus qu'un volet, et ses mois
// peuvent légitimement passer sur deux lignes. Ce qui compte : ils tiennent
// dans ce volet (débordement et défilement contrôlés plus bas).
expect(mois.large && mois.large.lignes >= 1 && mois.large.lignes <= 2, `Heat map mensuelle large : les mois occupent ${mois.large && mois.large.lignes} ligne(s), 1 ou 2 attendues`);
// Étroit, les volets s'empilent (#298) : le calendrier retrouve toute la
// largeur du widget et range deux mois par ligne, ou un seul.
expect(mois.etroit && mois.etroit.lignes >= 2, `Heat map mensuelle étroite : les mois occupent ${mois.etroit && mois.etroit.lignes} ligne(s), au moins 2 attendues — ils doivent passer les uns sous les autres`);
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
  expect(orgMetro.stations === 22, `Organigramme Métro : ${orgMetro.stations} station(s), 22 attendues (20 personnes + 1 occurrence multi-équipe + la responsable d'Applications en tête de sa ligne)`);
  expect(orgMetro.duplicates === 2, `Organigramme Métro : ${orgMetro.duplicates} occurrence(s) supplémentaire(s), 2 attendues (Sacha Morin dans Données, Nora Vidal en tête d'Applications)`);
  expect(orgMetro.junctions >= 3, `Organigramme Métro : ${orgMetro.junctions} point(s) de bifurcation, au moins 3 attendus`);
  expect(orgMetro.transverse === 2, `Organigramme Métro : ${orgMetro.transverse} correspondance(s) transverse(s), 2 attendues (lien principal de Données + lien secondaire vers Opérations)`);
  expect(orgMetro.secondary.length === 2 && orgMetro.secondary.some((c) => /226, 166, 59|e2a63b/i.test(c)) && orgMetro.secondary.some((c) => /44, 107, 224|2c6be0/i.test(c)), `Organigramme Métro : parent secondaire (Exploration → Données) et rattachement de Laboratoire à Sacha Morin (Applications) ${JSON.stringify(orgMetro.secondary)}, deux traits pleins attendus, couleurs Exploration et Applications`);
  expect(orgMetro.secondaryWhenHidden === 2, "Organigramme Métro : le parent secondaire disparaît quand on masque les correspondances");
  expect(orgMetro.occurrenceTarget && orgMetro.occurrenceTarget.nearApps, `Organigramme Métro : la relation « Astreinte » ne vise pas l'occurrence de Sacha Morin dans Applications (${JSON.stringify(orgMetro.occurrenceTarget)})`);
  expect(orgMetro.leadBadgeSubs > 0 && orgMetro.leadBadgeStationsGone === orgMetro.leadBadgeSubs, `Organigramme Métro, variante ★ : ${orgMetro.leadBadgeSubs} responsables dans les bandeaux, ${orgMetro.leadBadgeStationsGone} stations retirées`);
  expect(orgMetro.leadBadgeOverlaps === 0, `Organigramme Métro, variante ★ : ${orgMetro.leadBadgeOverlaps} chevauchements bandeau/libellé`);
  expect(orgMetro.cursors && orgMetro.cursors.every((c) => c === "move"), `Organigramme Métro : curseur des éléments déplaçables ${JSON.stringify(orgMetro.cursors)}, « move » attendu`);
  expect(orgMetro.independent >= 2, `Organigramme Métro : ${orgMetro.independent} ligne(s) indépendante(s), 2 attendues (transverse + sans équipe)`);
  // Responsables : toujours la première station de leur ligne — Nora Vidal
  // dirige Applications sans en être membre, elle y figure quand même.
  expect(orgMetro.leadHalos === 8, `Organigramme Métro : ${orgMetro.leadHalos} halo(s) de responsable, 8 attendus`);
  expect(orgMetro.leadStars === 9, `Organigramme Métro : ${orgMetro.leadStars} étoile(s) de responsable, 9 attendues`);
  expect(orgMetro.badgeLeads.length === 0, `Organigramme Métro : rappel « Resp. » encore dans un bandeau ${JSON.stringify(orgMetro.badgeLeads)}`);
  expect(/^Nora Vidal/.test(orgMetro.appsFirstStation || ""), `Organigramme Métro : la première station d'Applications est « ${orgMetro.appsFirstStation} », sa responsable Nora Vidal attendue`);
  expect(orgMetro.overlaps.length === 0, `Organigramme Métro : libellés qui se chevauchent dans le rendu réel — ${orgMetro.overlaps.slice(0, 5).join(" ; ")}`);
  expect(orgMetro.fitScale > 0 && orgMetro.fitScale <= 1, `Organigramme Métro : échelle d'ajustement ${orgMetro.fitScale}`);
  expect(orgMetro.zoomedScale > orgMetro.fitScale, `Organigramme Métro : le zoom avant ne grossit pas (${orgMetro.fitScale} → ${orgMetro.zoomedScale})`);
  expect(Math.abs(orgMetro.refitScale - orgMetro.fitScale) < 0.001, `Organigramme Métro : « Ajuster » ne revient pas à l'échelle d'origine (${orgMetro.refitScale})`);
  expect(orgMetro.panned, "Organigramme Métro : glisser le plan ne le déplace pas");
  expect(orgMetro.transverseHidden === 0, "Organigramme Métro : les correspondances restent visibles une fois masquées");
  expect(orgMetro.hoverDimmed > 0, "Organigramme Métro : le survol ne met pas les relations en évidence");
  expect(orgMetro.hoverOccurrence === 1, `Organigramme Métro : ${orgMetro.hoverOccurrence} liaison(s) entre les occurrences d'une personne multi-équipe au survol, 1 attendue`);
  expect(/Emma Roux/.test(orgMetro.memberModal || ""), `Organigramme Métro : le clic sur une station n'ouvre pas la fiche utilisateur (${orgMetro.memberModal})`);
  expect(/Architecte cloud/.test(orgMetro.roleSaved || ""), `Fiche équipe : le poste saisi au clic sur le membre n'est pas enregistré (${orgMetro.roleSaved})`);
  expect(/Architecte cloud/.test(orgMetro.roleAfterEscape || "") && !/Ne pas garder/.test(orgMetro.roleAfterEscape || ""), `Fiche équipe : Échap n'annule pas la modification du poste (${orgMetro.roleAfterEscape})`);
  expect(orgMetro.modalStillOpen === 1, "Fiche équipe : Échap dans le champ du poste a fermé toute la fiche");
  expect(orgMetro.collapsedBadge === 1 && orgMetro.collapsedStations > 0 && orgMetro.collapsedLeadKept >= 1 && orgMetro.collapsedHidden === 0 && orgMetro.collapsedModal === 0, `Organigramme Métro : le clic simple ne replie pas la ligne en gardant le responsable (${JSON.stringify({ b: orgMetro.collapsedBadge, s: orgMetro.collapsedStations, l: orgMetro.collapsedLeadKept, h: orgMetro.collapsedHidden, m: orgMetro.collapsedModal })})`);
  expect(orgMetro.expandedStations === 0, `Organigramme Métro : le second clic ne déplie pas la ligne (${orgMetro.expandedStations})`);
  expect(orgMetro.memberTeamsClosed === 0 && orgMetro.memberTeamsLooseBoxes === 0 && orgMetro.memberTeamsBulk === 0, `Fiche utilisateur : les équipes doivent être dans une liste déroulante fermée par défaut (${JSON.stringify({ c: orgMetro.memberTeamsClosed, l: orgMetro.memberTeamsLooseBoxes, b: orgMetro.memberTeamsBulk })})`);
  expect(orgMetro.memberTeamsFiltered.length === 1 && /Plateforme/.test(orgMetro.memberTeamsFiltered[0]), `Fiche utilisateur : la recherche d'équipe ne filtre pas (${JSON.stringify(orgMetro.memberTeamsFiltered)})`);
  expect(orgMetro.memberInactiveBox === 0, "Fiche utilisateur : la case « Utilisateur inactif » doit être passée dans les paramètres du widget");
  expect(/Plateforme/.test(orgMetro.teamModal || ""), `Organigramme Métro : le double-clic sur un bandeau n'ouvre pas la fiche équipe (${orgMetro.teamModal})`);
  expect(orgMetro.relations === 4, `Organigramme Métro : ${orgMetro.relations} relation(s) du widget, 4 attendues`);
  expect(JSON.stringify([...orgMetro.relationLabels].sort()) === JSON.stringify(["Astreinte", "Binôme", "Support"]), `Organigramme Métro : légendes de relation ${JSON.stringify(orgMetro.relationLabels)}`);
  expect(orgMetro.inactiveStations.length === 1 && /Jules Brun/.test(orgMetro.inactiveStations[0]), `Organigramme Métro : stations inactives ${JSON.stringify(orgMetro.inactiveStations)}, « Jules Brun » attendu`);
  expect(orgMetro.managerOnLine !== null && orgMetro.managerOnLine < 1, `Organigramme Métro : le manager Nora Vidal n'est pas resté sur la ligne de son équipe (écart ${orgMetro.managerOnLine}px)`);
  expect(orgMetro.countOffsets.every((d) => d <= 1.5), `Organigramme Métro : chiffre décentré dans sa pastille (${orgMetro.countOffsets.map((d) => d.toFixed(1)).join(", ")} px)`);
  expect(orgMetro.leadTitleMetro, "Titre du responsable : « Responsable de lot » absent sous Zoé Faure dans le Métro");
  expect(orgMetro.dropMarker === 1, `Déplacement libre : grille ${orgMetro.dropMarker === 1 ? "affichée" : "absente"} pendant le geste`);
  expect(orgMetro.dragModal === 0, "Glisser-déposer : lâcher un bandeau a ouvert la fiche équipe");
  expect(orgMetro.afterDrag, "Déplacement libre : « Opérations » déposée à gauche de « Produit » n'y est pas");
  expect(orgMetro.overlapsAfterDrag === 0, `Déplacement libre : ${orgMetro.overlapsAfterDrag} superposition(s) de texte après le lâcher`);
  expect(orgMetro.stationDragMoved, "Déplacement libre : attraper une station ne déplace pas sa ligne d'équipe");
  expect(orgMetro.stationDragModal === 0, "Déplacement libre : lâcher une station a ouvert une fiche");
  expect(orgMetro.hubMovedAlone, "Déplacement libre : le grand titre ne se déplace pas seul");
  expect(orgMetro.linkMoved, "Déplacement libre : la relation « Binôme » ne se déplace pas");
  expect(orgMetro.portDraggable > 0 && orgMetro.portMoved, `Organigramme Métro : point de connexion déplaçable (${orgMetro.portDraggable}), déplacé : ${orgMetro.portMoved}`);
  expect(orgMetro.upMove && orgMetro.upMove.above && orgMetro.upMove.sideEntry, `Déplacement libre : « Cœur produit » ne remonte pas au-dessus de sa barre avec un lien par le flanc (${JSON.stringify(orgMetro.upMove)})`);
  expect(orgMetro.overlapsAfterUp === 0, `Déplacement libre : ${orgMetro.overlapsAfterUp} superposition(s) de texte après la remontée`);
  expect(Math.abs(orgMetro.forkDrag.tech) < 2 && orgMetro.forkDrag.plat > 30 && Math.abs(orgMetro.forkDrag.plat - orgMetro.forkDrag.apps) < 2, `Organigramme Métro : le nœud de bifurcation ne déplace pas ses lignes (${JSON.stringify(orgMetro.forkDrag)})`);
  expect(orgMetro.forkJog, "Organigramme Métro : le tronc ne rejoint pas le nœud déplacé sur le côté");
  expect(orgMetro.overlapsAfterFork === 0, `Organigramme Métro : ${orgMetro.overlapsAfterFork} texte(s) superposé(s) après déplacement du nœud`);
  expect(orgMetro.horizontalRow === 1 && orgMetro.horizontalSameY, `Organigramme Métro : l'équipe Opérations n'est pas en disposition horizontale (${orgMetro.horizontalRow}, ${orgMetro.horizontalSameY})`);
  expect(orgMetro.afterReset, "Recentrer : l'ordre par défaut des lignes n'est pas rétabli");
  expect(orgMetro.modeButtons === 0 && orgMetro.hierarchyPanels === 0, `Organigramme : la vue hiérarchique n'a pas été retirée (${orgMetro.modeButtons} bouton(s) de mode, ${orgMetro.hierarchyPanels} élément(s) hiérarchique(s))`);
  expect(JSON.stringify(orgMetro.layoutSummaries) === JSON.stringify(["3 équipes à la verticale", "Aucune équipe"]), `Disposition des équipes : listes ${JSON.stringify(orgMetro.layoutSummaries)} — une équipe cochée en verticale doit quitter l'horizontale`);
  expect(orgMetro.produitStacked && orgMetro.produitStacked.stacked && orgMetro.produitStacked.right, `Disposition des équipes : « Produit » en verticale n'empile pas ses sous-équipes après enregistrement (${JSON.stringify(orgMetro.produitStacked)})`);
  expect(JSON.stringify(orgMetro.viewsListed) === JSON.stringify(["Revue"]) && orgMetro.viewResetCollapsed === 0 && orgMetro.viewReloaded === 1, `Vues enregistrées : enregistrer / recharger ne rétablit pas la disposition (${JSON.stringify({ l: orgMetro.viewsListed, r: orgMetro.viewResetCollapsed, v: orgMetro.viewReloaded })})`);
  expect(orgMetro.elbowMoved && orgMetro.elbowMoved.changed && orgMetro.elbowMoved.badgeStill, `Équipe empilée : le trait horizontal d'Applications ne se déplace pas seul en hauteur (${JSON.stringify(orgMetro.elbowMoved)})`);
  expect(orgMetro.splitHandles >= 1 && orgMetro.split && orgMetro.split.platAbove && orgMetro.split.appsBelow, `Équipe empilée : glisser la ligne de « Technique » ne répartit pas ses sous-équipes au-dessus / au-dessous (${orgMetro.splitHandles}, ${JSON.stringify(orgMetro.split)})`);
  expect(orgMetro.stacked && orgMetro.stacked.below && orgMetro.stacked.rightOfTrunk, `Organigramme Métro : les sous-équipes de « Technique » ne sont pas empilées à droite (${JSON.stringify(orgMetro.stacked)})`);
  expect(orgMetro.narrow && orgMetro.narrow.scale >= 0.6, `Organigramme Métro étroit : zoom d'ouverture ${orgMetro.narrow && orgMetro.narrow.scale}, au moins 0,6 attendu pour rester lisible`);
  expect(orgMetro.narrow && orgMetro.narrow.legendHidden, "Organigramme Métro étroit : la légende reste affichée dans un widget de 380 px");
  expect(orgMetro.narrow && !orgMetro.narrow.exportLabelHidden, "Organigramme Métro étroit : les libellés SVG/PNG ont disparu alors qu'ils tiennent à 380 px");
  expect(orgMetro.narrow && orgMetro.narrow.inside && orgMetro.narrow.scroll <= 0, `Organigramme Métro étroit : barre d'outils hors cadre ou défilement horizontal (${JSON.stringify(orgMetro.narrow)})`);
}

// --- Vue Carte (#361) ------------------------------------------------------
expect(!carte.error, `Carte : scénario en échec (${carte.error})`);
// Mode focus (#512) : jugé dès que le parcours l'a mesuré, même si une capture
// ultérieure échoue (polices indisponibles hors ligne).
if (carte.focus || !carte.error) expect(carte.focus && carte.focus.halo === 2 && carte.focus.count === 2 && carte.focus.shown === 2 && carte.focus.pressed === "true" && carte.focus.haloFiltered === 2 && carte.focus.back === carte.quick.all, `Carte (#512) : le mode focus (halo et filtre rapide) ne suit pas les deux tâches en focus du jeu de démo (${JSON.stringify(carte.focus)})`);
// Gestes de la Carte (#503, #510) : jugés même si le parcours principal échoue.
{
  const G = carte.gestures || {};
  expect(!G.error, `Carte (gestes) : ${G.error}`);
  expect(G.point, "Carte (#503) : aucune parcelle libre visible pour tester le clic droit");
  if (G.point) {
    expect(G.rightMenu && /Construire ici/.test(G.rightMenuText || ""), "Carte (#503) : un vrai clic droit sur une parcelle libre n'ouvre pas « Construire ici »");
    expect(!G.afterEscape, "Carte (#503) : Échap ne ferme pas le menu « Construire ici »");
    expect(G.ctxOnlyMenu, "Carte (#503) : un contextmenu seul (Ctrl + clic sur Mac, touche Menu) n'ouvre pas « Construire ici »");
    expect(G.rightDrag && !G.rightDrag.menu && G.rightDrag.yaw > 0.05, `Carte (#510) : le clic droit glissé doit tourner sans ouvrir le menu (${JSON.stringify(G.rightDrag)})`);
    expect(G.createModal, "Carte (#503) : « Construire ici » n'ouvre pas la fiche de création");
  }
  expect(G.leftDrag && G.leftDrag.moved > 0.5 && G.leftDrag.yaw < 0.01 && !G.leftDrag.walkTo, `Carte (#510) : le clic gauche glissé doit déplacer la carte sans tourner ni marcher (${JSON.stringify(G.leftDrag)})`);
  expect(!G.folderGo || ((G.folderGo.goal || G.folderGo.moved > 1) && G.folderGo.pop === 0), `Carte (#504) : le double clic sur une pastille de dossier n'y emmène pas l'arpenteur (${JSON.stringify(G.folderGo)})`);
  expect(G.middleDrag && G.middleDrag.yaw > 0.05, `Carte (#510) : la molette enfoncée glissée doit faire tourner la caméra (${JSON.stringify(G.middleDrag)})`);
}
if (!carte.error) {
  expect(carte.canvas === 1, `Carte : ${carte.canvas} canevas 3D (1 attendu)`);
  expect(carte.badges >= 1 && carte.badges < 7, `Carte : ${carte.badges} pastilles dans le ruban (une par dossier attendue, moins que les 7 projets)`);
  expect(carte.folderPop && carte.folderPop.open && carte.folderPop.projects >= 1 && carte.folderPop.total === 7, `Carte : le survol d'une pastille de dossier ne déroule pas ses projets (${JSON.stringify(carte.folderPop)})`);
  expect(carte.folderPopClosed === 0, "Carte : le menu du dossier reste ouvert après le survol");
  expect(carte.groupBy && carte.groupBy.assignee.group === "assignee" && carte.groupBy.assignee.ribbon === "Responsables" && carte.groupBy.assignee.badges.length >= 2 && carte.groupBy.terr >= 1 && carte.groupBy.back.group === "folder" && carte.groupBy.back.ribbon === "Dossiers" && carte.groupBy.backTerr === carte.simplify.off, `Carte : le regroupement par responsable ne fonctionne pas (${JSON.stringify(carte.groupBy)})`);
  expect(carte.simplify && carte.simplify.on >= 1 && carte.simplify.on < carte.simplify.before && carte.simplify.off === carte.simplify.before, `Carte : la carte simplifiée ne retire pas les projets écartés (${JSON.stringify(carte.simplify)})`);
  expect(carte.projectLabels >= 1, "Carte : aucun nom de totem près de l'arpenteur (#410)");
  expect(carte.projectLabelsFar <= 1, `Carte : ${carte.projectLabelsFar} noms de totems en vue d'ensemble, 1 au plus attendu (#410)`);
  expect(carte.suggestions.some((t) => /Passerelle/.test(t)), `Carte : la recherche « Passerelle » ne propose pas le projet (${JSON.stringify(carte.suggestions)})`);
  expect(carte.territory === "banc-p4", `Carte : la recherche ne mène pas au territoire « Passerelle quai Nord » (${carte.territory})`);
  expect(carte.panelPick && carte.panelSelected.indexOf(carte.panelPick.replace(/^◆ /, "")) !== -1, `Carte : choisir « ${carte.panelPick} » dans le panneau n'ouvre pas son détail (« ${carte.panelSelected} »)`);
  expect(!!carte.near, "Carte : l'arpenteur n'est pas arrivé près de la tâche choisie");
  expect(carte.selected && carte.selected === carte.near, `Carte : Entrée ne sélectionne pas la tâche proche (${carte.selected} / ${carte.near})`);
  expect(carte.detailTitle && carte.detailTitle.indexOf(carte.nearTitle) !== -1, `Carte : la fiche de détail ne montre pas la tâche proche (« ${carte.detailTitle} » / « ${carte.nearTitle} »)`);
  expect(carte.detailSections.includes("Description") && carte.detailSections.includes("Champs"), `Carte : le volet de détail n'affiche pas la description et les champs (${JSON.stringify(carte.detailSections)})`);
  expect(carte.slider && carte.progressAfter !== null && Math.abs(carte.progressAfter - carte.progressBefore) === 20, `Carte : régler l'avancement dans le volet n'est pas enregistré (${carte.progressBefore} → ${carte.progressAfter})`);
  expect(carte.tasksBefore === carte.tasksAfter, "Carte : se déplacer ou lire une tâche a modifié les tâches enregistrées");
  expect(carte.overlapsNear.n === 0, `Carte : ${carte.overlapsNear.n} libellé(s) superposé(s) sur ${carte.overlapsNear.count}`);
  expect(carte.stayOnProjectClick && carte.stayOnProjectClick.carte && carte.stayOnProjectClick.dimmed >= 1, `Carte : un clic sur un projet ou un dossier de la barre latérale quitte la Carte (${JSON.stringify(carte.stayOnProjectClick)})`);
  expect(carte.syncLock && /Toussaint/.test(carte.syncLock.title) && carte.syncLock.text && !carte.syncLock.selects && !carte.syncLock.sliders && !carte.syncLock.doneBtn, `Carte : tâche de calendrier synchronisé modifiable (${JSON.stringify(carte.syncLock)})`);
  expect(carte.syncUnchanged, `Carte : ouvrir une tâche de calendrier synchronisé l'a modifiée (${JSON.stringify(carte.syncDiff)})`);
  expect(!carteWidget.error && carteWidget.canvas >= 1 && carteWidget.toolbar >= 1, `Widget Carte (complet) : la carte ne monte pas dans le tableau de bord (${JSON.stringify(carteWidget)})`);
  expect(carteWidget.hint >= 1, `Widget Carte (complet) : pas d'invitation à agrandir un widget de 3 × 4 (${JSON.stringify(carteWidget)})`);
  expect(!cosmosWidget.error && cosmosWidget.canvas >= 1 && cosmosWidget.toolbar >= 1 && cosmosWidget.rail >= 1 && cosmosWidget.crumbs >= 1, `Widget Cosmos (complet) : l'univers ne monte pas dans le tableau de bord (${JSON.stringify(cosmosWidget)})`);
  expect(cosmosWidget.hint >= 1, `Widget Cosmos (complet) : pas d'invitation à agrandir un widget de 3 × 4 (${JSON.stringify(cosmosWidget)})`);
  expect(cosmosWidget.largeHint && cosmosWidget.largeHint.length >= 1 && cosmosWidget.largeHint.every((n) => n === 0), `Widget Cosmos (complet) : un widget de 12 × 14 ne doit pas inviter à l'agrandir (${JSON.stringify(cosmosWidget)})`);
  expect(carte.ariadne && carte.ariadne.pill && carte.ariadne.n >= 1 && carte.ariadne.n <= 8 && carte.ariadne.shown === carte.ariadne.n && carte.ariadne.steps >= 1 && carte.ariadne.closed === 0 && carte.ariadne.after === carte.ariadne.before, `Carte : le mode Fil d'Ariane ne fonctionne pas (${JSON.stringify(carte.ariadne)})`);
  expect(carte.chips === 0, `Carte : ${carte.chips} puce(s) de filtre rapide encore affichée(s)`);
  expect(carte.quick && ["crits", "statuses", "assignees"].every((k) => carte.quick.kinds.includes(k)), `Carte (#506) : filtres rapides Criticité, Statuts et Responsables absents (${JSON.stringify(carte.quick)})`);
  expect(carte.quick && carte.quick.urgent < carte.quick.urgentMoyen && carte.quick.urgentMoyen < carte.quick.all && carte.quick.count === 2 && carte.quick.back === carte.quick.all, `Carte (#506) : la criticité en multi-sélection ne filtre pas comme attendu (${JSON.stringify(carte.quick)})`);
  expect(carte.modalTitle, "Carte : « Ouvrir la fiche » n'ouvre pas la fiche Nexora de la tâche");
  expect(carte.mobile.joystick && carte.mobile.action, `Carte mobile : manette ou bouton « Lire » absent (${JSON.stringify(carte.mobile)})`);
  expect(carte.panel.projects >= 2 && carte.panel.tasks >= 1 && /Chantiers/.test(carte.panel.kicker), `Carte : le panneau ne liste pas la région Chantiers et ses tâches (${JSON.stringify(carte.panel)})`);
  expect(carte.panel.done >= 1, `Carte : les tâches terminées n'apparaissent pas, alors qu'elles sont visibles par défaut (${JSON.stringify(carte.panel)})`);
  expect(carte.dim.dim >= 1 && carte.dim.dim < carte.dim.all && carte.dim.pill && carte.dimAfter === 0, `Carte : grisage des territoires écartés par les filtres incorrect (${JSON.stringify(carte.dim)}, après retour : ${carte.dimAfter})`);
  expect(!carte.iconLeak, "Carte : un identifiant d'icône (iconify:, tabler:) s'affiche en texte");
  expect(carte.filterModal, "Carte : le bouton « Filtres » n'ouvre pas le moteur de filtre général");
  expect(carte.mobile.panelHidden, "Carte mobile : le panneau de droite devrait rester replié par défaut");
  expect(carte.mobile.scroll <= 0, `Carte mobile : défilement horizontal de ${carte.mobile.scroll}px`);
  expect(/basse/.test(carte.volumeQuality), `Carte volume : qualité « ${carte.volumeQuality} », basse attendue pour 12 000 tâches`);
  expect(carte.volumeMs < 60000, `Carte volume : ${carte.volumeMs} ms avant l'affichage (60 s maximum sur rendu logiciel)`);
  expect(carte.volumeOverlaps.n === 0, `Carte volume : ${carte.volumeOverlaps.n} libellé(s) superposé(s)`);
  expect(carte.fallbackProjects === 7, `Carte sans WebGL : ${carte.fallbackProjects} territoire(s) listé(s), 7 attendus`);
  expect(carte.fallbackModal >= 1, "Carte sans WebGL : la liste de repli n'ouvre pas la fiche");
}


expect(!cosmos.error, `Cosmos : scénario en échec (${cosmos.error})`);
if (!cosmos.error) {
  expect(cosmos.canvas === 1 && cosmos.tab, `Cosmos : vue non montée ou onglet inactif (${cosmos.canvas} canvas)`);
  ["Vallabrègues", "Avignon Nord", "Perso", "Archives", "Nouveaux chantiers", "À trier"].forEach((n) => expect(cosmos.galaxyLabels.includes(n), `Cosmos univers : galaxie « ${n} » absente (${cosmos.galaxyLabels.join(", ")})`));
  expect(cosmos.overlapsUniverse.n === 0 && cosmos.overlapsGalaxy.n === 0 && cosmos.overlapsPlanet.n === 0, `Cosmos : libellés superposés (univers ${cosmos.overlapsUniverse.n}, galaxie ${cosmos.overlapsGalaxy.n}, planète ${cosmos.overlapsPlanet.n})`);
  expect(cosmos.summaryTitle === "Vallabrègues", `Cosmos : la synthèse du dossier sélectionné affiche « ${cosmos.summaryTitle} »`);
  expect(cosmos.planetLabels >= 3 && cosmos.amas.some((a) => /Lot aval/.test(a)), `Cosmos galaxie : ${cosmos.planetLabels} planète(s) nommée(s), amas ${JSON.stringify(cosmos.amas)}`);
  expect(cosmos.taskLabels >= 6, `Cosmos planète : ${cosmos.taskLabels} satellite(s) nommé(s), 6 au moins attendus`);
  expect(cosmos.sunLabel.some((x) => /%/.test(x) && /tâches/.test(x)), `Cosmos #421 : chiffre du soleil absent (${JSON.stringify(cosmos.sunLabel)})`);
  expect(cosmos.flagged && cosmos.flagged.on && cosmos.flagged.urgent && cosmos.flagged.late && /Urgent/.test(cosmos.flagged.text) && /Retard \d+ j/.test(cosmos.flagged.text), `Cosmos #421 : tâche urgente et en retard mal signalée (${JSON.stringify(cosmos.flagged)})`);
  expect(/1 urgente/.test(cosmos.planetChips) && /en retard/.test(cosmos.planetChips), `Cosmos #421 : compteurs d'urgences et de retards absents de la planète (« ${cosmos.planetChips} »)`);
  expect(cosmos.detailTitle === "Vérifier les vannes", `Cosmos : le satellite ouvre « ${cosmos.detailTitle} »`);
  expect(cosmos.tasksAfterExplore === cosmos.tasksBefore, "Cosmos : explorer la scène a modifié des tâches");
  expect(cosmos.escSelected === "" && cosmos.escLevel1 === "galaxy" && cosmos.escLevel2 === "universe", `Cosmos : Échap ne remonte pas (${cosmos.escSelected} / ${cosmos.escLevel1} / ${cosmos.escLevel2})`);
  expect(cosmos.suggestions.some((x) => /Vérifier les vannes/.test(x)) && cosmos.searchLevel === "planet", `Cosmos recherche : ${JSON.stringify(cosmos.suggestions)} → ${cosmos.searchLevel}`);
  expect(cosmos.statusAfter === cosmos.doneId, `Cosmos : le statut choisi n'est pas enregistré (${cosmos.statusAfter})`);
  expect(cosmos.planetBefore !== cosmos.planetAfter && /43 %/.test(cosmos.planetAfter), `Cosmos : compteur de la planète non mis à jour (« ${cosmos.planetBefore} » → « ${cosmos.planetAfter} »)`);
  expect(/rgb\(34, 176, 125\)/.test(cosmos.satColor), `Cosmos : le satellite ne prend pas la couleur du statut Terminé (${cosmos.satColor})`);
  expect(cosmos.syncLock.text && cosmos.syncLock.selects === 0, `Cosmos : tâche de calendrier synchronisé modifiable (${JSON.stringify(cosmos.syncLock)})`);
  expect(/univers est vide/i.test(cosmos.empty), `Cosmos vide : message absent (${cosmos.empty})`);
  expect(cosmos.mobile.scroll <= 0 && cosmos.mobile.panelHidden && cosmos.mobile.rail && cosmos.mobile.crumbs, `Cosmos mobile : ${JSON.stringify(cosmos.mobile)}`);
  expect(/basse/.test(cosmos.volumeQuality), `Cosmos volume : qualité « ${cosmos.volumeQuality} », basse attendue pour 12 000 tâches`);
  expect(cosmos.volumeMs < 60000, `Cosmos volume : ${cosmos.volumeMs} ms avant l'affichage (60 s maximum sur rendu logiciel)`);
  expect(cosmos.volumeOverlaps.n === 0 && cosmos.volumeGalaxyOverlaps.n === 0, `Cosmos volume : libellés superposés (${cosmos.volumeOverlaps.n} / ${cosmos.volumeGalaxyOverlaps.n})`);
  expect(cosmos.fallbackGalaxies === 6, `Cosmos sans WebGL : ${cosmos.fallbackGalaxies} galaxie(s) listée(s), 6 attendues`);
  expect(cosmos.fallbackModal >= 1, "Cosmos sans WebGL : la liste de repli n'ouvre pas la fiche");
}

expect(!reu.error, `Réunions 3D : scénario en échec (${reu.error})`);
if (!reu.error) {
  expect(reu.canvas === 1 && reu.tab, `Réunions 3D : vue non montée ou onglet inactif (${reu.canvas} canvas)`);
  expect(/^S\d+ · /.test(reu.week.reuPeriod) && reu.week.reuKind === "week", `Réunions 3D : la période par défaut n'est pas la semaine courante (${reu.week.reuPeriod})`);
  // Semaine courante du jeu fictif : 7 réunions (la tâche « Préparer la réunion » n'en est pas une).
  expect(reu.week.reuTotal === "7" && reu.weekHud.count === "7" && reu.engine && reu.engine.pupitres === 7, `Réunions 3D : 7 réunions attendues cette semaine (${JSON.stringify({ total: reu.week.reuTotal, hud: reu.weekHud.count, engine: reu.engine })})`);
  for (const [name, h, d] of [["semaine", reu.weekHud, reu.week], ["mois", reu.monthHud, reu.month]]) {
    expect(h.projects === Number(d.reuTotal) && h.quick.all === Number(d.reuTotal), `Réunions 3D (${name}) : légende ou filtre « Toutes » incohérents avec la synthèse (${JSON.stringify(h)} / ${d.reuTotal})`);
    expect(h.states.notes === h.quick.notes && h.states.dark === h.quick.noreport && h.states.planned <= h.quick.upcoming, `Réunions 3D (${name}) : synthèse incohérente entre légende et filtres (${JSON.stringify(h)})`);
  }
  expect(reu.month.reuKind === "month" && /^[A-ZÉÛ][a-zéû]+ \d{4}$/.test(reu.month.reuPeriod) && Number(reu.month.reuTotal) > 0, `Réunions 3D : bascule en Mois (${JSON.stringify(reu.month)})`);
  expect(reu.prevMonth !== reu.month.reuPeriod && reu.backMonth === reu.month.reuPeriod, `Réunions 3D : navigation de période (${reu.month.reuPeriod} → ${reu.prevMonth} → ${reu.backMonth})`);
  expect(reu.prefs && reu.prefs.period === "month" && reu.prefs.anchor === null, `Réunions 3D : préférences non persistées (${JSON.stringify(reu.prefs)})`);
  expect(reu.noreport.reuQuick === "noreport" && Number(reu.noreport.reuShown) === reu.noreport.button && reu.noreport.pupitres === reu.noreport.button && reu.noreport.reuTotal === reu.month.reuTotal, `Réunions 3D : filtre « Sans compte rendu » (${JSON.stringify(reu.noreport)})`);
  expect(/Réunion de chantier n° 14/.test(reu.tip), `Réunions 3D : infobulle absente au survol (« ${reu.tip} »)`);
  expect(/Réunion de chantier n° 14/.test(reu.detail) && reu.zoom < 0.9, `Réunions 3D : sélection sans volet ou sans zoom (« ${reu.detail} », ${reu.zoom})`);
  expect(reu.modalButton >= 1, "Réunions 3D : « Ouvrir la fiche » n'ouvre pas la fiche");
  expect(reu.modalClosed === 0 && reu.modalDbl >= 1, `Réunions 3D : le double clic n'ouvre pas la fiche (${reu.modalClosed} / ${reu.modalDbl})`);
  expect(reu.tasksBefore === reu.tasksAfter, "Réunions 3D : explorer la vue a modifié des tâches");
  expect(reu.fallbackItems === 7 && reu.fallbackModal >= 1, `Réunions 3D sans WebGL : ${reu.fallbackItems} réunion(s) listée(s), fiche ${reu.fallbackModal}`);
}

expect(!fleuve.error, `Fleuve du temps : scénario en échec (${fleuve.error})`);
if (!fleuve.error) {
  const st = fleuve.state || {};
  expect(fleuve.canvas === 1 && fleuve.tab, `Fleuve du temps : vue non montée ou onglet inactif (${fleuve.canvas} canvas)`);
  expect(st.boats >= 25 && st.wrecks === 3 && st.ports === 3 && st.ropes === 3 && st.whirls === 2 && st.focus === 2 && st.halos === 1, `Fleuve du temps : scène incomplète ${JSON.stringify(st)}`);
  expect(/3\s*en retard/.test(fleuve.counter) && /2\s*critiques/.test(fleuve.counter) && /S\+2\s*chargée/.test(fleuve.counter), `Fleuve du temps : compteurs « ${fleuve.counter} »`);
  expect(fleuve.dayStart === "0" && /cette semaine/.test(fleuve.dateStart), `Fleuve du temps : date de départ ${fleuve.dayStart} « ${fleuve.dateStart} »`);
  expect(+fleuve.dayWeek >= 11 && /S\+2/.test(fleuve.dateWeek), `Fleuve du temps : « semaine › » ×2 mène à ${fleuve.dayWeek} « ${fleuve.dateWeek} »`);
  expect(+fleuve.dayFrise >= 25 && fleuve.litFrise >= 1, `Fleuve du temps : la frise mène au jour ${fleuve.dayFrise}, ${fleuve.litFrise} portique(s) illuminé(s)`);
  expect(+fleuve.dayWheel >= 3, `Fleuve du temps : la molette ne remonte pas le fleuve (jour ${fleuve.dayWheel})`);
  expect(!!fleuve.target, "Fleuve du temps : aucun bateau cliquable à l'écran");
  if (fleuve.target) {
    expect(fleuve.fiche && (fleuve.fiche.inputs.includes(fleuve.expectedTitle) || fleuve.fiche.text.includes(fleuve.expectedTitle)), `Fleuve du temps : le double clic n'ouvre pas la fiche « ${fleuve.expectedTitle} » (${JSON.stringify(fleuve.fiche)})`);
    expect(fleuve.selected === fleuve.target.id && fleuve.detailTitle.includes(fleuve.expectedTitle), `Fleuve du temps : sélection « ${fleuve.selected} », volet « ${fleuve.detailTitle} »`);
  }
  expect(fleuve.tasksAfter === fleuve.tasksBefore, "Fleuve du temps : naviguer a modifié des tâches");
  expect(fleuve.fallbackWeeks >= 7 && fleuve.fallbackModal >= 1, `Fleuve du temps sans WebGL : ${fleuve.fallbackWeeks} semaine(s), fiche ${fleuve.fallbackModal ? "ouverte" : "fermée"}`);
}

console.log(`Capture : ${shot}`);
if (failures.length) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`Contrôle visuel : OK (${seen.miniFrames.length} cadres et ${seen.miniBlocks} blocs dans le Mini-Gantt)`);
