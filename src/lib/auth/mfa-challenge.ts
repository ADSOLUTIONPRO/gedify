import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/* Jeton court (5 min) émis APRÈS le mot de passe et AVANT la validation TOTP.
   Ce n'est PAS une session : il n'autorise que /api/auth/mfa/verify. */

const COOKIE = process.env.MFA_COOKIE_NAME ?? "gedazserver.mfa";
const MAX_AGE = 300; // 5 minutes

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant.");
  return new TextEncoder().encode(s);
}
function cookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

export async function signMfaChallenge(username: string, userId: number): Promise<string> {
  return new SignJWT({ username, uid: userId, mfa: "pending" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
}

export async function readMfaChallenge(): Promise<{ username: string; userId: number } | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.mfa !== "pending" || typeof payload.username !== "string" || typeof payload.uid !== "number") return null;
    return { username: payload.username, userId: payload.uid };
  } catch {
    return null;
  }
}

export function mfaCookieOpts(token: string) {
  return { name: COOKIE, value: token, httpOnly: true, secure: cookieSecure(), sameSite: "lax" as const, path: "/", maxAge: MAX_AGE } as const;
}
export function clearMfaCookieOpts() {
  return { name: COOKIE, value: "", httpOnly: true, secure: cookieSecure(), sameSite: "lax" as const, path: "/", maxAge: 0 } as const;
}
