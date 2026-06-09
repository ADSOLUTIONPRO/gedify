import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courriels à traiter — Messagerie" };

/**
 * « Courriels à traiter » — vue logique UNIFIÉE : tous les courriels REÇUS de
 * tous les labels/dossiers autorisés (INBOX + libellés/dossiers personnalisés +
 * archives), MINUS les dossiers système (Envoyés, Brouillons, Spam, Corbeille,
 * Chats) et MINUS ceux déjà traités (liés à la GED ou avec PJ importée).
 *
 * L'exclusion système se fait par les identifiants de dossier Gmail (SENT,
 * DRAFT, SPAM, TRASH, CHATS) — pas par leur nom traduit. Gmail dédoublonne
 * nativement par thread (un message présent dans plusieurs labels n'apparaît
 * qu'une fois).
 */
const AGGREGATE_QUERY = "-in:sent -in:draft -in:trash -in:spam -in:chats";

export default async function MessagerieInboxPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = firstParam(params, "q");
  const accountId = firstParam(params, "accountId");
  const query = q && q.trim() ? q.trim() : AGGREGATE_QUERY;
  return <MailFolderView query={query} title="Courriels à traiter" excludeProcessed accountId={accountId || null} />;
}
