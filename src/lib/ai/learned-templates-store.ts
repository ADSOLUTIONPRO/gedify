import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getAiDataDir } from "@/lib/budget/storage";
import { scoreSimilarity, type DocumentFingerprint } from "./document-fingerprint";
import type { LearnedTemplate, TemplateBudgetMapping } from "./learned-templates-types";

const FILE = "learned-templates.json";

function filePath() {
  return path.join(getAiDataDir(), FILE);
}
async function ensureDir() {
  await mkdir(getAiDataDir(), { recursive: true });
}
async function readAllJson(): Promise<LearnedTemplate[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as LearnedTemplate[]) : [];
  } catch {
    return [];
  }
}
async function readAll(): Promise<LearnedTemplate[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<LearnedTemplate>("learned_templates");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}
async function writeAll(items: LearnedTemplate[]) {
  if (pgStorageActive()) {
    await pgWriteAll<LearnedTemplate>("learned_templates", "id", (t) => t.id, items);
    return;
  }
  await ensureDir();
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export async function listLearnedTemplates(): Promise<LearnedTemplate[]> {
  return (await readAll()).sort((a, b) => (b.lastValidatedAt > a.lastValidatedAt ? 1 : -1));
}
export async function listActiveLearnedTemplates(): Promise<LearnedTemplate[]> {
  return (await readAll()).filter((t) => t.active);
}
export async function getLearnedTemplate(id: string): Promise<LearnedTemplate | null> {
  return (await readAll()).find((t) => t.id === id) ?? null;
}
export async function removeLearnedTemplate(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
export type LearnedTemplatePatch = Partial<
  Pick<LearnedTemplate, "active" | "label" | "description" | "promptSystem" | "promptInstructions">
> & {
  /** Restaure le prompt précédent (annule la dernière modification de prompt). */
  restorePrompt?: boolean;
  /** Auteur de la modification (username), pour l'historique. */
  updatedBy?: string | null;
};

export async function updateLearnedTemplate(
  id: string,
  patch: LearnedTemplatePatch,
): Promise<LearnedTemplate | null> {
  const all = await readAll();
  const idx = all.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const cur = all[idx];
  const now = new Date().toISOString();

  // Restauration du prompt précédent (1 niveau).
  if (patch.restorePrompt && cur.previousPrompt) {
    all[idx] = {
      ...cur,
      promptSystem: cur.previousPrompt.promptSystem,
      promptInstructions: cur.previousPrompt.promptInstructions,
      previousPrompt: null,
      version: (cur.version ?? 1) + 1,
      updatedAt: now,
      updatedBy: patch.updatedBy ?? cur.updatedBy ?? null,
    };
    await writeAll(all);
    return all[idx];
  }

  const promptChanged =
    (typeof patch.promptSystem === "string" && patch.promptSystem !== (cur.promptSystem ?? "")) ||
    (typeof patch.promptInstructions === "string" && patch.promptInstructions !== (cur.promptInstructions ?? ""));

  const next: LearnedTemplate = { ...cur, updatedAt: now };
  if (typeof patch.active === "boolean") next.active = patch.active;
  if (typeof patch.label === "string" && patch.label.trim()) next.label = patch.label.trim();
  if (typeof patch.description === "string") next.description = patch.description;
  if (promptChanged) {
    // Snapshot du prompt courant AVANT écrasement (restauration possible).
    next.previousPrompt = {
      promptSystem: cur.promptSystem ?? null,
      promptInstructions: cur.promptInstructions ?? null,
      at: now,
    };
    if (typeof patch.promptSystem === "string") next.promptSystem = patch.promptSystem;
    if (typeof patch.promptInstructions === "string") next.promptInstructions = patch.promptInstructions;
    next.version = (cur.version ?? 1) + 1;
  }
  if (patch.updatedBy !== undefined) next.updatedBy = patch.updatedBy;
  all[idx] = next;
  await writeAll(all);
  return next;
}

/** Duplique un modèle (copie désactivée, sans compteur ni exemples). */
export async function duplicateLearnedTemplate(id: string): Promise<LearnedTemplate | null> {
  const all = await readAll();
  const src = all.find((t) => t.id === id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: LearnedTemplate = {
    ...src,
    id: randomUUID(),
    label: `${src.label} (copie)`,
    validatedCount: 0,
    exampleDocumentIds: [],
    active: false, // copie désactivée → l'utilisateur la révise puis l'active
    previousPrompt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastValidatedAt: now,
  };
  all.push(copy);
  await writeAll(all);
  return copy;
}

export type LearnInput = {
  documentId: number | null;
  documentType: string | null;
  primaryCorrespondent: string | null;
  secondaryCorrespondents?: string[];
  tags?: string[];
  folder?: string | null;
  budgetMapping?: TemplateBudgetMapping | null;
  fingerprint: DocumentFingerprint;
  /** Motif de titre appris depuis le titre validé (ex. « Arrêt maladie {{date}} »). */
  titlePattern?: string | null;
};

/** Cherche un modèle existant à renforcer (même type/correspondant + texte proche). */
function findReinforcable(all: LearnedTemplate[], input: LearnInput): LearnedTemplate | null {
  const candidates = all.filter((t) => {
    const sameType = input.documentType ? norm(t.documentType) === norm(input.documentType) : true;
    const sameCorr = input.primaryCorrespondent && t.primaryCorrespondent
      ? norm(t.primaryCorrespondent) === norm(input.primaryCorrespondent)
      : false;
    return sameType || sameCorr;
  });
  let best: { t: LearnedTemplate; s: number } | null = null;
  for (const t of candidates) {
    const s = scoreSimilarity(t, input.fingerprint).global;
    const corrBonus = input.primaryCorrespondent && t.primaryCorrespondent && norm(t.primaryCorrespondent) === norm(input.primaryCorrespondent) ? 0.25 : 0;
    const total = s + corrBonus;
    if (!best || total > best.s) best = { t, s: total };
  }
  return best && best.s >= 0.55 ? best.t : null;
}

/**
 * Apprend (ou renforce) un modèle de classement à partir d'une validation
 * utilisateur. §6 : valide sans modif → renforce ; corrige → met à jour.
 */
export async function learnFromValidation(input: LearnInput): Promise<LearnedTemplate> {
  const all = await readAll();
  const now = new Date().toISOString();
  const existing = findReinforcable(all, input);

  if (existing) {
    existing.documentType = input.documentType ?? existing.documentType;
    if (input.primaryCorrespondent) existing.primaryCorrespondent = input.primaryCorrespondent;
    existing.secondaryCorrespondents = [...new Set([...(existing.secondaryCorrespondents ?? []), ...(input.secondaryCorrespondents ?? [])])];
    existing.tags = [...new Set([...(existing.tags ?? []), ...(input.tags ?? [])])].slice(0, 12);
    if (input.folder) existing.folder = input.folder;
    if (input.budgetMapping) existing.budgetMapping = input.budgetMapping;
    // Fusionne les mots-clés (union, plafonné) pour stabiliser l'empreinte.
    existing.textFingerprint = {
      keywords: [...new Set([...existing.textFingerprint.keywords, ...input.fingerprint.text.keywords])].slice(0, 60),
      issuer: input.fingerprint.text.issuer ?? existing.textFingerprint.issuer,
    };
    existing.metadataFingerprint = input.fingerprint.metadata;
    if (input.titlePattern) existing.titlePattern = input.titlePattern; // dernière structure validée
    existing.validatedCount += 1;
    existing.lastValidatedAt = now;
    existing.updatedAt = now;
    if (input.documentId != null) existing.exampleDocumentIds = [...new Set([...existing.exampleDocumentIds, input.documentId])].slice(-20);
    await writeAll(all);
    return existing;
  }

  const label = `${input.documentType ?? "Document"}${input.primaryCorrespondent ? ` ${input.primaryCorrespondent}` : ""}`.trim();
  const created: LearnedTemplate = {
    id: randomUUID(),
    label,
    documentType: input.documentType,
    primaryCorrespondent: input.primaryCorrespondent,
    secondaryCorrespondents: input.secondaryCorrespondents ?? [],
    tags: (input.tags ?? []).slice(0, 12),
    folder: input.folder ?? null,
    budgetMapping: input.budgetMapping ?? null,
    textFingerprint: input.fingerprint.text,
    metadataFingerprint: input.fingerprint.metadata,
    visualFingerprint: {},
    exampleDocumentIds: input.documentId != null ? [input.documentId] : [],
    validatedCount: 1,
    lastValidatedAt: now,
    confidenceThreshold: 0.85,
    active: true,
    titlePattern: input.titlePattern ?? null,
    createdAt: now,
    updatedAt: now,
  };
  all.push(created);
  await writeAll(all);
  return created;
}
