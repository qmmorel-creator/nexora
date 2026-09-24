/* Rucher — moteur de rendu three.js (maquettes).
 * RucherEngine.create(container, { data, style, quality, onSelect, onHover, onNear, onFrame })
 * data = { projects, tasks } normalisés (voir layout.js). Lecture seule : aucune écriture de tâche.
 */
(function () {
  'use strict';
  var L = window.RucherLayout;

  var STATE = { todo: 'À faire', doing: 'En cours', done: 'Terminée', waiting: 'En attente' };

  function create(container, opts) {
    var THREE = window.THREE;
    var style = Object.assign({
      sky: '#bfe3f2', fogNear: 40, fogFar: 140, pitch: 0.95, dist: 22, minDist: 7, maxDist: 110,
      light: '#fff6e0', ambient: 1.35, sun: 2.1, sunPos: [30, 50, 20],
      water: '#4fb6d8', waterDeep: '#2f8fc4', earth: '#9b6b43', earthDark: '#7a5233',
      biomes: {
        prairie: '#8fd14f', lavande: '#b69be0', verger: '#6cc26a', bruyere: '#d98fb5',
        tournesol: '#f2c84b', foret: '#4f9e4f', forest: '#3f8f45', lake: '#8fd14f', mountain: '#9aa0a6'
      },
      wild: '#a9d86a', mountain: '#8d8f96', snow: '#f4f6f8', path: '#e2bb82', tint: 0.07,
      outline: false, labelAll: false, orbitFree: true
    }, opts.style || {});
    var quality = opts.quality || 'auto';

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error('webgl');
    }
    renderer.setClearColor(style.sky);
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute('aria-label', 'Carte du rucher. Flèches ou ZQSD pour marcher, Entrée pour lire la tâche proche.');

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(style.sky, style.fogNear, style.fogFar);
    var camera = new THREE.PerspectiveCamera(34, 1, 0.5, 600);
    var hemi = new THREE.HemisphereLight(style.skyLight || 0xffffff, style.groundLight || 0x8a8f6a, style.ambient);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(style.light, style.sun);
    sun.position.set(style.sunPos[0], style.sunPos[1], style.sunPos[2]);
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    sun.shadow.camera.far = 200;
    scene.add(sun); scene.add(sun.target);

    var world = new THREE.Group();
    scene.add(world);
    var dyn = new THREE.Group();
    scene.add(dyn);

    var state = {
      data: null, layout: null, taskById: {}, projectById: {}, poiByTask: {}, tileList: [],
      filter: null, visibleTask: {}, selected: null, hovered: null, near: null,
      yaw: 0.6, pitch: style.pitch, dist: style.dist, target: new THREE.Vector3(), follow: true,
      keys: {}, joy: { x: 0, y: 0 }, walkTo: null, nectar: {}, time: 0, raf: 0, disposed: false
    };

    // ---------- Construction de la carte ----------
    var hexGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
    hexGeo.translate(0, 0.5, 0);
    var capGeo = new THREE.CylinderGeometry(0.985, 0.985, 0.14, 6, 1);
    capGeo.translate(0, 0.07, 0);
    var lambert = function (c, extra) { return new THREE.MeshLambertMaterial(Object.assign({ color: c, flatShading: true }, extra || {})); };
    var disposables = [hexGeo, capGeo];

    var meshes = {};
    function clearWorld() {
      while (world.children.length) {
        var c = world.children.pop();
        if (c.geometry && disposables.indexOf(c.geometry) === -1) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { m.dispose(); });
      }
      while (dyn.children.length) dyn.remove(dyn.children[0]);
      meshes = {};
    }

    var tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
    var UP = new THREE.Vector3(0, 1, 0);

    function inst(geo, mat, count, shadow) {
      var m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
      m.count = 0;
      m.castShadow = !!shadow; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      world.add(m);
      return m;
    }
    function put(m, x, y, z, sx, sy, sz, rot, color) {
      tmpQ.setFromAxisAngle(UP, rot || 0);
      tmpS.set(sx, sy, sz); tmpP.set(x, y, z);
      tmpM.compose(tmpP, tmpQ, tmpS);
      var i = m.count++;
      m.setMatrixAt(i, tmpM);
      if (color != null) m.setColorAt(i, tmpC.set(color));
      return i;
    }

    function mix(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
    function shade(c, f) { var k = new THREE.Color(c); k.multiplyScalar(f); return '#' + k.getHexString(); }

    function tileTopColor(t) {
      if (t.path && t.kind !== 'water') return style.path;
      if (t.kind === 'water') return t.bridge ? style.water : style.water;
      if (t.kind === 'mountain') return style.mountain;
      if (t.kind === 'forest') return style.biomes.forest;
      if (t.kind === 'wild') return style.wild;
      var base = style.biomes[t.biome] || style.wild;
      var p = state.projectById[t.projectId];
      var c = p && p.color ? mix(base, p.color, t.kind === 'hive' ? style.tint * 1.6 : style.tint) : base;
      var v = L.rand01('v:' + t.q + ',' + t.r);
      return shade(c, 0.93 + v * 0.12);
    }

    function hexToVec(q, r, y) { var w = L.toWorld(q, r); return new THREE.Vector3(w.x, y || 0, w.z); }

    function buildWorld() {
      clearWorld();
      var lay = state.layout;
      var tiles = lay.tiles;
      var keys = Object.keys(tiles);
      state.tileList = keys.map(function (k) { return tiles[k]; });
      var n = keys.length;
      var hi = quality === 'high';

      var baseM = inst(hexGeo, lambert('#ffffff'), n, false);
      var capM = inst(capGeo, lambert('#ffffff'), n, false);
      var waterM = inst(capGeo, new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.88, flatShading: true }), n, false);
      meshes.cap = capM; meshes.water = waterM;
      capM.userData.keys = []; waterM.userData.keys = [];

      keys.forEach(function (k) {
        var t = tiles[k];
        var w = L.toWorld(t.q, t.r);
        var h = t.h;
        if (t.kind === 'water') {
          put(baseM, w.x, 0, w.z, 1, 0.1, 1, 0, style.waterDeep);
          var i = put(waterM, w.x, 0.02, w.z, 1, 0.55, 1, 0, t.bridge ? mix(style.water, '#ffffff', 0.15) : style.water);
          waterM.userData.keys[i] = k;
        } else {
          put(baseM, w.x, 0, w.z, 1, h, 1, 0, t.kind === 'mountain' ? shade(style.mountain, 0.8) : L.rand01('e' + k) < 0.5 ? style.earth : style.earthDark);
          var j = put(capM, w.x, h - 0.02, w.z, 1, 1, 1, 0, tileTopColor(t));
          capM.userData.keys[j] = k;
        }
      });
      [baseM, capM, waterM].forEach(function (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });

      // Décor instancié
      var pineGeo = new THREE.ConeGeometry(0.34, 1, 6); pineGeo.translate(0, 0.5, 0);
      var roundGeo = new THREE.IcosahedronGeometry(0.34, 0);
      var trunkGeo = new THREE.CylinderGeometry(0.06, 0.08, 0.3, 5); trunkGeo.translate(0, 0.15, 0);
      var rockGeo = new THREE.DodecahedronGeometry(0.22, 0);
      var peakGeo = new THREE.ConeGeometry(0.95, 1, 6); peakGeo.translate(0, 0.5, 0);
      var flowerGeo = new THREE.IcosahedronGeometry(0.07, 0);
      var bridgeGeo = new THREE.BoxGeometry(1.5, 0.08, 0.55);
      var pine = inst(pineGeo, lambert('#ffffff'), n * 3, hi);
      var round = inst(roundGeo, lambert('#ffffff'), n * 2, hi);
      var trunk = inst(trunkGeo, lambert('#7b5433'), n * 4, false);
      var rock = inst(rockGeo, lambert('#b9b3a8'), n, hi);
      var peak = inst(peakGeo, lambert('#ffffff'), n, hi);
      var flowers = inst(flowerGeo, lambert('#ffffff'), n * 6, false);
      var bridges = inst(bridgeGeo, lambert('#b07a47'), n, false);
      var poiTiles = {};
      lay.pois.forEach(function (p) { poiTiles[p.key] = true; });
      var flowerCols = { lavande: ['#8e6bd1', '#b59af0'], tournesol: ['#f5b82e', '#ffe07a'], bruyere: ['#d35d9b', '#f2a1c8'], prairie: ['#ffffff', '#ffd94a', '#f28ab2'], verger: ['#ffffff', '#ffc4d6'], foret: ['#ffffff', '#ffe07a'] };
      var density = quality === 'low' ? 0.45 : 1;

      keys.forEach(function (k) {
        var t = tiles[k];
        var w = L.toWorld(t.q, t.r);
        var r1 = L.rand01('d1' + k), r2 = L.rand01('d2' + k), r3 = L.rand01('d3' + k);
        var top = t.h + 0.12;
        if (t.bridge) {
          var ang = L.rand01('b' + k) < 0.5 ? 0 : Math.PI / 3;
          put(bridges, w.x, 0.62, w.z, 1, 1, 1, ang);
          return;
        }
        if (t.path || t.kind === 'hive' || poiTiles[k] || t.kind === 'water') return;
        if (r3 > density) return;
        if (t.kind === 'mountain') {
          var s = 1.2 + r1 * 1.4;
          put(peak, w.x, top - 0.1, w.z, 1, s, 1, r2, style.mountain);
          if (s > 1.9) put(peak, w.x, top - 0.1 + s * 0.62, w.z, 0.4, s * 0.38, 0.4, r2, style.snow);
          return;
        }
        var trees = 0, pines = 0;
        if (t.kind === 'forest') { pines = 2 + Math.floor(r1 * 2); trees = r2 < 0.4 ? 1 : 0; }
        else if (t.kind === 'wild') { pines = r1 < 0.35 ? 1 : 0; trees = r2 < 0.3 ? 1 : 0; }
        else if (t.kind === 'edge') { pines = r1 < 0.4 ? 1 : 0; }
        else if (t.biome === 'foret') { pines = r1 < 0.7 ? 2 : 1; }
        else if (t.biome === 'verger') { trees = r1 < 0.8 ? 2 : 1; }
        for (var a = 0; a < pines; a++) {
          var ox = (L.rand01('px' + a + k) - 0.5) * 1.1, oz = (L.rand01('pz' + a + k) - 0.5) * 1.1;
          var sc = 0.75 + L.rand01('ps' + a + k) * 0.5;
          put(pine, w.x + ox, top, w.z + oz, sc, sc * 1.05, sc, 0, shade(style.biomes.forest, 0.75 + L.rand01('pc' + a + k) * 0.35));
        }
        for (var b = 0; b < trees; b++) {
          var tx = (L.rand01('tx' + b + k) - 0.5) * 1.0, tz = (L.rand01('tz' + b + k) - 0.5) * 1.0;
          put(trunk, w.x + tx, top, w.z + tz, 1, 1, 1, 0);
          var fruit = t.biome === 'verger' ? mix('#5fae4f', '#f0a0b8', L.rand01('fr' + k) * 0.5) : '#5fae4f';
          put(round, w.x + tx, top + 0.5, w.z + tz, 1, 1.1, 1, r3 * 6, shade(fruit, 0.85 + r2 * 0.3));
        }
        if (t.kind === 'land' || t.kind === 'wild') {
          if (r2 > 0.82) put(rock, w.x + (r1 - 0.5), top, w.z + (r3 - 0.5), 1, 0.7, 1, r1 * 6);
          var cols = flowerCols[t.biome] || flowerCols.prairie;
          var nf = t.kind === 'land' ? 3 + Math.floor(r1 * 3) : 1;
          for (var f = 0; f < nf; f++) {
            put(flowers, w.x + (L.rand01('fx' + f + k) - 0.5) * 1.4, top + 0.06, w.z + (L.rand01('fz' + f + k) - 0.5) * 1.4, 1, 1, 1, 0, cols[f % cols.length]);
          }
        }
      });
      [pine, round, trunk, rock, peak, flowers, bridges].forEach(function (m) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); });

      buildHives();
      buildPois();
      applyQuality();
    }

    // ---------- Ruches (une par projet) ----------
    var hiveGroup;
    function buildHives() {
      hiveGroup = new THREE.Group();
      world.add(hiveGroup);
      var bodyGeo = new THREE.BoxGeometry(0.62, 0.26, 0.5);
      var roofGeo = new THREE.ConeGeometry(0.52, 0.28, 4); roofGeo.rotateY(Math.PI / 4);
      var standGeo = new THREE.BoxGeometry(0.72, 0.08, 0.6);
      var honeyGeo = new THREE.BoxGeometry(0.64, 0.07, 0.52);
      state.layout.territories.forEach(function (tr) {
        var p = state.projectById[tr.projectId];
        var stats = state.stats[tr.projectId];
        var tile = state.layout.tiles[L.key(tr.q, tr.r)];
        var base = hexToVec(tr.q, tr.r, tile.h + 0.12);
        var g = new THREE.Group();
        g.position.copy(base);
        var stand = new THREE.Mesh(standGeo, lambert('#8a6038')); stand.position.y = 0.04; g.add(stand);
        if (p && p.priority === 'high') { g.position.y += 0.18; stand.scale.set(1.2, 3.2, 1.2); stand.position.y = -0.08; }
        // Hausse(s) : une par tranche de 25 % de tâches terminées, au moins une.
        var supers = 1 + Math.min(3, Math.floor((stats.total ? stats.done / stats.total : 0) * 4));
        for (var i = 0; i < supers; i++) {
          var b = new THREE.Mesh(bodyGeo, lambert(i % 2 ? '#f3e2b8' : '#fbefcf'));
          b.position.y = 0.08 + 0.13 + i * 0.27; g.add(b);
          var band = new THREE.Mesh(honeyGeo, lambert('#e7a81c'));
          band.position.y = 0.08 + i * 0.27 + 0.03; band.scale.set(1.01, 0.5, 1.01); g.add(band);
        }
        var roof = new THREE.Mesh(roofGeo, lambert(p && p.color ? p.color : '#c9503a'));
        roof.position.y = 0.08 + supers * 0.27 + 0.13; g.add(roof);
        var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 5), lambert('#6d4b2c'));
        pole.position.set(0.55, 0.65, 0.3); g.add(pole);
        var flag = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.26, 0.42), lambert(p && p.color ? p.color : '#c9503a'));
        flag.position.set(0.55, 1.15, 0.52); g.add(flag);
        g.userData = { projectId: tr.projectId, top: 0.08 + supers * 0.27 + 0.3 };
        hiveGroup.add(g);
        tr.anchor = new THREE.Vector3(base.x, base.y + g.userData.top + 0.35, base.z);
      });
    }

    // ---------- Points d'intérêt (tâches) ----------
    var poiMeshes = null;
    function buildPois() {
      var n = state.layout.pois.length;
      var stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.55, 4); stemGeo.translate(0, 0.275, 0);
      var headGeo = new THREE.IcosahedronGeometry(0.2, 0);
      var heartGeo = new THREE.IcosahedronGeometry(0.1, 0);
      var skepGeo = new THREE.SphereGeometry(0.3, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
      var jarGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.3, 7); jarGeo.translate(0, 0.15, 0);
      var lidGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.06, 7);
      var flagGeo = new THREE.BoxGeometry(0.02, 0.18, 0.28);
      var poleGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.9, 4); poleGeo.translate(0, 0.45, 0);
      var ringGeo = new THREE.RingGeometry(0.62, 0.78, 6); ringGeo.rotateX(-Math.PI / 2); ringGeo.rotateY(Math.PI / 6);
      var stoneGeo = new THREE.OctahedronGeometry(0.22, 0); stoneGeo.scale(0.7, 1.6, 0.7);
      var tentGeo = new THREE.ConeGeometry(0.38, 0.45, 6); tentGeo.translate(0, 0.22, 0);
      var budGeo = new THREE.ConeGeometry(0.1, 0.26, 5); budGeo.rotateX(Math.PI); budGeo.translate(0, 0.08, 0);
      var signGeo = new THREE.BoxGeometry(0.5, 0.32, 0.05);
      var stakeGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.7, 4); stakeGeo.translate(0, 0.35, 0);
      poiMeshes = {
        stem: inst(stemGeo, lambert('#4f8f3a'), n),
        head: inst(headGeo, lambert('#ffffff'), n),
        heart: inst(heartGeo, lambert('#ffd23f', { emissive: '#5a3a00' }), n),
        skep: inst(skepGeo, lambert('#d9a54a'), n),
        jar: inst(jarGeo, new THREE.MeshLambertMaterial({ color: '#f0a81f', emissive: '#6a3c00', flatShading: true }), n),
        lid: inst(lidGeo, lambert('#ffffff'), n),
        pole: inst(poleGeo, lambert('#6d4b2c'), n),
        flag: inst(flagGeo, lambert('#ffffff'), n),
        ring: inst(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }), n),
        stone: inst(stoneGeo, lambert('#cfc6b3'), n),
        tent: inst(tentGeo, lambert('#ffffff'), n),
        bud: inst(budGeo, lambert('#ffffff'), n),
        sign: inst(signGeo, lambert('#ffffff'), n),
        stake: inst(stakeGeo, lambert('#c98b4a'), n)
      };
      layoutPois();
    }

    function stackOffset(p) {
      if (!p.stack) return [0, 0];
      var a = p.stack * 2.4, r = 0.3 + 0.12 * Math.floor(p.stack / 6);
      return [Math.cos(a) * r, Math.sin(a) * r];
    }

    function layoutPois() {
      Object.keys(poiMeshes).forEach(function (k) { poiMeshes[k].count = 0; });
      state.poiByTask = {};
      var today = startOfDay(Date.now());
      state.layout.pois.forEach(function (p) {
        var t = state.taskById[p.taskId];
        if (!t || !state.visibleTask[t.id]) return;
        var tile = state.layout.tiles[p.key];
        var w = L.toWorld(tile.q, tile.r);
        var off = stackOffset(p);
        var x = w.x + off[0], z = w.z + off[1], y = tile.h + 0.12;
        var cue = cues(t, today);
        var sc = (p.stack ? 0.72 : 1) * (t.future ? 0.7 : 1);
        var PM = poiMeshes;
        var ht = 0.8 + critScale(t.criticality) * 0.4;
        if (t.state === 'done') {
          put(PM.jar, x, y, z, sc, sc, sc, 0);
          put(PM.lid, x, y + 0.31 * sc, z, sc, sc, sc, 0, '#fff4d6');
        } else if (t.state === 'doing') {
          put(PM.skep, x, y, z, sc, sc * 1.25, sc, 0);
          put(PM.heart, x, y + 0.36 * sc, z, sc * 0.8, sc * 0.8, sc * 0.8, 0);
        } else if (t.state === 'info') {
          put(PM.pole, x, y, z, 1, 0.7, 1, 0);
          put(PM.sign, x, y + 0.55, z, 1, 1, 1, L.rand01(t.id) * 1.2, '#e9d3a6');
        } else {
          var petal = t.state === 'waiting' ? '#9d8fc2' : cue.overdue ? '#d98a6a' : '#ffffff';
          put(PM.stem, x, y, z, sc, sc * ht, sc, 0);
          var hy = y + 0.55 * sc * ht;
          if (t.state === 'waiting') put(PM.bud, x, hy, z, sc, sc, sc, 0, petal);
          else {
            put(PM.head, x, hy, z, sc, sc * 0.55, sc, L.rand01(t.id) * 6, petal);
            put(PM.heart, x, hy + 0.05, z, sc, sc * 0.6, sc, 0);
          }
        }
        if (!p.stack) {
          if (t.milestone) put(PM.stone, x - 0.42, y + 0.2, z + 0.2, 1, 1, 1, 0);
          else if (t.kind === 'meeting') put(PM.tent, x + 0.42, y, z - 0.25, 1, 1, 1, 0, '#f4f1ea');
          else if (t.kind === 'planning') put(PM.stake, x - 0.4, y, z - 0.2, 1, 1, 1, 0);
          if (t.criticality === 'urgent' || t.criticality === 'moyen') {
            if (t.state !== 'done') {
              put(PM.pole, x + 0.3, y, z + 0.3, 1, 1, 1, 0);
              put(PM.flag, x + 0.3, y + 0.8, z + 0.44, 1, 1, 1, 0, t.criticality === 'urgent' ? '#DC2626' : '#D97706');
            }
          }
          if ((cue.overdue || cue.soon) && t.state !== 'done' && t.state !== 'info') {
            put(PM.ring, w.x, y + 0.02, w.z, 1, 1, 1, 0, cue.overdue ? '#DC2626' : '#F2A93B');
          }
        }
        state.poiByTask[t.id] = { x: x, y: y, z: z, key: p.key, stack: p.stack, top: y + (t.state === 'done' ? 0.45 : 0.85) };
      });
      Object.keys(poiMeshes).forEach(function (k) {
        var m = poiMeshes[k];
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
        m.computeBoundingSphere();
      });
      buildBees();
    }

    function critScale(c) { return c === 'urgent' ? 1 : c === 'moyen' ? 0.55 : c === 'bas' ? 0 : 0.3; }
    function startOfDay(ms) { var d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }
    function cues(t, today) {
      var end = t.end ? startOfDay(t.end) : null;
      return {
        overdue: end != null && end < today && t.state !== 'done',
        soon: end != null && end >= today && end - today <= 7 * 864e5,
        noDate: end == null
      };
    }

    // ---------- Abeilles (animation limitée) ----------
    var bees = null;
    function buildBees() {
      if (bees) { dyn.remove(bees.mesh); bees.mesh.geometry.dispose(); }
      var anchors = [];
      state.layout.pois.forEach(function (p) {
        var t = state.taskById[p.taskId];
        var pos = state.poiByTask[p.taskId];
        if (t && pos && t.state === 'doing') anchors.push({ x: pos.x, y: pos.y + 0.5, z: pos.z, id: t.id });
      });
      state.layout.territories.forEach(function (tr) {
        if (state.stats[tr.projectId].doing > 0 && tr.anchor) anchors.push({ x: tr.anchor.x, y: tr.anchor.y - 0.2, z: tr.anchor.z, id: tr.projectId, hive: true });
      });
      var cap = quality === 'low' ? 0 : quality === 'medium' ? 90 : 240;
      var per = 3;
      var list = [];
      for (var i = 0; i < anchors.length && list.length < cap; i++) for (var j = 0; j < per && list.length < cap; j++) list.push({ a: anchors[i], ph: L.rand01(anchors[i].id + j) * 6.28, sp: 1.2 + L.rand01('s' + anchors[i].id + j) * 1.2, r: 0.35 + j * 0.15 });
      var geo = new THREE.SphereGeometry(0.055, 5, 3);
      var mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#2b2106' }), Math.max(1, list.length));
      mesh.count = list.length;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      dyn.add(mesh);
      bees = { mesh: mesh, list: list };
    }
    function animateBees(t) {
      if (!bees || !bees.list.length || reducedMotion) return;
      var m = bees.mesh;
      for (var i = 0; i < bees.list.length; i++) {
        var b = bees.list[i];
        var a = t * b.sp + b.ph;
        tmpP.set(b.a.x + Math.cos(a) * b.r, b.a.y + Math.sin(a * 2.3) * 0.12, b.a.z + Math.sin(a) * b.r);
        tmpM.makeTranslation(tmpP.x, tmpP.y, tmpP.z);
        m.setMatrixAt(i, tmpM);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    // ---------- Apiculteur ----------
    var keeper = new THREE.Group();
    (function buildKeeper() {
      var suit = lambert('#f7f5ee'), glove = lambert('#e8c26a'), veil = new THREE.MeshLambertMaterial({ color: '#2d3a30', transparent: true, opacity: 0.55 });
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.46, 8), suit); body.position.y = 0.38; keeper.add(body);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), lambert('#f1c9a5')); head.position.y = 0.76; keeper.add(head);
      var v = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 10, 1, true), veil); v.position.y = 0.76; keeper.add(v);
      var brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), lambert('#e9dcb5')); brim.position.y = 0.88; keeper.add(brim);
      var crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.12, 12), lambert('#e9dcb5')); crown.position.y = 0.95; keeper.add(crown);
      var legG = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 6);
      var l1 = new THREE.Mesh(legG, suit); l1.position.set(-0.08, 0.1, 0); keeper.add(l1);
      var l2 = new THREE.Mesh(legG, suit); l2.position.set(0.08, 0.1, 0); keeper.add(l2);
      var smoker = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 8), lambert('#b8bcc2')); smoker.position.set(0.24, 0.36, 0.06); keeper.add(smoker);
      var hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), glove); hand.position.set(-0.22, 0.34, 0.04); keeper.add(hand);
      keeper.userData = { l1: l1, l2: l2, body: body };
      var shadow = new THREE.Mesh(new THREE.CircleGeometry(0.28, 12), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.18, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; keeper.add(shadow);
      keeper.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
      scene.add(keeper);
    })();
    var keeperVel = new THREE.Vector2();

    function groundAt(x, z) {
      var h = L.fromWorld(x, z);
      var t = state.layout && state.layout.tiles[L.key(h[0], h[1])];
      if (!t) return null;
      if (t.kind === 'water') return t.bridge ? 0.66 : 0.3;
      if (t.kind === 'mountain') return null;
      return t.h + 0.12;
    }

    // ---------- Caméra & contrôles ----------
    var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function updateCamera(dt, snap) {
      var goal = state.follow ? new THREE.Vector3(keeper.position.x, keeper.position.y + 0.4, keeper.position.z) : state.focusGoal || state.target;
      var k = snap || reducedMotion ? 1 : 1 - Math.pow(0.001, dt);
      state.target.lerp(goal, k);
      var cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
      camera.position.set(
        state.target.x + Math.sin(state.yaw) * cp * state.dist,
        state.target.y + sp * state.dist,
        state.target.z + Math.cos(state.yaw) * cp * state.dist
      );
      camera.lookAt(state.target);
      if (quality === 'high') {
        sun.position.set(state.target.x + style.sunPos[0], style.sunPos[1], state.target.z + style.sunPos[2]);
        sun.target.position.copy(state.target);
      }
    }

    var el = renderer.domElement;
    function onKey(e, down) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      var k = e.key.toLowerCase();
      var map = { arrowup: 'f', z: 'f', w: 'f', arrowdown: 'b', s: 'b', arrowleft: 'l', q: 'l', a: 'l', arrowright: 'r', d: 'r' };
      if (map[k]) { state.keys[map[k]] = down; if (down) { state.follow = true; state.walkTo = null; } e.preventDefault(); return; }
      if (!down) return;
      if (k === 'e' || k === 'pageup') { state.yaw += Math.PI / 6; e.preventDefault(); }
      else if (k === 'r' || k === 'pagedown') { state.yaw -= Math.PI / 6; e.preventDefault(); }
      else if (k === '+' || k === '=') zoomBy(0.8);
      else if (k === '-') zoomBy(1.25);
      else if (k === 'enter' || k === ' ') { if (state.near) select(state.near); e.preventDefault(); }
      else if (k === 'escape') select(null);
      else if (k === 'c') recenter();
    }
    var kd = function (e) { onKey(e, true); }, ku = function (e) { onKey(e, false); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    function zoomBy(f) { state.dist = Math.max(style.minDist, Math.min(style.maxDist, state.dist * f)); }
    el.addEventListener('wheel', function (e) { e.preventDefault(); zoomBy(e.deltaY > 0 ? 1.12 : 0.89); }, { passive: false });

    var pointers = {}, drag = null, pinch = null;
    var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function pick(clientX, clientY) {
      var rect = el.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects([meshes.cap, meshes.water].filter(Boolean), false);
      if (!hits.length) return null;
      var h = hits[0];
      var k = h.object.userData.keys[h.instanceId];
      return { key: k, point: h.point };
    }
    function taskAtKey(k, point) {
      var ids = state.layout.pois.filter(function (p) { return p.key === k && state.visibleTask[p.taskId]; }).map(function (p) { return p.taskId; });
      if (!ids.length) return null;
      if (ids.length === 1 || !point) return ids[0];
      var best = ids[0], bd = Infinity;
      ids.forEach(function (id) { var p = state.poiByTask[id]; var d = Math.hypot(p.x - point.x, p.z - point.z); if (d < bd) { bd = d; best = id; } });
      return best;
    }
    function hiveAtKey(k) {
      var t = state.layout.tiles[k];
      return t && t.kind === 'hive' ? t.projectId : null;
    }
    el.addEventListener('pointerdown', function (e) {
      el.focus({ preventScroll: true });
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: state.dist }; drag = null;
      } else drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, yaw: state.yaw, pitch: state.pitch, moved: false };
    });
    el.addEventListener('pointermove', function (e) {
      if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);
      if (pinch && ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.x - b.x, a.y - b.y);
        state.dist = Math.max(style.minDist, Math.min(style.maxDist, pinch.dist * pinch.d / Math.max(20, d)));
        return;
      }
      if (drag) {
        var dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (Math.hypot(dx, dy) > 6) drag.moved = true;
        if (drag.moved) {
          state.yaw = drag.yaw - dx * 0.006;
          if (style.orbitFree) state.pitch = Math.max(0.45, Math.min(1.35, drag.pitch + dy * 0.004));
        }
        return;
      }
      if (e.pointerType === 'mouse') {
        var h = pick(e.clientX, e.clientY);
        var id = h ? taskAtKey(h.key, h.point) : null;
        var hp = h && !id ? hiveAtKey(h.key) : null;
        var hv = id ? { task: id } : hp ? { project: hp } : null;
        if (JSON.stringify(hv) !== JSON.stringify(state.hovered)) {
          state.hovered = hv;
          el.style.cursor = hv ? 'pointer' : 'grab';
          opts.onHover && opts.onHover(hv);
        }
      }
    });
    function endPointer(e) {
      delete pointers[e.pointerId];
      if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; drag = null; return; }
      if (drag && !drag.moved) {
        var h = pick(e.clientX, e.clientY);
        if (h) {
          var id = taskAtKey(h.key, h.point);
          var hp = hiveAtKey(h.key);
          if (id) { walkToTask(id); select(id); }
          else if (hp) { opts.onProject && opts.onProject(hp); walkToPoint(h.point.x, h.point.z); }
          else walkToPoint(h.point.x, h.point.z);
        }
      }
      drag = null;
    }
    el.addEventListener('pointerup', endPointer);
    el.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; drag = null; pinch = null; });

    function walkToPoint(x, z) { state.walkTo = { x: x, z: z }; state.follow = true; }
    function walkToTask(id) {
      var p = state.poiByTask[id];
      if (!p) return;
      var dx = keeper.position.x - p.x, dz = keeper.position.z - p.z, d = Math.hypot(dx, dz) || 1;
      walkToPoint(p.x + dx / d * 0.7, p.z + dz / d * 0.7);
    }

    function stepKeeper(dt) {
      var f = (state.keys.f ? 1 : 0) - (state.keys.b ? 1 : 0) + (-state.joy.y);
      var s = (state.keys.r ? 1 : 0) - (state.keys.l ? 1 : 0) + state.joy.x;
      var mx = 0, mz = 0;
      if (f || s) {
        // relatif à la caméra
        var fx = -Math.sin(state.yaw), fz = -Math.cos(state.yaw);
        var rx = -fz, rz = fx;
        mx = fx * f + rx * s; mz = fz * f + rz * s;
        state.walkTo = null;
      } else if (state.walkTo) {
        mx = state.walkTo.x - keeper.position.x; mz = state.walkTo.z - keeper.position.z;
        if (Math.hypot(mx, mz) < 0.12) { state.walkTo = null; mx = mz = 0; }
      }
      var len = Math.hypot(mx, mz);
      var speed = 3.6;
      if (len > 0) {
        mx /= len; mz /= len;
        var nx = keeper.position.x + mx * speed * dt, nz = keeper.position.z + mz * speed * dt;
        var g = groundAt(nx, nz);
        if (g == null) { g = groundAt(nx, keeper.position.z); if (g != null) nz = keeper.position.z; else { g = groundAt(keeper.position.x, nz); if (g != null) nx = keeper.position.x; } }
        if (g != null) {
          keeper.position.x = nx; keeper.position.z = nz;
          keeper.rotation.y = Math.atan2(mx, mz);
        } else state.walkTo = null;
        state.walkPhase = (state.walkPhase || 0) + dt * 12;
      }
      var gy = groundAt(keeper.position.x, keeper.position.z);
      if (gy != null) keeper.position.y += (gy - keeper.position.y) * Math.min(1, dt * 14);
      var u = keeper.userData, ph = state.walkPhase || 0, moving = len > 0 && !reducedMotion;
      u.l1.position.z = moving ? Math.sin(ph) * 0.06 : 0;
      u.l2.position.z = moving ? -Math.sin(ph) * 0.06 : 0;
      u.body.position.y = 0.38 + (moving ? Math.abs(Math.sin(ph)) * 0.03 : 0);

      // Proximité : la tâche la plus proche (lecture seule).
      var near = null, nd = 1.25;
      var kq = L.fromWorld(keeper.position.x, keeper.position.z);
      for (var dq = -1; dq <= 1; dq++) for (var dr = -1; dr <= 1; dr++) {
        var k = L.key(kq[0] + dq, kq[1] + dr);
        var list = state.poisByKey[k];
        if (!list) continue;
        list.forEach(function (id) {
          var p = state.poiByTask[id]; if (!p) return;
          var d = Math.hypot(p.x - keeper.position.x, p.z - keeper.position.z);
          if (d < nd) { nd = d; near = id; }
        });
      }
      if (near !== state.near) {
        state.near = near;
        if (near) {
          var t = state.taskById[near];
          if (t && t.state === 'todo' && !state.nectar[near]) { state.nectar[near] = true; opts.onNectar && opts.onNectar(Object.keys(state.nectar).length, near); }
        }
        opts.onNear && opts.onNear(near);
      }
    }

    // ---------- Libellés HTML sans chevauchement ----------
    var labelLayer = document.createElement('div');
    labelLayer.className = 'rucher-labels';
    labelLayer.setAttribute('aria-hidden', 'true');
    container.appendChild(labelLayer);
    var labelPool = {};
    function labelEl(id, cls) {
      var l = labelPool[id];
      if (!l) { l = document.createElement('div'); l.className = cls; labelLayer.appendChild(l); labelPool[id] = l; }
      return l;
    }
    var projV = new THREE.Vector3();
    function updateLabels() {
      var w = el.clientWidth, h = el.clientHeight;
      var cand = [];
      var zoomedOut = state.dist > 45;
      state.layout.territories.forEach(function (tr) {
        if (!tr.anchor || !state.projectVisible[tr.projectId]) return;
        cand.push({ id: 'p:' + tr.projectId, kind: 'project', pid: tr.projectId, pos: tr.anchor, prio: state.focusProject === tr.projectId ? 1000 : 500 + (state.stats[tr.projectId].total || 0) });
      });
      var showTasks = !zoomedOut;
      if (showTasks) {
        var ids = {};
        if (state.selected) { ids[state.selected] = 900; var st0 = state.taskById[state.selected]; (st0 && st0.dependsOn || []).forEach(function (d) { ids[d] = 700; }); }
        if (state.near) ids[state.near] = 800;
        if (state.hovered && state.hovered.task) ids[state.hovered.task] = 850;
        if (style.labelAll || state.dist < 16) {
          var kp = keeper.position;
          Object.keys(state.poiByTask).forEach(function (id) {
            var p = state.poiByTask[id];
            var d = Math.hypot(p.x - kp.x, p.z - kp.z);
            if (d < (style.labelAll ? 9 : 5) && !ids[id]) ids[id] = 300 - d * 10;
          });
        }
        Object.keys(ids).forEach(function (id) {
          var p = state.poiByTask[id]; if (!p) return;
          cand.push({ id: 't:' + id, kind: 'task', tid: id, pos: new THREE.Vector3(p.x, p.top, p.z), prio: ids[id] });
        });
      }
      cand.sort(function (a, b) { return b.prio - a.prio; });
      var placed = [], seen = {};
      cand.forEach(function (c) {
        projV.copy(c.pos).project(camera);
        if (projV.z > 1 || projV.x < -1.1 || projV.x > 1.1 || projV.y < -1.1 || projV.y > 1.1) return;
        var sx = (projV.x + 1) / 2 * w, sy = (1 - projV.y) / 2 * h;
        var l = labelEl(c.id, 'rucher-label rucher-label--' + c.kind);
        if (c.kind === 'project') {
          var s = state.stats[c.pid], p = state.projectById[c.pid];
          var html = '<span class="rl-dot" style="background:' + (p.color || '#c9503a') + '"></span><span class="rl-name">' + esc(p.name || 'Projet sans nom') + '</span>';
          if (style.projectMeta || zoomedOut || state.focusProject === c.pid) html += '<span class="rl-meta">' + s.todo + ' à faire · ' + s.doing + ' en cours · ' + s.done + ' ✓</span>';
          if (l._html !== html) { l.innerHTML = html; l._html = html; }
        } else {
          var t = state.taskById[c.tid];
          var st = state.stack[c.tid];
          var html2 = '<span class="rl-state rl-state--' + t.state + '"></span>' + esc(t.title || 'Tâche sans titre') + (st > 1 ? ' <b class="rl-stack">+' + (st - 1) + '</b>' : '');
          if (l._html !== html2) { l.innerHTML = html2; l._html = html2; }
          l.classList.toggle('is-selected', c.tid === state.selected);
          l.classList.toggle('is-near', c.tid === state.near);
        }
        var bw = l._w || (l._w = l.offsetWidth || 120), bh = l._h || (l._h = l.offsetHeight || 22);
        if (l._html !== l._measured) { bw = l._w = l.offsetWidth; bh = l._h = l.offsetHeight; l._measured = l._html; }
        var box = { x: sx - bw / 2, y: sy - bh - 4, w: bw, h: bh };
        if (box.x < 2 || box.y < 2 || box.x + box.w > w - 2 || box.y + box.h > h - 2) return;
        for (var i = 0; i < placed.length; i++) {
          var o = placed[i];
          if (box.x < o.x + o.w + 4 && box.x + box.w + 4 > o.x && box.y < o.y + o.h + 2 && box.y + box.h + 2 > o.y) return;
        }
        placed.push(box);
        seen[c.id] = true;
        l.style.transform = 'translate(' + Math.round(box.x) + 'px,' + Math.round(box.y) + 'px)';
        l.style.visibility = 'visible';
      });
      Object.keys(labelPool).forEach(function (id) { if (!seen[id]) labelPool[id].style.visibility = 'hidden'; });
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    // ---------- Données ----------
    function setData(data) {
      state.data = data;
      state.taskById = {}; state.projectById = {}; state.stats = {}; state.stack = {};
      data.projects.forEach(function (p) { state.projectById[p.id] = p; state.stats[p.id] = { todo: 0, doing: 0, done: 0, waiting: 0, total: 0, overdue: 0 }; });
      var today = startOfDay(Date.now());
      data.tasks.forEach(function (t) {
        state.taskById[t.id] = t;
        var s = state.stats[t.projectId]; if (!s) return;
        s[t.state] = (s[t.state] || 0) + 1; s.total++;
        if (cues(t, today).overdue) s.overdue++;
      });
      state.layout = L.build({ projects: data.projects, tasks: data.tasks, memory: data.memory });
      state.poisByKey = {};
      state.layout.pois.forEach(function (p) {
        (state.poisByKey[p.key] = state.poisByKey[p.key] || []).push(p.taskId);
        state.stack[p.taskId] = state.layout.occupancy[p.key];
      });
      applyFilterSets();
      buildWorld();
      if (!state.placed) {
        var first = state.layout.territories[0];
        if (first) {
          var w = L.toWorld(first.q + 1, first.r + 1);
          keeper.position.set(w.x, 1, w.z);
        }
        state.placed = true;
        updateCamera(1, true);
      }
      return state.layout;
    }
    function applyFilterSets() {
      state.visibleTask = {}; state.projectVisible = {};
      var f = state.filter;
      state.data.tasks.forEach(function (t) { if (!f || f(t)) state.visibleTask[t.id] = true; });
      state.data.projects.forEach(function (p) { state.projectVisible[p.id] = true; });
    }
    function setFilter(fn) { state.filter = fn; applyFilterSets(); if (poiMeshes) layoutPois(); }

    var linkGroup = new THREE.Group();
    scene.add(linkGroup);
    function drawLinks(id) {
      while (linkGroup.children.length) { var c = linkGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); }
      if (!id) return;
      var t = state.taskById[id];
      var from = state.poiByTask[id];
      if (!t || !from) return;
      var pairs = [];
      (t.dependsOn || []).forEach(function (d) { pairs.push({ other: d, color: '#6b4ce6' }); });
      state.data.tasks.forEach(function (o) { if ((o.dependsOn || []).indexOf(id) !== -1) pairs.push({ other: o.id, color: '#e07b1a' }); });
      pairs.forEach(function (pr) {
        var to = state.poiByTask[pr.other];
        var end;
        if (to) end = new THREE.Vector3(to.x, to.top, to.z);
        else {
          var o = state.taskById[pr.other];
          var tr = o && state.layout.territories.filter(function (x) { return x.projectId === o.projectId; })[0];
          if (!tr || !tr.anchor) return;
          end = tr.anchor.clone();
        }
        var a = new THREE.Vector3(from.x, from.top, from.z);
        var mid = a.clone().lerp(end, 0.5);
        mid.y += 1 + a.distanceTo(end) * 0.25;
        var curve = new THREE.QuadraticBezierCurve3(a, mid, end);
        var geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
        var line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: pr.color, dashSize: 0.25, gapSize: 0.18 }));
        line.computeLineDistances();
        linkGroup.add(line);
      });
      if (t.secondaryProjectId) {
        var tr2 = state.layout.territories.filter(function (x) { return x.projectId === t.secondaryProjectId; })[0];
        if (tr2 && tr2.anchor) {
          var a2 = new THREE.Vector3(from.x, from.top, from.z), e2 = tr2.anchor.clone();
          var m2 = a2.clone().lerp(e2, 0.5); m2.y += 1.5;
          var g2 = new THREE.BufferGeometry().setFromPoints(new THREE.QuadraticBezierCurve3(a2, m2, e2).getPoints(40));
          var l2 = new THREE.Line(g2, new THREE.LineDashedMaterial({ color: '#2a9d8f', dashSize: 0.12, gapSize: 0.12 }));
          l2.computeLineDistances(); linkGroup.add(l2);
        }
      }
    }
    function select(id) {
      state.selected = id;
      drawLinks(id);
      opts.onSelect && opts.onSelect(id);
    }
    function focusProject(pid) {
      var tr = state.layout.territories.filter(function (t) { return t.projectId === pid; })[0];
      if (!tr) return;
      state.focusProject = pid;
      var w = L.toWorld(tr.q, tr.r);
      var off = L.toWorld(0, 1);
      walkToPoint(w.x + off.x * 0.9, w.z + off.z * 0.9);
      state.dist = Math.min(state.dist, 22);
    }
    function recenter() {
      state.follow = true; state.walkTo = null; state.dist = style.dist; state.pitch = style.pitch;
    }
    function overview() {
      var xs = 0, zs = 0, n = 0, maxd = 0;
      state.layout.territories.forEach(function (t) { var w = L.toWorld(t.q, t.r); xs += w.x; zs += w.z; n++; });
      if (!n) return;
      var cx = xs / n, cz = zs / n;
      state.layout.territories.forEach(function (t) { var w = L.toWorld(t.q, t.r); maxd = Math.max(maxd, Math.hypot(w.x - cx, w.z - cz)); });
      state.follow = false;
      state.focusGoal = new THREE.Vector3(cx, 0, cz);
      state.dist = Math.min(style.maxDist, Math.max(30, maxd * 2.4 + 16));
    }

    var qualityPresets = { low: { ratio: 1, shadows: false }, medium: { ratio: 1.5, shadows: false }, high: { ratio: 2, shadows: true } };
    function applyQuality() {
      var q = qualityPresets[quality] || qualityPresets.medium;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.ratio));
      renderer.shadowMap.enabled = q.shadows;
      sun.castShadow = q.shadows;
      resize();
    }
    function setQuality(q) {
      if (q === 'auto') q = state.layout && state.layout.pois.length > 2500 ? 'low' : state.layout && state.layout.pois.length > 600 ? 'medium' : 'high';
      var changed = q !== quality;
      quality = q;
      if (changed && state.layout) { buildWorld(); } else applyQuality();
      return quality;
    }

    function resize() {
      var w = container.clientWidth || 300, h = container.clientHeight || 300;
      renderer.setSize(w, h, false);
      el.style.width = w + 'px'; el.style.height = h + 'px';
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    var ro = new ResizeObserver(resize);
    ro.observe(container);

    var last = performance.now(), fpsAcc = 0, fpsN = 0;
    function frame(now) {
      if (state.disposed) return;
      state.raf = requestAnimationFrame(frame);
      if (document.hidden) { last = now; return; }
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      state.time += dt;
      if (!state.layout) return;
      stepKeeper(dt);
      updateCamera(dt);
      animateBees(state.time);
      renderer.render(scene, camera);
      updateLabels();
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 1) { opts.onFrame && opts.onFrame({ fps: Math.round(fpsN / fpsAcc), quality: quality }); fpsAcc = 0; fpsN = 0; }
    }

    if (quality === 'auto') quality = 'high';
    setData(opts.data);
    if ((opts.quality || 'auto') === 'auto') setQuality('auto');
    resize();
    state.raf = requestAnimationFrame(frame);

    return {
      setData: setData,
      setFilter: setFilter,
      select: select,
      focusProject: focusProject,
      walkToTask: walkToTask,
      recenter: recenter,
      overview: overview,
      setQuality: setQuality,
      zoomBy: zoomBy,
      rotate: function (d) { state.yaw += d; },
      setJoystick: function (x, y) { state.joy.x = x; state.joy.y = y; if (x || y) { state.follow = true; state.walkTo = null; } },
      stats: function () { return state.stats; },
      layout: function () { return state.layout; },
      nearTask: function () { return state.near; },
      nectarCount: function () { return Object.keys(state.nectar).length; },
      dispose: function () {
        state.disposed = true; cancelAnimationFrame(state.raf); ro.disconnect();
        window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
        clearWorld(); renderer.dispose(); el.remove(); labelLayer.remove();
      }
    };
  }

  function webglAvailable() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  window.RucherEngine = { create: create, webglAvailable: webglAvailable, STATE: STATE };
})();
