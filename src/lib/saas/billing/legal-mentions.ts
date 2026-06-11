import "server-only";

import type { BillingProfile } from "./profile-store";

/* Construit les mentions légales selon le profil émetteur + le type de pièce.
   Configurable selon le régime TVA (standard / franchise / exonéré /
   autoliquidation / intra-UE). Aucune mention codée en dur non personnalisable :
   `legalFooterHtml`/`termsFooterHtml` du profil priment si renseignés. */

export type LegalMentionsSnapshot = {
  lines: string[];
  vatNotice: string | null;
  paymentTerms: string;
  latePenalties: string;
  recoveryIndemnity: string | null;
  footerHtml: string | null;
};

function vatNotice(regime: string): string | null {
  switch (regime) {
    case "franchise_base":
      return "TVA non applicable, art. 293 B du CGI.";
    case "exempt":
      return "Opération exonérée de TVA.";
    case "reverse_charge":
      return "Autoliquidation — TVA due par le preneur (art. 283-2 du CGI).";
    case "intra_eu":
      return "Livraison/prestation intracommunautaire — autoliquidation par le preneur.";
    default:
      return null; // standard : la TVA figure dans les totaux
  }
}

export function buildLegalMentions(
  profile: BillingProfile,
  opts: { isCreditNote: boolean; isB2B: boolean },
): LegalMentionsSnapshot {
  const lines: string[] = [];
  lines.push(profile.legalName || profile.companyName);
  if (profile.legalForm) lines.push(`Forme juridique : ${profile.legalForm}`);
  if (profile.shareCapital) lines.push(`Capital social : ${profile.shareCapital}`);
  lines.push([profile.addressLine1, profile.addressLine2].filter(Boolean).join(", "));
  lines.push(`${profile.postalCode} ${profile.city}, ${profile.country}`);
  if (profile.siret) lines.push(`SIRET : ${profile.siret}`);
  else if (profile.siren) lines.push(`SIREN : ${profile.siren}`);
  if (profile.rcsNumber || profile.rcsCity) lines.push(`RCS : ${[profile.rcsCity, profile.rcsNumber].filter(Boolean).join(" ")}`);
  if (profile.rmNumber) lines.push(`RM : ${profile.rmNumber}`);
  if (profile.apeNaf) lines.push(`APE/NAF : ${profile.apeNaf}`);
  if (profile.vatNumber) lines.push(`TVA intracommunautaire : ${profile.vatNumber}`);

  const paymentTerms = `Paiement à ${profile.paymentTermsDays} jours.`;
  const rate = profile.latePaymentRate || "trois fois le taux d'intérêt légal";
  const latePenalties = `En cas de retard de paiement, pénalités au taux de ${rate}, exigibles sans rappel.`;
  const recoveryIndemnity = opts.isB2B
    ? `Indemnité forfaitaire pour frais de recouvrement : ${(profile.fixedRecoveryIndemnityCents / 100).toFixed(0)} € (clients professionnels).`
    : null;

  return {
    lines,
    vatNotice: vatNotice(profile.vatRegime),
    paymentTerms,
    latePenalties,
    recoveryIndemnity,
    footerHtml: profile.legalFooterHtml ?? null,
  };
}
