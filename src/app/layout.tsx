import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import "@/components/admin-ui/admin-ui.css";
import "@/components/admin-ui/superadmin-ui.css";
import { AppShell } from "@/components/layout/app-shell";
import { EnvironmentBanner } from "@/components/env/EnvironmentBanner";
import { AuthSetupBanner } from "@/components/ui/auth-setup-banner";
import { SessionExpiredBanner } from "@/components/ui/session-expired-banner";
import { AssistantProvider } from "@/components/ai-assistant/assistant-provider";
import { Toaster } from "@/components/ui/toaster";
import { TenantBadge } from "@/components/tenant/tenant-badge";
import { SupportWidget } from "@/components/support/support-widget";
import { readSession } from "@/lib/auth/session";
import { getTenantNav } from "@/lib/tenant/get-current-tenant";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";

export const metadata: Metadata = {
  title: "Gedify",
  description: "GED personnelle autonome — moteur documentaire local embarqué",
  icons: { icon: "/gedify-icon.png", apple: "/gedify-icon.png" },
};

/** Viewport mobile correct (échelle 1, largeur de l'appareil) — corrige le
 *  « zoom » au lancement sur smartphone. Pinch-to-zoom conservé (maxScale 5). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

/** Routes rendues sans AppShell (0 chrome : fond + contenu uniquement). */
const BARE_ROUTES = ["/login", "/installation", "/unsubscribe", "/invite"];

/** Applique le thème (clair/sombre) AVANT le rendu pour éviter tout flash. */
const THEME_INIT_SCRIPT =
  "(function(){try{var t=localStorage.getItem('gedify-theme');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme:dark)').matches;if(d)document.documentElement.classList.add('dark');}catch(e){}})();";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const headersList = await headers();
  // x-pathname est injecté par le proxy (src/proxy.ts) dans les headers de requête.
  // Défaut "/" (route protégée) et NON "/login" : si le header manque, on doit
  // exiger une session, pas supposer une page publique.
  const pathname = headersList.get("x-pathname") ?? "/";

  // ── Page login (et routes publiques) : 0 chrome ───────────────────────────
  const isBareRoute = BARE_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  if (isBareRoute) {
    return (
      <html lang="fr">
        <body
          className="min-h-screen antialiased"
          style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
        >
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <EnvironmentBanner />
          {children}
        </body>
      </html>
    );
  }

  // ── Défense en profondeur ──────────────────────────────────────────────────
  // Le proxy (src/proxy.ts) bloque normalement les routes non authentifiées
  // en amont. Mais si une route échappait au matcher, ce garde côté serveur
  // empêche tout de même l'accès. Redirection serveur (pas de useEffect client)
  // → évite l'erreur "Router action dispatched before initialization".
  const session = await readSession();
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(pathname)}&reason=auth_required`);
  }

  // ── MFA obligatoire pour les superusers en production ──────────────────────
  // Tant que la MFA n'est pas configurée, on force l'écran d'enrôlement.
  if (process.env.APP_ENV?.trim().toLowerCase() === "production"
      && pathname !== "/account/security" && !pathname.startsWith("/api/")) {
    let superuserNeedsMfa = false;
    try {
      const { getCurrentUser } = await import("@/lib/auth/current-user");
      const u = await getCurrentUser();
      if (u?.is_superuser) {
        const { isMfaEnabled } = await import("@/lib/saas/mfa/mfa-store");
        superuserNeedsMfa = !(await isMfaEnabled(u.id));
      }
    } catch { /* ne bloque pas le rendu si la vérif échoue */ }
    if (superuserNeedsMfa) redirect("/account/security?enroll=mfa");
  }

  // ── Phase 5 — écran de sélection d'espace (multi-tenant) ───────────────────
  // Rendu SANS AppShell (écran dédié, mais authentifié — pas une route publique).
  if (pathname === "/select-tenant") {
    return (
      <html lang="fr">
        <body
          className="min-h-screen antialiased"
          style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
        >
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <EnvironmentBanner />
          {children}
        </body>
      </html>
    );
  }

  // Résolution tenant (UNE fois par requête). Neutre/instantané en mono-tenant.
  const tenantNav = await getTenantNav();
  // Plusieurs espaces et aucun sélectionné → sélection obligatoire. On exempte
  // l'admin SaaS global (superuser) qui n'a pas besoin d'un tenant actif.
  if (tenantNav.needsSelection && !pathname.startsWith("/admin/saas")) {
    redirect("/select-tenant");
  }

  // ── Espace paramètres tenant (/settings/*) : layout PROPRE, sans chrome ────
  // Aucune sidebar GED, aucun rail d'icônes, aucune topbar globale, aucun menu
  // SuperAdmin. Les gardes d'auth / MFA / sélection de tenant ci-dessus restent
  // appliquées ; seul l'AppShell (chrome) est retiré. Le rendu propre vient du
  // layout dédié src/app/settings/layout.tsx + des composants `.st-*`.
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return (
      <html lang="fr">
        <body
          className="min-h-screen antialiased"
          style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
        >
          <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
          <EnvironmentBanner />
          <AssistantProvider>
            <AuthSetupBanner />
            <SessionExpiredBanner />
            {children}
            {isMultiTenantEnabled() ? <SupportWidget /> : null}
            <Toaster />
          </AssistantProvider>
        </body>
      </html>
    );
  }

  // ── App normale (session valide) ───────────────────────────────────────────
  // Plus de sidebar gauche : navigation via le lanceur d'applications de la
  // topbar. Le contenu occupe toute la largeur (centré, max 1600px).
  return (
    <html lang="fr">
      <body
        className="min-h-screen antialiased"
        style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
      >
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <EnvironmentBanner />
        <TenantBadge nav={tenantNav} />
        <AssistantProvider>
          <AuthSetupBanner />
          <SessionExpiredBanner />
          <AppShell>{children}</AppShell>
          {isMultiTenantEnabled() ? <SupportWidget /> : null}
          <Toaster />
        </AssistantProvider>
      </body>
    </html>
  );
}
