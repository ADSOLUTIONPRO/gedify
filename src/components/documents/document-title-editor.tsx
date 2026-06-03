"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  Pencil,
  RotateCw,
  Sparkles,
  X,
} from "lucide-react";

type DocumentTitleEditorProps = {
  documentId: number;
  displayTitle: string;
  source: "user" | "ai" | "paperless" | "rule" | "imported" | "filename";
  confidence: number | null;
  editedByUser: boolean;
  originalFilename: string | null;
  paperlessTitle: string | null;
  aiSuggestedTitle: string | null;
};

export function DocumentTitleEditor(props: DocumentTitleEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(props.displayTitle);
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  function applyServer(action: () => Promise<Response>) {
    setFeedback(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setFeedback({ kind: "success", message: "Titre enregistré." });
        setEditing(false);
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Erreur inconnue.",
        });
      }
    });
  }

  function save() {
    const trimmed = value.trim();
    if (!trimmed) {
      setFeedback({ kind: "error", message: "Le titre ne peut pas être vide." });
      return;
    }
    applyServer(() =>
      fetch(`/api/documents/${props.documentId}/display-title`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayTitle: trimmed }),
      })
    );
  }

  function resetToAI() {
    if (!props.aiSuggestedTitle) return;
    applyServer(() =>
      fetch(`/api/documents/${props.documentId}/display-title`, {
        method: "DELETE",
      })
    );
  }

  function resetToFilename() {
    applyServer(() =>
      fetch(`/api/documents/${props.documentId}/display-title`, {
        method: "DELETE",
      })
    );
  }

  const sourceLabel = {
    user: "Édité par vous",
    ai: "Suggéré par l'IA",
    paperless: "Titre Gedify",
    rule: "Règle automatique",
    imported: "Importé",
    filename: "Nom de fichier",
  }[props.source];

  return (
    <div>
      {editing ? (
        <div className="space-y-2">
          <textarea
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={2}
            maxLength={240}
            className="w-full rounded-lg border bg-white px-3 py-2 text-sm font-medium outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            placeholder="Titre du document"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: "var(--blue-600)" }}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              )}
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(props.displayTitle);
                setFeedback(null);
              }}
              disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border bg-white px-3 text-xs font-semibold transition hover:bg-slate-50 disabled:opacity-60"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p
            className="text-sm font-bold leading-snug"
            style={{ color: "var(--text-main)" }}
          >
            {props.displayTitle}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
              style={{
                background:
                  props.source === "user"
                    ? "rgba(11,92,255,0.10)"
                    : props.source === "ai"
                    ? "rgba(124,58,237,0.10)"
                    : "rgba(100,116,139,0.10)",
                color:
                  props.source === "user"
                    ? "var(--blue-600)"
                    : props.source === "ai"
                    ? "#7C3AED"
                    : "#475569",
              }}
            >
              {props.source === "ai" ? <Sparkles className="h-3 w-3" strokeWidth={2} /> : null}
              {sourceLabel}
              {typeof props.confidence === "number" && props.source === "ai"
                ? ` · ${Math.round(props.confidence * 100)}%`
                : ""}
            </span>
            {props.originalFilename && props.originalFilename !== props.displayTitle ? (
              <span style={{ color: "var(--text-muted)" }} title={props.originalFilename}>
                Fichier : <span className="font-mono">{props.originalFilename}</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-semibold transition hover:bg-slate-50"
              style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
            >
              <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Modifier
            </button>
            {props.aiSuggestedTitle && props.editedByUser ? (
              <button
                type="button"
                onClick={resetToAI}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
                title={`Réinitialiser avec : ${props.aiSuggestedTitle}`}
              >
                <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Reprendre l&apos;IA
              </button>
            ) : null}
            {props.source !== "filename" ? (
              <button
                type="button"
                onClick={resetToFilename}
                disabled={pending}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-[11px] font-semibold transition hover:bg-slate-50 disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-main)" }}
              >
                <RotateCw className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Reset auto
              </button>
            ) : null}
          </div>
        </div>
      )}
      {feedback ? (
        <p
          className={`mt-2 text-[11px] font-semibold ${
            feedback.kind === "success" ? "" : ""
          }`}
          style={{
            color: feedback.kind === "success" ? "#16A34A" : "#DC2626",
          }}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
