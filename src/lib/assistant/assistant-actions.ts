import "server-only";

import {
  mutateList,
  readStore,
  writeStore,
  slugify,
  STORE,
  type EngineDocument,
  type EngineNamed,
  type EngineTag,
} from "@/lib/engine/stores";
import {
  listProjectFolders,
  createProject,
  resolveFolderPath,
  linkProjectDocuments,
} from "@/lib/projects/project-store";
import { createFinancialItem, updateFinancialItem } from "@/lib/budget/financial-item-store";
import { KIND_TO_DIRECTION, type FinancialKind } from "@/lib/budget/financial-item-types";
import { createReminder } from "@/lib/actions/reminder-store";
import { completeAction } from "@/lib/actions/action-store";
import { runDocumentAnalysis } from "@/lib/ai/run-document-analysis";
import { appendGedLog } from "@/lib/ged/ged-store";
import type { ExecuteResult, ProposedAction } from "./assistant-types";
import { getAssistantPermissions, isActionAllowed } from "./assistant-permissions";

/* ────────────────────────────────────────────────────────────────────────
   Exécuteurs d'actions confirmées. Réutilisent les stores Gedify existants.
   Chaque exécution est journalisée (ged-logs).
   ──────────────────────────────────────────────────────────────────────── */

const MAX_ANALYZE = 30;

export async function executeAction(action: ProposedAction, user: string | null): Promise<ExecuteResult> {
  const perms = getAssistantPermissions();
  if (!isActionAllowed(action.type, perms)) {
    return { ok: false, message: "Action non autorisée par les permissions de l'assistant.", affected: 0 };
  }

  try {
    const result = await dispatch(action);
    await appendGedLog({
      level: result.ok ? "success" : "warning",
      source: "GED",
      message: `Assistant IA : ${result.message}`,
      details: action.label,
      documentId: action.documentIds[0] ?? null,
      user: user ?? "assistant",
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await appendGedLog({
      level: "error",
      source: "GED",
      message: `Assistant IA — échec : ${action.label}`,
      details: message,
      documentId: action.documentIds[0] ?? null,
      user: user ?? "assistant",
    });
    return { ok: false, message: `Échec : ${message}`, affected: 0, error: message };
  }
}

async function dispatch(a: ProposedAction): Promise<ExecuteResult> {
  switch (a.type) {
    case "assign_folder": return assignFolder(a);
    case "add_tags": return addTags(a);
    case "remove_tags": return removeTags(a);
    case "set_type": return setType(a);
    case "analyze": return analyze(a);
    case "create_financial_item": return createFinance(a);
    case "validate_financial_item": return validateFinance(a);
    case "create_reminder": return makeReminder(a);
    case "complete_task": return completeTask(a);
    case "create_folder": return makeFolder(a);
    case "pipeline": return runPipelineProposed(a);
    case "apply_filter":
    case "draft_mail":
    case "navigate":
      // Actions côté client (filtre/navigation/compositeur mail) : pas d'exécution serveur.
      return { ok: false, message: "Action gérée côté client.", affected: 0 };
  }
}

/* ── Retraitement pipeline (OCR / IA / miniatures / index) ───────────────── */
async function runPipelineProposed(a: ProposedAction): Promise<ExecuteResult> {
  const { runPipelineAction, isPipelineAction } = await import("@/lib/jobs/pipeline-actions");
  const action = String(a.params.action ?? "").trim();
  if (!isPipelineAction(action)) {
    return { ok: false, message: `Action pipeline inconnue : ${action || "—"}.`, affected: 0 };
  }
  const result = await runPipelineAction(action);
  const n = result.queued ?? result.requeued ?? 0;
  return {
    ok: true,
    message:
      action === "retry-failed"
        ? `${n} job(s) relancé(s).`
        : `${n} document(s) mis en file de traitement (${action}).`,
    affected: n,
  };
}

/* ── Classement dans un dossier ──────────────────────────────────────────── */
async function assignFolder(a: ProposedAction): Promise<ExecuteResult> {
  const folderName = String(a.params.folderName ?? "").trim();
  if (!folderName || a.documentIds.length === 0) return { ok: false, message: "Dossier ou documents manquants.", affected: 0 };
  const folderId = await findOrCreateFolder(folderName);
  await linkProjectDocuments(folderId, a.documentIds);
  return { ok: true, message: `${a.documentIds.length} document(s) classé(s) dans « ${folderName} ».`, affected: a.documentIds.length };
}

async function findOrCreateFolder(nameOrPath: string): Promise<string> {
  const folders = await listProjectFolders();
  const segments = nameOrPath.split("/").map((s) => s.trim()).filter(Boolean);
  const leaf = segments[segments.length - 1] ?? nameOrPath;
  const existing = folders.find((f) => f.name.toLowerCase() === leaf.toLowerCase());
  if (existing) return existing.id;
  if (segments.length > 1) {
    const resolved = await resolveFolderPath(nameOrPath).catch(() => null);
    if (resolved) return resolved.id;
  }
  const created = await createProject({ name: leaf });
  return created.id;
}

/* ── Tags ────────────────────────────────────────────────────────────────── */
async function addTags(a: ProposedAction): Promise<ExecuteResult> {
  const names = (a.params.tags as string[] | undefined)?.filter(Boolean) ?? [];
  if (names.length === 0 || a.documentIds.length === 0) return { ok: false, message: "Tags ou documents manquants.", affected: 0 };
  const tagIds = await resolveTagIds(names);
  const set = new Set(a.documentIds);
  await mutateList<EngineDocument>(STORE.documents, (docs) =>
    docs.map((d) => (set.has(d.id) ? { ...d, tags: [...new Set([...d.tags, ...tagIds])] } : d)),
  );
  return { ok: true, message: `Tag(s) « ${names.join(", ")} » ajouté(s) à ${a.documentIds.length} document(s).`, affected: a.documentIds.length };
}

async function removeTags(a: ProposedAction): Promise<ExecuteResult> {
  const names = (a.params.tags as string[] | undefined)?.filter(Boolean) ?? [];
  const tags = await readStore<EngineTag[]>(STORE.tags, []);
  const ids = names.map((n) => tags.find((t) => t.name.toLowerCase() === n.toLowerCase())?.id).filter((x): x is number => x != null);
  const set = new Set(a.documentIds);
  await mutateList<EngineDocument>(STORE.documents, (docs) =>
    docs.map((d) => (set.has(d.id) ? { ...d, tags: d.tags.filter((t) => !ids.includes(t)) } : d)),
  );
  return { ok: true, message: `Tag(s) retiré(s) de ${a.documentIds.length} document(s).`, affected: a.documentIds.length };
}

async function resolveTagIds(names: string[]): Promise<number[]> {
  const tags = await readStore<EngineTag[]>(STORE.tags, []);
  const ids: number[] = [];
  let nextId = tags.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  let created = false;
  for (const name of names) {
    const existing = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const tag: EngineTag = {
      id: nextId++,
      name,
      slug: slugify(name),
      color: "#7C3AED",
      text_color: "#ffffff",
      match: "",
      matching_algorithm: 0,
      is_insensitive: true,
      is_inbox_tag: false,
      owner: null,
    };
    tags.push(tag);
    ids.push(tag.id);
    created = true;
  }
  if (created) await writeStore(STORE.tags, tags);
  return ids;
}

/* ── Type de document ────────────────────────────────────────────────────── */
async function setType(a: ProposedAction): Promise<ExecuteResult> {
  const typeName = String(a.params.type ?? "").trim();
  if (!typeName || a.documentIds.length === 0) return { ok: false, message: "Type ou documents manquants.", affected: 0 };
  const typeId = await resolveTypeId(typeName);
  const set = new Set(a.documentIds);
  await mutateList<EngineDocument>(STORE.documents, (docs) =>
    docs.map((d) => (set.has(d.id) ? { ...d, document_type: typeId } : d)),
  );
  return { ok: true, message: `Type « ${typeName} » appliqué à ${a.documentIds.length} document(s).`, affected: a.documentIds.length };
}

async function resolveTypeId(name: string): Promise<number> {
  const types = await readStore<EngineNamed[]>(STORE.document_types, []);
  const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const id = types.reduce((m, t) => Math.max(m, t.id), 0) + 1;
  const named: EngineNamed = {
    id,
    name,
    slug: slugify(name),
    match: "",
    matching_algorithm: 0,
    is_insensitive: true,
    owner: null,
  };
  types.push(named);
  await writeStore(STORE.document_types, types);
  return id;
}

/* ── Analyse IA ──────────────────────────────────────────────────────────── */
async function analyze(a: ProposedAction): Promise<ExecuteResult> {
  const ids = a.documentIds.slice(0, MAX_ANALYZE);
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const out = await runDocumentAnalysis(id, { force: true, autoApply: true, createFinancialItems: true });
      if (out.status === "error" || out.status === "no-ocr") failed += 1;
      else ok += 1;
    } catch {
      failed += 1;
    }
  }
  const truncated = a.documentIds.length > MAX_ANALYZE ? ` (limité à ${MAX_ANALYZE})` : "";
  return {
    ok: ok > 0,
    message: `Analyse IA : ${ok}/${ids.length} document(s) analysé(s)${failed ? `, ${failed} échec(s)` : ""}${truncated}.`,
    affected: ok,
  };
}

/* ── Finances ────────────────────────────────────────────────────────────── */
async function createFinance(a: ProposedAction): Promise<ExecuteResult> {
  const kind = (String(a.params.kind ?? "expense") as FinancialKind);
  const amount = Number(a.params.amount ?? 0);
  const label = String(a.params.label ?? "Ligne budget");
  const dueDate = a.params.dueDate ? String(a.params.dueDate) : null;
  const docId = a.documentIds[0] ?? null;
  const direction = KIND_TO_DIRECTION[kind] ?? "outgoing";
  await createFinancialItem({
    kind,
    direction,
    label,
    amount,
    dueDate,
    sourceDocumentId: docId,
    status: "to_review",
  });
  return { ok: true, message: `Ligne budget « ${label} » (${amount} €) créée.`, affected: 1 };
}

async function validateFinance(a: ProposedAction): Promise<ExecuteResult> {
  const id = String(a.params.entryId ?? "");
  if (!id) return { ok: false, message: "Ligne budget manquante.", affected: 0 };
  const updated = await updateFinancialItem(id, { status: "validated", validationStatus: "validated" });
  return updated
    ? { ok: true, message: "Ligne budget validée.", affected: 1 }
    : { ok: false, message: "Ligne budget introuvable.", affected: 0 };
}

/* ── Rappels ─────────────────────────────────────────────────────────────── */
async function makeReminder(a: ProposedAction): Promise<ExecuteResult> {
  const title = String(a.params.title ?? "Rappel");
  const remindAt = resolveRemindAt(a.params);
  const documentId = a.documentIds[0] ?? null;
  await createReminder({ title, remindAt, documentId });
  return { ok: true, message: `Rappel « ${title} » créé pour le ${remindAt.slice(0, 10)}.`, affected: 1 };
}

/* ── Dossiers ────────────────────────────────────────────────────────────── */
async function makeFolder(a: ProposedAction): Promise<ExecuteResult> {
  const name = String(a.params.name ?? "").trim();
  if (!name) return { ok: false, message: "Nom de dossier manquant.", affected: 0 };
  const parentName = a.params.parentName ? String(a.params.parentName) : null;
  let parentId: string | null = null;
  if (parentName) {
    const folders = await listProjectFolders();
    parentId = folders.find((f) => f.name.toLowerCase() === parentName.toLowerCase())?.id ?? null;
  }
  await createProject({ name, parentId });
  return { ok: true, message: `Dossier « ${name} » créé${parentName ? ` dans « ${parentName} »` : ""}.`, affected: 1 };
}

/* ── Tâches ──────────────────────────────────────────────────────────────── */
async function completeTask(a: ProposedAction): Promise<ExecuteResult> {
  const id = String(a.params.taskId ?? "");
  if (!id) return { ok: false, message: "Tâche manquante.", affected: 0 };
  const done = await completeAction(id);
  return done
    ? { ok: true, message: `Tâche « ${done.title} » marquée terminée.`, affected: 1 }
    : { ok: false, message: "Tâche introuvable.", affected: 0 };
}

function resolveRemindAt(params: Record<string, unknown>): string {
  if (params.dueDate) {
    const d = new Date(String(params.dueDate));
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const days = Number(params.dueInDays);
  const offset = Number.isFinite(days) && days > 0 ? days : 1;
  return new Date(Date.now() + offset * 86400_000).toISOString();
}
