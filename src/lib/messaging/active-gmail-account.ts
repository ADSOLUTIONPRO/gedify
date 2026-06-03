import "server-only";

import { listGmailAccounts, type GmailAccountSummary } from "@/lib/connectors/gmail/gmail-token-store";

/**
 * Résout le compte Gmail OAuth « actif » pour les routes /api/messaging/*.
 *
 * Pour la phase 1, on ne supporte qu'un compte à la fois — le premier
 * connecté. Quand le multi-comptes sera ajouté, ce helper devra lire un
 * paramètre `?account=` ou la session utilisateur.
 *
 * Retourne `null` si aucun compte n'est connecté. L'appelant doit
 * répondre 412 (Precondition Failed) ou afficher l'écran de connexion.
 */
export async function getActiveGmailAccount(): Promise<GmailAccountSummary | null> {
  const accounts = await listGmailAccounts();
  if (accounts.length === 0) return null;
  // Le plus récemment connecté.
  return accounts.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
}
