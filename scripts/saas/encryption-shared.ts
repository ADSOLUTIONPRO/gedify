/* Helpers PARTAGÉS par les scripts de chiffrement (migration + vérification).
   Autonome : aucune dépendance "@/…" ni "server-only". Résout les chemins de la
   même façon que l'application (DATA_DIR/FILES_DIR + arborescence héritée media/).
   Réutilise les primitives d'enveloppe pour éviter toute dérive de format. */

import fs from "node:fs";
import path from "node:path";
import type { Client } from "pg";
import {
  isEnvelope, encodeEnvelope, decodeEnvelope, gcmDecrypt, unwrapKey,
} from "../../src/lib/saas/encryption/envelope";

export { isEnvelope, encodeEnvelope, decodeEnvelope, gcmDecrypt };

/** KEK maître depuis l'env (jamais affichée). base64 (32 o) ou hex (64 car.). */
export function parseMasterKey(): Buffer | null {
  const v = (process.env.ENCRYPTION_MASTER_KEY ?? "").trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{64}$/.test(v)) return Buffer.from(v, "hex");
  try { const b = Buffer.from(v, "base64"); if (b.length === 32) return b; } catch { /* ignore */ }
  return null;
}

function dataDir(): string {
  const configured = (process.env.DATA_DIR ?? process.env.APP_DATA_DIR ?? "").trim();
  return configured || path.join(process.cwd(), ".data");
}
function filesDir(): string {
  const v = (process.env.FILES_DIR ?? "").trim();
  return v || path.join(dataDir(), "files");
}
function legacyMedia(category: string): string {
  return path.join(dataDir(), "media", category);
}

/** Chemins candidats (nouvelle arbo files/ puis héritée media/) d'un fichier. */
function candidates(category: string, filename: string): string[] {
  const out = [path.join(filesDir(), category, filename)];
  if (category === "originals" || category === "thumbnails") out.push(path.join(legacyMedia(category), filename));
  return out;
}
function resolveExisting(category: string, filename: string): string | null {
  for (const c of candidates(category, filename)) {
    try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
  }
  return null;
}

export type DocFile = { kind: "original" | "thumbnail" | "preview" | "page"; path: string };

/** Tous les fichiers binaires existants associés à un document. */
export function filesForDocument(id: number, storedFilename: string | null): DocFile[] {
  const out: DocFile[] = [];
  if (storedFilename) {
    const p = resolveExisting("originals", storedFilename);
    if (p) out.push({ kind: "original", path: p });
  }
  const thumb = resolveExisting("thumbnails", `${id}.webp`);
  if (thumb) out.push({ kind: "thumbnail", path: thumb });
  const prev = resolveExisting("previews", `${id}.webp`);
  if (prev) out.push({ kind: "preview", path: prev });
  // pages : files/pages/<id>/*.webp
  const pagesDir = path.join(filesDir(), "pages", String(id));
  try {
    if (fs.existsSync(pagesDir)) {
      for (const f of fs.readdirSync(pagesDir)) {
        if (f.endsWith(".webp")) out.push({ kind: "page", path: path.join(pagesDir, f) });
      }
    }
  } catch { /* ignore */ }
  return out;
}

export type DocRow = { id: number; tenantId: string | null; storedFilename: string | null };

/** Liste des documents (id, tenant, fichier source) depuis la base. */
export async function loadDocuments(client: Client): Promise<DocRow[]> {
  const { rows } = await client.query("SELECT id, tenant_id, raw FROM documents ORDER BY id");
  return rows.map((r) => {
    const raw = (r.raw ?? {}) as Record<string, unknown>;
    return {
      id: Number(r.id),
      tenantId: r.tenant_id == null ? null : String(r.tenant_id),
      storedFilename: typeof raw.storedFilename === "string" ? (raw.storedFilename as string) : null,
    };
  });
}

/** DEK déchiffrées par tenant (depuis tenant_encryption_keys + KEK). */
export async function loadTenantDeks(client: Client, kek: Buffer): Promise<Map<string, Buffer>> {
  const map = new Map<string, Buffer>();
  let rows: Array<{ tenant_id: string; wrapped_dek: string }> = [];
  try {
    rows = (await client.query("SELECT tenant_id, wrapped_dek FROM tenant_encryption_keys")).rows as typeof rows;
  } catch { return map; }
  for (const r of rows) {
    try {
      const dek = unwrapKey(kek, String(r.wrapped_dek), `tenant-dek:${r.tenant_id}`);
      if (dek.length === 32) map.set(String(r.tenant_id), dek);
    } catch { /* clé non déwrappable → tenant ignoré */ }
  }
  return map;
}

/** Premiers octets d'un fichier (pour tester l'en-tête d'enveloppe sans tout lire). */
export function readHeader(file: string, n = 8): Buffer {
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}
