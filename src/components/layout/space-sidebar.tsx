"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { SpaceNavItem } from "@/config/space-navigation";

type SpaceSidebarProps = {
  items: SpaceNavItem[];
  /** Couleur de domaine de l'espace (accent de l'onglet actif). */
  color: string;
};

function splitHref(href: string): { base: string; params: URLSearchParams } {
  const [base, query = ""] = href.split("?");
  return { base, params: new URLSearchParams(query) };
}

/**
 * Navigation interne d'un espace, rendue en onglets horizontaux (cf. maquettes :
 * « Tout les documents · Récents · … » en haut de chaque espace).
 *
 * L'onglet actif est déterminé de façon « query-aware » : on compare le
 * pathname puis, pour l'ensemble des clés de query utilisées par le groupe
 * d'onglets, la valeur courante à celle de l'onglet (absente = ""). Cela
 * permet de distinguer `?state=todo` de l'onglet « Tous » (sans query).
 */
export function SpaceSidebar({ items, color }: SpaceSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (items.length === 0) return null;

  // Union des clés de query contrôlées par ce groupe d'onglets.
  const controlledKeys = new Set<string>();
  for (const item of items) {
    splitHref(item.href).params.forEach((_value, key) => controlledKeys.add(key));
  }

  // Longueur du `base` le plus long qui matche le pathname courant — évite
  // qu'un onglet index (ex. « /organiser ») soit actif sur ses sous-routes
  // (« /organiser/types »).
  const matchesPath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const bestBaseLength = items.reduce((max, item) => {
    const { base } = splitHref(item.href);
    return matchesPath(base) ? Math.max(max, base.length) : max;
  }, 0);

  function isActive(href: string): boolean {
    const { base, params } = splitHref(href);
    if (!matchesPath(base) || base.length !== bestBaseLength) return false;
    for (const key of controlledKeys) {
      if ((searchParams.get(key) ?? "") !== (params.get(key) ?? "")) return false;
    }
    return true;
  }

  return (
    <nav aria-label="Navigation de l'espace">
      <div
        className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
        style={{ borderColor: "var(--border)", scrollbarWidth: "none" }}
      >
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="relative flex h-10 shrink-0 items-center whitespace-nowrap px-3 text-[13px] font-medium transition-colors"
              style={{ color: active ? color : "var(--text-muted)" }}
            >
              {item.label}
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full"
                  style={{ background: color }}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
