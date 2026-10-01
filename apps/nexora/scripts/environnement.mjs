// Adaptation d'une construction de l'interface à son environnement — Ref #544.
//
// production     : sortie inchangée, plus une balise de version discrète.
// local, preproduction : Firebase remplacé par un bouchon sans réseau, stockage
//   fictif dans le navigateur, bandeau d'environnement, noindex, et
//   vérification qu'AUCUNE référence aux ressources de production ne subsiste.
//   Une substitution qui ne trouve pas sa cible fait échouer le build : un
//   bundle de test ne doit jamais retomber silencieusement sur la production.
import { environnement, MOTIFS_PRODUCTION_INTERDITS, PRODUIT } from "../../../config/environnements.mjs";

export const DOSSIER_DEMO = "__demo";

// En-têtes de netlify.toml, reproduits dans `_headers` : un dépôt par l'API
// (outil de publication) ne traite pas netlify.toml.
const ENTETES_COMMUNS = [
  ["/api/*", [["Cache-Control", "no-store"]]],
  ["/api/nexora/*", [["Cache-Control", "no-store"], ["X-Content-Type-Options", "nosniff"]]],
  ["/version.json", [["Cache-Control", "no-store"], ["Access-Control-Allow-Origin", "*"]]],
];
const ENTETES_HORS_PRODUCTION = [
  ["/*", [
    ["X-Robots-Tag", "noindex, nofollow"],
    // Seconde barrière : même si une référence réelle échappait au contrôle du
    // build, le navigateur refuserait de joindre Firebase ou Google.
    // frame-ancestors 'self' : seul Nexora peut encadrer ses pages (protection contre l'intégration par un autre site).
    ["Content-Security-Policy", "connect-src 'self' https://esm.sh; frame-ancestors 'self'"],
  ]],
];

export function entetes(nomEnv) {
  const env = environnement(nomEnv);
  const regles = [...(env.indexable ? [] : ENTETES_HORS_PRODUCTION), ...ENTETES_COMMUNS];
  return regles.map(([chemin, valeurs]) => `${chemin}\n${valeurs.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n\n") + "\n";
}

export function metadonnees({ env, version, commit, branche, dateConstruction, composant = "application" }) {
  environnement(env);
  if (!/^\d+\.\d+\.\d+(-rc\.\d+|-dev)?$/.test(version || "")) throw new Error(`Version invalide : « ${version} »`);
  if (!/^[0-9a-f]{40}$/.test(commit || "") && commit !== "inconnu") throw new Error(`Commit invalide : « ${commit} » (SHA complet attendu)`);
  return { produit: PRODUIT, composant, version, environnement: env, commit, branche: branche || "inconnue", dateConstruction };
}

const echapper = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function remplacer(html, motif, par, quoi) {
  const avant = html;
  const apres = html.replace(motif, par);
  if (apres === avant) throw new Error(`Environnement de démonstration : cible introuvable (${quoi}). Construction refusée plutôt que de garder l'accès à la production.`);
  return apres;
}

export function libelleBandeau(meta, court = false) {
  const env = environnement(meta.environnement);
  if (env.nom === "local") return "LOCAL";
  return court ? `PRÉPROD ${meta.commit.slice(0, 7)}` : `${env.libelle} · ${meta.version} · ${meta.commit.slice(0, 7)}`;
}

// Bandeau : coin bas droit sur grand écran, sans capter les clics. Sous
// 768 px, la bande basse porte la navigation mobile et le bouton « + » :
// le bandeau devient un onglet de 8 px pendu au bord haut, au centre : les
// contrôles de la barre du haut commencent à 8 px (mesuré le 29/09/2026).
function bandeau(meta) {
  const fond = meta.environnement === "local" ? "rgba(71,85,105,.8)" : "rgba(194,65,12,.85)";
  return `<style>#nexora-bandeau-environnement{position:fixed;right:2px;bottom:calc(2px + env(safe-area-inset-bottom, 0px));z-index:2147483000;pointer-events:none;font:600 9px/1.2 system-ui,sans-serif;letter-spacing:.04em;color:#fff;background:${fond};padding:2px 6px;border-radius:5px;box-shadow:0 1px 3px rgba(0,0,0,.25);max-width:60vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media (max-width:767px){#nexora-bandeau-environnement{bottom:auto;top:env(safe-area-inset-top, 0px);right:50%;transform:translateX(50%);font-size:7px;line-height:8px;padding:0 5px;border-radius:0 0 4px 4px}#nexora-bandeau-environnement .long{display:none}}@media (min-width:768px){#nexora-bandeau-environnement .court{display:none}}</style><div id="nexora-bandeau-environnement" role="status" aria-label="Environnement : ${echapper(libelleBandeau(meta))}"><span class="long">${echapper(libelleBandeau(meta))}</span><span class="court">${echapper(libelleBandeau(meta, true))}</span></div>`;
}

export function appliquerEnvironnement(html, meta) {
  const env = environnement(meta.environnement);
  const baliseVersion = `<meta name="nexora-version" content="${echapper(`${meta.version} ${meta.commit}`)}"/>`;
  if (env.donnees === "firebase") {
    return remplacer(html, /<meta charset="UTF-8"\/>/, (m) => `${m}\n${baliseVersion}`, "balise charset");
  }
  let sortie = html;
  sortie = remplacer(sortie, /<meta charset="UTF-8"\/>/, (m) => `${m}\n${baliseVersion}\n<meta name="robots" content="noindex, nofollow"/>`, "balise charset");
  sortie = remplacer(sortie, /window\.__FIREBASE_CONFIG__ = \{[\s\S]*?\n\};/,
    () => `window.__FIREBASE_CONFIG__ = { projectId: "${env.firebaseProjet}", apiKey: "demo", authDomain: "demo.invalid", appId: "demo" };\nwindow.__NEXORA_ENVIRONNEMENT__ = ${JSON.stringify(meta)};`,
    "configuration Firebase");
  sortie = remplacer(sortie, /<script>\nwindow\.__FIREBASE_CONFIG__/, (m) => `<script src="/${DOSSIER_DEMO}/stockage-demo.js"></script>\n${m}`, "script de configuration");
  for (const module of ["firebase-app", "firebase-firestore", "firebase-auth"]) {
    sortie = remplacer(sortie, new RegExp(`https://www\\.gstatic\\.com/firebasejs/[\\d.]+/${module}\\.js`, "g"), `/${DOSSIER_DEMO}/firebase-demo.js`, module);
  }
  sortie = remplacer(sortie, /window\.storage = window\.location\.protocol === "file:"/,
    'window.storage = window.__nexoraStockageDemo ? window.__nexoraStockageDemo : window.location.protocol === "file:"', "choix de l'adaptateur de stockage");
  sortie = remplacer(sortie, /<\/body>(?![\s\S]*<\/body>)/, (m) => `${bandeau(meta)}\n${m}`, "fin du document");
  controlerSortieHorsProduction(sortie, "index.html");
  return sortie;
}

export function controlerSortieHorsProduction(contenu, nom) {
  for (const motif of MOTIFS_PRODUCTION_INTERDITS) {
    if (motif.test(contenu)) throw new Error(`${nom} : référence de production interdite hors production (${motif}).`);
  }
}
