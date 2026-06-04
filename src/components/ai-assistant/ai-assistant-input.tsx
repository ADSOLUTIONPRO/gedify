"use client";

import { useState, type KeyboardEvent } from "react";
import { Loader2, SendHorizontal } from "lucide-react";

/** Zone de saisie du chat (Entrée = envoyer, Maj+Entrée = nouvelle ligne). */
export function AiAssistantInput({
  onSend,
  loading,
}: {
  onSend: (text: string) => void;
  loading: boolean;
}) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t || loading) return;
    onSend(t);
    setText("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t p-2.5" style={{ borderColor: "var(--border)" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Demandez quelque chose à l'assistant…"
        className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2"
        style={{ borderColor: "var(--border-strong)" }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || !text.trim()}
        aria-label="Envoyer"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition hover:opacity-90 disabled:opacity-40"
        style={{ background: "var(--accent)" }}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" strokeWidth={2} />}
      </button>
    </div>
  );
}
