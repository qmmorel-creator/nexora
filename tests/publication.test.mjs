// Tests de l'outil de publication — Ref #544.
// API Netlify, HTTP et GitHub factices ; dépôt Git temporaire avec son
// « origin ». Aucun scénario de refus ne publie quoi que ce soit de réel.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import * as commandes from "../outils/publication/commandes.mjs";
import { creerGit } from "../outils/publication/lib/git.mjs";
import { empreinteComposant } from "../outils/publication/lib/empreinte.mjs";
import { evaluerVerdict } from "../outils/publication/lib/verdict.mjs";
import { creerClientNetlify, ErreurNetlify } from "../outils/publication/lib/netlify.mjs";
import { retrouverCandidat } from "../outils/publication/lib/depot.mjs";
import { COMPOSANTS } from "../config/environnements.mjs";

const REPO = path.resolve(import.meta.dirname, "..");
const APP = COMPOSANTS.application.netlifyId;
const MCP = COMPOSANTS.mcp.netlifyId;
const id = (n) => n.toString(16).padStart(24, "0");

function sh(cwd, ...args) { return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }

// Dépôt minimal portant le mécanisme : config, source de version, changelog,
// un fichier par composant.
function depotTemporaire() {
  const dir = mkdtempSync(path.join(tmpdir(), "nexora-pub-"));
  const distant = path.join(dir, "origin.git");
  const local = path.join(dir, "local");
  sh(dir, "init", "--bare", "-q", distant);
  sh(dir, "init", "-q", "-b", "main", local);
  sh(local, "config", "user.email", "test@exemple.invalid");
  sh(local, "config", "user.name", "Test");
  sh(local, "remote", "add", "origin", distant);
  const ecrire = (f, c) => { mkdirSync(path.dirname(path.join(local, f)), { recursive: true }); writeFileSync(path.join(local, f), c); };
  cpSync(path.join(REPO, "config"), path.join(local, "config"), { recursive: true });
  ecrire("apps/nexora/scripts/environnement.mjs", "// mécanisme\n");
  ecrire("apps/nexora/source/index.html.part-000", "<html>v1</html>\n");
  ecrire("apps/nexora-mcp/src/tools.mts", "export const v = 1;\n");
  ecrire("publication/version.json", '{ "version": "0.1.0-dev" }\n');
  ecrire("CHANGELOG.md", "# Journal\n\n## À venir\n\n### Nouveautés\n\n- Première version officielle.\n\n### Corrections\n\n### Incompatibilités\n\n## État initial (non versionné)\n\nRelevé.\n");
  ecrire("docs/guide.md", "doc\n");
  ecrire("publication/registre.json", JSON.stringify(registreInitial(), null, 2));
  sh(local, "add", "-A");
  sh(local, "commit", "-q", "-m", "initial");
  sh(local, "push", "-q", "origin", "main");
  return { dir, local, ecrire, commit: (m) => { sh(local, "add", "-A"); sh(local, "commit", "-q", "-m", m); sh(local, "push", "-q", "origin", "HEAD:main"); return sh(local, "rev-parse", "HEAD"); } };
}

function registreInitial() {
  const c = (commit, deployId) => ({ version: "initial", commit, empreinte: null, deployId, publieLe: "2026-09-29T00:00:00Z", statut: "initial-non-versionne", precedent: null });
  return {
    format: 1,
    composants: { application: c("a".repeat(40), id(1)), mcp: c("b".repeat(40), id(2)) },
    historique: [
      { type: "initial", version: "initial", composant: "application", deployId: id(1), commit: "a".repeat(40), statut: "initial-non-versionne" },
      { type: "initial", version: "initial", composant: "mcp", deployId: id(2), commit: "b".repeat(40), statut: "initial-non-versionne" },
    ],
  };
}

// API Netlify factice : état en mémoire, journal des appels.
function apiFactice({ stopBuilds = true, verrou = false } = {}) {
  let suivant = 100;
  const sites = {
    [APP]: { name: "nexora-project", build_settings: { stop_builds: stopBuilds, allowed_branches: ["main"], skip_prs: true }, published_deploy: { id: id(1), locked: verrou } },
    [MCP]: { name: "nexora-chatgpt-mcp", build_settings: { stop_builds: stopBuilds, allowed_branches: ["main"], skip_prs: true }, published_deploy: { id: id(2), locked: false } },
  };
  const deploys = { [id(1)]: { id: id(1), site: APP, state: "ready" }, [id(2)]: { id: id(2), site: MCP, state: "ready" } };
  const appels = [];
  return {
    appels, sites, deploys,
    site: async (s) => structuredClone(sites[s]),
    deploiement: async (d) => structuredClone(deploys[d]),
    deploiements: async (s) => Object.values(deploys).filter((d) => d.site === s).reverse().map((d) => structuredClone(d)),
    creerDeploiement: async (s, p) => { appels.push(["creer", s, p.title, p.draft, p.branch || null]); const d = id(suivant++); deploys[d] = { id: d, site: s, state: "ready", title: p.title, draft: p.draft, branch: p.branch, required: [], required_functions: [] }; return deploys[d]; },
    envoyerFichier: async () => {}, envoyerFonction: async () => {},
    publier: async (s, d) => { appels.push(["publier", s, d]); sites[s].published_deploy = { id: d, locked: false }; },
    modifierSite: async (s, corps) => { appels.push(["modifier", s, corps]); Object.assign(sites[s].build_settings, corps.build_settings); },
  };
}

// HTTP factice : chaque URL de déploiement renvoie les métadonnées du dépôt
// correspondant ; la production renvoie celles du deploy publié.
function lecteurFactice(api, metaParDeploy) {
  return async (url) => {
    const u = new URL(url);
    const hote = u.hostname;
    let deployId = null;
    const m = /^([0-9a-f]{24})--/.exec(hote);
    if (m) deployId = m[1];
    else if (hote.startsWith("preprod--")) deployId = Object.values(api.deploys).filter((d) => d.branch === "preprod").pop()?.id;
    else if (hote === "nexora-project.org") deployId = api.sites[APP].published_deploy.id;
    else if (hote === "nexora-chatgpt-mcp.netlify.app") deployId = api.sites[MCP].published_deploy.id;
    const meta = metaParDeploy.get(deployId);
    const prod = meta?.environnement === "production";
    if (u.pathname === "/version.json") return meta ? { statut: 200, donnees: meta, texte: JSON.stringify(meta) } : { statut: 404, donnees: null };
    if (u.pathname === "/") return { statut: 200, texte: prod ? '<script type="module">' : '<meta name="robots" content="noindex"><script type="module"><div id="nexora-bandeau-environnement">', entetes: prod ? {} : { "x-robots-tag": "noindex, nofollow" } };
    if (u.pathname === "/api/nexora/health") return prod ? { statut: 200, donnees: { ok: true, projectId: "nexora-cb20d" } } : { statut: 404 };
    if (u.pathname === "/health") return { statut: 200, donnees: { ok: true, service: "nexora-mcp" } };
    if (u.pathname.startsWith("/.well-known")) return { statut: 200, donnees: { issuer: "https://nexora-chatgpt-mcp.netlify.app" } };
    if (u.pathname === "/openapi.yaml") return { statut: 200, texte: "openapi: 3.1.0" };
    return { statut: 200, texte: "ok" };
  };
}

function dependances(depot, { api = apiFactice(), verdict = { ok: true, url: "https://ci/1" } } = {}) {
  const metaParDeploy = new Map();
  const git = creerGit(depot.local);
  const d = {
    racine: depot.local, git, api, env: {}, essai: false, journal: () => {}, attendre: async () => {},
    maintenant: () => "2026-09-30T10:00:00.000Z",
    verdict: async () => verdict,
    lire: null,
    commits: [],
    tags: [],
    constructions: [],
    construire: async ({ sha, composant, nomEnv, avecFonctions }) => {
      d.constructions.push([composant, nomEnv, avecFonctions]);
      const dossier = mkdtempSync(path.join(tmpdir(), "nexora-dist-"));
      writeFileSync(path.join(dossier, "index.html"), `${composant} ${nomEnv}`);
      const version = JSON.parse(git.fichier(sha, "publication/version.json")).version;
      d.derniereMeta = { produit: "nexora", composant, version, environnement: nomEnv, commit: sha };
      return { dossier, fonctions: avecFonctions ? [] : null, meta: d.derniereMeta, nettoyer: async () => {} };
    },
    committerRegistre: async (contenu, message) => { d.commits.push({ contenu: JSON.parse(contenu), message }); return { ok: true }; },
    creerTagEtRelease: async ({ version, sha }) => { d.tags.push([version, sha]); return `v${version} créé`; },
  };
  // Associe chaque nouveau dépôt aux métadonnées de la construction qui l'a produit.
  const creer = api.creerDeploiement;
  api.creerDeploiement = async (s, p) => { const r = await creer(s, p); metaParDeploy.set(r.id, d.derniereMeta); return r; };
  d.lire = lecteurFactice(api, metaParDeploy);
  d.metaParDeploy = metaParDeploy;
  return d;
}

async function candidatPret(depot, d, version = "0.1.0") {
  d.essai = false;
  await commandes.preparer(d, { version, date: "2026-09-30" });
  const sha = depot.commit(`Version ${version}`);
  await commandes.preproduction(d, { ref: "main" });
  return sha;
}

test("empreinte : registre, source de version et documentation ne changent pas l'empreinte d'un composant", () => {
  const depot = depotTemporaire();
  const git = creerGit(depot.local);
  const avant = { app: empreinteComposant(git, git.sha("HEAD"), "application"), mcp: empreinteComposant(git, git.sha("HEAD"), "mcp") };
  depot.ecrire("publication/registre.json", JSON.stringify({ ...registreInitial(), note: "x" }));
  depot.ecrire("publication/version.json", '{ "version": "0.2.0" }\n');
  depot.ecrire("docs/guide.md", "doc modifiée\n");
  const sha = depot.commit("registre, version, doc");
  assert.equal(empreinteComposant(git, sha, "application"), avant.app);
  assert.equal(empreinteComposant(git, sha, "mcp"), avant.mcp);
  depot.ecrire("apps/nexora/source/index.html.part-000", "<html>v2</html>\n");
  const sha2 = depot.commit("interface");
  assert.notEqual(empreinteComposant(git, sha2, "application"), avant.app);
  assert.equal(empreinteComposant(git, sha2, "mcp"), avant.mcp, "une modification de l'interface seule ne touche pas le MCP");
});

test("verdict : succès exigé sur le SHA exact ; skipped ignoré, jamais pris pour un succès", () => {
  const sha = "c".repeat(40);
  const run = (conclusion, status = "completed", date = "2026-09-30T10:00:00Z", s = sha) => ({ name: "verdict", head_sha: s, status, conclusion, started_at: date, app: { slug: "github-actions" } });
  assert.equal(evaluerVerdict([], sha).ok, false);
  assert.equal(evaluerVerdict([run("skipped")], sha).ok, false);
  assert.equal(evaluerVerdict([run("success", "completed", "x", "d".repeat(40))], sha).ok, false, "verdict d'un autre SHA");
  assert.equal(evaluerVerdict([run("failure")], sha).ok, false);
  assert.equal(evaluerVerdict([run("cancelled")], sha).ok, false);
  assert.equal(evaluerVerdict([run(null, "in_progress")], sha).ok, false);
  assert.equal(evaluerVerdict([run("success", "completed", "2026-09-30T09:00:00Z"), run("skipped", "completed", "2026-09-30T11:00:00Z")], sha).ok, true, "un skipped plus récent ne masque pas le vrai verdict");
  assert.equal(evaluerVerdict([run("success", "completed", "2026-09-30T09:00:00Z"), run("failure", "completed", "2026-09-30T10:00:00Z")], sha).ok, false, "un échec plus récent l'emporte");
});

test("preproduction : refus d'un commit antérieur au mécanisme, refus du MCP, dépôt en brouillon sous l'alias preprod", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  await assert.rejects(commandes.preproduction(d, { ref: "main", composants: "mcp" }), /MCP : aucune préproduction/);
  const r = await commandes.preproduction(d, { ref: "main" });
  assert.equal(r[0].verification, "vérifiée", JSON.stringify(r[0].details));
  assert.deepEqual(d.api.appels.filter((a) => a[0] === "creer").map((a) => [a[3], a[4]]), [[true, "preprod"]]);
  assert.equal(r[0].productionInchangee, id(1));
  assert.deepEqual(d.constructions[0], ["application", "preproduction", false], "jamais de fonctions en préproduction");
  // Relance sur le même candidat : aucun nouveau dépôt.
  const r2 = await commandes.preproduction(d, { ref: "main" });
  assert.equal(r2[0].deployId, r[0].deployId);
  assert.equal(d.api.appels.filter((a) => a[0] === "creer").length, 1);
  // Commit antérieur au mécanisme.
  execFileSync("git", ["rm", "-q", "config/environnements.mjs"], { cwd: depot.local });
  const ancien = depot.commit("avant mécanisme");
  await assert.rejects(commandes.preproduction(d, { ref: ancien }), /antérieur au mécanisme/);
});

test("production --essai : chaque prérequis manquant est un refus compréhensible, sans aucune modification distante", async () => {
  const depot = depotTemporaire();
  const api = apiFactice({ stopBuilds: false, verrou: true });
  const d = dependances(depot, { api, verdict: { ok: false, raison: "verdict failure sur ccc" } });
  const sha = sh(depot.local, "rev-parse", "HEAD");
  const plan = await commandes.production(d, { version: "0.1.0", commit: sha, essai: true });
  const texte = plan.refus.join("\n");
  assert.equal(plan.verdictFinal, "REFUSÉ");
  assert.match(texte, /version déclarée au commit est « 0\.1\.0-dev »/);
  assert.match(texte, /CHANGELOG\.md n'a pas de section \[0\.1\.0\]/);
  assert.match(texte, /CI : verdict failure/);
  assert.match(texte, /builds Git encore actifs/);
  assert.match(texte, /verrouillé/);
  assert.match(texte, /aucune préproduction du même contenu/);
  assert.equal(api.appels.length, 0, "le mode essai ne modifie rien");
  await assert.rejects(commandes.production(d, { version: "0.1.0", commit: "main" }), /SHA complet/);
});

test("production : commit hors main et tag existant ailleurs refusés", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  const sha = await candidatPret(depot, d);
  sh(depot.local, "checkout", "-q", "-b", "cote");
  depot.ecrire("apps/nexora/source/index.html.part-000", "<html>hors main</html>\n");
  sh(depot.local, "add", "-A"); sh(depot.local, "commit", "-q", "-m", "hors main");
  const hors = sh(depot.local, "rev-parse", "HEAD");
  let plan = await commandes.production(d, { version: "0.1.0", commit: hors, essai: true });
  assert.match(plan.refus.join("\n"), /n'appartient pas à origin\/main/);
  sh(depot.local, "tag", "v0.1.0", hors);
  plan = await commandes.production(d, { version: "0.1.0", commit: sha, essai: true });
  assert.match(plan.refus.join("\n"), /tag v0\.1\.0 existe déjà sur un autre commit/);
});

test("production : feu vert obligatoire et précis ; brouillon permis sans promotion", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  const sha = await candidatPret(depot, d);
  await assert.rejects(commandes.production(d, { version: "0.1.0", commit: sha, composants: "application" }), /feu vert de Quentin absent/);
  await assert.rejects(commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", accord: "oui vas-y" }), /ne mentionne pas la version et le SHA/);
  const b = await commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", brouillon: true });
  assert.equal(b.mode, "brouillon");
  assert.equal(d.api.appels.filter((a) => a[0] === "publier").length, 0, "un brouillon ne promeut rien");
  assert.equal(d.api.sites[APP].published_deploy.id, id(1));
});

test("production : promotion du brouillon vérifié, registre mis à jour, composant inchangé conservé, reprise sans doublon", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  const sha = await candidatPret(depot, d);
  const accord = `Oui, publie la 0.1.0 au commit ${sha.slice(0, 12)} pour l'application.`;
  const r = await commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", accord });
  assert.equal(r.verdictFinal, "publié");
  const app = r.composants.find((c) => c.composant === "application");
  assert.equal(app.statut, "publie-verifie");
  assert.equal(d.api.sites[APP].published_deploy.id, app.deployId);
  assert.equal(d.api.sites[MCP].published_deploy.id, id(2), "le MCP n'est pas republié");
  const reg = d.commits.at(-1).contenu;
  assert.equal(reg.composants.application.version, "0.1.0");
  assert.equal(reg.composants.application.precedent.deployId, id(1));
  assert.equal(reg.composants.mcp.deployId, id(2));
  assert.deepEqual(d.tags, [["0.1.0", sha]], "tag sur le commit source validé");
  assert.match(d.commits.at(-1).message, /Ref #544/);
  // Nouvelle exécution du même candidat : rien à publier (composant inchangé).
  depot.ecrire("publication/registre.json", JSON.stringify(reg, null, 2));
  const plan = await commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", essai: true });
  assert.match(plan.refus.join("\n"), /rien à publier/);
});

test("production : reprise après interruption — le brouillon déjà créé est retrouvé, pas recréé", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  const sha = await candidatPret(depot, d);
  await commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", brouillon: true });
  const creations = d.api.appels.filter((a) => a[0] === "creer").length;
  await commandes.production(d, { version: "0.1.0", commit: sha, composants: "application", accord: `0.1.0 ${sha} application` });
  assert.equal(d.api.appels.filter((a) => a[0] === "creer").length, creations, "aucun second dépôt pour le même candidat");
});

test("production : publication partielle — le premier composant reste inscrit quand le second échoue", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  const sha = await candidatPret(depot, d);
  const publier = d.api.publier;
  d.api.publier = async (s, dep) => { if (s === MCP) throw new ErreurNetlify("HTTP 503", { statut: 503 }); return publier(s, dep); };
  await assert.rejects(commandes.production(d, { version: "0.1.0", commit: sha, composants: "application,mcp", sansRecette: "MCP sans projet de test isolé", accord: `0.1.0 ${sha} application mcp` }), /503/);
  const local = JSON.parse(readFileSync(path.join(depot.local, "publication/registre.json"), "utf8"));
  assert.equal(local.composants.application.version, "0.1.0", "résultat du premier composant conservé immédiatement");
  assert.equal(local.composants.mcp.version, "initial");
  assert.ok(existsSync(path.join(depot.local, "publication/.journal/reprise.jsonl")));
  assert.ok(!existsSync(path.join(depot.local, "publication/.journal/verrou")), "verrou libéré");
});

test("retour : republie le Deploy ID connu sans reconstruction et l'inscrit au registre", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  d.api.sites[APP].published_deploy.id = id(9);
  const essai = await commandes.retour(d, { version: "initial", sites: "application", essai: true });
  assert.deepEqual(essai.cibles.map((c) => c.deployId), [id(1)]);
  assert.equal(d.api.appels.length, 0);
  const r = await commandes.retour(d, { version: "initial", sites: "application" });
  assert.equal(d.api.sites[APP].published_deploy.id, id(1));
  assert.equal(r.cibles[0].statut, "retour-verifie");
  assert.equal(d.constructions.length, 0, "aucune reconstruction");
  assert.equal(d.commits.at(-1).contenu.historique.at(-1).type, "retour");
  await assert.rejects(commandes.retour(d, { version: "9.9.9", sites: "application" }), /aucune publication connue/);
});

test("garde : lit, arrête ; ne rétablit les builds Git que sur demande explicite", async () => {
  const depot = depotTemporaire();
  const api = apiFactice({ stopBuilds: false });
  const d = dependances(depot, { api });
  assert.deepEqual((await commandes.garde(d)).map((g) => g.buildsGitArretes), [false, false]);
  assert.deepEqual((await commandes.garde(d, { arreter: true })).map((g) => g.buildsGitArretes), [true, true]);
  await assert.rejects(commandes.garde(d, { retablir: true }), /demande explicite de Quentin/);
  api.sites[APP].name = "autre-site";
  await assert.rejects(commandes.garde(d), /Cible incohérente/);
});

test("client Netlify : une création dont la réponse est perdue n'est jamais rejouée ; les lectures le sont, bornées", async () => {
  let n = 0;
  const perdu = creerClientNetlify({ jeton: "x", attendre: async () => {}, fetchImpl: async () => { n++; throw new Error("socket hang up"); } });
  await assert.rejects(perdu.creerDeploiement("s", {}), (e) => e.incertain === true);
  assert.equal(n, 1, "POST tenté une seule fois");
  n = 0;
  const lent = creerClientNetlify({ jeton: "x", attendre: async () => {}, fetchImpl: async () => { n++; return n < 3 ? new Response("", { status: 503 }) : new Response('{"id":"ok"}', { status: 200 }); } });
  assert.deepEqual(await lent.site("s"), { id: "ok" });
  assert.equal(n, 3);
  assert.throws(() => creerClientNetlify({ jeton: "" }), /NETLIFY_AUTH_TOKEN absent/);
});

test("reprise : un titre seul ne suffit pas à reconnaître un candidat", () => {
  const e = "e".repeat(64);
  const titre = `v0.1.0 · ${"f".repeat(40)} · application · empreinte:${e.slice(0, 16)}`;
  assert.equal(retrouverCandidat([{ title: titre, state: "error" }], { titre, empreinte: e }), null);
  assert.equal(retrouverCandidat([{ title: titre.replace(e.slice(0, 16), "0".repeat(16)), state: "ready" }], { titre, empreinte: e }), null);
  assert.ok(retrouverCandidat([{ title: titre, state: "ready" }], { titre, empreinte: e }));
});

test("preparer : version déclarée et section datée ; refus d'un « À venir » vide", async () => {
  const depot = depotTemporaire();
  const d = dependances(depot);
  await commandes.preparer(d, { version: "0.1.0", date: "2026-09-30" });
  const log = readFileSync(path.join(depot.local, "CHANGELOG.md"), "utf8");
  assert.match(log, /## \[0\.1\.0\] — 2026-09-30\n[\s\S]*Première version officielle/);
  assert.match(log, /## À venir\n\n### Nouveautés\n\n### Corrections/);
  assert.match(log, /Première version officielle\.\n+## État initial/, "la section suivante n'est pas absorbée");
  assert.equal((log.match(/## État initial/g) || []).length, 1);
  assert.equal(JSON.parse(readFileSync(path.join(depot.local, "publication/version.json"), "utf8")).version, "0.1.0");
  await assert.rejects(commandes.preparer(d, { version: "0.2.0" }), /« À venir » est vide/);
  await assert.rejects(commandes.preparer(d, { version: "1.0" }), /invalide/);
});
