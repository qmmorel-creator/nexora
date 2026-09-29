// Sélection des scénarios visuels : node --test affected.test.mjs
// (aucune dépendance npm : lancé aussi par `npm run verify` à la racine).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { classifyPaths, sourceImpact, harnessImpact, parseHunks, computeAffected } from "./affected.mjs";
import { parseScope } from "./scope.mjs";

const hunks = (a, b) => {
  const dir = mkdtempSync(path.join(tmpdir(), "affected-test-"));
  try {
    writeFileSync(path.join(dir, "a"), a);
    writeFileSync(path.join(dir, "b"), b);
    const r = spawnSync("git", ["diff", "--no-index", "--no-color", "-U0", path.join(dir, "a"), path.join(dir, "b")], { encoding: "utf8" });
    return parseHunks(r.stdout);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const impact = (a, b) => {
  const r = sourceImpact(a, b, hunks(a, b));
  return { scenarios: [...r.scenarios].sort(), exhaustive: [...r.exhaustive], reasons: [...r.reasons] };
};

// Un monofichier miniature, construit comme le vrai : feuille de style, script
// Babel, déclarations de premier niveau, CSS des vues dans GlobalStyles.
const css = Array.from({ length: 30 }, (_, i) => `    .lp-task-list .row-${i}{ color:red; }`).join("\n");
const SOURCE = `<!DOCTYPE html>
<style>
.lp-btn{ color:red; }
body{ margin:0; }
</style>
<script type="text/babel" data-type="module" data-presets="react">
import React from 'https://esm.sh/react@18.2.0';
function fmtDue(d) {
  return d;
}
function carteLabel(t) {
  return fmtDue(t.due);
}
function CosmosView() {
  return <div className="lp-cosmos-stage lp-btn">{carteLabel(x)}</div>;
}
function TaskList() {
  return <div className="lp-task-list lp-btn">{fmtDue(1)}</div>;
}
function createFleuveEngine(THREE) {
  return { three: THREE };
}
function FleuveView() {
  return <div className="lp-fleuve-view lp-btn">{createFleuveEngine()}</div>;
}
function Reunions3DView() {
  return <div className="lp-reu-view lp-btn" />;
}
function GlobalStyles() {
  return <style>{\`
${css}
    .lp-fleuve-view{ color:blue; }
    .lp-cosmos-stage .lp-btn{ color:green; }
  \`}</style>;
}
root.render(<App />);
</script>
`;
const edit = (from, to) => { assert.ok(SOURCE.includes(from), from); return SOURCE.replace(from, to); };

test("documentation seule : aucune suite visuelle", () => {
  const r = classifyPaths(["docs/AUDIT.md", "README.md", ".github/workflows/ci.yml", "tools/visual-check/README.md", "apps/nexora-mcp/src/tools.mts", "apps/nexora/netlify/functions/nexora-read.ts"]);
  assert.deepEqual([...r.scenarios], []);
  assert.equal(r.source.length, 0);
});

test("chemin inconnu : prudence, toutes les vues", () => {
  const r = classifyPaths(["nouveau/dossier/fichier.bin"]);
  assert.deepEqual([...r.scenarios].sort(), ["2d", "carte", "cosmos", "fleuve", "reunions3d"]);
  assert.ok([...r.reasons].some((x) => x.startsWith("prudence")));
});

test("modèles 3D et chaîne de build : campagne exhaustive avant livraison", () => {
  assert.deepEqual([...classifyPaths(["apps/nexora/public/carte/house.glb"]).scenarios], ["carte"]);
  assert.ok(classifyPaths(["apps/nexora/public/carte/house.glb"]).exhaustive.size);
  assert.ok(classifyPaths(["apps/nexora/scripts/compile-ui.mjs"]).exhaustive.size);
});

test("module non 3D : scénario 2D seul", () => {
  const r = impact(SOURCE, edit("return <div className=\"lp-task-list lp-btn\">", "return <div className=\"lp-task-list lp-btn is-new\">"));
  assert.deepEqual(r.scenarios, ["2d"]);
});

test("moteur de rendu 3D : sa vue, et la campagne exhaustive est signalée", () => {
  const r = impact(SOURCE, edit("return { three: THREE };", "return { three: THREE, fog: true };"));
  assert.deepEqual(r.scenarios, ["fleuve"]);
  assert.equal(r.exhaustive.length, 1);
});

test("dépendance commune : 2D et, de proche en proche, les vues 3D qui l'utilisent", () => {
  const r = impact(SOURCE, edit("  return d;\n", "  return d || null;\n"));
  // fmtDue → carteLabel (Carte) → CosmosView (Cosmos) ; TaskList (2D).
  assert.deepEqual(r.scenarios, ["2d", "carte", "cosmos"]);
});

test("CSS : classe d'une vue, classe partagée, règle globale", () => {
  assert.deepEqual(impact(SOURCE, edit(".lp-fleuve-view{ color:blue; }", ".lp-fleuve-view{ color:navy; }")).scenarios, ["fleuve"]);
  // Sélecteur composé : l'intersection ne garde que Cosmos.
  assert.deepEqual(impact(SOURCE, edit(".lp-cosmos-stage .lp-btn{ color:green; }", ".lp-cosmos-stage .lp-btn{ color:lime; }")).scenarios, ["cosmos"]);
  // Classe commune au 2D et à plusieurs vues 3D : une vue 3D représentative.
  assert.deepEqual(impact(SOURCE, edit(".lp-btn{ color:red; }", ".lp-btn{ color:orange; }")).scenarios, ["2d", "carte"]);
  assert.deepEqual(impact(SOURCE, edit("body{ margin:0; }", "body{ margin:1px; }")).scenarios, ["2d", "carte"]);
  assert.deepEqual(impact(SOURCE, edit(".lp-task-list .row-3{ color:red; }", ".lp-task-list .row-3{ color:pink; }")).scenarios, ["2d"]);
});

test("ajout, suppression et renommage de déclarations", () => {
  const added = impact(SOURCE, edit("function TaskList() {", "function cosmosOrbit() {\n  return 1;\n}\nfunction TaskList() {"));
  assert.deepEqual(added.scenarios, ["cosmos"]);
  const removed = impact(SOURCE, edit("function Reunions3DView() {\n  return <div className=\"lp-reu-view lp-btn\" />;\n}\n", ""));
  assert.deepEqual(removed.scenarios, ["reunions3d"]);
  const renamed = impact(SOURCE, edit("function carteLabel(t) {", "function carteTitle(t) {").replace("{carteLabel(x)}", "{carteTitle(x)}"));
  assert.deepEqual(renamed.scenarios, ["carte", "cosmos"]);
  // Fragment renommé ou redécoupé sans changement de contenu : rien à rejouer.
  assert.deepEqual(impact(SOURCE, SOURCE).scenarios, []);
});

test("instruction de premier niveau ou import : prudence, toutes les vues", () => {
  assert.deepEqual(impact(SOURCE, edit("root.render(<App />);", "root.render(<App mode=\"x\" />);")).scenarios, ["2d", "carte", "cosmos", "fleuve", "reunions3d"]);
  assert.deepEqual(impact(SOURCE, edit("import React from 'https://esm.sh/react@18.2.0';", "import React from 'https://esm.sh/react@18.3.0';")).scenarios, ["2d", "carte", "cosmos", "fleuve", "reunions3d"]);
});

test("harness.jsx : scénarios 2D, données d'une vue, données communes", () => {
  const H = [
    "function AnnotationsHarness() {", "  return null;", "}",
    "const root = createRoot(document.getElementById('root'));",
    "if (benchApp) {", "  const benchTasks = [];",
    "  if (benchParams.get(\"carte\") === \"demo\") {", "    carteData();",
    "  } else if (benchParams.get(\"reunions\") === \"demo\") {", "    reuData();",
    "  }", "}", "function BenchApp() {", "  return null;", "}",
  ].join("\n");
  const run = (from, to) => [...harnessImpact(H, H.replace(from, to), hunks(H, H.replace(from, to))).scenarios].sort();
  assert.deepEqual(run("  return null;\n}\nconst root", "  return 1;\n}\nconst root"), ["2d"]);
  assert.deepEqual(run("    reuData();", "    reuData(2);"), ["reunions3d"]);
  assert.deepEqual(run("  const benchTasks = [];", "  const benchTasks = [1];"), ["2d", "carte", "cosmos", "fleuve", "reunions3d"]);
});

test("diff indisponible : sélection prudente, jamais vide", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "affected-nogit-"));
  try {
    const r = computeAffected({ root: dir });
    assert.equal(r.prudent, true);
    assert.deepEqual(r.scenarios, ["2d", "carte", "cosmos", "reunions3d", "fleuve"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lancement manuel : portée explicite, défaut exhaustif, rien d'inconnu", () => {
  const all = parseScope([], {});
  assert.equal(all.exhaustive, true);
  assert.deepEqual(all.notRun, []);
  const one = parseScope(["--only=carte", "--depth=cible"], {});
  assert.deepEqual([...one.only], ["carte"]);
  assert.equal(one.full, false);
  assert.equal(one.exhaustive, false);
  // Ce qui n'est pas exécuté est listé : les autres scénarios et les sous-parcours exhaustifs de la Carte.
  assert.equal(one.notRun.length, 5);
  assert.deepEqual([...parseScope([], { VISUAL_ONLY: "2d" }).only], ["2d"]);
  assert.throws(() => parseScope(["--only=carte,timeline3d"], {}), /inconnu/);
  assert.throws(() => parseScope(["--depth=rapide"], {}), /inconnue/);
});

// Tout fichier suivi doit être classé (#544) : un nouvel outil ou dossier non
// répertorié élargirait chaque sélection par prudence, sans que personne ne
// décide de sa place.
test("inventaire : chaque fichier du dépôt correspond à une règle du sélecteur", async () => {
  const { execFileSync } = await import("node:child_process");
  const { PATH_RULES } = await import("./affected.mjs");
  const racine = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const fichiers = execFileSync("git", ["ls-files"], { cwd: racine, encoding: "utf8" }).split("\n").filter(Boolean);
  const orphelins = fichiers.filter((f) => !PATH_RULES.some(([re]) => re.test(f)));
  assert.deepEqual(orphelins, [], `fichiers non classés dans PATH_RULES : ${orphelins.join(", ")}`);
});
