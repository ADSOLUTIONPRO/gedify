import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getMailConnectorDataDir } from "@/lib/mail-connector/storage-paths";

/* Stockage des tokens OAuth Microsoft, chiffrés (AES-256-GCM). Volontairement
   SÉPARÉ du store Gmail (fichier + table distincts) : chaque store réécrit
   l'intégralité de sa collection, donc partager la table provoquerait un
   écrasement mutuel des enregistrements. */

const FILE = "outlook-tokens.json";
const TABLE = "outlook_oauth_tokens";
const ALG = "aes-256-gcm";
const IV_LEN = 12;

type OutlookTokenRecord = {
  accountId: string;
  email: string;
  encryptedRefreshToken: string;
  scopes: string[];
  cachedAccessToken: string | null;
  accessTokenExpiresAt: number | null;
  connectedAt: string;
  updatedAt: string;
};

function getSecret(): Buffer {
  const secret = process.env.CONNECTOR_SECRET_KEY ?? process.env.MAIL_CONNECTOR_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "CONNECTOR_SECRET_KEY (16+ caractères) requis pour stocker les tokens Microsoft chiffrés.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function isOutlookStoreSecure(): boolean {
  const secret = process.env.CONNECTOR_SECRET_KEY ?? process.env.MAIL_CONNECTOR_KEY;
  return Boolean(secret && secret.length >= 16);
}

function encryptToken(plain: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

function decryptToken(encoded: string): string {
  const key = getSecret();
  const [ivB64, tagB64, ctB64] = encoded.split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Token chiffré invalide.");
  const decipher = createDecipheriv(ALG, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plain = Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]);
  return plain.toString("utf8");
}

function getFilePath() {
  return path.join(getMailConnectorDataDir(), FILE);
}

async function readAllJson(): Promise<OutlookTokenRecord[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutlookTokenRecord[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<OutlookTokenRecord[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<OutlookTokenRecord>(TABLE, "id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: OutlookTokenRecord[]) {
  if (pgStorageActive()) {
    await pgWriteAll<OutlookTokenRecord>(TABLE, "id", (t) => t.accountId, items, "metadata");
    return;
  }
  await mkdir(getMailConnectorDataDir(), { recursive: true });
  await writeFile(getFilePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function saveOutlookTokens(input: {
  accountId: string;
  email: string;
  refreshToken: string;
  accessToken?: string | null;
  accessTokenExpiresAt?: number | null;
  scopes: string[];
}): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.accountId === input.accountId);
  const now = new Date().toISOString();
  const record: OutlookTokenRecord = {
    accountId: input.accountId,
    email: input.email,
    encryptedRefreshToken: encryptToken(input.refreshToken),
    cachedAccessToken: input.accessToken ?? null,
    accessTokenExpiresAt: input.accessTokenExpiresAt ?? null,
    scopes: input.scopes,
    connectedAt: index >= 0 ? all[index].connectedAt : now,
    updatedAt: now,
  };
  if (index >= 0) all[index] = record;
  else all.push(record);
  await writeAll(all);
}

export async function getOutlookRefreshToken(accountId: string): Promise<{
  refreshToken: string;
  email: string;
  scopes: string[];
} | null> {
  const all = await readAll();
  const record = all.find((entry) => entry.accountId === accountId);
  if (!record) return null;
  return {
    refreshToken: decryptToken(record.encryptedRefreshToken),
    email: record.email,
    scopes: record.scopes,
  };
}

export async function getOutlookRecordPublic(accountId: string): Promise<{
  accountId: string;
  email: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
} | null> {
  const all = await readAll();
  const record = all.find((entry) => entry.accountId === accountId);
  if (!record) return null;
  return {
    accountId: record.accountId,
    email: record.email,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    updatedAt: record.updatedAt,
    hasRefreshToken: Boolean(record.encryptedRefreshToken),
  };
}

export async function getCachedOutlookAccessToken(accountId: string): Promise<string | null> {
  const all = await readAll();
  const record = all.find((entry) => entry.accountId === accountId);
  if (!record?.cachedAccessToken || !record.accessTokenExpiresAt) return null;
  if (record.accessTokenExpiresAt - Date.now() < 60_000) return null;
  return record.cachedAccessToken;
}

export async function updateOutlookTokens(
  accountId: string,
  patch: { accessToken?: string; accessTokenExpiresAt?: number; refreshToken?: string },
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.accountId === accountId);
  if (index < 0) return;
  all[index] = {
    ...all[index],
    ...(patch.accessToken != null ? { cachedAccessToken: patch.accessToken } : {}),
    ...(patch.accessTokenExpiresAt != null ? { accessTokenExpiresAt: patch.accessTokenExpiresAt } : {}),
    ...(patch.refreshToken ? { encryptedRefreshToken: encryptToken(patch.refreshToken) } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
}

export async function deleteOutlookTokens(accountId: string): Promise<void> {
  const all = await readAll();
  const next = all.filter((entry) => entry.accountId !== accountId);
  await writeAll(next);
}

export type OutlookAccountSummary = {
  accountId: string;
  email: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export async function listOutlookAccounts(): Promise<OutlookAccountSummary[]> {
  const all = await readAll();
  return all.map((record) => ({
    accountId: record.accountId,
    email: record.email,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    updatedAt: record.updatedAt,
  }));
}
