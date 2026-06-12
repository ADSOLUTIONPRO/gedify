import type { CSSProperties, ReactNode } from "react";
import { headers } from "next/headers";
import { Topbar } from "@/components/layout/topbar";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { MobileAppHeader } from "@/components/layout/mobile-app-header";
import { AppsRail } from "@/components/layout/apps-rail";
import { SpaceMenuSidebar } from "@/components/layout/space-menu-sidebar";
import { MailComposer } from "@/components/messaging/mail-composer";
import { ImportActivityIndicator } from "@/components/layout/import-activity-indicator";
import { GlobalDropImport } from "@/components/layout/global-drop-import";
import { readSession } from "@/lib/auth/session";
import { getGedifyFeatureFlags } from "@/lib/settings/feature-flags";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isMultiTenantEnabled } from "@/lib/tenant/tenant-config";

type AppShellProps = {
  children: ReactNode;
};

/**
 * Coque applicative en double sidebar (style SaaS) :
 * - Zone 1 : rail d'applications (`AppsRail`).
 * - Zone 2 : sidebar du menu de l'espace actif (`SpaceMenuSidebar`).
 * - Zone 3 : topbar (sticky) + contenu de la page.
 *
 * Application macOS (Electron) : une barre de titre **bleu nuit déplaçable** est
 * ajoutée tout en haut (détectée via l'User-Agent « GedifyDesktop »), pour
 * laisser de la place aux boutons fermer/réduire/agrandir. La hauteur est
 * propagée par la variable CSS `--titlebar-h` (0 hors desktop).
 */
export async function AppShell({ children }: AppShellProps) {
  const session = await readSession().catch(() => null);
  const initials = session?.username ? session.username[0].toUpperCase() : "";
  const ua = (await headers()).get("user-agent") ?? "";
  const isDesktop = ua.includes("GedifyDesktop");
  const { financeSpaceEnabled } = await getGedifyFeatureFlags().catch(() => ({ financeSpaceEnabled: true }));
  // « Gestion clients » (SaaS) : visible uniquement pour un superuser sur une
  // instance multi-tenant (jamais en local/Synology/mono-tenant).
  const me = await getCurrentUser().catch(() => null);
  const saasAdmin = isMultiTenantEnabled() && Boolean(me?.is_superuser);
  // Client = utilisateur multi-tenant non-superuser → menu « Paramètres » (pas « Administration »).
  const tenantClient = isMultiTenantEnabled() && Boolean(me) && !me?.is_superuser;

  return (
    <div
      className="flex min-h-screen pt-[var(--titlebar-h,0px)]"
      style={{ "--titlebar-h": isDesktop ? "34px" : "0px" } as CSSProperties}
    >
      {isDesktop ? (
        <div
          className="titlebar-drag-region fixed inset-x-0 top-0 z-[200] h-[34px]"
          style={{ background: "var(--gedify-navy)" }}
          aria-hidden="true"
        />
      ) : null}

      <AppsRail userInitials={initials} financeEnabled={financeSpaceEnabled} saasAdmin={saasAdmin} />
      <SpaceMenuSidebar financeEnabled={financeSpaceEnabled} saasAdmin={saasAdmin} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bureau (≥ md) : topbar STICKY (reste visible au scroll) */}
        <div
          className="sticky z-40 hidden md:block"
          style={{ top: "var(--titlebar-h,0px)", background: "var(--surface)" }}
        >
          <Topbar saasAdmin={saasAdmin} tenantClient={tenantClient} />
        </div>
        <MobileAppHeader />
        {/* pb-24 sous `md` : réserve la place de la barre d'onglets fixe */}
        <main className="w-full pb-24 md:pb-0">{children}</main>
      </div>
      <MobileTabBar financeEnabled={financeSpaceEnabled} />
      {/* Fenêtre de rédaction globale (persiste pendant la navigation) */}
      <MailComposer />
      {/* Indicateur global non bloquant de traitement (import → OCR/IA/miniatures) */}
      <ImportActivityIndicator />
      {/* Glisser-déposer global : déposer un fichier n'importe où → import direct */}
      <GlobalDropImport />
    </div>
  );
}
