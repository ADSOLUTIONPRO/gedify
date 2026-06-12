import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { confirmEnable } from "@/lib/saas/mfa/mfa-store";
import { logSecurityEvent } from "@/lib/saas/security/security-events";
import { recordAudit } from "@/lib/audit/audit-store";

export const runtime = "nodejs";

/** Confirme l'activation MFA (code TOTP) et renvoie les codes de secours (1 fois). */
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  try {
    const backupCodes = await confirmEnable(me.id, (body.code ?? "").trim());
    await logSecurityEvent({ eventType: "mfa_enabled", category: "auth", severity: "info", userId: me.id, message: `MFA activée : « ${me.username} »` });
    await recordAudit({ action: "mfa_enabled", target: me.username, user: me.username });
    return NextResponse.json({ ok: true, backupCodes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 400 });
  }
}
