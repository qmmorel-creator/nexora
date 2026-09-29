// Commande `ignore` des deux projets Netlify — Ref #544.
//
// Second garde-fou, versionné, derrière l'arrêt des builds Git dans Netlify.
// Code de sortie 0 = Netlify SAUTE la construction ; 1 = il construit.
//
//   • contexte production (build Git sur main) : toujours sauté. La production
//     ne se publie plus que par `outils/publier production`, après feu vert.
//   • Deploy Preview, branch deploy et tout autre contexte : sautés. Les
//     projets existants servent les secrets de production à TOUS les
//     contextes : un aperçu construit par Netlify ne serait pas isolé. Un
//     commit marqué [apercu] est seulement signalé ; l'aperçu se fait par
//     `outils/publier preproduction` (données fictives, sans fonctions).
//
// Retour à l'ancien fonctionnement (build à chaque fusion) : variable Netlify
// NEXORA_BUILDS_GIT_PRODUCTION=ancien-fonctionnement, réservée à une
// restauration explicitement demandée. Désactivée par défaut, ce n'est pas le
// chemin normal de release. Même alors, un site dont les fichiers n'ont pas
// changé n'est pas reconstruit (ancienne règle par dossier, étendue aux
// fichiers partagés).
import { execFileSync } from "node:child_process";

export const MARQUEUR_APERCU = "[apercu]";
export const RESTAURATION = "ancien-fonctionnement";
// Fichiers hors du dossier de l'application qui changent son résultat.
export const PARTAGES = ["config/environnements.mjs", "publication/version.json"];

export function decider({ contexte, restauration, messageCommit = "", diffVide }) {
  if (contexte === "production") {
    if (restauration !== RESTAURATION) return { construire: false, raison: "build Git de production désactivé : publication par outils/publier uniquement" };
    if (diffVide === true) return { construire: false, raison: "ancien fonctionnement : aucun fichier du site modifié" };
    return { construire: true, raison: "ancien fonctionnement explicitement restauré" };
  }
  if (messageCommit.includes(MARQUEUR_APERCU)) return { construire: false, raison: "[apercu] noté : utiliser outils/publier preproduction (Netlify servirait ici les secrets de production)" };
  return { construire: false, raison: `contexte « ${contexte || "inconnu"} » : aucun build Git` };
}

const principal = process.argv[1] && import.meta.filename && process.argv[1].endsWith("netlify-ignore.mjs");
if (principal) {
  const env = process.env;
  const git = (args) => { try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
  let diffVide = null;
  if (env.CACHED_COMMIT_REF && env.COMMIT_REF) {
    const racine = git(["rev-parse", "--show-toplevel"]);
    // « . » = base directory du site ; les fichiers partagés en plus.
    const r = git(["diff", "--name-only", env.CACHED_COMMIT_REF, env.COMMIT_REF, "--", ".", ...PARTAGES.map((p) => `${racine}/${p}`)]);
    diffVide = r === null ? null : r === "";
  }
  const d = decider({ contexte: env.CONTEXT, restauration: env.NEXORA_BUILDS_GIT_PRODUCTION, messageCommit: git(["log", "-1", "--format=%B"]) || "", diffVide });
  console.log(`[nexora ignore] ${d.construire ? "construction" : "construction sautée"} — ${d.raison}`);
  process.exit(d.construire ? 1 : 0);
}
