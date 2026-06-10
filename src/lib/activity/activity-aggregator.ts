import "server-only";

import {
  formatTaskName,
  normalizeStatus,
  type ActivitySource,
  type ActivityStatus,
} from "./activity-formatters";
import type { MailSyncLog } from "@/lib/mail-connector/types";
import type { AIAnalysis } from "@/lib/ai/types";
import type { PaperlessResource } from "@/lib/paperless-resource-types";

export type ActivityCategory =
  | "import"
  | "analysis"
  | "task"
  | "error"
  | "info"
  | "workflow"
  | "log";

export type ActivityEvent = {
  id: string;
  timestamp: string;
  source: ActivitySource;
  category: ActivityCategory;
  title: string;
  description: string;
  status: ActivityStatus;
  /** Lien éventuel "voir détail". */
  href?: string;
  /** Identifiant technique exposé seulement en tooltip ou en détail avancé. */
  technicalRef?: string;
  /** Niveau d'importance — `high` pour les erreurs et événements critiques. */
  priority: "low" | "normal" | "high";
};

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickTimestamp(resource: PaperlessResource): string {
  const candidates = [
    "date_done",
    "date_created",
    "date_modified",
    "created",
    "timestamp",
    "modified",
  ];
  for (const key of candidates) {
    const value = asString(resource[key]);
    if (value) return value;
  }
  return new Date().toISOString();
}

/** Mappe les `/api/logs/` Paperless vers des `ActivityEvent`. */
export function mapPaperlessLogs(rows: PaperlessResource[]): ActivityEvent[] {
  return rows.map((row, index) => {
    const message = asString(row.message) ?? "Événement Paperless";
    const level = (asString(row.level) ?? "").toLowerCase();
    const status: ActivityStatus =
      level === "error" || level === "critical"
        ? "error"
        : level === "warning"
        ? "to_validate"
        : "success";
    const ts = pickTimestamp(row);
    const technicalRef = String(row.id ?? index);
    return {
      id: `pl-log-${technicalRef}`,
      timestamp: ts,
      source: "paperless",
      category: status === "error" ? "error" : "log",
      title: message,
      description: asString(row.group) ?? "Journal Paperless",
      status,
      technicalRef,
      priority: status === "error" ? "high" : "low",
    };
  });
}

/** Mappe les `/api/tasks/` Paperless vers des `ActivityEvent`. */
export function mapPaperlessTasks(rows: PaperlessResource[]): ActivityEvent[] {
  return rows.map((row, index) => {
    const taskName = asString(row.task_name) ?? asString(row.task) ?? "task";
    const humanName = formatTaskName(taskName);
    const status = normalizeStatus(asString(row.status));
    const taskFileName = asString(row.task_file_name);
    const result = asString(row.result);
    const documentId = asNumber(row.related_document);
    const ts = pickTimestamp(row);
    const technicalRef = asString(row.task_id) ?? String(row.id ?? index);

    let description = taskFileName ?? result ?? "Tâche système Paperless";
    if (status === "error" && result) {
      description = result;
    }

    return {
      id: `pl-task-${technicalRef}`,
      timestamp: ts,
      source: "tasks",
      category: status === "error" ? "error" : status === "success" ? "task" : "task",
      title: humanName,
      description,
      status,
      href: documentId ? `/documents/${documentId}` : undefined,
      technicalRef,
      priority: status === "error" ? "high" : "low",
    };
  });
}

/** Mappe les logs du connecteur mail Gedify vers des `ActivityEvent`. */
export function mapMailLogs(logs: MailSyncLog[]): ActivityEvent[] {
  return logs.map((log) => {
    const status: ActivityStatus =
      log.status === "imported"
        ? "imported"
        : log.status === "error"
        ? "error"
        : log.status === "duplicate"
        ? "ignored"
        : log.status === "pending"
        ? "pending"
        : "ignored";
    const title =
      log.status === "imported"
        ? "Email importé"
        : log.status === "error"
        ? "Erreur d'import email"
        : log.status === "duplicate"
        ? "Email déjà importé"
        : log.status === "pending"
        ? "Email en attente"
        : "Email ignoré";
    const descriptionParts: string[] = [];
    if (log.subject) descriptionParts.push(log.subject);
    if (log.attachmentName) descriptionParts.push(log.attachmentName);
    if (log.errorMessage) descriptionParts.push(log.errorMessage);
    const description =
      descriptionParts.join(" — ") || `Compte ${log.accountName}`;

    return {
      id: `mail-${log.id}`,
      timestamp: log.createdAt,
      source: "email",
      category: status === "error" ? "error" : "import",
      title,
      description,
      status,
      href: log.paperlessDocumentId
        ? `/documents/${log.paperlessDocumentId}`
        : "/emails/logs",
      technicalRef: log.messageId ?? log.emailUid ?? log.id,
      priority: status === "error" ? "high" : "normal",
    };
  });
}

/** Mappe les analyses IA persistées vers des `ActivityEvent`. */
export function mapAiAnalyses(analyses: AIAnalysis[]): ActivityEvent[] {
  return analyses.map((analysis) => {
    const hasWarnings = (analysis.warnings ?? []).length > 0;
    const status: ActivityStatus =
      analysis.status === "applied"
        ? "success"
        : analysis.status === "validated"
        ? "success"
        : analysis.status === "rejected"
        ? "ignored"
        : hasWarnings
        ? "to_validate"
        : "new";

    const correspondent =
      analysis.suggestedCorrespondentName ?? "Correspondant à valider";

    return {
      id: `ai-${analysis.id}`,
      timestamp: analysis.updatedAt ?? analysis.createdAt,
      source: "ai",
      category: status === "ignored" ? "info" : "analysis",
      title:
        status === "success"
          ? "Analyse IA validée"
          : status === "to_validate"
          ? "Analyse IA à valider"
          : "Analyse IA terminée",
      description: `${analysis.detectedDocumentKind} · ${correspondent}`,
      status,
      href: `/ia/document/${analysis.documentId}`,
      technicalRef: analysis.id,
      priority: hasWarnings ? "high" : "normal",
    };
  });
}

/**
 * Trie les événements par timestamp décroissant (plus récent en premier).
 */
export function sortEvents(events: ActivityEvent[]): ActivityEvent[] {
  return [...events].sort((a, b) =>
    a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0
  );
}
