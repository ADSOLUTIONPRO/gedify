import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  buildAuthorizationUrl,
  getOutlookOAuthConfig,
  signState,
} from "@/lib/connectors/outlook/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const config = getOutlookOAuthConfig();
    if (!config) {
      return NextResponse.json(
        {
          error: "OAuth Microsoft non configuré",
          message:
            "Définissez MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI et MICROSOFT_OAUTH_STATE_SECRET (ou CONNECTOR_SECRET_KEY).",
        },
        { status: 503 },
      );
    }
    const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/messagerie/parametres-emails";
    const accountId = request.nextUrl.searchParams.get("accountId") ?? null;
    const { signed } = signState(config.stateSecret, { returnTo, accountId });
    const url = buildAuthorizationUrl(config, signed);
    return NextResponse.redirect(url);
  } catch (error) {
    return jsonError("Démarrage OAuth Microsoft impossible", error);
  }
}
