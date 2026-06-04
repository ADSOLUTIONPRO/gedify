import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { AuthSetupBanner } from "@/components/ui/auth-setup-banner";
import { SessionExpiredBanner } from "@/components/ui/session-expired-banner";
import { AssistantProvider } from "@/components/ai-assistant/assistant-provider";
import { readSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Gedify",
  description: "GED personnelle autonome — moteur documentaire local embarqué",
  icons: { icon: "/gedify-icon.png", apple: "/gedify-icon.png" },
};

/** Routes rendues sans AppShell (0 chrome : fond + contenu uniquement). */
const BARE_ROUTES = ["/login", "/installation"];

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

  // ── App normale (session valide) ───────────────────────────────────────────
  // Plus de sidebar gauche : navigation via le lanceur d'applications de la
  // topbar. Le contenu occupe toute la largeur (centré, max 1600px).
  return (
    <html lang="fr">
      <body
        className="min-h-screen antialiased"
        style={{ background: "var(--bg-page)", color: "var(--text-main)" }}
      >
        <AssistantProvider>
          <AuthSetupBanner />
          <SessionExpiredBanner />
          <AppShell>{children}</AppShell>
        </AssistantProvider>
      </body>
    </html>
  );
}
