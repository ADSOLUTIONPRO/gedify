"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { navigationGroups } from "@/lib/navigation";

type MobileSidebarProps = {
  badges?: Record<string, number | string | undefined>;
};

export function MobileSidebar({ badges }: MobileSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white"
                  style={{ background: "var(--blue-600)" }}
                >
                  G
                </span>
                <span>
                  <span className="block text-sm font-extrabold tracking-tight text-white">
                    GED AzServer
                  </span>
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

            <nav
              className="flex-1 space-y-4 overflow-y-auto px-2 py-3"
              aria-label="Navigation mobile"
            >
              {navigationGroups.map((group) => (
                <div key={group.name}>
                  <p
                    className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
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
                          onClick={() => setOpen(false)}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                            isActive ? "text-white" : "text-[#8AABCC] hover:text-white hover:bg-white/5"
                          }`}
                          style={isActive ? { background: "var(--blue-600)" } : undefined}
                        >
                          <Icon
                            aria-hidden="true"
                            className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-[#4A6A8A]"}`}
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
          </aside>
        </div>
      ) : null}
    </>
  );
}
