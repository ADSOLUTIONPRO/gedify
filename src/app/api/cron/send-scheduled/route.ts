import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { listDueScheduledEmails, markScheduledEmail } from "@/lib/messaging/scheduled-email-store";
import { sendGmailMessage, deleteGmailDraft } from "@/lib/connectors/gmail/gmail-api";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Déclencheur des envois programmés. À appeler par un planificateur externe
 * (cron système, Vercel Cron, GitHub Action) avec le secret `CRON_SECRET` :
 *   GET /api/cron/send-scheduled?key=SECRET
 *   ou header `Authorization: Bearer SECRET`.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // tant que non configuré, on refuse
  const header = request.headers.get("authorization");
  const key = request.nextUrl.searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}

async function run() {
  const due = await listDueScheduledEmails(new Date().toISOString());
  let sent = 0;
  let failed = 0;
  for (const email of due) {
    try {
      const accountId = email.gmailAccountId ?? (await getActiveGmailAccount())?.accountId;
      if (!accountId) throw new Error("Aucun compte Gmail connecté.");
      await sendGmailMessage(accountId, email.to, email.subject, email.bodyHtml, {
        threadId: email.threadId ?? undefined,
        inReplyTo: email.inReplyTo ?? undefined,
        cc: email.cc ?? undefined,
        bcc: email.bcc ?? undefined,
        html: true,
      });
      if (email.draftId) await deleteGmailDraft(accountId, email.draftId).catch(() => {});
      await markScheduledEmail(email.id, { status: "sent", sentAt: new Date().toISOString(), errorMessage: null });
      sent += 1;
    } catch (error) {
      await markScheduledEmail(email.id, { status: "failed", errorMessage: error instanceof Error ? error.message : String(error) });
      failed += 1;
    }
  }
  return { processed: due.length, sent, failed };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    return NextResponse.json(await run());
  } catch (error) {
    return jsonError("Traitement des envois programmés échoué", error);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
