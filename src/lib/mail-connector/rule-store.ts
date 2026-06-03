import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getMailConnectorDataDir, RULES_FILE } from "./storage-paths";
import type { MailRule, MailRuleInput } from "./types";

async function ensureDir() {
  await mkdir(getMailConnectorDataDir(), { recursive: true });
}

function getFilePath() {
  return path.join(getMailConnectorDataDir(), RULES_FILE);
}

async function readAll(): Promise<MailRule[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MailRule[];
  } catch {
    return [];
  }
}

async function writeAll(rules: MailRule[]) {
  await ensureDir();
  await writeFile(getFilePath(), JSON.stringify(rules, null, 2), "utf8");
}

export async function listRules(): Promise<MailRule[]> {
  const all = await readAll();
  return [...all].sort((a, b) => a.priority - b.priority);
}

export async function getRule(id: string): Promise<MailRule | null> {
  const all = await readAll();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function createRule(input: MailRuleInput): Promise<MailRule> {
  const now = new Date().toISOString();
  const rule: MailRule = {
    id: randomUUID(),
    name: input.name ?? "Nouvelle règle",
    description: input.description ?? "",
    isActive: input.isActive ?? true,
    priority: input.priority ?? 100,
    accountIds: input.accountIds ?? [],
    conditions: input.conditions ?? [],
    actions: input.actions ?? [],
    createdAt: now,
    updatedAt: now,
  };
  const all = await readAll();
  all.push(rule);
  await writeAll(all);
  return rule;
}

export async function updateRule(
  id: string,
  input: MailRuleInput,
): Promise<MailRule | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const updated: MailRule = {
    ...all[index],
    ...input,
    id: all[index].id,
    updatedAt: new Date().toISOString(),
    createdAt: all[index].createdAt,
  };
  all[index] = updated;
  await writeAll(all);
  return updated;
}

export async function deleteRule(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
