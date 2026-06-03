export type ActionType =
  | "to-pay"
  | "to-reply"
  | "to-forward"
  | "to-verify"
  | "to-classify"
  | "to-follow-up"
  | "to-sign"
  | "to-send"
  | "to-keep"
  | "to-archive"
  | "to-call"
  | "to-prepare"
  | "to-declare"
  | "to-contest";

export type ActionStatus =
  | "todo"
  | "in-progress"
  | "waiting"
  | "done"
  | "cancelled"
  | "overdue";

export type ActionPriority = "low" | "normal" | "high" | "urgent";

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  type: ActionType;
  status: ActionStatus;
  priority: ActionPriority;
  dueDate: string | null;
  documentIds: number[];
  projectId: string | null;
  correspondentId: number | null;
  budgetItemId: string | null;
  amount: number | null;
  currency: string | null;
  createdFrom: "manual" | "ai" | "import";
  aiAnalysisId: string | null;
  aiConfidence: "low" | "medium" | "high" | null;
  notes: string;
  history: ActionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ActionHistoryEntry = {
  at: string;
  kind: "created" | "updated" | "status-changed" | "postponed" | "linked-document" | "note";
  message: string;
};

export type ActionItemInput = Partial<
  Omit<ActionItem, "id" | "history" | "createdAt" | "updatedAt" | "completedAt">
>;

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  "to-pay": "À payer",
  "to-reply": "À répondre",
  "to-forward": "À transmettre",
  "to-verify": "À vérifier",
  "to-classify": "À classer",
  "to-follow-up": "À relancer",
  "to-sign": "À signer",
  "to-send": "À envoyer",
  "to-keep": "À conserver",
  "to-archive": "À archiver",
  "to-call": "À appeler",
  "to-prepare": "À préparer",
  "to-declare": "À déclarer",
  "to-contest": "À contester",
};

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  todo: "À faire",
  "in-progress": "En cours",
  waiting: "En attente",
  done: "Terminée",
  cancelled: "Annulée",
  overdue: "En retard",
};

export const ACTION_PRIORITY_LABELS: Record<ActionPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};
