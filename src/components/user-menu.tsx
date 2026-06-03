"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  Loader2,
  LogOut,
  Server,
  Settings,
  UserCircle,
} from "lucide-react";

type UserMenuProps = {
  initials?: string;
  label?: string;
  username?: string | null;
};

const items = [
  { name: "Mon profil", href: "/profil", icon: UserCircle },
  { name: "Tokens API", href: "/tokens", icon: KeyRound },
  { name: "Paramètres", href: "/parametres", icon: Settings },
  { name: "Statut système", href: "/statut", icon: Server },
];

export function UserMenu({ initials = "N", label = "Compte", username }: UserMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore — on redirige quand même
    }
    router.push("/login");
    router.refresh();
  }

  const displayInitials = username ? username[0].toUpperCase() : initials;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 transition hover:opacity-90"
        style={{ borderColor: "var(--blue-600)", background: "var(--blue-600)" }}
        title={username ?? "Compte"}
      >
        <span className="text-[13px] font-bold text-white">{displayInitials}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border bg-white shadow-xl"
          style={{ borderColor: "var(--border)", boxShadow: "var(--shadow-xl)" }}
        >
          {/* En-tête compte */}
          <div className="border-b px-4 py-3" style={{ borderColor: "var(--border-soft)" }}>
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white"
                style={{ background: "var(--blue-600)" }}
              >
                {displayInitials}
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-hint)" }}>
                  Compte Gedify
                </p>
                {username ? (
                  <p className="truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>
                    {username}
                  </p>
                ) : (
                  <p className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>
                    Espace personnel
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="p-1.5">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition hover:bg-slate-50"
                  style={{ color: "var(--text-main)" }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Déconnexion */}
          <div className="border-t p-1.5" style={{ borderColor: "var(--border-soft)" }}>
            <button
              type="button"
              onClick={() => { setOpen(false); void handleLogout(); }}
              disabled={loggingOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition hover:bg-rose-50 disabled:opacity-60"
              style={{ color: "#D93025" }}
            >
              {loggingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              {loggingOut ? "Déconnexion…" : "Déconnexion"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
