import "server-only";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { startEnrollment } from "@/lib/saas/mfa/mfa-store";

export const runtime = "nodejs";

/** Démarre l'enrôlement MFA de l'utilisateur courant : renvoie le QR + le secret. */
export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  try {
    const label = me.email || me.username;
    const { otpauth, qrSvg, secret } = await startEnrollment(me.id, label);
    return NextResponse.json({ otpauth, qrSvg, secret });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erreur." }, { status: 400 });
  }
}
