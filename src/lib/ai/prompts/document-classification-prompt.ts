/**
 * Règles de classement (type de document) injectées dans le prompt système.
 *
 * Principe : le texte OCR prime ; le nom de fichier n'est qu'un indice faible ;
 * l'ancien ancien classement est un contexte potentiellement FAUX. Ne
 * jamais deviner sans preuve, toujours fournir un niveau de confiance.
 */
export const DOCUMENT_CLASSIFICATION_RULES = `
════════════════════════════════════════════════════
▌ RÈGLES DE TYPE DE DOCUMENT
════════════════════════════════════════════════════

A. Hiérarchie des sources :
   1. Contenu OCR du document = SOURCE DE VÉRITÉ.
   2. Montants, dates et références explicites.
   3. Nom de fichier = INDICE FAIBLE uniquement (jamais décisif).
   4. Ancien type Paperless = potentiellement FAUX (à corriger si contradiction).

B. Proposer un suggestedDocumentTypeName uniquement si une PREUVE TEXTUELLE
   le justifie (sinon null + confidence "low").

════════════════════════════════════════════════════
▌ CAS PRIORITAIRE : BULLETIN DE SALAIRE / PAIE
════════════════════════════════════════════════════
RÈGLE ABSOLUE : dans un bulletin de paie, l'employeur est TOUJOURS
le correspondant principal, jamais les organismes mentionnés dans le corps.

Indice de déclenchement (AU MOINS 3 marqueurs sur 4 familles) :
  □ IDENTITÉ : BULLETIN DE PAIE / EMPLOYEUR / SALARIÉ / SALAIRE
  □ RÉMUNÉRATION : NET À PAYER / NET SOCIAL / BRUT
  □ COTISATIONS : COTISATIONS / SÉCURITÉ SOCIALE / CONVENTION COLLECTIVE
  □ DATES : DATE DE PAIE / PÉRIODE DE PAIE / SIRET

SI déclenché → TOUJOURS :
  - Type : "Bulletin de salaire" (PAS "Avis CAF", PAS "Avis URSSAF")
  - Correspondant : employeur (chercher bloc EMPLOYEUR dans OCR)
  - Tags : salaire, paie, bulletin de salaire, employeur
  - Montant : NET À PAYER (financialImpact kind = "income")
  - URSSAF/CAF/CPAM/Retraite/Prévoyance/Mutuelle = organismes SECONDAIRES
    (mentionnés dans les cotisations, PAS l'émetteur)
  - Confidence = "high" si employeur détecté, "medium" sinon

EMPLOYEUR dans l'OCR : chercher la ligne "EMPLOYEUR :" puis le nom qui suit.
Exemples de noms légitimes :
  - "SAS DE L'HOTEL DU COMMERCE"
  - "SARL X"
  - "Association Y"
  - "Entreprise Z"
Si l'employeur n'est pas lisible → suggestedCorrespondentName = null
(demander une création manuelle), confidence = "medium".

Types INTERDITS pour un bulletin de paie :
  - "Avis CAF"
  - "Courrier CAF"
  - "Notification CAF"
  - "Courrier URSSAF"
  - "Appel de cotisations URSSAF"
  - "Courrier CPAM"
  - "Attestation CPAM"
  - "Avis d'imposition"

════════════════════════════════════════════════════
▌ AUTRES TYPES COURANTS
════════════════════════════════════════════════════
Facture, Avis d'imposition, Taxe foncière, Taxe d'habitation,
Relevé bancaire, Attestation, Contrat, Courrier administratif,
Mise en demeure, Devis, Remboursement, Avis CAF, Relance de paiement.

Respecter la distinction :
  - NATURE (type de document)
  - SUJET (tags)
  - ÉMETTEUR (correspondant)
Ne jamais deviner un type absent du document.
`;
