// Rendu des graphiques Sankey et « Budget cumulé par mois » de Nexora, sans React.
// Transcription ligne à ligne de FinanceSankeyChart (part-003 l. 36281) et de
// FinanceCumulCategories / FinanceCumulAxes / FinanceCumulRefLines /
// FinanceCumulEndLabels / FinanceCumulHit / FinanceCumulTip / FinanceCumulLegend
// (part-003 l. 38419 à 38549). Les calculs (mise en page, ordonnancement,
// formats, palette, graduations) viennent tels quels de nexora-extrait.js.
// Mêmes marques SVG, mêmes classes, mêmes opacités, même infobulle.
(function () {
  "use strict";
  const NX = window.NX;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const REG = new Map();
  let seq = 0;

  // Styles de Nexora, injectés une fois (+ infobulle .lp-pie-tooltip, part-001 l. 1456 ;
  // --ink de la couche life = #18263d).
  function styles() {
    if (document.getElementById("nx-graph-css")) return;
    const st = document.createElement("style");
    st.id = "nx-graph-css";
    st.textContent = NX.FINANCE_SANKEY_CSS + NX.FINANCE_BUDGET_CHART_CSS + NX.FINANCE_BUDGET_CUMUL_CSS +
      ".lp-pie-tooltip{ background:var(--ink, #18263d); color:#fff; font-size:11.5px; font-weight:600; padding:5px 9px; border-radius:7px; pointer-events:none; z-index:200; box-shadow:0 4px 12px rgba(10,15,25,0.25); }" +
      ".nx-ptr-tip{position:fixed;left:0;top:0}";
    document.head.appendChild(st);
  }

  // ------------------------------------------------------------------ Sankey
  function sankey(graph, opts) {
    const id = "nxs" + ++seq;
    REG.set(id, { kind: "sankey", graph, title: opts.title, period: opts.period, config: { ...NX.FINANCE_SANKEY_DEFAULT_CONFIG, ...(opts.config || {}) }, height: opts.height || 470, showData: false });
    return `<div class="nx-sankey" data-nxg="${id}" style="height:${opts.height || 470}px"><div class="sankey-figure"></div><div class="sankey-footer"><span title="Même échelle pour les revenus, les comptes et les dépenses. Les comptes représentent le maximum des entrées et sorties ; les espaces libres indiquent leur différence.">Échelle commune · hauteurs proportionnelles aux montants</span><button type="button" data-nxdata="${id}" aria-pressed="false">Données</button></div></div>`;
  }
  function drawSankey(el, R) {
    const fig = el.querySelector(".sankey-figure");
    const r = fig.getBoundingClientRect();
    const m = NX.financeSankeyLayout(R.graph, r.width || 900, r.height || 470);
    const byId = new Map(m.nodes.map((n) => [n.id, n]));
    const config = R.config, uid = el.dataset.nxg;
    const opacity = Math.min(1, Math.max(0.1, NX.financeSankeyNumber(config, "flowOpacity", 0.52)));
    const showValues = config.sankeyShowValues !== false && config.labelMode !== "none";
    const lastCol = R.graph.columns.length - 1;
    const money = (value, maxWidth = 120, fontSize = m.valueFont) => {
      const full = NX.financeSankeyRound(value, "€", 0, NX.financeSankeyText(config, "rounding", "auto")) + " €";
      if (NX.financeSankeyMeasure(full, fontSize, 500) <= maxWidth) return full;
      const short = NX.financeSankeyRound(value, "€", 0, "compact") + " €";
      return NX.financeSankeyMeasure(short, fontSize, 500) <= maxWidth ? short : "";
    };
    let s = `<svg viewBox="0 0 ${m.width} ${m.height}" preserveAspectRatio="xMidYMid meet" class="sankey-svg sankey-svg-v3" role="group" aria-label="${esc(R.title + " · " + R.graph.columns.join(" → "))}" style="${R.showData ? "display:none" : ""}"><style>${NX.FINANCE_SANKEY_SVG_CSS}</style><desc>Échelle monétaire commune aux colonnes. Les hauteurs des piliers et des rubans sont proportionnelles aux montants réels.</desc><defs>`;
    m.links.forEach((l, i) => { s += `<linearGradient id="${uid}-flow-${i}" gradientUnits="userSpaceOnUse" x1="${byId.get(l.source).x1}" x2="${byId.get(l.target).x0}"><stop stop-color="${byId.get(l.source).color}"/><stop offset="100%" stop-color="${byId.get(l.target).color}"/></linearGradient>`; });
    s += `</defs><g class="sankey-column-totals">`;
    m.columns.forEach((col, i) => {
      const room = ((m.columns[i + 1] && m.columns[i + 1].x) ?? m.width) - col.x - 8;
      const label = money(col.value, room, 15);
      const wrap = col.name.length * 6 + 10 + NX.financeSankeyMeasure(label, 15, 700) > room;
      s += `<g transform="translate(${col.x},17)"><text fill="#60717c" font-family="Segoe UI,Arial,sans-serif" font-size="9" font-weight="700" letter-spacing=".08em">${esc(col.name)}</text>`;
      if (showValues) s += `<text x="${wrap ? 0 : col.name.length * 6 + 10}" y="${wrap ? 19 : 1}" fill="#14232d" font-family="Segoe UI,Arial,sans-serif" font-size="15" font-weight="700">${esc(label)}</text>`;
      if (i === lastCol) s += `<text x="0" y="${wrap ? 34 : 19}" fill="${m.columns[0].value - col.value > 0 ? "var(--health)" : "var(--danger)"}" font-family="Segoe UI,Arial,sans-serif" font-size="10" font-weight="700">${esc("Solde du mois : " + NX.financeSankeyFormat(m.columns[0].value - col.value, "€", 0))}</text>`;
      s += `</g>`;
    });
    s += `</g><g class="sankey-ribbons">`;
    m.links.forEach((l, i) => { const label = byId.get(l.source).name + " → " + byId.get(l.target).name + " · " + NX.financeSankeyFormat(l.value, "€", 0); s += `<path class="b360-flow-ribbon" data-link="${i}" d="${l.path}" fill="url(#${uid}-flow-${i})" fill-opacity="${opacity}" style="mix-blend-mode:multiply" tabindex="0" role="button" aria-label="${esc(label)}"><title>${esc(label)}</title></path>`; });
    s += `</g><g class="sankey-nodes">`;
    m.nodes.forEach((n) => {
      const last = n.col === lastCol, mid = (n.y0 + n.y1) / 2, ly = n.labelY;
      const elbowX = last ? n.x1 + 10 : n.x0 - 10, textX = last ? elbowX + 12 : elbowX - 12, swatchX = last ? elbowX : elbowX - 7, anchor = last ? "start" : "end";
      const leftBound = n.col ? m.columns[n.col - 1].x + (n.x1 - n.x0) + 10 : 0;
      const room = last ? m.width - textX - 6 : textX - leftBound - 6;
      const label = n.name + " · " + NX.financeSankeyFormat(n.value, "€", 0);
      s += `<g class="b360-flow-node" data-node-id="${esc(n.id)}" opacity="1" tabindex="0" role="button" aria-label="${esc(label)}"><rect x="${n.x0}" y="${n.y0}" width="${n.x1 - n.x0}" height="${Math.max(0, n.y1 - n.y0)}" rx="2" fill="${n.color}" stroke="#fff" stroke-width=".7"/><title>${esc(label)}</title><g class="sankey-label-group">`;
      if (Math.abs(ly - mid) > 1) s += `<path d="M${last ? n.x1 : n.x0},${mid} H${elbowX + (last ? -3 : 3)} V${ly}" fill="none" stroke="${n.color}" stroke-width=".9" opacity=".75"/>`;
      s += `<rect x="${swatchX}" y="${ly - 6}" width="7" height="7" rx="2" fill="${n.color}"/><text class="b360-flow-label b360-flow-name" x="${textX}" y="${ly - 2}" text-anchor="${anchor}" font-size="${m.font}">${esc(NX.financeSankeyTruncate(n.name, room, m.font))}</text>`;
      if (showValues) s += `<text class="b360-flow-label b360-flow-value" x="${textX}" y="${ly + m.valueFont + 2}" text-anchor="${anchor}" font-size="${m.valueFont}">${esc(money(n.value, room))}</text>`;
      s += `</g></g>`;
    });
    s += `</g></svg>`;
    if (R.showData) s += `<div class="sankey-data"><table><thead><tr><th>Origine</th><th>Destination</th><th>Montant · €</th></tr></thead><tbody>${m.links.map((l) => `<tr><td>${esc(byId.get(l.source).name)}</td><td>${esc(byId.get(l.target).name)}</td><td class="numeric">${esc(NX.financeSankeyFormat(l.value, "", 0))}</td></tr>`).join("")}</tbody></table></div>`;
    s += `<div class="sankey-tooltip os-tooltip" role="tooltip" hidden></div>`;
    fig.innerHTML = s;
    R.m = m; R.byId = byId; R.size = { width: r.width || 900, height: r.height || 470 }; R.opacity = opacity;
  }
  // Survol : rubans actifs à 0,9, autres à 0,1 ; nœuds sans lien à 0,14 ; infobulle.
  function sankeyHover(el, R, target, ev) {
    const svg = el.querySelector("svg"), tip = el.querySelector(".sankey-tooltip");
    if (!svg) return;
    const ribbons = svg.querySelectorAll(".b360-flow-ribbon"), nodes = svg.querySelectorAll(".b360-flow-node");
    if (!target) { ribbons.forEach((p) => p.setAttribute("fill-opacity", R.opacity)); nodes.forEach((g) => g.setAttribute("opacity", 1)); tip.hidden = true; return; }
    const m = R.m, byId = R.byId;
    const link = target.dataset.link != null ? m.links[Number(target.dataset.link)] : undefined;
    const node = target.dataset.nodeId ? byId.get(target.dataset.nodeId) : undefined;
    const related = new Set(link ? [link.source, link.target] : node ? [node.id, ...m.links.flatMap((l) => (l.source === node.id ? [l.target] : l.target === node.id ? [l.source] : []))] : []);
    ribbons.forEach((p, i) => { const l = m.links[i]; const active = link === l || (node && (node.id === l.source || node.id === l.target)); p.setAttribute("fill-opacity", active ? 0.9 : 0.1); });
    nodes.forEach((g) => g.setAttribute("opacity", related.has(g.dataset.nodeId) ? 1 : 0.14));
    const box = el.querySelector(".sankey-figure").getBoundingClientRect(), size = R.size;
    const tw = Math.min(285, size.width - 8), th = 150, gap = 16;
    const px = ev.clientX - box.x, py = ev.clientY - box.y;
    const fx = px + gap + tw > size.width - 4 ? px - gap - tw : px + gap, fy = py + gap + th > size.height - 4 ? py - gap - th : py + gap;
    tip.style.left = Math.max(4, Math.min(size.width - tw - 4, fx)) + "px"; tip.style.top = Math.max(4, Math.min(size.height - th, fy)) + "px";
    tip.innerHTML = `<div class="os-tooltip-title">${esc(R.title)}</div><div class="os-tooltip-context">${esc(node ? node.name : byId.get(link.source).name + " → " + byId.get(link.target).name)}</div><div class="os-tooltip-row"><span>Montant réel</span><span class="os-tooltip-value">${esc(NX.financeSankeyFormat(node ? node.value : link.value, "€", 0))}</span></div>${link ? `<div class="os-tooltip-row"><span>Part du nœud d’origine</span><span>${esc(NX.financeSankeyFormat(100 * link.value / byId.get(link.source).value, "%", 1))}</span></div>` : ""}<div class="os-tooltip-foot">${esc(R.period)}</div>`;
    tip.hidden = false;
  }

  // ------------------------------------------------------ Budget cumulé (aires)
  function cumul(charts, opts = {}) {
    const id = "nxc" + ++seq;
    const model = NX.financeCumulModel(charts);
    REG.set(id, { kind: "cumul", model, height: opts.height || 300 });
    const legend = `<div class="nx-bch-legend">${model.series.map((s) => `<span${s.other ? ` title="${esc(s.members.join(", "))}"` : ""}><i style="background:${s.color}"></i>${esc(s.category)}${s.other ? ` (${s.members.length})` : ""} · ${esc(NX.financeBudgetEuro(s.total))}</span>`).join("")}<span><i class="dash" style="border-color:${NX.FINANCE_CUMUL_INK.income}"></i>Revenus cumulés</span>${model.budgetTotal > 0 ? `<span><i class="dash" style="border-color:${NX.FINANCE_CUMUL_INK.over}"></i>Budget total</span>` : ""}</div>`;
    return `<div class="nx-bch" data-nxg="${id}" style="height:auto;overflow:visible;padding:0"><div class="nx-bcu-plot" style="height:${opts.height || 300}px;flex:none"></div>${legend}</div>`;
  }
  function drawCumul(el, R) {
    const plot = el.querySelector(".nx-bcu-plot"), box = { w: plot.clientWidth, h: plot.clientHeight };
    const { W, H } = NX.financeCumulPlotSize(box, 280), model = R.model, I = NX.FINANCE_CUMUL_INK;
    const last = model.days.length - 1, base = model.days.map(() => 0);
    const layers = model.series.map((s) => { const lower = [...base]; const upper = s.values.map((v, k) => (base[k] += v)); return { ...s, lower, upper }; });
    const f = NX.financeCumulFrame({ W, H, R: 150, top: Math.max(model.spent, model.budgetTotal, ...model.income) * 1.04, days: model.days });
    let s = `<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Dépenses cumulées par catégorie, revenus cumulés et budget total">`;
    // FinanceCumulAxes
    f.ticks.forEach((t) => { s += `<g><line x1="${f.L}" x2="${f.W - f.R}" y1="${f.y(t)}" y2="${f.y(t)}" stroke="${I.grid}"/><text x="${f.L - 5}" y="${f.y(t) + 3}" text-anchor="end">${esc(NX.financeChartShortEuro(t))}</text></g>`; });
    f.days.forEach((d, k) => { s += `<g><line x1="${f.x(k)}" x2="${f.x(k)}" y1="${f.H - f.B}" y2="${f.H - f.B + 3}" stroke="${I.axis}"/><text x="${f.x(k)}" y="${f.H - f.B + 13}" text-anchor="middle" style="font-size:${f.days.length > 31 ? 7 : 8.5}px">${Number(d.slice(8))}</text></g>`; });
    s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${f.H - f.B}" y2="${f.H - f.B}" stroke="${I.axis}"/>`;
    // Aires empilées, liseré blanc
    layers.forEach((L) => { s += `<path fill="${L.color}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" d="M ${L.upper.map((v, k) => `${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" L ")} L ${L.lower.map((v, k) => [k, v]).reverse().map(([k, v]) => `${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" L ")} Z"/>`; });
    // FinanceCumulRefLines (nommées)
    s += `<path d="${NX.financeCumulPath(model.income, f)}" fill="none" stroke="${I.income}" stroke-width="1.6" stroke-dasharray="5 4"/>`;
    if (model.budgetTotal > 0) s += `<line x1="${f.L}" x2="${f.W - f.R}" y1="${f.y(model.budgetTotal)}" y2="${f.y(model.budgetTotal)}" stroke="${I.over}" stroke-width="1.6" stroke-dasharray="6 4"/><text x="${f.L + 4}" y="${f.y(model.budgetTotal) - 4}" style="fill:${I.over};font-weight:600">Budget ${esc(NX.financeBudgetEuro(model.budgetTotal))}</text>`;
    if (last >= 0) s += `<text x="${f.L + 4}" y="${f.y(model.income[last]) - 4}" style="fill:${I.income};font-weight:600">Revenus ${esc(NX.financeBudgetEuro(model.income[last]))}</text>`;
    if (last >= 0) s += `<text x="${f.x(last) - 3}" y="${f.y(model.spent) - 5}" text-anchor="end" style="fill:${I.ink};font-weight:700;font-size:11px">${esc(NX.financeBudgetEuro(model.spent))}</text>`;
    // FinanceCumulEndLabels
    NX.financeCumulSpread(layers.map((L) => ({ key: L.category, y: f.y(L.upper[last] - L.total / 2), value: NX.financeBudgetEuro(L.total), label: L.category, swatch: L.color })), 12).forEach((it) => { s += `<g><rect x="${f.W - f.R + 4}" y="${it.y - 3}" width="4" height="6" rx="1" fill="${it.swatch}"/><text x="${f.W - f.R + 11}" y="${it.y + 3}" style="fill:${I.muted}"><tspan style="font-weight:650">${esc(it.value)}</tspan> ${esc(it.label)}</text></g>`; });
    // FinanceCumulHit
    s += `<line class="nxc-cursor" x1="0" x2="0" y1="${f.T}" y2="${f.H - f.B}" stroke="#0b0b0b" stroke-opacity=".3" visibility="hidden"/>`;
    f.days.forEach((d, k) => { s += `<rect data-k="${k}" x="${f.x(k) - f.step / 2}" y="${f.T}" width="${f.step}" height="${f.H - f.T - f.B}" fill="transparent"/>`; });
    plot.innerHTML = s + "</svg>";
    R.f = f;
  }
  // FinanceCumulTip : valeurs à la date, total, revenus, budget, reste ou dépassement.
  function cumulTip(R, k) {
    const model = R.model, budgetTotal = model.budgetTotal, spent = model.total[k], E = NX.financeBudgetEuro;
    let h = `<div class="nx-bch-tip"><strong>Au ${esc(NX.financeCumulDayLabel(model.days[k]))}</strong>`;
    model.series.filter((s) => s.values[k] > 0).forEach((s) => { h += `<div><span><i style="background:${s.color}"></i>${esc(s.category)}${s.daily[k] > 0 ? ` (+${esc(E(s.daily[k]))} ce jour)` : ""}</span><span>${esc(E(s.values[k]))}</span></div>`; });
    h += `<div><strong>Dépenses cumulées</strong><strong>${esc(E(spent))}</strong></div>`;
    if (model.dailyTotal[k] > 0) h += `<div><span>Dépensé ce jour</span><span>${esc(E(model.dailyTotal[k]))}</span></div>`;
    h += `<div><span><i class="dash" style="border-color:${NX.FINANCE_CUMUL_INK.income}"></i>Revenus cumulés</span><span>${esc(E(model.income[k]))}</span></div>`;
    if (budgetTotal > 0) h += `<div><span><i class="dash" style="border-color:${NX.FINANCE_CUMUL_INK.over}"></i>Budget total</span><span>${esc(E(budgetTotal))}</span></div>` + (budgetTotal >= spent ? `<div><span>Reste sur le budget</span><span>${esc(E(budgetTotal - spent))}</span></div>` : `<div><span style="color:#f3a3a6">Dépassement du budget</span><span style="color:#f3a3a6">${esc(E(spent - budgetTotal))}</span></div>`);
    return h + "</div>";
  }

  // Infobulle de pointeur (WidgetPointerTooltip, part-002 l. 10379).
  function pointerTip(html, x, y) {
    let t = document.getElementById("nx-ptr-tip");
    if (!html) { if (t) t.hidden = true; return; }
    if (!t) { t = document.createElement("div"); t.id = "nx-ptr-tip"; t.className = "lp-pie-tooltip nx-ptr-tip"; document.body.appendChild(t); }
    t.innerHTML = html; t.hidden = false;
    const gap = 14, b = t.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    let left = x + gap, top = y + gap;
    if (b.width && left + b.width + 8 > vw) left = x - b.width - gap;
    if (b.height && top + b.height + 8 > vh) top = y - b.height - gap;
    t.style.left = Math.max(8, left) + "px"; t.style.top = Math.max(8, top) + "px";
  }

  function mount(root) {
    styles();
    (root || document).querySelectorAll("[data-nxg]").forEach((el) => { const R = REG.get(el.dataset.nxg); if (!R) return; if (R.kind === "sankey") drawSankey(el, R); else drawCumul(el, R); });
  }
  document.addEventListener("mousemove", (ev) => {
    const el = ev.target.closest && ev.target.closest("[data-nxg]");
    document.querySelectorAll("[data-nxg]").forEach((g) => { if (g !== el) { const R = REG.get(g.dataset.nxg); if (R && R.kind === "sankey" && R.hovering) { R.hovering = false; sankeyHover(g, R, null); } if (R && R.kind === "cumul" && R.hovering) { R.hovering = false; const c = g.querySelector(".nxc-cursor"); if (c) c.setAttribute("visibility", "hidden"); pointerTip(null); } } });
    if (!el) return;
    const R = REG.get(el.dataset.nxg); if (!R) return;
    if (R.kind === "sankey") { const t = ev.target.closest(".b360-flow-ribbon,.b360-flow-node"); R.hovering = !!t; sankeyHover(el, R, t, ev); return; }
    const hit = ev.target.closest("rect[data-k]"), cur = el.querySelector(".nxc-cursor");
    if (!hit || !R.f) { R.hovering = false; if (cur) cur.setAttribute("visibility", "hidden"); pointerTip(null); return; }
    const k = Number(hit.dataset.k); R.hovering = true;
    cur.setAttribute("x1", R.f.x(k)); cur.setAttribute("x2", R.f.x(k)); cur.setAttribute("visibility", "visible");
    pointerTip(cumulTip(R, k), ev.clientX, ev.clientY);
  });
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest && ev.target.closest("[data-nxdata]"); if (!b) return;
    const R = REG.get(b.dataset.nxdata); if (!R) return;
    R.showData = !R.showData; b.textContent = R.showData ? "Graphique" : "Données"; b.setAttribute("aria-pressed", String(R.showData));
    drawSankey(b.closest("[data-nxg]"), R);
  });
  window.NXG = { sankey, cumul, mount, pointerTip, reset: () => REG.clear() };
})();
