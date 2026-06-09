import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Page Signatures de l'espace Office supprimée (doublon). La gestion des
 * signatures documentaires se fait dans Documents → Signatures & paraphes
 * (/documents/signatures) ; les signatures mail dans Mails. Cette route
 * redirige vers l'accueil Office (compat favoris, pas de 404).
 */
export default function RedactionSignaturesRedirect() {
  redirect("/redaction");
}
