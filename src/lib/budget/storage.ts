import "server-only";

import { getDataSubdir } from "@/lib/storage/data-dir";

export function getBudgetDataDir(): string {
  return process.env.BUDGET_STORAGE_PATH ?? getDataSubdir("budget");
}

export function getActionsDataDir(): string {
  return process.env.ACTIONS_STORAGE_PATH ?? getDataSubdir("actions");
}

export function getAiDataDir(): string {
  return process.env.AI_STORAGE_PATH ?? getDataSubdir("ai");
}

export type StoreType = "memory" | "json" | "sqlite" | "postgres" | "supabase";

export function getStoreType(envVar: string): StoreType {
  const value = process.env[envVar];
  if (
    value === "memory" ||
    value === "json" ||
    value === "sqlite" ||
    value === "postgres" ||
    value === "supabase"
  ) {
    return value;
  }
  return "json";
}
