import "server-only";

import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { isMultiTenantEnabled } from "./tenant-config";
import type { Membership, Tenant, TenantRole, TenantSettings } from "./types";

/* ────────────────────────────────────────────────────────────────────────
   Stores du socle multi-tenant — Postgres UNIQUEMENT (fonctionnalité SaaS).
   En mode mono-tenant (MULTI_TENANT désactivé), ces fonctions ne sont jamais
   appelées (getCurrentTenant renvoie le tenant par défaut sans accès base).
   Lecture seule ici (Phase 1) ; l'écriture initiale se fait via le script
   scripts/saas/create-initial-tenant.mjs.
   ──────────────────────────────────────────────────────────────────────── */

function assertPostgres(): void {
  if (!postgresActive()) {
    throw new Error(
      "Multi-tenant requiert PostgreSQL (DATABASE_URL + mode postgres). Stores tenant indisponibles.",
    );
  }
}

function iso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rowToTenant(r: Record<string, unknown>): Tenant {
  return {
    id: String(r.id),
    name: (r.name as string | null) ?? null,
    slug: String(r.slug ?? r.id),
    plan: (r.plan as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function rowToMembership(r: Record<string, unknown>): Membership {
  return {
    id: String(r.id),
    userId: Number(r.user_id),
    tenantId: String(r.tenant_id),
    role: (String(r.role) as TenantRole) || "member",
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

function rowToSettings(r: Record<string, unknown>): TenantSettings {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    maxUsers: r.max_users == null ? null : Number(r.max_users),
    maxDocuments: r.max_documents == null ? null : Number(r.max_documents),
    maxStorageMb: r.max_storage_mb == null ? null : Number(r.max_storage_mb),
    aiEnabled: r.ai_enabled !== false,
    ocrEnabled: r.ocr_enabled !== false,
    emailImportEnabled: r.email_import_enabled !== false,
    onlyofficeEnabled: r.onlyoffice_enabled !== false,
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenants WHERE id = $1 LIMIT 1", [id]);
  return rows.length ? rowToTenant(rows[0]) : null;
}

export async function getTenantBySlug(slug: string): Promise<Tenant | null> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenants WHERE slug = $1 LIMIT 1", [slug]);
  return rows.length ? rowToTenant(rows[0]) : null;
}

export async function listTenants(): Promise<Tenant[]> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenants ORDER BY created_at, id");
  return rows.map(rowToTenant);
}

/** Nombre d'adhésions (utilisateurs) d'un tenant. */
export async function countTenantMembers(tenantId: string): Promise<number> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM memberships WHERE tenant_id = $1",
      [tenantId],
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export type TenantMember = {
  userId: number;
  role: TenantRole;
  username: string | null;
  email: string | null;
};

/** Membres d'un tenant enrichis du username/email (jamais de secret). */
export async function listTenantMembersWithUser(tenantId: string): Promise<TenantMember[]> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query(
    `SELECT m.user_id, m.role, u.username, u.email
       FROM memberships m
       LEFT JOIN users u ON u.id = m.user_id
      WHERE m.tenant_id = $1
      ORDER BY m.created_at, m.id`,
    [tenantId],
  );
  return rows.map((r) => ({
    userId: Number(r.user_id),
    role: (String(r.role) as TenantRole) || "member",
    username: (r.username as string | null) ?? null,
    email: (r.email as string | null) ?? null,
  }));
}

export type RecentDocument = { id: number; title: string | null; created: string | null };

/** Derniers documents (non supprimés) d'un tenant — pour le diagnostic superuser. */
export async function getRecentDocuments(tenantId: string, limit = 10): Promise<RecentDocument[]> {
  assertPostgres();
  const pool = await getPool();
  try {
    const { rows } = await pool.query(
      `SELECT raw FROM documents WHERE tenant_id = $1 ORDER BY id DESC LIMIT $2`,
      [tenantId, limit],
    );
    return rows
      .map((r) => (r.raw ?? {}) as Record<string, unknown>)
      .filter((d) => d.deleted !== true)
      .map((d) => ({
        id: Number(d.id),
        title: (d.title as string | null) ?? null,
        created: (d.created as string | null) ?? (d.createdDate as string | null) ?? null,
      }));
  } catch {
    return [];
  }
}

/** Adhésions d'un utilisateur (tous tenants confondus). */
export async function listMembershipsForUser(userId: number): Promise<Membership[]> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM memberships WHERE user_id = $1 ORDER BY created_at, id",
    [userId],
  );
  return rows.map(rowToMembership);
}

/** Adhésion précise (utilisateur ↔ tenant), ou null. */
export async function getMembership(userId: number, tenantId: string): Promise<Membership | null> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query(
    "SELECT * FROM memberships WHERE user_id = $1 AND tenant_id = $2 LIMIT 1",
    [userId, tenantId],
  );
  return rows.length ? rowToMembership(rows[0]) : null;
}

export async function getTenantSettings(tenantId: string): Promise<TenantSettings | null> {
  assertPostgres();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenant_settings WHERE tenant_id = $1 LIMIT 1", [
    tenantId,
  ]);
  return rows.length ? rowToSettings(rows[0]) : null;
}

export type TenantCounts = {
  documents: number;
  tags: number;
  correspondents: number;
  documentTypes: number;
  folders: number;
};

/**
 * Compte les lignes rattachées au tenant `tenantId` par table métier scopée.
 * Tolérant : une table/colonne absente compte 0 (jamais d'exception fatale).
 */
export async function getTenantCounts(tenantId: string): Promise<TenantCounts> {
  assertPostgres();
  const pool = await getPool();
  async function countOf(table: string): Promise<number> {
    try {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id = $1`,
        [tenantId],
      );
      return Number(rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }
  const [documents, tags, correspondents, documentTypes, folders] = await Promise.all([
    countOf("documents"),
    countOf("tags"),
    countOf("correspondents"),
    countOf("document_types"),
    countOf("folders"),
  ]);
  return { documents, tags, correspondents, documentTypes, folders };
}

/**
 * Tenant d'un document (pour rendre les jobs de fond tenant-aware), ou null si
 * mono-tenant / hors postgres / introuvable / colonne absente. Ne lève jamais.
 */
export async function getDocumentTenantId(documentId: number): Promise<string | null> {
  if (!isMultiTenantEnabled() || !postgresActive()) return null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT tenant_id FROM documents WHERE id = $1 LIMIT 1", [documentId]);
    return (rows[0]?.tenant_id as string | null) ?? null;
  } catch {
    return null;
  }
}

export type UnscopedCounts = {
  documents: number;
  tags: number;
  correspondents: number;
  documentTypes: number;
  folders: number;
  documentCorrespondents: number;
  documentFiles: number;
};

/** Compte les lignes métier SANS tenant_id (orphelines) — diagnostic anti-fuite. */
export async function getUnscopedCounts(): Promise<UnscopedCounts> {
  assertPostgres();
  const pool = await getPool();
  async function nullOf(table: string): Promise<number> {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE tenant_id IS NULL`);
      return Number(rows[0]?.n ?? 0);
    } catch {
      return 0;
    }
  }
  const [documents, tags, correspondents, documentTypes, folders, documentCorrespondents, documentFiles] =
    await Promise.all([
      nullOf("documents"),
      nullOf("tags"),
      nullOf("correspondents"),
      nullOf("document_types"),
      nullOf("folders"),
      nullOf("document_correspondents"),
      nullOf("document_files"),
    ]);
  return { documents, tags, correspondents, documentTypes, folders, documentCorrespondents, documentFiles };
}
