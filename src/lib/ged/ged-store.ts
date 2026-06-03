import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDataDir } from "@/lib/storage/data-dir";
import type {
  GedLog,
  GedLogInput,
  GedSavedView,
  GedSavedViewInput,
  GedWorkflow,
  GedWorkflowInput,
} from "@/lib/ged/ged-types";

const MAX_LOGS = 1000;

function getStorePath(fileName: string) {
  return path.join(getDataDir(), fileName);
}

async function readJsonArray<T>(fileName: string): Promise<T[]> {
  try {
    const raw = await readFile(getStorePath(fileName), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJsonArray<T>(fileName: string, values: T[]) {
  const filePath = getStorePath(fileName);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(values, null, 2)}\n`, "utf8");
}

function normalizeFilters(filters: unknown): Record<string, string> {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, String(value ?? "")])
      .filter(([, value]) => value !== "")
  );
}

export async function listGedViews() {
  const views = await readJsonArray<GedSavedView>("ged-views.json");
  return views.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getGedView(id: string) {
  const views = await readJsonArray<GedSavedView>("ged-views.json");
  return views.find((view) => view.id === id) ?? null;
}

export async function createGedView(input: GedSavedViewInput) {
  if (!input.name?.trim()) {
    throw new Error("Le nom de la vue est obligatoire.");
  }

  const now = new Date().toISOString();
  const views = await readJsonArray<GedSavedView>("ged-views.json");
  const view: GedSavedView = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    sourcePath: input.sourcePath ?? "/recherche",
    filters: normalizeFilters(input.filters),
    includeProjects: Boolean(input.includeProjects),
    displayMode: input.displayMode ?? "table",
    density: input.density ?? "comfortable",
    visibility: input.visibility ?? "private",
    nativePaperlessViewId: input.nativePaperlessViewId ?? null,
    lastUsedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  views.unshift(view);
  await writeJsonArray("ged-views.json", views);
  await appendGedLog({
    level: "success",
    source: "GED",
    message: `Vue GED créée : ${view.name}`,
    details: JSON.stringify(view.filters),
  });
  return view;
}

export async function updateGedView(id: string, input: Partial<GedSavedViewInput>) {
  const views = await readJsonArray<GedSavedView>("ged-views.json");
  const index = views.findIndex((view) => view.id === id);

  if (index === -1) {
    return null;
  }

  const current = views[index];
  const updated: GedSavedView = {
    ...current,
    name: input.name === undefined ? current.name : input.name.trim(),
    description:
      input.description === undefined ? current.description : input.description.trim(),
    sourcePath: input.sourcePath ?? current.sourcePath,
    filters: input.filters === undefined ? current.filters : normalizeFilters(input.filters),
    includeProjects:
      input.includeProjects === undefined ? current.includeProjects : Boolean(input.includeProjects),
    displayMode: input.displayMode ?? current.displayMode,
    density: input.density ?? current.density,
    visibility: input.visibility ?? current.visibility,
    nativePaperlessViewId:
      input.nativePaperlessViewId === undefined
        ? current.nativePaperlessViewId
        : input.nativePaperlessViewId,
    updatedAt: new Date().toISOString(),
  };

  views[index] = updated;
  await writeJsonArray("ged-views.json", views);
  return updated;
}

export async function deleteGedView(id: string) {
  const views = await readJsonArray<GedSavedView>("ged-views.json");
  const next = views.filter((view) => view.id !== id);

  if (next.length === views.length) {
    return false;
  }

  await writeJsonArray("ged-views.json", next);
  return true;
}

export async function listGedWorkflows() {
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  return workflows.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export async function getGedWorkflow(id: string) {
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  return workflows.find((workflow) => workflow.id === id) ?? null;
}

export async function createGedWorkflow(input: GedWorkflowInput) {
  if (!input.name?.trim()) {
    throw new Error("Le nom du workflow est obligatoire.");
  }

  const now = new Date().toISOString();
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  const workflow: GedWorkflow = {
    id: randomUUID(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    kind: input.kind ?? "ged",
    enabled: input.enabled ?? true,
    trigger: input.trigger ?? "document-imported",
    conditions: input.conditions ?? [],
    actions: input.actions ?? [],
    priority: Number(input.priority ?? workflows.length + 1),
    logging: input.logging ?? true,
    lastRunAt: null,
    runCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  workflows.unshift(workflow);
  await writeJsonArray("ged-workflows.json", workflows);
  await appendGedLog({
    level: "success",
    source: "Workflow",
    message: `Workflow GED créé : ${workflow.name}`,
  });
  return workflow;
}

export async function updateGedWorkflow(id: string, input: Partial<GedWorkflowInput>) {
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  const index = workflows.findIndex((workflow) => workflow.id === id);

  if (index === -1) {
    return null;
  }

  const current = workflows[index];
  const updated: GedWorkflow = {
    ...current,
    name: input.name === undefined ? current.name : input.name.trim(),
    description:
      input.description === undefined ? current.description : input.description.trim(),
    kind: input.kind ?? current.kind,
    enabled: input.enabled === undefined ? current.enabled : Boolean(input.enabled),
    trigger: input.trigger ?? current.trigger,
    conditions: input.conditions ?? current.conditions,
    actions: input.actions ?? current.actions,
    priority: input.priority === undefined ? current.priority : Number(input.priority),
    logging: input.logging === undefined ? current.logging : Boolean(input.logging),
    updatedAt: new Date().toISOString(),
  };

  workflows[index] = updated;
  await writeJsonArray("ged-workflows.json", workflows);
  return updated;
}

export async function deleteGedWorkflow(id: string) {
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  const next = workflows.filter((workflow) => workflow.id !== id);

  if (next.length === workflows.length) {
    return false;
  }

  await writeJsonArray("ged-workflows.json", next);
  return true;
}

export async function markGedWorkflowRun(id: string) {
  const workflows = await readJsonArray<GedWorkflow>("ged-workflows.json");
  const index = workflows.findIndex((workflow) => workflow.id === id);

  if (index === -1) {
    return null;
  }

  workflows[index] = {
    ...workflows[index],
    lastRunAt: new Date().toISOString(),
    runCount: workflows[index].runCount + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonArray("ged-workflows.json", workflows);
  await appendGedLog({
    level: "info",
    source: "Workflow",
    message: `Workflow testé : ${workflows[index].name}`,
  });
  return workflows[index];
}

export async function listGedLogs(limit = 250, filter?: { documentId?: number }) {
  const logs = await readJsonArray<GedLog>("ged-logs.json");
  const filtered =
    filter?.documentId !== undefined
      ? logs.filter((l) => l.documentId === filter.documentId)
      : logs;
  return filtered
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

export async function appendGedLog(input: GedLogInput) {
  const logs = await readJsonArray<GedLog>("ged-logs.json");
  const log: GedLog = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  logs.unshift(log);
  await writeJsonArray("ged-logs.json", logs.slice(0, MAX_LOGS));
  return log;
}
