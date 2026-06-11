import "server-only";

import { randomUUID, randomBytes } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { getMasterKey } from "./master-key";
import { wrapKey, unwrapKey } from "./envelope";

/* Gestion des clés de données (DEK) par tenant.
   - La DEK (32 octets) est générée une fois par tenant.
   - Elle est stockée WRAPPED (chiffrée par la KEK maître), jamais en clair.
   - En mémoire de process, on garde la DEK déchiffrée en cache (jamais persistée). */

const DDL = `
CREATE TABLE IF NOT EXISTS tenant_encryption_keys (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT UNIQUE NOT NULL,
  wrapped_dek TEXT NOT NULL,
  algo        TEXT NOT NULL DEFAULT 'aes-256-gcm',
  key_version INTEGER NOT NULL DEFAULT 1,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

let ddlEnsured = false;
async function ensureTable() {
  if (ddlEnsured) return;
  const pool = await getPool();
  await pool.query(DDL);
  ddlEnsured = true;
}

// Cache process-local des DEK déchiffrées (Buffer 32 octets). Jamais persisté.
const dekCache = new Map<string, Buffer>();

function aadFor(tenantId: string): string {
  return `tenant-dek:${tenantId}`;
}

/** Crée (si absente) la clé du tenant. Renvoie true si une clé a été créée. */
export async function ensureTenantKey(tenantId: string): Promise<boolean> {
  const kek = getMasterKey();
  if (!kek) throw new Error("ENCRYPTION_MASTER_KEY absente ou invalide.");
  if (!postgresActive()) throw new Error("Postgres requis pour les clés de chiffrement.");
  await ensureTable();
  const pool = await getPool();
  const existing = await pool.query("SELECT 1 FROM tenant_encryption_keys WHERE tenant_id=$1 LIMIT 1", [tenantId]);
  if (existing.rows[0]) return false;

  const dek = randomBytes(32);
  const wrapped = wrapKey(kek, dek, aadFor(tenantId));
  try {
    await pool.query(
      "INSERT INTO tenant_encryption_keys(id, tenant_id, wrapped_dek) VALUES ($1,$2,$3) ON CONFLICT (tenant_id) DO NOTHING",
      [randomUUID(), tenantId, wrapped],
    );
  } finally {
    dek.fill(0); // efface la copie locale en clair
  }
  dekCache.delete(tenantId);
  return true;
}

/** Récupère la DEK déchiffrée du tenant (cache mémoire). Lève si indisponible. */
export async function getTenantDek(tenantId: string): Promise<Buffer> {
  const cached = dekCache.get(tenantId);
  if (cached) return cached;
  const kek = getMasterKey();
  if (!kek) throw new Error("ENCRYPTION_MASTER_KEY absente ou invalide.");
  if (!postgresActive()) throw new Error("Postgres requis pour les clés de chiffrement.");
  await ensureTable();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT wrapped_dek FROM tenant_encryption_keys WHERE tenant_id=$1 LIMIT 1", [tenantId]);
  if (!rows[0]) throw new Error(`Aucune clé de chiffrement pour le tenant ${tenantId}.`);
  const dek = unwrapKey(kek, String(rows[0].wrapped_dek), aadFor(tenantId));
  dekCache.set(tenantId, dek);
  return dek;
}

/** Le tenant possède-t-il déjà une clé ? (lecture seule, ne crée rien) */
export async function hasTenantKey(tenantId: string): Promise<boolean> {
  if (!postgresActive()) return false;
  try {
    await ensureTable();
    const pool = await getPool();
    const { rows } = await pool.query("SELECT 1 FROM tenant_encryption_keys WHERE tenant_id=$1 LIMIT 1", [tenantId]);
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

/** Liste des tenant_id disposant d'une clé. */
export async function listTenantsWithKey(): Promise<string[]> {
  if (!postgresActive()) return [];
  try {
    await ensureTable();
    const pool = await getPool();
    const { rows } = await pool.query("SELECT tenant_id FROM tenant_encryption_keys ORDER BY tenant_id");
    return rows.map((r) => String(r.tenant_id));
  } catch {
    return [];
  }
}

/** Vide le cache mémoire des DEK (tests / rotation). */
export function clearDekCache(): void {
  for (const v of dekCache.values()) v.fill(0);
  dekCache.clear();
}
