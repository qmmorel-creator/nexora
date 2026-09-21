// Émission de jetons d'accès OAuth2 Google à partir du compte de service
// Firebase (FIREBASE_SERVICE_ACCOUNT_JSON), pour appeler une API Google REST
// AUTRE que Firestore (ex. Drive) sans dépendre du SDK `googleapis` complet.
//
// Principe (RFC 7523 — JWT Bearer Token pour OAuth2 côté serveur) :
//   1. On construit un JWT signé en RS256 avec la clé privée du compte de
//      service (`iss` = client_email, `scope` demandé, `aud` = endpoint de
//      jeton, `exp`/`iat`).
//   2. On l'échange contre un access_token à
//      https://oauth2.googleapis.com/token
//      (grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer).
//
// C'est un mécanisme distinct de celui de nexora-storage.mts, qui relaie
// directement le jeton d'identité Firebase de l'utilisateur (accepté tel
// quel par l'API REST Firestore via les règles de sécurité) : Firestore n'a
// pas besoin d'un jeton OAuth2 de compte de service côté serveur, alors que
// l'API Drive, elle, l'exige. Cette fonction ne touche donc pas au chemin
// existant de nexora-storage.mts ni de _shared/nexora.ts (firebase-admin) —
// elle leur est parallèle, réutilisable par toute future intégration Google
// REST qui aurait besoin du même compte de service avec un autre scope.
//
// Le jeton obtenu est mis en cache en mémoire par scope, jusqu'à ~1 minute
// avant son expiration, pour éviter de re-signer un JWT à chaque appel Drive
// dans une même invocation de fonction (plusieurs uploads d'affilée, etc.).
// Ce cache ne survit pas forcément entre deux invocations froides (le
// runtime Netlify peut recycler le module) : ce n'est qu'une optimisation,
// jamais une hypothèse de correction.

import { createSign } from "node:crypto";

declare const Netlify: { env: { get(name: string): string | undefined } };

export type ServiceAccount = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

export function parseServiceAccountJson(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (typeof parsed.private_key === "string") parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  return parsed;
}

function base64url(input: Buffer | string) {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type CachedToken = { accessToken: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function mintAccessToken(serviceAccount: ServiceAccount, scope: string): Promise<CachedToken> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(serviceAccount.private_key);
  const jwt = `${signingInput}.${base64url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    const error: any = new Error(
      payload?.error_description || payload?.error || `Échange de jeton OAuth2 Google échoué (${response.status}).`
    );
    error.status = response.status;
    error.code = "GOOGLE_OAUTH_ERROR";
    throw error;
  }
  const expiresIn = Number(payload.expires_in) || 3600;
  return { accessToken: payload.access_token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
}

export async function getGoogleAccessToken(scope: string): Promise<string> {
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > Date.now()) return cached.accessToken;

  const serviceAccount = parseServiceAccountJson(Netlify.env.get("FIREBASE_SERVICE_ACCOUNT_JSON"));
  if (!serviceAccount) {
    const error: any = new Error("FIREBASE_SERVICE_ACCOUNT_JSON manquant ou invalide.");
    error.code = "GOOGLE_SERVICE_ACCOUNT_MISSING";
    throw error;
  }

  const minted = await mintAccessToken(serviceAccount, scope);
  tokenCache.set(scope, minted);
  return minted.accessToken;
}
