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
    for (let i = 1; i <= 27; i++) {
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
    Object.assign(S, { screen: "accueil", projectId: "p-ctex6", taskId: null, composer: false, toast: "", hot: null, draft: "Relancer BC vendredi 14h #CTEX6 @Vincent !urgent", pop: "", metrics: { tile: new Set(["recovery", "sleep", "hrv", "sport"]), page: new Set(["sleep", "recovery", "hrv", "restingHr", "sport", "steps", "weight"]) } });
    const pt = K.task("t7"); if (pt) pt.statusId = "s5"; // point hebdo de 8:30 déjà fait
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

  function kpi(k) {
    const H = D.health, sw = K.sportWeek();
    const m = { sleep: ["Sommeil", String(K.last(H.sleep)).replace(".", ",") + " h", H.sleep, "#5b7bd8"], recovery: ["Récupération", K.last(H.recovery) + " %", H.recovery, "#0f9d76"], hrv: ["HRV", K.last(H.hrv) + " ms", H.hrv, "#0f9d76"], restingHr: ["FC repos", K.last(H.restingHr) + " bpm", H.restingHr, "#d64545"], weight: ["Poids", String(K.last(H.weight)).replace(".", ",") + " kg", H.weight, "#475569"], steps: ["Pas", (K.last(H.steps) / 1000).toFixed(1).replace(".", ",") + " k", H.steps, "#7c5cd6"] }[k];
    if (k === "sport") return `<div><small>Sport semaine</small><b>${K.hm(sw.done)}<span> / ${D.sport.goalHours} h</span></b><span class="hx-bar"><i style="width:${Math.min(100, sw.done / sw.goal * 100)}%;background:#0e7490"></i></span></div>`;
    return m ? `<div><small>${m[0]}</small><b>${m[1]}</b>${K.spark(m[2].slice(-7), { w: 70, h: 18, color: m[3], fill: false })}</div>` : "";
  }

  // ---------------------------------------------------------------- accueil
  function accueil() {
    const today = K.todayTasks(), late = K.late(), sw = K.sportWeek(), bp = K.budgetPace(), H = D.health;
    const next = dayItems(TODAY).find((i) => i.h0 >= hh(NOW));
    const todo = D.budget.toCategorize.filter((x) => !S.categorized[x.id]);
    const wk = Array.from({ length: 7 }, (_, i) => K.addDays(TODAY, i));
    const fmt = (h) => String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
    return `<main class="hx-main hx-home" data-scroll>
      <div class="hx-hello"><h1>Lundi 5 octobre</h1><p>${today.length} tâches aujourd'hui · ${late.length} en retard · ${next ? `ensuite <b>${fmt(next.h0)} ${e(next.label)}</b>` : "plus rien d'horodaté"}</p></div>
      <div class="hx-grid">
        <section class="hx-tile hx-t-day">${tileHead("Journée", "journee")}<div class="hx-dayin"><div class="hx-mini">${cadran(TODAY, 220, true)}</div><ul class="hx-list">${today.map((t) => trow(t)).join("")}</ul></div></section>
        <section class="hx-tile hx-t-late">${tileHead(`À rattraper <span class="hx-red">${late.length}</span>`, "projets")}<ul class="hx-list">${late.map((t) => trow(t)).join("")}</ul></section>
        <section class="hx-tile hx-t-proj">${tileHead("Projets", "projets")}<table class="hx-ptable"><thead><tr><th>Projet</th><th>Avancement</th><th>Ouv.</th><th>Retard</th><th>Prochain jalon</th></tr></thead><tbody>${D.projects.map((p) => { const s = K.projectStats(p.id); const ms = K.byProject(p.id).filter((t) => t.milestone && !K.isDone(t)).sort((a, b) => a.end.localeCompare(b.end))[0]; return `<tr><th><button type="button" data-nav="projets" data-project="${p.id}"><i style="background:${p.color}"></i>${e(p.name)}</button></th><td><span class="hx-bar"><i style="width:${s.progress}%;background:${p.color}"></i></span><small>${s.progress} %</small></td><td>${s.open}</td><td class="${s.late ? "hx-red" : ""}">${s.late || "—"}</td><td>${ms ? `<button type="button" data-task="${ms.id}">◆ ${e(ms.title)}</button> <small>${K.dateShort(ms.end)}</small>` : "—"}</td></tr>`; }).join("")}</tbody></table></section>
        <section class="hx-tile hx-t-body">${tileHead("Corps", "corps", chooserBtn("tile"))}<div class="hx-kpis">${[...S.metrics.tile].map((k) => kpi(k)).join("")}</div>
          <div class="hx-hstrip"><span class="hx-hlbl">Habitudes</span>${Array.from({ length: 7 }, (_, i) => K.addDays(TODAY, i - 6)).map((x) => `<span class="${x === TODAY ? "is-today" : ""}" title="${K.dateShort(x)} · ${count(x).done}/${count(x).total}">${pixel(x, 7, 1.5)}<small>${K.dayShort(x).slice(0, 2)}</small></span>`).join("")}<span class="hx-hnow">${count(TODAY).done} / ${count(TODAY).total} aujourd'hui</span></div></section>
        <section class="hx-tile hx-t-week">${tileHead("Semaine", "planning")}<div class="hx-wk" style="--n:7"><span></span>${wk.map((d) => `<b class="${d === TODAY ? "is-today" : ""}">${K.dayShort(d).slice(0, 3)} ${Number(d.slice(8))}</b>`).join("")}
          ${D.projects.map((p) => { const ts = K.byProject(p.id).filter((t) => !K.isDone(t) && t.statusId !== "s6" && t.end >= TODAY && t.start <= wk[6]); return `<span class="hx-wl"><i style="background:${p.color}"></i>${e(p.name)}</span><div class="hx-wt">${ts.map((t, i) => { const a = Math.max(0, K.days(TODAY, t.start)), b = Math.min(6, K.days(TODAY, t.end)); return `<button type="button" data-task="${t.id}" class="hx-wb ${t.milestone ? "is-ms" : ""}" style="grid-column:${a + 1}/${b + 2};grid-row:${i + 1};--c:${p.color}" title="${e(t.title)}">${t.milestone ? "◆ " : ""}${e(t.title)}</button>`; }).join("")}</div>`; }).join("")}
          <span class="hx-wl"><i style="background:#0e7490"></i>Sport</span><div class="hx-wt">${D.sport.planned.filter((s) => s.date <= wk[6]).map((s) => `<span class="hx-wb is-sport" style="grid-column:${K.days(TODAY, s.date) + 1}">${s.time} ${e(s.sport)}</span>`).join("")}</div></div></section>
        <section class="hx-tile hx-t-money">${tileHead(`Argent <small>${D.budget.month}</small>`, "argent")}<div class="hx-kpis is-3"><div><small>Reste à dépenser</small><b>${K.euro(bp.left)}</b><span class="hx-dim">${K.euro(bp.perDay)} / jour</span></div><div><small>Rythme</small><span class="hx-pace"><i style="width:${Math.round(D.budget.spent / D.budget.total * 100)}%"></i><b style="left:${Math.round(D.budget.dayOfMonth / D.budget.daysInMonth * 100)}%"></b></span><span class="hx-dim">${bp.ahead > 0 ? K.euro(bp.ahead) + " au-dessus" : K.euro(-bp.ahead) + " sous le rythme"}</span></div><div><small>Patrimoine</small><b>${K.euro(D.wealth.total)}</b>${K.spark(D.wealth.series, { w: 80, h: 18, color: "#0f766e", fill: false })}</div></div>
          <div class="hx-alert"><b>Restaurants</b> 112 € / 100 € · dépassé de 12 €</div>
          ${todo.map((x) => `<div class="hx-txr"><span>${e(x.label)}</span><span class="hx-num">${K.euro(x.amount, true)}</span><button type="button" class="hx-btn is-sm" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></div>`).join("") || `<p class="hx-dim">Toutes les opérations sont classées.</p>`}</section>
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

  // ------------------------------------------------------- partition : semaine
  function planning() {
    const start = K.addDays(TODAY, -2), N = 9, days = Array.from({ length: N }, (_, i) => K.addDays(start, i));
    const col = (iso) => Math.max(0, Math.min(N - 1, K.days(start, iso)));
    const head = `<div class="hx-prow hx-phead"><span>Portée</span>${days.map((d) => `<b class="${d === TODAY ? "is-today" : ""}"><span>${K.dayShort(d)} <strong>${Number(d.slice(8))}</strong></span>${tcount(d).total ? `<span class="hx-phpx">${taskSquare(d, 6, 1.5)}<small>${tcount(d).done}/${tcount(d).total}</small></span>` : ""}</b>`).join("")}</div>`;
    const lane = (label, sub, color, cells, go) => `<div class="hx-prow" style="--n:${N}"><button type="button" class="hx-plh" style="--c:${color}" ${go || ""}><b>${label}</b><small>${sub}</small></button><div class="hx-ptrack" style="--n:${N};--today:${K.days(start, TODAY) + 1}">${cells}</div></div>`;
    let html = "";
    D.projects.forEach((p) => {
      const ts = K.byProject(p.id).filter((t) => !K.isDone(t) && t.statusId !== "s6" && t.end >= start && t.start <= days[N - 1]);
      const st = K.projectStats(p.id);
      const cells = ts.map((t, i) => `<button type="button" class="hx-note ${K.isLate(t) ? "is-late" : ""} ${t.milestone ? "is-ms" : ""}" data-task="${t.id}" style="grid-column:${col(t.start) + 1}/${col(t.end) + 2};grid-row:${i + 1};--c:${p.color}" title="${e(t.title)}">${t.milestone ? "◆ " : ""}${t.startTime && t.start === t.end ? t.startTime + " " : ""}${e(t.title)}</button>`).join("") + (st.late ? `<span class="hx-lateflag" style="grid-row:${ts.length + 1}">◂ ${st.late} en retard avant cette période</span>` : "");
      html += lane(e(p.name), `${st.open} ouvertes${st.late ? ` · <em>${st.late} en retard</em>` : ""}`, p.color, cells, `data-nav="projets" data-project="${p.id}"`);
    });
    const corps = days.map((d, i) => { const k = 13 - K.days(d, TODAY); const past = d <= TODAY; const ses = D.sport.sessions.concat(D.sport.planned).filter((s) => s.date === d); return `<span class="hx-dc" style="grid-column:${i + 1}">${past ? `<span class="hx-dcl">${pixel(d, 6, 1.5)}<small>${count(d).done}/${count(d).total}</small></span><small>${String(D.health.sleep[k]).replace(".", ",")} h · ${D.health.recovery[k]} %</small>` : ""}${ses.map((s) => `<em class="${s.date >= TODAY && !s.hr ? "is-plan" : ""}">${e(s.sport)} ${K.hm(s.minutes)}</em>`).join("")}</span>`; }).join("");
    html += lane("Corps", "habitudes · sommeil · sport", "#0f9d76", corps, 'data-nav="corps"');
    const argent = days.map((d, i) => { const sp = D.budget.transactions.filter((x) => x.date === d && x.amount < 0).reduce((a, x) => a + x.amount, 0); return `<span class="hx-dc" style="grid-column:${i + 1}">${d <= TODAY ? (sp ? `<b class="hx-spend">${K.euro(sp)}</b>` : `<small>—</small>`) : `<small class="hx-dim">${K.euro(K.budgetPace().perDay)} possibles</small>`}</span>`; }).join("");
    html += lane("Argent", "dépenses du jour", "#6d28d9", argent, 'data-nav="argent"');
    return `<main class="hx-main" data-scroll><div class="hx-hello hx-row"><div><h1>Planning <span>du samedi 3 au dimanche 11 octobre</span></h1><p>Une portée par projet, puis Corps et Argent. Cliquer une portée l'ouvre ; cliquer une barre ouvre la tâche.</p></div><div class="hx-seg"><button type="button" disabled>Jour</button><button type="button" aria-pressed="true">Semaine</button><button type="button" disabled>Mois</button></div></div>
      <div class="hx-tile hx-partition">${head}${html}</div><p class="hx-hint">Glisser une barre d'une colonne à l'autre change son échéance ; d'une portée à l'autre, son projet. Gantt, Calendrier et Tableur restent dans « Afficher en… ».</p></main>`;
  }

  // ------------------------------------------------------- partition : projets
  function projets() {
    const p = proj(S.projectId), st = K.projectStats(p.id), f = D.folders.find((x) => x.id === p.folderId);
    const start = K.addDays(TODAY, -21), N = 42, weeks = Array.from({ length: 6 }, (_, i) => K.addDays(start, i * 7));
    const x = (iso) => ((Math.max(0, Math.min(N, K.days(start, iso))) / N) * 100).toFixed(2) + "%";
    const ts = K.byProject(p.id).filter((t) => t.statusId !== "s6").sort((a, b) => (K.isDone(a) - K.isDone(b)) || a.end.localeCompare(b.end));
    return `<main class="hx-main hx-projets" data-scroll><nav class="hx-plist" aria-label="Projets">${D.folders.map((fo) => `<h3>${e(fo.name)}</h3>${D.projects.filter((q) => q.folderId === fo.id).map((q) => { const s = K.projectStats(q.id); return `<button type="button" data-nav="projets" data-project="${q.id}" aria-current="${q.id === p.id}"><i style="background:${q.color}"></i><span>${e(q.name)}</span><small>${s.open}${s.late ? ` · <em>${s.late}</em>` : ""}</small></button>`; }).join("")}`).join("")}</nav>
      <div class="hx-pmain"><div class="hx-hello hx-row"><div><p class="hx-crumb">${e(f.name)} › ${e(p.name)}</p><h1 style="--c:${p.color}" class="hx-ptitle">${e(p.name)}</h1></div>
        <div class="hx-kpis is-inline"><div><small>Avancement</small><b>${st.progress} %</b></div><div><small>Ouvertes</small><b>${st.open}</b></div><div><small>En retard</small><b class="${st.late ? "hx-red" : ""}">${st.late}</b></div>${p.budget ? `<div><small>Budget</small><b>${Math.round(p.spent / p.budget * 100)} %</b></div>` : ""}<div><small>Prochain jalon</small><b>${e(p.next || "—")}</b></div></div>
        <button type="button" class="hx-btn is-primary" data-new>+ Tâche</button></div>
      <div class="hx-tile hx-gantt"><div class="hx-grow hx-ghead"><span>Tâche</span><span>Resp.</span><span>Échéance</span><div>${weeks.map((w) => `<b style="left:${x(w)}">${K.dateShort(w)}</b>`).join("")}<i class="hx-gtoday" style="left:${x(TODAY)}"></i></div></div>
        ${ts.map((t) => `<div class="hx-grow ${S.taskId === t.id ? "is-sel" : ""} ${K.isDone(t) ? "is-done" : ""}"><span class="hx-gname">${chk(t)}<button type="button" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button></span><span class="hx-dim">${K.initials(t.assignee)}</span>${due(t)}<div class="hx-gtrack">${t.milestone ? `<i class="hx-gms" style="left:${x(t.end)};background:${p.color}"></i>` : `<button type="button" class="hx-gbar" data-task="${t.id}" style="left:${x(t.start)};width:calc(${x(K.addDays(t.end, 1))} - ${x(t.start)});--c:${p.color}" aria-label="${e(t.title)}"></button>`}${K.isLate(t) ? `<span class="hx-gover" style="left:${x(K.addDays(t.end, 1))};width:calc(${x(TODAY)} - ${x(K.addDays(t.end, 1))})"></span>` : ""}<i class="hx-gtoday" style="left:${x(TODAY)}"></i></div></div>`).join("")}</div>
      <p class="hx-hint">Hachures : retard accumulé depuis l'échéance. Autres lectures : liste, tableau, tableur, heat map. Budget, documents, équipe et journal du projet sont sous « Fiche projet ».</p></div></main>`;
  }

  // --------------------------------------------------------- partition : corps
  function corps() {
    const H = D.health, N = 14, days = Array.from({ length: N }, (_, i) => K.addDays(TODAY, i - N + 1));
    const head = `<div class="hx-crow hx-chead"><span></span>${days.map((d) => `<b class="${d === TODAY ? "is-today" : ""}">${K.dayShort(d).slice(0, 2)}<strong>${Number(d.slice(8))}</strong></b>`).join("")}<span>14 j</span></div>`;
    const row = (label, sub, color, cells, tail, cls = "") => `<div class="hx-crow ${cls}" style="--c:${color}"><span class="hx-clh"><b>${label}</b><small>${sub}</small></span>${cells}<span class="hx-ctail">${tail}</span></div>`;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    let html = head;
    const LANES = {
      sleep: () => row("Sommeil", "heures", "#5b7bd8", H.sleep.map((v) => `<span class="hx-cbar"><i style="height:${v / 9 * 100}%"></i><small>${String(v).replace(".", ",")}</small></span>`).join(""), `moy. ${avg(H.sleep).toFixed(1).replace(".", ",")} h`),
      recovery: () => row("Récupération", "%", "#0f9d76", H.recovery.map((v) => `<span class="hx-cdot" style="--k:${v >= 67 ? "#0f9d76" : v >= 34 ? "#d99a2b" : "#dc2626"}">${v}</span>`).join(""), `moy. ${Math.round(avg(H.recovery))} %`),
      hrv: () => row("HRV", "ms", "#0f9d76", H.hrv.map((v) => `<span class="hx-cnum"><b>${v}</b></span>`).join(""), K.spark(H.hrv, { w: 60, h: 18, color: "#0f9d76", fill: false })),
      restingHr: () => row("FC repos", "bpm", "#d64545", H.restingHr.map((v) => `<span class="hx-cnum"><b>${v}</b></span>`).join(""), K.spark(H.restingHr, { w: 60, h: 18, color: "#d64545", fill: false })),
      sport: () => row("Sport", `${K.hm(K.sportWeek().done)} / ${D.sport.goalHours} h`, "#0e7490", days.map((d) => { const s = D.sport.sessions.concat(D.sport.planned).filter((x) => x.date === d); return `<span class="hx-csport">${s.map((x) => `<i class="${d >= TODAY && !x.hr ? "is-plan" : ""}" style="height:${Math.min(100, x.minutes)}%" title="${e(x.sport + " · " + x.title)}"></i><small>${e(x.sport.slice(0, 4))}</small>`).join("")}</span>`; }).join(""), `sem. dern. ${K.hm(K.sportWeek().last)}`),
      steps: () => row("Pas", "milliers", "#7c5cd6", H.steps.map((v) => `<span class="hx-cbar is-steps"><i style="height:${v / 16000 * 100}%"></i><small>${(v / 1000).toFixed(1).replace(".", ",")}</small></span>`).join(""), `moy. ${(avg(H.steps) / 1000).toFixed(1).replace(".", ",")}`),
      weight: () => row("Poids", "kg", "#475569", `<span class="hx-cspark">${K.spark(H.weight, { w: 700, h: 34, color: "#475569" })}</span>`, `${String(K.last(H.weight)).replace(".", ",")} kg`, "is-spark"),
    };
    html += [...S.metrics.page].filter((k) => LANES[k]).map((k) => LANES[k]()).join("");
    html += `<div class="hx-crow hx-csep"><span class="hx-clh"><b>Habitudes</b><small>une case = une habitude un jour · cliquer pour cocher</small></span>${days.map((d) => `<span class="hx-cday" title="${count(d).done}/${count(d).total}">${pixel(d, 5, 1)}</span>`).join("")}<span class="hx-ctail">pixel du jour</span></div>`;
    THEMES.forEach((t) => {
      html += `<div class="hx-crow hx-ctheme" style="--c:${t.color}"><span class="hx-clh"><b>${e(t.name)}</b><small>${t.mode === "single" ? "un seul choix" : "plusieurs possibles"}</small></span>${days.map((d) => { const c = count(d, t); return `<span class="hx-cth">${c.done}/${c.total}</span>`; }).join("")}<span class="hx-ctail"></span></div>`;
      t.habits.forEach((h) => {
        let ok = 0, tot = 0;
        const cells = days.map((d) => { const st = hstate(h, d); if (st.state !== "na") { tot++; if (st.state !== "todo") ok++; } return `<button type="button" class="hx-hc is-${st.state}" data-hab="${h.id}|${d}|toggle" data-hp="${h.id}" style="--f:${st.state === "part" ? st.value / h.max : 1}" title="${e(h.name)} · ${K.dateShort(d)}${st.value != null && h.kind === "numeric" ? " · " + st.value + "/" + h.max : ""}" aria-label="${e(h.name)} le ${K.dateShort(d)}">${h.kind === "numeric" && st.value ? `<small>${st.value}</small>` : ""}</button>`; }).join("");
        html += `<div class="hx-crow hx-chab ${S.hot === h.id ? "is-hot" : ""}" style="--c:${t.color}"><span class="hx-clh is-sub">${e(h.name)}</span>${cells}<span class="hx-ctail">${tot ? Math.round(ok / tot * 100) : 0} %</span></div>`;
      });
    });
    return `<main class="hx-main" data-scroll><div class="hx-hello"><h1>Corps <span>14 derniers jours</span></h1><p>Récupération ${K.last(H.recovery)} % ce matin, au-dessus de la moyenne. ${count(TODAY).done} habitudes sur ${count(TODAY).total} aujourd'hui. Les cases hachurées sont « non applicables » et sortent du total.</p></div><div class="hx-corpsbar">${chooserBtn("page")}</div><div class="hx-tile hx-corps">${html}</div></main>`;
  }

  // -------------------------------------------------------- partition : argent
  function argent() {
    const b = D.budget, bp = K.budgetPace(), N = b.daysInMonth, days = Array.from({ length: N }, (_, i) => "2026-10-" + String(i + 1).padStart(2, "0"));
    const todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
    const spendOn = (cat, d) => b.transactions.filter((x) => x.date === d && x.amount < 0 && (x.cat === cat || (x.cat == null && Object.entries(S.categorized).some(([id, c]) => c === cat && (b.toCategorize.find((y) => y.id === id) || {}).label === x.label)))).reduce((a, x) => a - x.amount, 0);
    return `<main class="hx-main" data-scroll><div class="hx-hello"><h1>Argent <span>${b.month}</span></h1><p>Une portée par catégorie, une colonne par jour ; la taille d'un point suit le montant. Le trait vertical marque aujourd'hui.</p></div>
      <div class="hx-msum"><div class="hx-tile"><small>Reste à dépenser</small><b>${K.euro(bp.left)}</b><span class="hx-dim">${K.euro(bp.perDay)} par jour jusqu'au 31</span></div><div class="hx-tile"><small>Rythme du mois</small><span class="hx-pace is-lg"><i style="width:${Math.round(b.spent / b.total * 100)}%"></i><b style="left:${Math.round(b.dayOfMonth / N * 100)}%"></b></span><span class="hx-dim">${K.euro(b.spent)} sur ${K.euro(b.total)} · attendu ${K.euro(bp.expected)}</span></div><div class="hx-tile"><small>Patrimoine</small><b>${K.euro(D.wealth.total)}</b>${K.spark(D.wealth.series, { w: 150, h: 26, color: "#0f766e" })}</div><div class="hx-tile"><small>Pro</small><b>${K.euro(D.pro.unpaid)}</b><span class="hx-dim">à encaisser · ${D.pro.invoices} factures · ${D.pro.quotes} devis</span></div></div>
      ${todo.length ? `<div class="hx-classer"><b>À classer</b>${todo.map((x) => `<span>${e(x.label)} · ${K.dateShort(x.date)} · <span class="hx-num">${K.euro(x.amount, true)}</span> <button type="button" class="hx-btn is-sm" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></span>`).join("")}</div>` : ""}
      <div class="hx-tile hx-money"><div class="hx-mrow hx-mhead" style="--n:${N}"><span>Catégorie</span><div>${days.map((d, i) => `<b class="${d === TODAY ? "is-today" : ""}">${i + 1}</b>`).join("")}</div><span>Mois</span></div>
        ${b.categories.map((c) => { const pct = Math.round(c.spent / c.limit * 100); return `<div class="hx-mrow ${pct > 100 ? "is-over" : ""}" style="--n:${N};--c:${c.color}"><span class="hx-mlh"><b>${e(c.name)}</b><small>${pct} % du budget</small></span><div>${days.map((d, i) => { const v = i + 1 <= b.dayOfMonth ? spendOn(c.name, d) : 0; return `<span class="${i + 1 > b.dayOfMonth ? "is-future" : ""} ${d === TODAY ? "is-today" : ""}">${v ? `<i style="--s:${Math.min(1, v / 60)}" title="${K.euro(v, true)}"></i>` : ""}</span>`; }).join("")}</div><span class="hx-mtot"><b>${K.euro(c.spent)}</b><small>/ ${K.euro(c.limit)}</small><em><i style="width:${Math.min(100, pct)}%"></i></em></span></div>`; }).join("")}
      </div></main>`;
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
  }
  function go(screen, extra = {}) { S.screen = screen; S.toast = ""; S.composer = false; if (extra.project) S.projectId = extra.project; S.taskId = extra.task || (screen === "projets" && !extra.project ? S.taskId : null); render(); }

  document.addEventListener("click", (ev) => {
    if (ev.target.closest(".hx-pop") && !ev.target.closest("[data-pop]")) return;
    const el = ev.target.closest("[data-nav],[data-task],[data-close],[data-done],[data-new],[data-hab],[data-cat],[data-append],[data-reset],[data-demo],[data-pop]");
    if (!el) return;
    const d = el.dataset;
    if (d.reset !== undefined) { reset(); render(); return; }
    if (d.pop !== undefined) { S.pop = S.pop === d.pop ? "" : d.pop; render(); return; }
    if (d.demo) { if (d.demo === "projet") { S.screen = "projets"; S.projectId = "p-ctex6"; S.taskId = "t2"; S.composer = false; } else if (d.demo === "nouvelle") { S.composer = true; S.taskId = null; } render(); return; }
    if (d.done) { ev.stopPropagation(); const t = K.task(d.done); if (t) { t.statusId = K.isDone(t) ? "s3" : "s5"; S.toast = K.isDone(t) ? `« ${t.title} » terminée · Annuler` : `« ${t.title} » rouverte`; } render(); return; }
    if (d.hab) { const [h, day, op] = d.hab.split("|"); habitAct(h, day, op); render(); return; }
    if (d.cat) { const [id, c] = d.cat.split(":"); S.categorized[id] = c; S.toast = `Opération classée dans « ${c} » (démo)`; render(); return; }
    if (d.append) { S.draft = (S.draft.trim() + " " + d.append).trim(); render(); return; }
    if (d.new !== undefined) { S.composer = true; S.taskId = null; render(); return; }
    if (d.close !== undefined) { S.composer = false; S.taskId = null; render(); return; }
    if (d.nav) { go(d.nav, { project: d.project }); return; }
    if (d.task) { S.taskId = d.task; S.composer = false; render(); }
  });
  // Survol : relie une habitude à son segment d'anneau, à sa case du pixel et à sa ligne.
  document.addEventListener("mouseover", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-hp]");
    const id = el ? el.dataset.hp : null;
    if (id === S.hot) return;
    S.hot = id;
    document.querySelectorAll("#hx-app .is-hot").forEach((x) => x.classList.remove("is-hot"));
    if (id) document.querySelectorAll(`#hx-app [data-hp="${id}"]`).forEach((x) => { x.classList.add("is-hot"); const r = x.closest(".hx-hrow,.hx-chab"); if (r) r.classList.add("is-hot"); });
    document.getElementById("hx-app").classList.toggle("has-hot", !!id);
  });
  document.addEventListener("change", (ev) => { const m = ev.target.dataset && ev.target.dataset.metric; if (!m) return; const [scope, k] = m.split("|"); const set = S.metrics[scope]; if (set.has(k)) set.delete(k); else set.add(k); render(); });
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
