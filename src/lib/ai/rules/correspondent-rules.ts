/**
 * Règles déterministes de cohérence post-analyse.
 *
 * Ces règles sont évaluées CÔTÉ SERVEUR après le retour du LLM. Elles
 * permettent de :
 *  1. confirmer qu'un correspondant proposé est cohérent avec les marqueurs
 *     présents dans le texte OCR ;
 *  2. invalider une proposition contradictoire (ex. CAF proposé alors que
 *     le document mentionne DGFIP / Centre des Finances Publiques) ;
 *  3. lever une alerte (`warning`) interdisant l'application automatique
 *     tant qu'un humain n'a pas validé.
 *
 * Une règle est dite « strong » quand elle peut écraser la proposition IA
 * (correction automatique + warning consigné). Les autres règles servent
 * uniquement à confirmer ou à signaler.
 */

export type CorrespondentCategory =
  | "impots"
  | "caf"
  | "cpam"
  | "france_travail"
  | "urssaf"
  | "banque"
  | "notaire"
  | "energie"
  | "eau"
  | "telecom"
  | "assurance"
  | "justice"
  | "huissier"
  | "autre_administration"
  | "entreprise"
  | "particulier"
  | "inconnu";

export type CorrespondentRule = {
  /** Identifiant stable (utilisé dans les warnings / les logs). */
  id: string;
  /** Libellé humain (affiché dans l'UI quand le warning est déclenché). */
  description: string;
  /** Marqueurs OCR (au moins UN doit apparaître pour activer la règle). */
  markers: RegExp[];
  /** Catégorie cible imposée par la règle (cf. schéma rich). */
  enforceCategory?: CorrespondentCategory;
  /** Nom canonique proposé pour le correspondant. */
  canonicalName?: string;
  /**
   * Catégories explicitement interdites quand la règle est active.
   * Toute proposition IA dans ces catégories doit lever un warning fort.
   */
  forbiddenCategories?: CorrespondentCategory[];
  /**
   * Patterns sur le nom du correspondant proposé qui doivent déclencher un
   * warning si la règle est active (filtrage par expression régulière sur
   * `suggestedCorrespondentName`).
   */
  forbiddenCorrespondentPatterns?: RegExp[];
  /**
   * `strong` : peut corriger la proposition IA et bloquer l'auto-apply.
   * `medium` : se contente de confirmer / d'attirer l'attention.
   * `weak`   : indice secondaire, jamais utilisé pour corriger.
   */
  weight: "strong" | "medium" | "weak";
};

/**
 * Liste ordonnée des règles évaluées dans l'ordre d'écriture. Quand
 * plusieurs règles `strong` matchent, leur effet s'additionne (les
 * catégories interdites se cumulent, la première qui apporte un
 * `canonicalName` non vide gagne pour la correction).
 */
export const CORRESPONDENT_RULES: CorrespondentRule[] = [
  // --- Impôts / DGFIP / Centre des Finances Publiques ---
  {
    id: "impots-strong",
    description:
      "Document fiscal : DGFIP / Centre des Finances Publiques / Avis d'imposition.",
    markers: [
      /\bDGFIP\b/i,
      /direction\s+g[ée]n[ée]rale\s+des\s+finances\s+publiques/i,
      /centre\s+des\s+finances\s+publiques/i,
      /service\s+des\s+imp[oô]ts/i,
      /impots\.gouv\.fr/i,
      /\bavis\s+d['’]imp[oô]t/i,
      /\bavis\s+d['’]imposition\b/i,
      /\btaxe\s+fonci[èe]re\b/i,
      /\btaxe\s+d['’]habitation\b/i,
      /\bimp[oô]t\s+sur\s+le\s+revenu\b/i,
      /\btr[ée]sor\s+public\b/i,
      /\bSIP\b/,
      /\bSIE\b/,
    ],
    enforceCategory: "impots",
    canonicalName: "Centre des Finances Publiques",
    forbiddenCategories: ["caf", "cpam", "france_travail"],
    forbiddenCorrespondentPatterns: [
      /^\s*CAF\b/i,
      /caisse\s+d['’]?allocations\s+familiales/i,
      /^\s*CPAM\b/i,
      /assurance\s+maladie/i,
      /\bameli\b/i,
      /p[oô]le\s+emploi/i,
      /\bfrance\s+travail\b/i,
    ],
    weight: "strong",
  },

  // --- CAF ---
  {
    id: "caf-strong",
    description:
      "Document CAF : Caisse d'Allocations Familiales / APL / RSA / prime d'activité.",
    markers: [
      /(^|\W)CAF(\W|$)/,
      /caisse\s+d['’]?allocations?\s+familiales?/i,
      /\bcaf\.fr\b/i,
      /\ballocations?\s+familiales?\b/i,
      /\bAPL\b/i,
      /\bRSA\b/i,
      /prime\s+d['’]activit[ée]/i,
      /prestation\s+familiale/i,
    ],
    enforceCategory: "caf",
    canonicalName: "CAF",
    weight: "medium",
  },

  // --- CPAM / Assurance Maladie ---
  {
    id: "cpam-strong",
    description:
      "Document CPAM : Ameli / Assurance Maladie / Attestation de droits.",
    markers: [
      /\bCPAM\b/i,
      /caisse\s+primaire\s+d['’]?assurance\s+maladie/i,
      /\bameli\b/i,
      /ameli\.fr/i,
      /assurance\s+maladie/i,
      /attestation\s+de\s+droits/i,
      /indemnit[ée]s\s+journali[èe]res/i,
      /carte\s+vitale/i,
    ],
    enforceCategory: "cpam",
    canonicalName: "CPAM",
    weight: "medium",
  },

  // --- France Travail / Pôle Emploi ---
  {
    id: "france-travail",
    description: "Pôle Emploi / France Travail / ARE.",
    markers: [
      /p[oô]le\s+emploi/i,
      /\bfrance\s+travail\b/i,
      /\bARE\b/i,
      /actualisation\s+mensuelle/i,
    ],
    enforceCategory: "france_travail",
    canonicalName: "France Travail",
    weight: "medium",
  },

  // --- URSSAF ---
  // IMPORTANT : dans un bulletin de paie, URSSAF est un organisme SECONDAIRE.
  // Il n'est "strong" que si le document est explicitement un courrier URSSAF.
  {
    id: "urssaf",
    description: "URSSAF / cotisations sociales (secondaire dans bulletin de paie).",
    markers: [/\bURSSAF\b/i, /cotisations\s+sociales/i],
    enforceCategory: "urssaf",
    canonicalName: "URSSAF",
    weight: "medium",
  },

  // --- Banque ---
  {
    id: "bank-strong",
    description: "Relevé bancaire / IBAN / nom de banque.",
    markers: [
      /relev[ée]\s+(de\s+compte|bancaire)/i,
      /\bIBAN\b/i,
      /\bBIC\b/i,
      /pr[ée]l[èe]vement\s+SEPA/i,
      /cr[ée]dit\s+agricole/i,
      /\bBNP\s+Paribas\b/i,
      /soci[ée]t[ée]\s+g[ée]n[ée]rale/i,
      /\bLCL\b/i,
      /cr[ée]dit\s+mutuel/i,
      /\bCIC\b/i,
      /banque\s+populaire/i,
      /caisse\s+d['’]?[ée]pargne/i,
      /la\s+banque\s+postale/i,
      /\bboursorama\b/i,
      /\bfortuneo\b/i,
      /\bhello\s*bank\b/i,
    ],
    enforceCategory: "banque",
    weight: "medium",
  },

  // --- Huissier / Justice / Recouvrement ---
  {
    id: "bailiff",
    description:
      "Huissier de justice / commissaire de justice / mise en demeure.",
    markers: [
      /huissier\s+de\s+justice/i,
      /commissaire\s+de\s+justice/i,
      /mise\s+en\s+demeure/i,
      /sommation\s+de\s+payer/i,
      /injonction\s+de\s+payer/i,
    ],
    enforceCategory: "huissier",
    weight: "medium",
  },

  // --- Notaire ---
  {
    id: "notaire-strong",
    description:
      "Office notarial : SCP / SELARL notariale / acte authentique / vente immobilière.",
    markers: [
      /office\s+notarial/i,
      /\bnotaires?\b/i,
      /\bSCP\b[^\n]*notair/i,
      /\bSELARL\b/i,
      /acte\s+(authentique|notari[ée])/i,
      /vente\s+immobili[èe]re/i,
      /compromis\s+de\s+vente/i,
      /[ée]tude\s+de\s+ma[iî]tre/i,
    ],
    enforceCategory: "notaire",
    canonicalName: "Office notarial",
    weight: "strong",
  },

  // --- Assurance ---
  {
    id: "assurance",
    description: "Assureur / mutuelle / contrat d'assurance / sinistre.",
    markers: [
      /\bassurances?\b/i,
      /\bmutuelle\b/i,
      /contrat\s+d['’]assurance/i,
      /\bsinistre\b/i,
      /\bMAIF\b/,
      /\bMACIF\b/,
      /\bMATMUT\b/,
      /\bGroupama\b/i,
      /\bAXA\b/,
      /\bAllianz\b/i,
    ],
    enforceCategory: "assurance",
    weight: "medium",
  },

  // --- Énergie ---
  {
    id: "energie",
    description: "Fournisseur d'énergie : EDF / Engie / électricité / gaz.",
    markers: [
      /\bEDF\b/,
      /\bENGIE\b/i,
      /\bTotalEnergies\b/i,
      /facture\s+d['’]?([ée]lectricit[ée]|gaz)/i,
      /consommation\s+(d['’]?[ée]lectricit[ée]|de\s+gaz)/i,
    ],
    enforceCategory: "energie",
    weight: "medium",
  },

  // --- Télécom ---
  {
    id: "telecom",
    description: "Opérateur télécom : Orange / SFR / Free / Bouygues.",
    markers: [
      /\bSFR\b/,
      /\bFree\s+(Mobile|Telecom)\b/i,
      /\bBouygues\s+Telecom\b/i,
      /forfait\s+mobile/i,
      /abonnement\s+internet/i,
    ],
    enforceCategory: "telecom",
    weight: "weak",
  },
];

/**
 * Liste des marqueurs « faibles » : à eux seuls ils ne suffisent pas à
 * affirmer un correspondant et doivent même DÉCLENCHER un warning si une
 * règle forte concurrente est active (ex. l'IA voit "allocataire" et propose
 * CAF, mais le document est un avis d'imposition mentionnant DGFIP).
 */
export const WEAK_MARKERS_BY_CATEGORY: Record<CorrespondentCategory, RegExp[]> = {
  caf: [/allocataire/i],
  impots: [],
  cpam: [/assur[ée]/i],
  france_travail: [],
  urssaf: [],
  banque: [/\bcompte\b/i],
  notaire: [/\bma[iî]tre\b/i],
  energie: [],
  eau: [],
  telecom: [],
  assurance: [],
  justice: [],
  huissier: [],
  autre_administration: [],
  entreprise: [],
  particulier: [],
  inconnu: [],
};
