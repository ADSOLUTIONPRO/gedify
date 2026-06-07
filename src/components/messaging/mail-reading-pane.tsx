"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CheckSquare,
  CornerUpLeft,
  FolderInput,
  FolderPlus,
  Forward,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Printer,
  ReplyAll,
  Upload,
} from "lucide-react";
import { ThreadAttachmentsCard, type ThreadAttachment } from "./thread-attachments-card";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { avatarColor, formatFull, initials } from "./mail-list-utils";
import type { EmailMessageRecord } from "@/lib/messaging/email-types";

type ThreadDetail = {
  accountEmail: string;
  messages: EmailMessageRecord[];
  analysis: { summary?: string | null; category?: string | null } | null;
  links?: unknown[];
};

type Props = {
  threadId: string | null;
  folderLabel: string;
  /** Ouvre le panneau « Classer / Associer à un dossier » pour ce thread. */
  onClassify: (threadId: string) => void;
};

export function MailReadingPane({ threadId, folderLabel, onClassify }: Props) {
  const [data, setData] = useState<ThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // ── État vide ──
  if (!threadId) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--text-hint)" }}>
        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)" }}>
          <Mail className="h-7 w-7" style={{ color: "var(--accent)" }} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>Sélectionnez un message</p>
        <p className="mt-1 text-[12.5px]">Choisissez un email dans la liste pour le lire ici.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center" style={{ color: "var(--text-hint)" }}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error || !data || data.messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center" style={{ color: "var(--text-hint)" }}>
        <Mail className="mb-3 h-9 w-9" strokeWidth={1.25} />
        <p className="text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>Message indisponible</p>
        {error ? <p className="mt-1 text-[12px]">{error}</p> : null}
      </div>
    );
  }

  const sorted = [...data.messages].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));
  const latest = sorted[sorted.length - 1];
  const sender = latest.from;
  const senderDisplay = sender?.name ?? sender?.email ?? "Inconnu";
  const color = avatarColor(senderDisplay);

  const attachments: ThreadAttachment[] = data.messages.flatMap((m) =>
    m.attachments
      .filter((a) => !a.inline)
      .map((a) => ({
        attachmentId: a.attachmentId,
        messageId: m.id,
        filename: a.filename,
        mimeType: a.mimeType,
        size: a.size,
        status: "none" as const,
        documentId: null,
      })),
  );

  const hasGedLink = Array.isArray(data.links) && data.links.length > 0;
  const accountEmail = data.accountEmail;

  function reply(all: boolean) {
    const recipients = all
      ? [sender?.email, ...latest.to.map((t) => t.email), ...latest.cc.map((c) => c.email)]
      : [sender?.email];
    const to = [...new Set(recipients.filter((e): e is string => Boolean(e) && e !== accountEmail))];
    openComposer({
      to: to.join(", "),
      subject: `Re: ${latest.subject ?? ""}`.trim(),
      threadId: threadId ?? undefined,
      inReplyTo: latest.id,
    });
  }

  function forward() {
    openComposer({
      subject: `Tr: ${latest.subject ?? ""}`.trim(),
      threadId: threadId ?? undefined,
      inReplyTo: latest.id,
    });
  }

  return (
    <div className="flex h-full flex-col bg-white">
      {/* ── Barre d'actions ── */}
      <div className="flex items-center gap-1 border-b px-4 py-2.5" style={{ borderColor: "var(--border)" }}>
        <ToolbarButton icon={CornerUpLeft} label="Répondre" onClick={() => reply(false)} />
        <ToolbarButton icon={ReplyAll} label="Répondre à tous" onClick={() => reply(true)} />
        <ToolbarButton icon={Forward} label="Transférer" onClick={forward} />
        <ToolbarButton icon={FolderInput} label="Déplacer" onClick={() => threadId && onClassify(threadId)} />
        <ToolbarButton icon={MoreHorizontal} label="Plus" onClick={() => threadId && onClassify(threadId)} />
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton icon={Printer} label="Imprimer" onClick={() => window.print()} />
          <IconButton icon={Archive} label="Archiver" onClick={() => threadId && onClassify(threadId)} />
        </div>
      </div>

      {/* ── Contenu défilant ── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Sujet + badges */}
        <h2 className="text-[20px] font-extrabold leading-tight" style={{ color: "var(--text-main)" }}>
          {latest.subject ?? "(sans sujet)"}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {attachments.length > 0 && (
            <Badge bg="#EDE9FE" color="#6D28D9" icon={Paperclip}>
              {attachments.length} pièce{attachments.length > 1 ? "s" : ""} jointe{attachments.length > 1 ? "s" : ""}
            </Badge>
          )}
          {hasGedLink && <Badge bg="var(--accent-soft)" color="var(--accent)">Lié à la GED</Badge>}
          <Badge bg="#F3F4F6" color="#6B7280">{folderLabel}</Badge>
        </div>

        {/* Carte expéditeur */}
        <div className="mt-5 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[15px] font-bold text-white" style={{ background: color }}>
            {initials(senderDisplay)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[14px] font-bold" style={{ color: "var(--text-main)" }}>{senderDisplay}</p>
              <span className="text-[12px]" style={{ color: "var(--text-hint)" }}>{formatFull(latest.date)}</span>
            </div>
            {sender?.email && (
              <p className="truncate text-[12.5px]" style={{ color: "var(--accent)" }}>{sender.email}</p>
            )}
            <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--text-muted)" }}>
              À : {latest.to.map((t) => t.email).join(", ") || data.accountEmail}
            </p>
          </div>
        </div>

        {/* Corps du message */}
        <div
          className="mt-5 whitespace-pre-wrap rounded-2xl border p-4 text-[13.5px] leading-relaxed"
          style={{ borderColor: "var(--border)", background: "#FCFCFD", color: "var(--text-main)" }}
        >
          {latest.bodyText.trim().slice(0, 12000) || "(corps vide)"}
        </div>

        {sorted.length > 1 && (
          <Link
            href={`/messagerie/thread/${threadId}`}
            className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Voir les {sorted.length} messages du fil →
          </Link>
        )}

        {/* Pièces jointes */}
        {attachments.length > 0 && (
          <div className="mt-6">
            <ThreadAttachmentsCard threadId={threadId} attachments={attachments} />
          </div>
        )}

        {/* Gérer avec GEDify */}
        <div className="mt-6">
          <p className="mb-2.5 text-[13px] font-bold" style={{ color: "var(--text-main)" }}>Gérer avec GEDify</p>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <ActionTile
              icon={Upload}
              tone="var(--accent)"
              title="Importer dans GED"
              description="Enregistrer cet email et ses pièces jointes dans la GED."
              href={`/messagerie/thread/${threadId}#attachments`}
            />
            <ActionTile
              icon={FolderPlus}
              tone="var(--gedify-info)"
              title="Classer ce document"
              description="Choisir un dossier et appliquer une taxonomie."
              onClick={() => threadId && onClassify(threadId)}
            />
            <ActionTile
              icon={CheckSquare}
              tone="var(--gedify-green)"
              title="Créer une tâche"
              description="Transformer ce mail en tâche à traiter."
              href="/rappels"
            />
            <ActionTile
              icon={FolderInput}
              tone="var(--gedify-purple)"
              title="Associer à un dossier"
              description="Lier ce mail à un dossier existant."
              href="/organiser/dossiers"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sous-composants ─────────────────────────────────────────────────────────

function ToolbarButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium transition hover:bg-[var(--bg-card-soft)]"
      style={{ color: "var(--text-main)" }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      <span className="hidden lg:inline">{label}</span>
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-[var(--bg-card-soft)]"
      style={{ color: "var(--text-muted)" }}
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function Badge({ children, bg, color, icon: Icon }: { children: React.ReactNode; bg: string; color: string; icon?: React.ElementType }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: bg, color }}>
      {Icon ? <Icon className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

function ActionTile({
  icon: Icon,
  tone,
  title,
  description,
  href,
  onClick,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `color-mix(in srgb, ${tone} 14%, white)`, color: tone }}>
        <Icon className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" />
      </span>
      <p className="text-[12.5px] font-bold" style={{ color: "var(--text-main)" }}>{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-muted)" }}>{description}</p>
    </>
  );
  const cls = "flex flex-col rounded-2xl border bg-white p-3 text-left transition hover:shadow-sm hover:-translate-y-0.5";
  const style = { borderColor: "var(--border)" };
  return href ? (
    <Link href={href} className={cls} style={style}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className={cls} style={style}>{inner}</button>
  );
}
