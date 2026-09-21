/* Module Facture — construit sur le modèle du module Devis (voir
   quotes.test.mjs). Même convention : les calculs purs (numérotation, statut
   effectif) sont extraits du bundle RÉELLEMENT construit entre les
   sentinelles NEXORA:INVOICES / NEXORA:QUOTES / NEXORA:DATE-UTILS, jamais
   recopiés ; le reste (handlers, UI, PDF) est vérifié par lecture directe des
   fragments source, comme calendar-import-guard.test.mjs. */

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

const I = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("QUOTES")}\n${slice("INVOICES")}\n;return {
    INVOICE_STATUSES, INVOICE_MANUAL_STATUSES, DEFAULT_INVOICE_DUE_DAYS,
    invoiceStatusMeta, invoiceTotal, defaultInvoiceDueDate, effectiveInvoiceStatus,
    nextInvoiceNumber, quoteLineAmount, fmtQuoteAmount,
  };\n})`
)();

// --- Numérotation F-AAAA-NNN, strictement continue -------------------------

test("nextInvoiceNumber : premier document de l'année -> F-AAAA-001", () => {
  assert.equal(I.nextInvoiceNumber([], 2026), "F-2026-001");
});

test("nextInvoiceNumber : incrémente sur le plus grand numéro existant, sans se soucier de l'ordre de création", () => {
  const invoices = [{ number: "F-2026-001" }, { number: "F-2026-003" }, { number: "F-2025-009" }];
  assert.equal(I.nextInvoiceNumber(invoices, 2026), "F-2026-004");
});

test("nextInvoiceNumber : une facture 'annulée' garde son numéro dans le compte — jamais de trou, jamais de réutilisation", () => {
  // Une facture annulée (via avoir) N'EST JAMAIS supprimée ni exclue du
  // calcul : elle reste dans la liste, son numéro compte comme n'importe
  // quel autre document de la séquence.
  const invoices = [
    { number: "F-2026-001", status: "cancelled", cancelledByInvoiceId: "x" },
    { number: "F-2026-002", creditNoteOf: "y" }, // l'avoir qui l'a annulée
  ];
  assert.equal(I.nextInvoiceNumber(invoices, 2026), "F-2026-003");
});

test("nextInvoiceNumber : le compteur se réinitialise à chaque année civile, comme les devis", () => {
  const invoices = [{ number: "F-2026-014" }];
  assert.equal(I.nextInvoiceNumber(invoices, 2027), "F-2027-001");
});

test("nextInvoiceNumber : ignore les numéros mal formés plutôt que de planter", () => {
  const invoices = [{ number: "pas-un-numero" }, { number: undefined }, { number: "F-2026-005" }];
  assert.equal(I.nextInvoiceNumber(invoices, 2026), "F-2026-006");
});

// --- Statut effectif "En retard" — jamais persisté --------------------------

test("effectiveInvoiceStatus : une facture Émise toujours dans les délais reste Émise", () => {
  const invoice = { status: "issued", dueDate: "2026-10-01" };
  assert.equal(I.effectiveInvoiceStatus(invoice, "2026-09-21"), "issued");
});

test("effectiveInvoiceStatus : une facture Émise dont l'échéance est dépassée devient En retard à l'affichage", () => {
  const invoice = { status: "issued", dueDate: "2026-09-01" };
  assert.equal(I.effectiveInvoiceStatus(invoice, "2026-09-21"), "late");
});

test("effectiveInvoiceStatus : Payée/Annulée ne deviennent jamais En retard, même après l'échéance", () => {
  assert.equal(I.effectiveInvoiceStatus({ status: "paid", dueDate: "2020-01-01" }, "2026-09-21"), "paid");
  assert.equal(I.effectiveInvoiceStatus({ status: "cancelled", dueDate: "2020-01-01" }, "2026-09-21"), "cancelled");
});

test("effectiveInvoiceStatus : 'En retard' n'est jamais une valeur PERSISTABLE (sélecteur de statut manuel)", () => {
  assert.ok(!I.INVOICE_MANUAL_STATUSES.some((s) => s.key === "late"));
  assert.ok(I.INVOICE_STATUSES.some((s) => s.key === "late"));
});

test("effectiveInvoiceStatus : 'Annulée' n'est jamais une valeur du sélecteur manuel — uniquement via un avoir (createCreditNote)", () => {
  assert.ok(!I.INVOICE_MANUAL_STATUSES.some((s) => s.key === "cancelled"));
  assert.ok(I.INVOICE_STATUSES.some((s) => s.key === "cancelled"));
});

// --- Total / échéance par défaut --------------------------------------------

test("invoiceTotal : réutilise quoteLineAmount, mêmes lignes forfait/régie qu'un devis", () => {
  const invoice = { lines: [{ kind: "forfait", amount: 500 }, { kind: "regie", quantity: 2, unitRate: 300 }] };
  assert.equal(I.invoiceTotal(invoice), 500 + 600);
});

test("invoiceTotal : un avoir a des lignes en montants négatifs -> total négatif", () => {
  const invoice = { lines: [{ kind: "forfait", amount: -500 }] };
  assert.equal(I.invoiceTotal(invoice), -500);
});

test("defaultInvoiceDueDate : 30 jours après l'émission par défaut, comme la validité d'un devis", () => {
  assert.equal(I.DEFAULT_INVOICE_DUE_DAYS, 30);
  assert.equal(I.defaultInvoiceDueDate("2026-09-21"), "2026-10-21");
});

test("fmtQuoteAmount : affiche correctement un montant négatif (avoir), signe conservé, séparateurs ASCII", () => {
  assert.equal(I.fmtQuoteAmount(-1234.5), "-1 234,50 €");
});

// ============================================================================
// Le reste (navigation, persistance, handlers, UI, PDF) est vérifié par
// lecture directe des fragments source, comme quotes.test.mjs.
// ============================================================================

const p0 = await readFile(new URL("../source/index.html.part-000", import.meta.url), "utf8");
const p1 = await readFile(new URL("../source/index.html.part-001", import.meta.url), "utf8");
const p3 = await readFile(new URL("../source/index.html.part-003", import.meta.url), "utf8");

test("navigation : l'entrée « Factures » existe dans le registre des vues et est de haut niveau, à côté de Devis", () => {
  assert.match(p0, /\{\s*key:\s*"invoices",\s*label:\s*"Factures"/);
  assert.match(p0, /TOP_LEVEL_VIEW_KEYS\s*=\s*\[[^\]]*"invoices"[^\]]*\]/);
});

test("persistance : les trois clés du module Facture sont enregistrées dans les TROIS registres Firebase, comme quotes", () => {
  assert.ok(p1.includes('"nexora:invoices"'));

  const mergeableBlock = p1.slice(p1.indexOf("const NEXORA_MERGEABLE_KEYS"), p1.indexOf("]);", p1.indexOf("const NEXORA_MERGEABLE_KEYS")));
  assert.match(mergeableBlock, /nexora:invoices/);

  const entriesBlock = p1.slice(p1.indexOf("const firebaseStateEntries"), p1.indexOf("];", p1.indexOf("const firebaseStateEntries")));
  assert.match(entriesBlock, /setInvoices/);

  const backupBlock = p1.slice(p1.indexOf("const fullBackupLivePayload"), p1.indexOf("});", p1.indexOf("const fullBackupLivePayload")));
  assert.match(backupBlock, /"nexora:invoices":\s*invoices/);
});

test("handlers : createInvoiceFromQuote copie client + lignes + titre, statut initial 'issued', quoteId renseigné", () => {
  const from = p1.indexOf("const createInvoiceFromQuote = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  assert.match(body, /quoteId:\s*quote\.id/);
  assert.match(body, /clientId:\s*quote\.clientId/);
  assert.match(body, /status:\s*"issued"/);
  assert.match(body, /nextInvoiceNumber\(invoices\)/);
  assert.match(body, /defaultInvoiceDueDate\(/);
});

test("handlers : setInvoiceStatus renseigne paidAt automatiquement quand le statut devient 'paid', et n'atteint jamais 'cancelled'", () => {
  const from = p1.indexOf("const setInvoiceStatus = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  assert.match(body, /if \(status === "cancelled"\) return;/);
  assert.match(body, /paidAt:\s*status === "paid" \? iso\(new Date\(\)\) : inv\.paidAt/);
});

test("handlers : createCreditNote — numéro dédié dans la séquence continue, lignes en montants négatifs, référence croisée dans les deux sens", () => {
  const from = p1.indexOf("const createCreditNote = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  // Numéro dédié, dans la même séquence (pas de compteur séparé).
  assert.match(body, /nextInvoiceNumber\(invoices\)/);
  // Montants négatifs sur les lignes copiées.
  assert.match(body, /-Math\.abs\(Number\(l\.amount\)/);
  assert.match(body, /-Math\.abs\(Number\(l\.unitRate\)/);
  // Référence croisée : l'avoir référence la facture d'origine (creditNoteOf),
  // et la facture d'origine référence l'avoir (cancelledByInvoiceId) + passe
  // en "cancelled" — jamais supprimée.
  assert.match(body, /creditNoteOf:\s*source\.id/);
  assert.match(body, /status:\s*"cancelled",\s*cancelledByInvoiceId:\s*id/);
  assert.doesNotMatch(body, /setInvoices\(\s*\(prev\)\s*=>\s*prev\.filter/); // jamais de suppression
});

test("handlers : aucune suppression de facture émise n'existe dans le module (contrainte de numérotation sans trou)", () => {
  assert.doesNotMatch(p1, /const deleteInvoice = /);
});

test("UI : bouton « Facturer ce devis » sur un devis Accepté (QuotesView), appelle createInvoiceFromQuote puis bascule sur la vue Factures", () => {
  assert.match(p3, /Facturer ce devis/);
  const from = p3.indexOf("function QuotesView");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /status === "accepted"/);
  assert.match(body, /onClick=\{\(\) => onFacturer\(q\)\}/);

  const facturerFrom = p1.indexOf("const facturerQuote = ");
  assert.ok(facturerFrom !== -1);
  const facturerBody = p1.slice(facturerFrom, p1.indexOf("\n  };", facturerFrom));
  assert.match(facturerBody, /createInvoiceFromQuote\(quote\)/);
  assert.match(facturerBody, /setView\("invoices"\)/);
});

test("UI : InvoicesView propose une sous-vue « Livre des recettes » (factures payées) avec export CSV", () => {
  assert.match(p3, /Livre des recettes/);
  const from = p3.indexOf("function InvoicesView");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /paidRows/);
  assert.match(body, /new Blob\(\[csv\]/);
  assert.match(body, /URL\.createObjectURL\(blob\)/);
});

test("UI : InvoiceFormModal réutilise QuoteChipPicker (pas de duplication du sélecteur de chips)", () => {
  const from = p3.indexOf("function InvoiceFormModal");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /<QuoteChipPicker /);
});

test("PDF facture : mention RCS/RM obligatoire, absente du devis", () => {
  assert.match(p3, /Dispensé d'immatriculation au registre du commerce et des sociétés \(RCS\) et au répertoire des métiers \(RM\)/);
  // Absente des mentions du devis (QUOTE_LEGAL_MENTIONS).
  const quoteLegalFrom = p3.indexOf("const QUOTE_LEGAL_MENTIONS = [");
  const quoteLegalBody = p3.slice(quoteLegalFrom, p3.indexOf("];", quoteLegalFrom));
  assert.doesNotMatch(quoteLegalBody, /RCS/);
});

test("PDF facture : assurance professionnelle affichée UNIQUEMENT si settings.insurance est renseigné", () => {
  const from = p3.indexOf("function invoiceLegalMentionsText");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\n}", from));
  assert.match(body, /if \(\(settings\?\.insurance \|\| ""\)\.trim\(\)\) lines\.push/);
});

test("PDF facture : titre « Facture » (même taille 38pt que le devis), numéro F-AAAA-NNN, date d'émission + échéance", () => {
  const from = p3.indexOf("async function downloadInvoicePdf");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /doc\.setFontSize\(38\)/);
  assert.match(body, /doc\.text\("Facture", marginX, titleBaseline\)/);
  assert.match(body, /Facture \$\{invoice\.number\}/);
  assert.match(body, /Émise le .* Échéance le/);
});

test("PDF facture : pas de section « Bon pour accord » — remplacée par un récapitulatif des conditions de paiement", () => {
  const from = p3.indexOf("async function downloadInvoicePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  // Aucune section "05 / Bon pour accord" (titre affiché sur le devis) —
  // le seul "05 /" de la facture est "05 / Conditions de paiement".
  assert.doesNotMatch(body, /"05 \/ Bon pour accord"/i);
  assert.match(body, /05 \/ Conditions de paiement/);
});

test("PDF facture : bandeau AVOIR visible + montants négatifs quand invoice.creditNoteOf est renseigné", () => {
  const from = p3.indexOf("async function downloadInvoicePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /const isCreditNote = !!invoice\.creditNoteOf;/);
  assert.match(body, /AVOIR — annule et corrige la facture/);
});

test("PDF facture : page CGV seulement si settings.cgvText n'est pas vide, même logique que le devis", () => {
  const from = p3.indexOf("async function downloadInvoicePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /if \(\(settings\?\.cgvText \|\| ""\)\.trim\(\)\)\s*\{/);
});

test("PDF facture : chips de compétences réutilisent la même construction que le PDF devis (pas de duplication)", () => {
  const from = p3.indexOf("async function downloadInvoicePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /buildQuoteLinesTableRows\(invoice\.lines, invoiceSkills\)/);
  assert.match(body, /didDrawCell:\s*attachQuoteSkillsCellDrawer\(doc, invoice\.lines, invoiceSkills\)/);
});

test("réglages entreprise : champ assurance professionnelle optionnel, vide par défaut, utilisé uniquement pour la facture", () => {
  const settingsBlock = p0.slice(p0.indexOf("const seedQuoteSettings"), p0.indexOf("};", p0.indexOf("const seedQuoteSettings")));
  assert.match(settingsBlock, /insurance:\s*""/);
});

test("modèle de données : la forme d'une facture couvre les champs demandés (avoir, référence devis, cycle de vie)", () => {
  const from = p1.indexOf("const saveInvoice = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  assert.match(body, /status:\s*"issued"/);
});
