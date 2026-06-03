import { Suspense } from "react";
import Link from "next/link";
import { ExternalLink, Search, Upload } from "lucide-react";
import { AdministrationDropdown } from "@/components/navigation/administration-dropdown";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { UserMenu } from "@/components/user-menu";
import { ConnectionStatusBadge } from "@/components/ui/connection-status-badge";
import { getPaperlessPublicUrl } from "@/lib/paperless";

function ConnectionBadgeSkeleton() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
      Vérification...
    </span>
  );
}

type TopbarProps = {
  badges?: Record<string, number | string | undefined>;
};

export function Topbar({ badges }: TopbarProps = {}) {
  const paperlessUrl = getPaperlessPublicUrl();

  return (
    <header className="sticky top-0 z-30 border-b bg-white px-4 py-3 lg:px-6" style={{ borderColor: "var(--border)" }}>
      <div className="flex h-[46px] items-center gap-3">
        <MobileSidebar badges={badges} />

        {/* Mobile logo */}
        <Link href="/dashboard" className="flex items-center gap-3 lg:hidden">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
            style={{ background: "var(--blue-600)" }}
          >
            G
          </span>
          <span className="hidden sm:block text-sm font-extrabold tracking-tight" style={{ color: "var(--text-main)" }}>
            GED AzServer
          </span>
        </Link>

        {/* Search */}
        <form
          action="/recherche"
          className="hidden flex-1 items-center md:flex md:max-w-xl lg:max-w-2xl"
        >
          <input type="hidden" name="include_projects" value="on" />
          <label className="sr-only" htmlFor="topbar-query">
            Recherche rapide
          </label>
          <div className="relative flex h-10 w-full items-center">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
              strokeWidth={1.75}
            />
            <input
              id="topbar-query"
              name="query"
              type="search"
              placeholder="Rechercher dans les documents et dossiers..."
              className="h-full w-full rounded-xl border bg-slate-50/80 pl-10 pr-16 text-sm font-medium outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-bold text-slate-400"
            >
              <span className="text-sm leading-none">⌘</span>K
            </span>
          </div>
        </form>

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-2">
          <div className="hidden xl:block">
            <Suspense fallback={<ConnectionBadgeSkeleton />}>
              <ConnectionStatusBadge compact />
            </Suspense>
          </div>

          <Link
            href="/import"
            className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: "var(--blue-600)" }}
          >
            <Upload className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Importer</span>
          </Link>

          <div className="hidden md:block">
            <AdministrationDropdown paperlessUrl={paperlessUrl} />
          </div>

          {paperlessUrl ? (
            <a
              href={paperlessUrl}
              target="_blank"
              rel="noreferrer"
              title="Ouvrir Gedify"
              aria-label="Ouvrir Gedify"
              className="hidden h-9 w-9 items-center justify-center rounded-lg border bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 lg:inline-flex"
              style={{ borderColor: "var(--border)" }}
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </a>
          ) : null}

          <UserMenu initials="N" />
        </div>
      </div>

      {/* Mobile search */}
      <form action="/recherche" className="mt-0 flex items-center md:hidden pb-3">
        <input type="hidden" name="include_projects" value="on" />
        <div className="relative flex h-9 w-full items-center">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-slate-400"
            strokeWidth={1.75}
          />
          <input
            name="query"
            type="search"
            placeholder="Documents et dossiers..."
            className="h-full w-full rounded-xl border bg-slate-50/80 pl-10 pr-4 text-sm font-medium outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
      </form>

      <div className="flex items-center gap-2 pb-3 md:hidden">
        <AdministrationDropdown paperlessUrl={paperlessUrl} />
        <div className="ml-auto">
          <Suspense fallback={<ConnectionBadgeSkeleton />}>
            <ConnectionStatusBadge compact />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
