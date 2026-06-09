import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Ancienne route — redirige vers la page intégrée des paramètres Mails. */
export default function MessagerieParametresRedirect() {
  redirect("/messagerie/parametres-emails");
}
