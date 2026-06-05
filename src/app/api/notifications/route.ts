import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { jsonError } from "@/lib/api-utils";
import { listNotifications, markAllNotificationsRead, clearAllNotifications } from "@/lib/notifications/notifications";

/* Notifications agrégées (rappels échus, jobs en erreur, actions notables).
   GET : liste + compteur non lus. POST { action: "read" | "clear" }. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    return NextResponse.json(await listNotifications());
  } catch (error) {
    return jsonError("Impossible de charger les notifications", error);
  }
}

export async function POST(request: NextRequest) {
  const deny = await requireAuth(request);
  if (deny) return deny;
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string };
    if (body.action === "read") await markAllNotificationsRead();
    else if (body.action === "clear") await clearAllNotifications();
    else return NextResponse.json({ error: "action invalide (read|clear)" }, { status: 400 });
    return NextResponse.json(await listNotifications());
  } catch (error) {
    return jsonError("Action notifications impossible", error);
  }
}
