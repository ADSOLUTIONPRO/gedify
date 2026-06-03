import "server-only";

import { paperlessFetch } from "@/lib/paperless";
import type { PaperlessListResponse, PaperlessTask } from "@/lib/paperless-types";
import { getTaskHumanInfo, humanizeTaskStatus } from "./task-formatters";

// ---------------------------------------------------------------------------
// Normalised types
// ---------------------------------------------------------------------------

export type NormalizedPaperlessTask = {
  id: string;
  taskId: string;
  fileName: string | null;
  type: string | null;
  humanName: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "REVOKED" | string;
  humanStatus: string;
  progressPercent: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  relatedDocumentId: number | null;
  error: string | null;
  raw: PaperlessTask;
};

export type DocumentProcessingStatus = {
  documentId: number;
  status:
    | "imported"
    | "queued"
    | "ocr_pending"
    | "ocr_running"
    | "ocr_done"
    | "indexing"
    | "classifying"
    | "ready_for_ai"
    | "ai_pending"
    | "ai_running"
    | "ai_done"
    | "error"
    | "unknown";
  progressPercent: number;
  /** Mention que la progression est estimée si Paperless ne renvoie pas de %  */
  progressIsEstimated: boolean;
  progressLabel: string;
  currentStep: string;
  tasks: NormalizedPaperlessTask[];
  lastUpdatedAt: string | null;
  errorMessage: string | null;
  ocrTextAvailable: boolean;
  canRunAi: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function taskProgressPercent(task: NormalizedPaperlessTask): number {
  switch (task.status.toUpperCase()) {
    case "SUCCESS":
      return 100;
    case "STARTED":
      return 50;
    case "PENDING":
      return 10;
    case "FAILURE":
    case "REVOKED":
      return 0;
    default:
      return 0;
  }
}

export function normalizePaperlessTask(raw: PaperlessTask): NormalizedPaperlessTask {
  const info = getTaskHumanInfo(raw.type);
  const status = String(raw.status ?? "PENDING");
  return {
    id: String(raw.id),
    taskId: raw.task_id,
    fileName: raw.task_file_name,
    type: raw.type,
    humanName: info.label,
    status,
    humanStatus: humanizeTaskStatus(status),
    progressPercent: taskProgressPercent({
      status,
    } as NormalizedPaperlessTask),
    createdAt: raw.date_created,
    startedAt: raw.date_created, // Paperless doesn't expose a separate start time
    finishedAt: raw.date_done,
    relatedDocumentId: raw.related_document,
    error: status === "FAILURE" ? (raw.result ?? "Erreur inconnue") : null,
    raw,
  };
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

export async function getPaperlessTasks(): Promise<NormalizedPaperlessTask[]> {
  try {
    const data = await paperlessFetch<PaperlessListResponse<PaperlessTask>>("/api/tasks/", {
      searchParams: { page_size: 100 },
    });
    return (data.results ?? []).map(normalizePaperlessTask);
  } catch {
    return [];
  }
}

export async function getPaperlessTaskById(
  taskId: string,
): Promise<NormalizedPaperlessTask | null> {
  try {
    const all = await getPaperlessTasks();
    return all.find((t) => t.taskId === taskId || t.id === taskId) ?? null;
  } catch {
    return null;
  }
}

export async function getPaperlessTasksForDocument(
  documentId: number,
): Promise<NormalizedPaperlessTask[]> {
  const all = await getPaperlessTasks();
  return all.filter((t) => t.relatedDocumentId === documentId);
}

// ---------------------------------------------------------------------------
// Deriving processing status
// ---------------------------------------------------------------------------

/**
 * Dérive le statut de traitement d'un document à partir :
 *   1. des tâches Paperless liées
 *   2. de la disponibilité du texte OCR (content.length)
 *   3. de l'existence d'une analyse IA locale
 *
 * La progression est ESTIMÉE par étapes car Paperless ne renvoie pas
 * de pourcentage réel dans l'API tâches.
 */
export function deriveProcessingStatus(
  documentId: number,
  tasks: NormalizedPaperlessTask[],
  ocrTextLength: number,
  hasAiAnalysis: boolean,
  aiAnalysisStatus?: string | null,
): DocumentProcessingStatus {
  const now = new Date().toISOString();

  // If no tasks, the document is either fully processed or we can't know
  if (tasks.length === 0) {
    if (ocrTextLength >= 20) {
      if (hasAiAnalysis) {
        return {
          documentId,
          status: aiAnalysisStatus === "validated" || aiAnalysisStatus === "applied" ? "ai_done" : "ai_done",
          progressPercent: 100,
          progressIsEstimated: true,
          progressLabel: hasAiAnalysis ? "Analyse IA disponible" : "Texte OCR disponible",
          currentStep: hasAiAnalysis ? "Analyse IA terminée" : "Prêt pour analyse IA",
          tasks: [],
          lastUpdatedAt: now,
          errorMessage: null,
          ocrTextAvailable: true,
          canRunAi: true,
        };
      }
      return {
        documentId,
        status: "ready_for_ai",
        progressPercent: 90,
        progressIsEstimated: true,
        progressLabel: "Prêt pour analyse IA",
        currentStep: "OCR terminé — analyse IA disponible",
        tasks: [],
        lastUpdatedAt: now,
        errorMessage: null,
        ocrTextAvailable: true,
        canRunAi: true,
      };
    }
    // No tasks, no OCR — document recently imported
    return {
      documentId,
      status: "imported",
      progressPercent: 10,
      progressIsEstimated: true,
      progressLabel: "Document importé",
      currentStep: "En attente du traitement Paperless",
      tasks: [],
      lastUpdatedAt: now,
      errorMessage: null,
      ocrTextAvailable: false,
      canRunAi: false,
    };
  }

  // Find the most relevant task (most recent)
  const sorted = [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = sorted[0];

  // Check for any failure
  const failedTask = tasks.find((t) => t.status === "FAILURE");
  if (failedTask) {
    return {
      documentId,
      status: "error",
      progressPercent: 0,
      progressIsEstimated: false,
      progressLabel: "Erreur de traitement",
      currentStep: `Erreur : ${failedTask.humanName}`,
      tasks: sorted,
      lastUpdatedAt: latest.finishedAt ?? now,
      errorMessage: failedTask.error ?? "Une erreur est survenue lors du traitement.",
      ocrTextAvailable: ocrTextLength >= 20,
      canRunAi: false,
    };
  }

  // Check for running tasks
  const runningTask = tasks.find((t) => t.status === "STARTED");
  if (runningTask) {
    const isOcr = runningTask.type === "ocr_document";
    return {
      documentId,
      status: isOcr ? "ocr_running" : "indexing",
      progressPercent: isOcr ? 50 : 80,
      progressIsEstimated: true,
      progressLabel: runningTask.humanName,
      currentStep: `En cours : ${runningTask.humanName}`,
      tasks: sorted,
      lastUpdatedAt: now,
      errorMessage: null,
      ocrTextAvailable: ocrTextLength >= 20,
      canRunAi: false,
    };
  }

  // All tasks succeeded — check OCR
  const allDone = tasks.every((t) => t.status === "SUCCESS");
  if (allDone) {
    if (ocrTextLength >= 20) {
      if (hasAiAnalysis) {
        return {
          documentId,
          status: "ai_done",
          progressPercent: 100,
          progressIsEstimated: true,
          progressLabel: "Analyse IA terminée",
          currentStep: "Analyse IA disponible — à valider",
          tasks: sorted,
          lastUpdatedAt: latest.finishedAt ?? now,
          errorMessage: null,
          ocrTextAvailable: true,
          canRunAi: true,
        };
      }
      return {
        documentId,
        status: "ready_for_ai",
        progressPercent: 90,
        progressIsEstimated: true,
        progressLabel: "Prêt pour analyse IA",
        currentStep: "OCR et indexation terminés",
        tasks: sorted,
        lastUpdatedAt: latest.finishedAt ?? now,
        errorMessage: null,
        ocrTextAvailable: true,
        canRunAi: true,
      };
    }
    // All tasks done but no OCR text yet — OCR may have produced nothing
    return {
      documentId,
      status: "ocr_done",
      progressPercent: 70,
      progressIsEstimated: true,
      progressLabel: "Tâches terminées — texte OCR non disponible",
      currentStep: "OCR terminé (texte court ou vide)",
      tasks: sorted,
      lastUpdatedAt: latest.finishedAt ?? now,
      errorMessage: null,
      ocrTextAvailable: false,
      canRunAi: false,
    };
  }

  // Pending tasks
  const pendingTask = tasks.find((t) => t.status === "PENDING");
  if (pendingTask) {
    return {
      documentId,
      status: "queued",
      progressPercent: 20,
      progressIsEstimated: true,
      progressLabel: "En file d'attente",
      currentStep: `En attente : ${pendingTask.humanName}`,
      tasks: sorted,
      lastUpdatedAt: now,
      errorMessage: null,
      ocrTextAvailable: ocrTextLength >= 20,
      canRunAi: false,
    };
  }

  return {
    documentId,
    status: "unknown",
    progressPercent: 0,
    progressIsEstimated: true,
    progressLabel: "Statut inconnu",
    currentStep: "Statut inconnu",
    tasks: sorted,
    lastUpdatedAt: now,
    errorMessage: null,
    ocrTextAvailable: ocrTextLength >= 20,
    canRunAi: ocrTextLength >= 20,
  };
}
