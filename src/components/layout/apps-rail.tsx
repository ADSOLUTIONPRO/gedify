"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { getSpaceById } from "@/config/spaces";
import { getActiveSpaceId, RAIL_PRIMARY, RAIL_SECONDARY } from "@/config/space-menus";

type RailEntry = { id: string; label: string; href: string; icon: LucideIcon };

/** Libellés courts spécifiques au rail (l'espace garde son nom complet ailleurs). */
const LABEL_OVERRIDES: Record<string, string> = { messagerie: "Mails" };

function buildEntries(): RailEntry[] {
  const map = (id: string): RailEntry | null => {
    const s = getSpaceById(id);
    return s ? { id: s.id, label: LABEL_OVERRIDES[s.id] ?? s.label, href: s.href, icon: s.icon } : null;
  };
  // Une seule liste continue : Accueil + espaces principaux + Office/Organiser/Actions.
  return [
    { id: "accueil", label: "Accueil", href: "/", icon: Home },
    ...[...RAIL_PRIMARY, ...RAIL_SECONDARY].map(map).filter((e): e is RailEntry => e !== null),
  ];
}

function RailTile({ entry, active }: { entry: RailEntry; active: boolean }) {
  const Icon = entry.icon;
  return (
    <Link
      href={entry.href}
      aria-label={entry.label}
      aria-current={active ? "page" : undefined}
      className="group flex min-h-[64px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2.5 transition hover:bg-black/[0.04]"
      style={active ? { background: "var(--accent-soft)", boxShadow: "var(--shadow-xs)" } : undefined}
    >
      <Icon
        className="h-[26px] w-[26px] shrink-0 transition"
        style={{ color: active ? "var(--accent)" : "#6B7280" }}
        strokeWidth={active ? 2.2 : 1.85}
        aria-hidden="true"
      />
      <span
        className="w-full truncate text-center text-[10.5px] font-semibold leading-tight"
        style={{ color: active ? "var(--accent)" : "#5F6B7A" }}
      >
        {entry.label}
      </span>
    </Link>
  );
}

/**
 * Zone 1 — Rail d'applications (desktop), flat : fond crème (`--surface-rail`
 * = #F7F1E7), icône + libellé sous l'icône, actif rose doux. Masqué sous `lg`
 * (navigation via `MobileTabBar`).
 */
export function AppsRail({ userInitials, financeEnabled = true }: { userInitials: string; financeEnabled?: boolean }) {
  const pathname = usePathname();
  const activeId = getActiveSpaceId(pathname);
  // Masque l'espace Finances si le module est désactivé (Paramètres › Modules).
  const entries = buildEntries().filter((e) => financeEnabled || e.id !== "finances");

  return (
    <aside
      className="sticky z-30 hidden w-[84px] shrink-0 flex-col items-center border-r md:flex"
      style={{ background: "var(--surface-rail)", borderColor: "var(--border-soft)", top: "var(--titlebar-h,0px)", height: "calc(100dvh - var(--titlebar-h,0px))" }}
      aria-label="Applications"
    >
      {/* Marque Gedify */}
      <Link href="/" aria-label="Accueil Gedify" className="flex w-full items-center justify-center py-3">
        <BrandLogo variant="icon" className="h-9 w-auto" />
      </Link>

      <nav className="flex w-full flex-1 flex-col items-center gap-0.5 overflow-y-auto px-1.5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((e) => (
          <RailTile key={e.id} entry={e} active={activeId === e.id} />
        ))}
      </nav>

      {/* Bas : réglages + profil */}
      <div className="flex w-full flex-col items-center gap-1.5 border-t px-1.5 py-2.5" style={{ borderColor: "var(--border)" }}>
        <Link
          href="/parametres"
          aria-label="Réglages"
          aria-current={activeId === "parametres" ? "page" : undefined}
          className="flex w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 transition hover:bg-black/[0.04]"
        >
          <Settings className="h-[24px] w-[24px] shrink-0" strokeWidth={1.85} style={{ color: "#6B7280" }} aria-hidden="true" />
          <span className="text-[10.5px] font-semibold" style={{ color: "#5F6B7A" }}>Réglages</span>
        </Link>
        <Link href="/profil" title="Mon profil" aria-label="Mon profil" className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white transition hover:opacity-90" style={{ background: "var(--accent)" }}>
          {userInitials || "?"}
        </Link>
      </div>
    </aside>
  );
}
