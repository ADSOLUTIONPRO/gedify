import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pgStorageActive, jsonFallback, pgReadAll, pgWriteAll } from "@/lib/db/pg-store";
import { getMailConnectorDataDir } from "@/lib/mail-connector/storage-paths";

/**
 * Préférences d'inclusion des dossiers/labels par compte mail (§13).
 *
 * On ne stocke QUE les écarts au comportement par défaut : un libellé non
 * système est inclus par défaut dans « Courriels à traiter », l'utilisateur peut
 * le décocher → on enregistre une exclusion. Les dossiers système (Envoyés,
 * Brouillons, Spam, Corbeille…) sont verrouillés et gérés par les règles
 * d'exclusion système (jamais stockés ici).
 *
 * Compatible Postgres (JSONB) / SQLite / JSON via le routage central pg-store.
 */

const FILE = "mail-folder-prefs.json";
const TABLE = "mail_folder_prefs";

export type MailFolderPref = {
  /** Clé : `${accountId}::${folderId}`. */
  id: string;
  accountId: string;
  /** Id fournisseur du dossier/label (ex. label Gmail "Label_123"). */
  folderId: string;
  /** Nom lisible (utilisé pour la requête d'exclusion `-label:"…"`). */
  folderName: string;
  included: boolean;
  updatedAt: string;
};

function filePath() {
  return path.join(getMailConnectorDataDir(), FILE);
}

async function readAllJson(): Promise<MailFolderPref[]> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MailFolderPref[]) : [];
  } catch {
    return [];
  }
}

async function readAll(): Promise<MailFolderPref[]> {
  if (pgStorageActive()) {
    try {
      return await pgReadAll<MailFolderPref>(TABLE);
    } catch (e) {
      if (jsonFallback()) return readAllJson();
      throw e;
    }
  }
  return readAllJson();
}

async function writeAll(items: MailFolderPref[]) {
  if (pgStorageActive()) {
    await pgWriteAll<MailFolderPref>(TABLE, "id", (p) => p.id, items);
    return;
  }
  await mkdir(getMailConnectorDataDir(), { recursive: true });
  await writeFile(filePath(), JSON.stringify(items, null, 2), "utf8");
}

function key(accountId: string, folderId: string): string {
  return `${accountId}::${folderId}`;
}

/** Toutes les préférences d'un compte (écarts au défaut uniquement). */
export async function listFolderPrefs(accountId: string): Promise<MailFolderPref[]> {
  const all = await readAll();
  return all.filter((p) => p.accountId === accountId);
}

/**
 * Définit l'inclusion d'un dossier non système. `included=true` (défaut) supprime
 * l'écart enregistré ; `included=false` enregistre l'exclusion manuelle.
 */
export async function setFolderPref(
  accountId: string,
  folderId: string,
  folderName: string,
  included: boolean,
): Promise<void> {
  const all = await readAll();
  const id = key(accountId, folderId);
  const rest = all.filter((p) => p.id !== id);
  if (included) {
    // Retour au défaut (inclus) → on ne conserve aucun écart.
    if (rest.length !== all.length) await writeAll(rest);
    return;
  }
  rest.push({ id, accountId, folderId, folderName, included: false, updatedAt: new Date().toISOString() });
  await writeAll(rest);
}

/** Noms des libellés exclus manuellement par l'utilisateur pour ce compte. */
export async function getExcludedFolderNames(accountId: string): Promise<string[]> {
  const prefs = await listFolderPrefs(accountId);
  return prefs.filter((p) => !p.included).map((p) => p.folderName).filter(Boolean);
}
