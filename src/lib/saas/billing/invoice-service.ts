import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { getDataDir } from "@/lib/storage/data-dir";
import { recordAudit } from "@/lib/audit/audit-store";
import { getTenantById, listTenantMembersWithUser } from "@/lib/tenant/tenant-store";
import { enqueueMail } from "@/lib/saas/mailing/queue";
import { getAppBaseUrl } from "@/lib/saas/mailing/config";
import { encryptForTenant, decryptOnRead } from "@/lib/saas/encryption/file-crypto";
import { getDefaultBillingProfile } from "./profile-store";
import { reserveInvoiceNumber, reserveCreditNoteNumber } from "./invoice-numbering";
import { buildLegalMentions } from "./legal-mentions";
import { renderInvoiceHtml, type RenderInvoice, type RenderLine } from "./render-invoice-html";
import { generateInvoicePdfBytes } from "./render-invoice-pdf";

export type InvoiceLineInput = { description: string; quantity: number; unitPriceHtCents: number; discountCents?: number; vatRate?: number | null };
export type InvoiceRecord = Record<string, unknown> & { id: string; tenant_id: string };

function iso(v: unknown): string | null {
  return v ? (v instanceof Date ? v.toISOString() : String(v)) : null;
}

/** Email de contact d'un tenant (owner → admin → 1er membre). Best-effort. */
async function tenantContact(tenantId: string): Promise<{ email: string; name: string | null } | null> {
  try {
    const members = await listTenantMembersWithUser(tenantId);
    const m = members.find((x) => x.role === "owner" && x.email)
      ?? members.find((x) => x.role === "admin" && x.email)
      ?? members.find((x) => x.email);
    return m?.email ? { email: m.email, name: m.username } : null;
  } catch {
    return null;
  }
}

function fmtMoney(cents: unknown, currency = "EUR"): string {
  return `${(Number(cents ?? 0) / 100).toFixed(2)} ${currency}`;
}
function assertPg() {
  if (!postgresActive()) throw new Error("Postgres requis (facturation).");
}

export async function getInvoice(id: string): Promise<{ invoice: InvoiceRecord; lines: Record<string, unknown>[] } | null> {
  assertPg();
  const pool = await getPool();
  const inv = await pool.query("SELECT * FROM invoices WHERE id = $1 LIMIT 1", [id]);
  if (!inv.rows[0]) return null;
  const lines = await pool.query("SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id", [id]);
  return { invoice: inv.rows[0] as InvoiceRecord, lines: lines.rows };
}

export async function listInvoices(tenantId?: string): Promise<InvoiceRecord[]> {
  assertPg();
  const pool = await getPool();
  const { rows } = tenantId
    ? await pool.query("SELECT * FROM invoices WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId])
    : await pool.query("SELECT * FROM invoices ORDER BY created_at DESC LIMIT 500");
  return rows as InvoiceRecord[];
}

async function tenantBuyer(tenantId: string): Promise<Partial<RenderInvoice>> {
  const tenant = await getTenantById(tenantId).catch(() => null);
  let billing: Record<string, unknown> = {};
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT raw FROM tenant_settings WHERE tenant_id = $1 LIMIT 1", [tenantId]);
    const raw = (rows[0]?.raw as Record<string, unknown> | null) ?? null;
    if (raw && typeof raw.billing === "object" && raw.billing) billing = raw.billing as Record<string, unknown>;
  } catch { /* ignore */ }
  const g = (k: string) => (typeof billing[k] === "string" ? (billing[k] as string) : null);
  return {
    buyerName: g("name") ?? tenant?.name ?? tenantId,
    buyerLegalName: g("legalName"),
    buyerEmail: g("email"),
    buyerAddressLine1: g("addressLine1"),
    buyerAddressLine2: g("addressLine2"),
    buyerPostalCode: g("postalCode"),
    buyerCity: g("city"),
    buyerCountry: g("country") ?? "France",
    buyerSiren: g("siren"),
    buyerSiret: g("siret"),
    buyerVatNumber: g("vatNumber"),
  };
}

function computeLine(l: InvoiceLineInput, fallbackVat: number | null) {
  const totalHt = Math.round(l.quantity * l.unitPriceHtCents) - (l.discountCents ?? 0);
  const vat = l.vatRate ?? fallbackVat;
  const tax = vat ? Math.round((totalHt * vat) / 100) : 0;
  return { totalHt, tax, totalTtc: totalHt + tax, vat: vat ?? null };
}

export type CreateInvoiceInput = {
  tenantId: string;
  lines: InvoiceLineInput[];
  vatRate?: number | null;
  discountCents?: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  currency?: string;
};

/** Crée une facture BROUILLON (sans numéro) + ses lignes, totaux calculés. */
export async function createManualInvoice(input: CreateInvoiceInput): Promise<string> {
  assertPg();
  const pool = await getPool();
  const profile = await getDefaultBillingProfile();
  const vatRate = input.vatRate ?? profile?.defaultVatRate ?? null;
  const id = randomUUID();
  const buyer = await tenantBuyer(input.tenantId);

  let subtotalHt = 0, tax = 0;
  const computed = input.lines.map((l) => {
    const c = computeLine(l, vatRate);
    subtotalHt += c.totalHt;
    tax += c.tax;
    return { l, c };
  });
  const discount = input.discountCents ?? 0;
  const totalTtc = subtotalHt - discount + tax;

  await pool.query(
    `INSERT INTO invoices
       (id, tenant_id, provider, type, status, currency, subtotal_ht_cents, discount_cents, tax_cents, total_ttc_cents,
        amount_due, amount_paid, vat_rate, vat_regime, billing_profile_id, period_start, period_end,
        buyer_name, buyer_legal_name, buyer_email, buyer_address_line1, buyer_address_line2, buyer_postal_code,
        buyer_city, buyer_country, buyer_vat_number, buyer_siren, buyer_siret)
     VALUES ($1,$2,'manual','invoice','draft',$3,$4,$5,$6,$7,$7,0,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
    [
      id, input.tenantId, input.currency ?? "EUR", subtotalHt, discount, tax, totalTtc, vatRate,
      profile?.vatRegime ?? null, profile?.id ?? null, input.periodStart ?? null, input.periodEnd ?? null,
      buyer.buyerName ?? null, buyer.buyerLegalName ?? null, buyer.buyerEmail ?? null, buyer.buyerAddressLine1 ?? null,
      buyer.buyerAddressLine2 ?? null, buyer.buyerPostalCode ?? null, buyer.buyerCity ?? null, buyer.buyerCountry ?? null,
      buyer.buyerVatNumber ?? null, buyer.buyerSiren ?? null, buyer.buyerSiret ?? null,
    ],
  );
  let i = 0;
  for (const { l, c } of computed) {
    await pool.query(
      `INSERT INTO invoice_lines(id, invoice_id, description, quantity, unit_price_ht_cents, discount_cents, vat_rate, tax_cents, total_ht_cents, total_ttc_cents, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID(), id, l.description, l.quantity, l.unitPriceHtCents, l.discountCents ?? 0, c.vat, c.tax, c.totalHt, c.totalTtc, i++],
    );
  }
  await recordAudit({ action: "plan_created", target: `invoice:${input.tenantId}`, details: "facture brouillon" });
  return id;
}

function toRenderInvoice(inv: InvoiceRecord): RenderInvoice {
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return {
    invoiceNumber: (inv.invoice_number as string) ?? null, type: (inv.type as string) ?? "invoice",
    issueDate: iso(inv.issue_date), dueDate: iso(inv.due_date), currency: (inv.currency as string) ?? "EUR",
    subtotalHtCents: n(inv.subtotal_ht_cents), discountCents: n(inv.discount_cents), taxCents: n(inv.tax_cents),
    totalTtcCents: n(inv.total_ttc_cents), vatRate: inv.vat_rate == null ? null : Number(inv.vat_rate),
    buyerName: (inv.buyer_name as string) ?? null, buyerLegalName: (inv.buyer_legal_name as string) ?? null,
    buyerEmail: (inv.buyer_email as string) ?? null, buyerAddressLine1: (inv.buyer_address_line1 as string) ?? null,
    buyerAddressLine2: (inv.buyer_address_line2 as string) ?? null, buyerPostalCode: (inv.buyer_postal_code as string) ?? null,
    buyerCity: (inv.buyer_city as string) ?? null, buyerCountry: (inv.buyer_country as string) ?? null,
    buyerVatNumber: (inv.buyer_vat_number as string) ?? null, buyerSiren: (inv.buyer_siren as string) ?? null,
    buyerSiret: (inv.buyer_siret as string) ?? null, periodStart: iso(inv.period_start), periodEnd: iso(inv.period_end),
  };
}
function toRenderLines(rows: Record<string, unknown>[]): RenderLine[] {
  const n = (v: unknown) => (v == null ? 0 : Number(v));
  return rows.map((r) => ({
    description: (r.description as string) ?? null, quantity: n(r.quantity), unitPriceHtCents: n(r.unit_price_ht_cents),
    discountCents: n(r.discount_cents), vatRate: r.vat_rate == null ? null : Number(r.vat_rate),
    totalHtCents: n(r.total_ht_cents), totalTtcCents: n(r.total_ttc_cents),
  }));
}

/** Génère et stocke HTML + PDF d'une facture, renvoie les URLs (routes sécurisées). */
async function renderAndStore(invoice: InvoiceRecord, lines: Record<string, unknown>[]): Promise<{ htmlUrl: string; pdfUrl: string }> {
  const profile = await getDefaultBillingProfile();
  if (!profile) throw new Error("Profil de facturation manquant (configurez /admin/saas/billing/profile).");
  const isB2B = Boolean((invoice.buyer_vat_number as string) || (invoice.buyer_siret as string));
  const mentions = buildLegalMentions(profile, { isCreditNote: invoice.type === "credit_note", isB2B });
  const ri = toRenderInvoice(invoice);
  const rl = toRenderLines(lines);
  const html = renderInvoiceHtml(ri, rl, profile, mentions);
  const pdf = await generateInvoicePdfBytes(ri, rl, profile, mentions);

  const tenantId = String(invoice.tenant_id);
  const number = (invoice.invoice_number as string) ?? String(invoice.id);
  const dir = path.join(getDataDir(), "billing", "invoices", tenantId);
  await mkdir(dir, { recursive: true });
  // Documents potentiellement sensibles → chiffrés au repos avec la clé du tenant.
  await writeFile(path.join(dir, `${number}.html`), await encryptForTenant(tenantId, Buffer.from(html, "utf8")));
  await writeFile(path.join(dir, `${number}.pdf`), await encryptForTenant(tenantId, Buffer.from(pdf)));

  const base = `/admin/saas/billing/invoices/${invoice.id}`;
  // snapshot mentions + urls persistés
  const pool = await getPool();
  await pool.query(
    "UPDATE invoices SET html_url=$2, pdf_url=$3, legal_mentions_snapshot=$4, updated_at=now() WHERE id=$1",
    [invoice.id, `${base}/html`, `${base}/pdf`, JSON.stringify(mentions)],
  );
  return { htmlUrl: `${base}/html`, pdfUrl: `${base}/pdf` };
}

/** Émet une facture brouillon : réserve un numéro, fige dates + mentions, génère les fichiers. */
export async function issueInvoice(id: string): Promise<void> {
  assertPg();
  const data = await getInvoice(id);
  if (!data) throw new Error("Facture introuvable.");
  if (data.invoice.invoice_number) return; // déjà émise (numéro ne change jamais)
  const profile = await getDefaultBillingProfile();
  if (!profile) throw new Error("Profil de facturation manquant.");
  const number = await reserveInvoiceNumber(profile.id);
  const due = new Date();
  due.setDate(due.getDate() + profile.paymentTermsDays);
  const pool = await getPool();
  // Snapshot du modèle de facture par défaut (fige la mise en page de cette facture).
  let templateId: string | null = null;
  try {
    const { getDefaultInvoiceTemplate } = await import("./invoice-template-store");
    templateId = (await getDefaultInvoiceTemplate())?.id ?? null;
  } catch { /* best-effort */ }
  await pool.query(
    "UPDATE invoices SET invoice_number=$2, status='issued', issue_date=now(), due_date=$3, template_id=COALESCE($4, template_id), updated_at=now() WHERE id=$1",
    [id, number, due, templateId],
  );
  const refreshed = await getInvoice(id);
  if (refreshed) await renderAndStore(refreshed.invoice, refreshed.lines);
  await recordAudit({ action: "plan_updated", target: `invoice:${number}`, details: "facture émise" });

  // Notification client (best-effort, ne bloque jamais l'émission).
  try {
    const inv = refreshed?.invoice;
    if (inv) {
      const contact = await tenantContact(String(inv.tenant_id));
      if (contact) {
        await enqueueMail({
          to: contact.email, toName: contact.name, templateKey: "billing.invoice_issued",
          category: "billing", tenantId: String(inv.tenant_id), dedupeKey: `invoice_issued:${id}`,
          vars: {
            recipientName: contact.name ?? "",
            invoiceNumber: number,
            amount: fmtMoney(inv.total_ttc_cents, String(inv.currency ?? "EUR")),
            dueDate: inv.due_date ? new Date(String(inv.due_date)).toLocaleDateString("fr-FR") : "",
            invoiceUrl: `${getAppBaseUrl()}/admin/saas/billing/invoices/${id}/pdf`,
          },
        });
      }
    }
  } catch { /* notification best-effort */ }
}

/** Crée un avoir référant une facture émise. */
export async function createCreditNote(originalId: string): Promise<string> {
  assertPg();
  const data = await getInvoice(originalId);
  if (!data) throw new Error("Facture d'origine introuvable.");
  const o = data.invoice;
  const profile = await getDefaultBillingProfile();
  if (!profile) throw new Error("Profil de facturation manquant.");
  const number = await reserveCreditNoteNumber(profile.id);
  const id = randomUUID();
  const neg = (v: unknown) => -(v == null ? 0 : Number(v));
  const pool = await getPool();
  await pool.query(
    `INSERT INTO invoices
       (id, tenant_id, provider, type, credit_note_of_id, status, invoice_number, issue_date, currency,
        subtotal_ht_cents, discount_cents, tax_cents, total_ttc_cents, amount_due, amount_paid, vat_rate, vat_regime,
        billing_profile_id, buyer_name, buyer_legal_name, buyer_email, buyer_vat_number, buyer_siren, buyer_siret)
     VALUES ($1,$2,'manual','credit_note',$3,'issued',$4, now(), $5,$6,$7,$8,$9,$9,0,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [
      id, o.tenant_id, originalId, number, o.currency ?? "EUR", neg(o.subtotal_ht_cents), neg(o.discount_cents),
      neg(o.tax_cents), neg(o.total_ttc_cents), o.vat_rate ?? null, o.vat_regime ?? null, profile.id,
      o.buyer_name ?? null, o.buyer_legal_name ?? null, o.buyer_email ?? null, o.buyer_vat_number ?? null,
      o.buyer_siren ?? null, o.buyer_siret ?? null,
    ],
  );
  for (const l of data.lines) {
    await pool.query(
      `INSERT INTO invoice_lines(id, invoice_id, description, quantity, unit_price_ht_cents, vat_rate, tax_cents, total_ht_cents, total_ttc_cents, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [randomUUID(), id, l.description, l.quantity, l.unit_price_ht_cents, l.vat_rate, neg(l.tax_cents), neg(l.total_ht_cents), neg(l.total_ttc_cents), l.sort_order ?? 0],
    );
  }
  const refreshed = await getInvoice(id);
  if (refreshed) await renderAndStore(refreshed.invoice, refreshed.lines);
  await recordAudit({ action: "plan_updated", target: `credit_note:${number}`, details: `avoir de ${o.invoice_number ?? originalId}` });
  return id;
}

export async function markInvoicePaid(id: string): Promise<void> {
  assertPg();
  const pool = await getPool();
  await pool.query("UPDATE invoices SET status='paid', paid_at=now(), amount_paid=total_ttc_cents, updated_at=now() WHERE id=$1", [id]);
  await recordAudit({ action: "plan_updated", target: `invoice:${id}`, details: "marquée payée" });

  // Confirmation de paiement (best-effort).
  try {
    const data = await getInvoice(id);
    const inv = data?.invoice;
    if (inv) {
      const contact = await tenantContact(String(inv.tenant_id));
      if (contact) {
        await enqueueMail({
          to: contact.email, toName: contact.name, templateKey: "billing.payment_succeeded",
          category: "billing", tenantId: String(inv.tenant_id), dedupeKey: `invoice_paid:${id}`,
          vars: {
            recipientName: contact.name ?? "",
            amount: fmtMoney(inv.total_ttc_cents, String(inv.currency ?? "EUR")),
            invoiceNumber: String(inv.invoice_number ?? ""),
          },
        });
      }
    }
  } catch { /* notification best-effort */ }
}

export async function voidInvoice(id: string): Promise<void> {
  assertPg();
  const pool = await getPool();
  await pool.query("UPDATE invoices SET status='void', updated_at=now() WHERE id=$1", [id]);
  await recordAudit({ action: "plan_updated", target: `invoice:${id}`, details: "annulée" });
}

/** Lit le PDF/HTML stocké sur disque (pour la route de téléchargement sécurisée). */
export async function readInvoiceFile(invoice: InvoiceRecord, kind: "html" | "pdf"): Promise<Buffer | null> {
  const { readFile } = await import("node:fs/promises");
  const number = (invoice.invoice_number as string) ?? String(invoice.id);
  const file = path.join(getDataDir(), "billing", "invoices", String(invoice.tenant_id), `${number}.${kind}`);
  try {
    return await decryptOnRead(await readFile(file));
  } catch {
    // Régénère à la volée si le fichier manque (et que la facture est émise).
    if (invoice.invoice_number) {
      const data = await getInvoice(String(invoice.id));
      if (data) {
        await renderAndStore(data.invoice, data.lines);
        try { return await decryptOnRead(await readFile(file)); } catch { return null; }
      }
    }
    return null;
  }
}
