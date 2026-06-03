import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archives — Messagerie" };

// Archivé = présent dans « Tous les messages » mais sans label INBOX (ni envoyé,
// brouillon, corbeille ou spam).
const ARCHIVED_QUERY = "-in:inbox -in:sent -in:draft -in:trash -in:spam -in:chats";

export default async function MessagerieArchivesPage() {
  return (
    <MailFolderView
      query={ARCHIVED_QUERY}
      title="Archives"
      subtitle="Messages archivés (hors boîte de réception)"
    />
  );
}
