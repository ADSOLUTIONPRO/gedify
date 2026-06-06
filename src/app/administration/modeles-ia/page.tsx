import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Les Modèles IA appris vivent désormais dans l'espace Documents. */
export default function AdminModelesIaRedirect() {
  redirect("/documents/modeles-ia");
}
