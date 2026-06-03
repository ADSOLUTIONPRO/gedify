/**
 * Règles d'extraction financière injectées dans le prompt système.
 *
 * Objectif : produire un `financialImpact` fiable (dépense / revenu / dette /
 * échéance / remboursement…) sans jamais inventer de montant ou de date.
 */
export const FINANCIAL_EXTRACTION_RULES = `
Règles strictes d'extraction financière.

- N'extraire QUE des montants explicitement présents dans le texte OCR.
- Ne jamais déduire un montant par calcul si le total n'est pas écrit.
- Chaque montant doit avoir un libellé (label) issu du contexte (ex.
  "Montant à payer", "Net à payer", "Solde", "Remboursement").
- Identifier le type d'impact financier le plus précis :
  expense (dépense), income (revenu), debt (dette), due (échéance),
  refund (remboursement), invoice (facture), subscription (abonnement),
  tax (impôt), allowance/benefit (prestation), loan/credit, fees, other.
- Distinguer la DATE du document de la DATE d'échéance (dueDate) : la dueDate
  n'est renseignée que si une date limite de paiement est explicite.
- Préciser la récurrence (monthly / yearly / one-shot) si le document l'indique
  (mensuel, annuel), sinon null.
- En cas de doute sur un montant, ne pas l'inclure plutôt que d'inventer.

Tout impact financier détecté servira à créer une proposition budgétaire en
statut "à contrôler" — la fiabilité prime sur l'exhaustivité.
`;
