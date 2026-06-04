import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import type {
  DocumentTitleOverride,
  DocumentTitleSource,
} from "@/lib/documents/document-title-types";

const STORE_FILE = "document-title-overrides.json";

let memoryOverrides: DocumentTitleOverride[] = [];

function isMemoryStoreEnabled() {
  return process.env.DOCUMENT_TITLE_STORE_TYPE === "memory";
}

function getStorePath() {
  return path.join(getDataDir(), STORE_FILE);
}

async function readOverridesJson(): Promise<DocumentTitleOverride[]> {
  if (isMemoryStoreEnabled()) {
    return memoryOverrides;
  }

  try {
    const contents = await readFile(getStorePath(), "utf8");
    const parsed = JSON.parse(contents) as unknown;
    return Array.isArray(parsed) ? (parsed as DocumentTitleOverride[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function readOverrides(): Promise<DocumentTitleOverride[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<DocumentTitleOverride>("document_title_overrides", "document_id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readOverridesJson();
      throw e;
    }
  }
  return readOverridesJson();
}

async function writeOverrides(overrides: DocumentTitleOverride[]): Promise<void> {
  if (pgStorageActive()) {
    await pgWriteAll<DocumentTitleOverride>(
      "document_title_overrides",
      "document_id",
      (o) => o.documentId,
      overrides,
      "metadata",
    );
    return;
  }
  if (isMemoryStoreEnabled()) {
    memoryOverrides = overrides;
    return;
  }

  const filePath = getStorePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(overrides, null, 2), "utf8");
}

export async function getTitleOverride(
  documentId: number
): Promise<DocumentTitleOverride | null> {
  const overrides = await readOverrides();
  return overrides.find((o) => o.documentId === documentId) ?? null;
}

export async function getTitleOverridesMap(
  documentIds: number[]
): Promise<Map<number, DocumentTitleOverride>> {
  const overrides = await readOverrides();
  const ids = new Set(documentIds);
  const map = new Map<number, DocumentTitleOverride>();
  for (const o of overrides) {
    if (ids.has(o.documentId)) map.set(o.documentId, o);
  }
  return map;
}

export async function setTitleOverride(
  documentId: number,
  displayTitle: string,
  source: DocumentTitleSource,
  confidence: number | null,
  editedByUser: boolean
): Promise<DocumentTitleOverride> {
  const overrides = await readOverrides();
  const idx = overrides.findIndex((o) => o.documentId === documentId);
  const now = new Date().toISOString();

  const next: DocumentTitleOverride = {
    documentId,
    displayTitle: displayTitle.trim(),
    source,
    confidence,
    editedByUser,
    editedAt: now,
  };

  if (idx >= 0) {
    overrides[idx] = next;
  } else {
    overrides.push(next);
  }
  await writeOverrides(overrides);
  return next;
}

export async function deleteTitleOverride(documentId: number): Promise<void> {
  const overrides = await readOverrides();
  const next = overrides.filter((o) => o.documentId !== documentId);
  await writeOverrides(next);
}
