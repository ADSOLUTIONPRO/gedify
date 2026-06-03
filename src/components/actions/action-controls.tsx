"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  XCircle,
} from "lucide-react";

type Props = {
  actionId: string;
  status: string;
  dueDate: string | null;
};

type Feedback = { kind: "success" | "error"; message: string } | null;

export function ActionControls({ actionId, status, dueDate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [postponeValue, setPostponeValue] = useState(dueDate ?? "");

  async function send(label: string, url: string, body?: unknown) {
    setBusy(label);
    setFeedback(null);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; details?: string };
        throw new Error(data.details ?? data.error ?? `HTTP ${response.status}`);
      }
      setFeedback({ kind: "success", message: `${label} effectué.` });
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
        <button
          type="button"
          disabled={busy !== null || status === "done"}
          onClick={() => send("Terminer", `/api/actions/${actionId}/complete`, {})}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-600 to-emerald-700 px-3.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] transition hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-60"
        >
          {busy === "Terminer" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Marquer terminée
        </button>

        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={postponeValue}
            onChange={(event) => setPostponeValue(event.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-900 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
          <button
            type="button"
            disabled={busy !== null || !postponeValue}
            onClick={() =>
              send("Reporter", `/api/actions/${actionId}/postpone`, { dueDate: postponeValue })
            }
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {busy === "Reporter" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
            Reporter
          </button>
        </div>

        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            if (!window.confirm("Supprimer cette action ?")) return;
            setBusy("Supprimer");
            try {
              const response = await fetch(`/api/actions/${actionId}`, { method: "DELETE" });
              if (!response.ok && response.status !== 204) throw new Error("Suppression impossible.");
              router.push("/actions");
              router.refresh();
            } catch (error) {
              setFeedback({
                kind: "error",
                message: error instanceof Error ? error.message : "Suppression impossible.",
              });
            } finally {
              setBusy(null);
            }
          }}
          className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
        >
          {busy === "Supprimer" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          )}
          Supprimer
        </button>
      </div>
      {feedback ? (
        <p
          className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold ${
            feedback.kind === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
