// Timelines premium (Ref #688 ; retour de Quentin du 03/10/2026) : six représentations
// de barres de Gantt dessinées en SVG. Le code de dessin est COPIÉ du prototype
// docs/maquettes/timelines-premium/prototype.html (fonctions D.*) ; seules
// adaptations : préfixe « tlp- » des identifiants SVG et dates passées en libellés
// (t.libDebut, t.libFin). Ne pas modifier ici sans reporter dans le prototype.
// Convention commune : le réalisé est plein et saturé ; le restant est pâle ET
// texturé ; les formes ne codent que les dates et l'avancement (le reste est décoratif).

const NS = "http://www.w3.org/2000/svg";
const el = (n, a = {}, parent) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (parent) parent.appendChild(e); return e; };
const graine = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
const mix = (hex, blanc) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (c) => Math.round(c + (255 - c) * blanc); return `rgb(${m(r)},${m(g)},${m(b)})`; };
let uid = 0;
// Teinte décalée (HSL) : dégradés des prismes ; d = degrés, l = points de luminosité.
const teinte = (hex, d = 0, l = 0) => { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), L = (mx + mn) / 2, D = mx - mn; let H = 0, S = 0; if (D) { S = D / (1 - Math.abs(2 * L - 1)); H = mx === r ? ((g - b) / D) % 6 : mx === g ? (b - r) / D + 2 : (r - g) / D + 4; H *= 60; } return `hsl(${((H + d) % 360 + 360) % 360} ${Math.round(S * 100)}% ${Math.max(5, Math.min(95, Math.round(L * 100 + l)))}%)`; };
// Flou gaussien (halo des trajectoires).
function flou(defs, sd) { const id = "tlp-f" + (++uid); const f = el("filter", { id, x: "-30%", y: "-300%", width: "160%", height: "700%" }, defs); el("feGaussianBlur", { stdDeviation: sd }, f); return `url(#${id})`; }
// Chemin fermé lissé (Catmull-Rom → Bézier) : contours organiques.
function lisse(pts) { const n = pts.length, P = (i) => pts[(i + n) % n]; let d = `M${P(0)[0].toFixed(1)},${P(0)[1].toFixed(1)}`; for (let i = 0; i < n; i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2); d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`; } return d + "Z"; }

// ---------- Dessin d'une tâche : (g, x0, x1, cy, h, couleur, av 0..100|null, tâche, opts) ----------
// Convention commune : le réalisé est plein et saturé ; le restant est pâle ET texturé
// (hachures, pointillés ou contour seul) : la distinction ne repose pas que sur la couleur.
function hachures(defs, couleur) { const id = "tlp-h" + (++uid); const p = el("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs); el("rect", { width: 6, height: 6, fill: mix(couleur, .86) }, p); el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: mix(couleur, .55), "stroke-width": 1.4 }, p); return `url(#${id})`; }
function clipX(defs, x0, x1) { const id = "tlp-c" + (++uid); const c = el("clipPath", { id }, defs); el("rect", { x: x0, y: -9999, width: Math.max(0, x1 - x0), height: 19998 }, c); return `url(#${id})`; }
const D = {
  briques(g, x0, x1, cy, h, c, av, t, o) {
    const hh = Math.min(h * .5, 18), y = cy - hh / 2, w = x1 - x0, n = Math.max(1, Math.round(w / Math.max(o.pxj, 14))), m = w / n, xa = x0 + w * (av ?? 0) / 100;
    for (let k = 0; k < n; k++) {
      const a = x0 + k * m, fait = a + m <= xa + .5, part = !fait && a < xa;
      const fill = fait ? c : o.hach;
      el("rect", { x: a + .6, y, width: m - 1.2, height: hh, rx: 2, fill, stroke: fait ? c : mix(c, .45), "stroke-width": 1 }, g);
      if (part) el("rect", { x: a + .6, y, width: xa - a - .6, height: hh, rx: 2, fill: c }, g);
      if (m > 9) { const sw = Math.min(8, m * .38); el("rect", { x: a + m / 2 - sw / 2, y: y - 2.6, width: sw, height: 2.6, rx: 1, fill: fait || part ? c : mix(c, .6) }, g); }
    }
    return { y0: y - 3, y1: y + hh };
  },
  conduite(g, x0, x1, cy, h, c, av, t, o) {
    const hh = Math.min(h * .34, 12), y = cy - hh / 2, xa = x0 + (x1 - x0) * (av ?? 0) / 100;
    el("rect", { x: x0, y, width: x1 - x0, height: hh, rx: hh / 2, fill: "#fff", stroke: mix(c, .35), "stroke-width": 1.2 }, g);
    el("rect", { x: x0, y: y + 1.6, width: Math.max(0, xa - x0), height: hh - 3.2, rx: (hh - 3.2) / 2, fill: c }, g);
    if (xa > x0 + 14) { const l = el("line", { x1: x0 + 6, y1: cy, x2: xa - 6, y2: cy, stroke: "rgba(255,255,255,.85)", "stroke-width": 1, "stroke-dasharray": "6 10", class: o.anim ? "anim-flux" : "" }, g); }
    el("line", { x1: Math.max(xa, x0) + 3, y1: cy, x2: x1 - 3, y2: cy, stroke: mix(c, .5), "stroke-width": 1, "stroke-dasharray": "2 3" }, g);
    for (const x of [x0, x1]) el("rect", { x: x - 2.5, y: y - 2.5, width: 5, height: hh + 5, rx: 1.4, fill: mix(c, .2), stroke: c, "stroke-width": .8 }, g);
    return { y0: y - 3, y1: y + hh + 3 };
  },
  nuages(g, x0, x1, cy, h, c, av, t, o) {
    const hh = Math.min(h * .55, 24) / 2, w = x1 - x0, xa = x0 + w * (av ?? 0) / 100, r = graine(t.id), n = Math.round(w * (o.dense ? .9 : 1.6));
    for (let k = 0; k < n; k++) {
      const x = x0 + 4 + r() * (w - 8), u = r() * 2 - 1, y = cy + u * Math.abs(u) * hh * .95, fait = x <= xa;
      el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: fait ? 1.15 : .95, fill: fait ? c : "none", stroke: fait ? "none" : mix(c, .35), "stroke-width": .6, opacity: fait ? .8 : .7 }, g);
    }
    el("line", { x1: x0, y1: cy, x2: x1, y2: cy, stroke: mix(c, .4), "stroke-width": .7 }, g);
    el("circle", { cx: x0, cy, r: 3, fill: c }, g); el("circle", { cx: x1, cy, r: 3.2, fill: "#fff", stroke: c, "stroke-width": 1.4 }, g);
    if (av != null && av > 0 && av < 100) { el("line", { x1: xa, y1: cy - hh, x2: xa, y2: cy + hh, stroke: c, "stroke-width": 1.4 }, g); el("circle", { cx: xa, cy, r: 3.6, fill: "#fff", stroke: c, "stroke-width": 1.8 }, g); }
    return { y0: cy - hh, y1: cy + hh };
  },
  niveaux(g, x0, x1, cy, h, c, av, t, o) {
    // Courbes de niveau façon carte IGN. Un relief fictif (un sommet, ou deux sur les tâches longues,
    // plus un bruit doux) est calculé dans l'île ; ses isolignes sont tracées par « marching squares ».
    // Le contour extérieur (la côte) touche exactement les deux dates. Une courbe maîtresse, plus
    // épaisse, sur cinq. Relief, sommets et nombre de courbes sont décoratifs : stables
    // (graine = identifiant), ils ne codent ni charge ni intensité.
    const w = x1 - x0, r = graine(t.id), hh = Math.min(h * .7, o.dense ? 17 : 38) / 2, p = av ?? 0, xa = x0 + w * p / 100;
    const ph = [r() * 6.3, r() * 6.3, r() * 6.3, r() * 6.3];
    const B = (x) => { const u = (x - x0) / w; return u <= 0 || u >= 1 ? 0 : hh * Math.sin(Math.PI * u) ** .7 * (1 + .12 * Math.sin(Math.PI * u) * Math.sin(u * 9 + ph[0])); };
    const sommets = [[x0 + w * (.25 + r() * .3), cy + (r() - .5) * hh * .5, w * (.16 + r() * .1), hh * .7]];
    if (w > 150) sommets.push([x0 + w * (.62 + r() * .2), cy + (r() - .5) * hh * .5, w * (.1 + r() * .08), hh * .55]);
    const f = (x, y) => {
      const b = B(x); if (b <= 0) return 0;
      const m = 1 - ((y - cy) / b) ** 2; if (m <= 0) return 0;
      let z = .18; for (const [sx, sy, ax, ay] of sommets) z += Math.exp(-(((x - sx) / ax) ** 2) - (((y - sy) / ay) ** 2)) * (sx === sommets[0][0] ? 1 : .8);
      z += .07 * Math.sin(x / 9 + ph[1]) * Math.cos(y / 5 + ph[2]) + .05 * Math.sin(x / 4.3 + y / 3.1 + ph[3]);
      return Math.max(0, z) * m ** .55;
    };
    // Grille et isolignes.
    const nx = Math.max(12, Math.min(220, Math.round(w / 1.8))), ny = o.dense ? 12 : 22, dx = w / nx, dy = 2 * hh / ny;
    const V = []; let zmax = 0;
    for (let j = 0; j <= ny; j++) { const row = []; for (let i = 0; i <= nx; i++) { const z = f(x0 + i * dx, cy - hh + j * dy); row.push(z); if (z > zmax) zmax = z; } V.push(row); }
    const N = o.dense ? 4 : Math.max(5, Math.min(11, Math.round(w / 12)));
    const isolignes = (niv) => {
      const pt = (cle) => { const [k, i, j] = cle.split(","); const a = +i, b = +j; if (k === "h") { const z1 = V[b][a], z2 = V[b][a + 1], u = (niv - z1) / (z2 - z1); return [x0 + (a + u) * dx, cy - hh + b * dy]; } const z1 = V[b][a], z2 = V[b + 1][a], u = (niv - z1) / (z2 - z1); return [x0 + a * dx, cy - hh + (b + u) * dy]; };
      const adj = new Map(), lien = (e1, e2) => { (adj.get(e1) || adj.set(e1, []).get(e1)).push(e2); (adj.get(e2) || adj.set(e2, []).get(e2)).push(e1); };
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = V[j][i] > niv, b = V[j][i + 1] > niv, cc = V[j + 1][i + 1] > niv, d = V[j + 1][i] > niv;
        const H = `h,${i},${j}`, D = `v,${i + 1},${j}`, Bs = `h,${i},${j + 1}`, G = `v,${i},${j}`;
        const bords = []; if (a !== b) bords.push(H); if (b !== cc) bords.push(D); if (cc !== d) bords.push(Bs); if (d !== a) bords.push(G);
        if (bords.length === 2) lien(bords[0], bords[1]);
        else if (bords.length === 4) { if (a) { lien(H, D); lien(Bs, G); } else { lien(H, G); lien(D, Bs); } }
      }
      const vus = new Set(), chemins = [];
      for (const depart of adj.keys()) {
        if (vus.has(depart)) continue;
        const suite = [depart]; vus.add(depart); let cur = depart;
        for (;;) { const nxt = (adj.get(cur) || []).find((e) => !vus.has(e)); if (!nxt) break; vus.add(nxt); suite.push(nxt); cur = nxt; }
        if (suite.length > 3) chemins.push(suite.map(pt));
      }
      return chemins.map((pts) => lisse(pts)).join(" ");
    };
    // La côte : contour exact de l'île (touche x0 et x1).
    const cote = []; for (let i = 0; i <= 48; i++) { const x = x0 + w * i / 48; cote.push([x, cy - B(x)]); } for (let i = 48; i >= 0; i--) { const x = x0 + w * i / 48; cote.push([x, cy + B(x)]); }
    const dCote = "M" + cote.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" L") + "Z";
    const cf = clipX(o.defs, x0, xa), cr = clipX(o.defs, xa, x1 + 2), fonce = teinte(c, 0, -12);
    const niveaux = []; for (let k = 1; k < N; k++) niveaux.push([isolignes(zmax * (k / N) ** .9), k % 5 === 0]);
    // Restant : côte pleine fine, courbes intercalaires pointillées, pâles, sans teinte.
    const gr = el("g", { "clip-path": cr }, g);
    el("path", { d: dCote, fill: mix(c, .95), stroke: mix(c, .4), "stroke-width": .9 }, gr);
    for (const [d, m] of niveaux) if (d) el("path", { d, fill: "none", stroke: mix(c, .48), "stroke-width": m ? .9 : .55, "stroke-dasharray": m ? "none" : "2.2 1.6" }, gr);
    // Réalisé : teintes hypsométriques légères, courbes pleines, maîtresses plus épaisses.
    if (p) {
      const gf = el("g", { "clip-path": cf }, g);
      el("path", { d: dCote, fill: mix(c, .87), stroke: fonce, "stroke-width": 1.15 }, gf);
      niveaux.forEach(([d, m], k) => { if (d) el("path", { d, fill: k >= niveaux.length - 2 ? mix(c, .76 - (k - niveaux.length + 2) * .08) : "none", "fill-rule": "evenodd", stroke: fonce, "stroke-width": m ? 1.1 : .6 }, gf); });
    }
    if (p > 0 && p < 100) el("line", { x1: xa, y1: cy - B(xa) - 2, x2: xa, y2: cy + B(xa) + 2, stroke: o.ink, "stroke-width": 1.5, "stroke-linecap": "round" }, g);
    el("circle", { cx: x0, cy, r: 2.6, fill: fonce }, g); el("circle", { cx: x1, cy, r: 2.8, fill: "#fff", stroke: fonce, "stroke-width": 1.3 }, g);
    return { y0: cy - hh, y1: cy + hh };
  },
  trajectoires(g, x0, x1, cy, h, c, av, t, o) {
    // Brins tressés (d'après la planche ChatGPT) : un brin principal et des brins secondaires
    // pâles, tous issus des deux dates et croisés au point d'avancement ; halo flouté.
    // Le nombre de brins et leur amplitude sont décoratifs (identiques pour toutes les tâches).
    const w = x1 - x0, r = graine(t.id), amp = Math.min(h * .26, o.dense ? 5 : 12), p = av ?? 0, xa = x0 + w * p / 100;
    const xm = p > 0 && p < 100 ? xa : x0 + w * .5;
    const forme = o.dense ? [[1, -1], [.5, -.7]] : [[1, -1], [.62, -.78], [-.38, .42], [.86, -.55]];
    const brin = ([a1, a2], k) => {
      const j = .85 + r() * .3, d1 = xm - x0, d2 = x1 - xm, dec = k ? (r() - .5) * .16 : 0;
      return `M${x0},${cy} C${x0 + d1 * (.36 + dec)},${cy - amp * a1 * j} ${x0 + d1 * (.72 + dec)},${cy - amp * a1 * j * .9} ${xm},${cy}`
        + ` C${xm + d2 * (.3 - dec)},${cy - amp * a2 * j * .9} ${xm + d2 * (.66 - dec)},${cy - amp * a2 * j} ${x1},${cy}`;
    };
    const chemins = forme.map(brin), cf = clipX(o.defs, x0, xa), cr = clipX(o.defs, xa, x1 + 2), halo = flou(o.defs, o.dense ? 1.6 : 3);
    // Halo : léger sur toute la durée, plus soutenu sur le réalisé.
    el("path", { d: chemins[0], fill: "none", stroke: mix(c, .62), "stroke-width": amp * 1.5, opacity: .3, filter: halo, "stroke-linecap": "round" }, g);
    if (p) el("path", { d: chemins[0], fill: "none", stroke: mix(c, .5), "stroke-width": amp * 1.5, opacity: .5, filter: halo, "clip-path": cf, "stroke-linecap": "round" }, g);
    chemins.slice(1).forEach((d, k) => { el("path", { d, fill: "none", stroke: c, "stroke-width": .85, opacity: .48 + k * .06, "clip-path": cr }, g); if (p) el("path", { d, fill: "none", stroke: c, "stroke-width": 1, opacity: .7, "clip-path": cf }, g); });
    // Brin principal : couleur du projet et épais sur le réalisé, encre fine sur le restant.
    el("path", { d: chemins[0], fill: "none", stroke: o.ink, "stroke-width": 1.05, opacity: .72, "clip-path": cr }, g);
    if (p) { const m = el("path", { d: chemins[0], fill: "none", stroke: c, "stroke-width": 2, "stroke-linecap": "round", "clip-path": cf, class: o.anim ? "anim-trace" : "" }, g); if (o.anim) { m.style.setProperty("--len", w * 1.3); m.setAttribute("stroke-dasharray", w * 1.3); } }
    el("circle", { cx: x0, cy, r: 3.3, fill: "#fff", stroke: o.ink, "stroke-width": 1.3 }, g); el("circle", { cx: x1, cy, r: 3.3, fill: "#fff", stroke: o.ink, "stroke-width": 1.3 }, g);
    if (p > 0 && p < 100) {
      el("line", { x1: xa, y1: cy - amp * 1.1, x2: xa, y2: cy + amp * 1.1, stroke: c, "stroke-width": .8, opacity: .45 }, g);
      el("circle", { cx: xa, cy, r: o.dense ? 6 : 10, fill: mix(c, .2), opacity: .45, filter: halo }, g);
      el("circle", { cx: xa, cy, r: o.dense ? 3.4 : 4.8, fill: c, stroke: "#fff", "stroke-width": 1.4 }, g);
    }
    // Dates sous les repères (expressif, quand la place le permet).
    if (!o.dense) {
      const date = (x, txt, ancre = "start") => { const lw = txt.length * 5.7 + 6, lx = ancre === "middle" ? x - lw / 2 : x - 3; el("rect", { x: lx, y: cy + amp + 0.5, width: lw, height: 12, rx: 3, fill: "var(--surface)", opacity: .92 }, g); const e = el("text", { x, y: cy + amp + 9, "text-anchor": ancre, "font-size": 10.5, fill: o.ink3, "font-family": "Fraunces, Georgia, serif", class: "surlib" }, g); e.textContent = txt; };
      if (w > 70) date(x0 + 2, t.libDebut);
      // Sous la bille : le pourcentage, jamais une date (avancement et calendrier sont indépendants).
      if (p > 0 && p < 100 && xa - x0 > 70 && x1 - xa > 44) date(xa, `${p} %`, "middle");
      if (!t.risque && t.av != null) { const e = el("text", { x: x1 + 8, y: cy + 4, "font-size": 10.5, fill: o.ink3, "font-family": "Fraunces, Georgia, serif", class: "surlib" }, g); e.textContent = t.libFin; }
    }
    return { y0: cy - amp, y1: cy + amp };
  },
  prismes(g, x0, x1, cy, h, c, av, t, o) {
    // Facettes translucides qui se chevauchent (d'après la planche ChatGPT), en dégradé de
    // teinte ; ventre décentré. Sommets aléatoires mais stables (graine = identifiant).
    // Facettes, ventre et opacités sont décoratifs ; seuls les bornes et le trait d'avancement codent.
    const w = x1 - x0, r = graine(t.id), hh = Math.min(h * .66, o.dense ? 16 : 34) / 2, p = av ?? 0, xa = x0 + w * p / 100;
    const xs = x0 + w * (.3 + r() * .28);
    const env = (x) => (x <= xs ? ((x - x0) / (xs - x0)) ** .85 : ((x1 - x) / (x1 - xs)) ** .7);
    const n = Math.max(3, Math.round(w / (o.dense ? 22 : 30))), haut = [], bas = [], mil = [];
    for (let k = 0; k <= n; k++) {
      const bord = k === 0 || k === n, x = bord ? (k ? x1 : x0) : x0 + w * k / n + (r() - .5) * w / n * .55, e = bord ? 0 : env(x);
      haut.push([x, cy - hh * e * (.7 + r() * .4)]); bas.push([x, cy + hh * e * (.7 + r() * .4)]);
      mil.push(bord ? [x, cy] : [x + (r() - .5) * w / n * .5, cy + (r() - .5) * hh * e * .9]);
    }
    const tri = [];
    for (let k = 0; k < n; k++) {
      tri.push([haut[k], haut[k + 1], mil[k]], [haut[k + 1], mil[k + 1], mil[k]], [bas[k], bas[k + 1], mil[k]], [bas[k + 1], mil[k + 1], mil[k]]);
      if (k + 2 <= n && r() < .9) tri.push([r() < .5 ? haut[k] : bas[k], r() < .5 ? haut[k + 2] : bas[k + 2], mil[k + 1]]); // grandes facettes qui chevauchent
    }
    for (let k = 0; k + 3 <= n; k += 2) tri.push([haut[k + 1], bas[k + 3], mil[k]], [bas[k + 1], haut[k + 3], mil[k + 2]]);
    const id = "tlp-g" + (++uid), gr = el("linearGradient", { id, gradientUnits: "userSpaceOnUse", x1: x0, y1: cy, x2: x1, y2: cy }, o.defs);
    el("stop", { offset: 0, "stop-color": teinte(c, -18, 6) }, gr); el("stop", { offset: .55, "stop-color": c }, gr); el("stop", { offset: 1, "stop-color": teinte(c, 34, 8) }, gr);
    const op = tri.map(() => .1 + r() * .24), pts = (a) => a.map((q) => q.map((v) => v.toFixed(1)).join(",")).join(" ");
    const contour = pts([...haut, ...bas.slice(1, -1).reverse()]);
    const couche = (clip, gain, trait) => { const gg = el("g", { "clip-path": clip }, g); el("polygon", { points: contour, fill: `url(#${id})`, "fill-opacity": .1 * gain }, gg); tri.forEach((q, i) => el("polygon", { points: pts(q), fill: `url(#${id})`, "fill-opacity": Math.min(.9, op[i] * gain), stroke: "#fff", "stroke-width": .5, "stroke-opacity": .55 }, gg)); el("polygon", { points: contour, fill: "none", stroke: c, "stroke-width": .7, "stroke-opacity": .45, "stroke-dasharray": trait }, gg); };
    couche(clipX(o.defs, xa, x1 + 2), .55, "2 2"); // restant : pâle, contour pointillé
    if (p) couche(clipX(o.defs, x0, xa), 1.9, "none"); // réalisé : facettes soutenues, contour plein
    const fonce = teinte(c, 0, -16);
    if (p > 0 && p < 100) { const e = env(xa) * hh + 3; el("line", { x1: xa, y1: cy - e, x2: xa, y2: cy + e, stroke: fonce, "stroke-width": 2, "stroke-linecap": "round" }, g); }
    el("circle", { cx: x0, cy, r: 2.7, fill: fonce }, g); el("circle", { cx: x1, cy, r: 2.7, fill: fonce }, g);
    return { y0: cy - hh, y1: cy + hh };
  },


};

export const STYLES_PREMIUM = ["briques", "conduite", "nuages", "niveaux", "trajectoires", "prismes"];

// Couleur CSS → #rrggbb (les calculs de teinte en ont besoin) ; repli gris ardoise.
export function hex6(couleur) {
  const c = String(couleur || "").trim();
  let m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return "#" + m[1].split("").map((x) => x + x).join("");
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  m = /^rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(c);
  if (m) return "#" + [m[1], m[2], m[3]].map((v) => Math.min(255, +v).toString(16).padStart(2, "0")).join("");
  return "#5b6b82";
}

// Dessine une barre dans `svg` (vidé au préalable) : largeur et hauteur en px,
// avancement 0..100 (null = non renseigné), joursVisibles = durée affichée (module des briques).
export function dessinerBarre(svg, style, { largeur, hauteur, couleur, avancement, id, libDebut = "", libFin = "", jours = 1, compact = true }) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  if (!D[style] || largeur <= 0 || hauteur <= 0) return;
  svg.setAttribute("viewBox", `0 0 ${largeur} ${hauteur}`);
  const defs = el("defs", {}, svg), g = el("g", { class: "forme" }, svg), c = hex6(couleur);
  const x0 = Math.min(3, largeur / 2), x1 = Math.max(x0 + 1, largeur - 3), cy = hauteur / 2;
  if (x1 - x0 < 8) { el("rect", { x: 0, y: cy - 4, width: largeur, height: 8, rx: 2, fill: c }, g); return; }
  const anim = typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const o = { defs, pxj: largeur / Math.max(1, jours), dense: compact, hach: hachures(defs, c), anim, ink: "#18263d", ink3: "#8c96a6" };
  D[style](g, x0, x1, cy, hauteur, c, avancement, { id: id || "x", libDebut, libFin, risque: false, av: avancement }, o);
}
