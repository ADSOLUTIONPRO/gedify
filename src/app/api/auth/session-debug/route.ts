import "server-only";

import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session-debug
 *
 * Diagnostic d'authentification — ne jamais exposer en production sans auth.
 * Aide à comprendre pourquoi requireAuth() ou le middleware échoue.
 * Ne logue jamais le token JWT ni l'AUTH_SECRET.
 */
export async function GET(req: NextRequest) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "gedazserver.session";

  // Méthode 1 : readSession() via next/headers (App Router)
  const session = await readSession();

  // Méthode 2 : req.cookies de NextRequest (middleware-style)
  const tokenFromReq = req.cookies.get(cookieName)?.value;

  // Méthode 3 : cookies() directement pour lister tous les cookies reçus
  const allCookies = (await cookies()).getAll();
  const cookieNames = allCookies.map((c) => c.name);
  const hasSessionCookieInStore = cookieNames.includes(cookieName);

  return NextResponse.json({
    authenticated: session !== null,
    hasCookie: session !== null,
    cookieName,
    username: session?.username ?? null,

    // Diagnostic approfondi
    debug: {
      readSessionOk: session !== null,
      tokenFoundInReqCookies: Boolean(tokenFromReq),
      tokenFoundInNextHeadersCookies: hasSessionCookieInStore,
      allCookieNames: cookieNames,
      sessionMaxAgeSec: Number(process.env.SESSION_MAX_AGE_SECONDS ?? 28800),
      authSecretSet: Boolean(process.env.AUTH_SECRET),
      nodeEnv: process.env.NODE_ENV,
    },
  });
}
