import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getOutlookOAuthConfig } from "@/lib/connectors/outlook/oauth";
import {
  getOutlookRecordPublic,
  isOutlookStoreSecure,
} from "@/lib/connectors/outlook/outlook-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const config = getOutlookOAuthConfig();
    const configured = Boolean(config);
    const secureStorage = isOutlookStoreSecure();

    if (!accountId) {
      return NextResponse.json({
        configured,
        secureStorage,
        scopes: config?.scopes ?? [],
        redirectUri: config?.redirectUri ?? null,
      });
    }

    const record = await getOutlookRecordPublic(accountId);
    return NextResponse.json({ configured, secureStorage, account: record });
  } catch (error) {
    return jsonError("Impossible de récupérer le statut Microsoft", error);
  }
}
