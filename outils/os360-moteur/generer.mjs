// Génère le « moteur de graphiques OS360 » servi par Nexora (#573).
//
//   node outils/os360-moteur/generer.mjs <chemin/vers/OS360/index.html> <commit OS360>
//
// Copie le bundle OS360 d'un commit donné, sans en retoucher la logique :
//   1. un stockage en mémoire remplace localStorage/sessionStorage (la page
//      tourne dans un iframe sandbox, sans origine : rien n'est lu ni écrit
//      dans le stockage de Nexora, d'OS360 ou de personne) ;
//   2. le montage de l'application OS360 (gCe) est remplacé par nxMoteur
//      (moteur.js), qui affiche le contenu d'UN widget à partir des données
//      reçues de Nexora ;
//   3. moteur.js est ajouté à la fin du module OS360.
// Toute la séquence de démarrage d'OS360 et ses surcouches s'exécutent donc à
// l'identique : les graphiques sont ceux d'OS360 par construction.
//
// Chaque remplacement doit trouver sa cible exactement une fois, et chaque nom
// minifié utilisé par moteur.js doit exister dans le bundle : sinon la
// génération échoue au lieu de produire un moteur qui casserait à l'exécution.
// Ne jamais modifier les fichiers générés à la main : relancer ce script.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ici = import.meta.dirname;
const racine = path.resolve(ici, "..", "..");
const sortie = path.join(racine, "apps", "nexora", "public", "os360-moteur");

const [source, commit] = process.argv.slice(2);
if (!source || !/^[0-9a-f]{7,40}$/.test(commit || "")) {
  console.error("Usage : node outils/os360-moteur/generer.mjs <OS360/index.html> <commit>");
  process.exit(2);
}

const html = await readFile(source, "utf8");
const moteur = await readFile(path.join(ici, "moteur.js"), "utf8");

function unique(texte, motif, quoi) {
  const n = texte.split(motif).length - 1;
  if (n !== 1) throw new Error(`${quoi} : ${n} occurrence(s) au lieu d'une — bundle OS360 inattendu, génération refusée.`);
}

// Noms du module OS360 dont dépend moteur.js : déclarés au niveau du module.
const NOMS = ["Z9", "X9", "\\$9", "W9", "lCe", "ul", "gl", "Fc", "osBudgetCategoryColors", "osTabNode", "osSidebarSettings", "D", "nl", "rl", "osChangeConfig"];
const debutModule = html.indexOf('<script type="module"');
const finModule = html.indexOf("</script>", debutModule);
if (debutModule < 0 || finModule < 0) throw new Error("Module OS360 introuvable.");
const module = html.slice(debutModule, finModule);
for (const nom of NOMS) {
  const declare = new RegExp(`(?:function ${nom}\\(|[,;\\s(]${nom}(?:,|;|=(?!=)))`);
  if (!declare.test(module)) throw new Error(`Nom OS360 introuvable dans le bundle : ${nom.replace("\\", "")}`);
}

const MONTAGE = "(0,$9.jsx)(gCe,{})";
unique(module, MONTAGE, "Montage de l'application OS360");
unique(html, '<script type="module"', "Module OS360");

const SHIM = `<script>
/* Nexora · moteur OS360 (#573) : stockage en mémoire, la page n'a pas d'origine. */
(function () {
  function Memoire() { var m = new Map(); return {
    get length() { return m.size; }, key: function (i) { return Array.from(m.keys())[i] ?? null; },
    getItem: function (k) { return m.has(String(k)) ? m.get(String(k)) : null; },
    setItem: function (k, v) { m.set(String(k), String(v)); }, removeItem: function (k) { m.delete(String(k)); }, clear: function () { m.clear(); } }; }
  var l = Memoire(), s = Memoire();
  Object.defineProperty(window, "localStorage", { configurable: true, get: function () { return l; } });
  Object.defineProperty(window, "sessionStorage", { configurable: true, get: function () { return s; } });
})();
</script>
<style>html,body,#root{height:100%;margin:0;background:transparent}.nx-moteur{height:100%;display:flex;flex-direction:column}.nx-moteur>article.widget{flex:1;min-height:0;border:0!important;box-shadow:none!important;border-radius:0!important;background:transparent!important;display:flex;flex-direction:column}.nx-moteur .widget-content{flex:1;min-height:0}.nx-moteur-message{padding:16px;font:13px Inter,Segoe UI,Arial,sans-serif;color:#536477}.nx-moteur-options{position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;background:#fff;font:13px Inter,Segoe UI,Arial,sans-serif}.nx-moteur-options>header{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid #d8e1eb}.nx-moteur-options>header button{height:26px;padding:0 10px;border:1px solid #d8e1eb;border-radius:5px;background:#fff;cursor:pointer}.nx-moteur-options-body{flex:1;min-height:0;overflow:auto;padding:10px 12px}.nx-moteur{position:relative}</style>
`;

let out = html.replace('<script type="module"', () => SHIM + '<script type="module"');
out = out.replace(MONTAGE, () => "(0,$9.jsx)(nxMoteur,{})");
const fin = out.indexOf("</script>", out.indexOf('<script type="module"'));
out = out.slice(0, fin) + "\n" + moteur + "\n" + out.slice(fin);
out = out.replace(/<title>[^<]*<\/title>/, "<title>Moteur de graphiques OS360 · Nexora</title>");
out = `<!-- Généré par outils/os360-moteur/generer.mjs depuis OS360 ${commit} — ne pas modifier à la main. -->\n` + out;

await mkdir(sortie, { recursive: true });
await writeFile(path.join(sortie, "index.html"), out);
const empreinte = (texte) => createHash("sha256").update(texte).digest("hex");
await writeFile(path.join(sortie, "source.json"), JSON.stringify({
  os360: { commit, index: empreinte(html) },
  moteur: empreinte(moteur),
  genere: empreinte(out),
}, null, 2) + "\n");
console.log(`Moteur OS360 généré depuis ${commit} : ${(out.length / 1e6).toFixed(2)} Mo → apps/nexora/public/os360-moteur/`);
