"use client";

import { type ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import {
  Archive,
  Ban,
  ChevronDown,
  ChevronRight,
  FileUp,
  Inbox,
  Mail,
  Paperclip,
  PenSquare,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  Trash2,
} from "lucide-react";

/* ── Thème Apple Mail (dominante ROUGE) ─────────────────────────────────── */
const RED = "#ff3b30";
const RED2 = "#fff0ef";
const LINE = "#e6e6eb";
const BG = "#f8f8fb";
const MUTED = "#8e8e93";

type FolderDef = { href: string; icon: React.ElementType; label: string; tone?: string };

const MAILBOXES: FolderDef[] = [
  { href: "/messagerie/inbox", icon: Inbox, label: "Boîte de réception" },
  { href: "/messagerie/inbox?q=in%3Ainbox+category%3Aprimary", icon: Sparkles, label: "Principal" },
  { href: "/messagerie/inbox?q=in%3Ainbox+category%3Apurchases", icon: ShoppingBag, label: "Transactions" },
  { href: "/messagerie/inbox?q=in%3Ainbox+category%3Aupdates", icon: Receipt, label: "Mises à jour" },
  { href: "/messagerie/inbox?q=in%3Ainbox+category%3Apromotions", icon: Tag, label: "Promotions" },
  { href: "/messagerie/inbox?q=is%3Astarred", icon: Star, label: "VIP", tone: "#ffb000" },
  { href: "/messagerie/brouillons", icon: PenSquare, label: "Brouillons" },
  { href: "/messagerie/envoyes", icon: Send, label: "Envoyés" },
  { href: "/messagerie/inbox?q=in%3Aspam", icon: Ban, label: "Indésirables" },
  { href: "/messagerie/inbox?q=in%3Atrash", icon: Trash2, label: "Corbeille" },
  { href: "/messagerie/archives", icon: Archive, label: "Archives" },
];

const FOLDERS: FolderDef[] = [
  { href: "/messagerie/pieces-jointes", icon: Paperclip, label: "Pièces jointes" },
  { href: "/messagerie/dossiers", icon: FileUp, label: "Liés à la GED" },
];

function NavItem({ folder, pathname }: { folder: FolderDef; pathname: string }) {
  // Détection « actif » basée sur le pathname seul (pas de useSearchParams →
  // évite un bascule CSR de toute la zone Messagerie). Les dossiers « catégorie »
  // (href avec ?q) ne sont pas mis en surbrillance (ils partagent /messagerie/inbox).
  const hasQuery = folder.href.includes("?");
  const path = folder.href.split("?")[0];
  const active = !hasQuery && (pathname === path || (path !== "/messagerie/inbox" && pathname.startsWith(path + "/")));
  const Icon = folder.icon;
  return (
    <Link
      href={folder.href}
      className="flex h-10 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[15px] transition"
      style={{ background: active ? "#e9e9ee" : "transparent", color: "#1d1d1f", fontWeight: active ? 600 : 400 }}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} style={{ color: folder.tone ?? RED }} aria-hidden="true" />
      <span className="flex-1 truncate">{folder.label}</span>
    </Link>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-full items-center gap-1 px-2 text-[12px] font-extrabold uppercase tracking-wide transition hover:opacity-70"
        style={{ color: MUTED }}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
        {title}
      </button>
      {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
}

type Props = { children: ReactNode; email?: string | null };

export function MessagerieShell({ children, email }: Props) {
  const pathname = usePathname();

  // La page Contacts (espace iCloud-like) gère sa propre pleine largeur.
  if (pathname.startsWith("/messagerie/contacts")) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-[calc(100vh-53px)]" style={{ background: "#fff" }}>
      {/* ────────────── Colonne 1 — Boîtes aux lettres ────────────── */}
      <aside className="hidden w-[270px] shrink-0 flex-col border-r md:flex" style={{ background: BG, borderColor: LINE }}>
        {/* Marque */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4">
          <div className="flex items-center gap-2.5 font-extrabold" style={{ color: "#1d1d1f" }}>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-lg text-[14px] text-white" style={{ background: RED }}>G</span>
            GEDify Mail
          </div>
          <Link href="/messagerie/parametres" className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[#fff0ef]" style={{ color: RED }} aria-label="Réglages">
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
        </div>

        {/* Nouveau message */}
        <button
          type="button"
          onClick={() => openComposer()}
          className="mx-3 mb-2 flex h-11 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white transition hover:opacity-95"
          style={{ background: `linear-gradient(135deg, ${RED}, #ff6259)` }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Nouveau message
        </button>

        {/* Liste */}
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-5">
          <h2 className="px-2 py-2.5 text-[24px] font-extrabold" style={{ color: "#1d1d1f" }}>Boîtes aux lettres</h2>
          <div className="space-y-0.5">
            {MAILBOXES.map((f) => <NavItem key={f.label} folder={f} pathname={pathname} />)}
          </div>
          <Section title="Dossiers">
            {FOLDERS.map((f) => <NavItem key={f.label} folder={f} pathname={pathname} />)}
          </Section>
        </div>

        {/* Pied : compte */}
        <div className="flex shrink-0 items-center gap-2.5 border-t px-4 py-3" style={{ borderColor: LINE }}>
          {email ? (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: RED2, color: RED }}>
                {email[0]?.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold" style={{ color: "#1d1d1f" }}>{email}</p>
                <p className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                  <RefreshCw className="h-3 w-3" strokeWidth={1.75} /> Synchronisé
                </p>
              </div>
            </>
          ) : (
            <Link href="/messagerie/parametres" className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: RED }}>
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
