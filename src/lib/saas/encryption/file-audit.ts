import "server-only";

import fs from "node:fs";
import path from "node:path";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { filesSubdir, legacyMediaSubdir, getFilesDir, resolveExistingFilePath } from "@/lib/storage/ged-paths";
import { isEnvelope } from "./envelope";

/* Audit (lecture seule) des fichiers documents : chiffrés vs en clair, et
   dernier passage de migration. Utilisé par la page /admin/saas/encryption. */

export type EncryptionAudit = {
  found: number;
  encrypted: number;
  plain: number;
  noTenant: number;
  lastRun: {
    finishedAt: string | null;
    dryRun: boolean;
    found: number;
    alreadyEncrypted: number;
    encrypted: number;
    skipped: number;
    errors: number;
  } | null;
};

function header8(file: string): Buffer | null {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buf = Buffer.alloc(8);
      fs.readSync(fd, buf, 0, 8, 0);
      return buf;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

function filesForDoc(id: number, storedFilename: string | null): string[] {
  const out: string[] = [];
  if (storedFilename) {
    const p = resolveExistingFilePath("originals", storedFilename);
    if (p) out.push(p);
  }
  const thumb = resolveExistingFilePath("thumbnails", `${id}.webp`);
  if (thumb) out.push(thumb);
  const prev = resolveExistingFilePath("previews", `${id}.webp`);
  if (prev) out.push(prev);
  const pagesDir = path.join(filesSubdir("pages"), String(id));
  try {
    if (fs.existsSync(pagesDir)) {
      for (const f of fs.readdirSync(pagesDir)) if (f.endsWith(".webp")) out.push(path.join(pagesDir, f));
    }
  } catch { /* ignore */ }
  return out;
}

/** Inventaire des fichiers + dernier run de migration. */
export async function getEncryptionAudit(): Promise<EncryptionAudit> {
  const empty: EncryptionAudit = { found: 0, encrypted: 0, plain: 0, noTenant: 0, lastRun: null };
  if (!postgresActive()) return empty;
  // Évite un parcours disque inutile si l'arbo n'existe pas.
  try { if (!fs.existsSync(getFilesDir()) && !fs.existsSync(legacyMediaSubdir("originals"))) return empty; } catch { /* continue */ }

  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT id, tenant_id, raw FROM documents ORDER BY id");
    const audit = { ...empty };
    for (const r of rows) {
      const raw = (r.raw ?? {}) as Record<string, unknown>;
      const storedFilename = typeof raw.storedFilename === "string" ? (raw.storedFilename as string) : null;
      const tenantId = r.tenant_id == null ? null : String(r.tenant_id);
      for (const f of filesForDoc(Number(r.id), storedFilename)) {
        audit.found++;
        const h = header8(f);
        if (h && isEnvelope(h)) audit.encrypted++;
        else { audit.plain++; if (!tenantId) audit.noTenant++; }
      }
    }

    // Dernier passage de migration (si la table existe).
    try {
      const { rows: runs } = await pool.query(
        "SELECT finished_at, dry_run, found, already_encrypted, encrypted, skipped, errors FROM encryption_migration_runs ORDER BY started_at DESC LIMIT 1",
      );
      if (runs[0]) {
        const x = runs[0];
        audit.lastRun = {
          finishedAt: x.finished_at ? new Date(String(x.finished_at)).toISOString() : null,
          dryRun: x.dry_run === true,
          found: Number(x.found ?? 0), alreadyEncrypted: Number(x.already_encrypted ?? 0),
          encrypted: Number(x.encrypted ?? 0), skipped: Number(x.skipped ?? 0), errors: Number(x.errors ?? 0),
        };
      }
    } catch { /* table absente */ }

    return audit;
  } catch {
    return empty;
  }
}
