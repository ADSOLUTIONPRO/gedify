import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getAiDataDir } from "@/lib/budget/storage";
import type { AIAnalysis, AIAnalysisInput, AIAnalysisStatus } from "./types";

const INDEX_FILE = "analyses.json";

async function ensureDir() {
  await mkdir(getAiDataDir(), { recursive: true });
}

function indexPath() {
  return path.join(getAiDataDir(), INDEX_FILE);
}

async function readAll(): Promise<AIAnalysis[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AIAnalysis[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: AIAnalysis[]) {
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(items, null, 2), "utf8");
}

export type ListOptions = {
  status?: AIAnalysisStatus;
  documentId?: number;
};

export async function listAnalyses(options: ListOptions = {}): Promise<AIAnalysis[]> {
  const all = await readAll();
  return all
    .filter((entry) => (options.status ? entry.status === options.status : true))
    .filter((entry) => (options.documentId ? entry.documentId === options.documentId : true))
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export async function getAnalysis(id: string): Promise<AIAnalysis | null> {
  const all = await readAll();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function getLatestAnalysisForDocument(documentId: number): Promise<AIAnalysis | null> {
  const all = await readAll();
  const candidates = all
    .filter((entry) => entry.documentId === documentId)
    .sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
  return candidates[0] ?? null;
}

export async function upsertAnalysis(input: AIAnalysisInput): Promise<AIAnalysis> {
  const all = await readAll();
  const now = new Date().toISOString();
  const existing = input.id
    ? all.findIndex((entry) => entry.id === input.id)
    : -1;
  if (existing >= 0) {
    const merged: AIAnalysis = {
      ...all[existing],
      ...input,
      id: all[existing].id,
      documentId: all[existing].documentId,
      createdAt: all[existing].createdAt,
      updatedAt: now,
    };
    all[existing] = merged;
    await writeAll(all);
    return merged;
  }
  const created: AIAnalysis = {
    // `...input` d'abord : conserve TOUS les champs optionnels fournis
    // (suggestedTitle, globalConfidenceScore, suggestedFolderName, appliedFields,
    //  secondaryCorrespondentNames, warnings, autoApplyEligible, ruleMatches…).
    // Les champs requis ci-dessous garantissent ensuite des valeurs par défaut.
    ...input,
    id: randomUUID(),
    documentId: input.documentId ?? 0,
    summary: input.summary ?? "",
    plainLanguageExplanation: input.plainLanguageExplanation ?? "",
    detectedDocumentKind: input.detectedDocumentKind ?? "Document",
    suggestedCorrespondentId: input.suggestedCorrespondentId ?? null,
    suggestedCorrespondentName: input.suggestedCorrespondentName ?? null,
    suggestedDocumentTypeId: input.suggestedDocumentTypeId ?? null,
    suggestedDocumentTypeName: input.suggestedDocumentTypeName ?? null,
    suggestedTagIds: input.suggestedTagIds ?? [],
    suggestedTagNames: input.suggestedTagNames ?? [],
    suggestedProjectIds: input.suggestedProjectIds ?? [],
    detectedDates: input.detectedDates ?? [],
    detectedAmounts: input.detectedAmounts ?? [],
    detectedReferences: input.detectedReferences ?? [],
    detectedPeople: input.detectedPeople ?? [],
    detectedOrganizations: input.detectedOrganizations ?? [],
    urgency: input.urgency ?? "normal",
    recommendedActions: input.recommendedActions ?? [],
    financialImpact: input.financialImpact ?? [],
    confidence: input.confidence ?? "medium",
    status: input.status ?? "ready-to-validate",
    provider: input.provider ?? (process.env.AI_PROVIDER ?? "mock"),
    richData: input.richData ?? null,
    enrichmentStatus: input.enrichmentStatus ?? null,
    enrichmentMessage: input.enrichmentMessage ?? null,
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  return created;
}

/**
 * Upsert anti-doublon : si une analyse non-finale (draft/ready-to-validate) existe
 * déjà pour ce documentId, elle est remplacée. Les analyses validées/appliquées
 * ne sont pas écrasées — elles restent et une nouvelle est créée.
 *
 * À utiliser à la place de `upsertAnalysis` lors d'une réanalyse automatique.
 */
export async function upsertAnalysisForDocument(input: AIAnalysisInput): Promise<AIAnalysis> {
  const all = await readAll();
  const now = new Date().toISOString();
  const docId = input.documentId ?? 0;

  // Chercher une analyse existante non finalisée pour ce document
  const existingIndex = all.findIndex(
    (entry) =>
      entry.documentId === docId &&
      (entry.status === "draft" || entry.status === "ready-to-validate"),
  );

  if (existingIndex >= 0) {
    const existing = all[existingIndex];
    const merged: AIAnalysis = {
      ...existing,
      ...input,
      id: existing.id,
      documentId: existing.documentId,
      createdAt: existing.createdAt,
      updatedAt: now,
    };
    all[existingIndex] = merged;
    await writeAll(all);
    return merged;
  }

  // Aucune analyse remplaçable — créer normalement
  return upsertAnalysis(input);
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
