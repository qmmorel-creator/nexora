// Offline workspace fixture. No credentials or real writes; seed data via
// window.__premiumSeed before navigation, or inject __premiumReadError.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildHarness } from "./build-harness.mjs";
import { compileUi } from "../../apps/nexora/scripts/compile-ui.mjs";

export async function preparePremiumFixture() {
  const dir = await buildHarness({ compile: false });
  const fixture = await readFile(new URL("./harness.jsx", import.meta.url), "utf8");
  const template = await readFile(path.join(dir, "index.html"), "utf8");
  const bootstrap = `
const demoValues=new Map(Object.entries(window.__premiumSeed || {}).map(([k,v])=>[k,JSON.stringify(v)]));
window.storage={get:async key=>{if(window.__premiumReadError)throw Error('Simulated read failure');return demoValues.has(key)?{value:demoValues.get(key)}:null;},set:async(key,value)=>{demoValues.set(key,value);return {value};},delete:async key=>demoValues.delete(key),list:async()=>({keys:[]}),watch:()=>()=>{},checkRevision:async()=>({changed:false}),getKnownRevision:()=>null,getKnownValue:key=>demoValues.get(key),refreshRevision:async()=>null,acceptRemote:()=>{}};
const root=createRoot(document.getElementById('root'));
root.render(<><GlobalStyles/><LePlan currentUser={{uid:'premium-fixture',email:'demo@example.invalid'}} onSignOut={()=>{}}/></>);`;
  if (!template.includes(fixture)) throw new Error("Fixture bootstrap not found");
  const page = template.replace(fixture, bootstrap);
  await writeFile(path.join(dir, "app-babel.html"), page);
  await writeFile(path.join(dir, "app.html"), await compileUi(page));
  return dir;
}
if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  console.log(await preparePremiumFixture());
}
