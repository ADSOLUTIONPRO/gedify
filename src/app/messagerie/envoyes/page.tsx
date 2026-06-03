import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Envoyés — Messagerie" };

export default async function MessagerieEnvoyesPage() {
  return <MailFolderView query="in:sent" title="Envoyés" />;
}
