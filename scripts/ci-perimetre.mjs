// Périmètre et preuve de la CI — Ref #544.
//
//   node scripts/ci-perimetre.mjs --base <sha> --head <sha>   → JSON { verifier, raisons, empreinte }
//
// `verifier` = faut-il exécuter le socle `npm run verify` ? Seules les
// modifications documentaires CONNUES l'évitent ; tout chemin inconnu, toute
// modification de la CI, du sélecteur, d'un outil ou d'une dépendance le
// déclenche. `empreinte` identifie le contenu couvert par le socle : une
// preuve portant sur la même empreinte, récente et issue d'un run fiable,
// peut être réutilisée (voir .github/workflows/ci.yml).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Documentation connue : aucun effet sur le socle. Rien d'autre.
const DOCUMENTATION = [
  /^docs\/.*\.(md|png|jpe?g|webp|gif)$/,
  /^[^/]+\.md$/,
  /^apps\/[^/]+\/[^/]+\.md$/,
  /^tools\/[^/]+\/[^/]+\.md$/,
  /^\.github\/(ISSUE_TEMPLATE\/.*|PROCESS\.md|labels\.json)$/,
];
// Hors socle mais pas documentaire : pris en compte dans l'empreinte, jamais
// sautés sans preuve.
export const EXCLUS_EMPREINTE_CI = ["publication/registre.json"];

export function classer(chemins) {
  const raisons = [];
  let verifier = false;
  for (const c of chemins) {
    if (EXCLUS_EMPREINTE_CI.includes(c)) { raisons.push(`registre seul : ${c}`); continue; }
    if (DOCUMENTATION.some((re) => re.test(c))) { raisons.push(`documentation : ${c}`); continue; }
    verifier = true;
    raisons.push(`${/^\.github\/workflows\//.test(c) ? "CI modifiée" : /package(-lock)?\.json$/.test(c) ? "dépendances" : "code"} : ${c}`);
  }
  if (!chemins.length) { verifier = true; raisons.push("aucun chemin comparé : prudence"); }
  return { verifier, raisons };
}

// Empreinte du contenu couvert par le socle : tout l'arbre sauf documentation
// connue et registre, plus la version de Node.
export function empreinteSocle(lignesArbre, versionNode) {
  const utiles = lignesArbre.filter((l) => {
    const chemin = l.split("\t")[1];
    return chemin && !EXCLUS_EMPREINTE_CI.includes(chemin) && !DOCUMENTATION.some((re) => re.test(chemin));
  }).sort();
  return createHash("sha256").update(`node${versionNode}\n${utiles.join("\n")}`).digest("hex");
}

const principal = process.argv[1] && process.argv[1].endsWith("ci-perimetre.mjs");
if (principal) {
  const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
  const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 }).trim();
  const head = arg("head") || "HEAD";
  const base = arg("base");
  let chemins = [];
  let prudence = null;
  try {
    if (!base || /^0+$/.test(base)) throw new Error("base absente");
    chemins = git(["diff", "--name-only", base, head]).split("\n").filter(Boolean);
  } catch (e) { prudence = `diff indisponible (${e.message.split("\n")[0]})`; }
  const r = prudence ? { verifier: true, raisons: [`prudence ← ${prudence}`] } : classer(chemins);
  const empreinte = empreinteSocle(git(["ls-tree", "-r", "--full-tree", head]).split("\n"), process.versions.node.split(".")[0]);
  console.log(JSON.stringify({ ...r, empreinte, arbre: git(["rev-parse", `${head}^{tree}`]) }));
}
