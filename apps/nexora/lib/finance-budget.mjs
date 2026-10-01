// Budget natif Nexora (#586) : calculs du mois, du suivi budgétaire, de la file
// « à catégoriser » et du patrimoine, à partir des tables brutes KDM360.
//
// Les règles de calcul sont celles d'OS360, traduites de son bundle (copie dans
// apps/nexora/public/os360-moteur) ; le nom de la fonction d'origine est donné
// en commentaire. Toute divergence avec OS360 est un défaut : corriger ici en
// relisant la fonction d'origine, jamais « améliorer ».
//
// Module unique, utilisé par /api/nexora/finance-budget-summary (widgets) et
// par le rapport du matin : les deux affichent donc les mêmes chiffres.

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const BUDGET_PREFIX = /^\[B360:BUDGET_V2:([0-9,]+)\]/;
// Catégories hors dépenses et revenus — `_f` d'OS360.
const NEUTRAL_CATEGORIES = new Set(["Transferts internes", "Ajustement"]);
const UNCLASSIFIED = "À classer";
const FALLBACK_COLORS = ["#4e79a7", "#f28e2b", "#59a14f", "#e15759", "#76b7b2", "#edc948", "#b07aa1", "#9c755f"];
export const CATEGORIZE_CONFIDENCE = 0.85;
export const CATEGORIZE_RECENT_DAYS = 60;

const text = (row, key, fallback = "") => (typeof row?.[key] === "string" ? row[key] : fallback);
function amount(value, fallback = 0) {
  if (value == null || value === "") return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("finance_invalid_amount");
  return n;
}
function isDate(value) {
  if (typeof value !== "string" || !DATE.test(value)) return false;
  const d = new Date(value + "T12:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const color = (value, fallback) => (typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value : fallback);
const round2 = (n) => Math.round(n * 100) / 100;
const rows = (raw, key) => {
  if (!Array.isArray(raw?.[key])) throw new Error("finance_invalid_response");
  return raw[key].map((row) => (row && typeof row === "object" && !Array.isArray(row) ? row : {}));
};

// Date civile de Paris (aaaa-mm-jj).
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(now);
}

export function monthBounds(month) {
  if (!MONTH.test(month || "")) throw new Error("invalid_month");
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);
  return { from: `${month}-01`, to: last };
}

export function shiftMonth(month, delta) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1, 12));
  return d.toISOString().slice(0, 7);
}

// Lignes brutes KDM360 -> modèle Budget d'OS360 — `Fc` et `jc` d'OS360.
// Une transaction sans identifiant ou sans dates valides refuse tout le jeu,
// comme OS360 : un total calculé sur un résultat partiel serait faux.
export function normalizeBudget(raw) {
  const transactions = rows(raw, "transactions");
  const cancelled = new Set(transactions.map((row) => row.cancels_transaction_id).filter(Boolean));
  const toTransaction = (row) => {
    const effectiveDate = text(row, "effective_date");
    const bankDate = text(row, "bank_date", effectiveDate);
    if (!isDate(effectiveDate) || !isDate(bankDate) || !row.transaction_id) throw new Error("finance_invalid_transaction");
    const rawData = row.raw && typeof row.raw === "object" && !Array.isArray(row.raw) ? row.raw : {};
    return {
      id: String(row.transaction_id),
      effectiveDate,
      bankDate,
      label: text(row, "merchant") || text(row, "description") || text(row, "transaction_type"),
      amount: amount(row.signed_amount),
      type: text(row, "transaction_type"),
      accountId: text(row, "account_id"),
      category: text(row, "category", UNCLASSIFIED),
      subcategory: text(row, "subcategory"),
      description: text(row, "description"),
      confidence: row.category_confidence == null || row.category_confidence === "" ? null : amount(row.category_confidence, null),
      budgetMonths: Array.isArray(rawData.budget_months) ? rawData.budget_months.map(String) : undefined,
    };
  };
  const ref = (row, nameKey, fallback) => ({ name: text(row, nameKey), color: color(row.color, fallback), active: row.active !== false });
  return {
    ledger: transactions
      .filter((row) => !["Budget", "Annulation", "Ouverture"].includes(text(row, "transaction_type")) && !cancelled.has(row.transaction_id))
      .map(toTransaction),
    transactions: transactions.filter((row) => !cancelled.has(row.transaction_id)).map(toTransaction),
    accounts: rows(raw, "accounts").filter((row) => row.active !== false).map((row) => ({
      id: text(row, "account_id"), name: text(row, "name"), bank: text(row, "bank"), type: text(row, "account_type"),
      opening: amount(row.opening_balance), color: color(row.color, "#536477"),
    })),
    categories: rows(raw, "categories").map((row) => ref(row, "category", "#536477")),
    subcategories: rows(raw, "subcategories").map((row) => ({ category: text(row, "category"), name: text(row, "subcategory"), active: row.active !== false })),
    banks: rows(raw, "banks").map((row) => ref(row, "name", "#536477")),
    accountTypes: rows(raw, "accountTypes").map((row) => ref(row, "name", "#536477")),
    balances: rows(raw, "balances").map((row) => ({
      accountId: text(row, "account_id"),
      date: text(row, "as_of_date") || text(row, "balance_date") || text(row, "date"),
      balance: amount(row.balance),
    })),
  };
}

// Dépenses, revenus, somme des valeurs absolues — `vf`, `yf`, `bf` d'OS360.
const isNeutral = (t) => NEUTRAL_CATEGORIES.has(t.category);
export const expensesOf = (list) => list.filter((t) => t.type === "Dépense" && !isNeutral(t));
export const incomeOf = (list) => list.filter((t) => ["Revenu", "Remboursement"].includes(t.type) && !isNeutral(t));
export const sumAbs = (list) => list.reduce((sum, t) => sum + Math.abs(t.amount), 0);

// Transactions de la période, date effective — `af` d'OS360 sans filtre de widget.
const inPeriod = (list, period) => list.filter((t) => t.effectiveDate >= period.from && t.effectiveDate <= period.to);

// Mois couverts par une ligne Budget — `pf` d'OS360.
export function budgetMonthsOf(t) {
  const months = t.budgetMonths?.map(Number) || t.description.match(BUDGET_PREFIX)?.[1].split(",").map(Number) || [];
  return [...new Set(months.filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))];
}

// Budget d'une catégorie pour un mois aaaa-mm — `mf` d'OS360.
function categoryBudget(budgets, category, month) {
  return budgets
    .filter((t) => t.category === category && t.effectiveDate.slice(0, 4) === month.slice(0, 4))
    .filter((t) => budgetMonthsOf(t).includes(Number(month.slice(5, 7))))
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);
}

// Suivi budgétaire d'une période — `osBudgetGroups` + `hf` d'OS360 : catégories
// ayant une dépense dans la période ou une ligne Budget sur ses années, triées.
export function budgetTracking(data, period) {
  const months = [...new Set(enumerateDays(period.from, period.to).map((d) => d.slice(0, 7)))];
  const expenses = expensesOf(inPeriod(data.transactions, period));
  const budgets = data.transactions.filter((t) => t.type === "Budget"
    && t.effectiveDate.slice(0, 4) >= period.from.slice(0, 4) && t.effectiveDate.slice(0, 4) <= period.to.slice(0, 4));
  const categories = [...new Set([...expenses.map((t) => t.category), ...budgets.map((t) => t.category)])].sort();
  return categories.map((category) => {
    const actual = sumAbs(expenses.filter((t) => t.category === category));
    const budget = months.reduce((sum, month) => sum + categoryBudget(budgets, category, month), 0);
    return {
      category,
      color: data.categories.find((c) => c.name === category)?.color || "#536477",
      budget: round2(budget),
      actual: round2(actual),
      remaining: round2(budget - actual),
      over: actual > budget,
    };
  });
}

// Jours d'une période — `ne` d'OS360.
function enumerateDays(from, to) {
  const days = [];
  const d = new Date(from + "T12:00:00Z");
  const end = new Date(to + "T12:00:00Z");
  while (d <= end && days.length < 40000) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return days;
}

// Solde de chaque compte à une date : dernier relevé connu, puis mouvements du
// grand livre postérieurs — `of` d'OS360 (date bornée à aujourd'hui en UTC,
// comme l'original).
export function accountBalances(data, date, now = new Date()) {
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
      balance: base + data.ledger
        .filter((t) => t.accountId === account.id && t.effectiveDate > after && t.effectiveDate <= until)
        .reduce((sum, t) => sum + t.amount, 0),
    };
  });
}

// Patrimoine total à une date — `sf` d'OS360.
export const wealthAt = (data, date, now = new Date()) => accountBalances(data, date, now).reduce((sum, a) => sum + a.balance, 0);

// Opérations à catégoriser : catégorie absente ou « À classer », sous-catégorie
// hors du catalogue actif (vide acceptée seulement pour une catégorie qui n'a
// aucune sous-catégorie, comme Vacances), ou catégorie proposée par l'IA avec
// une confiance < 85 % sur les 60 derniers jours. Une catégorie validée dans
// Nexora passe à une confiance de 1 et quitte la file.
export function toCategorize(data, today) {
  const active = data.subcategories.filter((s) => s.active);
  const pairs = new Set(active.map((s) => `${s.category}\u0000${s.name}`));
  const withSubcategories = new Set(active.map((s) => s.category));
  const recentFrom = shiftDays(today, -CATEGORIZE_RECENT_DAYS);
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  return data.transactions
    .filter((t) => ["Dépense", "Revenu", "Remboursement"].includes(t.type))
    .map((t) => {
      let reason = null;
      if (!t.category || t.category === UNCLASSIFIED) reason = "sans_categorie";
      else if (t.subcategory ? !pairs.has(`${t.category}\u0000${t.subcategory}`) : withSubcategories.has(t.category)) reason = "sous_categorie";
      else if (t.confidence != null && t.confidence < CATEGORIZE_CONFIDENCE && t.effectiveDate >= recentFrom) reason = "confiance";
      return reason && {
        id: t.id, date: t.effectiveDate, label: t.label, amount: t.amount, type: t.type,
        account: accounts.get(t.accountId)?.name || t.accountId,
        category: t.category === UNCLASSIFIED ? "" : t.category, subcategory: t.subcategory,
        confidence: t.confidence, reason,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

function shiftDays(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Synthèse d'un mois : carte, suivi, file à catégoriser, patrimoine.
export function buildBudgetSummary(raw, month, now = new Date()) {
  const data = normalizeBudget(raw);
  const today = parisToday(now);
  const period = monthBounds(month || today.slice(0, 7));
  const periodRows = inPeriod(data.transactions, period);
  const expenses = sumAbs(expensesOf(periodRows));
  const income = sumAbs(incomeOf(periodRows));
  const tracking = budgetTracking(data, period);
  const budgeted = tracking.filter((c) => c.budget > 0);
  const budgetTotal = budgeted.reduce((sum, c) => sum + c.budget, 0);
  const budgetedSpent = budgeted.reduce((sum, c) => sum + c.actual, 0);

  // Patrimoine : soldes à la fin du mois (bornés à aujourd'hui), répartition
  // banque × type de compte, et total en fin de mois sur 12 mois.
  const balances = accountBalances(data, period.to, now);
  // Couleur du type de compte ; à défaut, une teinte de secours distincte par type.
  const typeNames = [...new Set(balances.map((a) => a.type || "Sans type"))].sort();
  const typeColor = (name) => data.accountTypes.find((t) => t.name === name)?.color
    || FALLBACK_COLORS[typeNames.indexOf(name) % FALLBACK_COLORS.length];
  const bankColor = (name) => data.banks.find((b) => b.name === name)?.color || "#8899a6";
  const byBank = new Map();
  for (const a of balances) {
    const bank = a.bank || "Sans banque";
    if (!byBank.has(bank)) byBank.set(bank, new Map());
    const types = byBank.get(bank);
    const type = a.type || "Sans type";
    types.set(type, (types.get(type) || 0) + a.balance);
  }
  const banks = [...byBank].map(([bank, types]) => ({
    bank,
    color: bankColor(bank),
    total: round2([...types.values()].reduce((s, v) => s + v, 0)),
    segments: [...types].map(([type, value]) => ({ type, value: round2(value), color: typeColor(type) }))
      .sort((a, b) => b.value - a.value),
  })).sort((a, b) => b.total - a.total);
  const history = [];
  for (let i = 11; i >= 0; i--) {
    const m = shiftMonth(period.from.slice(0, 7), -i);
    const end = monthBounds(m).to;
    history.push({ month: m, total: round2(wealthAt(data, end, now)) });
  }

  return {
    month: period.from.slice(0, 7),
    period,
    today,
    totals: {
      expenses: round2(expenses),
      income: round2(income),
      net: round2(income - expenses),
      budget: round2(budgetTotal),
      remaining: round2(budgetTotal - budgetedSpent),
    },
    tracking,
    overBudget: tracking.filter((c) => c.over && c.budget > 0).map((c) => c.category),
    toCategorize: toCategorize(data, today),
    wealth: {
      date: period.to > today ? today : period.to,
      total: round2(balances.reduce((s, a) => s + a.balance, 0)),
      banks,
      types: [...new Set(balances.map((a) => a.type || "Sans type"))].map((name) => ({ name, color: typeColor(name) })),
      history,
    },
    catalogs: {
      accounts: data.accounts.map((a) => ({ id: a.id, name: a.name, bank: a.bank, type: a.type })),
      categories: data.categories.filter((c) => c.active).map((c) => ({
        name: c.name,
        color: c.color,
        subcategories: data.subcategories.filter((s) => s.active && s.category === c.name).map((s) => s.name).sort((a, b) => a.localeCompare(b, "fr")),
      })).sort((a, b) => a.name.localeCompare(b.name, "fr")),
    },
  };
}

// Partie Budget du rapport du matin : reste à dépenser, alertes, file.
export function buildBudgetReport(raw, now = new Date()) {
  const summary = buildBudgetSummary(raw, null, now);
  const near = summary.tracking.filter((c) => c.budget > 0 && !c.over && c.actual >= 0.9 * c.budget);
  return {
    month: summary.month,
    expenses: summary.totals.expenses,
    income: summary.totals.income,
    net: summary.totals.net,
    budget: summary.totals.budget,
    remaining: summary.totals.remaining,
    overBudget: summary.tracking.filter((c) => c.budget > 0 && c.over).map((c) => ({ category: c.category, budget: c.budget, actual: c.actual })),
    nearBudget: near.map((c) => ({ category: c.category, budget: c.budget, actual: c.actual })),
    toCategorize: summary.toCategorize.length,
  };
}
