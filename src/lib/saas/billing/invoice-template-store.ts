import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";
import { getDefaultBillingProfile, type BillingProfile } from "./profile-store";
import { renderInvoiceHtml, type RenderInvoice, type RenderLine } from "./render-invoice-html";
import { generateInvoicePdfBytes } from "./render-invoice-pdf";
import { buildLegalMentions } from "./legal-mentions";

/* Modèles de facture éditables. Le HTML/CSS personnalisé est NETTOYÉ (aucun JS)
   et l'aperçu est rendu dans une iframe sandboxée. */

export type InvoiceTemplate = {
  id: string;
  name: string;
  isDefault: boolean;
  locale: string;
  currency: string;
  primaryColor: string | null;
  secondaryColor: string | null;
  fontFamily: string | null;
  logoPosition: string | null;
  showLogo: boolean;
  showPaymentDetails: boolean;
  showLegalFooter: boolean;
  showQrCode: boolean;
  headerHtml: string | null;
  footerHtml: string | null;
  customCss: string | null;
};

function rowTo(r: Record<string, unknown>): InvoiceTemplate {
  return {
    id: String(r.id), name: String(r.name), isDefault: r.is_default === true, locale: String(r.locale ?? "fr-FR"),
    currency: String(r.currency ?? "EUR"), primaryColor: (r.primary_color as string) ?? null, secondaryColor: (r.secondary_color as string) ?? null,
    fontFamily: (r.font_family as string) ?? null, logoPosition: (r.logo_position as string) ?? null,
    showLogo: r.show_logo !== false, showPaymentDetails: r.show_payment_details !== false, showLegalFooter: r.show_legal_footer !== false,
    showQrCode: r.show_qr_code === true, headerHtml: (r.header_html as string) ?? null, footerHtml: (r.footer_html as string) ?? null,
    customCss: (r.custom_css as string) ?? null,
  };
}

/** Retire tout script/handler/URL JS (anti-XSS) du HTML/CSS personnalisé. */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*\/?\s*(script|iframe|object|embed|link|meta)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
export function sanitizeCss(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/<\s*\/?\s*style\b[^>]*>/gi, "").replace(/javascript:/gi, "").replace(/expression\s*\(/gi, "");
}

export async function listInvoiceTemplates(): Promise<InvoiceTemplate[]> {
  if (!postgresActive()) return [];
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM invoice_templates ORDER BY is_default DESC, name");
    return rows.map(rowTo);
  } catch { return []; }
}

export async function getInvoiceTemplate(id: string): Promise<InvoiceTemplate | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM invoice_templates WHERE id=$1 LIMIT 1", [id]);
  return rows[0] ? rowTo(rows[0]) : null;
}

export async function getDefaultInvoiceTemplate(): Promise<InvoiceTemplate | null> {
  if (!postgresActive()) return null;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT * FROM invoice_templates WHERE is_default=true ORDER BY created_at LIMIT 1");
  return rows[0] ? rowTo(rows[0]) : null;
}

export type TemplateInput = Partial<Omit<InvoiceTemplate, "id">> & { name: string };

export async function createInvoiceTemplate(input: TemplateInput): Promise<string> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO invoice_templates(id, name, is_default, locale, currency, primary_color, secondary_color, font_family, logo_position,
       show_logo, show_payment_details, show_legal_footer, show_qr_code, header_html, footer_html, custom_css)
     VALUES ($1,$2,false,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [id, input.name, input.locale ?? "fr-FR", input.currency ?? "EUR", input.primaryColor ?? "#0E7490", input.secondaryColor ?? null,
     input.fontFamily ?? null, input.logoPosition ?? "left", input.showLogo ?? true, input.showPaymentDetails ?? true,
     input.showLegalFooter ?? true, input.showQrCode ?? false, sanitizeHtml(input.headerHtml), sanitizeHtml(input.footerHtml), sanitizeCss(input.customCss)],
  );
  await recordAudit({ action: "plan_created", target: `invoice_template:${id}`, details: input.name });
  return id;
}

export async function updateInvoiceTemplate(id: string, input: TemplateInput): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  await pool.query(
    `UPDATE invoice_templates SET name=$2, locale=$3, currency=$4, primary_color=$5, secondary_color=$6, font_family=$7,
       logo_position=$8, show_logo=$9, show_payment_details=$10, show_legal_footer=$11, show_qr_code=$12,
       header_html=$13, footer_html=$14, custom_css=$15, updated_at=now() WHERE id=$1`,
    [id, input.name, input.locale ?? "fr-FR", input.currency ?? "EUR", input.primaryColor ?? "#0E7490", input.secondaryColor ?? null,
     input.fontFamily ?? null, input.logoPosition ?? "left", input.showLogo ?? true, input.showPaymentDetails ?? true,
     input.showLegalFooter ?? true, input.showQrCode ?? false, sanitizeHtml(input.headerHtml), sanitizeHtml(input.footerHtml), sanitizeCss(input.customCss)],
  );
  await recordAudit({ action: "plan_updated", target: `invoice_template:${id}` });
}

export async function setDefaultInvoiceTemplate(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("UPDATE invoice_templates SET is_default=false");
  await pool.query("UPDATE invoice_templates SET is_default=true, updated_at=now() WHERE id=$1", [id]);
  await recordAudit({ action: "plan_updated", target: `invoice_template:${id}`, details: "défaut" });
}

export async function duplicateInvoiceTemplate(id: string): Promise<string | null> {
  const t = await getInvoiceTemplate(id);
  if (!t) return null;
  return createInvoiceTemplate({ ...t, name: `${t.name} (copie)`, isDefault: false });
}

export async function deleteInvoiceTemplate(id: string): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  await pool.query("DELETE FROM invoice_templates WHERE id=$1 AND is_default=false", [id]);
  await recordAudit({ action: "plan_updated", target: `invoice_template:${id}`, details: "supprimé" });
}

/** Crée le modèle par défaut intégré s'il n'en existe aucun. */
export async function ensureDefaultInvoiceTemplate(): Promise<void> {
  if (!postgresActive()) return;
  const pool = await getPool();
  const { rows } = await pool.query("SELECT 1 FROM invoice_templates LIMIT 1");
  if (rows[0]) return;
  const id = await createInvoiceTemplate({ name: "Modèle standard", primaryColor: "#0E7490" });
  await setDefaultInvoiceTemplate(id);
}

/* ── Aperçu avec données fictives (jamais de vraie facture / numéro) ───────── */

function fakeProfile(): BillingProfile {
  return {
    id: "preview", profileName: "Aperçu", companyName: "Votre Société SAS", legalName: "Votre Société SAS", legalForm: "SAS",
    siren: "123456789", siret: "12345678900012", vatNumber: "FR00123456789", rcsCity: "Paris", rcsNumber: "123 456 789",
    rmNumber: null, apeNaf: "6201Z", shareCapital: "10 000 €", addressLine1: "1 rue de l'Exemple", addressLine2: null,
    postalCode: "75001", city: "Paris", country: "France", email: "facturation@exemple.fr", phone: "01 23 45 67 89",
    website: null, logoUrl: null, iban: "FR76 3000 1000 0100 0000 0000 123", bic: "EXEMPLEFRPP", paymentTermsDays: 30,
    latePaymentRate: "3× taux légal", fixedRecoveryIndemnityCents: 4000, vatRegime: "standard", defaultVatRate: 20,
    invoicePrefix: "FAC", creditNotePrefix: "AVOIR", nextInvoiceNumber: 1, nextCreditNoteNumber: 1, isDefault: true,
    legalFooterHtml: null, termsFooterHtml: null,
  };
}

function fakeInvoice(): { inv: RenderInvoice; lines: RenderLine[] } {
  const lines: RenderLine[] = [
    { description: "Abonnement Gedify Pro — mensuel", quantity: 1, unitPriceHtCents: 2900, discountCents: 0, vatRate: 20, totalHtCents: 2900, totalTtcCents: 3480 },
    { description: "Utilisateur supplémentaire", quantity: 2, unitPriceHtCents: 500, discountCents: 0, vatRate: 20, totalHtCents: 1000, totalTtcCents: 1200 },
  ];
  const subtotal = 3900, tax = 780;
  return {
    inv: {
      invoiceNumber: "FAC-2026-000123 (aperçu)", type: "invoice", issueDate: new Date().toISOString(), dueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
      currency: "EUR", subtotalHtCents: subtotal, discountCents: 0, taxCents: tax, totalTtcCents: subtotal + tax, vatRate: 20,
      buyerName: "Client Test", buyerLegalName: "Client Test SARL", buyerEmail: "client@test.fr", buyerAddressLine1: "10 avenue du Client",
      buyerAddressLine2: null, buyerPostalCode: "69000", buyerCity: "Lyon", buyerCountry: "France", buyerVatNumber: "FR00987654321",
      buyerSiren: "987654321", buyerSiret: "98765432100021", periodStart: null, periodEnd: null,
    },
    lines,
  };
}

/** HTML d'aperçu d'un modèle (données fictives, HTML/CSS nettoyés, sans JS). */
export async function renderInvoiceTemplatePreview(template: InvoiceTemplate): Promise<string> {
  const profile = (await getDefaultBillingProfile().catch(() => null)) ?? fakeProfile();
  const { inv, lines } = fakeInvoice();
  const mentions = buildLegalMentions(profile, { isCreditNote: false, isB2B: true });
  let html = renderInvoiceHtml(inv, lines, profile, mentions, template.primaryColor ?? "#0E7490");
  const css = sanitizeCss(template.customCss);
  const header = sanitizeHtml(template.headerHtml);
  const footer = sanitizeHtml(template.footerHtml);
  if (css) html = html.replace("</style>", `${css}\n</style>`);
  if (header) html = html.replace(/<body([^>]*)>/i, `<body$1><div class="tpl-header">${header}</div>`);
  if (footer) html = html.replace("</body>", `<div class="tpl-footer">${footer}</div></body>`);
  return html;
}

export async function renderInvoiceTemplatePreviewPdf(template: InvoiceTemplate): Promise<Buffer> {
  const profile = (await getDefaultBillingProfile().catch(() => null)) ?? fakeProfile();
  const { inv, lines } = fakeInvoice();
  const mentions = buildLegalMentions(profile, { isCreditNote: false, isB2B: true });
  return Buffer.from(await generateInvoicePdfBytes(inv, lines, profile, mentions));
}
