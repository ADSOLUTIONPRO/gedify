import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadScoped, pgWriteScoped } from "@/lib/db/pg-store";
import {
  getSignatureDataDir,
  SIGNATURE_INDEX_FILE,
} from "./storage-paths";
import type { WriterSignature, WriterSignatureInput } from "./types";

async function ensureDir() {
  await mkdir(getSignatureDataDir(), { recursive: true });
}

function indexPath() {
  return path.join(getSignatureDataDir(), SIGNATURE_INDEX_FILE);
}

function signatureFilePath(signature: Pick<WriterSignature, "id" | "fileName">) {
  return path.join(getSignatureDataDir(), `${signature.id}__${signature.fileName}`);
}

async function readIndexJson(): Promise<WriterSignature[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WriterSignature[];
  } catch {
    return [];
  }
}

async function readIndex(): Promise<WriterSignature[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadScoped<WriterSignature>("signatures", "scope", "writer");
    } catch (e) {
      if (jsonFallback()) return readIndexJson();
      throw e;
    }
  }
  return readIndexJson();
}

async function writeIndex(items: WriterSignature[]) {
  if (pgStorageActive()) {
    await pgWriteScoped<WriterSignature>("signatures", "id", (s) => s.id, items, {
      scopeCol: "scope",
      scopeVal: "writer",
    });
    return;
  }
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(items, null, 2), "utf8");
}

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Format dataUrl invalide (attendu data:image/...;base64,...).");
  const contentType = match[1].toLowerCase();
  if (!/^image\/(png|jpe?g|webp)$/.test(contentType)) {
    throw new Error(`Type ${contentType} non supporté pour une signature.`);
  }
  const ext =
    contentType === "image/jpeg" || contentType === "image/jpg" ? "jpg" :
    contentType === "image/webp" ? "webp" : "png";
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType, ext };
}

export async function listSignatures(): Promise<WriterSignature[]> {
  return readIndex();
}

export async function getSignature(id: string): Promise<WriterSignature | null> {
  const all = await readIndex();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function readSignatureFile(id: string): Promise<Buffer | null> {
  const signature = await getSignature(id);
  if (!signature) return null;
  try {
    return await readFile(signatureFilePath(signature));
  } catch {
    return null;
  }
}

export async function createSignature(input: WriterSignatureInput): Promise<WriterSignature> {
  if (!input.dataUrl) throw new Error("dataUrl manquant.");
  await ensureDir();
  const id = randomUUID();
  const { buffer, contentType, ext } = decodeDataUrl(input.dataUrl);
  const fileName = `signature.${ext}`;
  await writeFile(signatureFilePath({ id, fileName }), buffer);

  const all = await readIndex();
  const isDefault = input.isDefault ?? all.length === 0;
  if (isDefault) {
    for (const entry of all) entry.isDefault = false;
  }
  const signature: WriterSignature = {
    id,
    name: input.name?.trim() || "Signature",
    isDefault,
    fileName,
    contentType,
    width: input.width ?? 400,
    height: input.height ?? 150,
    createdAt: new Date().toISOString(),
  };
  all.push(signature);
  await writeIndex(all);
  return signature;
}

export async function deleteSignature(id: string): Promise<boolean> {
  const all = await readIndex();
  const target = all.find((entry) => entry.id === id);
  if (!target) return false;
  const next = all.filter((entry) => entry.id !== id);
  if (target.isDefault && next.length > 0) {
    next[0].isDefault = true;
  }
  await writeIndex(next);
  try {
    await unlink(signatureFilePath(target));
  } catch {
    // ignore
  }
  return true;
}

export async function setDefaultSignature(id: string): Promise<WriterSignature | null> {
  const all = await readIndex();
  let updated: WriterSignature | null = null;
  for (const entry of all) {
    if (entry.id === id) {
      entry.isDefault = true;
      updated = entry;
    } else {
      entry.isDefault = false;
    }
  }
  if (!updated) return null;
  await writeIndex(all);
  return updated;
}
