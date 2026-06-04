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

export async function createServerBackup(
  options: { includeFiles?: boolean } = {},
): Promise<BackupReport> {
  const dir = getBackupsDir();
  await fs.mkdir(dir, { recursive: true });

  const { buffer, counts, errors } = await buildExportZip({ includeFiles: options.includeFiles });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${PREFIX}${stamp}.zip`;
  await fs.writeFile(path.join(dir, filename), buffer);

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
