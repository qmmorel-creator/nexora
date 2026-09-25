// Construit une copie hors ligne de dist/index.html : les URL de CDN sont
// redirigées par une import map vers des modules bundlés depuis npm, Firebase
// est bouchonné, et le point d'entrée React est remplacé par le scénario de
// contrôle (harness.jsx).
import { mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import { compileUi } from "../../apps/nexora/scripts/compile-ui.mjs";

const here = path.resolve(import.meta.dirname);
const repoRoot = path.resolve(here, "..", "..");
const distFile = path.join(repoRoot, "apps", "nexora", ".build", "index.html");
const outDir = path.join(here, ".harness");
const vendorDir = path.join(outDir, "vendor");

// React, ReactDOM et son client partagent UN SEUL bundle : deux copies de React
// dans la même page casseraient les Hooks.
const ENTRIES = [
  { name: "runtime.js", contents: `import React from "react";\nimport ReactDOM from "react-dom";\nimport * as client from "react-dom/client";\nexport { React, ReactDOM, client };` },
  { name: "lucide.js", contents: `export * from "lucide-react";` },
  { name: "tabler.js", contents: `export * from "@tabler/icons-react";` },
  { name: "papaparse.js", contents: `export { default } from "papaparse";` },
  // Vue Carte (#361) : three.js est importé à la demande par l'application.
  { name: "three.js", contents: `export * from "three";` },
];

// Façades servies telles quelles : elles ne font que ré-exporter le bundle
// commun sous les noms attendus par l'application.
const FACADES = {
  "react.js": `import { React } from "./runtime.js";
export default React;
export const {
  createElement, cloneElement, createContext, createRef, forwardRef, isValidElement,
  memo, lazy, Suspense, Fragment, StrictMode, Children, version,
  useState, useRef, useEffect, useLayoutEffect, useMemo, useCallback, useContext,
  useReducer, useImperativeHandle, useDebugValue, useId, useSyncExternalStore,
  useTransition, useDeferredValue, startTransition,
} = React;`,
  "react-dom.js": `import { ReactDOM } from "./runtime.js";
export default ReactDOM;
export const { createPortal, flushSync, findDOMNode, render, unmountComponentAtNode, version } = ReactDOM;`,
  "react-dom-client.js": `import { client } from "./runtime.js";
export default client;
export const createRoot = client.createRoot;
export const hydrateRoot = client.hydrateRoot;`,
  // Le banc ne touche jamais Firebase : le bouchon se contente de ne rien faire
  // sans jamais lever d'exception au chargement du module.
  "firebase-stub.js": `const noop = () => {};
export const initializeApp = () => ({ name: "harness" });
export const getFirestore = () => ({});
export const getAuth = () => ({ currentUser: null });
export const onAuthStateChanged = (_a, cb) => { setTimeout(() => cb(null), 0); return noop; };
export const doc = () => ({});
export const getDoc = async () => ({ exists: () => false, data: () => ({}) });
export const setDoc = async () => {};
export const deleteDoc = async () => {};
export const runTransaction = async () => {};
export const collection = () => ({});
export const query = () => ({});
export const orderBy = () => ({});
export const startAt = () => ({});
export const endAt = () => ({});
export const getDocs = async () => ({ forEach: noop, docs: [] });
export const onSnapshot = () => noop;
export const signInWithEmailAndPassword = async () => {};
export const createUserWithEmailAndPassword = async () => {};
export const signOut = async () => {};
export const sendPasswordResetEmail = async () => {};
export class GoogleAuthProvider {}
export const linkWithPopup = async () => {};
export const signInWithPopup = async () => {};
export const reauthenticateWithPopup = async () => {};`,
  // PDF des devis, factures et fiches (#289, #291) : le banc ne génère jamais
  // de PDF, mais le module doit se résoudre hors ligne pour que la page monte.
  "jspdf-stub.js": `export class jsPDF { constructor() { throw new Error("jsPDF indisponible dans le banc"); } }
export default jsPDF;`,
  "jspdf-autotable-stub.js": `export default function autoTable() {}`,
};

const IMPORT_MAP = {
  react: "./vendor/react.js",
  "https://esm.sh/react@18.2.0": "./vendor/react.js",
  "https://esm.sh/react-dom@18.2.0": "./vendor/react-dom.js",
  "https://esm.sh/react-dom@18.2.0/client": "./vendor/react-dom-client.js",
  "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0": "./vendor/lucide.js",
  "https://esm.sh/@tabler/icons-react@3.46.0?deps=react@18.2.0": "./vendor/tabler.js",
  "https://esm.sh/papaparse@5.4.1": "./vendor/papaparse.js",
  "https://esm.sh/three@0.158.0": "./vendor/three.js",
  // Modèles 3D de la Carte (#499) : GLTFLoader partage le three.js du banc.
  three: "./vendor/three.js",
  "https://esm.sh/three@0.158.0/examples/jsm/loaders/GLTFLoader.js": "./vendor/gltf-loader.js",
  "https://esm.sh/jspdf@2.5.2": "./vendor/jspdf-stub.js",
  "https://esm.sh/jspdf-autotable@3.8.4": "./vendor/jspdf-autotable-stub.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js": "./vendor/firebase-stub.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js": "./vendor/firebase-stub.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js": "./vendor/firebase-stub.js",
};

const BABEL_TAG = '<script src="https://unpkg.com/@babel/standalone@7.24.7/babel.min.js"></script>';
const FONT_TAG = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750;800&display=swap">';
const BOOTSTRAP = `const root = createRoot(document.getElementById('root'));\nroot.render(React.createElement(AuthGate));`;

function requireOnce(source, needle, label) {
  const count = source.split(needle).length - 1;
  if (count !== 1) throw new Error(`${label} : ${count} occurrence(s) dans dist/index.html, 1 attendue — le banc doit être mis à jour.`);
}

export async function buildHarness({ compile = true } = {}) {
  const source = await readFile(distFile, "utf8").then(s => s.replace(/\r\n/g, "\n")).catch(() => {
    throw new Error("apps/nexora/dist/index.html absent — lancer d'abord `npm run build --prefix apps/nexora`.");
  });
  requireOnce(source, BABEL_TAG, "balise Babel");
  requireOnce(source, BOOTSTRAP, "point d'entrée React");

  await rm(outDir, { recursive: true, force: true });
  await mkdir(vendorDir, { recursive: true });

  // Les points d'entrée sont écrits dans un dossier temporaire puis bundlés :
  // rien de généré ne traîne dans le dépôt.
  const srcDir = path.join(outDir, "src");
  await mkdir(srcDir, { recursive: true });
  for (const entry of ENTRIES) await writeFile(path.join(srcDir, entry.name), entry.contents);
  await build({
    entryPoints: ENTRIES.map((e) => path.join(srcDir, e.name)),
    bundle: true,
    format: "esm",
    outdir: vendorDir,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  // GLTFLoader (#499) : bundlé à part, « three » laissé externe pour qu'il
  // réutilise l'unique three.js de la page (import map).
  await writeFile(path.join(srcDir, "gltf-loader.js"), `export { GLTFLoader } from ${JSON.stringify(path.join(here, "node_modules", "three", "examples", "jsm", "loaders", "GLTFLoader.js"))};`);
  await build({
    entryPoints: [path.join(srcDir, "gltf-loader.js")],
    bundle: true,
    format: "esm",
    outdir: vendorDir,
    external: ["three"],
    logLevel: "error",
  });
  for (const [name, contents] of Object.entries(FACADES)) await writeFile(path.join(vendorDir, name), contents);
  await writeFile(path.join(vendorDir, "babel.min.js"), await readFile(path.join(here, "node_modules", "@babel", "standalone", "babel.min.js")));
  await rm(srcDir, { recursive: true, force: true });

  const harness = await readFile(path.join(here, "harness.jsx"), "utf8");
  const page = source
    .replace(BABEL_TAG, `<script type="importmap">${JSON.stringify({ imports: IMPORT_MAP })}</script>\n<script src="./vendor/babel.min.js"></script>`)
    .replace(FONT_TAG, "")
    .replace(BOOTSTRAP, harness);
  await writeFile(path.join(outDir, "index.html"), compile ? await compileUi(page) : page);
  // Ressources statiques publiées avec l'application (modèles 3D de la Carte).
  await cp(path.join(repoRoot, "apps", "nexora", "public", "carte"), path.join(outDir, "carte"), { recursive: true });
  return outDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = await buildHarness();
  console.log("Banc d'essai construit :", dir);
}
