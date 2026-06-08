import "server-only";

/* ────────────────────────────────────────────────────────────────────────
   Conventions de titre par famille documentaire + moteur de rendu
   DÉTERMINISTE. Objectif : deux documents de même type reçoivent la MÊME
   structure de titre ; seules les variables (date, émetteur, n°…) changent.
   Le titre n'est PAS une reformulation libre du contenu.
   ──────────────────────────────────────────────────────────────────────── */

const MAX_LEN = 120;

/** Normalise pour le matching : minuscules, sans accents, espaces compacts. */
export function normalizeType(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Conventions (motif `{{variable}}`). Clés = marqueurs cherchés dans le type/kind
 * normalisé (premier marqueur contenu gagne). Variables manquantes = omises.
 */
const CONVENTIONS: { family: string; markers: string[]; pattern: string }[] = [
  { family: "arret_maladie", markers: ["arret de travail", "arret maladie", "avis d arret", "teletransmises"], pattern: "Arrêt maladie {{date}}" },
  { family: "bulletin_salaire", markers: ["bulletin de salaire", "fiche de paie", "bulletin de paie", "paie"], pattern: "Bulletin de salaire {{mois}} {{annee}}" },
  { family: "imposition", markers: ["avis d imposition", "avis d impot", "impot sur le revenu"], pattern: "Avis d'imposition {{annee}}" },
  { family: "taxe", markers: ["taxe fonciere", "taxe d habitation"], pattern: "{{type}} {{annee}}" },
  { family: "releve_bancaire", markers: ["releve bancaire", "releve de compte", "releve"], pattern: "Relevé bancaire {{emetteur}} {{mois}} {{annee}}" },
  { family: "facture", markers: ["facture", "facturation"], pattern: "Facture {{emetteur}} {{reference}} {{date}}" },
  { family: "devis", markers: ["devis"], pattern: "Devis {{emetteur}} {{reference}} {{date}}" },
  { family: "ordonnance", markers: ["ordonnance"], pattern: "Ordonnance {{emetteur}} {{date}}" },
  { family: "contrat", markers: ["contrat", "bail", "location"], pattern: "Contrat {{emetteur}} {{date}}" },
  { family: "convocation", markers: ["convocation"], pattern: "Convocation {{objet}} {{date}}" },
  { family: "attestation", markers: ["attestation"], pattern: "Attestation {{objet}} {{date}}" },
  { family: "quittance", markers: ["quittance", "loyer"], pattern: "Quittance de loyer {{mois}} {{annee}}" },
  { family: "courrier", markers: ["courrier", "lettre"], pattern: "Courrier {{emetteur}} {{objet}}" },
];

/** Famille documentaire détectée dans un texte (type, kind ou titre), ou null. */
export function detectFamily(text: string | null | undefined): string | null {
  const hay = normalizeType(text);
  if (!hay) return null;
  for (const c of CONVENTIONS) {
    if (c.markers.some((m) => hay.includes(m))) return c.family;
  }
  return null;
}

/**
 * Cohérence titre ↔ type (§23) : on ne peut PROUVER l'incohérence que si le
 * titre désigne clairement une AUTRE famille que le type. Sinon on considère
 * cohérent (pas de faux rejet). Ex. type « Arrêt maladie » + titre « Contrat de
 * location » → incohérent (familles arret_maladie ≠ contrat).
 */
export function titleConsistentWithType(title: string, typeName: string | null | undefined, kind?: string | null): boolean {
  const famType = detectFamily(`${typeName ?? ""} ${kind ?? ""}`);
  if (!famType) return true; // type sans famille connue → rien à contredire
  const famTitle = detectFamily(title);
  if (!famTitle) return true; // titre neutre → cohérent
  return famTitle === famType;
}

export type TitleFields = {
  type?: string | null;
  date?: string | null;        // ISO YYYY-MM-DD
  emetteur?: string | null;
  reference?: string | null;
  objet?: string | null;
  banque?: string | null;
};

/** Renvoie le motif applicable au type/kind, ou null si aucune convention. */
export function findTitlePattern(typeName: string | null | undefined, kind?: string | null): string | null {
  const hay = `${normalizeType(typeName)} ${normalizeType(kind)}`.trim();
  if (!hay) return null;
  for (const c of CONVENTIONS) {
    if (c.markers.some((m) => hay.includes(m))) return c.pattern;
  }
  return null;
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

function isoParts(iso: string | null | undefined): { date: string; mois: string; annee: string } {
  if (!iso) return { date: "", mois: "", annee: "" };
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return { date: "", mois: "", annee: "" };
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, mois: MONTHS_FR[d.getMonth()], annee: yyyy };
}

/**
 * Rend un titre déterministe à partir d'un motif et de champs. Variables
 * absentes omises (jamais « Facture undefined null »), séparateurs et espaces
 * nettoyés, longueur bornée.
 */
export function renderDocumentTitle(pattern: string, fields: TitleFields): string {
  const { date, mois, annee } = isoParts(fields.date);
  const values: Record<string, string> = {
    type: (fields.type ?? "").trim(),
    date, mois, annee,
    emetteur: (fields.emetteur ?? "").trim(),
    reference: (fields.reference ?? "").trim(),
    objet: (fields.objet ?? "").trim(),
    banque: (fields.banque ?? fields.emetteur ?? "").trim(),
  };
  let out = pattern.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key] ?? "");
  // Nettoyage : espaces multiples, séparateurs orphelins, capitalise l'initiale.
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([—\-/,;:])\s+/g, " $1 ")
    .replace(/(^[\s—\-/,;:]+)|([\s—\-/,;:]+$)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN).trim();
  return out;
}

/**
 * Déduit un MOTIF de titre à partir d'un titre validé + ses champs variables :
 * « Arrêt maladie 2025-11-13 » + date 2025-11-13 → « Arrêt maladie {{date}} ».
 * On apprend la STRUCTURE, jamais la valeur. Renvoie null si rien à généraliser.
 */
export function inferTitlePattern(title: string | null | undefined, fields: TitleFields): string | null {
  let s = (title ?? "").trim();
  if (s.length < 3) return null;
  const replaceFirst = (hay: string, needle: string, token: string): string => {
    if (!needle || needle.length < 2) return hay;
    const i = hay.toLowerCase().indexOf(needle.toLowerCase());
    return i === -1 ? hay : hay.slice(0, i) + token + hay.slice(i + needle.length);
  };
  // Date : on tente plusieurs représentations issues de l'ISO.
  const iso = fields.date ?? null;
  if (iso) {
    const { date, mois, annee } = isoParts(iso);
    const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const candidates = [date, `${dd}/${mm}/${annee}`, `${dd}-${mm}-${annee}`, `${dd}.${mm}.${annee}`, `${d.getDate()} ${mois} ${annee}`];
    for (const c of candidates) {
      const before = s;
      s = replaceFirst(s, c, "{{date}}");
      if (s !== before) break;
    }
    if (!s.includes("{{date}}") && annee) s = replaceFirst(s, annee, "{{annee}}");
  }
  if (fields.reference) s = replaceFirst(s, fields.reference, "{{reference}}");
  if (fields.emetteur) s = replaceFirst(s, fields.emetteur, "{{emetteur}}");
  // Un motif utile contient au moins une variable, sinon le titre est figé.
  return /\{\{\s*\w+\s*\}\}/.test(s) ? s.replace(/\s{2,}/g, " ").trim() : null;
}

/** Nettoie un nom de fichier en titre lisible (dernier recours). */
export function titleFromFileName(fileName: string | null | undefined): string {
  if (!fileName) return "";
  let s = fileName.replace(/\.[a-z0-9]{1,5}$/i, "");          // extension
  s = s.replace(/[_]+/g, " ").replace(/[-]{2,}/g, " ").trim();
  s = s.replace(/\b\d{6,}\b/g, "").replace(/\s{2,}/g, " ").trim(); // longues séquences de chiffres
  return s.slice(0, MAX_LEN).trim();
}
