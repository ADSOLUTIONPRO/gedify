import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getGmailThread, modifyGmailThread, trashGmailThread } from "@/lib/connectors/gmail/gmail-api";
import { normaliseGmailMessage } from "@/lib/messaging/gmail-normalize";
import { resolveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { listEmailLinks } from "@/lib/messaging/email-ged-link-store";
import { analyzeEmail } from "@/lib/ai/analyze-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Multi-comptes : l'id du thread appartient au compte passé en `accountId`.
    const account = await resolveGmailAccount(request.nextUrl.searchParams.get("accountId"));
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

type ThreadAction = "archive" | "trash" | "markRead" | "markUnread";

/** POST /api/messaging/gmail/threads/:id — action sur un fil (archiver, corbeille, lu/non lu). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const { id } = await params;
    const { action, accountId } = (await request.json().catch(() => ({}))) as { action?: ThreadAction; accountId?: string };
    const account = await resolveGmailAccount(accountId ?? null);
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Gmail connecté." },
        { status: 412 },
      );
    }
    switch (action) {
      case "archive":
        await modifyGmailThread(account.accountId, id, { removeLabelIds: ["INBOX"] });
        break;
      case "trash":
        await trashGmailThread(account.accountId, id);
        break;
      case "markRead":
        await modifyGmailThread(account.accountId, id, { removeLabelIds: ["UNREAD"] });
        break;
      case "markUnread":
        await modifyGmailThread(account.accountId, id, { addLabelIds: ["UNREAD"] });
        break;
      default:
        return NextResponse.json({ error: "invalid_action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError("Action sur le fil Gmail impossible", error);
  }
}
