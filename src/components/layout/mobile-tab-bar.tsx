"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Mail, Menu, Wallet, type LucideIcon } from "lucide-react";

type Tab = { label: string; href: string; icon: LucideIcon; match: (p: string) => boolean };

/** Onglets principaux de la barre basse (maquettes mobiles validées). */
const TABS: Tab[] = [
  { label: "Accueil", href: "/", icon: Home, match: (p) => p === "/" },
  { label: "Documents", href: "/documents", icon: FileText, match: (p) => p === "/documents" || p.startsWith("/documents/") },
  { label: "Mails", href: "/messagerie", icon: Mail, match: (p) => p.startsWith("/messagerie") },
  { label: "Finances", href: "/finances", icon: Wallet, match: (p) => p.startsWith("/finances") || p.startsWith("/budget") },
  { label: "Menu", href: "/menu", icon: Menu, match: (p) => p.startsWith("/menu") },
];

/**
 * Barre de navigation basse — app mobile (smartphone / tablette, < md).
 * Onglet actif en rose `--accent`. Masquée dès `md` (double sidebar bureau).
 */
export function MobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t bg-white/95 backdrop-blur md:hidden"
      style={{ borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
            style={{ color: active ? "var(--accent)" : "#64748B" }}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
            <span className="text-[10.5px] font-semibold" style={{ color: active ? "var(--accent)" : "#5F6B7A" }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
