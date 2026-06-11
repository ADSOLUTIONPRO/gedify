import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { listTenantMembersWithUser } from "./tenant-store";
import { assertNotLastOwner } from "./permissions";
import type { TenantRole } from "./types";

/* Mutations d'adhésion (memberships) côté admin. Garde-fous : dernier owner
   protégé, rôles valides. Journalise audit + sécurité (best-effort). */

const ROLES: TenantRole[] = ["owner", "admin", "member", "viewer"];
function assertRole(role: string): asserts role is TenantRole {
  if (!ROLES.includes(role as TenantRole)) throw new Error(`Rôle invalide : ${role}`);
}
function assertPg() { if (!postgresActive()) throw new Error("Postgres requis."); }

/** Ajoute (ou met à jour le rôle d') un utilisateur dans un tenant. */
export async function addOrUpdateMembership(tenantId: string, userId: number, role: TenantRole, actor?: string): Promise<void> {
  assertPg();
  assertRole(role);
  const pool = await getPool();
  const existing = await pool.query("SELECT id, role FROM memberships WHERE tenant_id=$1 AND user_id=$2 LIMIT 1", [tenantId, userId]);
  if (existing.rows[0]) {
    const oldRole = String(existing.rows[0].role);
    if (oldRole === "owner" && role !== "owner") {
      const members = await listTenantMembersWithUser(tenantId);
      assertNotLastOwner(members, "owner");
    }
    await pool.query("UPDATE memberships SET role=$3, updated_at=now() WHERE tenant_id=$1 AND user_id=$2", [tenantId, userId, role]);
    await recordAudit({ action: "tenant_member_role_changed", target: `${tenantId}:${userId}`, details: `${oldRole}→${role}`, user: actor });
  } else {
    await pool.query("INSERT INTO memberships(id, user_id, tenant_id, role) VALUES ($1,$2,$3,$4)", [randomUUID(), userId, tenantId, role]);
    await recordAudit({ action: "tenant_member_invited", target: `${tenantId}:${userId}`, details: `role=${role}`, user: actor });
  }
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(tenantId, "membership_created", `Membre ${userId} → ${role}`, { userId, category: "tenant" });
  } catch { /* best-effort */ }
}

/** Retire un utilisateur d'un tenant (jamais le dernier owner). */
export async function removeMembership(tenantId: string, userId: number, actor?: string): Promise<void> {
  assertPg();
  const pool = await getPool();
  const members = await listTenantMembersWithUser(tenantId);
  const target = members.find((m) => m.userId === userId);
  if (!target) return;
  assertNotLastOwner(members, target.role);
  await pool.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tenantId, userId]);
  await recordAudit({ action: "tenant_member_removed", target: `${tenantId}:${userId}`, user: actor });
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(tenantId, "membership_removed", `Membre ${userId} retiré`, { userId, category: "tenant", severity: "warning" });
  } catch { /* best-effort */ }
}

/** Transfère le rôle owner à un autre membre (l'ancien owner devient admin). */
export async function transferOwnership(tenantId: string, newOwnerUserId: number, actor?: string): Promise<void> {
  assertPg();
  const pool = await getPool();
  const members = await listTenantMembersWithUser(tenantId);
  if (!members.find((m) => m.userId === newOwnerUserId)) throw new Error("Le nouvel owner doit déjà être membre.");
  await pool.query("UPDATE memberships SET role='admin', updated_at=now() WHERE tenant_id=$1 AND role='owner'", [tenantId]);
  await pool.query("UPDATE memberships SET role='owner', updated_at=now() WHERE tenant_id=$1 AND user_id=$2", [tenantId, newOwnerUserId]);
  await recordAudit({ action: "tenant_owner_transferred", target: tenantId, details: `→ user ${newOwnerUserId}`, user: actor });
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(tenantId, "tenant_owner_transferred", `Propriété transférée à ${newOwnerUserId}`, { userId: newOwnerUserId, category: "tenant", severity: "warning" });
  } catch { /* best-effort */ }
}
