import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brouillons — Messagerie" };

export default async function MessagerieBrouillonsPage() {
  return <MailFolderView query="in:draft" title="Brouillons" />;
}
