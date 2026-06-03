import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { getGmailThread } from "@/lib/connectors/gmail/gmail-api";
import { normaliseGmailMessage } from "@/lib/messaging/gmail-normalize";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import { analyzeEmail } from "@/lib/ai/analyze-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Gmail connecté." },
        { status: 412 },
      );
    }

    const { id } = await params;
    const thread = await getGmailThread(account.accountId, id, "full");
    const messages = (thread.messages ?? []).map((message) =>
      normaliseGmailMessage(message, {
        accountId: account.accountId,
        accountEmail: account.email,
      }),
    );

    // Analyse IA sur le message le plus récent (sera étendu en phase 4).
    const latest = [...messages].sort((a, b) =>
      (a.date ?? "") < (b.date ?? "") ? 1 : -1,
    )[0];
    const analysis = latest ? analyzeEmail(latest) : null;

    const links = await listEmailLinks({ scope: "thread", emailId: id });

    return NextResponse.json({
      accountId: account.accountId,
      accountEmail: account.email,
      thread: {
        id: thread.id,
        snippet: thread.snippet,
        messageCount: messages.length,
      },
      messages,
      analysis,
      links,
    });
  } catch (error) {
    return jsonError("Lecture du thread Gmail impossible", error);
  }
}
