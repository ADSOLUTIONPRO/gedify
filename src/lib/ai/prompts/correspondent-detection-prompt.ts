/**
 * Règles déterministes de détection du correspondant (organisme émetteur)
 * pour les documents administratifs français.
 *
 * Ces règles ne sont PAS interprétées en code : elles sont injectées dans le
 * prompt système de l'IA pour fixer un comportement non-ambigu. Le but est
 * d'éviter les classements grossièrement faux (ex : un avis d'imposition
 * classé "CAF" parce que le mot "allocataire" apparaît marginalement).
 *
 * Toute règle ajoutée ici doit être :
 *  - vérifiable depuis le texte du document (preuves explicites),
 *  - mutuellement exclusive autant que possible (pas deux familles à la fois),
 *  - accompagnée d'une catégorie cible claire.
 */
export const CORRESPONDENT_DETECTION_RULES = `
Règles strictes de classement du correspondant (organisme émetteur).

Tu DOIS justifier le correspondant proposé avec au moins une preuve textuelle
issue du contenu OCR. Si aucune preuve directe n'est trouvée, retourne
suggestedCorrespondentName = null et confidence = "low".

Familles à reconnaître (par ordre de priorité décroissante) :

════════════════════════════════════════════════════
▌ CAS PRIORITAIRE : BULLETIN DE SALAIRE / PAIE
════════════════════════════════════════════════════
SI le document contient AU MOINS 3 marqueurs parmi :
  - "BULLETIN DE PAIE" / "BULLETIN DE SALAIRE" / "PAYE"
  - "EMPLOYEUR" / "SALARIÉ" / "SALAIRE"
  - "NET À PAYER" / "NET SOCIAL" / "BRUT"
  - "COTISATIONS" / "SÉCURITÉ SOCIALE"
  - "DATE DE PAIE" / "PÉRIODE DE PAIE" / "SIRET"
ALORS :
  - documentKind = "Bulletin de salaire" / "Bulletin de paie"
  - TYPE DE DOCUMENT = "Bulletin de salaire"
  - CORRESPONDANT PRINCIPAL = employeur (champ "EMPLOYEUR" dans l'OCR)
  - Ne JAMAIS proposer URSSAF, CAF, CPAM, France Travail, DGFIP comme correspondant
  - Ne JAMAIS proposer "Avis CAF", "Courrier URSSAF", "Avis d'imposition" comme type
  - Tags suggérés : ["salaire", "paie", "bulletin de salaire", "employeur"]
  - Montant principal = "NET À PAYER" (financialImpact kind = "income")
  - secondaryOrganisms (pour info, NON comme correspondant) :
      URSSAF, Sécurité sociale, Retraite, Prévoyance, Mutuelle,
      Impôts (prélèvement à la source), France Travail si présents
  - Confidence = "high" si employer détecté, "medium" sinon

EMPLOYEUR : chercher le texte qui suit immédiatement le mot "EMPLOYEUR"
ou qui précède "SIRET". Exemple : "EMPLOYEUR : SAS DE L'HOTEL DU COMMERCE"
→ correspondant = "SAS DE L'HOTEL DU COMMERCE"
Ne PAS utiliser URSSAF, mutuelle, retraite comme correspondant principal.
Ils apparaissent dans les cotisations, pas dans l'émetteur.

▓▓▓ CAS D'EXCEPTION — URSSAF COMME CORRESPONDANT ▓▓▓
URSSAF peut être correspondant principal UNIQUEMENT si le document
contient explicitement :
  - appel de cotisations URSSAF
  - mise en demeure URSSAF
  - échéancier URSSAF
  - courrier URSSAF
  - déclaration sociale URSSAF
  - échéance de paiement URSSAF
ET ne contient PAS les marqueurs forts de bulletin de paie ci-dessus.

▓▓▓ CAS D'EXCEPTION — CAF COMME CORRESPONDANT ▓▓▓
CAF peut être correspondant principal UNIQUEMENT si le document
contient explicitement :
  - courrier CAF / notification CAF / attestation CAF
  - demande CAF / paiement CAF / APL / RSA / Prime d'activité
  - document allocataire avec mention CAF comme émetteur
ET ne contient PAS les marqueurs forts de bulletin de paie.

▓▓▓ CAS D'EXCEPTION — CPAM COMME CORRESPONDANT ▓▓▓
CPAM peut être correspondant principal UNIQUEMENT si le document
contient explicitement :
  - courrier CPAM / attestation de droits / relevé remboursement santé
  - indemnités journalières / document Assurance Maladie
ET ne contient PAS les marqueurs forts de bulletin de paie.

════════════════════════════════════════════════════
▌ AUTRES FAMILLES
════════════════════════════════════════════════════

[Impôts / Finances publiques]
Indices déclencheurs (au moins UN doit apparaître dans le texte) :
  - "DGFIP"
  - "Direction Générale des Finances Publiques"
  - "Direction générale des finances publiques"
  - "Centre des Finances Publiques"
  - "Service des impôts"
  - "Trésor Public"
  - "impots.gouv.fr"
  - "Avis d'imposition"
  - "Avis d'impôt"
  - "Taxe foncière"
  - "Taxe d'habitation"
  - "Impôt sur le revenu"
  - "Rôle d'impôt"
  - "SIE", "SIP" (services des impôts des entreprises / particuliers)
Si l'un de ces indices apparaît :
  - suggestedCorrespondentName ∈ {"DGFIP", "Centre des Finances Publiques", "Service des impôts"}
  - suggestedDocumentTypeName privilégié : "Avis d'imposition", "Avis de taxe foncière", "Avis de taxe d'habitation", "Courrier impôts"
  - suggestedTagNames inclura "Impôts" et "Administratif"
  - INTERDIT de proposer CAF, CPAM, France Travail, Banque comme correspondant.

[CAF / Allocations Familiales]
Indices déclencheurs requis (au moins UN explicite) :
  - "CAF"
  - "Caisse d'Allocations Familiales"
  - "caf.fr"
  - "Allocations familiales"
  - "APL" (aide personnalisée au logement)
  - "RSA" (revenu de solidarité active)
  - "Prime d'activité"
  - "Prestation familiale"
  - "Allocataire" combiné avec un indice CAF (allocataire seul ne suffit pas)
Si déclenché :
  - suggestedCorrespondentName = "CAF"
  - suggestedTagNames inclura "CAF" et "Administratif"
INTERDIT : ne pas proposer CAF si le seul indice est le mot "allocataire" alors
que le document mentionne aussi DGFIP, impôts, Centre des Finances Publiques ou
"avis d'imposition". Dans ce cas, le correspondant est l'administration fiscale.

[CPAM / Assurance Maladie]
Indices requis :
  - "CPAM"
  - "Caisse Primaire d'Assurance Maladie"
  - "Ameli"
  - "ameli.fr"
  - "Assurance Maladie"
  - "Attestation de droits"
  - "Indemnités journalières"
  - "Remboursement santé"
  - "Carte Vitale"
Si déclenché :
  - suggestedCorrespondentName = "CPAM"
  - suggestedTagNames inclura "Santé" et "Administratif"

[France Travail / Pôle Emploi]
Indices requis :
  - "Pôle Emploi", "Pole Emploi"
  - "France Travail"
  - "ARE" (allocation de retour à l'emploi)
  - "Actualisation mensuelle"
Si déclenché :
  - suggestedCorrespondentName = "France Travail"

[URSSAF]
Indices requis : "URSSAF", "Cotisations sociales", "Travailleur indépendant".

[Banque]
Indices requis (au moins UN explicite) :
  - "Relevé de compte", "Relevé bancaire"
  - "IBAN", "BIC"
  - "Compte bancaire", "Compte courant"
  - "Prélèvement SEPA", "Carte bancaire"
  - Nom de banque clair : "Crédit Agricole", "BNP Paribas", "Société Générale",
    "LCL", "Crédit Mutuel", "CIC", "Banque Populaire", "Caisse d'Épargne",
    "La Banque Postale", "Boursorama", "Fortuneo", "Hello bank", "Revolut",
    "N26", "Qonto"
Si déclenché : suggestedCorrespondentName = nom exact de la banque détectée.

[Notaire / Acte / Vente immobilière]
Indices requis : "Office notarial", "Maître ", "SCP ", "SELARL ",
"Étude de Me ", "Acte authentique", "Compromis de vente", "Acte de vente".
Si déclenché :
  - suggestedCorrespondentName = nom de l'étude / du notaire
  - suggestedTagNames inclura "Notaire", "Juridique"

[Énergie / Fournisseurs]
"EDF", "Engie", "TotalEnergies", "Eni", "Vattenfall" ⇒ correspondant énergie.
"Veolia", "Suez", "SAUR", "SEAFF" ⇒ correspondant eau.

[Télécoms]
"Orange", "SFR", "Bouygues Telecom", "Free", "RED by SFR", "Sosh" ⇒ télécom.

[Justice / Recouvrement]
"Huissier de justice", "Commissaire de justice", "Mise en demeure",
"Sommation de payer", "Injonction de payer" ⇒
  - Le correspondant reste l'organisme créancier (DGFIP, CAF, opérateur…)
    si identifiable. Sinon, l'étude d'huissier.
  - Toujours produire une recommendedAction "pay" ou "contest" avec priorité
    "high" ou "urgent".
  - Toujours produire un financialImpact en kind "debt" si un montant est lisible,
    avec confidence "low" si le montant est ambigu.

Règles transverses :
1. Le contenu OCR du document est la SOURCE DE VÉRITÉ. Le nom du fichier est
   un INDICE FAIBLE ; il ne doit jamais l'emporter contre une preuve OCR.
2. Si le nom du fichier suggère "CAF" mais que le texte mentionne DGFIP /
   impôts / Centre des Finances Publiques, le correspondant reste fiscal.
3. Si le document mentionne plusieurs familles, choisis celle qui apparaît
   dans le bloc émetteur (en-tête, logo, adresse, signature) plutôt que dans
   le corps. En cas de doute, retourne suggestedCorrespondentName = null et
   confidence = "low".
4. Ne JAMAIS deviner un correspondant si aucun indice de la liste ci-dessus
   n'apparaît dans le texte. Préfère null à un faux positif.
5. Toujours inclure le ou les indices déclencheurs dans le champ "summary"
   (ex. "Document émis par la DGFIP — mentionne 'Avis d'imposition 2025'.").
`;
