import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { financeFetch } from "./_shared/finance.js";
import { readAllRows, requireOwnerFinance } from "./_shared/finance-owner.js";

// Réglages → Catégories Budget (#574) : catégories et sous-catégories KDM360,
// lues et modifiées depuis la session Nexora du propriétaire (vérification
// dans _shared/finance-owner.ts). Aucune écriture directe dans les tables :
// tout passe par les deux fonctions d'administration de la base, qui tracent
// chaque opération dans finance_reference_audit :
//   - finance_admin_reference_write : création, budget mensuel, activation,
//     suppression (refusée tant que des transactions utilisent la référence) ;
//   - finance_admin_reference_edit (apps/nexora/supabase/) : renommage
//     répercuté sur les transactions et les règles, et couleur, en une
//     transaction Postgres.

const ACTOR = "nexora";
const NAME_MAX = 80;

class InputError extends Error {}

function text(value: unknown, field: string, required = true) {
  if (value == null || value === "") {
    if (required) throw new InputError(`${field}_required`);
    return "";
  }
  if (typeof value !== "string") throw new InputError(`${field}_invalid`);
  const result = value.trim();
  if (required && !result) throw new InputError(`${field}_required`);
  if (result.length > NAME_MAX) throw new InputError(`${field}_too_long`);
  return result;
}

function color(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(value)) throw new InputError("color_invalid");
  return value;
}

function budget(value: unknown) {
  if (value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) throw new InputError("monthly_budget_invalid");
  return Math.round(n * 100) / 100;
}

// Codes d'erreur des fonctions SQL -> messages lisibles.
const MESSAGES: Record<string, string> = {
  reference_in_use: "Suppression refusée : des transactions utilisent encore cette référence.",
  reference_protected: "Ce nom est protégé (Épargne, Transferts internes, Ajustement) : il est lu par les calculs de Nexora.",
  category_exists: "Une catégorie porte déjà ce nom.",
  subcategory_exists: "Cette catégorie a déjà une sous-catégorie de ce nom.",
  category_not_found: "Catégorie introuvable : elle a peut-être été modifiée ailleurs. Actualisez.",
  subcategory_not_found: "Sous-catégorie introuvable : elle a peut-être été modifiée ailleurs. Actualisez.",
  no_change: "Aucune modification à enregistrer.",
};

function sqlCode(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return Object.keys(MESSAGES).find((code) => message.includes(code)) || null;
}

async function rpc(config: { url: string; secretKey: string }, name: string, args: Record<string, unknown>) {
  return financeFetch(config, `/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(args) });
}

async function listReferences(config: { url: string; secretKey: string }) {
  const [categories, subcategories, transactions] = await Promise.all([
    readAllRows(config, { table: "finance_categories_current", select: "category,color,monthly_budget,active,keywords", order: "category" }),
    readAllRows(config, { table: "finance_subcategories_current", select: "category,subcategory,color,active,keywords", order: "category,subcategory" }),
    readAllRows(config, { table: "finance_transactions_current", select: "category,subcategory", order: "transaction_id" }),
  ]) as [any[], any[], any[]];
  const byCategory = new Map<string, number>();
  const bySub = new Map<string, number>();
  for (const t of transactions) {
    if (!t.category) continue;
    byCategory.set(t.category, (byCategory.get(t.category) || 0) + 1);
    if (t.subcategory) bySub.set(t.category + "\u0000" + t.subcategory, (bySub.get(t.category + "\u0000" + t.subcategory) || 0) + 1);
  }
  const known = new Set(categories.map((c) => c.category));
  return {
    categories: categories.map((c) => ({ ...c, usage: byCategory.get(c.category) || 0 })),
    subcategories: subcategories.map((s) => ({ ...s, usage: bySub.get(s.category + "\u0000" + s.subcategory) || 0 })),
    // Noms portés par des transactions sans entrée au référentiel (héritage
    // d'anciens renommages) : affichés pour être recréés ou corrigés.
    orphans: [...byCategory.entries()].filter(([name]) => !known.has(name)).map(([category, usage]) => ({ category, usage })),
  };
}

export default async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  const config = access.config;

  if (req.method === "GET") {
    try {
      return json({ ok: true, data: await listReferences(config) });
    } catch (error) {
      return json({ ok: false, error: "finance_read_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
    }
  }

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  try {
    const action = text(body.action, "action");
    const entity = text(body.entity, "entity");
    if (entity !== "category" && entity !== "subcategory") throw new InputError("entity_invalid");
    const category = text(body.category, "category");
    const subcategory = entity === "subcategory" ? text(body.subcategory, "subcategory") : "";
    let result: unknown;

    if (action === "edit") {
      const changes: Record<string, unknown> = {};
      if (body.name !== undefined) changes.name = text(body.name, "name");
      if (body.color !== undefined) changes.color = color(body.color);
      const idempotencyKey = text(body.idempotencyKey, "idempotency_key");
      result = await rpc(config, "finance_admin_reference_edit", {
        p_entity: entity, p_category: category, p_subcategory: subcategory || null, p_changes: changes, p_idempotency_key: idempotencyKey, p_actor: ACTOR,
      });
    } else if (["create", "update", "activate", "deactivate", "delete"].includes(action)) {
      const payload: Record<string, unknown> = { category };
      if (entity === "subcategory") payload.subcategory = subcategory;
      if (action === "create" || action === "update") {
        if (entity === "category" && body.monthlyBudget !== undefined) payload.monthlyBudget = budget(body.monthlyBudget);
        if (body.keywords !== undefined) payload.keywords = text(body.keywords, "keywords", false) || null;
      }
      result = await rpc(config, "finance_admin_reference_write", { p_action: action, p_entity: entity, p_payload: payload, p_actor: ACTOR });
      // La création ne connaît pas la couleur : elle suit dans un second appel tracé.
      if (action === "create" && body.color) {
        await rpc(config, "finance_admin_reference_edit", {
          p_entity: entity, p_category: category, p_subcategory: subcategory || null, p_changes: { color: color(body.color) },
          p_idempotency_key: `create-color:${entity}:${category}:${subcategory}:${Date.now()}`, p_actor: ACTOR,
        });
      }
    } else {
      throw new InputError("action_invalid");
    }
    return json({ ok: true, result, data: await listReferences(config) });
  } catch (error) {
    if (error instanceof InputError) return json({ ok: false, error: error.message }, 400);
    const code = sqlCode(error);
    if (code) return json({ ok: false, error: code, message: MESSAGES[code] }, code === "category_not_found" || code === "subcategory_not_found" ? 404 : 409);
    return json({ ok: false, error: "finance_write_failed", detail: error instanceof Error ? error.message : String(error) }, 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-references", method: ["GET", "POST"] };
