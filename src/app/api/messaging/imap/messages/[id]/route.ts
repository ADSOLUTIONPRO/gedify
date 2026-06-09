import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { getEmailMessageById } from "@/lib/messaging/email-message-store";
import { listAccounts } from "@/lib/mail-connector/account-store";
import { firstAddress, parseAddressList } from "@/lib/messaging/gmail-normalize";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import type { EmailMessageRecord } from "@/lib/messaging/email-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Lecture seule d'un message IMAP indexé (inbox unifiée). Le contenu provient de
 * l'index local (email-message-store) alimenté par la synchro — pas d'appel IMAP
 * live ici. Renvoie une forme compatible avec le volet de lecture (ThreadDetail).
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const rec = await getEmailMessageById(id);
    if (!rec) return NextResponse.json({ error: "Message introuvable." }, { status: 404 });

    const accountEmail = (await listAccounts()).find((a) => a.id === rec.accountId)?.email ?? "";
    const message: EmailMessageRecord = {
      id: rec.id,
      threadId: rec.id,
      accountId: rec.accountId,
      accountEmail,
      date: rec.date,
      snippet: (rec.text ?? "").slice(0, 200),
      subject: rec.subject,
      from: firstAddress(rec.from),
      to: parseAddressList(rec.to),
      cc: [],
      bcc: [],
      labelIds: [],
      attachments: [],
      unread: false,
      important: false,
      bodyText: rec.text ?? "",
      bodyHtml: null,
    };

    const links = await listEmailLinks({ scope: "thread", emailId: rec.id }).catch(() => []);

    return NextResponse.json({
      accountId: rec.accountId,
      accountEmail,
      provider: "imap",
      thread: { id: rec.id, snippet: message.snippet, messageCount: 1 },
      messages: [message],
      analysis: null,
      links,
    });
  } catch (error) {
    return jsonError("Lecture du message IMAP impossible", error);
  }
}
