import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listCalDavAccounts } from "@/lib/connectors/caldav/caldav-credentials-store";
import { pullCalDav, type CalDavSyncReport } from "@/lib/calendar/caldav-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/caldav/sync — importe (PULL) les événements iCloud du
 * compte indiqué (ou de tous), sur [-30 j, +120 j]. Idempotent (upsert).
 */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const userId = user ? String(user.id) : "local";
    const body = (await req.json().catch(() => ({}))) as { accountId?: string };
    const accounts = await listCalDavAccounts();
    const targets = body.accountId ? accounts.filter((a) => a.id === body.accountId) : accounts;
    if (targets.length === 0) {
      return NextResponse.json({ error: "no_account", message: "Aucun compte iCloud connecté." }, { status: 400 });
    }
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date(Date.now() + 120 * 86400000).toISOString();
    const reports: Record<string, CalDavSyncReport> = {};
    for (const a of targets) {
      reports[a.id] = await pullCalDav(userId, a.id, { from, to });
    }
    return NextResponse.json({ ok: true, reports });
  } catch (error) {
    return jsonError("Synchronisation iCloud impossible.", error);
  }
}
