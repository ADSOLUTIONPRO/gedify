"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, TriangleAlert, X } from "lucide-react";

type Props = {
  to: string;
  subject: string;
  threadId: string;
  inReplyTo?: string;
  onClose: () => void;
  onSent?: () => void;
};

type DraftStatus = "idle" | "saving" | "saved" | "error";
type SendStatus = "idle" | "sending" | "sent" | "error" | "scope_missing";

const AUTOSAVE_DEBOUNCE = 1500;

export function QuickReplyPanel({ to, subject, threadId, inReplyTo, onClose, onSent }: Props) {
  const [body, setBody] = useState("");
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const saveDraft = useCallback(async (currentBody: string, currentDraftId: string | null) => {
    if (!currentBody.trim()) return;
    if (!isMounted.current) return;
    setDraftStatus("saving");
    try {
      const res = await fetch("/api/messaging/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          draftId: currentDraftId ?? undefined,
          to,
          subject: `Re: ${subject}`,
          body: currentBody,
          threadId,
          inReplyTo,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: { id: string }; error?: string };
      if (!isMounted.current) return;
      if (res.ok && data.draft?.id) {
        setDraftId(data.draft.id);
        setDraftStatus("saved");
      } else {
        setDraftStatus("error");
      }
    } catch {
      if (isMounted.current) setDraftStatus("error");
    }
  }, [to, subject, threadId, inReplyTo]);

  // Auto-save avec debounce
  useEffect(() => {
    if (!body.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveDraft(body, draftId);
    }, AUTOSAVE_DEBOUNCE);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  async function send() {
    if (!body.trim()) return;
    setSendStatus("sending");
    setSendError(null);
    try {
      const res = await fetch("/api/messaging/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          to,
          subject: `Re: ${subject}`,
          body,
          threadId,
          inReplyTo,
          draftId: draftId ?? undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; errorType?: string };
      if (!isMounted.current) return;
      if (res.ok) {
        setSendStatus("sent");
        setTimeout(() => { if (isMounted.current) onSent?.(); }, 1500);
      } else if (data.errorType === "gmail_scope") {
        setSendStatus("scope_missing");
        setSendError(data.error ?? "Scope Gmail insuffisant.");
      } else {
        setSendStatus("error");
        setSendError(data.error ?? `Erreur HTTP ${res.status}`);
      }
    } catch (err) {
      if (!isMounted.current) return;
      setSendStatus("error");
      setSendError(err instanceof Error ? err.message : "Erreur réseau");
    }
  }

  const replySubject = `Re: ${subject}`;
  const canSend = body.trim().length > 0 && sendStatus !== "sending" && sendStatus !== "sent";

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "var(--border)" }}>
      {/* En-tête */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-bold" style={{ color: "var(--text-main)" }}>
            Répondre à <span style={{ color: "var(--blue-600)" }}>{to}</span>
          </p>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{replySubject}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-slate-100"
          style={{ color: "var(--text-muted)" }}
          aria-label="Fermer"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Zone de texte */}
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          setSendStatus("idle");
        }}
        placeholder="Écrivez votre réponse…"
        rows={6}
        className="w-full rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed outline-none focus:ring-2 resize-none"
        style={{
          borderColor: "var(--border)",
          color: "var(--text-main)",
          background: "var(--surface)",
        }}
        disabled={sendStatus === "sent" || sendStatus === "sending"}
      />

      {/* Footer */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {/* Statut brouillon */}
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {draftStatus === "saving" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Enregistrement…
            </span>
          )}
          {draftStatus === "saved" && "✓ Brouillon enregistré"}
          {draftStatus === "error" && (
            <span className="text-amber-600">Erreur d&apos;enregistrement du brouillon</span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {sendStatus === "scope_missing" && (
            <span className="flex items-center gap-1 text-[11.5px] text-amber-700">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </span>
          )}
          {sendStatus === "error" && (
            <span className="flex items-center gap-1 text-[11.5px] text-rose-700">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              {sendError}
            </span>
          )}
          {sendStatus === "sent" && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} /> Envoyé
            </span>
          )}
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--blue-600)" }}
          >
            {sendStatus === "sending" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.75} />
            )}
            {sendStatus === "sending" ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>

      {sendStatus === "scope_missing" && (
        <div
          className="mt-3 rounded-xl border p-3 text-[12px]"
          style={{ borderColor: "#FDE68A", background: "#FFFBEB", color: "#92400E" }}
        >
          <strong>Scope Gmail manquant.</strong> Pour activer l&apos;envoi d&apos;emails, reconnectez votre compte Gmail
          avec le scope <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">gmail.send</code> ou{" "}
          <code className="rounded bg-amber-100 px-1 font-mono text-[11px]">gmail.compose</code>.{" "}
          Ajoutez ces scopes dans <strong>GOOGLE_GMAIL_SCOPES</strong> dans votre <code className="font-mono text-[11px]">.env.local</code>{" "}
          puis reconnectez-vous via <a href="/messagerie/parametres" className="underline">Messagerie &gt; Paramètres</a>.
        </div>
      )}
    </div>
  );
}
