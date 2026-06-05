"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Paperclip, RefreshCw, Inbox } from "lucide-react";
import type { ImapInboxResult } from "@/lib/messaging/load-imap-inbox";
import { MailboxSelector } from "@/components/messaging/mailbox-selector";

const PINK = "#F75C8D";

/* Boîte de réception IMAP en LECTURE SEULE (comptes non-Gmail).
   Affiche les messages déjà synchronisés + un bouton « Synchroniser » qui
   déclenche une relève IMAP, puis rafraîchit. N'ouvre pas de thread Gmail. */

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function senderName(from: string | null): string {
  if (!from) return "(inconnu)";
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<.+>$/);
  return (m?.[1] ?? from).trim();
}

export function ImapInboxView({ data, title }: { data: ImapInboxResult; title: string }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function sync() {
    setSyncing(true);
    setNote(null);
    try {
      const res = await fetch("/api/mail-connector/sync-all", { method: "POST", credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as { imported?: number; message?: string };
      setNote(
        res.ok
          ? `Synchronisation terminée${typeof json.imported === "number" ? ` — ${json.imported} pièce(s) jointe(s) importée(s)` : ""}.`
          : json.message ?? "Échec de la synchronisation.",
      );
      router.refresh();
    } catch {
      setNote("Synchronisation impossible (réseau).");
    } finally {
      setSyncing(false);
    }
  }

  const accountLabel = data.accounts.map((a) => a.email).join(", ");

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b px-5 py-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold" style={{ color: "var(--text-main)" }}>{title}</h1>
          <p className="truncate text-[12px]" style={{ color: "var(--text-muted)" }}>{accountLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <MailboxSelector />
          <button
            type="button"
            onClick={() => void sync()}
            disabled={syncing}
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[13px] font-bold text-white shadow-sm transition disabled:opacity-60"
            style={{ background: PINK }}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} strokeWidth={2} />
            {syncing ? "Synchronisation…" : "Synchroniser"}
          </button>
        </div>
      </div>

      {note ? (
        <div className="border-b px-5 py-2 text-[12px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
          {note}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        {data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${PINK}1A` }}>
              <Inbox className="h-6 w-6" style={{ color: PINK }} strokeWidth={1.75} />
            </span>
            <p className="text-[14px] font-semibold" style={{ color: "var(--text-main)" }}>Aucun message synchronisé pour l’instant</p>
            <p className="max-w-sm text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Cliquez sur « Synchroniser » pour relever votre boîte IMAP. Les pièces jointes
              compatibles sont importées dans la GED, et les messages apparaissent ici.
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {data.items.map((m) => {
              const isOpen = openId === m.id;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : m.id)}
                    className="flex w-full items-start gap-3 px-5 py-3 text-left transition hover:bg-black/[0.02]"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: PINK }}>
                      {senderName(m.from)[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-main)" }}>{senderName(m.from)}</span>
                        {m.hasAttachments ? <Paperclip className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--text-muted)" }} /> : null}
                        <span className="ml-auto shrink-0 text-[11.5px]" style={{ color: "var(--text-muted)" }}>{fmtDate(m.date)}</span>
                      </span>
                      <span className="block truncate text-[13px]" style={{ color: "var(--text-main)" }}>{m.subject || "(sans objet)"}</span>
                      <span className={`block text-[12px] ${isOpen ? "" : "truncate"}`} style={{ color: "var(--text-muted)" }}>{m.snippet || ""}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t px-5 py-2 text-[11.5px]" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <Mail className="mr-1 inline h-3.5 w-3.5" /> Certaines fonctions (réponse, dossiers, fils de discussion) dépendent du type de connexion de votre boîte mail.
      </div>
    </div>
  );
}
