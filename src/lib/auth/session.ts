import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "gedazserver.session";
const MAX_AGE_SEC = Number(process.env.SESSION_MAX_AGE_SECONDS ?? 28800); // 8 h

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET manquant dans .env");
  return new TextEncoder().encode(s);
}

/**
 * Le cookie de session doit-il porter l'attribut `Secure` ?
 * Par défaut `true` en production (HTTPS attendu). Mais un déploiement servi en
 * HTTP simple (ex. domaine sslip.io sans certificat) doit pouvoir le désactiver,
 * sinon le navigateur jette le cookie et la connexion boucle sur /login.
 *   COOKIE_SECURE=false → jamais Secure (HTTP autorisé)
 *   COOKIE_SECURE=true  → toujours Secure
 *   (absent)            → Secure uniquement en production.
 */
function cookieSecure(): boolean {
  const v = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (v === "false" || v === "0") return false;
  if (v === "true" || v === "1") return true;
  return process.env.NODE_ENV === "production";
}

/** L'identité GED = l'identifiant (username) Paperless authentifié. */
export type SessionData = { username: string };

export async function signSession(data: SessionData): Promise<string> {
  return new SignJWT(data as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(secret());
}

/** Lit la session depuis le cookie (composants serveur / API routes). */
export async function readSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.username !== "string") return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}

export function cookieOpts(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  } as const;
}

export function clearCookieOpts() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  } as const;
}
