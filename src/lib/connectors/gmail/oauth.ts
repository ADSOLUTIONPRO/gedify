import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const DEFAULT_GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/contacts.readonly",
  "https://www.googleapis.com/auth/calendar",
  "openid",
  "email",
  "profile",
];

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  stateSecret: string;
};

export function getGmailOAuthConfig(): GmailOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const stateSecret =
    process.env.GOOGLE_OAUTH_STATE_SECRET ?? process.env.CONNECTOR_SECRET_KEY;
  const scopesEnv = process.env.GOOGLE_GMAIL_SCOPES;
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) return null;
  const scopes = scopesEnv
    ? scopesEnv.split(/\s+/).filter(Boolean)
    : DEFAULT_GMAIL_SCOPES.slice();
  // Ensure openid + email (lire l'email du compte) et contacts.readonly
  // (synchronisation Google Contacts via People API) sont toujours demandés.
  for (const required of [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/contacts.readonly",
    // Agenda complet : lecture/écriture des événements ET énumération des
    // agendas (calendarList) — même connexion Google que pour les emails.
    "https://www.googleapis.com/auth/calendar",
  ]) {
    if (!scopes.includes(required)) scopes.push(required);
  }
  return { clientId, clientSecret, redirectUri, scopes, stateSecret };
}

export type SignedState = {
  raw: string;
  signed: string;
};

export function signState(stateSecret: string, payload: Record<string, unknown> = {}): SignedState {
  const nonce = randomBytes(16).toString("base64url");
  const issued = Date.now();
  const raw = JSON.stringify({ nonce, issued, ...payload });
  const rawB64 = Buffer.from(raw, "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret).update(rawB64).digest("base64url");
  return { raw, signed: `${rawB64}.${sig}` };
}

export function verifyState(
  stateSecret: string,
  state: string,
  options: { maxAgeMs?: number } = {},
): Record<string, unknown> | null {
  const maxAge = options.maxAgeMs ?? 10 * 60 * 1000;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [rawB64, sig] = parts;
  const expected = createHmac("sha256", stateSecret).update(rawB64).digest("base64url");
  if (
    expected.length !== sig.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return null;
  }
  try {
    const raw = Buffer.from(rawB64, "base64url").toString("utf8");
    const parsed = JSON.parse(raw) as { issued?: number };
    if (typeof parsed.issued !== "number") return null;
    if (Date.now() - parsed.issued > maxAge) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(
  config: GmailOAuthConfig,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: config.scopes.join(" "),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

export async function exchangeCodeForTokens(
  config: GmailOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<GoogleTokenResponse>;
}

/**
 * Erreur signalant qu'un compte Google doit être reconnecté : le refresh token
 * est expiré ou révoqué (`invalid_grant`). Les loaders la rattrapent pour
 * afficher un état « Reconnecter Gmail » au lieu de planter la page.
 */
export class GmailReconnectError extends Error {
  constructor(message = "Le compte Google doit être reconnecté (token expiré ou révoqué).") {
    super(message);
    this.name = "GmailReconnectError";
  }
}

export function isGmailReconnectError(error: unknown): boolean {
  return (
    error instanceof GmailReconnectError ||
    (error instanceof Error && /invalid_grant|GmailReconnect/.test(error.message))
  );
}

export async function refreshAccessToken(
  config: GmailOAuthConfig,
  refreshToken: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    // Token révoqué/expiré : erreur typée → l'UI propose la reconnexion.
    if (response.status === 400 && /invalid_grant/i.test(text)) {
      throw new GmailReconnectError();
    }
    throw new Error(`Google token refresh failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<GoogleTokenResponse>;
}

export async function fetchUserInfo(accessToken: string): Promise<{ email?: string; name?: string }> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return {};
  return response.json() as Promise<{ email?: string; name?: string }>;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const body = new URLSearchParams({ token });
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}
