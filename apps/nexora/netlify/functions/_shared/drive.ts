// ============================================================================
// Archivage automatique des devis/factures PDF sur Google Drive.
//
// Prérequis côté Google Cloud / Drive — CE SONT DES ACTIONS DE QUENTIN, pas
// du code, et rien ici ne peut les remplacer :
//   1. Activer l'API Google Drive sur le projet GCP `nexora-cb20d` (console
//      Google Cloud → API et services → Bibliothèque → rechercher
//      "Google Drive API" → Activer).
//   2. Récupérer l'adresse email du compte de service déjà utilisé pour
//      Firebase : c'est le champ `client_email` du JSON stocké dans la
//      variable d'environnement Netlify `FIREBASE_SERVICE_ACCOUNT_JSON`
//      (ressemble à quelque-chose@nexora-cb20d.iam.gserviceaccount.com).
//   3. Créer un dossier "Clients" dans son propre Google Drive, le PARTAGER
//      avec cet email (rôle "Éditeur"), copier son ID depuis l'URL du
//      dossier (https://drive.google.com/drive/folders/<ID ICI>) et le
//      renseigner dans la variable d'environnement Netlify
//      `NEXORA_DRIVE_ROOT_FOLDER_ID`.
//
// Tant que ces trois étapes ne sont pas faites, `requireDriveConfig` signale
// l'absence de la variable d'environnement, et un appel Drive malgré tout
// (dossier racine introuvable ou non partagé, API désactivée...) échoue de
// façon capturée — jamais de crash non catché. Voir nexora-drive-archive.ts,
// qui traduit ça en `{ archived: false, reason: "not_configured" | "drive_error" }`,
// toujours avec un statut HTTP 200 : l'archivage est du best-effort, jamais
// une opération bloquante pour la sauvegarde d'un devis ou d'une facture.
// ============================================================================

declare const Netlify: { env: { get(name: string): string | undefined } };

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export function requireDriveConfig() {
  const rootFolderId = Netlify.env.get("NEXORA_DRIVE_ROOT_FOLDER_ID");
  return { rootFolderId, missing: rootFolderId ? [] : ["NEXORA_DRIVE_ROOT_FOLDER_ID"] };
}

// Échappement minimal pour les valeurs injectées dans une requête `q=` Drive
// (les noms de client/fichier peuvent contenir des apostrophes).
function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function driveRequest(accessToken: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
  });
  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) {
    const error: any = new Error(payload?.error?.message || `Google Drive a répondu ${response.status}.`);
    error.status = response.status;
    error.code = "DRIVE_API_ERROR";
    throw error;
  }
  return payload;
}

export async function findOrCreateFolder(accessToken: string, parentId: string, name: string): Promise<string> {
  const safeName = escapeDriveQueryValue(name);
  const q = `'${parentId}' in parents and name = '${safeName}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1", spaces: "drive" });
  const found = await driveRequest(accessToken, `${DRIVE_API}/files?${params.toString()}`);
  const existingId = found?.files?.[0]?.id;
  if (existingId) return existingId;

  const created = await driveRequest(accessToken, `${DRIVE_API}/files?fields=id`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!created?.id) throw new Error("Création du dossier Drive impossible : réponse sans id.");
  return created.id;
}

export async function findOrCreateClientFolder(
  accessToken: string,
  rootFolderId: string,
  clientName: string
): Promise<string> {
  const name = (clientName || "").trim() || "Client sans nom";
  return findOrCreateFolder(accessToken, rootFolderId, name);
}

async function findFileInFolder(accessToken: string, folderId: string, filename: string): Promise<string | null> {
  const safeName = escapeDriveQueryValue(filename);
  const q = `'${folderId}' in parents and name = '${safeName}' and trashed = false`;
  const params = new URLSearchParams({ q, fields: "files(id,name)", pageSize: "1", spaces: "drive" });
  const found = await driveRequest(accessToken, `${DRIVE_API}/files?${params.toString()}`);
  return found?.files?.[0]?.id || null;
}

export async function uploadOrReplaceFile(
  accessToken: string,
  folderId: string,
  filename: string,
  pdfBase64: string
): Promise<{ fileId: string; folderId: string }> {
  const existingId = await findFileInFolder(accessToken, folderId, filename);

  if (existingId) {
    // Remplacement du contenu d'un fichier existant : upload simple (le
    // corps binaire suffit, pas de multipart nécessaire pour PATCH+media).
    const buffer = Buffer.from(pdfBase64, "base64");
    const updated = await driveRequest(
      accessToken,
      `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(existingId)}?uploadType=media`,
      { method: "PATCH", headers: { "content-type": "application/pdf" }, body: buffer }
    );
    return { fileId: updated?.id || existingId, folderId };
  }

  // Création : upload multipart (métadonnées JSON + contenu PDF) en un seul
  // appel, comme documenté par l'API Drive pour uploadType=multipart.
  const boundary = `nexora-drive-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: filename, parents: [folderId], mimeType: "application/pdf" });
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/pdf\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n${pdfBase64}\r\n` +
    `--${boundary}--`;

  const created = await driveRequest(accessToken, `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { "content-type": `multipart/related; boundary=${boundary}` },
    body: multipartBody,
  });
  if (!created?.id) throw new Error("Envoi du fichier Drive impossible : réponse sans id.");
  return { fileId: created.id, folderId };
}
