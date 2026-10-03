import type { Config } from "@netlify/functions";
import { requireEnableBankingConfig, runSync } from "./_shared/bank-sync.js";
import { requireFinanceConfig } from "./_shared/finance.js";

// Synchronisation bancaire planifiée (#677), deux fois par jour (UTC) : avant
// le rapport du matin (7 h à Paris) et en fin de journée. La DSP2 limite les
// accès sans l'utilisateur à 4 par jour et par compte : rester à 2 laisse
// de la marge au bouton « Synchroniser » des Réglages.
// Sans configuration Enable Banking ou sans compte lié : ne fait rien.
export default async () => {
  const bank = requireEnableBankingConfig();
  const finance = requireFinanceConfig();
  if (!bank.config || !finance.secretKey) {
    console.log(`bank-sync:skip configuration_missing=${[...bank.missing, ...finance.missing].join(",")}`);
    return;
  }
  // 30 s pour une fonction planifiée : plafond plus haut qu'à la demande ; un
  // reste éventuel est repris au passage suivant.
  const result = await runSync(bank.config, { url: finance.url, secretKey: finance.secretKey }, { maxWrites: 60 });
  console.log(`bank-sync:done comptes=${result.accounts.length} crees=${result.created} rapproches=${result.reconciled} erreurs=${result.errors} partiel=${result.partial}`);
  for (const account of result.accounts.filter((a) => a.error)) console.log(`bank-sync:error compte=${account.accountId} erreur=${account.error}`);
};

export const config: Config = { schedule: "40 4,16 * * *" };
