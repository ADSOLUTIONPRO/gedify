import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGmailOAuthConfig } from "@/lib/connectors/gmail/oauth";
import { listGmailAccounts } from "@/lib/connectors/gmail/gmail-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const config = getGmailOAuthConfig();
    const accounts = await listGmailAccounts();
    return NextResponse.json({
      oauthConfigured: Boolean(config),
      connectedAccounts: accounts.length,
      accounts: accounts.map((account) => ({
        accountId: account.accountId,
        email: account.email,
        scopes: account.scopes,
        connectedAt: account.connectedAt,
      })),
    });
  } catch (error) {
    return jsonError("Statut messagerie indisponible", error);
  }
}
