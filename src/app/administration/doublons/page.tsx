import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * La détection des doublons est une fonction documentaire : déplacée dans
 * l'espace Documents (/documents/doublons). Cette ancienne route ne fait que
 * rediriger (implémentation unique, compat favoris/anciens liens, pas de 404).
 */
export default function AdminDoublonsRedirect() {
  redirect("/documents/doublons");
}
