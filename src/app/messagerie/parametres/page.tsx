import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Les paramètres email sont désormais regroupés dans une seule zone :
 * Administration › Emails (/emails) — OAuth Google, comptes Gmail/IMAP,
 * signatures, sécurité et logs. On évite ainsi deux pages concurrentes.
 */
export default function MessagerieParametresRedirect() {
  redirect("/emails");
}
