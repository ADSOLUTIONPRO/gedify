"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileDown, Loader2, Paperclip, TriangleAlert } from "lucide-react";
import { RightRailCard } from "@/components/ui/right-rail-card";
import type { MailDocumentLinkStatus } from "@/lib/messaging/mail-document-links-store";

export type ThreadAttachment = {
  attachmentId: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  status: MailDocumentLinkStatus | "none" | "importing";
  documentId: number | null;
};

/**
 * Pièces jointes du thread (sidebar) — section UNIQUE avec l'état GED réel
 * (calculé serveur depuis la liaison) : Ajouter à la GED / Import en cours… /
 * Erreur + Réessayer / Ajouté à la GED (vert, cliquable vers le document).
 */
export function ThreadAttachmentsCard({ threadId, attachments }: { threadId: string; attachments: ThreadAttachment[] }) {
  const [rows, setRows] = useState<ThreadAttachment[]>(attachments);

  if (rows.length === 0) return null;

  function setRow(attachmentId: string, patch: Partial<ThreadAttachment>) {
    setRows((prev) => prev.map((r) => (r.attachmentId === attachmentId ? { ...r, ...patch } : r)));
  }

  async function importAttachment(att: ThreadAttachment) {
    if (att.status === "importing" || att.status === "imported" || att.status === "pending") return;
    setRow(att.attachmentId, { status: "importing" });
    try {
      const res = await fetch("/api/messaging/attachments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailId: att.messageId,
          threadId,
          attachmentId: att.attachmentId,
          filename: att.filename,
          mimeType: att.mimeType,
          sizeBytes: att.size,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { link?: { status?: MailDocumentLinkStatus; paperlessDocumentId?: number | null } };
      if (!res.ok) setRow(att.attachmentId, { status: "error" });
      else setRow(att.attachmentId, { status: data.link?.status ?? "imported", documentId: data.link?.paperlessDocumentId ?? att.documentId });
    } catch {
      setRow(att.attachmentId, { status: "error" });
    }
  }

  return (
    <RightRailCard title={`Pièces jointes (${rows.length})`} icon={Paperclip} iconTone="blue">
      <ul className="space-y-2">
        {rows.map((att) => (
          <li key={att.attachmentId} className="rounded-xl border p-2.5" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-main)" }} title={att.filename}>
                {att.filename}
              </span>
              <span className="shrink-0 text-[10.5px]" style={{ color: "var(--text-hint)" }}>{Math.round(att.size / 1024)} ko</span>
            </div>
            <div className="mt-1.5">
              {att.status === "imported" ? (
                att.documentId ? (
                  <Link href={`/documents/${att.documentId}`} className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: "#15803D" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> Ajouté à la GED · Ouvrir
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: "#15803D" }}>
                    <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} /> Ajouté à la GED
                  </span>
                )
              ) : att.status === "importing" || att.status === "pending" ? (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: "#B45309" }}>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Import en cours…
                </span>
              ) : att.status === "error" ? (
                <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: "#B91C1C" }}>
                  <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2} /> Erreur d&apos;import
                  <button type="button" onClick={() => void importAttachment(att)} className="font-bold underline" style={{ color: "var(--accent)" }}>Réessayer</button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void importAttachment(att)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-bold transition hover:bg-[#FCFAF7]"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  <FileDown className="h-3.5 w-3.5" strokeWidth={2} /> Ajouter à la GED
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </RightRailCard>
  );
}
