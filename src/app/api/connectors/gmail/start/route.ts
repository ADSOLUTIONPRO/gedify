import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  buildAuthorizationUrl,
  getGmailOAuthConfig,
  signState,
} from "@/lib/connectors/gmail/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const config = getGmailOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          error: "OAuth Google non configuré",
          message:
            "Définissez GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI et GOOGLE_OAUTH_STATE_SECRET (ou CONNECTOR_SECRET_KEY).",
        },
        { status: 503 },
      );
    }
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/emails/comptes";
    const accountId = request.nextUrl.searchParams.get("accountId") ?? null;
    const { signed } = signState(config.stateSecret, { returnTo, accountId });
    const url = buildAuthorizationUrl(config, signed);
    return NextResponse.redirect(url);
  } catch (error) {
    return jsonError("Démarrage OAuth Gmail impossible", error);
  }
}
