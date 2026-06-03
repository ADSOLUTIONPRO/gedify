"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  EyeOff,
  FolderPlus,
  Loader2,
  MessageSquareReply,
} from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";
import { MailClassifyPanel } from "@/components/messaging/mail-classify-panel";
import type { EmailMessageRecord } from "@/lib/messaging/email-types";

type Props = {
  threadId: string;
  latestMessage: EmailMessageRecord;
  accountEmail: string;
};

/**
 * Barre d'actions de la conversation (centre) : Répondre / Classer / Masquer
 * l'expéditeur. Les pièces jointes, le rendez-vous détecté et les liaisons GED
 * sont désormais affichés UNIQUEMENT dans la sidebar (plus de doublon central).
 */
export function ThreadActionsClient({ threadId, latestMessage, accountEmail }: Props) {
  const [showClassify, setShowClassify] = useState(false);
  const router = useRouter();
  const [hidingSender, setHidingSender] = useState(false);
  const [senderHidden, setSenderHidden] = useState(false);

  const replyTo = latestMessage.from?.email ?? "";
  const subject = latestMessage.subject ?? "";
  const inReplyTo = latestMessage.id;

  async function hideSender() {
    const email = latestMessage.from?.email;
    if (!email) return;
    setHidingSender(true);
    try {
      await fetch("/api/messaging/hidden-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, displayName: latestMessage.from?.name ?? null }),
      });
      setSenderHidden(true);
    } finally {
      setHidingSender(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3" style={{ borderColor: "var(--border)" }}>
        <button
          type="button"
          onClick={() => openComposer({ to: replyTo, subject: /^re:/i.test(subject) ? subject : `Re: ${subject}`, threadId, inReplyTo })}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-[#FCFAF7]"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <MessageSquareReply className="h-4 w-4" strokeWidth={1.75} />
          Répondre
        </button>

        <button
          type="button"
          onClick={() => setShowClassify(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-[#FCFAF7]"
          style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
        >
          <FolderPlus className="h-4 w-4" strokeWidth={1.75} />
          Classer
        </button>

        <button
          type="button"
          disabled={hidingSender || senderHidden || !latestMessage.from?.email}
          onClick={() => void hideSender()}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition hover:bg-amber-50 disabled:opacity-50"
          style={{ borderColor: senderHidden ? "#6EE7B7" : "#FDE68A", color: senderHidden ? "#059669" : "#D97706" }}
        >
          {hidingSender ? <Loader2 className="h-4 w-4 animate-spin" /> : senderHidden ? <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} /> : <EyeOff className="h-4 w-4" strokeWidth={1.75} />}
          {senderHidden ? "Expéditeur masqué" : "Masquer expéditeur"}
        </button>

        <span className="ml-auto text-[11.5px]" style={{ color: "var(--text-muted)" }}>{accountEmail}</span>
      </div>

      {showClassify && (
        <MailClassifyPanel
          threadIds={[threadId]}
          onClose={() => setShowClassify(false)}
          onSuccess={() => { setShowClassify(false); router.refresh(); }}
        />
      )}
    </>
  );
}
