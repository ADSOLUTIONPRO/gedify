export const PROJECT_CATEGORIES = [
  "Administratif",
  "Juridique",
  "Logement",
  "Travail",
  "Santé",
  "Banque",
  "Assurance",
  "Fiscalité",
  "Famille",
  "Entreprise",
  "Formation",
  "Autre",
] as const;

export const PROJECT_STATUSES = [
  "En cours",
  "À traiter",
  "En attente",
  "Important",
  "Terminé",
  "Archivé",
] as const;

export const PROJECT_PRIORITIES = ["Basse", "Normale", "Haute", "Urgente"] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export type ProjectTimelineEventType =
  | "created"
  | "updated"
  | "document_linked"
  | "document_unlinked"
  | "status_changed"
  | "note_added"
  | "tag_synced";

export type ProjectTimelineEvent = {
  id: string;
  type: ProjectTimelineEventType;
  label: string;
  at: string;
  details?: string;
  documentId?: number;
};

export type ProjectFolder = {
  id: string;
  /** Dossier parent (null = racine). Source de vérité de l'arborescence. */
  parentId: string | null;
  name: string;
  slug: string;
  description: string;
  category: ProjectCategory;
  status: ProjectStatus;
  priority: ProjectPriority;
  color: string;
  icon: string;
  openedAt: string | null;
  dueDate: string | null;
  closedAt: string | null;
  notes: string;
  linkedDocumentIds: number[];
  linkedCorrespondentIds: number[];
  linkedTagIds: number[];
  linkedDocumentTypeIds: number[];
  syncWithPaperlessTag: boolean;
  paperlessTagId: number | null;
  paperlessTagName: string | null;
  timeline: ProjectTimelineEvent[];
  createdAt: string;
  updatedAt: string;
};

export type ProjectFolderInput = {
  name: string;
  parentId?: string | null;
  description?: string;
  category?: ProjectCategory;
  status?: ProjectStatus;
  priority?: ProjectPriority;
  color?: string;
  icon?: string;
  openedAt?: string | null;
  dueDate?: string | null;
  closedAt?: string | null;
  notes?: string;
  linkedDocumentIds?: number[];
  linkedCorrespondentIds?: number[];
  linkedTagIds?: number[];
  linkedDocumentTypeIds?: number[];
  syncWithPaperlessTag?: boolean;
  paperlessTagId?: number | null;
  paperlessTagName?: string | null;
};

export type ProjectFolderPatch = Partial<ProjectFolderInput>;

/** Nœud d'arborescence : dossier + enfants + métadonnées calculées. */
export type FolderTreeNode = ProjectFolder & {
  children: FolderTreeNode[];
  level: number;
  path: string;
  /** Documents du dossier + de tous ses descendants (dédoublonnés). */
  documentsCountDeep: number;
};

export type ProjectStoreType = "memory" | "json" | "postgres" | "supabase";

export type ProjectStoreInfo = {
  type: ProjectStoreType;
  persistent: boolean;
  path?: string;
  warning?: string;
};

export type ProjectStats = {
  totalDocuments: number;
  totalCorrespondents: number;
  totalTags: number;
  totalDocumentTypes: number;
  documentsToProcess: number;
  dueSoon: boolean;
  overdue: boolean;
};
