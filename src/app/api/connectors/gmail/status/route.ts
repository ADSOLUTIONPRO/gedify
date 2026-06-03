import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import {
  getGmailRecordPublic,
  isGmailStoreSecure,
} from "@/lib/connectors/gmail/gmail-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const config = getGmailOAuthConfig();
    const configured = Boolean(config);
    const secureStorage = isGmailStoreSecure();

    if (!accountId) {
      return NextResponse.json({
        configured,
        secureStorage,
        scopes: config?.scopes ?? [],
        redirectUri: config?.redirectUri ?? null,
      });
    }

    const record = await getGmailRecordPublic(accountId);
    return NextResponse.json({
      configured,
      secureStorage,
      account: record,
    });
  } catch (error) {
    return jsonError("Impossible de récupérer le statut Gmail", error);
  }
}
