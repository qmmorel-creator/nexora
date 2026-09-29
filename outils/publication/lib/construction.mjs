// Construction d'un composant à un SHA exact, dans un worktree temporaire —
// Ref #544. Dépendances verrouillées (npm ci), configuration d'environnement
// explicite, aucune modification de la branche courante.
import { mkdtemp, rm, readFile, writeFile, cp, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { COMPOSANTS, environnement } from "../../../config/environnements.mjs";

// Fichiers qui prouvent qu'un commit porte le mécanisme d'environnement.
// Sans eux, une construction hors production pourrait garder des liens ou
// des accès vers la production : elle est refusée.
export const FICHIERS_MECANISME = ["config/environnements.mjs", "apps/nexora/scripts/environnement.mjs", "publication/version.json"];

export function verifierMecanisme(git, sha) {
  const manquants = FICHIERS_MECANISME.filter((f) => git.fichier(sha, f) === null);
  if (manquants.length) {
    throw new Error(`Le commit ${sha.slice(0, 12)} est antérieur au mécanisme d'environnements (absents : ${manquants.join(", ")}). Préproduction refusée : ses liens ou accès pourraient viser la production.`);
  }
}

function lancer(commande, args, cwd, env = {}) {
  const r = spawnSync(commande, args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env: { ...process.env, ...env }, maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error(`${commande} ${args.join(" ")} (dans ${path.basename(cwd)}) a échoué :\n${(r.stderr || r.stdout || "").slice(-1500)}`);
  return r.stdout;
}

// Construit `composant` au commit `sha` pour l'environnement `nomEnv`.
// Retourne { dossier, fonctions: [...] | null, meta, nettoyer() }.
export async function construire({ git, sha, composant, nomEnv, avecFonctions, journal = () => {} }) {
  const env = environnement(nomEnv);
  const def = COMPOSANTS[composant];
  verifierMecanisme(git, sha);
  const travail = await mkdtemp(path.join(tmpdir(), `nexora-${composant}-${nomEnv}-`));
  const arbre = path.join(travail, "source");
  const nettoyer = async () => { git.retirerWorktree(arbre); await rm(travail, { recursive: true, force: true }); };
  try {
    journal(`worktree ${sha.slice(0, 12)} → ${arbre}`);
    git.ajouterWorktree(arbre, sha);
    const base = path.join(arbre, def.base);
    const version = JSON.parse(await readFile(path.join(arbre, "publication", "version.json"), "utf8")).version;
    const meta = {
      produit: "nexora", composant, version, environnement: env.nom, commit: sha, branche: "detachee",
      // Date du commit : reconstruire le même candidat produit les mêmes octets.
      dateConstruction: git.dateCommit(sha),
    };
    journal(`npm ci (${def.base})`);
    lancer("npm", ["ci", "--no-audit", "--no-fund"], base);
    let dossier;
    if (composant === "application") {
      journal(`construction ${env.nom}`);
      lancer("node", ["scripts/build.mjs"], base, {
        NEXORA_ENV: env.nom, NEXORA_COMMIT: sha, NEXORA_BRANCHE: meta.branche, NEXORA_DATE_CONSTRUCTION: meta.dateConstruction,
      });
      dossier = path.join(base, def.publie);
      const servi = JSON.parse(await readFile(path.join(dossier, "version.json"), "utf8"));
      for (const cle of ["version", "environnement", "commit"]) {
        if (servi[cle] !== meta[cle]) throw new Error(`version.json construit incohérent (${cle} = ${servi[cle]}, attendu ${meta[cle]}).`);
      }
    } else {
      // Le MCP n'a pas d'étape de build : ses fichiers publics sont copiés tels
      // quels, avec leurs métadonnées de version.
      if (env.nom !== "production") throw new Error("Aucun MCP hors production tant qu'un projet Firebase et des secrets de test distincts n'existent pas (voir docs/PUBLICATION.md).");
      dossier = path.join(travail, "public");
      await cp(path.join(base, def.publie), dossier, { recursive: true });
      await writeFile(path.join(dossier, "version.json"), JSON.stringify(meta, null, 2) + "\n");
    }
    let fonctions = null;
    if (avecFonctions) {
      if (!env.fonctions) throw new Error(`Environnement ${env.nom} : dépôt de fonctions interdit (secrets de production servis à tous les contextes des projets existants).`);
      fonctions = await empaqueterFonctions({ base, arbre, sortie: path.join(travail, "fonctions"), journal });
    }
    return { dossier, fonctions, meta, travail, nettoyer };
  } catch (e) {
    await nettoyer();
    throw e;
  }
}

async function empaqueterFonctions({ base, arbre, sortie, journal }) {
  const module = path.join(import.meta.dirname, "..", "node_modules", "@netlify", "zip-it-and-ship-it", "dist", "main.js");
  try { await access(module); } catch {
    throw new Error("Empaqueteur de fonctions absent : lancer une fois `npm ci --prefix outils/publication` (hors CI).");
  }
  const { zipFunctions } = await import(module);
  journal("empaquetage des fonctions (zip-it-and-ship-it)");
  const resultats = await zipFunctions([path.join(base, "netlify", "functions")], sortie, {
    basePath: base, repositoryRoot: arbre, config: { "*": { nodeBundler: "esbuild" } }, featureFlags: {},
  });
  if (!resultats.length) throw new Error("Aucune fonction empaquetée : périmètre incohérent.");
  return resultats.map((f) => ({
    nom: f.name, chemin: f.path, runtime: f.runtime, schedule: f.schedule || null, routes: f.routes || [],
    routesExclues: f.excludedRoutes || [], donnees: f.buildData || null, priorite: f.priority ?? null,
    modeInvocation: f.invocationMode || null, generateur: f.generator || null, nomAffiche: f.displayName || null,
  }));
}
