import "server-only";

import { randomUUID, randomBytes, createHash } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { getTenantById, listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { checkUserQuota } from "@/lib/saas/quota";
import { isFeatureEnabled } from "@/lib/saas/entitlements";
import { enqueueMail } from "@/lib/saas/mailing/queue";
import { getAppBaseUrl } from "@/lib/saas/mailing/config";
import type { TenantRole } from "@/lib/tenant/types";

/* Invitations à rejoindre un tenant. Token aléatoire long ; SEUL son hash est
   stocké. Le token en clair n'existe qu'au moment de la création (lien email). */

export type TenantInvitation = {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  status: "pending" | "accepted" | "expired" | "canceled";
  invitedByUserId: number | null;
  acceptedByUserId: number | null;
  expiresAt: string | null;
  acceptedAt: string | null;
  lastSentAt: string | null;
  sendCount: number;
  message: string | null;
  createdAt: string | null;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
function iso(v: unknown): string | null { return v ? new Date(String(v)).toISOString() : null; }
function rowTo(r: Record<string, unknown>): TenantInvitation {
  return {
    id: String(r.id), tenantId: String(r.tenant_id), email: String(r.email), role: (String(r.role) as TenantRole),
    status: (String(r.status) as TenantInvitation["status"]), invitedByUserId: r.invited_by_user_id == null ? null : Number(r.invited_by_user_id),
    acceptedByUserId: r.accepted_by_user_id == null ? null : Number(r.accepted_by_user_id),
    expiresAt: iso(r.expires_at), acceptedAt: iso(r.accepted_at), lastSentAt: iso(r.last_sent_at),
    sendCount: Number(r.send_count ?? 0), message: (r.message as string) ?? null, createdAt: iso(r.created_at),
  };
}

const DDL = `
CREATE TABLE IF NOT EXISTS tenant_invitations (
  id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'pending',
  token_hash TEXT NOT NULL, invited_by_user_id INTEGER, accepted_by_user_id INTEGER,
  expires_at TIMESTAMPTZ NOT NULL, accepted_at TIMESTAMPTZ, canceled_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ, send_count INTEGER NOT NULL DEFAULT 0, message TEXT, metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tenant_invitations_tenant_idx ON tenant_invitations(tenant_id);`;
let ddlEnsured = false;
async function ensureTable() { if (ddlEnsured) return; const pool = await getPool(); await pool.query(DDL); ddlEnsured = true; }

const DURATIONS: Record<string, number> = { "24h": 1, "7d": 7, "14d": 14, "30d": 30 };

/** Vérifie qu'on peut inviter un membre (feature + quota). Lève sinon. */
export async function assertCanInviteMember(tenantId: string): Promise<void> {
  if (!(await isFeatureEnabled(tenantId, "user_invitations_enabled"))) {
    throw new Error("Les invitations ne sont pas incluses dans l'offre de cet espace.");
  }
  // Quota : membres actuels + invitations pending + 1 ne doit pas dépasser max_users.
  await ensureTable();
  const pool = await getPool();
  const pending = Number((await pool.query("SELECT COUNT(*)::int n FROM tenant_invitations WHERE tenant_id=$1 AND status='pending'", [tenantId])).rows[0]?.n ?? 0);
  const quota = await checkUserQuota(tenantId, pending + 1);
  if (!quota.ok) throw new Error(quota.message ?? "Limite d'utilisateurs atteinte pour cette offre.");
}

async function sendInvitationEmail(inv: TenantInvitation, token: string, inviterName: string | null): Promise<void> {
  const tenant = await getTenantById(inv.tenantId).catch(() => null);
  const inviteUrl = `${getAppBaseUrl()}/invite/${token}`;
  await enqueueMail({
    to: inv.email, templateKey: "account.invitation", category: "account", tenantId: inv.tenantId,
    vars: { tenantName: tenant?.name ?? inv.tenantId, inviterName: inviterName ?? "L'équipe", inviteUrl },
  });
}

export type CreateInvitationInput = {
  tenantId: string;
  email: string;
  role: TenantRole;
  duration?: string;
  message?: string | null;
  invitedByUserId?: number | null;
  inviterName?: string | null;
  sendEmail?: boolean;
};

export async function createTenantInvitation(input: CreateInvitationInput): Promise<{ id: string; token: string }> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  await ensureTable();
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Email invalide.");
  const pool = await getPool();

  // Déjà membre ?
  const members = await listTenantMembersWithUser(input.tenantId);
  if (members.some((m) => (m.email ?? "").toLowerCase() === email)) throw new Error("Cet email est déjà membre de l'espace.");
  // Invitation pending existante ?
  const existing = await pool.query("SELECT 1 FROM tenant_invitations WHERE tenant_id=$1 AND lower(email)=$2 AND status='pending' LIMIT 1", [input.tenantId, email]);
  if (existing.rows[0]) throw new Error("Une invitation est déjà en attente pour cet email (utilisez « Renvoyer »).");

  await assertCanInviteMember(input.tenantId);

  const id = randomUUID();
  const token = randomBytes(24).toString("hex");
  const days = DURATIONS[input.duration ?? "7d"] ?? 7;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  await pool.query(
    `INSERT INTO tenant_invitations(id, tenant_id, email, role, status, token_hash, invited_by_user_id, expires_at, last_sent_at, send_count, message)
     VALUES ($1,$2,$3,$4,'pending',$5,$6,$7, now(), 1, $8)`,
    [id, input.tenantId, email, input.role, hashToken(token), input.invitedByUserId ?? null, expiresAt, input.message ?? null],
  );
  await recordAudit({ action: "tenant_invitation_created", target: `${input.tenantId}:${email}`, details: `role=${input.role}` });
  const inv = rowTo((await pool.query("SELECT * FROM tenant_invitations WHERE id=$1", [id])).rows[0]);
  if (input.sendEmail !== false) await sendInvitationEmail(inv, token, input.inviterName ?? null);
  try {
    const { logTenantSecurityEvent } = await import("@/lib/saas/security/security-events");
    await logTenantSecurityEvent(input.tenantId, "tenant_member_invited", `Invitation envoyée à ${email} (${input.role})`, { actorUserId: input.invitedByUserId ?? null, category: "tenant" });
  } catch { /* best-effort */ }
  return { id, token };
}

export async function resendTenantInvitation(id: string, inviterName?: string | null): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const row = (await pool.query("SELECT * FROM tenant_invitations WHERE id=$1 AND status='pending' LIMIT 1", [id])).rows[0];
  if (!row) throw new Error("Invitation introuvable ou déjà traitée.");
  // Nouveau token à chaque renvoi (l'ancien lien est invalidé).
  const token = randomBytes(24).toString("hex");
  await pool.query("UPDATE tenant_invitations SET token_hash=$2, last_sent_at=now(), send_count=send_count+1, updated_at=now() WHERE id=$1", [id, hashToken(token)]);
  const inv = rowTo({ ...row, token_hash: undefined });
  await sendInvitationEmail(inv, token, inviterName ?? null);
  await recordAudit({ action: "tenant_invitation_resent", target: `${inv.tenantId}:${inv.email}` });
}

export async function cancelTenantInvitation(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE tenant_invitations SET status='canceled', canceled_at=now(), updated_at=now() WHERE id=$1 AND status='pending'", [id]);
  await recordAudit({ action: "tenant_invitation_canceled", target: id });
}

export async function getInvitationByToken(token: string): Promise<TenantInvitation | null> {
  if (!postgresActive()) return null;
  await ensureTable();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenant_invitations WHERE token_hash=$1 LIMIT 1", [hashToken(token)]);
  return rows[0] ? rowTo(rows[0]) : null;
}

/** Marque une invitation acceptée + crée le membership (via membership-admin). */
export async function acceptTenantInvitation(token: string, userId: number): Promise<{ tenantId: string } | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const inv = await getInvitationByToken(token);
  if (!inv) throw new Error("Invitation introuvable.");
  if (inv.status !== "pending") throw new Error("Cette invitation n'est plus valable.");
  if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
    await pool.query("UPDATE tenant_invitations SET status='expired', updated_at=now() WHERE id=$1", [inv.id]);
    throw new Error("Cette invitation a expiré.");
  }
  const { addOrUpdateMembership } = await import("@/lib/tenant/membership-admin");
  await addOrUpdateMembership(inv.tenantId, userId, inv.role);
  await pool.query("UPDATE tenant_invitations SET status='accepted', accepted_at=now(), accepted_by_user_id=$2, updated_at=now() WHERE id=$1", [inv.id, userId]);
  await recordAudit({ action: "tenant_invitation_accepted", target: `${inv.tenantId}:${inv.email}`, details: `user=${userId}` });
  return { tenantId: inv.tenantId };
}

export async function getInvitationsForTenant(tenantId: string): Promise<TenantInvitation[]> {
  if (!postgresActive()) return [];
  await ensureTable();
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM tenant_invitations WHERE tenant_id=$1 ORDER BY created_at DESC", [tenantId]);
  return rows.map(rowTo);
}

export async function listAllInvitations(status?: string): Promise<TenantInvitation[]> {
  if (!postgresActive()) return [];
  await ensureTable();
  const pool = await getPool();
  const { rows } = status
    ? await pool.query("SELECT * FROM tenant_invitations WHERE status=$1 ORDER BY created_at DESC LIMIT 500", [status])
    : await pool.query("SELECT * FROM tenant_invitations ORDER BY created_at DESC LIMIT 500");
  return rows.map(rowTo);
}

/** Passe les invitations pending échues en `expired`. Renvoie le nombre traité. */
export async function expireOldInvitations(): Promise<number> {
  if (!postgresActive()) return 0;
  await ensureTable();
  const pool = await getPool();
  const { rowCount } = await pool.query("UPDATE tenant_invitations SET status='expired', updated_at=now() WHERE status='pending' AND expires_at < now()");
  return rowCount ?? 0;
}
