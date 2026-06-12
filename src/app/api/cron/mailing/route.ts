import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api-utils";
import { processMailQueue } from "@/lib/saas/mailing/queue";
import { runPaymentReminders } from "@/lib/saas/mailing/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Déclencheur planifié du mailing SaaS. À appeler par un planificateur externe
 * avec le secret `CRON_SECRET` :
 *   GET /api/cron/mailing?key=SECRET
 *   ou header `Authorization: Bearer SECRET`.
 *
 * Étapes : (1) génère les relances de paiement dues, (2) traite la file d'envoi.
 * N'envoie rien si EMAILS_ENABLED≠true (processMailQueue retourne disabled).
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  const key = request.nextUrl.searchParams.get("key");
  return header === `Bearer ${secret}` || key === secret;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  try {
    // Expire les invitations échues avant le reste.
    let expiredInvitations = 0;
    try {
      const { expireOldInvitations } = await import("@/lib/saas/invitations");
      expiredInvitations = await expireOldInvitations();
    } catch { /* best-effort */ }
    const reminders = await runPaymentReminders();
    const queue = await processMailQueue(100);
    return NextResponse.json({ expiredInvitations, reminders, queue });
  } catch (error) {
    return jsonError("Traitement du mailing planifié échoué", error);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
