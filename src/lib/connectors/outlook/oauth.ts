import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/* ────────────────────────────────────────────────────────────────────────
   OAuth2 Microsoft (Outlook.com / Hotmail / Live / Microsoft 365 / Exchange
   Online), flux « authorization code » serveur (Entra / Azure AD v2.0).

   Accès via MICROSOFT GRAPH (et non IMAP/SMTP) : lecture des messages, dossiers,
   brouillons et envoyés, envoi de messages avec pièces jointes, agenda et
   contacts. Les permissions déléguées Graph correspondantes doivent être
   accordées dans l'app Entra. `offline_access` fournit le refresh token.
   ──────────────────────────────────────────────────────────────────────── */

/** Portées Microsoft Graph (déléguées) requises par le connecteur. */
export const DEFAULT_OUTLOOK_SCOPES = [
  "offline_access",
  "openid",
  "email",
  "profile",
  "https://graph.microsoft.com/User.Read",
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/Contacts.ReadWrite",
];

export type OutlookOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tenant: string;
  scopes: string[];
  stateSecret: string;
};

function authBase(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
}

export function getOutlookOAuthConfig(): OutlookOAuthConfig | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  const stateSecret =
    process.env.MICROSOFT_OAUTH_STATE_SECRET ?? process.env.CONNECTOR_SECRET_KEY;
  // « common » accepte comptes personnels ET professionnels ; « consumers »
  // pour le grand public uniquement. Surclassable par MICROSOFT_TENANT.
  const tenant = process.env.MICROSOFT_TENANT ?? "common";
  const scopesEnv = process.env.MICROSOFT_SCOPES;
  if (!clientId || !clientSecret || !redirectUri || !stateSecret) return null;
  const scopes = scopesEnv ? scopesEnv.split(/\s+/).filter(Boolean) : DEFAULT_OUTLOOK_SCOPES.slice();
  for (const required of DEFAULT_OUTLOOK_SCOPES) {
    if (!scopes.includes(required)) scopes.push(required);
  }
  return { clientId, clientSecret, redirectUri, tenant, scopes, stateSecret };
}

/* ── State CSRF signé (HMAC), identique au connecteur Gmail ─────────────── */

export type SignedState = { raw: string; signed: string };

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
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
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

export function buildAuthorizationUrl(config: OutlookOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: config.scopes.join(" "),
    // Force le consentement initial pour obtenir un refresh_token (offline_access).
    prompt: "select_account",
    state,
  });
  return `${authBase(config.tenant)}/authorize?${params.toString()}`;
}

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: "Bearer";
  id_token?: string;
};

export async function exchangeCodeForTokens(
  config: OutlookOAuthConfig,
  code: string,
): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    scope: config.scopes.join(" "),
  });
  const response = await fetch(`${authBase(config.tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft token exchange failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<MicrosoftTokenResponse>;
}

/**
 * Erreur signalant qu'un compte Outlook doit être reconnecté (refresh token
 * expiré/révoqué). Les loaders la rattrapent pour afficher « Reconnecter ».
 */
export class OutlookReconnectError extends Error {
  constructor(message = "Le compte Microsoft doit être reconnecté (token expiré ou révoqué).") {
    super(message);
    this.name = "OutlookReconnectError";
  }
}

export function isOutlookReconnectError(error: unknown): boolean {
  return (
    error instanceof OutlookReconnectError ||
    (error instanceof Error && /invalid_grant|OutlookReconnect/.test(error.message))
  );
}

export async function refreshAccessToken(
  config: OutlookOAuthConfig,
  refreshToken: string,
): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: config.scopes.join(" "),
  });
  const response = await fetch(`${authBase(config.tenant)}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) {
    const text = await response.text();
    if (response.status === 400 && /invalid_grant|interaction_required/i.test(text)) {
      throw new OutlookReconnectError();
    }
    throw new Error(`Microsoft token refresh failed (${response.status}): ${text}`);
  }
  return response.json() as Promise<MicrosoftTokenResponse>;
}

/**
 * Lit l'adresse email depuis l'id_token (claims `email` / `preferred_username`).
 * Le jeton vient directement du endpoint Microsoft via TLS (échange serveur à
 * serveur) : on lit le payload sans re-vérifier la signature, uniquement pour
 * récupérer l'adresse du compte connecté.
 */
export function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as {
      email?: string;
      preferred_username?: string;
      upn?: string;
    };
    const candidate = payload.email ?? payload.preferred_username ?? payload.upn ?? null;
    return candidate && candidate.includes("@") ? candidate : candidate ?? null;
  } catch {
    return null;
  }
}
