// Garde-fou du build de production (Ref #655) : aucune donnée ni aucun code
// de démonstration ne doit être publié. Échoue le build sinon.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

if (process.env.VITE_DEMO === "1") { console.log("[paquet] build de démonstration : contrôle sauté"); process.exit(0); }
const INTERDITS = ["__nexoraDemo", "demo@exemple.invalid", "Ancienne relance fournisseur", "sourceMemoire"];
const fichiers = (d) => readdirSync(d).flatMap((n) => { const p = path.join(d, n); return statSync(p).isDirectory() ? fichiers(p) : [p]; });
const fautes = fichiers("dist").filter((f) => /\.(js|html|css)$/.test(f)).flatMap((f) => { const t = readFileSync(f, "utf8"); return INTERDITS.filter((x) => t.includes(x)).map((x) => `${f} contient « ${x} »`); });
if (fautes.length) { console.error("[paquet] contenu de démonstration dans le build de production :\n" + fautes.join("\n")); process.exit(1); }
console.log("[paquet] aucun contenu de démonstration dans dist/");
