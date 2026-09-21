/* Archivage automatique des devis/factures PDF sur Google Drive (issue
   dédiée). Comme les autres suites de fonctions Netlify (voir helpers.test.mjs),
   ces tests lisent directement le code source des fonctions plutôt que d'en
   recopier une version : le comportement réel (auth, statuts HTTP, absence de
   crash) est ce qui compte, pas une réimplémentation qui pourrait diverger. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("google-auth : signe un JWT RS256 à partir du compte de service et l'échange sur oauth2.googleapis.com", async () => {
  const source = await read("../netlify/functions/_shared/google-auth.ts");
  assert.match(source, /createSign\("RSA-SHA256"\)/);
  assert.match(source, /grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"/);
  assert.match(source, /https:\/\/oauth2\.googleapis\.com\/token/);
  assert.match(source, /Netlify\.env\.get\("FIREBASE_SERVICE_ACCOUNT_JSON"\)/);
  assert.doesNotMatch(source, /process\.env/);
});

test("google-auth : ne casse jamais silencieusement — compte de service absent = erreur explicite, jamais un crash", async () => {
  const source = await read("../netlify/functions/_shared/google-auth.ts");
  assert.match(source, /GOOGLE_SERVICE_ACCOUNT_MISSING/);
  assert.match(source, /GOOGLE_OAUTH_ERROR/);
});

test("drive.ts : documente les 3 étapes de setup Google Cloud/Drive à faire par Quentin", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  assert.match(source, /Activer l'API Google Drive/);
  assert.match(source, /client_email/);
  assert.match(source, /NEXORA_DRIVE_ROOT_FOLDER_ID/);
});

test("drive.ts : scope Drive complet, jamais le scope Firestore", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  assert.match(source, /DRIVE_SCOPE = "https:\/\/www\.googleapis\.com\/auth\/drive"/);
  assert.doesNotMatch(source, /datastore/);
});

test("drive.ts : findOrCreateFolder cherche avant de créer, jamais de doublon de dossier client", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  assert.match(source, /export async function findOrCreateFolder/);
  assert.match(source, /mimeType = '\$\{FOLDER_MIME\}'/);
  assert.match(source, /export async function findOrCreateClientFolder/);
  assert.match(source, /findOrCreateFolder\(accessToken, rootFolderId, name\)/);
});

test("drive.ts : findOrCreateClientFolder retombe sur « Client sans nom » plutôt que de planter", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  const from = source.indexOf("export async function findOrCreateClientFolder");
  const body = source.slice(from, source.indexOf("\n}", from));
  assert.match(body, /"Client sans nom"/);
});

test("drive.ts : uploadOrReplaceFile remplace un fichier existant (PATCH+media) ou en crée un (multipart)", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  assert.match(source, /export async function uploadOrReplaceFile/);
  assert.match(source, /uploadType=media/);
  assert.match(source, /method: "PATCH"/);
  assert.match(source, /uploadType=multipart/);
  assert.match(source, /Buffer\.from\(pdfBase64, "base64"\)/);
});

test("drive.ts : toute erreur Drive est capturée avec un code identifiable, jamais un throw non catché à travers driveRequest", async () => {
  const source = await read("../netlify/functions/_shared/drive.ts");
  assert.match(source, /DRIVE_API_ERROR/);
  assert.match(source, /if \(!response\.ok\)/);
});

test("nexora-drive-archive : protégé par le même mécanisme Bearer que nexora-storage (jeton Firebase de session)", async () => {
  const source = await read("../netlify/functions/nexora-drive-archive.ts");
  const storage = await read("../netlify/functions/nexora-storage.mts");
  assert.match(source, /authorization\.startsWith\("Bearer "\)/);
  assert.match(storage, /authorization\.startsWith\("Bearer "\)/);
  assert.match(source, /method: \["POST"\]/);
});

test("nexora-drive-archive : configuration Drive absente -> 200 { archived: false, reason: \"not_configured\" }, jamais une erreur bloquante", async () => {
  const source = await read("../netlify/functions/nexora-drive-archive.ts");
  assert.match(source, /archived: false, reason: "not_configured" \}, 200/);
  assert.match(source, /requireDriveConfig/);
});

test("nexora-drive-archive : un échec Drive répond aussi 200 { archived: false, reason: \"drive_error\" } — jamais un 500 qui casserait la sauvegarde", async () => {
  const source = await read("../netlify/functions/nexora-drive-archive.ts");
  const from = source.indexOf("} catch (error) {");
  const body = source.slice(from, source.indexOf("};", from));
  assert.match(body, /reason: "drive_error"/);
  assert.match(body, /\},\s*200/);
  assert.doesNotMatch(source, /\}, 500\)/);
});

test("nexora-drive-archive : succès Drive répond { archived: true, fileId, folderId }", async () => {
  const source = await read("../netlify/functions/nexora-drive-archive.ts");
  assert.match(source, /archived: true, fileId, folderId \}, 200/);
});

test("nexora-drive-archive : pas de nouvelle dépendance npm — appels REST bruts, comme nexora-storage.mts pour Firestore", async () => {
  const pkg = JSON.parse(await read("../package.json"));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  assert.ok(!("googleapis" in deps), "le SDK googleapis ne doit pas être ajouté comme dépendance");
});

test("front : archivage best-effort — jamais d'alert, toujours un console.warn en cas d'échec, et un flag de config manquante", async () => {
  const part = await read("../source/index.html.part-003");
  assert.match(part, /async function archivePdfToDrive/);
  assert.match(part, /\/api\/nexora\/drive-archive/);
  assert.doesNotMatch(part.slice(part.indexOf("async function archivePdfToDrive"), part.indexOf("async function archiveQuotePdfToDrive")), /alert\(/);
  assert.match(part, /console\.warn\("Archivage Drive/);
  assert.match(part, /nexora:driveArchiveNotConfigured/);
});

test("front : downloadQuotePdf n'est jamais dupliqué pour l'archivage — buildQuotePdfBase64 réutilise la même mise en page (option asBase64)", async () => {
  const part = await read("../source/index.html.part-003");
  assert.match(part, /async function downloadQuotePdf\(quote, client, settings, quoteSkills, \{ asBase64 = false \} = \{\}\)/);
  assert.match(part, /async function buildQuotePdfBase64\(quote, client, settings, quoteSkills\) \{\s*\n\s*return downloadQuotePdf\(quote, client, settings, quoteSkills, \{ asBase64: true \}\);/);
});

test("front : downloadInvoicePdf n'est jamais dupliqué pour l'archivage — même motif que les devis (option asBase64)", async () => {
  const part = await read("../source/index.html.part-003");
  assert.match(part, /async function downloadInvoicePdf\([^)]*\{ asBase64 = false \} = \{\}\)/);
  assert.match(part, /async function buildInvoicePdfBase64\([^)]*\)\s*\{\s*\n\s*return downloadInvoicePdf\(/);
  assert.match(part, /async function archiveInvoicePdfToDrive\(/);
});

test("front : l'archivage se déclenche sur les 3 points de sauvegarde d'une facture — saisie manuelle, « Facturer ce devis » et un avoir", async () => {
  const part003 = await read("../source/index.html.part-003");
  const part001 = await read("../source/index.html.part-001");
  assert.match(part003, /archiveInvoicePdfToDrive\(saved, client, settings, skills, sourceQuote, original\?\.number\)/);
  assert.match(part001, /archiveInvoicePdfToDrive\(invoice, client, quoteSettings, quoteSkills, quote, null\)/);
  assert.match(part001, /archiveInvoicePdfToDrive\(creditNote, client, quoteSettings, quoteSkills, sourceQuote, source\.number\)/);
});

test("front : saveQuote et saveInvoice renvoient le document sauvegardé (pas juste son id), nécessaire pour l'archivage synchrone", async () => {
  const part001 = await read("../source/index.html.part-001");
  const saveQuoteFrom = part001.indexOf("const saveQuote = (data, existingId) => {");
  const saveQuoteBody = part001.slice(saveQuoteFrom, part001.indexOf("\n  };", saveQuoteFrom));
  assert.match(saveQuoteBody, /return merged;/);
  assert.match(saveQuoteBody, /return quote;/);

  const saveInvoiceFrom = part001.indexOf("const saveInvoice = (data, existingId) => {");
  const saveInvoiceBody = part001.slice(saveInvoiceFrom, part001.indexOf("\n  };", saveInvoiceFrom));
  assert.match(saveInvoiceBody, /return merged;/);
  assert.match(saveInvoiceBody, /return invoice;/);
});
