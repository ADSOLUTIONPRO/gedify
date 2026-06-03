import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getActionsDataDir } from "@/lib/budget/storage";

/**
 * Modèle de rappel propre à GED AzServer (store JSON local, comme les actions).
 * Volontairement riche pour couvrir les liaisons GED (action, document, email,
 * finance, calendrier, dossier, correspondant). Les canaux externes (email,
 * calendrier) sont des stubs « à connecter » — aucun envoi n'est effectué.
 */

export type ReminderRecurrence = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type ReminderChannel = "in_app" | "email" | "calendar";
export type ReminderStatus = "scheduled" | "done" | "cancelled";
export type ReminderPriority = "low" | "normal" | "high" | "urgent";

export type ReminderRecord = {
  id: string;
  title: string;
  description: string;
  remindAt: string; // ISO
  status: ReminderStatus;
  recurrence: ReminderRecurrence;
  channel: ReminderChannel;
  priority: ReminderPriority;
  actionId: string | null;
  documentId: number | null;
  emailThreadId: string | null;
  financialItemId: string | null;
  calendarEventId: string | null;
  projectId: string | null;
  correspondentId: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ReminderInput = Partial<Omit<ReminderRecord, "id" | "createdAt" | "updatedAt" | "completedAt">>;

export type ReminderBucket = "overdue" | "today" | "upcoming" | "done";

const INDEX_FILE = "reminders.json";

async function ensureDir() {
  await mkdir(getActionsDataDir(), { recursive: true });
}
function indexPath() {
  return path.join(getActionsDataDir(), INDEX_FILE);
}
async function readAll(): Promise<ReminderRecord[]> {
  try {
    const raw = await readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ReminderRecord[]) : [];
  } catch {
    return [];
  }
}
async function writeAll(items: ReminderRecord[]) {
  await ensureDir();
  await writeFile(indexPath(), JSON.stringify(items, null, 2), "utf8");
}

function normalize(input: ReminderInput, base?: ReminderRecord): ReminderRecord {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? randomUUID(),
    title: input.title ?? base?.title ?? "Rappel",
    description: input.description ?? base?.description ?? "",
    remindAt: input.remindAt ?? base?.remindAt ?? now,
    status: input.status ?? base?.status ?? "scheduled",
    recurrence: input.recurrence ?? base?.recurrence ?? "none",
    channel: input.channel ?? base?.channel ?? "in_app",
    priority: input.priority ?? base?.priority ?? "normal",
    actionId: input.actionId ?? base?.actionId ?? null,
    documentId: input.documentId ?? base?.documentId ?? null,
    emailThreadId: input.emailThreadId ?? base?.emailThreadId ?? null,
    financialItemId: input.financialItemId ?? base?.financialItemId ?? null,
    calendarEventId: input.calendarEventId ?? base?.calendarEventId ?? null,
    projectId: input.projectId ?? base?.projectId ?? null,
    correspondentId: input.correspondentId ?? base?.correspondentId ?? null,
    notes: input.notes ?? base?.notes ?? "",
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
    completedAt: input.status === "done" ? base?.completedAt ?? now : base?.completedAt ?? null,
  };
}

export function reminderBucket(r: ReminderRecord, now = Date.now()): ReminderBucket {
  if (r.status === "done" || r.status === "cancelled") return "done";
  const t = new Date(r.remindAt).getTime();
  if (t < now) {
    // même jour ?
    const sameDay = new Date(r.remindAt).toDateString() === new Date(now).toDateString();
    return sameDay ? "today" : "overdue";
  }
  if (new Date(r.remindAt).toDateString() === new Date(now).toDateString()) return "today";
  return "upcoming";
}

export type ListReminderOptions = { status?: ReminderStatus; recurringOnly?: boolean; actionId?: string; documentId?: number };

export async function listReminders(options: ListReminderOptions = {}): Promise<ReminderRecord[]> {
  let all = await readAll();
  if (options.status) all = all.filter((r) => r.status === options.status);
  if (options.recurringOnly) all = all.filter((r) => r.recurrence !== "none");
  if (options.actionId) all = all.filter((r) => r.actionId === options.actionId);
  if (options.documentId !== undefined) all = all.filter((r) => r.documentId === options.documentId);
  return all.sort((a, b) => a.remindAt.localeCompare(b.remindAt));
}

export async function getReminder(id: string): Promise<ReminderRecord | null> {
  return (await readAll()).find((r) => r.id === id) ?? null;
}

export async function createReminder(input: ReminderInput): Promise<ReminderRecord> {
  const record = normalize(input);
  const all = await readAll();
  all.push(record);
  await writeAll(all);
  return record;
}

export async function updateReminder(id: string, input: ReminderInput): Promise<ReminderRecord | null> {
  const all = await readAll();
  const i = all.findIndex((r) => r.id === id);
  if (i < 0) return null;
  all[i] = normalize(input, all[i]);
  await writeAll(all);
  return all[i];
}

export async function deleteReminder(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((r) => r.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

export async function completeReminder(id: string): Promise<ReminderRecord | null> {
  return updateReminder(id, { status: "done" });
}

export async function postponeReminder(id: string, remindAt: string): Promise<ReminderRecord | null> {
  return updateReminder(id, { remindAt, status: "scheduled" });
}

export type ReminderBucketLabel = { label: string; tone: "emerald" | "amber" | "rose" | "slate" };
export type ReminderGroups = {
  today: ReminderRecord[];
  week: ReminderRecord[];
  overdue: ReminderRecord[];
  upcoming: ReminderRecord[];
  recurring: ReminderRecord[];
  finance: ReminderRecord[];
  docs: ReminderRecord[];
  labelById: Record<string, ReminderBucketLabel>;
};

/**
 * Groupe une liste de rappels (côté serveur — calculs de date hors rendu pour
 * éviter la règle react-hooks/purity côté composant). Retourne aussi un label
 * de bucket par id pour l'affichage.
 */
export function bucketReminders(reminders: ReminderRecord[]): ReminderGroups {
  const now = Date.now();
  const todayStr = new Date(now).toDateString();
  const oneWeek = now + 7 * 86_400_000;
  const today: ReminderRecord[] = [];
  const week: ReminderRecord[] = [];
  const overdue: ReminderRecord[] = [];
  const upcoming: ReminderRecord[] = [];
  const labelById: Record<string, ReminderBucketLabel> = {};
  for (const r of reminders) {
    const t = new Date(r.remindAt).getTime();
    const sameDay = new Date(r.remindAt).toDateString() === todayStr;
    let label: ReminderBucketLabel;
    if (r.status === "done") label = { label: "Terminé", tone: "emerald" };
    else if (r.status === "cancelled") label = { label: "Annulé", tone: "slate" };
    else if (sameDay) label = { label: "Aujourd'hui", tone: "amber" };
    else if (t < now) label = { label: "En retard", tone: "rose" };
    else label = { label: "À venir", tone: "slate" };
    labelById[r.id] = label;
    if (r.status !== "scheduled") continue;
    if (sameDay) today.push(r);
    if (t <= oneWeek && t >= now) week.push(r);
    if (t < now && !sameDay) overdue.push(r);
    if (t >= now) upcoming.push(r);
  }
  return {
    today,
    week,
    overdue,
    upcoming,
    recurring: reminders.filter((r) => r.recurrence !== "none"),
    finance: reminders.filter((r) => r.financialItemId),
    docs: reminders.filter((r) => r.documentId != null),
    labelById,
  };
}
