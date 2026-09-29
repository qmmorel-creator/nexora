import { mkdir, readdir, readFile, writeFile, copyFile, cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { compileUi } from "./compile-ui.mjs";
import { appliquerEnvironnement, controlerSortieHorsProduction, DOSSIER_DEMO, entetes, metadonnees } from "./environnement.mjs";
import { environnement } from "../../../config/environnements.mjs";

const root = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(root, "..", "..");
const sourceDir = path.join(root, "source");
const outputDir = path.join(root, "dist");
const parts = (await readdir(sourceDir))
  .filter((name) => name.startsWith("index.html.part-"))
  .sort();

if (!parts.length) throw new Error("Aucun fragment index.html trouvé");

// Environnement de construction (Ref #544). Par défaut « production » : c'est
// ce que construisent les tests et, tant qu'ils existent, les builds Git
// Netlify. Local et préproduction se demandent explicitement.
const env = environnement(process.env.NEXORA_ENV || "production");
const git = (...args) => { try { return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };
const commit = process.env.NEXORA_COMMIT || process.env.COMMIT_REF || git("rev-parse", "HEAD") || "inconnu";
const version = JSON.parse(await readFile(path.join(repoRoot, "publication", "version.json"), "utf8")).version;
// Date du commit plutôt que l'horloge : reconstruire le même candidat donne
// exactement les mêmes fichiers, donc aucune republication inutile.
const meta = metadonnees({
  env: env.nom,
  version,
  commit,
  branche: process.env.NEXORA_BRANCHE || process.env.BRANCH || git("rev-parse", "--abbrev-ref", "HEAD") || "inconnue",
  dateConstruction: process.env.NEXORA_DATE_CONSTRUCTION || (commit !== "inconnu" && git("show", "-s", "--format=%cI", commit)) || "inconnue",
});

const buffers = await Promise.all(parts.map((name) => readFile(path.join(sourceDir, name))));
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
const source = Buffer.concat(buffers);
// Preserve the exact assembled source for extraction-based business tests.
const assembledDir = path.join(root, ".build");
await mkdir(assembledDir, { recursive: true });
await writeFile(path.join(assembledDir, "index.html"), source);
const html = appliquerEnvironnement(await compileUi(source.toString("utf8")), meta);
await writeFile(path.join(outputDir, "index.html"), html);
await copyFile(path.join(root, "public", "openapi.yaml"), path.join(outputDir, "openapi.yaml"));
// Modèles 3D de la vue Carte (#499, Kenney, CC0) : servis tels quels sous /carte/.
await cp(path.join(root, "public", "carte"), path.join(outputDir, "carte"), { recursive: true });
await writeFile(path.join(outputDir, "version.json"), JSON.stringify(meta, null, 2) + "\n");
await writeFile(path.join(outputDir, "_headers"), entetes(env.nom));
if (env.donnees === "demo") {
  await cp(path.join(root, "environnement-demo"), path.join(outputDir, DOSSIER_DEMO), { recursive: true });
  for (const nom of await readdir(path.join(outputDir, DOSSIER_DEMO))) {
    controlerSortieHorsProduction(await readFile(path.join(outputDir, DOSSIER_DEMO, nom), "utf8"), `${DOSSIER_DEMO}/${nom}`);
  }
}
console.log(`Build Nexora (${env.nom}, ${meta.version}, ${meta.commit.slice(0, 7)}): ${parts.length} fragments, ${buffers.reduce((sum, item) => sum + item.length, 0)} octets`);
