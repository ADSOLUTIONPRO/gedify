import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import type {
  ProjectFolder,
  ProjectFolderInput,
  ProjectFolderPatch,
  ProjectStats,
  ProjectStoreInfo,
  ProjectStoreType,
} from "@/lib/projects/project-types";
import {
  childrenOf,
  createProjectFolder,
  createTimelineEvent,
  descendantIds,
  getProjectStats,
  mergeProjectIds,
  normalizeProjectIds,
  removeProjectIds,
  updateProjectFolderData,
  wouldCreateCycle,
} from "@/lib/projects/project-utils";

const DEV_STORE_FILE = "project-folders.json";
const JSON_WARNING =
  "Stockage JSON local côté serveur. Suffisant pour le développement, à remplacer par une base dédiée avant production multi-instance.";
const MEMORY_WARNING =
  "Stockage mémoire côté serveur. Les dossiers sont perdus au redémarrage du serveur.";

let memoryProjects: ProjectFolder[] = [];

function getConfiguredStoreType(): ProjectStoreType {
  const value = process.env.PROJECT_STORE_TYPE;

  if (value === "memory" || value === "json" || value === "postgres" || value === "supabase") {
    return value;
  }

  return "json";
}

function getJsonStorePath() {
  return path.join(getDataDir(), DEV_STORE_FILE);
}

export function getProjectStoreInfo(): ProjectStoreInfo {
  const type = getConfiguredStoreType();

  if (type === "json") {
    return {
      type,
      persistent: true,
      path: getJsonStorePath(),
      warning: JSON_WARNING,
    };
  }

  if (type === "memory") {
    return {
      type,
      persistent: false,
      warning: MEMORY_WARNING,
    };
  }

  return {
    type,
    persistent: false,
    warning: `PROJECT_STORE_TYPE=${type} est prévu, mais le connecteur de persistance n'est pas encore branché.`,
  };
}

async function assertSupportedStore() {
  const type = getConfiguredStoreType();

  if (type === "postgres" || type === "supabase") {
    throw new Error(
      `PROJECT_STORE_TYPE=${type} est préparé mais pas encore implémenté. Utilisez json ou memory pour cette version.`
    );
  }
}

async function readProjects(): Promise<ProjectFolder[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<ProjectFolder>("folders");
    } catch (e) {
      if (jsonFallback()) return readProjectsJson();
      throw e;
    }
  }
  return readProjectsJson();
}

async function readProjectsJson(): Promise<ProjectFolder[]> {
  await assertSupportedStore();

  if (getConfiguredStoreType() === "memory") {
    return memoryProjects;
  }

  try {
    const contents = await readFile(getJsonStorePath(), "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return Array.isArray(parsed) ? (parsed as ProjectFolder[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeProjects(projects: ProjectFolder[]) {
  if (pgStorageActive()) {
    await pgWriteAll<ProjectFolder>("folders", "id", (p) => p.id, projects);
    return;
  }
  await assertSupportedStore();

  if (getConfiguredStoreType() === "memory") {
    memoryProjects = projects;
    return;
  }

  const filePath = getJsonStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(projects, null, 2)}\n`, "utf8");
}

export async function listProjectFolders() {
  const projects = await readProjects();
  return projects.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getProjectFolder(id: string) {
  const projects = await readProjects();
  return projects.find((project) => project.id === id || project.slug === id) ?? null;
}

export async function createProject(input: ProjectFolderInput) {
  if (!input.name?.trim()) {
    throw new Error("Le nom du dossier est obligatoire.");
  }

  const projects = await readProjects();
  if (input.parentId && !projects.some((p) => p.id === input.parentId)) {
    throw new Error("Dossier parent introuvable.");
  }
  const project = createProjectFolder(input);
  projects.unshift(project);
  await writeProjects(projects);
  return project;
}

export async function updateProject(id: string, patch: ProjectFolderPatch) {
  const projects = await readProjects();
  const index = projects.findIndex((project) => project.id === id || project.slug === id);

  if (index === -1) {
    return null;
  }

  if (patch.name !== undefined && !patch.name.trim()) {
    throw new Error("Le nom du dossier est obligatoire.");
  }

  if (patch.parentId !== undefined && patch.parentId) {
    if (wouldCreateCycle(projects[index].id, patch.parentId, projects)) {
      throw new Error("Déplacement impossible : un dossier ne peut pas être placé dans lui-même ou un de ses sous-dossiers.");
    }
    if (!projects.some((p) => p.id === patch.parentId)) {
      throw new Error("Dossier parent introuvable.");
    }
  }

  const updated = updateProjectFolderData(projects[index], patch);
  projects[index] = updated;
  await writeProjects(projects);
  return updated;
}

/**
 * Supprime un dossier.
 *  - "reparent" (défaut) : les sous-dossiers remontent au parent du supprimé.
 *  - "cascade" : supprime le dossier ET tous ses descendants.
 * Ne supprime jamais de documents (ils vivent dans la GED ; on retire juste
 * leur lien au dossier en supprimant celui-ci).
 */
export async function deleteProject(id: string, mode: "reparent" | "cascade" = "reparent") {
  const projects = await readProjects();
  const target = projects.find((project) => project.id === id || project.slug === id);
  if (!target) return false;

  if (mode === "cascade") {
    const toDelete = new Set<string>([target.id, ...descendantIds(target.id, projects)]);
    await writeProjects(projects.filter((p) => !toDelete.has(p.id)));
    return true;
  }

  // reparent : les enfants directs remontent au parent du supprimé.
  const next = projects
    .filter((p) => p.id !== target.id)
    .map((p) => ((p.parentId ?? null) === target.id ? { ...p, parentId: target.parentId } : p));
  await writeProjects(next);
  return true;
}

/**
 * Résout (find-or-create) une chaîne « A / B / C » et renvoie le dossier feuille.
 * Réutilisé par l'IA (sous-dossiers automatiques) et l'association par chemin.
 */
export async function resolveFolderPath(pathStr: string): Promise<ProjectFolder | null> {
  const segments = pathStr.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  const projects = await readProjects();
  let parentId: string | null = null;
  let current: ProjectFolder | null = null;
  let dirty = false;

  for (const name of segments) {
    const lower = name.toLowerCase();
    let match: ProjectFolder | null = childrenOf(parentId, projects).find((f) => f.name.toLowerCase() === lower) ?? null;
    if (!match) {
      match = createProjectFolder({ name, parentId });
      projects.unshift(match);
      dirty = true;
    }
    current = match;
    parentId = match.id;
  }

  if (dirty) await writeProjects(projects);
  return current;
}

export async function linkProjectDocuments(id: string, documentIdsInput: unknown) {
  const documentIds = normalizeProjectIds(documentIdsInput);
  const project = await getProjectFolder(id);

  if (!project) {
    return null;
  }

  const addedIds = documentIds.filter((documentId) => !project.linkedDocumentIds.includes(documentId));
  const nextProject = await updateProject(id, {
    linkedDocumentIds: mergeProjectIds(project.linkedDocumentIds, documentIds),
  });

  if (!nextProject || addedIds.length === 0) {
    return nextProject;
  }

  const projects = await readProjects();
  const index = projects.findIndex((item) => item.id === nextProject.id);
  if (index >= 0) {
    projects[index] = {
      ...nextProject,
      timeline: [
        ...addedIds.map((documentId) =>
          createTimelineEvent(
            "document_linked",
            "Document ajouté au dossier",
            `Document Paperless #${documentId}`,
            documentId
          )
        ),
        ...nextProject.timeline,
      ],
    };
    await writeProjects(projects);
    return projects[index];
  }

  return nextProject;
}

export async function unlinkProjectDocuments(id: string, documentIdsInput: unknown) {
  const documentIds = normalizeProjectIds(documentIdsInput);
  const project = await getProjectFolder(id);

  if (!project) {
    return null;
  }

  const removedIds = documentIds.filter((documentId) =>
    project.linkedDocumentIds.includes(documentId)
  );
  const nextProject = await updateProject(id, {
    linkedDocumentIds: removeProjectIds(project.linkedDocumentIds, documentIds),
  });

  if (!nextProject || removedIds.length === 0) {
    return nextProject;
  }

  const projects = await readProjects();
  const index = projects.findIndex((item) => item.id === nextProject.id);
  if (index >= 0) {
    projects[index] = {
      ...nextProject,
      timeline: [
        ...removedIds.map((documentId) =>
          createTimelineEvent(
            "document_unlinked",
            "Document retiré du dossier",
            `Document Paperless #${documentId}`,
            documentId
          )
        ),
        ...nextProject.timeline,
      ],
    };
    await writeProjects(projects);
    return projects[index];
  }

  return nextProject;
}

export async function getProjectFolderStats(id: string): Promise<ProjectStats | null> {
  const project = await getProjectFolder(id);
  return project ? getProjectStats(project) : null;
}
