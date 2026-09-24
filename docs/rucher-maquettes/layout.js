/* Rucher — disposition déterministe de la carte hexagonale.
 * Module pur (aucun DOM, aucune dépendance) : mêmes données => même carte.
 * Entrée normalisée :
 *   projects: [{ id, name, color, group, createdAt }]
 *   tasks:    [{ id, projectId, title, state, priority, type, start, end, createdAt }]
 *   memory (facultatif) : { projects: {id: "i,j"}, tasks: {id: "q,r"} } — emplacements précédents
 * Sortie : { territories, tiles, pois, paths, memory, bounds }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RucherLayout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var R = 4; // rayon d'une cellule de territoire (anneau 4 = lisière)
  var INNER = 3; // tuiles 0..3 = territoire, 0 = ruche
  var AX = [2 * R + 1, -R];
  var BX = [R, R + 1];
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

  // FNV-1a 32 bits puis mélange : stable entre navigateurs et Node.
  function hash(str) {
    var h = 0x811c9dc5;
    str = String(str);
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }
  function rand01(str) { return hash(str) / 4294967296; }

  function key(q, r) { return q + ',' + r; }
  function dist(aq, ar, bq, br) {
    var dq = aq - bq, dr = ar - br;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }
  function macroCenter(i, j) { return [AX[0] * i + BX[0] * j, AX[1] * i + BX[1] * j]; }

  // Spirale des emplacements de territoires (coordonnées axiales du réseau macro).
  function spiral(count) {
    var out = [[0, 0]];
    for (var k = 1; out.length < count; k++) {
      var q = DIRS[4][0] * k, r = DIRS[4][1] * k;
      for (var s = 0; s < 6; s++) {
        for (var n = 0; n < k; n++) {
          out.push([q, r]);
          q += DIRS[s][0]; r += DIRS[s][1];
        }
      }
    }
    return out;
  }

  function byCreation(a, b) {
    var ca = a.createdAt == null ? Infinity : a.createdAt;
    var cb = b.createdAt == null ? Infinity : b.createdAt;
    if (ca !== cb) return ca < cb ? -1 : 1;
    return String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0;
  }

  function ringTiles(cq, cr, radius) {
    var out = [];
    for (var q = -radius; q <= radius; q++) {
      for (var r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
        out.push([cq + q, cr + r, dist(0, 0, q, r)]);
      }
    }
    return out;
  }

  var BIOMES = ['prairie', 'lavande', 'verger', 'bruyere', 'tournesol', 'foret'];

  function placeProjects(projects, memory) {
    var sorted = projects.slice().sort(byCreation);
    var slots = spiral(Math.max(19, sorted.length * 4 + 7));
    var index = {};
    slots.forEach(function (s, n) { index[key(s[0], s[1])] = n; });
    var used = {}; // "i,j" -> projectId
    var at = {}; // projectId -> [i,j]
    var groupOf = {};
    sorted.forEach(function (p) { groupOf[p.id] = p.group || null; });

    // 1. Emplacements mémorisés : une mise à jour ne redistribue pas la carte.
    sorted.forEach(function (p) {
      var m = memory && memory.projects && memory.projects[p.id];
      if (m && !used[m] && index[m] !== undefined) {
        used[m] = p.id;
        at[p.id] = m.split(',').map(Number);
      }
    });

    function neighborsOtherGroup(s, group) {
      for (var d = 0; d < 6; d++) {
        var o = used[key(s[0] + DIRS[d][0], s[1] + DIRS[d][1])];
        if (o && groupOf[o] !== group) return true;
      }
      return false;
    }

    // 2. Nouveaux projets, par ordre de création : un projet ajouté ne déplace aucun ancien.
    sorted.forEach(function (p) {
      if (at[p.id]) return;
      var g = groupOf[p.id];
      var mates = g ? sorted.filter(function (o) { return at[o.id] && groupOf[o.id] === g; }) : [];
      var best = null, bestScore = Infinity;
      slots.forEach(function (s, n) {
        var k = key(s[0], s[1]);
        if (used[k]) return;
        var score;
        if (mates.length) {
          // Même dossier : au plus près des territoires déjà posés du dossier.
          var d = Infinity;
          mates.forEach(function (o) { d = Math.min(d, dist(s[0], s[1], at[o.id][0], at[o.id][1])); });
          score = d * 1000 + n;
        } else {
          // Nouveau dossier (ou projet libre) : premier emplacement sans voisin d'un autre dossier.
          score = n + (neighborsOtherGroup(s, g) ? 100000 : 0);
        }
        if (score < bestScore) { bestScore = score; best = s; }
      });
      used[key(best[0], best[1])] = p.id;
      at[p.id] = best;
    });
    return { at: at, used: used, sorted: sorted };
  }

  function build(input) {
    var projects = (input.projects || []).filter(function (p) { return p && p.id != null; });
    var tasks = (input.tasks || []).filter(function (t) { return t && t.id != null; });
    var memory = input.memory || {};
    var placed = placeProjects(projects, memory);
    var tiles = {};
    var territories = [];
    var projectById = {};
    projects.forEach(function (p) { projectById[p.id] = p; });

    function setTile(q, r, t) { tiles[key(q, r)] = Object.assign({ q: q, r: r }, t); }

    placed.sorted.forEach(function (p) {
      var slot = placed.at[p.id];
      var c = macroCenter(slot[0], slot[1]);
      var biome = BIOMES[hash('biome:' + p.id) % BIOMES.length];
      var terr = { projectId: p.id, slot: slot, q: c[0], r: c[1], biome: biome, tiles: [] };
      ringTiles(c[0], c[1], R).forEach(function (t) {
        var h = rand01('h:' + t[0] + ',' + t[1]);
        if (t[2] === 0) {
          setTile(t[0], t[1], { kind: 'hive', projectId: p.id, biome: biome, h: 0.75 });
        } else if (t[2] <= INNER) {
          setTile(t[0], t[1], { kind: 'land', projectId: p.id, biome: biome, ring: t[2], h: 0.42 + h * 0.22 });
          terr.tiles.push(key(t[0], t[1]));
        } else {
          setTile(t[0], t[1], { kind: 'edge', projectId: p.id, biome: biome, h: 0.3 + h * 0.15 });
        }
      });
      territories.push(terr);
    });

    // Lisières : entre deux dossiers différents, eau peu profonde ; même dossier, bois et prés.
    var terrBySlot = {};
    territories.forEach(function (t) { terrBySlot[key(t.slot[0], t.slot[1])] = t; });
    Object.keys(tiles).forEach(function (k) {
      var t = tiles[k];
      if (t.kind !== 'edge') return;
      var foreign = false, sameGroupNeighbor = false;
      for (var d = 0; d < 6; d++) {
        var n = tiles[key(t.q + DIRS[d][0], t.r + DIRS[d][1])];
        if (!n || n.projectId === t.projectId) continue;
        var g1 = projectById[t.projectId] && projectById[t.projectId].group;
        var g2 = projectById[n.projectId] && projectById[n.projectId].group;
        if (g1 && g1 === g2) sameGroupNeighbor = true; else foreign = true;
      }
      var hasNeighbor = foreign || sameGroupNeighbor;
      if (!hasNeighbor) t.kind = rand01('w:' + k) < 0.55 ? 'water' : 'wild';
      else if (foreign) t.kind = 'water';
      else t.kind = 'wild';
      if (t.kind === 'water') t.h = 0.12;
    });

    // Bordure de paysage autour des territoires occupés (lacs, forêts, montagnes).
    var ring = {};
    territories.forEach(function (tr) {
      for (var d = 0; d < 6; d++) {
        var s = [tr.slot[0] + DIRS[d][0], tr.slot[1] + DIRS[d][1]];
        var sk = key(s[0], s[1]);
        if (!terrBySlot[sk]) ring[sk] = s;
      }
    });
    Object.keys(ring).forEach(function (sk) {
      var s = ring[sk];
      var c = macroCenter(s[0], s[1]);
      var roll = rand01('scene:' + sk);
      var theme = roll < 0.4 ? 'lake' : roll < 0.75 ? 'forest' : 'mountain';
      ringTiles(c[0], c[1], R).forEach(function (t) {
        var k = key(t[0], t[1]);
        if (tiles[k]) return;
        var h = rand01('h:' + k);
        var kind;
        if (theme === 'lake') kind = t[2] <= 2 ? 'water' : (h < 0.5 ? 'water' : 'wild');
        else if (theme === 'mountain') kind = t[2] <= 1 ? 'mountain' : t[2] <= 2 && h < 0.6 ? 'mountain' : 'wild';
        else kind = h < 0.12 ? 'water' : 'forest';
        setTile(t[0], t[1], {
          kind: kind, projectId: null, biome: theme,
          h: kind === 'water' ? 0.12 : kind === 'mountain' ? 0.9 + h * 0.5 : 0.3 + h * 0.2,
          scenery: true
        });
      });
    });

    // Chemins : seulement entre ruches d'un même dossier (lien présent dans les données).
    var paths = [];
    var groups = {};
    placed.sorted.forEach(function (p) {
      if (!p.group) return;
      (groups[p.group] = groups[p.group] || []).push(p.id);
    });
    Object.keys(groups).forEach(function (g) {
      var ids = groups[g];
      // Arbre couvrant minimal (Prim) sur les distances entre territoires : peu de chemins, pas de croisements inutiles.
      var inTree = [ids[0]];
      var rest = ids.slice(1);
      while (rest.length) {
        var best = null;
        inTree.forEach(function (a) {
          rest.forEach(function (b) {
            var sa = placed.at[a], sb = placed.at[b];
            var d = dist(sa[0], sa[1], sb[0], sb[1]);
            if (!best || d < best.d || (d === best.d && String(a + b) < String(best.a + best.b))) best = { a: a, b: b, d: d };
          });
        });
        inTree.push(best.b);
        rest.splice(rest.indexOf(best.b), 1);
        var ca = macroCenter(placed.at[best.a][0], placed.at[best.a][1]);
        var cb = macroCenter(placed.at[best.b][0], placed.at[best.b][1]);
        var line = hexLine(ca[0], ca[1], cb[0], cb[1]);
        line.forEach(function (h) {
          var t = tiles[key(h[0], h[1])];
          if (!t || t.kind === 'hive') return;
          t.path = g;
          if (t.kind === 'water') { t.bridge = true; }
        });
        paths.push({ group: g, from: best.a, to: best.b, tiles: line.map(function (h) { return key(h[0], h[1]); }) });
      }
    });

    // Tâches : hachage de rendez-vous dans le territoire du projet.
    var pois = [];
    var taskTile = {};
    var occupancy = {};
    var byProject = {};
    tasks.slice().sort(byCreation).forEach(function (t) {
      (byProject[t.projectId] = byProject[t.projectId] || []).push(t);
    });
    var orphans = byProject[undefined] || [];
    territories.forEach(function (terr) {
      var list = byProject[terr.projectId] || [];
      terr.taskCount = list.length;
      var free = terr.tiles.filter(function (k) { return !tiles[k].path; });
      if (!free.length) free = terr.tiles.slice();
      list.forEach(function (t) {
        var remembered = memory.tasks && memory.tasks[t.id];
        var chosen = null;
        if (remembered && free.indexOf(remembered) !== -1 && !occupancy[remembered]) chosen = remembered;
        if (!chosen) {
          var ranked = free.slice().sort(function (a, b) { return hash(t.id + '@' + b) - hash(t.id + '@' + a); });
          for (var i = 0; i < ranked.length && !chosen; i++) if (!occupancy[ranked[i]]) chosen = ranked[i];
          if (!chosen) {
            // Territoire plein : regroupement sur la tuile la moins chargée (ordre de rendez-vous).
            var min = Infinity;
            ranked.forEach(function (k) { var n = occupancy[k] || 0; if (n < min) { min = n; chosen = k; } });
            if (remembered && free.indexOf(remembered) !== -1) chosen = remembered;
          }
        }
        var stack = occupancy[chosen] || 0;
        occupancy[chosen] = stack + 1;
        taskTile[t.id] = chosen;
        var tile = tiles[chosen];
        pois.push({ taskId: t.id, projectId: t.projectId, q: tile.q, r: tile.r, key: chosen, stack: stack });
      });
    });

    var memOut = { projects: {}, tasks: taskTile };
    Object.keys(placed.at).forEach(function (id) { memOut.projects[id] = key(placed.at[id][0], placed.at[id][1]); });

    return {
      tiles: tiles,
      territories: territories,
      pois: pois,
      paths: paths,
      occupancy: occupancy,
      unplacedTasks: orphans.map(function (t) { return t.id; }),
      memory: memOut
    };
  }

  function hexRound(q, r) {
    var s = -q - r;
    var rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
    var dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    return [rq, rr];
  }
  function hexLine(aq, ar, bq, br) {
    var n = dist(aq, ar, bq, br);
    var out = [];
    for (var i = 0; i <= n; i++) {
      var t = n === 0 ? 0 : i / n;
      out.push(hexRound(aq + (bq - aq) * t + 1e-6, ar + (br - ar) * t + 1e-6));
    }
    return out;
  }

  // Coordonnées monde (hexagones « pointe en haut », taille 1).
  var SQ3 = Math.sqrt(3);
  function toWorld(q, r) { return { x: SQ3 * (q + r / 2), z: 1.5 * r }; }
  function fromWorld(x, z) { var r = z / 1.5; var q = x / SQ3 - r / 2; return hexRound(q, r); }

  return {
    build: build, hash: hash, rand01: rand01, key: key, dist: dist,
    toWorld: toWorld, fromWorld: fromWorld, hexLine: hexLine, spiral: spiral,
    RADIUS: R, INNER: INNER, BIOMES: BIOMES
  };
});
