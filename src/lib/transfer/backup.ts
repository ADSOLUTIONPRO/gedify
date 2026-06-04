import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { getBackupsDir } from "@/lib/storage/ged-paths";
import { buildExportZip, type ExportCounts } from "@/lib/transfer/export";

/* ────────────────────────────────────────────────────────────────────────
   Sauvegarde SERVEUR « maintenant » (Chantier 5).

   Construit l'archive complète (documents + fichiers + taxonomies + overlay +
   dump PostgreSQL si actif) et l'écrit dans <BACKUPS_DIR> côté serveur, avec un
   rapport. Restaurable via l'import ZIP existant. Aucune donnée supprimée.
   ──────────────────────────────────────────────────────────────────────── */

export type BackupReport = {
  ok: boolean;
  filename: string;
  bytes: number;
  createdAt: string;
  counts: ExportCounts;
  errors: string[];
};

export type BackupEntry = { filename: string; bytes: number; createdAt: string };

const PREFIX = "gedify-backup-";

/** Nombre de sauvegardes serveur à conserver (rétention). 0 = illimité. */
export function backupRetention(): number {
  const v = Number(process.env.GEDIFY_BACKUP_RETENTION);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 14;
}

/** Supprime les sauvegardes les plus anciennes au-delà de `keep`. */
export async function pruneBackups(keep = backupRetention()): Promise<number> {
  if (keep <= 0) return 0;
  const dir = getBackupsDir();
  const all = await listServerBackups(); // déjà trié du plus récent au plus ancien
  const toDelete = all.slice(keep);
  let deleted = 0;
  for (const b of toDelete) {
    try {
      await fs.rm(path.join(dir, b.filename), { force: true });
      deleted += 1;
    } catch {
      /* ignore */
    }
  }
  return deleted;
}

export async function createServerBackup(
  options: { includeFiles?: boolean } = {},
): Promise<BackupReport> {
  const dir = getBackupsDir();
  await fs.mkdir(dir, { recursive: true });

  const { buffer, counts, errors } = await buildExportZip({ includeFiles: options.includeFiles });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${PREFIX}${stamp}.zip`;
  await fs.writeFile(path.join(dir, filename), buffer);

  // Rétention : on ne garde que les N dernières.
  await pruneBackups().catch(() => 0);

  return {
    ok: true,
    filename,
    bytes: buffer.length,
    createdAt: new Date().toISOString(),
    counts,
    errors,
  };
}

export async function listServerBackups(): Promise<BackupEntry[]> {
  const dir = getBackupsDir();
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: BackupEntry[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith(".zip")) continue;
    try {
      const st = await fs.stat(path.join(dir, e.name));
      out.push({ filename: e.name, bytes: st.size, createdAt: new Date(st.mtimeMs).toISOString() });
    } catch {
      /* ignore */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
