"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getActiveSpaceId } from "@/config/space-menus";
import { getSpaceById } from "@/config/spaces";

/** Titres « gros titre » par section principale (cf. maquettes mobiles). */
const TITLES: { match: (p: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Accueil" },
  { match: (p) => p.startsWith("/documents"), title: "Documents" },
  { match: (p) => p.startsWith("/messagerie"), title: "Mails" },
  { match: (p) => p.startsWith("/finances") || p.startsWith("/budget"), title: "Finances" },
  { match: (p) => p.startsWith("/menu"), title: "Menu" },
];

function resolveTitle(pathname: string): string {
  const direct = TITLES.find((t) => t.match(pathname));
  if (direct) return direct.title;
  const space = getSpaceById(getActiveSpaceId(pathname));
  return space?.label ?? "GED AzServer";
}

/**
 * En-tête mobile « façon application » (smartphone / tablette, < md) :
 * gros titre de la page + pastille Finances + marque AzServer + avatar.
 * Le bureau (≥ md) garde la `Topbar`.
 */
export function MobileAppHeader() {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur md:hidden"
      style={{ background: "rgba(255,255,255,0.95)", borderColor: "var(--border)" }}
    >
      <h1 className="min-w-0 flex-1 truncate text-[26px] font-extrabold leading-none" style={{ color: "var(--text-main)" }}>
        {title}
      </h1>

      {/* Pastille Finances (raccourci) */}
      <Link
        href="/finances"
        aria-label="Finances"
        className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Wallet className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Finances
      </Link>

      {/* Marque Gedify */}
      <Link href="/menu" aria-label="Menu Gedify" className="flex shrink-0 items-center">
        <BrandLogo variant="icon" className="h-9 w-auto" />
      </Link>
    </header>
  );
}
