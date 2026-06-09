import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import {
  decryptPassword,
  encryptPassword,
  isSecureStorageReady,
} from "./encryption";
import { findProvider } from "./providers";
import { ACCOUNTS_FILE, getMailConnectorDataDir } from "./storage-paths";
import type {
  MailAccount,
  MailAccountInput,
  MailAttachmentFilter,
  MailEncryption,
} from "./types";

async function ensureDir() {
  await mkdir(getMailConnectorDataDir(), { recursive: true });
}

function getFilePath() {
  return path.join(getMailConnectorDataDir(), ACCOUNTS_FILE);
}

async function readAllJson(): Promise<MailAccount[]> {
  try {
    const raw = await readFile(getFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as MailAccount[];
  } catch {
    return [];
  }
}

async function readAll(): Promise<MailAccount[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<MailAccount>("mail_accounts", "id", "metadata");
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(accounts: MailAccount[]) {
  if (pgStorageActive()) {
    await pgWriteAll<MailAccount>("mail_accounts", "id", (a) => a.id, accounts, "metadata");
    return;
  }
  await ensureDir();
  await writeFile(getFilePath(), JSON.stringify(accounts, null, 2), "utf8");
}

function publicAccount(account: MailAccount): MailAccount {
  const { encryptedPassword, ...rest } = account;
  return {
    ...rest,
    encryptedPassword: null,
    hasPassword: Boolean(encryptedPassword),
    folderRules: account.folderRules ?? null,
    senderFilter: account.senderFilter ?? null,
    attachmentRules: account.attachmentRules ?? null,
    connector: account.connector ?? "imap",
    gmailEmail: account.gmailEmail ?? null,
    // Legacy : comptes créés avant l'ajout du SMTP.
    smtpHost: account.smtpHost ?? null,
    smtpPort: account.smtpPort ?? null,
    smtpEncryption: account.smtpEncryption ?? null,
    smtpUsername: account.smtpUsername ?? null,
  };
}

/** Déduit un hôte SMTP plausible d'un hôte IMAP (imap.→smtp., mail.→mail.). */
function deriveSmtpHost(imapHost: string): string {
  const h = (imapHost ?? "").trim();
  if (!h) return "";
  if (/^imap\./i.test(h)) return h.replace(/^imap\./i, "smtp.");
  return h; // mail.<domaine> / autres : SMTP souvent identique
}

function applyDefaults(input: MailAccountInput): Partial<MailAccount> {
  const providerId = input.provider ?? "custom-imap";
  const provider = findProvider(providerId);

  return {
    name: input.name ?? "Nouveau compte mail",
    email: input.email ?? "",
    provider: providerId,
    authType: input.authType ?? provider?.preferredAuthType ?? "imap-password",
    imapHost: input.imapHost ?? provider?.defaultImapHost ?? "",
    imapPort: input.imapPort ?? provider?.defaultImapPort ?? 993,
    encryption: (input.encryption ?? provider?.defaultEncryption ?? "tls") as MailEncryption,
    username: input.username ?? input.email ?? "",
    // SMTP (envoi) : déduit de l'IMAP si non fourni (imap.→smtp., 465 SSL). Le mot
    // de passe SMTP réutilise celui de l'IMAP (cas courant des fournisseurs).
    smtpHost: input.smtpHost ?? deriveSmtpHost(input.imapHost ?? provider?.defaultImapHost ?? ""),
    smtpPort: input.smtpPort ?? 465,
    smtpEncryption: (input.smtpEncryption ?? "tls") as MailEncryption,
    smtpUsername: input.smtpUsername ?? input.username ?? input.email ?? "",
    watchedFolder: input.watchedFolder ?? "INBOX",
    isActive: input.isActive ?? false,
    syncIntervalMinutes: input.syncIntervalMinutes ?? 30,
    markAsRead: input.markAsRead ?? true,
    ignoreAlreadyRead: input.ignoreAlreadyRead ?? true,
    deleteAfterImport: input.deleteAfterImport ?? false,
    attachmentFilter: (input.attachmentFilter ?? "pdf-only") as MailAttachmentFilter,
    defaultTags: input.defaultTags ?? [],
    defaultCorrespondent: input.defaultCorrespondent ?? null,
    defaultDocumentType: input.defaultDocumentType ?? null,
    color: input.color ?? null,
    isDefault: input.isDefault ?? false,
  };
}

export async function listAccounts(): Promise<MailAccount[]> {
  const all = await readAll();
  return all.map(publicAccount);
}

export async function getAccount(id: string): Promise<MailAccount | null> {
  const all = await readAll();
  const account = all.find((entry) => entry.id === id);
  return account ? publicAccount(account) : null;
}

/** Server-only: returns the raw account including encryptedPassword, for internal use only. */
export async function getAccountWithSecret(id: string): Promise<MailAccount | null> {
  const all = await readAll();
  return all.find((entry) => entry.id === id) ?? null;
}

export async function getDecryptedPassword(id: string): Promise<string | null> {
  const account = await getAccountWithSecret(id);
  if (!account?.encryptedPassword) return null;
  return decryptPassword(account.encryptedPassword);
}

export async function createAccount(input: MailAccountInput): Promise<MailAccount> {
  const now = new Date().toISOString();
  const id = randomUUID();
  const defaults = applyDefaults(input);

  let encryptedPassword: string | null = null;
  if (input.password) {
    if (!isSecureStorageReady()) {
      throw new Error(
        "Stockage sécurisé à connecter : définissez MAIL_CONNECTOR_KEY pour activer le chiffrement AES-256-GCM avant de stocker un mot de passe.",
      );
    }
    encryptedPassword = encryptPassword(input.password);
  }

  const account: MailAccount = {
    id,
    name: defaults.name!,
    email: defaults.email!,
    provider: defaults.provider!,
    authType: defaults.authType!,
    imapHost: defaults.imapHost!,
    imapPort: defaults.imapPort!,
    encryption: defaults.encryption!,
    username: defaults.username!,
    smtpHost: defaults.smtpHost ?? null,
    smtpPort: defaults.smtpPort ?? null,
    smtpEncryption: defaults.smtpEncryption ?? null,
    smtpUsername: defaults.smtpUsername ?? null,
    encryptedPassword,
    hasPassword: Boolean(encryptedPassword),
    watchedFolder: defaults.watchedFolder!,
    isActive: defaults.isActive!,
    syncIntervalMinutes: defaults.syncIntervalMinutes!,
    markAsRead: defaults.markAsRead!,
    ignoreAlreadyRead: defaults.ignoreAlreadyRead!,
    deleteAfterImport: defaults.deleteAfterImport!,
    attachmentFilter: defaults.attachmentFilter!,
    defaultTags: defaults.defaultTags!,
    defaultCorrespondent: defaults.defaultCorrespondent!,
    defaultDocumentType: defaults.defaultDocumentType!,
    lastSyncAt: null,
    lastSuccessAt: null,
    lastError: null,
    folderRules: input.folderRules ?? null,
    senderFilter: input.senderFilter ?? null,
    attachmentRules: input.attachmentRules ?? null,
    connector: input.connector ?? "imap",
    gmailEmail: input.gmailEmail ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const all = await readAll();
  all.push(account);
  await writeAll(all);
  return publicAccount(account);
}

export async function updateAccount(
  id: string,
  input: MailAccountInput,
): Promise<MailAccount | null> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return null;

  const existing = all[index];
  const defaults = applyDefaults({ ...existing, ...input });

  let encryptedPassword = existing.encryptedPassword;
  if (input.password !== undefined) {
    if (input.password === null || input.password === "") {
      encryptedPassword = null;
    } else {
      if (!isSecureStorageReady()) {
        throw new Error(
          "Stockage sécurisé à connecter : MAIL_CONNECTOR_KEY manquant.",
        );
      }
      encryptedPassword = encryptPassword(input.password);
    }
  }

  const updated: MailAccount = {
    ...existing,
    ...defaults,
    encryptedPassword,
    hasPassword: Boolean(encryptedPassword),
    folderRules: input.folderRules !== undefined ? input.folderRules : existing.folderRules ?? null,
    senderFilter: input.senderFilter !== undefined ? input.senderFilter : existing.senderFilter ?? null,
    attachmentRules:
      input.attachmentRules !== undefined ? input.attachmentRules : existing.attachmentRules ?? null,
    connector: input.connector ?? existing.connector ?? "imap",
    gmailEmail: input.gmailEmail !== undefined ? input.gmailEmail : existing.gmailEmail ?? null,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  // Boîte par défaut exclusive : une seule à la fois.
  if (updated.isDefault) {
    for (let i = 0; i < all.length; i++) {
      if (i !== index && all[i].isDefault) all[i] = { ...all[i], isDefault: false };
    }
  }
  await writeAll(all);
  return publicAccount(updated);
}

export async function deleteAccount(id: string): Promise<boolean> {
  const all = await readAll();
  const next = all.filter((entry) => entry.id !== id);
  if (next.length === all.length) return false;
  await writeAll(next);
  return true;
}

export async function recordAccountSyncResult(
  id: string,
  result: { ok: boolean; errorMessage?: string },
): Promise<void> {
  const all = await readAll();
  const index = all.findIndex((entry) => entry.id === id);
  if (index < 0) return;

  const now = new Date().toISOString();
  const updated = {
    ...all[index],
    lastSyncAt: now,
    lastSuccessAt: result.ok ? now : all[index].lastSuccessAt,
    lastError: result.ok ? null : result.errorMessage ?? "Erreur inconnue",
    updatedAt: now,
  };

  all[index] = updated;
  await writeAll(all);
}
