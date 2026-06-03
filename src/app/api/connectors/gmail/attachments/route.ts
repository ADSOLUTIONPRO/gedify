import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { findAttachments, getGmailMessage } from "@/lib/connectors/gmail/gmail-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId");
    const messageId = request.nextUrl.searchParams.get("messageId");
    if (!accountId || !messageId) {
      return NextResponse.json({ error: "accountId et messageId requis." }, { status: 400 });
    }
    const message = await getGmailMessage(accountId, messageId);
    const attachments = findAttachments(message);
    return NextResponse.json({
      attachments: attachments.map((entry) => ({
        filename: entry.filename,
        mimeType: entry.mimeType,
        size: entry.size,
        inline: entry.inline,
      })),
    });
  } catch (error) {
    return jsonError("Impossible de lister les pièces jointes", error);
  }
}
