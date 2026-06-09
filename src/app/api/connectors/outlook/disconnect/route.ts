import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { recordAudit } from "@/lib/audit/audit-store";
import { deleteOutlookTokens } from "@/lib/connectors/outlook/outlook-token-store";
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
    // Pas de point de révocation OAuth côté Microsoft : on supprime simplement
    // les tokens stockés (l'utilisateur peut retirer l'accès depuis son compte
    // Microsoft : https://account.live.com/consent/Manage).
    await deleteOutlookTokens(body.accountId);
    if (body.deleteAccount) {
      await deleteAccount(body.accountId);
    } else {
      await updateAccount(body.accountId, { isActive: false });
    }
    invalidateMailboxCounts();
    await recordAudit({
      action: "mail.account.disconnect",
      target: `#${body.accountId}`,
      details: body.deleteAccount ? "compte Outlook supprimé + tokens effacés" : "Outlook désactivé + tokens effacés",
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Déconnexion Microsoft impossible", error);
  }
}
