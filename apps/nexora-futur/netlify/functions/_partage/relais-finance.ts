// Relais Finances (Ref #659), logique pure. Décision de Quentin (2026-10-03) :
// nexora-futur ne détient AUCUN secret KDM360 ; il transmet le jeton Firebase
// du propriétaire à nexora-project, qui fait les calculs (lib/finance-budget.mjs).
// Liste blanche : quatre lectures et la seule CATÉGORISATION (ni édition
// complète, ni saisie d'opération, ni référentiel).
export const AMONT = "https://nexora-project.org";

const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export type Route = { ok: true; url: string; methode: "GET" | "PATCH"; corps?: string } | { ok: false; statut: number; erreur: string };

const lecture = (cible: string, params: URLSearchParams, autorises: string[], valider: (p: URLSearchParams) => string | null): Route => {
  const erreur = valider(params);
  if (erreur) return { ok: false, statut: 400, erreur };
  const q = new URLSearchParams();
  autorises.forEach((k) => { const v = params.get(k); if (v) q.append(k, v); });
  const s = q.toString();
  return { ok: true, methode: "GET", url: `${AMONT}/api/nexora/${cible}${s ? `?${s}` : ""}` };
};

export function router(methode: string, chemin: string, params: URLSearchParams, corps: unknown): Route {
  const nom = chemin.replace(/^\/api\/futur\/finance\/?/, "");
  if (methode === "GET") {
    switch (nom) {
      case "budget-summary":
        return lecture("finance-budget-summary", params, ["month", "from", "to"], (p) => {
          const m = p.get("month"); const f = p.get("from"); const t = p.get("to");
          if (m && !MOIS.test(m)) return "invalid_month";
          if ((f || t) && !(f && t && JOUR.test(f) && JOUR.test(t) && f <= t)) return "invalid_period";
          return null;
        });
      case "wealth-series":
        return lecture("finance-wealth-series", params, ["step", "from", "to"], (p) => {
          const s = p.get("step"); const f = p.get("from"); const t = p.get("to");
          if (s && !["day", "week", "month"].includes(s)) return "invalid_step";
          if ((f && !JOUR.test(f)) || (t && !JOUR.test(t))) return "invalid_period";
          return null;
        });
      case "sankey-data": return lecture("finance-sankey-data", params, [], () => null);
      case "transactions-data": return lecture("finance-transactions-data", params, [], () => null);
    }
    return { ok: false, statut: 404, erreur: "not_found" };
  }
  if (methode === "PATCH" && nom === "categoriser") {
    const b = corps && typeof corps === "object" ? (corps as Record<string, unknown>) : null;
    if (!b) return { ok: false, statut: 400, erreur: "invalid_body" };
    const texte = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.trim().length <= max ? v.trim() : null);
    const transactionId = texte(b.transactionId, 200); const category = texte(b.category, 120); const idempotencyKey = texte(b.idempotencyKey, 120);
    const subcategory = b.subcategory == null || b.subcategory === "" ? null : texte(b.subcategory, 120);
    if (!transactionId) return { ok: false, statut: 400, erreur: "transaction_id_required" };
    if (!category) return { ok: false, statut: 400, erreur: "category_required" };
    if (!idempotencyKey) return { ok: false, statut: 400, erreur: "idempotency_key_required" };
    if (b.subcategory != null && b.subcategory !== "" && !subcategory) return { ok: false, statut: 400, erreur: "invalid_subcategory" };
    // Corps RECONSTRUIT : aucun autre champ (operation, montant…) ne passe.
    return { ok: true, methode: "PATCH", url: `${AMONT}/api/nexora/finance-owner-transactions`, corps: JSON.stringify({ transactionId, category, subcategory, idempotencyKey: `futur:${idempotencyKey}` }) };
  }
  return { ok: false, statut: 405, erreur: "method_not_allowed" };
}
