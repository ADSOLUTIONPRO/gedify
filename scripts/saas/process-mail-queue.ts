/* saas:process-mail-queue — worker d'envoi des emails en file (cron).

   Autonome via `pg` + `nodemailer`. N'envoie RIEN si EMAILS_ENABLED≠true.
   ⚠️ SMTP_PASSWORD n'est jamais loggé. Idempotent : verrou optimiste (sending). */

import { randomUUID } from "node:crypto";
import { Client } from "pg";
import nodemailer from "nodemailer";

function enabled(): boolean {
  const v = process.env.EMAILS_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

function smtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME)?.trim();
  const pass = process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS;
  const fromEmail = (process.env.MAIL_FROM || process.env.SMTP_FROM)?.trim() || user;
  if (!host || !user || !pass || !fromEmail) return null;
  const port = Number(process.env.SMTP_PORT?.trim() || "465") || 465;
  const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureRaw ? secureRaw === "true" || secureRaw === "1" || secureRaw === "yes" : port === 465;
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "Gedify";
  return { host, port, secure, user, pass, fromEmail, fromName };
}

const LIMIT = Number(process.env.MAIL_BATCH?.trim() || "50") || 50;

async function main() {
  if (!enabled()) { console.log("⏭️  Mailing désactivé (EMAILS_ENABLED≠true) — rien à envoyer."); process.exit(0); }
  const cfg = smtpConfig();
  if (!cfg) { console.error("❌ Configuration SMTP incomplète (SMTP_HOST/SMTP_USER/SMTP_PASSWORD/MAIL_FROM)."); process.exit(1); }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("❌ DATABASE_URL absente."); process.exit(1); }

  const client = new Client({ connectionString: url });
  await client.connect();
  const transporter = nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure, requireTLS: !cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  const from = `"${cfg.fromName.replace(/"/g, "")}" <${cfg.fromEmail}>`;

  let sent = 0, failed = 0;
  try {
    const { rows } = await client.query(
      `SELECT * FROM mail_queue
        WHERE status='pending' AND scheduled_at <= now() AND attempts < max_attempts
        ORDER BY scheduled_at ASC LIMIT $1`,
      [LIMIT],
    );
    for (const row of rows) {
      const id = String(row.id);
      const lock = await client.query("UPDATE mail_queue SET status='sending', updated_at=now() WHERE id=$1 AND status='pending'", [id]);
      if (lock.rowCount === 0) continue;
      const event = async (type: string, detail?: string) => {
        try {
          await client.query("INSERT INTO mail_events(id, queue_id, tenant_id, type, detail) VALUES ($1,$2,$3,$4,$5)",
            [randomUUID(), id, row.tenant_id ?? null, type, detail ?? null]);
        } catch { /* best-effort */ }
      };
      try {
        const info = await transporter.sendMail({
          from,
          to: row.to_name ? `"${String(row.to_name).replace(/"/g, "")}" <${row.to_email}>` : String(row.to_email),
          subject: String(row.subject),
          html: String(row.html_body),
          text: row.text_body ? String(row.text_body) : undefined,
        });
        await client.query("UPDATE mail_queue SET status='sent', sent_at=now(), provider_message_id=$2, updated_at=now() WHERE id=$1", [id, info.messageId ?? ""]);
        await event("sent", info.messageId ?? "");
        sent++;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : "Erreur d'envoi").slice(0, 500);
        const attempts = Number(row.attempts ?? 0) + 1;
        const max = Number(row.max_attempts ?? 5);
        const isFailed = attempts >= max;
        await client.query(
          `UPDATE mail_queue SET status=$2, attempts=$3, last_error=$4,
             scheduled_at = now() + ($3 * interval '5 minutes'), updated_at=now() WHERE id=$1`,
          [id, isFailed ? "failed" : "pending", attempts, msg],
        );
        await event(isFailed ? "failed" : "retry", msg.slice(0, 200));
        failed++;
      }
    }
    console.log(`✅ process-mail-queue : ${sent} envoyé(s), ${failed} échec(s) sur ${rows.length} traité(s).`);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((e) => { console.error("❌ saas:process-mail-queue :", e instanceof Error ? e.message : String(e)); process.exit(1); });
