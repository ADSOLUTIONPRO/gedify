import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { regenerateBackupCodes } from "@/lib/saas/mfa/mfa-store";
import { recordAudit } from "@/lib/audit/audit-store";

export const runtime = "nodejs";

/** Régénère les codes de secours (invalide les anciens). MFA active requise. */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const backupCodes = await regenerateBackupCodes(me.id);
    await recordAudit({ action: "mfa_backup_codes_regenerated", target: me.username, user: me.username });
    return NextResponse.json({ ok: true, backupCodes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 400 });
  }
}
