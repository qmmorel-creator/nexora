// Sélection des scénarios visuels concernés par une modification.
//
//   node affected.mjs                 compare l'arbre de travail à la base (merge-base avec origin/main)
//   node affected.mjs --base=<ref>    base explicite
//   node affected.mjs --head=<ref>    compare deux commits (base..head) au lieu de l'arbre de travail
//   node affected.mjs --files=a,b     classe une liste de chemins, sans diff de contenu
//   node affected.mjs --run           exécute ensuite la sélection (build, test moteur, banc)
//   node affected.mjs --json          sortie machine
//
// L'interface tient dans les fragments `apps/nexora/source/index.html.part-*`,
// concaténés au build : le nom de fichier ne dit donc rien de la vue touchée.
// On les recolle (ancienne et nouvelle version), on les compare ligne à ligne,
// et chaque ligne modifiée est rattachée à la déclaration de premier niveau qui
// la contient. Une déclaration appartient à une vue 3D par son nom (carte*,
// cosmos*, fleuve*, reunions3d* / REU3D_*) ; une déclaration commune entraîne
// les vues 3D qui y font référence. Le CSS (y compris celui de GlobalStyles)
// est rattaché aux composants qui utilisent ses classes.
//
// Toute incertitude élargit la sélection, jamais l'inverse : diff indisponible,
// chemin inconnu, instruction de premier niveau, CSS sans classe → prudence.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { SCENARIOS_3D } from "./scope.mjs";

const SOURCE_DIR = "apps/nexora/source";
const PART = /^apps\/nexora\/source\/index\.html\.part-\d+$/;
// Vue représentative quand les quatre vues 3D partagent réellement le même code
// (CSS global, variables de thème) : même coque HTML, mêmes composants de fiche.
const REPRESENTATIVE_3D = "carte";

export function familyOfName(name) {
  if (/carte/i.test(name)) return "carte";
  if (/cosmos/i.test(name)) return "cosmos";
  if (/fleuve/i.test(name)) return "fleuve";
  if (/reunions3d|reu3d/i.test(name)) return "reunions3d";
  return "2d";
}
const familyOfClass = (cls) => (/(^|-)carte(-|$)/.test(cls) ? "carte" : /(^|-)cosmos(-|$)/.test(cls) ? "cosmos" : /(^|-)fleuve(-|$)/.test(cls) ? "fleuve" : /(^|-)reu(3d)?(-|$)/.test(cls) ? "reunions3d" : null);

// Moteurs de rendu : une modification ici réclame la campagne exhaustive avant livraison.
const ENGINE = /^create(Carte|Cosmos|Fleuve|Reunions3d)Engine$/;

const DECL = /^(?:export (?:default )?)?(?:async )?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
// Instructions de premier niveau (imports CDN, montage de l'application) : prudence.
const TOP_STATEMENT = /^(import\s|export\s+default\s+[^f]|root\.render|ReactDOM|window\.|if \(typeof|Object\.assign\()/;
const CSS_LINE = /^\s*[.#@:*\[][^=]*\{|^\s*[a-z-]+\s*:\s*[^,]*;\s*\}?\s*$|^\s*\}\s*$/;
const IDENT = /[A-Za-z_$][\w$]*/g;
const CLASS_TOKEN = /[A-Za-z_][\w-]*/g;

// Découpe le HTML assemblé en régions : prélude, <style>, script, et une région
// par déclaration de premier niveau du script Babel.
export function indexSource(text) {
  const lines = text.split("\n");
  const regions = [];
  let mode = "html", cur = null;
  const open = (r) => { if (cur) cur.end = r.start - 1; cur = r; regions.push(r); };
  lines.forEach((l, i) => {
    const n = i + 1;
    if (mode === "html") {
      if (/^<style\b/.test(l)) { open({ kind: "style", start: n }); mode = "style"; }
      else if (/^<script type="text\/babel"/.test(l)) { open({ kind: "prelude", start: n }); mode = "babel"; }
      else if (!cur || cur.kind !== "html") open({ kind: "html", start: n });
    } else if (mode === "style") {
      if (/^<\/style>/.test(l)) mode = "html";
    } else if (/^<\/script>/.test(l)) {
      open({ kind: "html", start: n }); mode = "html";
    } else {
      const m = DECL.exec(l);
      if (m) open({ kind: "decl", name: m[1] || m[2], start: n });
    }
  });
  if (cur) cur.end = lines.length;
  for (const r of regions) {
    const body = lines.slice(r.start - 1, r.end);
    if (r.kind === "decl") {
      const css = body.filter((l) => CSS_LINE.test(l)).length;
      r.style = body.length >= 20 && css / body.length >= 0.5;
      r.idents = new Set(body.join("\n").match(IDENT) || []);
      r.tokens = new Set(body.join("\n").match(CLASS_TOKEN) || []);
    }
  }
  return { lines, regions };
}

const regionAt = (index, n) => {
  let lo = 0, hi = index.regions.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, r = index.regions[mid];
    if (n < r.start) hi = mid - 1; else if (n > r.end) lo = mid + 1; else return r;
  }
  return null;
};

// Vues qui utilisent une classe CSS : mot-clé de la classe, puis composants
// (hors feuilles de style) qui la citent.
function classFamilies(index, cls) {
  index.classCache = index.classCache || new Map();
  if (!index.classCache.has(cls)) {
    const fams = new Set();
    const kw = familyOfClass(cls);
    if (kw) fams.add(kw);
    for (const r of index.regions) if (r.kind === "decl" && !r.style && r.tokens.has(cls)) fams.add(familyOfName(r.name));
    index.classCache.set(cls, fams);
  }
  return index.classCache.get(cls);
}

// Rattache une ligne de CSS (et son sélecteur) aux vues concernées. Un
// sélecteur composé (`.lp-carte-view .lp-btn`) ne vise que les vues où toutes
// ses classes vivent : on prend l'intersection. Une classe commune au 2D et à
// plusieurs vues 3D (bouton, carte, état) se vérifie sur une vue 3D
// représentative : ces vues partagent alors exactement le même code.
function cssImpact(index, region, n, add, why) {
  const { lines } = index;
  const own = lines[n - 1];
  let selector = own;
  if (!/\{/.test(own)) {
    for (let j = n - 1; j >= region.start; j--) if (/\{/.test(lines[j - 1])) { selector = lines[j - 1]; break; }
  }
  const head = selector.includes("{") ? selector.slice(0, selector.indexOf("{")) : selector;
  for (const part of head.split(",")) {
    const classes = [...new Set([...part.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]))];
    if (!classes.length) {
      if (part.trim()) add(["2d", REPRESENTATIVE_3D], `CSS sans classe (${part.trim().slice(0, 60)}) : global → 2D + vue 3D représentative`);
      continue;
    }
    let fams = null;
    for (const cls of classes) {
      const f = classFamilies(index, cls);
      fams = fams === null ? new Set(f) : new Set([...fams].filter((x) => f.has(x)));
    }
    if (!fams.size) {
      classes.forEach((cls) => classFamilies(index, cls).forEach((f) => fams.add(f)));
      if (!fams.size) { fams = new Set(["2d", REPRESENTATIVE_3D]); why(`sélecteur ${part.trim().slice(0, 60)} introuvable dans les composants`); }
    }
    const three = [...fams].filter((f) => f !== "2d");
    if (fams.has("2d") && three.length >= 2) {
      add(["2d", REPRESENTATIVE_3D], `CSS ${part.trim().slice(0, 60)} commun au 2D et à ${three.length} vues 3D → vue 3D représentative`);
    } else add([...fams], `CSS ${part.trim().slice(0, 60)}`);
  }
}

// Une déclaration touche sa propre vue et, de proche en proche, les vues 3D
// qui l'utilisent : un utilitaire commun repris par une fonction de la Carte
// elle-même appelée par Cosmos concerne aussi Cosmos. On ne remonte pas à
// travers le code 2D (l'application entière y mène) : le scénario 2D est alors
// déjà retenu.
function declImpact(index, region, add, flag) {
  const name = region.name;
  const own = familyOfName(name);
  const fams = new Set([own]);
  const seen = new Set([region]);
  const queue = [region];
  while (queue.length) {
    const cur = queue.shift();
    for (const r of index.regions) {
      if (r.kind !== "decl" || r.style || seen.has(r) || !r.idents.has(cur.name)) continue;
      seen.add(r);
      const f = familyOfName(r.name);
      if (f === "2d") { if (own === "2d") fams.add("2d"); continue; }
      fams.add(f);
      queue.push(r);
    }
  }
  if (own !== "2d" && /^WidgetEmbed/.test(name)) fams.add("2d"); // widget monté dans le tableau de bord 2D
  const shared = [...fams].filter((f) => f !== own);
  add([...fams], shared.length ? `${name} (utilisé aussi par ${shared.join(", ")})` : name);
  if (ENGINE.test(name)) flag(`${name} : moteur de rendu`);
}

function lineImpact(index, n, acc) {
  const region = regionAt(index, n);
  const add = (fams, reason) => { fams.forEach((f) => acc.scenarios.add(f)); acc.reasons.add(`${[...new Set(fams)].join("+")} ← ${reason}`); };
  const why = (reason) => acc.reasons.add(`prudence ← ${reason}`);
  const flag = (reason) => acc.exhaustive.add(reason);
  const text = index.lines[n - 1] ?? "";
  if (!region || region.kind === "html" || region.kind === "prelude") {
    add(["2d", ...SCENARIOS_3D], `ligne ${n} hors déclaration (${region ? region.kind : "?"}) : prudence`);
    return;
  }
  if (region.kind === "style") { cssImpact(index, region, n, add, why); return; }
  if (TOP_STATEMENT.test(text)) { add(["2d", ...SCENARIOS_3D], `instruction de premier niveau « ${text.trim().slice(0, 50)} » : prudence`); return; }
  if (region.style && n !== region.start) { cssImpact(index, region, n, add, why); return; }
  declImpact(index, region, add, flag);
}

// Banc `harness.jsx` : le haut du fichier monte les scénarios 2D ; à partir du
// montage (`createRoot`), il prépare l'application complète (`?app=1`) dont les
// données de démo nourrissent AUSSI les vues 3D ; chaque bloc
// `benchParams.get("carte" | "cosmos" | "reunions" | "fleuve")` prépare une vue.
export function harnessImpact(oldText, newText, hunks) {
  const acc = { scenarios: new Set(), reasons: new Set() };
  const zones = (text) => {
    const lines = text.split("\n");
    const mount = lines.findIndex((l) => /^const root = createRoot\(/.test(l)) + 1;
    const blocks = [];
    lines.forEach((l, i) => {
      if (/benchParams\.get\("(carte|cosmos|reunions|fleuve)"\)\s*===/.test(l)) {
        const fams = new Set([...l.matchAll(/benchParams\.get\("(carte|cosmos|reunions|fleuve)"\)/g)].map((m) => (m[1] === "reunions" ? "reunions3d" : m[1])));
        blocks.push({ start: i + 1, fams });
      } else if (/^function BenchApp\b/.test(l)) blocks.push({ start: i + 1, fams: null });
    });
    return (n) => {
      if (!mount || n < mount) return ["2d"];
      const b = blocks.filter((x) => x.start <= n).pop();
      return b && b.fams ? [...b.fams] : null; // null : données ou montage communs
    };
  };
  const at = { old: zones(oldText), new: zones(newText) };
  const mark = (side, n) => {
    const f = at[side](n);
    if (f) { f.forEach((x) => acc.scenarios.add(x)); acc.reasons.add(`${f.join("+")} ← harness.jsx (${f[0] === "2d" ? "scénarios 2D" : "données de démo de la vue"})`); }
    else { ["2d", ...SCENARIOS_3D].forEach((x) => acc.scenarios.add(x)); acc.reasons.add("2d+carte+cosmos+reunions3d+fleuve ← harness.jsx (données ou montage communs à l'application de démo)"); }
  };
  for (const h of hunks) {
    for (let i = 0; i < h.newCount; i++) mark("new", h.newStart + i);
    for (let i = 0; i < h.oldCount; i++) mark("old", h.oldStart + i);
  }
  return acc;
}

// Hunks d'un diff unifié -U0 : [{ oldStart, oldCount, newStart, newCount }].
export function parseHunks(diff) {
  const hunks = [];
  for (const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
    hunks.push({ oldStart: +m[1], oldCount: m[2] === undefined ? 1 : +m[2], newStart: +m[3], newCount: m[4] === undefined ? 1 : +m[4] });
  }
  return hunks;
}

export function sourceImpact(oldText, newText, hunks) {
  const acc = { scenarios: new Set(), reasons: new Set(), exhaustive: new Set() };
  const oldIdx = indexSource(oldText), newIdx = indexSource(newText);
  for (const h of hunks) {
    for (let i = 0; i < h.newCount; i++) lineImpact(newIdx, h.newStart + i, acc);
    for (let i = 0; i < h.oldCount; i++) lineImpact(oldIdx, h.oldStart + i, acc);
    // Insertion pure : la ligne voisine situe l'ajout.
    if (h.newCount === 0 && h.oldCount === 0) lineImpact(newIdx, Math.max(1, h.newStart), acc);
  }
  return acc;
}

// Règles par chemin, dans l'ordre. `null` = aucune suite visuelle (le socle
// `npm run verify` couvre ces fichiers). Un chemin qui ne correspond à rien est
// traité avec prudence.
const ALL = ["2d", ...SCENARIOS_3D];
export const PATH_RULES = [
  [PART, "source"],
  [/^apps\/nexora\/public\/carte\//, { scenarios: ["carte"], exhaustive: "modèles 3D de la Carte" }],
  [/^apps\/nexora\/scripts\//, { scenarios: ALL, exhaustive: "chaîne de build de l'interface" }],
  [/^apps\/nexora\/package(-lock)?\.json$/, { scenarios: ALL }],
  // Environnements (#544) : la configuration commune entre dans le build de
  // l'interface ; le mode démonstration ne sert qu'aux constructions local et
  // préproduction (le banc a son propre bouchon Firebase).
  [/^config\//, { scenarios: ALL }],
  [/^apps\/nexora\/environnement-demo\//, null],
  // Fonctions SQL versionnées (#574) : appliquées dans Supabase, sans rendu.
  [/^apps\/nexora\/(netlify|lib|tests|supabase)\//, null],
  [/^apps\/nexora\/(openapi\.yaml|public\/openapi\.yaml|tsconfig\.json|netlify\.toml|[^/]+\.md)$/, null],
  [/^apps\/nexora-mcp\//, null],
  [/^tools\/visual-check\/(affected|scope)(\.test)?\.mjs$/, { scenarios: [], tests: ["selection"] }],
  [/^tools\/visual-check\/carte-engine\.test\.mjs$/, { scenarios: [], tests: ["carte-engine"] }],
  [/^tools\/visual-check\/(premium|impact)-fixture\.mjs$/, { scenarios: ["2d"] }],
  [/^tools\/visual-check\/harness\.jsx$/, "harness"],
  [/^tools\/visual-check\/build-harness\.mjs$/, { scenarios: ALL }],
  [/^tools\/visual-check\/run\.mjs$/, { scenarios: ALL, exhaustive: "banc visuel modifié" }],
  [/^tools\/visual-check\/package(-lock)?\.json$/, { scenarios: ALL, exhaustive: "dépendances du banc (three, React)" }],
  [/^tools\/visual-check\/[^/]+\.(md|png)$/, null],
  [/^tools\/pdf-check\//, null],
  [/^(docs\/|\.github\/|scripts\/)/, null],
  // Outil de publication, registre, source de version et tests du mécanisme
  // (#544) : couverts par le socle `npm run verify`, sans rendu.
  [/^(outils\/|publication\/|tests\/)/, null],
  // Relevé des jetons de design (référencé par DESIGN.md), sans effet sur le rendu.
  [/^\.impeccable\//, null],
  [/^[^/]+\.md$/, null],
  [/^(package\.json|\.gitignore|\.gitattributes|\.editorconfig)$/, null],
];

export function classifyPaths(paths) {
  const out = { scenarios: new Set(), reasons: new Set(), exhaustive: new Set(), tests: new Set(), source: [] };
  for (const p of paths) {
    const rule = PATH_RULES.find(([re]) => re.test(p));
    if (!rule) { ALL.forEach((s) => out.scenarios.add(s)); out.reasons.add(`prudence ← chemin non répertorié : ${p}`); continue; }
    const [, what] = rule;
    if (what === "source") { out.source.push(p); continue; }
    if (what === "harness") { out.harness = true; continue; }
    if (what === null) { out.reasons.add(`aucune suite visuelle ← ${p}`); continue; }
    what.scenarios.forEach((s) => out.scenarios.add(s));
    (what.tests || []).forEach((t) => out.tests.add(t));
    if (what.exhaustive) out.exhaustive.add(what.exhaustive);
    out.reasons.add(`${what.scenarios.join("+") || (what.tests || []).join("+")} ← ${p}`);
  }
  return out;
}

const git = (args, opts = {}) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "pipe"], ...opts });

function readParts(ref, root) {
  if (ref === null) {
    const dir = path.join(root, SOURCE_DIR);
    return readdirSync(dir).filter((n) => /^index\.html\.part-\d+$/.test(n)).sort().map((n) => readFileSync(path.join(dir, n), "utf8")).join("");
  }
  const names = git(["ls-tree", "--name-only", `${ref}:${SOURCE_DIR}`], { cwd: root }).split("\n").filter((n) => /^index\.html\.part-\d+$/.test(n)).sort();
  return names.map((n) => git(["show", `${ref}:${SOURCE_DIR}/${n}`], { cwd: root })).join("");
}

function defaultBase(root) {
  for (const ref of ["origin/main", "main"]) {
    try { return git(["merge-base", "HEAD", ref], { cwd: root }).trim(); } catch { /* suivant */ }
  }
  return null;
}

// Résultat complet : { base, scenarios, depth, exhaustive, tests, reasons, prudent }.
export function computeAffected({ root, base, head, files } = {}) {
  const result = { base: base || null, head: head || null, prudent: false };
  let paths = files, oldText, newText, hunks;
  if (!paths) {
    try {
      result.base = base || defaultBase(root);
      if (!result.base) throw new Error("aucune base (origin/main introuvable)");
      const names = head
        ? git(["diff", "--name-status", "-M", result.base, head], { cwd: root })
        : git(["diff", "--name-status", "-M", result.base], { cwd: root }) + "\n" + git(["ls-files", "--others", "--exclude-standard"], { cwd: root }).split("\n").filter(Boolean).map((f) => `A\t${f}`).join("\n");
      paths = [...new Set(names.split("\n").filter(Boolean).flatMap((l) => l.split("\t").slice(1)))];
    } catch (e) {
      result.prudent = true;
      result.scenarios = [...ALL]; result.depth = "cible"; result.exhaustive = []; result.tests = ["carte-engine"];
      result.reasons = [`prudence ← diff indisponible (${String(e.message || e).split("\n")[0]}) : toutes les vues, profondeur ciblée`];
      return result;
    }
  }
  const acc = classifyPaths(paths);
  if (acc.source.length) {
    if (files) {
      // Liste de chemins sans contenu : impossible de situer la modification.
      ALL.forEach((s) => acc.scenarios.add(s));
      acc.reasons.add("prudence ← fragment d'interface sans diff de contenu");
    } else {
      const dir = mkdtempSync(path.join(tmpdir(), "nexora-affected-"));
      try {
        oldText = readParts(result.base, root);
        newText = readParts(head || null, root);
        writeFileSync(path.join(dir, "old.html"), oldText);
        writeFileSync(path.join(dir, "new.html"), newText);
        const r = spawnSync("git", ["diff", "--no-index", "--no-color", "-U0", path.join(dir, "old.html"), path.join(dir, "new.html")], { encoding: "utf8", maxBuffer: 1 << 28 });
        if (r.status !== 0 && r.status !== 1) throw new Error(r.stderr || "git diff --no-index en échec");
        hunks = parseHunks(r.stdout);
        const s = sourceImpact(oldText, newText, hunks);
        s.scenarios.forEach((x) => acc.scenarios.add(x));
        s.reasons.forEach((x) => acc.reasons.add(x));
        s.exhaustive.forEach((x) => acc.exhaustive.add(x));
      } catch (e) {
        ALL.forEach((s) => acc.scenarios.add(s));
        acc.reasons.add(`prudence ← analyse des fragments impossible (${String(e.message || e).split("\n")[0]})`);
        result.prudent = true;
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  if (acc.harness) {
    const file = "tools/visual-check/harness.jsx";
    try {
      if (files) throw new Error("liste de chemins sans contenu");
      const show = (ref) => { try { return git(["show", `${ref}:${file}`], { cwd: root }); } catch { return ""; } };
      const oldH = show(result.base);
      const newH = head ? show(head) : (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : "");
      const d = git(["diff", "--no-color", "-U0", result.base, ...(head ? [head] : []), "--", file], { cwd: root });
      const h = harnessImpact(oldH, newH, parseHunks(d));
      h.scenarios.forEach((x) => acc.scenarios.add(x));
      h.reasons.forEach((x) => acc.reasons.add(x));
    } catch (e) {
      ALL.forEach((s) => acc.scenarios.add(s));
      acc.reasons.add(`prudence ← harness.jsx non analysable (${String(e.message || e).split("\n")[0]})`);
    }
  }
  if (acc.scenarios.has("carte")) acc.tests.add("carte-engine");
  if ([...acc.reasons].some((r) => r.startsWith("prudence"))) result.prudent = true;
  result.paths = paths;
  result.scenarios = ALL.filter((s) => acc.scenarios.has(s));
  result.depth = "cible";
  result.exhaustive = [...acc.exhaustive];
  result.tests = [...acc.tests];
  result.reasons = [...acc.reasons];
  return result;
}

function print(r) {
  console.log(`Base : ${r.base || "—"}${r.head ? ` → ${r.head}` : " → arbre de travail"}${r.prudent ? "  (sélection élargie par prudence)" : ""}`);
  console.log(`Fichiers modifiés : ${r.paths ? r.paths.length : "inconnus"}`);
  console.log(`Scénarios du banc : ${r.scenarios.length ? `${r.scenarios.join(", ")} (profondeur ${r.depth})` : "aucun"}`);
  console.log(`Tests sans navigateur : ${r.tests.length ? r.tests.join(", ") : "aucun"}`);
  const shown = r.reasons.slice(0, 40);
  console.log("Motifs :");
  shown.forEach((x) => console.log(`  - ${x}`));
  if (r.reasons.length > shown.length) console.log(`  … et ${r.reasons.length - shown.length} autre(s)`);
  if (r.exhaustive.length) {
    console.log(`\nCampagne exhaustive à passer AVANT LIVRAISON, sur le lot stabilisé (${r.exhaustive.join(" ; ")}) :`);
    console.log("  npm run visual:check");
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a && a.slice(k.length + 3); };
  const root = git(["rev-parse", "--show-toplevel"]).trim();
  const files = opt("files") ? opt("files").split(",").filter(Boolean) : undefined;
  const r = computeAffected({ root, base: opt("base"), head: opt("head"), files });
  if (argv.includes("--json")) console.log(JSON.stringify(r, null, 2)); else print(r);
  if (argv.includes("--run")) {
    const here = path.dirname(import.meta.filename);
    const sh = (cmd, args, cwd) => { console.log(`\n$ ${cmd} ${args.join(" ")}`); const x = spawnSync(cmd, args, { cwd, stdio: "inherit" }); if (x.status !== 0) process.exit(x.status || 1); };
    if (r.tests.includes("selection")) sh("node", ["--test", "affected.test.mjs"], here);
    if (r.scenarios.length || r.tests.includes("carte-engine")) sh("npm", ["run", "build", "--prefix", "apps/nexora"], root);
    if (r.tests.includes("carte-engine")) {
      if (!existsSync(path.join(here, "node_modules", "three"))) { console.error("tools/visual-check : dépendances absentes — lancer `npm install` dans ce dossier."); process.exit(1); }
      sh("npm", ["run", "test:carte-engine"], here);
    }
    if (r.scenarios.length) sh("node", ["run.mjs", `--only=${r.scenarios.join(",")}`, `--depth=${r.depth}`], here);
    else console.log("\nAucun scénario du banc visuel n'est concerné : rien n'a été lancé (ce n'est pas un contrôle réussi).");
    if (r.exhaustive.length) console.log("\nRappel : la campagne exhaustive (`npm run visual:check`) reste due sur le lot stabilisé, avant livraison.");
  }
}
