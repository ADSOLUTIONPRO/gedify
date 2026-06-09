import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  getGmailOAuthConfig,
  verifyState,
} from "@/lib/connectors/gmail/oauth";
import {
  isGmailStoreSecure,
  saveGmailTokens,
} from "@/lib/connectors/gmail/gmail-token-store";
import { invalidateMailboxCounts } from "@/lib/messaging/mailbox-counts";
import { createAccount, listAccounts, updateAccount } from "@/lib/mail-connector/account-store";
import { GMAIL_DEFAULT_WATCHED_LABELS, GMAIL_EXCLUDED_LABELS } from "@/lib/mail-connector/default-excluded-folders";
import { DEFAULT_SENDER_FILTER } from "@/lib/mail-connector/mail-filter-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Origine joignable par le navigateur pour la redirection post-OAuth.
 * En dev, `request.nextUrl.origin` peut valoir http://0.0.0.0:PORT (adresse de
 * bind « toutes interfaces »), non routable côté client → ERR_CONNECTION_REFUSED.
 * On privilégie l'en-tête Host réel et on réécrit les hôtes non joignables.
 */
function resolveAppOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "http";
  let origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  // 0.0.0.0 / :: / [::] ne sont pas des destinations valides pour le navigateur.
  origin = origin.replace(/:\/\/(0\.0\.0\.0|\[::\]|::)(:|\/|$)/, "://localhost$2");
  return origin;
}

export async function GET(request: NextRequest) {
  try {
    const config = getGmailOAuthConfig();
    if (!config) {
      return redirectToError("OAuth Google non configuré.", request);
    }

    const errorParam = request.nextUrl.searchParams.get("error");
    if (errorParam) {
      return redirectToError(`OAuth refusé : ${errorParam}`, request);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) {
      return redirectToError("Paramètres OAuth manquants.", request);
    }

    const decoded = verifyState(config.stateSecret, state);
    if (!decoded) {
      return redirectToError("State CSRF invalide ou expiré.", request);
    }

    if (!isGmailStoreSecure()) {
      return redirectToError(
        "Stockage sécurisé manquant : définissez CONNECTOR_SECRET_KEY (16+ caractères) avant de connecter Gmail.",
        request,
      );
    }

    const tokens = await exchangeCodeForTokens(config, code);
    if (!tokens.refresh_token) {
      return redirectToError(
        "Google n'a pas renvoyé de refresh_token. Révoquez l'accès dans https://myaccount.google.com/permissions puis relancez.",
        request,
      );
    }
    const profile = await fetchUserInfo(tokens.access_token);
    const accountEmail = profile.email ?? "compte gmail";

    const passedAccountId = (decoded.accountId as string | null | undefined) ?? null;
    let accountId = passedAccountId;

    // Dédoublonnage : si on reconnecte une boîte déjà présente (même email),
    // on réutilise le compte existant au lieu d'en créer un nouveau.
    if (!accountId) {
      const existing = (await listAccounts()).find(
        (a) => (a.email ?? a.gmailEmail ?? "").toLowerCase() === accountEmail.toLowerCase(),
      );
      if (existing) accountId = existing.id;
    }

    if (accountId) {
      await updateAccount(accountId, {
        authType: "oauth-gmail",
        connector: "gmail-oauth",
        gmailEmail: accountEmail,
        email: accountEmail,
        isActive: true,
      });
    } else {
      const created = await createAccount({
        name: `Gmail · ${accountEmail}`,
        email: accountEmail,
        provider: "gmail",
        authType: "oauth-gmail",
        connector: "gmail-oauth",
        gmailEmail: accountEmail,
        imapHost: "gmail-api",
        imapPort: 443,
        encryption: "tls",
        username: accountEmail,
        watchedFolder: "INBOX",
        isActive: true,
        attachmentFilter: "pdf-only",
        folderRules: {
          watchedFolders: GMAIL_DEFAULT_WATCHED_LABELS,
          excludedFolders: GMAIL_EXCLUDED_LABELS,
          honorDefaultExclusions: true,
        },
        senderFilter: DEFAULT_SENDER_FILTER,
      });
      accountId = created.id;
    }

    await saveGmailTokens({
      accountId,
      email: accountEmail,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
      scopes: tokens.scope.split(" "),
    });

    invalidateMailboxCounts(); // un nouveau compte → recompter les boîtes.

    const returnTo = (decoded.returnTo as string | undefined) || "/emails/comptes";
    const successUrl = new URL(returnTo, resolveAppOrigin(request));
    successUrl.searchParams.set("gmail", "connected");
    successUrl.searchParams.set("accountId", accountId);
    return NextResponse.redirect(successUrl);
  } catch (error) {
    return jsonError("Callback Gmail impossible", error);
  }
}

function redirectToError(message: string, request: NextRequest) {
  const url = new URL("/emails/connecter", resolveAppOrigin(request));
  url.searchParams.set("gmail_error", message);
  return NextResponse.redirect(url);
}
