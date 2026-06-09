"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import {
  CheckCircle2,
  EyeOff,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Settings,
} from "lucide-react";

/* ── Thème Apple Mail (dominante ROUGE) ─────────────────────────────────── */
const RED = "var(--accent)";
const RED2 = "var(--accent-soft)";
const LINE = "var(--border)";
const BG = "var(--surface-muted)";
const MUTED = "var(--text-hint)";

export type MailSidebarCounts = {
  toProcess?: number | null;
  processed?: number;
  attachments?: number;
  hidden?: number;
};

type NavDef = { href: string; icon: React.ElementType; label: string; count?: number | null };

function NavItem({ item, pathname }: { item: NavDef; pathname: string }) {
  const path = item.href.split("?")[0];
  const active = pathname === path || (path !== "/messagerie" && pathname.startsWith(path + "/"));
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[15px] transition hover:bg-[var(--bg-card-soft)]"
      style={{ background: active ? "var(--accent-soft)" : "transparent", color: "var(--text-main)", fontWeight: active ? 600 : 400 }}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} style={{ color: RED }} aria-hidden="true" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.count != null && item.count > 0 ? (
        <span className="text-[13px]" style={{ color: active ? RED : MUTED }}>{item.count.toLocaleString("fr-FR")}</span>
      ) : null}
    </Link>
  );
}

type Props = { children: ReactNode; email?: string | null; counts?: MailSidebarCounts };

export function MessagerieShell({ children, email, counts }: Props) {
  const pathname = usePathname();

  // La page Contacts (espace iCloud-like) gère sa propre pleine largeur.
  if (pathname.startsWith("/messagerie/contacts")) {
    return <>{children}</>;
  }

  const MAIN: NavDef[] = [
    { href: "/messagerie/inbox", icon: Inbox, label: "Courriels à traiter", count: counts?.toProcess ?? null },
    { href: "/messagerie/importes", icon: CheckCircle2, label: "Importés en GED", count: counts?.processed ?? null },
  ];
  const TOOLS: NavDef[] = [
    { href: "/messagerie/pieces-jointes", icon: Paperclip, label: "Pièces jointes", count: counts?.attachments ?? null },
    { href: "/messagerie/expediteurs-masques", icon: EyeOff, label: "Expéditeurs masqués", count: counts?.hidden ?? null },
    { href: "/messagerie/parametres-emails", icon: Settings, label: "Paramètres des Emails" },
  ];

  return (
    <div className="flex h-[calc(100vh-53px)]" style={{ background: "#fff" }}>
      {/* ────────────── Colonne 1 — Navigation ────────────── */}
      <aside className="hidden w-[270px] shrink-0 flex-col border-r md:flex" style={{ background: BG, borderColor: LINE }}>
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2.5 font-extrabold" style={{ color: "var(--text-main)" }}>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[14px] text-white" style={{ background: RED }}>G</span>
            GEDify Mail
          </div>
        </div>

        <button
          type="button"
          onClick={() => openComposer()}
          className="mx-3 mb-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white transition hover:opacity-95"
          style={{ background: `linear-gradient(135deg, ${RED}, var(--accent))` }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nouveau message
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-5">
          <h2 className="px-2 py-2.5 text-[24px] font-extrabold" style={{ color: "var(--text-main)" }}>Messagerie</h2>
          <div className="space-y-0.5">
            {MAIN.map((f) => <NavItem key={f.label} item={f} pathname={pathname} />)}
          </div>
          <div className="my-3 border-t" style={{ borderColor: LINE }} />
          <div className="space-y-0.5">
            {TOOLS.map((f) => <NavItem key={f.label} item={f} pathname={pathname} />)}
          </div>
        </div>

        {/* Pied : compte */}
        <div className="flex shrink-0 items-center gap-2.5 border-t px-4 py-3" style={{ borderColor: LINE }}>
          {email ? (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: RED2, color: RED }}>
                {email[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold" style={{ color: "var(--text-main)" }}>{email}</p>
                <p className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                  <RefreshCw className="h-3 w-3" strokeWidth={1.75} /> Synchronisé
                </p>
              </div>
            </>
          ) : (
            <Link href="/messagerie/parametres-emails" className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: RED }}>
              <Mail className="h-4 w-4" strokeWidth={1.75} /> Connecter une boîte mail →
            </Link>
          )}
        </div>
      </aside>

      {/* ────────────── Colonnes 2 + 3 (liste + lecture) ────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ background: "#fff" }}>
        {children}
      </div>
    </div>
  );
}
