"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { navigationGroups } from "@/lib/navigation";

type SidebarProps = {
  footer?: ReactNode;
  badges?: Record<string, number | string | undefined>;
};

export function Sidebar({ footer, badges }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 hidden w-[246px] lg:flex">
      <div
        className="flex h-full w-full flex-col overflow-hidden px-2.5 py-3.5"
        style={{ background: "var(--navy-900)" }}
      >
        {/* Logo */}
        <Link
          href="/dashboard"
          className="mb-4 flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/5"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
            style={{ background: "var(--blue-600)" }}
          >
            G
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold tracking-tight text-white">
              GED AzServer
            </span>
            <span className="block truncate text-[10px] font-medium" style={{ color: "#7A9CC8" }}>
              Espace documentaire
            </span>
          </span>
        </Link>

        {/* Navigation */}
        <nav
          className="flex-1 space-y-3 overflow-y-auto pr-0.5 scrollbar-thin"
          aria-label="Navigation principale"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}
        >
          {navigationGroups.map((group) => (
            <div key={group.name}>
              <p
                className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: "#4A6A8A" }}
              >
                {group.name}
              </p>
              <div>
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  const badge = item.badgeKey ? badges?.[item.badgeKey] : undefined;
                  const showBadge =
                    badge !== undefined && badge !== null && badge !== 0 && badge !== "";

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`group flex h-8 items-center gap-2 rounded-lg px-2.5 text-[12px] font-medium transition-colors ${
                        isActive ? "text-white" : "text-[#8AABCC] hover:text-white hover:bg-white/5"
                      }`}
                      style={
                        isActive
                          ? { background: "var(--blue-600)" }
                          : undefined
                      }
                    >
                      <Icon
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive ? "text-white" : "text-[#4A6A8A] group-hover:text-[#8AABCC]"
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="flex-1 truncate">{item.name}</span>
                      {showBadge ? (
                        <span
                          className={`inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                            isActive ? "bg-white/20 text-white" : "text-white"
                          }`}
                          style={
                            isActive
                              ? undefined
                              : { background: "var(--blue-600)" }
                          }
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer connection card */}
        {footer ? (
          <div
            className="mt-3 rounded-xl border p-3"
            style={{ background: "#040E1E", borderColor: "rgba(255,255,255,0.07)" }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
