"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useDocumentProcessingStatus,
  type ProcessingStatus,
} from "@/hooks/use-document-processing-status";

type Props = {
  documentId: number;
};

// ─── Step definitions ────────────────────────────────────────────────────────

type Step = {
  id: string;
  label: string;
  statuses: ProcessingStatus[];
  color: "blue" | "violet" | "emerald" | "amber" | "rose";
};

const STEPS: Step[] = [
  { id: "import", label: "Import", statuses: ["imported", "queued"], color: "blue" },
  { id: "ocr", label: "OCR", statuses: ["ocr_pending", "ocr_running", "ocr_done"], color: "blue" },
  { id: "index", label: "Indexation", statuses: ["indexing", "classifying"], color: "blue" },
  { id: "ready", label: "Prêt", statuses: ["ready_for_ai"], color: "amber" },
  { id: "ai", label: "Analyse IA", statuses: ["ai_pending", "ai_running", "ai_done"], color: "violet" },
];

function getStepState(
  step: Step,
  currentStatus: ProcessingStatus,
): "done" | "active" | "pending" | "error" {
  if (currentStatus === "error") return "error";
  const allStatuses: ProcessingStatus[] = [
    "imported", "queued", "ocr_pending", "ocr_running", "ocr_done",
    "indexing", "classifying", "ready_for_ai", "ai_pending", "ai_running", "ai_done",
  ];
  const currentIdx = allStatuses.indexOf(currentStatus);
  // find the last status in this step
  const stepMax = Math.max(...step.statuses.map((s) => allStatuses.indexOf(s)));
  const stepMin = Math.min(...step.statuses.map((s) => allStatuses.indexOf(s)));
  if (currentIdx > stepMax) return "done";
  if (currentIdx >= stepMin) return "active";
  return "pending";
}

const STEP_DOT_CLASSES: Record<ReturnType<typeof getStepState>, string> = {
  done: "bg-emerald-500 border-emerald-500",
  active: "bg-blue-600 border-blue-600 ring-2 ring-blue-200",
  pending: "bg-white border-slate-300",
  error: "bg-rose-500 border-rose-500",
};

const STEP_LABEL_CLASSES: Record<ReturnType<typeof getStepState>, string> = {
  done: "text-emerald-700 font-semibold",
  active: "text-blue-700 font-bold",
  pending: "text-slate-400",
  error: "text-rose-700 font-semibold",
};

// ─── Reanalyze button ─────────────────────────────────────────────────────────

function ReanalyzeButton({
  documentId,
  onSuccess,
}: {
  documentId: number;
  onSuccess: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${documentId}/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; status?: string };
      if (!res.ok) {
        if (res.status === 409) throw new Error("Analyse déjà en cours — patientez.");
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      onSuccess();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        )}
        {loading ? "Analyse en cours…" : "Analyser avec l'IA"}
      </button>
      {error ? (
        <span className="text-[11px] text-rose-600">{error}</span>
      ) : null}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentProcessingProgress({ documentId }: Props) {
  const { data, loading, fetchError, fetchErrorType, refresh } = useDocumentProcessingStatus(documentId);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
        Chargement du statut de traitement…
      </div>
    );
  }

  if (fetchError && !data) {
    const isAuth = fetchErrorType === "auth";
    return (
      <div className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
        {isAuth ? (
          <span>
            {fetchError}{" "}
            <a href="/login" className="underline hover:no-underline">
              Se reconnecter
            </a>
          </span>
        ) : (
          <span>Impossible de charger le statut : {fetchError}</span>
        )}
      </div>
    );
  }

  if (!data) return null;

  const isDone = data.status === "ai_done" || data.status === "ready_for_ai";
  const isError = data.status === "error";
  const isActive =
    !isDone &&
    !isError &&
    data.status !== "unknown" &&
    data.status !== "imported";

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            Progression
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="font-bold text-slate-700">{data.progressPercent}%</span>
            {data.progressIsEstimated ? (
              <span className="rounded bg-amber-50 px-1 py-0.5 text-[10px] font-semibold text-amber-700">
                estimé
              </span>
            ) : null}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              isError
                ? "bg-rose-500"
                : isDone
                  ? "bg-emerald-500"
                  : "bg-blue-600"
            }`}
            style={{ width: `${data.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((step, i) => {
          const state = getStepState(step, data.status);
          return (
            <div key={step.id} className="flex flex-1 flex-col items-center gap-1 text-center">
              {/* connector + dot row */}
              <div className="flex w-full items-center">
                {i > 0 ? (
                  <div
                    className={`h-px flex-1 ${state === "done" ? "bg-emerald-400" : "bg-slate-200"}`}
                  />
                ) : (
                  <div className="flex-1" />
                )}
                <div
                  className={`h-3 w-3 shrink-0 rounded-full border-2 transition-all ${STEP_DOT_CLASSES[state]}`}
                />
                {i < STEPS.length - 1 ? (
                  <div className={`h-px flex-1 ${state === "done" ? "bg-emerald-400" : "bg-slate-200"}`} />
                ) : (
                  <div className="flex-1" />
                )}
              </div>
              <span className={`text-[10px] leading-tight ${STEP_LABEL_CLASSES[state]}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current step */}
      <div
        className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
          isError
            ? "bg-rose-50"
            : isDone
              ? "bg-emerald-50"
              : "bg-blue-50"
        }`}
      >
        {isError ? (
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : isDone ? (
          <CheckCircle2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : isActive ? (
          <Loader2
            className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-blue-600"
            strokeWidth={2}
            aria-hidden="true"
          />
        ) : (
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-slate-400" />
        )}
        <div className="min-w-0">
          <p
            className={`font-semibold ${
              isError ? "text-rose-700" : isDone ? "text-emerald-700" : "text-blue-700"
            }`}
          >
            {data.progressLabel}
          </p>
          <p className="text-slate-500">{data.currentStep}</p>
          {isError && data.errorMessage ? (
            <p className="mt-1 text-rose-600">{data.errorMessage}</p>
          ) : null}
        </div>
      </div>

      {/* OCR info */}
      {data.ocrTextLength > 0 ? (
        <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600"
          style={{ border: "1px solid var(--border)" }}
        >
          <p className="font-semibold text-slate-700">
            OCR : {data.ocrTextLength.toLocaleString("fr-FR")} caractères
          </p>
          {data.ocrExtract ? (
            <p className="mt-0.5 line-clamp-2 text-slate-500">{data.ocrExtract}</p>
          ) : null}
        </div>
      ) : null}

      {/* AI analysis action */}
      {data.canRunAi ? (
        <ReanalyzeButton documentId={documentId} onSuccess={refresh} />
      ) : null}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition hover:text-slate-700"
        >
          <RefreshCw className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
          Actualiser
        </button>
        {data.lastUpdatedAt ? (
          <span className="text-[10px] text-slate-400">
            Mis à jour {new Date(data.lastUpdatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        ) : null}
      </div>

      {/* Technical details collapsible */}
      {data.tasks.length > 0 ? (
        <details
          open={taskDetailsOpen}
          onToggle={(e) => setTaskDetailsOpen((e.target as HTMLDetailsElement).open)}
          className="group rounded-xl border border-slate-200 bg-slate-50/60"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-bold text-slate-600">
            Détails techniques ({data.tasks.length} tâche{data.tasks.length > 1 ? "s" : ""})
            <ChevronDown
              className="h-3 w-3 transition group-open:rotate-180"
              strokeWidth={2}
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-1.5 border-t border-slate-200 px-3 py-2">
            {data.tasks.map((task) => (
              <div
                key={task.id}
                className="rounded-lg bg-white px-2.5 py-2"
                style={{ border: "1px solid var(--border)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-700">
                    {task.humanName}
                  </span>
                  <span
                    className={`rounded px-1 py-0.5 text-[10px] font-bold ${
                      task.status === "SUCCESS"
                        ? "bg-emerald-50 text-emerald-700"
                        : task.status === "FAILURE"
                          ? "bg-rose-50 text-rose-700"
                          : task.status === "STARTED"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {task.humanStatus}
                  </span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {task.createdAt ? new Date(task.createdAt).toLocaleString("fr-FR") : "—"}
                  {task.finishedAt ? ` → ${new Date(task.finishedAt).toLocaleString("fr-FR")}` : ""}
                </p>
                {task.error ? (
                  <p className="mt-1 text-[10px] text-rose-600">{task.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
