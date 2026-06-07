import type { Metadata } from "next";
import { MailFolderView } from "@/components/messaging/mail-folder-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Importés en GED — Messagerie" };

/**
 * « Importés en GED » — vue logique des courriels TRAITÉS : liés à la GED
 * (document/dossier/correspondant) ou ayant au moins une pièce jointe importée.
 * Déplacement uniquement logique : les messages restent intacts chez le fournisseur.
 */
export default async function MessagerieImportesPage() {
  return <MailFolderView query="" title="Importés en GED" source="processed" />;
}
