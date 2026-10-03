import type { Config } from "@netlify/functions";
import { disconnect, listFrenchBanks, psuHeadersOf, readStatus, requireEnableBankingConfig, runSync, startAuthorization, updateLink } from "./_shared/bank-sync.js";
import { getFinanceCatalogs } from "./_shared/finance.js";
import { normalizeIgnorePatterns } from "../../lib/bank-sync.mjs";
import { requireOwnerFinance } from "./_shared/finance-owner.js";
import { json } from "./_shared/nexora.js";

// Banques connectées (#677), pour la session du PROPRIÉTAIRE uniquement.
// GET  : état (banques, consentements, comptes, liaisons), sans identifiant
//        de session.
// POST : `action` =
//   - banks       : banques françaises proposées par Enable Banking ;
//   - connect     : ouvre l'autorisation d'une banque → `url` vers la banque ;
//   - link        : compte bancaire → compte Nexora (`accountId`, nul pour
//                   ignorer), date de départ `importFrom` et libellés à
//                   ignorer `ignorePatterns` (facultatif) ;
//   - sync        : synchronise tout, ou `accountKeys` ;
//   - disconnect  : ferme la session d'une banque (`aspspKey`).
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const access = await requireOwnerFinance(req);
  if ("response" in access) return access.response;
  const finance = access.config;
  const bank = requireEnableBankingConfig();

  try {
    if (req.method === "GET") {
      const [status, catalogs] = await Promise.all([readStatus(finance), getFinanceCatalogs(finance)]);
      const nexoraAccounts = catalogs.accounts.map((a) => ({ accountId: a.account_id, name: a.name, bank: a.bank, type: a.account_type }));
      return json({ ok: true, configured: !bank.missing.length, missing: bank.missing, ...status, nexoraAccounts });
    }
    const body = await req.json().catch(() => null) as Record<string, any> | null;
    if (!body || typeof body !== "object") return json({ ok: false, error: "invalid_body" }, 400);

    if (body.action === "link") {
      const accountKey = typeof body.accountKey === "string" ? body.accountKey : "";
      if (!accountKey) return json({ ok: false, error: "account_key_required" }, 400);
      const accountId = body.accountId == null || body.accountId === "" ? null : String(body.accountId);
      const importFrom = body.importFrom == null || body.importFrom === "" ? null : String(body.importFrom);
      if (accountId) {
        const catalogs = await getFinanceCatalogs(finance);
        if (!catalogs.accounts.some((a) => a.account_id === accountId)) return json({ ok: false, error: "account_not_found" }, 400);
        if (!importFrom || !DATE.test(importFrom)) return json({ ok: false, error: "import_from_required" }, 400);
      }
      const changes: Record<string, unknown> = { account_id: accountId, import_from: accountId ? importFrom : null };
      // Absent : libellés ignorés inchangés.
      if (body.ignorePatterns !== undefined) changes.ignore_patterns = normalizeIgnorePatterns(body.ignorePatterns);
      const link = await updateLink(finance, accountKey, changes);
      return json({ ok: true, link: { accountKey: link.account_key, accountId: link.account_id, importFrom: link.import_from, ignorePatterns: link.ignore_patterns || [] } });
    }

    if (!bank.config) return json({ ok: false, error: "enable_banking_configuration_missing", missing: bank.missing }, 503);

    switch (body.action) {
      case "banks":
        return json({ ok: true, banks: await listFrenchBanks(bank.config) });
      case "connect":
        return json({ ok: true, ...(await startAuthorization(bank.config, finance, String(body.aspspName || ""), String(body.country || "FR"))) });
      case "sync": {
        const accountKeys = Array.isArray(body.accountKeys) ? body.accountKeys.map(String) : undefined;
        // Lancée depuis l'onglet : l'utilisateur est en ligne (en-têtes PSU).
        return json({ ok: true, result: await runSync(bank.config, finance, { accountKeys, psu: psuHeadersOf(req) }) });
      }
      case "disconnect":
        return json({ ok: true, ...(await disconnect(bank.config, finance, String(body.aspspKey || ""))) });
      default:
        return json({ ok: false, error: "unsupported_action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const clientError = /(_required|_not_found|^invalid_|unsupported_|_too_)/.test(message);
    return json({ ok: false, error: clientError ? message : "bank_sync_failed", detail: clientError ? undefined : message }, clientError ? 400 : 502);
  }
};

export const config: Config = { path: "/api/nexora/finance-bank-sync", method: ["GET", "POST"] };
