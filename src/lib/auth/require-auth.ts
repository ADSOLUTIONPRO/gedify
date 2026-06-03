import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "gedazserver.session";

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

/**
 * Guard pour routes API : retourne NextResponse 401 si non authentifié, sinon null.
 *
 * Ordre de lecture :
 *   1. req.cookies (NextRequest) — le plus fiable dans tous les runtimes Next.js
 *   2. cookies() de next/headers — fallback
 *
 * Toujours passer `request` pour activer la méthode 1.
 */
export async function requireAuth(req?: NextRequest): Promise<NextResponse | null> {
  // Mode bureau LOCAL (runtime macOS embarqué) : auth désactivée. Jamais en ligne.
  if (process.env.GEDIFY_LOCAL_NO_AUTH === "1") return null;

  // Méthode 1 (prioritaire) : req.cookies
  if (req) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        await jwtVerify(token, secret());
        return null;
      } catch {
        // Token invalide
      }
    }
  }

  // Méthode 2 : cookies() de next/headers
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (token) {
      await jwtVerify(token, secret());
      return null;
    }
  } catch {
    // cookies() indisponible ou token invalide
  }

  return NextResponse.json(
    {
      error: "Non authentifié",
      errorType: "ged_auth",
      message: "Session GED expirée ou absente. Reconnectez-vous via /login.",
    },
    { status: 401 },
  );
}
