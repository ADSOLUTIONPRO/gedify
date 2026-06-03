import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getMailConnectorDataDir, LOGS_FILE } from "./storage-paths";
import type { MailSyncLog, MailSyncLogInput } from "./types";

const MAX_LOGS = 1000;

async function ensureDir() {
  await mkdir(getMailConnectorDataDir(), { recursive: true });
}

function getFilePath() {
  return path.join(getMailConnectorDataDir(), LOGS_FILE);
}

async function readAll(): Promise<MailSyncLog[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MailSyncLog[];
  } catch {
    return [];
  }
}

async function writeAll(logs: MailSyncLog[]) {
  await ensureDir();
  await writeFile(getFilePath(), JSON.stringify(logs.slice(0, MAX_LOGS), null, 2), "utf8");
}

export type ListLogsOptions = {
  accountId?: string;
  limit?: number;
  status?: MailSyncLog["status"];
};

export async function listLogs(options: ListLogsOptions = {}): Promise<MailSyncLog[]> {
  const all = await readAll();
  let filtered = all;
  if (options.accountId) {
    filtered = filtered.filter((log) => log.accountId === options.accountId);
  }
  if (options.status) {
    filtered = filtered.filter((log) => log.status === options.status);
  }
  if (options.limit) {
    filtered = filtered.slice(0, options.limit);
  }
  return filtered;
}

export async function appendLog(input: MailSyncLogInput): Promise<MailSyncLog> {
  const log: MailSyncLog = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const all = await readAll();
  all.unshift(log);
  await writeAll(all);
  return log;
}

export async function countRecentErrors(sinceMinutes: number = 60): Promise<number> {
  const all = await readAll();
  const cutoff = Date.now() - sinceMinutes * 60_000;
  return all.filter(
    (log) => log.status === "error" && new Date(log.createdAt).getTime() >= cutoff,
  ).length;
}
