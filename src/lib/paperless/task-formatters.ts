/**
 * Humanise les noms techniques des tâches Paperless.
 * Le nom brut (task_id UUID, type technique) reste disponible dans les
 * détails techniques — on ne l'expose pas en titre principal.
 */

export type TaskHumanInfo = {
  label: string;
  shortLabel: string;
  icon: "import" | "ocr" | "index" | "classify" | "thumbnail" | "archive" | "train" | "generic";
};

const TASK_HUMAN_MAP: Record<string, TaskHumanInfo> = {
  consume_file: {
    label: "Import du document",
    shortLabel: "Import",
    icon: "import",
  },
  ocr_document: {
    label: "Lecture OCR du document",
    shortLabel: "OCR",
    icon: "ocr",
  },
  index_document: {
    label: "Indexation du document",
    shortLabel: "Indexation",
    icon: "index",
  },
  train_classifier: {
    label: "Entraînement du classifieur",
    shortLabel: "Entraînement",
    icon: "train",
  },
  classify_document: {
    label: "Classement automatique Paperless",
    shortLabel: "Classement",
    icon: "classify",
  },
  generate_thumbnail: {
    label: "Génération de l'aperçu",
    shortLabel: "Aperçu",
    icon: "thumbnail",
  },
  archive_document: {
    label: "Archivage du document",
    shortLabel: "Archive",
    icon: "archive",
  },
};

export function getTaskHumanInfo(taskType: string | null | undefined): TaskHumanInfo {
  if (!taskType) {
    return { label: "Tâche en cours", shortLabel: "Tâche", icon: "generic" };
  }
  const key = taskType.trim().toLowerCase();
  return (
    TASK_HUMAN_MAP[key] ?? {
      label: taskType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      shortLabel: taskType.split("_").slice(-1)[0] ?? taskType,
      icon: "generic",
    }
  );
}

export function humanizeTaskStatus(status: string): string {
  switch (status.toUpperCase()) {
    case "PENDING":
      return "En attente";
    case "STARTED":
      return "En cours";
    case "SUCCESS":
      return "Terminé";
    case "FAILURE":
      return "Erreur";
    case "REVOKED":
      return "Annulé";
    default:
      return status;
  }
}
