import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  buildAuthorizationUrl,
  createPkce,
  encryptVerifier,
  getOutlookOAuthConfig,
  isOutlookRelayMode,
  signState,
} from "@/lib/connectors/outlook/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Origine publique de CETTE instance : `GEDIFY_PUBLIC_URL` en priorité (canonique
 *  derrière un reverse proxy), sinon l'en-tête Host réel. Sert à indiquer au relais
 *  où renvoyer le code. */
function resolveAppOrigin(request: NextRequest): string {
  const pub = process.env.GEDIFY_PUBLIC_URL?.replace(/\/+$/, "");
  if (pub) return pub;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "") ?? "http";
  let origin = host ? `${proto}://${host}` : request.nextUrl.origin;
  origin = origin.replace(/:\/\/(0\.0\.0\.0|\[::\]|::)(:|\/|$)/, "://localhost$2");
  return origin;
}

export async function GET(request: NextRequest) {
  try {
    const config = getOutlookOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          error: "OAuth Microsoft non configuré",
          message:
            "Définissez MICROSOFT_CLIENT_ID + MICROSOFT_OAUTH_STATE_SECRET (ou CONNECTOR_SECRET_KEY) et soit MICROSOFT_RELAY_URL (multi-tenant), soit MICROSOFT_REDIRECT_URI + MICROSOFT_CLIENT_SECRET (direct).",
        },
        { status: 503 },
      );
    }
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/messagerie/parametres-emails";
    const accountId = request.nextUrl.searchParams.get("accountId") ?? null;

    // PKCE : le vérifieur (secret) est chiffré et transporté dans le state.
    const { verifier, challenge } = createPkce();
    const pkce = encryptVerifier(verifier, config.stateSecret);
    // En mode relais, on indique au relais le callback de CETTE instance.
    const instanceCallback = isOutlookRelayMode(config)
      ? `${resolveAppOrigin(request)}/api/connectors/outlook/callback`
      : null;

    const { signed } = signState(config.stateSecret, { returnTo, accountId, pkce, instanceCallback });
    const url = buildAuthorizationUrl(config, signed, { codeChallenge: challenge });
    return NextResponse.redirect(url);
  } catch (error) {
    return jsonError("Démarrage OAuth Microsoft impossible", error);
  }
}
