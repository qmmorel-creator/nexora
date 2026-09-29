// Empreintes de périmètre — Ref #544.
//
// Trois notions distinctes, à ne pas confondre :
//   • empreinte de composant : arbre Git des chemins du composant (code servi,
//     dépendances verrouillées, construction, configuration non secrète),
//     hors registre des publications et hors source de version. Elle décide
//     s'il faut republier un composant ET prouve qu'une recette porte sur le
//     même contenu : une préproduction et une production du même composant
//     partagent donc cette empreinte, seul l'environnement diffère.
//   • empreinte de recette : empreinte de composant + environnement +
//     version majeure de Node du constructeur. Elle identifie une préproduction
//     déjà servie pour ne pas la redéposer.
//   • arbre du verdict CI : `git rev-parse <sha>^{tree}`, auquel se rattache
//     le statut `verdict` ; il couvre tout le dépôt, registre compris.
//
// L'écriture du registre seule ne change aucune des deux premières.
import { createHash } from "node:crypto";
import { COMPOSANTS, EXCLUS_EMPREINTE } from "../../../config/environnements.mjs";

// La source de version ne déclenche pas à elle seule de republication : un
// composant inchangé garde sa version, son commit et son Deploy ID antérieurs.
export const EXCLUS_DECISION = [...EXCLUS_EMPREINTE, "publication/version.json"];

export function empreinteComposant(git, sha, composant) {
  const def = COMPOSANTS[composant];
  if (!def) throw new Error(`Composant inconnu : « ${composant} ».`);
  const lignes = git.arbre(sha, def.chemins)
    .filter((l) => !EXCLUS_DECISION.includes(l.split("\t")[1]))
    .sort();
  if (!lignes.length) throw new Error(`Composant ${composant} vide au commit ${sha} : périmètre incohérent.`);
  return createHash("sha256").update(`${composant}\n${lignes.join("\n")}`).digest("hex");
}

export function empreinteRecette(empreinte, environnement, versionNode = process.versions.node.split(".")[0]) {
  return createHash("sha256").update(`${empreinte}\n${environnement}\nnode${versionNode}`).digest("hex");
}
