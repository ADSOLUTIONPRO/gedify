"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Paperclip, Search, Star } from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { MobileFab } from "@/components/mobile/mobile-fab";
import type { EmailThreadRecord } from "@/lib/messaging/email-types";

type AttachSummary = { imported: number; error: boolean; docId: number | null };

type Props = {
  threads: EmailThreadRecord[];
  attachmentsByThread: Map<string, AttachSummary>;
  query: string;
};

const AVATAR_COLORS = ["#4285F4", "#EA4335", "#FBBC04", "#34A853", "#FF6D00", "#46BDC6", "#7B61FF", "#E91E63", "#009688", "#795548"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return `${p[0][0]}${p[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

function gedBadge(t: EmailThreadRecord, s: AttachSummary | undefined): { label: string; bg: string; color: string } | null {
  const imported = s?.imported ?? 0;
  if (t.hasAttachments && imported > 0) return { label: "Ajouté à la GED", bg: "#EAF8EF", color: "#15803D" };
  if (t.hasAttachments && imported === 0) return { label: "Non importée", bg: "#FDECF2", color: "#F75C8D" };
  if (t.unread) return { label: "À traiter", bg: "#FFF4E5", color: "#B45309" };
  return null;
}

/** Espace Mails en version « app mobile » (< md) — liste de cartes mail. */
export function MobileMails({ threads, attachmentsByThread, query }: Props) {
  const [search, setSearch] = useState("");

  const chips = [
    { label: "Boîte de réception", href: "/messagerie/inbox", active: query === "in:inbox", count: threads.length },
    { label: "À traiter", href: `/messagerie/inbox?q=${encodeURIComponent("in:inbox is:unread")}`, active: query.includes("is:unread"), count: threads.filter((t) => t.unread).length },
    { label: "Envoyés", href: "/messagerie/envoyes", active: false, count: null as number | null },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const sender = t.participants[0];
      return (
        (t.subject ?? "").toLowerCase().includes(q) ||
        (sender?.name ?? sender?.email ?? "").toLowerCase().includes(q) ||
        (t.snippet ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads, search]);

  return (
    <div className="px-4 py-4 pb-28 md:hidden">
      {/* Recherche */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-hint)" }} strokeWidth={1.75} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un expéditeur, un sujet…"
          className="h-12 w-full rounded-2xl border bg-white pl-10 pr-4 text-[14px] outline-none focus:border-[var(--accent)]"
          style={{ borderColor: "var(--border)" }}
        />
      </div>

      {/* Chips dossiers */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold"
            style={{
              background: c.active ? "var(--accent)" : "#fff",
              color: c.active ? "#fff" : "var(--text-muted)",
              border: `1px solid ${c.active ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {c.label}
            {c.count != null ? (
              <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: c.active ? "rgba(255,255,255,0.25)" : "var(--accent-soft)", color: c.active ? "#fff" : "var(--accent)" }}>
                {c.count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun message</p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>Cette boîte est vide ou aucun résultat.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((t) => {
            const sender = t.participants[0];
            const name = sender?.name ?? sender?.email ?? "(inconnu)";
            const badge = gedBadge(t, attachmentsByThread.get(t.id));
            return (
              <Link
                key={t.id}
                href={`/messagerie/thread/${t.id}`}
                className="flex gap-3 rounded-2xl border bg-white p-3"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: avatarColor(name) }} aria-hidden="true">
                  {initials(name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-[13.5px]" style={{ color: "#111827", fontWeight: t.unread ? 800 : 600 }}>{name}</p>
                    <span className="shrink-0 text-[11px]" style={{ color: t.unread ? "var(--accent)" : "var(--text-hint)" }}>{formatTime(t.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-[13px]" style={{ color: "#111827", fontWeight: t.unread ? 700 : 500 }}>{t.subject ?? "(sans sujet)"}</p>
                  <p className="truncate text-[12px]" style={{ color: "var(--text-hint)" }}>{t.snippet ?? ""}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    {t.hasAttachments ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>
                        <Paperclip className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                        {t.attachmentCount > 0 ? `${t.attachmentCount} PJ` : "PJ"}
                      </span>
                    ) : null}
                    {badge ? (
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: badge.bg, color: badge.color }}>{badge.label}</span>
                    ) : null}
                    {t.important ? <Star className="ml-auto h-3.5 w-3.5" style={{ color: "#FBBC04" }} fill="#FBBC04" strokeWidth={1.5} aria-hidden="true" /> : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <MobileFab label="Nouveau message" onClick={() => openComposer({})} />
    </div>
  );
}
