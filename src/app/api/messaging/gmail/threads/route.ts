import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import {
  getGmailThread,
  listGmailThreads,
} from "@/lib/connectors/gmail/gmail-api";
import { normaliseGmailThread } from "@/lib/messaging/gmail-normalize";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json(
        { error: "no_account", message: "Aucun compte Gmail connecté." },
        { status: 412 },
      );
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "in:inbox";
    const maxResults = Math.min(
      Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30,
      100,
    );
    const pageToken = url.searchParams.get("pageToken") ?? undefined;

    const { threads, nextPageToken, resultSizeEstimate } = await listGmailThreads(
      account.accountId,
      query,
      maxResults,
      pageToken,
    );

    // Pour chaque thread, on charge la version `metadata` (légère) afin
    // d'extraire sujet, snippet, participants, labels et compteurs.
    const enriched = await Promise.all(
      threads.map(async (ref) => {
        try {
          const full = await getGmailThread(account.accountId, ref.id, "metadata");
          return normaliseGmailThread(full, {
            accountId: account.accountId,
            accountEmail: account.email,
          });
        } catch {
          return null;
        }
      }),
    );

    return NextResponse.json({
      accountId: account.accountId,
      accountEmail: account.email,
      threads: enriched.filter((t) => t !== null),
      nextPageToken,
      resultSizeEstimate,
    });
  } catch (error) {
    return jsonError("Lecture des threads Gmail impossible", error);
  }
}
