import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  getWriterDataDir,
  WRITER_INDEX_FILE,
} from "./storage-paths";
import type { WriterDocument, WriterDocumentInput } from "./types";

async function ensureDir() {
  await mkdir(getWriterDataDir(), { recursive: true });
}

function indexPath() {
  return path.join(getWriterDataDir(), WRITER_INDEX_FILE);
}

function docFilePath(id: string, fileName: string) {
  return path.join(getWriterDataDir(), `${id}__${fileName}`);
}

async function readIndex(): Promise<WriterDocument[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as WriterDocument[];
  } catch {
    return [];
  }
}

async function writeIndex(documents: WriterDocument[]) {
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(documents, null, 2), "utf8");
}

export async function listWriterDocuments(): Promise<WriterDocument[]> {
  const docs = await readIndex();
  return docs.sort((a, b) => (b.updatedAt > a.updatedAt ? 1 : -1));
}

export async function getWriterDocument(id: string): Promise<WriterDocument | null> {
  const docs = await readIndex();
  return docs.find((doc) => doc.id === id) ?? null;
}

export async function readWriterDocumentFile(id: string): Promise<Buffer | null> {
  const doc = await getWriterDocument(id);
  if (!doc) return null;
  try {
    return await readFile(docFilePath(id, doc.fileName));
  } catch {
    return null;
  }
}

export type CreateWriterDocumentArgs = WriterDocumentInput & {
  initialDocx: Buffer;
};

export async function createWriterDocument(args: CreateWriterDocumentArgs): Promise<WriterDocument> {
  await ensureDir();
  const id = randomUUID();
  const now = new Date().toISOString();
  const fileName = "document.docx";
  const fileFullPath = docFilePath(id, fileName);
  await writeFile(fileFullPath, args.initialDocx);

  const document: WriterDocument = {
    id,
    title: args.title ?? "Nouveau courrier",
    letterType: args.letterType ?? "libre",
    templateId: args.templateId ?? null,
    recipient: args.recipient ?? "",
    recipientAddress: args.recipientAddress ?? "",
    subject: args.subject ?? "",
    reference: args.reference ?? "",
    projectId: args.projectId ?? null,
    paperlessCorrespondent: args.paperlessCorrespondent ?? null,
    paperlessDocumentType: args.paperlessDocumentType ?? null,
    paperlessTags: args.paperlessTags ?? [],
    fileName,
    fileSize: args.initialDocx.byteLength,
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: 1,
    paperlessTaskId: null,
    paperlessDocumentId: null,
    status: args.status ?? "draft",
    createdAt: now,
    updatedAt: now,
  };

  const docs = await readIndex();
  docs.push(document);
  await writeIndex(docs);
  return document;
}

export async function updateWriterDocument(
  id: string,
  patch: WriterDocumentInput,
): Promise<WriterDocument | null> {
  const docs = await readIndex();
  const index = docs.findIndex((doc) => doc.id === id);
  if (index < 0) return null;
  const updated: WriterDocument = {
    ...docs[index],
    ...patch,
    id: docs[index].id,
    fileName: docs[index].fileName,
    fileSize: docs[index].fileSize,
    contentType: docs[index].contentType,
    version: docs[index].version,
    createdAt: docs[index].createdAt,
    updatedAt: new Date().toISOString(),
  };
  docs[index] = updated;
  await writeIndex(docs);
  return updated;
}

export async function replaceWriterDocumentContent(
  id: string,
  content: Buffer,
): Promise<WriterDocument | null> {
  const docs = await readIndex();
  const index = docs.findIndex((doc) => doc.id === id);
  if (index < 0) return null;
  const doc = docs[index];
  await writeFile(docFilePath(id, doc.fileName), content);
  const updated: WriterDocument = {
    ...doc,
    fileSize: content.byteLength,
    version: doc.version + 1,
    updatedAt: new Date().toISOString(),
  };
  docs[index] = updated;
  await writeIndex(docs);
  return updated;
}

export async function recordPaperlessSend(
  id: string,
  paperlessTaskId: string | null,
): Promise<WriterDocument | null> {
  const docs = await readIndex();
  const index = docs.findIndex((doc) => doc.id === id);
  if (index < 0) return null;
  const updated: WriterDocument = {
    ...docs[index],
    paperlessTaskId,
    status: "sent-to-paperless",
    updatedAt: new Date().toISOString(),
  };
  docs[index] = updated;
  await writeIndex(docs);
  return updated;
}

export async function deleteWriterDocument(id: string): Promise<boolean> {
  const docs = await readIndex();
  const target = docs.find((doc) => doc.id === id);
  if (!target) return false;
  const next = docs.filter((doc) => doc.id !== id);
  await writeIndex(next);
  try {
    await unlink(docFilePath(id, target.fileName));
  } catch {
    // ignore
  }
  return true;
}
