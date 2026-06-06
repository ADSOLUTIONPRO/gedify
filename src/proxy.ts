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

/* Routes appelées par le SERVEUR ONLYOFFICE (téléchargement du .docx + callback
   de sauvegarde). ONLYOFFICE n'a pas de cookie de session : ces requêtes portent
   un `oo_token` signé (vérifié DANS la route). On ne les laisse passer sans
   session QUE si ce token est présent — sinon le contrôle de session normal
   s'applique (un navigateur sans session reste bloqué). */
const ONLYOFFICE_SERVER_ROUTE = /^\/api\/writer\/documents\/[^/]+\/(file|onlyoffice-callback)$/;
function isOnlyOfficeServerRequest(req: NextRequest): boolean {
  return (
    ONLYOFFICE_SERVER_ROUTE.test(req.nextUrl.pathname) &&
    req.nextUrl.searchParams.has("oo_token")
  );
}

function secret(): Uint8Array {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "");
}

/* ────────────────────────────────────────────────────────────────────────
   Content-Security-Policy posée au RUNTIME (et non au build via next.config),
   car l'origine du serveur ONLYOFFICE vient d'une variable d'environnement
   connue seulement à l'exécution (http://IP_DU_NAS:8082 en Synology,
   http://localhost:8082 en Mac/PC, https://office.azserver.fr en Coolify, ou un
   reverse proxy https://office-maison.domaine.fr). Le middleware lit
   `process.env.*` à l'exécution (vérifié : même mécanisme que AUTH_SECRET).

   Règles :
   • On NE code AUCUN domaine en dur. On lit l'origine de
     ONLYOFFICE_DOCUMENT_SERVER_URL (chargée par le navigateur) — et, par
     robustesse, ONLYOFFICE_INTERNAL_URL — via `new URL(...).origin`.
   • Si la variable est absente ou invalide → on n'ajoute RIEN (CSP de base
     inchangée → aucun impact Coolify/Synology/Mac/PC sans ONLYOFFICE).
   • Origine ajoutée aux directives : script-src, style-src, img-src, font-src,
     connect-src (+ WebSocket ws/wss), frame-src, worker-src, child-src.
   ──────────────────────────────────────────────────────────────────────── */
function originOf(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    return new URL(v).origin; // normalise (sans slash final, port inclus)
  } catch {
    return null; // URL invalide → on n'ajoute rien
  }
}

function buildCsp(): string {
  const origins = new Set<string>();
  for (const o of [
    originOf(process.env.ONLYOFFICE_DOCUMENT_SERVER_URL),
    originOf(process.env.ONLYOFFICE_INTERNAL_URL),
  ]) {
    if (o) origins.add(o);
  }
  const office = [...origins];
  const http = office.join(" "); // ex. "https://office.azserver.fr" / "http://192.168.1.17:8082"
  // WebSocket correspondant (ws:// pour http, wss:// pour https) pour l'édition.
  const ws = office.map((o) => o.replace(/^http/, "ws")).join(" ");
  const sp = http ? ` ${http}` : ""; // origines http(s)
  const cp = http ? ` ${http}${ws ? ` ${ws}` : ""}` : ""; // + WebSocket (connect-src)

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'${sp}`,
    `style-src 'self' 'unsafe-inline'${sp}`,
    // `https:` conservé (images externes existantes) ; ${sp} ajoute l'origine
    // ONLYOFFICE en http (Synology/Mac local).
    `img-src 'self' data: blob: https:${sp}`,
    `font-src 'self' data:${sp}`,
    `connect-src 'self'${cp}`,
    `frame-src 'self' blob:${sp}`,
    `child-src 'self' blob:${sp}`,
    `worker-src 'self' blob:${sp}`,
    `frame-ancestors 'self'${sp}`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

function withCsp<T extends NextResponse>(res: T): T {
  res.headers.set("Content-Security-Policy", buildCsp());
  return res;
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
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Routes publiques : login, assets Next.js, routes auth API
  if (isPublic(pathname)) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Téléchargement / callback ONLYOFFICE (serveur, sans session) : laissés passer
  // UNIQUEMENT s'ils portent un oo_token signé — la route en vérifie la validité.
  if (isOnlyOfficeServerRequest(req)) {
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  }

  // Toutes les autres routes nécessitent une session valide
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return withCsp(denyAccess(req, pathname));
  }

  try {
    await jwtVerify(token, secret());
    return withCsp(NextResponse.next({ request: { headers: requestHeaders } }));
  } catch {
    // Token invalide ou expiré
    const res = withCsp(denyAccess(req, pathname));
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
