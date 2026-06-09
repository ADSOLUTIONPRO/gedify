import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { pullGoogleEvents } from "@/lib/calendar/google-sync";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { pullOutlookEvents } from "@/lib/connectors/outlook/sync-outlook-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/sync — importe les événements Google ET Microsoft (PULL)
 * des comptes connectés dans le socle, fenêtre [-30 j, +120 j]. Idempotent
 * (upsert par provider/externalId). 409 si le scope Calendar Google manque.
 */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const userId = user ? String(user.id) : "local";
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date(Date.now() + 120 * 86400000).toISOString();

    const googleAccount = await getActiveGmailAccount();
    const outlookAccounts = (await listAccounts()).filter((a) => a.authType === "oauth-outlook" && a.isActive);
    if (!googleAccount && outlookAccounts.length === 0) {
      return NextResponse.json({ error: "no_account", message: "Aucun compte Google ou Microsoft connecté." }, { status: 400 });
    }

    const report = googleAccount ? await pullGoogleEvents(userId, googleAccount.accountId, { from, to }) : null;
    const outlookReports = [] as { accountId: string; imported: number; updated: number; errors: string[] }[];
    for (const acc of outlookAccounts) {
      const r = await pullOutlookEvents(userId, acc.id, { from, to });
      outlookReports.push({ accountId: acc.id, ...r });
    }
    return NextResponse.json({ ok: true, report, outlookReports });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CALENDAR_SCOPE_MISSING")) {
      return NextResponse.json(
        { error: "scope_missing", message: "L'accès Google Calendar n'est pas autorisé. Reconnectez votre compte Google avec le scope Agenda activé." },
        { status: 409 },
      );
    }
    return jsonError("Synchronisation Google impossible.", error);
  }
}
