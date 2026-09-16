import { mkdir, readdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { compileUi } from "./compile-ui.mjs";

const root = path.resolve(import.meta.dirname, "..");
const sourceDir = path.join(root, "source");
const outputDir = path.join(root, "dist");
const parts = (await readdir(sourceDir))
  .filter((name) => name.startsWith("index.html.part-"))
  .sort();

if (!parts.length) throw new Error("Aucun fragment index.html trouvé");

const buffers = await Promise.all(parts.map((name) => readFile(path.join(sourceDir, name))));
await mkdir(outputDir, { recursive: true });
const source = Buffer.concat(buffers);
// Preserve the exact assembled source for extraction-based business tests.
const assembledDir = path.join(root, ".build");
await mkdir(assembledDir, { recursive: true });
await writeFile(path.join(assembledDir, "index.html"), source);
const html = await compileUi(source.toString("utf8"));
await writeFile(path.join(outputDir, "index.html"), html);
await copyFile(path.join(root, "public", "openapi.yaml"), path.join(outputDir, "openapi.yaml"));
console.log(`Build Nexora: ${parts.length} fragments, ${buffers.reduce((sum, item) => sum + item.length, 0)} octets`);

