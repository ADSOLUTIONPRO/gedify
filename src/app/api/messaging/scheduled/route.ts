import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { createScheduledEmail, listScheduledEmails } from "@/lib/messaging/scheduled-email-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json({ items: await listScheduledEmails() });
  } catch (error) {
    return jsonError("Liste des envois programmés impossible", error);
  }
}

type Body = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  bodyHtml: string;
  scheduledAt: string;
  threadId?: string;
  inReplyTo?: string;
  draftId?: string;
};

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  if (!body.to || !body.subject || !body.scheduledAt) {
    return NextResponse.json({ error: "to, subject et scheduledAt requis." }, { status: 400 });
  }
  const when = new Date(body.scheduledAt);
  if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: "Date de programmation invalide ou déjà passée." }, { status: 400 });
  }

  const account = await getActiveGmailAccount();

  try {
    const item = await createScheduledEmail({
      gmailAccountId: account?.accountId ?? null,
      to: body.to,
      cc: body.cc ?? null,
      bcc: body.bcc ?? null,
      subject: body.subject,
      bodyHtml: body.bodyHtml ?? "",
      threadId: body.threadId ?? null,
      inReplyTo: body.inReplyTo ?? null,
      draftId: body.draftId ?? null,
      scheduledAt: when.toISOString(),
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return jsonError("Programmation de l'envoi impossible", error);
  }
}
