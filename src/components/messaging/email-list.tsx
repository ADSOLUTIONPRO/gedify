import { Mail } from "lucide-react";
import { ThreadRow } from "@/components/messaging/thread-row";
import type { LinksByThread, NormalizedThread } from "@/lib/messaging/load-threads";

type EmailListProps = {
  threads: NormalizedThread[];
  linksByThread: LinksByThread;
  emptyTitle?: string;
  emptyDescription?: string;
};

/** Liste d'emails (threads) réutilisant `ThreadRow`, avec état vide propre. */
export function EmailList({ threads, linksByThread, emptyTitle = "Aucun email", emptyDescription = "Aucun email dans cette vue." }: EmailListProps) {
  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border bg-white p-10 text-center" style={{ borderColor: "var(--border)" }}>
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "rgba(219,39,119,0.08)", color: "#DB2777" }}>
          <Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <p className="text-sm font-bold" style={{ color: "var(--text-main)" }}>{emptyTitle}</p>
        <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: "var(--border)" }}>
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {threads.map((thread) => (
          <li key={thread.id}>
            <ThreadRow thread={thread} links={linksByThread.get(thread.id) ?? []} />
          </li>
        ))}
      </ul>
    </div>
  );
}
