"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Plug,
  RefreshCw,
  Trash2,
} from "lucide-react";
import type { MailTestResult, MailSyncResult } from "@/lib/mail-connector/types";
import { GedifyErrorHint } from "@/components/ui/gedify-error-hint";

type Props = {
  accountId: string;
  hasPassword: boolean;
};

type FeedbackKind = "success" | "error" | null;

type Feedback = {
  kind: FeedbackKind;
  message: string;
} | null;

export function AccountActions({ accountId, hasPassword }: Props) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [deleting, startDeleting] = useTransition();

  async function runTest() {
    setTesting(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/mail-connector/accounts/${accountId}/test`, {
        method: "POST",
      });
      const body = (await response.json()) as { result?: MailTestResult; error?: string };
      if (body.result) {
        setFeedback({
          kind: body.result.ok ? "success" : "error",
          message: body.result.message,
        });
      } else {
        setFeedback({ kind: "error", message: body.error ?? "Test impossible." });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Test impossible.",
      });
    } finally {
      setTesting(false);
      router.refresh();
    }
  }

  async function runSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/mail-connector/accounts/${accountId}/sync`, {
        method: "POST",
      });
      const body = (await response.json()) as { result?: MailSyncResult; error?: string };
      if (body.result) {
        setFeedback({
          kind: body.result.ok ? "success" : "error",
          message: body.result.message,
        });
      } else {
        setFeedback({ kind: "error", message: body.error ?? "Synchronisation impossible." });
      }
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Synchronisation impossible.",
      });
    } finally {
      setSyncing(false);
      router.refresh();
    }
  }

  function removeAccount() {
    if (!window.confirm("Supprimer définitivement ce compte mail ?")) return;
    startDeleting(async () => {
      try {
        const response = await fetch(`/api/mail-connector/accounts/${accountId}`, {
          method: "DELETE",
        });
        if (!response.ok && response.status !== 204) {
          throw new Error("Suppression impossible.");
        }
        router.push("/emails/comptes");
        router.refresh();
      } catch (error) {
        setFeedback({
          kind: "error",
          message: error instanceof Error ? error.message : "Suppression impossible.",
        });
      }
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Plug className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {testing ? "Test en cours..." : "Tester la connexion"}
        </button>
        <button
          type="button"
          onClick={runSync}
          disabled={syncing || !hasPassword}
          title={hasPassword ? "Lancer une synchronisation" : "Mot de passe non enregistré"}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-blue-600 to-blue-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] transition hover:from-blue-500 hover:to-blue-600 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {syncing ? "Synchronisation..." : "Synchroniser maintenant"}
        </button>
        <button
          type="button"
          onClick={removeAccount}
          disabled={deleting}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {deleting ? "Suppression..." : "Supprimer"}
        </button>
      </div>

      {feedback ? (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.kind === "success" ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
          ) : (
            <GedifyErrorHint code="mail_sync_failed" message={feedback.message} onRetry={() => void runSync()} />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}
    </div>
  );
}
