import type { Config } from "@netlify/functions";
import { json } from "./_shared/nexora.js";
import { getGoogleAccessToken } from "./_shared/google-auth.js";
import { DRIVE_SCOPE, findOrCreateClientFolder, requireDriveConfig, uploadOrReplaceFile } from "./_shared/drive.js";

function text(value: unknown, max: number) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  // Même mécanisme d'auth que nexora-storage.mts (le seul autre endpoint
  // appelé directement par la session navigateur d'un utilisateur, hors
  // passerelle assistant/MCP) : la présence d'un jeton d'identité Firebase
  // porté par la session en cours suffit à autoriser l'appel. Ce jeton
  // n'est retransmis à aucune API Google ici — l'archivage Drive s'authentifie
  // à part, via le compte de service (voir _shared/google-auth.ts) — donc pas
  // besoin de le vérifier plus finement que sa simple présence.
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ") || authorization.trim() === "Bearer") {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clientName = text(body.clientName, 240) || "Client sans nom";
  const filename = text(body.filename, 200);
  const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : "";
  if (!filename || !pdfBase64) return json({ ok: false, error: "missing_fields" }, 400);
  // ~40 Mo de base64 (largement au-dessus d'un devis/facture PDF réel) :
  // garde-fou de sanité, pas une limite fonctionnelle attendue en pratique.
  if (pdfBase64.length > 40_000_000) return json({ ok: false, error: "payload_too_large" }, 413);

  const drive = requireDriveConfig();
  if (drive.missing.length || !drive.rootFolderId) {
    // Pas une erreur : Quentin n'a pas encore terminé le setup Drive (voir
    // _shared/drive.ts). L'appelant (front) traite ça comme un simple
    // "archivage pas encore actif", jamais comme un échec bloquant.
    return json({ archived: false, reason: "not_configured" }, 200);
  }

  try {
    const accessToken = await getGoogleAccessToken(DRIVE_SCOPE);
    const folderId = await findOrCreateClientFolder(accessToken, drive.rootFolderId, clientName);
    const { fileId } = await uploadOrReplaceFile(accessToken, folderId, filename, pdfBase64);
    return json({ archived: true, fileId, folderId }, 200);
  } catch (error) {
    // Best-effort par construction : jamais de 500 qui remonterait comme un
    // échec de sauvegarde côté front (voir la mission). L'erreur reste
    // consultable via `detail` pour du diagnostic, sans casser l'UX.
    return json(
      { archived: false, reason: "drive_error", detail: error instanceof Error ? error.message : String(error) },
      200
    );
  }
};

export const config: Config = { path: "/api/nexora/drive-archive", method: ["POST"] };
