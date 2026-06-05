import Link from "next/link";
import { ExternalLink, Search, Upload } from "lucide-react";
import { AdministrationDropdown } from "@/components/navigation/administration-dropdown";
import { BrandLogo } from "@/components/ui/brand-logo";
import { MobileSpaceMenu } from "@/components/layout/space-menu-sidebar";
import { UserMenu } from "@/components/user-menu";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { getPaperlessPublicUrl } from "@/lib/paperless";
import { readSession } from "@/lib/auth/session";

export async function Topbar() {
  const paperlessUrl = getPaperlessPublicUrl();
  const session = await readSession().catch(() => null);
  const username = session?.username ?? null;
  const userInitials = username ? username[0].toUpperCase() : "N";

  return (
    <header
      className="sticky top-0 z-30 border-b bg-white/95 px-4 py-2.5 backdrop-blur lg:px-6"
      style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xs)" }}
    >
      <div className="flex h-10 items-center gap-3">
        {/* Menu de l'espace (mobile / tablette) — ouvre le drawer Zone 2 */}
        <MobileSpaceMenu />

        {/* Marque : neutralisée (Topbar masquée < md ; le rail/sidebar portent la marque ≥ md) */}
        <Link href="/" className="flex shrink-0 items-center md:hidden" aria-label="Accueil Gedify">
          <BrandLogo variant="full" className="h-7 w-auto" />
        </Link>

        {/* Barre de recherche */}
        <form action="/recherche" className="hidden flex-1 items-center md:flex md:max-w-xl lg:max-w-2xl">
          <input type="hidden" name="include_projects" value="on" />
          <label className="sr-only" htmlFor="topbar-query">Recherche rapide</label>
          <div className="relative flex h-10 w-full items-center">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 h-4 w-4"
              style={{ color: "var(--text-hint)" }}
              strokeWidth={1.75}
            />
            <input
              id="topbar-query"
              name="query"
              type="search"
              placeholder="Rechercher dans les documents, dossiers, taxonomies..."
              className="h-full w-full rounded-xl border pl-10 pr-16 text-sm font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg-page)",
                color: "var(--text-main)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] font-bold"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-hint)" }}
            >
              <span className="text-sm leading-none">⌘</span>K
            </span>
          </div>
        </form>

        {/* Droite */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Importer (masqué sur smartphone : accessible via Actions rapides) */}
          <Link
            href="/import"
            className="hidden h-9 items-center gap-2 rounded-[20px] px-4 text-[13px] font-bold text-white transition hover:opacity-90 sm:inline-flex"
            style={{ background: "var(--accent)" }}
          >
            <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Importer</span>
          </Link>

          {/* Administration */}
          <div className="hidden md:block">
            <AdministrationDropdown paperlessUrl={paperlessUrl} />
          </div>

          {/* Gedify */}
          {paperlessUrl ? (
            <a
              href={paperlessUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir Gedify"
              aria-label="Ouvrir Gedify"
              className="hidden h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-slate-50 lg:inline-flex"
              style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
            </a>
          ) : null}

          {/* Notifications (liste agrégée : rappels, erreurs, actions) */}
          <NotificationsBell />

          {/* User */}
          <UserMenu initials={userInitials} username={username} />
        </div>
      </div>

      {/* Recherche mobile : tablette uniquement (smartphone = barre d'onglets) */}
      <form action="/recherche" className="mt-2 hidden items-center sm:flex md:hidden">
        <input type="hidden" name="include_projects" value="on" />
        <div className="relative flex h-9 w-full items-center">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 h-4 w-4" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
          <input
            name="query"
            type="search"
            placeholder="Documents, dossiers, taxonomies..."
            className="h-full w-full rounded-xl border pl-10 pr-4 text-sm font-medium outline-none"
            style={{ borderColor: "var(--border)", background: "var(--bg-page)", color: "var(--text-main)" }}
          />
        </div>
      </form>
    </header>
  );
}
