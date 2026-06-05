import "server-only";

import { cookies } from "next/headers";
import { listGmailAccounts, type GmailAccountSummary } from "@/lib/connectors/gmail/gmail-token-store";

/** Cookie du sélecteur « Boîte active » (id de compte, ou « all »). */
export const ACTIVE_MAILBOX_COOKIE = "gedify_active_mailbox";

/**
 * Résout le compte Google « actif » pour les routes /api/messaging/*.
 *
 * Multi-comptes : le sélecteur « Boîte active » pose un cookie avec l'id choisi.
 *  - id d'un compte Google → ce compte ;
 *  - id d'une boîte IMAP (non Google) → `null` (l'inbox bascule sur la vue IMAP) ;
 *  - « all » / absent → le compte Google le plus récemment connecté.
 *
 * Retourne `null` si aucun compte Google n'est connecté.
 */
export async function getActiveGmailAccount(): Promise<GmailAccountSummary | null> {
  const accounts = await listGmailAccounts();
  if (accounts.length === 0) return null;

  let selected: string | undefined;
  try {
    selected = (await cookies()).get(ACTIVE_MAILBOX_COOKIE)?.value;
  } catch {
    /* hors contexte requête → ignore */
  }

  if (selected && selected !== "all") {
    const match = accounts.find((a) => a.accountId === selected);
    if (match) return match;
    // La boîte choisie n'est pas un compte Google (donc IMAP) → pas de Gmail actif.
    return null;
  }

  // Le plus récemment connecté.
  return accounts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}
