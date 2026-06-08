"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarPlus,
  CheckCircle2,
  CornerUpLeft,
  FolderPlus,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  MoreHorizontal,
  PenSquare,
  ReplyAll,
  Trash2,
  UserPlus,
} from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { CreateCalendarItemModal } from "@/components/calendar/create-calendar-item-modal";
import { initials } from "./mail-list-utils";
import type { EmailMessageRecord } from "@/lib/messaging/email-types";

/* ── Thème Apple Mail (dominante ROUGE) ─────────────────────────────────── */
const RED = "var(--accent)";
const RED2 = "var(--accent-soft)";
const LINE = "var(--border)";
const MUTED = "var(--text-muted)";
const HINT = "var(--text-hint)";

type ThreadDetail = {
  accountEmail: string;
  messages: EmailMessageRecord[];
  links?: unknown[];
};

type Att = { attachmentId: string; messageId: string; filename: string; mimeType: string; size: number };

type Props = {
  threadId: string | null;
  folderLabel: string;
  onClassify: (threadId: string) => void;
  onArchive?: (threadId: string) => void;
  onTrash?: (threadId: string) => void;
  onMarkUnread?: (threadId: string) => void;
};

export function MailReadingPane({ threadId, onClassify, onArchive, onTrash, onMarkUnread }: Props) {
  const [data, setData] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMenuOpen(false); }, [threadId]);

  useEffect(() => {
    if (!threadId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/messaging/gmail/threads/${threadId}`, { credentials: "include", cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ThreadDetail;
      })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Lecture impossible."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [threadId]);

  if (!threadId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: HINT }}>
        <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: RED2, color: RED }}>
          <Mail className="h-7 w-7" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-[16px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun message sélectionné</p>
        <p className="mt-1 text-[13px]">Choisissez un e-mail dans la liste pour le lire ici.</p>
      </div>
    );
  }
  if (loading) {
    return <div className="flex h-full items-center justify-center" style={{ color: HINT }}><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }
  if (error || !data || data.messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: HINT }}>
        <Mail className="mb-3 h-9 w-9" strokeWidth={1.25} />
        <p className="text-[14px] font-semibold" style={{ color: "var(--text-main)" }}>Message indisponible</p>
        {error ? <p className="mt-1 text-[12px]">{error}</p> : null}
      </div>
    );
  }

  const sorted = [...data.messages].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const sender = latest.from;
  const senderDisplay = sender?.name ?? sender?.email ?? "Inconnu";
  const accountEmail = data.accountEmail;

  const attachments: Att[] = data.messages.flatMap((m) =>
    m.attachments.filter((a) => !a.inline).map((a) => ({ attachmentId: a.attachmentId, messageId: m.id, filename: a.filename, mimeType: a.mimeType, size: a.size })),
  );

  function reply(all: boolean) {
    const recipients = all
      ? [sender?.email, ...latest.to.map((t) => t.email), ...latest.cc.map((c) => c.email)]
      : [sender?.email];
    const to = [...new Set(recipients.filter((e): e is string => Boolean(e) && e !== accountEmail))];
    openComposer({ to: to.join(", "), subject: `Re: ${latest.subject ?? ""}`.trim(), threadId: threadId ?? undefined, inReplyTo: latest.id });
  }
  function forward() {
    openComposer({ subject: `Tr: ${latest.subject ?? ""}`.trim(), threadId: threadId ?? undefined, inReplyTo: latest.id });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Barre d'actions */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4" style={{ borderColor: LINE }}>
        <IconBtn icon={PenSquare} label="Nouveau message" onClick={() => openComposer()} />
        <div className="flex items-center gap-0.5">
          <IconBtn icon={CornerUpLeft} label="Répondre" onClick={() => reply(false)} />
          <IconBtn icon={ReplyAll} label="Répondre à tous" onClick={() => reply(true)} />
          <IconBtn icon={Forward} label="Transférer" onClick={forward} />
          <IconBtn icon={CalendarPlus} label="Créer un RDV / une tâche" onClick={() => setCalOpen(true)} />
          <IconBtn icon={Archive} label="Archiver" onClick={() => threadId && onArchive?.(threadId)} />
          <IconBtn icon={Trash2} label="Supprimer" onClick={() => threadId && onTrash?.(threadId)} />
          <div className="relative">
            <IconBtn icon={MoreHorizontal} label="Plus" onClick={() => setMenuOpen((v) => !v)} />
            {menuOpen ? (
              <>
                <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border bg-white py-1 shadow-xl" style={{ borderColor: LINE }} role="menu">
                  <MenuItem icon={FolderPlus} label="Classer dans un dossier…" onClick={() => { setMenuOpen(false); if (threadId) onClassify(threadId); }} />
                  <MenuItem icon={MailOpen} label="Marquer comme non lu" onClick={() => { setMenuOpen(false); if (threadId) onMarkUnread?.(threadId); }} />
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-7 lg:px-9">
        {/* En-tête du mail */}
        <header className="grid grid-cols-[46px_1fr_auto] gap-3.5 border-b pb-5" style={{ borderColor: "var(--border-soft)" }}>
          <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[15px] font-extrabold" style={{ background: RED2, color: RED }}>
            {initials(senderDisplay)}
          </span>
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold leading-snug" style={{ color: "var(--text-main)" }}>{latest.subject ?? "(sans sujet)"}</h1>
            <p className="mt-1 text-[14px]" style={{ color: MUTED }}>
              <strong style={{ color: "var(--text-main)" }}>{senderDisplay}</strong>
              {sender?.email ? <> &lt;{sender.email}&gt;</> : null}
              <br />À : {latest.to.map((t) => t.email).join(", ") || accountEmail}
            </p>
          </div>
          <span className="text-right text-[13px]" style={{ color: HINT }}>{formatDateBlock(latest.date)}</span>
        </header>

        {/* Corps */}
        <div className="max-w-[820px] whitespace-pre-wrap py-7 text-[16px] leading-relaxed" style={{ color: "var(--text-main)" }}>
          {latest.bodyText.trim().slice(0, 12000) || "(corps vide)"}
        </div>

        {sorted.length > 1 ? (
          <Link href={`/messagerie/thread/${threadId}`} className="mb-5 inline-flex text-[13.5px] font-semibold" style={{ color: RED }}>
            Voir les {sorted.length} messages du fil →
          </Link>
        ) : null}

        {/* Pièces jointes */}
        {attachments.length > 0 ? (
          <div className="max-w-[660px] space-y-2.5">
            {attachments.map((a) => <AttachmentCard key={a.attachmentId} att={a} threadId={threadId!} />)}
          </div>
        ) : null}

        {/* Actions */}
        <div className="mt-7 flex flex-wrap gap-2.5 border-t pt-6" style={{ borderColor: "var(--border-soft)" }}>
          <ActionBtn primary onClick={() => reply(false)}>Répondre</ActionBtn>
          <ActionBtn onClick={forward}>Transférer</ActionBtn>
          <ActionBtn onClick={() => setCalOpen(true)}>Créer un RDV / une tâche</ActionBtn>
          <ActionLink href="/messagerie/contacts" icon={UserPlus}>Lier à un contact</ActionLink>
        </div>
      </div>

      {calOpen ? (
        <CreateCalendarItemModal
          source={{ sourceType: "email", sourceId: threadId ?? latest.id, sourceLabel: latest.subject ?? "Email" }}
          prefill={{ title: latest.subject ?? "", startISO: latest.date ?? undefined }}
          onClose={() => setCalOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ── Sous-composants ── */

function IconBtn({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-[9px] transition hover:bg-[var(--accent-soft)]" style={{ color: RED }}>
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function MenuItem({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13.5px] font-semibold transition hover:bg-[var(--accent-soft)]"
      style={{ color: "var(--text-main)" }}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.85} style={{ color: RED }} aria-hidden="true" /> {label}
    </button>
  );
}

function ActionBtn({ children, primary, onClick }: { children: React.ReactNode; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[10px] border px-3.5 py-2 text-[14px] font-semibold transition hover:opacity-90"
      style={primary ? { background: RED, borderColor: RED, color: "#fff" } : { borderColor: LINE, background: "#fff", color: "var(--text-main)" }}
    >
      {children}
    </button>
  );
}

function ActionLink({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[14px] font-semibold transition hover:opacity-90" style={{ borderColor: LINE, background: "#fff", color: "var(--text-main)" }}>
      <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> {children}
    </Link>
  );
}

function AttachmentCard({ att, threadId }: { att: Att; threadId: string }) {
  const [status, setStatus] = useState<"none" | "importing" | "imported" | "error">("none");
  async function importToGed() {
    if (status === "importing" || status === "imported") return;
    setStatus("importing");
    try {
      const res = await fetch("/api/messaging/attachments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mailId: att.messageId, threadId, attachmentId: att.attachmentId, filename: att.filename, mimeType: att.mimeType, sizeBytes: att.size }),
      });
      setStatus(res.ok ? "imported" : "error");
    } catch {
      setStatus("error");
    }
  }
  const ext = (att.filename.split(".").pop() ?? "").slice(0, 4).toUpperCase() || "FIC";
  return (
    <div className="flex items-center gap-3 rounded-[13px] border p-3.5" style={{ borderColor: LINE, background: "var(--bg-card-soft)" }}>
      <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-[12px] font-extrabold" style={{ background: RED2, color: RED }}>{ext}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold" style={{ color: "var(--text-main)" }} title={att.filename}>{att.filename}</p>
        <p className="text-[12px]" style={{ color: HINT }}>{ext} · {Math.max(1, Math.round(att.size / 1024))} Ko</p>
      </div>
      {status === "imported" ? (
        <span className="inline-flex items-center gap-1 text-[12.5px] font-bold" style={{ color: "var(--gedify-green)" }}>
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Ajouté à la GED
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void importToGed()}
          disabled={status === "importing"}
          className="rounded-[9px] border px-3 py-1.5 text-[12.5px] font-bold transition hover:bg-[var(--accent-soft)] disabled:opacity-60"
          style={{ borderColor: "var(--border)", background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {status === "importing" ? "Import…" : status === "error" ? "Réessayer" : "Ajouter à la GED"}
        </button>
      )}
    </div>
  );
}

function formatDateBlock(iso: string | null): React.ReactNode {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return (
    <>
      {d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
      <br />
      {d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
    </>
  );
}
