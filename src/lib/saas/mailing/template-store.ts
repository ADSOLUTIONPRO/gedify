import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { DEFAULT_TEMPLATES, findDefaultTemplate } from "./templates";

export type MailTemplate = {
  id: string;
  key: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  locale: string;
  enabled: boolean;
  description: string | null;
  variables: string[];
  isMarketing: boolean;
};

function rowToTemplate(r: Record<string, unknown>): MailTemplate {
  return {
    id: String(r.id),
    key: String(r.key),
    name: String(r.name ?? ""),
    category: String(r.category ?? "system"),
    subject: String(r.subject ?? ""),
    htmlBody: String(r.html_body ?? ""),
    textBody: (r.text_body as string) ?? null,
    locale: String(r.locale ?? "fr-FR"),
    enabled: r.enabled !== false,
    description: (r.description as string) ?? null,
    variables: Array.isArray(r.variables) ? (r.variables as string[]) : [],
    isMarketing: r.is_marketing === true,
  };
}

export async function listTemplates(): Promise<MailTemplate[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM mail_templates ORDER BY category, key");
    return rows.map(rowToTemplate);
  } catch {
    return [];
  }
}

/** Récupère un modèle par clé : base, ou repli sur le catalogue par défaut. */
export async function getTemplate(key: string): Promise<MailTemplate | null> {
  if (postgresActive()) {
    try {
      const pool = await getPool();
      const { rows } = await pool.query("SELECT * FROM mail_templates WHERE key = $1 LIMIT 1", [key]);
      if (rows[0]) return rowToTemplate(rows[0]);
    } catch { /* fallback below */ }
  }
  const def = findDefaultTemplate(key);
  if (!def) return null;
  return {
    id: `default:${def.key}`, key: def.key, name: def.name, category: def.category, subject: def.subject,
    htmlBody: def.html, textBody: null, locale: "fr-FR", enabled: true, description: null,
    variables: def.variables, isMarketing: def.isMarketing === true,
  };
}

export type TemplateUpdate = Partial<Pick<MailTemplate, "name" | "subject" | "htmlBody" | "textBody" | "enabled" | "category" | "isMarketing">>;

export async function upsertTemplate(key: string, update: TemplateUpdate): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const existing = await pool.query("SELECT id FROM mail_templates WHERE key = $1 LIMIT 1", [key]);
  if (existing.rows[0]) {
    await pool.query(
      `UPDATE mail_templates SET
         name = COALESCE($2, name), subject = COALESCE($3, subject), html_body = COALESCE($4, html_body),
         text_body = COALESCE($5, text_body), enabled = COALESCE($6, enabled), category = COALESCE($7, category),
         is_marketing = COALESCE($8, is_marketing), updated_at = now()
       WHERE key = $1`,
      [key, update.name ?? null, update.subject ?? null, update.htmlBody ?? null, update.textBody ?? null,
       update.enabled ?? null, update.category ?? null, update.isMarketing ?? null],
    );
    return;
  }
  const def = findDefaultTemplate(key);
  await pool.query(
    `INSERT INTO mail_templates(id, key, name, category, subject, html_body, text_body, enabled, is_marketing, variables)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      randomUUID(), key, update.name ?? def?.name ?? key, update.category ?? def?.category ?? "system",
      update.subject ?? def?.subject ?? "", update.htmlBody ?? def?.html ?? "", update.textBody ?? null,
      update.enabled ?? true, update.isMarketing ?? def?.isMarketing ?? false,
      JSON.stringify(def?.variables ?? []),
    ],
  );
}

/** Insère les modèles par défaut manquants. Renvoie le nombre créé. */
export async function seedDefaultTemplates(): Promise<{ created: number; skipped: number }> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  let created = 0, skipped = 0;
  for (const def of DEFAULT_TEMPLATES) {
    const exists = await pool.query("SELECT 1 FROM mail_templates WHERE key = $1 LIMIT 1", [def.key]);
    if (exists.rows[0]) { skipped++; continue; }
    await pool.query(
      `INSERT INTO mail_templates(id, key, name, category, subject, html_body, enabled, is_marketing, variables)
       VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)`,
      [randomUUID(), def.key, def.name, def.category, def.subject, def.html, def.isMarketing ?? false, JSON.stringify(def.variables)],
    );
    created++;
  }
  return { created, skipped };
}
