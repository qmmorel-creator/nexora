// Commande `ignore` des deux projets Netlify — Ref #544, #553.
//
// Code de sortie 0 = Netlify SAUTE la construction ; 1 = il construit.
//
//   • contexte production (build Git sur main) : publication systématique à
//     chaque fusion (#553). Un site dont les fichiers n'ont pas changé n'est
//     pas reconstruit (règle par dossier, étendue aux fichiers partagés).
//     Arrêt d'urgence sans commit : variable Netlify
//     NEXORA_BUILDS_GIT_PRODUCTION=arret (ou `outils/publier garde --arreter`).
//   • Deploy Preview, branch deploy et tout autre contexte : sautés. Les
//     projets existants servent les secrets de production à TOUS les
//     contextes : un aperçu construit par Netlify ne serait pas isolé.
import { execFileSync } from "node:child_process";

export const MARQUEUR_APERCU = "[apercu]";
export const ARRET = "arret";
// Fichiers hors du dossier de l'application qui changent son résultat.
export const PARTAGES = ["config/environnements.mjs", "publication/version.json"];

export function decider({ contexte, arret, messageCommit = "", diffVide }) {
  if (contexte === "production") {
    if (arret === ARRET) return { construire: false, raison: "arrêt d'urgence (NEXORA_BUILDS_GIT_PRODUCTION=arret)" };
    if (diffVide === true) return { construire: false, raison: "aucun fichier du site modifié" };
    return { construire: true, raison: "publication systématique de main (#553)" };
  }
  if (messageCommit.includes(MARQUEUR_APERCU)) return { construire: false, raison: "[apercu] ignoré : Netlify servirait ici les secrets de production" };
  return { construire: false, raison: `contexte « ${contexte || "inconnu"} » : aucun build Git` };
}

// Comparaison utilisable seulement entre deux commits DIFFÉRENTS. Au premier
// build d'un site (aucun build antérieur), Netlify fournit CACHED_COMMIT_REF
// égal à COMMIT_REF : le diff serait vide et le site jamais construit (#688).
// Diff inconnu = repli « construire ».
export function refsComparables(precedent, courant) {
  return !!precedent && !!courant && precedent !== courant;
}

const principal = process.argv[1] && import.meta.filename && process.argv[1].endsWith("netlify-ignore.mjs");
if (principal) {
  const env = process.env;
  const git = (args) => { try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; } };
  let diffVide = null;
  if (refsComparables(env.CACHED_COMMIT_REF, env.COMMIT_REF)) {
    const racine = git(["rev-parse", "--show-toplevel"]);
    // « . » = base directory du site ; les fichiers partagés en plus.
    const r = git(["diff", "--name-only", env.CACHED_COMMIT_REF, env.COMMIT_REF, "--", ".", ...PARTAGES.map((p) => `${racine}/${p}`)]);
    diffVide = r === null ? null : r === "";
  }
  const d = decider({ contexte: env.CONTEXT, arret: env.NEXORA_BUILDS_GIT_PRODUCTION, messageCommit: git(["log", "-1", "--format=%B"]) || "", diffVide });
  console.log(`[nexora ignore] ${d.construire ? "construction" : "construction sautée"} — ${d.raison}`);
  process.exit(d.construire ? 1 : 0);
}
