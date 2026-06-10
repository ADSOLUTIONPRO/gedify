import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

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
  /** Secret confidentiel (mode direct). Absent en mode relais (client public + PKCE). */
  clientSecret: string | null;
  /** URI de redirection de CETTE instance (mode direct, enregistrée dans son app). */
  redirectUri: string | null;
  /**
   * URL du RELAIS OAuth (mode multi-tenant) : une URL de callback UNIQUE, hébergée
   * par l'éditeur et enregistrée une seule fois dans l'app Azure partagée. Quand
   * elle est définie, l'instance l'utilise comme redirect_uri auprès de Microsoft,
   * encode SON propre callback dans le `state`, et échange le code par PKCE (sans
   * secret). Voir docs/oauth-relay.
   */
  relayUrl: string | null;
  tenant: string;
  scopes: string[];
  stateSecret: string;
};

/** Mode relais multi-tenant actif (un seul enregistrement Azure pour N instances). */
export function isOutlookRelayMode(config: OutlookOAuthConfig): boolean {
  return Boolean(config.relayUrl);
}

function authBase(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0`;
}

export function getOutlookOAuthConfig(): OutlookOAuthConfig | null {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || null;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI || null;
  const relayUrl = process.env.MICROSOFT_RELAY_URL?.trim() || null;
  const stateSecret =
    process.env.MICROSOFT_OAUTH_STATE_SECRET ?? process.env.CONNECTOR_SECRET_KEY;
  // « common » accepte comptes personnels ET professionnels ; « consumers »
  // pour le grand public uniquement. Surclassable par MICROSOFT_TENANT.
  const tenant = process.env.MICROSOFT_TENANT ?? "common";
  const scopesEnv = process.env.MICROSOFT_SCOPES;
  // Il faut au minimum le client + un secret d'état, ET une destination de
  // redirection : soit un relais (multi-tenant), soit un redirect direct.
  if (!clientId || !stateSecret) return null;
  if (!relayUrl && !redirectUri) return null;
  // Mode direct (sans relais) : un secret confidentiel est requis.
  if (!relayUrl && !clientSecret) return null;
  const scopes = scopesEnv ? scopesEnv.split(/\s+/).filter(Boolean) : DEFAULT_OUTLOOK_SCOPES.slice();
  for (const required of DEFAULT_OUTLOOK_SCOPES) {
    if (!scopes.includes(required)) scopes.push(required);
  }
  return { clientId, clientSecret, redirectUri, relayUrl, tenant, scopes, stateSecret };
}

/* ── PKCE (RFC 7636) ─────────────────────────────────────────────────────────
   Le code_verifier est SECRET : il prouve que c'est bien l'instance qui a initié
   le flux qui réclame les tokens. On le chiffre (AES-256-GCM) pour le transporter
   dans le `state` (aller-retour via Microsoft + relais) sans jamais l'exposer, ce
   qui évite tout stockage serveur et survit à un redémarrage du conteneur. */
function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
export function createPkce(): { verifier: string; challenge: string } {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function pkceKey(stateSecret: string): Buffer {
  return createHash("sha256").update(stateSecret).digest();
}
export function encryptVerifier(verifier: string, stateSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", pkceKey(stateSecret), iv);
  const ct = Buffer.concat([cipher.update(verifier, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}
export function decryptVerifier(encoded: string, stateSecret: string): string | null {
  try {
    const [ivB64, tagB64, ctB64] = encoded.split(".");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const decipher = createDecipheriv("aes-256-gcm", pkceKey(stateSecret), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
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

/** redirect_uri EFFECTIF : le relais (multi-tenant) s'il est défini, sinon le
 *  redirect direct de l'instance. Doit être IDENTIQUE à l'autorisation ET à
 *  l'échange de token (exigence Microsoft). */
export function effectiveRedirectUri(config: OutlookOAuthConfig): string {
  return (config.relayUrl ?? config.redirectUri)!;
}

export function buildAuthorizationUrl(
  config: OutlookOAuthConfig,
  state: string,
  opts: { codeChallenge?: string } = {},
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: effectiveRedirectUri(config),
    response_type: "code",
    response_mode: "query",
    scope: config.scopes.join(" "),
    // Force le consentement initial pour obtenir un refresh_token (offline_access).
    prompt: "select_account",
    state,
  });
  if (opts.codeChallenge) {
    params.set("code_challenge", opts.codeChallenge);
    params.set("code_challenge_method", "S256");
  }
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
  opts: { codeVerifier?: string } = {},
): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    redirect_uri: effectiveRedirectUri(config),
    grant_type: "authorization_code",
    scope: config.scopes.join(" "),
  });
  // Client confidentiel (mode direct) → secret ; client public (relais) → PKCE.
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  if (opts.codeVerifier) body.set("code_verifier", opts.codeVerifier);
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
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    scope: config.scopes.join(" "),
  });
  // Client public (relais/PKCE) → rafraîchissement sans secret.
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
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
