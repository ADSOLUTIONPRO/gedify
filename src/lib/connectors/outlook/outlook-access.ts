import "server-only";

import {
  OutlookReconnectError,
  getOutlookOAuthConfig,
  refreshAccessToken,
} from "./oauth";
import {
  getCachedOutlookAccessToken,
  getOutlookRefreshToken,
  updateOutlookTokens,
} from "./outlook-token-store";

/* Fournit un access token Microsoft valide pour un compte donné : renvoie le
   token en cache s'il est encore valable (>60 s), sinon le rafraîchit via le
   refresh token et persiste le nouveau (en gérant la rotation éventuelle du
   refresh token). Sert aux connexions IMAP et SMTP en XOAUTH2. */

export type OutlookAccessToken = { accessToken: string; email: string };

export async function getValidOutlookAccessToken(accountId: string): Promise<OutlookAccessToken> {
  const config = getOutlookOAuthConfig();
  if (!config) {
    throw new Error(
      "OAuth Microsoft non configuré (MICROSOFT_CLIENT_ID/SECRET/REDIRECT_URI requis).",
    );
  }

  const stored = await getOutlookRefreshToken(accountId);
  if (!stored) {
    throw new OutlookReconnectError("Aucun token Microsoft enregistré pour ce compte. Reconnectez-le.");
  }

  const cached = await getCachedOutlookAccessToken(accountId);
  if (cached) return { accessToken: cached, email: stored.email };

  const refreshed = await refreshAccessToken(config, stored.refreshToken);
  const expiresAt = Date.now() + (refreshed.expires_in - 60) * 1000;
  await updateOutlookTokens(accountId, {
    accessToken: refreshed.access_token,
    accessTokenExpiresAt: expiresAt,
    // Microsoft fait parfois tourner le refresh token : on conserve le nouveau.
    refreshToken: refreshed.refresh_token,
  });
  return { accessToken: refreshed.access_token, email: stored.email };
}
