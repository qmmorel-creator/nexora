// Garde-fous des environnements et de la CI — Ref #544.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { decider, RESTAURATION } from "../scripts/netlify-ignore.mjs";
import { classer, empreinteSocle } from "../scripts/ci-perimetre.mjs";
import { resoudre, creerServeur } from "../scripts/serveur-local.mjs";
import { fumer } from "../scripts/smoke-environnement.mjs";
import { appliquerEnvironnement, entetes, metadonnees } from "../apps/nexora/scripts/environnement.mjs";
import { validerRegistre } from "../outils/publication/lib/registre.mjs";

const REPO = path.resolve(import.meta.dirname, "..");

test("ignore Netlify : aucun build Git de production, de preview ni de branche par défaut", () => {
  assert.equal(decider({ contexte: "production" }).construire, false);
  assert.equal(decider({ contexte: "production", restauration: "oui" }).construire, false, "seule la valeur exacte restaure");
  assert.equal(decider({ contexte: "deploy-preview" }).construire, false);
  assert.equal(decider({ contexte: "deploy-preview", messageCommit: "x [apercu]" }).construire, false, "[apercu] ne donne jamais accès aux secrets");
  assert.equal(decider({ contexte: "branch-deploy" }).construire, false);
  assert.equal(decider({ contexte: undefined }).construire, false);
  assert.equal(decider({ contexte: "production", restauration: RESTAURATION, diffVide: false }).construire, true);
  assert.equal(decider({ contexte: "production", restauration: RESTAURATION, diffVide: true }).construire, false);
  assert.equal(decider({ contexte: "production", restauration: RESTAURATION, diffVide: null }).construire, true, "diff inconnu : repli sûr = construire, uniquement en restauration");
});

test("netlify.toml : les deux sites passent par la commande ignore commune", () => {
  for (const f of ["apps/nexora/netlify.toml", "apps/nexora-mcp/netlify.toml"]) {
    const toml = readFileSync(path.join(REPO, f), "utf8");
    assert.match(toml, /ignore = "node \.\.\/\.\.\/scripts\/netlify-ignore\.mjs"/, f);
    assert.doesNotMatch(toml, /git diff --quiet/, `${f} : l'ancienne règle par dossier ne doit plus décider seule`);
  }
});

test("CI : pas de push de branche de travail, verdict final, runs de main jamais annulés", () => {
  const ci = readFileSync(path.join(REPO, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /branches: \[main, develop\]/);
  assert.doesNotMatch(ci, /claude\/\*\*'|codex\/\*\*'/);
  assert.match(ci, /workflow_dispatch:/);
  assert.match(ci, /cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}/);
  assert.match(ci, /\n  verdict:\n/);
  assert.match(ci, /if: always\(\)/);
  assert.doesNotMatch(ci, /NETLIFY_AUTH_TOKEN|netlify deploy|secrets\./, "la CI ne publie pas et ne reçoit aucun secret Netlify");
});

test("périmètre CI : documentation connue sans socle ; CI, dépendances, outils et chemins inconnus avec socle", () => {
  assert.equal(classer(["docs/PUBLICATION.md", "README.md", "publication/registre.json"]).verifier, false);
  for (const c of [".github/workflows/ci.yml", "apps/nexora/package-lock.json", "tools/visual-check/affected.mjs", "outils/publication/cli.mjs", "nouveau/dossier.txt", "scripts/ci-perimetre.mjs", "config/environnements.mjs"]) {
    assert.equal(classer([c]).verifier, true, c);
  }
  assert.equal(classer([]).verifier, true, "aucun chemin : prudence");
  const arbre = ["100644 blob a\tapps/x.mjs", "100644 blob b\tdocs/y.md", "100644 blob c\tpublication/registre.json"];
  const e = empreinteSocle(arbre, "22");
  assert.equal(empreinteSocle(["100644 blob a\tapps/x.mjs", "100644 blob Z\tdocs/y.md", "100644 blob Z\tpublication/registre.json"], "22"), e, "doc et registre hors empreinte");
  assert.notEqual(empreinteSocle(arbre, "24"), e, "changement de moteur : preuve invalidée");
  assert.notEqual(empreinteSocle(["100644 blob Z\tapps/x.mjs"], "22"), e);
});

test("serveur local : seules les sorties publiées sont servies", async () => {
  const dist = mkdtempSync(path.join(tmpdir(), "nexora-dist-"));
  writeFileSync(path.join(dist, "index.html"), "<html>LOCAL</html>");
  writeFileSync(path.join(dist, "_headers"), "/*\n");
  mkdirSync(path.join(dist, ".cache"));
  writeFileSync(path.join(dist, ".cache", "x"), "secret");
  // Jamais hors de dist : soit refusé, soit ramené à l'intérieur (puis 404 s'il n'existe pas).
  for (const u of ["/../package.json", "/%2e%2e/%2e%2e/.env", "/..%2f..%2fpackage.json", "/..%5c..%5cetc", "/%00"]) {
    const r = resoudre(u, dist);
    assert.ok(r === null || r.startsWith(dist + path.sep), `${u} → ${r}`);
  }
  for (const u of ["/.cache/x", "/_headers", "/%2e%2e/%2e%2e/.env"]) assert.equal(resoudre(u, dist), null, u);
  assert.equal(resoudre("/index.html", dist), path.join(dist, "index.html"));
  const serveur = creerServeur({ dist });
  await new Promise((r) => serveur.listen(0, "127.0.0.1", r));
  const { port } = serveur.address();
  const get = async (p) => (await fetch(`http://127.0.0.1:${port}${p}`)).status;
  try {
    assert.equal(await get("/"), 200);
    assert.equal(await get("/api/nexora/health"), 503);
    assert.equal(await get("/.cache/x"), 404);
    assert.equal(await get("/_headers"), 404);
    assert.equal(await get("/..%2f..%2fpackage.json"), 404);
    const r = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(r.headers.get("x-robots-tag"), "noindex, nofollow");
  } finally { serveur.close(); }
});

test("fumée hors production : refuse une origine de production et échoue si la production répond", async () => {
  await assert.rejects(fumer({ env: "preproduction", url: "https://nexora-project.org" }), /origine de production/);
  await assert.rejects(fumer({ env: "production" }), /smoke:production/);
  const reponses = {
    "/version.json": { statut: 200, donnees: { composant: "application", environnement: "production", commit: "x" } },
    "/": { statut: 200, texte: '<script type="module"> nexora-cb20d' },
    "/api/nexora/health": { statut: 200, donnees: { ok: true } },
  };
  const lire = async (url) => reponses[new URL(url).pathname] || { statut: 200, texte: "openapi:" };
  const r = await fumer({ env: "preproduction", url: "https://copie.exemple.invalid", lire });
  assert.equal(r.ok, false);
  const echecs = r.resultats.filter((x) => !x.ok).map((x) => x.nom);
  for (const n of ["version.json", "aucune référence Firebase de production", "aucune fonction servie (isolation)"]) assert.ok(echecs.includes(n), n);
});

test("build : hors production, Firebase réel absent, stockage fictif, bandeau et noindex ; production inchangée", () => {
  const html = `<html><head>\n<meta charset="UTF-8"/>\n</head><body>\n<script>\nwindow.__FIREBASE_CONFIG__ = {\n  projectId: "nexora-cb20d",\n};\n</script>\n<script type="module">\nimport { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';\nimport { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';\nimport { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';\nwindow.storage = window.location.protocol === "file:"\n  ? a : b;\n</script>\n</body></html>`;
  const sha = "a".repeat(40);
  const pre = appliquerEnvironnement(html, metadonnees({ env: "preproduction", version: "0.1.0", commit: sha, dateConstruction: "x" }));
  assert.doesNotMatch(pre, /nexora-cb20d|gstatic\.com\/firebasejs/);
  assert.match(pre, /\/__demo\/firebase-demo\.js/);
  assert.match(pre, /<script src="\/__demo\/stockage-demo\.js"><\/script>\n<script>\nwindow\.__FIREBASE_CONFIG__ = \{ projectId: "demo-nexora"/);
  assert.match(pre, /window\.storage = window\.__nexoraStockageDemo \? window\.__nexoraStockageDemo :/);
  assert.match(pre, /PRÉPRODUCTION · 0\.1\.0 · aaaaaaa/);
  assert.match(pre, /<meta name="robots" content="noindex, nofollow"\/>/);
  const prod = appliquerEnvironnement(html, metadonnees({ env: "production", version: "0.1.0", commit: sha, dateConstruction: "x" }));
  assert.equal(prod, html.replace('<meta charset="UTF-8"/>', `<meta charset="UTF-8"/>\n<meta name="nexora-version" content="0.1.0 ${sha}"/>`), "production : seule la balise de version s'ajoute");
  assert.match(entetes("preproduction"), /X-Robots-Tag: noindex, nofollow/);
  assert.doesNotMatch(entetes("production"), /noindex/);
  // Une cible de substitution disparue fait échouer le build au lieu de laisser la production joignable.
  assert.throws(() => appliquerEnvironnement(html.replace("window.storage = window.location", "window.storage= window.location"), metadonnees({ env: "local", version: "0.1.0", commit: sha, dateConstruction: "x" })), /Construction refusée/);
  assert.throws(() => metadonnees({ env: "preprod", version: "0.1.0", commit: sha }), /Environnement inconnu/);
  assert.throws(() => metadonnees({ env: "local", version: "0.1.0", commit: "abc" }), /SHA complet/);
});

test("registre versionné : valide, sans secret, état initial non versionné", () => {
  const r = validerRegistre(JSON.parse(readFileSync(path.join(REPO, "publication/registre.json"), "utf8")));
  for (const c of Object.values(r.composants)) assert.equal(c.version, "initial");
  assert.throws(() => validerRegistre({ ...r, fuite: "Bearer abc" }), /contenu interdit/);
  assert.throws(() => validerRegistre({ format: 1, composants: { application: { commit: "x", deployId: "y", statut: "?" } }, historique: [] }), /Registre incohérent/);
});
