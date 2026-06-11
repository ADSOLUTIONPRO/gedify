import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { computeSlaDue } from "./sla";

/* Conversations de support, strictement cloisonnées par tenant. Toute lecture
   côté client DOIT passer par *ForTenant (vérification tenant_id). */

export type SupportConversation = {
  id: string;
  tenantId: string;
  ref: string;
  subject: string;
  status: string;
  channel: string;
  priority: string;
  category: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  assignedToUserId: number | null;
  lastMessageAt: string | null;
  customerUnread: number;
  agentUnread: number;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaDueAt: string | null;
  slaBreached: boolean;
  ratingScore: number | null;
  ratingComment: string | null;
  createdAt: string | null;
};

export type SupportMessage = {
  id: string;
  conversationId: string;
  tenantId: string;
  authorType: string;
  authorUserId: number | null;
  authorName: string | null;
  body: string;
  isInternal: boolean;
  createdAt: string | null;
};

function iso(v: unknown): string | null {
  return v ? (v instanceof Date ? v.toISOString() : String(v)) : null;
}

function rowToConv(r: Record<string, unknown>): SupportConversation {
  return {
    id: String(r.id), tenantId: String(r.tenant_id), ref: String(r.ref), subject: String(r.subject ?? ""),
    status: String(r.status ?? "open"), channel: String(r.channel ?? "chat"), priority: String(r.priority ?? "normal"),
    category: (r.category as string) ?? null,
    createdByUserId: r.created_by_user_id == null ? null : Number(r.created_by_user_id),
    createdByName: (r.created_by_name as string) ?? null,
    assignedToUserId: r.assigned_to_user_id == null ? null : Number(r.assigned_to_user_id),
    lastMessageAt: iso(r.last_message_at), customerUnread: Number(r.customer_unread ?? 0),
    agentUnread: Number(r.agent_unread ?? 0), firstResponseAt: iso(r.first_response_at),
    resolvedAt: iso(r.resolved_at), slaDueAt: iso(r.sla_due_at), slaBreached: r.sla_breached === true,
    ratingScore: r.rating_score == null ? null : Number(r.rating_score),
    ratingComment: (r.rating_comment as string) ?? null, createdAt: iso(r.created_at),
  };
}

function rowToMsg(r: Record<string, unknown>): SupportMessage {
  return {
    id: String(r.id), conversationId: String(r.conversation_id), tenantId: String(r.tenant_id),
    authorType: String(r.author_type), authorUserId: r.author_user_id == null ? null : Number(r.author_user_id),
    authorName: (r.author_name as string) ?? null, body: String(r.body ?? ""),
    isInternal: r.is_internal === true, createdAt: iso(r.created_at),
  };
}

async function nextRef(): Promise<string> {
  const pool = await getPool();
  const { rows } = await pool.query("SELECT COUNT(*)::int n FROM support_conversations");
  const n = Number(rows[0]?.n ?? 0) + 1;
  return `SUP-${String(n).padStart(4, "0")}`;
}

export type CreateConversationInput = {
  tenantId: string;
  subject: string;
  body: string;
  createdByUserId?: number | null;
  createdByName?: string | null;
  channel?: string;
  priority?: string;
  category?: string | null;
};

/** Crée une conversation + son premier message client. Renvoie l'id. */
export async function createConversation(input: CreateConversationInput): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const id = randomUUID();
  const priority = input.priority ?? "normal";
  const channel = input.channel ?? "chat";
  const slaDue = channel === "ai" ? null : await computeSlaDue(priority);

  // Génère une ref unique (retry en cas de collision rare).
  let ref = await nextRef();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await pool.query(
        `INSERT INTO support_conversations
           (id, tenant_id, ref, subject, status, channel, priority, category, created_by_user_id, created_by_name,
            last_message_at, agent_unread, customer_unread, sla_due_at)
         VALUES ($1,$2,$3,$4,'open',$5,$6,$7,$8,$9, now(), 1, 0, $10)`,
        [id, input.tenantId, ref, input.subject, channel, priority, input.category ?? null,
         input.createdByUserId ?? null, input.createdByName ?? null, slaDue],
      );
      break;
    } catch (e) {
      if (e instanceof Error && /unique|duplicate/i.test(e.message)) { ref = `SUP-${randomUUID().slice(0, 6).toUpperCase()}`; continue; }
      throw e;
    }
  }
  await pool.query(
    `INSERT INTO support_messages(id, conversation_id, tenant_id, author_type, author_user_id, author_name, body)
     VALUES ($1,$2,$3,'customer',$4,$5,$6)`,
    [randomUUID(), id, input.tenantId, input.createdByUserId ?? null, input.createdByName ?? null, input.body],
  );
  await recordAudit({ action: "support_conversation_created", target: `support:${ref}`, details: input.subject });
  return id;
}

export async function listConversationsForTenant(tenantId: string): Promise<SupportConversation[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM support_conversations WHERE tenant_id=$1 ORDER BY last_message_at DESC NULLS LAST, created_at DESC", [tenantId]);
    return rows.map(rowToConv);
  } catch {
    return [];
  }
}

export async function listAllConversations(status?: string): Promise<SupportConversation[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = status
      ? await pool.query("SELECT * FROM support_conversations WHERE status=$1 ORDER BY last_message_at DESC NULLS LAST LIMIT 500", [status])
      : await pool.query("SELECT * FROM support_conversations ORDER BY last_message_at DESC NULLS LAST LIMIT 500");
    return rows.map(rowToConv);
  } catch {
    return [];
  }
}

export async function getConversation(id: string): Promise<SupportConversation | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM support_conversations WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? rowToConv(rows[0]) : null;
}

/** Lecture cloisonnée : renvoie null si la conversation n'appartient pas au tenant. */
export async function getConversationForTenant(id: string, tenantId: string): Promise<SupportConversation | null> {
  const conv = await getConversation(id);
  if (!conv || conv.tenantId !== tenantId) return null;
  return conv;
}

export async function listMessages(conversationId: string, opts: { includeInternal?: boolean } = {}): Promise<SupportMessage[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = opts.includeInternal
      ? await pool.query("SELECT * FROM support_messages WHERE conversation_id=$1 ORDER BY created_at ASC, id ASC", [conversationId])
      : await pool.query("SELECT * FROM support_messages WHERE conversation_id=$1 AND is_internal=false ORDER BY created_at ASC, id ASC", [conversationId]);
    return rows.map(rowToMsg);
  } catch {
    return [];
  }
}

export type AddMessageInput = {
  conversationId: string;
  tenantId: string;
  authorType: "customer" | "agent" | "ai" | "system";
  authorUserId?: number | null;
  authorName?: string | null;
  body: string;
  isInternal?: boolean;
};

export async function addMessage(input: AddMessageInput): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO support_messages(id, conversation_id, tenant_id, author_type, author_user_id, author_name, body, is_internal)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, input.conversationId, input.tenantId, input.authorType, input.authorUserId ?? null,
     input.authorName ?? null, input.body, input.isInternal ?? false],
  );

  if (!input.isInternal) {
    // Compteurs de non-lus + première réponse agent + statut.
    if (input.authorType === "agent" || input.authorType === "ai") {
      await pool.query(
        `UPDATE support_conversations
            SET last_message_at=now(), customer_unread = customer_unread + 1,
                first_response_at = COALESCE(first_response_at, now()),
                status = CASE WHEN status IN ('resolved','closed') THEN status ELSE 'waiting_customer' END,
                updated_at=now()
          WHERE id=$1`,
        [input.conversationId],
      );
    } else {
      await pool.query(
        `UPDATE support_conversations
            SET last_message_at=now(), agent_unread = agent_unread + 1,
                status = CASE WHEN status IN ('resolved','closed') THEN 'open' ELSE 'pending' END,
                updated_at=now()
          WHERE id=$1`,
        [input.conversationId],
      );
    }
  }
  return id;
}

export async function setStatus(id: string, status: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const resolved = status === "resolved" || status === "closed";
  await pool.query(
    `UPDATE support_conversations
        SET status=$2, resolved_at = CASE WHEN $3 THEN COALESCE(resolved_at, now()) ELSE resolved_at END,
            closed_at = CASE WHEN $2='closed' THEN now() ELSE closed_at END, updated_at=now()
      WHERE id=$1`,
    [id, status, resolved],
  );
}

export async function assignConversation(id: string, userId: number | null): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE support_conversations SET assigned_to_user_id=$2, updated_at=now() WHERE id=$1", [id, userId]);
}

export async function markRead(id: string, side: "customer" | "agent"): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const col = side === "customer" ? "customer_unread" : "agent_unread";
  await pool.query(`UPDATE support_conversations SET ${col}=0, updated_at=now() WHERE id=$1`, [id]);
}

export async function rateConversation(id: string, score: number, comment: string | null): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  await pool.query("UPDATE support_conversations SET rating_score=$2, rating_comment=$3, updated_at=now() WHERE id=$1", [id, clamped, comment]);
}

export type SupportStats = { open: number; pending: number; waiting: number; resolved: number; total: number; breached: number; unassigned: number };

export async function getSupportStats(): Promise<SupportStats> {
  const empty: SupportStats = { open: 0, pending: 0, waiting: 0, resolved: 0, total: 0, breached: 0, unassigned: 0 };
  if (!postgresActive()) return empty;
  try {
    const pool = await getPool();
    const n = async (sql: string) => Number((await pool.query(sql)).rows[0]?.n ?? 0);
    return {
      open: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status='open'"),
      pending: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status='pending'"),
      waiting: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status='waiting_customer'"),
      resolved: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE status IN ('resolved','closed')"),
      total: await n("SELECT COUNT(*)::int n FROM support_conversations"),
      breached: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE sla_due_at IS NOT NULL AND first_response_at IS NULL AND sla_due_at < now() AND status NOT IN ('resolved','closed')"),
      unassigned: await n("SELECT COUNT(*)::int n FROM support_conversations WHERE assigned_to_user_id IS NULL AND status NOT IN ('resolved','closed')"),
    };
  } catch {
    return empty;
  }
}
