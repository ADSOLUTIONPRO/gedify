import "server-only";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { BillingProfile } from "./profile-store";
import type { LegalMentionsSnapshot } from "./legal-mentions";
import type { RenderInvoice, RenderLine } from "./render-invoice-html";
import { formatCurrency, formatDate } from "./render-invoice-html";

/* PDF de facture via pdf-lib (pas de Chromium requis). Mise en page simple mais
   conforme (émetteur/acheteur, lignes, totaux, mentions légales). */

export async function generateInvoicePdfBytes(
  inv: RenderInvoice,
  lines: RenderLine[],
  profile: BillingProfile,
  mentions: LegalMentionsSnapshot,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cur = inv.currency || "EUR";
  let y = 800;
  const left = 40;
  const right = 555;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = rgb(0.12, 0.16, 0.22)) =>
    page.drawText(s, { x, y: yy, size, font: f, color });
  const rtext = (s: string, xRight: number, yy: number, size = 10, f = font) =>
    page.drawText(s, { x: xRight - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color: rgb(0.12, 0.16, 0.22) });

  const isCredit = inv.type === "credit_note";
  text(isCredit ? "AVOIR" : "FACTURE", left, y, 20, bold, rgb(0.05, 0.45, 0.56));
  rtext(inv.invoiceNumber ?? "(brouillon)", right, y, 12, bold);
  y -= 16;
  rtext(`Émise le ${formatDate(inv.issueDate)}`, right, y, 9);
  y -= 12;
  rtext(`Échéance ${formatDate(inv.dueDate)}`, right, y, 9);

  // Émetteur
  y = 760;
  text(profile.legalName || profile.companyName, left, y, 11, bold);
  y -= 13;
  text(profile.addressLine1, left, y, 9); y -= 11;
  text(`${profile.postalCode} ${profile.city}, ${profile.country}`, left, y, 9); y -= 11;
  if (profile.siret) { text(`SIRET ${profile.siret}`, left, y, 9); y -= 11; }
  else if (profile.siren) { text(`SIREN ${profile.siren}`, left, y, 9); y -= 11; }
  if (profile.vatNumber) { text(`TVA ${profile.vatNumber}`, left, y, 9); y -= 11; }

  // Client
  let yc = 760;
  text("CLIENT", 330, yc, 8, bold, rgb(0.42, 0.45, 0.5)); yc -= 13;
  text(inv.buyerLegalName || inv.buyerName || "—", 330, yc, 10, bold); yc -= 12;
  if (inv.buyerAddressLine1) { text(inv.buyerAddressLine1, 330, yc, 9); yc -= 11; }
  if (inv.buyerPostalCode || inv.buyerCity) { text(`${inv.buyerPostalCode ?? ""} ${inv.buyerCity ?? ""}`, 330, yc, 9); yc -= 11; }
  if (inv.buyerVatNumber) { text(`TVA ${inv.buyerVatNumber}`, 330, yc, 9); yc -= 11; }

  // Lignes
  y = Math.min(y, yc) - 20;
  page.drawRectangle({ x: left, y: y - 4, width: right - left, height: 18, color: rgb(0.95, 0.96, 0.97) });
  text("Désignation", left + 4, y, 9, bold); rtext("Qté", 340, y, 9, bold); rtext("PU HT", 420, y, 9, bold);
  rtext("TVA", 470, y, 9, bold); rtext("Total HT", right - 4, y, 9, bold);
  y -= 20;
  for (const l of lines) {
    text((l.description ?? "").slice(0, 60), left + 4, y, 9);
    rtext(String(l.quantity), 340, y, 9);
    rtext(formatCurrency(l.unitPriceHtCents, cur), 420, y, 9);
    rtext(l.vatRate != null ? `${l.vatRate}%` : "—", 470, y, 9);
    rtext(formatCurrency(l.totalHtCents, cur), right - 4, y, 9);
    y -= 16;
    if (y < 160) { y = 780; doc.addPage([595, 842]); }
  }

  // Totaux
  y -= 8;
  rtext(`Total HT : ${formatCurrency(inv.subtotalHtCents, cur)}`, right - 4, y, 10); y -= 14;
  if (inv.discountCents) { rtext(`Remise : - ${formatCurrency(inv.discountCents, cur)}`, right - 4, y, 10); y -= 14; }
  rtext(`TVA${inv.vatRate != null ? ` (${inv.vatRate}%)` : ""} : ${formatCurrency(inv.taxCents, cur)}`, right - 4, y, 10); y -= 16;
  rtext(`Total TTC : ${formatCurrency(inv.totalTtcCents, cur)}`, right - 4, y, 12, bold); y -= 28;

  // Mentions légales (texte simple wrap)
  const footerLines = [
    ...mentions.lines,
    mentions.paymentTerms,
    mentions.latePenalties,
    ...(mentions.recoveryIndemnity ? [mentions.recoveryIndemnity] : []),
    ...(mentions.vatNotice ? [mentions.vatNotice] : []),
  ];
  for (const fl of footerLines) {
    for (const wrapped of wrap(fl, 110)) {
      if (y < 40) break;
      text(wrapped, left, y, 8, font, rgb(0.42, 0.45, 0.5));
      y -= 10;
    }
  }
  return doc.save();
}

function wrap(s: string, max: number): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) { if (cur) out.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}
