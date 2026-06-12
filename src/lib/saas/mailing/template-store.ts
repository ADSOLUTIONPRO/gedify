import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { DEFAULT_TEMPLATES, findDefaultTemplate } from "./templates";

export type DeviceVariant = { html: string; css: string };
export type ResponsiveVariants = { desktop: DeviceVariant; tablet: DeviceVariant; mobile: DeviceVariant };
export type DeviceKey = keyof ResponsiveVariants;

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
  preheader: string | null;
  responsiveVariants: ResponsiveVariants | null;
};

/** Nettoyage anti-XSS du HTML d'email (scripts/handlers/JS supprimés). */
export function sanitizeEmailHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
export function sanitizeEmailCss(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/<\s*\/?\s*style\b[^>]*>/gi, "").replace(/javascript:/gi, "").replace(/expression\s*\(/gi, "");
}

function asVariant(v: unknown): DeviceVariant | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  return { html: typeof o.html === "string" ? o.html : "", css: typeof o.css === "string" ? o.css : "" };
}
function parseVariants(raw: unknown): ResponsiveVariants | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const d = asVariant(o.desktop), t = asVariant(o.tablet), m = asVariant(o.mobile);
  if (!d && !t && !m) return null;
  const base = d ?? t ?? m ?? { html: "", css: "" };
  return { desktop: d ?? base, tablet: t ?? base, mobile: m ?? base };
}

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
    preheader: (r.preheader as string) ?? null,
    responsiveVariants: parseVariants(r.responsive_variants),
  };
}

/** Variantes responsive d'un modèle ; rétrocompat : init depuis htmlBody si absentes. */
export function variantsOf(t: MailTemplate): ResponsiveVariants {
  if (t.responsiveVariants) return t.responsiveVariants;
  const base: DeviceVariant = { html: t.htmlBody, css: "" };
  return { desktop: { ...base }, tablet: { ...base }, mobile: { ...base } };
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
    variables: def.variables, isMarketing: def.isMarketing === true, preheader: null, responsiveVariants: null,
  };
}

/** Sauvegarde le CONTENU éditable (objet, préheader, variantes responsive).
    Le HTML/CSS est nettoyé. htmlBody canonique = variante desktop (utilisée à l'envoi). */
export async function saveTemplateContent(key: string, input: { subject?: string; preheader?: string | null; variants: ResponsiveVariants }): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const clean = (v: DeviceVariant): DeviceVariant => ({ html: sanitizeEmailHtml(v.html), css: sanitizeEmailCss(v.css) });
  const variants: ResponsiveVariants = { desktop: clean(input.variants.desktop), tablet: clean(input.variants.tablet), mobile: clean(input.variants.mobile) };
  const pool = await getPool();
  const existing = await pool.query("SELECT id FROM mail_templates WHERE key = $1 LIMIT 1", [key]);
  const desktopHtml = variants.desktop.html;
  if (existing.rows[0]) {
    await pool.query(
      "UPDATE mail_templates SET subject = COALESCE($2, subject), preheader = $3, html_body = $4, responsive_variants = $5, updated_at = now() WHERE key = $1",
      [key, input.subject ?? null, input.preheader ?? null, desktopHtml, JSON.stringify(variants)],
    );
  } else {
    const def = findDefaultTemplate(key);
    await pool.query(
      `INSERT INTO mail_templates(id, key, name, category, subject, html_body, preheader, responsive_variants, enabled, is_marketing, variables)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
      [randomUUID(), key, def?.name ?? key, def?.category ?? "system", input.subject ?? def?.subject ?? "", desktopHtml,
       input.preheader ?? null, JSON.stringify(variants), def?.isMarketing ?? false, JSON.stringify(def?.variables ?? [])],
    );
  }
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
