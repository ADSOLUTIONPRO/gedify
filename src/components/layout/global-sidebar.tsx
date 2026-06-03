"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Inbox,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Star,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { getSpaceByHref } from "@/config/spaces";

type QuickItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  badgeKey?: string;
  section?: string;
};

/**
 * Accès rapides quotidiens (cf. brief). La sidebar globale reste volontairement
 * minimale : les anciennes entrées surchargées vivent désormais dans les espaces
 * ou le menu Administration de la topbar.
 */
const quickItems: QuickItem[] = [
  { name: "Accueil", href: "/", icon: Home },
  { name: "Recherche", href: "/recherche", icon: Search },
  { name: "Importer", href: "/import", icon: Upload },
  { name: "À traiter", href: "/a-traiter", icon: Inbox, badgeKey: "inbox" },
];

const shortcutItems: QuickItem[] = [
  { name: "Favoris", href: "/recherche?favoris=1", icon: Star },
  { name: "Tâches récentes", href: "/activite", icon: Inbox },
];

type GlobalSidebarProps = {
  footer?: ReactNode;
  badges?: Record<string, number | string | undefined>;
};

function isItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalSidebar({ footer, badges }: GlobalSidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const activeSpace = getSpaceByHref(pathname);

  function renderItem(item: QuickItem) {
    const Icon = item.icon;
    const isActive = isItemActive(pathname, item.href);
    const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
    const showBadge = badge !== undefined && badge !== null && badge !== 0 && badge !== "";

    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.name : undefined}
        aria-current={isActive ? "page" : undefined}
        className={`group flex h-9 items-center gap-2.5 rounded-lg text-[12.5px] font-medium transition-colors ${
          collapsed ? "justify-center px-0" : "px-2.5"
        } ${isActive ? "text-white" : "text-[#8AABCC] hover:bg-white/5 hover:text-white"}`}
        style={isActive ? { background: "var(--blue-600)" } : undefined}
      >
        <Icon
          aria-hidden="true"
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${
            isActive ? "text-white" : "text-[#4A6A8A] group-hover:text-[#8AABCC]"
          }`}
          strokeWidth={1.75}
        />
        {collapsed ? null : <span className="flex-1 truncate">{item.name}</span>}
        {showBadge && !collapsed ? (
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
              isActive ? "bg-white/20 text-white" : "text-white"
            }`}
            style={isActive ? undefined : { background: "var(--blue-600)" }}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <aside
      data-collapsed={collapsed}
      className={`fixed left-0 top-0 bottom-0 z-40 hidden lg:flex ${
        collapsed ? "w-[72px]" : "w-[246px]"
      }`}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden px-2.5 py-3.5"
        style={{ background: "var(--navy-900)" }}
      >
        {/* Logo */}
        <Link
          href="/"
          className={`mb-4 flex items-center gap-2.5 rounded-xl py-2 transition hover:bg-white/5 ${
            collapsed ? "justify-center px-0" : "px-2"
          }`}
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
            style={{ background: "var(--blue-600)" }}
          >
            G
          </span>
          {collapsed ? null : (
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold tracking-tight text-white">
                GED AzServer
              </span>
              <span className="block truncate text-[10px] font-medium" style={{ color: "#7A9CC8" }}>
                Espace documentaire
              </span>
            </span>
          )}
        </Link>

        {/* Navigation */}
        <nav
          className="flex-1 space-y-4 overflow-y-auto pr-0.5"
          aria-label="Navigation principale"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          <div className="space-y-0.5">{quickItems.map(renderItem)}</div>

          {/* Espace actif (surligné, cf. maquettes) */}
          {activeSpace ? (
            <div className="space-y-0.5">
              {!collapsed ? (
                <p
                  className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "#4A6A8A" }}
                >
                  Espace
                </p>
              ) : null}
              <Link
                href={activeSpace.href}
                title={collapsed ? activeSpace.label : undefined}
                aria-current="page"
                className={`group flex h-9 items-center gap-2.5 rounded-lg text-[12.5px] font-semibold text-white transition-colors ${
                  collapsed ? "justify-center px-0" : "px-2.5"
                }`}
                style={{ background: "var(--blue-600)" }}
              >
                <activeSpace.icon
                  aria-hidden="true"
                  className="h-[18px] w-[18px] shrink-0 text-white"
                  strokeWidth={1.75}
                />
                {collapsed ? null : <span className="flex-1 truncate">{activeSpace.label}</span>}
              </Link>
            </div>
          ) : null}

          {/* Raccourcis */}
          <div className="space-y-0.5">
            {!collapsed ? (
              <p
                className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "#4A6A8A" }}
              >
                Raccourcis
              </p>
            ) : null}
            {shortcutItems.map(renderItem)}
          </div>
        </nav>

        {/* Footer connexion */}
        {footer && !collapsed ? (
          <div
            className="mt-3 rounded-xl border p-3"
            style={{ background: "#040E1E", borderColor: "rgba(255,255,255,0.07)" }}
          >
            {footer}
          </div>
        ) : null}

        {/* Réduire le menu */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-pressed={collapsed}
          className={`mt-2 flex h-9 items-center gap-2.5 rounded-lg text-[12px] font-medium text-[#6A87A8] transition-colors hover:bg-white/5 hover:text-white ${
            collapsed ? "justify-center px-0" : "px-2.5"
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <>
              <PanelLeftClose className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span className="flex-1 truncate text-left">Réduire le menu</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

type GlobalMobileNavProps = {
  badges?: Record<string, number | string | undefined>;
};

/**
 * Déclencheur + drawer de navigation pour tablette / smartphone.
 * Reprend les accès rapides + l'espace actif, sans sidebar permanente.
 */
export function GlobalMobileNav({ badges }: GlobalMobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeSpace = getSpaceByHref(pathname);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    if (!open) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  function renderLink(item: QuickItem) {
    const Icon = item.icon;
    const isActive = isItemActive(pathname, item.href);
    const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
    const showBadge = badge !== undefined && badge !== null && badge !== 0 && badge !== "";
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setOpen(false)}
        aria-current={isActive ? "page" : undefined}
        className={`flex h-10 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
          isActive ? "text-white" : "text-[#8AABCC] hover:bg-white/5 hover:text-white"
        }`}
        style={isActive ? { background: "var(--blue-600)" } : undefined}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? "text-white" : "text-[#4A6A8A]"}`} strokeWidth={1.75} aria-hidden="true" />
        <span className="flex-1 truncate">{item.name}</span>
        {showBadge ? (
          <span
            className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
              isActive ? "bg-white/20 text-white" : "text-white"
            }`}
            style={isActive ? undefined : { background: "var(--blue-600)" }}
          >
            {badge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-slate-600 transition hover:bg-slate-50 lg:hidden"
        style={{ borderColor: "var(--border)", background: "white" }}
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col shadow-2xl"
            style={{ background: "var(--navy-900)" }}
          >
            <div
              className="flex items-center justify-between px-4 py-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{ background: "var(--blue-600)" }}
                >
                  G
                </span>
                <span>
                  <span className="block text-sm font-extrabold tracking-tight text-white">GED AzServer</span>
                  <span className="block text-[10px] font-medium" style={{ color: "#7A9CC8" }}>
                    Espace documentaire
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3" aria-label="Navigation mobile">
              <div className="space-y-0.5">{quickItems.map(renderLink)}</div>
              {activeSpace ? (
                <div className="space-y-0.5">
                  <p
                    className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                    style={{ color: "#4A6A8A" }}
                  >
                    Espace
                  </p>
                  {renderLink({ name: activeSpace.label, href: activeSpace.href, icon: activeSpace.icon })}
                </div>
              ) : null}
              <div className="space-y-0.5">
                <p
                  className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: "#4A6A8A" }}
                >
                  Raccourcis
                </p>
                {shortcutItems.map(renderLink)}
              </div>
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
