import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { recordAudit } from "@/lib/audit/audit-store";
import {
  deleteGmailTokens,
  getGmailRefreshToken,
} from "@/lib/connectors/gmail/gmail-token-store";
import { revokeRefreshToken } from "@/lib/connectors/gmail/oauth";
import { deleteAccount, updateAccount } from "@/lib/mail-connector/account-store";
import { invalidateMailboxCounts } from "@/lib/messaging/mailbox-counts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { accountId: string; deleteAccount?: boolean };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    if (!body.accountId) {
      return NextResponse.json({ error: "accountId requis." }, { status: 400 });
    }
    const stored = await getGmailRefreshToken(body.accountId);
    if (stored) {
      try {
        await revokeRefreshToken(stored.refreshToken);
      } catch {
        // best effort
      }
    }
    await deleteGmailTokens(body.accountId);
    if (body.deleteAccount) {
      await deleteAccount(body.accountId);
    } else {
      await updateAccount(body.accountId, { isActive: false });
    }
    invalidateMailboxCounts(); // boîte retirée/désactivée → recompter.
    await recordAudit({
      action: "mail.account.disconnect",
      target: `#${body.accountId}`,
      details: body.deleteAccount ? "compte supprimé + token révoqué" : "désactivé + token révoqué",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Déconnexion Gmail impossible", error);
  }
}
