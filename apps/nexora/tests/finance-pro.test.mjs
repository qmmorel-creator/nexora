/* Module Finance PRO (#267). Mêmes principes que quotes.test.mjs : les
   calculs purs sont extraits du bundle RÉELLEMENT construit, entre les
   sentinelles NEXORA:FINANCEPRO-CORE / NEXORA:FINANCEPRO-CONFIRM, avec
   NEXORA:DATE-UTILS pour les vraies `iso`/`addDays` et NEXORA:QUOTES pour
   `quoteTotal` (réutilisé tel quel pour proCaSigne — pas de duplication). */

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

const F = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("QUOTES")}\n${slice("FINANCEPRO-CORE")}\n${slice("FINANCEPRO-CONFIRM")}\n;return {
    proEuros, proActive, proExpenseDedupeHash,
    proCaSigne, proCaPlanifie, proCaFacture, proCaEncaisse, proTravailRealiseNonFacture,
    proFacturesEnRetard, proDelaiMoyenEncaissement, proMargeParMission, proTjmVendu, proTjmObtenu,
    proTempsParFacturabilite, proTauxOccupation, proResteAFacturer, proResteAEncaisser,
    proTresorerieDisponible, proTresoreriePrevisionnelle, proProvisions, proConcentrationCA,
    proCarnetCommandes, proRevenuMensuelRecurrent, proEcartPrevisionRealise,
    proCaEncaisseAnnee, proSeuilTvaStatus, proUpcomingObligations,
    proMissionBillingLines, proMissionPayments, proMissionProgress,
    PRO_TVA_SEUIL_BASE, PRO_TVA_SEUIL_MAJORE,
    proConfirmationPolicy, proRecordAuditEvent,
    PRO_NEVER_AUTO_ACTIONS, PRO_AUTO_COMMIT_AMOUNT_THRESHOLD, PRO_AUTO_COMMIT_CONFIDENCE_THRESHOLD,
  };\n})`
)();

// --- CA signé / planifié / facturé / encaissé -------------------------------

test("proCaSigne : somme des devis acceptés seulement", () => {
  const quotes = [
    { status: "accepted", lines: [{ kind: "forfait", amount: 1000 }] },
    { status: "draft", lines: [{ kind: "forfait", amount: 5000 }] },
    { status: "accepted", lines: [{ kind: "regie", quantity: 2, unitRate: 500 }] },
  ];
  assert.equal(F.proCaSigne(quotes), 1000 + 1000);
});

test("proCaPlanifie : exclut les lignes annulées et déjà facturées", () => {
  const lines = [
    { statut: "prevu", montantPrevu: 100 },
    { statut: "a_facturer", montantPrevu: 200 },
    { statut: "facture", montantPrevu: 300 },
    { statut: "annule", montantPrevu: 400 },
  ];
  assert.equal(F.proCaPlanifie(lines), 300);
});

test("proCaFacture : un avoir (montant négatif) vient en déduction, jamais en suppression", () => {
  const lines = [
    { statut: "facture", type: "jalon", montantPrevu: 1000 },
    { statut: "facture", type: "avoir", montantPrevu: -200 },
    { statut: "encaisse", type: "solde", montantPrevu: 500 },
    { statut: "prevu", type: "jalon", montantPrevu: 9999 },
  ];
  assert.equal(F.proCaFacture(lines), 1000 - 200 + 500);
});

test("proCaFacture : une ligne archivée n'est jamais comptée", () => {
  const lines = [{ statut: "facture", montantPrevu: 1000, archivedAt: "2026-01-01T00:00:00.000Z" }];
  assert.equal(F.proCaFacture(lines), 0);
});

test("proCaEncaisse : un paiement partiel = somme réelle des paiements liés, jamais le montant de la facture", () => {
  const payments = [
    { statutRapprochement: "rapproche", montant: 300 },
    { statutRapprochement: "rapproche", montant: 200 },
    { statutRapprochement: "non_rapproche", montant: 9999 },
  ];
  assert.equal(F.proCaEncaisse(payments), 500);
});

// --- Travail réalisé non facturé -------------------------------------------

test("proTravailRealiseNonFacture : temps facturable non facturé + dépenses refacturables non facturées", () => {
  const timeEntries = [
    { billable: true, status: "validee", durationMinutes: 480, rateApplied: 100, rateType: "horaire" }, // 8h * 100 = 800
    { billable: true, status: "facturee", durationMinutes: 480, rateApplied: 100, rateType: "horaire" }, // exclu, déjà facturé
    { billable: false, status: "validee", durationMinutes: 480, rateApplied: 100, rateType: "horaire" }, // exclu, non facturable
  ];
  const expenses = [
    { refacturable: true, statutRemboursement: "a_refacturer", montantTTC: 150 },
    { refacturable: true, statutRemboursement: "refacture", montantTTC: 999 }, // déjà refacturée, exclue
    { refacturable: false, statutRemboursement: "na", montantTTC: 999 },
  ];
  assert.equal(F.proTravailRealiseNonFacture(timeEntries, expenses), 800 + 150);
});

test("proTravailRealiseNonFacture : régie journalière convertit les minutes en jours de 8h", () => {
  const timeEntries = [{ billable: true, status: "brouillon", durationMinutes: 8 * 60, rateApplied: 600, rateType: "journalier" }];
  assert.equal(F.proTravailRealiseNonFacture(timeEntries, []), 600);
});

// --- Factures en retard / délai moyen d'encaissement ------------------------

test("proFacturesEnRetard : ligne à facturer dont l'échéance est dépassée", () => {
  const lines = [
    { statut: "a_facturer", dateCible: "2026-01-01" },
    { statut: "facture", dateCible: "2026-09-01" },
    { statut: "encaisse", dateCible: "2020-01-01" }, // déjà soldée, jamais "en retard"
    { statut: "prevu", dateCible: "2020-01-01" }, // pas encore facturable, jamais "en retard"
  ];
  const result = F.proFacturesEnRetard(lines, "2026-09-22");
  assert.equal(result.length, 2);
});

test("proDelaiMoyenEncaissement : moyenne pondérée par montant entre échéance et paiement", () => {
  const lines = [{ id: "l1", statut: "encaisse", dateCible: "2026-01-01" }];
  const payments = [{ billingScheduleId: "l1", montant: 1000, date: "2026-01-11" }]; // 10 jours
  assert.equal(F.proDelaiMoyenEncaissement(lines, payments), 10);
});

test("proDelaiMoyenEncaissement : aucune ligne soldée -> null, jamais NaN ni 0 trompeur", () => {
  assert.equal(F.proDelaiMoyenEncaissement([], []), null);
});

// --- Marge par mission -------------------------------------------------------

test("proMargeParMission : une dépense refacturée ne compte jamais deux fois (exclue des charges)", () => {
  const billingSchedule = [{ missionId: "m1", statut: "facture", montantPrevu: 1000 }];
  const expenses = [
    { missionId: "m1", statutRemboursement: "a_refacturer", montantTTC: 100 },
    { missionId: "m1", statutRemboursement: "refacture", montantTTC: 9999 },
  ];
  const marge = F.proMargeParMission("m1", billingSchedule, expenses);
  assert.equal(marge.ca, 1000);
  assert.equal(marge.charges, 100);
  assert.equal(marge.marge, 900);
  assert.equal(marge.tauxMarge, 0.9);
});

test("proMargeParMission : aucun CA facturé -> marge négative égale aux charges, jamais de division par zéro", () => {
  const marge = F.proMargeParMission("m1", [], [{ missionId: "m1", statutRemboursement: "na", montantTTC: 200 }]);
  assert.equal(marge.ca, 0);
  assert.equal(marge.marge, -200);
  assert.equal(marge.tauxMarge, null);
});

// --- Reste à facturer / reste à encaisser -----------------------------------

test("proResteAFacturer et proResteAEncaisser", () => {
  const quotes = [{ status: "accepted", lines: [{ kind: "forfait", amount: 3000 }] }];
  const billingSchedule = [{ statut: "facture", montantPrevu: 1200 }];
  const payments = [{ statutRapprochement: "rapproche", montant: 500 }];
  assert.equal(F.proResteAFacturer(quotes, billingSchedule), 3000 - 1200);
  assert.equal(F.proResteAEncaisser(billingSchedule, payments), 1200 - 500);
});

// --- Trésorerie --------------------------------------------------------------

test("proTresoreriePrevisionnelle : un encaissement déjà rapproché n'est jamais recompté comme prévisionnel", () => {
  const settings = { tresorerieDisponible: 1000, tauxProvisionSocialesFiscales: null };
  const billingSchedule = [
    { statut: "prevu", montantPrevu: 500, dateCible: "2026-10-01" },
    { statut: "encaisse", montantPrevu: 9999, dateCible: "2026-10-01" }, // déjà encaissée, jamais recomptée
  ];
  const result = F.proTresoreriePrevisionnelle(settings, billingSchedule, [], 30, "2026-09-22");
  assert.equal(result, 1000 + 500);
});

test("proTresoreriePrevisionnelle : applique les provisions quand un taux est renseigné", () => {
  const settings = { tresorerieDisponible: 0, tauxProvisionSocialesFiscales: 0.2 };
  const billingSchedule = [{ statut: "a_facturer", montantPrevu: 1000, dateCible: "2026-10-01" }];
  assert.equal(F.proTresoreriePrevisionnelle(settings, billingSchedule, [], 30, "2026-09-22"), 1000 - 200);
});

test("proProvisions : taux non renseigné -> 0, jamais un barème inventé", () => {
  assert.equal(F.proProvisions(10000, { tauxProvisionSocialesFiscales: null }), 0);
  assert.equal(F.proProvisions(10000, { tauxProvisionSocialesFiscales: 0.212 }), 2120);
});

// --- Concentration CA / carnet de commandes / revenu récurrent --------------

test("proConcentrationCA : triée décroissante, part en pourcentage du total facturé", () => {
  const missions = [{ id: "m1", clientId: "c1" }, { id: "m2", clientId: "c2" }];
  const billingSchedule = [
    { missionId: "m1", statut: "facture", montantPrevu: 300 },
    { missionId: "m2", statut: "encaisse", montantPrevu: 700 },
  ];
  const result = F.proConcentrationCA(billingSchedule, missions);
  assert.equal(result[0].clientId, "c2");
  assert.equal(result[0].part, 0.7);
  assert.equal(result[1].part, 0.3);
});

test("proCarnetCommandes : exclut le CA facturé des missions closes/archivées", () => {
  const quotes = [{ status: "accepted", lines: [{ kind: "forfait", amount: 5000 }] }];
  const missions = [{ id: "m1", status: "en_cours" }, { id: "m2", status: "cloturee" }];
  const billingSchedule = [
    { missionId: "m1", statut: "facture", montantPrevu: 1000 },
    { missionId: "m2", statut: "facture", montantPrevu: 2000 }, // mission close, non déduite du carnet
  ];
  assert.equal(F.proCarnetCommandes(quotes, billingSchedule, missions), 5000 - 1000);
});

test("proRevenuMensuelRecurrent : somme des missions en abonnement actives seulement", () => {
  const missions = [
    { billingMode: "abonnement", status: "en_cours", soldDayRate: 300 },
    { billingMode: "abonnement", status: "cloturee", soldDayRate: 9999 },
    { billingMode: "forfait", status: "en_cours", soldDayRate: 9999 },
  ];
  assert.equal(F.proRevenuMensuelRecurrent(missions), 300);
});

// --- Écart prévision/réalisé -------------------------------------------------

test("proEcartPrevisionRealise : sur une période close, prévu vs réellement facturé", () => {
  const billingSchedule = [
    { dateCible: "2026-06-15", statut: "facture", montantPrevu: 800 },
    { dateCible: "2026-06-20", statut: "annule", montantPrevu: 200 }, // non archivée mais annulée : exclue du "réalisé"
    { dateCible: "2026-07-01", statut: "facture", montantPrevu: 999 }, // hors période
  ];
  const result = F.proEcartPrevisionRealise(billingSchedule, "2026-06-01", "2026-06-30");
  assert.equal(result.prevu, 800 + 200);
  assert.equal(result.realise, 800);
  assert.equal(result.ecart, 800 - 1000);
});

// --- Seuil de franchise en base de TVA (base auto-entrepreneur) ------------

test("proCaEncaisseAnnee : ne compte que les paiements rapprochés de l'année civile demandée", () => {
  const payments = [
    { statutRapprochement: "rapproche", date: "2026-03-10", montant: 1000 },
    { statutRapprochement: "rapproche", date: "2025-12-20", montant: 9999 }, // autre année
    { statutRapprochement: "non_rapproche", date: "2026-05-01", montant: 9999 }, // pas rapproché
    { statutRapprochement: "rapproche", date: "2026-09-01", montant: 500 },
  ];
  assert.equal(F.proCaEncaisseAnnee(payments, 2026), 1500);
});

test("proSeuilTvaStatus : ok sous 80 % du seuil de base", () => {
  const result = F.proSeuilTvaStatus(10000);
  assert.equal(result.status, "ok");
});

test("proSeuilTvaStatus : proche entre 80 % et le seuil de base", () => {
  const result = F.proSeuilTvaStatus(0.85 * F.PRO_TVA_SEUIL_BASE);
  assert.equal(result.status, "proche");
});

test("proSeuilTvaStatus : seuil de base dépassé mais pas le majoré", () => {
  const result = F.proSeuilTvaStatus(F.PRO_TVA_SEUIL_BASE + 100);
  assert.equal(result.status, "depasse_base");
});

test("proSeuilTvaStatus : seuil majoré dépassé -> bascule TVA immédiate", () => {
  const result = F.proSeuilTvaStatus(F.PRO_TVA_SEUIL_MAJORE + 1);
  assert.equal(result.status, "depasse_majore");
});

// --- Obligations fiscales/sociales (base) -----------------------------------

test("proUpcomingObligations : triées par échéance, en retard signalées, archivées exclues", () => {
  const obligations = [
    { id: "o1", dateEcheance: "2026-12-01" },
    { id: "o2", dateEcheance: "2026-01-01" },
    { id: "o3", dateEcheance: "2026-06-01", archivedAt: "2026-05-01T00:00:00.000Z" },
  ];
  const result = F.proUpcomingObligations(obligations, "2026-09-22");
  assert.deepEqual(result.map((o) => o.id), ["o2", "o1"]);
  assert.equal(result.find((o) => o.id === "o2").late, true);
  assert.equal(result.find((o) => o.id === "o1").late, false);
});

// --- Vue mission : timeline et avancement global ----------------------------

test("proMissionBillingLines : filtre par mission et trie par échéance, exclut les archivées", () => {
  const billingSchedule = [
    { id: "l1", missionId: "m1", dateCible: "2026-06-01" },
    { id: "l2", missionId: "m2", dateCible: "2026-01-01" },
    { id: "l3", missionId: "m1", dateCible: "2026-02-01" },
    { id: "l4", missionId: "m1", dateCible: "2026-03-01", archivedAt: "2026-01-01T00:00:00.000Z" },
  ];
  const result = F.proMissionBillingLines("m1", billingSchedule);
  assert.deepEqual(result.map((l) => l.id), ["l3", "l1"]);
});

test("proMissionPayments : un paiement n'est rattaché qu'aux lignes de LA mission demandée", () => {
  const billingSchedule = [{ id: "l1", missionId: "m1" }, { id: "l2", missionId: "m2" }];
  const payments = [
    { billingScheduleId: "l1", montant: 100 },
    { billingScheduleId: "l2", montant: 999 },
  ];
  const result = F.proMissionPayments("m1", billingSchedule, payments);
  assert.equal(result.length, 1);
  assert.equal(result[0].montant, 100);
});

test("proMissionProgress : ratio basé sur le CA signé (devis lié) quand il existe", () => {
  const mission = { id: "m1", quoteId: "q1" };
  const quotes = [{ id: "q1", status: "accepted", lines: [{ kind: "forfait", amount: 1000 }] }];
  const billingSchedule = [{ id: "l1", missionId: "m1", statut: "facture", montantPrevu: 1000 }];
  const payments = [{ billingScheduleId: "l1", statutRapprochement: "rapproche", montant: 400 }];
  const result = F.proMissionProgress(mission, quotes, billingSchedule, payments);
  assert.equal(result.caSigne, 1000);
  assert.equal(result.caEncaisse, 400);
  assert.equal(result.ratio, 0.4);
});

test("proMissionProgress : sans devis lié ni ligne de facturation -> ratio 0, jamais NaN", () => {
  const result = F.proMissionProgress({ id: "m1", quoteId: null }, [], [], []);
  assert.equal(result.ratio, 0);
  assert.equal(result.caSigne, 0);
});

test("proMissionProgress : le ratio ne dépasse jamais 1 même si l'encaissé excède la référence", () => {
  const mission = { id: "m1", quoteId: "q1" };
  const quotes = [{ id: "q1", status: "accepted", lines: [{ kind: "forfait", amount: 100 }] }];
  const billingSchedule = [{ id: "l1", missionId: "m1", statut: "encaisse", montantPrevu: 100 }];
  const payments = [{ billingScheduleId: "l1", statutRapprochement: "rapproche", montant: 500 }]; // acompte + solde mal saisis, exemple limite
  const result = F.proMissionProgress(mission, quotes, billingSchedule, payments);
  assert.equal(result.ratio, 1);
});

// --- Détection de doublon (dépenses) ----------------------------------------

test("proExpenseDedupeHash : même fournisseur/montant/date -> même hash, insensible à la casse", () => {
  const a = F.proExpenseDedupeHash({ fournisseur: "SNCF Connect", montantTTC: 96.4, dateAchat: "2026-09-18" });
  const b = F.proExpenseDedupeHash({ fournisseur: "sncf connect", montantTTC: 96.40, dateAchat: "2026-09-18" });
  assert.equal(a, b);
});

test("proExpenseDedupeHash : un montant différent change le hash", () => {
  const a = F.proExpenseDedupeHash({ fournisseur: "SNCF", montantTTC: 96.4, dateAchat: "2026-09-18" });
  const b = F.proExpenseDedupeHash({ fournisseur: "SNCF", montantTTC: 96.5, dateAchat: "2026-09-18" });
  assert.notEqual(a, b);
});

// --- Politique de confirmation (Lot 10 — conçue, non activée) --------------

test("proConfirmationPolicy : un paiement n'est JAMAIS automatique, même sous le seuil et à confiance maximale", () => {
  const result = F.proConfirmationPolicy({ action: "payment", amount: 10, confidence: 1, allowAutoCommit: true });
  assert.equal(result.committed, false);
  assert.equal(result.reason, "action_never_automatic");
});

for (const action of ["payment", "transfer", "delete", "cancel"]) {
  test(`proConfirmationPolicy : ${action} toujours bloqué sans confirmation explicite`, () => {
    const result = F.proConfirmationPolicy({ action, amount: 1, confidence: 1, allowAutoCommit: true, confirmed: undefined });
    assert.equal(result.committed, false);
  });
}

test("proConfirmationPolicy : au-delà de 200 € -> confirmation requise même avec allowAutoCommit", () => {
  const result = F.proConfirmationPolicy({ action: "create", amount: 201, confidence: 1, allowAutoCommit: true });
  assert.equal(result.committed, false);
  assert.equal(result.reason, "unusual_amount_over_200_eur");
});

test("proConfirmationPolicy : confiance sous 85 % -> confirmation requise", () => {
  const result = F.proConfirmationPolicy({ action: "create", amount: 50, confidence: 0.5, allowAutoCommit: true });
  assert.equal(result.committed, false);
  assert.equal(result.reason, "low_category_confidence");
});

test("proConfirmationPolicy : sans allowAutoCommit (défaut désactivé), rien ne se valide tout seul", () => {
  const result = F.proConfirmationPolicy({ action: "create", amount: 50, confidence: 0.99 });
  assert.equal(result.committed, false);
  assert.equal(result.reason, "confirmation_required");
});

test("proConfirmationPolicy : confirmed:true valide toujours l'écriture (hors actions jamais automatiques)", () => {
  const result = F.proConfirmationPolicy({ action: "create", amount: 999999, confidence: 0, confirmed: true });
  assert.equal(result.committed, true);
  assert.equal(result.reason, "explicit_confirmation");
});

test("proRecordAuditEvent : trace type/entité/acteur/horodatage, idempotencyKey réutilisable telle quelle", () => {
  const event = F.proRecordAuditEvent({ type: "finance_pro_expense_created", entityId: "e1", actor: "assistant-api", idempotencyKey: "abc", at: "2026-09-22T10:00:00.000Z" });
  assert.equal(event.type, "finance_pro_expense_created");
  assert.equal(event.idempotencyKey, "abc");
  assert.equal(event.at, "2026-09-22T10:00:00.000Z");
});
