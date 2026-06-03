import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { syncAllMailAccounts } from "@/lib/mail-connector/sync-all-mail-accounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Worker endpoint: synchronize ALL active accounts.
 *
 * Protected by MAIL_CONNECTOR_SYNC_SECRET (required via `Authorization: Bearer <secret>`
 * or `?secret=<secret>`). If the env var is unset, this endpoint refuses to run to
 * avoid being exposed publicly without protection.
 *
 * TODO: wire this to a Coolify cron / scheduled task.
 */
export async function POST(request: NextRequest) {
  try {
    const expected = process.env.MAIL_CONNECTOR_SYNC_SECRET;
    if (!expected) {
      return NextResponse.json(
        {
          error: "MAIL_CONNECTOR_SYNC_SECRET non configuré. Endpoint désactivé pour éviter une exposition publique.",
        },
        { status: 503 },
      );
    }

    const authHeader = request.headers.get("authorization") ?? "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const querySecret = request.nextUrl.searchParams.get("secret") ?? "";
    const provided = bearer || querySecret;

    if (provided !== expected) {
      return NextResponse.json({ error: "Secret invalide." }, { status: 401 });
    }

    const outcome = await syncAllMailAccounts();
    return NextResponse.json(outcome);
  } catch (error) {
    return jsonError("Impossible de synchroniser les comptes", error);
  }
}
