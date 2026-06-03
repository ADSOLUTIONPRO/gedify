"use client";

import { Mail } from "lucide-react";
import { openComposer } from "@/lib/messaging/mail-composer-store";

/**
 * Bouton « Envoyer par mail » pour la page détail d'un document : ouvre la
 * fenêtre de rédaction Gmail avec le document GED déjà joint (PJ réelle).
 */
export function DocumentSendMailButton({
  documentId,
  title,
}: {
  documentId: number;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        openComposer({
          subject: `Document : ${title}`,
          attachments: [{ documentId, name: title }],
        })
      }
      className="inline-flex h-10 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold transition hover:bg-slate-50"
      style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
    >
      <Mail className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      Envoyer par mail
    </button>
  );
}
