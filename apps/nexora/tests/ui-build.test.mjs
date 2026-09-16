import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileUi } from "../scripts/compile-ui.mjs";

test("production entry is JavaScript and preserves external import contracts", async () => {
  const source = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
  const output = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(output, /type="text\/babel"|@babel\/standalone/);
  assert.match(output, /<script type="module">/);
  const urls = [...source.matchAll(/from\s+["'](https:[^"']+)["']/g)].map(m => m[1]);
  assert.ok(urls.length > 3);
  for (const url of urls) assert.ok(output.includes(url), `Missing import ${url}`);
  assert.match(output, /React\.createElement\(AuthGate\)/);
});

test("inline compilation cannot terminate the script with a string literal", async () => {
  const html = '<script type="text/babel">const text = "<' + '/script>"; window.demo = <p>{text}</p>;</script>';
  // Real HTML cannot embed an unescaped closing tag in a script: use the source-safe spelling.
  const safe = html.replace('"</script>"', '"<\\/script>"');
  const output = await compileUi(safe);
  assert.equal((output.match(/<\/script>/g) || []).length, 1);
  assert.match(output, /React\.createElement/);
});

test("missing or duplicate JSX entries fail the build", async () => {
  await assert.rejects(compileUi("<html></html>"), /Expected one JSX entry/);
  await assert.rejects(compileUi('<script type="text/babel">const a=1;</script>'.repeat(2)), /Expected one JSX entry/);
});
