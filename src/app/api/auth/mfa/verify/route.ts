import "server-only";

import { type NextRequest, NextResponse } from "next/server";
import { signSession, cookieOpts } from "@/lib/auth/session";
import { readMfaChallenge, clearMfaCookieOpts } from "@/lib/auth/mfa-challenge";
import { verifyMfaCode } from "@/lib/saas/mfa/mfa-store";
import { logSecurityEvent } from "@/lib/saas/security/security-events";

export const runtime = "nodejs";

function reqMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null;
  return { ipAddress: ip, userAgent: req.headers.get("user-agent") };
}

/** Étape 2 de la connexion : valide le code MFA puis ouvre la session. */
export async function POST(req: NextRequest) {
  const challenge = await readMfaChallenge();
  if (!challenge) return NextResponse.json({ error: "Session de vérification expirée. Reconnectez-vous." }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = (body.code ?? "").trim();
  if (!code) return NextResponse.json({ error: "Code requis." }, { status: 400 });

  const ok = await verifyMfaCode(challenge.userId, code).catch(() => false);
  if (!ok) {
    await logSecurityEvent({ eventType: "mfa_failed", category: "auth", severity: "warning", userId: challenge.userId, message: `Échec MFA pour « ${challenge.username} »`, ...reqMeta(req) });
    return NextResponse.json({ error: "Code incorrect." }, { status: 401 });
  }

  await logSecurityEvent({ eventType: "mfa_success", category: "auth", severity: "info", userId: challenge.userId, message: `MFA validée : « ${challenge.username} »`, ...reqMeta(req) });
  await logSecurityEvent({ eventType: "login_success", category: "auth", severity: "info", userId: challenge.userId, message: `Connexion réussie (MFA) : « ${challenge.username} »`, ...reqMeta(req) });

  const token = await signSession({ username: challenge.username });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieOpts(token));
  res.cookies.set(clearMfaCookieOpts());
  return res;
}
