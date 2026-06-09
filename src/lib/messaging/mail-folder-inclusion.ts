import "server-only";

import { listGmailLabels } from "@/lib/connectors/gmail/gmail-api";
import { getExcludedFolderNames, listFolderPrefs } from "@/lib/messaging/mail-folder-prefs-store";

/**
 * MailFolderInclusionResolver (§12) — décide, pour chaque dossier/label d'un
 * compte, s'il alimente « Courriels à traiter ».
 *
 * Règles centralisées (jamais dupliquées par provider) :
 *  - libellés système Envoyés/Brouillons/Spam/Corbeille/Chats/Catégories →
 *    EXCLUS et VERROUILLÉS (par identifiant système, pas par nom traduit) ;
 *  - INBOX → INCLUS et verrouillé ;
 *  - libellés utilisateur → INCLUS par défaut, l'utilisateur peut les exclure ;
 *  - labels techniques (IMPORTANT/STARRED/UNREAD…) → masqués de l'UI.
 */

/** Labels Gmail système toujours exclus de « Courriels à traiter ». */
const GMAIL_LOCKED_EXCLUDED = new Set([
  "SENT", "DRAFT", "SPAM", "TRASH", "CHAT",
  "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "CATEGORY_UPDATES",
]);
/** Labels Gmail système toujours inclus. */
const GMAIL_LOCKED_INCLUDED = new Set(["INBOX"]);
/** Labels Gmail techniques non pertinents comme « dossier ». */
const GMAIL_HIDDEN = new Set(["IMPORTANT", "STARRED", "UNREAD", "CATEGORY_PERSONAL"]);

export type ResolvedFolder = {
  id: string;
  name: string;
  /** "system" (verrouillé) ou "user" (modifiable). */
  kind: "system" | "user";
  included: boolean;
  /** Verrouillé = non modifiable par l'utilisateur (dossier système). */
  locked: boolean;
  /** Motif d'exclusion automatique (pour l'UI), si applicable. */
  reason?: string;
};

function gmailReason(id: string): string | undefined {
  if (id === "SENT") return "system_sent_folder";
  if (id === "DRAFT") return "system_draft_folder";
  if (id === "SPAM") return "system_spam_folder";
  if (id === "TRASH") return "system_trash_folder";
  if (id === "CHAT") return "system_chat";
  if (id.startsWith("CATEGORY_")) return "system_category";
  return undefined;
}

/**
 * Liste classée des dossiers d'un compte Gmail (inclus / exclus système / exclus
 * manuellement). Lève les labels techniques. Trie : inclus d'abord, A–Z.
 */
export async function resolveGmailFolders(accountId: string): Promise<ResolvedFolder[]> {
  const [labels, prefs] = await Promise.all([
    listGmailLabels(accountId),
    listFolderPrefs(accountId),
  ]);
  const excludedManual = new Set(prefs.filter((p) => !p.included).map((p) => p.folderId));

  const out: ResolvedFolder[] = [];
  for (const label of labels) {
    if (GMAIL_HIDDEN.has(label.id)) continue;
    if (GMAIL_LOCKED_EXCLUDED.has(label.id)) {
      out.push({ id: label.id, name: label.name, kind: "system", included: false, locked: true, reason: gmailReason(label.id) });
      continue;
    }
    if (GMAIL_LOCKED_INCLUDED.has(label.id)) {
      out.push({ id: label.id, name: label.name, kind: "system", included: true, locked: true });
      continue;
    }
    // Label utilisateur (ou système non listé) : inclus sauf exclusion manuelle.
    out.push({ id: label.id, name: label.name, kind: "user", included: !excludedManual.has(label.id), locked: false });
  }

  return out.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    return a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  });
}

/**
 * Suffixe de requête Gmail excluant les libellés désactivés manuellement pour ce
 * compte (ex. ` -label:"Archives 2024" -label:"Pub"`). Vide si aucun écart.
 */
export async function buildGmailExclusionSuffix(accountId: string): Promise<string> {
  const names = await getExcludedFolderNames(accountId);
  if (names.length === 0) return "";
  return " " + names.map((n) => `-label:"${n.replace(/"/g, "")}"`).join(" ");
}
