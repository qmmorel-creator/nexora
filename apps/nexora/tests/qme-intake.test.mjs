/* Endpoint d'ingestion prospect QME (nexora#279). Teste la logique pure
   extraite dans lib/qme-intake-validation.mjs — le VRAI code utilisé par
   netlify/functions/nexora-qme-intake.ts, jamais une copie. Les cas qui
   touchent Firestore (création nominale, idempotence, projet/statut/type
   réels) relèvent de la recette de bout en bout, pas de ce fichier — voir
   la checklist de recette dans docs/qme-intake/. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  QME_PROJECT_ID, QME_TASK_TYPE_ID, QME_STATUS_ID, QME_SOURCE,
  requiredText, optionalText, normalizeOrganization, validateEmail, validateRequestId,
  validateSourceUrl, escapeMarkdown, buildTitle, buildDescription, buildProspectChecklist,
  computeSignature, verifySignature, isTimestampFresh, signatureFingerprint, ipFingerprint,
} from "../lib/qme-intake-validation.mjs";

// --- Constantes projet (vérifiées en direct via le MCP, 2026-09-22) --------

test("les constantes de catalogue correspondent au projet QME - Formulaire réel", () => {
  assert.equal(QME_PROJECT_ID, "5a0b2231-9419-4e84-913f-1b1a94114fdc");
  assert.equal(QME_TASK_TYPE_ID, "tt1");
  assert.equal(QME_STATUS_ID, "s1");
  assert.equal(QME_SOURCE, "qme-website");
});

// --- Validation des champs ---------------------------------------------------

test("requiredText/optionalText : rejettent une valeur vide, trop longue, ou du mauvais type", () => {
  assert.throws(() => requiredText("", "champ", 10), /champ_required/);
  assert.throws(() => requiredText("   ", "champ", 10), /champ_required/);
  assert.throws(() => requiredText("a".repeat(11), "champ", 10), /champ_too_long/);
  assert.equal(requiredText("  ok  ", "champ", 10), "ok");
  assert.equal(optionalText(null, "champ", 10), "");
  assert.equal(optionalText("", "champ", 10), "");
  assert.throws(() => optionalText("a".repeat(11), "champ", 10), /champ_too_long/);
});

test("normalizeOrganization : obligatoire, espaces internes normalisés, vide après trim -> rejet", () => {
  assert.throws(() => normalizeOrganization(""), /organization_required/);
  assert.throws(() => normalizeOrganization("   \t  "), /organization_required/);
  assert.throws(() => normalizeOrganization(undefined), /organization_required/);
  assert.equal(normalizeOrganization("  Ma   Société   SAS  "), "Ma Société SAS");
  assert.throws(() => normalizeOrganization("a".repeat(201)), /organization_too_long/);
});

test("validateEmail : accepte un email plausible, rejette un email invalide", () => {
  assert.equal(validateEmail("prospect@exemple.fr"), "prospect@exemple.fr");
  assert.throws(() => validateEmail("pas-un-email"), /invalid_email/);
  assert.throws(() => validateEmail("@exemple.fr"), /invalid_email/);
  assert.throws(() => validateEmail(""), /email_required/);
});

test("validateRequestId : exige un UUID, rejette un id arbitraire", () => {
  assert.equal(validateRequestId("6a21a1d0-1234-4abc-89ab-1234567890ab"), "6a21a1d0-1234-4abc-89ab-1234567890ab");
  assert.throws(() => validateRequestId("pas-un-uuid"), /invalid_request_id/);
});

test("validateSourceUrl : exige https ET l'origine attendue du site QME", () => {
  const origin = "https://qme-engineering.netlify.app";
  assert.equal(validateSourceUrl(`${origin}/#contact`, origin), `${origin}/#contact`);
  assert.throws(() => validateSourceUrl("http://qme-engineering.netlify.app/", origin), /invalid_source_url/);
  assert.throws(() => validateSourceUrl("https://un-autre-site.example/", origin), /unexpected_source_origin/);
  assert.throws(() => validateSourceUrl("pas-une-url", origin), /invalid_source_url/);
});

// --- Neutralisation Markdown/HTML -------------------------------------------

test("escapeMarkdown : neutralise les titres, listes, liens et balises HTML actifs", () => {
  assert.equal(escapeMarkdown("# Faux titre"), "\\# Faux titre");
  assert.equal(escapeMarkdown("[Cliquez ici](https://malveillant.example)"), "\\[Cliquez ici\\]\\(https://malveillant\\.example\\)");
  assert.equal(escapeMarkdown("<script>alert(1)</script>"), "\\<script\\>alert\\(1\\)\\</script\\>");
  assert.equal(escapeMarkdown("- item de liste"), "\\- item de liste");
});

test("escapeMarkdown : une seule passe -> jamais de double échappement des backslashs déjà insérés", () => {
  const result = escapeMarkdown("<<>>");
  assert.equal(result, "\\<\\<\\>\\>");
  assert.doesNotMatch(result, /\\\\/); // aucun backslash rééchappé
});

test("escapeMarkdown : un texte plein de ponctuation ordinaire reste lisible (juste échappé)", () => {
  const result = escapeMarkdown("Bonjour ! Besoin d'un outil (urgent).");
  assert.doesNotMatch(result, /[^\\]!/); // "!" toujours précédé d'un backslash
  assert.ok(result.includes("Bonjour"));
});

// --- Gabarit de la tâche ------------------------------------------------------

test("buildTitle : gabarit exact du brief", () => {
  assert.equal(buildTitle("Ateliers Ferrand"), "QME - Demande de l'entreprise Ateliers Ferrand");
});

test("buildTitle : rejette une organisation qui ferait dépasser 240 caractères", () => {
  assert.throws(() => buildTitle("X".repeat(230)), /organization_too_long/);
});

test("buildDescription : contient toutes les sections du gabarit, valeurs échappées", () => {
  const desc = buildDescription({
    name: "Jean Dupont", email: "jean@exemple.fr", organization: "# Faux titre",
    need: "Audit d'un outil existant", message: "Ligne 1\n[lien](http://x)",
    receivedAtParis: "22/09/2026 à 14:32", requestId: "abc-123", sourceUrl: "https://qme-engineering.netlify.app/",
  });
  assert.match(desc, /^# Demande QME/);
  assert.match(desc, /- \*\*Nom :\*\* Jean Dupont/);
  assert.match(desc, /- \*\*Email :\*\* jean@exemple\\\.fr/); // email aussi échappé (uniformité : il n'est pas exempté du risque d'injection)
  assert.match(desc, /- \*\*Organisation :\*\* \\# Faux titre/);
  assert.match(desc, /### Message/);
  assert.match(desc, /\\\[lien\\\]\\\(http:\/\/x\\\)/);
  assert.match(desc, /- \*\*Nature :\*\* Prospect potentiel/);
  assert.match(desc, /- \*\*Reçu le :\*\* 22\/09\/2026 à 14:32/);
  assert.match(desc, /- \*\*Identifiant de demande :\*\* abc-123/);
  assert.doesNotMatch(desc, /<script/i);
});

// --- Checklist de qualification prospect ------------------------------------

test("buildProspectChecklist : 4 items fixes, jamais paramétrables, jamais cochés à la création", () => {
  const checklist = buildProspectChecklist(() => "fixe");
  assert.equal(checklist.length, 4);
  assert.ok(checklist.every((item) => item.done === false && item.statusId === null));
  assert.deepEqual(checklist.map((c) => c.id), ["qme-ck-fixe", "qme-ck-fixe", "qme-ck-fixe", "qme-ck-fixe"]);
  assert.ok(checklist.some((c) => /Qualifier le besoin/.test(c.text)));
  assert.ok(checklist.some((c) => /Décider/.test(c.text)));
});

// --- Signature HMAC et anti-rejeu -------------------------------------------

test("verifySignature : accepte une signature correcte, rejette un corps modifié", () => {
  const secret = "test-secret";
  const timestamp = "1758000000";
  const body = JSON.stringify({ a: 1 });
  const signature = computeSignature(secret, timestamp, body);
  assert.equal(verifySignature(secret, timestamp, body, signature), true);
  assert.equal(verifySignature(secret, timestamp, JSON.stringify({ a: 2 }), signature), false);
});

test("verifySignature : rejette un mauvais secret et une signature absente/vide", () => {
  const timestamp = "1758000000";
  const body = "{}";
  const signature = computeSignature("bon-secret", timestamp, body);
  assert.equal(verifySignature("mauvais-secret", timestamp, body, signature), false);
  assert.equal(verifySignature("bon-secret", timestamp, body, ""), false);
  assert.equal(verifySignature("bon-secret", timestamp, body, undefined), false);
});

test("isTimestampFresh : accepte l'instant présent, rejette trop vieux ou trop dans le futur", () => {
  const now = 1758000000;
  assert.equal(isTimestampFresh(now, now), true);
  assert.equal(isTimestampFresh(now - 60, now), true);
  assert.equal(isTimestampFresh(now - 301, now), false); // > 5 min
  assert.equal(isTimestampFresh(now + 61, now), false); // > 1 min de dérive d'horloge tolérée
  assert.equal(isTimestampFresh("pas-un-nombre", now), false);
});

test("signatureFingerprint/ipFingerprint : déterministes, jamais la valeur en clair", () => {
  assert.equal(signatureFingerprint("sig-a"), signatureFingerprint("sig-a"));
  assert.notEqual(signatureFingerprint("sig-a"), signatureFingerprint("sig-b"));
  assert.notEqual(ipFingerprint("1.2.3.4"), "1.2.3.4");
  assert.equal(ipFingerprint("1.2.3.4"), ipFingerprint("1.2.3.4"));
});

// --- Absence de secret dans les réponses/logs (structure du fichier) -------

test("nexora-qme-intake.ts ne journalise jamais le secret, l'email ou le message en clair", async () => {
  const source = await readFile(new URL("../netlify/functions/nexora-qme-intake.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /console\.(log|error|warn|info)/);
});

test("nexora-qme-intake.ts : réponse minimale seulement (ok/status/error), jamais les champs du prospect", () => {
  return readFile(new URL("../netlify/functions/nexora-qme-intake.ts", import.meta.url), "utf8").then((source) => {
    const jsonCalls = [...source.matchAll(/json\(\{[^}]*\}/g)].map((m) => m[0]);
    assert.ok(jsonCalls.length > 0);
    // Cherche les champs du prospect comme CLÉS de l'objet renvoyé (ex.
    // "email:"), pas le mot ailleurs (ex. la variable `message` de la
    // capture d'erreur générique) — sinon un faux positif systématique.
    for (const call of jsonCalls) {
      assert.doesNotMatch(call, /\b(email|organization|signingKey)\s*:/i);
    }
  });
});

test("nexora-qme-intake.ts : honeypot rempli renvoie la même forme de réponse qu'un succès (rejet silencieux)", async () => {
  const source = await readFile(new URL("../netlify/functions/nexora-qme-intake.ts", import.meta.url), "utf8");
  assert.match(source, /HONEYPOT_FIELD/);
  assert.match(source, /status:\s*"received"/);
});

test("nexora-qme-intake.ts : authentifié par QME_INTAKE_SIGNING_KEY, jamais par NEXORA_ASSISTANT_API_KEY", async () => {
  const source = await readFile(new URL("../netlify/functions/nexora-qme-intake.ts", import.meta.url), "utf8");
  assert.match(source, /QME_INTAKE_SIGNING_KEY/);
  // La clé assistant générale peut être NOMMÉE dans un commentaire explicatif
  // (pourquoi un secret séparé) — ce qui compte est qu'elle ne soit jamais
  // LUE ni utilisée pour authentifier une requête ici.
  assert.doesNotMatch(source, /Netlify\.env\.get\("NEXORA_ASSISTANT_API_KEY"\)/);
  assert.doesNotMatch(source, /isAuthorized\(/);
});
