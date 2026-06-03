import type { PaperlessCorrespondent } from "@/lib/paperless-types";
import type { EmailContactRecord } from "@/lib/messaging/email-types";

/**
 * Calcule un score [0,1] de proximité entre un contact (Google ou email
 * brut) et un correspondant Paperless existant.
 *
 * Heuristiques :
 *  - email exact contre `name` ou pseudo du correspondant ⇒ score ≈ 1
 *  - domaine partagé (ex. `@dgfip.finances.gouv.fr` vs « DGFIP ») ⇒ +0.4
 *  - organization == name ⇒ +0.4
 *  - similarité de nom (tokens en commun) ⇒ +0–0.5
 */
export function scoreContactMatch(
  contact: Pick<EmailContactRecord, "displayName" | "email" | "organization">,
  correspondent: Pick<PaperlessCorrespondent, "name" | "slug">
): { score: number; reason: string } {
  const reasons: string[] = [];
  let score = 0;

  const corrName = (correspondent.name ?? "").toLowerCase().trim();
  if (!corrName) return { score: 0, reason: "Correspondant sans nom." };

  const corrTokens = tokenize(corrName);
  const displayName = (contact.displayName ?? "").toLowerCase().trim();
  const displayTokens = tokenize(displayName);
  const organization = (contact.organization ?? "").toLowerCase().trim();
  const orgTokens = tokenize(organization);
  const email = (contact.email ?? "").toLowerCase().trim();
  const domain = email.includes("@") ? email.split("@").pop() ?? "" : "";

  // 1. Exact display name match.
  if (displayName && displayName === corrName) {
    score += 0.9;
    reasons.push("nom identique");
  } else if (displayTokens.length > 0) {
    const ratio = jaccard(displayTokens, corrTokens);
    if (ratio > 0) {
      score += ratio * 0.5;
      reasons.push(`tokens de nom (${Math.round(ratio * 100)}%)`);
    }
  }

  // 2. Organization match.
  if (organization && organization === corrName) {
    score += 0.7;
    reasons.push("organisation identique");
  } else if (orgTokens.length > 0) {
    const ratio = jaccard(orgTokens, corrTokens);
    if (ratio > 0.3) {
      score += ratio * 0.4;
      reasons.push("organisation similaire");
    }
  }

  // 3. Domain heuristic — only used as a tiebreaker, never alone.
  if (domain && corrTokens.length > 0) {
    const domainTokens = tokenize(domain.replace(/\.[a-z]{2,3}$/, ""));
    const ratio = jaccard(domainTokens, corrTokens);
    if (ratio > 0) {
      score += ratio * 0.2;
      reasons.push("domaine email");
    }
  }

  // Clamp to [0, 1].
  score = Math.min(1, Math.max(0, score));
  return { score, reason: reasons.join(" + ") || "Aucune preuve forte." };
}

/**
 * Trouve la meilleure correspondance dans la liste fournie. Renvoie `null`
 * si aucun correspondant ne dépasse le seuil (par défaut 0.5).
 */
export function findBestCorrespondentMatch(
  contact: Pick<EmailContactRecord, "displayName" | "email" | "organization">,
  correspondents: PaperlessCorrespondent[],
  threshold = 0.5
): { correspondent: PaperlessCorrespondent; score: number; reason: string } | null {
  let best: { correspondent: PaperlessCorrespondent; score: number; reason: string } | null =
    null;
  for (const correspondent of correspondents) {
    const { score, reason } = scoreContactMatch(contact, correspondent);
    if (score >= threshold && (best === null || score > best.score)) {
      best = { correspondent, score, reason };
    }
  }
  return best;
}

/**
 * Trouve toutes les correspondances raisonnables (score >= threshold)
 * triées par score décroissant.
 */
export function findCorrespondentMatches(
  contact: Pick<EmailContactRecord, "displayName" | "email" | "organization">,
  correspondents: PaperlessCorrespondent[],
  threshold = 0.45
): Array<{ correspondent: PaperlessCorrespondent; score: number; reason: string }> {
  return correspondents
    .map((correspondent) => ({
      correspondent,
      ...scoreContactMatch(contact, correspondent),
    }))
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

const STOP_WORDS = new Set([
  "le",
  "la",
  "les",
  "de",
  "du",
  "des",
  "et",
  "ou",
  "sa",
  "sas",
  "sarl",
  "selarl",
  "scp",
  "sci",
  "mr",
  "mme",
  "m",
]);

function tokenize(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
