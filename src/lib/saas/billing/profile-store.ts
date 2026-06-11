import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/lib/db/pg";
import { postgresActive } from "@/lib/db/pg-store";
import { recordAudit } from "@/lib/audit/audit-store";

/* Profil émetteur (entreprise) pour les factures. Une ligne par défaut suffit. */

export type BillingProfile = {
  id: string;
  profileName: string;
  companyName: string;
  legalName: string | null;
  legalForm: string | null;
  siren: string | null;
  siret: string | null;
  vatNumber: string | null;
  rcsCity: string | null;
  rcsNumber: string | null;
  rmNumber: string | null;
  apeNaf: string | null;
  shareCapital: string | null;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  email: string;
  phone: string | null;
  website: string | null;
  logoUrl: string | null;
  iban: string | null;
  bic: string | null;
  paymentTermsDays: number;
  latePaymentRate: string | null;
  fixedRecoveryIndemnityCents: number;
  vatRegime: string;
  defaultVatRate: number | null;
  invoicePrefix: string;
  creditNotePrefix: string;
  nextInvoiceNumber: number;
  nextCreditNoteNumber: number;
  isDefault: boolean;
  legalFooterHtml: string | null;
  termsFooterHtml: string | null;
};

function row(r: Record<string, unknown>): BillingProfile {
  const num = (v: unknown, d = 0) => (v == null ? d : Number(v));
  return {
    id: String(r.id), profileName: String(r.profile_name ?? ""), companyName: String(r.company_name ?? ""),
    legalName: (r.legal_name as string) ?? null, legalForm: (r.legal_form as string) ?? null,
    siren: (r.siren as string) ?? null, siret: (r.siret as string) ?? null, vatNumber: (r.vat_number as string) ?? null,
    rcsCity: (r.rcs_city as string) ?? null, rcsNumber: (r.rcs_number as string) ?? null, rmNumber: (r.rm_number as string) ?? null,
    apeNaf: (r.ape_naf as string) ?? null, shareCapital: (r.share_capital as string) ?? null,
    addressLine1: String(r.address_line1 ?? ""), addressLine2: (r.address_line2 as string) ?? null,
    postalCode: String(r.postal_code ?? ""), city: String(r.city ?? ""), country: String(r.country ?? "France"),
    email: String(r.email ?? ""), phone: (r.phone as string) ?? null, website: (r.website as string) ?? null,
    logoUrl: (r.logo_url as string) ?? null, iban: (r.iban as string) ?? null, bic: (r.bic as string) ?? null,
    paymentTermsDays: num(r.payment_terms_days, 30), latePaymentRate: (r.late_payment_rate as string) ?? null,
    fixedRecoveryIndemnityCents: num(r.fixed_recovery_indemnity_cents, 4000), vatRegime: String(r.vat_regime ?? "standard"),
    defaultVatRate: r.default_vat_rate == null ? null : Number(r.default_vat_rate),
    invoicePrefix: String(r.invoice_prefix ?? "FAC"), creditNotePrefix: String(r.credit_note_prefix ?? "AVOIR"),
    nextInvoiceNumber: num(r.next_invoice_number, 1), nextCreditNoteNumber: num(r.next_credit_note_number, 1),
    isDefault: r.is_default === true, legalFooterHtml: (r.legal_footer_html as string) ?? null,
    termsFooterHtml: (r.terms_footer_html as string) ?? null,
  };
}

export async function getDefaultBillingProfile(): Promise<BillingProfile | null> {
  if (!postgresActive()) return null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM billing_profiles ORDER BY is_default DESC, created_at LIMIT 1");
    return rows.length ? row(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function getBillingProfile(id: string): Promise<BillingProfile | null> {
  if (!postgresActive()) return null;
  try {
    const pool = await getPool();
    const { rows } = await pool.query("SELECT * FROM billing_profiles WHERE id = $1 LIMIT 1", [id]);
    return rows.length ? row(rows[0]) : null;
  } catch {
    return null;
  }
}

export type BillingProfileInput = Partial<Omit<BillingProfile, "id">> & {
  profileName: string; companyName: string; addressLine1: string; postalCode: string; city: string; email: string;
};

/** Upsert le profil par défaut (un seul profil géré pour l'instant). */
export async function upsertDefaultBillingProfile(input: BillingProfileInput): Promise<void> {
  if (!postgresActive()) throw new Error("Postgres requis.");
  const pool = await getPool();
  const existing = await getDefaultBillingProfile();
  const id = existing?.id ?? randomUUID();
  await pool.query(
    `INSERT INTO billing_profiles
      (id, profile_name, company_name, legal_name, legal_form, siren, siret, vat_number, rcs_city, rcs_number,
       rm_number, ape_naf, share_capital, address_line1, address_line2, postal_code, city, country, email, phone,
       website, logo_url, iban, bic, payment_terms_days, late_payment_rate, fixed_recovery_indemnity_cents,
       vat_regime, default_vat_rate, invoice_prefix, credit_note_prefix, next_invoice_number, next_credit_note_number,
       is_default, legal_footer_html, terms_footer_html)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,true,$34,$35)
     ON CONFLICT (id) DO UPDATE SET
       profile_name=EXCLUDED.profile_name, company_name=EXCLUDED.company_name, legal_name=EXCLUDED.legal_name,
       legal_form=EXCLUDED.legal_form, siren=EXCLUDED.siren, siret=EXCLUDED.siret, vat_number=EXCLUDED.vat_number,
       rcs_city=EXCLUDED.rcs_city, rcs_number=EXCLUDED.rcs_number, rm_number=EXCLUDED.rm_number, ape_naf=EXCLUDED.ape_naf,
       share_capital=EXCLUDED.share_capital, address_line1=EXCLUDED.address_line1, address_line2=EXCLUDED.address_line2,
       postal_code=EXCLUDED.postal_code, city=EXCLUDED.city, country=EXCLUDED.country, email=EXCLUDED.email,
       phone=EXCLUDED.phone, website=EXCLUDED.website, logo_url=EXCLUDED.logo_url, iban=EXCLUDED.iban, bic=EXCLUDED.bic,
       payment_terms_days=EXCLUDED.payment_terms_days, late_payment_rate=EXCLUDED.late_payment_rate,
       fixed_recovery_indemnity_cents=EXCLUDED.fixed_recovery_indemnity_cents, vat_regime=EXCLUDED.vat_regime,
       default_vat_rate=EXCLUDED.default_vat_rate, invoice_prefix=EXCLUDED.invoice_prefix,
       credit_note_prefix=EXCLUDED.credit_note_prefix, legal_footer_html=EXCLUDED.legal_footer_html,
       terms_footer_html=EXCLUDED.terms_footer_html, updated_at=now()`,
    [
      id, input.profileName, input.companyName, input.legalName ?? null, input.legalForm ?? null, input.siren ?? null,
      input.siret ?? null, input.vatNumber ?? null, input.rcsCity ?? null, input.rcsNumber ?? null, input.rmNumber ?? null,
      input.apeNaf ?? null, input.shareCapital ?? null, input.addressLine1, input.addressLine2 ?? null, input.postalCode,
      input.city, input.country ?? "France", input.email, input.phone ?? null, input.website ?? null, input.logoUrl ?? null,
      input.iban ?? null, input.bic ?? null, input.paymentTermsDays ?? 30, input.latePaymentRate ?? null,
      input.fixedRecoveryIndemnityCents ?? 4000, input.vatRegime ?? "standard", input.defaultVatRate ?? null,
      input.invoicePrefix ?? "FAC", input.creditNotePrefix ?? "AVOIR", existing?.nextInvoiceNumber ?? 1,
      existing?.nextCreditNoteNumber ?? 1, input.legalFooterHtml ?? null, input.termsFooterHtml ?? null,
    ],
  );
  await recordAudit({ action: existing ? "tenant_settings_updated" : "plan_created", target: "billing_profile" });
}

/** Profil incomplet ? (pour l'alerte admin) */
export function billingProfileIssues(p: BillingProfile | null): string[] {
  if (!p) return ["Aucun profil de facturation configuré."];
  const out: string[] = [];
  if (!p.siren && !p.siret) out.push("SIREN/SIRET manquant.");
  if (!p.addressLine1 || !p.postalCode || !p.city) out.push("Adresse incomplète.");
  if (p.vatRegime === "standard" && p.defaultVatRate == null) out.push("Taux de TVA par défaut manquant (régime standard).");
  if (!p.invoicePrefix || !p.creditNotePrefix) out.push("Préfixes de numérotation manquants.");
  if (!p.latePaymentRate) out.push("Taux de pénalités de retard non renseigné.");
  return out;
}
