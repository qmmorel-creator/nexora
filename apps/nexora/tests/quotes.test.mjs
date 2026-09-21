/* Module Devis (Quentin Morel Engineering). Comme les autres suites, les
   calculs purs (numérotation, total, statut effectif) sont extraits du
   bundle RÉELLEMENT construit — jamais recopiés — entre les sentinelles
   NEXORA:QUOTES, avec NEXORA:DATE-UTILS pour les vraies `iso`/`addDays`. Le
   reste (navigation, persistance, PDF) est vérifié par lecture directe des
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

const Q = vm.runInThisContext(
  `(function () {\n${slice("DATE-UTILS")}\n${slice("QUOTES")}\n;return {
    QUOTE_REGIE_UNITS, QUOTE_STATUSES, QUOTE_EDITABLE_STATUSES, DEFAULT_QUOTE_VALIDITY_DAYS,
    quoteStatusMeta, quoteLineAmount, quoteTotal, nextQuoteNumber, defaultQuoteValidUntil,
    effectiveQuoteStatus, fmtQuoteAmount,
  };\n})`
)();

// --- Lignes (forfait / régie) et total -------------------------------------

test("quoteLineAmount : ligne forfait = son montant fixe", () => {
  assert.equal(Q.quoteLineAmount({ kind: "forfait", amount: 1200 }), 1200);
});

test("quoteLineAmount : ligne régie = quantité × taux unitaire", () => {
  assert.equal(Q.quoteLineAmount({ kind: "regie", quantity: 3, unitRate: 450 }), 1350);
});

test("quoteLineAmount : valeurs manquantes ou non numériques -> 0, jamais NaN", () => {
  assert.equal(Q.quoteLineAmount({ kind: "regie" }), 0);
  assert.equal(Q.quoteLineAmount({ kind: "forfait", amount: "n'importe quoi" }), 0);
  assert.equal(Q.quoteLineAmount(null), 0);
});

test("quoteTotal : somme des lignes, un devis mélangeant forfait et régie librement", () => {
  const quote = { lines: [
    { kind: "forfait", amount: 800 },
    { kind: "regie", quantity: 2, unitRate: 500 },
    { kind: "regie", quantity: 0.5, unitRate: 900 },
  ] };
  assert.equal(Q.quoteTotal(quote), 800 + 1000 + 450);
});

test("quoteTotal : devis sans ligne -> 0", () => {
  assert.equal(Q.quoteTotal({ lines: [] }), 0);
  assert.equal(Q.quoteTotal({}), 0);
});

// --- Numérotation AAAA-NNN ---------------------------------------------------

test("nextQuoteNumber : premier devis de l'année -> 001", () => {
  assert.equal(Q.nextQuoteNumber([], 2026), "2026-001");
});

test("nextQuoteNumber : incrémente sur le plus grand numéro existant de l'année", () => {
  const quotes = [{ number: "2026-001" }, { number: "2026-002" }, { number: "2025-009" }];
  assert.equal(Q.nextQuoteNumber(quotes, 2026), "2026-003");
});

test("nextQuoteNumber : le compteur se réinitialise à chaque année civile", () => {
  const quotes = [{ number: "2026-014" }];
  assert.equal(Q.nextQuoteNumber(quotes, 2027), "2027-001");
});

test("nextQuoteNumber : ignore les numéros mal formés plutôt que de planter", () => {
  const quotes = [{ number: "pas-un-numero" }, { number: undefined }, { number: "2026-005" }];
  assert.equal(Q.nextQuoteNumber(quotes, 2026), "2026-006");
});

// --- Validité par défaut -----------------------------------------------------

test("defaultQuoteValidUntil : 30 jours après l'émission par défaut", () => {
  assert.equal(Q.DEFAULT_QUOTE_VALIDITY_DAYS, 30);
  assert.equal(Q.defaultQuoteValidUntil("2026-09-21"), "2026-10-21");
});

test("defaultQuoteValidUntil : nombre de jours personnalisable (éditable par devis)", () => {
  assert.equal(Q.defaultQuoteValidUntil("2026-09-21", 45), "2026-11-05");
});

// --- Cycle de vie / statut effectif ------------------------------------------

test("effectiveQuoteStatus : un devis Envoyé toujours dans sa période de validité reste Envoyé", () => {
  const quote = { status: "sent", validUntil: "2026-10-01" };
  assert.equal(Q.effectiveQuoteStatus(quote, "2026-09-21"), "sent");
});

test("effectiveQuoteStatus : un devis Envoyé dont la validité est dépassée devient Expiré à l'affichage", () => {
  const quote = { status: "sent", validUntil: "2026-09-01" };
  assert.equal(Q.effectiveQuoteStatus(quote, "2026-09-21"), "expired");
});

test("effectiveQuoteStatus : Accepté/Refusé/Brouillon ne deviennent jamais Expiré, même après la validité", () => {
  assert.equal(Q.effectiveQuoteStatus({ status: "accepted", validUntil: "2020-01-01" }, "2026-09-21"), "accepted");
  assert.equal(Q.effectiveQuoteStatus({ status: "refused", validUntil: "2020-01-01" }, "2026-09-21"), "refused");
  assert.equal(Q.effectiveQuoteStatus({ status: "draft", validUntil: "2020-01-01" }, "2026-09-21"), "draft");
});

test("effectiveQuoteStatus : le statut Expiré n'est jamais une valeur PERSISTABLE (menu de statuts éditables)", () => {
  assert.ok(!Q.QUOTE_EDITABLE_STATUSES.some((s) => s.key === "expired"));
  assert.ok(Q.QUOTE_STATUSES.some((s) => s.key === "expired"));
});

// --- Cycle de vie : couleurs de badge cohérentes avec le reste de Nexora -----

test("quoteStatusMeta : couleurs alignées sur les tokens de statut déjà utilisés ailleurs dans Nexora", () => {
  assert.equal(Q.quoteStatusMeta("accepted").color, "var(--success)");
  assert.equal(Q.quoteStatusMeta("refused").color, "var(--danger)");
  assert.equal(Q.quoteStatusMeta("expired").color, "var(--warning)");
});

// --- Unités de régie ----------------------------------------------------------

test("QUOTE_REGIE_UNITS : heure, demi-journée, jour — rien de plus, rien de moins", () => {
  assert.deepEqual(Q.QUOTE_REGIE_UNITS.map((u) => u.key), ["hour", "halfDay", "day"]);
});

// --- Formatage ------------------------------------------------------------

test("fmtQuoteAmount : deux décimales, séparateur français (espace ASCII normale, jamais insécable), symbole euro", () => {
  assert.equal(Q.fmtQuoteAmount(1234.5), "1 234,50 €");
  assert.equal(Q.fmtQuoteAmount(0), "0,00 €");
});

test("fmtQuoteAmount : jamais d'espace insécable Unicode dans le séparateur de milliers (illisible dans le PDF avec Helvetica standard)", () => {
  const out = Q.fmtQuoteAmount(1800);
  assert.equal(out, "1 800,00 €");
  // U+202F (espace fine insécable, sortie par défaut de toLocaleString("fr-FR"))
  // et U+00A0 (espace insécable) doivent être totalement absentes : seule une
  // espace ASCII normale (0x20) est autorisée comme séparateur de milliers.
  assert.ok(!out.includes("\u202F"), "ne doit pas contenir d'espace fine insécable U+202F");
  assert.ok(!out.includes("\u00A0"), "ne doit pas contenir d'espace insécable U+00A0");
  assert.equal(out.charCodeAt(1), 0x20, "le séparateur de milliers doit être une espace ASCII normale");
});

// ============================================================================
// Le reste (navigation, persistance, PDF, formulaire) est vérifié par lecture
// directe des fragments source, comme calendar-import-guard.test.mjs — il n'y
// a pas de rendu React réel dans cette suite de tests.
// ============================================================================

const p0 = await readFile(new URL("../source/index.html.part-000", import.meta.url), "utf8");
const p1 = await readFile(new URL("../source/index.html.part-001", import.meta.url), "utf8");
const p3 = await readFile(new URL("../source/index.html.part-003", import.meta.url), "utf8");

test("navigation : l'entrée « Devis » existe dans le registre des vues et est de haut niveau", () => {
  assert.match(p0, /\{\s*key:\s*"quotes",\s*label:\s*"Devis"/);
  assert.match(p0, /TOP_LEVEL_VIEW_KEYS\s*=\s*\[[^\]]*"quotes"[^\]]*\]/);
});

test("persistance : les trois clés du module Devis sont enregistrées dans les TROIS registres Firebase", () => {
  for (const key of ["nexora:quotes", "nexora:quoteClients", "nexora:quoteSettings"]) {
    assert.ok(p1.includes(`"${key}"`), `${key} doit apparaître dans part-001 (firebaseStateEntries/NEXORA_MERGEABLE_KEYS/fullBackupLivePayload)`);
  }
  const mergeableBlock = p1.slice(p1.indexOf("const NEXORA_MERGEABLE_KEYS"), p1.indexOf("]);", p1.indexOf("const NEXORA_MERGEABLE_KEYS")));
  assert.match(mergeableBlock, /nexora:quotes/);
  assert.match(mergeableBlock, /nexora:quoteClients/);
  assert.match(mergeableBlock, /nexora:quoteSettings/);

  const entriesBlock = p1.slice(p1.indexOf("const firebaseStateEntries"), p1.indexOf("];", p1.indexOf("const firebaseStateEntries")));
  assert.match(entriesBlock, /setQuotes/);
  assert.match(entriesBlock, /setQuoteClients/);
  assert.match(entriesBlock, /setQuoteSettings/);

  const backupBlock = p1.slice(p1.indexOf("const fullBackupLivePayload"), p1.indexOf("});", p1.indexOf("const fullBackupLivePayload")));
  assert.match(backupBlock, /"nexora:quotes":\s*quotes/);
  assert.match(backupBlock, /"nexora:quoteClients":\s*quoteClients/);
  assert.match(backupBlock, /"nexora:quoteSettings":\s*quoteSettings/);
});

test("devis accepté : la création de projet n'est jamais automatique — validation explicite requise", () => {
  assert.match(p1, /quoteToProjectPrompt/);
  assert.match(p1, /Créer le projet/);
  assert.match(p1, /Ignorer/);
  // Le passage en "accepted" ne fait QU'ouvrir la proposition — jamais créer
  // le projet directement dans le même geste.
  const setStatusFrom = p1.indexOf("const setQuoteStatus = ");
  assert.ok(setStatusFrom !== -1);
  const setStatusBody = p1.slice(setStatusFrom, p1.indexOf("\n  };", setStatusFrom));
  assert.doesNotMatch(setStatusBody, /createProjectFromQuote\(/);
});

test("création de projet depuis un devis : une tâche par ligne, réutilise le modèle {id,projectId,statusId,title}", () => {
  const from = p1.indexOf("const createProjectFromQuote = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  assert.match(body, /quote\.lines/);
  assert.match(body, /title:\s*line\.description/);
  assert.match(body, /setProjects/);
  assert.match(body, /setTasks/);
});

test("PDF : jsPDF + jspdf-autotable chargés depuis esm.sh, comme les autres libs du projet", () => {
  assert.match(p0, /from 'https:\/\/esm\.sh\/jspdf@/);
  assert.match(p0, /from 'https:\/\/esm\.sh\/jspdf-autotable@/);
  assert.match(p3, /autoTable\(doc,/);
});

test("PDF : mentions légales obligatoires toutes présentes dans le code de génération", () => {
  assert.match(p3, /TVA non applicable, art\. 293 B du CGI/);
  assert.match(p3, /valable jusqu'au/i);
  assert.match(p3, /Conditions de règlement/);
  assert.match(p3, /Pénalités de retard/);
  assert.match(p3, /indemnité forfaitaire de recouvrement de 40/i);
  assert.match(p3, /SIRET/);
});

test("PDF : pénalités de retard — formulation BCE + 10 points (guide « Charte et Mentions »), plus l'ancienne formulation", () => {
  assert.match(p3, /au taux de refinancement de la BCE applicable au début du semestre majoré de 10 points/);
  assert.doesNotMatch(p3, /3 fois le taux d'intérêt légal/);
});

test("PDF : charte graphique — couleurs de marque figées en RGB (jsPDF ne lit pas les variables CSS)", () => {
  assert.match(p3, /brand:\s*\[0,\s*74,\s*173\]/); // #004AAD
  assert.match(p3, /ink:\s*\[47,\s*52,\s*55\]/); // #2F3437
  assert.match(p3, /border:\s*\[219,\s*223,\s*219\]/); // #DBDFDB
  assert.match(p3, /surfaceMuted:\s*\[241,\s*245,\s*250\]/); // #F1F5FA
  assert.match(p3, /roundedRect/); // coins arrondis
});

test("PDF : format A4 en millimètres, marges de 15mm (guide de personnalisation)", () => {
  assert.match(p3, /new jsPDF\(\{\s*unit:\s*"mm",\s*format:\s*"a4"\s*\}\)/);
  const from = p3.indexOf("async function downloadQuotePdf");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /const marginX = 15;/);
});

test("PDF : bandeau bleu plein en haut de page + libellé fixe « PROPOSITION COMMERCIALE »", () => {
  assert.match(p3, /function drawQuoteBand/);
  assert.match(p3, /PROPOSITION COMMERCIALE/);
});

test("PDF : titre « Devis » en 38pt, structure en 2 pages (Devis + Conditions)", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /doc\.setFontSize\(38\)/);
  assert.match(body, /doc\.text\("Devis", marginX, titleBaseline\)/);
  assert.match(body, /doc\.addPage\(\)/);
  assert.match(body, /Conditions & mentions légales/);
});

test("PDF : pas de ligne TVA — seul un bandeau « TOTAL HT (= TTC) »", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /TOTAL HT \(= TTC\)/);
  assert.doesNotMatch(body, /TVA\s*20\s*%/);
});

test("PDF : pagination finale calculée après génération complète (doc.internal.getNumberOfPages)", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /doc\.internal\.getNumberOfPages\(\)/);
  assert.match(body, /doc\.setPage\(p\)/);
});

test("PDF : bloc « Bon pour accord » visuel en bas de page 2, sans nouveau champ de données", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /05 \/ Bon pour accord/i);
  assert.match(body, /J'accepte le devis \$\{quote\.number\}/);
  assert.match(body, /Signature du client/);
});

test("réglages entreprise : les placeholders demandés sont bien ceux fournis (à remplacer plus tard par Quentin)", () => {
  assert.match(p0, /companyName:\s*"Quentin Morel Engineering"/);
  assert.match(p0, /siret:\s*"000 000 000 00000"/);
  assert.match(p0, /activity:\s*"Ingénierie \/ conseil"/);
  assert.match(p0, /logoUrl:\s*""/);
});

test("réglages entreprise : le lien du logo est validé avec la même règle Google Drive que les pièces jointes", () => {
  const from = p3.indexOf("function QuoteSettingsModal");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /isGoogleDriveUrl\(trimmedLogo\)/);
});

test("réglages entreprise : un vrai input file d'upload du logo, lu en data-URL (FileReader.readAsDataURL), comme onFileAttach", () => {
  const from = p3.indexOf("function QuoteSettingsModal");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /<input type="file" accept="image\/\*"/);
  assert.match(body, /new FileReader\(\)/);
  assert.match(body, /reader\.readAsDataURL\(file\)/);
  // Même limite et même message d'erreur que les pièces jointes de tâche.
  assert.match(body, /350 \* 1024/);
});

test("PDF : le logo utilise directement le data-URL déjà stocké — le fetch réseau (loadQuoteLogoDataUrl) n'est qu'un repli pour un lien http(s) classique", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /rawLogoUrl\.startsWith\("data:image\/"\)/);
  assert.match(body, /loadQuoteLogoDataUrl\(rawLogoUrl\)/);
});

test("PDF : les mentions légales de la page 2 sont réparties en sections numérotées (02/03/04), avec repli multi-lignes", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /doc\.splitTextToSize\(/);
  assert.match(body, /"02"[\s\S]*"Validité & règlement"/);
  assert.match(body, /"03"[\s\S]*"Pénalités & indemnités"/);
  assert.match(body, /"04"[\s\S]*"Identification"/);
});

// ============================================================================
// CGV auto-renseignées (#devis-v2)
// ============================================================================

test("CGV : champs cgvText/cgvUpdatedAt dans quoteSettings (part-000), vides par défaut", () => {
  const settingsBlock = p0.slice(p0.indexOf("const seedQuoteSettings"), p0.indexOf("};", p0.indexOf("const seedQuoteSettings")));
  assert.match(settingsBlock, /cgvText:\s*""/);
  assert.match(settingsBlock, /cgvUpdatedAt:\s*""/);
});

test("CGV : la version affichée se recalcule à la volée (fmtShort), jamais une chaîne pré-formatée stockée en base", () => {
  assert.match(p3, /function quoteCgvVersionLabel\(settings\)/);
  const from = p3.indexOf("function quoteCgvVersionLabel");
  const body = p3.slice(from, p3.indexOf("\n}", from));
  assert.match(body, /fmtShort\(settings\.cgvUpdatedAt\)/);
});

test("CGV : cgvUpdatedAt n'est mis à jour QUE si cgvText a réellement changé (QuotesView, part-003)", () => {
  const from = p3.indexOf("function QuotesView");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /data\.cgvText\s*!==\s*prev\.cgvText/);
  assert.match(body, /cgvUpdatedAt:\s*data\.cgvText\s*!==\s*prev\.cgvText\s*\?\s*iso\(new Date\(\)\)\s*:\s*prev\.cgvUpdatedAt/);
});

test("CGV : réglages entreprise — textarea dédié avec aide contextuelle", () => {
  const from = p3.indexOf("function QuoteSettingsModal");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /Conditions générales de vente/);
  assert.match(body, /<textarea[^>]*value=\{cgvText\}/);
});

test("PDF : page 3 dédiée aux CGV, uniquement si settings.cgvText n'est pas vide (pas de page vide)", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /if\s*\(\(settings\?\.cgvText \|\| ""\)\.trim\(\)\)\s*\{/);
  assert.match(body, /Conditions générales de vente/);
  assert.match(body, /doc\.splitTextToSize\(paragraph, contentWidth\)/);
});

test("PDF : bon pour accord référence la version des CGV quand elles sont renseignées, phrase simple sinon", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /ses conditions et ses CGV \(v\.\$\{acceptCgvVersion\}\)/);
  assert.match(body, /J'accepte le devis \$\{quote\.number\}\.`/);
});

// ============================================================================
// Catalogue de prestations (#devis-v2)
// ============================================================================

test("catalogue : quoteCatalog présent dans les TROIS registres de persistance (part-001), comme quotes/quoteClients", () => {
  assert.ok(p1.includes('"nexora:quoteCatalog"'));
  assert.ok(p1.includes('"nexora:quoteSkills"'));

  const mergeableBlock = p1.slice(p1.indexOf("const NEXORA_MERGEABLE_KEYS"), p1.indexOf("]);", p1.indexOf("const NEXORA_MERGEABLE_KEYS")));
  assert.match(mergeableBlock, /nexora:quoteCatalog/);
  assert.match(mergeableBlock, /nexora:quoteSkills/);

  const entriesBlock = p1.slice(p1.indexOf("const firebaseStateEntries"), p1.indexOf("];", p1.indexOf("const firebaseStateEntries")));
  assert.match(entriesBlock, /setQuoteCatalog/);
  assert.match(entriesBlock, /setQuoteSkills/);

  const backupBlock = p1.slice(p1.indexOf("const fullBackupLivePayload"), p1.indexOf("});", p1.indexOf("const fullBackupLivePayload")));
  assert.match(backupBlock, /"nexora:quoteCatalog":\s*quoteCatalog/);
  assert.match(backupBlock, /"nexora:quoteSkills":\s*quoteSkills/);
});

test("catalogue : seedé avec du contenu réel (Quentin), librement éditable ensuite (saveCatalogEntry/deleteCatalogEntry)", () => {
  assert.match(p0, /const seedQuoteCatalog = \[/);
  assert.match(p0, /label:\s*"Assistance technique IA"/);
  assert.match(p1, /const saveCatalogEntry = /);
  assert.match(p1, /const deleteCatalogEntry = /);
});

test("catalogue : bouton « Insérer depuis le catalogue » dans QuoteFormModal, insertion = copie one-shot (pas de référence permanente)", () => {
  const from = p3.indexOf("function QuoteFormModal");
  assert.ok(from !== -1);
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /Insérer depuis le catalogue/);
  assert.match(body, /const insertFromCatalog = /);
  // Copie one-shot : un nouvel id de ligne généré, jamais l'id de l'entrée catalogue.
  assert.match(body, /id:\s*uid\(\)/);
});

// ============================================================================
// Chips de compétences/logiciels (#devis-v2)
// ============================================================================

test("chips : quoteSkills seedé avec une couleur hex par entrée, palette réutilisant les couleurs de statut existantes", () => {
  assert.match(p0, /const QUOTE_SKILL_COLORS = \[/);
  assert.match(p0, /const seedQuoteSkills = \[/);
  assert.match(p0, /label:\s*"Claude",\s*color:\s*"#[0-9A-Fa-f]{6}"/);
});

test("chips : deleteSkill retire aussi l'id de skillIds sur les lignes de devis ET les entrées de catalogue (pas de référence orpheline)", () => {
  const from = p1.indexOf("const deleteSkill = ");
  assert.ok(from !== -1);
  const body = p1.slice(from, p1.indexOf("\n  };", from));
  assert.match(body, /setQuoteSkills/);
  assert.match(body, /setQuoteCatalog/);
  assert.match(body, /setQuotes/);
  assert.match(body, /skillIds\.filter/);
});

test("chips : sélecteur multi-choix custom sur chaque ligne de devis (composant maison, pas de librairie externe)", () => {
  assert.match(p3, /function QuoteChipPicker\(/);
  const from = p3.indexOf("function QuoteFormModal");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.match(body, /<QuoteChipPicker /);
  assert.match(body, /toggleLineSkill/);
});

test("chips : badges colorés affichés dans le catalogue (lecture) via le même composant", () => {
  assert.match(p3, /function QuoteChipBadges\(/);
  assert.match(p3, /<QuoteChipBadges /);
});

test("chips : jamais affichés dans le code de génération du PDF (UI seulement, décision actée avec Quentin)", () => {
  const from = p3.indexOf("async function downloadQuotePdf");
  const body = p3.slice(from, p3.indexOf("\nfunction ", from + 1));
  assert.doesNotMatch(body, /skillIds/);
  assert.doesNotMatch(body, /QuoteChip/);
});
