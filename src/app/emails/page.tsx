import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Les paramètres email sont intégrés à l'espace Mails :
 * /messagerie/parametres-emails (même sidebar, même layout). Cette ancienne
 * route ne fait que rediriger — implémentation unique, pas de duplication.
 * Compatibilité favoris / anciens liens (pas de 404).
 */
export default function EmailsRedirect() {
  redirect("/messagerie/parametres-emails");
}
