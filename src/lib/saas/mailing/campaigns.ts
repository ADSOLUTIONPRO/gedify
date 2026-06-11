import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { listTenants, listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { enqueueMail } from "./queue";

/* Campagnes d'emailing (marketing/info) ciblant les espaces clients.
   L'audience désigne des tenants ; le destinataire est l'owner (repli admin). */

export type CampaignAudience = { scope: "all" | "plan" | "status"; value?: string | null };

export type Campaign = {
  id: string;
  name: string;
  templateKey: string | null;
  subject: string | null;
  htmlBody: string | null;
  category: string;
  status: string;
  audience: CampaignAudience | null;
  scheduledAt: string | null;
  sentCount: number;
  failedCount: number;
  createdAt: string | null;
};

function rowTo(r: Record<string, unknown>): Campaign {
  return {
    id: String(r.id), name: String(r.name ?? ""), templateKey: (r.template_key as string) ?? null,
    subject: (r.subject as string) ?? null, htmlBody: (r.html_body as string) ?? null,
    category: String(r.category ?? "marketing"), status: String(r.status ?? "draft"),
    audience: (r.audience as CampaignAudience) ?? null,
    scheduledAt: r.scheduled_at ? new Date(String(r.scheduled_at)).toISOString() : null,
    sentCount: Number(r.sent_count ?? 0), failedCount: Number(r.failed_count ?? 0),
    createdAt: r.created_at ? new Date(String(r.created_at)).toISOString() : null,
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM mail_campaigns ORDER BY created_at DESC LIMIT 200");
    return rows.map(rowTo);
  } catch {
    return [];
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM mail_campaigns WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export type CreateCampaignInput = {
  name: string;
  templateKey?: string | null;
  subject?: string | null;
  htmlBody?: string | null;
  category?: string;
  audience: CampaignAudience;
  createdByUserId?: number | null;
};

export async function createCampaign(input: CreateCampaignInput): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO mail_campaigns(id, name, template_key, subject, html_body, category, status, audience, created_by_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8)`,
    [id, input.name, input.templateKey ?? null, input.subject ?? null, input.htmlBody ?? null,
     input.category ?? "marketing", JSON.stringify(input.audience), input.createdByUserId ?? null],
  );
  await recordAudit({ action: "mail_campaign_created", target: `campaign:${id}`, details: input.name });
  return id;
}

async function resolveAudienceTenants(audience: CampaignAudience): Promise<string[]> {
  const tenants = await listTenants();
  const filtered = tenants.filter((t) => {
    if (audience.scope === "all") return true;
    if (audience.scope === "plan") return (t.plan ?? "free") === audience.value;
    if (audience.scope === "status") return (t.status ?? "active") === audience.value;
    return false;
  });
  return filtered.map((t) => t.id);
}

/** Envoie (met en file) une campagne à son audience. */
export async function sendCampaign(id: string): Promise<{ enqueued: number; skipped: number }> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const campaign = await getCampaign(id);
  if (!campaign) throw new Error("Campagne introuvable.");
  if (campaign.status === "sent" || campaign.status === "sending") throw new Error("Campagne déjà envoyée.");
  if (!campaign.audience) throw new Error("Audience non définie.");

  const pool = await getPool();
  await pool.query("UPDATE mail_campaigns SET status='sending', updated_at=now() WHERE id=$1", [id]);

  const tenantIds = await resolveAudienceTenants(campaign.audience);
  let enqueued = 0, skipped = 0;
  for (const tenantId of tenantIds) {
    const members = await listTenantMembersWithUser(tenantId);
    const owner = members.find((m) => m.role === "owner" && m.email) ?? members.find((m) => m.email);
    if (!owner?.email) { skipped++; continue; }
    const res = await enqueueMail({
      to: owner.email, toName: owner.username, tenantId,
      templateKey: campaign.templateKey ?? undefined,
      subject: campaign.templateKey ? undefined : campaign.subject ?? undefined,
      html: campaign.templateKey ? undefined : campaign.htmlBody ?? undefined,
      category: campaign.category, campaignId: id,
      dedupeKey: `campaign:${id}:${tenantId}`,
      vars: { recipientName: owner.username ?? "", subject: campaign.subject ?? "", bodyHtml: campaign.htmlBody ?? "" },
    });
    if (res.status === "queued") enqueued++; else skipped++;
  }

  await pool.query("UPDATE mail_campaigns SET status='sent', sent_count=$2, failed_count=$3, updated_at=now() WHERE id=$1", [id, enqueued, skipped]);
  await recordAudit({ action: "mail_campaign_sent", target: `campaign:${id}`, details: `enqueued=${enqueued} skipped=${skipped}` });
  return { enqueued, skipped };
}
