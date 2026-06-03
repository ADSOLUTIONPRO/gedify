import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { extractHeader, getGmailMessage, listGmailMessages } from "@/lib/connectors/gmail/gmail-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accountId = request.nextUrl.searchParams.get("accountId");
    if (!accountId) {
      return NextResponse.json({ error: "accountId requis." }, { status: 400 });
    }
    const q = request.nextUrl.searchParams.get("q") ?? "has:attachment newer_than:7d -in:spam -in:trash";
    const maxRaw = request.nextUrl.searchParams.get("max");
    const max = maxRaw ? Math.min(100, Math.max(1, Number.parseInt(maxRaw, 10))) : 20;
    const list = await listGmailMessages(accountId, q, max);
    const previews = await Promise.all(
      list.messages.slice(0, max).map(async (entry) => {
        try {
          const message = await getGmailMessage(accountId, entry.id);
          return {
            id: message.id,
            labelIds: message.labelIds ?? [],
            snippet: message.snippet ?? "",
            from: extractHeader(message, "From"),
            subject: extractHeader(message, "Subject"),
            date: extractHeader(message, "Date"),
          };
        } catch (error) {
          return {
            id: entry.id,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );
    return NextResponse.json({ messages: previews });
  } catch (error) {
    return jsonError("Impossible de lister les messages Gmail", error);
  }
}
