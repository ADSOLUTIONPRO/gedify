import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";

/* ────────────────────────────────────────────────────────────────────────
   Socle Agenda : modèle CalendarEvent général (événements/rendez-vous), PAR
   UTILISATEUR, stocké en base (JSON / SQLite / Postgres via pg-store).
   Champs de synchro prévus pour la future synchro bidirectionnelle
   (Google/Outlook/iCloud/CalDAV) — non branchée ici. Les TÂCHES réutilisent
   le modèle existant (action-store) : pas de duplication.
   ──────────────────────────────────────────────────────────────────────── */

export type EventProvider = "local" | "google" | "outlook" | "icloud" | "caldav";
export type EventSyncStatus = "local" | "synced" | "pending" | "syncing" | "error" | "conflict" | "readonly";
export type EventSourceType = "manual" | "email" | "document" | "contact" | "project" | "folder" | "auto" | "assistant";
export type EventVisibility = "default" | "public" | "private";
export type ParticipantStatus = "accepted" | "declined" | "tentative" | "pending";

export type EventParticipant = { email: string; name?: string | null; status?: ParticipantStatus; organizer?: boolean };
export type EventReminder = { minutesBefore: number; channel: "in_app" | "email" | "notification" };
export type EventLocation = {
  displayName?: string | null;
  formattedAddress?: string | null;
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  calendarId: string | null;
  title: string;
  description: string | null;
  start: string; // ISO
  end: string | null; // ISO
  allDay: boolean;
  timezone: string | null;
  location: EventLocation | null;
  color: string | null;
  /** RRULE iCalendar (récurrence), ou null. */
  recurrence: string | null;
  participants: EventParticipant[];
  reminders: EventReminder[];
  visibility: EventVisibility;
  conferenceUrl: string | null;
  status: "confirmed" | "tentative" | "cancelled";
  // Origine
  sourceType: EventSourceType | null;
  sourceId: string | null;
  sourceLabel: string | null;
  createdAutomatically: boolean;
  validatedByUser: boolean;
  // Synchro externe (préparé pour la phase synchro)
  provider: EventProvider;
  externalId: string | null;
  etag: string | null;
  syncStatus: EventSyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  // Relations GEDify
  linkedDocumentIds: number[];
  linkedEmailIds: string[];
  linkedContactIds: string[];
  linkedFolderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CalendarEventInput = Partial<Omit<CalendarEvent, "id" | "userId" | "createdAt" | "updatedAt">> & { title: string; start: string };

const COLLECTION = "calendar_events";
const JSON_FILE = "calendar-events.json";

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readAll(): Promise<CalendarEvent[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<CalendarEvent>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function readJson(): Promise<CalendarEvent[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CalendarEvent[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeAll(items: CalendarEvent[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<CalendarEvent>(COLLECTION, "id", (e) => e.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function normalize(userId: string, input: CalendarEventInput, base?: CalendarEvent): CalendarEvent {
  const now = new Date().toISOString();
  return {
    id: base?.id ?? randomUUID(),
    userId,
    calendarId: input.calendarId ?? base?.calendarId ?? null,
    title: input.title?.trim() || base?.title || "Sans titre",
    description: input.description ?? base?.description ?? null,
    start: input.start ?? base?.start ?? now,
    end: input.end ?? base?.end ?? null,
    allDay: input.allDay ?? base?.allDay ?? false,
    timezone: input.timezone ?? base?.timezone ?? null,
    location: input.location ?? base?.location ?? null,
    color: input.color ?? base?.color ?? null,
    recurrence: input.recurrence ?? base?.recurrence ?? null,
    participants: input.participants ?? base?.participants ?? [],
    reminders: input.reminders ?? base?.reminders ?? [],
    visibility: input.visibility ?? base?.visibility ?? "default",
    conferenceUrl: input.conferenceUrl ?? base?.conferenceUrl ?? null,
    status: input.status ?? base?.status ?? "confirmed",
    sourceType: input.sourceType ?? base?.sourceType ?? "manual",
    sourceId: input.sourceId ?? base?.sourceId ?? null,
    sourceLabel: input.sourceLabel ?? base?.sourceLabel ?? null,
    createdAutomatically: input.createdAutomatically ?? base?.createdAutomatically ?? false,
    validatedByUser: input.validatedByUser ?? base?.validatedByUser ?? true,
    provider: input.provider ?? base?.provider ?? "local",
    externalId: input.externalId ?? base?.externalId ?? null,
    etag: input.etag ?? base?.etag ?? null,
    syncStatus: input.syncStatus ?? base?.syncStatus ?? "local",
    syncError: input.syncError ?? base?.syncError ?? null,
    lastSyncedAt: input.lastSyncedAt ?? base?.lastSyncedAt ?? null,
    linkedDocumentIds: input.linkedDocumentIds ?? base?.linkedDocumentIds ?? [],
    linkedEmailIds: input.linkedEmailIds ?? base?.linkedEmailIds ?? [],
    linkedContactIds: input.linkedContactIds ?? base?.linkedContactIds ?? [],
    linkedFolderId: input.linkedFolderId ?? base?.linkedFolderId ?? null,
    createdAt: base?.createdAt ?? now,
    updatedAt: now,
  };
}

/** Liste les événements de l'utilisateur, éventuellement bornée à [from, to]. */
export async function listEvents(userId: string, range?: { from?: string; to?: string }): Promise<CalendarEvent[]> {
  const all = await readAll();
  let mine = all.filter((e) => e.userId === userId && e.status !== "cancelled");
  if (range?.from) mine = mine.filter((e) => (e.end ?? e.start) >= range.from!);
  if (range?.to) mine = mine.filter((e) => e.start <= range.to!);
  return mine.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export async function getEvent(userId: string, id: string): Promise<CalendarEvent | null> {
  const all = await readAll();
  const e = all.find((x) => x.id === id);
  return e && e.userId === userId ? e : null;
}

export async function createEvent(userId: string, input: CalendarEventInput): Promise<CalendarEvent> {
  const all = await readAll();
  const event = normalize(userId, input);
  all.push(event);
  await writeAll(all);
  return event;
}

export async function updateEvent(userId: string, id: string, patch: Partial<CalendarEventInput>): Promise<CalendarEvent | null> {
  const all = await readAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1 || all[idx].userId !== userId) return null;
  const next = normalize(userId, { ...all[idx], ...patch, title: patch.title ?? all[idx].title, start: patch.start ?? all[idx].start }, all[idx]);
  all[idx] = next;
  await writeAll(all);
  return next;
}

export async function deleteEvent(userId: string, id: string): Promise<boolean> {
  const all = await readAll();
  const target = all.find((e) => e.id === id);
  if (!target || target.userId !== userId) return false;
  await writeAll(all.filter((e) => e.id !== id));
  return true;
}

/**
 * Upsert d'un événement EXTERNE (synchro) : retrouve par (userId, provider,
 * externalId) → met à jour, sinon crée. Renvoie { created }. Évite les
 * doublons lors de synchros répétées.
 */
export async function upsertByExternal(
  userId: string,
  provider: EventProvider,
  externalId: string,
  input: CalendarEventInput,
): Promise<{ event: CalendarEvent; created: boolean }> {
  const all = await readAll();
  const idx = all.findIndex((e) => e.userId === userId && e.provider === provider && e.externalId === externalId);
  if (idx >= 0) {
    const next = normalize(userId, { ...all[idx], ...input, provider, externalId, title: input.title ?? all[idx].title, start: input.start ?? all[idx].start }, all[idx]);
    all[idx] = next;
    await writeAll(all);
    return { event: next, created: false };
  }
  const event = normalize(userId, { ...input, provider, externalId });
  all.push(event);
  await writeAll(all);
  return { event, created: true };
}
