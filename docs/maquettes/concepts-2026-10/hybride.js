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
  // Couleur propre à chaque habitude (habit.color dans Nexora), réglable ; à défaut, celle du thème.
  const themeOf = (h) => h.theme || THEMES.find((t) => t.habits.some((x) => x.id === h.id));
  const hc = (h) => (S && S.hcolors && S.hcolors[h.id]) || themeOf(h).color;
  const HLABEL = { done: "faite", part: "en partie", todo: "à faire", na: "non applicable" };
  const htip = (h, d) => { const st = hstate(h, d); return `${h.name}|${themeOf(h).name} · ${HLABEL[st.state]}${h.kind === "numeric" ? ` · ${st.value || 0} / ${h.max} ${h.unit || ""}` : ""}|${K.dateShort(d)}`; };
  const SQ = Math.max(THEMES.length, ...THEMES.map((t) => t.habits.length));
  function pixel(d, size = 8, gap = 2, opts = {}) {
    const w = SQ * size + (SQ - 1) * gap;
    let s = `<svg class="hx-px" viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">`;
    for (let r = 0; r < SQ; r++) for (let c = 0; c < SQ; c++) {
      const t = THEMES[r], h = t && t.habits[c], x = c * (size + gap), y = r * (size + gap);
      if (!h) { s += `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="none" stroke="#e6eaf0" stroke-width="1" stroke-dasharray="2 2"/>`; continue; }
      const st = hstate(h, d), hot = opts.hot === h.id ? " is-hot" : "", col = hc({ ...h, theme: t }), tip = `data-tip="${e(htip({ ...h, theme: t }, d))}"`;
      if (st.state === "done") s += `<rect class="hx-pc${hot}" data-hp="${h.id}" ${tip} x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="${col}"/>`;
      else if (st.state === "part") { const f = st.value / h.max; s += `<rect class="hx-pc${hot}" data-hp="${h.id}" ${tip} x="${x}" y="${y}" width="${size}" height="${size}" rx="${size / 5}" fill="${col}" opacity=".18"/><rect x="${x}" y="${(y + size * (1 - f)).toFixed(1)}" width="${size}" height="${(size * f).toFixed(1)}" fill="${col}" pointer-events="none"/>`; }
      else if (st.state === "na") s += `<rect class="hx-pc${hot}" data-hp="${h.id}" ${tip} x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="url(#hx-na)" stroke="#cbd3de"/>`;
      else s += `<rect class="hx-pc${hot}" data-hp="${h.id}" ${tip} x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="#fff" stroke="${col}" stroke-opacity=".45"/>`;
    }
    return s + "</svg>";
  }

  // ---------------------------------------------------------------- état
  let S;
  function reset() {
    K.reset(); S = K.state;
    Object.assign(S, { screen: "accueil", projectId: "p-ctex6", taskId: null, composer: false, toast: "", hot: null, draft: "Relancer BC vendredi 14h #CTEX6 @Vincent !urgent", pop: "", filter: F0(), fpop: "", fview: "tout", pz: "mois", po: 0, pgroup: "projet", show: { corps: true, argent: true }, collapsed: new Set(), jz: "trimestre", jo: 0, cmp: "ref", cper: 30, closed: new Set(), atab: "mois", amonth: "oct", aq: "", acat: "", focus: "", hcolors: {}, settings: false, stab: "habitudes", homePx: true, wN: 24, saved: loadViews(), vname: null, vsel: {}, jgroup: "aucun", jcol: new Set(), of: OF0(), ofpop: "", gstyle: "ruban", cagg: "jour", sagg: "semaine", undo: null, metrics: { tile: new Set(["recovery", "sleep", "hrv", "sport"]), page: new Set(["sleep", "recovery", "hrv", "restingHr", "sport", "steps", "weight", "bodyFat", "respRate", "spo2"]) } });
    const pt = K.task("t7"); if (pt) pt.statusId = "s5"; // point hebdo de 8:30 déjà fait
    extendTasks();
    seedHabits();
    // Budget cohérent dans toutes les vues : Logement ajouté, total = somme des enveloppes.
    if (!D.budget.categories.some((c) => c.name === "Logement")) D.budget.categories.unshift({ name: "Logement", spent: 0, limit: 950, color: "#475569" });
    D.budget.total = D.budget.categories.reduce((a, c) => a + c.limit, 0);
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
      <button type="button" class="hx-btn is-primary" data-new>+ Nouvelle tâche</button><button type="button" class="hx-gear" data-settings aria-label="Réglages" title="Réglages">⚙</button></header>`;
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
    K.tasks().filter((t) => t.startTime && t.start <= d && t.end >= d).forEach((t) => it.push({ h0: hh(t.startTime), h1: t.endTime ? hh(t.endTime) : hh(t.startTime) + .5, label: t.title, id: t.id, color: proj(t.projectId).color, kind: K.type(t.typeId).name === "Réunion" ? "Réunion" : "Tâche", done: K.isDone(t), sub: `${proj(t.projectId).name} · ${K.status(t.statusId).name}${t.assignee ? " · " + t.assignee : ""}` }));
    D.sport.planned.filter((s) => s.date === d).forEach((s) => it.push({ h0: hh(s.time), h1: hh(s.time) + s.minutes / 60, label: s.title, color: "#0e7490", kind: "Sport", sub: `${s.sport} · séance prévue · ${K.hm(s.minutes)}` }));
    return it.sort((a, b) => a.h0 - b.h0);
  }
  const hmf = (h) => String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
  function cadran(d, size = 440, mini = false) {
    const c = size / 2, R1 = size * .4, W1 = size * .042, R2 = size * .325, W2 = size * .03;
    let s = `<svg class="hx-dial" viewBox="0 0 ${size} ${size}" role="img" aria-label="Cadran de la journée et anneau des habitudes"><defs><pattern id="hx-na" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#f6f7f9"/><line x1="0" y1="0" x2="0" y2="4" stroke="#cbd3de" stroke-width="1.4"/></pattern></defs>`;
    s += `<circle cx="${c}" cy="${c}" r="${R1}" fill="none" stroke="#eef1f6" stroke-width="${W1}"/>`;
    s += `<path d="${arcDeg(c, c, R1, h2a(23.2), h2a(6.7))}" stroke="#d6def3" stroke-width="${W1}" fill="none" data-tip="Sommeil · 23:10 → 06:40|${String(K.last(D.health.sleep)).replace(".", ",")} h · récupération ${K.last(D.health.recovery)} %|Heures de coucher et de lever à importer de Whoop"/>`;
    for (let h = 0; h < 24; h++) {
      const a = h2a(h), [x0, y0] = P(c, c, R1 + W1 / 2 + 3, a), [x1, y1] = P(c, c, R1 + W1 / 2 + (h % 6 ? 6 : 10), a);
      s += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#b9c4d2" stroke-width="${h % 6 ? 1 : 1.5}"/>`;
      if (!mini && h % 3 === 0) { const [tx, ty] = P(c, c, R1 + W1 / 2 + 21, a); s += `<text x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="middle" class="hx-hr">${String(h).padStart(2, "0")}</text>`; }
    }
    dayItems(d).forEach((it) => { s += `<path d="${arcDeg(c, c, R1, h2a(it.h0), h2a(Math.max(it.h1, it.h0 + .3)))}" stroke="${it.color}" stroke-width="${W1}" fill="none" opacity="${it.done ? .35 : 1}" data-tip="${e(`${hmf(it.h0)}–${hmf(it.h1)} · ${it.label}|${it.kind}${it.sub ? " · " + it.sub : ""}${it.done ? "|Terminée" : ""}`)}" ${it.id ? `data-task="${it.id}" class="hx-arc"` : ""}/>`; });
    // Anneau des habitudes : un segment par habitude, regroupées par thème.
    const gapT = 5, gapH = 1.6, n = ALL.length, span = (360 - THEMES.length * gapT - (n - THEMES.length) * gapH) / n;
    let a = -90 + gapT / 2;
    THEMES.forEach((t) => {
      t.habits.forEach((h, i) => {
        const a0 = a, a1 = a + span, st = hstate(h, d), hot = S.hot === h.id ? " is-hot" : "", col = hc({ ...h, theme: t });
        s += `<path class="hx-seg${hot}" data-hp="${h.id}" data-tip="${e(htip({ ...h, theme: t }, d))}" d="${arcDeg(c, c, R2, a0, a1)}" stroke="${st.state === "na" ? "url(#hx-na)" : col}" stroke-opacity="${st.state === "na" ? 1 : .16}" stroke-width="${W2}" fill="none"/>`;
        if (st.state === "done") s += `<path class="hx-seg${hot}" data-hp="${h.id}" d="${arcDeg(c, c, R2, a0, a1)}" stroke="${col}" stroke-width="${W2}" fill="none" pointer-events="none"/>`;
        if (st.state === "part") s += `<path d="${arcDeg(c, c, R2, a0, a0 + span * st.value / h.max)}" stroke="${col}" stroke-width="${W2}" fill="none" pointer-events="none"/>`;
        a = a1 + (i < t.habits.length - 1 ? gapH : gapT);
      });
    });
    if (d === TODAY) {
      const ang = h2a(hh(NOW)), [x, y] = P(c, c, R1 + W1 / 2 + 3, ang), [x2, y2] = P(c, c, R2 + W2 / 2 + 6, ang);
      s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#18263d" stroke-width="3.5" stroke-linecap="round" data-tip="${e(`Maintenant · ${NOW}|${(() => { const n = dayItems(d).find((i) => i.h0 >= hh(NOW) && !i.done); return n ? "Ensuite : " + hmf(n.h0) + " " + n.label : "Plus rien d'horodaté"; })()}`)}"/><circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="#18263d"/>`;
    }
    const hcnt = count(d), tc = tcount(d);
    // Accueil sans pixels (réglage) : les deux compteurs seuls, en grand.
    if (mini && !S.homePx) {
      s += `<text x="${(c - size * .13).toFixed(1)}" y="${(c + 4).toFixed(1)}" text-anchor="middle" class="hx-cnum is-big">${tc.done}<tspan class="hx-cden">/${tc.total}</tspan></text><text x="${(c + size * .13).toFixed(1)}" y="${(c + 4).toFixed(1)}" text-anchor="middle" class="hx-cnum is-big">${hcnt.done}<tspan class="hx-cden">/${hcnt.total}</tspan></text>`;
      s += `<text x="${(c - size * .13).toFixed(1)}" y="${(c + 20).toFixed(1)}" text-anchor="middle" class="hx-csub">tâches</text><text x="${(c + size * .13).toFixed(1)}" y="${(c + 20).toFixed(1)}" text-anchor="middle" class="hx-csub">habitudes</text>`;
      return s + "</svg>";
    }
    // Taille des pixels calculée sur la place libre au cœur : elle diminue
    // quand le nombre d'habitudes augmente, sans jamais déborder de l'anneau.
    const pg = mini ? 2 : 3, gapC = mini ? 12 : 22, inner = 2 * (R2 - W2 / 2) * (mini ? .74 : .7);
    const hwMax = (inner - gapC) / 2, ps = Math.min(mini ? 12 : 14, (hwMax - (SQ - 1) * pg) / SQ);
    const hw = SQ * ps + (SQ - 1) * pg, ts = dayTasks(d), tn = Math.max(2, Math.ceil(Math.sqrt(ts.length || 1))), tps = (hw - (tn - 1) * pg) / tn;
    const total = hw * 2 + gapC, x0 = c - total / 2, y0 = c - hw / 2 - (mini ? 6 : 12);
    s += `<g transform="translate(${x0.toFixed(1)} ${y0.toFixed(1)})">${taskSquare(d, tps, pg).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
    s += `<g transform="translate(${(x0 + hw + gapC).toFixed(1)} ${y0.toFixed(1)})">${pixel(d, ps, pg, { hot: S.hot }).replace(/<svg[^>]*>|<\/svg>/g, "")}</g>`;
    s += `<text x="${(x0 + hw / 2).toFixed(1)}" y="${(y0 + hw + (mini ? 14 : 20)).toFixed(1)}" text-anchor="middle" class="hx-cnum">${tc.done}<tspan class="hx-cden">/${tc.total}</tspan></text><text x="${(x0 + hw + gapC + hw / 2).toFixed(1)}" y="${(y0 + hw + (mini ? 14 : 20)).toFixed(1)}" text-anchor="middle" class="hx-cnum">${hcnt.done}<tspan class="hx-cden">/${hcnt.total}</tspan></text>`;
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
    let g = `<g class="hx-tc" data-task="${t.id}" data-tip="${e(`${t.title}|${proj(t.projectId).name} · ${st.label}${late ? ` · ${K.lateDays(t)} j de retard` : ""}|Échéance ${K.dateShort(t.end)}${t.startTime ? " · " + t.startTime : ""}${t.progress ? ` · ${t.progress} %` : ""}`)}"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s / 4}" fill="${st.fill}" stroke="${late ? "#dc2626" : st.stroke}" stroke-width="${late ? 2 : 1.3}"/>`;
    if (done) g += `<path d="M${x + s * .28} ${y + s * .52} l${s * .15} ${s * .15} l${s * .3} -${s * .32}" fill="none" stroke="#fff" stroke-width="${Math.max(1.4, s / 10)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if (t.progress) g += `<rect x="${x + 3}" y="${y + s - 5}" width="${(s - 6) * t.progress / 100}" height="2.5" rx="1" fill="#245edb"/>`;
    return g + "</g>";
  }
  function taskSquare(d, size = 8, gap = 2) {
    const ts = dayTasks(d), n = Math.max(2, Math.ceil(Math.sqrt(ts.length || 1))), w = n * size + (n - 1) * gap;
    let s = `<svg class="hx-px" viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" aria-hidden="true">`;
    for (let i = 0; i < n * n; i++) { const x = (i % n) * (size + gap), y = Math.floor(i / n) * (size + gap), t = ts[i]; s += t ? `<rect data-tip="${e(`${t.title}|${proj(t.projectId).name} · ${tst(t).label}${K.isLate(t) ? " · en retard" : ""}`)}" x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="${tst(t).fill}" stroke="${K.isLate(t) ? "#dc2626" : tst(t).stroke}"/>` : `<rect x="${x + .5}" y="${y + .5}" width="${size - 1}" height="${size - 1}" rx="${size / 5}" fill="none" stroke="#e6eaf0" stroke-dasharray="2 2"/>`; }
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
    const h = ALL.find((x) => x.id === h0.id) || h0, st = hstate(h, d), c = hc(h), hot = S.hot === h.id ? " is-hot" : "";
    let g = `<g class="hx-pc${hot}" data-hp="${h.id}" data-hab="${h.id}|${d}|toggle" data-tip="${e(htip(h, d))}">`;
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
      ${THEMES.map((t) => { const c = count(d, t); return wired(`<i style="background:${t.color}"></i><b>${e(t.name)}</b><span>${c.done} / ${c.total}</span><small>${t.mode === "single" ? "un seul choix" : ""}</small>`, t.habits.map((h) => { const st = hstate(h, d); return `<div class="hx-wr hx-hrow is-${st.state} ${S.hot === h.id ? "is-hot" : ""}" data-hp="${h.id}" style="--t:${hc({ ...h, theme: t })}"><span class="hx-hname"><i class="hx-hdot" style="background:${hc({ ...h, theme: t })}"></i>${e(h.name)}${h.unit ? ` <small>${h.unit}</small>` : ""}</span>${h.kind === "numeric" ? `<span class="hx-step"><button type="button" data-hab="${h.id}|${d}|minus" aria-label="Moins">−</button><b>${st.value || 0}/${h.max}</b><button type="button" data-hab="${h.id}|${d}|plus" aria-label="Plus">+</button></span>` : `<button type="button" class="hx-box ${st.state === "done" ? "is-on" : ""}" data-hab="${h.id}|${d}|toggle" aria-pressed="${st.state === "done"}" aria-label="${e(h.name)}">${st.state === "done" ? "✓" : ""}</button>`}<button type="button" class="hx-na ${st.state === "na" ? "is-on" : ""}" data-hab="${h.id}|${d}|na" aria-pressed="${st.state === "na"}" title="Non applicable aujourd'hui">n/a</button></div>`; }), t.habits.map((h) => ({ wire: hc({ ...h, theme: t }), hp: h.id, draw: (x, y, s) => habitCell(h, d, x, y, s) })), t.color); }).join("")}
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
  const DEMO_METRICS = new Set(["sleep", "recovery", "hrv", "restingHr", "weight", "bodyFat", "respRate", "spo2", "steps", "sport"]);
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
  // Vues enregistrées : filtres + réglages de l'écran (zoom, regroupement,
  // représentation…). Conservées dans ce navigateur seulement (démo).
  const VKEY = "nexora-hybride:vues";
  const VOPTS = { planning: ["pz", "pgroup", "gstyle", "show"], projets: ["jz", "jgroup", "cmp", "gstyle"] };
  const fOut = (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v instanceof Set ? [...v] : v]));
  const fIn = (o) => { const f = F0(); Object.keys(f).forEach((k) => { if (o[k] === undefined) return; f[k] = f[k] instanceof Set ? new Set(o[k]) : o[k]; }); return f; };
  const VSEED = [
    { id: "v1", scope: "planning", name: "Chantiers · trimestre par responsable", filter: { projects: ["p-ctex6", "p-lot2b"] }, opts: { pz: "trimestre", pgroup: "responsable", gstyle: "ecart" } },
    { id: "v2", scope: "planning", name: "Mes retards du mois", filter: { people: ["Quentin Morel"], late: true }, opts: { pz: "mois", pgroup: "projet", gstyle: "compte" } },
    { id: "v3", scope: "projets", name: "Glissements sur l'année", filter: {}, opts: { jz: "annee", jgroup: "statut", cmp: "initial", gstyle: "glisse" } },
  ];
  function loadViews() { try { const v = JSON.parse(localStorage.getItem(VKEY) || "null"); if (Array.isArray(v)) return v; } catch (_) { /* stockage indisponible */ } return JSON.parse(JSON.stringify(VSEED)); }
  function storeViews() { try { localStorage.setItem(VKEY, JSON.stringify(S.saved)); } catch (_) { /* stockage indisponible */ } }
  function applyView(scope, val) {
    S.vsel[scope] = val; S.fpop = "";
    if (val.startsWith("p:")) { const v = VIEWS.find((x) => x[0] === val.slice(2)); if (v) { S.filter = v[2](); S.fview = v[0]; } return; }
    const v = S.saved.find((x) => x.id === val.slice(2)); if (!v) return;
    S.filter = fIn(v.filter || {}); S.fview = "";
    Object.entries(v.opts || {}).forEach(([k, x]) => { S[k] = k === "show" ? { ...x } : x; });
    if (scope === "planning") S.po = 0; else S.jo = 0;
  }
  function saveView(scope, name) {
    const opts = {}; VOPTS[scope].forEach((k) => { opts[k] = k === "show" ? { ...S.show } : S[k]; });
    const v = { id: "u" + Date.now().toString(36), scope, name: name || "Vue sans nom", filter: fOut(S.filter), opts };
    S.saved.push(v); storeViews(); S.vsel[scope] = "u:" + v.id; S.vname = null;
    S.toast = `Vue « ${v.name} » enregistrée`;
  }
  function viewPicker(scope) {
    const mine = S.saved.filter((v) => v.scope === scope), cur = S.vsel[scope] || (S.fview ? "p:" + S.fview : "");
    const sel = `<select data-vsel="${scope}" aria-label="Vue enregistrée"><option value="" ${cur ? "" : "selected"}>— vue en cours (non enregistrée)</option><optgroup label="Prédéfinies">${VIEWS.map(([id, l]) => `<option value="p:${id}" ${cur === "p:" + id ? "selected" : ""}>${l}</option>`).join("")}</optgroup>${mine.length ? `<optgroup label="Mes vues">${mine.map((v) => `<option value="u:${v.id}" ${cur === "u:" + v.id ? "selected" : ""}>${e(v.name)}</option>`).join("")}</optgroup>` : ""}</select>`;
    const naming = S.vname !== null && S.vscope === scope;
    return `<span class="hx-fviews"><span>Vue</span>${sel}${naming ? `<input id="hx-vname" data-vname value="${e(S.vname)}" placeholder="Nom de la vue" aria-label="Nom de la vue" autocomplete="off"><button type="button" class="hx-btn is-sm is-primary" data-vok="${scope}">Enregistrer</button><button type="button" class="hx-more" data-vcancel>Annuler</button>` : `<button type="button" class="hx-more" data-vsave="${scope}">+ Enregistrer la vue</button>${cur.startsWith("u:") ? `<button type="button" class="hx-more is-plain" data-vdel="${scope}|${cur.slice(2)}">Supprimer</button>` : ""}`}</span>`;
  }
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
      ${opts.views === false ? "" : viewPicker(scope)}
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
  // Représentations de Gantt, au choix. Les cinq dernières sont les nouvelles
  // variantes de la v4 (Métro retiré).
  const GSTYLES = [
    ["ruban", "Ruban", "Bande pâle, avancement plein, titre dedans."],
    ["pixels", "Pixels", "Une case par jour (semaine ou mois sur les zooms larges) ; foncée = écoulée."],
    ["fil", "Fil", "Trait épais du début à la fin, titre à la suite."],
    ["comete", "Comète", "Point à l'échéance, traînée depuis le début."],
    ["biseau", "Biseau", "La barre s'affine jusqu'à l'échéance ; la partie foncée est le temps écoulé."],
    ["ecart", "Écart", "Deux traits : en haut le temps écoulé, en bas l'avancement. Le rouge entre les deux est le retard pris."],
    ["pont", "Pont", "Une arche du début à la fin ; la partie pleine est l'avancement."],
    ["glisse", "Glissement", "Contour pointillé : dates de la référence ; trait plein : dates actuelles ; écart en jours à la suite."],
    ["compte", "Compte à rebours", "Seul le temps restant est plein ; le passé est un pointillé ; « J−n » avant l'échéance."],
  ];
  const gstyleSeg = (sm) => `<div class="hx-gsel"><span>Représentation</span><div class="hx-seg ${sm ? "is-xs" : "is-sm"}">${GSTYLES.map(([id, l, d]) => `<button type="button" data-gstyle="${id}" aria-pressed="${S.gstyle === id}" title="${e(d)}">${l}</button>`).join("")}</div></div>`;
  const gstyleDesc = () => { const g = GSTYLES.find((x) => x[0] === S.gstyle) || GSTYLES[0]; return `<b>${g[1]}</b> : ${g[2]}`; };
  // Position d'une date dans la barre (en % de sa largeur), bornée à 0–100.
  const inBar = (r, iso, a, b) => Math.max(0, Math.min(100, ((tx(r, iso) - a) / Math.max(.01, b - a)) * 100));
  const countdown = (t) => { if (K.isDone(t)) return "✓"; if (K.isLate(t)) return `+${K.lateDays(t)} j`; const n = K.days(TODAY, t.end); return t.start > TODAY ? `dans ${K.days(TODAY, t.start)} j` : n === 0 ? "J" : `J−${n}`; };
  const driftOf = (t) => (t.ref ? K.days(t.ref.end, t.end) : 0);
  const driftLab = (t) => { const d = driftOf(t); return d ? `<em class="g-dr ${d > 0 ? "is-late" : "is-early"}">${d > 0 ? "+" : "−"}${Math.abs(d)} j</em>` : ""; };
  // Contenu commun aux variantes sans titre intégré (titre éventuel ajouté après).
  function gInner(t, r, a, b, st) {
    const done = K.isDone(t), prog = done ? 100 : t.progress || 0, el = done ? 100 : inBar(r, K.addDays(TODAY, 1), a, b);
    if (st === "fil") return `<span class="g-line"></span>`;
    if (st === "comete") return `<span class="g-tail"></span><i class="g-head"></i>`;
    if (st === "biseau") return `<span class="g-wedge" style="--el:${el.toFixed(1)}%"></span>`;
    if (st === "ecart") { const lag = Math.max(0, el - prog); return `<span class="g-time"><i style="width:${el.toFixed(1)}%"></i></span><span class="g-done"><i style="width:${prog}%"></i>${lag > 0 && !done ? `<b style="left:${prog}%;width:${lag.toFixed(1)}%"></b>` : ""}</span>`; }
    if (st === "pont") return `<span class="g-arc"></span><span class="g-arc is-fill" style="clip-path:inset(0 ${100 - prog}% 0 0)"></span>`;
    if (st === "glisse") { if (!t.ref) return `<span class="g-cur"></span>`; const sc = (v) => (Math.max(0, Math.min(100, v)) - a) / Math.max(.01, b - a) * 100, g0 = sc(tx(r, t.ref.start)), g1 = sc(tx(r, K.addDays(t.ref.end, 1))); if (g1 <= g0) return `<span class="g-cur"></span>`; return `<span class="g-ghost" style="left:${g0.toFixed(1)}%;width:${(g1 - g0).toFixed(1)}%"></span><span class="g-cur"></span>`; }
    if (st === "compte") { const past = t.start > TODAY ? 0 : done ? 100 : inBar(r, TODAY, a, b); return `<span class="g-past" style="width:${past.toFixed(1)}%"></span><span class="g-left" style="left:${past.toFixed(1)}%"></span>`; }
    return "";
  }
  const labW = (t) => t.title.length * 6.3 + 22;
  // Rangement en lignes sans chevauchement, titre compris selon la représentation.
  function pack(ts, r, trackW = 1050) {
    const st = S.gstyle;
    const items = ts.map((t) => { const a = tx(r, t.milestone ? t.end : t.start), b = t.milestone ? a : tx(r, K.addDays(t.end, 1)); return { t, a, b, a2: st === "glisse" && t.ref && !t.milestone ? Math.min(a, tx(r, t.ref.start)) : a }; }).filter((x) => x.b >= 0 && x.a <= 100).sort((x, y) => x.a2 - y.a2);
    const rows = [];
    items.forEach((it) => {
      const a0 = Math.max(0, it.a2), barPx = (Math.min(100, it.b) - a0) / 100 * trackW, lab = labW(it.t);
      const extra = st === "compte" ? 56 : st === "glisse" ? 40 : 0;
      const ext = it.t.milestone ? lab + 14 : st === "ruban" ? (barPx >= lab ? barPx : barPx + lab + 8) : st === "pixels" ? Math.max(barPx, lab) : barPx + lab + 16 + extra;
      const end = a0 + (ext / trackW) * 100;
      let row = rows.findIndex((v) => v <= a0 - 0.3); if (row < 0) { row = rows.length; rows.push(0); } rows[row] = end; it.row = row;
    });
    return { items, rows: Math.max(1, rows.length) };
  }
  const ROWH = 26;
  const gtip = (t) => e(`${t.title}|${proj(t.projectId).name} · ${K.status(t.statusId).name}${t.assignee ? " · " + t.assignee : ""}|${t.milestone ? "Jalon le " + K.dateShort(t.end) : `${K.dateShort(t.start)} → ${K.dateShort(t.end)} · ${K.days(t.start, t.end) + 1} j`}${t.progress ? ` · ${t.progress} %` : ""}${K.isLate(t) ? `|${K.lateDays(t)} jours de retard` : ""}|Glisser pour replanifier · bords pour étirer`);
  // Unité des pixels : le jour jusqu'au trimestre, la semaine sur un an, le mois au-delà.
  const pxUnit = (r) => (r.span <= 98 ? 1 : r.span <= 366 ? 7 : 30.4);
  function pixelsOf(t, r, a, b) {
    const u = pxUnit(r), s0 = t.start < r.start ? r.start : t.start, s1 = t.end > r.end ? r.end : t.end, n = Math.max(1, Math.round((K.days(s0, s1) + 1) / u));
    const el = TODAY < s0 ? 0 : Math.min(n, Math.round((K.days(s0, TODAY < s1 ? TODAY : s1) + 1) / u));
    return Array.from({ length: n }, (_, i) => `<i class="${K.isDone(t) ? "is-done" : i < el ? "is-el" : ""}"></i>`).join("");
  }
  function lineItem(it, r) {
    const t = it.t, p = proj(t.projectId), late = K.isLate(t), done = K.isDone(t), a = Math.max(0, it.a), b = Math.min(100, it.b), st = S.gstyle;
    const cls = `${done ? "is-done" : ""} ${late ? "is-late" : ""} is-${t.statusId} ${it.a < 0 ? "cut-l" : ""} ${it.b > 100 ? "cut-r" : ""} ${S.taskId === t.id ? "is-sel" : ""}`;
    const top = it.row * ROWH, tip = `data-tip="${gtip(t)}"`;
    if (t.milestone) return `<button type="button" class="hx-ms ${cls}" data-task="${t.id}" data-drag="${t.id}" ${tip} style="left:${a}%;top:${top}px;--c:${p.color}"><i></i><span>${e(t.title)} <small>${K.dateShort(t.end)}</small></span></button>`;
    const w = Math.max(.35, b - a), prog = done ? 100 : t.progress || 0;
    let inner;
    if (st === "ruban") inner = `<span class="g-bar"><i class="g-prog" style="width:${prog}%"></i><span class="g-lab">${done ? "✓ " : ""}${e(t.title)}</span></span>`;
    else if (st === "pixels") inner = `<span class="g-lab">${e(t.title)}</span><span class="g-px">${pixelsOf(t, r, a, b)}</span>`;
    else if (st === "compte") inner = gInner(t, r, a, b, st) + `<span class="g-lab"><b class="g-cd ${late ? "is-late" : ""}">${countdown(t)}</b>${e(t.title)}</span>`;
    else inner = gInner(t, r, a, b, st) + `<span class="g-lab">${done ? "✓ " : ""}${e(t.title)} <small>${K.dateShort(t.end)}</small>${st === "glisse" ? driftLab(t) : ""}</span>`;
    let h = `<button type="button" class="hx-g gs-${st} ${cls}" data-task="${t.id}" data-drag="${t.id}" ${tip} style="left:${a}%;width:${w}%;top:${top}px;--c:${p.color}">${inner}</button>`;
    if (late) { const o0 = Math.max(0, tx(r, K.addDays(t.end, 1))), o1 = Math.min(100, tx(r, TODAY)); if (o1 > o0) h += `<span class="hx-over gs-o-${st}" style="left:${o0}%;width:${o1 - o0}%;top:${top}px"></span>`; }
    return h;
  }
  // Barre d'une ligne de projet (une tâche par ligne, titre dans la colonne de gauche).
  function projBar(t, r, a0, a1, color) {
    const st = S.gstyle, done = K.isDone(t), a = Math.max(0, a0), w = Math.max(.35, Math.min(100, a1) - a), prog = done ? 100 : t.progress || 0, tip = `data-tip="${gtip(t)}"`;
    if (t.milestone) return `<i class="hx-pms" data-drag="${t.id}" ${tip} style="left:${a0}%;--c:${color}"></i>`;
    const cls = `is-${t.statusId} ${done ? "is-done" : ""} ${K.isLate(t) ? "is-late" : ""}`;
    const b = Math.min(100, a1), inner = st === "ruban" ? `<span class="g-bar"><i class="g-prog" style="width:${prog}%"></i>${prog && !done ? `<span class="g-lab is-pct">${prog} %</span>` : ""}</span>` : st === "pixels" ? `<span class="g-px">${pixelsOf(t, r)}</span>` : gInner(t, r, a, b, st) + (st === "compte" && a1 > 0 ? `<span class="g-lab"><b class="g-cd ${K.isLate(t) ? "is-late" : ""}">${countdown(t)}</b></span>` : "");
    return `<span class="hx-g gs-${st} is-row ${cls}" data-drag="${t.id}" ${tip} style="left:${a}%;width:${w}%;--c:${color}">${inner}</span>`;
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
  const NDAYS = 400;
  const SERIES = { dates: [], sleep: [], recovery: [], hrv: [], restingHr: [], weight: [], bodyFat: [], respRate: [], spo2: [], steps: [], spend: [] };
  const SESSIONS = [];
  const SPORT_COL = { Course: "#0e7490", Vélo: "#7c5cd6", Natation: "#0284c7", Renforcement: "#d97706" };
  (function genSeries() {
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < NDAYS; i++) {
      const d = K.addDays(TODAY, i - NDAYS + 1), dw = new Date(d + "T12:00:00Z").getUTCDay(), we = dw === 0 || dw === 6;
      const sl = Math.min(8.9, Math.max(5.3, 7.05 + .55 * Math.sin(i / 5) + (rnd() - .5) * 1.3 + (we ? .4 : 0)));
      const rc = Math.round(Math.min(95, Math.max(20, 28 + (sl - 6) * 20 + (rnd() - .5) * 24)));
      SERIES.dates.push(d); SERIES.sleep.push(Math.round(sl * 10) / 10); SERIES.recovery.push(rc);
      SERIES.hrv.push(Math.round(41 + rc * .2 + (rnd() - .5) * 6)); SERIES.restingHr.push(Math.round(58.5 - rc * .08 + (rnd() - .5) * 3));
      SERIES.weight.push(Math.round((79.7 + (NDAYS - 14 - i) * .011 + (rnd() - .5) * .45) * 10) / 10); SERIES.steps.push(Math.round(4800 + rnd() * 8800 + (we ? 2200 : 0)));
      SERIES.spend.push(d > TODAY ? 0 : Math.round((rnd() < .78 ? 8 + rnd() * 55 : 0) + (rnd() < .07 ? 60 + rnd() * 90 : 0)));
      const kinds = ["Course", "Renforcement", "Vélo", "Natation"];
      if (i < NDAYS - 14 && (dw === 2 || dw === 4 || dw === 0) && rnd() < .85) { const k = dw === 0 ? (rnd() < .6 ? "Vélo" : "Course") : kinds[Math.floor(rnd() * 4)]; SESSIONS.push({ date: d, sport: k, title: k === "Vélo" ? "Sortie" : k === "Course" ? "Footing" : k === "Natation" ? "Piscine" : "Gainage", minutes: k === "Vélo" ? 60 + Math.round(rnd() * 60) : 30 + Math.round(rnd() * 25), km: k === "Course" ? Math.round((6 + rnd() * 5) * 10) / 10 : k === "Vélo" ? Math.round(25 + rnd() * 30) : 0 }); }
    }
    const H = D.health, off = NDAYS - 14;
    ["sleep", "recovery", "hrv", "restingHr", "weight", "steps"].forEach((k) => H[k].forEach((v, j) => (SERIES[k][off + j] = v)));
    D.sport.sessions.forEach((x) => SESSIONS.push({ ...x }));
    D.budget.transactions.forEach((x) => { const j = SERIES.dates.indexOf(x.date); if (j >= 0 && x.amount < 0) SERIES.spend[j] = Math.round(-x.amount); });
    SESSIONS.sort((a, b) => a.date.localeCompare(b.date));
    // Masse grasse, fréquence respiratoire et SpO₂ : séries de démo propres.
    let s2 = 19; const r2 = () => ((s2 = (s2 * 16807) % 2147483647) / 2147483647);
    SERIES.dates.forEach((_, i) => {
      SERIES.bodyFat.push(Math.round((18.9 - i * .0045 + (r2() - .5) * .5) * 10) / 10);
      SERIES.respRate.push(Math.round((14.6 - (SERIES.recovery[i] - 55) * .012 + (r2() - .5) * .6) * 10) / 10);
      SERIES.spo2.push(Math.round((96.4 + (r2() - .5) * 1.4) * 10) / 10);
    });
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
      ${D.projects.map((p) => { const pk = pack(ts.filter((t) => t.projectId === p.id), r, 640); if (!pk.items.length) return ""; return `<div class="hx-lane" data-lane-project="${p.id}"><span class="hx-lh is-static" style="--c:${p.color}"><b>${e(p.name)}</b></span><div class="hx-ltrack" data-rs="${r.start}" data-rn="${r.span}" style="height:${pk.rows * ROWH + 6}px">${gridLines(r)}${pk.items.map((it) => lineItem(it, r)).join("")}</div></div>`; }).join("")}
      <div class="hx-lane"><span class="hx-lh is-static" style="--c:#0e7490"><b>Sport</b></span><div class="hx-ltrack" style="height:${ROWH + 4}px">${gridLines(r)}${D.sport.planned.filter((s) => s.date <= J(6)).map((s) => `<span class="hx-dot" style="left:${tx(r, s.date) + 100 / 14}%;--c:${SPORT_COL[s.sport] || "#0e7490"}" title="${e(s.title)}"><i></i>${s.time} ${e(s.sport)}</span>`).join("")}</div></div></div>`;
  }
  function accueil() {
    const today = K.todayTasks(), late = K.late(), bp = K.budgetPace();
    const next = dayItems(TODAY).find((i) => i.h0 >= hh(NOW) && !i.done);
    const todo = D.budget.toCategorize.filter((x) => !S.categorized[x.id]);
    const fmt = (h) => String(Math.floor(h)).padStart(2, "0") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");
    const hcnt = count(TODAY), tc = tcount(TODAY);
    return `<main class="hx-main hx-home" data-scroll>
      <div class="hx-hello is-tight"><h1>Lundi 5 octobre</h1><p>${today.length} tâches aujourd'hui · <span class="hx-red">${late.length} en retard</span> · ${next ? `ensuite <b>${fmt(next.h0)} ${e(next.label)}</b>` : "plus rien d'horodaté"} · habitudes ${hcnt.done}/${hcnt.total}</p></div>
      <div class="hx-grid">
        <section class="hx-tile hx-t-day">${tileHead(`Journée <small>${tc.done}/${tc.total} tâches · habitudes ${hcnt.done}/${hcnt.total}</small>`, "journee")}<div class="hx-dayin"><div class="hx-mini">${cadran(TODAY, 240, true)}</div>
          <div class="hx-daycols"><div><h3 class="hx-h3">Aujourd'hui <small>${today.length}</small></h3><ul class="hx-list">${today.map((t) => trow(t)).join("")}</ul></div><div><h3 class="hx-h3">À rattraper <span class="hx-red">${late.length}</span><button type="button" class="hx-more" data-nav="planning">Planning ›</button></h3><ul class="hx-list">${late.map((t) => trow(t, { noProject: true })).join("")}</ul></div></div></div></section>
        <section class="hx-tile hx-t-body">${tileHead("Corps", "corps", chooserBtn("tile"))}<div class="hx-kpis is-2">${[...S.metrics.tile].slice(0, 4).map((k) => kpi(k)).join("")}</div>
          <div class="hx-hstrip">${Array.from({ length: 7 }, (_, i) => K.addDays(TODAY, i - 6)).map((x) => `<span class="${x === TODAY ? "is-today" : ""}" title="${K.dateShort(x)} · ${count(x).done}/${count(x).total}">${pixel(x, 5, 1)}<small>${K.dayShort(x).slice(0, 2)}</small></span>`).join("")}</div></section>
        <section class="hx-tile hx-t-week">${tileHead("Semaine", "planning", gstyleSeg(true))}${miniWeek()}</section>
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
        <div class="hx-opts"><span>Grouper par</span><div class="hx-seg is-sm">${GROUPS.map(([id, l]) => `<button type="button" data-group="${id}" aria-pressed="${S.pgroup === id}">${l}</button>`).join("")}</div>${gstyleSeg()}<label><input type="checkbox" data-show="corps" ${S.show.corps ? "checked" : ""}> Corps</label><label><input type="checkbox" data-show="argent" ${S.show.argent ? "checked" : ""}> Argent</label></div></div>
      ${filterBar("planning", ts.length)}
      <div class="hx-tile hx-tl">
        <div class="hx-tlhead"><span class="hx-tlcap">${GROUPS.find((g) => g[0] === S.pgroup)[1]}</span><div class="hx-tltrack">${ticks(r).map((k) => `<span class="hx-tick ${k.major ? "is-major" : ""} ${r.zoom === "semaine" && k.iso === TODAY ? "is-today" : ""}" style="left:${tx(r, k.iso)}%">${k.label}</span>`).join("")}</div></div>
        ${lanes.map((l) => { const col = S.collapsed.has(l.id), late = l.tasks.filter(K.isLate).length, pk = pack(l.tasks, r); const sum = col ? (() => { const a = Math.max(0, tx(r, l.tasks.reduce((m, t) => (t.start < m ? t.start : m), "9999"))), b = Math.min(100, tx(r, K.addDays(l.tasks.reduce((m, t) => (t.end > m ? t.end : m), "0000"), 1))); return `<span class="hx-lsum" style="left:${a}%;width:${b - a}%;--c:${l.color}"></span>`; })() : ""; return `<div class="hx-lane ${col ? "is-col" : ""}" ${l.project ? `data-lane-project="${l.project}"` : ""}><button type="button" class="hx-lh" style="--c:${l.color}" data-collapse="${l.id}" aria-expanded="${!col}"><b><span class="hx-chev">${col ? "▸" : "▾"}</span>${e(l.label)}</b><small>${l.tasks.length} tâche${l.tasks.length > 1 ? "s" : ""}${late ? ` · <em>${late} en retard</em>` : ""}${l.project ? ` · <span class="hx-open" data-nav="projets" data-project="${l.project}">ouvrir</span>` : ""}</small></button><div class="hx-ltrack" data-rs="${r.start}" data-rn="${r.span}" style="height:${col ? 22 : pk.rows * ROWH + 6}px">${gridLines(r)}${col ? sum : pk.items.map((it) => lineItem(it, r)).join("")}</div></div>`; }).join("") || `<p class="hx-empty">Aucune tâche ne correspond aux filtres sur cette période.</p>`}
        ${lifeLanes(r)}
      </div>
      <p class="hx-gdesc">${gstyleDesc()}</p>
      <p class="hx-legend2"><span>Couleur = projet ; pâle ou hachuré = à planifier ; ambre = attente tiers ; gris = terminée</span><span><i class="lg-ms"></i>jalon</span><span><i class="lg-over"></i>retard depuis l'échéance</span><span><i class="lg-today"></i>aujourd'hui</span><span>Glisser une ligne la replanifie ; la glisser vers une autre portée change son projet.</span></p>
    </main>`;
  }

  // --------------------------------------------------------------- projets
  const JGROUPS = [["aucun", "Aucun"], ["statut", "Statut"], ["responsable", "Responsable"], ["type", "Type"], ["crit", "Criticité"], ["echeance", "Échéance"], ["jalon", "Tâche / jalon"]];
  const CRIT = [["urgent", "Urgent", "#dc2626"], ["moyen", "Moyen", "#d97706"], ["bas", "Bas", "#16a34a"], ["", "Sans criticité", "#94a3b8"]];
  function projGroups(ts, by) {
    if (by === "statut") return D.statuses.map((x) => ({ id: "s-" + x.id, label: x.name, color: x.color, tasks: ts.filter((t) => t.statusId === x.id) })).filter((g) => g.tasks.length);
    if (by === "responsable") return [...D.members, ""].map((m) => ({ id: "m-" + m, label: m || "Sans responsable", color: "#64748b", tasks: ts.filter((t) => (t.assignee || "") === m) })).filter((g) => g.tasks.length);
    if (by === "type") return D.types.map((x) => ({ id: "t-" + x.id, label: x.name, color: "#64748b", tasks: ts.filter((t) => t.typeId === x.id) })).filter((g) => g.tasks.length);
    if (by === "crit") return CRIT.map(([id, l, c]) => ({ id: "c-" + (id || "none"), label: l, color: c, tasks: ts.filter((t) => (t.crit || "") === id) })).filter((g) => g.tasks.length);
    if (by === "jalon") return [["j-t", "Tâches", "#64748b", (t) => !t.milestone], ["j-m", "Jalons", "#18263d", (t) => t.milestone]].map(([id, l, c, f]) => ({ id, label: l, color: c, tasks: ts.filter(f) })).filter((g) => g.tasks.length);
    if (by === "echeance") {
      const wk = J(6), mo = J(30), b = (t) => (K.isDone(t) ? 4 : K.isLate(t) ? 0 : t.end <= wk ? 1 : t.end <= mo ? 2 : 3);
      return [["e0", "En retard", "#dc2626"], ["e1", "Sous 7 jours", "#d97706"], ["e2", "Sous 30 jours", "#2563eb"], ["e3", "Plus tard", "#64748b"], ["e4", "Terminées", "#16a34a"]].map(([id, l, c], i) => ({ id, label: l, color: c, tasks: ts.filter((t) => b(t) === i) })).filter((g) => g.tasks.length);
    }
    return [{ id: "", tasks: ts }];
  }
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
    const rowOf = (t) => {
      const d = drift(t), b = cmp !== "none" ? t[cmp] : null, a0 = tx(r, t.milestone ? t.end : t.start), a1 = t.milestone ? a0 : tx(r, K.addDays(t.end, 1));
      const gx = b ? tx(r, b.end) : 0;
      const ghost = b && (t.milestone ? gx < 0 || gx > 100 : tx(r, K.addDays(b.end, 1)) < 0 || tx(r, b.start) > 100) ? "" : b ? (t.milestone ? `<i class="hx-gms" style="left:${gx}%"></i>` : `<i class="hx-ghost" style="left:${Math.max(0, tx(r, b.start))}%;width:${Math.max(.3, Math.min(100, tx(r, K.addDays(b.end, 1))) - Math.max(0, tx(r, b.start)))}%"></i>`) : "";
      const ce = tx(r, K.addDays(b ? b.end : t.end, 1)), c0 = Math.max(0, Math.min(ce, a1)), c1 = Math.min(100, Math.max(ce, a1));
      const conn = b && d && c1 > c0 ? `<i class="hx-conn ${d > 0 ? "is-late" : "is-early"}" style="left:${c0}%;width:${c1 - c0}%"></i>` : "";
      const bar = projBar(t, r, a0, a1, p.color);
      const over = K.isLate(t) ? `<span class="hx-over" style="left:${Math.max(0, a1)}%;width:${Math.max(0, Math.min(100, tx(r, TODAY)) - Math.max(0, a1))}%;top:7px"></span>` : "";
      return `<div class="hx-prw ${S.taskId === t.id ? "is-sel" : ""} ${K.isDone(t) ? "is-done" : ""}"><span class="hx-gname">${chk(t)}<button type="button" data-task="${t.id}">${t.milestone ? "◆ " : ""}${e(t.title)}</button></span><span class="hx-dim">${K.initials(t.assignee)}</span><span class="hx-num">${K.dateShort(t.start)}</span><span class="hx-num ${K.isLate(t) ? "hx-red" : ""}">${K.dateShort(t.end)}</span><span class="hx-num hx-dim">${b ? K.dateShort(b.end) : "—"}</span><span class="hx-num">${dcell(d)}</span><div class="hx-ptl" data-rs="${r.start}" data-rn="${r.span}">${gridLines(r)}${ghost}${conn}${bar}${over}</div></div>`;
    };
    // Groupement libre des tâches du projet (statut, responsable, type…).
    const groups = projGroups(ts, S.jgroup);
    const rows = groups.map((g) => {
      if (!g.id) return g.tasks.map(rowOf).join("");
      const col = S.jcol.has(g.id), late = g.tasks.filter(K.isLate).length, open = g.tasks.filter((t) => !K.isDone(t)).length;
      const g0 = g.tasks.reduce((m, t) => (t.start < m ? t.start : m), "9999"), g1 = g.tasks.reduce((m, t) => (t.end > m ? t.end : m), "0000");
      const a = Math.max(0, tx(r, g0)), b = Math.min(100, tx(r, K.addDays(g1, 1)));
      return `<div class="hx-prw hx-pgrp"><button type="button" class="hx-gname" data-jcollapse="${g.id}" aria-expanded="${!col}"><span class="hx-chev">${col ? "▸" : "▾"}</span><i style="background:${g.color}"></i><b>${e(g.label)}</b><small>${g.tasks.length} tâche${g.tasks.length > 1 ? "s" : ""}${open !== g.tasks.length ? ` · ${open} ouverte${open > 1 ? "s" : ""}` : ""}${late ? ` · <em>${late} en retard</em>` : ""}</small></button><span></span><span class="hx-num hx-dim">${K.dateShort(g0)}</span><span class="hx-num hx-dim">${K.dateShort(g1)}</span><span></span><span></span><div class="hx-ptl">${gridLines(r)}${b > a ? `<span class="hx-lsum" style="left:${a}%;width:${b - a}%;--c:${g.color}"></span>` : ""}</div></div>${col ? "" : g.tasks.map(rowOf).join("")}`;
    }).join("");
    return `<main class="hx-main hx-projets" data-scroll><nav class="hx-plist" aria-label="Projets">${D.folders.map((fo) => `<h3>${e(fo.name)}</h3>${D.projects.filter((q) => q.folderId === fo.id).map((q) => { const s = K.projectStats(q.id); return `<button type="button" data-nav="projets" data-project="${q.id}" aria-current="${q.id === p.id}"><i style="background:${q.color}"></i><span>${e(q.name)}</span><small>${s.open}${s.late ? ` · <em>${s.late}</em>` : ""}</small></button>`; }).join("")}`).join("")}</nav>
      <div class="hx-pmain"><div class="hx-hello hx-row"><div><p class="hx-crumb">${e(f.name)} › ${e(p.name)}</p><h1 style="--c:${p.color}" class="hx-ptitle">${e(p.name)}</h1></div>
        <div class="hx-kpis is-inline"><div><small>Avancement</small><b>${st.progress} %</b></div><div><small>Ouvertes</small><b>${st.open}</b></div><div><small>En retard</small><b class="${st.late ? "hx-red" : ""}">${st.late}</b></div>${p.budget ? `<div><small>Budget</small><b>${Math.round(p.spent / p.budget * 100)} %</b></div>` : ""}<div><small>Fin prévue</small><b>${K.dateShort(endNow)}</b></div></div>
        <button type="button" class="hx-btn is-primary" data-new>+ Tâche</button></div>
        <section class="hx-tile hx-cmp"><div class="hx-cmpl"><span>Comparer à</span><div class="hx-seg is-sm">${CMP.map(([id, l]) => `<button type="button" data-cmp="${id}" aria-pressed="${cmp === id}">${l}</button>`).join("")}</div><button type="button" class="hx-more is-plain">Figer une nouvelle référence</button></div>
          ${cmp === "none" ? `<p class="hx-dim">Choisissez une référence pour voir les glissements de dates.</p>` : `<div class="hx-cmpk"><div><small>Fin du projet</small><b>${K.dateShort(endNow)}</b><span>${cmp === "ref" ? "réf." : "initial"} ${K.dateShort(endRef)} · ${dcell(K.days(endRef, endNow))}</span></div><div><small>Tâches glissées</small><b class="${slip ? "hx-red" : ""}">${slip}</b><span>sur ${ds.length} comparées</span></div><div><small>En avance</small><b class="${early ? "hx-green" : ""}">${early}</b><span>${stable} à l'heure</span></div><div><small>Dérive moyenne</small><b>${avg > 0 ? "+" : ""}${avg.toFixed(1).replace(".", ",")} j</b><span>sur la date de fin</span></div><div class="hx-cmpbar">${ds.slice().sort((a, b) => b - a).map((d) => `<i class="${d > 0 ? "is-late" : d < 0 ? "is-early" : ""}" style="height:${Math.min(100, 12 + Math.abs(d) * 4)}%" title="${d > 0 ? "+" : ""}${d} j"></i>`).join("")}</div></div>`}</section>
        <div class="hx-pbarrow">${zoomBar(r, "projets", ["mois", "trimestre", "annee", "pluri"])}<div class="hx-opts"><span>Grouper par</span><div class="hx-seg is-sm">${JGROUPS.map(([id, l]) => `<button type="button" data-jgroup="${id}" aria-pressed="${S.jgroup === id}">${l}</button>`).join("")}</div></div>${gstyleSeg()}</div>
        ${filterBar("projets", ts.length, { hide: ["projects"] })}
        <div class="hx-tile hx-pgantt"><div class="hx-prw hx-prh"><span>Tâche</span><span>Resp.</span><span>Début</span><span>Fin</span><span>${cmp === "initial" ? "Initiale" : "Réf."}</span><span>Dérive</span><div class="hx-ptl">${sparse(ticks(r), 7).map((k) => `<b class="hx-tick ${k.major ? "is-major" : ""}" style="left:${tx(r, k.iso)}%">${k.label}</b>`).join("")}</div></div>${rows || `<p class="hx-empty">Aucune tâche ne correspond aux filtres.</p>`}</div>
        <p class="hx-gdesc">${gstyleDesc()}</p>
        <p class="hx-legend2"><span>barre : dates actuelles</span><span><i class="lg-ghost"></i>${cmp === "initial" ? "plan initial" : "référence"}</span><span><i class="lg-conn"></i>glissement</span><span><i class="lg-over"></i>retard</span><span>Budget, documents, équipe et journal : « Fiche projet ».</span></p>
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
  // Regroupement des jours : jour, semaine (lundi) ou mois civil.
  const monday = (iso) => { const w = new Date(iso + "T12:00:00Z").getUTCDay() || 7; return K.addDays(iso, 1 - w); };
  function buckets(n, mode) {
    const off = SERIES.dates.length - n, out = [];
    SERIES.dates.slice(-n).forEach((d, i) => {
      const k = mode === "semaine" ? monday(d) : mode === "mois" ? d.slice(0, 7) : d;
      if (!out.length || out[out.length - 1].key !== k) out.push({ key: k, start: d, idx: [] });
      out[out.length - 1].idx.push(off + i); out[out.length - 1].end = d;
    });
    return out;
  }
  const bucketLabel = (b, mode) => (mode === "semaine" ? `S${isoWeek(b.start)}` : mode === "mois" ? MOIS_C[Number(b.key.slice(5, 7)) - 1] : K.dateShort(b.start));
  const bucketTitle = (b, mode) => (mode === "semaine" ? `Semaine ${isoWeek(b.start)} · du ${K.dateShort(b.start)} au ${K.dateShort(b.end)}` : mode === "mois" ? `${MOIS_C[Number(b.key.slice(5, 7)) - 1]} ${b.key.slice(0, 4)}${b.idx.length < 28 ? " (partiel)" : ""}` : `${K.dayName(b.start)} ${K.dateShort(b.start)}`);
  // Courbe de mesure avec faisceau de variation : en vue Jour, moyenne et
  // min–max glissants sur 7 jours ; en Semaine ou Mois, moyenne et min–max
  // de chaque période. Points = valeur du jour ou moyenne de la période.
  function metricChart(k, n, mode, m, W = 1240) {
    const B = buckets(n, mode), raw = SERIES[k];
    let pts, lo, hi, line;
    if (mode === "jour") { pts = B.map((b) => raw[b.idx[0]]); lo = roll(pts, 7, (a) => Math.min(...a)); hi = roll(pts, 7, (a) => Math.max(...a)); line = roll(pts, 7, mean); }
    else { pts = B.map((b) => mean(b.idx.map((i) => raw[i]))); lo = B.map((b) => Math.min(...b.idx.map((i) => raw[i]))); hi = B.map((b) => Math.max(...b.idx.map((i) => raw[i]))); line = pts; }
    const H = m.h || (W < 1000 ? 120 : 104), L = 6, R = 78, T = 12, Bm = 20, cnt = pts.length;
    const all = [...lo, ...hi, m.goal ?? lo[0]], y0v = Math.min(...all), y1v = Math.max(...all), pad = (y1v - y0v) * .12 || 1;
    const lov = m.min != null ? Math.max(m.min, y0v - pad) : y0v - pad, hiv = m.max != null ? Math.min(m.max, y1v + pad) : y1v + pad;
    const X = (i) => L + (cnt > 1 ? i / (cnt - 1) : .5) * (W - L - R), Y = (v) => T + (1 - (v - lov) / (hiv - lov || 1)) * (H - T - Bm);
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(m.label)}">`;
    (m.zones || []).forEach(([a, b, c]) => { const ya = Y(Math.min(b, hiv)), yb = Y(Math.max(a, lov)); if (yb > ya) s += `<rect x="${L}" y="${ya.toFixed(1)}" width="${W - L - R}" height="${(yb - ya).toFixed(1)}" fill="${c}" opacity=".06"/>`; });
    const every = Math.max(1, Math.ceil(cnt / (W < 1000 ? 5 : 9)));
    for (let i = 0; i < cnt; i += every) s += `<line x1="${X(i).toFixed(1)}" y1="${T}" x2="${X(i).toFixed(1)}" y2="${H - Bm}" stroke="#eef1f5"/><text x="${X(i).toFixed(1)}" y="${H - 5}" class="hx-mct" text-anchor="${i === 0 ? "start" : "middle"}">${bucketLabel(B[i], mode)}</text>`;
    if (m.goal != null) s += `<line x1="${L}" y1="${Y(m.goal).toFixed(1)}" x2="${W - R}" y2="${Y(m.goal).toFixed(1)}" stroke="${m.color}" stroke-dasharray="4 4" opacity=".55"/><text x="${W - R + 6}" y="${(Y(m.goal) + 4).toFixed(1)}" class="hx-mct">obj. ${m.fmt(m.goal)}</text>`;
    if (m.mode === "bars") {
      const bw = Math.max(2, Math.min(18, (W - L - R) / cnt * .6));
      pts.forEach((v, i) => { const ok = m.goal != null && v >= m.goal; s += `<rect x="${(X(i) - bw / 2).toFixed(1)}" y="${Y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Y(lov) - Y(v)).toFixed(1)}" rx="${Math.min(4, bw / 2)}" fill="${m.color}" opacity="${ok ? .9 : .4}" data-tip="${e(`${bucketTitle(B[i], mode)}|${m.label} : ${m.fmt(v)}${mode !== "jour" ? " par jour en moyenne" : ""}${m.goal != null ? (ok ? " · objectif atteint" : " · sous l'objectif") : ""}`)}"/>`; });
    } else {
      s += `<path d="${smooth(hi.map((v, i) => [X(i), Y(v)]))} L${lo.map((v, i) => [X(i), Y(v)]).reverse().map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")} Z" fill="${m.color}" opacity=".11"/>`;
      if (m.mode === "area") s += `<path d="${smooth(line.map((v, i) => [X(i), Y(v)]))} L${X(cnt - 1)} ${Y(lov)} L${X(0)} ${Y(lov)} Z" fill="${m.color}" opacity=".07"/>`;
      s += `<path d="${smooth(line.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="${m.color}" stroke-width="2.2" stroke-linecap="round"/>`;
      pts.forEach((v, i) => { s += `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${cnt > 60 ? 1.6 : 3}" fill="${m.dotColor ? m.dotColor(v) : m.color}" opacity="${m.dotColor ? .9 : .5}"/><rect x="${(X(i) - (W - L - R) / cnt / 2).toFixed(1)}" y="${T}" width="${((W - L - R) / Math.max(1, cnt)).toFixed(1)}" height="${H - T - Bm}" fill="transparent" data-tip="${e(`${bucketTitle(B[i], mode)}|${m.label} : ${m.fmt(v)}${mode !== "jour" ? " (moyenne)" : ""}|Faisceau : ${m.fmt(lo[i])} → ${m.fmt(hi[i])}${mode === "jour" ? " sur 7 jours" : ""}`)}"/>`; });
    }
    const lv = pts[cnt - 1];
    s += `<circle cx="${X(cnt - 1)}" cy="${Y(lv).toFixed(1)}" r="4.5" fill="#fff" stroke="${m.dotColor ? m.dotColor(lv) : m.color}" stroke-width="2.4" pointer-events="none"/><text x="${X(cnt - 1) + 10}" y="${(Y(lv) + 4).toFixed(1)}" class="hx-mcv">${m.fmt(lv)}</text>`;
    return { svg: s + "</svg>", pts };
  }

  // ---------------------------------------------------------------- corps
  const MDEF = {
    recovery: { label: "Récupération", color: "#16a34a", fmt: (v) => Math.round(v) + " %", zones: [[0, 33, "#dc2626"], [34, 66, "#e0a21b"], [67, 100, "#16a34a"]], dotColor: zoneColor, min: 0, max: 100 },
    sleep: { label: "Sommeil réel", color: "#5b7bd8", fmt: (v) => v.toFixed(1).replace(".", ",") + " h", goal: 8, mode: "area" },
    hrv: { label: "HRV", color: "#0f9d76", fmt: (v) => Math.round(v) + " ms" },
    restingHr: { label: "FC repos", color: "#d64545", fmt: (v) => Math.round(v) + " bpm", invert: true },
    weight: { label: "Poids", color: "#475569", fmt: (v) => v.toFixed(1).replace(".", ",") + " kg", invert: true },
    bodyFat: { label: "Masse grasse", color: "#b45309", fmt: (v) => v.toFixed(1).replace(".", ",") + " %", invert: true },
    respRate: { label: "Fréq. respiratoire", color: "#0e7490", fmt: (v) => v.toFixed(1).replace(".", ",") + " /min", invert: true },
    spo2: { label: "SpO₂", color: "#2563eb", fmt: (v) => v.toFixed(1).replace(".", ",") + " %", min: 90, max: 100 },
    steps: { label: "Pas", color: "#7c5cd6", fmt: (v) => (v / 1000).toFixed(1).replace(".", ",") + " k", goal: 10000, mode: "bars" },
  };
  const CSECT = [["recup", "Récupération et sommeil", ["recovery", "sleep"]], ["cardio", "Cardio", ["hrv", "restingHr"]], ["comp", "Composition corporelle", ["weight", "bodyFat"]], ["vitaux", "Signes vitaux", ["respRate", "spo2"]], ["act", "Activité et sport", ["steps", "sport"]], ["hab", "Habitudes", []]];
  const AGG = [["jour", "Jour"], ["semaine", "Semaine"], ["mois", "Mois"]];
  const PERIODS = [[14, "14 j"], [30, "30 j"], [90, "90 j"], [365, "1 an"]];
  const HALF = new Set(["recup", "cardio", "comp", "vitaux"]);
  function metricRow(k, n, half) {
    const m = MDEF[k], ch = metricChart(k, n, S.cagg, m, half ? 660 : 1240), raw = SERIES[k].slice(-n), last = raw[n - 1], av = mean(raw), delta = (last - av) / av * 100;
    const good = m.invert ? delta < 0 : delta > 0;
    return `<div class="hx-mrow2"><div class="hx-mhd"><small>${m.label}</small><b>${m.fmt(last)}</b><span class="${Math.abs(delta) < 2 ? "hx-dim" : good ? "hx-green" : "hx-red"}">${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)} % vs moyenne</span><span class="hx-dim">moy. ${m.fmt(av)} · min ${m.fmt(Math.min(...raw))} · max ${m.fmt(Math.max(...raw))}</span></div>${ch.svg}</div>`;
  }
  // Sport : heures empilées par discipline, par jour, semaine ou mois ;
  // objectif proportionné à la période ; total au-dessus de chaque pile.
  function sportBlock(n) {
    const mode = S.sagg, first = SERIES.dates[SERIES.dates.length - n];
    const B = buckets(n, mode).map((b) => { const by = {}; SESSIONS.filter((x) => x.date >= b.start && x.date <= b.end).forEach((x) => (by[x.sport] = (by[x.sport] || 0) + x.minutes)); return { ...b, by, tot: Object.values(by).reduce((a, c) => a + c, 0) }; });
    const goalOf = (b) => D.sport.goalHours * 60 * (mode === "jour" ? 1 / 7 : mode === "semaine" ? 1 : b.idx.length / 7);
    const W = 1240, H = 170, L = 6, R = 78, T = 18, Bm = 22, cnt = B.length, max = Math.max(...B.map(goalOf), ...B.map((b) => b.tot)) * 1.12 || 60;
    const slot = (W - L - R) / cnt, bw = Math.max(2, Math.min(34, slot * .62)), Y = (m) => T + (1 - m / max) * (H - T - Bm);
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Heures de sport par ${mode}"><defs>`;
    B.forEach((b, i) => { if (!b.tot) return; const x = L + (i + .5) * slot - bw / 2, y = Y(b.tot), r = Math.min(4, bw / 2), h = Y(0) - y; s += `<clipPath id="spk-${i}"><path d="M${x} ${Y(0)} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${Y(0)} Z"/></clipPath>`; });
    s += `</defs>`;
    [0, .5, 1].forEach((f) => { const v = max / 1.12 * f; s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f5"/>`; });
    if (mode !== "mois") s += `<line x1="${L}" x2="${W - R}" y1="${Y(goalOf(B[0]))}" y2="${Y(goalOf(B[0]))}" stroke="#0e7490" stroke-dasharray="4 4" opacity=".6"/><text x="${W - R + 6}" y="${Y(goalOf(B[0])) + 4}" class="hx-mct">obj. ${K.hm(Math.round(goalOf(B[0])))}</text>`;
    const every = Math.max(1, Math.ceil(cnt / 14));
    B.forEach((b, i) => {
      const x = L + (i + .5) * slot - bw / 2;
      if (mode === "mois") s += `<line x1="${x - 3}" x2="${x + bw + 3}" y1="${Y(goalOf(b))}" y2="${Y(goalOf(b))}" stroke="#0e7490" stroke-dasharray="3 3" opacity=".7"/>`;
      if (b.tot) {
        let y = Y(0);
        s += `<g clip-path="url(#spk-${i})" data-tip="${e(`${bucketTitle(b, mode)}|Total : ${K.hm(b.tot)} sur un objectif de ${K.hm(Math.round(goalOf(b)))}|${Object.entries(b.by).map(([k, v]) => `${k} : ${K.hm(v)}`).join(" · ")}`)}">`;
        Object.keys(SPORT_COL).forEach((k) => { const v = b.by[k] || 0; if (!v) return; const h = Y(0) - Y(v); y -= h; s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" fill="${SPORT_COL[k]}" stroke="#fff" stroke-width="1.5"/>`; });
        s += `<rect x="${x.toFixed(1)}" y="${Y(b.tot).toFixed(1)}" width="${bw.toFixed(1)}" height="${(Y(0) - Y(b.tot)).toFixed(1)}" fill="transparent"/></g>`;
        if (cnt <= 26) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(Y(b.tot) - 6).toFixed(1)}" class="hx-mcl" text-anchor="middle">${(b.tot / 60).toFixed(1).replace(".", ",")} h</text>`;
      }
      if (i % every === 0) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" class="hx-mct" text-anchor="middle">${bucketLabel(b, mode)}</text>`;
    });
    s += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" stroke="#c9ccd1"/></svg>`;
    const per = {}; SESSIONS.filter((x) => x.date >= first && x.date <= TODAY).forEach((x) => { per[x.sport] = per[x.sport] || { m: 0, n: 0 }; per[x.sport].m += x.minutes; per[x.sport].n++; });
    const sw = K.sportWeek(), recent = SESSIONS.filter((x) => x.date <= TODAY).slice(-6).reverse();
    return `<div class="hx-mrow2"><div class="hx-mhd"><small>Sport</small><b>${K.hm(sw.done)} <span class="hx-dim">/ ${D.sport.goalHours} h</span></b><span class="hx-dim">cette semaine · semaine dernière ${K.hm(sw.last)}</span><div class="hx-seg is-xs">${AGG.map(([id, l]) => `<button type="button" data-sagg="${id}" aria-pressed="${mode === id}">${l}</button>`).join("")}</div></div><div>${s}<div class="hx-sleg is-tot">${Object.keys(SPORT_COL).filter((k) => per[k]).map((k) => `<span><i style="background:${SPORT_COL[k]}"></i>${k} <b>${K.hm(per[k].m)}</b> · ${per[k].n} séance${per[k].n > 1 ? "s" : ""}</span>`).join("")}</div></div></div>
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
        h += `<span class="hx-hgl is-sub ${S.hot === hb.id ? "is-hot" : ""}" data-hp="${hb.id}"><i class="hx-hdot" style="background:${hc(hb)}"></i>${e(hb.name)}</span>` + days.map((d) => { const st = hstate(hb, d); if (st.state !== "na") { tot++; if (st.state !== "todo") ok++; } return `<button type="button" class="hx-hc is-${st.state}" data-hab="${hb.id}|${d}|toggle" data-hp="${hb.id}" data-tip="${e(htip(hb, d))}" style="--c:${hc(hb)};--f:${st.state === "part" ? st.value / hb.max : 1}" aria-label="${e(hb.name)} le ${K.dateShort(d)}"></button>`; }).join("") + `<span class="hx-hgr">${tot ? Math.round(ok / tot * 100) : 0} %</span>`;
      });
    });
    return h + "</div>";
  }
  function corps() {
    const n = S.cper, sel = S.metrics.page;
    const summary = { recup: () => `récup. ${K.last(SERIES.recovery)} % · sommeil ${String(K.last(SERIES.sleep)).replace(".", ",")} h`, cardio: () => `HRV ${K.last(SERIES.hrv)} ms · FC ${K.last(SERIES.restingHr)} bpm`, comp: () => `${String(K.last(SERIES.weight)).replace(".", ",")} kg · ${String(K.last(SERIES.bodyFat)).replace(".", ",")} %`, vitaux: () => `${String(K.last(SERIES.respRate)).replace(".", ",")} /min · SpO₂ ${String(K.last(SERIES.spo2)).replace(".", ",")} %`, act: () => `${(K.last(SERIES.steps) / 1000).toFixed(1).replace(".", ",")} k pas · ${K.hm(K.sportWeek().done)} de sport`, hab: () => `${count(TODAY).done}/${count(TODAY).total} aujourd'hui` };
    return `<main class="hx-main hx-corps2" data-scroll>
      <div class="hx-hello hx-row"><div><h1>Corps</h1><p>Récupération ${K.last(SERIES.recovery)} % ce matin. Trait : moyenne · faisceau : minimum et maximum (sur 7 jours glissants en vue Jour, dans chaque période sinon) · points : valeur du jour ou moyenne de la période.</p></div>
        <div class="hx-opts"><span>Période</span><div class="hx-seg is-sm">${PERIODS.map(([p, l]) => `<button type="button" data-cper="${p}" aria-pressed="${n === p}">${l}</button>`).join("")}</div><span>Regrouper par</span><div class="hx-seg is-sm">${AGG.map(([id, l]) => `<button type="button" data-cagg="${id}" aria-pressed="${S.cagg === id}">${l}</button>`).join("")}</div></div><div class="hx-corpsbar">${chooserBtn("page")}</div></div>
      ${(() => { const sec = (list) => list.map(([id, title, keys]) => {
        const open = !S.closed.has(id), shown = keys.filter((k) => sel.has(k));
        if (id !== "hab" && !shown.length) return "";
        const body = id === "hab" ? habitGrid(Math.min(n, 30)) + (n > 30 ? `<p class="hx-hint">Habitudes limitées aux 30 derniers jours pour rester lisibles ; les vues Semaine, Mois et Année de Habit Pixel restent disponibles.</p>` : "") : shown.map((k) => (k === "sport" ? sportBlock(n) : metricRow(k, n, HALF.has(id)))).join("");
        return `<section class="hx-tile hx-csec ${open ? "" : "is-closed"}"><button type="button" class="hx-csh" data-csec="${id}" aria-expanded="${open}"><span class="hx-chev">${open ? "▾" : "▸"}</span><h2>${title}</h2><span class="hx-csum">${summary[id]()}</span></button>${open ? `<div class="hx-csb">${body}</div>` : ""}</section>`;
      }).join(""); return `<div class="hx-cgrid">${sec(CSECT.filter((c) => HALF.has(c[0])))}</div>${sec(CSECT.filter((c) => !HALF.has(c[0])))}`; })()}
    </main>`;
  }

  // --------------------------------------------------------------- argent
  // Données fictives au format lu par les graphiques de Nexora :
  // Sankey mensuel (origine › comptes › destination, transferts internes exclus),
  // Sankey de structure (type › banque › compte), budget cumulé par catégorie.
  const CATCOL = { Logement: "#475569", Courses: "#16a34a", Maison: "#0284c7", Restaurants: "#dc2626", Transport: "#7c5cd6", Abonnements: "#64748b", Loisirs: "#d99a2b", Santé: "#db2777" };
  const MONTHS = {
    oct: { key: "2026-10", label: "Octobre 2026", ndays: 31, upto: 5,
      income: [["Salaire", "Compte courant", 3250, 1]],
      spend: [["Compte courant", "Courses", [[1, 42.3], [2, 61.4], [3, 18.2], [4, 46.2]]], ["Compte joint", "Courses", [[3, 41.9]]], ["Compte joint", "Maison", [[2, 85.7], [4, 64.3]]], ["Compte courant", "Restaurants", [[1, 47.6], [2, 58], [5, 6.4]]], ["Compte courant", "Transport", [[1, 58], [3, 38]]], ["Compte courant", "Abonnements", [[1, 48.01], [1, 11.99]]], ["Compte courant", "Loisirs", [[3, 54.99], [4, 5.01]]]] },
    sept: { key: "2026-09", label: "Septembre 2026", ndays: 30, upto: 30,
      income: [["Salaire", "Compte courant", 3250, 1], ["Participation du conjoint", "Compte joint", 1200, 5], ["Remboursement santé", "Compte courant", 85, 18]],
      spend: [["Compte joint", "Logement", [[2, 950]]], ["Compte courant", "Courses", [[3, 62], [7, 48], [10, 55], [14, 71], [18, 39], [22, 66], [27, 59]]], ["Compte joint", "Courses", [[12, 62], [25, 68]]], ["Compte joint", "Maison", [[6, 64.3], [16, 98], [24, 47.7]]], ["Compte courant", "Restaurants", [[5, 34], [13, 52], [26, 54]]], ["Compte courant", "Transport", [[4, 58], [15, 38], [23, 64]]], ["Compte courant", "Abonnements", [[1, 60], [10, 25]]], ["Compte courant", "Loisirs", [[9, 54], [20, 88], [28, 48]]], ["Compte courant", "Santé", [[17, 45]]]] },
  };
  const ACC_COL = { "Compte courant": "#256d85", "Compte joint": "#3f806f" };
  // Opérations détaillées, tirées des mêmes mois que le Sankey et la courbe
  // cumulée (montants identiques), avec tous les champs filtrables.
  const OP_LABELS = { Logement: ["Loyer"], Courses: ["Monoprix", "Carrefour Market", "Biocoop", "Grand Frais", "Lidl"], Maison: ["Prélèvement EDF", "Leroy Merlin", "Ikea", "Veolia Eau"], Restaurants: ["Le Bouchon des Filles", "Boulangerie Paul", "Sushi Shop", "Café Mokxa"], Transport: ["TCL abonnement", "SNCF CONNECT", "Total Energies"], Abonnements: ["Free Box", "Spotify", "Netflix", "Free Mobile"], Loisirs: ["Decathlon", "Cinéma Pathé", "Fnac", "Musée des Confluences"], Santé: ["Pharmacie Bellecour", "Dr Martin"], Autres: ["La Poste", "Amazon"] };
  const OP_MODE = { Logement: "Prélèvement", Abonnements: "Prélèvement", Maison: "Carte", Courses: "Carte", Restaurants: "Carte", Transport: "Carte", Loisirs: "Carte", Santé: "Carte", Autres: "Carte" };
  const ACC_BANK = { "Compte courant": "Boursorama", "Compte joint": "Crédit Agricole", "Livret A": "Crédit Agricole" };
  const OPS = (() => {
    const out = []; let n = 0;
    Object.values(MONTHS).forEach((M) => {
      const iso = (d) => `${M.key}-${String(d).padStart(2, "0")}`;
      M.income.forEach(([l, acc, v, d]) => out.push({ id: "o" + n++, date: iso(d), label: l, amount: v, cat: "Revenus", account: acc, bank: ACC_BANK[acc], mode: "Virement", sens: "Revenu", scope: "Perso" }));
      M.spend.forEach(([acc, cat, list]) => list.forEach(([d, v], j) => {
        const date = iso(d), tc = D.budget.toCategorize.find((x) => x.date === date && Math.abs(x.amount + v) < .01);
        const labels = OP_LABELS[cat] || ["Paiement"], label = tc ? tc.label : cat === "Maison" && v === 64.3 ? "Prélèvement EDF" : labels[(d + j) % labels.length];
        out.push({ id: "o" + n++, date, label, amount: -v, cat: tc ? null : cat, tc: tc ? tc.id : null, account: acc, bank: ACC_BANK[acc], mode: label.startsWith("Prélèvement") || label === "Loyer" ? "Prélèvement" : OP_MODE[cat] || "Carte", sens: "Dépense", scope: "Perso" });
      }));
      out.push({ id: "o" + n++, date: iso(Math.min(M.upto, 2)), label: "Virement vers Livret A", amount: -300, cat: "Virement interne", account: "Compte courant", bank: "Boursorama", mode: "Virement", sens: "Virement interne", scope: "Perso" });
    });
    out.push({ id: "o" + n++, date: "2026-09-21", label: "Encaissement facture F-2026-014", amount: 1800, cat: "Revenus pro", account: "Compte courant", bank: "Boursorama", mode: "Virement", sens: "Revenu", scope: "Pro" });
    out.push({ id: "o" + n++, date: "2026-09-08", label: "Abonnement logiciel métier", amount: -29, cat: "Frais pro", account: "Compte courant", bank: "Boursorama", mode: "Carte", sens: "Dépense", scope: "Pro" });
    return out.sort((a, b) => b.date.localeCompare(a.date) || a.label.localeCompare(b.label));
  })();
  const OF0 = () => ({ q: "", from: "", to: "", min: "", max: "", accounts: new Set(), banks: new Set(), cats: new Set(), modes: new Set(), sens: new Set(), statut: new Set(), scope: new Set() });
  const opCat = (o) => o.cat || (o.tc && S.categorized[o.tc]) || null;
  const OFIELDS = [
    ["accounts", "Comptes", (o) => o.account], ["banks", "Banques", (o) => o.bank], ["cats", "Catégories", (o) => opCat(o) || "À classer"], ["modes", "Moyen de paiement", (o) => o.mode],
    ["sens", "Sens", (o) => o.sens], ["statut", "Statut", (o) => (opCat(o) ? "Classée" : "À classer")], ["scope", "Périmètre", (o) => o.scope],
  ];
  function applyOF(list, f) {
    const q = f.q.trim().toLowerCase(), mn = f.min === "" ? null : Number(f.min), mx = f.max === "" ? null : Number(f.max);
    return list.filter((o) => (!q || (o.label + " " + (opCat(o) || "") + " " + o.account).toLowerCase().includes(q)) && (!f.from || o.date >= f.from) && (!f.to || o.date <= f.to) && (mn === null || Math.abs(o.amount) >= mn) && (mx === null || Math.abs(o.amount) <= mx) && OFIELDS.every(([k, , get]) => !f[k].size || f[k].has(get(o))));
  }
  function monthGraph(M) {
    const inc = [...new Set(M.income.map((x) => x[0]))], acc = [...new Set([...M.income.map((x) => x[1]), ...M.spend.map((x) => x[0])])], cats = [...new Set(M.spend.map((x) => x[1]))];
    const sum = (pairs) => pairs.reduce((a, p) => a + p[1], 0);
    const catTotal = (c) => M.spend.filter((x) => x[1] === c).reduce((a, x) => a + sum(x[2]), 0);
    cats.sort((x, y) => catTotal(y) - catTotal(x));
    const nodes = [...inc.map((n, i) => ({ id: "income:" + n, name: n, col: 0, order: i, color: NX.FINANCE_SANKEY_INCOME_PALETTE[i % NX.FINANCE_SANKEY_INCOME_PALETTE.length] })), ...acc.map((n, i) => ({ id: "account:" + n, name: n, col: 1, order: i, color: NX.financeSankeyColor(ACC_COL[n]) })), ...cats.map((n, i) => ({ id: "category:" + n, name: n, col: 2, order: i, color: NX.financeSankeyColor(CATCOL[n], "#587894") }))];
    const links = [...M.income.map(([n, a, v]) => ({ source: "income:" + n, target: "account:" + a, value: v })), ...M.spend.map(([a, c, p]) => ({ source: "account:" + a, target: "category:" + c, value: sum(p) }))];
    const merged = []; links.forEach((l) => { const m = merged.find((x) => x.source === l.source && x.target === l.target); if (m) m.value += l.value; else merged.push({ ...l }); });
    return { nodes, links: merged, columns: ["ORIGINE", "COMPTES", "DESTINATION"] };
  }
  function cumulCharts(M) {
    const days = Array.from({ length: M.ndays }, (_, i) => `${M.key}-${String(i + 1).padStart(2, "0")}`);
    const budgets = {}; D.budget.categories.forEach((c) => (budgets[c.name] = c.limit));
    const byCat = {}; M.spend.forEach(([, c, p]) => p.forEach(([d, v]) => { byCat[c] = byCat[c] || Array(M.ndays).fill(0); byCat[c][d - 1] += v; }));
    const cumulative = Object.entries(byCat).map(([c, daily]) => { let acc = 0; const values = daily.map((v) => Math.round((acc += v) * 100) / 100); return { category: c, color: CATCOL[c], total: values[values.length - 1], budget: budgets[c] || 0, values }; }).sort((x, y) => y.total - x.total);
    let inc = 0; const incomeCumulative = days.map((_, i) => (inc += M.income.filter((x) => x[3] === i + 1).reduce((a, x) => a + x[2], 0)));
    const periodic = Object.values(MONTHS).map((m) => ({ month: m.key, categories: Object.keys(CATCOL).map((c) => ({ category: c, amount: m.spend.filter((x) => x[1] === c).reduce((a, x) => a + x[2].reduce((b, p) => b + p[1], 0), 0) })) }));
    return { days, cumulative, incomeCumulative, budgetTotal: Object.values(budgets).filter((v) => v > 0).reduce((a, v) => a + v, 0), periodic };
  }
  const ACCOUNTS = [
    { type: "Bourse", bank: "Boursorama", name: "PEA", bal: 14000, color: "#7c5cd6" },
    { type: "Comptes courants", bank: "Boursorama", name: "Compte courant", bal: 4200, color: "#607d9b" },
    { type: "Comptes courants", bank: "Crédit Agricole", name: "Compte joint", bal: 2000, color: "#607d9b" },
    { type: "Épargne réglementée", bank: "Crédit Agricole", name: "Livret A", bal: 22950, color: "#0284c7" },
    { type: "Assurance-vie", bank: "Linxea", name: "Linxea Spirica", bal: 41150, color: "#0f766e" },
  ];
  const TYPES = [["Bourse", "#7c5cd6"], ["Comptes courants", "#94a3b8"], ["Épargne réglementée", "#0284c7"], ["Assurance-vie", "#0f766e"]];
  const BANKS = [["Boursorama", "#256d85"], ["Crédit Agricole", "#3f806f"], ["Linxea", "#cf7856"]];
  // Patrimoine mensuel sur 60 mois (nov. 2021 → oct. 2026) ; l'écran en
  // montre les N derniers, N étant choisi dans les réglages.
  const WMAX = 60;
  const WSERIES = (() => { let s = 11; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const end = { "Comptes courants": 6200, "Épargne réglementée": 22950, "Assurance-vie": 41150, "Bourse": 14000 }, start = { "Comptes courants": 4300, "Épargne réglementée": 9800, "Assurance-vie": 19500, "Bourse": 2400 }; return Array.from({ length: WMAX }, (_, i) => { const f = Math.pow(i / (WMAX - 1), 1.15); const o = {}; TYPES.forEach(([t]) => { const base = start[t] + (end[t] - start[t]) * f; o[t] = i === WMAX - 1 ? end[t] : Math.round(base * (1 + (r() - .5) * (t === "Bourse" ? .09 : t === "Comptes courants" ? .12 : .015))); }); return o; }); })();
  const WMONTHS = Array.from({ length: WMAX }, (_, i) => new Date(Date.UTC(2021, 10 + i, 1)));
  const WN_OPTS = [6, 12, 24, 36, 60];
  const wsum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  function stackChart(N) {
    const ser = WSERIES.slice(-N), mon = WMONTHS.slice(-N);
    const W = 1300, H = 430, L = 50, R = 16, T = 10, B = 24, n = ser.length, tot = ser.map(wsum), step = Math.max(...tot) > 60000 ? 20000 : 10000, max = Math.ceil(Math.max(...tot) / step) * step;
    const X = (i) => L + i / (n - 1) * (W - L - R), Y = (v) => T + (1 - v / max) * (H - T - B);
    const lab = (d, full) => MOIS_C[d.getUTCMonth()] + (full || d.getUTCMonth() === 0 ? " " + d.getUTCFullYear() : "");
    let s = `<svg class="hx-mc hx-wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du patrimoine sur ${N} mois">`;
    for (let v = 0; v <= max; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="#eef1f5"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" class="hx-mct">${v / 1000} k€</text>`;
    let base = ser.map(() => 0);
    TYPES.forEach(([t, c]) => { const top = ser.map((o, i) => base[i] + o[t]); const up = top.map((v, i) => [X(i), Y(v)]), dn = base.map((v, i) => [X(i), Y(v)]).reverse(); s += `<path d="${smooth(up)} L${dn.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" L")} Z" fill="${c}" opacity=".78"/>`; base = top; });
    s += `<path d="${smooth(tot.map((v, i) => [X(i), Y(v)]))}" fill="none" stroke="#18263d" stroke-width="1.6"/>`;
    const every = Math.max(1, Math.round(n / 8));
    mon.forEach((d, i) => { if ((n - 1 - i) % every === 0) s += `<text x="${X(i)}" y="${H - 6}" text-anchor="${i === n - 1 ? "end" : "middle"}" class="hx-mct">${lab(d)}</text>`; });
    // Infobulle par mois : détail par type, total, variation sur un mois.
    const slot = (W - L - R) / Math.max(1, n - 1);
    ser.forEach((o, i) => {
      const dv = i ? tot[i] - tot[i - 1] : null;
      const tip = `${lab(mon[i], true)} · ${K.euro(tot[i])}|${TYPES.slice().reverse().map(([t]) => `${t} : ${K.euro(o[t])} (${Math.round(o[t] / tot[i] * 100)} %)`).join("|")}${dv !== null ? `|Sur un mois : ${dv >= 0 ? "+" : "−"}${K.euro(Math.abs(dv))}` : ""}`;
      s += `<g class="hx-whit"><line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${H - B}" stroke="#18263d" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${X(i)}" cy="${Y(tot[i])}" r="4" fill="#fff" stroke="#18263d" stroke-width="2"/><rect x="${(X(i) - slot / 2).toFixed(1)}" y="${T}" width="${slot.toFixed(1)}" height="${H - T - B}" fill="transparent" data-tip="${e(tip)}"/></g>`;
    });
    return s + `<circle cx="${X(n - 1)}" cy="${Y(tot[n - 1])}" r="4" fill="#fff" stroke="#18263d" stroke-width="2" pointer-events="none"/></svg>`;
  }
  function wealthGraph() {
    const types = TYPES.map((t) => t[0]).filter((t) => ACCOUNTS.some((a) => a.type === t)), banks = BANKS.map((b) => b[0]);
    const nodes = [...types.map((n, i) => ({ id: "type:" + n, name: n, col: 0, order: i, color: NX.financeSankeyColor(TYPES.find((t) => t[0] === n)[1], ["#607d9b", "#3f806f"][i % 2]) })), ...banks.map((n, i) => ({ id: "bank:" + n, name: n, col: 1, order: i, color: NX.financeSankeyColor(BANKS[i][1], ["#256d85", "#cf7856", "#73927e"][i % 3]) })), ...ACCOUNTS.map((a, i) => ({ id: "account:" + a.name, name: a.name, col: 2, order: i, color: NX.financeSankeyColor(a.color) }))];
    const links = [];
    types.forEach((t) => banks.forEach((b) => { const v = ACCOUNTS.filter((a) => a.type === t && a.bank === b).reduce((x, a) => x + a.bal, 0); if (v > 0) links.push({ source: "type:" + t, target: "bank:" + b, value: v }); }));
    ACCOUNTS.forEach((a) => links.push({ source: "bank:" + a.bank, target: "account:" + a.name, value: a.bal }));
    return { nodes, links, columns: ["TYPE", "BANQUE", "COMPTE"] };
  }
  // Activité pro (Devis, Factures, Finance PRO) : mêmes statuts que Nexora
  // (QUOTE_STATUSES, INVOICE_STATUSES, PRO_MISSION_STATUSES), franchise de TVA 2026.
  const PRO = {
    seuil: 37500, majore: 41250,
    monthly: [1800, 2400, 3100, 2200, 2650, 3400, 1500, 900, 3250, 3600],
    invoices: [
      { n: "2026-034", client: "Cabinet Delta Ingénierie", obj: "Assistance maîtrise d'œuvre · septembre", issued: K.J(-12), due: K.J(18), amount: 2400, status: "issued" },
      { n: "2026-033", client: "SCI Les Tilleuls", obj: "Diagnostic structure", issued: K.J(-40), due: K.J(-10), amount: 1200, status: "late" },
      { n: "2026-032", client: "Commune de Saint-Exemple", obj: "Étude de faisabilité · acompte 30 %", issued: K.J(-21), due: K.J(9), amount: 1200, status: "issued" },
      { n: "2026-031", client: "Cabinet Delta Ingénierie", obj: "Assistance maîtrise d'œuvre · août", issued: K.J(-44), due: K.J(-14), amount: 1200, status: "paid" },
    ],
    quotes: [
      { n: "D-2026-019", client: "Atelier Mercier", obj: "Note de calcul passerelle", amount: 3900, valid: K.J(21), status: "sent" },
      { n: "D-2026-018", client: "Commune de Saint-Exemple", obj: "Étude de faisabilité · phase 2", amount: 3000, valid: K.J(9), status: "sent" },
      { n: "D-2026-017", client: "SCI Les Tilleuls", obj: "Suivi de travaux", amount: 2600, valid: K.J(-3), status: "expired" },
      { n: "D-2026-016", client: "Cabinet Delta Ingénierie", obj: "Assistance MOE · T4", amount: 7200, valid: K.J(-20), status: "accepted" },
    ],
    missions: [
      { client: "Cabinet Delta Ingénierie", name: "Assistance maîtrise d'œuvre 2026", mode: "Régie journalière", billed: 14400, budget: 21600, status: "en_cours" },
      { client: "Commune de Saint-Exemple", name: "Étude de faisabilité", mode: "Acompte / jalons facturables", billed: 1200, budget: 4000, status: "en_cours" },
      { client: "SCI Les Tilleuls", name: "Diagnostic structure", mode: "Forfait", billed: 1200, budget: 1200, status: "cloturee" },
      { client: "Atelier Mercier", name: "Passerelle piétonne", mode: "Forfait", billed: 0, budget: 3900, status: "prospect" },
    ],
  };
  const QST = { draft: ["Brouillon", "#7A8290"], sent: ["Envoyé", "#2C6BE0"], accepted: ["Accepté", "#16a34a"], refused: ["Refusé", "#dc2626"], expired: ["Expiré", "#d97706"] };
  const IST = { issued: ["Émise", "#2C6BE0"], paid: ["Payée", "#16a34a"], cancelled: ["Annulée", "#7A8290"], late: ["En retard", "#d97706"] };
  const MST = { prospect: ["Prospect", "#7A8290"], signee: ["Signée", "#2C6BE0"], en_cours: ["En cours", "#16a34a"], cloturee: ["Clôturée", "#7A8290"] };
  const badge = ([l, c]) => `<span class="hx-badge2" style="--b:${c}">${l}</span>`;
  function proChart() {
    const W = 1240, H = 210, L = 50, R = 175, T = 14, B = 24, n = 12, months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
    let cum = 0; const cumul = PRO.monthly.map((v) => (cum += v));
    const max = PRO.majore * 1.08, Y = (v) => T + (1 - v / max) * (H - T - B), X = (i) => L + (i + .5) * (W - L - R) / n, bw = (W - L - R) / n * .5;
    const ymax = Math.max(...PRO.monthly) * 3.2, Yb = (v) => (H - B) - (v / ymax) * (H - T - B);
    let s = `<svg class="hx-mc" viewBox="0 0 ${W} ${H}" role="img" aria-label="Encaissements 2026 face au seuil de franchise de TVA">`;
    NX.financeChartTicks(max).ticks.forEach((t) => (s += `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="#ebecee"/><text x="${L - 6}" y="${Y(t) + 3}" text-anchor="end" class="hx-mct">${NX.financeChartShortEuro(t)}</text>`));
    PRO.monthly.forEach((v, i) => (s += `<rect x="${X(i) - bw / 2}" y="${Yb(v)}" width="${bw}" height="${H - B - Yb(v)}" rx="3" fill="#2a78d6" opacity=".28" data-tip="${e(`${months[i]} 2026|Encaissé : ${NX.financeBudgetEuro(v)}|Cumul : ${NX.financeBudgetEuro(cumul[i])}`)}"/>`));
    s += `<path d="${cumul.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="#2a78d6" stroke-width="2.2"/>`;
    cumul.forEach((v, i) => (s += `<circle cx="${X(i)}" cy="${Y(v)}" r="3" fill="#2a78d6" stroke="#fff" stroke-width="1.5"/>`));
    [[PRO.seuil, "Seuil de franchise", "#c0392b"], [PRO.majore, "Seuil majoré", "#7a1f16"]].forEach(([v, l, c]) => (s += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${c}" stroke-width="1.4" stroke-dasharray="6 4"/><text x="${W - R + 6}" y="${Y(v) + 4}" class="hx-mct" style="fill:${c};font-weight:600">${l} ${NX.financeChartShortEuro(v)}</text>`));
    s += `<text x="${X(9) + 8}" y="${Y(cum) - 6}" class="hx-mcv">${NX.financeBudgetEuro(cum)} encaissés</text>`;
    months.forEach((m, i) => (s += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="hx-mct">${m}</text>`));
    return s + "</svg>";
  }
  function argent() {
    const tab = S.atab, b = D.budget, bp = K.budgetPace();
    const tabs = `<div class="hx-tabs">${[["mois", "Mois"], ["patrimoine", "Patrimoine"], ["pro", "Pro"], ["operations", "Opérations"]].map(([id, l]) => `<button type="button" data-atab="${id}" aria-selected="${tab === id}">${l}</button>`).join("")}</div>`;
    let body = "";
    if (tab === "mois") {
      const M = MONTHS[S.amonth], G = monthGraph(M), C = cumulCharts(M), todo = b.toCategorize.filter((x) => !S.categorized[x.id]);
      const income = M.income.reduce((a, x) => a + x[2], 0), spent = G.links.filter((l) => l.source.startsWith("account:")).reduce((a, l) => a + l.value, 0);
      body = `<div class="hx-mhead2"><div class="hx-nav2"><button type="button" data-amonth="sept" aria-label="Mois précédent" ${S.amonth === "sept" ? "disabled" : ""}>‹</button><b>${M.label}${S.amonth === "oct" ? " · au 5" : ""}</b><button type="button" data-amonth="oct" aria-label="Mois suivant" ${S.amonth === "oct" ? "disabled" : ""}>›</button></div>
        <div class="hx-mk"><div><small>Revenus</small><b>${NX.financeBudgetEuro(income)}</b></div><div><small>Dépenses</small><b>${NX.financeBudgetEuro(spent)}</b></div><div><small>Solde du mois</small><b class="hx-green">${NX.financeBudgetEuro(income - spent)}</b></div>${S.amonth === "oct" ? `<div><small>Reste à dépenser</small><b>${K.euro(bp.left)}</b><span class="hx-dim">${K.euro(bp.perDay)} / jour</span></div><div class="is-wide"><small>Rythme du budget · ${K.euro(b.spent)} sur ${K.euro(b.total)}</small><span class="hx-pace"><i style="width:${Math.round(b.spent / b.total * 100)}%"></i><b style="left:${Math.round(b.dayOfMonth / b.daysInMonth * 100)}%"></b></span><span class="${bp.ahead > 0 ? "hx-red" : "hx-green"}">${bp.ahead > 0 ? K.euro(bp.ahead) + " au-dessus du rythme" : "dans le rythme"}</span></div>` : `<div><small>Budget</small><b>${NX.financeBudgetEuro(C.budgetTotal)}</b><span class="hx-dim">${NX.financeBudgetEuro(C.budgetTotal - spent)} non dépensés</span></div>`}</div></div>
        <section class="hx-tile"><header class="hx-th"><h2>Flux du mois</h2><small class="hx-dim">graphique Sankey de Nexora, à l'identique</small></header>${NXG.sankey(G, { title: "Sankey mensuel (flux)", period: M.label, height: 470 })}</section>
        <section class="hx-tile"><header class="hx-th"><h2>Budget cumulé par mois</h2><small class="hx-dim">par catégorie (aires empilées), face au budget et aux revenus réels · graphique de Nexora, à l'identique</small></header>${NXG.cumul(C, { height: 320 })}</section>
        <div class="hx-acols"><section class="hx-tile"><header class="hx-th"><h2>Budget par catégorie</h2><small class="hx-dim">trait : où vous devriez en être au ${b.dayOfMonth}</small></header>${b.categories.map((c) => { const pct = c.limit ? Math.round(c.spent / c.limit * 100) : 0; return `<div class="hx-bcat ${pct > 100 ? "is-over" : ""}"><span><i style="background:${c.color}"></i>${e(c.name)}</span><span class="hx-bmeter"><i style="width:${Math.min(100, pct)}%;background:${pct > 100 ? "#dc2626" : c.color}"></i><b style="left:${Math.round(b.dayOfMonth / b.daysInMonth * 100)}%"></b></span><span class="hx-num">${K.euro(c.spent)} <small>/ ${K.euro(c.limit)}</small></span><span class="hx-num ${pct > 100 ? "hx-red" : "hx-dim"}">${pct} %</span></div>`; }).join("")}</section>
          <section class="hx-tile"><header class="hx-th"><h2>À classer <span class="hx-badge">${todo.length}</span></h2></header>${todo.map((x) => `<div class="hx-txr"><span>${e(x.label)} <small class="hx-dim">${K.dateShort(x.date)}</small></span><span class="hx-num">${K.euro(x.amount, true)}</span><button type="button" class="hx-btn is-sm" data-cat="${x.id}:${x.suggest}">→ ${e(x.suggest)}</button></div>`).join("") || `<p class="hx-dim">Tout est classé.</p>`}</section></div>`;
    } else if (tab === "patrimoine") {
      const N = S.wN, last = WSERIES[WMAX - 1], prev = WSERIES[WMAX - 2], y = WSERIES[WMAX - 13], first = WSERIES[WMAX - N], sum = wsum;
      const t = sum(last), m1 = t - sum(prev), m12 = t - sum(y), mN = t - sum(first);
      const pct = (d, ref) => `${(d / sum(ref) * 100).toFixed(1).replace(".", ",")} %`, sgn = (d) => `${d >= 0 ? "+" : "−"}${K.euro(Math.abs(d))}`;
      body = `<div class="hx-wtop"><div class="hx-wcards">
          <div><small>Patrimoine</small><b>${K.euro(t)}</b><span class="hx-dim">au 5 oct. 2026</span></div>
          <div><small>Sur 1 mois</small><b class="${m1 >= 0 ? "hx-green" : "hx-red"}">${sgn(m1)}</b><span class="hx-dim">${pct(m1, prev)}</span></div>
          <div><small>Sur 12 mois</small><b class="${m12 >= 0 ? "hx-green" : "hx-red"}">${sgn(m12)}</b><span class="hx-dim">${pct(m12, y)}</span></div>
          ${N !== 12 ? `<div><small>Sur ${N} mois</small><b class="${mN >= 0 ? "hx-green" : "hx-red"}">${sgn(mN)}</b><span class="hx-dim">${pct(mN, first)}</span></div>` : ""}
          <div><small>Disponible</small><b>${K.euro(last["Comptes courants"] + last["Épargne réglementée"])}</b><span class="hx-dim">comptes + livrets</span></div>
          <div><small>Investi</small><b>${K.euro(last["Assurance-vie"] + last["Bourse"])}</b><span class="hx-dim">assurance-vie + bourse</span></div></div>
        <section class="hx-tile hx-wevo"><header class="hx-th"><h2>Évolution sur ${N} mois <small>par type de compte</small></h2><span class="hx-sleg">${TYPES.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join("")}</span><button type="button" class="hx-more is-plain" data-settings data-stab="patrimoine" title="Changer la durée dans les réglages">⚙ ${N} mois</button></header>${stackChart(N)}</section></div>
        <div class="hx-acols"><section class="hx-tile"><header class="hx-th"><h2>Structure du patrimoine</h2><small class="hx-dim">type › banque › compte · Sankey de Nexora</small></header>${NXG.sankey(wealthGraph(), { title: "Structure du patrimoine (Sankey)", period: "Soldes au 5 oct. 2026", height: 380 })}</section>
          <section class="hx-tile"><header class="hx-th"><h2>Comptes</h2></header><table class="hx-atab"><thead><tr><th>Compte</th><th>Banque</th><th>Solde</th><th>Part</th></tr></thead><tbody>${TYPES.map(([ty, c]) => `<tr class="is-grp"><th colspan="2"><i style="background:${c}"></i>${ty}</th><td class="hx-num">${K.euro(last[ty])}</td><td class="hx-num hx-dim">${Math.round(last[ty] / t * 100)} %</td></tr>${ACCOUNTS.filter((a) => a.type === ty).map((a) => `<tr><td>${e(a.name)}</td><td class="hx-dim">${e(a.bank)}</td><td class="hx-num">${K.euro(a.bal)}</td><td><span class="hx-bar"><i style="width:${a.bal / t * 100}%;background:${c}"></i></span></td></tr>`).join("")}`).join("")}</tbody></table></section></div>`;
    } else if (tab === "pro") {
      const enc = PRO.monthly.reduce((a, v) => a + v, 0), open = PRO.invoices.filter((i) => i.status === "issued" || i.status === "late"), late = PRO.invoices.filter((i) => i.status === "late"), sent = PRO.quotes.filter((q) => q.status === "sent");
      body = `<div class="hx-mk"><div class="is-wide"><small>Chiffre d'affaires encaissé 2026 · franchise en base de TVA</small><span class="hx-pace is-pro"><i style="width:${(enc / PRO.majore * 100).toFixed(1)}%"></i><b style="left:${(PRO.seuil / PRO.majore * 100).toFixed(1)}%"></b></span><span><b>${NX.financeBudgetEuro(enc)}</b> <span class="hx-dim">· ${Math.round(enc / PRO.seuil * 100)} % du seuil de ${NX.financeBudgetEuro(PRO.seuil)} · majoré ${NX.financeBudgetEuro(PRO.majore)}</span></span></div><div><small>À encaisser</small><b>${NX.financeBudgetEuro(open.reduce((a, i) => a + i.amount, 0))}</b><span class="hx-dim">${open.length} factures émises</span></div><div><small>En retard</small><b class="hx-red">${NX.financeBudgetEuro(late.reduce((a, i) => a + i.amount, 0))}</b><span class="hx-dim">${late.length} facture</span></div><div><small>Devis envoyés</small><b>${NX.financeBudgetEuro(sent.reduce((a, q) => a + q.amount, 0))}</b><span class="hx-dim">${sent.length} en attente de réponse</span></div></div>
        <section class="hx-tile"><header class="hx-th"><h2>Encaissements 2026</h2><small class="hx-dim">barres : par mois · courbe : cumul face aux seuils de franchise</small></header>${proChart()}</section>
        <div class="hx-acols"><section class="hx-tile"><header class="hx-th"><h2>Factures</h2><button type="button" class="hx-more">+ Facture</button></header><table class="hx-atab"><thead><tr><th>N°</th><th>Client · objet</th><th>Échéance</th><th>Montant</th><th>Statut</th></tr></thead><tbody>${PRO.invoices.map((i) => `<tr><td class="hx-num">${i.n}</td><td><b>${e(i.client)}</b><br><small class="hx-dim">${e(i.obj)}</small></td><td class="hx-num ${i.status === "late" ? "hx-red" : ""}">${K.dateShort(i.due)}</td><td class="hx-num">${NX.financeBudgetEuro(i.amount)}</td><td>${badge(IST[i.status])}</td></tr>`).join("")}</tbody></table></section>
          <section class="hx-tile"><header class="hx-th"><h2>Devis</h2><button type="button" class="hx-more">+ Devis</button></header><table class="hx-atab"><thead><tr><th>N°</th><th>Client · objet</th><th>Validité</th><th>Montant</th><th>Statut</th></tr></thead><tbody>${PRO.quotes.map((q) => `<tr><td class="hx-num">${q.n}</td><td><b>${e(q.client)}</b><br><small class="hx-dim">${e(q.obj)}</small></td><td class="hx-num">${K.dateShort(q.valid)}</td><td class="hx-num">${NX.financeBudgetEuro(q.amount)}</td><td>${badge(QST[q.status])}</td></tr>`).join("")}</tbody></table></section></div>
        <section class="hx-tile"><header class="hx-th"><h2>Missions</h2></header><table class="hx-atab"><thead><tr><th>Client</th><th>Mission</th><th>Facturation</th><th>Facturé</th><th></th><th>Statut</th></tr></thead><tbody>${PRO.missions.map((m) => `<tr><td><b>${e(m.client)}</b></td><td>${e(m.name)}</td><td class="hx-dim">${e(m.mode)}</td><td class="hx-num">${NX.financeBudgetEuro(m.billed)} <small class="hx-dim">/ ${NX.financeBudgetEuro(m.budget)}</small></td><td style="width:18%"><span class="hx-bar"><i style="width:${Math.round(m.billed / m.budget * 100)}%;background:#2a78d6"></i></span></td><td>${badge(MST[m.status])}</td></tr>`).join("")}</tbody></table>
          <p class="hx-hint">Finance PRO garde ses 6 onglets : Synthèse, Clients &amp; missions, Vue mission, Factures &amp; encaissements, Dépenses &amp; justificatifs, Trésorerie &amp; prévisions. Le livre des recettes reste dans Factures.</p></section>`;
    } else {
      const f = S.of, list = applyOF(OPS, f), out = list.filter((o) => o.sens === "Dépense").reduce((x, o) => x - o.amount, 0), inc = list.filter((o) => o.sens === "Revenu").reduce((x, o) => x + o.amount, 0);
      const chips = OFIELDS.map(([k, l, get]) => { const opts = [...new Set(OPS.map(get))].sort(); return `<span class="hx-fchip-w"><button type="button" class="hx-fchip ${f[k].size ? "is-on" : ""}" data-ofpop="${k}" aria-expanded="${S.ofpop === k}">${l}${f[k].size ? ` <b>${f[k].size}</b>` : ""} ▾</button>${S.ofpop === k ? `<div class="hx-pop is-f" role="dialog" aria-label="${l}">${opts.map((v) => `<label><input type="checkbox" data-ofset="${k}|${e(v)}" ${f[k].has(v) ? "checked" : ""}>${e(v)} <small class="hx-dim">${OPS.filter((o) => get(o) === v).length}</small></label>`).join("")}<footer><button type="button" class="hx-more" data-ofall="${k}">Tout décocher</button></footer></div>` : ""}</span>`; }).join("");
      const parts = OFIELDS.filter(([k]) => f[k].size).map(([k, l]) => `${l.toLowerCase()} : ${[...f[k]].join(", ")}`);
      if (f.from || f.to) parts.push(`du ${f.from ? K.dateShort(f.from) : "début"} au ${f.to ? K.dateShort(f.to) : "aujourd'hui"}`);
      if (f.min !== "" || f.max !== "") parts.push(`montant ${f.min !== "" ? "≥ " + f.min + " €" : ""}${f.min !== "" && f.max !== "" ? " et " : ""}${f.max !== "" ? "≤ " + f.max + " €" : ""}`);
      if (f.q) parts.push(`« ${e(f.q)} »`);
      body = `<div class="hx-fbar"><label class="hx-fsearch"><span aria-hidden="true">⌕</span><input id="hx-aq" data-ofq value="${e(f.q)}" placeholder="Libellé, catégorie, compte" aria-label="Rechercher une opération" autocomplete="off"></label>${chips}
          <span class="hx-frange"><label>Du <input type="date" data-ofv="from" value="${f.from}" min="2026-09-01" max="${TODAY}"></label><label>au <input type="date" data-ofv="to" value="${f.to}" min="2026-09-01" max="${TODAY}"></label></span>
          <span class="hx-frange"><label>Montant ≥ <input type="number" data-ofv="min" value="${f.min}" min="0" step="1" placeholder="0"> €</label><label>≤ <input type="number" data-ofv="max" value="${f.max}" min="0" step="1" placeholder="∞"> €</label></span>
          <p class="hx-fsum"><b>${list.length} opération${list.length > 1 ? "s" : ""}</b> · ${parts.length ? parts.join(" · ") : "aucun filtre"} · dépenses ${NX.financeBudgetEuro(out)} · revenus ${NX.financeBudgetEuro(inc)}${parts.length ? ` <button type="button" class="hx-more" data-ofclear>Réinitialiser</button>` : ""} · <button type="button" class="hx-more">Exporter en CSV</button></p></div>
        <div class="hx-tile hx-ops"><table class="hx-atab"><thead><tr><th>Date</th><th>Libellé</th><th>Compte</th><th>Banque</th><th>Moyen</th><th>Catégorie</th><th>Périmètre</th><th>Montant</th></tr></thead><tbody>${list.map((o) => { const cat = opCat(o), tc = o.tc && D.budget.toCategorize.find((y) => y.id === o.tc); return `<tr><td class="hx-num hx-dim">${K.dateShort(o.date)}</td><td>${e(o.label)}</td><td>${e(o.account)}</td><td class="hx-dim">${e(o.bank)}</td><td class="hx-dim">${e(o.mode)}</td><td>${cat ? `<span class="hx-catc" ${CATCOL[cat] ? `style="--cc:${CATCOL[cat]}"` : ""}>${e(cat)}</span>` : `<button type="button" class="hx-btn is-sm" data-cat="${tc.id}:${tc.suggest}">À classer → ${e(tc.suggest)}</button>`}</td><td class="hx-dim">${o.scope}</td><td class="hx-num ${o.amount > 0 ? "hx-green" : ""}">${K.euro(o.amount, true)}</td></tr>`; }).join("") || `<tr><td colspan="8" class="hx-empty">Aucune opération ne correspond aux filtres.</td></tr>`}</tbody></table></div>`;
    }
    return `<main class="hx-main hx-argent" data-scroll><div class="hx-hello hx-row"><div><h1>Argent</h1><p>Budget personnel (KDM360), patrimoine et activité pro. Côté budget, la seule écriture possible reste le classement d'une opération, comme dans Nexora.</p></div>${tabs}</div>${body}</main>`;
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

  // ------------------------------------------------------------ réglages
  // Réglages › Thèmes d'habitudes : une couleur par habitude (habit.color dans Nexora).
  const HPALETTE = ["#16a34a", "#0f9d76", "#0284c7", "#2563eb", "#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#d97706", "#64748b", "#18263d"];
  const STABS = [["habitudes", "Thèmes d'habitudes"], ["accueil", "Accueil"], ["patrimoine", "Patrimoine"], ["", "Vues affichées"], ["", "Objectifs sport"], ["", "Catégories budget"], ["", "Intégrations"], ["", "Raccourcis"]];
  function settings() {
    if (!S.settings) return "";
    let body;
    if (S.stab === "accueil") body = `<p class="hx-hint">Disposition de la tuile Journée de l'accueil.</p>
      <label class="hx-sopt"><input type="checkbox" data-homepx ${S.homePx ? "checked" : ""}><span><b>Pixels au cœur du cadran</b><small>Pixel des tâches et pixel des habitudes. Leur taille s'adapte au nombre d'habitudes ; décoché, le cadran n'affiche que les deux compteurs et les pixels restent dans la vue Journée.</small></span></label>`;
    else if (S.stab === "patrimoine") body = `<p class="hx-hint">Durée de l'évolution affichée dans Argent › Patrimoine.</p>
      <div class="hx-sopt"><span><b>Évolution sur N mois</b><small>Les cartes « Sur 1 mois » et « Sur 12 mois » restent affichées ; une carte « Sur N mois » s'ajoute quand N diffère de 12.</small></span><div class="hx-seg is-sm">${WN_OPTS.map((n) => `<button type="button" data-wn="${n}" aria-pressed="${S.wN === n}">${n} mois</button>`).join("")}</div></div>`;
    else body = `<p class="hx-hint">Chaque habitude garde sa couleur partout : anneau du cadran, pixel du jour, grilles et liaisons.</p>
      ${THEMES.map((t) => `<h3><i style="background:${t.color}"></i>${e(t.name)} <small>${t.mode === "single" ? "un seul choix" : "plusieurs possibles"}</small></h3>${t.habits.map((h) => { const cur = hc({ ...h, theme: t }); return `<div class="hx-hset"><span class="hx-hname"><i class="hx-hdot" style="background:${cur}"></i>${e(h.name)}</span><span class="hx-swatches">${HPALETTE.map((c) => `<button type="button" data-hcol="${h.id}|${c}" class="${c === cur ? "is-on" : ""}" style="background:${c}" aria-label="Couleur ${c} pour ${e(h.name)}"></button>`).join("")}<input type="color" data-hpick="${h.id}" value="${cur}" aria-label="Autre couleur pour ${e(h.name)}"></span>${S.hcolors[h.id] ? `<button type="button" class="hx-more" data-hreset="${h.id}">Couleur du thème</button>` : `<span class="hx-dim">couleur du thème</span>`}</div>`; }).join("")}`).join("")}`;
    return `<div class="hx-scrim" data-settings></div><section class="hx-settings" role="dialog" aria-label="Réglages"><header class="hx-th"><h2>Réglages</h2><button type="button" class="hx-x" data-settings aria-label="Fermer">×</button></header>
      <nav class="hx-stabs">${STABS.map(([id, l]) => (id ? `<button type="button" data-stab="${id}" class="${S.stab === id ? "is-on" : ""}">${l}</button>` : `<span title="Réglage de Nexora, non simulé ici">${l}</span>`)).join("")}</nav>
      <div class="hx-sbody">${body}<p class="hx-hint is-foot">Les onglets grisés reprennent les réglages de Nexora (12 onglets) ; ils ne sont pas simulés ici.</p></div></section>`;
  }

  // ------------------------------------------------------- glisser-déposer
  // Déplacer une tâche (dates décalées), étirer un bord (début ou fin), ou la
  // déposer sur la portée d'un autre projet (projet modifié). Annulable.
  let drag = null;
  document.addEventListener("pointerdown", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-drag]"); if (!el || ev.button !== 0) return;
    const track = el.closest("[data-rs]"); if (!track) return;
    const t = K.task(el.dataset.drag); if (!t) return;
    const rb = el.getBoundingClientRect(), tr = track.getBoundingClientRect(), x = ev.clientX;
    const mode = t.milestone ? "move" : x - rb.left < 8 ? "start" : rb.right - x < 8 ? "end" : "move";
    drag = { id: t.id, el, mode, x0: x, y0: ev.clientY, dayPx: tr.width / Number(track.dataset.rn), left: el.offsetLeft, width: el.offsetWidth, moved: false, lane: null };
    el.setPointerCapture && el.setPointerCapture(ev.pointerId);
    el.classList.add("is-dragging");
  });
  document.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const dx = ev.clientX - drag.x0, dd = Math.round(dx / drag.dayPx), t = K.task(drag.id);
    if (Math.abs(dx) > 3 || Math.abs(ev.clientY - drag.y0) > 6) drag.moved = true;
    if (!drag.moved) return;
    const el = drag.el;
    if (drag.mode === "move") el.style.transform = `translate(${dd * drag.dayPx}px, ${ev.clientY - drag.y0}px)`;
    else if (drag.mode === "start") { el.style.left = drag.left + dd * drag.dayPx + "px"; el.style.width = Math.max(drag.dayPx, drag.width - dd * drag.dayPx) + "px"; }
    else el.style.width = Math.max(drag.dayPx, drag.width + dd * drag.dayPx) + "px";
    const under = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.dataset && n.dataset.laneProject);
    document.querySelectorAll(".hx-lane.is-drop").forEach((n) => n.classList.remove("is-drop"));
    drag.lane = drag.mode === "move" && under && under.dataset.laneProject !== t.projectId ? under.dataset.laneProject : null;
    if (drag.lane) under.classList.add("is-drop");
    const ns = drag.mode === "end" ? t.start : K.addDays(t.start, dd), ne = drag.mode === "start" ? t.end : K.addDays(t.end, dd);
    drag.dd = dd;
    NXG.pointerTip(`<div class="nx-bch-tip"><strong>${e(t.title)}</strong><div><span>${drag.mode === "move" ? "Déplacer" : drag.mode === "start" ? "Nouveau début" : "Nouvelle fin"}</span><span>${dd > 0 ? "+" : ""}${dd} j</span></div><div><span>${t.milestone ? "Jalon" : "Dates"}</span><span>${t.milestone ? K.dateShort(ne) : `${K.dateShort(ns > ne ? ne : ns)} → ${K.dateShort(ne)}`}</span></div>${drag.lane ? `<div><span>Nouveau projet</span><span>${e(proj(drag.lane).name)}</span></div>` : ""}</div>`, ev.clientX, ev.clientY);
  });
  document.addEventListener("pointerup", () => {
    if (!drag) return;
    const d0 = drag; drag = null; NXG.pointerTip(null);
    document.querySelectorAll(".hx-lane.is-drop").forEach((n) => n.classList.remove("is-drop"));
    d0.el.classList.remove("is-dragging");
    if (!d0.moved) return;
    S.justDragged = true; setTimeout(() => (S.justDragged = false), 0);
    const t = K.task(d0.id), dd = d0.dd || 0;
    if (!dd && !d0.lane) { render(); return; }
    S.undo = { id: t.id, start: t.start, end: t.end, projectId: t.projectId };
    if (d0.mode === "move") { t.start = K.addDays(t.start, dd); t.end = K.addDays(t.end, dd); }
    else if (d0.mode === "start") { t.start = K.addDays(t.start, dd); if (t.start > t.end) t.start = t.end; }
    else { t.end = K.addDays(t.end, dd); if (t.end < t.start) t.end = t.start; }
    if (d0.lane) t.projectId = d0.lane;
    S.toast = `« ${t.title} » ${t.milestone ? "le " + K.dateShort(t.end) : `du ${K.dateShort(t.start)} au ${K.dateShort(t.end)}`}${d0.lane ? " · déplacée dans " + proj(d0.lane).name : ""} (démo)`;
    render();
  });

  // Infobulle commune : tout élément portant data-tip (« titre|ligne|ligne »).
  document.addEventListener("mousemove", (ev) => {
    if (drag || !window.NXG) return;
    if (ev.target.closest && ev.target.closest("[data-nxg]")) return;
    const el = ev.target.closest && ev.target.closest("[data-tip]");
    if (!el) { if (S && S.tipOn) { S.tipOn = false; NXG.pointerTip(null); } return; }
    const [h, ...rest] = el.getAttribute("data-tip").split("|");
    S.tipOn = true;
    NXG.pointerTip(`<div class="nx-bch-tip"><strong>${e(h)}</strong>${rest.map((x) => `<div><span>${e(x)}</span></div>`).join("")}</div>`, ev.clientX, ev.clientY);
  });

  // ----------------------------------------------------------------- rendu
  const SCREENS = { accueil, journee, planning, projets, corps, argent };
  function render() {
    const app = document.getElementById("hx-app");
    const sc = app.querySelector("[data-scroll]"), keep = sc ? sc.scrollTop : 0, same = app.dataset.screen === S.screen;
    app.dataset.screen = S.screen;
    if (window.NXG) NXG.reset();
    app.innerHTML = topbar() + `<div class="hx-body ${S.taskId ? "has-panel" : ""}">${SCREENS[S.screen]()}${panel()}</div>` + composer() + settings() + (S.toast ? `<div class="hx-toast" role="status">${e(S.toast)}${S.undo ? ` <button type="button" data-undo>Annuler</button>` : ""}</div>` : "");
    if (window.NXG) NXG.mount(app);
    // Ruban : titre sorti à droite quand il ne tient pas dans la barre.
    app.querySelectorAll(".gs-ruban:not(.is-row) .g-lab").forEach((l) => { if (l.scrollWidth > l.clientWidth + 1) l.closest(".hx-g").classList.add("lab-out"); });
    const sc2 = app.querySelector("[data-scroll]"); if (sc2 && same) sc2.scrollTop = keep;
    const f = app.querySelector("#hx-draft"); if (f && S.composer) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); }
    if (S.focus) { const g = app.querySelector("#" + S.focus); if (g) { g.focus(); g.setSelectionRange(g.value.length, g.value.length); } S.focus = ""; }
  }
  function go(screen, extra = {}) { S.screen = screen; S.toast = ""; S.composer = false; if (extra.project) S.projectId = extra.project; S.taskId = extra.task || (screen === "projets" && !extra.project ? S.taskId : null); render(); }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-nav],[data-task],[data-close],[data-done],[data-new],[data-hab],[data-cat],[data-append],[data-reset],[data-demo],[data-pop],[data-fpop],[data-fclear],[data-ftoggle],[data-fview],[data-zoom],[data-shift],[data-group],[data-collapse],[data-cmp],[data-cper],[data-cagg],[data-sagg],[data-gstyle],[data-settings],[data-hcol],[data-hreset],[data-undo],[data-csec],[data-atab],[data-amonth],[data-acat],[data-vsave],[data-vok],[data-vcancel],[data-vdel],[data-jgroup],[data-jcollapse],[data-stab],[data-wn],[data-ofpop],[data-ofclear],[data-ofall]");
    if (!el) { if (!ev.target.closest(".hx-pop") && (S.fpop || S.pop)) { S.fpop = ""; S.pop = ""; render(); } return; }
    const d = el.dataset;
    if (S.justDragged && (d.task || d.drag)) { S.justDragged = false; return; }
    if (d.reset !== undefined) { reset(); render(); return; }
    if (d.gstyle) { S.gstyle = d.gstyle; render(); return; }
    if (d.vsave) { S.vname = ""; S.vscope = d.vsave; S.focus = "hx-vname"; render(); return; }
    if (d.vok) { const i = document.getElementById("hx-vname"); saveView(d.vok, i ? i.value.trim() : ""); render(); return; }
    if (d.vcancel !== undefined) { S.vname = null; render(); return; }
    if (d.vdel) { const [sc, id] = d.vdel.split("|"); S.saved = S.saved.filter((v) => v.id !== id); storeViews(); S.vsel[sc] = ""; S.toast = "Vue supprimée"; render(); return; }
    if (d.jgroup) { S.jgroup = d.jgroup; S.jcol = new Set(); render(); return; }
    if (d.jcollapse) { if (S.jcol.has(d.jcollapse)) S.jcol.delete(d.jcollapse); else S.jcol.add(d.jcollapse); render(); return; }
    if (d.stab) { S.stab = d.stab; if (d.settings !== undefined) S.settings = true; render(); return; }
    if (d.wn) { S.wN = Number(d.wn); render(); return; }
    if (d.ofpop) { S.ofpop = S.ofpop === d.ofpop ? "" : d.ofpop; render(); return; }
    if (d.ofclear !== undefined) { S.of = OF0(); S.ofpop = ""; render(); return; }
    if (d.ofall) { S.of[d.ofall].clear(); render(); return; }
    if (d.settings !== undefined) { S.settings = !S.settings; render(); return; }
    if (d.hcol) { const [h, c] = d.hcol.split("|"); S.hcolors[h] = c; render(); return; }
    if (d.hreset) { delete S.hcolors[d.hreset]; render(); return; }
    if (d.undo !== undefined && S.undo) { const u = S.undo, t = K.task(u.id); if (t) Object.assign(t, { start: u.start, end: u.end, projectId: u.projectId }); S.undo = null; S.toast = `« ${t.title} » : modification annulée`; render(); return; }
    if (d.pop !== undefined) { S.pop = S.pop === d.pop ? "" : d.pop; S.fpop = ""; render(); return; }
    if (d.fpop) { S.fpop = S.fpop === d.fpop ? "" : d.fpop; S.pop = ""; render(); return; }
    if (d.fclear) { S.filter[d.fclear].clear(); S.fview = ""; S.vsel = {}; render(); return; }
    if (d.ftoggle) { S.filter[d.ftoggle] = !S.filter[d.ftoggle]; S.fview = ""; S.vsel = {}; render(); return; }
    if (d.fview) { const v = VIEWS.find((x) => x[0] === d.fview); S.filter = v[2](); S.fview = d.fview; S.fpop = ""; S.vsel = {}; render(); return; }
    if (d.zoom) { const [sc, z] = d.zoom.split("|"); if (sc === "planning") { S.pz = z; S.po = 0; } else { S.jz = z; S.jo = 0; } render(); return; }
    if (d.shift) { const [sc, v] = d.shift.split("|"); const k = sc === "planning" ? "po" : "jo"; S[k] = v === "0" ? 0 : S[k] + Number(v); render(); return; }
    if (d.group) { S.pgroup = d.group; render(); return; }
    if (d.collapse) { if (S.collapsed.has(d.collapse)) S.collapsed.delete(d.collapse); else S.collapsed.add(d.collapse); render(); return; }
    if (d.cmp) { S.cmp = d.cmp; render(); return; }
    if (d.cper) { S.cper = Number(d.cper); render(); return; }
    if (d.cagg) { S.cagg = d.cagg; render(); return; }
    if (d.sagg) { S.sagg = d.sagg; render(); return; }
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
    if (ds.fset) { const [k, id] = ds.fset.split("|"); const set = S.filter[k]; if (set.has(id)) set.delete(id); else set.add(id); S.fview = ""; S.vsel = {}; render(); return; }
    if (ds.vsel) { if (ev.target.value) applyView(ds.vsel, ev.target.value); else S.vsel[ds.vsel] = ""; render(); return; }
    if (ds.ofset) { const [k, id] = ds.ofset.split("|"); const set = S.of[k]; if (set.has(id)) set.delete(id); else set.add(id); render(); return; }
    if (ds.ofv) { S.of[ds.ofv] = ev.target.value; render(); return; }
    if (ds.homepx !== undefined) { S.homePx = ev.target.checked; render(); return; }
    if (ds.show) { S.show[ds.show] = ev.target.checked; render(); return; }
    if (ds.hpick) { S.hcolors[ds.hpick] = ev.target.value; render(); return; }
    const m = ds.metric; if (!m) return; const [scope, k] = m.split("|"); const set = S.metrics[scope]; if (set.has(k)) set.delete(k); else set.add(k); render(); });
  document.addEventListener("input", (ev) => {
    if (ev.target.matches("[data-fq]")) { S.filter.q = ev.target.value; S.fview = ""; S.focus = "hx-fq"; render(); return; }
    if (ev.target.matches("[data-aq]")) { S.aq = ev.target.value; S.focus = "hx-aq"; render(); return; }
    if (ev.target.matches("[data-vname]")) { S.vname = ev.target.value; return; }
    if (ev.target.matches("[data-ofq]")) { S.of.q = ev.target.value; S.focus = "hx-aq"; render(); return; }
  });
  document.addEventListener("input", (ev) => { if (ev.target.matches("[data-draft]")) { S.draft = ev.target.value; document.querySelectorAll("[data-preview]").forEach((p) => (p.innerHTML = K.previewHtml(S.draft))); } });
  document.addEventListener("submit", (ev) => { if (!ev.target.matches("[data-compose]")) return; ev.preventDefault(); const t = K.createFromDraft(S.draft); if (!t) return; S.composer = false; S.draft = ""; S.toast = `Tâche « ${t.title} » créée dans ${proj(t.projectId).name} (démo, rien n'est enregistré)`; render(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.target.matches && ev.target.matches("[data-vname]")) { if (ev.key === "Enter") { saveView(S.vscope, ev.target.value.trim()); render(); } else if (ev.key === "Escape") { S.vname = null; render(); } return; }
    if (ev.key === "Escape" && (S.composer || S.taskId)) { S.composer = false; S.taskId = null; render(); }
  });

  function boot() {
    reset();
    const h = (location.hash || "").slice(1);
    if (SCREENS[h]) S.screen = h;
    render();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
