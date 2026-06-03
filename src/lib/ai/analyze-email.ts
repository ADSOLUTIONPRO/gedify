import "server-only";

import type {
  EmailAnalysis,
  EmailCategory,
  EmailImportance,
  EmailMessageRecord,
} from "@/lib/messaging/email-types";

/**
 * Phase 1 : analyse rule-based locale (pas d'appel OpenAI).
 *
 * Quand le provider IA sera prêt à analyser des emails, on remplacera ce
 * module par un appel à `getActiveAIProvider().analyzeEmail(...)`. La
 * signature publique restera identique pour que l'UI ne change pas.
 */

const CATEGORY_RULES: Array<{ category: EmailCategory; patterns: RegExp[] }> = [
  {
    category: "facture",
    patterns: [
      /\bfacture\b/i,
      /\binvoice\b/i,
      /\bmontant\s+ttc\b/i,
      /\bnet\s+à\s+payer\b/i,
    ],
  },
  {
    category: "relance",
    patterns: [
      /\brelance\b/i,
      /\bmise\s+en\s+demeure\b/i,
      /\bimpay[ée]\b/i,
      /\bhuissier\b/i,
    ],
  },
  {
    category: "banque",
    patterns: [
      /\biban\b/i,
      /\brelev[ée]\s+(de\s+compte|bancaire)/i,
      /\bvirement\b/i,
      /\bpr[ée]l[èe]vement\b/i,
    ],
  },
  {
    category: "assurance",
    patterns: [
      /\bassurance\b/i,
      /\bsinistre\b/i,
      /\bgarantie\b/i,
      /\bpolice\s+(d'?\s*)?assurance/i,
    ],
  },
  {
    category: "sante",
    patterns: [
      /\bcpam\b/i,
      /\bameli\b/i,
      /\battestation\s+de\s+droits\b/i,
      /\bremboursement\s+sant[ée]\b/i,
      /\bm[ée]decin\b/i,
    ],
  },
  {
    category: "administratif",
    patterns: [
      /\bdgfip\b/i,
      /\bcentre\s+des\s+finances\s+publiques\b/i,
      /\bimpots\.gouv\.fr\b/i,
      /\bcaf\b/i,
      /\bcaisse\s+d['’]?allocations\b/i,
      /\bp[oô]le\s+emploi\b/i,
      /\bfrance\s+travail\b/i,
    ],
  },
  {
    category: "juridique",
    patterns: [/\bavocat\b/i, /\bma[iî]tre\b/i, /\bgreffe\b/i, /\btribunal\b/i],
  },
  {
    category: "rendez-vous",
    patterns: [
      /\brendez-?vous\b/i,
      /\bvisio\b/i,
      /\bmeet(ing)?\b/i,
      /\bréunion\b/i,
      /\bcalendrier\b/i,
    ],
  },
  {
    category: "personnel",
    patterns: [/\bfamille\b/i, /\bm[ée]r[ée]\b/i, /\bcousin\b/i],
  },
  {
    category: "spam",
    patterns: [
      /\bunsubscribe\b/i,
      /\bse\s+d[ée]sabonner\b/i,
      /\bpromo(tion)?\b/i,
      /\bnewsletter\b/i,
    ],
  },
];

const DATE_REGEX = /\b(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})\b/;
const AMOUNT_REGEX =
  /(\d{1,3}(?:[\s.]\d{3})*(?:[,.]\d{1,2})?)\s*(€|EUR|euros?)/i;

function detectCategory(haystack: string): EmailCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((re) => re.test(haystack))) return rule.category;
  }
  return "autre";
}

function detectImportance(haystack: string, hasAttachments: boolean): EmailImportance {
  if (/\burgent\b|\bmise\s+en\s+demeure\b|\bimpay[ée]\b/i.test(haystack)) return "urgent";
  if (/\brelance\b|\b[ée]ch[ée]ance\b|\bavant\s+le\b/i.test(haystack)) return "high";
  if (hasAttachments) return "normal";
  if (/\bspam\b|\bunsubscribe\b/i.test(haystack)) return "low";
  return "normal";
}

function summarize(message: EmailMessageRecord, category: EmailCategory): string {
  const fromName = message.from?.name ?? message.from?.email ?? "Inconnu";
  const subject = message.subject ?? "(sans sujet)";
  const attachmentNote =
    message.attachments.filter((a) => !a.inline).length > 0
      ? ` Comporte ${message.attachments.filter((a) => !a.inline).length} pièce(s) jointe(s).`
      : "";
  return `Email de ${fromName} — ${subject}. Catégorie détectée : ${category}.${attachmentNote}`;
}

function detectMeeting(haystack: string): EmailAnalysis["detectedMeeting"] {
  if (!/rendez-?vous|réunion|meeting|visio|appel/i.test(haystack)) return null;
  const dateMatch = haystack.match(DATE_REGEX);
  return {
    date: dateMatch
      ? `${dateMatch[3].length === 2 ? "20" + dateMatch[3] : dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
      : null,
    location: null,
  };
}

function detectBudget(haystack: string, category: EmailCategory): EmailAnalysis["detectedBudget"] {
  const match = haystack.match(AMOUNT_REGEX);
  if (!match) return null;
  const raw = match[1].replace(/[\s.]/g, "").replace(",", ".");
  const amount = Number.parseFloat(raw);
  if (!Number.isFinite(amount)) return null;
  return {
    amount,
    currency: "EUR",
    kind:
      category === "facture"
        ? "invoice"
        : category === "relance"
        ? "debt"
        : category === "banque"
        ? "expense"
        : "other",
  };
}

export function analyzeEmail(message: EmailMessageRecord): EmailAnalysis {
  const haystack = [
    message.subject ?? "",
    message.snippet ?? "",
    message.bodyText.slice(0, 4000),
  ]
    .join("\n")
    .toLowerCase();

  const category = detectCategory(haystack);
  const hasAttachments = message.attachments.some((a) => !a.inline);
  const importance = detectImportance(haystack, hasAttachments);

  const suggestedAction =
    category === "facture"
      ? "Payer la facture après vérification."
      : category === "relance"
      ? "Traiter en priorité : vérifier la dette et payer ou contester."
      : category === "rendez-vous"
      ? "Confirmer le rendez-vous et l'ajouter au calendrier."
      : category === "administratif"
      ? "Lire le courrier et préparer une réponse si nécessaire."
      : hasAttachments
      ? "Importer la pièce jointe dans la GED puis analyser."
      : null;

  return {
    messageId: message.id,
    threadId: message.threadId,
    summary: summarize(message, category),
    category,
    importance,
    suggestedCorrespondentName:
      message.from?.name ?? (message.from?.email ? message.from.email.split("@")[1] : null),
    suggestedProjectName: null,
    suggestedAction,
    detectedMeeting: detectMeeting(haystack),
    detectedBudget: detectBudget(haystack, category),
    suggestedReply: null,
    confidence: category === "autre" ? "low" : hasAttachments ? "high" : "medium",
    createdAt: new Date().toISOString(),
  };
}
