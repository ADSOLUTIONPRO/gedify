import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { disableMfa } from "@/lib/saas/mfa/mfa-store";
import { logSecurityEvent } from "@/lib/saas/security/security-events";
import { recordAudit } from "@/lib/audit/audit-store";

export const runtime = "nodejs";

/** Désactive la MFA (exige un code valide). Refusé aux superusers en production. */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  // En production, un superuser ne peut pas se retrouver sans MFA.
  if (me.is_superuser && process.env.APP_ENV?.trim().toLowerCase() === "production") {
    return NextResponse.json({ error: "La MFA est obligatoire pour les administrateurs plateforme en production." }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  try {
    await disableMfa(me.id, (body.code ?? "").trim());
    await logSecurityEvent({ eventType: "mfa_disabled", category: "auth", severity: "warning", userId: me.id, message: `MFA désactivée : « ${me.username} »` });
    await recordAudit({ action: "mfa_disabled", target: me.username, user: me.username });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 400 });
  }
}
