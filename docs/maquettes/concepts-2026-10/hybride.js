// Prototype hybride : Mosaïque condensée (accueil), Cadran (journée),
// Partition (planning, projets, corps, argent), habitudes au style Habit Pixel.
// DONNÉES DE DÉMONSTRATION uniquement, en mémoire, rien n'est enregistré.
(function () {
  "use strict";
  const K = window.K, D = K.D, e = K.esc;
  const TODAY = D.today, NOW = D.now;
  const hh = (t) => { const [a, b] = t.split(":").map(Number); return a + b / 60; };

  // ------------------------------------------------------------ habitudes
  // Même structure que nexora:habitThemes / habitLog / habitSkips.
  const THEMES = [
    { id: "th1", name: "Santé", color: "#16a34a", mode: "multi", habits: [{ id: "h1", name: "Eau 2 L" }, { id: "h2", name: "Lecture" }, { id: "h3", name: "Méditation" }, { id: "h4", name: "Pas", unit: "milliers", kind: "numeric", min: 0, max: 10 }] },
    { id: "th2", name: "Lieu", color: "#2563eb", mode: "single", habits: [{ id: "h5", name: "Bureau" }, { id: "h6", name: "Télétravail" }] },
    { id: "th3", name: "Sommeil", color: "#7c3aed", mode: "multi", habits: [{ id: "h7", name: "Couché avant 23 h" }, { id: "h8", name: "Pas d'écran au lit" }] },
  ];
  const ALL = THEMES.flatMap((t) => t.habits.map((h) => ({ ...h, theme: t })));
  const LOG = new Map(), SKIP = new Set();
  const key = (h, d) => h + "|" + d;
  function seedHabits() {
    LOG.clear(); SKIP.clear();
    for (let i = 1; i < NDAYS; i++) {
      const d = K.addDays(TODAY, -i);
      ["h1", "h2", "h3", "h7", "h8"].forEach((h, k) => { if ((i * 7 + k * 3) % 5 < 3) LOG.set(key(h, d), true); });
      LOG.set(key("h4", d), [10, 6, 12, 4, 9, 14, 8, 11, 5, 10, 13, 7][i % 12] > 10 ? 10 : [10, 6, 12, 4, 9, 14, 8, 11, 5, 10, 13, 7][i % 12]);
      const dw = new Date(d + "T12:00:00Z").getUTCDay();
      if (dw === 0 || dw === 6) { SKIP.add(key("h5", d)); SKIP.add(key("h6", d)); } else LOG.set(key(i % 3 ? "h5" : "h6", d), true);
    }
    LOG.set(key("h1", TODAY), true); LOG.set(key("h2", TODAY), true); LOG.set(key("h4", TODAY), 3); LOG.set(key("h5", TODAY), true); LOG.set(key("h7", TODAY), true);
  }
  function hstate(h, d) {
    if (LOG.has(key(h.id, d))) { if (h.kind === "numeric") { const v = LOG.get(key(h.id, d)); return { state: v >= h.max ? "done" : "part", value: v }; } return { state: "done" }; }
    if (SKIP.has(key(h.id, d))) return { state: "na" };
    return { state: "todo", value: h.kind === "numeric" ? 0 : null };
  }
  // Règle de Nexora (part-002 l. 4560) : « n/a » hors du total, partiel compté comme fait.
  function count(d, theme) {
    let done = 0, total = 0;
    (theme ? [theme] : THEMES).forEach((t) => t.habits.forEach((h) => { const s = hstate(h, d).state; if (s === "na") return; total++; if (s === "done" || s === "part") done++; }));
    return { done, total };
  }
  function habitAct(hid, d, op) {
    const h = ALL.find((x) => x.id === hid); if (!h) return;
    const k = key(hid, d);
    if (op === "na") { if (SKIP.has(k)) SKIP.delete(k); else { SKIP.add(k); LOG.delete(k); } return; }
    SKIP.delete(k);
    if (h.kind === "numeric") {
      const v = LOG.has(k) ? LOG.get(k) : 0;
      const n = op === "minus" ? v - 1 : op === "plus" ? v + 1 : (v >= h.max ? 0 : h.max);
      if (n <= 0) LOG.delete(k); else LOG.set(k, Math.min(h.max, n));
      return;
    }
    if (LOG.has(k)) { LOG.delete(k); return; }
    if (h.theme.mode === "single") h.theme.habits.forEach((x) => LOG.delete(key(x.id, d)));
    LOG.set(k, true);
  }
  // Pixel du jour : un carré n × n, une rangée par thème, une case par habitude.
  const SQ = Math.max(THEMES.length, ...THEMES.map((t) => t.habits.length));
  function pixel(d, size = 8, gap = 2, opts = {}) {
    const w = SQ * size + (SQ - 1) * gap;
    let s = `<svg class="hx-px" viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">`;
    for (let r = 0; r < SQ; r++) for (let c = 0; c < SQ; c++) {
      const t = THEMES[r], h = t && t.habits[c], x = c * (size + gap), y = r * (size + gap);
      if (!h) { s += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="none" stroke="#e6eaf0" stroke-width="1" stroke-dasharray="2 2"/>`; continue; }
      const st = hstate(h, d), hot = opts.hot === h.id ? " is-hot" : "";
      if (st.state === "done") s += `<rect class="hx-pc${hot}" data-hp="${h.id}" x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="${t.color}"/>`;
      else if (st.state === "part") { const f = st.value / h.max; s += `<rect class="hx-pc${hot}" data-hp="${h.id}" x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="${t.color}" opacity=".18"/><rect x="${x}" y="${(y + size * (1 - f)).toFixed(1)}" width="${size}" height="${(size * f).toFixed(1)}" fill="${t.color}"/>`; }
      else if (st.state === "na") s += `<rect class="hx-pc${hot}" data-hp="${h.id}" x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="url(#hx-na)" stroke="#cbd3de"/>`;
      else s += `<rect class="hx-pc${hot}" data-hp="${h.id}" x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="#fff" stroke="${t.color}" stroke-opacity=".45"/>`;
    }
    return s + "</svg>";
  }

  // ---------------------------------------------------------------- état
  let S;
  function reset() {
    K.reset(); S = K.state;
    Object.assign(S, { screen: "accueil", projectId: "p-ctex6", taskId: null, composer: false, toast: "", hot: null, draft: "Relancer BC vendredi 14h #CTEX6 @Vincent !urgent", pop: "", filter: F0(), fpop: "", fview: "tout", pz: "mois", po: 0, pgroup: "projet", show: { corps: true, argent: true }, collapsed: new Set(), jz: "trimestre", jo: 0, cmp: "ref", cper: 30, closed: new Set(), atab: "mois", amonth: "oct", aq: "", acat: "", focus: "", metrics: { tile: new Set(["recovery", "sleep", "hrv", "sport"]), page: new Set(["sleep", "recovery", "hrv", "restingHr", "sport", "steps", "weight"]) } });
    const pt = K.task("t7"); if (pt) pt.statusId = "s5"; // point hebdo de 8:30 déjà fait
    extendTasks();
    seedHabits();
  }

  // ------------------------------------------------------------- briques
  const NAV = [["accueil", "Accueil"], ["journee", "Journée"], ["planning", "Planning"], ["projets", "Projets"], ["corps", "Corps"], ["argent", "Argent"]];
  const proj = (id) => K.project(id);
  const chk = (t) => `<button type="button" class="hx-ck ${K.isDone(t) ? "is-on" : ""}" data-done="${t.id}" aria-label="${K.isDone(t) ? "Rouvrir" : "Terminer"} ${e(t.title)}">${K.isDone(t) ? "✓" : ""}</button>`;
  const due = (t) => K.isLate(t) ? `<span class="hx-due is-late">−${K.lateDays(t)} j</span>` : `<span class="hx-due">${t.end === TODAY ? (t.startTime || "auj.") : K.dateShort(t.end)}</span>`;
  const trow = (t, opt = {}) => `<li class="hx-tr ${K.isDone(t) ? "is-done" : ""} ${S.taskId === t.id ? "is-sel" : ""}">${chk(t)}<button type="button" class="hx-tt" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button>${opt.noProject ? "" : `<span class="hx-pj"><i style="background:${proj(t.projectId).color}"></i>${e(proj(t.projectId).name)}</span>`}${due(t)}</li>`;
  const tileHead = (title, nav, extra = "") => `<header class="hx-th"><h2>${title}</h2>${extra}${nav ? `<button type="button" class="hx-more" data-nav="${nav}">Ouvrir ›</button>` : ""}</header>`;

  function topbar() {
    return `<header class="hx-top"><span class="hx-logo"><i></i>Nexora</span>
      <nav class="hx-nav" aria-label="Sections">${NAV.map(([id, l]) => `<button type="button" data-nav="${id}" aria-current="${S.screen === id ? "page" : "false"}">${l}${id === "projets" && K.late().length ? `<em>${K.late().length}</em>` : ""}</button>`).join("")}</nav>
      <span class="hx-search">Rechercher, créer, aller à… <kbd>⌘K</kbd></span>
      <button type="button" class="hx-btn is-primary" data-new>+ Nouvelle tâche</button></header>`;
  }

  // ----------------------------------------------------------------- cadran
  const h2a = (h) => (h / 24) * 360 - 90;
  const P = (cx, cy, r, a) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  function arcDeg(cx, cy, r, a0, a1) {
    if (a1 < a0) a1 += 360;
    const [x0, y0] = P(cx, cy, r, a0), [x1, y1] = P(cx, cy, r, a1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  }
  function dayItems(d) {
    const it = [];
    K.tasks().filter((t) => t.startTime && t.start <= d && t.end >= d).forEach((t) => it.push({ h0: hh(t.startTime), h1: t.endTime ? hh(t.endTime) : hh(t.startTime) + .5, label: t.title, id: t.id, color: proj(t.projectId).color, kind: K.type(t.typeId).name === "Réunion" ? "Réunion" : "Tâche", done: K.isDone(t) }));
    D.sport.planned.filter((s) => s.date === d).forEach((s) => it.push({ h0: hh(s.time), h1: hh(s.time) + s.minutes / 60, label: s.title, color: "#0e7490", kind: "Sport" }));
    return it.sort((a, b) => a.h0 - b.h0);
  }
  function cadran(d, size = 440, mini = false) {
    const c = size / 2, R1 = size * .4, W1 = size * .042, R2 = size * .325, W2 = size * .03;
    let s = `<svg class="hx-dial" viewBox="0 0 ${size} ${size}" role="img" aria-label="Cadran de la journée et anneau des habitudes"><defs><pattern id="hx-na" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#f6f7f9"/><line x1="0" y1="0" x2="0" y2="4" stroke="#cbd3de" stroke-width="1.4"/></pattern></defs>`;
    s += `<circle cx="${c}" cy="${c}" r="${R1}" fill="none" stroke="#eef1f6" stroke-width="${W1}"/>`;
    s += `<path d="${arcDeg(c, c, R1, h2a(23.2), h2a(6.7))}" stroke="#d6def3" stroke-width="${W1}" fill="none"><title>Sommeil (heures à importer de Whoop)</title></path>`;
    for (let h = 0; h < 24; h++) {
      const a = h2a(h), [x0, y0] = P(c, c, R1 + W1 / 2 + 3, a), [x1, y1] = P(c, c, R1 + W1 / 2 + (h % 6 ? 6 : 10), a);
      s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#b9c4d2" stroke-width="${h % 6 ? 1 : 1.5}"/>`;
      if (!mini && h % 3 === 0) { const [tx, ty] = P(c, c, R1 + W1 / 2 + 21, a); s += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="hx-hr">${String(h).padStart(2, "0")}</text>`; }
    }
    dayItems(d).forEach((it) => { s += `<path d="${arcDeg(c, c, R1, h2a(it.h0), h2a(Math.max(it.h1, it.h0 + .3)))}" stroke="${it.color}" stroke-width="${W1}" fill="none" opacity="${it.done ? .35 : 1}" ${it.id ? `data-task="${it.id}" class="hx-arc"` : ""}><title>${e(it.label)}</title></path>`; });
    // Anneau des habitudes : un segment par habitude, regroupées par thème.
    const gapT = 5, gapH = 1.6, n = ALL.length, span = (360 - THEMES.length * gapT - (n - THEMES.length) * gapH) / n;
    let a = -90 + gapT / 2;
    THEMES.forEach((t) => {
      t.habits.forEach((h, i) => {
        const a0 = a, a1 = a + span, st = hstate(h, d), hot = S.hot === h.id ? " is-hot" : "";
        s += `<path class="hx-seg${hot}" data-hp="${h.id}" d="${arcDeg(c, c, R2, a0, a1)}" stroke="${st.state === "na" ? "url(#hx-na)" : t.color}" stroke-opacity="${st.state === "na" ? 1 : .16}" stroke-width="${W2}" fill="none"><title>${e(h.name)}</title></path>`;
        if (st.state === "done") s += `<path class="hx-seg${hot}" data-hp="${h.id}" d="${arcDeg(c, c, R2, a0, a1)}" stroke="${t.color}" stroke-width="${W2}" fill="none" pointer-events="none"/>`;
        if (st.state === "part") s += `<path d="${arcDeg(c, c, R2, a0, a0 + span * st.value / h.max)}" stroke="${t.color}" stroke-width="${W2}" fill="none" pointer-events="none"/>`;
        a = a1 + (i < t.habits.length - 1 ? gapH : gapT);
      });
    });
    if (d === TODAY) {
      const ang = h2a(hh(NOW)), [x, y] = P(c, c, R1 + W1 / 2 + 3, ang), [x2, y2] = P(c, c, R2 + W2 / 2 + 6, ang);
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#18263d" stroke-width="2.5" stroke-linecap="round"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="#18263d"/>`;
    }
    const ps = mini ? 9 : 14, pg = mini ? 2 : 3, hw = SQ * ps + (SQ - 1) * pg, ts = dayTasks(d), tn = Math.max(2, Math.ceil(Math.sqrt(ts.length || 1))), tps = (hw - (tn - 1) * pg) / tn;
    const gapC = mini ? 12 : 22, total = hw * 2 + gapC, x0 = c - total / 2, y0 = c - hw / 2 - (mini ? 6 : 12), hc = count(d), tc = tcount(d);
    s += `<g transform="translate(${x0.toFixed(1)} ${y0.toFixed(1)})">${taskSquare(d, tps, pg).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
    s += `<g transform="translate(${(x0 + hw + gapC).toFixed(1)} ${y0.toFixed(1)})">${pixel(d, ps, pg, { hot: S.hot }).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
    s += `<text x="${(x0 + hw / 2).toFixed(1)}" y="${(y0 + hw + (mini ? 13 : 20)).toFixed(1)}" text-anchor="middle" class="hx-cnum">${tc.done}<tspan class="hx-cden">/${tc.total}</tspan></text><text x="${(x0 + hw + gapC + hw / 2).toFixed(1)}" y="${(y0 + hw + (mini ? 13 : 20)).toFixed(1)}" text-anchor="middle" class="hx-cnum">${hc.done}<tspan class="hx-cden">/${hc.total}</tspan></text>`;
    if (!mini) s += `<text x="${(x0 + hw / 2).toFixed(1)}" y="${(y0 - 8).toFixed(1)}" text-anchor="middle" class="hx-csub">tâches</text><text x="${(x0 + hw + gapC + hw / 2).toFixed(1)}" y="${(y0 - 8).toFixed(1)}" text-anchor="middle" class="hx-csub">habitudes</text>`;
    return s + "</svg>";
  }

  // ------------------------------------------------------- pixels de tâches
  // Pixel Tasks (#524/#542) : 1 tâche = 1 pixel, couleur = statut, cadre rouge = retard,
  // barre = avancement, coche = terminée.
  const TST = { s1: { fill: "#ffffff", stroke: "#c3cdd9", wire: "#9aa6b6", label: "À planifier" }, s3: { fill: "#dfeafd", stroke: "#7aa7f0", wire: "#5b8def", label: "En cours" }, s2: { fill: "#fdf0cf", stroke: "#f0b44c", wire: "#e59f1f", label: "Attente" }, s5: { fill: "#16a34a", stroke: "#16a34a", wire: "#16a34a", label: "Terminé" }, s6: { fill: "#f1f5f9", stroke: "#cbd5e1", wire: "#94a3b8", label: "Information" } };
  const tst = (t) => TST[t.statusId] || TST.s1;
  function dayTasks(d) {
    const base = d === TODAY ? [...K.todayTasks(), ...K.late(), ...K.tasks().filter((t) => K.isDone(t) && t.end === d)] : K.tasks().filter((t) => t.end === d && t.statusId !== "s6");
    return base.filter((t, i, a) => a.indexOf(t) === i);
  }
  function taskCell(t, x, y, s) {
    const st = tst(t), late = K.isLate(t), done = K.isDone(t);
    let g = `<g class="hx-tc" data-task="${t.id}"><title>${e(t.title)} · ${st.label}${late ? " · en retard" : ""}</title><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s / 4}" fill="${st.fill}" stroke="${late ? "#dc2626" : st.stroke}" stroke-width="${late ? 2 : 1.3}"/>`;
    if (done) g += `<path d="M${x + s * .28} ${y + s * .52} l${s * .15} ${s * .15} l${s * .3} -${s * .32}" fill="none" stroke="#fff" stroke-width="${Math.max(1.4, s / 10)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if (t.progress) g += `<rect x="${x + 3}" y="${y + s - 5}" width="${(s - 6) * t.progress / 100}" height="2.5" rx="1" fill="#245edb"/>`;
    return g + "</g>";
  }
  function taskSquare(d, size = 8, gap = 2) {
    const ts = dayTasks(d), n = Math.max(2, Math.ceil(Math.sqrt(ts.length || 1))), w = n * size + (n - 1) * gap;
    let s = `<svg class="hx-px" viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">`;
    for (let i = 0; i < n * n; i++) { const x = (i % n) * (size + gap), y = Math.floor(i / n) * (size + gap), t = ts[i]; s += t ? `<rect x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="${tst(t).fill}" stroke="${K.isLate(t) ? "#dc2626" : tst(t).stroke}"/>` : `<rect x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="none" stroke="#e6eaf0" stroke-dasharray="2 2"/>`; }
    return s + "</svg>";
  }
  const tcount = (d) => { const ts = dayTasks(d); return { done: ts.filter(K.isDone).length, total: ts.length }; };

  // Groupe relié : une ligne par élément, un pixel par élément, liaisons en équerre
  // (même dessin que habitPixelWirePath, part-002 l. 4590).
  const RH = 28, HH = 34, CS = 22, CG = 6;
  function wired(head, rows, cells, tint) {
    const n = cells.length, W = 26 + n * CS + (n - 1) * CG + 8, H = HH + rows.length * RH;
    let svg = `<svg class="hx-wsvg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="18" y="2" width="${W - 20}" height="${CS + 10}" rx="8" fill="${tint}" fill-opacity=".07" stroke="${tint}" stroke-opacity=".28"/>`;
    cells.forEach((c, i) => {
      const x = 24 + i * (CS + CG), y = 7, cx = x + CS / 2, ry = HH + i * RH + RH / 2, r = 5;
      svg += `<path class="hx-wire" data-hp="${c.hp || ""}" d="M3 ${ry} H${cx - r} Q${cx} ${ry} ${cx} ${ry - r} V${y + CS + 1}" fill="none" stroke="${c.wire}" stroke-width="1.4"/><circle cx="3" cy="${ry}" r="2.5" fill="${c.wire}"/>` + c.draw(x, y, CS);
    });
    return `<div class="hx-wg"><div class="hx-wgl"><div class="hx-wgh">${head}</div>${rows.join("")}</div>${svg}</svg></div>`;
  }
  function taskPanel(d) {
    const ts = dayTasks(d), c = tcount(d);
    const groups = D.projects.map((p) => ({ p, ts: ts.filter((t) => t.projectId === p.id).sort((a, b) => (a.startTime || "99").localeCompare(b.startTime || "99")) })).filter((g) => g.ts.length);
    const chip = (t) => K.isDone(t) ? `<span class="hx-chip is-ok">fait</span>` : K.isLate(t) ? `<span class="hx-chip is-late">retard ${K.lateDays(t)} j</span>` : t.startTime ? `<span class="hx-chip is-time">${t.startTime}</span>` : t.end === d ? `<span class="hx-chip is-due">échéance</span>` : `<span class="hx-chip">éch. ${K.dateShort(t.end)}</span>`;
    return `<section class="hx-pxpanel" aria-label="Tâches du jour, une tâche par pixel">
      <header class="hx-th"><h2>Tâches du jour</h2><span class="hx-badge">${c.done} / ${c.total}</span><span class="hx-dnav"><button type="button" aria-label="Jour précédent" disabled>‹</button>Aujourd'hui<button type="button" aria-label="Jour suivant" disabled>›</button></span></header>
      <div class="hx-pdj">${taskSquare(d, 9, 2)}<div><b>Le pixel du jour</b><small>1 tâche = 1 pixel · ✓ = terminée</small></div><strong>${c.done}<span> / ${c.total}</span></strong></div>
      <p class="hx-plegend">${["s1", "s3", "s2", "s5"].map((k) => `<span><i style="background:${TST[k].fill};border-color:${TST[k].stroke}"></i>${TST[k].label}</span>`).join("")}<span><i style="border:2px solid #dc2626"></i>En retard</span><span><i class="is-bar"></i>avancement</span></p>
      ${groups.map(({ p, ts }) => wired(`<i style="background:${p.color}"></i><b>${e(p.name)}</b><span>${ts.filter(K.isDone).length} / ${ts.length}</span>`, ts.map((t) => `<div class="hx-wr ${K.isDone(t) ? "is-done" : ""} ${S.taskId === t.id ? "is-sel" : ""}"><button type="button" class="hx-wt2" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button>${chip(t)}${chk(t)}</div>`), ts.map((t) => ({ wire: tst(t).wire, draw: (x, y, s) => taskCell(t, x, y, s) })), p.color)).join("")}
      <div class="hx-week">${Array.from({ length: 7 }, (_, i) => K.addDays(d, i - 3)).map((x) => { const k = tcount(x); return `<span class="${x === d ? "is-today" : ""}">${taskSquare(x, 6, 1.5)}<b>${K.dayShort(x).slice(0, 3)} ${Number(x.slice(8))}</b><small>${k.done} / ${k.total}</small></span>`; }).join("")}</div>
      <p class="hx-hint">Glisser une tâche d'un pixel à l'autre la replanifie · clic sur un pixel = ouvrir la fiche · la coche termine la tâche.</p></section>`;
  }

  // ----------------------------------------------------------- habitudes UI
  function habitCell(h0, d, x, y, s) {
    const h = ALL.find((x) => x.id === h0.id) || h0, st = hstate(h, d), c = h.theme.color, hot = S.hot === h.id ? " is-hot" : "";
    let g = `<g class="hx-pc${hot}" data-hp="${h.id}" data-hab="${h.id}|${d}|toggle"><title>${e(h.name)}</title>`;
    if (st.state === "done") g += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s / 4}" fill="${c}"/><path d="M${x + s * .28} ${y + s * .52} l${s * .15} ${s * .15} l${s * .3} -${s * .32}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if (st.state === "part") g += `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s / 4}" fill="${c}" fill-opacity=".15" stroke="${c}"/><rect x="${x + 3}" y="${y + s - 5}" width="${(s - 6) * st.value / h.max}" height="2.5" rx="1" fill="${c}"/><text x="${x + s / 2}" y="${y + s / 2 + 2}" text-anchor="middle" class="hx-pctxt">${st.value}/${h.max}</text>`;
    else if (st.state === "na") g += `<rect x="${x + .5}" y="${y + .5}" width="${s - 1}" height="${s - 1}" rx="${s / 4}" fill="url(#hx-na)" stroke="#cbd3de"/>`;
    else g += `<rect x="${x + .5}" y="${y + .5}" width="${s - 1}" height="${s - 1}" rx="${s / 4}" fill="#fff" stroke="${c}" stroke-opacity=".5"/>`;
    return g + "</g>";
  }
  function habitPanel(d) {
    const cnt = count(d);
    return `<section class="hx-pxpanel" aria-label="Habitudes du jour, une habitude par pixel">
      <header class="hx-th"><h2>Habitudes</h2><span class="hx-badge">${cnt.done} / ${cnt.total}</span><span class="hx-dnav"><button type="button" aria-label="Jour précédent" disabled>‹</button>Aujourd'hui<button type="button" aria-label="Jour suivant" disabled>›</button></span></header>
      <div class="hx-pdj">${pixel(d, 9, 2)}<div><b>Le pixel du jour</b><small>1 habitude = 1 pixel · non applicables exclues</small></div><strong>${cnt.done}<span> / ${cnt.total}</span></strong></div>
      ${THEMES.map((t) => { const c = count(d, t); return wired(`<i style="background:${t.color}"></i><b>${e(t.name)}</b><span>${c.done} / ${c.total}</span><small>${t.mode === "single" ? "un seul choix" : ""}</small>`, t.habits.map((h) => { const st = hstate(h, d); return `<div class="hx-wr hx-hrow is-${st.state} ${S.hot === h.id ? "is-hot" : ""}" data-hp="${h.id}" style="--t:${t.color}"><span class="hx-hname">${e(h.name)}${h.unit ? ` <small>${h.unit}</small>` : ""}</span>${h.kind === "numeric" ? `<span class="hx-step"><button type="button" data-hab="${h.id}|${d}|minus" aria-label="Moins">−</button><b>${st.value || 0}/${h.max}</b><button type="button" data-hab="${h.id}|${d}|plus" aria-label="Plus">+</button></span>` : `<button type="button" class="hx-box ${st.state === "done" ? "is-on" : ""}" data-hab="${h.id}|${d}|toggle" aria-pressed="${st.state === "done"}" aria-label="${e(h.name)}">${st.state === "done" ? "✓" : ""}</button>`}<button type="button" class="hx-na ${st.state === "na" ? "is-on" : ""}" data-hab="${h.id}|${d}|na" aria-pressed="${st.state === "na"}" title="Non applicable aujourd'hui">n/a</button></div>`; }), t.habits.map((h) => ({ wire: t.color, hp: h.id, draw: (x, y, s) => habitCell(h, d, x, y, s) })), t.color); }).join("")}
      <div class="hx-week">${Array.from({ length: 7 }, (_, i) => K.addDays(d, i - 6)).map((x) => { const c = count(x); return `<span class="${x === d ? "is-today" : ""}">${pixel(x, 6, 1.5)}<b>${K.dayShort(x).slice(0, 3)} ${Number(x.slice(8))}</b><small>${c.done} / ${c.total}</small></span>`; }).join("")}</div>
    </section>`;
  }

  // ------------------------------------------- données affichées (au choix)
  // Les 18 mesures de HEALTH_METRICS (part-003 l. 40581) + le sport ; chaque
  // tuile et la page Corps n'affichent que celles cochées.
  const METRICS = [
    ["sleep", "Sommeil réel", "Sommeil"], ["sleepPerf", "Performance sommeil", "Sommeil"], ["sleepEff", "Efficacité sommeil", "Sommeil"], ["deepSleep", "Sommeil profond", "Sommeil"], ["remSleep", "Sommeil REM", "Sommeil"],
    ["recovery", "Récupération", "Récupération"], ["hrv", "HRV", "Récupération"], ["restingHr", "FC repos", "Récupération"], ["respRate", "Fréq. respiratoire", "Récupération"], ["spo2", "SpO₂", "Récupération"], ["skinTemp", "Température cutanée", "Récupération"],
    ["weight", "Poids", "Corps"], ["bodyFat", "Masse grasse", "Corps"], ["muscleMass", "Masse musculaire", "Corps"], ["muscleRate", "Masse musculaire (%)", "Corps"],
    ["strain", "Day Strain", "Activité"], ["calories", "Calories dépensées", "Activité"], ["steps", "Pas", "Activité"], ["sport", "Sport (séances, objectif)", "Activité"],
  ];
  const DEMO_METRICS = new Set(["sleep", "recovery", "hrv", "restingHr", "weight", "steps", "sport"]);
  function chooser(scope) {
    const sel = S.metrics[scope];
    return `<div class="hx-pop" role="dialog" aria-label="Choisir les données affichées"><header><b>Données affichées</b><button type="button" class="hx-x" data-pop="" aria-label="Fermer">×</button></header>
      ${["Sommeil", "Récupération", "Corps", "Activité"].map((g) => `<h4>${g}</h4>${METRICS.filter((m) => m[2] === g).map(([k, l]) => `<label class="${DEMO_METRICS.has(k) ? "" : "is-off"}"><input type="checkbox" data-metric="${scope}|${k}" ${sel.has(k) ? "checked" : ""} ${DEMO_METRICS.has(k) ? "" : "disabled"}> ${l}${DEMO_METRICS.has(k) ? "" : " <small>pas de donnée de démo</small>"}</label>`).join("")}`).join("")}
      <p class="hx-hint">Le choix est mémorisé pour cette tuile (préférence synchronisée, comme nexora:futurPrefs).</p></div>`;
  }
  const chooserBtn = (scope) => `<button type="button" class="hx-more is-plain" data-pop="${scope}" aria-expanded="${S.pop === scope}">Données ▾</button>${S.pop === scope ? chooser(scope) : ""}`;

  // ------------------------------------------------- données de démo étendues
  // Tâches longues et lointaines (zooms Année, Pluriannuel) et référence de
  // planning (comparison : référence courante + plan initial, comme Nexora).
  const J = K.J;
  const EXTRA_TASKS = [
    { id: "x1", title: "Études d'exécution", projectId: "p-ctex6", statusId: "s5", typeId: "tt2", start: J(-120), end: J(-75), assignee: "Vincent Bernard", progress: 100 },
    { id: "x2", title: "Travaux de gros œuvre", projectId: "p-ctex6", statusId: "s1", typeId: "tt2", start: J(12), end: J(70), assignee: "Maïa Sonnier" },
    { id: "x3", title: "Réception CTEX6", projectId: "p-ctex6", statusId: "s1", typeId: "tt2", start: J(150), end: J(150), milestone: true, assignee: "Quentin Morel" },
    { id: "x4", title: "Levée des réserves", projectId: "p-ctex6", statusId: "s1", typeId: "tt1", start: J(152), end: J(205), assignee: "Vincent Bernard" },
    { id: "x5", title: "Garantie de parfait achèvement", projectId: "p-ctex6", statusId: "s6", typeId: "tt4", start: J(150), end: J(515) },
    { id: "x6", title: "Préparation de chantier", projectId: "p-lot2b", statusId: "s5", typeId: "tt2", start: J(-95), end: J(-50), assignee: "Quentin Morel", progress: 100 },
    { id: "x7", title: "Terrassements", projectId: "p-lot2b", statusId: "s1", typeId: "tt2", start: J(10), end: J(45), assignee: "Maïa Sonnier" },
    { id: "x8", title: "Lancement Lot 3", projectId: "p-lot2b", statusId: "s1", typeId: "tt2", start: J(90), end: J(90), milestone: true, assignee: "Quentin Morel" },
    { id: "x9", title: "Rapport annuel 2026", projectId: "p-com", statusId: "s1", typeId: "tt1", start: J(55), end: J(85), assignee: "Anne-Laure Masson" },
    { id: "x10", title: "Salon Pollutec", projectId: "p-com", statusId: "s1", typeId: "tt3", start: J(58), end: J(61), assignee: "Quentin Morel" },
    { id: "x11", title: "Mise en service CTEX6", projectId: "p-ctex6", statusId: "s1", typeId: "tt2", start: J(260), end: J(260), milestone: true, assignee: "Quentin Morel" },
  ];
  // Écart en jours de la fin réelle par rapport à la référence et au plan initial.
  const DRIFT = { t1: [6, 14], t2: [6, 10], t3: [5, 5], t15: [0, 4], t4: [5, 8], t5: [0, 0], t10: [2, 2], t9: [0, 0], x1: [0, 3], x2: [10, 18], x3: [14, 21], x4: [14, 21], x6: [-2, 0], x7: [4, 4], x8: [0, 7], x9: [0, 0], x11: [14, 30] };
  function extendTasks() {
    EXTRA_TASKS.forEach((t) => K.state.tasks.push(JSON.parse(JSON.stringify(t))));
    K.state.tasks.forEach((t) => { const d = DRIFT[t.id]; if (!d) return; t.ref = { start: K.addDays(t.start, -d[0]), end: K.addDays(t.end, -d[0]) }; t.initial = { start: K.addDays(t.start, -d[1]), end: K.addDays(t.end, -d[1]) }; });
  }

  // ------------------------------------------------------------- filtres
  // Barre de filtres commune (planning, projets, opérations) : recherche,
  // listes à cocher, bascules, vues enregistrées, résumé en clair.
  const F0 = () => ({ q: "", projects: new Set(), statuses: new Set(), people: new Set(), types: new Set(), crit: new Set(), late: false, ms: false, done: false });
  const FOPTS = {
    projects: ["Projets", () => D.projects.map((p) => [p.id, p.name, p.color])],
    statuses: ["Statuts", () => D.statuses.map((s) => [s.id, s.name, s.color])],
    people: ["Responsables", () => D.members.map((m) => [m, m, ""])],
    types: ["Types", () => D.types.map((t) => [t.id, t.name, ""])],
    crit: ["Criticité", () => [["urgent", "Urgent", "#dc2626"], ["moyen", "Moyen", "#d97706"], ["bas", "Bas", "#16a34a"]]],
  };
  const VIEWS = [
    ["tout", "Tout", () => F0()],
    ["moi", "Mes tâches", () => ({ ...F0(), people: new Set(["Quentin Morel"]) })],
    ["chantiers", "Chantiers en retard", () => ({ ...F0(), projects: new Set(["p-ctex6", "p-lot2b"]), late: true })],
    ["jalons", "Jalons", () => ({ ...F0(), ms: true })],
  ];
  function applyF(ts, f) {
    const q = f.q.trim().toLowerCase();
    return ts.filter((t) => (!q || t.title.toLowerCase().includes(q)) && (!f.projects.size || f.projects.has(t.projectId)) && (!f.statuses.size || f.statuses.has(t.statusId)) && (!f.people.size || f.people.has(t.assignee)) && (!f.types.size || f.types.has(t.typeId)) && (!f.crit.size || f.crit.has(t.crit)) && (!f.late || K.isLate(t)) && (!f.ms || t.milestone) && (f.done || !K.isDone(t)));
  }
  function filterSummary(f, n) {
    const parts = [];
    Object.keys(FOPTS).forEach((k) => { if (f[k].size) { const o = FOPTS[k][1](); parts.push(`${FOPTS[k][0].toLowerCase()} : ${[...f[k]].map((id) => (o.find((x) => x[0] === id) || [id, id])[1]).join(", ")}`); } });
    if (f.late) parts.push("en retard seulement"); if (f.ms) parts.push("jalons seulement"); if (f.q) parts.push(`« ${f.q} »`);
    return `<b>${n} tâche${n > 1 ? "s" : ""}</b> · ${parts.length ? parts.join(" · ") : "aucun filtre"} · terminées ${f.done ? "affichées" : "masquées"}`;
  }
  function filterBar(scope, n, opts = {}) {
    const f = S.filter, active = S.view && S.view.startsWith(scope) ? S.view : "";
    const chips = Object.keys(FOPTS).filter((k) => !(opts.hide || []).includes(k)).map((k) => {
      const [label, list] = FOPTS[k], sel = f[k];
      return `<span class="hx-fchip-w"><button type="button" class="hx-fchip ${sel.size ? "is-on" : ""}" data-fpop="${k}" aria-expanded="${S.fpop === k}">${label}${sel.size ? ` <b>${sel.size}</b>` : ""} ▾</button>${S.fpop === k ? `<div class="hx-pop is-f" role="dialog" aria-label="${label}">${list().map(([id, l, c]) => `<label><input type="checkbox" data-fset="${k}|${id}" ${sel.has(id) ? "checked" : ""}>${c ? `<i style="background:${c}"></i>` : ""}${e(l)}</label>`).join("")}<footer><button type="button" class="hx-more" data-fclear="${k}">Tout décocher</button></footer></div>` : ""}</span>`;
    }).join("");
    return `<div class="hx-fbar"><label class="hx-fsearch"><span aria-hidden="true">⌕</span><input id="hx-fq" data-fq value="${e(f.q)}" placeholder="Filtrer par mot" aria-label="Filtrer par mot" autocomplete="off"></label>${chips}
      <button type="button" class="hx-fchip ${f.late ? "is-on" : ""}" data-ftoggle="late">En retard</button><button type="button" class="hx-fchip ${f.ms ? "is-on" : ""}" data-ftoggle="ms">Jalons</button><button type="button" class="hx-fchip ${f.done ? "is-on" : ""}" data-ftoggle="done">Terminées</button>
      <span class="hx-fviews"><span>Vues :</span>${VIEWS.map(([id, l]) => `<button type="button" data-fview="${id}" class="${S.fview === id ? "is-on" : ""}">${l}</button>`).join("")}<button type="button" class="hx-more">+ Enregistrer</button></span>
      <p class="hx-fsum">${filterSummary(f, n)}${JSON.stringify([...Object.keys(FOPTS).map((k) => f[k].size), f.q, f.late, f.ms]) !== JSON.stringify([0, 0, 0, 0, 0, "", false, false]) ? ` <button type="button" class="hx-more" data-fview="tout">Réinitialiser</button>` : ""}</p></div>`;
  }

  // -------------------------------------------------------- moteur de frise
  const ZOOMS = [["semaine", "Semaine", 9, 2], ["mois", "Mois", 35, 7], ["trimestre", "Trimestre", 98, 14], ["annee", "Année", 365, 60], ["pluri", "Pluriannuel", 1096, 270]];
  const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const isoWeek = (iso) => { const d = new Date(iso + "T12:00:00Z"); const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const n = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - n); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 86400000 + 1) / 7); };
  function trange(zoom, offset) {
    const z = ZOOMS.find((x) => x[0] === zoom) || ZOOMS[0];
    const start = K.addDays(TODAY, -z[3] + offset * Math.round(z[2] * 0.75));
    return { zoom: z[0], start, end: K.addDays(start, z[2] - 1), span: z[2] };
  }
  const tx = (r, iso) => (K.days(r.start, iso) / r.span) * 100;
  // Libellés visibles : au plus « max » ; les autres graduations restent en traits.
  const sparse = (list, max) => { const step = Math.max(1, Math.ceil(list.length / max)); return list.filter((_, i) => i % step === 0); };
  function ticks(r) {
    const out = [];
    for (let i = 0; i < r.span; i++) {
      const d = K.addDays(r.start, i), dt = new Date(d + "T12:00:00Z"), day = dt.getUTCDate(), m = dt.getUTCMonth(), y = dt.getUTCFullYear(), w = dt.getUTCDay();
      if (r.zoom === "semaine") out.push({ iso: d, label: `${K.dayShort(d)} <b>${day}</b>`, major: w === 1 });
      else if (r.zoom === "mois" || r.zoom === "trimestre") { if (w === 1) out.push({ iso: d, label: `S${isoWeek(d)} <small>${day} ${MOIS_C[m]}</small>`, major: day <= 7 }); }
      else if (r.zoom === "annee") { if (day === 1) out.push({ iso: d, label: `${MOIS_C[m]}${m === 0 ? ` <b>${y}</b>` : ""}`, major: m === 0 }); }
      else if (day === 1 && m % 3 === 0) out.push({ iso: d, label: `T${m / 3 + 1} <b>${y}</b>`, major: m === 0 });
    }
    return out;
  }
  function rangeLabel(r) { const a = new Date(r.start + "T12:00:00Z"), b = new Date(r.end + "T12:00:00Z"); return `${a.getUTCDate()} ${MOIS_C[a.getUTCMonth()]} ${a.getUTCFullYear() !== b.getUTCFullYear() ? a.getUTCFullYear() : ""} → ${b.getUTCDate()} ${MOIS_C[b.getUTCMonth()]} ${b.getUTCFullYear()}`; }
  function zoomBar(r, scope, allowed) {
    return `<div class="hx-zoom"><div class="hx-seg">${scope === "planning" ? `<button type="button" data-nav="journee">Jour</button>` : ""}${ZOOMS.filter((z) => !allowed || allowed.includes(z[0])).map(([id, l]) => `<button type="button" data-zoom="${scope}|${id}" aria-pressed="${r.zoom === id}">${l}</button>`).join("")}</div>
      <div class="hx-nav2"><button type="button" data-shift="${scope}|-1" aria-label="Période précédente">‹</button><button type="button" data-shift="${scope}|0">Aujourd'hui</button><button type="button" data-shift="${scope}|1" aria-label="Période suivante">›</button></div><span class="hx-range">${rangeLabel(r)}</span></div>`;
  }
  // Rangement en lignes sans chevauchement (titre compris).
  function pack(ts, r, trackW = 1050) {
    const items = ts.map((t) => { const a = tx(r, t.milestone ? t.end : t.start), b = t.milestone ? a : tx(r, K.addDays(t.end, 1)); return { t, a, b }; }).filter((x) => x.b >= 0 && x.a <= 100).sort((x, y) => x.a - y.a);
    const rows = [];
    items.forEach((it) => { const lab = ((it.t.title.length * 6.4 + 26) / trackW) * 100; const end = Math.max(it.b, Math.max(0, it.a) + lab); let row = rows.findIndex((v) => v <= Math.max(0, it.a) - 0.4); if (row < 0) { row = rows.length; rows.push(0); } rows[row] = end; it.row = row; });
    return { items, rows: Math.max(1, rows.length) };
  }
  const ROWH = 26;
  function lineItem(it, r) {
    const t = it.t, p = proj(t.projectId), late = K.isLate(t), done = K.isDone(t), a = Math.max(0, it.a), b = Math.min(100, it.b);
    const cls = `${done ? "is-done" : ""} ${late ? "is-late" : ""} is-${t.statusId} ${it.a < 0 ? "cut-l" : ""} ${it.b > 100 ? "cut-r" : ""} ${S.taskId === t.id ? "is-sel" : ""}`;
    if (t.milestone) return `<button type="button" class="hx-ms ${cls}" data-task="${t.id}" style="left:${a}%;top:${it.row * ROWH}px;--c:${p.color}" title="${e(t.title)} · ${K.dateShort(t.end)}"><i></i><span>${e(t.title)} <small>${K.dateShort(t.end)}</small></span></button>`;
    let h = `<button type="button" class="hx-li ${cls}" data-task="${t.id}" style="left:${a}%;width:${Math.max(.35, b - a)}%;top:${it.row * ROWH}px;--c:${p.color}" title="${e(t.title)} · ${K.dateShort(t.start)} → ${K.dateShort(t.end)}"><span>${done ? "✓ " : ""}${e(t.title)}</span><i></i></button>`;
    if (late) { const o0 = Math.max(0, tx(r, K.addDays(t.end, 1))), o1 = Math.min(100, tx(r, TODAY)); if (o1 > o0) h += `<span class="hx-over" style="left:${o0}%;width:${o1 - o0}%;top:${it.row * ROWH}px" title="${K.lateDays(t)} jours de retard"></span>`; }
    return h;
  }
  function gridLines(r) { return ticks(r).map((k) => `<i class="hx-gl ${k.major ? "is-major" : ""}" style="left:${tx(r, k.iso)}%"></i>`).join("") + (TODAY >= r.start && TODAY <= r.end ? `<i class="hx-today" style="left:${tx(r, TODAY) + (r.zoom === "semaine" ? 50 / r.span : 0)}%"></i>` : ""); }
  function groupLanes(ts, by) {
    if (by === "dossier") return D.folders.map((f) => ({ id: f.id, label: f.name, color: "#64748b", sub: "", tasks: ts.filter((t) => proj(t.projectId).folderId === f.id) }));
    if (by === "responsable") return [...D.members, ""].map((m) => ({ id: "m-" + m, label: m || "Sans responsable", color: "#64748b", tasks: ts.filter((t) => (t.assignee || "") === m) }));
    if (by === "statut") return D.statuses.map((s) => ({ id: s.id, label: s.name, color: s.color, tasks: ts.filter((t) => t.statusId === s.id) }));
    return D.projects.map((p) => ({ id: p.id, label: p.name, color: p.color, project: p.id, tasks: ts.filter((t) => t.projectId === p.id) }));
  }

  // ------------------------------------------- séries de démo sur 120 jours
  // Santé (mêmes mesures que HEALTH_METRICS), séances de sport et dépenses
  // quotidiennes. Les 14 derniers jours reprennent les valeurs de kit.js.
  const NDAYS = 120;
  const SERIES = { dates: [], sleep: [], recovery: [], hrv: [], restingHr: [], weight: [], steps: [], spend: [] };
  const SESSIONS = [];
  const SPORT_COL = { Course: "#0e7490", Vélo: "#7c5cd6", Natation: "#0284c7", Renforcement: "#d97706" };
  (function genSeries() {
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < NDAYS; i++) {
      const d = K.addDays(TODAY, i - NDAYS + 1), dw = new Date(d + "T12:00:00Z").getUTCDay(), we = dw === 0 || dw === 6;
      const sl = Math.min(8.9, Math.max(5.3, 7.05 + .55 * Math.sin(i / 5) + (rnd() - .5) * 1.3 + (we ? .4 : 0)));
      const rc = Math.round(Math.min(95, Math.max(20, 28 + (sl - 6) * 20 + (rnd() - .5) * 24)));
      SERIES.dates.push(d); SERIES.sleep.push(Math.round(sl * 10) / 10); SERIES.recovery.push(rc);
      SERIES.hrv.push(Math.round(38 + rc * .22 + (rnd() - .5) * 6 + i * .04)); SERIES.restingHr.push(Math.round(58.5 - rc * .08 + (rnd() - .5) * 3));
      SERIES.weight.push(Math.round((81.1 - i * .022 + (rnd() - .5) * .45) * 10) / 10); SERIES.steps.push(Math.round(4800 + rnd() * 8800 + (we ? 2200 : 0)));
      SERIES.spend.push(d > TODAY ? 0 : Math.round((rnd() < .78 ? 8 + rnd() * 55 : 0) + (rnd() < .07 ? 60 + rnd() * 90 : 0)));
      const kinds = ["Course", "Renforcement", "Vélo", "Natation"];
      if (i < NDAYS - 14 && (dw === 2 || dw === 4 || dw === 0) && rnd() < .85) { const k = dw === 0 ? (rnd() < .6 ? "Vélo" : "Course") : kinds[Math.floor(rnd() * 4)]; SESSIONS.push({ date: d, sport: k, title: k === "Vélo" ? "Sortie" : k === "Course" ? "Footing" : k === "Natation" ? "Piscine" : "Gainage", minutes: k === "Vélo" ? 60 + Math.round(rnd() * 60) : 30 + Math.round(rnd() * 25), km: k === "Course" ? Math.round((6 + rnd() * 5) * 10) / 10 : k === "Vélo" ? Math.round(25 + rnd() * 30) : 0 }); }
    }
    const H = D.health, off = NDAYS - 14;
    ["sleep", "recovery", "hrv", "restingHr", "weight", "steps"].forEach((k) => H[k].forEach((v, j) => (SERIES[k][off + j] = v)));
    D.sport.sessions.forEach((x) => SESSIONS.push({ ...x }));
    D.budget.transactions.forEach((x) => { const j = SERIES.dates.indexOf(x.date); if (j >= 0 && x.amount < 0) SERIES.spend[j] = Math.round(-x.amount); });
    SESSIONS.sort((a, b) => a.date.localeCompare(b.date));
  })();
  const zoneColor = (v) => (v >= 67 ? "#16a34a" : v >= 34 ? "#e0a21b" : "#dc2626");

  // ---------------------------------------------------------------- accueil
  function kpi(k) {
    const H = D.health, sw = K.sportWeek();
    const m = { sleep: ["Sommeil", String(K.last(H.sleep)).replace(".", ",") + " h", H.sleep, "#5b7bd8"], recovery: ["Récupération", K.last(H.recovery) + " %", H.recovery, "#16a34a"], hrv: ["HRV", K.last(H.hrv) + " ms", H.hrv, "#0f9d76"], restingHr: ["FC repos", K.last(H.restingHr) + " bpm", H.restingHr, "#d64545"], weight: ["Poids", String(K.last(H.weight)).replace(".", ",") + " kg", H.weight, "#475569"], steps: ["Pas", (K.last(H.steps) / 1000).toFixed(1).replace(".", ",") + " k", H.steps, "#7c5cd6"] }[k];
    if (k === "sport") return `<div><small>Sport</small><b>${K.hm(sw.done)}<span>/${D.sport.goalHours} h</span></b><span class="hx-bar"><i style="width:${Math.min(100, sw.done / sw.goal * 100)}%;background:#0e7490"></i></span></div>`;
    return m ? `<div><small>${m[0]}</small><b>${m[1]}</b>${K.spark(m[2].slice(-7), { w: 56, h: 14, color: m[3], fill: false, dot: false })}</div>` : "";
  }
  function miniWeek() {
    const r = { zoom: "semaine", start: TODAY, end: J(6), span: 7 };
    const ts = K.tasks().filter((t) => !K.isDone(t) && t.statusId !== "s6" && t.end >= TODAY && t.start <= J(6));
    return `<div class="hx-tl is-mini"><div class="hx-tlhead"><span></span><div class="hx-tltrack">${ticks(r).map((k) => `<span class="hx-tick ${k.iso === TODAY ? "is-today" : ""}" style="left:${tx(r, k.iso)}%;width:${100 / 7}%">${k.label}</span>`).join("")}</div></div>
      ${D.projects.map((p) => { const pk = pack(ts.filter((t) => t.projectId === p.id), r, 640); if (!pk.items.length) return ""; return `<div class="hx-lane"><span class="hx-lh is-static" style="--c:${p.color}"><b>${e(p.name)}</b></span><div class="hx-ltrack" style="height:${pk.rows * ROWH + 6}px">${gridLines(r)}${pk.items.map((it) => lineItem(it, r)).join("")}</div></div>`; }).join("")}
      <div class="hx-lane"><span class="hx-lh is-static" style="--c:#0e7490"><b>Sport</b></span><div class="hx-ltrack" style="height:${ROWH + 4}px">${gridLines(r)}${D.sport.planned.filter((s) => s.date <= J(6)).map((s) => `<span class="hx-dot" style="left:${tx(r, s.date) + 100 / 14}%;--c:${SPORT_COL[s.sport] || "#0e7490"}" title="${e(s.title)}"><i></i>${s.time} ${e(s.sport)}</span>`).join("")}</div></div></div>`;
  }
  function accueil() {
    const today = K.todayTasks(), late = K.late(), bp = K.budgetPace();
    const next = dayItems(TODAY).find((i) => i.h0 >= hh(NOW) && !i.done);
    const todo = D.budget.toCategorize.filter((x) => !S.categorized[x.id]);
    const fmt = (h) => String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
    const hc = count(TODAY), tc = tcount(TODAY);
    return `<main class="hx-main hx-home" data-scroll>
      <div class="hx-hello is-tight"><h1>Lundi 5 octobre</h1><p>${today.length} tâches aujourd'hui · <span class="hx-red">${late.length} en retard</span> · ${next ? `ensuite <b>${fmt(next.h0)} ${e(next.label)}</b>` : "plus rien d'horodaté"} · habitudes ${hc.done}/${hc.total}</p></div>
      <div class="hx-grid">
        <section class="hx-tile hx-t-day">${tileHead(`Journée <small>${tc.done}/${tc.total} tâches</small>`, "journee")}<div class="hx-dayin"><div class="hx-mini">${cadran(TODAY, 170, true)}</div><ul class="hx-list">${today.map((t) => trow(t)).join("")}</ul></div></section>
        <section class="hx-tile hx-t-late">${tileHead(`À rattraper <span class="hx-red">${late.length}</span>`, "planning")}<ul class="hx-list">${late.map((t) => trow(t)).join("")}</ul></section>
        <section class="hx-tile hx-t-body">${tileHead("Corps", "corps", chooserBtn("tile"))}<div class="hx-kpis is-2">${[...S.metrics.tile].slice(0, 4).map((k) => kpi(k)).join("")}</div>
          <div class="hx-hstrip">${Array.from({ length: 7 }, (_, i) => K.addDays(TODAY, i - 6)).map((x) => `<span class="${x === TODAY ? "is-today" : ""}" title="${K.dateShort(x)} · ${count(x).done}/${count(x).total}">${pixel(x, 5, 1)}<small>${K.dayShort(x).slice(0, 2)}</small></span>`).join("")}</div></section>
        <section class="hx-tile hx-t-week">${tileHead("Semaine", "planning")}${miniWeek()}</section>
        <section class="hx-tile hx-t-proj">${tileHead("Projets", "projets")}<ul class="hx-plmini">${D.projects.map((p) => { const s = K.projectStats(p.id); return `<li><button type="button" data-nav="projets" data-project="${p.id}"><i style="background:${p.color}"></i>${e(p.name)}</button><span class="hx-bar"><i style="width:${s.progress}%;background:${p.color}"></i></span><span class="hx-num">${s.progress} %</span><span class="hx-num ${s.late ? "hx-red" : "hx-dim"}">${s.late ? s.late + " ret." : "—"}</span></li>`; }).join("")}</ul></section>
        <section class="hx-tile hx-t-money">${tileHead(`Argent <small>${D.budget.month}</small>`, "argent")}<div class="hx-mstrip">
          <div><small>Reste à dépenser</small><b>${K.euro(bp.left)}</b><span class="hx-dim">${K.euro(bp.perDay)}/jour</span></div>
          <div class="is-wide"><small>Rythme du mois · ${K.euro(D.budget.spent)} sur ${K.euro(D.budget.total)}</small><span class="hx-pace"><i style="width:${Math.round(D.budget.spent / D.budget.total * 100)}%"></i><b style="left:${Math.round(D.budget.dayOfMonth / D.budget.daysInMonth * 100)}%"></b></span><span class="${bp.ahead > 0 ? "hx-red" : "hx-dim"}">${bp.ahead > 0 ? K.euro(bp.ahead) + " au-dessus du rythme" : "dans le rythme"}</span></div>
          <div><small>Dépassement</small><b class="hx-red">Restaurants</b><span class="hx-dim">112 € / 100 €</span></div>
          <div><small>Patrimoine</small><b>${K.euro(D.wealth.total)}</b>${K.spark(D.wealth.series, { w: 70, h: 14, color: "#0f766e", fill: false, dot: false })}</div>
          <div class="is-wide"><small>À classer · ${todo.length}</small>${todo.map((x) => `<span class="hx-cls">${e(x.label)} <span class="hx-num">${K.euro(x.amount, true)}</span> <button type="button" class="hx-btn is-sm" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></span>`).join("") || `<span class="hx-dim">Tout est classé</span>`}</div>
        </div></section>
      </div></main>`;
  }

  // ------------------------------------------------------------- planning
  function lifeLanes(r) {
    let h = "";
    if (S.show.corps) {
      const cells = SERIES.dates.map((d, i) => (d >= r.start && d <= r.end ? `<i class="hx-rec" style="left:${tx(r, d)}%;width:${100 / r.span}%;background:${zoneColor(SERIES.recovery[i])}" title="${K.dateShort(d)} · récupération ${SERIES.recovery[i]} %"></i>` : "")).join("");
      const all = SESSIONS.concat(D.sport.planned.map((x) => ({ ...x, plan: true }))).filter((x) => x.date >= r.start && x.date <= r.end);
      const ses = r.span > 60 ? weekBars(r, (w0, w1) => all.filter((x) => x.date >= w0 && x.date < w1).reduce((a, x) => a + x.minutes, 0), 300, "#0e7490", (v) => K.hm(v) + " de sport") : all.map((x) => `<span class="hx-dot ${x.plan ? "is-plan" : ""}" style="left:${tx(r, x.date) + 50 / r.span}%;--c:${SPORT_COL[x.sport] || "#0e7490"}" title="${e(x.sport)} · ${K.hm(x.minutes)}"><i></i>${r.span <= 10 ? e(x.sport) : ""}</span>`).join("");
      h += `<div class="hx-lane is-life"><span class="hx-lh is-static" style="--c:#16a34a"><b>Corps</b><small>récupération · séances</small></span><div class="hx-ltrack" style="height:40px">${gridLines(r)}<div class="hx-recstrip">${cells}</div>${ses}</div></div>`;
    }
    if (S.show.argent) {
      const max = 150;
      const dots = r.span > 60 ? weekBars(r, (w0, w1) => SERIES.dates.reduce((a, d, i) => (d >= w0 && d < w1 ? a + SERIES.spend[i] : a), 0), 450, "#6d28d9", (v) => v + " € dépensés") : SERIES.dates.map((d, i) => (d >= r.start && d <= r.end && SERIES.spend[i] ? `<i class="hx-sp" style="left:${tx(r, d) + 50 / r.span}%;--s:${Math.min(1, SERIES.spend[i] / max)}" title="${K.dateShort(d)} · ${SERIES.spend[i]} €"></i>` : "")).join("");
      h += `<div class="hx-lane is-life"><span class="hx-lh is-static" style="--c:#6d28d9"><b>Argent</b><small>dépenses par jour</small></span><div class="hx-ltrack" style="height:34px">${gridLines(r)}${dots}</div></div>`;
    }
    return h;
  }
  // Barres hebdomadaires pour les zooms larges (une barre par semaine).
  function weekBars(r, val, max, color, label) {
    let h = "";
    for (let i = 0; i < r.span; i += 7) { const w0 = K.addDays(r.start, i), w1 = K.addDays(w0, 7), v = val(w0, w1); if (!v) continue; h += `<i class="hx-wbar" style="left:${tx(r, w0)}%;width:${Math.max(.25, 700 / r.span * .7)}%;height:${Math.max(2, Math.min(1, v / max) * 22)}px;background:${color}" title="Semaine du ${K.dateShort(w0)} · ${label(v)}"></i>`; }
    return h;
  }
  function planning() {
    const r = trange(S.pz, S.po);
    const ts = applyF(K.tasks(), S.filter).filter((t) => t.end >= r.start && t.start <= r.end);
    const lanes = groupLanes(ts, S.pgroup).filter((l) => l.tasks.length);
    const GROUPS = [["projet", "Projet"], ["dossier", "Dossier"], ["responsable", "Responsable"], ["statut", "Statut"]];
    return `<main class="hx-main" data-scroll>
      <div class="hx-hello hx-row"><div><h1>Planning</h1></div>${zoomBar(r, "planning")}
        <div class="hx-opts"><span>Grouper par</span><div class="hx-seg is-sm">${GROUPS.map(([id, l]) => `<button type="button" data-group="${id}" aria-pressed="${S.pgroup === id}">${l}</button>`).join("")}</div><label><input type="checkbox" data-show="corps" ${S.show.corps ? "checked" : ""}> Corps</label><label><input type="checkbox" data-show="argent" ${S.show.argent ? "checked" : ""}> Argent</label></div></div>
      ${filterBar("planning", ts.length)}
      <div class="hx-tile hx-tl">
        <div class="hx-tlhead"><span class="hx-tlcap">${GROUPS.find((g) => g[0] === S.pgroup)[1]}</span><div class="hx-tltrack">${ticks(r).map((k) => `<span class="hx-tick ${k.major ? "is-major" : ""} ${r.zoom === "semaine" && k.iso === TODAY ? "is-today" : ""}" style="left:${tx(r, k.iso)}%">${k.label}</span>`).join("")}</div></div>
        ${lanes.map((l) => { const col = S.collapsed.has(l.id), late = l.tasks.filter(K.isLate).length, pk = pack(l.tasks, r); const sum = col ? (() => { const a = Math.max(0, tx(r, l.tasks.reduce((m, t) => (t.start < m ? t.start : m), "9999"))), b = Math.min(100, tx(r, K.addDays(l.tasks.reduce((m, t) => (t.end > m ? t.end : m), "0000"), 1))); return `<span class="hx-lsum" style="left:${a}%;width:${b - a}%;--c:${l.color}"></span>`; })() : ""; return `<div class="hx-lane ${col ? "is-col" : ""}"><button type="button" class="hx-lh" style="--c:${l.color}" data-collapse="${l.id}" aria-expanded="${!col}"><b><span class="hx-chev">${col ? "▸" : "▾"}</span>${e(l.label)}</b><small>${l.tasks.length} tâche${l.tasks.length > 1 ? "s" : ""}${late ? ` · <em>${late} en retard</em>` : ""}${l.project ? ` · <span class="hx-open" data-nav="projets" data-project="${l.project}">ouvrir</span>` : ""}</small></button><div class="hx-ltrack" style="height:${col ? 22 : pk.rows * ROWH + 6}px">${gridLines(r)}${col ? sum : pk.items.map((it) => lineItem(it, r)).join("")}</div></div>`; }).join("") || `<p class="hx-empty">Aucune tâche ne correspond aux filtres sur cette période.</p>`}
        ${lifeLanes(r)}
      </div>
      <p class="hx-legend2"><span><i class="lg-line"></i>en cours</span><span><i class="lg-line is-s1"></i>à planifier</span><span><i class="lg-line is-s2"></i>attente tiers</span><span><i class="lg-line is-done"></i>terminée</span><span><i class="lg-ms"></i>jalon</span><span><i class="lg-over"></i>retard depuis l'échéance</span><span><i class="lg-today"></i>aujourd'hui</span><span>Glisser une ligne la replanifie ; la glisser vers une autre portée change son projet.</span></p>
    </main>`;
  }

  // --------------------------------------------------------------- projets
  function projets() {
    const p = proj(S.projectId), st = K.projectStats(p.id), f = D.folders.find((x) => x.id === p.folderId);
    const r = trange(S.jz, S.jo), cmp = S.cmp;
    const ts = applyF(K.byProject(p.id), { ...S.filter, projects: new Set() }).sort((a, b) => a.start.localeCompare(b.start));
    const drift = (t) => (cmp !== "none" && t[cmp] ? K.days(t[cmp].end, t.end) : null);
    const real = K.byProject(p.id).filter((t) => t.statusId !== "s6");
    const endNow = real.reduce((m, t) => (t.end > m ? t.end : m), "0000");
    const endRef = cmp !== "none" ? real.reduce((m, t) => { const x = t[cmp] ? t[cmp].end : t.end; return x > m ? x : m; }, "0000") : null;
    const ds = real.map(drift).filter((x) => x !== null), slip = ds.filter((x) => x > 0).length, early = ds.filter((x) => x < 0).length, stable = ds.filter((x) => x === 0).length;
    const avg = ds.length ? ds.reduce((a, b) => a + b, 0) / ds.length : 0;
    const CMP = [["none", "Aucune"], ["ref", "Référence courante"], ["initial", "Plan initial"]];
    const dcell = (d) => (d === null ? `<span class="hx-dim">—</span>` : d === 0 ? `<span class="hx-dim">0 j</span>` : `<span class="${d > 0 ? "hx-red" : "hx-green"}">${d > 0 ? "+" : "−"}${Math.abs(d)} j</span>`);
    const rows = ts.map((t) => {
      const d = drift(t), b = cmp !== "none" ? t[cmp] : null, a0 = tx(r, t.milestone ? t.end : t.start), a1 = t.milestone ? a0 : tx(r, K.addDays(t.end, 1));
      const gx = b ? tx(r, b.end) : 0;
      const ghost = b && (t.milestone ? gx < 0 || gx > 100 : tx(r, K.addDays(b.end, 1)) < 0 || tx(r, b.start) > 100) ? "" : b ? (t.milestone ? `<i class="hx-gms" style="left:${gx}%"></i>` : `<i class="hx-ghost" style="left:${Math.max(0, tx(r, b.start))}%;width:${Math.max(.3, Math.min(100, tx(r, K.addDays(b.end, 1))) - Math.max(0, tx(r, b.start)))}%"></i>`) : "";
      const ce = tx(r, K.addDays(b ? b.end : t.end, 1)), c0 = Math.max(0, Math.min(ce, a1)), c1 = Math.min(100, Math.max(ce, a1));
      const conn = b && d && c1 > c0 ? `<i class="hx-conn ${d > 0 ? "is-late" : "is-early"}" style="left:${c0}%;width:${c1 - c0}%"></i>` : "";
      const bar = t.milestone ? `<i class="hx-pms" style="left:${a0}%;--c:${p.color}"></i>` : `<i class="hx-pbar is-${t.statusId} ${K.isDone(t) ? "is-done" : ""}" style="left:${Math.max(0, a0)}%;width:${Math.max(.35, Math.min(100, a1) - Math.max(0, a0))}%;--c:${p.color}"></i>`;
      const over = K.isLate(t) ? `<span class="hx-over" style="left:${Math.max(0, a1)}%;width:${Math.max(0, Math.min(100, tx(r, TODAY)) - Math.max(0, a1))}%;top:7px"></span>` : "";
      return `<div class="hx-prw ${S.taskId === t.id ? "is-sel" : ""} ${K.isDone(t) ? "is-done" : ""}"><span class="hx-gname">${chk(t)}<button type="button" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button></span><span class="hx-dim">${K.initials(t.assignee)}</span><span class="hx-num">${K.dateShort(t.start)}</span><span class="hx-num ${K.isLate(t) ? "hx-red" : ""}">${K.dateShort(t.end)}</span><span class="hx-num hx-dim">${b ? K.dateShort(b.end) : "—"}</span><span class="hx-num">${dcell(d)}</span><div class="hx-ptl" data-task="${t.id}">${gridLines(r)}${ghost}${conn}${bar}${over}</div></div>`;
    }).join("");
    return `<main class="hx-main hx-projets" data-scroll><nav class="hx-plist" aria-label="Projets">${D.folders.map((fo) => `<h3>${e(fo.name)}</h3>${D.projects.filter((q) => q.folderId === fo.id).map((q) => { const s = K.projectStats(q.id); return `<button type="button" data-nav="projets" data-project="${q.id}" aria-current="${q.id === p.id}"><i style="background:${q.color}"></i><span>${e(q.name)}</span><small>${s.open}${s.late ? ` · <em>${s.late}</em>` : ""}</small></button>`; }).join("")}`).join("")}</nav>
      <div class="hx-pmain"><div class="hx-hello hx-row"><div><p class="hx-crumb">${e(f.name)} › ${e(p.name)}</p><h1 style="--c:${p.color}" class="hx-ptitle">${e(p.name)}</h1></div>
        <div class="hx-kpis is-inline"><div><small>Avancement</small><b>${st.progress} %</b></div><div><small>Ouvertes</small><b>${st.open}</b></div><div><small>En retard</small><b class="${st.late ? "hx-red" : ""}">${st.late}</b></div>${p.budget ? `<div><small>Budget</small><b>${Math.round(p.spent / p.budget * 100)} %</b></div>` : ""}<div><small>Fin prévue</small><b>${K.dateShort(endNow)}</b></div></div>
        <button type="button" class="hx-btn is-primary" data-new>+ Tâche</button></div>
        <section class="hx-tile hx-cmp"><div class="hx-cmpl"><span>Comparer à</span><div class="hx-seg is-sm">${CMP.map(([id, l]) => `<button type="button" data-cmp="${id}" aria-pressed="${cmp === id}">${l}</button>`).join("")}</div><button type="button" class="hx-more is-plain">Figer une nouvelle référence</button></div>
          ${cmp === "none" ? `<p class="hx-dim">Choisissez une référence pour voir les glissements de dates.</p>` : `<div class="hx-cmpk"><div><small>Fin du projet</small><b>${K.dateShort(endNow)}</b><span>${cmp === "ref" ? "réf." : "initial"} ${K.dateShort(endRef)} · ${dcell(K.days(endRef, endNow))}</span></div><div><small>Tâches glissées</small><b class="${slip ? "hx-red" : ""}">${slip}</b><span>sur ${ds.length} comparées</span></div><div><small>En avance</small><b class="${early ? "hx-green" : ""}">${early}</b><span>${stable} à l'heure</span></div><div><small>Dérive moyenne</small><b>${avg > 0 ? "+" : ""}${avg.toFixed(1).replace(".", ",")} j</b><span>sur la date de fin</span></div><div class="hx-cmpbar">${ds.slice().sort((a, b) => b - a).map((d) => `<i class="${d > 0 ? "is-late" : d < 0 ? "is-early" : ""}" style="height:${Math.min(100, 12 + Math.abs(d) * 4)}%" title="${d > 0 ? "+" : ""}${d} j"></i>`).join("")}</div></div>`}</section>
        <div class="hx-pbarrow">${zoomBar(r, "projets", ["mois", "trimestre", "annee", "pluri"])}</div>
        ${filterBar("projets", ts.length, { hide: ["projects"] })}
        <div class="hx-tile hx-pgantt"><div class="hx-prw hx-prh"><span>Tâche</span><span>Resp.</span><span>Début</span><span>Fin</span><span>${cmp === "initial" ? "Initiale" : "Réf."}</span><span>Dérive</span><div class="hx-ptl">${sparse(ticks(r), 7).map((k) => `<b class="hx-tick ${k.major ? "is-major" : ""}" style="left:${tx(r, k.iso)}%">${k.label}</b>`).join("")}</div></div>${rows || `<p class="hx-empty">Aucune tâche ne correspond aux filtres.</p>`}</div>
        <p class="hx-legend2"><span><i class="lg-line"></i>dates actuelles</span><span><i class="lg-ghost"></i>${cmp === "initial" ? "plan initial" : "référence"}</span><span><i class="lg-conn"></i>glissement</span><span><i class="lg-over"></i>retard</span><span>Budget, documents, équipe et journal : « Fiche projet ».</span></p>
      </div></main>`;
  }

  // ---------------------------------------------------------------- journée
  function journee() {
    const items = dayItems(TODAY);
    const fmt = (h) => String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
    const timeline = [{ h0: 6.67, label: "Réveil · nuit de 7,2 h", kind: "Sommeil", color: "#9fb2e6" }, ...items];
    const rows = []; let nowDone = false;
    timeline.forEach((it) => { if (!nowDone && it.h0 > hh(NOW)) { rows.push(`<li class="hx-now"><time>${NOW}</time><span>Maintenant</span></li>`); nowDone = true; } rows.push(`<li class="${(it.h1 && it.h1 < hh(NOW)) || it.done ? "is-past" : ""}" style="--c:${it.color}"><time>${fmt(it.h0)}</time>${it.id ? `<button type="button" data-task="${it.id}">${e(it.label)}</button>` : `<span>${e(it.label)}</span>`}<small>${it.kind}${it.h1 ? " · " + Math.round((it.h1 - it.h0) * 60) + " min" : ""}</small></li>`); });
    return `<main class="hx-main hx-journee" data-scroll>
      <div class="hx-hello"><h1>Journée <span>lundi 5 octobre</span></h1><p>À gauche, les tâches du jour en pixels ; au centre, le cadran (anneau extérieur : les heures ; anneau intérieur : une case par habitude ; au cœur, les deux pixels du jour) ; à droite, les habitudes. Survoler une habitude l'éclaire partout.</p></div>
      <div class="hx-jgrid">
        ${taskPanel(TODAY)}
        <section class="hx-dialwrap">${cadran(TODAY, 460)}<ul class="hx-legend"><li><i style="background:#d6def3"></i>Sommeil <small>(heures à importer)</small></li><li><i style="background:#7c5cd6"></i>Réunions</li><li><i style="background:#d64545"></i>Tâches à heure fixe</li><li><i style="background:#0e7490"></i>Sport</li>${THEMES.map((t) => `<li><i style="background:${t.color}"></i>${e(t.name)}</li>`).join("")}</ul>
          <header class="hx-th is-sub"><h2>Fil horaire</h2></header><ol class="hx-fil">${rows.join("")}${nowDone ? "" : `<li class="hx-now"><time>${NOW}</time><span>Maintenant</span></li>`}</ol></section>
        ${habitPanel(TODAY)}
      </div></main>`;
  }

  // ------------------------------------------------------------ graphiques
  const roll = (a, w, f) => a.map((_, i) => f(a.slice(Math.max(0, i - w + 1), i + 1)));
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  function smooth(pts) {
    if (pts.length < 3) return pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) { const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2; d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`; }
    return d;
  }
  // Courbe de mesure : bande min–max glissante (7 j), moyenne mobile (7 j),
  // valeurs du jour, zones et objectif ; dernière valeur mise en avant.
  function metricChart(vals, dates, o) {
    const W = 1240, H = o.h || 96, L = 6, R = 70, T = 10, B = 18, n = vals.length;
    const lo = Math.min(...vals, o.goal ?? Infinity, o.min ?? Infinity), hi = Math.max(...vals, o.goal ?? -Infinity, o.max ?? -Infinity), pad = (hi - lo) * .12 || 1;
    const y0 = lo - pad, y1 = hi + pad, X = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R), Y = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(o.label)} sur ${n} jours">`;
    (o.zones || []).forEach(([a, b, c]) => { const ya = Y(Math.min(b, y1)), yb = Y(Math.max(a, y0)); if (yb > ya) s += `<rect x="${L}" y="${ya.toFixed(1)}" width="${W - L - R}" height="${(yb - ya).toFixed(1)}" fill="${c}" opacity=".07"/>`; });
    for (let i = 0; i < n; i += Math.max(1, Math.round(n / 7))) s += `<line x1="${X(i).toFixed(1)}" y1="${T}" x2="${X(i).toFixed(1)}" y2="${H - B}" stroke="#eef1f5"/><text x="${X(i).toFixed(1)}" y="${H - 4}" class="hx-mct" text-anchor="${i === 0 ? "start" : "middle"}">${K.dateShort(dates[i])}</text>`;
    if (o.goal != null) s += `<line x1="${L}" y1="${Y(o.goal).toFixed(1)}" x2="${W - R}" y2="${Y(o.goal).toFixed(1)}" stroke="${o.color}" stroke-dasharray="4 4" opacity=".55"/><text x="${W - R + 6}" y="${(Y(o.goal) + 4).toFixed(1)}" class="hx-mct">obj. ${o.fmt(o.goal)}</text>`;
    if (o.mode === "bars") {
      const bw = Math.max(2, Math.min(14, (W - L - R) / n * .55));
      vals.forEach((v, i) => { const ok = o.goal != null && v >= o.goal; s += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(y0) - Y(v)).toFixed(1)}" rx="${bw / 2}" fill="${o.color}" opacity="${ok ? .9 : .38}"><title>${K.dateShort(dates[i])} · ${o.fmt(v)}</title></rect>`; });
    } else {
      const mn = roll(vals, 7, (a) => Math.min(...a)), mx = roll(vals, 7, (a) => Math.max(...a));
      const top = mx.map((v, i) => [X(i), Y(v)]), bot = mn.map((v, i) => [X(i), Y(v)]).reverse();
      s += `<path d="${smooth(top)} L${bot.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")} Z" fill="${o.color}" opacity=".09"/>`;
      if (o.mode === "area") s += `<path d="${smooth(vals.map((v, i) => [X(i), Y(v)]))} L${X(n - 1)} ${Y(y0)} L${X(0)} ${Y(y0)} Z" fill="${o.color}" opacity=".10"/>`;
      vals.forEach((v, i) => { s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${n > 40 ? 1.5 : 2.6}" fill="${o.dotColor ? o.dotColor(v) : o.color}" opacity="${o.dotColor ? .9 : .45}"><title>${K.dateShort(dates[i])} · ${o.fmt(v)}</title></circle>`; });
      s += `<path d="${smooth(roll(vals, 7, mean).map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${o.color}" stroke-width="2.2" stroke-linecap="round"/>`;
    }
    const lv = vals[n - 1];
    s += `<circle cx="${X(n - 1)}" cy="${Y(lv).toFixed(1)}" r="4.5" fill="#fff" stroke="${o.dotColor ? o.dotColor(lv) : o.color}" stroke-width="2.4"/><text x="${X(n - 1) + 10}" y="${(Y(lv) + 4).toFixed(1)}" class="hx-mcv">${o.fmt(lv)}</text>`;
    return s + "</svg>";
  }

  // ---------------------------------------------------------------- corps
  const MDEF = {
    recovery: { label: "Récupération", unit: "%", color: "#16a34a", fmt: (v) => Math.round(v) + " %", zones: [[0, 33, "#dc2626"], [34, 66, "#e0a21b"], [67, 100, "#16a34a"]], dotColor: zoneColor, min: 0, max: 100 },
    sleep: { label: "Sommeil réel", unit: "h", color: "#5b7bd8", fmt: (v) => v.toFixed(1).replace(".", ",") + " h", goal: 8, mode: "area" },
    hrv: { label: "HRV", unit: "ms", color: "#0f9d76", fmt: (v) => Math.round(v) + " ms" },
    restingHr: { label: "FC repos", unit: "bpm", color: "#d64545", fmt: (v) => Math.round(v) + " bpm", invert: true },
    weight: { label: "Poids", unit: "kg", color: "#475569", fmt: (v) => v.toFixed(1).replace(".", ",") + " kg", invert: true },
    steps: { label: "Pas", unit: "", color: "#7c5cd6", fmt: (v) => (v / 1000).toFixed(1).replace(".", ",") + " k", goal: 10000, mode: "bars" },
  };
  const CSECT = [["recup", "Récupération et sommeil", ["recovery", "sleep"]], ["cardio", "Cardio", ["hrv", "restingHr"]], ["comp", "Composition corporelle", ["weight"]], ["act", "Activité et sport", ["steps", "sport"]], ["hab", "Habitudes", []]];
  function metricRow(k, n) {
    const m = MDEF[k], vals = SERIES[k].slice(-n), dates = SERIES.dates.slice(-n), last = vals[n - 1], av = mean(vals), delta = (last - av) / av * 100;
    const good = m.invert ? delta < 0 : delta > 0;
    return `<div class="hx-mrow2"><div class="hx-mhd"><small>${m.label}</small><b>${m.fmt(last)}</b><span class="${Math.abs(delta) < 2 ? "hx-dim" : good ? "hx-green" : "hx-red"}">${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)} % vs moyenne ${n} j</span><span class="hx-dim">moy. ${m.fmt(av)} · min ${m.fmt(Math.min(...vals))} · max ${m.fmt(Math.max(...vals))}</span></div>${metricChart(vals, dates, m)}</div>`;
  }
  function sportBlock(n) {
    const weeks = Math.max(2, Math.round(n / 7)), mon = (iso) => { const w = new Date(iso + "T12:00:00Z").getUTCDay() || 7; return K.addDays(iso, 1 - w); };
    const w0 = mon(K.addDays(TODAY, -(weeks - 1) * 7)), rows = Array.from({ length: weeks }, (_, i) => K.addDays(w0, i * 7));
    const data = rows.map((w) => { const by = {}; SESSIONS.filter((x) => x.date >= w && x.date < K.addDays(w, 7)).forEach((x) => (by[x.sport] = (by[x.sport] || 0) + x.minutes)); return { w, by, tot: Object.values(by).reduce((a, b) => a + b, 0) }; });
    const W = 1240, H = 150, L = 6, R = 70, T = 10, B = 20, max = Math.max(D.sport.goalHours * 60 * 1.25, ...data.map((d) => d.tot)), bw = (W - L - R) / weeks * .56;
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Heures de sport par semaine">`;
    const Y = (m) => T + (1 - m / max) * (H - T - B);
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(D.sport.goalHours * 60)}" y2="${Y(D.sport.goalHours * 60)}" stroke="#0e7490" stroke-dasharray="4 4" opacity=".6"/><text x="${W - R + 6}" y="${Y(D.sport.goalHours * 60) + 4}" class="hx-mct">obj. ${D.sport.goalHours} h</text>`;
    data.forEach((d, i) => { const x = L + (i + .5) * (W - L - R) / weeks - bw / 2; let y = Y(0); Object.keys(SPORT_COL).forEach((k) => { const v = d.by[k] || 0; if (!v) return; const h = Y(0) - Y(v); y -= h; s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(h - 1).toFixed(1)}" rx="3" fill="${SPORT_COL[k]}"><title>${k} · ${K.hm(v)}</title></rect>`; }); s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" class="hx-mct" text-anchor="middle">S${isoWeek(d.w)}</text>${d.tot ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" class="hx-mct" text-anchor="middle">${(d.tot / 60).toFixed(1).replace(".", ",")} h</text>` : ""}`; });
    s += "</svg>";
    const sw = K.sportWeek(), recent = SESSIONS.slice(-6).reverse();
    return `<div class="hx-mrow2"><div class="hx-mhd"><small>Sport</small><b>${K.hm(sw.done)} <span class="hx-dim">/ ${D.sport.goalHours} h</span></b><span class="hx-dim">cette semaine · semaine dernière ${K.hm(sw.last)}</span><span class="hx-sleg">${Object.entries(SPORT_COL).map(([k, c]) => `<span><i style="background:${c}"></i>${k}</span>`).join("")}</span></div>${s}</div>
      <table class="hx-stab"><thead><tr><th>Date</th><th>Sport</th><th>Séance</th><th>Durée</th><th>Distance</th><th>D+</th><th>FC moy.</th></tr></thead><tbody>${D.sport.planned.slice(0, 1).map((x) => `<tr class="is-plan"><td>auj. ${x.time}</td><td><i style="background:${SPORT_COL[x.sport]}"></i>${x.sport}</td><td>${e(x.title)}</td><td>${K.hm(x.minutes)}</td><td colspan="3" class="hx-dim">prévue</td></tr>`).join("")}${recent.map((x) => `<tr><td>${K.dayShort(x.date)} ${K.dateShort(x.date)}</td><td><i style="background:${SPORT_COL[x.sport] || "#0e7490"}"></i>${e(x.sport)}</td><td>${e(x.title)}</td><td>${K.hm(x.minutes)}</td><td>${x.km ? String(x.km).replace(".", ",") + " km" : "—"}</td><td>${x.dplus ? x.dplus + " m" : "—"}</td><td>${x.hr ? x.hr + " bpm" : "—"}</td></tr>`).join("")}</tbody></table>`;
  }
  function habitGrid(n) {
    const days = Array.from({ length: n }, (_, i) => K.addDays(TODAY, i - n + 1));
    let h = `<div class="hx-hg" style="--n:${n}"><span></span>${days.map((d, i) => `<span class="hx-hgd ${d === TODAY ? "is-today" : ""}">${n <= 30 || i % 7 === 0 ? Number(d.slice(8)) : ""}</span>`).join("")}<span></span>`;
    h += `<span class="hx-hgl"><b>Pixel du jour</b></span>${days.map((d) => `<span class="hx-hgp" title="${K.dateShort(d)} · ${count(d).done}/${count(d).total}">${pixel(d, n > 30 ? 2.4 : 4, n > 30 ? .6 : 1)}</span>`).join("")}<span></span>`;
    THEMES.forEach((t) => {
      h += `<span class="hx-hgl is-theme" style="--c:${t.color}"><b>${e(t.name)}</b><small>${t.mode === "single" ? "un seul choix" : ""}</small></span>${days.map(() => "<span></span>").join("")}<span></span>`;
      t.habits.forEach((hb0) => {
        const hb = ALL.find((x) => x.id === hb0.id); let ok = 0, tot = 0;
        h += `<span class="hx-hgl is-sub ${S.hot === hb.id ? "is-hot" : ""}" data-hp="${hb.id}">${e(hb.name)}</span>` + days.map((d) => { const st = hstate(hb, d); if (st.state !== "na") { tot++; if (st.state !== "todo") ok++; } return `<button type="button" class="hx-hc is-${st.state}" data-hab="${hb.id}|${d}|toggle" data-hp="${hb.id}" style="--c:${t.color};--f:${st.state === "part" ? st.value / hb.max : 1}" title="${e(hb.name)} · ${K.dateShort(d)}${st.value != null && hb.kind === "numeric" ? " · " + st.value + "/" + hb.max : ""}" aria-label="${e(hb.name)} le ${K.dateShort(d)}"></button>`; }).join("") + `<span class="hx-hgr">${tot ? Math.round(ok / tot * 100) : 0} %</span>`;
      });
    });
    return h + "</div>";
  }
  function corps() {
    const n = S.cper, sel = S.metrics.page;
    const summary = { recup: () => `récup. ${K.last(SERIES.recovery)} % · sommeil ${String(K.last(SERIES.sleep)).replace(".", ",")} h`, cardio: () => `HRV ${K.last(SERIES.hrv)} ms · FC ${K.last(SERIES.restingHr)} bpm`, comp: () => `${String(K.last(SERIES.weight)).replace(".", ",")} kg`, act: () => `${(K.last(SERIES.steps) / 1000).toFixed(1).replace(".", ",")} k pas · ${K.hm(K.sportWeek().done)} de sport`, hab: () => `${count(TODAY).done}/${count(TODAY).total} aujourd'hui` };
    return `<main class="hx-main hx-corps2" data-scroll>
      <div class="hx-hello hx-row"><div><h1>Corps</h1><p>Récupération ${K.last(SERIES.recovery)} % ce matin. Points : valeur du jour · trait : moyenne sur 7 jours · bande claire : minimum et maximum sur 7 jours.</p></div>
        <div class="hx-seg">${[14, 30, 90].map((p) => `<button type="button" data-cper="${p}" aria-pressed="${n === p}">${p} jours</button>`).join("")}</div><div class="hx-corpsbar">${chooserBtn("page")}</div></div>
      ${CSECT.map(([id, title, keys]) => {
        const open = !S.closed.has(id), shown = keys.filter((k) => sel.has(k));
        if (id !== "hab" && !shown.length) return "";
        const body = id === "hab" ? habitGrid(Math.min(n, 30)) + (n > 30 ? `<p class="hx-hint">Habitudes limitées aux 30 derniers jours pour rester lisibles ; la vue Année de Habit Pixel reste disponible.</p>` : "") : shown.map((k) => (k === "sport" ? sportBlock(n) : metricRow(k, n))).join("");
        return `<section class="hx-tile hx-csec ${open ? "" : "is-closed"}"><button type="button" class="hx-csh" data-csec="${id}" aria-expanded="${open}"><span class="hx-chev">${open ? "▾" : "▸"}</span><h2>${title}</h2><span class="hx-csum">${summary[id]()}</span></button>${open ? `<div class="hx-csb">${body}</div>` : ""}</section>`;
      }).join("")}
    </main>`;
  }

  // --------------------------------------------------------------- argent
  // Sankey : colonnes de nœuds, hauteurs proportionnelles, liens en rubans.
  function sankey(cols, links, o = {}) {
    const W = o.w || 1500, H = o.h || 330, L = o.left || 190, R = o.right || 230, gap = 9, nw = 12;
    const colX = cols.map((_, i) => L + i * (W - L - R - nw) / (cols.length - 1));
    const tot = (n) => Math.max(links.filter((l) => l[0] === n).reduce((a, l) => a + l[2], 0), links.filter((l) => l[1] === n).reduce((a, l) => a + l[2], 0));
    const maxCol = Math.max(...cols.map((c) => c.reduce((a, n) => a + tot(n[0]), 0) + (c.length - 1) * gap));
    const k = (H - 10) / maxCol, pos = {};
    cols.forEach((c, ci) => { let y = 5; c.forEach(([id, color, label]) => { const h = tot(id) * k; pos[id] = { x: colX[ci], y, h, color, label: label || id, out: y, in: y, ci }; y += h + gap; }); });
    let s = `<svg class="hx-sk" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(o.label || "Diagramme de flux")}">`;
    const off = new Map();
    Object.keys(pos).forEach((id) => { const P = pos[id]; let y = P.y; links.filter((l) => l[0] === id).sort((l1, l2) => pos[l1[1]].y - pos[l2[1]].y).forEach((l) => { off.set(l, { out: y }); y += l[2] * k; }); y = P.y; links.filter((l) => l[1] === id).sort((l1, l2) => pos[l1[0]].y - pos[l2[0]].y).forEach((l) => { off.get(l).in = y; y += l[2] * k; }); });
    links.forEach((l) => { const [a, b, v] = l, A = pos[a], Bn = pos[b], h = v * k, x0 = A.x + nw, x1 = Bn.x, y0 = off.get(l).out, y1 = off.get(l).in, cx = (x0 + x1) / 2; s += `<path d="M${x0} ${y0.toFixed(1)} C${cx} ${y0.toFixed(1)} ${cx} ${y1.toFixed(1)} ${x1} ${y1.toFixed(1)} L${x1} ${(y1 + h).toFixed(1)} C${cx} ${(y1 + h).toFixed(1)} ${cx} ${(y0 + h).toFixed(1)} ${x0} ${(y0 + h).toFixed(1)} Z" fill="${Bn.ci === cols.length - 1 ? Bn.color : A.color}" opacity=".28"><title>${e(A.label)} → ${e(Bn.label)} · ${K.euro(v)}</title></path>`; });
    Object.values(pos).forEach((p) => { const last = p.ci === cols.length - 1, first = p.ci === 0; s += `<rect x="${p.x}" y="${p.y.toFixed(1)}" width="${nw}" height="${Math.max(1.5, p.h).toFixed(1)}" rx="2" fill="${p.color}"/><text x="${first ? p.x - 8 : p.x + nw + 8}" y="${(p.y + p.h / 2 + 4).toFixed(1)}" text-anchor="${first ? "end" : "start"}" class="hx-skl">${e(p.label)} <tspan class="hx-skv">${K.euro(tot(Object.keys(pos).find((id) => pos[id] === p)))}</tspan></text>`; });
    (o.heads || []).forEach((h, i) => (s += ""));
    return s + "</svg>";
  }
  const FLOWS = {
    oct: { label: "Octobre 2026 · au 5", income: 3250, spent: 688, saved: 1000,
      cols: [[["Salaire", "#2f855a"]], [["Compte courant", "#256d85"]], [["Courses", "#16a34a"], ["Maison", "#0284c7"], ["Restaurants", "#dc2626"], ["Transport", "#7c5cd6"], ["Abonnements", "#64748b"], ["Loisirs", "#d99a2b"], ["Épargne", "#0f766e"], ["Non dépensé", "#cbd5e1"]]],
      links: [["Salaire", "Compte courant", 3250], ["Compte courant", "Courses", 210], ["Compte courant", "Maison", 150], ["Compte courant", "Restaurants", 112], ["Compte courant", "Transport", 96], ["Compte courant", "Abonnements", 60], ["Compte courant", "Loisirs", 60], ["Compte courant", "Épargne", 1000], ["Compte courant", "Non dépensé", 1562]] },
    sept: { label: "Septembre 2026", income: 4535, spent: 2570, saved: 1500,
      cols: [[["Salaire", "#2f855a"], ["Remboursements", "#73927e"], ["Activité pro", "#3f806f"]], [["Compte courant", "#256d85"], ["Compte pro", "#cf7856"]], [["Logement", "#475569"], ["Courses", "#16a34a"], ["Maison", "#0284c7"], ["Restaurants", "#dc2626"], ["Transport", "#7c5cd6"], ["Abonnements", "#64748b"], ["Loisirs", "#d99a2b"], ["Santé", "#db2777"], ["Charges pro", "#b45309"], ["Épargne", "#0f766e"], ["Non dépensé", "#cbd5e1"]]],
      links: [["Salaire", "Compte courant", 3250], ["Remboursements", "Compte courant", 85], ["Activité pro", "Compte pro", 1200], ["Compte courant", "Logement", 950], ["Compte courant", "Courses", 430], ["Compte courant", "Maison", 210], ["Compte courant", "Restaurants", 140], ["Compte courant", "Transport", 160], ["Compte courant", "Abonnements", 85], ["Compte courant", "Loisirs", 190], ["Compte courant", "Santé", 45], ["Compte courant", "Épargne", 1000], ["Compte courant", "Non dépensé", 125], ["Compte pro", "Charges pro", 360], ["Compte pro", "Épargne", 500], ["Compte pro", "Non dépensé", 340]] },
  };
  const ACCOUNTS = [
    { type: "Bourse", bank: "Boursorama", name: "PEA", bal: 14000, color: "#7c5cd6" },
    { type: "Comptes courants", bank: "Boursorama", name: "Compte courant", bal: 4200, color: "#607d9b" },
    { type: "Comptes courants", bank: "Crédit Agricole", name: "Compte joint", bal: 2000, color: "#607d9b" },
    { type: "Épargne réglementée", bank: "Crédit Agricole", name: "Livret A", bal: 22950, color: "#0284c7" },
    { type: "Assurance-vie", bank: "Linxea", name: "Linxea Spirica", bal: 41150, color: "#0f766e" },
  ];
  const TYPES = [["Bourse", "#7c5cd6"], ["Comptes courants", "#94a3b8"], ["Épargne réglementée", "#0284c7"], ["Assurance-vie", "#0f766e"]];
  const BANKS = [["Boursorama", "#256d85"], ["Crédit Agricole", "#3f806f"], ["Linxea", "#cf7856"]];
  const WSERIES = (() => { let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const end = { "Comptes courants": 6200, "Épargne réglementée": 22950, "Assurance-vie": 41150, "Bourse": 14000 }, start = { "Comptes courants": 5600, "Épargne réglementée": 17200, "Assurance-vie": 31800, "Bourse": 8600 }; return Array.from({ length: 24 }, (_, i) => { const f = i / 23; const o = {}; TYPES.forEach(([t]) => { const base = start[t] + (end[t] - start[t]) * f; o[t] = i === 23 ? end[t] : Math.round(base * (1 + (r() - .5) * (t === "Bourse" ? .09 : t === "Comptes courants" ? .12 : .015))); }); return o; }); })();
  const MONTHS24 = Array.from({ length: 24 }, (_, i) => { const d = new Date(Date.UTC(2024, 10 + i, 1)); return MOIS_C[d.getUTCMonth()] + (d.getUTCMonth() === 0 ? " " + d.getUTCFullYear() : ""); });
  function stackChart() {
    const W = 1500, H = 240, L = 50, R = 20, T = 10, B = 24, n = WSERIES.length, tot = WSERIES.map((o) => Object.values(o).reduce((a, b) => a + b, 0)), max = Math.ceil(Math.max(...tot) / 10000) * 10000;
    const X = (i) => L + i / (n - 1) * (W - L - R), Y = (v) => T + (1 - v / max) * (H - T - B);
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du patrimoine sur 24 mois">`;
    for (let v = 0; v <= max; v += 20000) s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f5"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="hx-mct">${v / 1000} k€</text>`;
    let base = WSERIES.map(() => 0);
    TYPES.forEach(([t, c]) => { const top = WSERIES.map((o, i) => base[i] + o[t]); const up = top.map((v, i) => [X(i), Y(v)]), dn = base.map((v, i) => [X(i), Y(v)]).reverse(); s += `<path d="${smooth(up)} L${dn.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")} Z" fill="${c}" opacity=".78"><title>${t}</title></path>`; base = top; });
    s += `<path d="${smooth(tot.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="#18263d" stroke-width="1.6"/>`;
    MONTHS24.forEach((m, i) => { if (i % 3 === 2 || i === n - 1) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="hx-mct">${m}</text>`; });
    return s + `<circle cx="${X(n - 1)}" cy="${Y(tot[n - 1])}" r="4" fill="#fff" stroke="#18263d" stroke-width="2"/></svg>`;
  }
  function argent() {
    const tab = S.atab, b = D.budget, bp = K.budgetPace();
    const tabs = `<div class="hx-tabs">${[["mois", "Mois"], ["patrimoine", "Patrimoine"], ["operations", "Opérations"]].map(([id, l]) => `<button type="button" data-atab="${id}" aria-selected="${tab === id}">${l}</button>`).join("")}</div>`;
    let body = "";
    if (tab === "mois") {
      const F = FLOWS[S.amonth], todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
      const cal = (() => { const first = new Date(Date.UTC(2026, 9, 1)).getUTCDay() || 7; let h = ["L", "M", "M", "J", "V", "S", "D"].map((x) => `<b>${x}</b>`).join("") + "<span></span>".repeat(first - 1); for (let d = 1; d <= 31; d++) { const iso = "2026-10-" + String(d).padStart(2, "0"), i = SERIES.dates.indexOf(iso), v = i >= 0 ? SERIES.spend[i] : 0; h += `<span class="${iso === TODAY ? "is-today" : ""} ${iso > TODAY ? "is-future" : ""}" style="--s:${Math.min(1, v / 120)}" title="${d} oct. · ${v ? v + " €" : "aucune dépense"}">${d}${v ? `<small>${v} €</small>` : ""}</span>`; } return h; })();
      body = `<div class="hx-mhead2"><div class="hx-nav2"><button type="button" data-amonth="sept" aria-label="Mois précédent" ${S.amonth === "sept" ? "disabled" : ""}>‹</button><b>${F.label}</b><button type="button" data-amonth="oct" aria-label="Mois suivant" ${S.amonth === "oct" ? "disabled" : ""}>›</button></div>
        <div class="hx-mk"><div><small>Revenus</small><b>${K.euro(F.income)}</b></div><div><small>Dépenses</small><b>${K.euro(F.spent)}</b></div><div><small>Épargne</small><b class="hx-green">${K.euro(F.saved)}</b><span class="hx-dim">${Math.round(F.saved / F.income * 100)} % des revenus</span></div>${S.amonth === "oct" ? `<div><small>Reste à dépenser</small><b>${K.euro(bp.left)}</b><span class="hx-dim">${K.euro(bp.perDay)} / jour</span></div><div class="is-wide"><small>Rythme</small><span class="hx-pace"><i style="width:${Math.round(b.spent / b.total * 100)}%"></i><b style="left:${Math.round(b.dayOfMonth / b.daysInMonth * 100)}%"></b></span><span class="hx-red">${K.euro(bp.ahead)} au-dessus du rythme</span></div>` : `<div><small>Budget tenu</small><b>6 / 7</b><span class="hx-dim">catégories dans l'enveloppe</span></div>`}</div></div>
        <section class="hx-tile"><header class="hx-th"><h2>Flux du mois <small>origine › compte › destination</small></h2></header>${sankey(F.cols, F.links, { label: "Flux du mois", h: S.amonth === "sept" ? 380 : 300 })}</section>
        <div class="hx-acols"><section class="hx-tile"><header class="hx-th"><h2>Budget par catégorie</h2><small class="hx-dim">trait : où vous devriez en être au ${b.dayOfMonth}</small></header>${b.categories.map((c) => { const pct = Math.round(c.spent / c.limit * 100); return `<div class="hx-bcat ${pct > 100 ? "is-over" : ""}"><span><i style="background:${c.color}"></i>${e(c.name)}</span><span class="hx-bmeter"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "#dc2626" : c.color}"></i><b style="left:${Math.round(b.dayOfMonth / b.daysInMonth * 100)}%"></b></span><span class="hx-num">${K.euro(c.spent)} <small>/ ${K.euro(c.limit)}</small></span><span class="hx-num ${pct > 100 ? "hx-red" : "hx-dim"}">${pct} %</span></div>`; }).join("")}</section>
          <section class="hx-tile"><header class="hx-th"><h2>À classer <span class="hx-badge">${todo.length}</span></h2></header>${todo.map((x) => `<div class="hx-txr"><span>${e(x.label)} <small class="hx-dim">${K.dateShort(x.date)}</small></span><span class="hx-num">${K.euro(x.amount, true)}</span><button type="button" class="hx-btn is-sm" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></div>`).join("") || `<p class="hx-dim">Tout est classé.</p>`}
            <header class="hx-th is-sub"><h2>Dépenses par jour</h2></header><div class="hx-mcal">${cal}</div></section></div>`;
    } else if (tab === "patrimoine") {
      const last = WSERIES[23], prev = WSERIES[22], y = WSERIES[11], sum = (o) => Object.values(o).reduce((a, b2) => a + b2, 0);
      const t = sum(last), m1 = t - sum(prev), m12 = t - sum(y);
      const cols = [TYPES.map(([n, c]) => [n, c]), BANKS.map(([n, c]) => [n, c]), ACCOUNTS.map((a) => [a.name, a.color])];
      const links = []; TYPES.forEach(([ty]) => BANKS.forEach(([bk]) => { const v = ACCOUNTS.filter((a) => a.type === ty && a.bank === bk).reduce((x, a) => x + a.bal, 0); if (v) links.push([ty, bk, v]); })); ACCOUNTS.forEach((a) => links.push([a.bank, a.name, a.bal]));
      body = `<div class="hx-mk"><div><small>Patrimoine</small><b>${K.euro(t)}</b></div><div><small>Sur 1 mois</small><b class="${m1 >= 0 ? "hx-green" : "hx-red"}">${m1 >= 0 ? "+" : "−"}${K.euro(Math.abs(m1))}</b><span class="hx-dim">${(m1 / sum(prev) * 100).toFixed(1).replace(".", ",")} %</span></div><div><small>Sur 12 mois</small><b class="hx-green">+${K.euro(m12)}</b><span class="hx-dim">${(m12 / sum(y) * 100).toFixed(1).replace(".", ",")} %</span></div><div><small>Disponible</small><b>${K.euro(last["Comptes courants"] + last["Épargne réglementée"])}</b><span class="hx-dim">comptes + livrets</span></div><div><small>Investi</small><b>${K.euro(last["Assurance-vie"] + last["Bourse"])}</b><span class="hx-dim">assurance-vie + bourse</span></div></div>
        <section class="hx-tile"><header class="hx-th"><h2>Évolution sur 24 mois <small>par type de compte</small></h2><span class="hx-sleg">${TYPES.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</span></header>${stackChart()}</section>
        <div class="hx-acols"><section class="hx-tile"><header class="hx-th"><h2>Structure <small>type › banque › compte</small></h2></header>${sankey(cols, links, { label: "Structure du patrimoine", w: 760, h: 270, left: 205, right: 170 })}</section>
          <section class="hx-tile"><header class="hx-th"><h2>Comptes</h2></header><table class="hx-atab"><thead><tr><th>Compte</th><th>Banque</th><th>Solde</th><th>Part</th></tr></thead><tbody>${TYPES.map(([ty, c]) => `<tr class="is-grp"><th colspan="2"><i style="background:${c}"></i>${ty}</th><td class="hx-num">${K.euro(last[ty])}</td><td class="hx-num hx-dim">${Math.round(last[ty] / t * 100)} %</td></tr>${ACCOUNTS.filter((a) => a.type === ty).map((a) => `<tr><td>${e(a.name)}</td><td class="hx-dim">${e(a.bank)}</td><td class="hx-num">${K.euro(a.bal)}</td><td><span class="hx-bar"><i style="width:${a.bal / t * 100}%;background:${c}"></i></span></td></tr>`).join("")}`).join("")}</tbody></table></section></div>`;
    } else {
      const all = [...b.transactions, { date: J(-5), label: "Prélèvement EDF", amount: -64.3, cat: "Maison" }, { date: J(-6), label: "Pharmacie Bellecour", amount: -18.9, cat: "Santé" }, { date: J(-7), label: "Monoprix", amount: -37.45, cat: "Courses" }, { date: J(-8), label: "Loyer octobre", amount: -950, cat: "Logement" }, { date: J(-9), label: "Facture 2026-031 · client", amount: 1200, cat: "Revenus pro" }, { date: J(-10), label: "Free Mobile", amount: -15.99, cat: "Abonnements" }];
      const q = S.aq.toLowerCase(), list = all.filter((x) => (!q || x.label.toLowerCase().includes(q)) && (!S.acat || (x.cat || "À classer") === S.acat)).sort((a, c) => c.date.localeCompare(a.date));
      const cats = [...new Set(all.map((x) => x.cat || "À classer"))];
      body = `<div class="hx-fbar"><label class="hx-fsearch"><span aria-hidden="true">⌕</span><input id="hx-aq" data-aq value="${e(S.aq)}" placeholder="Rechercher une opération" aria-label="Rechercher une opération" autocomplete="off"></label>${cats.map((c) => `<button type="button" class="hx-fchip ${S.acat === c ? "is-on" : ""}" data-acat="${e(c)}">${e(c)}</button>`).join("")}<p class="hx-fsum"><b>${list.length} opérations</b> · ${S.acat ? "catégorie : " + e(S.acat) : "toutes catégories"} · <button type="button" class="hx-more">Exporter en CSV</button></p></div>
        <div class="hx-tile hx-ops"><table class="hx-atab"><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Catégorie</th><th>Montant</th></tr></thead><tbody>${list.map((x) => { const tc = b.toCategorize.find((y) => y.label === x.label), cat = x.cat || (tc && S.categorized[tc.id]); return `<tr><td class="hx-num hx-dim">${K.dateShort(x.date)}</td><td>${e(x.label)}</td><td class="hx-dim">${x.cat === "Revenus pro" ? "Compte pro" : "Compte courant"}</td><td>${cat ? `<span class="hx-catc">${e(cat)}</span>` : `<button type="button" class="hx-btn is-sm" data-cat="${tc ? tc.id : ""}:${tc ? tc.suggest : ""}">À classer → ${tc ? e(tc.suggest) : ""}</button>`}</td><td class="hx-num ${x.amount > 0 ? "hx-green" : ""}">${K.euro(x.amount, true)}</td></tr>`; }).join("")}</tbody></table></div>`;
    }
    return `<main class="hx-main hx-argent" data-scroll><div class="hx-hello hx-row"><div><h1>Argent</h1><p>Budget personnel (KDM360) et patrimoine. La seule écriture possible reste le classement d'une opération, comme dans Nexora.</p></div>${tabs}</div>${body}<p class="hx-hint">Activité pro (devis, factures, Finance PRO) : onglet « Pro » à ajouter sur le même modèle.</p></main>`;
  }

  // ------------------------------------------------------------ fiche, saisie
  function panel() {
    const t = K.task(S.taskId); if (!t) return "";
    const cl = t.checklist || [], deps = K.deps(t), p = proj(t.projectId);
    return `<aside class="hx-panel" aria-label="Fiche de la tâche"><header><p class="hx-crumb"><i style="background:${p.color}"></i>${e(p.name)} · ${e(K.type(t.typeId).name)}</p><button type="button" class="hx-x" data-close aria-label="Fermer">×</button></header><h2>${e(t.title)}</h2>
      ${K.isLate(t) || K.blocked(t) ? `<p class="hx-flags">${K.isLate(t) ? `<span class="is-red">${K.lateDays(t)} j de retard</span>` : ""}${K.blocked(t) ? `<span class="is-amber">attend « ${e(deps[0].title)} »</span>` : ""}</p>` : ""}
      <dl class="hx-fields">${K.fields(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${cl.length ? `<h3>Sous-tâches <span>${cl.filter((x) => x.done).length}/${cl.length}</span></h3><ul class="hx-cl">${cl.map((x) => `<li class="${x.done ? "is-done" : ""}"><i>${x.done ? "✓" : ""}</i>${e(x.text)}</li>`).join("")}</ul>` : ""}
      ${t.desc ? `<h3>Description</h3><p>${e(t.desc)}</p>` : ""}
      ${deps.length ? `<h3>Dépend de</h3>${deps.map((d) => `<button type="button" class="hx-link" data-task="${d.id}">${e(d.title)} · ${K.isDone(d) ? "terminée" : "ouverte"}</button>`).join("")}` : ""}
      ${(t.attachments || []).length ? `<h3>Pièces jointes</h3>${t.attachments.map((a) => `<p class="hx-att">${e(a)}</p>`).join("")}` : ""}
      <details><summary>Plus de détails</summary><dl class="hx-fields">${K.more(t).map(([l, v]) => `<div><dt>${l}</dt><dd>${e(v)}</dd></div>`).join("")}</dl></details>
      <footer><button type="button" class="hx-btn is-primary" data-done="${t.id}">${K.isDone(t) ? "Rouvrir" : "Terminer"}</button><button type="button" class="hx-btn">Reporter</button><button type="button" class="hx-btn">Dupliquer</button><button type="button" class="hx-btn is-ghost">Archiver</button></footer></aside>`;
  }
  function composer() {
    if (!S.composer) return "";
    return `<div class="hx-scrim" data-close></div><form class="hx-compose" data-compose aria-label="Nouvelle tâche"><header class="hx-th"><h2>Nouvelle tâche</h2><button type="button" class="hx-x" data-close aria-label="Fermer">×</button></header>
      <input id="hx-draft" data-draft value="${e(S.draft)}" autocomplete="off" aria-label="Titre et détails de la tâche">
      <p class="hx-prev" data-preview>${K.previewHtml(S.draft)}</p>
      <div class="hx-pick"><span>Projet</span>${D.projects.map((p) => `<button type="button" data-append="#${p.name.replace(/\s/g, "")}"><i style="background:${p.color}"></i>${e(p.name)}</button>`).join("")}</div>
      <div class="hx-pick"><span>Quand</span>${["aujourd'hui", "demain", "vendredi", "lundi"].map((d) => `<button type="button" data-append="${d}">${d}</button>`).join("")}</div>
      <div class="hx-pick"><span>Qui</span>${D.members.map((n) => `<button type="button" data-append="@${n.split(" ")[0]}">${e(n.split(" ")[0])}</button>`).join("")}</div>
      <p class="hx-hint">Écrivez naturellement : #projet, @personne, !urgent, un jour, une heure. Type, début, sous-tâches et récurrence se règlent ensuite dans la fiche.</p>
      <footer><button type="button" class="hx-btn is-ghost" data-close>Annuler</button><button type="submit" class="hx-btn is-primary">Créer la tâche</button></footer></form>`;
  }

  // ----------------------------------------------------------------- rendu
  const SCREENS = { accueil, journee, planning, projets, corps, argent };
  function render() {
    const app = document.getElementById("hx-app");
    const sc = app.querySelector("[data-scroll]"), keep = sc ? sc.scrollTop : 0, same = app.dataset.screen === S.screen;
    app.dataset.screen = S.screen;
    app.innerHTML = topbar() + `<div class="hx-body ${S.taskId ? "has-panel" : ""}">${SCREENS[S.screen]()}${panel()}</div>` + composer() + (S.toast ? `<div class="hx-toast" role="status">${e(S.toast)}</div>` : "");
    const sc2 = app.querySelector("[data-scroll]"); if (sc2 && same) sc2.scrollTop = keep;
    const f = app.querySelector("#hx-draft"); if (f && S.composer) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    if (S.focus) { const g = app.querySelector("#" + S.focus); if (g) { g.focus(); g.setSelectionRange(g.value.length, g.value.length); } S.focus = ""; }
  }
  function go(screen, extra = {}) { S.screen = screen; S.toast = ""; S.composer = false; if (extra.project) S.projectId = extra.project; S.taskId = extra.task || (screen === "projets" && !extra.project ? S.taskId : null); render(); }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-nav],[data-task],[data-close],[data-done],[data-new],[data-hab],[data-cat],[data-append],[data-reset],[data-demo],[data-pop],[data-fpop],[data-fclear],[data-ftoggle],[data-fview],[data-zoom],[data-shift],[data-group],[data-collapse],[data-cmp],[data-cper],[data-csec],[data-atab],[data-amonth],[data-acat]");
    if (!el) { if (!ev.target.closest(".hx-pop") && (S.fpop || S.pop)) { S.fpop = ""; S.pop = ""; render(); } return; }
    const d = el.dataset;
    if (d.reset !== undefined) { reset(); render(); return; }
    if (d.pop !== undefined) { S.pop = S.pop === d.pop ? "" : d.pop; S.fpop = ""; render(); return; }
    if (d.fpop) { S.fpop = S.fpop === d.fpop ? "" : d.fpop; S.pop = ""; render(); return; }
    if (d.fclear) { S.filter[d.fclear].clear(); S.fview = ""; render(); return; }
    if (d.ftoggle) { S.filter[d.ftoggle] = !S.filter[d.ftoggle]; S.fview = ""; render(); return; }
    if (d.fview) { const v = VIEWS.find((x) => x[0] === d.fview); S.filter = v[2](); S.fview = d.fview; S.fpop = ""; render(); return; }
    if (d.zoom) { const [sc, z] = d.zoom.split("|"); if (sc === "planning") { S.pz = z; S.po = 0; } else { S.jz = z; S.jo = 0; } render(); return; }
    if (d.shift) { const [sc, v] = d.shift.split("|"); const k = sc === "planning" ? "po" : "jo"; S[k] = v === "0" ? 0 : S[k] + Number(v); render(); return; }
    if (d.group) { S.pgroup = d.group; render(); return; }
    if (d.collapse) { if (S.collapsed.has(d.collapse)) S.collapsed.delete(d.collapse); else S.collapsed.add(d.collapse); render(); return; }
    if (d.cmp) { S.cmp = d.cmp; render(); return; }
    if (d.cper) { S.cper = Number(d.cper); render(); return; }
    if (d.csec) { if (S.closed.has(d.csec)) S.closed.delete(d.csec); else S.closed.add(d.csec); render(); return; }
    if (d.atab) { S.atab = d.atab; render(); return; }
    if (d.amonth) { S.amonth = d.amonth; render(); return; }
    if (d.acat !== undefined) { S.acat = S.acat === d.acat ? "" : d.acat; render(); return; }
    if (d.demo) { if (d.demo === "projet") { S.screen = "projets"; S.projectId = "p-ctex6"; S.taskId = "t2"; S.composer = false; } else if (d.demo === "nouvelle") { S.composer = true; S.taskId = null; } render(); return; }
    if (d.done) { ev.stopPropagation(); const t = K.task(d.done); if (t) { t.statusId = K.isDone(t) ? "s3" : "s5"; S.toast = K.isDone(t) ? `« ${t.title} » terminée · Annuler` : `« ${t.title} » rouverte`; } render(); return; }
    if (d.hab) { const [h, day, op] = d.hab.split("|"); habitAct(h, day, op); render(); return; }
    if (d.cat) { const [id, c] = d.cat.split(":"); if (!id) return; S.categorized[id] = c; S.toast = `Opération classée dans « ${c} » (démo)`; render(); return; }
    if (d.append) { S.draft = (S.draft.trim() + " " + d.append).trim(); render(); return; }
    if (d.new !== undefined) { S.composer = true; S.taskId = null; render(); return; }
    if (d.close !== undefined) { S.composer = false; S.taskId = null; render(); return; }
    if (d.nav) { go(d.nav, { project: d.project }); return; }
    if (d.task) { S.taskId = d.task; S.composer = false; render(); }
  });
  // Survol : relie une habitude à son segment d'anneau, à sa case du pixel et à sa ligne.
  document.addEventListener("mouseover", (ev) => {
    if (!S) return;
    const el = ev.target.closest && ev.target.closest("[data-hp]");
    const id = el ? el.dataset.hp : null;
    if (id === S.hot) return;
    S.hot = id;
    document.querySelectorAll("#hx-app .is-hot").forEach((x) => x.classList.remove("is-hot"));
    if (id) document.querySelectorAll(`#hx-app [data-hp="${id}"]`).forEach((x) => { x.classList.add("is-hot"); const r = x.closest(".hx-hrow,.hx-chab"); if (r) r.classList.add("is-hot"); });
    document.getElementById("hx-app").classList.toggle("has-hot", !!id);
  });
  document.addEventListener("change", (ev) => {
    const ds = ev.target.dataset || {};
    if (ds.fset) { const [k, id] = ds.fset.split("|"); const set = S.filter[k]; if (set.has(id)) set.delete(id); else set.add(id); S.fview = ""; render(); return; }
    if (ds.show) { S.show[ds.show] = ev.target.checked; render(); return; }
    const m = ds.metric; if (!m) return; const [scope, k] = m.split("|"); const set = S.metrics[scope]; if (set.has(k)) set.delete(k); else set.add(k); render(); });
  document.addEventListener("input", (ev) => {
    if (ev.target.matches("[data-fq]")) { S.filter.q = ev.target.value; S.fview = ""; S.focus = "hx-fq"; render(); return; }
    if (ev.target.matches("[data-aq]")) { S.aq = ev.target.value; S.focus = "hx-aq"; render(); return; }
  });
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-draft]")) { S.draft = ev.target.value; document.querySelectorAll("[data-preview]").forEach((p) => (p.innerHTML = K.previewHtml(S.draft))); } });
  document.addEventListener("submit", (ev) => { if (!ev.target.matches("[data-compose]")) return; ev.preventDefault(); const t = K.createFromDraft(S.draft); if (!t) return; S.composer = false; S.draft = ""; S.toast = `Tâche « ${t.title} » créée dans ${proj(t.projectId).name} (démo, rien n'est enregistré)`; render(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && (S.composer || S.taskId)) { S.composer = false; S.taskId = null; render(); } });

  function boot() {
    reset();
    const h = (location.hash || "").slice(1);
    if (SCREENS[h]) S.screen = h;
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
