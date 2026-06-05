"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  FileUp,
  FolderClosed,
  FolderOpen,
  HardDrive,
  Inbox,
  Mail,
  MoreHorizontal,
  Paperclip,
  PenSquare,
  Send,
  Star,
  Trash2,
} from "lucide-react";

const BLUE = "#F75C8D";

// ── Helpers ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  icon: Icon,
  label,
  badge,
  pathname,
  indent = 0,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: string | number;
  pathname: string;
  indent?: number;
}) {
  const isActive =
    pathname === href.split("?")[0] ||
    (href !== "/messagerie" && pathname.startsWith(href.split("?")[0]));
  return (
    <Link
      href={href}
      className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] transition"
      style={{
        paddingLeft: `${8 + indent * 16}px`,
        background: isActive ? `${BLUE}12` : "transparent",
        color: isActive ? BLUE : "#374151",
        fontWeight: isActive ? 600 : 400,
      }}
    >
      <Icon
        className="h-[15px] w-[15px] shrink-0"
        strokeWidth={1.75}
        style={{ color: isActive ? BLUE : "#9CA3AF" }}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge !== undefined && badge !== 0 && badge !== "" && (
        <span
          className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
          style={{ background: isActive ? BLUE : "#E5E7EB", color: isActive ? "#fff" : "#374151" }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-full items-center gap-1 px-2 text-[11.5px] font-semibold uppercase tracking-wide transition hover:opacity-70"
        style={{ color: "#9CA3AF" }}
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
        )}
        {title}
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

// ── Shell ─────────────────────────────────────────────────────────────────────

type Props = {
  children: ReactNode;
  email?: string | null;
};

export function MessagerieShell({ children, email }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex h-[calc(100vh-53px)]" style={{ background: "#F9FAFB" }}>
      {/* ────────────── Sidebar ────────────── */}
      <aside
        className="hidden w-[230px] shrink-0 flex-col border-r bg-white md:flex"
        style={{ borderColor: "#E5E7EB" }}
      >
        <div className="flex flex-col gap-2 overflow-y-auto p-3 flex-1">

          {/* En-tête de l'espace (la sidebar générique d'espace est masquée sur /messagerie) */}
          <div className="mb-1 flex items-center gap-2 px-1">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)" }}>
              <Mail className="h-4 w-4" style={{ color: "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold" style={{ color: "#111827" }}>Messagerie</p>
              <p className="truncate text-[10.5px]" style={{ color: "#9CA3AF" }}>Emails &amp; pièces jointes</p>
            </div>
          </div>

          {/* Nouveau message → fenêtre de rédaction globale */}
          <button
            type="button"
            onClick={() => openComposer()}
            className="mb-1 flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-bold text-white shadow-sm transition hover:shadow-md active:opacity-90"
            style={{ background: BLUE }}
          >
            <PenSquare className="h-4 w-4" strokeWidth={2} />
            Nouveau message
          </button>

          {/* Inbox */}
          <NavItem href="/messagerie/inbox" icon={Inbox} label="Boîte de réception" pathname={pathname} />

          {/* Section Exchange */}
          <Section title="Messages">
            <NavItem href="/messagerie/envoyes" icon={Send} label="Envoyés" pathname={pathname} indent={1} />
            <NavItem href="/messagerie/brouillons" icon={PenSquare} label="Brouillons" pathname={pathname} indent={1} />
            <NavItem href="/messagerie/inbox?q=in:spam" icon={Mail} label="Spam" pathname={pathname} indent={1} />
            <NavItem href="/messagerie/inbox?q=in:trash" icon={Trash2} label="Corbeille" pathname={pathname} indent={1} />
            <NavItem href="/messagerie/archives" icon={Archive} label="Archives" pathname={pathname} indent={1} />
          </Section>

          {/* Section Flagged */}
          <Section title="Suivis" defaultOpen={false}>
            <NavItem href="/messagerie/inbox?q=is:starred" icon={Star} label="Importants" pathname={pathname} indent={1} />
          </Section>

          {/* Section Dossiers GED */}
          <Section title="Dossiers">
            <NavItem href="/messagerie/pieces-jointes" icon={Paperclip} label="Pièces jointes" pathname={pathname} indent={1} />
            <NavItem href="/messagerie/dossiers" icon={FileUp} label="Liés à la GED" pathname={pathname} indent={1} />
          </Section>

          {/* Expéditeurs masqués */}
          <div className="mt-1 space-y-0.5">
            <NavItem href="/messagerie/expediteurs-masques" icon={FolderClosed} label="Expéditeurs masqués" pathname={pathname} />
            <NavItem href="/messagerie/contacts" icon={FolderOpen} label="Contacts" pathname={pathname} />
            <NavItem href="/messagerie/parametres" icon={MoreHorizontal} label="Paramètres" pathname={pathname} />
          </div>
        </div>

        {/* Bas de sidebar */}
        <div
          className="border-t px-3 py-3 space-y-2"
          style={{ borderColor: "#E5E7EB" }}
        >
          {/* Compte + stockage */}
          {email && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "#D93025" }}
                >
                  {email[0]?.toUpperCase()}
                </span>
                <span className="truncate text-[11.5px] font-medium" style={{ color: "#374151" }}>
                  {email}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10.5px]" style={{ color: "#9CA3AF" }}>
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-3 w-3" strokeWidth={1.75} />
                    Stockage
                  </span>
                  <span>5 Go sur 20 Go</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#E5E7EB" }}>
                  <div className="h-full rounded-full" style={{ width: "25%", background: BLUE }} />
                </div>
              </div>
            </div>
          )}
          {!email && (
            <Link href="/messagerie/parametres" className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: BLUE }}>
              <Mail className="h-4 w-4" strokeWidth={1.75} />
              Connecter Gmail →
            </Link>
          )}
        </div>
      </aside>

      {/* ────────────── Contenu ────────────── */}
      {/* overflow-y-auto (et non hidden) : les pages à hauteur fixe (inbox) gèrent
          leur propre scroll interne via h-full ; les pages longues (conversation,
          paramètres) défilent naturellement ici. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        {children}
      </div>
    </div>
  );
}
