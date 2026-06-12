"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  CreditCard,
  Database,
  ExternalLink as ExternalLinkIcon,
  LayoutGrid,
  LifeBuoy,
  Receipt,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import {
  administrationDropdownNavigation,
  isAdministrationRoute,
  type NavigationItem,
} from "@/config/app-navigation";

type AdministrationDropdownProps = {
  /** URL publique Gedify résolue côté serveur (peut être null). */
  paperlessUrl: string | null;
  /** Superuser plateforme (multi-tenant) : affiche l'accès « Gestion clients ». */
  saasAdmin?: boolean;
  /** Client (multi-tenant non-superuser) : menu « Paramètres » au lieu d'« Administration ». */
  isClient?: boolean;
};

/** Menu « Paramètres » présenté aux clients (jamais d'admin globale). */
const CLIENT_SETTINGS: { section: string; items: NavigationItem[] }[] = [
  {
    section: "Mon espace",
    items: [
      { label: "Mon offre", href: "/settings/myplan", icon: CreditCard, description: "Plan, quotas, abonnement et factures." },
      { label: "Utilisateurs & équipe", href: "/settings/team", icon: Users, description: "Membres et invitations de votre espace." },
      { label: "Notifications", href: "/settings/notifications", icon: Bell, description: "Vos préférences d'alertes." },
      { label: "Sécurité du compte", href: "/account/security", icon: ShieldCheck, description: "Mot de passe, MFA, connexions." },
      { label: "Factures", href: "/settings/billing", icon: Receipt, description: "Vos factures." },
      { label: "Support", href: "/settings/support", icon: LifeBuoy, description: "Aide et assistance." },
      { label: "Export de mes données", href: "/settings/data", icon: Database, description: "Récupérez vos données." },
    ],
  },
];

/**
 * Pages techniques masquées du menu Administration pour offrir une interface
 * « utilisateur final » épurée (tokens, journaux, utilisateurs/groupes, statut
 * système, workflows non finalisés, rôles…). Masquées sur l'app de BUREAU ET sur
 * le WEB. Rien n'est supprimé : les pages restent accessibles par URL directe.
 */
const HIDDEN_TECHNICAL = new Set<string>([
  "/workflows",
  "/journaux",
  "/activite",
  "/utilisateurs",
  "/groupes",
  "/tokens",
  "/statut",
  "/administration/roles",
]);

function resolveItemHref(item: NavigationItem, paperlessUrl: string | null): string | null {
  if (item.external) {
    if (item.label === "Ouvrir Gedify") {
      return paperlessUrl ?? null;
    }
    return item.href || null;
  }
  return item.href;
}

export function AdministrationDropdown({ paperlessUrl, saasAdmin = false, isClient = false }: AdministrationDropdownProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const menuLabel = isClient ? "Paramètres" : "Administration";
  const MenuIcon = isClient ? Settings : SlidersHorizontal;
  const isActiveRoute = isClient ? pathname.startsWith("/settings") : isAdministrationRoute(pathname);

  // Client : menu « Paramètres » strictement tenant-scopé (aucune admin globale).
  // Sinon : menu Administration classique (filtré des pages techniques).
  let sections: { section: string; items: NavigationItem[] }[];
  if (isClient) {
    sections = CLIENT_SETTINGS;
  } else {
    sections = administrationDropdownNavigation
      .map((s) => ({ ...s, items: s.items.filter((i) => !HIDDEN_TECHNICAL.has(i.href)) }))
      .filter((s) => s.items.length > 0);
    // Superadmin plateforme uniquement : accès direct à la console SaaS.
    if (saasAdmin) {
      sections.unshift({
        section: "Plateforme SaaS",
        items: [{ label: "Gestion clients", href: "/admin/saas", icon: LayoutGrid, description: "Console SaaS : clients, plans, facturation, sécurité (superadmin)." }],
      });
    }
  }

  // Close on Escape + click outside
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        panelRef.current &&
        !panelRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Lock body scroll on mobile when the sheet is open
  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold transition ${
          open ? "ring-2" : ""
        } ${isActiveRoute || open ? "" : "hover:bg-slate-50"}`}
        style={{
          borderColor: isActiveRoute || open ? "rgba(11,92,255,0.4)" : "var(--border)",
          background: isActiveRoute || open ? "rgba(11,92,255,0.06)" : "white",
          color: isActiveRoute || open ? "var(--blue-600)" : "var(--text-main)",
        }}
      >
        <MenuIcon
          className="h-4 w-4"
          strokeWidth={1.75}
          aria-hidden="true"
          style={{
            color: isActiveRoute || open ? "var(--blue-600)" : "var(--text-muted)",
          }}
        />
        <span className="hidden sm:inline">{menuLabel}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <>
          {/* Backdrop on mobile */}
          <button
            type="button"
            aria-label="Fermer le menu Administration"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm md:hidden"
          />

          <div
            ref={panelRef}
            id={panelId}
            role="menu"
            aria-label="Menu Administration"
            className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl md:absolute md:bottom-auto md:inset-x-auto md:right-0 md:top-[calc(100%+8px)] md:max-h-[min(70vh,640px)] md:w-[min(720px,90vw)] md:rounded-2xl md:p-5"
            style={{
              border: "1px solid var(--border)",
              boxShadow: "0 24px 60px -20px rgba(8,18,37,0.28)",
            }}
          >
            <div className="flex items-center justify-between md:hidden mb-3">
              <p
                className="text-sm font-extrabold"
                style={{ color: "var(--text-main)" }}
              >
                {menuLabel}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border"
                style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section.section}>
                  <p
                    className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {section.section}
                  </p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const resolvedHref = resolveItemHref(item, paperlessUrl);
                      const isItemActive =
                        !item.external &&
                        !item.disabled &&
                        resolvedHref !== null &&
                        (pathname === resolvedHref ||
                          pathname.startsWith(`${resolvedHref}/`));

                      // Hide "Ouvrir Gedify" when no URL is configured.
                      if (item.external && item.label === "Ouvrir Gedify" && !resolvedHref) {
                        return null;
                      }

                      const inner = (
                        <div className="flex items-start gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                            style={{
                              background: isItemActive
                                ? "rgba(11,92,255,0.14)"
                                : item.disabled
                                ? "rgba(100,116,139,0.08)"
                                : "rgba(11,92,255,0.08)",
                              color: isItemActive
                                ? "var(--blue-600)"
                                : item.disabled
                                ? "var(--text-muted)"
                                : "var(--blue-600)",
                            }}
                          >
                            <Icon
                              className="h-4 w-4"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="truncate text-sm font-bold"
                                style={{
                                  color: item.disabled
                                    ? "var(--text-muted)"
                                    : "var(--text-main)",
                                }}
                              >
                                {item.label}
                              </span>
                              {item.badge ? (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                                  style={{
                                    background: "rgba(124,58,237,0.10)",
                                    color: "#7C3AED",
                                  }}
                                >
                                  {item.badge}
                                </span>
                              ) : null}
                              {item.external ? (
                                <ExternalLinkIcon
                                  className="h-3 w-3 shrink-0"
                                  strokeWidth={2}
                                  style={{ color: "var(--text-muted)" }}
                                  aria-hidden="true"
                                />
                              ) : null}
                            </div>
                            {item.description ? (
                              <p
                                className="mt-0.5 line-clamp-2 text-[11px] leading-snug"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );

                      const baseClass =
                        "block rounded-xl p-2.5 transition focus:outline-none focus-visible:ring-2";
                      const baseStyle = {
                        background: isItemActive
                          ? "rgba(11,92,255,0.04)"
                          : "transparent",
                        border: `1px solid ${isItemActive ? "rgba(11,92,255,0.2)" : "transparent"}`,
                      } as const;

                      if (item.disabled) {
                        return (
                          <span
                            key={item.label}
                            aria-disabled="true"
                            role="menuitem"
                            className={`${baseClass} cursor-not-allowed opacity-60`}
                            style={baseStyle}
                          >
                            {inner}
                          </span>
                        );
                      }

                      if (item.external && resolvedHref) {
                        return (
                          <a
                            key={item.label}
                            href={resolvedHref}
                            target="_blank"
                            rel="noreferrer"
                            role="menuitem"
                            className={`${baseClass} hover:bg-slate-50`}
                            style={baseStyle}
                            onClick={() => setOpen(false)}
                          >
                            {inner}
                          </a>
                        );
                      }

                      if (!resolvedHref) {
                        return null;
                      }

                      return (
                        <Link
                          key={item.label}
                          href={resolvedHref}
                          role="menuitem"
                          aria-current={isItemActive ? "page" : undefined}
                          className={`${baseClass} hover:bg-slate-50`}
                          style={baseStyle}
                          onClick={() => setOpen(false)}
                        >
                          {inner}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
