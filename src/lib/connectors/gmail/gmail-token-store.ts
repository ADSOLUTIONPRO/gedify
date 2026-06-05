import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getMailConnectorDataDir } from "@/lib/mail-connector/storage-paths";

const FILE = "gmail-tokens.json";
const ALG = "aes-256-gcm";
const IV_LEN = 12;

type GmailTokenRecord = {
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
      "CONNECTOR_SECRET_KEY (16+ caractères) requis pour stocker les tokens Gmail chiffrés.",
    );
  }
  return createHash("sha256").update(secret).digest();
}

export function isGmailStoreSecure(): boolean {
  const secret = process.env.CONNECTOR_SECRET_KEY ?? process.env.MAIL_CONNECTOR_KEY;
  return Boolean(secret && secret.length >= 16);
}

export function encryptToken(plain: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptToken(encoded: string): string {
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

async function readAllJson(): Promise<GmailTokenRecord[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as GmailTokenRecord[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<GmailTokenRecord[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<GmailTokenRecord>("mail_oauth_tokens", "id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

/** Type public masqué : présence/expiration UNIQUEMENT, jamais les valeurs. */
export type GmailTokenPublic = {
  accountId: string;
  email: string;
  hasRefreshToken: boolean;
  expiresAt: number | null;
  expired: boolean | null;
  connectedAt: string | null;
};

/**
 * Liste les tokens Gmail en forme PUBLIQUE (audit sécurité). Ne renvoie JAMAIS
 * encryptedRefreshToken / cachedAccessToken — seulement présence + expiration.
 */
export async function listGmailTokensPublic(): Promise<GmailTokenPublic[]> {
  const now = Date.now();
  const all = await readAll();
  return all.map((t) => ({
    accountId: t.accountId,
    email: t.email,
    hasRefreshToken: Boolean(t.encryptedRefreshToken && t.encryptedRefreshToken.trim()),
    expiresAt: t.accessTokenExpiresAt ?? null,
    expired: t.accessTokenExpiresAt != null ? t.accessTokenExpiresAt < now : null,
    connectedAt: t.connectedAt ?? null,
  }));
}

async function writeAll(items: GmailTokenRecord[]) {
  if (pgStorageActive()) {
    await pgWriteAll<GmailTokenRecord>("mail_oauth_tokens", "id", (t) => t.accountId, items, "metadata");
    return;
  }
  await mkdir(getMailConnectorDataDir(), { recursive: true });
  await writeFile(getFilePath(), JSON.stringify(items, null, 2), "utf8");
}

export async function saveGmailTokens(input: {
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
  const record: GmailTokenRecord = {
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

export async function getGmailRefreshToken(accountId: string): Promise<{
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

export async function getGmailRecordPublic(accountId: string): Promise<{
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

export async function updateCachedAccessToken(
  accountId: string,
  accessToken: string,
  expiresAt: number,
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.accountId === accountId);
  if (index < 0) return;
  all[index] = {
    ...all[index],
    cachedAccessToken: accessToken,
    accessTokenExpiresAt: expiresAt,
    updatedAt: new Date().toISOString(),
  };
  await writeAll(all);
}

export async function getCachedAccessToken(accountId: string): Promise<string | null> {
  const all = await readAll();
  const record = all.find((entry) => entry.accountId === accountId);
  if (!record?.cachedAccessToken || !record.accessTokenExpiresAt) return null;
  if (record.accessTokenExpiresAt - Date.now() < 60_000) return null;
  return record.cachedAccessToken;
}

export async function deleteGmailTokens(accountId: string): Promise<void> {
  const all = await readAll();
  const next = all.filter((entry) => entry.accountId !== accountId);
  await writeAll(next);
}

export type GmailAccountSummary = {
  accountId: string;
  email: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export async function listGmailAccounts(): Promise<GmailAccountSummary[]> {
  const all = await readAll();
  return all.map((record) => ({
    accountId: record.accountId,
    email: record.email,
    scopes: record.scopes,
    connectedAt: record.connectedAt,
    updatedAt: record.updatedAt,
  }));
}
