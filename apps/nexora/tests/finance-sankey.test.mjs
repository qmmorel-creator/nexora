/* Widgets Sankey Budget (issue #569).
   La tranche testée est extraite du bundle RÉELLEMENT construit, comme les
   autres blocs. Les valeurs attendues ont été établies en exécutant, sur les
   mêmes données, les fonctions d'origine (Ef, Df, of, te, Ff,
   Yf) : toute divergence ici signale un écart avec l'origine. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}

const EXPORTS = [
  "FINANCE_SANKEY_TYPES", "financeSankeyPeriod", "financeSankeyRound", "financeSankeyFormat", "financeSankeyNormalize",
  "financeSankeyAccountBalances", "financeSankeyMonthlyGraph", "financeSankeyWealthGraph", "financeSankeyBuild",
  "financeSankeyLayout", "financeSankeyDateLabel", "financeSankeyQuickPeriod",
];
const S = vm.runInThisContext(`(function () {\n${slice("FINANCE-SANKEY")}\n;return { ${EXPORTS.join(", ")} };\n})`)();

const raw = {
  transactions: [
    { transaction_id: "t1", effective_date: "2026-09-02", bank_date: "2026-09-03", transaction_type: "Revenu", account_id: "cc", signed_amount: 3000, category: "Revenus", subcategory: "Salaire" },
    { transaction_id: "t2", effective_date: "2026-09-05", bank_date: "2026-09-05", transaction_type: "Dépense", account_id: "cc", signed_amount: -900, category: "Logement", subcategory: "" },
    { transaction_id: "t3", effective_date: "2026-09-06", bank_date: "2026-09-06", transaction_type: "Dépense", account_id: "cc", signed_amount: -300, category: "Alimentation", subcategory: "" },
    { transaction_id: "t4", effective_date: "2026-09-07", bank_date: "2026-09-07", transaction_type: "Remboursement", account_id: "cc", signed_amount: 50, category: "Santé", subcategory: "" },
    { transaction_id: "t5", effective_date: "2026-09-08", bank_date: "2026-09-08", transaction_type: "Dépense", account_id: "cc", signed_amount: -500, category: "Transferts internes", subcategory: "" },
    { transaction_id: "t6", effective_date: "2026-09-09", bank_date: "2026-09-09", transaction_type: "Dépense", account_id: "cc", signed_amount: -80, category: "Loisirs", subcategory: "" },
    { transaction_id: "t7", effective_date: "2026-09-10", bank_date: "2026-09-10", transaction_type: "Annulation", account_id: "cc", signed_amount: 80, category: "Loisirs", subcategory: "", cancels_transaction_id: "t6" },
    { transaction_id: "t8", effective_date: "2026-08-20", bank_date: "2026-08-20", transaction_type: "Dépense", account_id: "cc", signed_amount: -42, category: "Loisirs", subcategory: "" },
  ],
  accounts: [
    { account_id: "cc", name: "Compte courant", bank: "Banque A", account_type: "Courant", opening_balance: 1000, color: "#2a6f97", active: true },
    { account_id: "liv", name: "Livret", bank: "Banque B", account_type: "Épargne", opening_balance: 5000, color: null, active: true },
    { account_id: "old", name: "Clos", bank: "Banque B", account_type: "Courant", opening_balance: 999, color: null, active: false },
  ],
  categories: [{ category: "Logement", color: "#aa3322" }, { category: "Alimentation", color: null }],
  banks: [{ bank_id: "a", name: "Banque A", color: "#123456" }],
  accountTypes: [{ id: "x", name: "Épargne", color: "#654321" }],
  balances: [{ account_id: "liv", as_of_date: "2026-06-30", balance: 6000 }],
};

test("deux types de widget, rattachés au catalogue et au rendu", () => {
  assert.deepEqual([...S.FINANCE_SANKEY_TYPES], ["financeSankeyMonthly", "financeSankeyWealth"]);
  for (const type of S.FINANCE_SANKEY_TYPES) assert.match(html, new RegExp(`key: "${type}"`), `${type} absent de WIDGET_TYPE_META`);
  assert.match(html, /FINANCE_SANKEY_TYPES\.includes\(w\.type\) && \(\s*<WidgetFinanceSankey widget=\{w\} externalToolbarSlot=\{headerToolbarSlot\} onUpdateWidget=/);
  // Réglages en en-tête (retour de test #569) : la barre d'outils du cadre est ouverte pour les deux types.
  assert.match(html, /hasHeaderToolbar=\{[^}]*\|\| FINANCE_SANKEY_TYPES\.includes\(w\.type\)/);
  for (const label of ["Aujourd’hui", "Ce mois", "Mois précédent", "Choisir le mois", "Variante du Sankey", "Étiquetage des valeurs", "Arrondi des valeurs", "Nombre de décimales", "Opacité des flux (0,1 à 1)"]) {
    assert.ok(html.includes(label), `contrôle d'en-tête manquant : ${label}`);
  }
  assert.match(html, /if \(FINANCE_SANKEY_TYPES\.includes\(type\)\) data\.sankeyConfig = \{ \.\.\.sankeyConfig \};/);
});

test("normalisation : annulées, comptes inactifs et grand livre comme à l'origine", () => {
  const data = S.financeSankeyNormalize(raw);
  assert.deepEqual(data.transactions.map((t) => t.id), ["t1", "t2", "t3", "t4", "t5", "t7", "t8"]);
  assert.deepEqual(data.ledger.map((t) => t.id), ["t1", "t2", "t3", "t4", "t5", "t8"]);
  assert.deepEqual(data.accounts.map((a) => a.id), ["cc", "liv"]);
  assert.equal(data.accounts[1].color, "#536477");
  assert.throws(() => S.financeSankeyNormalize({ ...raw, transactions: [{ transaction_id: "z", effective_date: "2026-13-01" }] }), /dates valides/);
  assert.throws(() => S.financeSankeyNormalize({ ...raw, balances: undefined }), /Réponse Budget invalide/);
});

test("Sankey mensuel : revenus → comptes → catégories, hors transferts internes", () => {
  const data = S.financeSankeyNormalize(raw);
  const { graph, period } = S.financeSankeyBuild("financeSankeyMonthly", data, { periodMode: "month", periodValue: "2026-09" }, "2026-10-01");
  assert.deepEqual(graph.columns, ["ORIGINE", "COMPTES", "DESTINATION"]);
  assert.deepEqual(graph.nodes.map((n) => n.id), ["income:Salaire", "income:Remboursement", "account:cc", "category:Logement", "category:Alimentation"]);
  assert.deepEqual(graph.links, [
    { source: "income:Salaire", target: "account:cc", value: 3000 },
    { source: "income:Remboursement", target: "account:cc", value: 50 },
    { source: "account:cc", target: "category:Logement", value: 900 },
    { source: "account:cc", target: "category:Alimentation", value: 300 },
  ]);
  assert.equal(graph.nodes.find((n) => n.id === "category:Logement").color, "#aa3322");
  assert.equal(graph.nodes.find((n) => n.id === "category:Alimentation").color, "#536477");
  assert.equal(period, "1 sept. 2026 → 30 sept. 2026");
});

test("Structure du patrimoine : dernier relevé puis grand livre, soldes positifs", () => {
  const data = S.financeSankeyNormalize(raw);
  const now = new Date("2026-10-01T10:00:00Z");
  const { graph } = S.financeSankeyBuild("financeSankeyWealth", data, { periodMode: "month", periodValue: "2026-09" }, "2026-10-01", now);
  assert.deepEqual(graph.columns, ["TYPE", "BANQUE", "COMPTE"]);
  // Compte courant : 1000 + 3000 - 900 - 300 + 50 - 500 - 42 = 2308 (t6 annulée hors grand livre) ; Livret : relevé 6000.
  assert.deepEqual(graph.links, [
    { source: "type:Courant", target: "bank:Banque A", value: 2308 },
    { source: "type:Épargne", target: "bank:Banque B", value: 6000 },
    { source: "bank:Banque A", target: "account:cc", value: 2308 },
    { source: "bank:Banque B", target: "account:liv", value: 6000 },
  ]);
  assert.equal(graph.nodes.find((n) => n.id === "type:Épargne").color, "#654321");
  assert.equal(graph.nodes.find((n) => n.id === "bank:Banque B").color, "#cf7856");
  // Une date future est bornée à aujourd'hui.
  const future = S.financeSankeyAccountBalances(data, "2027-01-01", now);
  assert.equal(future.find((a) => a.id === "cc").balance, 2308);
});

test("périodes : mois, année, fenêtre glissante, dates libres, tout l'historique", () => {
  const today = "2026-10-01";
  assert.deepEqual(S.financeSankeyPeriod({}, today), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(S.financeSankeyPeriod({ periodMode: "month", periodValue: "2026-02" }, today), { from: "2026-02-01", to: "2026-02-28" });
  assert.deepEqual(S.financeSankeyPeriod({ periodMode: "year", periodValue: "2025" }, today), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(S.financeSankeyPeriod({ range: "30" }, today), { from: "2026-09-02", to: "2026-10-01" });
  assert.deepEqual(S.financeSankeyPeriod({ from: "2026-03-01" }, today), { from: "2026-03-01", to: "2026-10-31" });
  assert.deepEqual(S.financeSankeyPeriod({ range: "all" }, today), { from: "1900-01-01", to: today });
  const data = S.financeSankeyNormalize(raw);
  const all = S.financeSankeyBuild("financeSankeyMonthly", data, { range: "all" }, today);
  assert.ok(all.graph.links.some((l) => l.target === "category:Loisirs" && l.value === 42));
});

test("barre de période : aujourd'hui, ce mois, mois précédent, mois choisi", () => {
  const today = "2026-10-01";
  assert.deepEqual(S.financeSankeyPeriod({ quickPeriod: "today" }, today), { from: today, to: today });
  assert.deepEqual(S.financeSankeyPeriod({ quickPeriod: "current" }, today), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(S.financeSankeyPeriod({ quickPeriod: "previous" }, today), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(S.financeSankeyPeriod({ periodMode: "month", periodValue: "previous" }, "2026-03-15"), { from: "2026-02-01", to: "2026-02-28" });
  // La sélection rapide prime, comme le correctif de `te` d'origine.
  assert.deepEqual(S.financeSankeyPeriod({ quickPeriod: "previous", from: "2025-01-01", to: "2025-01-31" }, today), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(S.financeSankeyPeriod({ periodMode: "month", periodValue: "2026-06", quickPeriod: "" }, today), { from: "2026-06-01", to: "2026-06-30" });
});

test("formats : arrondi intelligent, compact et espace insécable comme à l'origine", () => {
  assert.equal(S.financeSankeyRound(1234.567, "€", 2, "auto"), "1\u202F235");
  assert.equal(S.financeSankeyRound(3.14159, "€", 2, "auto"), "3,14");
  assert.equal(S.financeSankeyRound(1234.567, "€", 2, "fixed"), "1\u202F234,57");
  assert.equal(S.financeSankeyRound(1234567, "€", 2, "compact"), "1,2\u00A0M");
  assert.equal(S.financeSankeyFormat(-1500.5, "€", 2), "-1\u202F500,5\u00A0€");
  assert.equal(S.financeSankeyFormat(null, "€", 2), "—");
});

test("mise en page : échelle commune, piliers proportionnels, aucun ruban hors des nœuds", () => {
  const data = S.financeSankeyNormalize(raw);
  const { graph } = S.financeSankeyBuild("financeSankeyMonthly", data, { periodMode: "month", periodValue: "2026-09" }, "2026-10-01");
  const m = S.financeSankeyLayout(graph, 900, 470);
  assert.equal(m.width, 900);
  assert.equal(m.height, 470);
  const scale = (470 - 58 - 24) / 3050;
  const account = m.nodes.find((n) => n.id === "account:cc");
  assert.ok(Math.abs((account.y1 - account.y0) - 3050 * scale) < 1e-9, "le compte vaut le maximum de ses entrées et sorties");
  for (const l of m.links) {
    const s = m.nodes.find((n) => n.id === l.source);
    const t = m.nodes.find((n) => n.id === l.target);
    assert.ok(l.sourceY0 >= s.y0 - 1e-9 && l.sourceY1 <= s.y1 + 1e-9);
    assert.ok(l.targetY0 >= t.y0 - 1e-9 && l.targetY1 <= t.y1 + 1e-9);
  }
  assert.deepEqual(m.columns.map((c) => c.value), [3050, 3050, 1200]);
});

test("fonction serveur : lecture seule, jeton Firebase vérifié, propriétaire unique, colonnes limitées", async () => {
  const source = await readFile(new URL("../netlify/functions/finance-sankey-data.ts", import.meta.url), "utf8");
  const financeOwner = await readFile(new URL("../netlify/functions/_shared/finance-owner.ts", import.meta.url), "utf8");
  // Contrôle du propriétaire partagé avec les données sport (#578) : _shared/owner.ts.
  assert.match(financeOwner, /const denied = await requireOwner\(req\);\n  if \(denied\) return \{ response: denied \};/);
  const owner = financeOwner + await readFile(new URL("../netlify/functions/_shared/owner.ts", import.meta.url), "utf8");
  assert.match(source, /path: "\/api\/nexora\/finance-sankey-data", method: \["GET"\]/);
  assert.match(source, /if \(req\.method !== "GET"\)/);
  assert.match(source, /await requireOwnerFinance\(req\)/);
  assert.match(owner, /getAuth\(\)\.verifyIdToken\(token\)/);
  assert.match(owner, /decoded\.uid !== ownerUid/);
  assert.match(owner, /Netlify\.env\.get\("NEXORA_USER_UID"\)/);
  assert.match(owner, /finance_volume_limit/);
  assert.doesNotMatch(source + owner, /method: "(POST|PATCH|PUT|DELETE)"|rpc\//);
  // Le Sankey ne lit que ses colonnes : ni libellé, ni description, ni données brutes.
  assert.doesNotMatch(source, /select: "\*"|merchant|description|raw/);
});
