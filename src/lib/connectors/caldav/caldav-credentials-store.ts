import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import { encryptToken, decryptToken } from "@/lib/connectors/gmail/gmail-token-store";

/* Stockage des comptes CalDAV (iCloud…). Le mot de passe d'application est
   chiffré (AES-256-GCM via CONNECTOR_SECRET_KEY, partagé avec le connecteur
   Gmail). Jamais exposé en clair par les endpoints publics. */

export type CalDavCalendarRef = { url: string; displayName: string; color: string | null };

type CalDavAccountRecord = {
  id: string;
  label: string;
  username: string;
  encryptedPassword: string;
  serverUrl: string;
  principalUrl: string;
  homeUrl: string;
  calendars: CalDavCalendarRef[];
  connectedAt: string;
  updatedAt: string;
};

/** Vue publique (sans secret). */
export type CalDavAccountPublic = {
  id: string;
  label: string;
  username: string;
  serverUrl: string;
  homeUrl: string;
  calendars: CalDavCalendarRef[];
  connectedAt: string;
};

const COLLECTION = "caldav_accounts";
const JSON_FILE = "caldav-accounts.json";

export function isCalDavStoreSecure(): boolean {
  const secret = process.env.CONNECTOR_SECRET_KEY ?? process.env.MAIL_CONNECTOR_KEY;
  return Boolean(secret && secret.length >= 16);
}

function jsonPath() { return path.join(getDataDir(), JSON_FILE); }

async function readJson(): Promise<CalDavAccountRecord[]> {
  try {
    const raw = await readFile(jsonPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as CalDavAccountRecord[]) : [];
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

async function readAll(): Promise<CalDavAccountRecord[]> {
  if (pgStorageActive()) {
    try { return await pgReadAll<CalDavAccountRecord>(COLLECTION); }
    catch (e) { if (jsonFallback()) return readJson(); throw e; }
  }
  return readJson();
}

async function writeAll(items: CalDavAccountRecord[]): Promise<void> {
  if (pgStorageActive()) { await pgWriteAll<CalDavAccountRecord>(COLLECTION, "id", (a) => a.id, items); return; }
  const file = jsonPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(items, null, 2)}\n`, "utf8");
}

function toPublic(r: CalDavAccountRecord): CalDavAccountPublic {
  return { id: r.id, label: r.label, username: r.username, serverUrl: r.serverUrl, homeUrl: r.homeUrl, calendars: r.calendars, connectedAt: r.connectedAt };
}

export async function listCalDavAccounts(): Promise<CalDavAccountPublic[]> {
  return (await readAll()).map(toPublic);
}

export async function saveCalDavAccount(input: {
  label: string;
  username: string;
  password: string;
  serverUrl: string;
  principalUrl: string;
  homeUrl: string;
  calendars: CalDavCalendarRef[];
}): Promise<CalDavAccountPublic> {
  const all = await readAll();
  const now = new Date().toISOString();
  const idx = all.findIndex((a) => a.username.toLowerCase() === input.username.toLowerCase() && a.serverUrl === input.serverUrl);
  const record: CalDavAccountRecord = {
    id: idx >= 0 ? all[idx].id : randomUUID(),
    label: input.label,
    username: input.username,
    encryptedPassword: encryptToken(input.password),
    serverUrl: input.serverUrl,
    principalUrl: input.principalUrl,
    homeUrl: input.homeUrl,
    calendars: input.calendars,
    connectedAt: idx >= 0 ? all[idx].connectedAt : now,
    updatedAt: now,
  };
  if (idx >= 0) all[idx] = record; else all.push(record);
  await writeAll(all);
  return toPublic(record);
}

/** Identifiants déchiffrés d'un compte (usage serveur uniquement). */
export async function getCalDavAuth(accountId: string): Promise<{ username: string; password: string; homeUrl: string; serverUrl: string; calendars: CalDavCalendarRef[] } | null> {
  const all = await readAll();
  const r = all.find((a) => a.id === accountId);
  if (!r) return null;
  return { username: r.username, password: decryptToken(r.encryptedPassword), homeUrl: r.homeUrl, serverUrl: r.serverUrl, calendars: r.calendars };
}

/** Retrouve le compte CalDAV qui possède l'agenda d'URL donnée (routage du push). */
export async function getCalDavAccountForCalendar(calendarUrl: string): Promise<{ accountId: string; username: string; password: string } | null> {
  const all = await readAll();
  const r = all.find((a) => a.calendars.some((c) => c.url === calendarUrl));
  if (!r) return null;
  return { accountId: r.id, username: r.username, password: decryptToken(r.encryptedPassword) };
}

export async function deleteCalDavAccount(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((a) => a.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}
