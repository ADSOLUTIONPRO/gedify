import { type NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { requireAuth } from "@/lib/auth/require-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getActiveGmailAccount } from "@/lib/messaging/active-gmail-account";
import { pullGoogleEvents } from "@/lib/calendar/google-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/calendar/sync — importe les événements Google (PULL) du compte
 * actif dans le socle, sur une fenêtre [-30 j, +120 j]. Idempotent (upsert).
 * Renvoie 409 avec un message clair si le scope Calendar manque.
 */
export async function POST(req: NextRequest) {
  const deny = await requireAuth(req);
  if (deny) return deny;
  try {
    const user = await getCurrentUser();
    const userId = user ? String(user.id) : "local";
    const account = await getActiveGmailAccount();
    if (!account) {
      return NextResponse.json({ error: "no_account", message: "Aucun compte Google connecté." }, { status: 400 });
    }
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date(Date.now() + 120 * 86400000).toISOString();
    const report = await pullGoogleEvents(userId, account.accountId, { from, to });
    return NextResponse.json({ ok: true, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("CALENDAR_SCOPE_MISSING")) {
      return NextResponse.json(
        { error: "scope_missing", message: "L'accès Google Calendar n'est pas autorisé. Reconnectez votre compte Google avec le scope Agenda activé." },
        { status: 409 },
      );
    }
    return jsonError("Synchronisation Google impossible.", error);
  }
}
