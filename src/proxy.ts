import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ⚠️ Next.js 16 : ce fichier DOIT s'appeler `proxy.ts` (ex-`middleware.ts`,
// déprécié) et être placé au même niveau que `app/` — soit `src/proxy.ts`
// puisque l'app vit dans `src/app/`. Un fichier à la racine du projet est
// silencieusement ignoré et AUCUNE route n'est alors protégée.

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "gedazserver.session";

const AUTH_MESSAGE = "Vous devez vous connecter pour accéder à votre espace GED.";

/**
 * Routes accessibles sans session.
 * Tout le reste est protégé par défaut (voir `config.matcher`).
 */
const PUBLIC_PREFIXES = [
  "/login",
  // Première connexion : création du compte admin avant toute session.
  "/installation",
  "/api/auth/setup",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  // Liveness publique (healthcheck Docker/Synology, reverse proxy) — aucune donnée
  // sensible, statut « ok » uniquement.
  "/api/health",
  // Déclencheur planifié : sécurisé par CRON_SECRET dans la route elle-même,
  // pas par la session (appelé par un planificateur externe).
  "/api/cron/",
  "/_next/",
  "/favicon",
];

/**
 * Fichiers statiques publics servis depuis `public/` (logo, worker pdfjs,
 * polices, images…). Ils doivent rester accessibles sans session — notamment
 * le logo sur la page de login (publique) et le worker pdfjs (signature PDF).
 */
const STATIC_FILE = /\.(png|jpe?g|gif|svg|webp|ico|mjs|js|css|map|txt|woff2?)$/i;

function isPublic(pathname: string): boolean {
  if (STATIC_FILE.test(pathname)) return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix),
  );
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Injecter x-pathname dans les headers de requête (lisible par headers() côté serveur)
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  // Mode bureau LOCAL : auth désactivée (app mono-utilisateur sur localhost).
  // Activé UNIQUEMENT par le runtime macOS embarqué (GEDIFY_LOCAL_NO_AUTH=1) ;
  // jamais défini sur le serveur en ligne → aucun impact sécurité distant.
  if (process.env.GEDIFY_LOCAL_NO_AUTH === "1") {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Routes publiques : login, assets Next.js, routes auth API
  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Toutes les autres routes nécessitent une session valide
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return denyAccess(req, pathname);
  }

  try {
    await jwtVerify(token, secret());
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    // Token invalide ou expiré
    const res = denyAccess(req, pathname);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }
}

function denyAccess(req: NextRequest, pathname: string) {
  // Routes API : répondre 401 JSON
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Non authentifié", errorType: "ged_auth", message: AUTH_MESSAGE },
      { status: 401 },
    );
  }
  // Pages : rediriger vers /login avec l'URL de retour et le message
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  url.searchParams.set("reason", "auth_required");
  return NextResponse.redirect(url);
}

export const config = {
  // Tout est protégé par défaut ; on exclut uniquement les assets statiques.
  // Les routes publiques (login, /api/auth/*) sont laissées passer dans `proxy()`
  // afin que x-pathname soit tout de même injecté pour le layout.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|iconesmenu/|design-reference/).*)",
  ],
};
