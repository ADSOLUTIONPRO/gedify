import "server-only";

import { getDataSubdir } from "@/lib/storage/data-dir";

export function getMailConnectorDataDir(): string {
  const fromEnv = process.env.MAIL_CONNECTOR_DATA_DIR;
  if (fromEnv) return fromEnv;
  return getDataSubdir("mail-connector");
}

export const ACCOUNTS_FILE = "accounts.json";
export const RULES_FILE = "rules.json";
export const LOGS_FILE = "logs.json";

export function getStorageDriver(): "json-file" | "postgres" | "supabase" | "unknown" {
  const driver = process.env.MAIL_CONNECTOR_STORAGE;
  if (driver === "postgres" || driver === "supabase") return driver;
  return "json-file";
}
