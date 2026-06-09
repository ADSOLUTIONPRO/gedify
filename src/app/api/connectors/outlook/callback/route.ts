import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  emailFromIdToken,
  exchangeCodeForTokens,
  getOutlookOAuthConfig,
  verifyState,
} from "@/lib/connectors/outlook/oauth";
import {
  isOutlookStoreSecure,
  saveOutlookTokens,
} from "@/lib/connectors/outlook/outlook-token-store";
import { invalidateMailboxCounts } from "@/lib/messaging/mailbox-counts";
import { createAccount, listAccounts, updateAccount } from "@/lib/mail-connector/account-store";
import { DEFAULT_SENDER_FILTER } from "@/lib/mail-connector/mail-filter-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Origine joignable côté navigateur (cf. connecteur Gmail) : on privilégie
 *  l'en-tête Host réel et on réécrit 0.0.0.0/:: en localhost. */
function resolveAppOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "http";
  let origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  origin = origin.replace(/:\/\/(0\.0\.0\.0|\[::\]|::)(:|\/|$)/, "://localhost$2");
  return origin;
}

export async function GET(request: NextRequest) {
  try {
    const config = getOutlookOAuthConfig();
    if (!config) return redirectToError("OAuth Microsoft non configuré.", request);

    const errorParam = request.nextUrl.searchParams.get("error");
    if (errorParam) {
      const desc = request.nextUrl.searchParams.get("error_description");
      return redirectToError(`OAuth refusé : ${desc ?? errorParam}`, request);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code || !state) return redirectToError("Paramètres OAuth manquants.", request);

    const decoded = verifyState(config.stateSecret, state);
    if (!decoded) return redirectToError("State CSRF invalide ou expiré.", request);

    if (!isOutlookStoreSecure()) {
      return redirectToError(
        "Stockage sécurisé manquant : définissez CONNECTOR_SECRET_KEY (16+ caractères) avant de connecter Outlook.",
        request,
      );
    }

    const tokens = await exchangeCodeForTokens(config, code);
    if (!tokens.refresh_token) {
      return redirectToError(
        "Microsoft n'a pas renvoyé de refresh_token. Vérifiez que la portée « offline_access » est autorisée puis relancez.",
        request,
      );
    }
    const accountEmail = emailFromIdToken(tokens.id_token) ?? "compte outlook";

    const passedAccountId = (decoded.accountId as string | null | undefined) ?? null;
    let accountId = passedAccountId;

    // Reconnexion d'une boîte déjà présente (même email) → on la réutilise.
    if (!accountId) {
      const existing = (await listAccounts()).find(
        (a) => (a.email ?? "").toLowerCase() === accountEmail.toLowerCase(),
      );
      if (existing) accountId = existing.id;
    }

    if (accountId) {
      await updateAccount(accountId, {
        authType: "oauth-outlook",
        connector: "imap",
        provider: "outlook",
        email: accountEmail,
        username: accountEmail,
        imapHost: "outlook.office365.com",
        imapPort: 993,
        encryption: "tls",
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        smtpEncryption: "starttls",
        smtpUsername: accountEmail,
        isActive: true,
      });
    } else {
      const created = await createAccount({
        name: `Outlook · ${accountEmail}`,
        email: accountEmail,
        provider: "outlook",
        authType: "oauth-outlook",
        connector: "imap",
        imapHost: "outlook.office365.com",
        imapPort: 993,
        encryption: "tls",
        username: accountEmail,
        smtpHost: "smtp.office365.com",
        smtpPort: 587,
        smtpEncryption: "starttls",
        smtpUsername: accountEmail,
        watchedFolder: "INBOX",
        isActive: true,
        attachmentFilter: "pdf-only",
        senderFilter: DEFAULT_SENDER_FILTER,
      });
      accountId = created.id;
    }

    await saveOutlookTokens({
      accountId,
      email: accountEmail,
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      accessTokenExpiresAt: Date.now() + (tokens.expires_in - 60) * 1000,
      scopes: tokens.scope.split(" "),
    });

    invalidateMailboxCounts();

    // Relève initiale en arrière-plan (fire-and-forget).
    void import("@/lib/mail-connector/sync-mail-account")
      .then(({ syncMailAccount }) => syncMailAccount(accountId!))
      .catch(() => {});

    const returnTo = (decoded.returnTo as string | undefined) || "/messagerie/parametres-emails";
    const successUrl = new URL(returnTo, resolveAppOrigin(request));
    successUrl.searchParams.set("outlook", "connected");
    successUrl.searchParams.set("accountId", accountId);
    return NextResponse.redirect(successUrl);
  } catch (error) {
    return jsonError("Callback Microsoft impossible", error);
  }
}

function redirectToError(message: string, request: NextRequest) {
  const url = new URL("/messagerie/parametres-emails", resolveAppOrigin(request));
  url.searchParams.set("outlook_error", message);
  return NextResponse.redirect(url);
}
