// Logique métier pure de l'endpoint d'ingestion prospect QME
// (netlify/functions/nexora-qme-intake.ts). Extraite ici, comme
// lib/finance-validation.mjs et lib/report-period.mjs, pour que les tests
// éprouvent le VRAI code plutôt qu'une copie, et pour que la fonction Netlify
// reste un simple assemblage (I/O Firestore + réseau) autour de ces règles.
//
// Nexora #279 : cet endpoint est dédié aux prospects du site QME
// (qmmorel-creator/qme-engineering), distinct du MCP OAuth/PKCE et de la clé
// NEXORA_ASSISTANT_API_KEY générale — secret propre (QME_INTAKE_SIGNING_KEY),
// défense en profondeur car atteint indirectement par du trafic public.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const QME_PROJECT_ID = "5a0b2231-9419-4e84-913f-1b1a94114fdc";
export const QME_TASK_TYPE_ID = "tt1";
export const QME_STATUS_ID = "s1";
export const QME_SOURCE = "qme-website";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// UUID v1-v5, insensible à la casse — requestId généré côté navigateur.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requiredText(value, field, max) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field}_required`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field}_too_long`);
  return result;
}

export function optionalText(value, field, max) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new Error(`invalid_${field}`);
  const result = value.trim();
  if (result.length > max) throw new Error(`${field}_too_long`);
  return result;
}

// Organisation obligatoire : espaces internes normalisés (une tabulation ou
// une série d'espaces ne doit pas passer pour un contenu réel), longueur
// plafonnée, rejet explicite si vide APRÈS normalisation (un champ rempli de
// seuls espaces ne doit jamais créer de tâche).
export function normalizeOrganization(value, max = 200) {
  if (typeof value !== "string") throw new Error("organization_required");
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) throw new Error("organization_required");
  if (normalized.length > max) throw new Error("organization_too_long");
  return normalized;
}

export function validateEmail(value, max = 254) {
  const email = requiredText(value, "email", max);
  if (!EMAIL.test(email)) throw new Error("invalid_email");
  return email;
}

export function validateRequestId(value) {
  const requestId = requiredText(value, "request_id", 100);
  if (!UUID.test(requestId)) throw new Error("invalid_request_id");
  return requestId;
}

// Vérifie que sourceUrl pointe bien vers le site QME attendu — pas une
// validation de forme seule, une vérification d'origine (le brief l'exige :
// "vérifier l'origine attendue côté relais").
export function validateSourceUrl(value, expectedOrigin, max = 2000) {
  const raw = requiredText(value, "source_url", max);
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("invalid_source_url");
  }
  if (parsed.protocol !== "https:") throw new Error("invalid_source_url");
  if (expectedOrigin && parsed.origin !== expectedOrigin) throw new Error("unexpected_source_origin");
  return parsed.toString();
}

// Neutralise le Markdown/HTML actif dans un champ saisi par un visiteur avant
// insertion dans le gabarit de description : un `# Titre`, un `[lien](url)`
// ou une balise HTML ne doivent jamais devenir actifs dans la tâche générée.
// Principe : échapper les caractères de contrôle Markdown (CommonMark), pas
// les réécrire ni les supprimer — le texte reste lisible tel quel.
export function escapeMarkdown(value) {
  if (typeof value !== "string") return "";
  // UNE SEULE passe, sur le texte déjà nettoyé des caractères de contrôle :
  // un `.replace` global sur un caractère (jamais sur `\`) ne revisite jamais
  // le texte déjà inséré, donc jamais de double échappement (`\\<` rééchappé
  // en `\\\\<`) — c'était le bug d'une version antérieure à plusieurs passes.
  return value
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[\\`*_{}[\]()#+\-.!|>~<]/g, "\\$&");
}

function fmtMultiline(value) {
  // "message" est le seul champ multi-ligne autorisé : chaque ligne est
  // échappée indépendamment pour qu'un saut de ligne ne recompose pas un
  // Markdown actif à cheval sur deux lignes.
  return value.split("\n").map(escapeMarkdown).join("\n");
}

export function buildTitle(organization) {
  const title = `QME - Demande de l'entreprise ${organization}`;
  if (title.length > 240) throw new Error("organization_too_long");
  return title;
}

export function buildDescription({ name, email, organization, need, message, receivedAtParis, requestId, sourceUrl }) {
  return [
    "# Demande QME",
    "",
    "## Contact",
    "",
    `- **Nom :** ${escapeMarkdown(name) || "—"}`,
    `- **Email :** ${escapeMarkdown(email)}`,
    `- **Organisation :** ${escapeMarkdown(organization)}`,
    "",
    "## Besoin",
    "",
    `- **Type de prestation :** ${escapeMarkdown(need) || "—"}`,
    "",
    "### Message",
    "",
    fmtMultiline(message) || "—",
    "",
    "## Qualification initiale",
    "",
    "- **Nature :** Prospect potentiel",
    "- **Source :** Site web QME",
    `- **Reçu le :** ${receivedAtParis}`,
    `- **Identifiant de demande :** ${requestId}`,
    `- **Page d’origine :** ${escapeMarkdown(sourceUrl)}`
  ].join("\n");
}

// Checklist fixe de qualification prospect (brief) — jamais un contenu
// paramétrable par le visiteur. `idFactory` injecté pour des tests
// déterministes ; `crypto.randomUUID` en usage réel.
export function buildProspectChecklist(idFactory = () => crypto.randomUUID()) {
  return [
    "Qualifier le besoin et l’adéquation avec les prestations QME",
    "Vérifier les coordonnées du prospect",
    "Préparer le premier contact",
    "Décider : poursuivre, mettre en attente ou écarter"
  ].map((text) => ({ id: `qme-ck-${idFactory()}`, text, done: false, end: null, statusId: null, assignee: "" }));
}

// Signature HMAC-SHA256 du corps brut + horodatage — même principe que les
// autres comparaisons de secret du dépôt (constantTimeEqual, _shared/nexora.ts) :
// hachage préalable à taille fixe puis timingSafeEqual, jamais un `===` direct.
export function computeSignature(secret, timestamp, rawBody) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifySignature(secret, timestamp, rawBody, providedSignature) {
  if (typeof providedSignature !== "string" || !providedSignature) return false;
  const expected = computeSignature(secret, timestamp, rawBody);
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(providedSignature).digest();
  return timingSafeEqual(a, b);
}

// Fenêtre anti-rejeu : une requête trop ancienne est refusée (secret volé
// rejouable indéfiniment sinon) ; une requête "du futur" au-delà de la
// tolérance d'horloge est tout aussi suspecte.
export function isTimestampFresh(timestampSeconds, nowSeconds = Math.floor(Date.now() / 1000), maxAgeSeconds = 300, maxSkewSeconds = 60) {
  const ts = Number(timestampSeconds);
  if (!Number.isFinite(ts)) return false;
  if (ts > nowSeconds + maxSkewSeconds) return false;
  if (nowSeconds - ts > maxAgeSeconds) return false;
  return true;
}

// Empreinte stable d'une signature déjà consommée — sert de clé de document
// pour la protection anti-rejeu (jamais la signature en clair comme id).
export function signatureFingerprint(signature) {
  return createHash("sha256").update(signature).digest("hex");
}

// Empreinte d'IP pour la limitation de débit — jamais l'IP en clair dans un
// identifiant de document Firestore.
export function ipFingerprint(ip) {
  return createHash("sha256").update(ip || "unknown").digest("hex").slice(0, 32);
}
