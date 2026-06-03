"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CheckCircle2,
  Eye,
  Loader2,
  Mail,
  Power,
  RefreshCw,
  XCircle,
} from "lucide-react";

type Props = {
  accountId: string;
  email: string | null;
};

type Feedback = { kind: "success" | "error"; message: string } | null;

export function GmailControls({ accountId, email }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function call(label: string, url: string, body?: unknown) {
    setBusy(label);
    setFeedback(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        result?: { ok?: boolean; message?: string };
        preview?: { summary?: { importable: number; ignored: number; scanned: number } };
      };
      if (!response.ok) {
        throw new Error(data.error ?? `HTTP ${response.status}`);
      }
      const ok =
        data.ok ?? data.result?.ok ?? data.preview !== undefined;
      const message =
        data.message ??
        data.result?.message ??
        (data.preview
          ? `Aperçu : ${data.preview.summary?.importable ?? 0} à importer, ${
              data.preview.summary?.ignored ?? 0
            } ignorés (${data.preview.summary?.scanned ?? 0} scannés).`
          : `${label} effectué.`);
      setFeedback({ kind: ok ? "success" : "error", message });
      router.refresh();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : `${label} impossible.`,
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <Mail className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          Gmail OAuth · {email ?? "compte connecté"}
        </span>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => call("Synchroniser", "/api/connectors/gmail/sync", { accountId })}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          {busy === "Synchroniser" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Synchroniser maintenant
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => call("Prévisualiser", `/api/mail-connector/accounts/${accountId}/preview-sync`)}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy === "Prévisualiser" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Prévisualiser
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm("Déconnecter Gmail ? Le refresh_token sera révoqué.")) return;
            void call("Déconnecter", "/api/connectors/gmail/disconnect", { accountId });
          }}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          {busy === "Déconnecter" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Power className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Déconnecter Gmail
        </button>
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
