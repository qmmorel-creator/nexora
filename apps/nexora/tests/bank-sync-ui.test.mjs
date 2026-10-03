/* Réglages → Banques connectées (issue #677). Tranche extraite du bundle
   réellement construit, comme les autres blocs. */

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
const B = vm.runInThisContext(`(function () {\n${slice("BANK-SYNC")}\n;return { bankSyncConsentLabel, bankSyncResultLine, bankSyncGroups, bankSyncCallbackMessage, bankSyncErrorText, bankSyncPatternsText, bankSyncSampleLines };\n})`)();

test("onglet déclaré, rendu, appelé par le serveur et ouvert au retour de la banque", () => {
  assert.match(html, /\{ key: "bankSync", label: "Banques connectées"/);
  assert.match(html, /activeTab === "bankSync" && <BankSyncSettings pushToast=\{pushToast\} \/>/);
  assert.match(html, /fetch\("\/api\/nexora\/finance-bank-sync"/);
  assert.match(html, /params\.get\("bankSync"\)/);
  assert.match(html, /setSettingsTab\("bankSync"\)/);
  assert.match(html, /Comptes liés : ne plus les saisir à la main ni par capture d'écran\./, "avertissement doublons après import");
  assert.doesNotMatch(html, /api\.enablebanking\.com/, "le navigateur ne parle jamais à Enable Banking");
  assert.doesNotMatch(html, /session_id/, "aucun identifiant de session côté interface");
});

test("consentement : valide, bientôt expiré, expiré", () => {
  assert.equal(B.bankSyncConsentLabel({ validUntil: "2027-03-31T00:00:00Z", consent: { state: "ok", daysLeft: 179 } }).tone, "ok");
  const soon = B.bankSyncConsentLabel({ validUntil: "2026-10-08", consent: { state: "soon", daysLeft: 5 } });
  assert.equal(soon.tone, "warn");
  assert.match(soon.text, /08\/10\/2026 \(5 j\)/);
  assert.match(B.bankSyncConsentLabel({ validUntil: "2026-10-01", consent: { state: "expired" } }).text, /renouvelez/);
});

test("résultat d'un passage, erreurs traduites", () => {
  const line = B.bankSyncResultLine({ created: 2, reconciled: 1, already: 5, skipped: { pending: 1 }, balance: { amount: 1500, currency: "EUR" } });
  assert.match(line, /^2 créées · 1 rapprochée · 5 déjà présentes · 1 en attente ignorée · solde banque 1\s500,00\s€$/);
  assert.match(B.bankSyncResultLine({ created: 25, remaining: 40 }), /40 restant à traiter au prochain passage/);
  assert.match(html, /if \(!p\.result\.partial\) break;/, "l'interface relance tant que le passage est partiel");
  assert.equal(B.bankSyncResultLine({ error: "consent_expired" }), "Erreur : accès expiré, renouvelez la connexion.");
  assert.equal(B.bankSyncErrorText("enable_banking_http_500"), "enable_banking_http_500");
  assert.match(B.bankSyncErrorText("enable_banking_http_429:ASPSP_RATE_LIMIT_EXCEEDED"), /^limite de la banque atteinte \(4 accès par jour sans vous\)/);
});

test("libellés ignorés et échantillon des opérations écartées", () => {
  assert.equal(B.bankSyncPatternsText(["FACTURE CARTE A DEBIT DIFFERE", "Relevé CB"]), "FACTURE CARTE A DEBIT DIFFERE\nRelevé CB");
  assert.equal(B.bankSyncPatternsText(undefined), "");
  assert.match(B.bankSyncResultLine({ created: 0, skipped: { pending: 78, statuses: { PDNG: 78 }, ignored: 1 } }), /78 en attente ignorées \(PDNG 78\) · 1 ignorée par libellé/);
  const lines = B.bankSyncSampleLines({ samples: { pending: [{ status: "PDNG", date: "2026-10-02", amount: -12.5, label: "CB Carrefour" }], ignored: [{ date: "2026-11-04", amount: -1460.2, label: "FACTURE CARTE" }] } });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^En attente \(PDNG\) · 02\/10\/2026 · -12,50\s€ · CB Carrefour$/);
  assert.match(lines[1], /^Ignorée par libellé · 04\/11\/2026/);
  assert.deepEqual(B.bankSyncSampleLines(null), []);
  assert.match(B.bankSyncResultLine({ created: 1, upcomingKnown: 2, skipped: { upcomingUndated: 1 } }), /2 à venir déjà saisies · 1 à venir sans date/);
  assert.deepEqual(B.bankSyncSampleLines({ samples: { upcomingUndated: [{ amount: -89, label: "GLC" }] } }).length, 1);
  assert.match(html, /ignorePatterns: String\(patterns \|\| ""\)\.split\("\\n"\)/);
});

test("groupes : comptes rangés par banque, comptes d'une banque déconnectée conservés", () => {
  const groups = B.bankSyncGroups({
    connections: [{ aspspKey: "FR:revolut", name: "Revolut", lastSyncResult: [{ accountKey: "k1", created: 1 }] }],
    accounts: [{ accountKey: "k1", aspspKey: "FR:revolut" }, { accountKey: "k2", aspspKey: "FR:boursobank" }],
  });
  assert.equal(groups.length, 2);
  assert.equal(groups[0].accounts[0].lastResult.created, 1);
  assert.equal(groups[1].disconnected, true);
  assert.equal(groups[1].accounts[0].accountKey, "k2");
  assert.deepEqual(B.bankSyncGroups(null), []);
});

test("message au retour de la banque", () => {
  const ok = B.bankSyncCallbackMessage(new URLSearchParams("bankSync=ok&bank=BoursoBank&accounts=2"));
  assert.equal(ok.ok, true);
  assert.match(ok.message, /^BoursoBank connectée · 2 comptes\./);
  const ko = B.bankSyncCallbackMessage(new URLSearchParams("bankSync=error&reason=access_denied"));
  assert.equal(ko.message, "Connexion bancaire impossible : autorisation refusée à la banque.");
});
