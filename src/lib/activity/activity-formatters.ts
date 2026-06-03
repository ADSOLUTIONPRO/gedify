/**
 * Humanisation des données techniques pour la page Activité.
 *
 * Ces fonctions n'effectuent aucun appel réseau et sont sûres côté serveur
 * comme côté client.
 */

export type ActivitySource =
  | "paperless"
  | "tasks"
  | "email"
  | "ai"
  | "budget"
  | "workflow"
  | "system";

export type ActivityStatus =
  | "success"
  | "new"
  | "to_validate"
  | "imported"
  | "in_progress"
  | "error"
  | "ignored"
  | "pending";

const TASK_HUMAN_LABELS: Record<string, string> = {
  train_classifier: "Entraînement du classifieur",
  consume_file: "Import d'un document",
  index_document: "Indexation du document",
  ocr_document: "OCR du document",
  sync_mail: "Synchronisation email",
  analyze_document: "Analyse IA",
  bulk_edit_documents: "Édition en lot",
  empty_trash: "Vidage de la corbeille",
  update_document_archive_file: "Archivage du document",
  check_sanity: "Contrôle de cohérence",
  scan_mail: "Lecture des emails",
  consume_mail: "Import du courrier",
};

const TASK_KEYWORD_LABELS: Array<[RegExp, string]> = [
  [/consume/i, "Import"],
  [/index/i, "Indexation"],
  [/ocr/i, "OCR"],
  [/classif/i, "Classifieur"],
  [/mail/i, "Email"],
  [/train/i, "Entraînement"],
  [/analyz/i, "Analyse"],
  [/sanity/i, "Contrôle"],
  [/trash/i, "Corbeille"],
];

const STATUS_LABELS: Record<ActivityStatus, string> = {
  success: "Succès",
  new: "Nouveau",
  to_validate: "À valider",
  imported: "Importé",
  in_progress: "En cours",
  error: "Erreur",
  ignored: "Ignoré",
  pending: "En attente",
};

const SOURCE_LABELS: Record<ActivitySource, string> = {
  paperless: "Paperless",
  tasks: "Tâches",
  email: "Emails",
  ai: "Analyse IA",
  budget: "Budget",
  workflow: "Workflows",
  system: "Système",
};

export function formatTaskName(raw: string | null | undefined): string {
  if (!raw) return "Tâche";
  const trimmed = raw.trim();
  if (TASK_HUMAN_LABELS[trimmed]) return TASK_HUMAN_LABELS[trimmed];
  for (const [pattern, label] of TASK_KEYWORD_LABELS) {
    if (pattern.test(trimmed)) return label;
  }
  // Default: snake_case → Title Case
  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function formatEventSource(source: ActivitySource): string {
  return SOURCE_LABELS[source] ?? source;
}

export function formatEventStatus(status: ActivityStatus | string): string {
  if (status in STATUS_LABELS) return STATUS_LABELS[status as ActivityStatus];
  return status;
}

/**
 * Normalise un statut Paperless brut vers `ActivityStatus`.
 */
export function normalizeStatus(raw: string | undefined | null): ActivityStatus {
  if (!raw) return "in_progress";
  const lower = raw.toLowerCase();
  if (["success", "succeeded", "done", "completed"].includes(lower)) return "success";
  if (["failure", "failed", "error"].includes(lower)) return "error";
  if (["started", "pending", "running"].includes(lower)) return "in_progress";
  if (lower === "retry") return "pending";
  return "in_progress";
}

/**
 * Format relatif compact (« il y a 6 min », « hier », « il y a 3 j »).
 * Renvoie une date absolue formatée si > 30 jours.
 */
export function formatDateRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "hier";
  if (days <= 7) return `il y a ${days} j`;
  if (days <= 30) return `il y a ${days} j`;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export type TimeBucket = "today" | "yesterday" | "this_week" | "older";

const TIME_BUCKET_LABELS: Record<TimeBucket, string> = {
  today: "Aujourd'hui",
  yesterday: "Hier",
  this_week: "Cette semaine",
  older: "Plus ancien",
};

export function bucketByTime(iso: string | null | undefined): TimeBucket {
  if (!iso) return "older";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "older";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86_400_000;
  const sevenDaysAgo = today - 7 * 86_400_000;
  const t = date.getTime();
  if (t >= today) return "today";
  if (t >= yesterday) return "yesterday";
  if (t >= sevenDaysAgo) return "this_week";
  return "older";
}

export function timeBucketLabel(bucket: TimeBucket): string {
  return TIME_BUCKET_LABELS[bucket];
}

export function formatHourMinute(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

const STATUS_TONE: Record<ActivityStatus, "blue" | "violet" | "emerald" | "amber" | "rose" | "slate"> = {
  success: "emerald",
  new: "blue",
  to_validate: "amber",
  imported: "emerald",
  in_progress: "blue",
  error: "rose",
  ignored: "slate",
  pending: "amber",
};

export function statusTone(status: ActivityStatus): "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" {
  return STATUS_TONE[status] ?? "slate";
}

const SOURCE_TONE: Record<ActivitySource, "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange"> = {
  paperless: "blue",
  tasks: "blue",
  ai: "violet",
  email: "blue",
  budget: "emerald",
  workflow: "orange",
  system: "slate",
};

export function sourceTone(source: ActivitySource): "blue" | "violet" | "emerald" | "amber" | "rose" | "slate" | "orange" {
  return SOURCE_TONE[source] ?? "slate";
}

const SOURCE_ACCENT: Record<ActivitySource, string> = {
  paperless: "#0B5CFF",
  tasks: "#0B5CFF",
  ai: "#7C3AED",
  email: "#06B6D4",
  budget: "#16A34A",
  workflow: "#F97316",
  system: "#64748B",
};

export function sourceAccent(source: ActivitySource): string {
  return SOURCE_ACCENT[source] ?? "#64748B";
}
