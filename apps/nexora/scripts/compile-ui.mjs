import { transform } from "esbuild";

/** Compile the standalone UI without bundling or changing its CDN import contracts. */
export async function compileUi(html) {
  const scripts = [...html.matchAll(/<script\b([^>]*\btype="text\/babel"[^>]*)>([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) throw new Error(`Expected one JSX entry, found ${scripts.length}`);
  const compiled = await transform(scripts[0][2], {
    loader: "jsx", format: "esm", target: "es2020",
    jsxFactory: "React.createElement", jsxFragment: "React.Fragment",
    legalComments: "none", sourcefile: "nexora.jsx",
  });
  const output = html.replace(/<script src="(?:https:\/\/unpkg.com\/@babel\/standalone@7.24.7\/babel.min.js|\.\/vendor\/babel.min.js)"><\/script>/g, "")
    .replace(scripts[0][0], () => `<script type="module">\n${compiled.code}\n</script>`);
  if (output.includes('type="text/babel"') || output.includes("@babel/standalone")) throw new Error("Browser compilation remains in output");
  return output;
}
