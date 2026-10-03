/* eslint-disable */
// @ts-nocheck
// Fichier GÉNÉRÉ par scripts/extraire-nexora.py — NE PAS MODIFIER À LA MAIN (Ref #690).
// Code repris tel quel de apps/nexora/source (dernier commit du dossier : 9c48970) : graphiques
// Sankey et « Budget cumulé par mois » de Nexora, pour en garder exactement l'esthétique.
import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// — index.html.part-002, ligne 10382
function WidgetPointerTooltip({ x, y, className, children }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x + 14, top: y + 14 });

  useLayoutEffect(() => {
    const gap = 14;
    const node = ref.current;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 1024;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 768;
    // Sans mesure (premier rendu), on garde le placement direct : mieux vaut
    // une infobulle bien posée au curseur qu'un saut visible.
    const box = node ? node.getBoundingClientRect() : { width: 0, height: 0 };
    let left = x + gap;
    let top = y + gap;
    if (box.width && left + box.width + 8 > viewportW) left = x - box.width - gap;
    if (box.height && top + box.height + 8 > viewportH) top = y - box.height - gap;
    setPos({ left: Math.max(8, left), top: Math.max(8, top) });
  }, [x, y, children]);

  return createPortal(
    <div
      ref={ref}
      className={className}
      style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 100000, pointerEvents: "none" }}
    >
      {children}
    </div>,
    document.body,
  );
}
// — index.html.part-003, ligne 35819
const FINANCE_SANKEY_INCOME_PALETTE = ["#3f806f", "#4e8577", "#6fa99b", "#7fb8a5", "#5b9483", "#8fc4b0", "#9ccdb9"];
// — index.html.part-003, ligne 35820
const FINANCE_SANKEY_DEFAULT_CONFIG = {
  periodMode: "month", periodValue: "current", from: "", to: "", range: "",
  flowOpacity: 0.52, sankeyShowValues: true, labelMode: "auto", rounding: "auto",
};
// — index.html.part-003, ligne 35826
function financeSankeyText(config, key, fallback = "") {
  return typeof config[key] === "string" ? config[key] : fallback;
}
// — index.html.part-003, ligne 35829
function financeSankeyNumber(config, key, fallback = 0) {
  return config[key] !== "" && config[key] != null && Number.isFinite(Number(config[key])) ? Number(config[key]) : fallback;
}
// — index.html.part-003, ligne 35833
function financeSankeyColor(value, fallback = "#24569a") {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback;
}
// — index.html.part-003, ligne 35836
function financeSankeyIsDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
// — index.html.part-003, ligne 35841
function financeSankeyAddDays(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
// — index.html.part-003, ligne 35847
function financeSankeyToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
}
// — index.html.part-003, ligne 35852
function financeSankeyQuickPeriod(value, today = financeSankeyToday()) {
  if (value === "today") return { from: today, to: today };
  if (value === "previous") {
    const last = financeSankeyAddDays(today.slice(0, 7) + "-01", -1);
    return { from: last.slice(0, 7) + "-01", to: last };
  }
  const month = /^\d{4}-\d{2}$/.test(value) ? value : today.slice(0, 7);
  return { from: month + "-01", to: new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0, 12)).toISOString().slice(0, 10) };
}
// — index.html.part-003, ligne 35865
function financeSankeyPeriod(config, today = financeSankeyToday()) {
  if (config.quickPeriod || config.periodValue === "previous") return financeSankeyQuickPeriod(config.quickPeriod || "previous", today);
  const monthOf = (ym) => {
    const next = new Date(ym + "-01T12:00:00Z");
    next.setUTCMonth(next.getUTCMonth() + 1);
    return { from: ym + "-01", to: financeSankeyAddDays(next.toISOString().slice(0, 10), -1) };
  };
  const fallback = monthOf(today.slice(0, 7));
  if (financeSankeyIsDate(config.from) && financeSankeyIsDate(config.to)) return { from: config.from, to: config.to };
  if (financeSankeyIsDate(config.from) || financeSankeyIsDate(config.to)) {
    const { from, to, ...rest } = config;
    const base = financeSankeyPeriod(rest, today);
    return { from: financeSankeyIsDate(from) ? from : base.from, to: financeSankeyIsDate(to) ? to : base.to };
  }
  if (config.range === "all") return { from: "1900-01-01", to: today };
  if (config.range) return { from: financeSankeyAddDays(today, 1 - financeSankeyNumber(config, "range", 30)), to: today };
  const mode = financeSankeyText(config, "periodMode", "month");
  const value = financeSankeyText(config, "periodValue", "current");
  if (mode === "year" || config.year) {
    const year = String(config.year || (value === "current" ? today.slice(0, 4) : value));
    return { from: year + "-01-01", to: year + "-12-31" };
  }
  const ym = value === "current" ? today.slice(0, 7) : value.slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(ym)) return fallback;
  return monthOf(ym);
}
// — index.html.part-003, ligne 35893
function financeSankeyDateLabel(value, short = false) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}(-\d{2})?$/.test(text)) return text;
  const d = new Date(text + (text.length === 7 ? "-01" : "") + "T12:00:00Z");
  return Number.isFinite(d.getTime())
    ? new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...(text.length === 10 ? { day: "numeric" } : {}), month: "short", ...(!short || text.length === 7 ? { year: "numeric" } : {}) }).format(d)
    : text;
}
// — index.html.part-003, ligne 35903
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
// — index.html.part-003, ligne 35920
function financeSankeyFormat(value, unit = "", decimals = 2, compact = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) return value == null || value === "-" ? "—" : String(value);
  const digits = Math.max(0, Math.min(6, decimals));
  return (Math.sign(value) * Math.round(Math.abs(value) * 10 ** digits) / 10 ** digits || 0).toLocaleString("fr-FR", { maximumFractionDigits: digits, ...(compact ? { notation: "compact" } : {}) })
    + (unit ? "\u00A0" + unit : "");
}
// — index.html.part-003, ligne 35931
function financeSankeyNormalize(raw) {
  const rows = (key) => {
    if (!Array.isArray(raw?.[key])) throw new Error("Réponse Budget invalide.");
    return raw[key].map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row : {}));
  };
  const text = (row, key, fallback = "") => (typeof row[key] === "string" ? row[key] : fallback);
  const amount = (value, fallback = 0) => {
    if (value == null || value === "") return fallback;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error("Montant Budget invalide.");
    return n;
  };
  const transactions = rows("transactions");
  const cancelled = new Set(transactions.map((row) => row.cancels_transaction_id).filter(Boolean));
  const toTransaction = (row) => {
    const effectiveDate = text(row, "effective_date");
    const bankDate = text(row, "bank_date", effectiveDate);
    if (!financeSankeyIsDate(effectiveDate) || !financeSankeyIsDate(bankDate) || !row.transaction_id) {
      throw new Error("Transaction reçue sans identifiant ou dates valides.");
    }
    return {
      id: String(row.transaction_id), effectiveDate, bankDate,
      amount: amount(row.signed_amount), type: text(row, "transaction_type"), accountId: text(row, "account_id"),
      category: text(row, "category", "À classer"), subcategory: text(row, "subcategory"),
    };
  };
  const reference = (row, nameKey) => ({ name: text(row, nameKey), color: financeSankeyColor(row.color, "#536477") });
  return {
    ledger: transactions
      .filter((row) => !["Budget", "Annulation", "Ouverture"].includes(text(row, "transaction_type")) && !cancelled.has(row.transaction_id))
      .map(toTransaction),
    transactions: transactions.filter((row) => !cancelled.has(row.transaction_id)).map(toTransaction),
    accounts: rows("accounts").filter((row) => row.active !== false).map((row) => ({
      id: text(row, "account_id"), name: text(row, "name"), bank: text(row, "bank"), type: text(row, "account_type"),
      opening: amount(row.opening_balance), color: financeSankeyColor(row.color, "#536477"),
    })),
    categories: rows("categories").map((row) => reference(row, "category")),
    banks: rows("banks").map((row) => reference(row, "name")),
    accountTypes: rows("accountTypes").map((row) => reference(row, "name")),
    balances: rows("balances").map((row) => ({
      accountId: text(row, "account_id"),
      date: text(row, "as_of_date") || text(row, "balance_date") || text(row, "date"),
      balance: amount(row.balance),
    })),
  };
}
// — index.html.part-003, ligne 35979
function financeSankeyPeriodTransactions(data, period) {
  return data.transactions.filter((t) => t.effectiveDate >= period.from && t.effectiveDate <= period.to);
}
// — index.html.part-003, ligne 35986
function financeSankeyAccountBalances(data, date, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const until = date > today ? today : date;
  return data.accounts.map((account) => {
    const snapshot = data.balances
      .filter((b) => b.accountId === account.id && b.date <= until)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    const base = snapshot ? snapshot.balance : account.opening;
    const after = snapshot?.date || "";
    return {
      ...account,
      balance: base + (data.ledger ?? data.transactions)
        .filter((t) => t.accountId === account.id && t.effectiveDate > after && t.effectiveDate <= until)
        .reduce((sum, t) => sum + t.amount, 0),
    };
  });
}
// — index.html.part-003, ligne 36004
const financeSankeySum = (list, pick) => list.reduce((sum, item) => sum + pick(item), 0);
// — index.html.part-003, ligne 36007
function financeSankeyMonthlyGraph(data, periodTransactions) {
  const flows = periodTransactions.filter((t) => Number.isFinite(t.amount) && t.amount !== 0
    && ["Dépense", "Revenu", "Remboursement"].includes(t.type)
    && t.category !== "Transferts internes" && t.category !== "Ajustement");
  const accounts = data.accounts
    .filter((a) => flows.some((t) => t.accountId === a.id))
    .sort((a, b) => financeSankeySum(flows.filter((t) => t.accountId === b.id), (t) => Math.abs(t.amount))
      - financeSankeySum(flows.filter((t) => t.accountId === a.id), (t) => Math.abs(t.amount))
      || a.name.localeCompare(b.name, "fr"));
  const accountRank = new Map(accounts.map((a, i) => [a.id, i]));
  const incomes = flows.filter((t) => t.type === "Revenu" || t.type === "Remboursement");
  const expenses = flows.filter((t) => t.type === "Dépense");
  const incomeKey = (t) => t.subcategory || t.type;
  const orderKeys = (list, keyOf, valueOf) => [...new Set(list.map(keyOf))].sort((a, b) => {
    const firstAccount = (k) => Math.min(...list.filter((t) => keyOf(t) === k).map((t) => accountRank.get(t.accountId) ?? 999));
    return firstAccount(a) - firstAccount(b)
      || financeSankeySum(list.filter((t) => keyOf(t) === b), valueOf) - financeSankeySum(list.filter((t) => keyOf(t) === a), valueOf)
      || a.localeCompare(b, "fr");
  });
  const incomeKeys = orderKeys(incomes, incomeKey, (t) => Math.max(0, t.amount));
  const categoryKeys = orderKeys(expenses, (t) => t.category, (t) => Math.abs(t.amount));
  const nodes = [
    ...incomeKeys.map((name, i) => ({ id: "income:" + name, name, col: 0, order: i, color: FINANCE_SANKEY_INCOME_PALETTE[i % FINANCE_SANKEY_INCOME_PALETTE.length] })),
    ...accounts.map((a, i) => ({ id: "account:" + a.id, name: a.name, col: 1, order: i, color: financeSankeyColor(a.color) })),
    ...categoryKeys.map((name, i) => ({ id: "category:" + name, name, col: 2, order: i, color: financeSankeyColor(data.categories.find((c) => c.name === name)?.color, "#587894") })),
  ];
  const links = [];
  for (const account of accounts) {
    const own = flows.filter((t) => t.accountId === account.id);
    for (const key of incomeKeys) {
      const value = financeSankeySum(own.filter((t) => ["Revenu", "Remboursement"].includes(t.type) && incomeKey(t) === key), (t) => Math.max(0, t.amount));
      if (value > 0.005) links.push({ source: "income:" + key, target: "account:" + account.id, value });
    }
    for (const key of categoryKeys) {
      const value = financeSankeySum(own.filter((t) => t.type === "Dépense" && t.category === key), (t) => Math.abs(t.amount));
      if (value > 0.005) links.push({ source: "account:" + account.id, target: "category:" + key, value });
    }
  }
  return { nodes, links, columns: ["ORIGINE", "COMPTES", "DESTINATION"] };
}
// — index.html.part-003, ligne 36050
function financeSankeyWealthGraph(data, date, now = new Date()) {
  const accounts = financeSankeyAccountBalances(data, date, now).filter((a) => a.balance > 0);
  const types = [...new Set(accounts.map((a) => a.type))];
  const banks = [...new Set(accounts.map((a) => a.bank))];
  const nodes = [
    ...types.map((name, i) => ({ id: "type:" + name, name, col: 0, order: i, color: financeSankeyColor(data.accountTypes.find((t) => t.name === name)?.color, ["#607d9b", "#3f806f"][i % 2]) })),
    ...banks.map((name, i) => ({ id: "bank:" + name, name, col: 1, order: i, color: financeSankeyColor(data.banks.find((b) => b.name === name)?.color, ["#256d85", "#cf7856", "#73927e"][i % 3]) })),
    ...accounts.map((a, i) => ({ id: "account:" + a.id, name: a.name, col: 2, order: i, color: financeSankeyColor(a.color) })),
  ];
  const links = [];
  for (const type of types) for (const bank of banks) {
    const value = accounts.filter((a) => a.type === type && a.bank === bank).reduce((sum, a) => sum + a.balance, 0);
    if (value > 0) links.push({ source: "type:" + type, target: "bank:" + bank, value });
  }
  for (const a of accounts) links.push({ source: "bank:" + a.bank, target: "account:" + a.id, value: a.balance });
  return { nodes, links, columns: ["TYPE", "BANQUE", "COMPTE"] };
}
// — index.html.part-003, ligne 36069
function financeSankeyBuild(type, data, config, today = financeSankeyToday(), now = new Date()) {
  const period = financeSankeyPeriod(config, today);
  const effective = period.from === "1900-01-01"
    ? { from: data.transactions.reduce((min, t) => (t.effectiveDate < min ? t.effectiveDate : min), period.to), to: period.to }
    : period;
  const graph = type === "financeSankeyWealth"
    ? financeSankeyWealthGraph(data, effective.to, now)
    : financeSankeyMonthlyGraph(data, financeSankeyPeriodTransactions(data, effective));
  return { graph, period: financeSankeyDateLabel(period.from) + " → " + financeSankeyDateLabel(period.to) };
}
// — index.html.part-003, ligne 36082
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
// — index.html.part-003, ligne 36144
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
// — index.html.part-003, ligne 36221
let financeSankeyCanvas;
// — index.html.part-003, ligne 36222
function financeSankeyMeasure(text, size, weight = 600) {
  if (financeSankeyCanvas === undefined) {
    try { financeSankeyCanvas = document.createElement("canvas").getContext("2d"); } catch { financeSankeyCanvas = null; }
  }
  if (!financeSankeyCanvas) return Array.from(text).length * size * 0.75;
  financeSankeyCanvas.font = `${weight} ${size}px "Segoe UI",Arial,sans-serif`;
  return financeSankeyCanvas.measureText(text).width;
}
// — index.html.part-003, ligne 36231
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
// — index.html.part-003, ligne 36246
const FINANCE_SANKEY_SVG_CSS = ".b360-flow-label{paint-order:stroke fill;stroke:rgba(255,255,255,.96);stroke-linejoin:round;pointer-events:none;font-family:Segoe UI,Arial,sans-serif}.b360-flow-name{stroke-width:4px;fill:#14232d;font-weight:600}.b360-flow-value{stroke-width:3px;fill:#60717c;font-weight:500}.b360-flow-node:focus{outline:none}.b360-flow-node:focus>rect{stroke:#14232d;stroke-width:2}.b360-flow-ribbon:focus{outline:none;stroke:#14232d;stroke-width:1.5}";
// — index.html.part-003, ligne 36247
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
// — index.html.part-003, ligne 36281
function FinanceSankeyChart({ graph, config, title, period, showData: showDataProp, onToggleData }) {
  const figureRef = useRef(null);
  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [size, setSize] = useState({ width: 900, height: 470 });
  const [hover, setHover] = useState(null);
  const [tip, setTip] = useState(null);
  const [showDataOwn, setShowDataOwn] = useState(false);
  const showData = showDataProp ?? showDataOwn;
  const toggleData = onToggleData || (() => setShowDataOwn((v) => !v));
  useEffect(() => {
    const el = figureRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setSize((s) => (s.width === r.width && s.height === r.height ? s : { width: r.width, height: r.height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const m = useMemo(() => financeSankeyLayout(graph, size.width, size.height), [graph, size]);
  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const opacity = Math.min(1, Math.max(0.1, financeSankeyNumber(config, "flowOpacity", 0.52)));
  const showValues = config.sankeyShowValues !== false && config.labelMode !== "none";
  const lastCol = graph.columns.length - 1;
  const link = hover?.kind === "link" ? m.links[Number(hover.id)] : undefined;
  const node = hover?.kind === "node" ? byId.get(hover.id) : undefined;
  const related = new Set(link ? [link.source, link.target]
    : node ? [node.id, ...m.links.flatMap((l) => (l.source === node.id ? [l.target] : l.target === node.id ? [l.source] : []))] : []);
  const show = (kind, id, event) => {
    const box = figureRef.current.getBoundingClientRect();
    const target = event.currentTarget.getBoundingClientRect();
    const tw = Math.min(285, size.width - 8);
    const th = 150;
    const gap = 16;
    const px = typeof event.clientX === "number" ? event.clientX - box.x : target.x - box.x + 15;
    const py = typeof event.clientY === "number" ? event.clientY - box.y : target.y - box.y + 18;
    const fx = px + gap + tw > size.width - 4 ? px - gap - tw : px + gap;
    const fy = py + gap + th > size.height - 4 ? py - gap - th : py + gap;
    setHover({ kind, id });
    setTip({ x: Math.max(4, Math.min(size.width - tw - 4, fx)), y: Math.max(4, Math.min(size.height - th, fy)) });
  };
  const hide = () => { setHover(null); setTip(null); };
  const money = (value, maxWidth = 120, fontSize = m.valueFont) => {
    const full = financeSankeyRound(value, "€", 0, financeSankeyText(config, "rounding", "auto")) + " €";
    if (financeSankeyMeasure(full, fontSize, 500) <= maxWidth) return full;
    const short = financeSankeyRound(value, "€", 0, "compact") + " €";
    return financeSankeyMeasure(short, fontSize, 500) <= maxWidth ? short : "";
  };
  return (
    <div className="nx-sankey">
      <style>{FINANCE_SANKEY_CSS}</style>
      <div ref={figureRef} className="sankey-figure" onKeyDown={(e) => { if (e.key === "Escape") hide(); }}>
        <svg viewBox={`0 0 ${m.width} ${m.height}`} preserveAspectRatio="xMidYMid meet" className="sankey-svg sankey-svg-v3" role="group"
          aria-label={title + " · " + graph.columns.join(" → ")} style={{ display: showData ? "none" : undefined }}>
          <style>{FINANCE_SANKEY_SVG_CSS}</style>
          <desc>Échelle monétaire commune aux colonnes. Les hauteurs des piliers et des rubans sont proportionnelles aux montants réels.</desc>
          <defs>
            {m.links.map((l, i) => (
              <linearGradient key={i} id={`${uid}-flow-${i}`} gradientUnits="userSpaceOnUse" x1={byId.get(l.source).x1} x2={byId.get(l.target).x0}>
                <stop stopColor={byId.get(l.source).color} />
                <stop offset="100%" stopColor={byId.get(l.target).color} />
              </linearGradient>
            ))}
          </defs>
          <g className="sankey-column-totals">
            {m.columns.map((col, i) => {
              const room = (m.columns[i + 1]?.x ?? m.width) - col.x - 8;
              const label = money(col.value, room, 15);
              const wrap = col.name.length * 6 + 10 + financeSankeyMeasure(label, 15, 700) > room;
              return (
                <g key={col.name} transform={`translate(${col.x},17)`}>
                  <text fill="#60717c" fontFamily="Segoe UI,Arial,sans-serif" fontSize="9" fontWeight="700" letterSpacing=".08em">{col.name}</text>
                  {showValues && <text x={wrap ? 0 : col.name.length * 6 + 10} y={wrap ? 19 : 1} fill="#14232d" fontFamily="Segoe UI,Arial,sans-serif" fontSize="15" fontWeight="700">{label}</text>}
                  {i === lastCol && (
                    <text x={0} y={wrap ? 34 : 19} fill={m.columns[0].value - col.value > 0 ? "var(--health)" : "var(--danger)"} fontFamily="Segoe UI,Arial,sans-serif" fontSize="10" fontWeight="700">
                      {"Solde du mois : " + financeSankeyFormat(m.columns[0].value - col.value, "€", 0)}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          <g className="sankey-ribbons">
            {m.links.map((l, i) => {
              const active = link === l || node?.id === l.source || node?.id === l.target;
              const label = byId.get(l.source).name + " → " + byId.get(l.target).name + " · " + financeSankeyFormat(l.value, "€", 0);
              return (
                <path key={i} className="b360-flow-ribbon" d={l.path} fill={`url(#${uid}-flow-${i})`} fillOpacity={hover ? (active ? 0.9 : 0.1) : opacity}
                  style={{ mixBlendMode: "multiply" }} tabIndex={0} role="button" aria-label={label}
                  onMouseEnter={(e) => show("link", String(i), e)} onMouseLeave={hide} onFocus={(e) => show("link", String(i), e)} onBlur={hide} onClick={(e) => show("link", String(i), e)}>
                  <title>{label}</title>
                </path>
              );
            })}
          </g>
          <g className="sankey-nodes">
            {m.nodes.map((n) => {
              const last = n.col === lastCol;
              const mid = (n.y0 + n.y1) / 2;
              const ly = n.labelY;
              const elbowX = last ? n.x1 + 10 : n.x0 - 10;
              const textX = last ? elbowX + 12 : elbowX - 12;
              const swatchX = last ? elbowX : elbowX - 7;
              const anchor = last ? "start" : "end";
              const leftBound = n.col ? m.columns[n.col - 1].x + (n.x1 - n.x0) + 10 : 0;
              const room = last ? m.width - textX - 6 : textX - leftBound - 6;
              const label = n.name + " · " + financeSankeyFormat(n.value, "€", 0);
              return (
                <g key={n.id} className="b360-flow-node" data-node-id={n.id} opacity={hover && !related.has(n.id) ? 0.14 : 1} tabIndex={0} role="button" aria-label={label}
                  onMouseEnter={(e) => show("node", n.id, e)} onMouseLeave={hide} onFocus={(e) => show("node", n.id, e)} onBlur={hide} onClick={(e) => show("node", n.id, e)}>
                  <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(0, n.y1 - n.y0)} rx="2" fill={n.color} stroke="#fff" strokeWidth=".7" />
                  <title>{label}</title>
                  <g className="sankey-label-group">
                    {Math.abs(ly - mid) > 1 && <path d={`M${last ? n.x1 : n.x0},${mid} H${elbowX + (last ? -3 : 3)} V${ly}`} fill="none" stroke={n.color} strokeWidth=".9" opacity=".75" />}
                    <rect x={swatchX} y={ly - 6} width="7" height="7" rx="2" fill={n.color} />
                    <text className="b360-flow-label b360-flow-name" x={textX} y={ly - 2} textAnchor={anchor} fontSize={m.font}>{financeSankeyTruncate(n.name, room, m.font)}</text>
                    {showValues && <text className="b360-flow-label b360-flow-value" x={textX} y={ly + m.valueFont + 2} textAnchor={anchor} fontSize={m.valueFont}>{money(n.value, room)}</text>}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>
        {showData && (
          <div className="sankey-data">
            <table>
              <thead><tr><th>Origine</th><th>Destination</th><th>Montant · €</th></tr></thead>
              <tbody>
                {m.links.map((l, i) => (
                  <tr key={i}><td>{byId.get(l.source).name}</td><td>{byId.get(l.target).name}</td><td className="numeric">{financeSankeyFormat(l.value, "", 0)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tip && (node || link) && !showData && (
          <div className="sankey-tooltip os-tooltip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
            <div className="os-tooltip-title">{title}</div>
            <div className="os-tooltip-context">{node?.name || byId.get(link.source).name + " → " + byId.get(link.target).name}</div>
            <div className="os-tooltip-row"><span>Montant réel</span><span className="os-tooltip-value">{financeSankeyFormat(node?.value ?? link.value, "€", 0)}</span></div>
            {link && <div className="os-tooltip-row"><span>Part du nœud d’origine</span><span>{financeSankeyFormat(100 * link.value / byId.get(link.source).value, "%", 1)}</span></div>}
            <div className="os-tooltip-foot">{period}</div>
          </div>
        )}
      </div>
      <div className="sankey-footer">
        <span title="Même échelle pour les revenus, les comptes et les dépenses. Les comptes représentent le maximum des entrées et sorties ; les espaces libres indiquent leur différence.">Échelle commune · hauteurs proportionnelles aux montants</span>
        <button type="button" onClick={() => { toggleData(); hide(); }} aria-pressed={showData}>{showData ? "Graphique" : "Données"}</button>
      </div>
    </div>
  );
}
// — index.html.part-003, ligne 37664
function financeBudgetEuro(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const rounded = Math.sign(value) * Math.round(Math.abs(value)) || 0;
  return rounded.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
// — index.html.part-003, ligne 38501
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
// — index.html.part-003, ligne 38546
function financeChartShortEuro(value) {
  const abs = Math.abs(value);
  const text = abs >= 1000 ? `${(value / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} k€` : `${Math.round(value).toLocaleString("fr-FR")} €`;
  return text;
}
// — index.html.part-003, ligne 38636
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
// — index.html.part-003, ligne 38862
const FINANCE_CUMUL_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7"];
// — index.html.part-003, ligne 38863
const FINANCE_CUMUL_OTHER = "#a3a7ad";
// — index.html.part-003, ligne 38864
const FINANCE_CUMUL_INK = { ink: "#0b0b0b", muted: "#52514e", grid: "#ebecee", axis: "#c9ccd1", over: "#c0392b", income: "#1f7a52", pace: "#52514e" };
// — index.html.part-003, ligne 38866
function financeCumulRound(v) { return Math.round(v * 100) / 100; }
// — index.html.part-003, ligne 38873
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
// — index.html.part-003, ligne 38908
function financeCumulSpread(items, gap) {
  const sorted = [...items].sort((a, b) => a.y - b.y);
  for (let k = 1; k < sorted.length; k++) if (sorted[k].y - sorted[k - 1].y < gap) sorted[k] = { ...sorted[k], y: sorted[k - 1].y + gap };
  return sorted;
}
// — index.html.part-003, ligne 38915
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
// — index.html.part-003, ligne 38931
function financeCumulFrame({ W, H, L = 50, R, T = 12, B = 24, top, days }) {
  const { max, ticks } = financeChartTicks(top);
  const n = days.length;
  const x = (k) => L + (n > 1 ? (k / (n - 1)) * (W - L - R) : 0);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const step = n > 1 ? (W - L - R) / (n - 1) : W - L - R;
  return { W, H, L, R, T, B, max, ticks, x, y, step, days };
}
// — index.html.part-003, ligne 38945
const FINANCE_CUMUL_REF = { w: 720, h: 280 };
// — index.html.part-003, ligne 38946
const FINANCE_CUMUL_MIN_H = 120;
// — index.html.part-003, ligne 38947
const FINANCE_CUMUL_MIN_W = 360;
// — index.html.part-003, ligne 38948
function financeCumulPlotSize(box, fallbackH) {
  if (!box || !(box.w > 0) || !(box.h > 0)) return { W: FINANCE_CUMUL_REF.w, H: fallbackH };
  const zoom = Math.min(1.5, Math.max(1, Math.min(box.w / FINANCE_CUMUL_REF.w, box.h / FINANCE_CUMUL_REF.h)));
  return { W: Math.max(FINANCE_CUMUL_MIN_W, box.w / zoom), H: Math.max(FINANCE_CUMUL_MIN_H, box.h / zoom) };
}
// — index.html.part-003, ligne 38953
function FinanceCumulPlot({ fallback, grow = 1, children }) {
  const ref = useRef(null);
  const [box, setBox] = useState(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return <div className="nx-bcu-plot" ref={ref} style={{ flexGrow: grow }}>{children(financeCumulPlotSize(box, fallback))}</div>;
}
// — index.html.part-003, ligne 38967
function financeCumulPath(values, f) {
  return values.map((v, k) => `${k ? "L" : "M"} ${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" ");
}
// — index.html.part-003, ligne 38970
function financeCumulDayLabel(d) {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(d + "T12:00:00Z"));
}
// — index.html.part-003, ligne 38973
function FinanceCumulAxes({ f }) {
  const I = FINANCE_CUMUL_INK;
  return (
    <>
      {f.ticks.map((t) => <g key={t}><line x1={f.L} x2={f.W - f.R} y1={f.y(t)} y2={f.y(t)} stroke={I.grid} /><text x={f.L - 5} y={f.y(t) + 3} textAnchor="end">{financeChartShortEuro(t)}</text></g>)}
      {f.days.map((d, k) => (
        <g key={d}>
          <line x1={f.x(k)} x2={f.x(k)} y1={f.H - f.B} y2={f.H - f.B + 3} stroke={I.axis} />
          <text x={f.x(k)} y={f.H - f.B + 13} textAnchor="middle" style={{ fontSize: f.days.length > 31 ? 7 : 8.5 }}>{Number(d.slice(8))}</text>
        </g>
      ))}
      <line x1={f.L} x2={f.W - f.R} y1={f.H - f.B} y2={f.H - f.B} stroke={I.axis} />
    </>
  );
}
// — index.html.part-003, ligne 38989
function FinanceCumulHit({ f, hover, setHover }) {
  return (
    <>
      {hover && <line x1={f.x(hover.i)} x2={f.x(hover.i)} y1={f.T} y2={f.H - f.B} stroke="#0b0b0b" strokeOpacity=".3" />}
      {f.days.map((d, k) => (
        <rect key={"hit" + d} x={f.x(k) - f.step / 2} y={f.T} width={f.step} height={f.H - f.T - f.B} fill="transparent"
          onMouseEnter={(e) => setHover({ i: k, x: e.clientX, y: e.clientY })}
          onMouseMove={(e) => setHover({ i: k, x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setHover(null)} />
      ))}
    </>
  );
}
// — index.html.part-003, ligne 39004
function FinanceCumulTip({ model, hover, series = model.series, totals = true }) {
  if (!hover) return null;
  const k = hover.i;
  const { budgetTotal } = model;
  const spent = model.total[k];
  return (
    <WidgetPointerTooltip x={hover.x} y={hover.y} className="lp-pie-tooltip">
      <div className="nx-bch-tip">
        <strong>Au {financeCumulDayLabel(model.days[k])}</strong>
        {series.filter((s) => s.values[k] > 0).map((s) => (
          <div key={s.category}>
            <span><i style={{ background: s.color }} />{s.category}{s.daily[k] > 0 ? ` (+${financeBudgetEuro(s.daily[k])} ce jour)` : ""}</span>
            <span>{financeBudgetEuro(s.values[k])}{!totals && s.budget > 0 ? ` / ${financeBudgetEuro(s.budget)}` : ""}</span>
          </div>
        ))}
        {totals && <div><strong>Dépenses cumulées</strong><strong>{financeBudgetEuro(spent)}</strong></div>}
        {totals && model.dailyTotal[k] > 0 && <div><span>Dépensé ce jour</span><span>{financeBudgetEuro(model.dailyTotal[k])}</span></div>}
        {totals && <div><span><i className="dash" style={{ borderColor: FINANCE_CUMUL_INK.income }} />Revenus cumulés</span><span>{financeBudgetEuro(model.income[k])}</span></div>}
        {totals && budgetTotal > 0 && <div><span><i className="dash" style={{ borderColor: FINANCE_CUMUL_INK.over }} />Budget total</span><span>{financeBudgetEuro(budgetTotal)}</span></div>}
        {totals && budgetTotal > 0 && (budgetTotal >= spent
          ? <div><span>Reste sur le budget</span><span>{financeBudgetEuro(budgetTotal - spent)}</span></div>
          : <div><span style={{ color: "#f3a3a6" }}>Dépassement du budget</span><span style={{ color: "#f3a3a6" }}>{financeBudgetEuro(spent - budgetTotal)}</span></div>)}
      </div>
    </WidgetPointerTooltip>
  );
}
// — index.html.part-003, ligne 39030
function FinanceCumulLegend({ model, lines = true }) {
  const I = FINANCE_CUMUL_INK;
  return (
    <div className="nx-bch-legend">
      {model.series.map((s) => (
        <span key={s.category} title={s.other ? s.members.join(", ") : undefined}>
          <i style={{ background: s.color }} />{s.category}{s.other ? ` (${s.members.length})` : ""} · {financeBudgetEuro(s.total)}
        </span>
      ))}
      {lines && <span><i className="dash" style={{ borderColor: I.income }} />Revenus cumulés</span>}
      {lines && model.budgetTotal > 0 && <span><i className="dash" style={{ borderColor: I.over }} />Budget total</span>}
    </div>
  );
}
// — index.html.part-003, ligne 39045
function FinanceCumulEndLabels({ f, items, gap = 12 }) {
  return financeCumulSpread(items, gap).map((it) => (
    <g key={it.key}>
      {it.swatch && <rect x={f.W - f.R + 4} y={it.y - 3} width="4" height="6" rx="1" fill={it.swatch} />}
      <text x={f.W - f.R + (it.swatch ? 11 : 6)} y={it.y + 3} style={{ fill: it.ink || FINANCE_CUMUL_INK.muted }}>
        <tspan style={{ fontWeight: 650 }}>{it.value}</tspan> {it.label}
      </text>
    </g>
  ));
}
// — index.html.part-003, ligne 39056
function FinanceCumulRefLines({ f, model, named = true }) {
  const I = FINANCE_CUMUL_INK;
  const last = model.days.length - 1;
  return (
    <>
      <path d={financeCumulPath(model.income, f)} fill="none" stroke={I.income} strokeWidth="1.6" strokeDasharray="5 4" />
      {model.budgetTotal > 0 && <line x1={f.L} x2={f.W - f.R} y1={f.y(model.budgetTotal)} y2={f.y(model.budgetTotal)} stroke={I.over} strokeWidth="1.6" strokeDasharray="6 4" />}
      {named && model.budgetTotal > 0 && <text x={f.L + 4} y={f.y(model.budgetTotal) - 4} style={{ fill: I.over, fontWeight: 600 }}>Budget {financeBudgetEuro(model.budgetTotal)}</text>}
      {named && last >= 0 && <text x={f.L + 4} y={f.y(model.income[last]) - 4} style={{ fill: I.income, fontWeight: 600 }}>Revenus {financeBudgetEuro(model.income[last])}</text>}
    </>
  );
}
// — index.html.part-003, ligne 39070
function FinanceCumulCategories({ model }) {
  const [hover, setHover] = useState(null);
  const last = model.days.length - 1;
  const base = model.days.map(() => 0);
  const layers = model.series.map((s) => {
    const lower = [...base];
    const upper = s.values.map((v, k) => (base[k] += v));
    return { ...s, lower, upper };
  });
  return (
    <>
      <FinanceCumulPlot fallback={280}>{({ W, H }) => {
      const f = financeCumulFrame({ W, H, R: 150, top: Math.max(model.spent, model.budgetTotal, ...model.income) * 1.04, days: model.days });
      return (
      <svg viewBox={`0 0 ${f.W} ${f.H}`} role="img" aria-label="Dépenses cumulées par catégorie, revenus cumulés et budget total">
        <FinanceCumulAxes f={f} />
        {layers.map((s) => (
          <path key={s.category} fill={s.color} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"
            d={`M ${s.upper.map((v, k) => `${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" L ")} L ${s.lower.map((v, k) => [k, v]).reverse().map(([k, v]) => `${f.x(k).toFixed(1)} ${f.y(v).toFixed(1)}`).join(" L ")} Z`} />
        ))}
        <FinanceCumulRefLines f={f} model={model} />
        {last >= 0 && <text x={f.x(last) - 3} y={f.y(model.spent) - 5} textAnchor="end" style={{ fill: FINANCE_CUMUL_INK.ink, fontWeight: 700, fontSize: 11 }}>{financeBudgetEuro(model.spent)}</text>}
        <FinanceCumulEndLabels f={f} items={layers.map((s) => ({ key: s.category, y: f.y(s.upper[last] - s.total / 2), value: financeBudgetEuro(s.total), label: s.category, swatch: s.color }))} />
        <FinanceCumulHit f={f} hover={hover} setHover={setHover} />
      </svg>
      );
      }}</FinanceCumulPlot>
      <FinanceCumulTip model={model} hover={hover} />
      <FinanceCumulLegend model={model} />
    </>
  );
}

export { financeSankeyBuild, FinanceSankeyChart, FinanceCumulCategories, financeSankeyNormalize, financeSankeyPeriodTransactions, financeSankeyMonthlyGraph, financeSankeyWealthGraph, financeCumulModel, financeBudgetEuro, financeChartTicks, financeChartShortEuro, FINANCE_SANKEY_DEFAULT_CONFIG, FINANCE_SANKEY_CSS, FINANCE_BUDGET_CHART_CSS, FINANCE_BUDGET_CUMUL_CSS, WidgetPointerTooltip };
