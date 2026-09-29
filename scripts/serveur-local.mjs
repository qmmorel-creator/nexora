// Serveur local Nexora — mode UI léger (Ref #544).
//
//   npm run local            construit l'interface en environnement « local » puis la sert
//   npm run local -- --sans-build   sert la dernière construction locale
//
// Lié à 127.0.0.1 uniquement. Ne sert QUE apps/nexora/dist : racine du dépôt,
// sources, fichiers cachés, variables d'environnement et comptes de service
// sont inaccessibles (404). Aucune fonction Netlify : les appels /api/*
// répondent 503 explicitement. Données fictives dans le navigateur, jamais
// Firebase de production (le build local le garantit et le vérifie).
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { environnement } from "../config/environnements.mjs";

const racine = path.resolve(import.meta.dirname, "..");
const DIST = path.join(racine, "apps", "nexora", "dist");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".png": "image/png", ".glb": "model/gltf-binary",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
};

// Résout un chemin d'URL vers un fichier de DIST, ou null s'il sort du
// périmètre publié (traversée, fichier caché, _headers, encodage douteux).
export function resoudre(urlPath, dist = DIST) {
  let chemin;
  try { chemin = decodeURIComponent(new URL(urlPath, "http://x").pathname); } catch { return null; }
  if (chemin.includes("\0") || chemin.includes("\\")) return null;
  const segments = chemin.split("/").filter(Boolean);
  if (segments.some((s) => s === ".." || s.startsWith(".") || s === "_headers")) return null;
  const cible = path.resolve(dist, ...segments);
  if (cible !== dist && !cible.startsWith(dist + path.sep)) return null;
  return cible;
}

export function creerServeur({ dist = DIST } = {}) {
  return createServer(async (req, res) => {
    const entetes = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
    if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, entetes); res.end(); return; }
    if (/^\/(api|\.netlify)\//.test(req.url)) {
      res.writeHead(503, { ...entetes, "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "Mode UI léger : aucune fonction Netlify en local. Voir docs/PUBLICATION.md (mode intégration)." }));
      return;
    }
    let cible = resoudre(req.url, dist);
    if (cible) {
      try { if ((await stat(cible)).isDirectory()) cible = path.join(cible, "index.html"); } catch { cible = null; }
    }
    if (!cible) { res.writeHead(404, entetes); res.end("Introuvable"); return; }
    try {
      const corps = await readFile(cible);
      res.writeHead(200, { ...entetes, "Content-Type": TYPES[path.extname(cible)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : corps);
    } catch { res.writeHead(404, entetes); res.end("Introuvable"); }
  });
}

const principal = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (principal) {
  const env = environnement("local");
  if (!process.argv.includes("--sans-build")) {
    const r = spawnSync("node", ["scripts/build.mjs"], { cwd: path.join(racine, "apps", "nexora"), stdio: "inherit", env: { ...process.env, NEXORA_ENV: "local" } });
    if (r.status !== 0) process.exit(r.status || 1);
  }
  const version = JSON.parse(await readFile(path.join(DIST, "version.json"), "utf8"));
  if (version.environnement !== "local") {
    console.error(`dist/ contient une construction « ${version.environnement} » : relancer sans --sans-build.`);
    process.exit(1);
  }
  const port = Number(process.env.PORT || env.port);
  creerServeur().listen(port, env.hote, () => console.log(`Nexora LOCAL : http://${env.hote}:${port}/ (données fictives, sans fonctions)`));
}
