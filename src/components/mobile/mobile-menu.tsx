"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Briefcase,
  CalendarRange,
  ChevronRight,
  FileText,
  FolderTree,
  LogOut,
  Mail,
  Settings,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Entry = { label: string; href: string; icon: LucideIcon };

const ENTRIES: Entry[] = [
  { label: "Documents", href: "/documents", icon: FileText },
  { label: "Mails", href: "/messagerie", icon: Mail },
  { label: "Finances", href: "/finances", icon: Wallet },
  { label: "Contacts", href: "/correspondants", icon: Users },
  { label: "Rappels", href: "/rappels", icon: Bell },
  { label: "Calendrier", href: "/calendrier", icon: CalendarRange },
  { label: "Office", href: "/office", icon: Briefcase },
  { label: "Organiser", href: "/organiser", icon: FolderTree },
  { label: "Actions", href: "/actions", icon: Zap },
  { label: "Réglages", href: "/parametres", icon: Settings },
];

const SHOW_AMOUNTS_KEY = "ged.showAmounts";

/** Page Menu « app mobile » (< md) : accès secondaires + déconnexion. */
export function MobileMenu({ username }: { username: string | null }) {
  const [showAmounts, setShowAmounts] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // setState différé (microtâche) : évite le warning « setState dans un effet »
    // et tout décalage d'hydratation (le rendu initial garde la valeur par défaut).
    void Promise.resolve().then(() => setShowAmounts(localStorage.getItem(SHOW_AMOUNTS_KEY) !== "0"));
  }, []);

  function toggleAmounts() {
    setShowAmounts((prev) => {
      const next = !prev;
      localStorage.setItem(SHOW_AMOUNTS_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <div className="space-y-4 px-4 py-4 md:hidden">
      {/* Profil */}
      <div className="flex items-center gap-3 rounded-3xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-[18px] font-black text-white" style={{ background: "var(--accent)" }}>
          {username ? username[0].toUpperCase() : "G"}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-extrabold" style={{ color: "var(--text-main)" }}>{username ?? "Mon compte"}</p>
          <p className="text-[12px]" style={{ color: "var(--text-hint)" }}>Gedify</p>
        </div>
      </div>

      {/* Préférence : afficher les montants */}
      <button
        type="button"
        onClick={toggleAmounts}
        className="flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3.5"
        style={{ borderColor: "var(--border)" }}
      >
        <span className="flex items-center gap-3 text-[14px] font-semibold" style={{ color: "var(--text-main)" }}>
          <Wallet className="h-5 w-5" style={{ color: "var(--text-muted)" }} strokeWidth={1.85} aria-hidden="true" />
          Afficher les montants
        </span>
        <span className="relative h-6 w-11 rounded-full transition" style={{ background: showAmounts ? "var(--accent)" : "var(--border)" }}>
          <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all" style={{ left: showAmounts ? "22px" : "2px" }} />
        </span>
      </button>

      {/* Accès */}
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
        {ENTRIES.map((e, i) => {
          const Icon = e.icon;
          return (
            <Link
              key={e.href}
              href={e.href}
              className="flex items-center gap-3 px-4 py-3.5"
              style={{ borderTop: i === 0 ? undefined : "1px solid var(--border)" }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "var(--accent-soft)" }}>
                <Icon className="h-[18px] w-[18px]" style={{ color: "var(--accent)" }} strokeWidth={1.85} aria-hidden="true" />
              </span>
              <span className="flex-1 text-[14px] font-semibold" style={{ color: "var(--text-main)" }}>{e.label}</span>
              <ChevronRight className="h-4 w-4" style={{ color: "var(--text-hint)" }} strokeWidth={2} aria-hidden="true" />
            </Link>
          );
        })}
      </div>

      {/* Déconnexion */}
      <button
        type="button"
        onClick={() => void logout()}
        disabled={loggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-full border py-3.5 text-[14px] font-bold disabled:opacity-50"
        style={{ borderColor: "#FDECEC", color: "#EF4444", background: "#FFF" }}
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Déconnexion
      </button>
    </div>
  );
}
