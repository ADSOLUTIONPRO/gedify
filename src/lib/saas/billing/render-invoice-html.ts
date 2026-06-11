import "server-only";

import type { BillingProfile } from "./profile-store";
import type { LegalMentionsSnapshot } from "./legal-mentions";

/* Rendu HTML d'une facture — propre, imprimable, compatible PDF. */

export type RenderInvoice = {
  invoiceNumber: string | null;
  type: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  subtotalHtCents: number;
  discountCents: number;
  taxCents: number;
  totalTtcCents: number;
  vatRate: number | null;
  buyerName: string | null;
  buyerLegalName: string | null;
  buyerEmail: string | null;
  buyerAddressLine1: string | null;
  buyerAddressLine2: string | null;
  buyerPostalCode: string | null;
  buyerCity: string | null;
  buyerCountry: string | null;
  buyerVatNumber: string | null;
  buyerSiren: string | null;
  buyerSiret: string | null;
  periodStart: string | null;
  periodEnd: string | null;
};

export type RenderLine = {
  description: string | null;
  quantity: number;
  unitPriceHtCents: number;
  discountCents: number;
  vatRate: number | null;
  totalHtCents: number;
  totalTtcCents: number;
};

export function formatCurrency(cents: number, currency = "EUR"): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency}`;
}
export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";
}
function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export function renderLegalFooter(mentions: LegalMentionsSnapshot): string {
  if (mentions.footerHtml) return mentions.footerHtml;
  const parts = [...mentions.lines.map(esc)];
  parts.push(esc(mentions.paymentTerms), esc(mentions.latePenalties));
  if (mentions.recoveryIndemnity) parts.push(esc(mentions.recoveryIndemnity));
  if (mentions.vatNotice) parts.push(`<strong>${esc(mentions.vatNotice)}</strong>`);
  return parts.join("<br/>");
}

export function renderInvoiceHtml(
  inv: RenderInvoice,
  lines: RenderLine[],
  profile: BillingProfile,
  mentions: LegalMentionsSnapshot,
  primaryColor = "#0E7490",
): string {
  const isCredit = inv.type === "credit_note";
  const title = isCredit ? "AVOIR" : "FACTURE";
  const cur = inv.currency || "EUR";
  const rows = lines
    .map(
      (l) => `<tr>
        <td>${esc(l.description)}</td>
        <td class="r">${l.quantity}</td>
        <td class="r">${formatCurrency(l.unitPriceHtCents, cur)}</td>
        <td class="r">${l.vatRate != null ? `${l.vatRate}%` : "—"}</td>
        <td class="r">${formatCurrency(l.totalHtCents, cur)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(inv.invoiceNumber ?? title)}</title>
<style>
  *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;font-size:13px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  h1{font-size:22px;margin:0;color:${primaryColor}}
  .muted{color:#6b7280}
  .parties{display:flex;justify-content:space-between;gap:24px;margin:16px 0 24px}
  .box{flex:1} .box h3{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{padding:8px;border-bottom:1px solid #e5e7eb;text-align:left} th{font-size:11px;text-transform:uppercase;color:#6b7280}
  .r{text-align:right}
  .totals{margin-top:16px;margin-left:auto;width:280px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{border-top:2px solid ${primaryColor};font-weight:bold;font-size:15px;margin-top:6px;padding-top:8px}
  .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#6b7280;line-height:1.5}
</style></head><body>
  <div class="head">
    <div>
      ${profile.logoUrl ? `<img src="${esc(profile.logoUrl)}" alt="logo" style="max-height:48px"/>` : `<strong style="font-size:16px">${esc(profile.companyName)}</strong>`}
      <div class="muted">${esc(profile.addressLine1)}<br/>${esc(profile.postalCode)} ${esc(profile.city)}</div>
    </div>
    <div style="text-align:right">
      <h1>${title}</h1>
      <div><strong>${esc(inv.invoiceNumber ?? "(brouillon)")}</strong></div>
      <div class="muted">Émise le ${formatDate(inv.issueDate)}</div>
      <div class="muted">Échéance ${formatDate(inv.dueDate)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="box"><h3>Émetteur</h3>
      <strong>${esc(profile.legalName || profile.companyName)}</strong><br/>
      ${esc(profile.addressLine1)}<br/>${esc(profile.postalCode)} ${esc(profile.city)}, ${esc(profile.country)}<br/>
      ${profile.siret ? `SIRET ${esc(profile.siret)}<br/>` : profile.siren ? `SIREN ${esc(profile.siren)}<br/>` : ""}
      ${profile.vatNumber ? `TVA ${esc(profile.vatNumber)}` : ""}
    </div>
    <div class="box"><h3>Client</h3>
      <strong>${esc(inv.buyerLegalName || inv.buyerName)}</strong><br/>
      ${inv.buyerAddressLine1 ? `${esc(inv.buyerAddressLine1)}<br/>` : ""}
      ${inv.buyerPostalCode || inv.buyerCity ? `${esc(inv.buyerPostalCode)} ${esc(inv.buyerCity)}<br/>` : ""}
      ${inv.buyerCountry ? `${esc(inv.buyerCountry)}<br/>` : ""}
      ${inv.buyerSiret ? `SIRET ${esc(inv.buyerSiret)}<br/>` : inv.buyerSiren ? `SIREN ${esc(inv.buyerSiren)}<br/>` : ""}
      ${inv.buyerVatNumber ? `TVA ${esc(inv.buyerVatNumber)}<br/>` : ""}
      ${inv.buyerEmail ? esc(inv.buyerEmail) : ""}
    </div>
  </div>

  ${inv.periodStart || inv.periodEnd ? `<div class="muted">Période : ${formatDate(inv.periodStart)} → ${formatDate(inv.periodEnd)}</div>` : ""}

  <table>
    <thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">TVA</th><th class="r">Total HT</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" class="muted">Aucune ligne</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div><span>Total HT</span><span>${formatCurrency(inv.subtotalHtCents, cur)}</span></div>
    ${inv.discountCents ? `<div><span>Remise</span><span>- ${formatCurrency(inv.discountCents, cur)}</span></div>` : ""}
    <div><span>TVA${inv.vatRate != null ? ` (${inv.vatRate}%)` : ""}</span><span>${formatCurrency(inv.taxCents, cur)}</span></div>
    <div class="grand"><span>Total TTC</span><span>${formatCurrency(inv.totalTtcCents, cur)}</span></div>
  </div>

  <div class="footer">${renderLegalFooter(mentions)}</div>
</body></html>`;
}
