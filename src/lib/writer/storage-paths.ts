import "server-only";

import { getDataSubdir } from "@/lib/storage/data-dir";

export function getWriterDataDir(): string {
  const fromEnv = process.env.WRITER_STORAGE_PATH;
  if (fromEnv) return fromEnv;
  return getDataSubdir("writer");
}

export function getSignatureDataDir(): string {
  const fromEnv = process.env.SIGNATURE_STORAGE_PATH;
  if (fromEnv) return fromEnv;
  return getDataSubdir("signatures");
}

export function getWriterStoreType(): "json" | "filesystem" | "postgres" | "supabase" | "s3" {
  const value = process.env.WRITER_STORE_TYPE;
  if (
    value === "filesystem" ||
    value === "postgres" ||
    value === "supabase" ||
    value === "s3"
  ) {
    return value;
  }
  return "json";
}

export const WRITER_INDEX_FILE = "documents.json";
export const SIGNATURE_INDEX_FILE = "signatures.json";
