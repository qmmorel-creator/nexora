/* Recette de rendu de la « Fiche projet PDF » (#291).

   Le code testé est celui du bundle RÉELLEMENT construit (apps/nexora/.build/
   index.html, produit par `npm run build --prefix apps/nexora`), extrait entre
   ses sentinelles — jamais une copie. jsPDF est la même version que celle
   chargée par l'application (2.5.2).

   Pour chaque cas, le script :
   1. génère le PDF et vérifie que les données d'entrée n'ont pas été modifiées
      (export strictement en lecture seule) ;
   2. le rasterise avec Poppler (pdftoppm) dans .out/ pour contrôle visuel ;
   3. extrait les boîtes de chaque mot (pdftotext -bbox-layout) et échoue si un
      mot sort de la zone imprimable, ou si deux mots se chevauchent ;
   4. vérifie la présence des libellés attendus et l'absence de caractères
      illisibles.

   Utilisation :
     npm install && npm start
     node run.mjs --catalogs instantane.json --project <id> --today AAAA-MM-JJ
   (le second forme rejoue un instantané relu au moment de la recette). */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import vm from "node:vm";
import { jsPDF } from "jspdf";

const here = import.meta.dirname;
const root = path.resolve(here, "../..");
const out = path.join(here, ".out");
const html = await readFile(path.join(root, "apps/nexora/.build/index.html"), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`, end = `// === NEXORA:${name}:END ===`;
  const a = html.indexOf(start), b = html.indexOf(end);
  if (a === -1 || b < a) throw new Error(`bloc ${name} introuvable — lancer d'abord le build de apps/nexora`);
  return html.slice(a + start.length, b);
}
const logoLine = /const NEXORA_LOGO_FULL = "data:image\/png;base64,[A-Za-z0-9+/=]+";/.exec(html);
if (!logoLine) throw new Error("NEXORA_LOGO_FULL introuvable dans le bundle");

const lib = vm.runInThisContext(`(function (jsPDF) {
${logoLine[0]}
${["DATE-UTILS", "TASK-STATUS", "TASK-KIND", "CRITICALITY", "MEMO-PDF-CORE", "PROJECT-PDF-CORE", "PROJECT-PDF-DRAW"].map(slice).join("\n")}
return { buildFicheProjetPdf, projectPdfData };
})`)(jsPDF);

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) => (v.startsWith("--") ? [...acc, [v.slice(2), arr[i + 1]]] : acc), []));
const F = await import(path.join(root, "apps/nexora/tests/fixtures/project-pdf-fixtures.mjs"));

const cases = [];
if (args.catalogs) {
  cases.push({ name: "instantane", catalogs: JSON.parse(await readFile(args.catalogs, "utf8")), projectId: args.project, today: args.today || F.MAIA_TODAY, expect: [] });
} else {
  cases.push({
    name: "maia-sonnier", catalogs: F.maiaCatalogs, projectId: "qjah9det", today: F.MAIA_TODAY,
    expect: ["Médiation Maïa Sonnier", "Fournir Note de Synthèse des bétons", "Envoyer la dernière note PN", "Deadline Envois Docs Expertise", "Rapport des Experts", "Réunion expertise amiable Maïa-CNR", "Attente tiers", "Urgent", "État du réseau", "Vue Métro"],
    forbid: ["Tâche d'un autre projet"],
  });
  cases.push({ name: "projet-long", catalogs: F.makeLongCatalogs(), projectId: F.LONG_PROJECT_ID, today: F.MAIA_TODAY, expect: ["Rapport de synthèse d'exploitation", "Bouclage DREAL", "Tâches en cours", "État du réseau"] });
  cases.push({ name: "projet-vide", catalogs: { ...F.maiaCatalogs, tasks: [] }, projectId: "qjah9det", today: F.MAIA_TODAY, expect: ["Aucune tâche active"] });
}

const MM = 72 / 25.4;
const PAGE_W = 210 * MM, PAGE_H = 297 * MM;
const MARGIN = 12 * MM, BOTTOM = (297 - 10) * MM;

function words(pdfPath) {
  const xhtml = execFileSync("pdftotext", ["-bbox-layout", pdfPath, "-"], { encoding: "utf8" });
  const pages = [];
  xhtml.split(/<page /).slice(1).forEach((chunk) => {
    const list = [];
    for (const m of chunk.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)) {
      list.push({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4], text: m[5] });
    }
    pages.push(list);
  });
  return pages;
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
let failures = 0;
const fail = (msg) => { failures++; console.error("  ✗ " + msg); };

for (const c of cases) {
  console.log(`\n${c.name}`);
  const before = JSON.stringify(c.catalogs);
  const { doc, data, fileName } = await lib.buildFicheProjetPdf(c.projectId, c.catalogs, { todayIso: c.today });
  if (JSON.stringify(c.catalogs) !== before) fail("les données d'entrée ont été modifiées par l'export");
  const pdfPath = path.join(out, `${c.name}.pdf`);
  await writeFile(pdfPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`  fichier proposé : ${fileName}`);
  if (!/^nexora-fiche-projet-[a-z0-9-]+-\d{4}-\d{2}-\d{2}\.pdf$/.test(fileName)) fail(`nom de fichier invalide : ${fileName}`);

  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  const pagesCount = +/Pages:\s+(\d+)/.exec(info)[1];
  if (!/Page size:\s+595\.2\d* x 841\.8\d* pts \(A4\)/.test(info)) fail("format de page différent de l'A4 portrait");
  execFileSync("pdftoppm", ["-r", "110", "-png", pdfPath, path.join(out, c.name)]);
  console.log(`  ${pagesCount} page(s), rendu dans .out/${c.name}-*.png`);

  const pages = words(pdfPath);
  pages.forEach((list, p) => {
    list.forEach((w) => {
      if (w.x1 < MARGIN - 1.5 || w.x2 > PAGE_W - MARGIN + 1.5 || w.y1 < 0 || w.y2 > BOTTOM + 1.5) fail(`p.${p + 1} « ${w.text} » hors de la zone imprimable`);
    });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const ix = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1), iy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        if (ix <= 0.3 || iy <= 0.3) continue;
        const area = Math.min((a.x2 - a.x1) * (a.y2 - a.y1), (b.x2 - b.x1) * (b.y2 - b.y1));
        if ((ix * iy) / area > 0.12) fail(`p.${p + 1} chevauchement « ${a.text} » / « ${b.text} »`);
      }
    }
  });
  const text = execFileSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" });
  // Les micro-libellés sont composés en capitales : comparaison sans casse.
  const flat = text.replace(/\s+/g, " ").toLocaleLowerCase("fr");
  (c.expect || []).forEach((e) => { if (!flat.includes(e.toLocaleLowerCase("fr"))) fail(`libellé attendu absent : « ${e} »`); });
  (c.forbid || []).forEach((e) => { if (flat.includes(e.toLocaleLowerCase("fr"))) fail(`libellé qui ne devrait pas apparaître : « ${e} »`); });
  if (/\uFFFD/.test(text)) fail("caractère illisible (U+FFFD) dans le PDF");
  console.log(`  synthèse : ${JSON.stringify({ total: data.counts.total, enCours: data.counts.inProgress, terminees: data.counts.done, attenteTiers: data.counts.waitingThird, avancement: data.progress, periode: data.period, echeance: data.nextCritical && data.nextCritical.row.title })}`);
}

if (failures) { console.error(`\n${failures} contrôle(s) en échec`); process.exit(1); }
console.log("\nTous les contrôles de rendu sont verts.");
