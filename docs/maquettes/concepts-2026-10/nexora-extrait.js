// Fichier GÉNÉRÉ — ne pas modifier à la main.
// Extrait tel quel de apps/nexora/source/index.html.part-003 (commit 6497bd8) :
// fonctions pures et styles des graphiques Sankey et « Budget cumulé par mois »,
// pour que les maquettes reprennent exactement l'esthétique validée dans Nexora.
// Seul le rendu React (FinanceSankeyChart, FinanceCumulCategories…) est
// retranscrit à la main dans graphiques-nexora.js.
(function () {
// — part-003, ligne 35819
const FINANCE_SANKEY_INCOME_PALETTE = ["#3f806f", "#4e8577", "#6fa99b", "#7fb8a5", "#5b9483", "#8fc4b0", "#9ccdb9"];
// — part-003, ligne 35820
const FINANCE_SANKEY_DEFAULT_CONFIG = {
  periodMode: "month", periodValue: "current", from: "", to: "", range: "",
  flowOpacity: 0.52, sankeyShowValues: true, labelMode: "auto", rounding: "auto",
};
// — part-003, ligne 35826
function financeSankeyText(config, key, fallback = "") {
  return typeof config[key] === "string" ? config[key] : fallback;
}
// — part-003, ligne 35829
function financeSankeyNumber(config, key, fallback = 0) {
  return config[key] !== "" && config[key] != null && Number.isFinite(Number(config[key])) ? Number(config[key]) : fallback;
}
// — part-003, ligne 35833
function financeSankeyColor(value, fallback = "#24569a") {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
// — part-003, ligne 35903
function financeSankeyRound(value, unit = "", decimals = 2, rounding = "auto") {
  if (value === null || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const counted = /^(pas|steps|transactions|activités|observations)$/i.test(unit);
  // Montants en euros : arrondis à l'euro (#639), sauf l'arrondi compact k / M.
  const digits = unit === "€" ? 0
    : rounding === "fixed" ? decimals
    : counted || abs === 0 ? 0
    : abs < 1 ? Math.min(6, Math.max(decimals, Math.ceil(-Math.log10(abs)) + 1))
    : abs < 10 ? 2
    : +(abs < 100);
  return (Math.sign(value) * Math.round(Math.abs(value) * 10 ** digits) / 10 ** digits || 0).toLocaleString("fr-FR", {
    maximumFractionDigits: Math.max(0, Math.min(6, digits)),
    ...(rounding === "compact" ? { notation: "compact", maximumFractionDigits: 1 } : {}),
  });
}
// — part-003, ligne 35920
function financeSankeyFormat(value, unit = "", decimals = 2, compact = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value == null || value === "-" ? "—" : String(value);
  const digits = Math.max(0, Math.min(6, decimals));
  return (Math.sign(value) * Math.round(Math.abs(value) * 10 ** digits) / 10 ** digits || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits, ...(compact ? { notation: "compact" } : {}) })
    + (unit ? "\u00A0" + unit : "");
}
// — part-003, ligne 36082
function financeSankeyOrderNodes(nodes, links) {
  const list = nodes.map((n, i) => ({ ...n, seed: n.order ?? i, score: 0, weight: 0 }));
  const byId = new Map(list.map((n) => [n.id, n]));
  const cols = [...new Set(list.map((n) => n.col))].sort((a, b) => a - b);
  const columns = new Map(cols.map((c) => [c, list.filter((n) => n.col === c).sort((a, b) => a.seed - b.seed)]));
  const incoming = new Map(list.map((n) => [n.id, []]));
  const outgoing = new Map(list.map((n) => [n.id, []]));
  for (const l of links) {
    if (byId.has(l.source) && byId.has(l.target) && l.value > 0) {
      outgoing.get(l.source).push({ id: l.target, value: l.value });
      incoming.get(l.target).push({ id: l.source, value: l.value });
    }
  }
  const positions = () => new Map([...columns.values()].flatMap((col) => col.map((n, i) => [n.id, i])));
  const sweep = (forward) => {
    const pos = positions();
    for (const c of forward ? cols.slice(1) : cols.slice(0, -1).reverse()) {
      const col = columns.get(c);
      col.forEach((node, idx) => {
        const neighbours = (forward ? incoming : outgoing).get(node.id);
        const total = neighbours.reduce((s, x) => s + x.value, 0);
        const mean = total ? neighbours.reduce((s, x) => s + (pos.get(x.id) ?? idx) * x.value, 0) / total : idx;
        let median = idx;
        let acc = 0;
        for (const x of [...neighbours].sort((a, b) => (pos.get(a.id) ?? idx) - (pos.get(b.id) ?? idx))) {
          acc += x.value;
          if (acc >= total / 2) { median = pos.get(x.id) ?? idx; break; }
        }
        node.score = median * 0.7 + mean * 0.3;
        node.weight = total;
      });
      col.sort((a, b) => a.score - b.score || b.weight - a.weight || a.seed - b.seed);
    }
  };
  for (let i = 0; i < 14; i++) { sweep(true); sweep(false); }
  const crossings = () => {
    const pos = positions();
    let total = 0;
    for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) {
      const a = links[i];
      const b = links[j];
      if (byId.get(a.source)?.col === byId.get(b.source)?.col && byId.get(a.target)?.col === byId.get(b.target)?.col
        && (pos.get(a.source) - pos.get(b.source)) * (pos.get(a.target) - pos.get(b.target)) < 0) total += Math.sqrt(a.value * b.value);
    }
    return total;
  };
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const col of columns.values()) for (let i = 0; i < col.length - 1; i++) {
      const before = crossings();
      [col[i], col[i + 1]] = [col[i + 1], col[i]];
      if (crossings() + 0.001 < before) changed = true;
      else [col[i], col[i + 1]] = [col[i + 1], col[i]];
    }
    if (!changed) break;
  }
  for (const col of columns.values()) col.forEach((n, i) => { n.order = i; });
  return list.map((n) => ({ id: n.id, name: n.name, col: n.col, order: n.order, color: n.color }));
}
// — part-003, ligne 36144
function financeSankeyLayout(graph, width, height) {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const links = graph.links.filter((l) => Number.isFinite(l.value) && l.value > 0 && ids.has(l.source) && ids.has(l.target));
  const used = new Set(links.flatMap((l) => [l.source, l.target]));
  // Copie mise à l'échelle des seules sorties des comptes, pour l'ordonnancement.
  const scaled = links.map((l) => ({ ...l }));
  for (const node of graph.nodes.filter((n) => n.col === 1)) {
    const inValue = links.filter((l) => l.target === node.id).reduce((s, l) => s + l.value, 0);
    const outValue = links.filter((l) => l.source === node.id).reduce((s, l) => s + l.value, 0);
    if (inValue > 0 && outValue > 0) scaled.filter((l) => l.source === node.id).forEach((l) => { l.value *= inValue / outValue; });
  }
  const ordered = financeSankeyOrderNodes(graph.nodes.filter((n) => used.has(n.id)), scaled);
  const maxCount = Math.max(1, ...graph.columns.map((_, c) => ordered.filter((n) => n.col === c).length));
  const W = Math.max(420, width || 900);
  const compact = W < 620;
  const minHeight = (compact ? 27 : 29) * maxCount + 90;
  const H = Math.max(minHeight, Math.min(920, Math.max(280, height || 470, 44 + maxCount * 29)));
  const left = Math.min(196, Math.max(compact ? 104 : 128, W * 0.23));
  const right = Math.min(226, Math.max(compact ? 116 : 138, W * 0.26));
  const usable = H - 58 - 24;
  const nodeWidth = Math.max(11, Math.min(17, W / 52));
  const font = Math.max(9.5, Math.min(12, compact ? 10.5 : 11.5));
  const valueFont = Math.max(8.5, font - 1);
  const labelGap = font + valueFont + 7;
  const span = Math.max(1, graph.columns.length - 1);
  const nodes = ordered.map((n) => ({
    ...n,
    value: Math.max(links.filter((l) => l.target === n.id).reduce((s, l) => s + l.value, 0), links.filter((l) => l.source === n.id).reduce((s, l) => s + l.value, 0)),
    x0: left + n.col * (W - right - left - nodeWidth) / span, x1: 0, y0: 0, y1: 0, labelY: 0,
  }));
  const total = Math.max(0, ...graph.columns.map((_, c) => nodes.filter((n) => n.col === c).reduce((s, n) => s + n.value, 0)));
  const scale = total > 0 ? usable / total : 0;
  const columns = graph.columns.map((name, c) => {
    const col = nodes.filter((n) => n.col === c).sort((a, b) => a.order - b.order);
    const value = col.reduce((s, n) => s + n.value, 0);
    let y = 58;
    col.forEach((n) => {
      n.x1 = n.x0 + nodeWidth;
      n.y0 = y;
      n.y1 = y + n.value * scale;
      n.labelY = (n.y0 + n.y1) / 2;
      y = n.y1;
    });
    for (let i = 1; i < col.length; i++) col[i].labelY = Math.max(col[i].labelY, col[i - 1].labelY + labelGap);
    if (col.length && col.at(-1).labelY > H - 24 - labelGap / 2) {
      col.at(-1).labelY = H - 24 - labelGap / 2;
      for (let i = col.length - 2; i >= 0; i--) col[i].labelY = Math.min(col[i].labelY, col[i + 1].labelY - labelGap);
    }
    if (col.length && col[0].labelY < 58 + labelGap / 2) {
      const shift = 58 + labelGap / 2 - col[0].labelY;
      col.forEach((n) => { n.labelY += shift; });
    }
    return { name, value, x: left + c * (W - right - left - nodeWidth) / span };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ribbons = links.map((l) => ({ ...l, sourceY0: 0, sourceY1: 0, targetY0: 0, targetY1: 0, path: "" }));
  for (const node of nodes) for (const asSource of [true, false]) {
    let y = node.y0;
    ribbons
      .filter((l) => (asSource ? l.source : l.target) === node.id)
      .sort((a, b) => byId.get(asSource ? a.target : a.source).order - byId.get(asSource ? b.target : b.source).order)
      .forEach((l) => {
        const h = l.value * scale;
        if (asSource) { l.sourceY0 = y; l.sourceY1 = y + h; } else { l.targetY0 = y; l.targetY1 = y + h; }
        y += h;
      });
  }
  for (const l of ribbons) {
    const x0 = byId.get(l.source).x1;
    const x1 = byId.get(l.target).x0;
    const mid = (x0 + x1) / 2;
    l.path = `M${x0},${l.sourceY0}C${mid},${l.sourceY0} ${mid},${l.targetY0} ${x1},${l.targetY0}L${x1},${l.targetY1}C${mid},${l.targetY1} ${mid},${l.sourceY1} ${x0},${l.sourceY1}Z`;
  }
  return { width: W, height: H, font, valueFont, nodes, links: ribbons, columns };
}
// — part-003, ligne 36221
let financeSankeyCanvas;
// — part-003, ligne 36222
function financeSankeyMeasure(text, size, weight = 600) {
  if (financeSankeyCanvas === undefined) {
    try { financeSankeyCanvas = document.createElement("canvas").getContext("2d"); } catch { financeSankeyCanvas = null; }
  }
  if (!financeSankeyCanvas) return Array.from(text).length * size * 0.75;
  financeSankeyCanvas.font = `${weight} ${size}px "Segoe UI",Arial,sans-serif`;
  return financeSankeyCanvas.measureText(text).width;
}
// — part-003, ligne 36231
function financeSankeyTruncate(text, maxWidth, size) {
  if (financeSankeyMeasure(text, size) <= maxWidth) return text;
  if (maxWidth < financeSankeyMeasure("…", size)) return "";
  const chars = Array.from(text);
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (financeSankeyMeasure(chars.slice(0, mid).join("") + "…", size) <= maxWidth) lo = mid; else hi = mid - 1;
  }
  return chars.slice(0, lo).join("") + "…";
}
// — part-003, ligne 36246
const FINANCE_SANKEY_SVG_CSS = ".b360-flow-label{paint-order:stroke fill;stroke:rgba(255,255,255,.96);stroke-linejoin:round;pointer-events:none;font-family:Segoe UI,Arial,sans-serif}.b360-flow-name{stroke-width:4px;fill:#14232d;font-weight:600}.b360-flow-value{stroke-width:3px;fill:#60717c;font-weight:500}.b360-flow-node:focus{outline:none}.b360-flow-node:focus>rect{stroke:#14232d;stroke-width:2}.b360-flow-ribbon:focus{outline:none;stroke:#14232d;stroke-width:1.5}";
// — part-003, ligne 36247
const FINANCE_SANKEY_CSS = `
.lp-widget-head-toolbar:has(.nx-sankey-tools){flex-wrap:wrap;overflow:visible;row-gap:5px}
.lp-widget-head:has(.nx-sankey-tools){align-items:flex-start}
.lp-widget-head:has(.nx-sankey-tools) .lp-widget-title{flex:0 0 auto;max-width:40%;line-height:24px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-sankey-tools{display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0;max-width:100%;font-size:11px;color:#203246}
.nx-sankey-group{display:inline-flex;flex-wrap:wrap;align-items:center;gap:4px;row-gap:5px;min-width:0;max-width:100%;padding-left:6px;border-left:1px solid var(--border,#d8e1eb)}
.nx-sankey-tools button,.nx-sankey-tools select,.nx-sankey-tools input[type=month],.nx-sankey-tools input[type=number]{height:24px;padding:0 7px;font:inherit;border:1px solid #d8e1eb;border-radius:5px;background:#fff;color:#203246;cursor:pointer}
.nx-sankey-tools button.active{background:#e7efff;border-color:#24569a;color:#24569a;font-weight:600}
.nx-sankey-tools input[type=number]{width:60px;cursor:text}
.nx-sankey-tools label{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;cursor:pointer}
.nx-sankey-tools .nx-sankey-variant{font-weight:600}
.nx-sankey{--health:#176655;--danger:#a33135;flex-direction:column;height:100%;min-height:0;display:flex}
.nx-sankey .sankey-figure{flex:1;min-height:0;position:relative;overflow:hidden}
.nx-sankey .sankey-svg{width:100%;height:100%;display:block;overflow:hidden}
.nx-sankey text{font-family:Inter,'Segoe UI',Arial,sans-serif!important;font-variant-numeric:lining-nums tabular-nums}
.nx-sankey .sankey-footer{color:#60717c;justify-content:space-between;align-items:center;gap:8px;padding:3px 7px;font-size:10px;display:flex}
.nx-sankey .sankey-footer button{min-height:22px;padding:2px 7px;font-size:10px;border:1px solid #d8e1eb;border-radius:4px;background:#fff;color:#203246;cursor:pointer}
.nx-sankey .sankey-footer span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}
.nx-sankey .sankey-tooltip{z-index:5;pointer-events:none;max-width:min(285px,100% - 8px);position:absolute}
.nx-sankey .sankey-data{position:absolute;inset:0;overflow:auto;font-size:12px}
.nx-sankey .sankey-data table{width:100%;border-collapse:collapse}
.nx-sankey .sankey-data th,.nx-sankey .sankey-data td{padding:4px 8px;border-bottom:1px solid #edf1f4;text-align:left}
.nx-sankey .sankey-data th{background:#fff;position:sticky;top:0}
.nx-sankey .sankey-data td.numeric{text-align:right;font-variant-numeric:tabular-nums}
.nx-sankey .b360-flow-node,.nx-sankey .b360-flow-ribbon{cursor:pointer}
.nx-sankey .os-tooltip{color:#203246;overflow-wrap:anywhere;background:#fffffffa;border:1px solid #d8e1eb;border-radius:8px;min-width:160px;max-width:320px;padding:12px 14px;font:400 12px/1.5 Inter,'Segoe UI',Arial,sans-serif;box-shadow:0 10px 24px rgba(24,47,72,.18)}
.nx-sankey .os-tooltip-title{color:#24569a;margin-bottom:3px;font-size:12px;font-weight:500}
.nx-sankey .os-tooltip-context{color:#536477;margin-bottom:8px;font-size:11px}
.nx-sankey .os-tooltip-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:baseline;gap:12px;display:grid}
.nx-sankey .os-tooltip-value{font-variant-numeric:tabular-nums;text-align:right;font-weight:500}
.nx-sankey .os-tooltip-foot{color:#536477;border-top:1px solid #edf1f4;margin-top:7px;padding-top:7px;font-size:10px}
`;
// — part-003, ligne 37110
function financeBudgetEuro(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.sign(value) * Math.round(Math.abs(value)) || 0;
  return rounded.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
// — part-003, ligne 37947
function financeChartTicks(max, count = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const raw = max / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { max: top, ticks };
}
// — part-003, ligne 37992
function financeChartShortEuro(value) {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${Math.round(value).toLocaleString("fr-FR")} €`;
  return text;
}
// — part-003, ligne 38082
const FINANCE_BUDGET_CHART_CSS = `
.nx-bch{display:flex;flex-direction:column;gap:8px;height:100%;min-height:0;overflow:auto;padding:10px 12px;font-size:12px;color:#203246}
.nx-bch svg{display:block;width:100%;height:auto;overflow:visible}
.nx-bch svg text{font-size:10px;fill:#60717c;font-family:inherit}
.nx-bch-legend{display:flex;flex-wrap:wrap;gap:4px 12px;color:#60717c}
.nx-bch-legend span{display:inline-flex;align-items:center;gap:4px}
.nx-bch-legend i{width:10px;height:10px;border-radius:2px;display:inline-block}
.nx-bch-donut{display:grid;grid-template-columns:minmax(120px,200px) minmax(0,1fr);gap:12px;align-items:center}
.nx-bch-rows{display:flex;flex-direction:column;gap:3px;min-width:0}
.nx-bch-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto auto;gap:6px;align-items:center}
.nx-bch-row i{width:10px;height:10px;border-radius:2px}
.nx-bch-row b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-bch-row small{font-variant-numeric:tabular-nums;color:#60717c;white-space:nowrap}
.nx-bch-wf{display:flex;flex-direction:column;gap:4px}
.nx-bch-wf-row{display:grid;grid-template-columns:minmax(80px,140px) minmax(0,1fr) auto;gap:8px;align-items:center}
.nx-bch-wf-row b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-bch-wf-row small{font-variant-numeric:tabular-nums;white-space:nowrap}
.nx-bch-wf-track{position:relative;height:14px;background:#f3f6f9;border-radius:3px}
.nx-bch-wf-track i{position:absolute;top:0;bottom:0;border-radius:3px}
.nx-bch-waffle{display:flex;flex-direction:column;gap:6px}
.nx-bch-waffle-row{display:grid;grid-template-columns:minmax(80px,140px) minmax(0,1fr) auto;gap:8px;align-items:center}
.nx-bch-waffle-row b{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-bch-waffle-row small{font-variant-numeric:tabular-nums;white-space:nowrap}
.nx-bch-cells{display:flex;flex-wrap:wrap;gap:2px}
.nx-bch-cells i{width:11px;height:11px;border-radius:2px;display:inline-block}
.nx-bch-empty{color:#60717c;padding:16px 0}
.nx-bch-note{color:#60717c;font-size:11px}
.nx-bch-legend i.dash,.nx-bch-tip i.dash{width:14px;height:0;border-radius:0;border-top:2px dashed;background:none}
.nx-bch-tip{display:flex;flex-direction:column;gap:2px;min-width:200px}
.nx-bch-tip div{display:flex;justify-content:space-between;gap:12px;font-variant-numeric:tabular-nums}
.nx-bch-tip span{display:inline-flex;align-items:center;gap:5px}
.nx-bch-tip i{width:8px;height:8px;border-radius:2px;display:inline-block}
`;
// — part-003, ligne 38308
const FINANCE_CUMUL_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
// — part-003, ligne 38309
const FINANCE_CUMUL_OTHER = "#a3a7ad";
// — part-003, ligne 38310
const FINANCE_CUMUL_INK = { ink: "#0b0b0b", muted: "#52514e", grid: "#ebecee", axis: "#c9ccd1", over: "#c0392b", income: "#1f7a52", pace: "#52514e" };
// — part-003, ligne 38312
function financeCumulRound(v) { return Math.round(v * 100) / 100; }
// — part-003, ligne 38319
function financeCumulModel(charts) {
  const days = (charts && charts.days) || [];
  const cumulative = (charts && charts.cumulative) || [];
  const totals = new Map();
  for (const m of (charts && charts.periodic) || []) for (const c of m.categories || []) totals.set(c.category, (totals.get(c.category) || 0) + c.amount);
  for (const s of cumulative) if (!totals.has(s.category)) totals.set(s.category, s.total);
  const rank = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr")).map(([name]) => name);
  const top = rank.slice(0, FINANCE_CUMUL_PALETTE.length);
  const daily = (values) => values.map((v, i) => financeCumulRound(v - (i ? values[i - 1] : 0)));
  const series = [];
  top.forEach((name, i) => {
    const s = cumulative.find((x) => x.category === name);
    if (s && s.total > 0) series.push({ category: name, color: FINANCE_CUMUL_PALETTE[i], values: s.values, daily: daily(s.values), total: s.total, budget: s.budget || 0, members: [name] });
  });
  const rest = cumulative.filter((s) => !top.includes(s.category) && s.total > 0);
  if (rest.length) {
    const values = days.map((_, k) => financeCumulRound(rest.reduce((t, s) => t + (s.values[k] || 0), 0)));
    series.push({
      category: "Autres", color: FINANCE_CUMUL_OTHER, other: true, values, daily: daily(values),
      total: financeCumulRound(rest.reduce((t, s) => t + s.total, 0)),
      budget: financeCumulRound(rest.reduce((t, s) => t + (s.budget || 0), 0)),
      members: rest.map((s) => s.category),
    });
  }
  const total = days.map((_, k) => financeCumulRound(series.reduce((t, s) => t + (s.values[k] || 0), 0)));
  const income = days.map((_, k) => (charts && charts.incomeCumulative && charts.incomeCumulative[k]) || 0);
  const budgetTotal = (charts && charts.budgetTotal) || 0;
  const pace = days.map((_, k) => (budgetTotal > 0 ? financeCumulRound((budgetTotal * (k + 1)) / days.length) : 0));
  const crossDay = budgetTotal > 0 ? total.findIndex((v) => v > budgetTotal) : -1;
  const dailyTotal = daily(total);
  return { days, series, total, income, budgetTotal, pace, crossDay, dailyTotal, spent: total.length ? total[total.length - 1] : 0 };
}
// — part-003, ligne 38354
function financeCumulSpread(items, gap) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let k = 1; k < sorted.length; k++) if (sorted[k].y - sorted[k - 1].y < gap) sorted[k] = { ...sorted[k], y: sorted[k - 1].y + gap };
  return sorted;
}
// — part-003, ligne 38361
const FINANCE_BUDGET_CUMUL_CSS = `
.nx-bcu-tiles{display:flex;flex-wrap:wrap;gap:6px 24px}
.nx-bcu-tiles small{display:block;color:#52514e;font-size:11px}
.nx-bcu-tiles span{font-size:20px;font-weight:650;font-variant-numeric:tabular-nums;color:#0b0b0b}
.nx-bcu-sm{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.nx-bcu-sm article{border:1px solid #e3e7eb;border-radius:8px;padding:6px 8px 2px}
.nx-bcu-sm header{display:flex;justify-content:space-between;gap:6px;font-size:11.5px}
.nx-bcu-sm header b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nx-bcu-sm header small{font-variant-numeric:tabular-nums;color:#52514e;white-space:nowrap}
.nx-bcu-sm header small.over{color:#c0392b;font-weight:650}
.nx-bcu-panel{font-size:10px;font-weight:600;letter-spacing:.04em;color:#52514e;text-transform:uppercase}
.nx-bcu-plot{flex:1 1 0;min-height:120px;overflow:hidden}
`;
// — part-003, ligne 38377
function financeCumulFrame({ W, H, L = 50, R, T = 12, B = 24, top, days }) {
  const { max, ticks } = financeChartTicks(top);
  const n = days.length;
  const x = (k) => L + (n > 1 ? (k / (n - 1)) * (W - L - R) : 0);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const step = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
  return { W, H, L, R, T, B, max, ticks, x, y, step, days };
}
// — part-003, ligne 38391
const FINANCE_CUMUL_REF = { w: 720, h: 280 };
// — part-003, ligne 38392
const FINANCE_CUMUL_MIN_H = 120;
// — part-003, ligne 38393
const FINANCE_CUMUL_MIN_W = 360;
// — part-003, ligne 38394
function financeCumulPlotSize(box, fallbackH) {
  if (!box || !(box.w > 0) || !(box.h > 0)) return { W: FINANCE_CUMUL_REF.w, H: fallbackH };
  const zoom = Math.min(1.5, Math.max(1, Math.min(box.w / FINANCE_CUMUL_REF.w, box.h / FINANCE_CUMUL_REF.h)));
  return { W: Math.max(FINANCE_CUMUL_MIN_W, box.w / zoom), H: Math.max(FINANCE_CUMUL_MIN_H, box.h / zoom) };
}
// — part-003, ligne 38413
function financeCumulPath(values, f) {
  return values.map((v, k) => `${k ? "L" : "M"} ${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" ");
}
// — part-003, ligne 38416
function financeCumulDayLabel(d) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
}
  window.NX = { FINANCE_SANKEY_INCOME_PALETTE, FINANCE_SANKEY_DEFAULT_CONFIG, financeSankeyText, financeSankeyNumber, financeSankeyColor, financeSankeyRound, financeSankeyFormat, financeSankeyOrderNodes, financeSankeyLayout, financeSankeyMeasure, financeSankeyTruncate, FINANCE_SANKEY_SVG_CSS, FINANCE_SANKEY_CSS, financeBudgetEuro, financeChartTicks, financeChartShortEuro, FINANCE_BUDGET_CHART_CSS, FINANCE_CUMUL_PALETTE, FINANCE_CUMUL_OTHER, FINANCE_CUMUL_INK, financeCumulRound, financeCumulModel, financeCumulSpread, FINANCE_BUDGET_CUMUL_CSS, financeCumulFrame, FINANCE_CUMUL_REF, financeCumulPlotSize, financeCumulPath, financeCumulDayLabel };
})();
