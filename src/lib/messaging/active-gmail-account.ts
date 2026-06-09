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

/**
 * Résout le compte Google à utiliser pour une opération CIBLÉE sur un thread
 * (lecture, action, import PJ). En multi-comptes, l'id du thread n'a de sens que
 * pour SON compte → le client passe l'`accountId` du thread. Repli sur le compte
 * actif si l'id demandé est absent/inconnu.
 */
export async function resolveGmailAccount(
  requestedAccountId?: string | null,
): Promise<GmailAccountSummary | null> {
  if (requestedAccountId) {
    const accounts = await listGmailAccounts();
    const match = accounts.find((a) => a.accountId === requestedAccountId);
    if (match) return match;
  }
  return getActiveGmailAccount();
}

/**
 * Comptes Google à afficher dans l'inbox unifiée selon le sélecteur « Boîte
 * active » :
 *  - compte Google précis sélectionné → `{ aggregate:false, [ce compte] }` ;
 *  - boîte IMAP sélectionnée → `{ aggregate:false, [] }` (pas de Gmail à montrer) ;
 *  - « Toutes les boîtes » / absent → `{ aggregate:true, tous les comptes }`,
 *    le plus récent d'abord.
 *
 * Corrige le bug « la 2e boîte remplace la 1re » : par défaut on agrège TOUS les
 * comptes Google au lieu de n'afficher que le plus récent.
 */
export async function getInboxGmailAccounts(): Promise<{
  aggregate: boolean;
  accounts: GmailAccountSummary[];
}> {
  const accounts = await listGmailAccounts();
  if (accounts.length === 0) return { aggregate: false, accounts: [] };

  let selected: string | undefined;
  try {
    selected = (await cookies()).get(ACTIVE_MAILBOX_COOKIE)?.value;
  } catch {
    /* hors contexte requête → ignore */
  }

  if (selected && selected !== "all") {
    const match = accounts.find((a) => a.accountId === selected);
    return match ? { aggregate: false, accounts: [match] } : { aggregate: false, accounts: [] };
  }

  const sorted = [...accounts].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return { aggregate: true, accounts: sorted };
}
