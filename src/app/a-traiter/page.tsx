import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * « À traiter » a sa propre page (même liste/grille/tableau/actions que Tous les
 * documents, filtrée aux documents nécessitant une action) : /documents/a-traiter.
 * Cette ancienne route redirige (compat anciens liens / favoris).
 */
export default function ATraiterPage() {
  redirect("/documents/a-traiter");
}
