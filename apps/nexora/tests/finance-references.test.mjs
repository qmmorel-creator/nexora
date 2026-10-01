/* Réglages → Catégories Budget (issue #574). Tranche extraite du bundle
   réellement construit ; route serveur et fonction SQL lues dans le dépôt. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const html = await readFile(new URL("../.build/index.html", import.meta.url), "utf8");
const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

function slice(name) {
  const start = `// === NEXORA:${name}:START ===`;
  const end = `// === NEXORA:${name}:END ===`;
  const from = html.indexOf(start);
  const to = html.indexOf(end);
  assert.ok(from !== -1 && to > from, `bloc ${name} introuvable dans .build/index.html`);
  return html.slice(from + start.length, to);
}
const R = vm.runInThisContext(`(function () {\n${slice("FINANCE-REFERENCES")}\n;return { financeRefIsProtected, financeRefTree, financeRefRenameMessage };\n})`)();

const data = {
  categories: [
    { category: "Logement", color: "#8c5a3c", active: true, usage: 12 },
    { category: "Alimentation", color: "#d08c2f", active: true, usage: 418 },
    { category: "Ancienne", color: null, active: false, usage: 0 },
  ],
  subcategories: [
    { category: "Alimentation", subcategory: "Restaurant", active: true, usage: 40 },
    { category: "Alimentation", subcategory: "Courses", active: true, usage: 300 },
    { category: "Alimentation", subcategory: "Cantine", active: false, usage: 0 },
  ],
};

test("onglet Réglages rattaché, page servie par la route du propriétaire", () => {
  assert.match(html, /\{ key: "budgetCategories", label: "Catégories Budget", icon: "wallet" \}/);
  assert.match(html, /activeTab === "budgetCategories" && <BudgetCategoriesSettings pushToast=\{pushToast\} \/>/);
  assert.match(html, /fetch\("\/api\/nexora\/finance-references"/);
});

test("noms protégés reconnus avec ou sans accents ni majuscules", () => {
  for (const n of ["Épargne", "epargne", " ÉPARGNE ", "Transferts internes", "Ajustement"]) assert.equal(R.financeRefIsProtected(n), true, n);
  for (const n of ["Alimentation", "Épargne logement", ""]) assert.equal(R.financeRefIsProtected(n), false, n);
});

test("arbre trié, filtre texte sur catégories et sous-catégories, inactives masquables", () => {
  assert.deepEqual(R.financeRefTree(data).map((c) => c.category), ["Alimentation", "Ancienne", "Logement"]);
  assert.deepEqual(R.financeRefTree(data)[0].subcategories.map((s) => s.subcategory), ["Cantine", "Courses", "Restaurant"]);
  assert.deepEqual(R.financeRefTree(data, "", false).map((c) => c.category), ["Alimentation", "Logement"]);
  assert.deepEqual(R.financeRefTree(data, "", false)[0].subcategories.map((s) => s.subcategory), ["Courses", "Restaurant"]);
  assert.deepEqual(R.financeRefTree(data, "resta").map((c) => c.category), ["Alimentation"], "une sous-catégorie fait remonter sa catégorie");
});

test("la confirmation de renommage dit combien de transactions changent", () => {
  assert.match(R.financeRefRenameMessage("category", "Alimentation", "Courses", 418), /« Alimentation » en « Courses »[\s\S]*418 transactions seront renommées/);
  assert.match(R.financeRefRenameMessage("subcategory", "Cantine", "Midi", 1), /1 transaction sera renommée/);
  assert.match(R.financeRefRenameMessage("category", "X", "Y", 0), /aucune transaction ne l'utilise/);
});

test("route : session du propriétaire, écritures UNIQUEMENT par les fonctions d'administration", async () => {
  const source = await read("../netlify/functions/finance-references.ts");
  assert.match(source, /path: "\/api\/nexora\/finance-references", method: \["GET", "POST"\]/);
  assert.match(source, /await requireOwnerFinance\(req\)/);
  assert.match(source, /"finance_admin_reference_write"/);
  assert.match(source, /"finance_admin_reference_edit"/);
  // Aucune écriture directe dans une table : seules les lectures paginées et les RPC.
  assert.doesNotMatch(source, /method: "(PATCH|PUT|DELETE)"/);
  assert.doesNotMatch(source, /rest\/v1\/finance_(?!.*rpc)[a-z_]+[^"`]*", \{ method/);
  assert.match(source, /\/rest\/v1\/rpc\/\$\{name\}/);
  for (const code of ["reference_in_use", "reference_protected", "category_exists"]) assert.match(source, new RegExp(code));
  assert.match(source, /color_invalid/);
  assert.match(source, /monthly_budget_invalid/);
});

test("fonction SQL : service_role seul, atomique, tracée, idempotente, noms protégés", async () => {
  const sql = await read("../supabase/finance_admin_reference_edit.sql");
  assert.match(sql, /security definer/);
  assert.match(sql, /revoke all on function public\.finance_admin_reference_edit\(text, text, text, jsonb, text, text\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.finance_admin_reference_edit\(text, text, text, jsonb, text, text\) to service_role;/);
  assert.match(sql, /v_protected text\[\] := array\['epargne', 'transferts internes', 'ajustement'\]/);
  assert.match(sql, /insert into public\.finance_reference_audit/);
  assert.match(sql, /insert into public\.finance_write_outbox/);
  assert.match(sql, /update public\.finance_merchant_rules set category = v_new/);
  assert.match(sql, /update public\.finance_recurring_rules set category = v_new/);
  assert.match(sql, /jsonb_set\(t\.raw, '\{8\}'/);
  assert.match(sql, /jsonb_set\(t\.raw, '\{9\}'/);
  assert.match(sql, /revision = t\.revision \+ 1/);
  assert.match(sql, /after_value->>'idempotency_key' = v_key/);
});
