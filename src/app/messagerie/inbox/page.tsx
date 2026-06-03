import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Boîte de réception — Messagerie" };

/** Libellés de dossier selon la requête Gmail (la nav route Spam/Corbeille/Importants ici via ?q=). */
const FOLDER_TITLES: Record<string, string> = {
  "in:inbox": "Boîte de réception",
  "in:trash": "Corbeille",
  "in:spam": "Spam",
  "is:starred": "Importants",
  "is:important": "Importants",
};

export default async function MessagerieInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q && q.trim() ? q.trim() : "in:inbox";
  const title = FOLDER_TITLES[query] ?? "Messages";
  return <MailFolderView query={query} title={title} />;
}
