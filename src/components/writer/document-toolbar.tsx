"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSignature,
  Loader2,
  Send,
  XCircle,
} from "lucide-react";
import type { WriterDocument } from "@/lib/writer/types";

type Feedback = { kind: "success" | "error"; message: string } | null;

type Props = {
  document: WriterDocument;
};

export function DocumentToolbar({ document }: Props) {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function exportPdf() {
    setExporting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/writer/documents/${document.id}/export/pdf`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok?: boolean; fileUrl?: string; message?: string };
      if (body.ok && body.fileUrl) {
        window.open(body.fileUrl, "_blank", "noopener,noreferrer");
        setFeedback({ kind: "success", message: "PDF généré par ONLYOFFICE." });
      } else {
        setFeedback({ kind: "error", message: body.message ?? "Export impossible." });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Export impossible.",
      });
    } finally {
      setExporting(false);
    }
  }

  async function sendToPaperless() {
    if (!window.confirm("Envoyer ce document vers la GED ?")) return;
    setSending(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/writer/documents/${document.id}/send-to-paperless`, {
        method: "POST",
      });
      const body = (await response.json()) as { ok?: boolean; message?: string; taskId?: string };
      if (body.ok) {
        setFeedback({
          kind: "success",
          message: body.message ?? "Document envoyé à Gedify.",
        });
        router.refresh();
      } else {
        setFeedback({ kind: "error", message: body.message ?? "Envoi impossible." });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Envoi impossible.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/redaction/${document.id}`}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          Retour
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-900">{document.title}</p>
          <p className="text-xs text-slate-500">
            Version {document.version} · MAJ {new Date(document.updatedAt).toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link
            href="/documents/signatures"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            title="Gérer les signatures"
          >
            <FileSignature className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Signatures
          </Link>
          <button
            type="button"
            onClick={exportPdf}
            disabled={exporting}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            Exporter PDF
          </button>
          <button
            type="button"
            onClick={sendToPaperless}
            disabled={sending}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
          >
            {sending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            Envoyer vers la GED
          </button>
        </div>
      </div>
      {feedback ? (
        <p
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          <span>{feedback.message}</span>
        </p>
      ) : null}
    </div>
  );
}
