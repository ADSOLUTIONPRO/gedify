export type GedVisibility = "private" | "shared" | "admin";
export type GedDisplayMode = "table" | "cards";
export type GedDensity = "compact" | "comfortable";

export type GedSavedView = {
  id: string;
  name: string;
  description: string;
  sourcePath: string;
  filters: Record<string, string>;
  includeProjects: boolean;
  displayMode: GedDisplayMode;
  density: GedDensity;
  visibility: GedVisibility;
  nativePaperlessViewId: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GedSavedViewInput = Partial<
  Omit<GedSavedView, "id" | "createdAt" | "updatedAt" | "lastUsedAt">
> & {
  name: string;
};

export type GedWorkflowKind = "paperless" | "ged" | "hybrid";

export type GedWorkflowCondition = {
  field: string;
  operator: string;
  value: string;
};

export type GedWorkflowAction = {
  type: string;
  value: string;
};

export type GedWorkflow = {
  id: string;
  name: string;
  description: string;
  kind: GedWorkflowKind;
  enabled: boolean;
  trigger: string;
  conditions: GedWorkflowCondition[];
  actions: GedWorkflowAction[];
  priority: number;
  logging: boolean;
  lastRunAt: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string;
};

export type GedWorkflowInput = Partial<
  Omit<GedWorkflow, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "runCount">
> & {
  name: string;
};

export type GedLogLevel = "info" | "success" | "warning" | "error";
export type GedLogSource = "Paperless" | "GED" | "Email" | "Workflow" | "Cloud" | "API";

export type GedLog = {
  id: string;
  level: GedLogLevel;
  source: GedLogSource;
  message: string;
  details?: string;
  documentId?: number | null;
  projectId?: string | null;
  user?: string | null;
  createdAt: string;
};

export type GedLogInput = Omit<GedLog, "id" | "createdAt">;

export type GedActivityEvent = {
  id: string;
  type: string;
  source: GedLogSource;
  label: string;
  details?: string;
  href?: string;
  createdAt: string;
};
