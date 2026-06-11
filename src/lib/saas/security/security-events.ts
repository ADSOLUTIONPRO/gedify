import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";

/* Journal de sécurité SaaS. Best-effort : ne lève JAMAIS (ne doit pas casser
   un flux métier). Stocke des événements riches (séparé de l'audit générique). */

export type Severity = "info" | "warning" | "critical";
export type EventStatus = "open" | "reviewed" | "ignored" | "resolved";

export type SecurityEventInput = {
  eventType: string;
  category?: string;
  severity?: Severity;
  tenantId?: string | null;
  userId?: number | null;
  actorUserId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  message: string;
  metadata?: Record<string, unknown> | null;
};

let ddlEnsured = false;
const DDL = `
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT, user_id INTEGER, actor_user_id INTEGER,
  event_type TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'info',
  severity TEXT NOT NULL DEFAULT 'info',
  ip_address TEXT, user_agent TEXT, target_type TEXT, target_id TEXT,
  message TEXT NOT NULL, metadata JSONB, status TEXT NOT NULL DEFAULT 'open',
  reviewed_at TIMESTAMPTZ, reviewed_by_user_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS security_events_tenant_idx ON security_events(tenant_id);`;

async function ensureTable() {
  if (ddlEnsured) return;
  const pool = await getPool();
  await pool.query(DDL);
  ddlEnsured = true;
}

/** Enregistre un événement de sécurité (best-effort). */
export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  if (!postgresActive()) return;
  try {
    await ensureTable();
    const pool = await getPool();
    await pool.query(
      `INSERT INTO security_events
         (id, tenant_id, user_id, actor_user_id, event_type, category, severity, ip_address, user_agent, target_type, target_id, message, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        randomUUID(), input.tenantId ?? null, input.userId ?? null, input.actorUserId ?? null,
        input.eventType, input.category ?? "info", input.severity ?? "info",
        input.ipAddress ?? null, input.userAgent ?? null, input.targetType ?? null, input.targetId ?? null,
        input.message, input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch { /* best-effort : ne jamais bloquer */ }
}

export async function logTenantSecurityEvent(tenantId: string, eventType: string, message: string, extra: Partial<SecurityEventInput> = {}): Promise<void> {
  await logSecurityEvent({ ...extra, tenantId, eventType, message, category: extra.category ?? "tenant" });
}
export async function logUserSecurityEvent(userId: number, eventType: string, message: string, extra: Partial<SecurityEventInput> = {}): Promise<void> {
  await logSecurityEvent({ ...extra, userId, eventType, message, category: extra.category ?? "auth" });
}
export async function logCrossTenantAccessAttempt(actorUserId: number | null, attemptedTenantId: string, detail: string): Promise<void> {
  await logSecurityEvent({ eventType: "cross_tenant_access_attempt", category: "access", severity: "critical", actorUserId, tenantId: attemptedTenantId, message: `Tentative d'accès cross-tenant : ${detail}` });
}
export async function logSensitiveAdminAction(actorUserId: number | null, eventType: string, message: string, extra: Partial<SecurityEventInput> = {}): Promise<void> {
  await logSecurityEvent({ ...extra, actorUserId, eventType, message, category: extra.category ?? "system", severity: extra.severity ?? "warning" });
}

/* ── Lecture / dashboard ──────────────────────────────────────────────────── */

export type SecurityDashboardStats = {
  loginSuccess24h: number; loginFailed24h: number; loginFailed7d: number;
  criticalOpen: number; warningOpen: number; openTotal: number;
  tenantsSuspended: number; crossTenant7d: number;
};

export async function getSecurityDashboardStats(): Promise<SecurityDashboardStats> {
  const empty: SecurityDashboardStats = { loginSuccess24h: 0, loginFailed24h: 0, loginFailed7d: 0, criticalOpen: 0, warningOpen: 0, openTotal: 0, tenantsSuspended: 0, crossTenant7d: 0 };
  if (!postgresActive()) return empty;
  try {
    await ensureTable();
    const pool = await getPool();
    const n = async (sql: string) => Number((await pool.query(sql)).rows[0]?.n ?? 0);
    return {
      loginSuccess24h: await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='login_success' AND created_at > now()-interval '24 hours'"),
      loginFailed24h: await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='login_failed' AND created_at > now()-interval '24 hours'"),
      loginFailed7d: await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='login_failed' AND created_at > now()-interval '7 days'"),
      criticalOpen: await n("SELECT COUNT(*)::int n FROM security_events WHERE severity='critical' AND status='open'"),
      warningOpen: await n("SELECT COUNT(*)::int n FROM security_events WHERE severity='warning' AND status='open'"),
      openTotal: await n("SELECT COUNT(*)::int n FROM security_events WHERE status='open'"),
      tenantsSuspended: await n("SELECT COUNT(*)::int n FROM tenants WHERE status='suspended'").catch(() => 0),
      crossTenant7d: await n("SELECT COUNT(*)::int n FROM security_events WHERE event_type='cross_tenant_access_attempt' AND created_at > now()-interval '7 days'"),
    };
  } catch {
    return empty;
  }
}

export type SecurityEventRow = Record<string, unknown> & { id: string };

export type EventFilter = { tenantId?: string; severity?: string; status?: string; eventType?: string; limit?: number };

export async function getSecurityEvents(filter: EventFilter = {}): Promise<SecurityEventRow[]> {
  if (!postgresActive()) return [];
  try {
    await ensureTable();
    const pool = await getPool();
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (clause: string, val: unknown) => { params.push(val); where.push(clause.replace("$?", `$${params.length}`)); };
    if (filter.tenantId) add("tenant_id = $?", filter.tenantId);
    if (filter.severity) add("severity = $?", filter.severity);
    if (filter.status) add("status = $?", filter.status);
    if (filter.eventType) add("event_type = $?", filter.eventType);
    params.push(Math.min(filter.limit ?? 200, 500));
    const sql = `SELECT * FROM security_events ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT $${params.length}`;
    const { rows } = await pool.query(sql, params);
    return rows as SecurityEventRow[];
  } catch {
    return [];
  }
}

export async function markSecurityEventReviewed(id: string, reviewerUserId: number, status: EventStatus = "reviewed"): Promise<void> {
  if (!postgresActive()) return;
  try {
    const pool = await getPool();
    await pool.query("UPDATE security_events SET status=$2, reviewed_at=now(), reviewed_by_user_id=$3 WHERE id=$1", [id, status, reviewerUserId]);
  } catch { /* ignore */ }
}

/** Détecte une activité suspecte simple (trop d'échecs login récents). */
export async function detectSuspiciousActivity(): Promise<{ ip: string; count: number }[]> {
  if (!postgresActive()) return [];
  try {
    await ensureTable();
    const pool = await getPool();
    const { rows } = await pool.query(
      `SELECT ip_address AS ip, COUNT(*)::int n FROM security_events
        WHERE event_type='login_failed' AND ip_address IS NOT NULL AND created_at > now()-interval '1 hour'
        GROUP BY ip_address HAVING COUNT(*) >= 5 ORDER BY n DESC LIMIT 20`,
    );
    return rows.map((r) => ({ ip: String(r.ip), count: Number(r.n) }));
  } catch {
    return [];
  }
}
