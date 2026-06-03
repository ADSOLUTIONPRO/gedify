import { randomUUID } from "node:crypto";
import type {
  FolderTreeNode,
  ProjectCategory,
  ProjectFolder,
  ProjectFolderInput,
  ProjectFolderPatch,
  ProjectPriority,
  ProjectStats,
  ProjectStatus,
  ProjectTimelineEvent,
  ProjectTimelineEventType,
} from "@/lib/projects/project-types";
import {
  PROJECT_CATEGORIES,
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
} from "@/lib/projects/project-types";

const DEFAULT_COLOR = "#2563eb";
const DEFAULT_ICON = "folder-kanban";

function includesConst<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

export function slugifyProjectName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

export function normalizeProjectDate(value: unknown) {
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  return value.slice(0, 10);
}

export function normalizeProjectIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
}

export function normalizeProjectCategory(value: unknown): ProjectCategory {
  return includesConst(PROJECT_CATEGORIES, value) ? value : "Administratif";
}

export function normalizeProjectStatus(value: unknown): ProjectStatus {
  return includesConst(PROJECT_STATUSES, value) ? value : "En cours";
}

export function normalizeProjectPriority(value: unknown): ProjectPriority {
  return includesConst(PROJECT_PRIORITIES, value) ? value : "Normale";
}

export function createTimelineEvent(
  type: ProjectTimelineEventType,
  label: string,
  details?: string,
  documentId?: number
): ProjectTimelineEvent {
  return {
    id: randomUUID(),
    type,
    label,
    at: new Date().toISOString(),
    ...(details ? { details } : {}),
    ...(documentId ? { documentId } : {}),
  };
}

export function createProjectFolder(input: ProjectFolderInput): ProjectFolder {
  const now = new Date().toISOString();
  const name = input.name.trim();

  return {
    id: randomUUID(),
    parentId: input.parentId ?? null,
    name,
    slug: slugifyProjectName(name) || "dossier",
    description: input.description?.trim() ?? "",
    category: normalizeProjectCategory(input.category),
    status: normalizeProjectStatus(input.status),
    priority: normalizeProjectPriority(input.priority),
    color: input.color || DEFAULT_COLOR,
    icon: input.icon || DEFAULT_ICON,
    openedAt: normalizeProjectDate(input.openedAt) ?? now.slice(0, 10),
    dueDate: normalizeProjectDate(input.dueDate),
    closedAt: normalizeProjectDate(input.closedAt),
    notes: input.notes?.trim() ?? "",
    linkedDocumentIds: normalizeProjectIds(input.linkedDocumentIds),
    linkedCorrespondentIds: normalizeProjectIds(input.linkedCorrespondentIds),
    linkedTagIds: normalizeProjectIds(input.linkedTagIds),
    linkedDocumentTypeIds: normalizeProjectIds(input.linkedDocumentTypeIds),
    syncWithPaperlessTag: Boolean(input.syncWithPaperlessTag),
    paperlessTagId:
      input.paperlessTagId === undefined || input.paperlessTagId === null
        ? null
        : Number(input.paperlessTagId),
    paperlessTagName: input.paperlessTagName?.trim() || null,
    timeline: [createTimelineEvent("created", "Dossier créé")],
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProjectFolderData(
  project: ProjectFolder,
  patch: ProjectFolderPatch
): ProjectFolder {
  const nextName = patch.name === undefined ? project.name : patch.name.trim();
  const now = new Date().toISOString();
  const timeline = [...project.timeline];

  if (patch.status && patch.status !== project.status) {
    timeline.unshift(
      createTimelineEvent(
        "status_changed",
        "Statut modifié",
        `${project.status} vers ${patch.status}`
      )
    );
  } else {
    timeline.unshift(createTimelineEvent("updated", "Dossier mis à jour"));
  }

  if (patch.parentId !== undefined && patch.parentId !== project.parentId) {
    timeline.unshift(createTimelineEvent("updated", "Dossier déplacé"));
  }

  return {
    ...project,
    parentId: patch.parentId === undefined ? project.parentId : patch.parentId,
    name: nextName,
    slug: patch.name === undefined ? project.slug : slugifyProjectName(nextName) || project.slug,
    description:
      patch.description === undefined ? project.description : patch.description.trim(),
    category:
      patch.category === undefined ? project.category : normalizeProjectCategory(patch.category),
    status: patch.status === undefined ? project.status : normalizeProjectStatus(patch.status),
    priority:
      patch.priority === undefined ? project.priority : normalizeProjectPriority(patch.priority),
    color: patch.color === undefined ? project.color : patch.color || DEFAULT_COLOR,
    icon: patch.icon === undefined ? project.icon : patch.icon || DEFAULT_ICON,
    openedAt:
      patch.openedAt === undefined ? project.openedAt : normalizeProjectDate(patch.openedAt),
    dueDate: patch.dueDate === undefined ? project.dueDate : normalizeProjectDate(patch.dueDate),
    closedAt:
      patch.closedAt === undefined ? project.closedAt : normalizeProjectDate(patch.closedAt),
    notes: patch.notes === undefined ? project.notes : patch.notes.trim(),
    linkedDocumentIds:
      patch.linkedDocumentIds === undefined
        ? project.linkedDocumentIds
        : normalizeProjectIds(patch.linkedDocumentIds),
    linkedCorrespondentIds:
      patch.linkedCorrespondentIds === undefined
        ? project.linkedCorrespondentIds
        : normalizeProjectIds(patch.linkedCorrespondentIds),
    linkedTagIds:
      patch.linkedTagIds === undefined ? project.linkedTagIds : normalizeProjectIds(patch.linkedTagIds),
    linkedDocumentTypeIds:
      patch.linkedDocumentTypeIds === undefined
        ? project.linkedDocumentTypeIds
        : normalizeProjectIds(patch.linkedDocumentTypeIds),
    syncWithPaperlessTag:
      patch.syncWithPaperlessTag === undefined
        ? project.syncWithPaperlessTag
        : Boolean(patch.syncWithPaperlessTag),
    paperlessTagId:
      patch.paperlessTagId === undefined
        ? project.paperlessTagId
        : patch.paperlessTagId === null
          ? null
          : Number(patch.paperlessTagId),
    paperlessTagName:
      patch.paperlessTagName === undefined
        ? project.paperlessTagName
        : patch.paperlessTagName?.trim() || null,
    timeline,
    updatedAt: now,
  };
}

export function projectMatchesQuery(project: ProjectFolder, query?: string | null) {
  if (!query) {
    return true;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const haystack = [
    project.name,
    project.description,
    project.category,
    project.status,
    project.priority,
    project.notes,
    project.paperlessTagName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function getProjectStats(project: ProjectFolder): ProjectStats {
  const now = new Date();
  const dueDate = project.dueDate ? new Date(project.dueDate) : null;
  const msInDay = 24 * 60 * 60 * 1000;
  const daysBeforeDue = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / msInDay) : null;

  return {
    totalDocuments: project.linkedDocumentIds.length,
    totalCorrespondents: project.linkedCorrespondentIds.length,
    totalTags: project.linkedTagIds.length,
    totalDocumentTypes: project.linkedDocumentTypeIds.length,
    documentsToProcess: 0,
    dueSoon: daysBeforeDue !== null && daysBeforeDue >= 0 && daysBeforeDue <= 14,
    overdue: daysBeforeDue !== null && daysBeforeDue < 0,
  };
}

export function mergeProjectIds(current: number[], incoming: number[]) {
  return Array.from(new Set([...current, ...incoming])).sort((a, b) => a - b);
}

export function removeProjectIds(current: number[], incoming: number[]) {
  const toRemove = new Set(incoming);
  return current.filter((item) => !toRemove.has(item));
}

/* ── Arborescence ──────────────────────────────────────────────────────── */

/** Index id → dossier. */
export function indexFoldersById(folders: ProjectFolder[]): Map<string, ProjectFolder> {
  return new Map(folders.map((f) => [f.id, f]));
}

/** Chemin lisible « A / B / C » (remonte la chaîne des parents, anti-boucle). */
export function computeFolderPath(folder: ProjectFolder, byId: Map<string, ProjectFolder>): string {
  const names: string[] = [];
  const seen = new Set<string>();
  let current: ProjectFolder | undefined = folder;
  while (current && !seen.has(current.id)) {
    names.unshift(current.name);
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" / ");
}

/** Niveau de profondeur (0 = racine). */
export function computeFolderLevel(folder: ProjectFolder, byId: Map<string, ProjectFolder>): number {
  let level = 0;
  const seen = new Set<string>();
  let current = folder.parentId ? byId.get(folder.parentId) : undefined;
  while (current && !seen.has(current.id)) {
    level += 1;
    seen.add(current.id);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return level;
}

/** Enfants directs d'un dossier (null = racines). */
export function childrenOf(parentId: string | null, folders: ProjectFolder[]): ProjectFolder[] {
  return folders.filter((f) => (f.parentId ?? null) === parentId);
}

/** Ids de tous les descendants (récursif). */
export function descendantIds(id: string, folders: ProjectFolder[]): string[] {
  const out: string[] = [];
  const stack = [id];
  const seen = new Set<string>([id]);
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of folders) {
      if ((child.parentId ?? null) === current && !seen.has(child.id)) {
        seen.add(child.id);
        out.push(child.id);
        stack.push(child.id);
      }
    }
  }
  return out;
}

/** Vrai si déplacer `id` sous `newParentId` créerait un cycle (ou self). */
export function wouldCreateCycle(id: string, newParentId: string | null, folders: ProjectFolder[]): boolean {
  if (!newParentId) return false;
  if (newParentId === id) return true;
  return descendantIds(id, folders).includes(newParentId);
}

/** Documents du dossier + descendants (dédoublonnés). */
export function deepDocumentCount(id: string, folders: ProjectFolder[]): number {
  const ids = new Set<number>();
  const targets = [id, ...descendantIds(id, folders)];
  const byId = indexFoldersById(folders);
  for (const t of targets) {
    const f = byId.get(t);
    if (f) for (const d of f.linkedDocumentIds) ids.add(d);
  }
  return ids.size;
}

/** Construit l'arbre (racines → enfants) avec path/level/compteur profond. */
export function buildFolderTree(folders: ProjectFolder[]): FolderTreeNode[] {
  const byId = indexFoldersById(folders);
  const sortFn = (a: ProjectFolder, b: ProjectFolder) => a.name.localeCompare(b.name, "fr");
  function build(parentId: string | null, level: number): FolderTreeNode[] {
    return childrenOf(parentId, folders)
      .sort(sortFn)
      .map((f) => ({
        ...f,
        level,
        path: computeFolderPath(f, byId),
        documentsCountDeep: deepDocumentCount(f.id, folders),
        children: build(f.id, level + 1),
      }));
  }
  return build(null, 0);
}
