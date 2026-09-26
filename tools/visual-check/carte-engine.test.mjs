// Cycle de vie réel du moteur et objets Three.js, sans rendu GPU.
// Ces tests complètent le banc navigateur, ils ne valident ni les pixels ni les FPS GPU.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import * as Real from "three";

const html = await readFile(new URL("../../apps/nexora/.build/index.html", import.meta.url), "utf8");
const slice = (name) => html.split(`// === NEXORA:${name}:START ===`)[1].split(`// === NEXORA:${name}:END ===`)[0];
const noop = () => {};
class Element {
  constructor() {
    this.style = {}; this.children = []; this.clientWidth = 1000; this.clientHeight = 700;
    this.dataset = {}; this.classList = { add: noop, remove: noop, toggle: noop }; this.listeners = {}; this.handlers = {};
  }
  appendChild(el) { this.children.push(el); return el; }
  setAttribute() {} remove() {}
  addEventListener(name, fn) {
    (this.handlers[name] ||= new Set()).add(fn);
    this.listeners[name] = (event) => this.handlers[name].forEach((handler) => handler(event));
  }
  removeEventListener(name, fn) {
    this.handlers[name]?.delete(fn);
    if (!this.handlers[name]?.size) delete this.listeners[name];
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 700 }; }
  getContext() {
    return new Proxy({
      measureText: (s) => ({ width: String(s).length * 12 }),
      createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }),
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), createPattern: () => ({}),
    }, { get: (obj, key) => key in obj ? obj[key] : noop });
  }
}
function fixture(options = {}) {
  let frame, now = 0, scene, camera, renderer;
  class Renderer {
    constructor() {
      renderer = this; this.domElement = new Element(); this.shadowMap = {};
      this.capabilities = { isWebGL2: false }; this.extensions = { has: () => false };
      this.info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 }, reset: noop };
    }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} setRenderTarget() {}
    render(s, c) { if (s.fog) { scene = s; camera = c; s.updateMatrixWorld(true); } }
  }
  const document = Object.assign(new Element(), { createElement: () => new Element(), hidden: false });
  const context = vm.createContext({
    console, performance: { now: () => now }, window: { devicePixelRatio: 2, matchMedia: () => ({ matches: !!options.reduced }) }, document,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: (fn) => { frame = fn; return 1; }, cancelAnimationFrame: noop, setTimeout, clearTimeout,
  });
  vm.runInContext(`${slice("CARTE")}\n${slice("CARTE-ENGINE")}\nthis.api = { createCarteEngine, carteNormalize, carteBuild };`, context);
  const C = context.api;
  const engine = C.createCarteEngine({ ...Real, WebGLRenderer: Renderer, PMREMGenerator: class { constructor() { throw Error("Sans GPU"); } } }, new Element(), { fx: false, quality: "auto", ...options });
  const ctx = {
    projects: [{ id: "p1", name: "One", folderId: "f1", color: "#336699" }, { id: "p2", name: "Two", folderId: "f2", color: "#993366" }],
    projectFolders: [{ id: "f1", name: "Folder 1" }, { id: "f2", name: "Folder 2" }],
    statuses: [{ id: "s1", name: "En cours" }], taskTypes: [], teamMembers: [],
  };
  let tasks = [{ id: "t1", title: "Task 1", projectId: "p1", statusId: "s1" }, { id: "t2", title: "Task 2", projectId: "p2", statusId: "s1" }], memory = {};
  return {
    engine, ctx, document,
    set(patch = {}, dimmed = null, visible = null) {
      tasks = tasks.map((t) => ({ ...t, ...patch }));
      const data = C.carteNormalize(ctx, tasks, { now: Date.parse("2026-09-26") });
      data.taskById = Object.fromEntries(data.tasks.map((t) => [t.id, t]));
      const layout = C.carteBuild({ ...data, memory }); memory = layout.memory;
      engine.setData({ data, layout, dimmed, visible });
    },
    tick(ms = 16) { now += ms; frame(now); },
    wheel(deltaY, deltaMode = 0) { renderer.domElement.listeners.wheel({ deltaY, deltaMode, preventDefault: noop }); },
    surfaces() { const list = []; scene.traverse((m) => { if (m.userData.keys?.length) list.push(m); }); return list; },
    camera: () => camera,
  };
}

test("#517 : une édition réutilise les surfaces réelles, un filtre ne change que leur teinte", () => {
  const f = fixture();
  try {
    f.set(); f.tick();
    const surfaces = f.surfaces(), matrices = surfaces.map((m) => Array.from(m.instanceMatrix.array));
    const colors = surfaces.map((m) => Array.from(m.instanceColor.array));
    let disposed = 0;
    surfaces.forEach((m) => m.addEventListener("dispose", () => disposed++));
    f.engine.select("t1");
    f.set({ progress: 80 }); f.tick();
    assert.deepEqual(f.surfaces(), surfaces, "mêmes objets Three.js et tampons");
    assert.equal(f.engine.selected(), "t1");
    assert.equal(f.engine.performanceStats().terrainBuilds, 1);
    assert.equal(f.engine.performanceStats().decorBuilds, 1);
    f.set({}, new Set(["p2"]), new Set(["t1"])); f.tick();
    assert.deepEqual(f.surfaces(), surfaces);
    assert.deepEqual(surfaces.map((m) => Array.from(m.instanceMatrix.array)), matrices);
    assert.notDeepEqual(surfaces.map((m) => Array.from(m.instanceColor.array)), colors);
    assert.equal(f.engine.poiOf("t2"), null, "la tâche filtrée n'est plus interactive");
    f.set(); f.tick();
    assert.deepEqual(surfaces.map((m) => Array.from(m.instanceColor.array)), colors, "couleurs restaurées");
    assert.ok(f.engine.poiOf("t2"));
    assert.equal(disposed, 0);
    f.engine.setQuality("low");
    assert.equal(disposed, surfaces.length, "changer de qualité libère les anciennes surfaces");
    assert.equal(f.engine.performanceStats().terrainBuilds, 2);
    f.tick();
    const low = f.surfaces(); let cleaned = 0;
    low.forEach((m) => m.addEventListener("dispose", () => cleaned++));
    f.engine.dispose();
    assert.equal(cleaned, low.length);
    assert.equal(f.document.listeners.visibilitychange, undefined);
  } catch (e) { f.engine.dispose(); throw e; }
});

test("#517 : la boucle réelle mesure 10 FPS et conserve la résolution après une édition", () => {
  const f = fixture();
  try {
    f.set();
    for (let i = 0; i < 21; i++) f.tick(100);
    assert.ok(Math.abs(f.engine.performanceStats().fps - 10) < 1e-9);
    assert.equal(f.engine.performanceStats().pixelRatio, 1.75);
    f.set({ progress: 60 });
    assert.equal(f.engine.performanceStats().pixelRatio, 1.75);
    f.document.hidden = true; f.tick(120000);
    f.document.hidden = false; f.document.listeners.visibilitychange();
    for (let i = 0; i < 125; i++) f.tick(16);
    assert.ok(f.engine.performanceStats().fps > 60, "le temps masqué n'entre pas dans la mesure");
  } finally { f.engine.dispose(); }
});

test("#517 : le zoom est progressif, sans zoom horizontal, et immédiat en mouvement réduit", () => {
  for (const reduced of [false, true]) {
    const f = fixture({ reduced });
    try {
      f.set(); f.engine.snapView({ x: 0, z: 0, dist: 20, pitch: 0.9 }); f.tick();
      f.wheel(0); f.tick();
      assert.ok(Math.abs(f.camera().position.length() - 20) < 1e-9);
      f.wheel(100); f.tick();
      const target = 20 * Math.exp(0.15), actual = f.camera().position.length();
      if (reduced) assert.ok(Math.abs(actual - target) < 1e-9);
      else assert.ok(actual > 20 && actual < target, JSON.stringify({ actual, target, view: f.engine.getView() }));
      for (let i = 0; i < 100; i++) f.tick();
      assert.ok(Math.abs(f.camera().position.length() - target) < 0.001);
    } finally { f.engine.dispose(); }
  }
});

test("#517 : l'arrivée asynchrone des modèles renouvelle le décor, pas le terrain", async () => {
  class Loader {
    async loadAsync() {
      const scene = new Real.Group();
      scene.add(new Real.Mesh(new Real.BoxGeometry(1, 1, 1), new Real.MeshStandardMaterial()));
      return { scene };
    }
  }
  const f = fixture({ loadGltf: async () => Loader });
  try {
    f.set(); f.tick();
    const surfaces = f.surfaces();
    assert.equal(f.engine.fxState().models, false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.engine.fxState().models, true);
    f.tick();
    assert.deepEqual(f.surfaces(), surfaces);
    assert.equal(f.engine.performanceStats().terrainBuilds, 1);
    assert.equal(f.engine.performanceStats().decorBuilds, 2);
    f.set({ progress: 40 });
    assert.equal(f.engine.performanceStats().decorBuilds, 2);
  } finally { f.engine.dispose(); }
});
