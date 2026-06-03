import Link from "next/link";
import { Paperclip, Sparkles, Star } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
import type { EmailGedLink, EmailThreadRecord } from "@/lib/messaging/email-types";

type ThreadRowProps = {
  thread: EmailThreadRecord;
  links?: EmailGedLink[];
};

function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function senderLabel(thread: EmailThreadRecord): string {
  const main = thread.participants[0];
  if (!main) return "(sans expéditeur)";
  return main.name ?? main.email;
}

export function ThreadRow({ thread, links }: ThreadRowProps) {
  const linkLabels = links ?? [];
  return (
    <Link
      href={`/messagerie/thread/${thread.id}`}
      className="flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50"
    >
      <div className="flex w-44 shrink-0 flex-col gap-1">
        <span
          className="truncate text-sm font-bold"
          style={{ color: thread.unread ? "var(--text-main)" : "var(--text-muted)" }}
        >
          {senderLabel(thread)}
        </span>
        <span
          className="truncate text-[11px]"
          style={{ color: "var(--text-muted)" }}
        >
          {thread.messageCount > 1 ? `${thread.messageCount} messages` : "1 message"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm ${thread.unread ? "font-extrabold" : "font-semibold"}`}
          style={{ color: "var(--text-main)" }}
        >
          {thread.subject ?? "(sans sujet)"}
        </p>
        <p
          className="mt-0.5 line-clamp-1 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {thread.snippet ?? ""}
        </p>
        {(thread.hasAttachments ||
          thread.important ||
          linkLabels.length > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {thread.hasAttachments ? (
              <StatusPill tone="blue">
                <span className="inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" strokeWidth={2} />
                  {thread.attachmentCount} PJ
                </span>
              </StatusPill>
            ) : null}
            {thread.important ? (
              <StatusPill tone="amber">
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3" strokeWidth={2} />
                  Important
                </span>
              </StatusPill>
            ) : null}
            {linkLabels.slice(0, 2).map((link) => (
              <StatusPill key={link.id} tone="violet">
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  {link.target.kind === "project"
                    ? link.target.projectName
                    : link.target.kind === "correspondent"
                    ? link.target.correspondentName
                    : link.target.kind}
                </span>
              </StatusPill>
            ))}
          </div>
        )}
      </div>

      <div className="flex w-20 shrink-0 flex-col items-end gap-1 text-right">
        <span className="text-[11px] font-bold" style={{ color: "var(--text-muted)" }}>
          {formatDateShort(thread.lastMessageAt)}
        </span>
        {thread.unread ? (
          <span
            aria-label="Non lu"
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--blue-600)" }}
          />
        ) : null}
      </div>
    </Link>
  );
}
