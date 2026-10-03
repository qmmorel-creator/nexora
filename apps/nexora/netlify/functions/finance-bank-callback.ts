import type { Config } from "@netlify/functions";
import { completeAuthorization, requireEnableBankingConfig } from "./_shared/bank-sync.js";
import { requireFinanceConfig } from "./_shared/finance.js";

// Retour de la banque après autorisation Enable Banking (#677). Adresse
// déclarée dans le panneau Enable Banking : elle ne change pas sans issue.
// Pas de session Nexora ici (redirection du navigateur depuis la banque) :
// seul un `state` émis par une demande du propriétaire, à usage unique et de
// moins de 30 minutes, ouvre une session. Réponse : retour à Nexora, onglet
// Réglages → Banques connectées, avec le résultat dans l'adresse.
function back(params: Record<string, string>) {
  const target = `/?${new URLSearchParams(params)}`;
  return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
}

export default async (req: Request) => {
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const params = new URL(req.url).searchParams;
  const error = params.get("error");
  if (error) return back({ bankSync: "error", reason: error.slice(0, 80) });

  const bank = requireEnableBankingConfig();
  const finance = requireFinanceConfig();
  if (!bank.config || !finance.secretKey) return back({ bankSync: "error", reason: "configuration_missing" });
  try {
    const result = await completeAuthorization(bank.config, { url: finance.url, secretKey: finance.secretKey }, params.get("code") || "", params.get("state") || "");
    return back({ bankSync: "ok", bank: result.aspspName, accounts: String(result.accounts) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return back({ bankSync: "error", reason: message.slice(0, 80) });
  }
};

export const config: Config = { path: "/api/finance/enable-banking/callback", method: ["GET"] };
