import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { isMailingEnabled } from "./config";
import { getTemplate } from "./template-store";
import { renderEmail, type RenderVars } from "./render";
import { getOrCreatePreference, isUnsubscribed } from "./preferences";
import { sendEmail } from "./transport";

/* File d'attente d'emails + worker d'envoi. Tout est persisté en base pour
   audit/relance. Aucun envoi si EMAILS_ENABLED=false (les messages restent en
   `pending` et seront envoyés quand le mailing sera activé). */

export type EnqueueInput = {
  to: string;
  toName?: string | null;
  /** Modèle à rendre (recommandé). Sinon fournir subject + html bruts. */
  templateKey?: string;
  vars?: RenderVars;
  subject?: string;
  html?: string;
  text?: string | null;
  category?: string;
  tenantId?: string | null;
  scheduledAt?: Date | null;
  campaignId?: string | null;
  /** Clé d'idempotence : évite les doublons (ex: reminder:invoice:123:r1). */
  dedupeKey?: string | null;
  meta?: Record<string, unknown>;
};

export type EnqueueResult = { id: string | null; status: "queued" | "skipped" | "duplicate" };

async function recordEvent(queueId: string | null, tenantId: string | null, type: string, detail?: string) {
  try {
    const pool = await getPool();
    await pool.query(
      "INSERT INTO mail_events(id, queue_id, tenant_id, type, detail) VALUES ($1,$2,$3,$4,$5)",
      [randomUUID(), queueId, tenantId, type, detail ?? null],
    );
  } catch { /* best-effort */ }
}

/** Met un email en file. Respecte les préférences de désinscription. */
export async function enqueueMail(input: EnqueueInput): Promise<EnqueueResult> {
  if (!postgresActive()) return { id: null, status: "skipped" };
  const to = input.to.trim().toLowerCase();
  if (!to) return { id: null, status: "skipped" };
  const category = input.category ?? "system";
  const tenantId = input.tenantId ?? null;

  // Désinscription (le transactionnel n'est jamais bloqué sauf unsubAll).
  if (await isUnsubscribed(to, category, tenantId)) {
    await recordEvent(null, tenantId, "skipped", `désinscrit (${category}) : ${to}`);
    return { id: null, status: "skipped" };
  }

  // Rendu via modèle ou contenu brut.
  let subject = input.subject ?? "";
  let html = input.html ?? "";
  let text = input.text ?? null;
  let isMarketing = category === "marketing";
  if (input.templateKey) {
    const tpl = await getTemplate(input.templateKey);
    if (!tpl) return { id: null, status: "skipped" };
    if (!tpl.enabled) {
      await recordEvent(null, tenantId, "skipped", `modèle désactivé : ${input.templateKey}`);
      return { id: null, status: "skipped" };
    }
    isMarketing = tpl.isMarketing;
    const pref = isMarketing ? await getOrCreatePreference(to, tenantId) : null;
    const rendered = renderEmail(tpl, { recipientName: input.toName ?? "", ...input.vars }, { unsubToken: pref?.token });
    subject = rendered.subject;
    html = rendered.html;
    text = rendered.text;
  }
  if (!subject || !html) return { id: null, status: "skipped" };

  const id = randomUUID();
  const pool = await getPool();
  try {
    await pool.query(
      `INSERT INTO mail_queue(id, tenant_id, to_email, to_name, template_key, category, subject, html_body, text_body,
                              status, scheduled_at, campaign_id, dedupe_key, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending',$10,$11,$12,$13)`,
      [id, tenantId, to, input.toName ?? null, input.templateKey ?? null, category, subject, html, text,
       input.scheduledAt ?? new Date(), input.campaignId ?? null, input.dedupeKey ?? null,
       input.meta ? JSON.stringify(input.meta) : null],
    );
  } catch (e) {
    // Violation d'unicité dedupe_key → déjà en file.
    if (e instanceof Error && /duplicate key|unique/i.test(e.message)) return { id: null, status: "duplicate" };
    throw e;
  }
  await recordEvent(id, tenantId, "queued", input.templateKey ?? "(brut)");
  return { id, status: "queued" };
}

export type ProcessResult = { processed: number; sent: number; failed: number; skipped: number; disabled: boolean };

/** Traite la file : envoie les messages `pending` arrivés à échéance. */
export async function processMailQueue(limit = 25): Promise<ProcessResult> {
  const out: ProcessResult = { processed: 0, sent: 0, failed: 0, skipped: 0, disabled: !isMailingEnabled() };
  if (!postgresActive()) return out;
  if (!isMailingEnabled()) return out; // rien n'est envoyé tant que désactivé
  const pool = await getPool();

  const { rows } = await pool.query(
    `SELECT * FROM mail_queue
      WHERE status = 'pending' AND scheduled_at <= now() AND attempts < max_attempts
      ORDER BY scheduled_at ASC LIMIT $1`,
    [limit],
  );

  for (const row of rows) {
    out.processed++;
    const id = String(row.id);
    const tenantId = (row.tenant_id as string) ?? null;
    // Verrou optimiste : passe en 'sending' seulement si encore 'pending'.
    const lock = await pool.query("UPDATE mail_queue SET status='sending', updated_at=now() WHERE id=$1 AND status='pending'", [id]);
    if (lock.rowCount === 0) { out.skipped++; continue; }
    try {
      const res = await sendEmail({
        to: String(row.to_email),
        toName: (row.to_name as string) ?? null,
        subject: String(row.subject),
        html: String(row.html_body),
        text: (row.text_body as string) ?? null,
      });
      await pool.query(
        "UPDATE mail_queue SET status='sent', sent_at=now(), provider_message_id=$2, updated_at=now() WHERE id=$1",
        [id, res.messageId],
      );
      await recordEvent(id, tenantId, "sent", res.messageId);
      out.sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur d'envoi";
      const attempts = Number(row.attempts ?? 0) + 1;
      const max = Number(row.max_attempts ?? 5);
      const failed = attempts >= max;
      await pool.query(
        `UPDATE mail_queue SET status=$2, attempts=$3, last_error=$4,
           scheduled_at = now() + ($3 * interval '5 minutes'), updated_at=now() WHERE id=$1`,
        [id, failed ? "failed" : "pending", attempts, msg.slice(0, 500)],
      );
      await recordEvent(id, tenantId, failed ? "failed" : "retry", msg.slice(0, 200));
      out.failed++;
    }
  }
  if (out.sent > 0 || out.failed > 0) {
    await recordAudit({ action: "mail_queue_processed", target: "mailing", details: `sent=${out.sent} failed=${out.failed}` });
  }
  return out;
}

export type QueueStats = { pending: number; sending: number; sent: number; failed: number; skipped: number; total: number };

export async function getQueueStats(): Promise<QueueStats> {
  const empty: QueueStats = { pending: 0, sending: 0, sent: 0, failed: 0, skipped: 0, total: 0 };
  if (!postgresActive()) return empty;
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT status, COUNT(*)::int n FROM mail_queue GROUP BY status");
    const out = { ...empty };
    for (const r of rows) {
      const n = Number(r.n);
      out.total += n;
      if (r.status in out) (out as Record<string, number>)[String(r.status)] = n;
    }
    return out;
  } catch {
    return empty;
  }
}

export type QueueItem = Record<string, unknown> & { id: string };

export async function listQueue(limit = 100, status?: string): Promise<QueueItem[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = status
      ? await pool.query("SELECT * FROM mail_queue WHERE status=$1 ORDER BY created_at DESC LIMIT $2", [status, limit])
      : await pool.query("SELECT * FROM mail_queue ORDER BY created_at DESC LIMIT $1", [limit]);
    return rows as QueueItem[];
  } catch {
    return [];
  }
}

export async function retryQueueItem(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE mail_queue SET status='pending', attempts=0, last_error=NULL, scheduled_at=now(), updated_at=now() WHERE id=$1 AND status IN ('failed','canceled')", [id]);
}

export async function cancelQueueItem(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE mail_queue SET status='canceled', updated_at=now() WHERE id=$1 AND status IN ('pending','failed')", [id]);
}
