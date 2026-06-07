import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";
import type { PageSearchParams } from "@/lib/page-params";
import { firstParam } from "@/lib/page-params";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Courriels à traiter — Messagerie" };

/**
 * « Courriels à traiter » — vue logique UNIFIÉE : tous les courriels de tous les
 * labels/dossiers (hors corbeille/spam/chats), MINUS ceux déjà traités (liés à
 * la GED ou avec PJ importée). Les dossiers Gmail/IMAP techniques ne sont plus
 * exposés dans la navigation (filtre avancé « dossier d'origine » à venir).
 */
const AGGREGATE_QUERY = "-in:trash -in:spam -in:chats";

export default async function MessagerieInboxPage({ searchParams }: { searchParams: PageSearchParams }) {
  const params = await searchParams;
  const q = firstParam(params, "q");
  const query = q && q.trim() ? q.trim() : AGGREGATE_QUERY;
  return <MailFolderView query={query} title="Courriels à traiter" excludeProcessed />;
}
